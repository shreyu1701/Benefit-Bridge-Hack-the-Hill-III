"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AccountControl } from "@/components/auth-buttons";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useT } from "@/components/lang-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Main navigation. Each item lists the route prefixes it "owns", so the
 * benefits link stays marked as current through the whole check flow
 * (form → confirm → results → checklist → program details).
 * Below the xl breakpoint the links collapse into a menu button. The desktop
 * row leaves out Home (the logo) and Privacy (in the footer) so it fits on one
 * line in French too; the menu lists everything.
 */
const ITEMS: { href: string; label: MessageKey; match: string[]; desktop?: false }[] = [
  { href: "/", label: "nav.landing", match: [], desktop: false },
  { href: "/start", label: "nav.home", match: ["/start", "/onboarding", "/describe", "/confirm", "/results", "/checklist", "/programs"] },
  { href: "/laws", label: "nav.laws", match: ["/laws"] },
  { href: "/insights", label: "nav.insights", match: ["/insights"] },
  { href: "/privacy", label: "nav.privacy", match: ["/privacy"], desktop: false },
  { href: "/account", label: "nav.account", match: ["/account"] },
];

function isActive(pathname: string, item: (typeof ITEMS)[number]) {
  if (item.href === "/") return pathname === "/";
  return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export function MainNav({ authEnabled = false, signedIn = false }: { authEnabled?: boolean; signedIn?: boolean }) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const links = (mobile: boolean) =>
    ITEMS.filter((item) => mobile || item.desktop !== false).map((item) => {
      const active = isActive(pathname, item);
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              "min-h-11 flex items-center rounded-lg no-underline",
              mobile ? "px-3 text-base" : "px-2.5 text-[15px] whitespace-nowrap",
              active ? "font-semibold text-primary underline decoration-2 underline-offset-8" : "text-foreground hover:bg-surface",
            )}
          >
            {t(item.label)}
          </Link>
        </li>
      );
    });

  return (
    <nav aria-label="Main" className="flex shrink-0 items-center gap-2">
      <ul className="hidden xl:flex items-center gap-1 mr-2">{links(false)}</ul>
      <div className="hidden xl:block">
        <ThemeToggle compact />
      </div>
      <LangToggle />
      {authEnabled && (
        <div className="hidden sm:block">
          <AccountControl compact signedIn={signedIn} />
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="xl:hidden inline-flex size-11 items-center justify-center rounded-full hover:bg-surface"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="xl:hidden absolute left-0 right-0 top-full z-40 border-b border-border bg-background px-4 py-2 shadow-lg"
      >
        <ul>{links(true)}</ul>
        {authEnabled && (
          <div className="border-t border-border px-1 py-2 sm:hidden">
            <AccountControl signedIn={signedIn} />
          </div>
        )}
        <div className="border-t border-border px-3 py-3">
          <ThemeToggle showLabels />
        </div>
      </div>
    </nav>
  );
}
