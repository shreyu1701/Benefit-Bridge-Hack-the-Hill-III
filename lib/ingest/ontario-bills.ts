import * as cheerio from "cheerio";
import { sha256 } from "@/lib/sources/fetcher";
import { TIER1 } from "@/data/sources";
import type { BillEvent, NormalizedBill } from "./bills";

/**
 * Legislative Assembly of Ontario (ola.org) — no API, so we scrape politely.
 *
 * Parsing strategy is deliberately structural rather than tied to CSS classes:
 *  - the current session is detected from bill links of the form
 *    /en/legislative-business/bills/parliament-<P>/session-<S>/bill-<N>
 *    (highest P/S wins; never hardcoded)
 *  - on a bill page, the status table is the table whose header mentions a
 *    stage ("Bill stage" / "Stage"); each row is Date | Stage | Event | Outcome.
 * If the markup changes and nothing parses, the job fails loudly (no silent
 * "no bills").
 * NOTE: selectors were written without live access to ola.org — see
 * docs/SOURCE_VERIFICATION.md. Run `npm run fixtures:refresh` and adjust.
 */

const BILL_LINK = /\/en\/legislative-business\/bills\/parliament-(\d+)\/session-(\d+)\/bill-(\d+[a-z]?)\/?$/i;

export interface OlaBillRef {
  parliament: number;
  session: number;
  number: string;
  title: string;
  url: string;
}

export function parseOlaBillList(html: string): { parliament: number; session: number; bills: OlaBillRef[] } {
  const $ = cheerio.load(html);
  const refs = new Map<string, OlaBillRef>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href")!;
    const m = BILL_LINK.exec(href.split("?")[0]);
    if (!m) return;
    const url = new URL(href, TIER1.ontarioBills.origin).toString();
    const title = $(a).text().replace(/\s+/g, " ").trim();
    const key = `${m[1]}-${m[2]}-${m[3]}`;
    const existing = refs.get(key);
    // Several links may point at the same bill (number + title); keep the longest text as title.
    if (!existing || title.length > existing.title.length) {
      refs.set(key, { parliament: Number(m[1]), session: Number(m[2]), number: m[3].toUpperCase(), title, url });
    }
  });
  const all = [...refs.values()];
  if (!all.length) throw new Error("ola.org: no bill links found — page structure changed?");
  const best = all.reduce((a, b) => (b.parliament > a.parliament || (b.parliament === a.parliament && b.session > a.session) ? b : a));
  const bills = all.filter((b) => b.parliament === best.parliament && b.session === best.session);
  return { parliament: best.parliament, session: best.session, bills };
}

function parseOlaDate(s: string): string | null {
  const d = new Date(s.replace(/\s+/g, " ").trim() + " 12:00:00 GMT-0500");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function parseOlaBillPage(html: string, ref: OlaBillRef): { bill: NormalizedBill; events: BillEvent[] } {
  const $ = cheerio.load(html);
  const events: BillEvent[] = [];

  $("table").each((_, t) => {
    const headers = $(t).find("th").map((_, th) => $(th).text().trim().toLowerCase()).get();
    const stageIdx = headers.findIndex((h) => h.includes("stage"));
    const dateIdx = headers.findIndex((h) => h.includes("date"));
    if (stageIdx < 0 || dateIdx < 0) return;
    const eventIdx = headers.findIndex((h) => h === "event" || h.includes("activity"));
    const outcomeIdx = headers.findIndex((h) => h.includes("outcome"));
    $(t).find("tbody tr, tr").each((_, tr) => {
      const cells = $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
      if (cells.length <= Math.max(stageIdx, dateIdx)) return;
      const at = parseOlaDate(cells[dateIdx]);
      if (!at) return;
      const label = [cells[stageIdx], eventIdx >= 0 ? cells[eventIdx] : "", outcomeIdx >= 0 ? cells[outcomeIdx] : ""].filter(Boolean).join(" — ");
      events.push({
        stage: /royal assent/i.test(label) ? "royal_assent" : slug(label).slice(0, 120),
        chamber: "assembly",
        label_en: label,
        label_fr: null,
        occurred_at: at,
        occurred_at_is_detected: false,
      });
    });
  });

  events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const last = events[events.length - 1];
  const royal = events.find((e) => e.stage === "royal_assent");
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const chapter = /Chapter\s+(\d+)\s+of the Statutes of Ontario,?\s*(\d{4})/i.exec($("body").text());

  const core = {
    jurisdiction: TIER1.ontarioBills.jurisdiction,
    bill_number: ref.number,
    parliament: ref.parliament,
    session: ref.session,
    external_id: null,
    titles: { long_en: h1 || ref.title, long_fr: null, short_en: ref.title || h1, short_fr: null },
    current_stage: last?.label_en ?? null,
    current_stage_fr: null,
    status_en: last?.label_en ?? null,
    status_fr: null,
    is_government_bill: null,
    is_session_ongoing: true,
    royal_assent_at: royal?.occurred_at ?? null,
    statute_ref: chapter ? `S.O. ${chapter[2]}, c. ${chapter[1]}` : null,
    source_url: ref.url,
    source_summary: null,
  };
  return { bill: { ...core, content_hash: sha256(JSON.stringify({ core, events })), raw: { events } }, events };
}
