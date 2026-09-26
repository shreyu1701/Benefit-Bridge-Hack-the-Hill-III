"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useLang, useT } from "@/components/lang-provider";
import { FactInput } from "@/components/fact-input";
import { FACT_META, formatFact } from "@/lib/facts/labels";
import { FACT_KEYS, emptyFacts, type Facts } from "@/lib/facts/schema";
import { clearFlow, loadFlow, saveFlow, type FlowState } from "@/lib/session-state";

export function FactConfirm() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [editing, setEditing] = useState<keyof Facts | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // sessionStorage is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlow(loadFlow() ?? { facts: emptyFacts(), detected_language: null, sensitive_data_ignored: false, evidence: [] });
  }, []);
  useEffect(() => {
    if (editing) editorRef.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, [editing]);

  if (!flow) return <p>{t("common.loading")}</p>;

  const set = (k: keyof Facts, v: Facts[keyof Facts]) => {
    const next = { ...flow, facts: { ...flow.facts, [k]: v } };
    setFlow(next);
    saveFlow(next);
  };
  const known = FACT_KEYS.filter((k) => flow.facts[k] !== null);
  const unknown = FACT_KEYS.filter((k) => flow.facts[k] === null);

  const chip = (k: keyof Facts) => {
    const v = formatFact(k, flow.facts[k], lang);
    return (
      <li key={k}>
        <button
          type="button"
          onClick={() => setEditing(editing === k ? null : k)}
          aria-expanded={editing === k}
          aria-controls="fact-editor"
          className={`inline-flex items-center gap-2 rounded-full border px-3 min-h-11 text-left ${v ? "border-primary bg-card" : "border-dashed border-border text-muted"}`}
        >
          <span className="font-medium">{FACT_META[k].label[lang]}:</span>
          <span>{v ?? t("confirm.unknown")}</span>
          <Pencil aria-hidden size={14} />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("confirm.title")}</h1>
        <p className="text-muted">{t("confirm.help")}</p>
      </div>
      {flow.detected_language && (
        <p className="text-sm">
          {t("confirm.detected")} <strong>{languageName(flow.detected_language, lang)}</strong>
        </p>
      )}
      {flow.sensitive_data_ignored && <Notice>{t("confirm.sensitive")}</Notice>}

      <ul className="flex flex-wrap gap-2" aria-label={t("confirm.title")}>
        {known.map(chip)}
      </ul>

      {editing && (
        <div id="fact-editor" ref={editorRef} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <FactInput k={editing} value={flow.facts[editing]} onChange={(v) => set(editing, v)} />
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>OK</Button>
        </div>
      )}

      {unknown.length > 0 && (
        <details className="rounded-lg border border-border p-3" open={known.length === 0}>
          <summary className="cursor-pointer font-medium min-h-11 flex items-center">
            {lang === "fr" ? `Ajouter d'autres renseignements (${unknown.length})` : `Add more details (${unknown.length})`}
          </summary>
          <ul className="flex flex-wrap gap-2 mt-2">{unknown.map(chip)}</ul>
        </details>
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => router.push("/results")}>{t("confirm.submit")}</Button>
        <Button variant="ghost" onClick={() => { clearFlow(); router.push("/"); }}>{t("confirm.back")}</Button>
      </div>
    </div>
  );
}

function languageName(code: string, ui: string) {
  try {
    return new Intl.DisplayNames([ui], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
