import { z } from "zod";
import { INCOME_BANDS, ProfileSchema } from "@/lib/profile/schema";
import { toGeminiSchema } from "./json-schema";

/**
 * LLM prompt contracts. Each task has:
 *   - a JSON Schema given to Gemini as `responseJsonSchema` (structured output)
 *   - a zod validator applied to the response (defence in depth)
 *   - a system prompt that states what the model may and may not do
 *
 * The LLM has exactly four jobs: extract facts, translate, summarize verified
 * government text, and draft change summaries for human reviewers.
 * It NEVER decides eligibility.
 */

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const str = { type: "string" };

// ---------------------------------------------------------------------------
// 1. Fact extraction
// ---------------------------------------------------------------------------

const EXTRACT_FACTS_SCHEMA = toGeminiSchema(ProfileSchema);

export const EXTRACT_FACTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    detected_language: { type: "string", description: "BCP-47 code of the user's input language, e.g. 'en', 'fr', 'es', 'zh', 'ar', 'pa'" },
    // Generated from the one ProfileSchema, so extraction can never drift from
    // onboarding or storage. Every key is required but nullable: null = "not stated".
    facts: EXTRACT_FACTS_SCHEMA,
    evidence: {
      type: "array",
      description: "For each non-null fact, the short span of the user's text it came from",
      items: { type: "object", properties: { fact: str, quote: str }, required: ["fact", "quote"] },
    },
    sensitive_data_ignored: { type: "boolean", description: "true if the user volunteered SIN, exact income, or document numbers that were NOT extracted" },
  },
  required: ["detected_language", "facts", "evidence", "sensitive_data_ignored"],
};

/** Lenient validator: invalid individual fact values are coerced to null later (see extract.ts). */
export const ExtractFactsOutput = z.object({
  detected_language: z.string().min(2).max(20),
  facts: z.record(z.string(), z.unknown()),
  evidence: z.array(z.object({ fact: z.string(), quote: z.string() })).default([]),
  sensitive_data_ignored: z.boolean().default(false),
});
export type ExtractFactsOutput = z.infer<typeof ExtractFactsOutput>;

const bandList = INCOME_BANDS.map((b) => `${b.id}: $${b.min.toLocaleString("en-CA")}–$${b.max.toLocaleString("en-CA")}`).join("; ");

export const EXTRACT_FACTS_SYSTEM = `You extract structured facts from a person's description of their situation in Canada, for a benefits-finder tool.
The description may be in ANY language. Detect the language and return its BCP-47 code.

Rules:
- Extract ONLY what the person states or unambiguously implies. If a fact is not stated, return null. Never guess.
- Do NOT decide or mention eligibility for any program.
- province: 2-letter code. Infer it from a well-known city only when unambiguous (Toronto → ON, Montréal → QC, Vancouver → BC).
- city: the city name as the person wrote it, transliterated to Latin script if needed (e.g. 多伦多 → Toronto).
- children_ages: list each child's age. "2 kids under 6" with no exact ages → null (ages unknown), but household_size can still be computed if the rest is known.
- has_partner: "single mom/dad", "divorced", "widowed" → false. "married", "my husband/wife/partner" → true.
- household_size: count the person + partner + children + other people they say live with them, only if all are known.
- family_income_band: choose a band only if the person gives an amount or range for their household's annual income. Convert monthly × 12, hourly × hours × 52 only if hours are stated. Bands: ${bandList}.
- residency_status: "came to Canada 2 years ago" alone does NOT tell you the status → null. "PR"/"permanent resident" → permanent_resident. "refugee claimant"/"asylum seeker" → refugee_claimant. "accepted refugee"/"protected person" → protected_person. "work permit" → temporary_worker. "study permit"/"international student" → temporary_student.
- years_in_canada: numeric years (months ÷ 12). "born here" → equal to age if age is known, otherwise null.
- employment_status: "part-time"/"full-time job" → employed. "retired" → retired. "looking for work"/"laid off" → unemployed.
- student_status: college/university/post-secondary → post_secondary_full_time unless they say part-time.
- files_taxes: true only if they say they filed (or "did my taxes") for last year; false if they say they didn't; otherwise null.
- If the person includes a Social Insurance Number, exact income figures to the dollar, or immigration document numbers, do not copy them anywhere in your output; set sensitive_data_ignored to true. (You may still pick the income band.)
- evidence: for every non-null fact, include a short quote from the input that supports it.`;

// ---------------------------------------------------------------------------
// 2. Translation
// ---------------------------------------------------------------------------

export const TRANSLATE_JSON_SCHEMA = {
  type: "object",
  properties: { translations: { type: "array", items: str } },
  required: ["translations"],
} as const;
export const TranslateOutput = z.object({ translations: z.array(z.string()) });

export const TRANSLATE_SYSTEM = `You translate short texts from a Canadian government-benefits app into the target language.
Rules:
- Translate faithfully. Do not add, remove, soften, or strengthen any claim, number, date, or condition.
- Keep numbers, dollar amounts, dates, URLs, program names and form numbers (e.g. "RC66", "ON-BEN") exactly as given; you may add a translated name in parentheses after an official program name.
- Use plain, warm language at about a Grade 6 reading level.
- Return exactly one translation per input text, in the same order.`;

// ---------------------------------------------------------------------------
// 3. Plain-language summary of VERIFIED government content (programs & bills)
// ---------------------------------------------------------------------------

export const SUMMARIZE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One paragraph, Grade 6 reading level" },
    who_is_affected: { type: "array", items: str, description: "Groups of people affected, as stated or clearly implied by the source" },
    what_changed: nullable({ type: "string", description: "For bills/laws: what the law changes, in one or two sentences" }),
    coming_into_force: nullable({ type: "string", description: "Only if the source text states when it takes effect; else null" }),
    unsupported_claims: { type: "array", items: str, description: "Anything you were tempted to say that is NOT in the source (should be empty)" },
  },
  required: ["summary", "who_is_affected", "what_changed", "coming_into_force", "unsupported_claims"],
} as const;
export const SummarizeOutput = z.object({
  summary: z.string().min(1).max(2000),
  who_is_affected: z.array(z.string()).max(10),
  what_changed: z.string().nullable(),
  coming_into_force: z.string().nullable(),
  unsupported_claims: z.array(z.string()),
});
export type SummarizeOutput = z.infer<typeof SummarizeOutput>;

export const SUMMARIZE_SYSTEM = `You write plain-language summaries of official Canadian government text (program pages, bills, legislative summaries).
Rules:
- Use ONLY the SOURCE TEXT provided. Do not use outside knowledge. If something is not in the source, leave it out.
- Write at a Grade 6 reading level: short sentences, common words, no jargon (or explain it in brackets).
- For a bill that has NOT received royal assent, write in the conditional ("would", "proposes"); never say it is law.
- If the source does not say when a law takes effect, set coming_into_force to null.
- Write in the requested output language.`;

// ---------------------------------------------------------------------------
// 4. Change-review draft for human reviewers (never shown publicly)
// ---------------------------------------------------------------------------

export const CHANGE_FIELDS = ["eligibility_rules", "benefit_amount", "deadlines", "how_to_apply", "application_url", "name", "none"] as const;

export const CHANGE_REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "What changed on the page, in 1–4 sentences" },
    affected_fields: { type: "array", items: { type: "string", enum: [...CHANGE_FIELDS] } },
    evidence_quotes: { type: "array", items: str, description: "Exact added/removed lines from the diff that support the summary" },
    suggested_rule_changes: nullable({ type: "string", description: "Plain-English description of rule edits a reviewer should consider; null if none" }),
    risk: { type: "string", enum: ["low", "medium", "high"], description: "high if eligibility or amounts may have changed" },
    cosmetic_only: { type: "boolean", description: "true if the change is layout/navigation/date-only" },
  },
  required: ["summary", "affected_fields", "evidence_quotes", "suggested_rule_changes", "risk", "cosmetic_only"],
} as const;
export const ChangeReviewOutput = z.object({
  summary: z.string().min(1),
  affected_fields: z.array(z.enum(CHANGE_FIELDS)),
  evidence_quotes: z.array(z.string()),
  suggested_rule_changes: z.string().nullable(),
  risk: z.enum(["low", "medium", "high"]),
  cosmetic_only: z.boolean(),
});
export type ChangeReviewOutput = z.infer<typeof ChangeReviewOutput>;

export const CHANGE_REVIEW_SYSTEM = `You help a human reviewer check whether a change on an official government web page affects a benefits database.
You receive: the program's current structured record (JSON) and a unified diff of the page's main text.
Rules:
- Describe only what the diff shows. Quote exact lines as evidence.
- Flag any change to ages, income limits, amounts, dates, residency or status rules, or application steps.
- You do not update anything. A human decides. Be concise and factual.`;
