import { z } from "zod";
import { sha256 } from "@/lib/sources/fetcher";
import { TIER1 } from "@/data/sources";
import { applyBill, type BillEvent, type BillStore, type IngestStats, type NormalizedBill } from "./bills";

/**
 * LEGISinfo bills feed (https://www.parl.ca/legisinfo/en/bills/json).
 *
 * The schema is intentionally permissive (passthrough, everything optional
 * except the identity fields): the feed is not formally versioned, and an
 * unexpected new field must never break ingestion. Fields we rely on are the
 * ones listed in docs/SOURCE_VERIFICATION.md.
 */
const nstr = z.string().nullish();
const nbool = z.boolean().nullish();

export const LegisinfoBillSchema = z
  .object({
    BillId: z.union([z.number(), z.string()]).nullish(),
    NumberCode: z.string(),
    ParliamentNumber: z.coerce.number().int(),
    SessionNumber: z.coerce.number().int(),
    LongTitleEn: nstr,
    LongTitleFr: nstr,
    ShortTitleEn: nstr,
    ShortTitleFr: nstr,
    StatusNameEn: nstr,
    StatusNameFr: nstr,
    LatestCompletedMajorStageNameWithChamberSuffix: nstr,
    LatestCompletedMajorStageNameEn: nstr,
    LatestCompletedMajorStageNameFr: nstr,
    IsGovernmentBill: nbool,
    IsSessionOngoing: nbool,
    ReceivedRoyalAssent: nbool,
    ReceivedRoyalAssentDateTime: nstr,
    StatuteYear: z.union([z.number(), z.string()]).nullish(),
    StatuteChapter: z.union([z.number(), z.string()]).nullish(),
    ShortLegislativeSummaryEn: nstr,
    ShortLegislativeSummaryFr: nstr,
  })
  .passthrough();
export type LegisinfoBill = z.infer<typeof LegisinfoBillSchema>;

export function parseLegisinfoFeed(json: unknown): { bills: LegisinfoBill[]; rejected: number } {
  if (!Array.isArray(json)) throw new Error("LEGISinfo feed: expected a JSON array");
  const bills: LegisinfoBill[] = [];
  let rejected = 0;
  for (const item of json) {
    const r = LegisinfoBillSchema.safeParse(item);
    if (r.success) bills.push(r.data);
    else rejected++;
  }
  if (json.length > 0 && bills.length === 0) throw new Error("LEGISinfo feed: no parseable bills — format changed?");
  return { bills, rejected };
}

/**
 * Detect the current Parliament and session from the data itself — never hardcoded.
 * Prefer sessions flagged ongoing; otherwise the highest (parliament, session).
 * After a dissolution or prorogation no session is ongoing, and we keep
 * reporting the latest one (flagged not ongoing).
 */
export function detectCurrentSession(bills: LegisinfoBill[]): { parliament: number; session: number; ongoing: boolean } {
  if (!bills.length) throw new Error("Cannot detect session from an empty feed");
  const ongoing = bills.filter((b) => b.IsSessionOngoing === true);
  const pool = ongoing.length ? ongoing : bills;
  const best = pool.reduce((a, b) =>
    b.ParliamentNumber > a.ParliamentNumber || (b.ParliamentNumber === a.ParliamentNumber && b.SessionNumber > a.SessionNumber) ? b : a,
  );
  return { parliament: best.ParliamentNumber, session: best.SessionNumber, ongoing: ongoing.length > 0 };
}

function toIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const READING_LABELS: Record<string, string> = {
  FirstReading: "first reading",
  SecondReading: "second reading",
  ThirdReading: "third reading",
  Report: "report stage",
  Committee: "committee",
  CommitteeReport: "committee report",
};

/**
 * Every `Passed<House|Senate><Stage>DateTime` field with a value becomes a
 * timestamped event. Matching the pattern (rather than a fixed list) keeps us
 * robust to stages we did not anticipate.
 */
export function extractMilestones(b: LegisinfoBill): BillEvent[] {
  const events: BillEvent[] = [];
  for (const [key, value] of Object.entries(b)) {
    const m = /^Passed(House|Senate)(\w+?)DateTime$/.exec(key);
    if (!m || typeof value !== "string") continue;
    const at = toIso(value);
    if (!at) continue;
    const chamber = m[1].toLowerCase();
    const stageRaw = m[2];
    const stageLabel = READING_LABELS[stageRaw] ?? stageRaw.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    events.push({
      stage: `${chamber}_${stageRaw.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}`,
      chamber,
      label_en: `${chamber === "house" ? "House of Commons" : "Senate"}: ${stageLabel}`,
      label_fr: null,
      occurred_at: at,
      occurred_at_is_detected: false,
    });
  }
  const ra = toIso(b.ReceivedRoyalAssentDateTime);
  if (ra) {
    events.push({ stage: "royal_assent", chamber: null, label_en: "Royal assent", label_fr: "Sanction royale", occurred_at: ra, occurred_at_is_detected: false });
  }
  return events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

export function normalizeLegisinfoBill(b: LegisinfoBill): NormalizedBill {
  const statute =
    b.StatuteYear && b.StatuteChapter ? `S.C. ${b.StatuteYear}, c. ${b.StatuteChapter}` : null;
  const royal = b.ReceivedRoyalAssent === false ? null : toIso(b.ReceivedRoyalAssentDateTime);
  const core = {
    jurisdiction: TIER1.legisinfo.jurisdiction,
    bill_number: b.NumberCode.toUpperCase(),
    parliament: b.ParliamentNumber,
    session: b.SessionNumber,
    external_id: b.BillId != null ? String(b.BillId) : null,
    titles: {
      long_en: b.LongTitleEn ?? null,
      long_fr: b.LongTitleFr ?? null,
      short_en: b.ShortTitleEn || null,
      short_fr: b.ShortTitleFr || null,
    },
    current_stage: b.LatestCompletedMajorStageNameWithChamberSuffix ?? b.LatestCompletedMajorStageNameEn ?? null,
    current_stage_fr: b.LatestCompletedMajorStageNameFr ?? null,
    status_en: b.StatusNameEn ?? null,
    status_fr: b.StatusNameFr ?? null,
    is_government_bill: b.IsGovernmentBill ?? null,
    is_session_ongoing: b.IsSessionOngoing ?? null,
    royal_assent_at: royal,
    statute_ref: statute,
    source_url: TIER1.legisinfo.billPageUrl(b.ParliamentNumber, b.SessionNumber, b.NumberCode),
    source_summary: b.ShortLegislativeSummaryEn || null,
  };
  // Hash over the whole raw record so any field change is detected.
  return { ...core, content_hash: sha256(stableStringify(b)), raw: b };
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

/**
 * Ingest one feed payload. Only bills of the detected current session are
 * processed (the feed may include others, e.g. after filters change).
 */
export async function ingestLegisinfo(store: BillStore, json: unknown, now = new Date()): Promise<IngestStats> {
  const { bills } = parseLegisinfoFeed(json);
  const { parliament, session } = detectCurrentSession(bills);
  const stats: IngestStats = { parliament, session, bills_seen: 0, bills_new: 0, bills_changed: 0, events_inserted: 0, royal_assents_new: [] };

  for (const raw of bills) {
    if (raw.ParliamentNumber !== parliament || raw.SessionNumber !== session) continue;
    stats.bills_seen++;
    const bill = normalizeLegisinfoBill(raw);
    const r = await applyBill(store, bill, extractMilestones(raw), now);
    if (r.isNew) stats.bills_new++;
    else if (r.changed) stats.bills_changed++;
    stats.events_inserted += r.inserted;
    if (r.newRoyalAssent) stats.royal_assents_new.push(bill.bill_number);
  }
  return stats;
}
