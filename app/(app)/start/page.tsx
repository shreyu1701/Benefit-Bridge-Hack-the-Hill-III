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
export default async function StartPage() {
  const lang = await getUiLang();
  const c = ENTRY_COPY[lang];

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
