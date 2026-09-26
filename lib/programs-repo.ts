import { SEED_PROGRAMS } from "@/data/programs";
import { SEED_LAWS, SEED_PROGRAM_LAW_LINKS } from "@/data/laws";
import type { ProgramRecord } from "@/lib/rules/types";
import { hasDatabase, query } from "@/lib/db/pool";

/**
 * Program data for matching and display. With a database, the approved
 * records are read from Postgres; without one (local UI work only) the seed
 * file is used — and it is always status "needs_verification".
 */
export interface ProgramView extends ProgramRecord {
  status_reason: string | null;
  has_pending_review: boolean;
  /** "Source last changed": the page's own Date modified, most recent across watched pages. */
  source_last_changed: string | null;
  laws: LawView[];
}

export interface LawView {
  id: string;
  citation: string;
  title: { en: string; fr: string };
  source_url: string;
  what_changed: { en: string; fr: string };
  approved: boolean;
  relationship: string;
  current_to: string | null;
}

export const STALE_AFTER_DAYS = 30;

export function isStale(p: Pick<ProgramRecord, "last_verified_at">, now = new Date()): boolean {
  if (!p.last_verified_at) return true;
  return now.getTime() - new Date(p.last_verified_at).getTime() > STALE_AFTER_DAYS * 86_400_000;
}

function seedPrograms(): ProgramView[] {
  return SEED_PROGRAMS.map((p) => ({
    ...p,
    status_reason: "Development mode: seed data not yet verified by a reviewer",
    has_pending_review: false,
    source_last_changed: null,
    laws: SEED_PROGRAM_LAW_LINKS.filter((l) => l.program_id === p.id).map((l) => {
      const law = SEED_LAWS.find((x) => x.id === l.law_id)!;
      return { ...law, relationship: l.relationship, current_to: null };
    }),
  }));
}

export async function loadPrograms(): Promise<ProgramView[]> {
  if (!hasDatabase()) return seedPrograms();
  const rows = await query<Record<string, unknown>>(
    `SELECT p.*, p.jurisdiction_code AS jurisdiction,
            (SELECT max(last_date_modified)::text FROM program_sources s WHERE s.program_id = p.id) AS source_last_changed,
            COALESCE((SELECT json_agg(json_build_object(
                'id', l.id, 'citation', l.citation, 'title', l.title, 'source_url', l.source_url,
                'what_changed', l.what_changed, 'approved', l.what_changed_approved,
                'relationship', pl.relationship, 'current_to', l.current_to))
              FROM program_law_links pl JOIN laws l ON l.id = pl.law_id WHERE pl.program_id = p.id), '[]') AS laws
       FROM programs p WHERE p.status <> 'retired' ORDER BY p.level, p.id`,
  );
  return rows.map((r) => ({
    ...(r as unknown as ProgramView),
    last_verified_at: r.last_verified_at ? new Date(r.last_verified_at as string).toISOString() : null,
  }));
}

export async function loadProgram(id: string): Promise<ProgramView | null> {
  return (await loadPrograms()).find((p) => p.id === id) ?? null;
}
