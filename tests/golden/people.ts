import { emptyFacts, type Facts } from "@/lib/facts/schema";
import type { Confidence } from "@/lib/rules/types";

/**
 * Golden set: made-up people with the result we expect for EVERY program.
 *
 * Each expectation was worked out by hand from the program's official page
 * (the `source_url` on each criterion in data/programs.ts; the test prints it on
 * failure). If a rule change flips one of these, CI fails and the change needs a
 * reviewer to confirm the new answer against the official page.
 *
 * L = likely, P = possibly, N = not eligible.
 */
export type Code = "L" | "P" | "N";
export const CODE: Record<Code, Confidence> = { L: "likely", P: "possibly", N: "not_eligible" };

export interface GoldenPerson {
  name: string;
  facts: Facts;
  expect: Record<ProgramId, Code>;
}

type ProgramId =
  | "ca-ccb" | "ca-cgeb" | "ca-cdcp" | "ca-cwb" | "ca-oas" | "ca-gis"
  | "on-otb" | "on-child-care-fee-reduction" | "on-osap" | "on-ow" | "to-fair-pass";

const f = (x: Partial<Facts>): Facts => ({ ...emptyFacts(), ...x });

/** A fully described Toronto single parent; other people vary from here. */
const torontoParent = f({
  province: "ON", city: "Toronto", age: 29, has_partner: false, children_ages: [2, 4],
  family_income_band: "25k_35k", residency_status: "permanent_resident", years_in_canada: 5,
  employment_status: "employed", disability: false, student_status: "none", has_dental_insurance: false,
  housing: "rent", receives_social_assistance: false, files_taxes: true,
});
const torontoParentExpect: GoldenPerson["expect"] = {
  "ca-ccb": "L", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "L", "ca-oas": "N", "ca-gis": "N",
  // OTB, OW, CGEB: income or need rules are unverified data gaps, so "possibly" is the best they can be.
  "on-otb": "P", "on-child-care-fee-reduction": "L", "on-osap": "N", "on-ow": "P",
  // Fair Pass: only household sizes 1 and 4 have verified limits; this household is 3.
  "to-fair-pass": "P",
};

const senior = f({
  province: "ON", city: "Toronto", age: 70, has_partner: false, children_ages: [],
  family_income_band: "under_15k", residency_status: "citizen", years_in_canada: 70,
  employment_status: "retired", disability: false, student_status: "none", has_dental_insurance: false,
  housing: "rent", receives_social_assistance: false, files_taxes: true,
});

const bcFamily = f({
  province: "BC", city: "Vancouver", age: 40, has_partner: true, children_ages: [10],
  family_income_band: "80k_90k", residency_status: "citizen", years_in_canada: 40,
  employment_status: "employed", disability: false, student_status: "none", has_dental_insurance: false,
  housing: "own", receives_social_assistance: false, files_taxes: true,
});
const bcFamilyExpect: GoldenPerson["expect"] = {
  "ca-ccb": "L", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
  "on-otb": "N", "on-child-care-fee-reduction": "N", "on-osap": "N", "on-ow": "N", "to-fair-pass": "N",
};

const ottawaTempWorker = f({
  province: "ON", city: "Ottawa", age: 30, has_partner: true, children_ages: [3],
  family_income_band: "50k_70k", residency_status: "temporary_worker", years_in_canada: 1,
  employment_status: "employed", disability: false, student_status: "none", has_dental_insurance: false,
  housing: "rent", receives_social_assistance: false, files_taxes: true,
});

export const GOLDEN_PEOPLE: GoldenPerson[] = [
  {
    name: "Toronto single parent, 2 kids under 6, $25–35k, PR, files taxes",
    facts: torontoParent,
    expect: torontoParentExpect,
  },
  {
    name: "Same parent, has NOT filed taxes: tax-paid benefits drop to possibly, never to not eligible",
    facts: { ...torontoParent, files_taxes: false },
    expect: { ...torontoParentExpect, "ca-ccb": "P", "ca-cdcp": "P", "ca-cwb": "P" },
  },
  {
    name: "Same parent, tax filing unknown: tax-paid benefits are possibly",
    facts: { ...torontoParent, files_taxes: null },
    expect: { ...torontoParentExpect, "ca-ccb": "P", "ca-cdcp": "P", "ca-cwb": "P" },
  },
  {
    name: "Same parent with a disability: the CWB disability supplement limits are a data gap",
    facts: { ...torontoParent, disability: true },
    expect: { ...torontoParentExpect, "ca-cwb": "P" },
  },
  {
    name: "Toronto couple, 4 people, $25–35k, has dental insurance: Fair Pass size-4 limit applies",
    facts: { ...torontoParent, age: 35, has_partner: true, children_ages: [1, 7], residency_status: "citizen", years_in_canada: 35, has_dental_insurance: true },
    expect: { ...torontoParentExpect, "ca-cdcp": "N", "to-fair-pass": "L" },
  },
  {
    name: "Toronto senior, 70, citizen all their life, under $15k",
    facts: senior,
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "L", "ca-gis": "P",
      "on-otb": "P", "on-child-care-fee-reduction": "N", "on-osap": "N", "on-ow": "P", "to-fair-pass": "N",
    },
  },
  {
    name: "Senior, 68, PR for 8 years: under the 10-year OAS residence rule",
    facts: { ...senior, age: 68, residency_status: "permanent_resident", years_in_canada: 8 },
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
      "on-otb": "P", "on-child-care-fee-reduction": "N", "on-osap": "N", "on-ow": "P", "to-fair-pass": "N",
    },
  },
  {
    name: "Age edge 64: Fair Pass yes (20–64), OAS not yet",
    facts: { ...senior, age: 64, years_in_canada: 64, employment_status: "employed", has_dental_insurance: true },
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "N", "ca-cwb": "L", "ca-oas": "N", "ca-gis": "N",
      "on-otb": "P", "on-child-care-fee-reduction": "N", "on-osap": "N", "on-ow": "P", "to-fair-pass": "L",
    },
  },
  {
    name: "Age edge 65: OAS yes, Fair Pass no",
    facts: { ...senior, age: 65, years_in_canada: 65, employment_status: "employed", has_dental_insurance: true },
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "N", "ca-cwb": "L", "ca-oas": "L", "ca-gis": "P",
      "on-otb": "P", "on-child-care-fee-reduction": "N", "on-osap": "N", "on-ow": "P", "to-fair-pass": "N",
    },
  },
  {
    name: "Ottawa temporary worker, 12 months in Canada: CCB needs 18 months; not a Toronto resident",
    facts: ottawaTempWorker,
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
      "on-otb": "P", "on-child-care-fee-reduction": "L", "on-osap": "N", "on-ow": "P", "to-fair-pass": "N",
    },
  },
  {
    name: "Same temporary worker after 2 years: CCB likely",
    facts: { ...ottawaTempWorker, years_in_canada: 2 },
    expect: {
      "ca-ccb": "L", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
      "on-otb": "P", "on-child-care-fee-reduction": "L", "on-osap": "N", "on-ow": "P", "to-fair-pass": "N",
    },
  },
  {
    name: "Toronto refugee claimant, one child of 5, not working",
    facts: { ...torontoParent, age: 26, children_ages: [5], family_income_band: "under_15k", residency_status: "refugee_claimant", years_in_canada: 1, employment_status: "unemployed" },
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "L", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
      "on-otb": "P", "on-child-care-fee-reduction": "L", "on-osap": "N", "on-ow": "P", "to-fair-pass": "P",
    },
  },
  {
    name: "Toronto full-time student, 21, no kids, $15–25k: OSAP likely, CWB excludes full-time students",
    facts: { ...torontoParent, age: 21, children_ages: [], family_income_band: "15k_25k", years_in_canada: 10, student_status: "post_secondary_full_time", has_dental_insurance: true },
    expect: {
      "ca-ccb": "N", "ca-cgeb": "P", "ca-cdcp": "N", "ca-cwb": "N", "ca-oas": "N", "ca-gis": "N",
      // Fair Pass: $15–25k straddles the $20,514 size-1 limit, so we can't tell.
      "on-otb": "P", "on-child-care-fee-reduction": "N", "on-osap": "L", "on-ow": "P", "to-fair-pass": "P",
    },
  },
  {
    name: "BC family of 3, $80–90k: CDCP just under $90k, nothing provincial or municipal",
    facts: bcFamily,
    expect: bcFamilyExpect,
  },
  {
    name: "Same BC family at $90–120k: CDCP not eligible",
    facts: { ...bcFamily, family_income_band: "90k_120k" },
    expect: { ...bcFamilyExpect, "ca-cdcp": "N" },
  },
  {
    name: "Only the city is known: everything is possibly, nothing is ruled out",
    facts: f({ province: "ON", city: "Toronto" }),
    expect: {
      "ca-ccb": "P", "ca-cgeb": "P", "ca-cdcp": "P", "ca-cwb": "P", "ca-oas": "P", "ca-gis": "P",
      "on-otb": "P", "on-child-care-fee-reduction": "P", "on-osap": "P", "on-ow": "P", "to-fair-pass": "P",
    },
  },
];
