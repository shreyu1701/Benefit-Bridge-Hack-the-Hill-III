import { describe, expect, it } from "vitest";
import type { ProgramDraftOutput } from "@/lib/llm/contracts";
import { buildProgramFromDraft, draftProgramId } from "@/lib/rules/program-draft";
import { matchProgram } from "@/lib/rules/engine";
import { emptyFacts, type Facts } from "@/lib/facts/schema";
import { draftProgram } from "@/lib/llm/tasks";
import type { LlmClient } from "@/lib/llm/client";

const URL_ = "https://www.ontario.ca/page/ontario-seniors-dental-care-program";
const L = (en: string) => ({ en, fr: en + " (fr)" });
const f = (x: Partial<Facts>): Facts => ({ ...emptyFacts(), ...x });

const draft = (criteria: ProgramDraftOutput["criteria"]): ProgramDraftOutput => ({
  is_benefit_program: true,
  name: { en: "Ontario Seniors Dental Care Program", fr: "Programme ontarien de soins dentaires pour les aînés" },
  summary: L("Free dental care for low-income seniors."),
  needs: ["health_dental", "health_dental"],
  life_events: ["retiring_soon"],
  criteria,
  also_required: [L("You must not have other dental benefits")],
  how_to_apply: L("Apply online."),
  amount: null,
});

const age65 = { condition: { fact: "age" as const, op: ">=" as const, value: 65 }, met: L("You are 65 or older"), failed: L("You must be 65 or older"), check: L("Tell us your age"), source_quote: "be 65 years of age or older" };

describe("building a drafted program", () => {
  it("builds cited JSON Logic in code, with the jurisdiction added by the engine", () => {
    const { program, dropped } = buildProgramFromDraft(draft([age65]), { url: URL_, jurisdiction: "ON", id: "on-ontario-seniors-dental-care-program" });
    expect(dropped).toEqual([]);
    expect(program.level).toBe("provincial");
    expect(program.eligibility_rules.criteria[0]).toMatchObject({ id: "age_at_least_65", logic: { ">=": [{ var: "age" }, 65] }, source_url: URL_ });
    expect(program.topics).toEqual({ needs: ["health_dental"], life_events: ["retiring_soon"] });
    expect(matchProgram(program, f({ province: "ON", age: 70 })).confidence).toBe("likely");
    expect(matchProgram(program, f({ province: "BC", age: 70 })).confidence).toBe("not_eligible");
  });

  it("drops rules without a quote or with bad conditions; with none left, everyone stays 'possibly'", () => {
    const { program, dropped } = buildProgramFromDraft(
      draft([
        { ...age65, source_quote: " " },
        { ...age65, condition: { fact: "age", op: ">=", value: "sixty-five" } as never },
      ]),
      { url: URL_, jurisdiction: "ON", id: "x" },
    );
    expect(dropped).toHaveLength(2);
    expect(program.eligibility_rules.criteria.map((c) => c.id)).toEqual(["rules_not_drafted"]);
    expect(matchProgram(program, f({ province: "ON", age: 70 })).confidence).toBe("possibly");
  });

  it("'files taxes' never makes anyone ineligible", () => {
    const taxes = { ...age65, condition: { fact: "files_taxes" as const, op: "==" as const, value: true }, source_quote: "file your taxes" };
    const { program } = buildProgramFromDraft(draft([taxes]), { url: URL_, jurisdiction: "ON", id: "x" });
    expect(matchProgram(program, f({ province: "ON", files_taxes: false })).confidence).toBe("possibly");
  });

  it("makes readable, unique ids", () => {
    expect(draftProgramId("ON", "Ontario Seniors Dental Care Program (OSDCP)", new Set())).toBe("on-ontario-seniors-dental-care-program");
    expect(draftProgramId("CA", "Canada Disability Benefit", new Set(["ca-canada-disability-benefit"]))).toBe("ca-canada-disability-benefit-2");
  });
});

describe("drafting with a scripted model", () => {
  it("accepts any condition shape from the model; the builder checks them", async () => {
    const out = { ...draft([]), criteria: [{ ...age65, condition: { fact: "shoe_size", op: ">", value: 9 } }] };
    const llm: LlmClient = { generateJson: async ({ validator }) => validator.parse(out) };
    const d = await draftProgram(llm, { pageText: "…", url: URL_, jurisdiction: "ON" });
    const { dropped } = buildProgramFromDraft(d, { url: URL_, jurisdiction: "ON", id: "x" });
    expect(dropped[0]).toMatch(/not a valid condition|shoe_size/);
  });
});
