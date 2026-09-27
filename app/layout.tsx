import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { LangProvider } from "@/components/lang-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Logo } from "@/components/logo";
import { MainNav } from "@/components/main-nav";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { auth0, auth0Enabled } from "@/lib/auth0";
import { getT } from "@/lib/i18n/server";

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Benefit Bridge", template: "%s · Benefit Bridge" },
  description:
    "Find Canadian government benefits you may qualify for, explained in plain language, with official sources.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/**
 * Site shell. The landing page (app/page.tsx) is full width; every other page
 * lives in the (app) route group, whose layout adds the narrow reading column.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, t } = await getT();
  // Seed useUser() with the server session so the header shows the right state on first paint.
  const user = auth0 ? (await auth0.getSession())?.user : undefined;
  // suppressHydrationWarning: next-themes sets the theme class on <html> before React hydrates,
  // and browser extensions (e.g. Grammarly) add attributes to <body>. It only covers these two
  // elements' own attributes, not their children.
  return (
    <html
      lang={lang === "fr" ? "fr-CA" : "en-CA"}
      className={`${publicSans.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
        <Auth0Provider user={user}>
        <LangProvider lang={lang}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 bg-card px-3 py-2 rounded"
          >
            {t("skip")}
          </a>
          <header className="relative border-b border-border bg-background">
            <div className="mx-auto max-w-6xl px-4 sm:px-8 py-2 flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 min-h-11 no-underline text-foreground"
              >
                <Logo />
                <span className="font-display text-2xl font-medium tracking-tight">
                  {t("app.name")}
                </span>
              </Link>
              <MainNav authEnabled={auth0Enabled} signedIn={Boolean(user)} />
            </div>
          </header>
          <main id="main" className="w-full flex-1">
            {children}
          </main>
          <footer className="mt-16 border-t border-border text-sm text-muted">
            <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="max-w-2xl">{t("footer.independent")}</p>
              <p className="flex flex-wrap gap-x-6">
                <Link
                  href="/laws"
                  className="underline min-h-11 inline-flex items-center"
                >
                  {t("nav.laws")}
                </Link>
                <Link
                  href="/privacy"
                  className="underline min-h-11 inline-flex items-center"
                >
                  {t("nav.privacy")}
                </Link>
                <Link
                  href="/admin"
                  className="underline min-h-11 inline-flex items-center"
                >
                  {t("nav.admin")}
                </Link>
              </p>
            </div>
          </footer>
          <Toaster position="top-center" />
        </LangProvider>
        </Auth0Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
