"use client";

import { useRouter } from "next/navigation";
import { useLang } from "./lang-provider";
import type { UiLang } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const LABELS: Record<UiLang, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  fr: { short: "FR", name: "Français" },
};

function saveLangCookie(l: UiLang) {
  document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
}

/** EN | FR pill from the design canvas. The current language is the pressed button. */
export function LangToggle() {
  const lang = useLang();
  const router = useRouter();
  const choose = (l: UiLang) => {
    if (l === lang) return;
    saveLangCookie(l);
    router.refresh();
  };
  return (
    <div role="group" aria-label={lang === "fr" ? "Langue" : "Language"} className="inline-flex items-center rounded-full border border-border-strong p-0.5">
      {(Object.keys(LABELS) as UiLang[]).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === lang}
          aria-label={LABELS[l].name}
          onClick={() => choose(l)}
          className={cn(
            "min-h-10 min-w-11 rounded-full px-3 text-[13px] font-semibold",
            l === lang ? "bg-foreground text-background" : "text-foreground hover:bg-surface",
          )}
        >
          {LABELS[l].short}
        </button>
      ))}
    </div>
  );
}
