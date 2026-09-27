import { z } from "zod";
import type { BillImpactDraft } from "@/lib/llm/tasks";
import { LIFE_EVENTS, NEEDS, type LifeEvent, type Need } from "@/lib/profile/schema";
import { conditionsToLogic, sanitizeConditions, type Condition } from "@/lib/rules/conditions";
import type { Logic } from "@/lib/rules/types";
import { isAllowedUrl } from "@/lib/sources/allowlist";
import { hasDatabase, query } from "./pool";

/** A bill waiting for its "who does this affect" draft. */
export interface BillToAssess {
  id: string;
  jurisdiction_code: string;
  bill_number: string;
  parliament: number;
  session: number;
  source_url: string;
  raw: Record<string, unknown>;
  royal_assent_at: string | null;
  titles: { long_en: string | null; short_en: string | null };
  current_stage: string | null;
  status_en: string | null;
}

/** Bills of the current session (per jurisdiction) that have no impact row yet, newest first. */
export async function billsNeedingImpact(limit: number): Promise<BillToAssess[]> {
  return query<BillToAssess>(
    `WITH cur AS (
       SELECT DISTINCT ON (jurisdiction_code) jurisdiction_code, parliament, session
         FROM bills ORDER BY jurisdiction_code, parliament DESC, session DESC)
     SELECT b.id, b.jurisdiction_code, b.bill_number, b.parliament, b.session, b.source_url, b.raw, b.royal_assent_at,
            b.titles, b.current_stage, b.status_en
       FROM bills b JOIN cur USING (jurisdiction_code, parliament, session)
      WHERE NOT EXISTS (SELECT 1 FROM bill_impacts i WHERE i.bill_id = b.id)
      ORDER BY b.updated_at DESC
      LIMIT $1`,
    [limit],
  );
}

/** Store the model's draft: relevant bills wait for a reviewer; the rest are parked as "not relevant". */
export async function saveImpactDraft(billId: number | string, draft: BillImpactDraft, sourceUrl: string) {
  await query(
    `INSERT INTO bill_impacts (bill_id, status, needs, life_events, conditions, applies_if, who, source_url, draft)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (bill_id) DO NOTHING`,
    [billId, draft.relevant ? "pending" : "not_relevant", JSON.stringify(draft.needs), JSON.stringify(draft.life_events),
     JSON.stringify(draft.conditions), draft.applies_if === null ? null : JSON.stringify(draft.applies_if), draft.who, sourceUrl, draft],
  );
}

export type ImpactStatus = "pending" | "approved" | "rejected" | "not_relevant";

export interface ImpactRow {
  bill_id: number;
  status: ImpactStatus;
  needs: Need[];
  life_events: LifeEvent[];
  conditions: Condition[];
  applies_if: Logic | null;
  who: { en: string; fr: string };
  source_url: string;
  draft: (BillImpactDraft & Record<string, unknown>) | null;
  reviewer: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  jurisdiction_code: string;
  bill_number: string;
  titles: { long_en: string | null; long_fr: string | null; short_en: string | null; short_fr: string | null };
  current_stage: string | null;
  current_stage_fr: string | null;
  status_en: string | null;
  status_fr: string | null;
  royal_assent_at: string | null;
  bill_source_url: string;
}

const SELECT = `
  SELECT i.bill_id::int, i.status, i.needs, i.life_events, i.conditions, i.applies_if, i.who, i.source_url, i.draft,
         i.reviewer, i.reviewer_notes, i.reviewed_at, i.created_at,
         b.jurisdiction_code, b.bill_number, b.titles, b.current_stage, b.current_stage_fr, b.status_en, b.status_fr,
         b.royal_assent_at, b.source_url AS bill_source_url
    FROM bill_impacts i JOIN bills b ON b.id = i.bill_id`;

export async function listImpacts(status: ImpactStatus = "pending"): Promise<ImpactRow[]> {
  return query<ImpactRow>(`${SELECT} WHERE i.status = $1 ORDER BY i.created_at ASC LIMIT 200`, [status]);
}

/**
 * Approved impacts that can still matter to someone: bills of the current
 * session, or laws that got royal assent in the last year.
 */
export async function loadApprovedImpacts(): Promise<ImpactRow[]> {
  if (!hasDatabase()) return [];
  return query<ImpactRow>(
    `WITH cur AS (
       SELECT DISTINCT ON (jurisdiction_code) jurisdiction_code, parliament, session
         FROM bills ORDER BY jurisdiction_code, parliament DESC, session DESC)
     ${SELECT}
      WHERE i.status = 'approved'
        AND (EXISTS (SELECT 1 FROM cur WHERE cur.jurisdiction_code = b.jurisdiction_code AND cur.parliament = b.parliament AND cur.session = b.session)
             OR b.royal_assent_at > now() - interval '365 days')`,
  );
}

/** What a reviewer may change before approving. Everything is re-validated here, never trusted from the browser. */
export const ImpactEdit = z.object({
  needs: z.array(z.enum(NEEDS)).max(NEEDS.length),
  life_events: z.array(z.enum(LIFE_EVENTS)).max(LIFE_EVENTS.length),
  conditions: z.array(z.unknown()).max(10),
  who: z.object({ en: z.string().trim().min(5).max(400), fr: z.string().trim().min(5).max(400) }),
});
export type ImpactEdit = z.infer<typeof ImpactEdit>;

export class ImpactError extends Error {
  constructor(public errors: string[]) {
    super(errors.join("; "));
  }
}

/** Pure: check a reviewer's edit and build the JSON Logic. Throws ImpactError listing every problem. */
export function validateImpactEdit(input: unknown): { needs: Need[]; life_events: LifeEvent[]; conditions: Condition[]; applies_if: Logic | null; who: { en: string; fr: string } } {
  const p = ImpactEdit.safeParse(input);
  if (!p.success) throw new ImpactError(p.error.issues.map((i) => `${i.path.join(".") || "edit"}: ${i.message}`));
  const { conditions, dropped } = sanitizeConditions(p.data.conditions);
  if (dropped.length) throw new ImpactError(dropped);
  if (!conditions.length && !p.data.needs.length && !p.data.life_events.length) {
    throw new ImpactError(["Give at least one condition, need or life event, or it can never be matched to anyone"]);
  }
  return { needs: [...new Set(p.data.needs)], life_events: [...new Set(p.data.life_events)], conditions, applies_if: conditionsToLogic(conditions), who: p.data.who };
}

export async function approveImpact(billId: number, reviewer: string, opts: { edit?: unknown; notes?: string } = {}) {
  const current = (await query<ImpactRow>(`${SELECT} WHERE i.bill_id = $1`, [billId]))[0];
  if (!current) throw new ImpactError(["Not found"]);
  if (current.status === "approved") throw new ImpactError(["Already approved"]);
  if (!isAllowedUrl(current.source_url)) throw new ImpactError(["The source is not an official government page"]);
  const v = validateImpactEdit(opts.edit ?? { needs: current.needs, life_events: current.life_events, conditions: current.conditions, who: current.who });
  await query(
    `UPDATE bill_impacts SET status = 'approved', needs = $2, life_events = $3, conditions = $4, applies_if = $5, who = $6,
            reviewer = $7, reviewer_notes = $8, reviewed_at = now() WHERE bill_id = $1`,
    [billId, JSON.stringify(v.needs), JSON.stringify(v.life_events), JSON.stringify(v.conditions),
     v.applies_if === null ? null : JSON.stringify(v.applies_if), v.who, reviewer, opts.notes ?? null],
  );
  return { bill_id: billId, status: "approved" as const };
}

/** Reject (or re-open a "not relevant" one as rejected). Nothing about the bill is shown in results. */
export async function rejectImpact(billId: number, reviewer: string, notes?: string) {
  const r = await query(
    `UPDATE bill_impacts SET status = 'rejected', reviewer = $2, reviewer_notes = $3, reviewed_at = now()
      WHERE bill_id = $1 AND status <> 'rejected' RETURNING bill_id`,
    [billId, reviewer, notes ?? null],
  );
  if (!r.length) throw new ImpactError(["Not found or already rejected"]);
  return { bill_id: billId, status: "rejected" as const };
}
