/**
 * Live source verification. Fetches every registered endpoint and program page
 * (politely, allowlisted) and writes docs/SOURCE_VERIFICATION.live.md with the
 * HTTP status, content type, "Date modified", and a sample of the real response.
 *
 *   npm run verify:sources
 *
 * Run this from a network that can reach the government hosts; commit the output.
 */
import { writeFileSync } from "node:fs";
import { SEED_PROGRAMS } from "@/data/programs";
import { SEED_LAWS } from "@/data/laws";
import { TIER1, TIER3, watchedUrlsFor } from "@/data/sources";
import { extractPage } from "@/lib/ingest/page-extract";
import { PoliteFetcher } from "@/lib/sources/fetcher";

const f = new PoliteFetcher(fetch, 1500);

function sample(body: string, type: string | null): string {
  const t = (type ?? "").toLowerCase();
  try {
    if (t.includes("json") || body.trim().startsWith("[") || body.trim().startsWith("{")) {
      const j = JSON.parse(body);
      const first = Array.isArray(j) ? j[0] : j;
      const keys = first && typeof first === "object" ? Object.keys(first) : [];
      return `JSON ${Array.isArray(j) ? `array(${j.length})` : "object"}; keys of first item: ${keys.join(", ")}\n\n${JSON.stringify(first, null, 1).slice(0, 1500)}`;
    }
  } catch {}
  if (t.includes("xml") || body.trim().startsWith("<?xml")) return body.slice(0, 1200);
  const p = extractPage(body);
  return `title: ${p.title}\ndate modified: ${p.dateModified}\n\n${p.text.slice(0, 800)}`;
}

async function main() {
  const targets: { group: string; url: string }[] = [
    { group: "Tier 1", url: TIER1.legisinfo.feedUrl },
    { group: "Tier 1", url: TIER1.ontarioBills.currentBillsUrl },
    ...TIER1.gazette.feeds.map((g) => ({ group: "Tier 1", url: g.url })),
    { group: "Tier 3", url: TIER3.justiceLawsIndex },
    ...TIER3.ckanPortals.map((p) => ({ group: "Tier 3", url: `${p.base}/package_search?q=benefit&rows=1` })),
    ...SEED_LAWS.map((l) => ({ group: "Tier 3 (laws)", url: l.xml_url ?? l.source_url })),
    ...[...new Set(SEED_PROGRAMS.flatMap((p) => watchedUrlsFor(p).map((w) => w.url)))].map((url) => ({ group: "Tier 2 (program pages)", url })),
  ];
  const out: string[] = [`# Live source verification\n\nGenerated ${new Date().toISOString()} by \`npm run verify:sources\`.\n`];
  for (const t of targets) {
    const r = await f.get(t.url, { skipRobots: false });
    const line = `${r.ok ? "OK " : "ERR"} ${r.status} ${t.url}`;
    console.log(line);
    out.push(`## ${t.group}: ${t.url}\n\n- HTTP ${r.status}${r.error ? ` (${r.error})` : ""}\n- Final URL: ${r.finalUrl}\n- Content-Type: ${r.contentType}\n- Last-Modified header: ${r.lastModified ?? "—"}\n\n\`\`\`\n${r.ok ? sample(r.body, r.contentType) : ""}\n\`\`\`\n`);
  }
  writeFileSync("docs/SOURCE_VERIFICATION.live.md", out.join("\n"));
}
main();
