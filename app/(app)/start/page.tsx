import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { GoogleMark } from "@/components/google-mark";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { auth0Enabled, getUserSession, googleLoginUrl } from "@/lib/auth0";
import { hasDatabase } from "@/lib/db/pool";
import { getProfile, upsertUser } from "@/lib/db/profiles";
import { hasEncryptionKey } from "@/lib/crypto";
import { ENTRY_COPY } from "@/lib/i18n/onboarding";
import { getUiLang } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

/** Entry: sign in with Google, or continue as a guest. Nothing forces a login. */
const EXPIRED = {
  en: "Your sign-in expired or was started in another tab. Please try again.",
  fr: "Votre connexion a expiré ou a été lancée dans un autre onglet. Veuillez réessayer.",
};
const LOGIN_ERRORS: Record<string, { en: string; fr: string }> = {
  invalid_state: EXPIRED,
  missing_state: EXPIRED,
  access_denied: {
    en: "Sign-in was cancelled, or this account isn't allowed to sign in.",
    fr: "La connexion a été annulée, ou ce compte n'est pas autorisé à se connecter.",
  },
};

export default async function StartPage(props: PageProps<"/start">) {
  const lang = await getUiLang();
  const c = ENTRY_COPY[lang];
  const sp = await props.searchParams;
  const loginError = typeof sp.login_error === "string" ? sp.login_error.slice(0, 60) : null;
  const loginDetail = typeof sp.login_detail === "string" ? sp.login_detail.slice(0, 300) : null;

  const user = await getUserSession();
  if (user) {
    let hasProfile = false;
    if (hasDatabase() && hasEncryptionKey()) hasProfile = Boolean(await getProfile(await upsertUser(user.sub, user.email)));
    redirect(hasProfile ? "/describe" : "/onboarding");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{c.title}</h1>
        <p className="mt-2 text-muted">{c.intro}</p>
      </div>

      {loginError && (
        <Notice role="alert">
          <p className="font-semibold">
            {LOGIN_ERRORS[loginError]?.[lang] ??
              (lang === "fr" ? "La connexion avec Google n'a pas abouti." : "Signing in with Google didn't complete.")}
          </p>
          <p>
            {lang === "fr" ? "Réessayez, ou continuez en tant qu'invité." : "Try again, or continue as a guest."}{" "}
            <span className="text-xs">
              ({loginError}
              {loginDetail ? `: ${loginDetail}` : ""})
            </span>
          </p>
        </Notice>
      )}

      <ul className="grid gap-4">
        {auth0Enabled && (
          <li className="rounded-2xl border border-border bg-card p-5 space-y-3">
            {/* A plain link: Auth0 routes are server redirects, not client navigation. */}
            <a href={googleLoginUrl("/onboarding")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto no-underline")}>
              <GoogleMark />
              {c.google}
            </a>
            <p className="text-sm text-muted">{c.googleNote}</p>
          </li>
        )}
        <li className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <Link href="/onboarding" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto no-underline")}>
            <UserRound aria-hidden size={18} />
            {c.guest}
            <ArrowRight aria-hidden size={18} />
          </Link>
          <p className="text-sm text-muted">{c.guestNote}</p>
        </li>
      </ul>

      {!auth0Enabled && <Notice tone="info">{c.authOff}</Notice>}
    </div>
  );
}
