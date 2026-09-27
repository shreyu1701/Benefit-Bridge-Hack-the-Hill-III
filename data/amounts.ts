/**
 * Published figures used for personal amount estimates (lib/rules/amounts.ts).
 *
 * Every number is copied from the official page in `source_url`, checked on
 * `checked_on`. After `valid_until` the estimate is no longer shown (and a
 * test fails) until someone re-checks the page and updates this file.
 * Not reviewed through /admin: this file changes only through code review.
 */

export const CCB_AMOUNTS = {
  program_id: "ca-ccb",
  source_url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/how-much.html",
  checked_on: "2026-09-27", // page "Date modified: 2026-06-23"
  valid_until: "2027-06-30",
  period: { en: "July 2026 to June 2027 benefit year, based on 2025 family net income", fr: "Année de prestations de juillet 2026 à juin 2027, selon le revenu familial net de 2025" },
  max_under_6: 8157,
  max_6_to_17: 6883,
  threshold_1: 38237,
  threshold_2: 82847,
  /** Index = number of children (1, 2, 3, 4 or more). Phase 2 base = rate1 × (threshold_2 − threshold_1), as published. */
  rate_1: [0, 0.07, 0.135, 0.19, 0.23],
  base_2: [0, 3123, 6022, 8476, 10260],
  rate_2: [0, 0.032, 0.057, 0.08, 0.095],
} as const;

export const CWB_AMOUNTS = {
  program_id: "ca-cwb",
  source_url:
    "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-45300-canada-workers-benefit-cwb/how-much-you-can-get.html",
  checked_on: "2026-09-27", // page "Date modified: 2026-04-08"; figures for Ontario and other provinces except AB, QC, NU
  valid_until: "2027-04-30",
  period: { en: "2025 tax year", fr: "Année d'imposition 2025" },
  provinces_excluded: ["AB", "QC", "NU"],
  // The page publishes the maximum, where reduction starts, and where it reaches zero.
  single: { max: 1633, start: 26855, zero: 37742 },
  family: { max: 2813, start: 30639, zero: 49393 },
} as const;

export const OAS_AMOUNTS = {
  program_id: "ca-oas",
  source_url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/payments.html",
  partial_source_url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/benefit-amount.html",
  checked_on: "2026-09-27", // payments page "Date modified: 2026-08-17": "July to September 2026"
  valid_until: "2026-12-31",
  period: { en: "July to September 2026 rates (adjusted every 3 months)", fr: "Taux de juillet à septembre 2026 (rajustés tous les 3 mois)" },
  max_monthly_65_74: 751.97,
  max_monthly_75_plus: 827.17,
  /** "years lived in Canada ÷ 40" (benefit-amount page). */
  full_years: 40,
} as const;

export const CDB_AMOUNTS = {
  program_id: "ca-cdb",
  source_url: "https://www.canada.ca/en/services/benefits/disability/canada-disability-benefit/amount.html",
  checked_on: "2026-09-27", // page "Date modified: 2026-09-15"
  valid_until: "2027-06-30",
  period: { en: "July 2026 to June 2027, based on 2025 family income", fr: "De juillet 2026 à juin 2027, selon le revenu familial de 2025" },
  max_annual: 2448.4,
  single: { threshold: 23000, working_exemption: 10210, rate: 0.2 },
  /** Couples: 20% if one partner is eligible, 10% if both are. We don't know which, so the ceiling uses 10%. */
  couple: { threshold: 32500, working_exemption: 14294, rate: 0.1 },
} as const;

export const AMOUNT_TABLES = [CCB_AMOUNTS, CWB_AMOUNTS, OAS_AMOUNTS, CDB_AMOUNTS];
