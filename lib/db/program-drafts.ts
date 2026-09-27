import { z } from "zod";
import { getJurisdiction } from "@/data/jurisdictions";
import type { ProgramRecord } from "@/lib/rules/types";
import { isAllowedUrl } from "@/lib/sources/allowlist";
import { query, withTransaction } from "./pool";

/**
 * Requests to draft a new program from an official page. The worker drafts it
 * (status "draft", invisible), adds the page as a watched source, and the
 * page-watch job opens the first review. Approving that review makes it live.
 */
export interface DraftRequest {
  id: number;
  url: string;
  jurisdiction_code: string;
  requested_by: string;
  status: "queued" | "drafted" | "failed";
  program_id: string | null;
  error: string | null;
  created_at: string;
}

export const DraftRequestInput = z.object({
  url: z.string().url().refine(isAllowedUrl, "Must be an official government page (https, allow-listed domain)"),
  jurisdiction: z.string().refine((c) => Boolean(getJurisdiction(c)), "Unknown jurisdiction"),
});

export async function requestDraft(input: unknown, requestedBy: string): Promise<DraftRequest> {
  const { url, jurisdiction } = DraftRequestInput.parse(input);
  const existing = await query<DraftRequest>(
    `SELECT id::int, url, jurisdiction_code, requested_by, status, program_id, error, created_at FROM program_draft_requests
      WHERE url = $1 AND status <> 'failed' LIMIT 1`,
    [url],
  );
  if (existing[0]) return existing[0];
  const known = await query(`SELECT 1 FROM program_sources WHERE url = $1 LIMIT 1`, [url]);
  if (known.length) throw new z.ZodError([{ code: "custom", path: ["url"], message: "This page is already watched for an existing program", input: url }]);
  const rows = await query<DraftRequest>(
    `INSERT INTO program_draft_requests (url, jurisdiction_code, requested_by) VALUES ($1,$2,$3)
     RETURNING id::int, url, jurisdiction_code, requested_by, status, program_id, error, created_at`,
    [url, jurisdiction, requestedBy],
  );
  return rows[0];
}

export async function listDraftRequests(limit = 50): Promise<DraftRequest[]> {
  return query<DraftRequest>(
    `SELECT id::int, url, jurisdiction_code, requested_by, status, program_id, error, created_at
       FROM program_draft_requests ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
}

export async function queuedDraftRequests(limit: number): Promise<DraftRequest[]> {
  return query<DraftRequest>(
    `SELECT id::int, url, jurisdiction_code, requested_by, status, program_id, error, created_at
       FROM program_draft_requests WHERE status = 'queued' ORDER BY created_at LIMIT $1`,
    [limit],
  );
}

export async function takenProgramIds(): Promise<Set<string>> {
  return new Set((await query<{ id: string }>(`SELECT id FROM programs`)).map((r) => r.id));
}

/** Store a drafted program as invisible "draft" and start watching its page (which opens the first review). */
export async function saveDraftedProgram(requestId: number, p: ProgramRecord, dropped: string[]) {
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO programs (id, name, level, jurisdiction_code, eligibility_rules, benefit_amount, deadlines, how_to_apply,
                             application_url, source_url, status, status_reason, summaries_by_language, topics)
       VALUES ($1,$2,$3,$4,$5,$6,'[]',$7,$8,$9,'draft',$10,$11,$12)`,
      [p.id, p.name, p.level, p.jurisdiction, p.eligibility_rules, p.benefit_amount, p.how_to_apply, p.application_url, p.source_url,
       `Drafted by AI from the official page; not shown until a reviewer approves it.${dropped.length ? ` Unusable draft rules: ${dropped.join("; ")}` : ""}`.slice(0, 2000),
       p.summaries_by_language, p.topics],
    );
    await c.query(`INSERT INTO program_sources (program_id, url, check_interval_hours) VALUES ($1,$2,24)`, [p.id, p.source_url]);
    await c.query(`UPDATE program_draft_requests SET status = 'drafted', program_id = $2, updated_at = now() WHERE id = $1`, [requestId, p.id]);
  });
}

export async function failDraftRequest(requestId: number, error: string) {
  await query(`UPDATE program_draft_requests SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`, [requestId, error.slice(0, 1000)]);
}
