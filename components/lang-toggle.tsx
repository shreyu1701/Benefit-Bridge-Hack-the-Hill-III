"use client";

import { useRouter } from "next/navigation";
import { useLang, useT } from "./lang-provider";

export function LangToggle() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const other = lang === "en" ? "fr" : "en";
  return (
    <button
      type="button"
      lang={other}
      className="rounded-md px-2 py-1 underline hover:bg-card min-h-11"
      onClick={() => {
        document.cookie = `lang=${other}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {t("nav.language")}
    </button>
  );
}
