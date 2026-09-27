import { describe, expect, it } from "vitest";
import { evaluateLogic, followUpFacts, matchAll, matchProgram } from "@/lib/rules/engine";
import { deriveData } from "@/lib/facts/derive";
import { emptyFacts, type Facts } from "@/lib/facts/schema";
import { SEED_PROGRAMS } from "@/data/programs";
import type { Logic } from "@/lib/rules/types";
import { PERSONAS } from "@/data/personas";

const P = (id: string) => SEED_PROGRAMS.find((p) => p.id === id)!;
// These tests are about other rules, so they assume the person files taxes; see "tax filing" below.
const facts = (f: Partial<Facts>): Facts => ({ ...emptyFacts(), files_taxes: true, ...f });

describe("tri-state logic evaluation", () => {
  it("reports unknown instead of evaluating a comparison on a missing variable", () => {
    // json-logic-js alone would say `undefined < 90000` is true.
    const r = evaluateLogic({ "<": [{ var: "family_income" }, 90000] }, deriveData(emptyFacts()));
    expect(r).toEqual({ state: "unknown", missing: ["family_income"] });
  });

  it("evaluates income bands at both ends", () => {
    const d = (band: Facts["family_income_band"]) => deriveData(facts({ family_income_band: band }));
    const rule = { "<": [{ var: "family_income" }, 90000] } as Logic;
    expect(evaluateLogic(rule, d("80k_90k")).state).toBe("true"); // 80,000–89,999
    expect(evaluateLogic(rule, d("90k_120k")).state).toBe("false");
    const straddle = { "<": [{ var: "family_income" }, 38237] } as Logic;
    expect(evaluateLogic(straddle, d("35k_50k")).state).toBe("range");
  });

  it("treats an explicit null rule result as a data gap", () => {
    expect(evaluateLogic({ if: [false, true, null] }, deriveData(emptyFacts())).state).toBe("data_gap");
  });
});

describe("Canadian Dental Care Plan", () => {
  const cdcp = P("ca-cdcp");

  it("is likely for a household under $90k with no insurance", () => {
    const r = matchProgram(cdcp, facts({ family_income_band: "80k_90k", has_dental_insurance: false }));
    expect(r.confidence).toBe("likely");
  });

  it("narrow miss: income band starting at exactly $90,000 is not eligible", () => {
    const r = matchProgram(cdcp, facts({ family_income_band: "90k_120k", has_dental_insurance: false }));
    expect(r.confidence).toBe("not_eligible");
    expect(r.failed[0]).toMatch(/less than \$90,000/);
  });

  it("is not eligible with dental insurance even at low income", () => {
    const r = matchProgram(cdcp, facts({ family_income_band: "under_15k", has_dental_insurance: true }));
    expect(r.confidence).toBe("not_eligible");
  });

  it("asks about insurance when unknown instead of guessing", () => {
    const r = matchProgram(cdcp, facts({ family_income_band: "under_15k" }));
    expect(r.confidence).toBe("possibly");
    expect(r.missing_facts).toContain("has_dental_insurance");
  });
});

describe("Old Age Security", () => {
  const oas = P("ca-oas");
  const senior = (age: number, years: number) =>
    facts({ age, years_in_canada: years, residency_status: "citizen" });

  it("is likely at exactly 65 with 10 years since 18", () => {
    expect(matchProgram(oas, senior(65, 10)).confidence).toBe("likely");
  });

  it("narrow miss: 64 years old", () => {
    const r = matchProgram(oas, senior(64, 40));
    expect(r.confidence).toBe("not_eligible");
    expect(r.failed).toEqual(["You must be at least 65 years old"]);
  });

  it("narrow miss: 9 years in Canada", () => {
    const r = matchProgram(oas, senior(70, 9));
    expect(r.confidence).toBe("not_eligible");
    expect(r.failed[0]).toMatch(/10 years/);
  });

  it("only counts years after age 18", () => {
    // Age 26 with 26 years in Canada = only 8 adult years (not eligible anyway on age).
    const d = deriveData(senior(26, 26));
    expect(d.years_in_canada_since_18).toBe(8);
  });

  it("temporary status is uncertain, not a guess", () => {
    const r = matchProgram(oas, facts({ age: 70, years_in_canada: 20, residency_status: "temporary_worker" }));
    expect(r.confidence).toBe("possibly");
  });
});

describe("Canada Child Benefit", () => {
  const ccb = P("ca-ccb");

  it("is likely for a citizen parent", () => {
    const r = matchProgram(ccb, facts({ children_ages: [2], residency_status: "citizen" }));
    expect(r.confidence).toBe("likely");
  });

  it("narrow miss: temporary worker in Canada for 17 months", () => {
    const r = matchProgram(ccb, facts({ children_ages: [2], residency_status: "temporary_worker", years_in_canada: 17 / 12 }));
    expect(r.confidence).toBe("not_eligible");
    expect(r.failed[0]).toMatch(/18 months/);
  });

  it("temporary worker for exactly 18 months qualifies", () => {
    const r = matchProgram(ccb, facts({ children_ages: [2], residency_status: "temporary_worker", years_in_canada: 1.5 }));
    expect(r.confidence).toBe("likely");
  });

  it("the 18-month rule does not apply to permanent residents (even new ones)", () => {
    const r = matchProgram(ccb, facts({ children_ages: [2], residency_status: "permanent_resident", years_in_canada: 0.2 }));
    expect(r.confidence).toBe("likely");
    expect(r.criteria.find((c) => c.id === "temporary_resident_18_months")!.outcome).toBe("not_applicable");
  });

  it("asks for years in Canada only for temporary residents", () => {
    const r = matchProgram(ccb, facts({ children_ages: [2], residency_status: "temporary_student" }));
    expect(r.missing_facts).toEqual(["years_in_canada"]);
  });

  it("child who just turned 18 does not count", () => {
    expect(matchProgram(ccb, facts({ children_ages: [18], residency_status: "citizen" })).confidence).toBe("not_eligible");
  });
});

describe("Canada Workers Benefit", () => {
  const cwb = P("ca-cwb");
  const worker = (f: Partial<Facts>) =>
    facts({ age: 30, has_partner: false, children_ages: [], employment_status: "employed", disability: false, student_status: "none", ...f });

  it("single worker under $35k is likely", () => {
    expect(matchProgram(cwb, worker({ family_income_band: "25k_35k" })).confidence).toBe("likely");
  });

  it("single worker in 35k–50k band straddles the $37,742 limit → possibly", () => {
    expect(matchProgram(cwb, worker({ family_income_band: "35k_50k" })).confidence).toBe("possibly");
  });

  it("family in 35k–50k band: upper bound 49,999 exceeds 49,393 → possibly, not likely", () => {
    expect(matchProgram(cwb, worker({ has_partner: true, family_income_band: "35k_50k" })).confidence).toBe("possibly");
  });

  it("not working → not eligible", () => {
    expect(matchProgram(cwb, worker({ employment_status: "unemployed", family_income_band: "under_15k" })).confidence).toBe("not_eligible");
  });

  it("full-time student without children → not eligible", () => {
    const r = matchProgram(cwb, worker({ student_status: "post_secondary_full_time", family_income_band: "under_15k" }));
    expect(r.confidence).toBe("not_eligible");
  });

  it("disability → data gap on income (limits not verified), never a guess", () => {
    const r = matchProgram(cwb, worker({ disability: true, family_income_band: "50k_70k" }));
    expect(r.confidence).toBe("possibly");
    expect(r.criteria.find((c) => c.id === "income_limit")!.outcome).toBe("data_gap");
  });
});

describe("jurisdiction scoping", () => {
  it("Ontario programs fail for a Quebec resident", () => {
    const r = matchProgram(P("on-otb"), facts({ province: "QC", age: 40 }));
    expect(r.confidence).toBe("not_eligible");
  });

  it("Toronto program: Scarborough counts as Toronto", () => {
    const r = matchProgram(P("to-fair-pass"), facts({ province: "ON", city: "Scarborough", age: 30, household_size: 1, family_income_band: "15k_25k" }));
    // 15,000–24,999 straddles $20,514 → possibly
    expect(r.confidence).toBe("possibly");
    expect(r.criteria[0].outcome).toBe("met");
  });

  it("Toronto program: Mississauga does not count", () => {
    const r = matchProgram(P("to-fair-pass"), facts({ province: "ON", city: "Mississauga", age: 30 }));
    expect(r.confidence).toBe("not_eligible");
  });

  it("Toronto program: unknown city in Ontario → ask for the city", () => {
    const r = matchProgram(P("to-fair-pass"), facts({ province: "ON", age: 30, household_size: 1, family_income_band: "under_15k" }));
    expect(r.confidence).toBe("possibly");
    expect(r.missing_facts).toEqual(expect.arrayContaining(["city"]));
  });

  it("Fair Pass: household size without a verified limit → data gap", () => {
    const r = matchProgram(P("to-fair-pass"), facts({ province: "ON", city: "Toronto", age: 30, household_size: 2, family_income_band: "under_15k" }));
    expect(r.criteria.find((c) => c.id === "income_below_75pct_lim_at")!.outcome).toBe("data_gap");
  });

  it("Fair Pass narrow miss: age 65", () => {
    const r = matchProgram(P("to-fair-pass"), facts({ province: "ON", city: "Toronto", age: 65, household_size: 1, family_income_band: "under_15k" }));
    expect(r.confidence).toBe("not_eligible");
  });
});

describe("tax filing (benefits paid through the tax system)", () => {
  const ccb = P("ca-ccb");
  const parent = (files_taxes: boolean | null) => facts({ children_ages: [2], residency_status: "citizen", files_taxes });

  it("filed → the tax criterion is met", () => {
    expect(matchProgram(ccb, parent(true)).confidence).toBe("likely");
  });

  it("not filed → possibly eligible with a 'file a tax return' check, never 'not eligible'", () => {
    const r = matchProgram(ccb, parent(false));
    expect(r.confidence).toBe("possibly");
    expect(r.criteria.find((c) => c.id === "files_tax_return")!.outcome).toBe("data_gap");
    expect(r.uncertain.join(" ")).toMatch(/File a tax return/);
  });

  it("unknown → we ask the question", () => {
    const r = matchProgram(ccb, parent(null));
    expect(r.confidence).toBe("possibly");
    expect(r.missing_facts).toContain("files_taxes");
  });

  it("programs not paid through taxes ignore it", () => {
    const r = matchProgram(P("on-child-care-fee-reduction"), facts({ province: "ON", children_ages: [2], files_taxes: false }));
    expect(r.confidence).toBe("likely");
  });
});

describe("follow-up questions", () => {
  it("only asks about facts that change an outcome, most impactful first", () => {
    const results = matchAll(SEED_PROGRAMS, facts({ province: "ON", city: "Toronto" }));
    const q = followUpFacts(results, 3);
    expect(q.length).toBe(3);
    expect(q).toContain("age");
  });

  it("does not ask about facts only used by programs already ruled out", () => {
    // Quebec resident: Ontario/Toronto programs fail, so Fair Pass's household_size is irrelevant.
    const results = matchAll(SEED_PROGRAMS, facts({ province: "QC", city: "Montréal", age: 40, has_partner: false, children_ages: [] }));
    expect(followUpFacts(results, 10)).not.toContain("household_size");
  });
});

describe("personas run through the same engine", () => {
  it("Maria (single mom, Toronto) is likely eligible for the CCB and child care fee reduction", () => {
    const maria = PERSONAS.find((p) => p.id === "maria")!;
    const byId = Object.fromEntries(matchAll(SEED_PROGRAMS, maria.facts).map((r) => [r.program_id, r.confidence]));
    expect(byId["ca-ccb"]).toBe("likely");
    expect(byId["on-child-care-fee-reduction"]).toBe("likely");
    expect(byId["ca-oas"]).toBe("not_eligible");
  });
});

describe("every seeded criterion cites an official source", () => {
  it("has an https source_url on an allowlisted domain", async () => {
    const { isAllowedUrl } = await import("@/lib/sources/allowlist");
    for (const p of SEED_PROGRAMS) {
      expect(isAllowedUrl(p.source_url), p.id).toBe(true);
      for (const c of p.eligibility_rules.criteria) expect(isAllowedUrl(c.source_url), `${p.id}/${c.id}`).toBe(true);
      if (p.benefit_amount) expect(isAllowedUrl(p.benefit_amount.source_url)).toBe(true);
    }
  });
});
