import { hasDatabase, query } from "@/lib/db/pool";

export interface BillSummaryLang {
  summary: string;
  who_is_affected: string[];
  what_changed: string | null;
  coming_into_force: string | null;
}

export interface BillView {
  id: number;
  jurisdiction_code: string;
  bill_number: string;
  parliament: number;
  session: number;
  titles: { long_en: string | null; long_fr: string | null; short_en: string | null; short_fr: string | null };
  current_stage: string | null;
  current_stage_fr: string | null;
  status_en: string | null;
  status_fr: string | null;
  is_government_bill: boolean | null;
  royal_assent_at: string | null;
  statute_ref: string | null;
  coming_into_force: string | null;
  summary: { en?: BillSummaryLang; fr?: BillSummaryLang; source_url?: string; machine_generated?: boolean } | null;
  source_url: string;
  updated_at: string;
  last_event_at: string | null;
  programs: { id: string; name: { en: string; fr: string }; relationship: string }[];
}

export interface BillEventView {
  stage: string;
  chamber: string | null;
  label_en: string | null;
  label_fr: string | null;
  occurred_at: string;
  occurred_at_is_detected: boolean;
}

const BASE = `
  SELECT b.id::int, b.jurisdiction_code, b.bill_number, b.parliament, b.session, b.titles, b.current_stage, b.current_stage_fr,
         b.status_en, b.status_fr, b.is_government_bill, b.royal_assent_at, b.statute_ref, b.coming_into_force, b.summary,
         b.source_url, b.updated_at,
         (SELECT max(occurred_at) FROM bill_status_events e WHERE e.bill_id = b.id) AS last_event_at,
         COALESCE((SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'relationship', pl.relationship))
                     FROM program_law_links pl JOIN programs p ON p.id = pl.program_id WHERE pl.bill_id = b.id), '[]') AS programs
    FROM bills b`;

/** Bills of the current session per jurisdiction (the latest parliament/session we have ingested). */
export async function listBills(opts: { jurisdiction?: string; limit?: number } = {}): Promise<BillView[]> {
  if (!hasDatabase()) return [];
  return query<BillView>(
    `WITH cur AS (
       SELECT DISTINCT ON (jurisdiction_code) jurisdiction_code, parliament, session
         FROM bills ORDER BY jurisdiction_code, parliament DESC, session DESC)
     SELECT * FROM (${BASE} JOIN cur ON cur.jurisdiction_code = b.jurisdiction_code AND cur.parliament = b.parliament AND cur.session = b.session
      WHERE ($1::text IS NULL OR b.jurisdiction_code = $1)) x
     ORDER BY COALESCE(x.last_event_at, x.updated_at) DESC
     LIMIT $2`,
    [opts.jurisdiction ?? null, opts.limit ?? 100],
  );
}

export async function getBill(id: number): Promise<{ bill: BillView; events: BillEventView[] } | null> {
  if (!hasDatabase()) return null;
  const bills = await query<BillView>(`${BASE} WHERE b.id = $1`, [id]);
  if (!bills[0]) return null;
  const events = await query<BillEventView>(
    `SELECT stage, chamber, label_en, label_fr, occurred_at, occurred_at_is_detected FROM bill_status_events WHERE bill_id = $1 ORDER BY occurred_at`,
    [id],
  );
  return { bill: bills[0], events };
}

export const RECENT_ASSENT_DAYS = 30;
export function isRecentAssent(b: Pick<BillView, "royal_assent_at">, now = new Date()) {
  return Boolean(b.royal_assent_at && now.getTime() - new Date(b.royal_assent_at).getTime() < RECENT_ASSENT_DAYS * 86_400_000);
}

export function billTitle(b: Pick<BillView, "titles" | "bill_number">, lang: "en" | "fr") {
  const s = lang === "fr" ? b.titles.short_fr || b.titles.long_fr : b.titles.short_en || b.titles.long_en;
  return s || b.titles.short_en || b.titles.long_en || b.bill_number;
}
