import jsonLogic from "json-logic-js";
import { deriveData, DERIVED_FROM, RANGE_VARS, type DerivedData } from "@/lib/facts/derive";
import type { Facts } from "@/lib/facts/schema";
import { getJurisdiction } from "@/data/jurisdictions";
import type {
  Confidence,
  Criterion,
  CriterionResult,
  Localized,
  Logic,
  MatchResult,
  ProgramRecord,
} from "./types";

/**
 * Deterministic eligibility engine.
 *
 * The LLM is never consulted here. Inputs are user-confirmed facts and the
 * human-approved program rules; the output is fully explained by the criteria.
 *
 * Tri-state evaluation of one JSON Logic expression:
 *   - If any referenced variable is unknown → "unknown" (we will not guess).
 *     This matters because json-logic-js treats a missing variable as a value
 *     (e.g. `undefined < 5` is true), which would create false positives.
 *   - Range variables (income bands) are evaluated at both ends of the range.
 *     Rules must therefore be monotonic in range variables (plain threshold
 *     comparisons are). Same answer at both ends → definite; different → "range".
 *   - A rule may deliberately return null → "data_gap": the verified database
 *     has no rule for this situation.
 */

type EvalState =
  | { state: "true" }
  | { state: "false" }
  | { state: "unknown"; missing: string[] }
  | { state: "range" }
  | { state: "data_gap" };

function rootVar(v: unknown): string {
  return String(v).split(".")[0];
}

export function referencedVars(logic: Logic): string[] {
  const vars = (jsonLogic.uses_data(logic as object) as unknown[]).map(rootVar).filter((v) => v !== "");
  return [...new Set(vars)];
}

function isUnknown(v: unknown): boolean {
  return v === null || v === undefined;
}

export function evaluateLogic(logic: Logic, data: DerivedData): EvalState {
  const vars = referencedVars(logic);
  const missing = vars.filter((v) => isUnknown((data as unknown as Record<string, unknown>)[v]));
  if (missing.length) return { state: "unknown", missing };

  // Build "worlds": one per combination of range-variable endpoints.
  const rangeVars = vars.filter((v) => (RANGE_VARS as readonly string[]).includes(v));
  let worlds: Record<string, unknown>[] = [{ ...data }];
  for (const rv of rangeVars) {
    const r = (data as unknown as Record<string, { min: number; max: number }>)[rv];
    worlds = worlds.flatMap((w) => [
      { ...w, [rv]: r.min },
      { ...w, [rv]: r.max },
    ]);
  }

  const results = worlds.map((w) => {
    const out = jsonLogic.apply(logic, w);
    return out === null || out === undefined ? null : jsonLogic.truthy(out);
  });

  if (results.every((r) => r === null)) return { state: "data_gap" };
  if (results.some((r) => r === null)) return { state: "range" };
  if (results.every((r) => r === true)) return { state: "true" };
  if (results.every((r) => r === false)) return { state: "false" };
  return { state: "range" };
}

function toRawFacts(derivedVars: string[]): string[] {
  const out = new Set<string>();
  for (const v of derivedVars) {
    for (const f of DERIVED_FROM[v as keyof DerivedData] ?? [v]) out.add(f);
  }
  return [...out];
}

const loc = (l: Localized, lang: "en" | "fr") => l[lang] ?? l.en;

export function evaluateCriterion(c: Criterion, data: DerivedData, lang: "en" | "fr" = "en"): CriterionResult {
  const base = { id: c.id, source_url: c.source_url };
  if (c.applies_if) {
    const gate = evaluateLogic(c.applies_if, data);
    if (gate.state === "unknown")
      return { ...base, outcome: "unknown", text: loc(c.check, lang), missing_facts: toRawFacts(gate.missing) };
    if (gate.state === "false") return { ...base, outcome: "not_applicable", text: loc(c.met, lang), missing_facts: [] };
    if (gate.state !== "true")
      return { ...base, outcome: "unknown", text: loc(c.check, lang), missing_facts: [] };
  }
  const r = evaluateLogic(c.logic, data);
  switch (r.state) {
    case "true":
      return { ...base, outcome: "met", text: loc(c.met, lang), missing_facts: [] };
    case "false":
      return { ...base, outcome: "failed", text: loc(c.failed, lang), missing_facts: [] };
    case "unknown":
      return { ...base, outcome: "unknown", text: loc(c.check, lang), missing_facts: toRawFacts(r.missing) };
    case "range":
      // Income band straddles the threshold. We never ask for exact income, so
      // there is no follow-up question — the user must check the official page.
      return { ...base, outcome: "unknown", text: loc(c.check, lang), missing_facts: [] };
    case "data_gap":
      return { ...base, outcome: "data_gap", text: loc(c.check, lang), missing_facts: [] };
  }
}

/** Residence criteria generated from the program's jurisdiction (data-driven). */
export function jurisdictionCriteria(program: ProgramRecord): Criterion[] {
  const j = getJurisdiction(program.jurisdiction);
  if (!j || j.level === "federal") return [];
  const src = program.source_url;
  if (j.level === "provincial") {
    return [
      {
        id: "lives_in_" + j.code.toLowerCase(),
        met: { en: `You live in ${provinceName(j.province!, "en")}`, fr: `Vous habitez en ${provinceName(j.province!, "fr")}` },
        failed: {
          en: `This program is only for people who live in ${provinceName(j.province!, "en")}`,
          fr: `Ce programme est réservé aux personnes qui habitent en ${provinceName(j.province!, "fr")}`,
        },
        check: { en: "Tell us which province you live in", fr: "Dites-nous dans quelle province vous habitez" },
        logic: { "==": [{ var: "province" }, j.province] },
        source_url: src,
      },
    ];
  }
  return [
    {
      id: "lives_in_" + j.municipality,
      met: { en: `You live in ${j.name.en.replace("City of ", "")}`, fr: `Vous habitez à ${j.name.fr.replace("Ville de ", "")}` },
      failed: {
        en: `This program is only for residents of ${j.name.en}`,
        fr: `Ce programme est réservé aux résidents de la ${j.name.fr}`,
      },
      check: { en: "Tell us which city you live in", fr: "Dites-nous dans quelle ville vous habitez" },
      logic: {
        and: [
          { "==": [{ var: "province" }, j.province] },
          { "==": [{ var: "municipality" }, j.municipality] },
        ],
      },
      source_url: src,
    },
  ];
}

const PROVINCE_NAMES: Record<string, Localized> = {
  ON: { en: "Ontario", fr: "Ontario" },
  QC: { en: "Quebec", fr: "Québec" },
  BC: { en: "British Columbia", fr: "Colombie-Britannique" },
  AB: { en: "Alberta", fr: "Alberta" },
};
function provinceName(code: string, lang: "en" | "fr") {
  return PROVINCE_NAMES[code]?.[lang] ?? code;
}

export function matchProgram(program: ProgramRecord, facts: Facts, lang: "en" | "fr" = "en"): MatchResult {
  const data = deriveData(facts);
  const criteria = [...jurisdictionCriteria(program), ...program.eligibility_rules.criteria];
  const results = criteria.map((c) => evaluateCriterion(c, data, lang));

  const failed = results.filter((r) => r.outcome === "failed");
  const uncertain = results.filter((r) => r.outcome === "unknown" || r.outcome === "data_gap");
  const met = results.filter((r) => r.outcome === "met");

  let confidence: Confidence;
  if (failed.length) confidence = "not_eligible";
  else if (uncertain.length) confidence = "possibly";
  else confidence = "likely";

  return {
    program_id: program.id,
    confidence,
    criteria: results,
    reasons_met: met.map((r) => r.text),
    uncertain: uncertain.map((r) => r.text),
    failed: failed.map((r) => r.text),
    missing_facts: [...new Set(uncertain.flatMap((r) => r.missing_facts))],
  };
}

export function matchAll(programs: ProgramRecord[], facts: Facts, lang: "en" | "fr" = "en"): MatchResult[] {
  return programs.filter((p) => p.status !== "retired").map((p) => matchProgram(p, facts, lang));
}

/**
 * Follow-up questions: only for unknown facts that could change an outcome
 * (i.e. appear in a not-yet-failed program), ranked by how many programs they affect.
 */
export function followUpFacts(results: MatchResult[], limit = 3, skip: string[] = []): string[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.confidence === "not_eligible") continue;
    for (const f of r.missing_facts) if (!skip.includes(f)) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([f]) => f);
}
