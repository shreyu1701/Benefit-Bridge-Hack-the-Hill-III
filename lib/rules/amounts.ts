import { CCB_AMOUNTS, CDB_AMOUNTS, CWB_AMOUNTS, OAS_AMOUNTS } from "@/data/amounts";
import type { DerivedData } from "@/lib/facts/derive";
import type { Localized } from "./types";

/**
 * Personal dollar estimates from published formulas. Pure and deterministic.
 * Like the rules engine, income is a band: every estimate is computed at both
 * ends of it, so the answer is a range, never a made-up single number. If any
 * input is unknown, or the figures have expired, there is no estimate.
 */
export interface Estimate {
  program_id: string;
  /** "range": the formula is complete. "up_to": a ceiling (something we don't ask about can lower it). */
  kind: "range" | "up_to";
  low: number;
  high: number;
  per: "year" | "month";
  period: Localized;
  source_url: string;
}

const expired = (validUntil: string, now: Date) => now.getTime() > new Date(validUntil + "T23:59:59Z").getTime();

/** Annual CCB for a family income (published two-phase formula). */
export function ccbAnnual(under6: number, age6to17: number, income: number): number {
  const a = CCB_AMOUNTS;
  const n = Math.min(4, under6 + age6to17);
  if (n === 0) return 0;
  const max = under6 * a.max_under_6 + age6to17 * a.max_6_to_17;
  const reduction =
    income <= a.threshold_1 ? 0
    : income <= a.threshold_2 ? a.rate_1[n] * (income - a.threshold_1)
    : a.base_2[n] + a.rate_2[n] * (income - a.threshold_2);
  return Math.max(0, Math.round(max - reduction));
}

/** Most CWB (basic amount) at this income: straight line from where reduction starts to where it reaches zero. */
export function cwbCeiling(family: boolean, income: number): number {
  const t = family ? CWB_AMOUNTS.family : CWB_AMOUNTS.single;
  if (income <= t.start) return t.max;
  if (income >= t.zero) return 0;
  return Math.round((t.max * (t.zero - income)) / (t.zero - t.start));
}

function ccb(d: DerivedData): Estimate | null {
  if (d.children_ages === null || d.family_income === null) return null;
  const under6 = d.children_ages.filter((x) => x < 6).length;
  const older = d.children_ages.filter((x) => x >= 6 && x < 18).length;
  if (under6 + older === 0) return null;
  const low = ccbAnnual(under6, older, d.family_income.max);
  const high = ccbAnnual(under6, older, d.family_income.min);
  if (high === 0) return null;
  return { program_id: CCB_AMOUNTS.program_id, kind: "range", low, high, per: "year", period: CCB_AMOUNTS.period, source_url: CCB_AMOUNTS.source_url };
}

function cwb(d: DerivedData): Estimate | null {
  if (d.family_income === null || d.has_partner === null || d.num_children === null || d.province === null) return null;
  if ((CWB_AMOUNTS.provinces_excluded as readonly string[]).includes(d.province)) return null; // different amounts there
  const family = d.has_partner || d.num_children > 0;
  const high = cwbCeiling(family, d.family_income.min);
  if (high === 0) return null;
  return { program_id: CWB_AMOUNTS.program_id, kind: "up_to", low: 0, high, per: "year", period: CWB_AMOUNTS.period, source_url: CWB_AMOUNTS.source_url };
}

function oas(d: DerivedData): Estimate | null {
  if (d.age === null || d.age < 65 || d.years_in_canada_since_18 === null) return null;
  const years = Math.min(OAS_AMOUNTS.full_years, Math.floor(d.years_in_canada_since_18));
  if (years < 10) return null;
  const max = d.age >= 75 ? OAS_AMOUNTS.max_monthly_75_plus : OAS_AMOUNTS.max_monthly_65_74;
  const high = Math.round((max * years) / OAS_AMOUNTS.full_years * 100) / 100;
  return { program_id: OAS_AMOUNTS.program_id, kind: "up_to", low: 0, high, per: "month", period: OAS_AMOUNTS.period, source_url: OAS_AMOUNTS.source_url };
}

/** Canada Disability Benefit ceiling: assumes the largest work-income exemption and the gentlest rate, so it's never too low. */
export function cdbCeiling(couple: boolean, income: number): number {
  const t = couple ? CDB_AMOUNTS.couple : CDB_AMOUNTS.single;
  const counted = Math.max(0, income - t.working_exemption - t.threshold);
  return Math.max(0, Math.round((CDB_AMOUNTS.max_annual - t.rate * counted) * 100) / 100);
}

function cdb(d: DerivedData): Estimate | null {
  if (d.family_income === null || d.has_partner === null) return null;
  const high = Math.round(cdbCeiling(d.has_partner, d.family_income.min));
  if (high === 0) return null;
  return { program_id: CDB_AMOUNTS.program_id, kind: "up_to", low: 0, high, per: "year", period: CDB_AMOUNTS.period, source_url: CDB_AMOUNTS.source_url };
}

const ESTIMATORS: Record<string, { fn: (d: DerivedData) => Estimate | null; valid_until: string }> = {
  [CCB_AMOUNTS.program_id]: { fn: ccb, valid_until: CCB_AMOUNTS.valid_until },
  [CWB_AMOUNTS.program_id]: { fn: cwb, valid_until: CWB_AMOUNTS.valid_until },
  [OAS_AMOUNTS.program_id]: { fn: oas, valid_until: OAS_AMOUNTS.valid_until },
  [CDB_AMOUNTS.program_id]: { fn: cdb, valid_until: CDB_AMOUNTS.valid_until },
};

export function estimateFor(programId: string, d: DerivedData, now = new Date()): Estimate | null {
  const e = ESTIMATORS[programId];
  if (!e || expired(e.valid_until, now)) return null;
  return e.fn(d);
}

/** Plain-language sentence for a card. */
export function describeEstimate(e: Estimate, lang: "en" | "fr"): string {
  const money = (n: number) =>
    n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: e.per === "month" ? 2 : 0, minimumFractionDigits: e.per === "month" ? 2 : 0 });
  const per = lang === "fr" ? (e.per === "year" ? "par année" : "par mois") : e.per === "year" ? "a year" : "a month";
  const m = (n: number) => money(Math.round(n / 12));
  const to = lang === "fr" ? " à " : " to ";
  const monthlyAmount = e.kind === "up_to" || e.low === e.high ? m(e.high) : m(e.low) + to + m(e.high);
  const monthly = e.per === "year" ? (lang === "fr" ? ` (environ ${monthlyAmount} par mois)` : ` (about ${monthlyAmount} a month)`) : "";
  if (e.kind === "up_to") {
    return lang === "fr"
      ? `Jusqu'à environ ${money(e.high)} ${per}${monthly}. ${e.period.fr}. Le montant réel peut être plus bas.`
      : `Up to about ${money(e.high)} ${per}${monthly}. ${e.period.en}. Your actual amount may be lower.`;
  }
  const amount = e.low === e.high ? money(e.high) : money(e.low) + to + money(e.high);
  return lang === "fr"
    ? `Environ ${amount} ${per}${monthly}, selon la tranche de revenu que vous avez indiquée. ${e.period.fr}.`
    : `About ${amount} ${per}${monthly}, based on the income range you gave. ${e.period.en}.`;
}
