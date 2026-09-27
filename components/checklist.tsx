"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/program-card";
import { useLang, useT } from "@/components/lang-provider";
import type { MatchResponse } from "@/lib/present";
import { formatDate } from "@/lib/utils";

/** Printable checklist built from the results already in this tab (nothing is sent to a server). */
export function Checklist() {
  const t = useT();
  const lang = useLang();
  const [data, setData] = useState<MatchResponse | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bb.results");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(raw ? JSON.parse(raw) : null);
    } catch {
      setData(null);
    }
  }, []);

  if (data === undefined) return <p>{t("common.loading")}</p>;
  if (!data) return <p>{t("checklist.empty")} <Link href="/start" className="underline">{t("nav.home")}</Link></p>;

  const items = data.cards.filter((c) => c.confidence !== "not_eligible");
  const asText = () =>
    [t("checklist.title"), "", ...items.flatMap((c) => [
      `☐ ${c.name} — ${c.confidence === "likely" ? t("results.likely") : t("results.possibly")}`,
      ...c.deadlines.map((d) => `   ${d.date ? formatDate(d.date, lang) + ": " : ""}${d.label}`),
      `   ${c.application_url}`, "",
    ]), t("disclaimer")].join("\n");

  async function share() {
    const text = asText();
    if (navigator.share) {
      try { await navigator.share({ title: t("checklist.title"), text }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("checklist.title")}</h1>
      <div className="flex gap-2 no-print">
        <Button onClick={() => window.print()}>{t("checklist.print")}</Button>
        <Button variant="outline" onClick={share}>{t("checklist.share")}</Button>
        <span aria-live="polite" className="self-center text-sm">{copied ? t("checklist.copied") : ""}</span>
      </div>
      <ol className="space-y-4">
        {items.map((c) => (
          <li key={c.id} className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1.5 size-5" />
              <span className="space-y-1">
                <span className="block font-bold">{c.name}</span>
                <ConfidenceBadge c={c.confidence} />
                {c.deadlines.map((d, i) => (
                  <span key={i} className="block text-sm">{d.date ? <strong>{formatDate(d.date, lang)}: </strong> : null}{d.label}</span>
                ))}
                {c.uncertain.slice(0, 2).map((u, i) => <span key={i} className="block text-sm">• {u.text}</span>)}
                <a href={c.application_url} className="block text-sm text-primary underline break-all">{c.application_url}</a>
              </span>
            </label>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">{t("disclaimer")}</p>
    </div>
  );
}
