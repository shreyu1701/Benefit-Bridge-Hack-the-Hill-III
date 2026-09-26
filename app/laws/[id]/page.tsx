import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { billTitle, getBill } from "@/lib/bills-repo";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Bill" };
export const dynamic = "force-dynamic";

export default async function BillPage(props: PageProps<"/laws/[id]">) {
  const id = Number((await props.params).id);
  if (!Number.isInteger(id)) notFound();
  const { lang, t } = await getT();
  const data = await getBill(id);
  if (!data) notFound();
  const { bill: b, events } = data;
  const s = b.summary?.[lang];

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-sm">{b.jurisdiction_code === "CA" ? "Canada" : "Ontario"} · {b.bill_number} · {b.parliament}-{b.session}</p>
        <h1 className="text-2xl font-bold">{billTitle(b, lang)}</h1>
        {b.royal_assent_at ? (
          <div className="space-y-1">
            <Badge variant="likely">{t("laws.assent")}: {formatDate(b.royal_assent_at, lang)}</Badge>
            {b.statute_ref && <p className="text-sm">{b.statute_ref}</p>}
            <p className="text-sm">{b.coming_into_force ?? t("laws.assentNote")}</p>
          </div>
        ) : (
          <Badge variant="possibly">{t("laws.proposed")}</Badge>
        )}
      </header>

      {s ? (
        <section className="space-y-2">
          <p>{s.summary}</p>
          {s.what_changed && <p><strong>{t("program.whatChanged")}:</strong> {s.what_changed}</p>}
          {s.who_is_affected.length > 0 && (
            <>
              <h2 className="font-semibold">{t("laws.who")}</h2>
              <ul className="list-disc pl-5">{s.who_is_affected.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          <p className="text-xs text-muted">
            {t("laws.machineSummary")}{" "}
            {b.summary?.source_url && <a href={b.summary.source_url} className="underline" target="_blank" rel="noopener noreferrer">[{t("results.source")}]</a>}
          </p>
        </section>
      ) : (
        <p className="text-muted">{t("laws.summaryPending")}</p>
      )}

      <section aria-labelledby="tl" className="space-y-2">
        <h2 id="tl" className="text-xl font-semibold">{t("laws.timeline")}</h2>
        <ol className="border-l-2 border-border pl-4 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[1.4rem] top-2 size-3 rounded-full bg-primary" />
              <time dateTime={e.occurred_at} className="text-sm text-muted block">
                {formatDate(e.occurred_at, lang)}{e.occurred_at_is_detected ? ` (${t("laws.detectedAt")})` : ""}
              </time>
              <span>{lang === "fr" ? e.label_fr ?? e.label_en : e.label_en}</span>
            </li>
          ))}
        </ol>
      </section>

      {b.programs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">{t("laws.programs")}</h2>
          <ul className="list-disc pl-5">{b.programs.map((p) => <li key={p.id}><Link href={`/programs/${p.id}`} className="underline">{p.name[lang]}</Link> ({p.relationship})</li>)}</ul>
        </section>
      )}

      <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("results.official")}</a>
    </article>
  );
}
