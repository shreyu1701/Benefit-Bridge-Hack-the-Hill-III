import { JURISDICTIONS } from "@/data/jurisdictions";

/**
 * Only official government domains may be fetched or cited. News sites,
 * blogs, aggregators and LLM knowledge are never a source for program facts.
 *
 * A host matches if it equals an allowed domain or is a subdomain of it
 * (e.g. "www.canada.ca", "laws-lois.justice.gc.ca" via "gc.ca").
 */
const EXTRA_OFFICIAL_DOMAINS = [
  "open.canada.ca", // Open Government Portal (covered by canada.ca, listed for clarity)
  "data.ontario.ca", // Ontario Data Catalogue
  "ckan0.cf.opendata.inter.prod-toronto.ca", // City of Toronto Open Data CKAN API host
];

export function allowedDomains(): string[] {
  return [...new Set([...JURISDICTIONS.flatMap((j) => j.allowedDomains), ...EXTRA_OFFICIAL_DOMAINS])];
}

export function isAllowedHost(host: string, domains = allowedDomains()): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return domains.some((d) => h === d || h.endsWith("." + d));
}

export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && isAllowedHost(u.hostname);
  } catch {
    return false;
  }
}

export class DisallowedSourceError extends Error {
  constructor(url: string) {
    super(`Refusing to fetch non-allowlisted source: ${url}`);
  }
}
