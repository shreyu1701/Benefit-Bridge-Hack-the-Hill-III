"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { ListenButton } from "@/components/listen-button";
import { useLang, useT } from "@/components/lang-provider";
import { ENUM_LABELS } from "@/lib/facts/labels";
import type { Cited, ProgramCard as Card_ } from "@/lib/present";
import { formatDate } from "@/lib/utils";

export function ConfidenceBadge({ c }: { c: Card_["confidence"] }) {
  const t = useT();
  if (c === "likely") return <Badge variant="likely">✓ {t("results.likely")}</Badge>;
  if (c === "possibly") return <Badge variant="possibly">? {t("results.possibly")}</Badge>;
  return <Badge variant="not">✕ {t("results.not")}</Badge>;
}

function CitedList({ title, items }: { title: string; items: Cited[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      <ul className="list-disc pl-5 space-y-1">
        {items.map((i, n) => (
          <li key={n}>
            {i.text}{" "}
            <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline whitespace-nowrap">
              [{t("results.source")}]<span className="sr-only"> (opens official page in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgramCard({ card, speechLang }: { card: Card_; speechLang: string }) {
  const t = useT();
  const lang = useLang();
  const verified = formatDate(card.last_verified_at, lang);
  const changed = formatDate(card.source_last_changed, lang);
  const headingId = `p-${card.id}`;
  const related = card.relevance ? [...card.relevance.life_events, ...card.relevance.needs] : [];

  return (
    <Card>
      <article aria-labelledby={headingId} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={headingId} className="text-lg font-bold">{card.name}</h3>
          <ConfidenceBadge c={card.confidence} />
        </div>

        {related.length > 0 && (
          <p className="text-sm">
            <span className="font-semibold">{t("results.matches")}:</span> {related.map((v) => ENUM_LABELS[v]?.[lang] ?? v).join(", ")}
          </p>
        )}

        {card.status === "needs_verification" && (
          <Notice>{card.last_verified_at ? `${t("results.needsVerification")}${card.status_reason ? ` (${card.status_reason})` : ""}` : t("results.unverified")}</Notice>
        )}
        {card.status === "active" && card.stale && <Notice>{t("results.stale")}</Notice>}
        {card.pending_review && <Notice tone="info">{t("results.pending")}</Notice>}

        <p>{card.summary}</p>
        <ListenButton text={`${card.name}. ${card.summary} ${card.amount?.text ?? ""}`} lang={speechLang} />

        <CitedList title={t("results.why")} items={card.reasons_met} />
        <CitedList title={card.confidence === "not_eligible" ? t("results.because") : t("results.check")} items={card.confidence === "not_eligible" ? card.failed : card.uncertain} />

        {card.confidence !== "not_eligible" && card.also_required.length > 0 && (
          <div>
            <h4 className="font-semibold">{t("results.also")}</h4>
            <ul className="list-disc pl-5">{card.also_required.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}

        {card.amount && (
          <div>
            <h4 className="font-semibold">{t("results.amount")}</h4>
            <p>
              {card.amount.text}{" "}
              <a href={card.amount.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">[{t("results.source")}]</a>
            </p>
          </div>
        )}

        {card.deadlines.length > 0 && (
          <div>
            <h4 className="font-semibold">{t("results.deadlines")}</h4>
            <ul className="list-disc pl-5">
              {card.deadlines.map((d, i) => (
                <li key={i}>{d.date ? <strong>{formatDate(d.date, lang)}: </strong> : null}{d.label}</li>
              ))}
            </ul>
          </div>
        )}

        {card.confidence !== "not_eligible" && (
          <div>
            <h4 className="font-semibold">{t("results.apply")}</h4>
            <p>{card.how_to_apply}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href={card.application_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline font-medium min-h-11">
            {t("results.official")} <ExternalLink aria-hidden size={14} />
            <span className="sr-only">(new tab)</span>
          </a>
          <Link href={`/programs/${card.id}`} className="inline-flex items-center text-primary underline min-h-11">{t("results.details")}</Link>
        </div>

        {card.law && (
          <p className="text-sm">
            <span className="font-semibold">{t("program.law")}: </span>
            <a href={card.law.source_url} target="_blank" rel="noopener noreferrer" className="underline">{card.law.title}</a> ({card.law.citation})
          </p>
        )}

        <p className="text-xs text-muted">
          {t("results.lastVerified")}: {verified ?? t("results.never")}
          {" · "}
          {t("results.sourceChanged")}: {changed ?? "—"}
        </p>
      </article>
    </Card>
  );
}
