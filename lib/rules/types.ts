import type { RulesLogic, AdditionalOperation } from "json-logic-js";
import type { Level } from "@/data/jurisdictions";
import type { LifeEvent, Need } from "@/lib/profile/schema";

export type Localized = { en: string; fr: string };
export type Logic = RulesLogic<AdditionalOperation>;

/**
 * One eligibility requirement, expressed in JSON Logic over DerivedData.
 *
 * Tri-state semantics (see engine.ts):
 *  - every variable the logic references must be known, otherwise → "unknown"
 *  - `logic` may evaluate to `null` on purpose, meaning "our verified database
 *    has no rule for this situation" → "data_gap" (we never guess)
 */
export interface Criterion {
  id: string;
  /** Shown when met: "You live in Ontario". */
  met: Localized;
  /** Shown when failed: "You need to live in Ontario". */
  failed: Localized;
  /** Shown when we can't tell: "Check whether ...". */
  check: Localized;
  /** Optional gate: if this evaluates false the criterion does not apply (treated as met). */
  applies_if?: Logic;
  logic: Logic;
  /** Official page containing the rule. Required — no citation, no rule. */
  source_url: string;
  /** Exact wording from the official page that the rule encodes (for reviewers). */
  source_quote?: string;
}

export interface ProgramRules {
  version: number;
  criteria: Criterion[];
  /** Requirements we don't ask about, always shown as "also required". */
  also_required: Localized[];
}

export interface BenefitAmount {
  text: Localized;
  /** Only filled when the official page publishes a number. */
  max_annual_cad?: number | null;
  period?: string | null; // e.g. "July 2026 – June 2027"
  source_url: string;
}

export interface Deadline {
  label: Localized;
  date: string | null; // ISO date if the source publishes a fixed date
  source_url: string;
}

export interface ProgramRecord {
  id: string;
  name: Localized;
  level: Level;
  jurisdiction: string;
  eligibility_rules: ProgramRules;
  benefit_amount: BenefitAmount | null;
  deadlines: Deadline[];
  how_to_apply: Localized;
  application_url: string;
  source_url: string;
  status: "active" | "needs_verification" | "retired";
  last_verified_at: string | null;
  approved_by: string | null;
  /**
   * What the program helps with and which life events make it relevant.
   * Used ONLY to put the most relevant results first; never read by the rules.
   */
  topics: ProgramTopics;
  summaries_by_language: Record<string, string>;
}

export interface ProgramTopics {
  needs: Need[];
  life_events: LifeEvent[];
}

export type CriterionOutcome = "met" | "failed" | "unknown" | "data_gap" | "not_applicable";

export interface CriterionResult {
  id: string;
  outcome: CriterionOutcome;
  text: string;
  source_url: string;
  /** Raw facts that would resolve an "unknown" outcome. */
  missing_facts: string[];
}

export type Confidence = "likely" | "possibly" | "not_eligible";

export interface MatchResult {
  program_id: string;
  confidence: Confidence;
  criteria: CriterionResult[];
  reasons_met: string[];
  uncertain: string[];
  failed: string[];
  missing_facts: string[];
}
