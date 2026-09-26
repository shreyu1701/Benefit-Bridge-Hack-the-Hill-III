import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectCurrentSession,
  extractMilestones,
  ingestLegisinfo,
  normalizeLegisinfoBill,
  parseLegisinfoFeed,
} from "@/lib/ingest/legisinfo";
import { MemoryBillStore } from "./helpers/memory-bill-store";

const fx = (name: string) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));
const v1 = fx("legisinfo-bills.synthetic.v1.json");
const v2 = fx("legisinfo-bills.synthetic.v2.json");

describe("session detection", () => {
  it("detects the ongoing Parliament/session from the data, ignoring older sessions", () => {
    const { bills } = parseLegisinfoFeed(v1);
    expect(detectCurrentSession(bills)).toEqual({ parliament: 45, session: 1, ongoing: true });
  });

  it("follows a new session after prorogation without code changes", () => {
    const prorogued = v1.map((b: Record<string, unknown>) => ({ ...b, IsSessionOngoing: false }));
    prorogued.push({ ...v1[0], NumberCode: "C-1", SessionNumber: 2, IsSessionOngoing: true });
    const { bills } = parseLegisinfoFeed(prorogued);
    expect(detectCurrentSession(bills)).toEqual({ parliament: 45, session: 2, ongoing: true });
  });

  it("after dissolution (nothing ongoing) reports the latest session as not ongoing", () => {
    const dissolved = v1.map((b: Record<string, unknown>) => ({ ...b, IsSessionOngoing: false }));
    const { bills } = parseLegisinfoFeed(dissolved);
    expect(detectCurrentSession(bills)).toEqual({ parliament: 45, session: 1, ongoing: false });
  });
});

describe("parsing", () => {
  it("tolerates unknown fields and rejects items missing identity fields", () => {
    const { bills, rejected } = parseLegisinfoFeed([...v1, { Foo: 1 }]);
    expect(bills).toHaveLength(4);
    expect(rejected).toBe(1);
  });

  it("fails loudly if the feed format changes completely", () => {
    expect(() => parseLegisinfoFeed([{ totally: "different" }])).toThrow(/format changed/);
    expect(() => parseLegisinfoFeed({ not: "an array" })).toThrow();
  });

  it("builds the official bill page URL and statute reference", () => {
    const { bills } = parseLegisinfoFeed(v2);
    const c5 = normalizeLegisinfoBill(bills.find((b) => b.NumberCode === "C-5")!);
    expect(c5.source_url).toBe("https://www.parl.ca/legisinfo/en/bill/45-1/c-5");
    expect(c5.statute_ref).toBe("S.C. 2026, c. 12");
    expect(c5.royal_assent_at).toBe("2026-09-24T21:00:00.000Z");
  });

  it("turns every Passed*DateTime field into a timestamped milestone", () => {
    const { bills } = parseLegisinfoFeed(v1);
    const m = extractMilestones(bills.find((b) => b.NumberCode === "C-5")!);
    expect(m.map((e) => e.stage)).toEqual([
      "house_first_reading",
      "house_second_reading",
      "house_third_reading",
      "senate_first_reading",
      "senate_second_reading",
      "senate_third_reading",
    ]);
    expect(m.every((e) => !e.occurred_at_is_detected)).toBe(true);
  });
});

describe("ingestion and status-change events", () => {
  it("first run stores current-session bills with their milestone timeline", async () => {
    const store = new MemoryBillStore();
    const stats = await ingestLegisinfo(store, v1, new Date("2026-09-01T12:00:00Z"));
    expect(stats).toMatchObject({ parliament: 45, session: 1, bills_seen: 3, bills_new: 3, bills_changed: 0 });
    expect(store.byNumber("C-99")).toBeUndefined(); // previous Parliament ignored
    expect(store.eventsFor("C-5").map((e) => e.stage)).toContain("senate_third_reading");
  });

  it("re-ingesting the same feed is idempotent", async () => {
    const store = new MemoryBillStore();
    await ingestLegisinfo(store, v1, new Date("2026-09-01T12:00:00Z"));
    const before = store.events.length;
    const stats = await ingestLegisinfo(store, v1, new Date("2026-09-01T12:30:00Z"));
    expect(stats.events_inserted).toBe(0);
    expect(stats.bills_changed).toBe(0);
    expect(store.events.length).toBe(before);
  });

  it("records stage changes and new royal assents on the next poll", async () => {
    const store = new MemoryBillStore();
    await ingestLegisinfo(store, v1, new Date("2026-09-01T12:00:00Z"));
    const stats = await ingestLegisinfo(store, v2, new Date("2026-09-26T12:00:00Z"));

    expect(stats.bills_new).toBe(1); // C-12
    expect(stats.bills_changed).toBe(2); // C-2, C-5
    expect(stats.royal_assents_new).toEqual(["C-5"]);

    const c2 = store.eventsFor("C-2");
    expect(c2.find((e) => e.stage === "house_second_reading")?.occurred_at).toBe("2026-09-22T19:30:00.000Z");
    // The stage change is explained by the new timestamped milestone → no duplicate "detected" event.
    expect(c2.some((e) => e.stage.startsWith("status:"))).toBe(false);

    const ra = store.eventsFor("C-5").find((e) => e.stage === "royal_assent");
    expect(ra?.occurred_at).toBe("2026-09-24T21:00:00.000Z");
    expect(store.byNumber("C-5")?.royal_assent_at).toBe("2026-09-24T21:00:00.000Z");
  });

  it("a status change with no timestamp in the feed is recorded at detection time", async () => {
    const store = new MemoryBillStore();
    await ingestLegisinfo(store, v1, new Date("2026-09-01T12:00:00Z"));
    const v1b = structuredClone(v1);
    v1b[2].StatusNameEn = "At consideration in committee in the Senate";
    v1b[2].LatestCompletedMajorStageNameWithChamberSuffix = "Second reading in the Senate";
    await ingestLegisinfo(store, v1b, new Date("2026-09-10T08:00:00Z"));
    const ev = store.eventsFor("S-201").find((e) => e.stage === "status:Second reading in the Senate");
    expect(ev).toMatchObject({ occurred_at_is_detected: true, occurred_at: "2026-09-10T08:00:00.000Z" });
  });

  it("a bill without royal assent never gets a royal_assent_at", async () => {
    const store = new MemoryBillStore();
    await ingestLegisinfo(store, v2);
    expect(store.byNumber("C-2")?.royal_assent_at).toBeNull();
  });
});

// Runs automatically once `npm run fixtures:refresh` has saved the real feed.
const REAL = path.join(__dirname, "fixtures", "legisinfo-bills.real.json");
describe.skipIf(!existsSync(REAL))("real LEGISinfo feed fixture", () => {
  it("parses, detects a session, and ingests without errors", async () => {
    const json = JSON.parse(readFileSync(REAL, "utf8"));
    const { bills, rejected } = parseLegisinfoFeed(json);
    expect(rejected).toBe(0);
    const s = detectCurrentSession(bills);
    expect(s.parliament).toBeGreaterThanOrEqual(45);
    const stats = await ingestLegisinfo(new MemoryBillStore(), json);
    expect(stats.bills_seen).toBeGreaterThan(0);
  });
});
