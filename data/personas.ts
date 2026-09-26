import type { Facts } from "@/lib/facts/schema";
import type { Localized } from "@/lib/rules/types";

/**
 * Illustrative personas. Their scenarios are computed by the SAME rules engine
 * over the SAME approved program data — nothing about them is invented by an LLM.
 * They are always labelled "illustrative example" in the UI.
 */
export interface Persona {
  id: string;
  name: string;
  blurb: Localized;
  facts: Facts;
}

const base: Facts = {
  province: "ON",
  city: null,
  age: null,
  has_partner: null,
  children_ages: null,
  household_size: null,
  family_income_band: null,
  residency_status: null,
  years_in_canada: null,
  employment_status: null,
  disability: false,
  student_status: "none",
  has_dental_insurance: null,
  housing: null,
  receives_social_assistance: false,
};

export const PERSONAS: Persona[] = [
  {
    id: "priya",
    name: "Priya",
    blurb: {
      en: "Priya, 34, newcomer renting in Mississauga with her partner and a 3-year-old",
      fr: "Priya, 34 ans, nouvelle arrivante locataire à Mississauga avec son partenaire et un enfant de 3 ans",
    },
    facts: {
      ...base, city: "Mississauga", age: 34, has_partner: true, children_ages: [3],
      family_income_band: "50k_70k", residency_status: "permanent_resident", years_in_canada: 2,
      employment_status: "employed", has_dental_insurance: false, housing: "rent",
    },
  },
  {
    id: "maria",
    name: "Maria",
    blurb: {
      en: "Maria, 29, single mom in Toronto with two kids under 6, working part-time",
      fr: "Maria, 29 ans, mère seule à Toronto avec deux enfants de moins de 6 ans, travaille à temps partiel",
    },
    facts: {
      ...base, city: "Toronto", age: 29, has_partner: false, children_ages: [2, 4], household_size: 3,
      family_income_band: "25k_35k", residency_status: "citizen", years_in_canada: 29,
      employment_status: "employed", has_dental_insurance: false, housing: "rent",
    },
  },
  {
    id: "george",
    name: "George",
    blurb: {
      en: "George, 68, retired and living alone in Scarborough",
      fr: "George, 68 ans, retraité vivant seul à Scarborough",
    },
    facts: {
      ...base, city: "Scarborough", age: 68, has_partner: false, children_ages: [], household_size: 1,
      family_income_band: "15k_25k", residency_status: "citizen", years_in_canada: 68,
      employment_status: "retired", has_dental_insurance: false, housing: "rent",
    },
  },
  {
    id: "sam",
    name: "Sam",
    blurb: {
      en: "Sam, 21, full-time college student in Toronto living alone",
      fr: "Sam, 21 ans, étudiant à temps plein au collège à Toronto, vit seul",
    },
    facts: {
      ...base, city: "Toronto", age: 21, has_partner: false, children_ages: [], household_size: 1,
      family_income_band: "under_15k", residency_status: "citizen", years_in_canada: 21,
      employment_status: "employed", student_status: "post_secondary_full_time",
      has_dental_insurance: true, housing: "rent",
    },
  },
];
