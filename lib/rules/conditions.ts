import { z } from "zod";
import { EMPLOYMENT_STATUSES, HOUSING, PROVINCES, RESIDENCY_STATUSES } from "@/lib/profile/schema";
import type { DerivedData } from "@/lib/facts/derive";
import type { Logic } from "./types";

/**
 * Simple, checkable conditions ("age ≥ 65", "has a child under 6") that a model
 * may DRAFT from official text. The model never writes JSON Logic: it picks a
 * variable and an operator from fixed lists, and this file turns them into the
 * JSON Logic the rules engine evaluates. A human approves the result.
 */

const NUM_OPS = [">=", ">", "<=", "<"] as const;

/** Every variable a drafted condition may use, with the values it accepts. */
export const CONDITION_VARS = {
  province: { kind: "enum", values: PROVINCES },
  municipality: { kind: "enum", values: ["toronto"] },
  age: { kind: "number", min: 0, max: 120 },
  num_children: { kind: "number", min: 0, max: 15 },
  household_size: { kind: "number", min: 1, max: 20 },
  years_in_canada: { kind: "number", min: 0, max: 120 },
  /** Family income per year, CAD (a range variable: evaluated at both ends of the person's band). */
  family_income: { kind: "number", min: 0, max: 1_000_000 },
  residency_status: { kind: "enum", values: RESIDENCY_STATUSES },
  employment_status: { kind: "enum", values: EMPLOYMENT_STATUSES },
  housing: { kind: "enum", values: HOUSING },
  has_partner: { kind: "boolean" },
  has_child_under_6: { kind: "boolean" },
  has_child_under_18: { kind: "boolean" },
  has_working_income: { kind: "boolean" },
  disability: { kind: "boolean" },
  disability_tax_credit: { kind: "boolean" },
  is_post_secondary_student: { kind: "boolean" },
  has_dental_insurance: { kind: "boolean" },
  receives_social_assistance: { kind: "boolean" },
  files_taxes: { kind: "boolean" },
} as const satisfies Record<string, { kind: "enum"; values: readonly string[] } | { kind: "number"; min: number; max: number } | { kind: "boolean" }>;

export type ConditionVar = keyof typeof CONDITION_VARS;
// Compile-time guard: every condition variable is one the rules engine actually computes.
const _allKnown: ConditionVar extends keyof DerivedData ? true : never = true;
void _allKnown;
export const CONDITION_VAR_NAMES = Object.keys(CONDITION_VARS) as [ConditionVar, ...ConditionVar[]];
export const CONDITION_OPS = ["==", "!=", ...NUM_OPS, "in"] as const;

export const ConditionSchema = z.object({
  fact: z.enum(CONDITION_VAR_NAMES),
  op: z.enum(CONDITION_OPS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type Condition = z.infer<typeof ConditionSchema>;

/** Why a condition is not usable, or null when it is. */
export function conditionError(c: Condition): string | null {
  const spec = CONDITION_VARS[c.fact];
  const where = `${c.fact} ${c.op} ${JSON.stringify(c.value)}`;
  if (spec.kind === "boolean") {
    if (c.op !== "==" || typeof c.value !== "boolean") return `${where}: use "== true" or "== false"`;
  } else if (spec.kind === "number") {
    if (!([...NUM_OPS, "=="] as string[]).includes(c.op) || typeof c.value !== "number") return `${where}: compare a number with >=, >, <=, < or ==`;
    if (c.value < spec.min || c.value > spec.max) return `${where}: out of range ${spec.min}–${spec.max}`;
  } else {
    const values = spec.values as readonly string[];
    if (c.op === "in") {
      if (!Array.isArray(c.value) || !c.value.length || !c.value.every((v) => values.includes(v))) return `${where}: "in" needs a list of ${values.join(", ")}`;
    } else if (c.op === "==" || c.op === "!=") {
      if (typeof c.value !== "string" || !values.includes(c.value)) return `${where}: value must be one of ${values.join(", ")}`;
    } else return `${where}: use ==, != or in`;
  }
  return null;
}

/** All conditions must hold. Invalid conditions must be filtered out first (see `conditionError`). */
export function conditionsToLogic(conditions: Condition[]): Logic | null {
  const parts = conditions.map((c) => {
    const v = { var: c.fact };
    return c.op === "in" ? { in: [v, c.value] } : { [c.op]: [v, c.value] };
  });
  if (!parts.length) return null;
  return (parts.length === 1 ? parts[0] : { and: parts }) as Logic;
}

/** Split a drafted list into usable conditions and the reasons the rest were dropped. */
export function sanitizeConditions(input: unknown[]): { conditions: Condition[]; dropped: string[] } {
  const conditions: Condition[] = [];
  const dropped: string[] = [];
  for (const raw of input) {
    const p = ConditionSchema.safeParse(raw);
    if (!p.success) {
      dropped.push(`${JSON.stringify(raw).slice(0, 120)}: not a valid condition`);
      continue;
    }
    const err = conditionError(p.data);
    if (err) dropped.push(err);
    else conditions.push(p.data);
  }
  return { conditions, dropped };
}
