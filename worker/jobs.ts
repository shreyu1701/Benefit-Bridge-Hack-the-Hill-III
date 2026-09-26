import * as cheerio from "cheerio";
import { TIER1, TIER3 } from "@/data/sources";
import { PgBillStore } from "@/lib/db/bill-store";
import { PgPageWatchStore } from "@/lib/db/page-watch-store";
import { query } from "@/lib/db/pool";
import { applyBill } from "@/lib/ingest/bills";
import { parseGazetteRss } from "@/lib/ingest/gazette";
import { ingestLegisinfo } from "@/lib/ingest/legisinfo";
import { parseOlaBillList, parseOlaBillPage } from "@/lib/ingest/ontario-bills";
import { extractPage } from "@/lib/ingest/page-extract";
import { runPageWatch } from "@/lib/ingest/page-watch";
import { getLlm, hasLlm } from "@/lib/llm/client";
import { summarizeOfficialText } from "@/lib/llm/tasks";
import { PoliteFetcher, sha256 } from "@/lib/sources/fetcher";

export const fetcher = new PoliteFetcher();
const log = (job: string, ...a: unknown[]) => console.log(new Date().toISOString(), `[${job}]`, ...a);

// ---------------------------------------------------------------- Tier 1 ----

export async function legisinfoJob() {
  // Documented machine-readable feed; robots.txt still honoured by default.
  const res = await fetcher.get(TIER1.legisinfo.feedUrl);
  if (!res.ok) throw new Error(`LEGISinfo feed HTTP ${res.status} ${res.error ?? ""}`);
  const stats = await ingestLegisinfo(new PgBillStore(), JSON.parse(res.body));
  log("legisinfo", stats);
  // Tier 3 refresh is triggered when a bill becomes law.
  if (stats.royal_assents_new.length) await referenceLawsJob({ force: true });
  return stats;
}

export async function ontarioBillsJob() {
  const list = await fetcher.get(TIER1.ontarioBills.currentBillsUrl);
  if (!list.ok) throw new Error(`ola.org bills list HTTP ${list.status} ${list.error ?? ""}`);
  const { parliament, session, bills } = parseOlaBillList(list.body);
  const store = new PgBillStore();
  let changed = 0;
  let royal = 0;
  for (const ref of bills) {
    const page = await fetcher.get(ref.url); // rate-limited per host by PoliteFetcher
    if (!page.ok) continue;
    const { bill, events } = parseOlaBillPage(page.body, ref);
    const r = await applyBill(store, bill, events, new Date());
    if (r.changed) changed++;
    if (r.newRoyalAssent) royal++;
  }
  log("ontario-bills", { parliament, session, bills: bills.length, changed, royal });
  if (royal) await referenceLawsJob({ force: true });
}

export async function gazetteJob() {
  for (const feed of TIER1.gazette.feeds) {
    const res = await fetcher.get(feed.url);
    if (!res.ok) {
      log("gazette", `Part ${feed.part} feed unavailable: HTTP ${res.status} ${res.error ?? ""}`);
      continue;
    }
    const items = parseGazetteRss(res.body, feed.part);
    for (const i of items) {
      await query(
        `INSERT INTO gazette_items (guid, part, title, link, description, published_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (guid) DO NOTHING`,
        [i.guid, i.part, i.title, i.link, i.description, i.published_at],
      );
    }
    log("gazette", `Part ${feed.part}: ${items.length} items`);
  }
}

/** Plain-language bill summaries (LLM over official text only). */
export async function billSummariesJob(limit = 10) {
  if (!hasLlm()) return log("bill-summaries", "skipped: no GEMINI_API_KEY");
  const llm = getLlm();
  const rows = await query<{ id: string; jurisdiction_code: string; bill_number: string; parliament: number; session: number; source_url: string; raw: Record<string, unknown>; royal_assent_at: string | null }>(
    `SELECT id, jurisdiction_code, bill_number, parliament, session, source_url, raw, royal_assent_at
       FROM bills WHERE summary IS NULL ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );
  for (const b of rows) {
    const src = await officialBillText(b);
    if (!src) {
      log("bill-summaries", `${b.bill_number}: no official text available yet`);
      continue;
    }
    const summary: Record<string, unknown> = { source_url: src.url, generated_at: new Date().toISOString(), machine_generated: true };
    for (const lang of ["en", "fr"]) {
      summary[lang] = await summarizeOfficialText(llm, {
        sourceText: src.text, sourceUrl: src.url, language: lang, kind: "bill", hasRoyalAssent: Boolean(b.royal_assent_at),
      });
    }
    await query(`UPDATE bills SET summary = $2, summary_source_url = $3 WHERE id = $1`, [b.id, summary, src.url]);
    log("bill-summaries", `${b.bill_number}: summarized from ${src.url}`);
  }
}

/**
 * Official text to summarize, in order of preference:
 *  1. the feed's own ShortLegislativeSummary
 *  2. the Library of Parliament legislative summary (federal)
 *  3. the bill's official page text (LEGISinfo / ola.org)
 */
async function officialBillText(b: { jurisdiction_code: string; bill_number: string; parliament: number; session: number; source_url: string; raw: Record<string, unknown> }) {
  const feedSummary = (b.raw?.ShortLegislativeSummaryEn as string | undefined)?.trim();
  if (feedSummary) return { url: b.source_url, text: stripHtml(feedSummary) };

  if (b.jurisdiction_code === "CA") {
    const [chamber, num] = b.bill_number.split("-");
    const lop = `https://lop.parl.ca/sites/PublicWebsite/default/en_CA/ResearchPublications/LegislativeSummaries/${b.parliament}${b.session}${chamber}${num}E`;
    const r = await fetcher.get(lop);
    if (r.ok) {
      const p = extractPage(r.body);
      if (p.text.length > 500) return { url: lop, text: p.text };
    }
  }
  const page = await fetcher.get(b.source_url);
  if (page.ok) {
    const p = extractPage(page.body);
    if (p.text.length > 200) return { url: b.source_url, text: p.text };
  }
  return null;
}

const stripHtml = (s: string) => cheerio.load(s).text().replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- Tier 2 ----

export async function pageWatchJob() {
  const results = await runPageWatch({ store: new PgPageWatchStore(), fetcher, llm: hasLlm() ? getLlm() : null });
  const tally = results.reduce<Record<string, number>>((a, r) => ((a[r.outcome] = (a[r.outcome] ?? 0) + 1), a), {});
  log("page-watch", tally);
}

// ---------------------------------------------------------------- Tier 3 ----

export async function referenceLawsJob(opts: { force?: boolean } = {}) {
  const laws = await query<{ id: string; source_url: string; xml_url: string | null; content_hash: string | null; fetched_at: Date | null }>(
    `SELECT id, source_url, xml_url, content_hash, fetched_at FROM laws
      WHERE $1 OR fetched_at IS NULL OR fetched_at < now() - make_interval(hours => $2)`,
    [Boolean(opts.force), TIER3.intervalHours],
  );
  for (const l of laws) {
    const url = l.xml_url ?? l.source_url;
    const r = await fetcher.get(url);
    if (!r.ok) {
      log("reference-laws", `${l.id}: HTTP ${r.status} ${r.error ?? ""}`);
      continue;
    }
    // Justice Laws XML carries consolidation metadata as root attributes.
    const current = /current-date="(\d{4}-\d{2}-\d{2})"/.exec(r.body)?.[1] ?? null;
    const amended = /lastAmendedDate="(\d{4}-\d{2}-\d{2})"/.exec(r.body)?.[1] ?? null;
    const hash = l.xml_url ? sha256(r.body) : extractPage(r.body).hash;
    await query(
      `UPDATE laws SET fetched_at = now(), content_hash = $2, current_to = COALESCE($3::date, current_to),
                       last_amended_on = COALESCE($4::date, last_amended_on) WHERE id = $1`,
      [l.id, hash, current, amended],
    );
    if (l.content_hash && l.content_hash !== hash) log("reference-laws", `${l.id}: consolidated text changed`);
  }

  for (const d of TIER3.trackedDatasets) {
    const portal = TIER3.ckanPortals.find((p) => p.id === d.portal)!;
    const r = await fetcher.get(`${portal.base}/package_show?id=${encodeURIComponent(d.id)}`, { skipRobots: true });
    if (!r.ok) continue;
    const pkg = JSON.parse(r.body)?.result;
    if (!pkg) continue;
    await query(
      `INSERT INTO reference_datasets (portal, dataset_id, title, url, metadata_modified, content_hash, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (portal, dataset_id) DO UPDATE SET title=$3, url=$4, metadata_modified=$5, content_hash=$6, raw=$7, fetched_at=now()`,
      [d.portal, d.id, pkg.title?.en ?? pkg.title ?? null, `${portal.base}/package_show?id=${d.id}`, pkg.metadata_modified ?? null, sha256(r.body), pkg],
    );
  }
  log("reference-laws", `checked ${laws.length} laws, ${TIER3.trackedDatasets.length} datasets`);
}
