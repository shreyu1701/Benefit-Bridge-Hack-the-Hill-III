import type { ProgramRecord } from "@/lib/rules/types";

/**
 * Source registry for the three freshness tiers. All URLs must pass the
 * allowlist (lib/sources/allowlist.ts). See docs/SOURCE_VERIFICATION.md for
 * the verification status of each endpoint.
 */

export const TIER1 = {
  /** Federal bills. The default feed returns the current session; parliament/session are read from the data. */
  legisinfo: {
    jurisdiction: "CA",
    feedUrl: "https://www.parl.ca/legisinfo/en/bills/json",
    billPageUrl: (parl: number, session: number, number: string) =>
      `https://www.parl.ca/legisinfo/en/bill/${parl}-${session}/${number.toLowerCase()}`,
    intervalMinutes: Number(process.env.LEGISINFO_INTERVAL_MIN ?? 30),
  },
  /** Ontario bills: no API — polite HTML scraping of ola.org. */
  ontarioBills: {
    jurisdiction: "ON",
    currentBillsUrl: "https://www.ola.org/en/legislative-business/bills/current",
    origin: "https://www.ola.org",
    intervalMinutes: Number(process.env.OLA_INTERVAL_MIN ?? 60),
  },
  /** Canada Gazette RSS (regulations = Part II, Acts = Part III). */
  gazette: {
    feeds: [
      { part: "II" as const, url: "https://gazette.gc.ca/rss/p2-eng.xml" },
      { part: "III" as const, url: "https://gazette.gc.ca/rss/p3-eng.xml" }, // UNVERIFIED — see docs
    ],
    intervalMinutes: 60,
  },
} as const;

export const TIER3 = {
  justiceLawsIndex: "https://laws-lois.justice.gc.ca/eng/XML/Legis.xml",
  ckanPortals: [
    { id: "open.canada.ca", base: "https://open.canada.ca/data/api/action" },
    { id: "data.ontario.ca", base: "https://data.ontario.ca/api/3/action" },
    { id: "toronto", base: "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action" },
  ],
  /** Datasets we track (package ids). Adding one is a config change. */
  trackedDatasets: [
    // OAS benefit amounts table (open.canada.ca) — source for GIS thresholds once reviewed.
    { portal: "open.canada.ca", id: "dfa4daf1-669e-4514-82cd-982f27707ed0" },
  ],
  intervalHours: 24 * 7,
} as const;

/** Tier 2: every distinct official page a program's facts depend on is watched. */
export function watchedUrlsFor(p: ProgramRecord): { url: string; intervalHours: number }[] {
  const urls = new Set<string>([p.source_url, p.application_url]);
  for (const c of p.eligibility_rules.criteria) urls.add(c.source_url);
  if (p.benefit_amount) urls.add(p.benefit_amount.source_url);
  for (const d of p.deadlines) urls.add(d.source_url);
  // Federal benefit pages change more often around July (benefit year) → check more often.
  const intervalHours = p.level === "federal" ? 6 : p.level === "provincial" ? 12 : 24;
  return [...urls].map((url) => ({ url, intervalHours }));
}
