import { SituationInput } from "@/components/situation-input";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">{t("app.tagline")}</h1>
      <SituationInput />
    </div>
  );
}
