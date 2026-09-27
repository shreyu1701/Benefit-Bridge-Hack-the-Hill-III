"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: { en: "Light", fr: "Clair" } },
  { value: "dark", icon: Moon, label: { en: "Dark", fr: "Sombre" } },
  { value: "system", icon: Monitor, label: { en: "Match device", fr: "Comme l'appareil" } },
] as const;

const noop = () => () => {};

/**
 * Light / dark / system switch. Rendered unpressed until mounted, because the saved theme is only known in the browser.
 * `compact` is one button that steps through the three (the desktop header has no room for all three).
 */
export function ThemeToggle({ showLabels = false, compact = false }: { showLabels?: boolean; compact?: boolean }) {
  const lang = useLang();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const current = mounted ? theme ?? "system" : null;

  if (compact) {
    const i = Math.max(0, OPTIONS.findIndex((o) => o.value === (current ?? "system")));
    const { icon: Icon, label } = OPTIONS[i];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    const name = lang === "fr" ? "Thème" : "Theme";
    const hint = lang === "fr" ? "passer à" : "switch to";
    return (
      <button
        type="button"
        aria-label={`${name}: ${label[lang]} (${hint} ${next.label[lang]})`}
        title={`${name}: ${label[lang]}`}
        onClick={() => setTheme(next.value)}
        className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong text-foreground hover:bg-surface"
      >
        <Icon aria-hidden size={18} />
      </button>
    );
  }

  return (
    <div role="group" aria-label={lang === "fr" ? "Thème" : "Theme"} className="inline-flex items-center rounded-full border border-border-strong p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          aria-label={showLabels ? undefined : label[lang]}
          title={label[lang]}
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold",
            current === value ? "bg-foreground text-background" : "text-foreground hover:bg-surface",
          )}
        >
          <Icon aria-hidden size={16} />
          {showLabels && <span>{label[lang]}</span>}
        </button>
      ))}
    </div>
  );
}
