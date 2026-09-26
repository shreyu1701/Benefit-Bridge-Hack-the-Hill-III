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
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_;
    const env = { ...process.env, DATABASE_URL: URL_ };
    execSync(`psql "${URL_}" -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`, { env });
    execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { env, stdio: "pipe" });
    mods = {
      pool: await import("@/lib/db/pool"),
      bills: await import("@/lib/db/bill-store"),
      pw: await import("@/lib/db/page-watch-store"),
      reviews: await import("@/lib/db/reviews"),
      ingest: await import("@/lib/ingest/legisinfo"),
      watch: await import("@/lib/ingest/page-watch"),
      repo: await import("@/lib/bills-repo"),
    };
  }, 120_000);

  afterAll(async () => {
    await mods?.pool.closePool();
  });

  const fx = (n: string) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", n), "utf8"));

  it("seeds 11 programs, all needing verification", async () => {
    const rows = await mods.pool.query<{ status: string }>(`SELECT status FROM programs`);
    expect(rows).toHaveLength(11);
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

  it("the match API uses DB programs and records only anonymous events", async () => {
    const { POST } = await import("@/app/api/match/route");
    const res = await POST(
      new Request("http://x/api/match", {
        method: "POST",
        body: JSON.stringify({ facts: { province: "ON", city: "Toronto", family_income_band: "25k_35k", has_dental_insurance: false }, lang: "en" }),
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
