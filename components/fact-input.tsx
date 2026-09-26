"use client";

import { useState } from "react";
import { useLang, useT } from "@/components/lang-provider";
import { ENUM_LABELS, FACT_META, incomeLabel, OPTIONS, PROVINCE_LABELS } from "@/lib/facts/labels";
import type { Facts } from "@/lib/facts/schema";

type Key = keyof Facts;
const BOOL_KEYS: Key[] = ["has_partner", "disability", "has_dental_insurance", "receives_social_assistance"];
const NUM_KEYS: Key[] = ["age", "household_size", "years_in_canada"];

/** One accessible control for one fact. "Not sure" always maps to null. */
export function FactInput({ k, value, onChange, idPrefix = "f" }: { k: Key; value: Facts[Key]; onChange: (v: Facts[Key]) => void; idPrefix?: string }) {
  const lang = useLang();
  const t = useT();
  const id = `${idPrefix}-${k}`;
  const meta = FACT_META[k];
  const unknown = t("confirm.unknown");

  if (BOOL_KEYS.includes(k)) {
    const opts: [string, boolean | null][] = [[t("common.yes"), true], [t("common.no"), false], [unknown, null]];
    return (
      <fieldset>
        <legend className="font-medium">{meta.question[lang]}</legend>
        {meta.help && <p className="text-sm text-muted">{meta.help[lang]}</p>}
        <div className="flex flex-wrap gap-3 mt-1">
          {opts.map(([label, v]) => (
            <label key={label} className="inline-flex items-center gap-2 min-h-11">
              <input type="radio" name={id} checked={value === v} onChange={() => onChange(v as never)} className="size-5" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (k === "children_ages") return <ChildrenInput id={id} value={value as number[] | null} onChange={onChange as (v: number[] | null) => void} />;

  if (NUM_KEYS.includes(k)) {
    return (
      <div>
        <label htmlFor={id} className="font-medium block">{meta.question[lang]}</label>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={k === "household_size" ? 1 : 0}
          max={120}
          step={k === "years_in_canada" ? 0.5 : 1}
          className="mt-1 w-32 rounded-md border border-border bg-card p-2 min-h-11"
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange((n === null || Number.isNaN(n) ? null : k === "years_in_canada" ? n : Math.round(n)) as never);
          }}
        />
      </div>
    );
  }

  if (k === "city") {
    return (
      <div>
        <label htmlFor={id} className="font-medium block">{meta.question[lang]}</label>
        <input id={id} type="text" autoComplete="address-level2" className="mt-1 w-full max-w-xs rounded-md border border-border bg-card p-2 min-h-11"
          value={(value as string | null) ?? ""} onChange={(e) => onChange((e.target.value || null) as never)} />
      </div>
    );
  }

  const options = OPTIONS[k as keyof typeof OPTIONS] as readonly string[];
  const labelOf = (o: string) =>
    k === "province" ? PROVINCE_LABELS[o][lang] : k === "family_income_band" ? incomeLabel(o, lang) : ENUM_LABELS[o]?.[lang] ?? o;
  return (
    <div>
      <label htmlFor={id} className="font-medium block">{meta.question[lang]}</label>
      {meta.help && <p id={`${id}-help`} className="text-sm text-muted">{meta.help[lang]}</p>}
      <select id={id} aria-describedby={meta.help ? `${id}-help` : undefined} className="mt-1 rounded-md border border-border bg-card p-2 min-h-11 max-w-full"
        value={(value as string | null) ?? ""} onChange={(e) => onChange((e.target.value || null) as never)}>
        <option value="">{unknown}</option>
        {options.map((o) => (
          <option key={o} value={o}>{labelOf(o)}</option>
        ))}
      </select>
    </div>
  );
}

function ChildrenInput({ id, value, onChange }: { id: string; value: number[] | null; onChange: (v: number[] | null) => void }) {
  const lang = useLang();
  const t = useT();
  const [draft, setDraft] = useState(value?.join(", ") ?? "");
  const mode = value === null ? "unknown" : value.length === 0 ? "none" : "some";
  const parse = (s: string) => s.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 25);
  return (
    <fieldset>
      <legend className="font-medium">{FACT_META.children_ages.question[lang]}</legend>
      <div className="flex flex-wrap gap-3 mt-1">
        <label className="inline-flex items-center gap-2 min-h-11">
          <input type="radio" name={id} className="size-5" checked={mode === "none"} onChange={() => onChange([])} />
          {lang === "fr" ? "Pas d'enfant" : "No children"}
        </label>
        <label className="inline-flex items-center gap-2 min-h-11">
          <input type="radio" name={id} className="size-5" checked={mode === "some"} onChange={() => onChange(parse(draft).length ? parse(draft) : [0])} />
          {lang === "fr" ? "Oui" : "Yes"}
        </label>
        <label className="inline-flex items-center gap-2 min-h-11">
          <input type="radio" name={id} className="size-5" checked={mode === "unknown"} onChange={() => onChange(null)} />
          {t("confirm.unknown")}
        </label>
      </div>
      {mode === "some" && (
        <div className="mt-2">
          <label htmlFor={`${id}-ages`} className="block text-sm">
            {lang === "fr" ? "Âges, séparés par des virgules (ex. 2, 4)" : "Ages, separated by commas (e.g. 2, 4)"}
          </label>
          <input id={`${id}-ages`} inputMode="numeric" className="mt-1 w-48 rounded-md border border-border bg-card p-2 min-h-11"
            value={draft} onChange={(e) => { setDraft(e.target.value); const a = parse(e.target.value); if (a.length) onChange(a); }} />
        </div>
      )}
    </fieldset>
  );
}
