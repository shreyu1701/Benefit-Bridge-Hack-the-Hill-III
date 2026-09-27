import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { billTitle, isRecentAssent, listBills, type BillView } from "@/lib/bills-repo";
import type { MessageKey } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("laws");
export const dynamic = "force-dynamic";

export default async function LawsPage(props: PageProps<"/laws">) {
  const sp = await props.searchParams;
  const j = sp.j === "CA" || sp.j === "ON" ? sp.j : undefined;
  const { lang, t } = await getT();
  const bills = await listBills({ jurisdiction: j, limit: 100 });
  const recent = bills.filter((b) => isRecentAssent(b));
  const rest = bills.filter((b) => !isRecentAssent(b));

  const filters: [string | undefined, string][] = [[undefined, t("laws.all")], ["CA", t("laws.federal")], ["ON", t("laws.ontario")]];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("laws.title")}</h1>
        <p className="text-muted">{t("laws.help")}</p>
      </div>
      <nav aria-label="Filter" className="flex gap-2">
        {filters.map(([code, label]) => (
          <Link key={label} href={code ? `/laws?j=${code}` : "/laws"} aria-current={j === code ? "page" : undefined}
            className={`rounded-full border px-3 min-h-11 inline-flex items-center ${j === code ? "border-primary font-semibold" : "border-border"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {bills.length === 0 && <p>{t("laws.empty")}</p>}
      {recent.length > 0 && (
        <section aria-labelledby="recent" className="space-y-3">
          <h2 id="recent" className="text-xl font-semibold">{t("laws.recentAssent")}</h2>
          {recent.map((b) => <BillCard key={b.id} b={b} lang={lang} t={t} highlight />)}
        </section>
      )}
      <section className="space-y-3">
        {rest.map((b) => <BillCard key={b.id} b={b} lang={lang} t={t} />)}
      </section>
    </div>
  );
}

function BillCard({ b, lang, t, highlight = false }: { b: BillView; lang: "en" | "fr"; t: (k: MessageKey) => string; highlight?: boolean }) {
  const tt = t;
  const s = b.summary?.[lang];
  const stage = lang === "fr" ? b.current_stage_fr ?? b.status_fr ?? b.current_stage : b.current_stage ?? b.status_en;
  return (
    <Card className={highlight ? "border-2 border-primary" : ""}>
      <article className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{b.jurisdiction_code === "CA" ? "Canada" : "Ontario"} · {b.bill_number}</span>
          {b.royal_assent_at ? (
            <Badge variant="likely">{tt("laws.assent")}: {formatDate(b.royal_assent_at, lang)}</Badge>
          ) : (
            <Badge variant="possibly">{tt("laws.proposed")}</Badge>
          )}
        </div>
        <h3 className="font-bold"><Link href={`/laws/${b.id}`} className="underline">{billTitle(b, lang)}</Link></h3>
        <p className="text-sm"><span className="font-semibold">{tt("laws.stage")}:</span> {stage ?? "—"}</p>
        {b.royal_assent_at && <p className="text-sm">{b.coming_into_force ?? tt("laws.assentNote")}</p>}
        {s ? (
          <>
            <p>{s.summary}</p>
            {s.who_is_affected.length > 0 && <p className="text-sm"><span className="font-semibold">{tt("laws.who")}:</span> {s.who_is_affected.join("; ")}</p>}
            <p className="text-xs text-muted">{tt("laws.machineSummary")}</p>
          </>
        ) : (
          <p className="text-sm text-muted">{tt("laws.summaryPending")}</p>
        )}
        {b.programs.length > 0 && (
          <p className="text-sm"><span className="font-semibold">{tt("laws.programs")}:</span>{" "}
            {b.programs.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link href={`/programs/${p.id}`} className="underline">{p.name[lang]}</Link></span>)}
          </p>
        )}
        <a href={b.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{tt("results.official")}</a>
      </article>
    </Card>
  );
}
