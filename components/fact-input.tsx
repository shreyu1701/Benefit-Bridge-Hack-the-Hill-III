"use client";

import { useId, useState } from "react";
import { useLang, useT } from "@/components/lang-provider";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ENUM_LABELS, FACT_META, incomeLabel, OPTIONS, PROVINCE_LABELS } from "@/lib/facts/labels";
import { LIST_KEYS, type Facts } from "@/lib/facts/schema";
import { cn } from "@/lib/utils";

type Key = keyof Facts;
const BOOL_KEYS: Key[] = ["has_partner", "disability", "has_dental_insurance", "receives_social_assistance", "files_taxes"];
const NUM_KEYS: Key[] = ["age", "household_size", "years_in_canada"];
/** Short enums read better as radio cards than a dropdown. */
const RADIO_ENUMS: Key[] = ["employment_status", "student_status", "housing"];

interface Props {
  k: Key;
  value: Facts[Key];
  onChange: (v: Facts[Key]) => void;
  idPrefix?: string;
  /** Label for the "no answer" choice. Always maps to null, which the rules engine treats as unknown. */
  unknownLabel?: string;
  error?: string | null;
}

/** One accessible control for one fact (used by onboarding, confirm and follow-up questions). */
export function FactInput({ k, value, onChange, idPrefix = "f", unknownLabel, error }: Props) {
  const lang = useLang();
  const t = useT();
  const id = `${idPrefix}-${k}`;
  const meta = FACT_META[k];
  const unknown = unknownLabel ?? t("confirm.unknown");
  const helpId = meta.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const Help = meta.help ? <p id={helpId} className="text-sm text-muted">{meta.help[lang]}</p> : null;
  const Err = error ? <p id={errorId} className="text-sm font-medium text-destructive">{error}</p> : null;

  if (BOOL_KEYS.includes(k)) {
    const opts: [string, string][] = [["yes", t("common.yes")], ["no", t("common.no")], ["unknown", unknown]];
    const current = value === true ? "yes" : value === false ? "no" : "unknown";
    return (
      <Choice
        id={id}
        legend={meta.question[lang]}
        help={Help}
        err={Err}
        describedBy={describedBy}
        value={current}
        options={opts}
        onValue={(v) => onChange((v === "yes" ? true : v === "no" ? false : null) as never)}
      />
    );
  }

  if (k === "children_ages") {
    return <ChildrenInput id={id} value={value as number[] | null} onChange={onChange as (v: number[] | null) => void} unknown={unknown} />;
  }

  if (NUM_KEYS.includes(k) || k === "city") {
    const isCity = k === "city";
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block font-semibold">{meta.question[lang]}</label>
        {Help}
        <Input
          id={id}
          type={isCity ? "text" : "number"}
          inputMode={isCity ? "text" : k === "years_in_canada" ? "decimal" : "numeric"}
          autoComplete={isCity ? "address-level2" : "off"}
          min={isCity ? undefined : k === "household_size" ? 1 : 0}
          max={isCity ? undefined : k === "household_size" ? 20 : 120}
          step={k === "years_in_canada" ? 0.5 : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn("min-h-11 bg-card text-base md:text-base", isCity ? "max-w-sm" : "w-36")}
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            if (isCity) return onChange((e.target.value || null) as never);
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange((n === null || Number.isNaN(n) ? null : k === "years_in_canada" ? n : Math.round(n)) as never);
          }}
        />
        {unknownLabel && (
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-6 accent-primary" checked={value === null} onChange={(e) => e.target.checked && onChange(null as never)} />
            {unknownLabel}
          </label>
        )}
        {Err}
      </div>
    );
  }

  const options = OPTIONS[k as keyof typeof OPTIONS] as readonly string[];

  if ((LIST_KEYS as readonly Key[]).includes(k)) {
    return (
      <Chips
        id={id}
        legend={meta.question[lang]}
        help={Help}
        describedBy={describedBy}
        options={options.map((o) => [o, ENUM_LABELS[o]?.[lang] ?? o] as [string, string])}
        value={(value as string[] | null) ?? []}
        onChange={(v) => onChange(v as never)}
      />
    );
  }

  const labelOf = (o: string) =>
    k === "province" ? PROVINCE_LABELS[o][lang] : k === "family_income_band" ? incomeLabel(o, lang) : ENUM_LABELS[o]?.[lang] ?? o;

  if (RADIO_ENUMS.includes(k)) {
    return (
      <Choice
        id={id}
        legend={meta.question[lang]}
        help={Help}
        err={Err}
        describedBy={describedBy}
        value={(value as string | null) ?? "unknown"}
        options={[...options.map((o) => [o, labelOf(o)] as [string, string]), ["unknown", unknown]]}
        onValue={(v) => onChange((v === "unknown" ? null : v) as never)}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">{meta.question[lang]}</label>
      {Help}
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="min-h-11 w-full max-w-sm rounded-md border border-input bg-card px-3 text-base"
        value={(value as string | null) ?? ""}
        onChange={(e) => onChange((e.target.value || null) as never)}
      >
        <option value="">{unknown}</option>
        {options.map((o) => (
          <option key={o} value={o}>{labelOf(o)}</option>
        ))}
      </select>
      {Err}
    </div>
  );
}

/** A labelled radio group (shadcn RadioGroup) with large, tappable option rows. */
function Choice({
  id, legend, help, err, describedBy, value, options, onValue,
}: {
  id: string; legend: string; help: React.ReactNode; err: React.ReactNode; describedBy?: string;
  value: string; options: [string, string][]; onValue: (v: string) => void;
}) {
  const legendId = `${id}-legend`;
  return (
    <div className="space-y-2">
      <p id={legendId} className="font-semibold">{legend}</p>
      {help}
      <RadioGroup
        aria-labelledby={legendId}
        aria-describedby={describedBy}
        value={value}
        onValueChange={onValue}
        className="flex flex-wrap gap-2"
      >
        {options.map(([v, label]) => (
          <label
            key={v}
            htmlFor={`${id}-${v}`}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2",
              value === v ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-border-strong",
            )}
          >
            <RadioGroupItem id={`${id}-${v}`} value={v} className="size-5" />
            {label}
          </label>
        ))}
      </RadioGroup>
      {err}
    </div>
  );
}

/** Pick any number: real checkboxes styled as chips, grouped in a fieldset. */
function Chips({
  id, legend, help, describedBy, options, value, onChange,
}: {
  id: string; legend: string; help: React.ReactNode; describedBy?: string;
  options: [string, string][]; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={describedBy}>
      <legend className="font-semibold">{legend}</legend>
      {help}
      <div className="flex flex-wrap gap-2">
        {options.map(([v, label]) => {
          const on = value.includes(v);
          return (
            <label
              key={v}
              htmlFor={`${id}-${v}`}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-3.5 py-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                on ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-border-strong",
              )}
            >
              <input
                id={`${id}-${v}`}
                type="checkbox"
                className="size-5 accent-primary"
                checked={on}
                // Keep the list in the schema's order, so the same choices always compare equal.
                onChange={(e) => onChange(options.map(([o]) => o).filter((o) => (o === v ? e.target.checked : value.includes(o))))}
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChildrenInput({ id, value, onChange, unknown }: { id: string; value: number[] | null; onChange: (v: number[] | null) => void; unknown: string }) {
  const lang = useLang();
  const t = useT();
  const agesId = useId();
  const [draft, setDraft] = useState(value?.join(", ") ?? "");
  const mode = value === null ? "unknown" : value.length === 0 ? "none" : "some";
  const parse = (s: string) => s.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 25);
  return (
    <div className="space-y-3">
      <Choice
        id={id}
        legend={FACT_META.children_ages.question[lang]}
        help={null}
        err={null}
        value={mode}
        options={[["none", lang === "fr" ? "Pas d'enfant" : "No children"], ["some", t("common.yes")], ["unknown", unknown]]}
        onValue={(v) => onChange(v === "none" ? [] : v === "unknown" ? null : parse(draft).length ? parse(draft) : [0])}
      />
      {mode === "some" && (
        <div className="space-y-1.5">
          <label htmlFor={agesId} className="block text-sm font-medium">
            {lang === "fr" ? "Âge de chaque enfant, séparés par des virgules (ex. 2, 4)" : "Each child's age, separated by commas (e.g. 2, 4)"}
          </label>
          <Input
            id={agesId}
            inputMode="numeric"
            className="min-h-11 w-48 bg-card text-base md:text-base"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const a = parse(e.target.value);
              if (a.length) onChange(a);
            }}
          />
        </div>
      )}
    </div>
  );
}
