import { hasDatabase, query } from "@/lib/db/pool";
import { getT } from "@/lib/i18n/server";
import { loadPrograms } from "@/lib/programs-repo";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("insights");
export const dynamic = "force-dynamic";

/** Public dashboard over the match_daily continuous aggregate (anonymous; small counts suppressed). */
export default async function InsightsPage() {
  const { lang } = await getT();
  const rows = hasDatabase()
    ? await query<{ program_id: string; matches: number }>(
        `SELECT program_id, sum(matches)::int AS matches FROM match_daily
          WHERE day >= now() - interval '30 days' GROUP BY 1 HAVING sum(matches) >= 10 ORDER BY 2 DESC`,
      )
    : [];
  const programs = await loadPrograms();
  const name = (id: string) => programs.find((p) => p.id === id)?.name[lang] ?? id;
  const max = Math.max(1, ...rows.map((r) => r.matches));
  const title = lang === "fr" ? "Prestations que les gens pourraient manquer" : "Benefits people may be missing";
  const help =
    lang === "fr"
      ? "Nombre de fois, au cours des 30 derniers jours, où une personne semblait admissible à un programme. Données anonymes; les totaux inférieurs à 10 ne sont pas affichés."
      : "How often, in the last 30 days, someone looked likely or possibly eligible for each program. Anonymous; totals under 10 are hidden.";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">{help}</p>
      {rows.length === 0 ? (
        <p>{lang === "fr" ? "Pas encore assez de données." : "Not enough data yet."}</p>
      ) : (
        <table className="w-full text-left">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col" className="py-2">Program</th><th scope="col" className="py-2 w-1/2">Matches</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.program_id} className="border-t border-border">
                <th scope="row" className="py-2 pr-2 font-normal">{name(r.program_id)}</th>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div aria-hidden className="h-3 rounded bg-primary" style={{ width: `${(r.matches / max) * 100}%` }} />
                    <span>{r.matches.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
