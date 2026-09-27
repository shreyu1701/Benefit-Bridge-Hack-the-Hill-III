import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getT, getUiLang } from "@/lib/i18n/server";
import { isStale, loadProgram } from "@/lib/programs-repo";
import { jurisdictionCriteria } from "@/lib/rules/engine";
import { formatDate } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/programs/[id]">): Promise<Metadata> {
  const [p, lang] = await Promise.all([loadProgram((await props.params).id), getUiLang()]);
  return { title: p?.name[lang] ?? (lang === "fr" ? "Programme" : "Program") };
}

export default async function ProgramPage(props: PageProps<"/programs/[id]">) {
  const { id } = await props.params;
  const { lang, t } = await getT();
  const p = await loadProgram(id);
  if (!p) notFound();
  const criteria = [...jurisdictionCriteria(p), ...p.eligibility_rules.criteria];

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">{t(`results.level.${p.level}`)}</p>
        <h1 className="text-2xl font-bold">{p.name[lang]}</h1>
        {p.status === "needs_verification" && (
          <Notice>{p.last_verified_at ? `${t("results.needsVerification")}${p.status_reason ? ` (${p.status_reason})` : ""}` : t("results.unverified")}</Notice>
        )}
        {p.status === "active" && isStale(p) && <Notice>{t("results.stale")}</Notice>}
        {p.has_pending_review && <Notice tone="info">{t("results.pending")}</Notice>}
        <p>{p.summaries_by_language[lang] ?? p.summaries_by_language.en}</p>
        <p className="text-sm text-muted">
          {t("results.lastVerified")}: {formatDate(p.last_verified_at, lang) ?? t("results.never")} · {t("results.sourceChanged")}: {formatDate(p.source_last_changed, lang) ?? "—"}
        </p>
      </header>

      <section aria-labelledby="rules" className="space-y-2">
        <h2 id="rules" className="text-xl font-semibold">{lang === "fr" ? "Conditions d'admissibilité" : "Who can get it"}</h2>
        <ul className="list-disc pl-5 space-y-2">
          {criteria.map((c) => (
            <li key={c.id}>
              {c.met[lang]}{" "}
              <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">[{t("results.source")}]</a>
              {c.source_quote && <blockquote className="mt-1 border-l-4 border-border pl-3 text-sm text-muted">“{c.source_quote}”</blockquote>}
            </li>
          ))}
          {p.eligibility_rules.also_required.map((a, i) => <li key={i}>{a[lang]}</li>)}
        </ul>
      </section>

      {p.benefit_amount && (
        <section aria-labelledby="amount">
          <h2 id="amount" className="text-xl font-semibold">{t("results.amount")}</h2>
          <p>{p.benefit_amount.text[lang]} <a href={p.benefit_amount.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">[{t("results.source")}]</a></p>
        </section>
      )}

      <section aria-labelledby="apply">
        <h2 id="apply" className="text-xl font-semibold">{t("results.apply")}</h2>
        <p>{p.how_to_apply[lang]}</p>
        <a href={p.application_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline font-medium min-h-11">
          {t("results.official")} <ExternalLink aria-hidden size={14} />
        </a>
      </section>

      <section aria-labelledby="law" className="space-y-3">
        <h2 id="law" className="text-xl font-semibold">{t("program.law")}</h2>
        {p.laws.length === 0 && <p>{t("program.noLaw")}</p>}
        {p.laws.map((l) => (
          <Card key={l.id} className="space-y-2">
            <h3 className="font-bold">
              <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="underline">{l.title[lang]}</a>
            </h3>
            <p className="text-sm text-muted">{l.citation}{l.current_to ? ` · ${lang === "fr" ? "À jour au" : "Current to"} ${formatDate(l.current_to, lang)}` : ""}</p>
            <h4 className="font-semibold">{t("program.whatChanged")}</h4>
            {!l.approved && <Badge variant="warn">{t("program.draft")}</Badge>}
            <p>{l.what_changed[lang]}</p>
          </Card>
        ))}
      </section>
    </article>
  );
}
