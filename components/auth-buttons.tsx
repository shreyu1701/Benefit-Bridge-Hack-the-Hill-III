"use client";

import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import { LogIn, LogOut } from "lucide-react";
import { useT } from "@/components/lang-provider";
import { cn } from "@/lib/utils";

/**
 * Auth0 login state in the header (Auth0 Next.js SDK v4). Auth routes are
 * server redirects mounted by proxy.ts, so these are plain <a> links, not
 * client navigation. Rendered only when Auth0 is configured.
 */
const pill = "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] no-underline";

export function LoginButton({ className, returnTo = "/start" }: { className?: string; returnTo?: string }) {
  const t = useT();
  return (
    <a href={`/auth/login?${new URLSearchParams({ returnTo })}`} className={cn(pill, "border border-border-strong text-foreground hover:bg-surface", className)}>
      <LogIn aria-hidden size={16} />
      {t("nav.login")}
    </a>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <a href="/auth/logout" className={cn(pill, "text-foreground hover:bg-surface", className)}>
      <LogOut aria-hidden size={16} />
      {t("nav.logout")}
    </a>
  );
}

function initials(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

/**
 * Signed in: avatar (→ /account) + log out. Guest: log in.
 * `signedIn` is the server's answer, so guests see "Log in" on first paint
 * instead of an empty slot while useUser() checks /auth/profile.
 */
export function AccountControl({ compact = false, signedIn }: { compact?: boolean; signedIn: boolean }) {
  // Guests never call useUser(): it would request /auth/profile and log a 401 in the
  // console on every page, for an answer the server already gave us.
  if (!signedIn) return <LoginButton />;
  return <SignedInControl compact={compact} />;
}

function SignedInControl({ compact }: { compact: boolean }) {
  const t = useT();
  const { user, isLoading } = useUser();
  if (!user && !isLoading) return <LoginButton />;
  if (!user) return <span className="inline-block h-11 w-11" aria-hidden />;
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href="/account"
        title={user.email ?? undefined}
        aria-label={`${t("nav.account")}: ${user.email ?? user.name ?? ""}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-3 no-underline hover:bg-surface"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
          {initials(user.name, user.email)}
        </span>
        {!compact && <span className="max-w-40 truncate text-[15px] text-foreground">{user.email}</span>}
      </Link>
      <LogoutButton />
    </span>
  );
}
