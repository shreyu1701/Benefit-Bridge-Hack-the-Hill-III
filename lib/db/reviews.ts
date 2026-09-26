import { validateRules } from "@/lib/rules/validate";
import { query, withTransaction } from "./pool";

export interface ReviewRow {
  id: number;
  program_id: string;
  program_name: { en: string; fr: string };
  program_status: string;
  source_url: string | null;
  kind: string;
  diff: string | null;
  llm_change_summary: Record<string, unknown> | null;
  status: string;
  reviewer: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  snapshot_fetched_at: string;
  http_status: number | null;
  date_modified: string | null;
  current_rules: unknown;
}

export async function listReviews(status: "pending" | "approved" | "rejected" = "pending"): Promise<ReviewRow[]> {
  return query<ReviewRow>(
    `SELECT r.id::int, r.program_id, p.name AS program_name, p.status AS program_status, ps.url AS source_url, r.kind, r.diff,
            r.llm_change_summary, r.status, r.reviewer, r.reviewer_notes, r.reviewed_at, r.created_at, r.snapshot_fetched_at,
            s.http_status, s.date_modified::text, p.eligibility_rules AS current_rules
       FROM change_reviews r
       JOIN programs p ON p.id = r.program_id
       LEFT JOIN program_sources ps ON ps.id = r.program_source_id
       LEFT JOIN source_snapshots s ON s.id = r.snapshot_id AND s.fetched_at = r.snapshot_fetched_at
      WHERE r.status = $1
      ORDER BY r.created_at ASC
      LIMIT 200`,
    [status],
  );
}

export class ReviewError extends Error {
  constructor(public errors: string[]) {
    super(errors.join("; "));
  }
}

/**
 * Approve a review. Optionally applies reviewer-edited rules (validated).
 * The program becomes "active" and verified only when no review is still
 * pending for it — every watched page must have been looked at by a human.
 */
export async function approveReview(id: number, reviewer: string, opts: { rules?: unknown; notes?: string } = {}) {
  let validated: ReturnType<typeof validateRules> | null = null;
  if (opts.rules !== undefined) {
    validated = validateRules(opts.rules);
    if (!validated.ok) throw new ReviewError(validated.errors);
  }
  return withTransaction(async (c) => {
    const r = (await c.query(`SELECT id, program_id, status FROM change_reviews WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!r) throw new ReviewError(["Review not found"]);
    if (r.status !== "pending") throw new ReviewError([`Review is already ${r.status}`]);

    if (validated?.ok) {
      const p = (await c.query(`UPDATE programs SET eligibility_rules = $2, revision = revision + 1, updated_at = now()
                                 WHERE id = $1 RETURNING revision, eligibility_rules, benefit_amount, deadlines`, [r.program_id, validated.rules])).rows[0];
      await c.query(
        `INSERT INTO program_revisions (program_id, revision, eligibility_rules, benefit_amount, deadlines, approved_by, change_review_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.program_id, p.revision, p.eligibility_rules, p.benefit_amount, JSON.stringify(p.deadlines), reviewer, id],
      );
    }

    await c.query(
      `UPDATE change_reviews SET status = 'approved', reviewer = $2, reviewer_notes = $3, reviewed_at = now(), proposed_rules = $4 WHERE id = $1`,
      [id, reviewer, opts.notes ?? null, validated?.ok ? validated.rules : null],
    );

    const pending = Number((await c.query(`SELECT count(*) FROM change_reviews WHERE program_id = $1 AND status = 'pending'`, [r.program_id])).rows[0].count);
    if (pending === 0) {
      await c.query(
        `UPDATE programs SET status = 'active', status_reason = NULL, has_pending_review = false,
                             last_verified_at = now(), approved_by = $2, updated_at = now()
          WHERE id = $1 AND status <> 'retired'
            -- A page that is still failing keeps the program in "needs verification".
            AND NOT EXISTS (SELECT 1 FROM program_sources ps WHERE ps.program_id = $1
                             AND (ps.last_http_status IN (404, 410) OR ps.consecutive_failures >= 2))`,
        [r.program_id, reviewer],
      );
    }
    return { program_id: r.program_id as string, remaining_pending: pending };
  });
}

/** Reject: the live record stays exactly as it was. A source-error flag stays until a later successful check is approved. */
export async function rejectReview(id: number, reviewer: string, notes?: string) {
  return withTransaction(async (c) => {
    const r = (await c.query(`UPDATE change_reviews SET status = 'rejected', reviewer = $2, reviewer_notes = $3, reviewed_at = now()
                                WHERE id = $1 AND status = 'pending' RETURNING program_id`, [id, reviewer, notes ?? null])).rows[0];
    if (!r) throw new ReviewError(["Review not found or not pending"]);
    const pending = Number((await c.query(`SELECT count(*) FROM change_reviews WHERE program_id = $1 AND status = 'pending'`, [r.program_id])).rows[0].count);
    await c.query(`UPDATE programs SET has_pending_review = $2 WHERE id = $1`, [r.program_id, pending > 0]);
    return { program_id: r.program_id as string, remaining_pending: pending };
  });
}
