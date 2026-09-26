import { PERSONAS } from "@/data/personas";
import { FACT_META } from "@/lib/facts/labels";
import type { Facts } from "@/lib/facts/schema";
import type { UiLang } from "@/lib/i18n/messages";
import { isStale, type ProgramView } from "@/lib/programs-repo";
import { followUpFacts, matchAll, matchProgram } from "@/lib/rules/engine";
import type { Confidence, MatchResult } from "@/lib/rules/types";
import { isAllowedUrl } from "@/lib/sources/allowlist";

/**
 * Turns engine results into what the UI shows. Pure (no I/O) so it is easy to
 * test. Enforces "no citation = don't show it": a program without an official
 * source URL is dropped, and each reason carries the page it came from.
 */
export interface Cited {
  text: string;
  source_url: string;
}

export interface ProgramCard {
  id: string;
  name: string;
  level: ProgramView["level"];
  confidence: Confidence;
  summary: string;
  reasons_met: Cited[];
  uncertain: Cited[];
  failed: Cited[];
  also_required: string[];
  amount: { text: string; source_url: string } | null;
  deadlines: { label: string; date: string | null; source_url: string }[];
  how_to_apply: string;
  application_url: string;
  source_url: string;
  status: ProgramView["status"];
  status_reason: string | null;
  stale: boolean;
  pending_review: boolean;
  last_verified_at: string | null;
  source_last_changed: string | null;
  law: { title: string; citation: string; what_changed: string; approved: boolean; source_url: string } | null;
}

export interface PersonaScenario {
  id: string;
  name: string;
  blurb: string;
  likely: string[];
  possibly: { name: string; check: string }[];
}

export interface MatchResponse {
  lang: string;
  machine_translated: boolean;
  cards: ProgramCard[];
  followups: { fact: keyof Facts; question: string; help: string | null }[];
  personas: PersonaScenario[];
}

const ORDER: Record<Confidence, number> = { likely: 0, possibly: 1, not_eligible: 2 };

function cite(r: MatchResult, outcome: (o: string) => boolean): Cited[] {
  return r.criteria.filter((c) => outcome(c.outcome)).map((c) => ({ text: c.text, source_url: c.source_url }));
}

export function buildCards(programs: ProgramView[], facts: Facts, lang: UiLang, now = new Date()): ProgramCard[] {
  const cited = programs.filter((p) => isAllowedUrl(p.source_url));
  return cited
    .map((p) => {
      const r = matchProgram(p, facts, lang);
      const law = p.laws[0];
      return {
        id: p.id,
        name: p.name[lang],
        level: p.level,
        confidence: r.confidence,
        summary: p.summaries_by_language[lang] ?? p.summaries_by_language.en,
        reasons_met: cite(r, (o) => o === "met"),
        uncertain: cite(r, (o) => o === "unknown" || o === "data_gap"),
        failed: cite(r, (o) => o === "failed"),
        also_required: p.eligibility_rules.also_required.map((a) => a[lang]),
        amount: p.benefit_amount ? { text: p.benefit_amount.text[lang], source_url: p.benefit_amount.source_url } : null,
        deadlines: p.deadlines.map((d) => ({ label: d.label[lang], date: d.date, source_url: d.source_url })),
        how_to_apply: p.how_to_apply[lang],
        application_url: p.application_url,
        source_url: p.source_url,
        status: p.status,
        status_reason: p.status_reason,
        stale: isStale(p, now),
        pending_review: p.has_pending_review,
        last_verified_at: p.last_verified_at,
        source_last_changed: p.source_last_changed,
        law: law
          ? { title: law.title[lang], citation: law.citation, what_changed: law.what_changed[lang], approved: law.approved, source_url: law.source_url }
          : null,
      } satisfies ProgramCard;
    })
    .sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence] || a.name.localeCompare(b.name));
}

export function buildFollowups(programs: ProgramView[], facts: Facts, lang: UiLang, skip: string[] = []) {
  const results = matchAll(programs, facts, lang);
  return followUpFacts(results, 3, skip).map((f) => {
    const meta = FACT_META[f as keyof Facts];
    return { fact: f as keyof Facts, question: meta.question[lang], help: meta.help?.[lang] ?? null };
  });
}

/** Pick 2–3 personas most similar to the user; their outcomes come from the same engine. */
export function buildPersonas(programs: ProgramView[], facts: Facts, lang: UiLang, n = 3): PersonaScenario[] {
  const score = (p: Facts) => {
    let s = 0;
    if (facts.has_partner !== null && p.has_partner === facts.has_partner) s += 2;
    if (facts.children_ages !== null && (p.children_ages?.length ?? 0) > 0 === facts.children_ages.length > 0) s += 3;
    if (facts.age !== null && p.age !== null) s += Math.max(0, 3 - Math.abs(p.age - facts.age) / 10);
    if (facts.residency_status && p.residency_status === facts.residency_status) s += 1;
    if (facts.student_status && p.student_status === facts.student_status) s += 1;
    return s;
  };
  return [...PERSONAS]
    .sort((a, b) => score(b.facts) - score(a.facts))
    .slice(0, n)
    .map((persona) => {
      const rs = matchAll(programs, persona.facts, lang);
      const name = (id: string) => programs.find((p) => p.id === id)!.name[lang];
      return {
        id: persona.id,
        name: persona.name,
        blurb: persona.blurb[lang],
        likely: rs.filter((r) => r.confidence === "likely").map((r) => name(r.program_id)),
        possibly: rs.filter((r) => r.confidence === "possibly").map((r) => ({ name: name(r.program_id), check: r.uncertain[0] ?? "" })),
      };
    });
}

/** Region for anonymous analytics: a jurisdiction code, never anything finer. */
export function regionOf(facts: Facts, municipality: string | null): string {
  if (facts.province === "ON" && municipality === "toronto") return "ON-TORONTO";
  return facts.province ?? "unknown";
}
