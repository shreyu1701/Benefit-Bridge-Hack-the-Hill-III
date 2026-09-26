import { cookies, headers } from "next/headers";
import { t as translate, type MessageKey, type UiLang } from "./messages";

export async function getUiLang(): Promise<UiLang> {
  const c = (await cookies()).get("lang")?.value;
  if (c === "en" || c === "fr") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^fr\b/i.test(accept) ? "fr" : "en";
}

export async function getT() {
  const lang = await getUiLang();
  return { lang, t: (k: MessageKey) => translate(lang, k) };
}
