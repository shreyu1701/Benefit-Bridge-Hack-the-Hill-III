import { deriveData } from "@/lib/facts/derive";
import type { Facts, LifeEvent, Need } from "@/lib/facts/schema";
import type { UiLang } from "@/lib/i18n/messages";
import { evaluateLogic } from "@/lib/rules/engine";
import type { ImpactRow } from "@/lib/db/bill-impacts";
import { billTitle } from "@/lib/bills-repo";

/**
 * "Changes that may affect you": reviewer-approved bill impacts, evaluated with
 * the same deterministic engine as programs. Pure (no I/O).
 *
 *  - The approved conditions hold for this person      → "affects"
 *  - A condition can't be checked (unknown fact)       → "may_affect"
 *  - No conditions, but the bill is about what they
 *    told us (needs / life events)                     → "may_affect"
 *  - A condition fails, or nothing connects            → not shown
 */
export interface LawForYou {
  bill_id: number;
  bill_number: string;
  jurisdiction: string;
  title: string;
  /** Royal assent date (it's law) or null (still a proposal). */
  law_since: string | null;
  stage: string | null;
  who: string;
  match: "affects" | "may_affect";
  relevance: { needs: Need[]; life_events: LifeEvent[] };
  source_url: string;
}

export const MAX_LAWS = 5;

export function lawsForYou(impacts: ImpactRow[], facts: Facts, lang: UiLang, limit = MAX_LAWS): LawForYou[] {
  const data = deriveData(facts);
  const out: (LawForYou & { score: number })[] = [];
  for (const i of impacts) {
    if (i.status !== "approved") continue;
    const relevance = {
      needs: i.needs.filter((n) => facts.needs?.includes(n)),
      life_events: i.life_events.filter((e) => facts.life_events?.includes(e)),
    };
    const related = relevance.needs.length + relevance.life_events.length;

    let match: LawForYou["match"] | null;
    if (i.applies_if) {
      const r = evaluateLogic(i.applies_if, data).state;
      match = r === "true" ? "affects" : r === "false" ? null : "may_affect";
    } else {
      match = related > 0 ? "may_affect" : null;
    }
    if (!match) continue;

    out.push({
      bill_id: i.bill_id,
      bill_number: i.bill_number,
      jurisdiction: i.jurisdiction_code,
      title: billTitle({ titles: i.titles, bill_number: i.bill_number }, lang),
      law_since: i.royal_assent_at,
      stage: lang === "fr" ? i.current_stage_fr ?? i.status_fr ?? i.current_stage : i.current_stage ?? i.status_en,
      who: i.who[lang] || i.who.en,
      match,
      relevance,
      source_url: i.bill_source_url,
      // "Affects you" first, then what they came for, then laws already passed.
      score: (match === "affects" ? 100 : 0) + related * 10 + (i.royal_assent_at ? 1 : 0),
    });
  }
  return out
    .sort((a, b) => b.score - a.score || a.bill_number.localeCompare(b.bill_number))
    .slice(0, limit)
    .map(({ score, ...l }) => (void score, l));
}
