import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, FileCheck2, Landmark, Lock, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { SEED_PROGRAMS } from "@/data/programs";
import { LANDING } from "@/lib/i18n/landing";
import { getUiLang } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const c = LANDING[await getUiLang()];
  return { title: { absolute: `Benefit Bridge · ${c.meta.title}` }, description: c.meta.description };
}

const TRUST_ICONS = [Landmark, RefreshCw, Lock, MessageSquareText];

/** Landing page, built from the "Benefit Bridge Landing" design canvas. */
export default async function Home() {
  const lang = await getUiLang();
  const c = LANDING[lang];
  const examples = c.examples.ids.map((id) => SEED_PROGRAMS.find((p) => p.id === id)!).filter(Boolean);
  const cta =
    "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-[14px] bg-primary px-8 text-lg font-semibold text-primary-foreground no-underline hover:bg-primary-hover";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      {/* Hero */}
      <section aria-labelledby="hero" className="pt-11 sm:pt-24">
        <div className="mx-auto max-w-[820px] sm:text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary-soft-border bg-primary-soft px-3.5 py-1.5 text-[13px] font-medium text-primary-soft-fg">
            <ShieldCheck aria-hidden size={14} />
            {c.hero.badge}
          </p>
          <h1 id="hero" className="mt-6 font-display text-[44px] sm:text-[76px] leading-[1.04] tracking-[-0.025em]">
            {c.hero.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] sm:text-xl leading-relaxed text-muted">{c.hero.sub}</p>
          <div className="mt-8 sm:mt-10 flex flex-col items-start gap-3 sm:items-center">
            <Link href="/start" className={cta}>
              {c.hero.cta} <ArrowRight aria-hidden size={20} />
            </Link>
            <p className="text-sm text-muted">{c.hero.ctaNote}</p>
          </div>
        </div>
      </section>

      {/* Three example benefits, straight from the program data (amounts and links are the cited ones) */}
      <section aria-labelledby="examples-h" className="mt-16 sm:mt-24 space-y-5">
        <div>
          <h2 id="examples-h" className="font-display text-[28px] sm:text-4xl tracking-tight">{c.examples.heading}</h2>
          <p className="mt-1 text-muted">{c.examples.help}</p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {examples.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[17px] font-semibold">{p.name[lang]}</h3>
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

      {/* How it works */}
      <section aria-labelledby="how-h" id="how" className="mt-20 scroll-mt-6 space-y-6">
        <h2 id="how-h" className="font-display text-[28px] sm:text-4xl tracking-tight">{c.features.heading}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {c.features.items.map((it, i) => (
            <li key={it.title} className="rounded-2xl border border-border bg-card p-5">
              <span aria-hidden className="font-display text-2xl text-primary">{i + 1}</span>
              <h3 className="mt-2 font-semibold">{it.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{it.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section aria-labelledby="who-h" className="mt-20 space-y-6">
        <h2 id="who-h" className="font-display text-[28px] sm:text-4xl tracking-tight">{c.audiences.heading}</h2>
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
        <h2 id="faq-h" className="font-display text-[28px] sm:text-4xl tracking-tight">{c.faq.heading}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {c.faq.items.map((f) => (
            <details key={f.q} className="group px-5 py-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                <span>{f.q}</span>
                <span aria-hidden className="text-xl leading-none text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-3 text-muted">{f.a}</p>
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
