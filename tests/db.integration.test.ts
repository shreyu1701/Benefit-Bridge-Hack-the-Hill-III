import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end against a real PostgreSQL (plain Postgres or Tiger Data).
 * Runs only when TEST_DATABASE_URL is set; the database is wiped first.
 *   TEST_DATABASE_URL=postgres://… npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL_)("database integration", () => {
  let mods: {
    pool: typeof import("@/lib/db/pool");
    bills: typeof import("@/lib/db/bill-store");
    pw: typeof import("@/lib/db/page-watch-store");
    reviews: typeof import("@/lib/db/reviews");
    ingest: typeof import("@/lib/ingest/legisinfo");
    watch: typeof import("@/lib/ingest/page-watch");
    repo: typeof import("@/lib/bills-repo");
    impacts: typeof import("@/lib/db/bill-impacts");
    drafts: typeof import("@/lib/db/program-drafts");
    programs: typeof import("@/lib/programs-repo");
    builder: typeof import("@/lib/rules/program-draft");
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    const env = { ...process.env, DATABASE_URL: URL_ };
    const { Client } = await import("pg");
    const wipe = new Client({ connectionString: URL_ });
    await wipe.connect();
    await wipe.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await wipe.end();
    execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { env, stdio: "pipe" });
    mods = {
      pool: await import("@/lib/db/pool"),
      bills: await import("@/lib/db/bill-store"),
      pw: await import("@/lib/db/page-watch-store"),
      reviews: await import("@/lib/db/reviews"),
      ingest: await import("@/lib/ingest/legisinfo"),
      watch: await import("@/lib/ingest/page-watch"),
      repo: await import("@/lib/bills-repo"),
      impacts: await import("@/lib/db/bill-impacts"),
      drafts: await import("@/lib/db/program-drafts"),
      programs: await import("@/lib/programs-repo"),
      builder: await import("@/lib/rules/program-draft"),
    };
  }, 120_000);

  afterAll(async () => {
    await mods?.pool.closePool();
  });

  const fx = (n: string) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", n), "utf8"));

  it("seeds 13 programs, all needing verification", async () => {
    const rows = await mods.pool.query<{ status: string }>(`SELECT status FROM programs`);
    expect(rows).toHaveLength(13);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["needs_verification"]));
  });

  it("ingests LEGISinfo twice and records the timeline idempotently", async () => {
    const store = new mods.bills.PgBillStore();
    await mods.ingest.ingestLegisinfo(store, fx("legisinfo-bills.synthetic.v1.json"), new Date("2026-09-01T12:00:00Z"));
    const s2 = await mods.ingest.ingestLegisinfo(store, fx("legisinfo-bills.synthetic.v2.json"), new Date("2026-09-26T12:00:00Z"));
    const s3 = await mods.ingest.ingestLegisinfo(store, fx("legisinfo-bills.synthetic.v2.json"), new Date("2026-09-26T12:30:00Z"));
    expect(s2.royal_assents_new).toEqual(["C-5"]);
    expect(s3.events_inserted).toBe(0);

    const list = await mods.repo.listBills({ jurisdiction: "CA" });
    expect(list.map((b) => b.bill_number).sort()).toEqual(["C-12", "C-2", "C-5", "S-201"]);
    const c5 = list.find((b) => b.bill_number === "C-5")!;
    expect(c5.statute_ref).toBe("S.C. 2026, c. 12");
    const detail = await mods.repo.getBill(c5.id);
    expect(detail!.events.at(-1)!.stage).toBe("royal_assent");
  });

  it("bill impact: drafted → hidden until approved → shown; bad edits refused", async () => {
    const need = await mods.impacts.billsNeedingImpact(10);
    const c12 = need.find((b) => b.bill_number === "C-12")!;
    const s201 = need.find((b) => b.bill_number === "S-201")!;
    const base = { needs: [], life_events: [], evidence_quotes: [], dropped: [], who: { en: "Seniors would get more.", fr: "Les aînés recevraient plus." } };
    await mods.impacts.saveImpactDraft(c12.id, { ...base, relevant: true, needs: ["income_support"], conditions: [{ fact: "age", op: ">=", value: 65 }], applies_if: { ">=": [{ var: "age" }, 65] } }, c12.source_url);
    await mods.impacts.saveImpactDraft(s201.id, { ...base, relevant: false, conditions: [], applies_if: null }, s201.source_url);

    expect((await mods.impacts.billsNeedingImpact(10)).map((b) => b.bill_number)).not.toContain("C-12");
    expect((await mods.impacts.listImpacts("not_relevant")).map((r) => r.bill_number)).toEqual(["S-201"]);
    expect(await mods.impacts.loadApprovedImpacts()).toEqual([]); // nothing public before approval

    const id = Number(c12.id);
    await expect(mods.impacts.approveImpact(id, "r@example.org", { edit: { needs: [], life_events: [], conditions: [{ fact: "age", op: ">=", value: "old" }], who: base.who } })).rejects.toThrow();
    await mods.impacts.approveImpact(id, "r@example.org");
    const live = await mods.impacts.loadApprovedImpacts();
    expect(live.map((r) => [r.bill_number, r.applies_if])).toEqual([["C-12", { ">=": [{ var: "age" }, 65] }]]);
  });

  it("new program: requested → hidden draft → first review → approved and visible", async () => {
    const url = "https://www.ontario.ca/page/ontario-seniors-dental-care-program";
    await expect(mods.drafts.requestDraft({ url: "https://example.com/benefit", jurisdiction: "ON" }, "r@example.org")).rejects.toThrow();
    const req = await mods.drafts.requestDraft({ url, jurisdiction: "ON" }, "r@example.org");
    expect((await mods.drafts.requestDraft({ url, jurisdiction: "ON" }, "r@example.org")).id).toBe(req.id); // no duplicates
    expect((await mods.drafts.queuedDraftRequests(5)).map((r) => r.id)).toEqual([req.id]);

    const L = (en: string) => ({ en, fr: en });
    const { program, dropped } = mods.builder.buildProgramFromDraft(
      {
        is_benefit_program: true, name: L("Ontario Seniors Dental Care Program"), summary: L("Dental care for seniors."),
        needs: ["health_dental"], life_events: [], also_required: [], how_to_apply: L("Apply online."), amount: null,
        criteria: [{ condition: { fact: "age", op: ">=", value: 65 }, met: L("65+"), failed: L("Must be 65+"), check: L("Age?"), source_quote: "be 65 years of age or older" }],
      },
      { url, jurisdiction: "ON", id: mods.builder.draftProgramId("ON", "Ontario Seniors Dental Care Program", await mods.drafts.takenProgramIds()) },
    );
    await mods.drafts.saveDraftedProgram(req.id, program, dropped);
    expect((await mods.drafts.listDraftRequests()).find((r) => r.id === req.id)).toMatchObject({ status: "drafted", program_id: program.id });
    expect((await mods.programs.loadPrograms()).map((p) => p.id)).not.toContain(program.id); // hidden

    // The page watch opens the first review for it, like any program.
    const store = new mods.pw.PgPageWatchStore();
    const [src] = (await store.dueSources(new Date())).filter((s) => s.program_id === program.id);
    const html = readFileSync(path.join(__dirname, "fixtures", "canada-ca-page.v1.html"), "utf8");
    const fetcher = { get: async (u: string) => ({ url: u, finalUrl: u, status: 200, ok: true, body: html, contentType: "text/html", lastModified: null, etag: null, fetchedAt: new Date(), notModified: false }) };
    await mods.watch.checkSource(src, { store, fetcher, llm: null });
    const [review] = (await mods.reviews.listReviews("pending")).filter((r) => r.program_id === program.id);
    expect(review).toMatchObject({ kind: "initial_verification", program_status: "draft" });

    await mods.reviews.approveReview(review.id, "r@example.org");
    const live = (await mods.programs.loadPrograms()).find((p) => p.id === program.id)!;
    expect(live).toMatchObject({ status: "active", topics: { needs: ["health_dental"], life_events: [] } });
  });

  it("page change → pending review → approval activates the program only when nothing is pending", async () => {
    const store = new mods.pw.PgPageWatchStore();
    const due = (await store.dueSources(new Date())).filter((s) => s.program_id === "ca-cdcp");
    expect(due.length).toBeGreaterThan(0);
    const html = readFileSync(path.join(__dirname, "fixtures", "canada-ca-page.v1.html"), "utf8");
    const fetcher = { get: async (url: string) => ({ url, finalUrl: url, status: 200, ok: true, body: html, contentType: "text/html", lastModified: null, etag: null, fetchedAt: new Date(), notModified: false }) };

    for (const src of due) await mods.watch.checkSource(src, { store, fetcher, llm: null });
    const pending = (await mods.reviews.listReviews("pending")).filter((r) => r.program_id === "ca-cdcp");
    expect(pending).toHaveLength(due.length);
    expect(pending[0].kind).toBe("initial_verification");
    expect(pending[0].date_modified).toBe("2026-07-02");

    // Invalid rule edit is refused and nothing changes.
    await expect(
      mods.reviews.approveReview(pending[0].id, "reviewer@example.org", { rules: { version: 1, criteria: [{ id: "x", logic: { var: "nope" } }], also_required: [] } }),
    ).rejects.toThrow();

    for (const [i, r] of pending.entries()) {
      const out = await mods.reviews.approveReview(r.id, "reviewer@example.org");
      const [p] = await mods.pool.query<{ status: string; approved_by: string | null }>(`SELECT status, approved_by FROM programs WHERE id='ca-cdcp'`);
      if (i < pending.length - 1) expect(p.status).toBe("needs_verification");
      else {
        expect(out.remaining_pending).toBe(0);
        expect(p).toEqual({ status: "active", approved_by: "reviewer@example.org" });
      }
    }
  });

  it("stores the profile encrypted, reads it back, and deletes profile then user", async () => {
    process.env.PROFILE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    const profiles = await import("@/lib/db/profiles");
    const { emptyProfile } = await import("@/lib/profile/schema");
    const id = await profiles.upsertUser("google-oauth2|test", "person@example.org");
    expect(await profiles.upsertUser("google-oauth2|test", null)).toBe(id); // idempotent, email kept
    const profile = { ...emptyProfile(), residency_status: "refugee_claimant" as const, family_income_band: "15k_25k" as const };
    await profiles.saveProfile(id, profile);

    const [row] = await mods.pool.query<{ encrypted_data: Buffer }>(`SELECT encrypted_data FROM profiles WHERE user_id = $1`, [id]);
    expect(row.encrypted_data.toString("utf8")).not.toContain("refugee_claimant"); // encrypted at rest
    expect(await profiles.getProfile(id)).toEqual(profile);

    expect(await profiles.deleteAccount("google-oauth2|test")).toBe(true);
    expect(await mods.pool.query(`SELECT 1 FROM users WHERE id = $1`, [id])).toHaveLength(0);
    expect(await mods.pool.query(`SELECT 1 FROM profiles WHERE user_id = $1`, [id])).toHaveLength(0);
    expect(await profiles.deleteAccount("google-oauth2|test")).toBe(false);
  });

  it("the match API uses DB programs and records only anonymous events", async () => {
    const { POST } = await import("@/app/api/match/route");
    const res = await POST(
      new Request("http://x/api/match", {
        method: "POST",
        body: JSON.stringify({ facts: { province: "ON", city: "Toronto", family_income_band: "25k_35k", has_dental_insurance: false, files_taxes: true }, lang: "en" }),
      }),
    );
    const body = await res.json();
    const cdcp = body.cards.find((c: { id: string }) => c.id === "ca-cdcp");
    expect(cdcp.confidence).toBe("likely");
    expect(cdcp.status).toBe("active");
    await new Promise((r) => setTimeout(r, 200));
    const ev = await mods.pool.query(`SELECT * FROM match_events WHERE program_id='ca-cdcp'`);
    expect(ev.length).toBeGreaterThan(0);
    expect(Object.keys(ev[0]).sort()).toEqual(["confidence", "matched_at", "program_id", "region"]);
    expect(ev[0].region).toBe("ON-TORONTO");
  });
});
