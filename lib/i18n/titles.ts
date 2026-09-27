import type { Metadata } from "next";
import { getUiLang } from "./server";

/** Browser-tab titles, in the reader's language (the layout adds " · Benefit Bridge"). */
const TITLES = {
  account: { en: "Your profile", fr: "Votre profil" },
  admin: { en: "Review queue", fr: "File de révision" },
  checklist: { en: "My benefits checklist", fr: "Ma liste de prestations" },
  confirm: { en: "Confirm your details", fr: "Confirmez vos renseignements" },
  describe: { en: "Describe your situation", fr: "Décrivez votre situation" },
  insights: { en: "Benefits people may be missing", fr: "Prestations que les gens pourraient manquer" },
  laws: { en: "Recent laws", fr: "Lois récentes" },
  bill: { en: "Bill", fr: "Projet de loi" },
  onboarding: { en: "Your profile", fr: "Votre profil" },
  privacy: { en: "Privacy", fr: "Confidentialité" },
  results: { en: "Your results", fr: "Vos résultats" },
  start: { en: "Get started", fr: "Commencer" },
} as const;

export type TitleKey = keyof typeof TITLES;

/** Use as: `export const generateMetadata = localizedMetadata("laws");` */
export function localizedMetadata(key: TitleKey, extra: Metadata = {}) {
  return async (): Promise<Metadata> => ({ ...extra, title: TITLES[key][await getUiLang()] });
}
