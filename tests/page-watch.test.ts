import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPage } from "@/lib/ingest/page-extract";
import { checkSource, type PageWatchStore, type ReviewInput, type SnapshotInput, type WatchedSource } from "@/lib/ingest/page-watch";
import type { FetchResult } from "@/lib/sources/fetcher";
import type { LlmClient } from "@/lib/llm/client";
import { validateRules } from "@/lib/rules/validate";
import { SEED_PROGRAMS } from "@/data/programs";

const html = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");
const URL_ = "https://www.canada.ca/en/example/who-apply.html";

class MemStore implements PageWatchStore {
  snapshots: (SnapshotInput & { id: string })[] = [];
  reviews: (ReviewInput & { id: number; status: string })[] = [];
  flagged: { programId: string; reason: string }[] = [];
  source: WatchedSource = { id: 1, program_id: "ca-ccb", url: URL_, last_hash: null, etag: null, http_last_modified: null, consecutive_failures: 0 };
  // Stand-in for the live program record: must never be modified by the watcher.
  liveRules = JSON.stringify(SEED_PROGRAMS[0].eligibility_rules);

  async dueSources() { return [this.source]; }
  async latestOkSnapshot(url: string) {
    const s = [...this.snapshots].reverse().find((x) => x.source_url === url && x.content_hash);
    return s ? { id: s.id, normalized_text: s.normalized_text, content_hash: s.content_hash } : null;
  }
  async insertSnapshot(s: SnapshotInput) {
    const id = `snap-${this.snapshots.length + 1}`;
    this.snapshots.push({ ...s, id });
    return { id, fetched_at: s.fetched_at };
  }
  async updateSource(_id: number, patch: Partial<WatchedSource>) { Object.assign(this.source, patch); }
  async programForReview() { return JSON.parse(this.liveRules); }
  async hasPendingReview(_s: number, kind: string) { return this.reviews.some((r) => r.kind === kind && r.status === "pending"); }
  async createReview(r: ReviewInput) { const id = this.reviews.length + 1; this.reviews.push({ ...r, id, status: "pending" }); return id; }
  async markNeedsVerification(programId: string, reason: string) { this.flagged.push({ programId, reason }); }
}

const ok = (body: string): FetchResult => ({
  url: URL_, finalUrl: URL_, status: 200, ok: true, body, contentType: "text/html", lastModified: null, etag: null, fetchedAt: new Date(), notModified: false,
});
const fail = (status: number, error?: string): FetchResult => ({ ...ok(""), status, ok: false, error });
const fetcherOf = (r: FetchResult) => ({ get: async () => r });

const fakeLlm: LlmClient = {
  async generateJson<T>(): Promise<T> {
    return {
      summary: "The age limit changed from under 18 to under 19 and the amount changed from $8,157 to $8,300.",
      affected_fields: ["eligibility_rules", "benefit_amount"],
      evidence_quotes: ["+You must live with a child who is under 19 years of age."],
      suggested_rule_changes: "Change child age criterion from < 18 to < 19.",
      risk: "high",
      cosmetic_only: false,
    } as T;
  },
};

describe("page extraction", () => {
  it("extracts main content and the page's own Date modified", () => {
    const p = extractPage(html("canada-ca-page.v1.html"));
    expect(p.dateModified).toBe("2026-07-02");
    expect(p.text).toContain("You must live with a child who is under 18 years of age.");
    expect(p.text).not.toMatch(/Canada\.ca\s*Benefits/); // breadcrumb nav removed
    expect(p.text).not.toContain("tracking"); // scripts removed
    expect(p.text).not.toContain("Date modified");
    expect(p.text).not.toContain("Terms and conditions"); // footer removed
  });

  it("re-publishing without content changes gives the same hash", () => {
    const a = extractPage(html("canada-ca-page.v1.html"));
    const b = extractPage(html("canada-ca-page.v1-republished.html"));
    expect(b.dateModified).toBe("2026-08-15");
    expect(b.hash).toBe(a.hash);
  });

  it("reads ontario.ca-style 'Updated:' text", () => {
    const p = extractPage(`<html><body><main><h1>Program</h1><p>Some rule.</p><p>Updated: March 3, 2026</p></main></body></html>`);
    expect(p.dateModified).toBe("2026-03-03");
    expect(p.text).toBe("Program\nSome rule.");
  });
});

describe("change detection → human review queue", () => {
  it("first fetch creates an initial-verification review (seed data must be human-checked)", async () => {
    const store = new MemStore();
    const r = await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1.html"))), llm: fakeLlm });
    expect(r.outcome).toBe("initial");
    expect(store.reviews[0].kind).toBe("initial_verification");
    expect(store.snapshots[0].date_modified).toBe("2026-07-02");
  });

  it("unchanged content (only date/scripts differ) creates no review", async () => {
    const store = new MemStore();
    await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1.html"))), llm: fakeLlm });
    const r = await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1-republished.html"))), llm: fakeLlm });
    expect(r.outcome).toBe("unchanged");
    expect(store.reviews).toHaveLength(1);
    expect((store.source as unknown as Record<string, unknown>).last_date_modified).toBe("2026-08-15");
  });

  it("a content change creates a snapshot, a diff, an LLM draft, and a pending review — live rules untouched", async () => {
    const store = new MemStore();
    const rulesBefore = store.liveRules;
    await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1.html"))), llm: fakeLlm });
    const r = await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v2.html"))), llm: fakeLlm });

    expect(r.outcome).toBe("changed");
    const review = store.reviews[1];
    expect(review.kind).toBe("content_changed");
    expect(review.status).toBe("pending");
    expect(review.previous_snapshot_id).toBe("snap-1");
    expect(review.diff).toContain("-You must live with a child who is under 18 years of age.");
    expect(review.diff).toContain("+You must live with a child who is under 19 years of age.");
    expect(review.llm_change_summary).toMatchObject({ risk: "high" });
    expect(store.liveRules).toBe(rulesBefore);
    expect(store.flagged).toHaveLength(0);
  });

  it("an LLM failure still creates the review with the raw diff", async () => {
    const store = new MemStore();
    const broken: LlmClient = { async generateJson() { throw new Error("quota exceeded"); } };
    await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1.html"))), llm: broken });
    await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v2.html"))), llm: broken });
    expect(store.reviews[1].llm_change_summary).toEqual({ error: "quota exceeded" });
    expect(store.reviews[1].diff).toBeTruthy();
  });

  it("a 404 immediately marks the program 'needs verification' and queues one review", async () => {
    const store = new MemStore();
    await checkSource(store.source, { store, fetcher: fetcherOf(fail(404)), llm: null });
    await checkSource(store.source, { store, fetcher: fetcherOf(fail(404)), llm: null });
    expect(store.flagged[0]).toMatchObject({ programId: "ca-ccb" });
    expect(store.flagged[0].reason).toMatch(/404/);
    expect(store.reviews.filter((r) => r.kind === "source_error")).toHaveLength(1);
  });

  it("a single 503 is retried before flagging; the second consecutive failure flags", async () => {
    const store = new MemStore();
    const first = await checkSource(store.source, { store, fetcher: fetcherOf(fail(503)), llm: null });
    expect(first.outcome).toBe("error");
    expect(store.flagged).toHaveLength(0);
    const second = await checkSource(store.source, { store, fetcher: fetcherOf(fail(0, "ETIMEDOUT")), llm: null });
    expect(second.outcome).toBe("error_flagged");
    expect(store.flagged).toHaveLength(1);
  });

  it("a success resets the failure counter", async () => {
    const store = new MemStore();
    await checkSource(store.source, { store, fetcher: fetcherOf(fail(503)), llm: null });
    await checkSource(store.source, { store, fetcher: fetcherOf(ok(html("canada-ca-page.v1.html"))), llm: null });
    expect(store.source.consecutive_failures).toBe(0);
  });
});

describe("reviewer rule edits are validated before they can go live", () => {
  const good = SEED_PROGRAMS[0].eligibility_rules;

  it("accepts every seeded rule set", () => {
    for (const p of SEED_PROGRAMS) expect(validateRules(p.eligibility_rules), p.id).toMatchObject({ ok: true });
  });

  it("rejects a typo'd variable (which would otherwise evaluate as unknown forever)", () => {
    const bad = structuredClone(good);
    bad.criteria[0].logic = { "==": [{ var: "has_child_undr_18" }, true] };
    const r = validateRules(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/unknown variable "has_child_undr_18"/);
  });

  it("rejects a non-government citation", () => {
    const bad = structuredClone(good);
    bad.criteria[0].source_url = "https://www.example-news.com/ccb";
    expect(validateRules(bad).ok).toBe(false);
  });
});
