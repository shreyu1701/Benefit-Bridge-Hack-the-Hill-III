import { z } from "zod";
import jsonLogic from "json-logic-js";
import { DERIVED_FROM } from "@/lib/facts/derive";
import { isAllowedUrl } from "@/lib/sources/allowlist";
import { referencedVars } from "./engine";
import type { ProgramRules } from "./types";

/**
 * Validation for human-edited rules (admin review). A rule set is rejected if
 * it references an unknown variable, lacks an official citation, or is not
 * valid JSON Logic — so a typo can't silently make everyone "eligible".
 */
const Localized = z.object({ en: z.string().min(1), fr: z.string().min(1) });
const LogicValue: z.ZodType<unknown> = z.union([z.boolean(), z.null(), z.record(z.string(), z.unknown())]);

export const CriterionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  met: Localized,
  failed: Localized,
  check: Localized,
  applies_if: LogicValue.optional(),
  logic: LogicValue,
  source_url: z.string().url(),
  source_quote: z.string().optional(),
});

export const ProgramRulesSchema = z.object({
  version: z.number().int().positive(),
  criteria: z.array(CriterionSchema).min(1),
  also_required: z.array(Localized),
});

export function validateRules(input: unknown): { ok: true; rules: ProgramRules } | { ok: false; errors: string[] } {
  const parsed = ProgramRulesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const errors: string[] = [];
  const known = new Set(Object.keys(DERIVED_FROM));
  const ids = new Set<string>();

  for (const c of parsed.data.criteria) {
    if (ids.has(c.id)) errors.push(`${c.id}: duplicate criterion id`);
    ids.add(c.id);
    if (!isAllowedUrl(c.source_url)) errors.push(`${c.id}: source_url must be an official government https URL`);
    for (const [name, logic] of [["logic", c.logic], ["applies_if", c.applies_if]] as const) {
      if (logic === undefined) continue;
      if (typeof logic === "object" && logic !== null && !jsonLogic.is_logic(logic)) {
        errors.push(`${c.id}.${name}: not valid JSON Logic`);
        continue;
      }
      if (typeof logic === "object" && logic !== null) {
        for (const v of referencedVars(logic as never)) if (!known.has(v)) errors.push(`${c.id}.${name}: unknown variable "${v}"`);
        try {
          jsonLogic.apply(logic as never, {});
        } catch (e) {
          errors.push(`${c.id}.${name}: ${(e as Error).message}`);
        }
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, rules: parsed.data as ProgramRules };
}
