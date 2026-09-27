import { JURISDICTIONS } from "@/data/jurisdictions";
import { DERIVED_FROM } from "@/lib/facts/derive";
import { OPTIONS } from "@/lib/facts/labels";
import { FactsSchema, LIST_KEYS, type Facts } from "@/lib/facts/schema";
import { jurisdictionCriteria, matchProgram } from "./engine";
import type { Logic, ProgramRecord } from "./types";

/**
 * Which follow-up questions to ask: the ones whose answer could actually change
 * a result. For every unknown fact, try each possible answer, re-run the same
 * deterministic engine, and count the programs whose verdict would move.
 * No model is involved; it's cheap (programs × facts × a handful of answers).
 */

export interface RankedQuestion {
  fact: keyof Facts;
  /** How many programs could get a different result, depending on the answer. */
  could_change: number;
}

const BOOL_FACTS = new Set<keyof Facts>(["has_partner", "disability", "disability_tax_credit", "has_dental_insurance", "receives_social_assistance", "files_taxes"]);
const NUM_FACTS = new Set<keyof Facts>(["age", "years_in_canada", "household_size"]);

/** Numbers a program compares this fact (or a value derived from it) with. */
function thresholds(fact: keyof Facts, programs: ProgramRecord[]): number[] {
  const vars = new Set<string>([fact, ...Object.entries(DERIVED_FROM).filter(([, from]) => from.includes(fact)).map(([v]) => v)]);
  const found = new Set<number>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [op, args] of Object.entries(node as Record<string, unknown>)) {
      if (["==", "===", "<", "<=", ">", ">="].includes(op) && Array.isArray(args)) {
        const usesFact = args.some((a) => a && typeof a === "object" && vars.has(String((a as { var?: unknown }).var)));
        if (usesFact) for (const a of args) if (typeof a === "number") found.add(a);
      }
      walk(args);
    }
  };
  for (const p of programs) for (const c of [...jurisdictionCriteria(p), ...p.eligibility_rules.criteria]) walk([c.logic as Logic, c.applies_if]);
  return [...found];
}

/** A small set of answers that covers every outcome the rules can distinguish. */
export function answerOptions(fact: keyof Facts, programs: ProgramRecord[]): Facts[keyof Facts][] {
  if (BOOL_FACTS.has(fact)) return [true, false];
  if (fact === "children_ages") return [[], [2], [10], [18]];
  if (fact === "city") {
    const cities = JURISDICTIONS.filter((j) => j.level === "municipal").map((j) => j.cityAliases?.[0]).filter(Boolean) as string[];
    return [...cities, "another city"];
  }
  if (NUM_FACTS.has(fact)) {
    const values = new Set<number>();
    for (const n of thresholds(fact, programs)) for (const v of [n - 1, n, n + 1]) values.add(v);
    return [...values].filter((v) => FactsSchema.shape[fact].safeParse(v).success) as Facts[keyof Facts][];
  }
  const opts = OPTIONS[fact as keyof typeof OPTIONS];
  return opts ? ([...opts] as Facts[keyof Facts][]) : [];
}

export function rankFollowups(
  programs: ProgramRecord[],
  facts: Facts,
  { limit = 3, skip = [] as string[] } = {},
): RankedQuestion[] {
  const live = programs.filter((p) => p.status !== "retired");
  const now = new Map(live.map((p) => [p.id, matchProgram(p, facts)]));

  // Candidates: unknown facts used by a program that isn't already ruled out (as before).
  const mentions = new Map<keyof Facts, number>();
  for (const r of now.values()) {
    if (r.confidence === "not_eligible") continue;
    for (const f of r.missing_facts as (keyof Facts)[]) {
      if (skip.includes(f) || (LIST_KEYS as readonly string[]).includes(f)) continue;
      mentions.set(f, (mentions.get(f) ?? 0) + 1);
    }
  }

  const needs = new Set(facts.needs ?? []);
  const events = new Set(facts.life_events ?? []);
  const relevant = (p: ProgramRecord) => p.topics?.needs.some((n) => needs.has(n)) || p.topics?.life_events.some((e) => events.has(e));

  const ranked = [...mentions.keys()].map((fact) => {
    let changed = 0;
    let weight = 0;
    for (const p of live) {
      const before = now.get(p.id)!;
      if (before.confidence === "not_eligible") continue;
      const moves = answerOptions(fact, live).some((v) => matchProgram(p, { ...facts, [fact]: v }).confidence !== before.confidence);
      if (moves) {
        changed += 1;
        weight += relevant(p) ? 2 : 1; // what they came for counts double
      }
    }
    return { fact, could_change: changed, weight, mentions: mentions.get(fact)! };
  });

  return ranked
    .sort((a, b) => b.weight - a.weight || b.mentions - a.mentions || a.fact.localeCompare(b.fact))
    .slice(0, limit)
    .map(({ fact, could_change }) => ({ fact, could_change }));
}

