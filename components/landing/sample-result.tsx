import { PERSONAS } from "@/data/personas";
import { SEED_PROGRAMS } from "@/data/programs";
import { Badge } from "@/components/ui/badge";
import { deriveData } from "@/lib/facts/derive";
import { formatFact } from "@/lib/facts/labels";
import type { Facts } from "@/lib/facts/schema";
import type { UiLang } from "@/lib/i18n/messages";
import type { LandingCopy } from "@/lib/i18n/landing";
import { buildCards } from "@/lib/present";
import { estimateFor, type Estimate } from "@/lib/rules/amounts";

const PERSONA_ID = "maria";
const SHOWN_FACTS: (keyof Facts)[] = ["city", "children_ages", "family_income_band", "employment_status"];
const LEVEL = { federal: { en: "Federal", fr: "Fédéral" }, provincial: { en: "Ontario", fr: "Ontario" }, municipal: { en: "Toronto", fr: "Toronto" } } as const;

function short(e: Estimate, lang: UiLang): string {
  const money = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  const per = e.per === "year" ? (lang === "fr" ? "/an" : "/yr") : lang === "fr" ? "/mois" : "/mo";
  if (e.kind === "up_to") return `${lang === "fr" ? "jusqu'à" : "up to"} ${money(e.high)}${per}`;
  return e.low === e.high ? `≈ ${money(e.high)}${per}` : `${money(e.low)}–${money(e.high)}${per}`;
}

/**
 * A real result for an illustrative person, computed at render time by the same
 * rules engine and estimate formulas as everyone's results (never hand-typed),
 * so the landing page can't drift from what the app actually says.
 */
export function SampleResult({ lang, copy }: { lang: UiLang; copy: LandingCopy["sample"] }) {
  const persona = PERSONAS.find((p) => p.id === PERSONA_ID)!;
  const views = SEED_PROGRAMS.map((p) => ({ ...p, status_reason: null, has_pending_review: false, source_last_changed: null, laws: [] }));
  const cards = buildCards(views, persona.facts, lang).filter((c) => c.confidence !== "not_eligible");
  const likely = cards.filter((c) => c.confidence === "likely").slice(0, 3);
  const data = deriveData(persona.facts);
  const chips = SHOWN_FACTS.map((k) => formatFact(k, persona.facts[k], lang)).filter(Boolean) as string[];

  return (
    <figure className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.25)]">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-muted">{copy.label}</figcaption>
      <p className="mt-2 font-display text-xl leading-snug">{persona.blurb[lang]}</p>
      <ul aria-label={copy.said} className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <li key={c} className="rounded-full border border-primary-soft-border bg-primary-soft px-2.5 py-1 text-[13px] text-primary-soft-fg">{c}</li>
        ))}
      </ul>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {likely.map((c) => {
          const e = estimateFor(c.id, data);
          return (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{c.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge variant="likely">✓ {copy.likely}</Badge>
                  {LEVEL[c.level][lang]}
                </p>
              </div>
              {e && <p className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-primary">{short(e, lang)}</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm">{copy.more.replace("{n}", String(cards.length - likely.length))}</p>
      <p className="mt-1 text-xs text-muted">{copy.note}</p>
    </figure>
  );
}
