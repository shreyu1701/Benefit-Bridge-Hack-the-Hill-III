/** Jurisdiction-neutral bill model shared by the federal and Ontario ingesters. */

export interface NormalizedBill {
  jurisdiction: string;
  bill_number: string;
  parliament: number;
  session: number;
  external_id: string | null;
  titles: { long_en: string | null; long_fr: string | null; short_en: string | null; short_fr: string | null };
  current_stage: string | null;
  current_stage_fr: string | null;
  status_en: string | null;
  status_fr: string | null;
  is_government_bill: boolean | null;
  is_session_ongoing: boolean | null;
  royal_assent_at: string | null;
  statute_ref: string | null;
  source_url: string;
  source_summary: string | null; // official short summary, if the feed has one
  content_hash: string;
  raw: unknown;
}

export interface BillEvent {
  stage: string;
  chamber: string | null;
  label_en: string;
  label_fr: string | null;
  occurred_at: string; // ISO
  occurred_at_is_detected: boolean;
}

export interface StoredBill {
  id: number;
  current_stage: string | null;
  status_en: string | null;
  content_hash: string | null;
  royal_assent_at: string | null;
}

export interface BillStore {
  getBill(jurisdiction: string, parliament: number, session: number, number: string): Promise<StoredBill | null>;
  upsertBill(b: NormalizedBill): Promise<number>;
  /** Idempotent: events already recorded (same bill, stage, occurred_at) are ignored. Returns number inserted. */
  insertEvents(billId: number, events: BillEvent[]): Promise<number>;
  /** Stages already recorded for the bill (to avoid duplicate "detected" events). */
  recordedStages(billId: number): Promise<Set<string>>;
}

export interface IngestStats {
  parliament: number;
  session: number;
  bills_seen: number;
  bills_new: number;
  bills_changed: number;
  events_inserted: number;
  royal_assents_new: string[];
}

/**
 * Compare a freshly fetched bill with what we stored and produce events.
 * - Milestone timestamps from the source become events with their real time.
 * - A change of the textual status/stage without a timestamp becomes a
 *   "status:<text>" event stamped with the detection time.
 */
export async function applyBill(
  store: BillStore,
  bill: NormalizedBill,
  milestones: BillEvent[],
  now: Date,
): Promise<{ id: number; isNew: boolean; changed: boolean; inserted: number; newRoyalAssent: boolean }> {
  const prev = await store.getBill(bill.jurisdiction, bill.parliament, bill.session, bill.bill_number);
  const id = await store.upsertBill(bill);
  const events = [...milestones];

  const stageText = bill.current_stage ?? bill.status_en;
  const prevStageText = prev ? prev.current_stage ?? prev.status_en : null;
  const changed = !prev || prev.content_hash !== bill.content_hash;

  if (stageText && stageText !== prevStageText) {
    const key = "status:" + stageText;
    const recorded = prev ? await store.recordedStages(id) : new Set<string>();
    if (!recorded.has(key)) {
      events.push({
        stage: key,
        chamber: null,
        label_en: stageText,
        label_fr: bill.current_stage_fr ?? bill.status_fr,
        occurred_at: now.toISOString(),
        occurred_at_is_detected: true,
      });
    }
  }

  const inserted = events.length ? await store.insertEvents(id, events) : 0;
  return {
    id,
    isNew: !prev,
    changed,
    inserted,
    newRoyalAssent: Boolean(bill.royal_assent_at) && !prev?.royal_assent_at,
  };
}
