"use client";

import { createContext, useContext } from "react";
import { MESSAGES, type MessageKey, type UiLang } from "@/lib/i18n/messages";

const Ctx = createContext<UiLang>("en");

export function LangProvider({ lang, children }: { lang: UiLang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang(): UiLang {
  return useContext(Ctx);
}

export function useT() {
  const lang = useLang();
  return (k: MessageKey) => MESSAGES[lang][k] ?? MESSAGES.en[k];
}
