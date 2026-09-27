import type { PageWatchStore, ReviewInput, SnapshotInput, WatchedSource } from "@/lib/ingest/page-watch";
import { query } from "./pool";

export class PgPageWatchStore implements PageWatchStore {
  async dueSources(now: Date): Promise<WatchedSource[]> {
    const rows = await query<WatchedSource & { id: string }>(
      `SELECT id, program_id, url, last_hash, etag, http_last_modified, consecutive_failures
         FROM program_sources ps
        WHERE (last_checked_at IS NULL OR last_checked_at + make_interval(hours => check_interval_hours) <= $1)
          AND EXISTS (SELECT 1 FROM programs p WHERE p.id = ps.program_id AND p.status <> 'retired')
        ORDER BY last_checked_at NULLS FIRST`,
      [now],
    );
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  async latestOkSnapshot(url: string) {
    const rows = await query<{ id: string; normalized_text: string | null; content_hash: string | null }>(
      `SELECT id, normalized_text, content_hash FROM source_snapshots
        WHERE source_url = $1 AND content_hash IS NOT NULL ORDER BY fetched_at DESC LIMIT 1`,
      [url],
    );
    return rows[0] ?? null;
  }

  async insertSnapshot(s: SnapshotInput) {
    const rows = await query<{ id: string; fetched_at: Date }>(
      `INSERT INTO source_snapshots (source_url, fetched_at, http_status, date_modified, content_hash, normalized_text, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, fetched_at`,
      [s.source_url, s.fetched_at, s.http_status, s.date_modified, s.content_hash, s.normalized_text, s.error],
    );
    return rows[0];
  }

  async updateSource(id: number, patch: Record<string, unknown>) {
    const keys = Object.keys(patch);
    if (!keys.length) return;
    const allowed = new Set(["last_checked_at", "last_hash", "last_http_status", "last_date_modified", "etag", "http_last_modified", "consecutive_failures"]);
    const sets = keys.filter((k) => allowed.has(k));
    await query(
      `UPDATE program_sources SET ${sets.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [id, ...sets.map((k) => patch[k])],
    );
  }

  async programForReview(programId: string) {
    const rows = await query(`SELECT id, name, eligibility_rules, benefit_amount, deadlines, how_to_apply, application_url FROM programs WHERE id = $1`, [programId]);
    return rows[0] ?? null;
  }

  async hasPendingReview(sourceId: number, kind: ReviewInput["kind"]) {
    const rows = await query(`SELECT 1 FROM change_reviews WHERE program_source_id = $1 AND kind = $2 AND status = 'pending' LIMIT 1`, [sourceId, kind]);
    return rows.length > 0;
  }

  async createReview(r: ReviewInput) {
    const rows = await query<{ id: string }>(
      `INSERT INTO change_reviews (program_id, program_source_id, snapshot_id, snapshot_fetched_at, previous_snapshot_id, kind, diff, llm_change_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [r.program_id, r.program_source_id, r.snapshot_id, r.snapshot_fetched_at, r.previous_snapshot_id, r.kind, r.diff, r.llm_change_summary],
    );
    await query(`UPDATE programs SET has_pending_review = true WHERE id = $1`, [r.program_id]);
    return Number(rows[0].id);
  }

  async markNeedsVerification(programId: string, reason: string) {
    await query(
      `UPDATE programs SET status = 'needs_verification', status_reason = $2, updated_at = now() WHERE id = $1 AND status NOT IN ('retired', 'draft')`,
      [programId, reason],
    );
  }
}
