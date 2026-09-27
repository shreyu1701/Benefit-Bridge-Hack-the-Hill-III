import { describe, expect, it } from "vitest";
import { conditionError, conditionsToLogic, sanitizeConditions, type Condition } from "@/lib/rules/conditions";
import { evaluateLogic } from "@/lib/rules/engine";
import { deriveData } from "@/lib/facts/derive";
import { emptyFacts, type Facts } from "@/lib/facts/schema";
import { draftBillImpact } from "@/lib/llm/tasks";
import type { LlmClient } from "@/lib/llm/client";
import { ImpactError, validateImpactEdit, type ImpactRow } from "@/lib/db/bill-impacts";
import { lawsForYou } from "@/lib/laws-for-you";
import { GOLDEN_PEOPLE } from "./golden/people";

const f = (x: Partial<Facts>): Facts => ({ ...emptyFacts(), ...x });

describe("drafted conditions", () => {
  it("accepts well-formed conditions and turns them into JSON Logic", () => {
    const cs: Condition[] = [
      { fact: "age", op: ">=", value: 65 },
      { fact: "housing", op: "==", value: "rent" },
      { fact: "province", op: "in", value: ["ON", "QC"] },
    ];
    for (const c of cs) expect(conditionError(c)).toBeNull();
    const logic = conditionsToLogic(cs)!;
    expect(evaluateLogic(logic, deriveData(f({ age: 70, housing: "rent", province: "ON" }))).state).toBe("true");
    expect(evaluateLogic(logic, deriveData(f({ age: 40, housing: "rent", province: "ON" }))).state).toBe("false");
    expect(evaluateLogic(logic, deriveData(f({ age: 70, province: "ON" }))).state).toBe("unknown");
  });

  it("rejects wrong operators, values and ranges instead of guessing", () => {
    expect(conditionError({ fact: "age", op: "==", value: "old" })).toMatch(/compare a number/);
    expect(conditionError({ fact: "age", op: ">=", value: 400 })).toMatch(/out of range/);
    expect(conditionError({ fact: "disability", op: "!=", value: true })).toMatch(/== true/);
    expect(conditionError({ fact: "housing", op: "==", value: "castle" })).toMatch(/one of/);
    expect(conditionError({ fact: "province", op: "in", value: ["ON", "Ontario"] })).toMatch(/needs a list/);
  });

  it("keeps the usable conditions and says why the rest were dropped", () => {
    const { conditions, dropped } = sanitizeConditions([
      { fact: "age", op: ">=", value: 65 },
      { fact: "sin_number", op: "==", value: "123" },
      { fact: "has_child_under_6", op: "==", value: "yes" },
    ]);
    expect(conditions).toEqual([{ fact: "age", op: ">=", value: 65 }]);
    expect(dropped).toHaveLength(2);
  });

  it("income conditions use the same both-ends-of-the-band rule as programs", () => {
    const logic = conditionsToLogic([{ fact: "family_income", op: "<", value: 40_000 }])!;
    expect(evaluateLogic(logic, deriveData(f({ family_income_band: "25k_35k" }))).state).toBe("true");
    expect(evaluateLogic(logic, deriveData(f({ family_income_band: "35k_50k" }))).state).toBe("range");
  });
});

describe("drafting who a bill affects (scripted model)", () => {
  const scripted = (out: unknown): LlmClient => ({ generateJson: async ({ validator }) => validator.parse(out) });

  it("builds the logic in code and drops conditions the model made up", async () => {
    const d = await draftBillImpact(
      scripted({
        relevant_to_individuals: true,
        needs: ["income_support", "income_support"],
        life_events: ["retiring_soon"],
        conditions: [{ fact: "age", op: ">=", value: 65 }, { fact: "zodiac", op: "==", value: "leo" }],
        who_en: "Seniors 65 and older would get a bigger monthly payment.",
        who_fr: "Les aînés de 65 ans et plus recevraient un paiement mensuel plus élevé.",
        evidence_quotes: ["persons who are 65 years of age or older"],
      }),
      { title: "Bill C-1", stage: "Second reading", hasRoyalAssent: false, sourceText: "…", sourceUrl: "https://www.parl.ca/legisinfo/en/bill/45-1/c-1" },
    );
    expect(d.relevant).toBe(true);
    expect(d.needs).toEqual(["income_support"]);
    expect(d.applies_if).toEqual({ ">=": [{ var: "age" }, 65] });
    expect(d.dropped).toHaveLength(1);
  });

  it("rejects a draft with needs outside the fixed list", async () => {
    await expect(
      draftBillImpact(
        scripted({ relevant_to_individuals: true, needs: ["crypto"], life_events: [], conditions: [], who_en: "x", who_fr: "x", evidence_quotes: [] }),
        { title: "B", stage: "", hasRoyalAssent: false, sourceText: "", sourceUrl: "https://www.parl.ca/" },
      ),
    ).rejects.toThrow();
  });
});

describe("reviewer edits are re-validated on the server", () => {
  const ok = { needs: ["transit"], life_events: [], conditions: [{ fact: "municipality", op: "==", value: "toronto" }], who: { en: "Toronto transit riders", fr: "Usagers du transport à Toronto" } };

  it("accepts a valid edit and builds the logic", () => {
    expect(validateImpactEdit(ok).applies_if).toEqual({ "==": [{ var: "municipality" }, "toronto"] });
  });

  it("refuses bad conditions, unknown needs, or an edit that can never match anyone", () => {
    expect(() => validateImpactEdit({ ...ok, conditions: [{ fact: "age", op: ">=", value: "sixty" }] })).toThrow(ImpactError);
    expect(() => validateImpactEdit({ ...ok, needs: ["yachts"] })).toThrow(ImpactError);
    expect(() => validateImpactEdit({ ...ok, needs: [], conditions: [] })).toThrow(/never be matched/);
  });
});

describe("laws that affect you", () => {
  const row = (x: Partial<ImpactRow>): ImpactRow => ({
    bill_id: 1, status: "approved", needs: [], life_events: [], conditions: [], applies_if: null,
    who: { en: "Who (en)", fr: "Qui (fr)" }, source_url: "https://www.parl.ca/x", draft: null, reviewer: "r", reviewer_notes: null,
    reviewed_at: null, created_at: "2026-01-01", jurisdiction_code: "CA", bill_number: "C-1",
    titles: { long_en: "An Act", long_fr: "Loi", short_en: "Short Act", short_fr: "Loi courte" },
    current_stage: "Second reading", current_stage_fr: "Deuxième lecture", status_en: null, status_fr: null,
    royal_assent_at: null, bill_source_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-1", ...x,
  });
  const seniors = row({ bill_id: 1, bill_number: "C-1", applies_if: { ">=": [{ var: "age" }, 65] } });
  const renters = row({ bill_id: 2, bill_number: "C-2", needs: ["rent_housing"] });
  const parents = row({ bill_id: 3, bill_number: "C-3", applies_if: { "==": [{ var: "has_child_under_6" }, true] }, royal_assent_at: "2026-06-01" });
  const pending = row({ bill_id: 4, bill_number: "C-4", status: "pending", needs: ["rent_housing"] });
  const all = [seniors, renters, parents, pending];

  it("shows what affects the person, what may, and nothing else", () => {
    const parent = GOLDEN_PEOPLE[0].facts; // 29, kids 2 and 4, rents
    const laws = lawsForYou(all, { ...parent, needs: ["rent_housing"] }, "en");
    expect(laws.map((l) => [l.bill_number, l.match])).toEqual([["C-3", "affects"], ["C-2", "may_affect"]]);
    expect(laws[0].title).toBe("Short Act");
  });

  it("an unknown fact makes it 'may affect', never 'affects'", () => {
    expect(lawsForYou([seniors], f({ province: "ON" }), "en")).toMatchObject([{ bill_number: "C-1", match: "may_affect" }]);
  });

  it("never shows a draft that hasn't been approved", () => {
    expect(lawsForYou([pending], f({ needs: ["rent_housing"] }), "en")).toEqual([]);
  });

  it("speaks the person's language", () => {
    const [l] = lawsForYou([parents], f({ children_ages: [1] }), "fr");
    expect(l).toMatchObject({ title: "Loi courte", who: "Qui (fr)", stage: "Deuxième lecture" });
  });
});
