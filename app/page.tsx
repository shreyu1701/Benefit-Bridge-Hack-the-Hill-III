import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Calculator, ClipboardList, ExternalLink, FileCheck2, Landmark, ListChecks, Lock, MessageCircleQuestion,
  MessageSquareText, Mic, RefreshCw, Scale, SearchCheck, ShieldCheck, Tags, Volume2,
} from "lucide-react";
import { SampleResult } from "@/components/landing/sample-result";
import { SEED_PROGRAMS } from "@/data/programs";
import { LANDING } from "@/lib/i18n/landing";
import { getUiLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const c = LANDING[await getUiLang()];
  return { title: { absolute: `Benefit Bridge · ${c.meta.title}` }, description: c.meta.description };
}

const TRUST_ICONS = [Landmark, RefreshCw, Lock, MessageSquareText];
const STEP_ICONS = [Mic, Tags, ListChecks];
const FEATURE_ICONS = [Calculator, Scale, MessageCircleQuestion, SearchCheck, Volume2, ClipboardList];

/** Landing page, built from the "Benefit Bridge Landing" design canvas. */
export default async function Home() {
  const lang = await getUiLang();
  const c = LANDING[lang];
  const examples = c.examples.ids.map((id) => SEED_PROGRAMS.find((p) => p.id === id)!).filter(Boolean);

  // Counts and the covered-programs list come from the program data, so the copy can't go stale.
  const n = String(SEED_PROGRAMS.length);
  const programList = (["federal", "provincial", "municipal"] as const)
    .map((level) => {
      const names = SEED_PROGRAMS.filter((p) => p.level === level).map((p) => p.name[lang]);
      return names.length ? `${c.levels[level]}: ${names.join(", ")}.` : "";
    })
    .filter(Boolean)
    .join(" ");
  const fill = (s: string) => s.replaceAll("{n}", n).replaceAll("{programs}", programList);

  const cta =
    "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-[14px] bg-primary px-8 text-lg font-semibold text-primary-foreground no-underline hover:bg-primary-hover";
  const h2 = "font-display text-[28px] sm:text-4xl tracking-tight";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      {/* Hero: the pitch, and a real result computed by the same engine */}
      <section aria-labelledby="hero" className="pt-11 sm:pt-20 grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary-soft-border bg-primary-soft px-3.5 py-1.5 text-[13px] font-medium text-primary-soft-fg">
            <ShieldCheck aria-hidden size={14} />
            {c.hero.badge}
          </p>
          <h1 id="hero" className="mt-6 font-display text-[44px] sm:text-[64px] leading-[1.04] tracking-[-0.025em]">
            {c.hero.headline}
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] sm:text-xl leading-relaxed text-muted">{fill(c.hero.sub)}</p>
          <div className="mt-8 flex flex-col items-start gap-3">
            <Link href="/start" className={cta}>
              {c.hero.cta} <ArrowRight aria-hidden size={20} />
            </Link>
            <p className="text-sm text-muted">{c.hero.ctaNote}</p>
          </div>
        </div>
        <SampleResult lang={lang} copy={c.sample} />
      </section>

      {/* Trust strip */}
      <section aria-label={lang === "fr" ? "Pourquoi nous faire confiance" : "Why you can trust it"} className="mt-16 sm:mt-24 rounded-3xl border border-border bg-surface px-6 py-7 sm:px-14 sm:py-12">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {c.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i] ?? FileCheck2;
            return (
              <li key={item.title} className="flex gap-3.5 lg:flex-col lg:gap-2.5">
                <Icon aria-hidden size={22} strokeWidth={1.7} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-base sm:text-[17px] font-semibold">{item.title}</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* How it works: three steps */}
      <section aria-labelledby="how-h" id="how" className="mt-20 scroll-mt-6 space-y-6">
        <h2 id="how-h" className={h2}>{c.steps.heading}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {c.steps.items.map((it, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <li key={it.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="font-display text-2xl text-primary">
                    <span className="sr-only">{lang === "fr" ? "Étape" : "Step"} </span>{i + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-[17px] font-semibold">{it.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{it.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* What you get */}
      <section aria-labelledby="get-h" className="mt-20 space-y-6">
        <h2 id="get-h" className={h2}>{c.features.heading}</h2>
        <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {c.features.items.map((it, i) => {
            const Icon = FEATURE_ICONS[i] ?? FileCheck2;
            return (
              <li key={it.title} className="flex gap-3.5">
                <Icon aria-hidden size={22} strokeWidth={1.7} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{it.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{it.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Three example benefits, straight from the program data (amounts and links are the cited ones) */}
      <section aria-labelledby="examples-h" className="mt-20 space-y-5">
        <div>
          <h2 id="examples-h" className={h2}>{c.examples.heading}</h2>
          <p className="mt-1 text-muted">{c.examples.help}</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {examples.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.levels[p.level]}</p>
              <h3 className="-mt-1 text-[17px] font-semibold">{p.name[lang]}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{p.summaries_by_language[lang]}</p>
              {p.benefit_amount && <p className="text-[15px] leading-relaxed">{p.benefit_amount.text[lang]}</p>}
              <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline">
                {c.examples.source} <ExternalLink aria-hidden size={14} />
                <span className="sr-only">{lang === "fr" ? "(nouvel onglet)" : "(opens in a new tab)"}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Who it's for */}
      <section aria-labelledby="who-h" className="mt-20 space-y-6">
        <h2 id="who-h" className={h2}>{c.audiences.heading}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.audiences.items.map((a) => (
            <li key={a.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{a.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="mt-20 grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-12">
        <h2 id="faq-h" className={h2}>{c.faq.heading}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {c.faq.items.map((f) => (
            <details key={f.q} className="group px-5 py-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                <span>{f.q}</span>
                <span aria-hidden className="text-xl leading-none text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-3 text-muted">{fill(f.a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="final-h" className="mt-20 rounded-3xl border border-border bg-surface px-6 py-10 sm:px-14 sm:py-14 text-center">
        <h2 id="final-h" className="mx-auto max-w-2xl font-display text-[28px] sm:text-[40px] leading-tight tracking-tight">{c.cta.headline}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">{c.cta.body}</p>
        <Link href="/start" className={`mt-6 ${cta}`}>
          {c.cta.button} <ArrowRight aria-hidden size={20} />
        </Link>
        <p className="mt-4 text-sm text-muted">{c.cta.fine}</p>
      </section>
    </div>
  );
}
