import { hasDatabase, query } from "@/lib/db/pool";
import { errorResponse, json } from "@/lib/http";

/**
 * GET /api/insights — public, anonymous aggregate: how often people were matched
 * to each program in the last 30 days (from the match_daily continuous aggregate).
 * Counts under 10 are suppressed to avoid re-identification in small regions.
 */
export async function GET() {
  if (!hasDatabase()) return json({ rows: [] });
  try {
    const rows = await query(
      `SELECT program_id, region, sum(matches)::int AS matches
         FROM match_daily WHERE day >= now() - interval '30 days'
        GROUP BY 1, 2 HAVING sum(matches) >= 10 ORDER BY 3 DESC LIMIT 100`,
    );
    return json({ rows });
  } catch (e) {
    return errorResponse(e);
  }
}
