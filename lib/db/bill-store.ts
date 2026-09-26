import type { BillEvent, BillStore, NormalizedBill, StoredBill } from "@/lib/ingest/bills";
import { query } from "./pool";

export class PgBillStore implements BillStore {
  async getBill(jurisdiction: string, parliament: number, session: number, number: string): Promise<StoredBill | null> {
    const rows = await query<StoredBill>(
      `SELECT id, current_stage, status_en, content_hash, royal_assent_at
         FROM bills WHERE jurisdiction_code=$1 AND parliament=$2 AND session=$3 AND bill_number=$4`,
      [jurisdiction, parliament, session, number],
    );
    return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
  }

  async upsertBill(b: NormalizedBill): Promise<number> {
    const rows = await query<{ id: string }>(
      `INSERT INTO bills (jurisdiction_code, bill_number, parliament, session, external_id, titles, current_stage, current_stage_fr,
                          status_en, status_fr, is_government_bill, is_session_ongoing, royal_assent_at, statute_ref,
                          source_url, content_hash, raw, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NULL)
       ON CONFLICT (jurisdiction_code, parliament, session, bill_number) DO UPDATE SET
         external_id=$5, titles=$6, current_stage=$7, current_stage_fr=$8, status_en=$9, status_fr=$10,
         is_government_bill=$11, is_session_ongoing=$12, royal_assent_at=$13, statute_ref=$14, source_url=$15,
         raw=$17,
         -- A status change invalidates the plain-language summary (e.g. "would" → "does"): regenerate it.
         summary = CASE WHEN bills.royal_assent_at IS DISTINCT FROM $13 THEN NULL ELSE bills.summary END,
         content_hash=$16,
         updated_at = CASE WHEN bills.content_hash IS DISTINCT FROM $16 THEN now() ELSE bills.updated_at END
       RETURNING id`,
      [b.jurisdiction, b.bill_number, b.parliament, b.session, b.external_id, b.titles, b.current_stage, b.current_stage_fr,
       b.status_en, b.status_fr, b.is_government_bill, b.is_session_ongoing, b.royal_assent_at, b.statute_ref,
       b.source_url, b.content_hash, JSON.stringify(b.raw)],
    );
    return Number(rows[0].id);
  }

  async insertEvents(billId: number, events: BillEvent[]): Promise<number> {
    let n = 0;
    for (const e of events) {
      const r = await query(
        `INSERT INTO bill_status_events (bill_id, stage, chamber, label_en, label_fr, occurred_at, occurred_at_is_detected)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING bill_id`,
        [billId, e.stage, e.chamber, e.label_en, e.label_fr, e.occurred_at, e.occurred_at_is_detected],
      );
      n += r.length;
    }
    return n;
  }

  async recordedStages(billId: number): Promise<Set<string>> {
    const rows = await query<{ stage: string }>(`SELECT DISTINCT stage FROM bill_status_events WHERE bill_id=$1`, [billId]);
    return new Set(rows.map((r) => r.stage));
  }
}
