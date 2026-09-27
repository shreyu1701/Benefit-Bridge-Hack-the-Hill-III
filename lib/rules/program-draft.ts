import { getJurisdiction } from "@/data/jurisdictions";
import type { ProgramDraftOutput } from "@/lib/llm/contracts";
import { conditionsToLogic, sanitizeConditions, type Condition } from "./conditions";
import type { Criterion, Logic, ProgramRecord } from "./types";
import { validateRules } from "./validate";

/**
 * Turn a model's draft of a program page into a ProgramRecord. Pure.
 * The model only chose conditions from fixed lists; the JSON Logic, ids,
 * citations and safety defaults are all decided here. The result is stored as
 * status "draft" and stays invisible until a reviewer approves it.
 */

const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function draftProgramId(jurisdiction: string, nameEn: string, taken: Set<string>): string {
  const base = `${jurisdiction.toLowerCase().replace(/[^a-z]+/g, "-")}-${slug(nameEn)}`.slice(0, 60).replace(/-$/, "");
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** "Files taxes" never makes someone ineligible (they can file late): not filed → "possibly", as for the seed programs. */
function logicFor(c: Condition): Logic {
  if (c.fact === "files_taxes" && c.op === "==" && c.value === true) return { if: [{ "==": [{ var: "files_taxes" }, true] }, true, null] } as Logic;
  return conditionsToLogic([c])!;
}

const criterionId = (c: Condition) =>
  `${c.fact}_${{ "==": "is", "!=": "not", ">=": "at_least", ">": "over", "<=": "at_most", "<": "under", in: "in" }[c.op]}_${String(c.value).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(0, 60);

export interface BuiltDraft {
  program: ProgramRecord;
  /** Draft criteria that could not be used, with why. Shown to the reviewer. */
  dropped: string[];
}

export function buildProgramFromDraft(
  d: ProgramDraftOutput,
  opts: { url: string; jurisdiction: string; id: string },
): BuiltDraft {
  const j = getJurisdiction(opts.jurisdiction);
  if (!j) throw new Error(`Unknown jurisdiction ${opts.jurisdiction}`);
  const dropped: string[] = [];
  const criteria: Criterion[] = [];
  const ids = new Set<string>();

  for (const c of d.criteria) {
    // The model's condition is untrusted: check its shape and values before using it.
    const { conditions: [condition], dropped: why } = sanitizeConditions([c.condition]);
    if (!condition) {
      dropped.push(...why);
      continue;
    }
    if (!c.source_quote.trim()) {
      dropped.push(`${condition.fact}: no quote from the page, so it can't be checked`);
      continue;
    }
    let id = criterionId(condition);
    while (ids.has(id)) id += "_2";
    ids.add(id);
    criteria.push({ id, met: c.met, failed: c.failed, check: c.check, logic: logicFor(condition), source_url: opts.url, source_quote: c.source_quote.slice(0, 500) });
  }

  // No usable rule means we can't say anything: keep everyone at "possibly" until a reviewer writes the rules.
  if (!criteria.length) {
    criteria.push({
      id: "rules_not_drafted",
      met: { en: "You may qualify", fr: "Vous pourriez être admissible" },
      failed: { en: "You may not qualify", fr: "Vous pourriez ne pas être admissible" },
      check: { en: "Check the rules on the official page", fr: "Vérifiez les règles sur la page officielle" },
      logic: { if: [false, true, null] } as Logic,
      source_url: opts.url,
    });
  }

  const rules = { version: 1, criteria, also_required: d.also_required.filter((a) => a.en.trim() && a.fr.trim()) };
  const v = validateRules(rules);
  if (!v.ok) throw new Error(`Drafted rules are invalid: ${v.errors.join("; ")}`);

  return {
    dropped,
    program: {
      id: opts.id,
      name: d.name,
      level: j.level,
      jurisdiction: j.code,
      eligibility_rules: v.rules,
      benefit_amount: d.amount && d.amount.en.trim() ? { text: d.amount, source_url: opts.url } : null,
      deadlines: [],
      how_to_apply: d.how_to_apply,
      application_url: opts.url,
      source_url: opts.url,
      status: "needs_verification", // stored as "draft" by the caller; this type has no "draft"
      last_verified_at: null,
      approved_by: null,
      topics: { needs: [...new Set(d.needs)], life_events: [...new Set(d.life_events)] },
      summaries_by_language: d.summary,
    },
  };
}
