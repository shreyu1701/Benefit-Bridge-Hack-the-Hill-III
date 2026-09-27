import { INCOME_BANDS, type Facts } from "./schema";
import { resolveMunicipality } from "@/data/jurisdictions";

/**
 * Values the rules engine can reference in JSON Logic via {"var": "<name>"}.
 * Every value is either known or `null` (unknown).
 *
 * `family_income` is special: it is a *range* fact. The engine evaluates each
 * criterion at both ends of the range (see engine.ts).
 */
export interface DerivedData {
  province: string | null;
  municipality: string | null;
  age: number | null;
  has_partner: boolean | null;
  children_ages: number[] | null;
  num_children: number | null;
  has_child_under_6: boolean | null;
  has_child_under_18: boolean | null;
  has_child_under_19: boolean | null;
  household_size: number | null;
  family_income: { min: number; max: number } | null;
  residency_status: string | null;
  years_in_canada: number | null;
  /** Years lived in Canada since turning 18 (OAS residence test). */
  years_in_canada_since_18: number | null;
  employment_status: string | null;
  has_working_income: boolean | null;
  disability: boolean | null;
  disability_tax_credit: boolean | null;
  student_status: string | null;
  is_post_secondary_student: boolean | null;
  is_full_time_student: boolean | null;
  has_dental_insurance: boolean | null;
  housing: string | null;
  receives_social_assistance: boolean | null;
  files_taxes: boolean | null;
}

export const RANGE_VARS = ["family_income"] as const;

export function deriveData(f: Facts): DerivedData {
  const kids = f.children_ages;
  const anyKid = (pred: (a: number) => boolean) => (kids === null ? null : kids.some(pred));

  let household: number | null = f.household_size;
  if (household === null && f.has_partner !== null && kids !== null) {
    household = 1 + (f.has_partner ? 1 : 0) + kids.length;
  }

  const band = f.family_income_band ? INCOME_BANDS.find((b) => b.id === f.family_income_band)! : null;

  let since18: number | null = null;
  if (f.years_in_canada !== null && f.age !== null) {
    since18 = Math.max(0, Math.min(f.years_in_canada, f.age - 18));
  }

  const employed =
    f.employment_status === null ? null : f.employment_status === "employed" || f.employment_status === "self_employed";

  return {
    province: f.province,
    municipality: resolveMunicipality(f.province, f.city),
    age: f.age,
    has_partner: f.has_partner,
    children_ages: kids,
    num_children: kids === null ? null : kids.length,
    has_child_under_6: anyKid((a) => a < 6),
    has_child_under_18: anyKid((a) => a < 18),
    has_child_under_19: anyKid((a) => a < 19),
    household_size: household,
    family_income: band ? { min: band.min, max: band.max } : null,
    residency_status: f.residency_status,
    years_in_canada: f.years_in_canada,
    years_in_canada_since_18: since18,
    employment_status: f.employment_status,
    has_working_income: employed,
    disability: f.disability,
    disability_tax_credit: f.disability_tax_credit,
    student_status: f.student_status,
    is_post_secondary_student:
      f.student_status === null ? null : f.student_status.startsWith("post_secondary"),
    is_full_time_student: f.student_status === null ? null : f.student_status === "post_secondary_full_time",
    has_dental_insurance: f.has_dental_insurance,
    housing: f.housing,
    receives_social_assistance: f.receives_social_assistance,
    files_taxes: f.files_taxes,
  };
}

/** Which raw facts a derived variable depends on — used to phrase follow-up questions. */
export const DERIVED_FROM: Record<keyof DerivedData, (keyof Facts)[]> = {
  province: ["province"],
  municipality: ["province", "city"],
  age: ["age"],
  has_partner: ["has_partner"],
  children_ages: ["children_ages"],
  num_children: ["children_ages"],
  has_child_under_6: ["children_ages"],
  has_child_under_18: ["children_ages"],
  has_child_under_19: ["children_ages"],
  household_size: ["household_size", "has_partner", "children_ages"],
  family_income: ["family_income_band"],
  residency_status: ["residency_status"],
  years_in_canada: ["years_in_canada"],
  years_in_canada_since_18: ["years_in_canada", "age"],
  employment_status: ["employment_status"],
  has_working_income: ["employment_status"],
  disability: ["disability"],
  disability_tax_credit: ["disability_tax_credit"],
  student_status: ["student_status"],
  is_post_secondary_student: ["student_status"],
  is_full_time_student: ["student_status"],
  has_dental_insurance: ["has_dental_insurance"],
  housing: ["housing"],
  receives_social_assistance: ["receives_social_assistance"],
  files_taxes: ["files_taxes"],
};
