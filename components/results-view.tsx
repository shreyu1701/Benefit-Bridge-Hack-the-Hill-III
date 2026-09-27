"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { FactInput } from "@/components/fact-input";
import { ProgramCard } from "@/components/program-card";
import { useLang, useT } from "@/components/lang-provider";
import { ENUM_LABELS } from "@/lib/facts/labels";
import type { Facts } from "@/lib/facts/schema";
import type { MatchResponse } from "@/lib/present";
import { loadFlow, saveFlow, type FlowState } from "@/lib/session-state";

const LEVELS = ["federal", "provincial", "municipal"] as const;

export function ResultsView() {
  const t = useT();
  const uiLang = useLang();
  const router = useRouter();
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState<string[]>([]);
  const [showNot, setShowNot] = useState(false);
  const [answers, setAnswers] = useState<Partial<Facts>>({});
  const [moreQuestions, setMoreQuestions] = useState(false);
  /** After an answer re-runs the match: which results moved (read out by the live region). */
  const [moved, setMoved] = useState<MatchResponse["cards"] | null>(null);
  const lastCards = useRef<MatchResponse["cards"] | null>(null);
  const answered = useRef(false);

  // Results language: the user's own language if it's not English/French, else the UI language.
  const resultsLang =
    flow?.detected_language &&
    !["en", "fr"].includes(flow.detected_language.split("-")[0])
      ? flow.detected_language
      : uiLang;

  const run = useCallback(
    async (facts: Facts, skipList: string[]) => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facts,
            lang: resultsLang,
            skip_questions: skipList,
            questions: moreQuestions ? 6 : 3,
          }),
        });
        if (!res.ok) throw new Error();
        const d: MatchResponse = await res.json();
        if (answered.current && lastCards.current) {
          const before = new Map(lastCards.current.map((c) => [c.id, c.confidence]));
          setMoved(d.cards.filter((c) => before.has(c.id) && before.get(c.id) !== c.confidence));
        }
        answered.current = false;
        lastCards.current = d.cards;
        setData(d);
        try {
          sessionStorage.setItem("bb.results", JSON.stringify(d));
        } catch {}
      } catch {
        setError(true);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [resultsLang, moreQuestions],
  );

  useEffect(() => {
    const f = loadFlow();
    if (!f) {
      router.replace("/start");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlow(f);
  }, [router]);

  useEffect(() => {
    // Data fetch: state is set only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flow) run(flow.facts, skip);
  }, [flow, skip, run]);

  if (error)
    return (
      <div>
        <Notice>{t("common.error")}</Notice>
        <div className="mt-3">
          <Button
            onClick={() => flow && run(flow.facts, skip)}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("common.retry")}
          </Button>
        </div>
      </div>
    );

  // Keep the page (and its live region) on screen while an answer re-runs the match.
  if (!data || !flow)
    return <p aria-live="polite">{t("common.loading")}</p>;

  const answer = (k: keyof Facts) => {
    if (answers[k] === undefined || answers[k] === null)
      return setSkip((s) => [...s, k]);
    answered.current = true;
    const next = { ...flow, facts: { ...flow.facts, [k]: answers[k] } };
    saveFlow(next);
    setFlow(next);
  };

  const eligible = data.cards.filter((c) => c.confidence !== "not_eligible");
  const label = (v: string) => ENUM_LABELS[v]?.[uiLang] ?? v;
  const mentioned = [...(flow.facts.life_events ?? []), ...(flow.facts.needs ?? [])];
  const uncovered = data.uncovered_needs ?? [];
  const verdict = { likely: t("results.likely"), possibly: t("results.possibly"), not_eligible: t("results.not") };
  const announce =
    moved === null
      ? ""
      : moved.length
        ? `${t("results.changed")} ${moved.map((c) => `${c.name}: ${verdict[c.confidence]}`).join("; ")}.`
        : t("results.noChange");
  const notEligible = data.cards.filter((c) => c.confidence === "not_eligible");

  return (
    <div className="space-y-8" lang={data.lang}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{t("results.title")}</h1>
        <Link href="/confirm" className="underline text-primary">
          {t("results.edit")}
        </Link>
      </div>

      <Notice>{t("disclaimer")}</Notice>

      <div aria-live="polite" className="empty:hidden">
        {loading ? <p className="text-muted">{t("results.updating")}</p> : announce ? <Notice tone="info">{announce}</Notice> : null}
      </div>

      {mentioned.length > 0 && (
        <p>
          <strong>{t("results.mentioned")} {mentioned.map(label).join(", ")}</strong>, {t("results.mentionedNote")}
        </p>
      )}

      {uncovered.length > 0 && (
        <Notice tone="info">
          {t("results.uncovered")} <strong>{uncovered.map(label).join(", ")}</strong>.{" "}
          <a
            href={uiLang === "fr" ? "https://www.canada.ca/fr/services/prestations.html" : "https://www.canada.ca/en/services/benefits.html"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {t("results.uncoveredLink")}
            <span className="sr-only"> (opens official page in a new tab)</span>
          </a>
        </Notice>
      )}

      {data.machine_translated && (
        <Notice tone="info">{t("results.machineTranslated")}</Notice>
      )}

      {data.followups.length > 0 && (
        <section aria-labelledby="fu" className="space-y-3">
          <h2 id="fu" className="text-xl font-semibold">
            {t("results.followups")}
          </h2>
          {data.followups.map((q) => (
            <Card key={q.fact} className="space-y-3">
              <FactInput
                idPrefix="q"
                k={q.fact}
                value={(answers[q.fact] ?? null) as never}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.fact]: v }))}
              />
              {q.could_change > 0 && (
                <p className="text-sm text-muted">
                  {q.could_change === 1 ? t("q.couldChangeOne") : t("q.couldChangeMany").replace("{n}", String(q.could_change))}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => answer(q.fact)}>
                  {t("q.answer")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSkip((s) => [...s, q.fact])}
                >
                  {t("q.skip")}
                </Button>
              </div>
            </Card>
          ))}
          {!moreQuestions && data.followups.length >= 3 && (
            <Button variant="outline" size="sm" onClick={() => setMoreQuestions(true)} disabled={loading}>
              {t("q.more")}
            </Button>
          )}
        </section>
      )}

      {eligible.length === 0 && <p>{t("results.none")}</p>}

      {LEVELS.map((level) => {
        const cards = eligible.filter((c) => c.level === level);
        if (!cards.length) return null;
        return (
          <section
            key={level}
            aria-labelledby={`lvl-${level}`}
            className="space-y-3"
          >
            <h2 id={`lvl-${level}`} className="text-xl font-semibold">
              {t(`results.level.${level}`)}
            </h2>
            {cards.map((c) => (
              <ProgramCard key={c.id} card={c} speechLang={data.lang} />
            ))}
          </section>
        );
      })}

      {notEligible.length > 0 && (
        <section className="space-y-3">
          <Button
            variant="outline"
            aria-expanded={showNot}
            onClick={() => setShowNot((s) => !s)}
          >
            {t("results.showNot")} ({notEligible.length})
          </Button>
          {showNot &&
            notEligible.map((c) => (
              <ProgramCard key={c.id} card={c} speechLang={data.lang} />
            ))}
        </section>
      )}

      {data.personas.length > 0 && (
        <section aria-labelledby="personas" className="space-y-3">
          <h2 id="personas" className="text-xl font-semibold">
            {t("personas.title")}
          </h2>
          <p className="text-sm text-muted">{t("personas.label")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.personas.map((p) => (
              <Card key={p.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("personas.label").split("—")[0]}
                </p>
                <h3 className="font-bold">{p.blurb}</h3>
                {p.likely.length > 0 && (
                  <p>
                    <span className="font-semibold">
                      {t("results.likely")}:
                    </span>{" "}
                    {p.likely.join(", ")}
                  </p>
                )}
                {p.possibly.length > 0 && (
                  <div>
                    <span className="font-semibold">
                      {t("results.possibly")}:
                    </span>
                    <ul className="list-disc pl-5 text-sm">
                      {p.possibly.map((x) => (
                        <li key={x.name}>
                          {x.name}
                          {x.check ? ` — ${x.check}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <p>
        <Link
          href="/checklist"
          className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-4 min-h-12 font-medium"
        >
          {t("results.checklist")}
        </Link>
      </p>
    </div>
  );
}
