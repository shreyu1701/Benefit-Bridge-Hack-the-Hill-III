import type { PoliteFetcher } from "@/lib/sources/fetcher";
import type { LlmClient } from "@/lib/llm/client";
import { draftChangeReview } from "@/lib/llm/tasks";
import type { ChangeReviewOutput } from "@/lib/llm/contracts";
import { extractPage, unifiedDiff } from "./page-extract";

/**
 * Tier 2 page-change detection.
 *
 * The live eligibility rules are NEVER modified here. A detected change only
 * creates a snapshot + a pending change review; a human applies any update.
 */

export interface WatchedSource {
  id: number;
  program_id: string;
  url: string;
  last_hash: string | null;
  etag: string | null;
  http_last_modified: string | null;
  consecutive_failures: number;
}

export interface SnapshotInput {
  source_url: string;
  fetched_at: Date;
  http_status: number;
  date_modified: string | null;
  content_hash: string | null;
  normalized_text: string | null;
  error: string | null;
}

export interface ReviewInput {
  program_id: string;
  program_source_id: number;
  snapshot_id: string;
  snapshot_fetched_at: Date;
  previous_snapshot_id: string | null;
  kind: "content_changed" | "source_error" | "initial_verification";
  diff: string | null;
  llm_change_summary: (ChangeReviewOutput & { error?: never }) | { error: string } | null;
}

export interface PageWatchStore {
  dueSources(now: Date): Promise<WatchedSource[]>;
  latestOkSnapshot(url: string): Promise<{ id: string; normalized_text: string | null; content_hash: string | null } | null>;
  insertSnapshot(s: SnapshotInput): Promise<{ id: string; fetched_at: Date }>;
  updateSource(
    id: number,
    patch: Partial<{ last_checked_at: Date; last_hash: string; last_http_status: number; last_date_modified: string | null; etag: string | null; http_last_modified: string | null; consecutive_failures: number }>,
  ): Promise<void>;
  programForReview(programId: string): Promise<unknown>;
  hasPendingReview(sourceId: number, kind: ReviewInput["kind"]): Promise<boolean>;
  createReview(r: ReviewInput): Promise<number>;
  markNeedsVerification(programId: string, reason: string): Promise<void>;
}

export interface PageWatchResult {
  source_id: number;
  url: string;
  outcome: "unchanged" | "not_modified" | "changed" | "initial" | "error" | "error_flagged";
  review_id?: number;
}

/** Hard failures: the page is gone. Other failures must repeat before we flag (avoid flapping on 503s). */
const GONE = new Set([404, 410]);
export const TRANSIENT_FAILURES_BEFORE_FLAG = 2;

export async function checkSource(
  src: WatchedSource,
  deps: { store: PageWatchStore; fetcher: Pick<PoliteFetcher, "get">; llm: LlmClient | null; now?: Date },
): Promise<PageWatchResult> {
  const { store, fetcher, llm } = deps;
  const now = deps.now ?? new Date();
  const res = await fetcher.get(src.url, { etag: src.etag, lastModified: src.http_last_modified });

  if (res.notModified) {
    await store.updateSource(src.id, { last_checked_at: now, last_http_status: 304, consecutive_failures: 0 });
    return { source_id: src.id, url: src.url, outcome: "not_modified" };
  }

  if (!res.ok) {
    const failures = src.consecutive_failures + 1;
    const snap = await store.insertSnapshot({
      source_url: src.url, fetched_at: now, http_status: res.status, date_modified: null,
      content_hash: null, normalized_text: null, error: res.error ?? `HTTP ${res.status}`,
    });
    await store.updateSource(src.id, { last_checked_at: now, last_http_status: res.status, consecutive_failures: failures });

    const flag = GONE.has(res.status) || failures >= TRANSIENT_FAILURES_BEFORE_FLAG;
    if (!flag) return { source_id: src.id, url: src.url, outcome: "error" };

    const reason = GONE.has(res.status)
      ? `Official page returned HTTP ${res.status} (page removed or moved)`
      : `Official page failed ${failures} times in a row (${res.error ?? "HTTP " + res.status})`;
    await store.markNeedsVerification(src.program_id, reason);
    let review_id: number | undefined;
    if (!(await store.hasPendingReview(src.id, "source_error"))) {
      review_id = await store.createReview({
        program_id: src.program_id, program_source_id: src.id, snapshot_id: snap.id, snapshot_fetched_at: snap.fetched_at,
        previous_snapshot_id: null, kind: "source_error", diff: null, llm_change_summary: null,
      });
    }
    return { source_id: src.id, url: src.url, outcome: "error_flagged", review_id };
  }

  const page = extractPage(res.body);
  const sourcePatch = {
    last_checked_at: now, last_http_status: res.status, last_date_modified: page.dateModified,
    etag: res.etag, http_last_modified: res.lastModified, consecutive_failures: 0,
  };

  if (src.last_hash === page.hash) {
    await store.updateSource(src.id, sourcePatch);
    return { source_id: src.id, url: src.url, outcome: "unchanged" };
  }

  const initial = !src.last_hash;
  const prev = await store.latestOkSnapshot(src.url);
  const snap = await store.insertSnapshot({
    source_url: src.url, fetched_at: now, http_status: res.status, date_modified: page.dateModified,
    content_hash: page.hash, normalized_text: page.text, error: null,
  });
  await store.updateSource(src.id, { ...sourcePatch, last_hash: page.hash });

  const diff = unifiedDiff(src.url, prev?.normalized_text ?? "", page.text);

  let llmSummary: ReviewInput["llm_change_summary"] = null;
  if (llm && !initial) {
    try {
      llmSummary = await draftChangeReview(llm, { programJson: await store.programForReview(src.program_id), diff, url: src.url });
    } catch (e) {
      // A failed draft never blocks the review — the human still sees the raw diff.
      llmSummary = { error: (e as Error).message };
    }
  }

  const review_id = await store.createReview({
    program_id: src.program_id, program_source_id: src.id, snapshot_id: snap.id, snapshot_fetched_at: snap.fetched_at,
    previous_snapshot_id: prev?.id ?? null, kind: initial ? "initial_verification" : "content_changed", diff, llm_change_summary: llmSummary,
  });
  return { source_id: src.id, url: src.url, outcome: initial ? "initial" : "changed", review_id };
}

export async function runPageWatch(deps: { store: PageWatchStore; fetcher: Pick<PoliteFetcher, "get">; llm: LlmClient | null; now?: Date }) {
  const due = await deps.store.dueSources(deps.now ?? new Date());
  const results: PageWatchResult[] = [];
  for (const src of due) results.push(await checkSource(src, deps));
  return results;
}
