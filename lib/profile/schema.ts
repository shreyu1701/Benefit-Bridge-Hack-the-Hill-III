import { z } from "zod";

/**
 * THE profile schema — the single source of truth for a person's situation.
 *
 * Used by: onboarding forms (per-screen `pick`), the profile API (validation of
 * stored and submitted profiles), Gemini fact extraction (its JSON schema is
 * generated from this with `z.toJSONSchema`, see lib/llm/contracts.ts), and the
 * rules engine (lib/facts/derive.ts). Add a field here and every one of them
 * sees it; nothing is redeclared elsewhere.
 *
 * Design rules:
 *  - `null` always means "unknown". The rules engine never guesses a value for
 *    an unknown fact; criteria that depend on it are reported as uncertain.
 *  - Income is only ever captured as a band (range), never an exact number.
 *  - We never collect SIN, exact income, or immigration document numbers.
 */

export const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;
export type ProvinceCode = (typeof PROVINCES)[number];

export const RESIDENCY_STATUSES = [
  "citizen",
  "permanent_resident",
  "protected_person", // refugee status granted (Convention refugee / protected person)
  "refugee_claimant", // claim not yet decided
  "temporary_worker",
  "temporary_student",
  "visitor",
  "other",
] as const;
export type ResidencyStatus = (typeof RESIDENCY_STATUSES)[number];

export const EMPLOYMENT_STATUSES = [
  "employed",
  "self_employed",
  "unemployed",
  "retired",
  "not_working",
] as const;

export const STUDENT_STATUSES = [
  "none",
  "high_school",
  "post_secondary_full_time",
  "post_secondary_part_time",
] as const;

export const HOUSING = ["rent", "own", "other"] as const;

/**
 * Annual (adjusted) family net income bands. `max` is inclusive.
 * Bands are deliberately finer at the low end, where most program thresholds sit.
 * Changing bands is a data change: the engine only reads `min`/`max`.
 */
export const INCOME_BANDS = [
  { id: "under_15k", min: 0, max: 14_999 },
  { id: "15k_25k", min: 15_000, max: 24_999 },
  { id: "25k_35k", min: 25_000, max: 34_999 },
  { id: "35k_50k", min: 35_000, max: 49_999 },
  { id: "50k_70k", min: 50_000, max: 69_999 },
  { id: "70k_80k", min: 70_000, max: 79_999 },
  { id: "80k_90k", min: 80_000, max: 89_999 },
  { id: "90k_120k", min: 90_000, max: 119_999 },
  { id: "120k_150k", min: 120_000, max: 149_999 },
  { id: "over_150k", min: 150_000, max: 10_000_000 },
] as const;
export type IncomeBandId = (typeof INCOME_BANDS)[number]["id"];
export const INCOME_BAND_IDS = INCOME_BANDS.map((b) => b.id) as [IncomeBandId, ...IncomeBandId[]];

export const ProfileSchema = z.object({
  province: z.enum(PROVINCES).nullable(),
  city: z.string().trim().max(80).nullable(),
  age: z.number().int().min(0).max(120).nullable(),
  has_partner: z.boolean().nullable(),
  /** Ages of dependent children. `[]` = no children, `null` = unknown. */
  children_ages: z.array(z.number().int().min(0).max(25)).max(15).nullable(),
  /** Total people in the household, if the user said so explicitly. Otherwise derived. */
  household_size: z.number().int().min(1).max(20).nullable(),
  family_income_band: z.enum(INCOME_BAND_IDS).nullable(),
  residency_status: z.enum(RESIDENCY_STATUSES).nullable(),
  years_in_canada: z.number().min(0).max(120).nullable(),
  employment_status: z.enum(EMPLOYMENT_STATUSES).nullable(),
  disability: z.boolean().nullable(),
  student_status: z.enum(STUDENT_STATUSES).nullable(),
  has_dental_insurance: z.boolean().nullable(),
  housing: z.enum(HOUSING).nullable(),
  receives_social_assistance: z.boolean().nullable(),
  /** Filed a tax return for last year. Most federal and Ontario benefits are paid through the tax system. */
  files_taxes: z.boolean().nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileKey = keyof Profile;

export const PROFILE_KEYS = Object.keys(ProfileSchema.shape) as ProfileKey[];

export function emptyProfile(): Profile {
  return Object.fromEntries(PROFILE_KEYS.map((k) => [k, null])) as Profile;
}

/** Parse loosely: missing keys become null, unknown keys are dropped. Throws on invalid values. */
export function parseProfile(input: unknown): Profile {
  const base = emptyProfile();
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const merged = { ...base, ...Object.fromEntries(Object.entries(obj).filter(([k]) => k in base)) };
  return ProfileSchema.parse(merged);
}

// Engine-side names. "Facts" and "profile" are the same shape: a profile is the
// facts a person chose to keep; facts are what one check runs on.
export const FactsSchema = ProfileSchema;
export type Facts = Profile;
export const FACT_KEYS = PROFILE_KEYS;
export const emptyFacts = emptyProfile;
export const parseFacts = parseProfile;
