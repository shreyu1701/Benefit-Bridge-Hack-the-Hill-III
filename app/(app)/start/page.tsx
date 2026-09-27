import type { Metadata } from "next";
import { SituationInput } from "@/components/situation-input";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Check my benefits" };

export default async function StartPage() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">{t("app.tagline")}</h1>
      <SituationInput />
    </div>
  );
}
