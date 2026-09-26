import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { LangProvider } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "Benefit Bridge", template: "%s · Benefit Bridge" },
  description: "Find Canadian government benefits you may qualify for, explained in plain language, with official sources.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getT();
  // suppressHydrationWarning on <body>: browser extensions (e.g. Grammarly) add attributes
  // to it before React hydrates. It only affects <body>'s own attributes, not its children.
  return (
    <html lang={lang === "fr" ? "fr-CA" : "en-CA"}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <LangProvider lang={lang}>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 bg-card px-3 py-2 rounded">
            {t("skip")}
          </a>
          <header className="border-b border-border bg-card">
            <div className="mx-auto max-w-3xl px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <Link href="/" className="text-xl font-bold no-underline min-h-11 inline-flex items-center">
                {t("app.name")}
              </Link>
              <nav aria-label="Main" className="flex flex-wrap items-center gap-x-3 text-sm">
                <Link href="/" className="underline min-h-11 inline-flex items-center">{t("nav.home")}</Link>
                <Link href="/laws" className="underline min-h-11 inline-flex items-center">{t("nav.laws")}</Link>
                <Link href="/insights" className="underline min-h-11 inline-flex items-center">{t("nav.insights")}</Link>
                <Link href="/privacy" className="underline min-h-11 inline-flex items-center">{t("nav.privacy")}</Link>
                <LangToggle />
              </nav>
            </div>
          </header>
          <div role="note" className="bg-warn-bg text-warn-fg text-sm">
            <p className="mx-auto max-w-3xl px-4 py-2">{t("disclaimer")}</p>
          </div>
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
            {children}
          </main>
          <footer className="border-t border-border text-sm text-muted">
            <div className="mx-auto max-w-3xl px-4 py-4 space-y-1">
              <p>{t("disclaimer")}</p>
              <p>
                <Link href="/privacy" className="underline">{t("nav.privacy")}</Link>
                {" · "}
                <Link href="/admin" className="underline">{t("nav.admin")}</Link>
              </p>
            </div>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
