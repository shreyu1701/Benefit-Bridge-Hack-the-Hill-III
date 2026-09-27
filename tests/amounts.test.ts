import { describe, expect, it } from "vitest";
import { AMOUNT_TABLES, CCB_AMOUNTS } from "@/data/amounts";
import { deriveData } from "@/lib/facts/derive";
import { emptyFacts, type Facts } from "@/lib/facts/schema";
import { ccbAnnual, cdbCeiling, cwbCeiling, describeEstimate, estimateFor } from "@/lib/rules/amounts";

const d = (x: Partial<Facts>) => deriveData({ ...emptyFacts(), ...x });
const NOW = new Date("2026-09-27T12:00:00Z");

describe("published figures", () => {
  it("are not past their re-check date (update data/amounts.ts from the official page)", () => {
    for (const t of AMOUNT_TABLES) expect(new Date(t.valid_until + "T23:59:59Z").getTime(), t.program_id).toBeGreaterThan(Date.now());
  });

  it("CCB phase-2 bases match rate × the published threshold gap", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(Math.round(CCB_AMOUNTS.rate_1[n] * (CCB_AMOUNTS.threshold_2 - CCB_AMOUNTS.threshold_1))).toBe(CCB_AMOUNTS.base_2[n]);
    }
  });
});

describe("Canada Child Benefit estimate", () => {
  it("full amount below the first threshold", () => {
    expect(ccbAnnual(2, 0, 30_000)).toBe(2 * 8157);
    expect(ccbAnnual(1, 1, 38_237)).toBe(8157 + 6883);
  });

  it("phase 1 and phase 2 reductions", () => {
    // One child under 6 at $50,000: 8,157 − 7% × (50,000 − 38,237) = 7,333.59
    expect(ccbAnnual(1, 0, 50_000)).toBe(7334);
    // Two children 6–17 at $100,000: 13,766 − (6,022 + 5.7% × 17,153) = 6,766.28
    expect(ccbAnnual(0, 2, 100_000)).toBe(6766);
  });

  it("is a range over the person's income band, and needs children and income", () => {
    const e = estimateFor("ca-ccb", d({ children_ages: [2, 4], family_income_band: "25k_35k" }), NOW)!;
    expect(e).toMatchObject({ kind: "range", low: 16314, high: 16314, per: "year" }); // whole band is under $38,237
    const r = estimateFor("ca-ccb", d({ children_ages: [3], family_income_band: "35k_50k" }), NOW)!;
    expect([r.low, r.high]).toEqual([ccbAnnual(1, 0, 49_999), 8157]);
    expect(estimateFor("ca-ccb", d({ children_ages: [3] }), NOW)).toBeNull();
    expect(estimateFor("ca-ccb", d({ children_ages: [], family_income_band: "under_15k" }), NOW)).toBeNull();
  });

  it("disappears after the figures expire", () => {
    expect(estimateFor("ca-ccb", d({ children_ages: [2], family_income_band: "under_15k" }), new Date("2027-07-01"))).toBeNull();
  });
});

describe("Canada Workers Benefit ceiling", () => {
  it("follows the published start and zero points", () => {
    expect(cwbCeiling(false, 20_000)).toBe(1633);
    expect(cwbCeiling(false, 37_742)).toBe(0);
    expect(cwbCeiling(true, 40_016)).toBe(Math.round(2813 / 2)); // halfway between 30,639 and 49,393
  });

  it("is only a ceiling, and not given where amounts differ (Alberta, Quebec, Nunavut)", () => {
    const base = { has_partner: false, children_ages: [], family_income_band: "15k_25k" as const };
    expect(estimateFor("ca-cwb", d({ ...base, province: "ON" }), NOW)).toMatchObject({ kind: "up_to", high: 1633 });
    expect(estimateFor("ca-cwb", d({ ...base, province: "QC" }), NOW)).toBeNull();
  });
});

describe("Old Age Security estimate", () => {
  it("is years in Canada after 18 ÷ 40 of the maximum for the age group", () => {
    expect(estimateFor("ca-oas", d({ age: 70, years_in_canada: 70 }), NOW)).toMatchObject({ high: 751.97, per: "month" });
    expect(estimateFor("ca-oas", d({ age: 80, years_in_canada: 80 }), NOW)).toMatchObject({ high: 827.17 });
    expect(estimateFor("ca-oas", d({ age: 70, years_in_canada: 20 }), NOW)!.high).toBeCloseTo((751.97 * 20) / 40, 2);
    expect(estimateFor("ca-oas", d({ age: 70, years_in_canada: 8 }), NOW)).toBeNull();
  });
});

describe("Canada Disability Benefit ceiling", () => {
  it("is the full amount up to threshold + the largest work exemption, then falls at the published rate", () => {
    expect(cdbCeiling(false, 33_210)).toBe(2448.4); // 23,000 + 10,210
    expect(cdbCeiling(false, 38_210)).toBe(1448.4); // 5,000 over → −20%
    expect(cdbCeiling(false, 45_452)).toBe(0);
    expect(cdbCeiling(true, 46_794 + 10_000)).toBe(1448.4); // couples: gentlest (10%) rate
  });

  it("gives an 'up to' figure from the bottom of the income band", () => {
    const e = estimateFor("ca-cdb", d({ has_partner: false, family_income_band: "35k_50k" }), NOW)!;
    expect(e).toMatchObject({ kind: "up_to", high: Math.round(cdbCeiling(false, 35_000)) });
  });
});

describe("wording", () => {
  it("says it's a range from the income they gave, in both languages", () => {
    const e = estimateFor("ca-ccb", d({ children_ages: [3], family_income_band: "35k_50k" }), NOW)!;
    expect(describeEstimate(e, "en")).toMatch(/^About \$\d[\d,]* to \$8,157 a year \(about \$\d[\d,]* to \$680 a month\), based on the income range you gave\. July 2026/);
    expect(describeEstimate(e, "fr")).toMatch(/^Environ .* par année/);
  });
});
