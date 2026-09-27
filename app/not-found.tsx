import Link from "next/link";
import { getUiLang } from "@/lib/i18n/server";

/** Branded, bilingual 404 for unknown URLs and missing programs or bills. */
export default async function NotFound() {
  const fr = (await getUiLang()) === "fr";
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 space-y-4">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
        {fr ? "Cette page n'existe pas" : "We couldn't find that page"}
      </h1>
      <p className="text-muted">
        {fr
          ? "Le lien est peut-être ancien ou mal tapé. Vous pouvez chercher vos prestations depuis le début."
          : "The link may be old or mistyped. You can start looking for your benefits from the beginning."}
      </p>
      <p className="flex flex-wrap gap-x-6">
        <Link href="/start" className="inline-flex min-h-11 items-center font-medium text-primary underline">
          {fr ? "Trouver mes prestations" : "Find my benefits"}
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center text-primary underline">
          {fr ? "Accueil" : "Home"}
        </Link>
      </p>
    </div>
  );
}
