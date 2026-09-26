/**
 * Save REAL responses as test fixtures (run where the government hosts are reachable):
 *   npm run fixtures:refresh
 * Writes tests/fixtures/legisinfo-bills.real.json (enables the real-feed tests),
 * a real canada.ca page, and the ola.org current-bills page for selector checks.
 */
import { writeFileSync } from "node:fs";
import { TIER1 } from "@/data/sources";
import { PoliteFetcher } from "@/lib/sources/fetcher";

const f = new PoliteFetcher(fetch, 1500);
const save = async (url: string, file: string) => {
  const r = await f.get(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${r.error ?? ""}`);
  writeFileSync(`tests/fixtures/${file}`, r.body);
  console.log(`saved ${file} (${r.body.length} bytes)`);
};

(async () => {
  await save(TIER1.legisinfo.feedUrl, "legisinfo-bills.real.json");
  await save("https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/who-apply.html", "canada-ca-ccb-who-apply.real.html");
  await save(TIER1.ontarioBills.currentBillsUrl, "ola-current-bills.real.html");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
