/**
 * Jurisdiction registry. Adding a province or city is a DATA change:
 *   1. add an entry here (and run `npm run db:seed`),
 *   2. add its official domains to `allowedDomains`,
 *   3. add its programs under data/programs/ and its bill source (if any) in data/sources.ts.
 * No engine or UI code needs to change.
 */
export type Level = "federal" | "provincial" | "municipal";

export interface Jurisdiction {
  code: string; // "CA", "ON", "ON-TORONTO"
  level: Level;
  name: { en: string; fr: string };
  parent: string | null;
  province: string | null; // province code for provincial/municipal jurisdictions
  municipality: string | null; // municipality slug for municipal jurisdictions
  /** City names users may type that belong to this municipality (lower-case). */
  cityAliases?: string[];
  /** Official domains we may fetch from for this jurisdiction. */
  allowedDomains: string[];
}

export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: "CA",
    level: "federal",
    name: { en: "Government of Canada", fr: "Gouvernement du Canada" },
    parent: null,
    province: null,
    municipality: null,
    allowedDomains: ["canada.ca", "gc.ca", "parl.ca"],
  },
  {
    code: "ON",
    level: "provincial",
    name: { en: "Government of Ontario", fr: "Gouvernement de l'Ontario" },
    parent: "CA",
    province: "ON",
    municipality: null,
    allowedDomains: ["ontario.ca", "ola.org"],
  },
  {
    code: "ON-TORONTO",
    level: "municipal",
    name: { en: "City of Toronto", fr: "Ville de Toronto" },
    parent: "ON",
    province: "ON",
    municipality: "toronto",
    // The former municipalities amalgamated into the City of Toronto in 1998.
    cityAliases: ["toronto", "north york", "scarborough", "etobicoke", "east york", "york", "old toronto"],
    allowedDomains: ["toronto.ca"],
  },
];

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return JURISDICTIONS.find((j) => j.code === code);
}

/**
 * Map a free-text city to a municipality slug we have data for.
 *  - null     → unknown (we need to ask)
 *  - "other"  → known, but not a municipality we have programs for
 */
export function resolveMunicipality(province: string | null, city: string | null): string | null {
  if (!province) return null;
  if (!city || !city.trim()) return provinceHasMunicipalPrograms(province) ? null : "other";
  const c = city.trim().toLowerCase().replace(/\s+/g, " ");
  for (const j of JURISDICTIONS) {
    if (j.level === "municipal" && j.province === province && j.cityAliases?.includes(c)) return j.municipality;
  }
  return "other";
}

/** Whether a municipality we support exists in this province (so an unknown city matters). */
export function provinceHasMunicipalPrograms(province: string | null): boolean {
  return JURISDICTIONS.some((j) => j.level === "municipal" && j.province === province);
}
