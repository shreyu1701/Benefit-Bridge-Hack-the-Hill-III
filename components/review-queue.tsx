"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { ReviewRow } from "@/lib/db/reviews";

/**
 * Admin review queue. Reviewers see the raw diff (source of truth), an LLM
 * draft (clearly labelled), and can approve as-is, approve with edited rules
 * (validated server-side), or reject. Nothing changes the live rules otherwise.
 */
export function ReviewQueue() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(s = status) {
    const res = await fetch(`/api/admin/reviews?status=${s}`);
    setError(null);
    if (!res.ok) {
      setError(res.status === 401 || res.status === 403 ? "You need a reviewer account to see this page." : "Could not load reviews.");
      setRows([]);
      return;
    }
    setRows(await res.json());
  }
  useEffect(() => {
    // Data fetch on tab change; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Review status" className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 min-h-11 ${status === s ? "border-primary font-semibold" : "border-border"}`}>
            {s}
          </button>
        ))}
      </div>
      {error && <Notice>{error}</Notice>}
      {rows === null && <p>Loading…</p>}
      {rows?.length === 0 && !error && <p>Nothing here.</p>}
      {rows?.map((r) => <ReviewItem key={r.id} r={r} onDone={() => load()} />)}
    </div>
  );
}

function ReviewItem({ r, onDone }: { r: ReviewRow; onDone: () => void }) {
  const [rules, setRules] = useState(JSON.stringify(r.current_rules, null, 2));
  const [editRules, setEditRules] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const s = r.llm_change_summary as null | { summary?: string; risk?: string; affected_fields?: string[]; evidence_quotes?: string[]; suggested_rule_changes?: string | null; cosmetic_only?: boolean; error?: string };

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErrors([]);
    let body: Record<string, unknown> = { action, notes: notes || undefined };
    if (action === "approve" && editRules) {
      try {
        body = { ...body, rules: JSON.parse(rules) };
      } catch {
        setErrors(["Rules are not valid JSON."]);
        setBusy(false);
        return;
      }
    }
    const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) return onDone();
    const data = await res.json().catch(() => ({}));
    setErrors(data.errors ?? [data.error ?? "Failed"]);
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={r.kind === "source_error" ? "warn" : r.kind === "initial_verification" ? "outline" : "possibly"}>{r.kind.replace("_", " ")}</Badge>
        {s?.risk && <Badge variant={s.risk === "high" ? "warn" : "outline"}>risk: {s.risk}</Badge>}
        <span className="text-sm text-muted">#{r.id} · {new Date(r.created_at).toLocaleString("en-CA")}</span>
      </div>
      <h2 className="text-lg font-bold">{r.program_name.en} <span className="text-sm font-normal text-muted">({r.program_id}, {r.program_status})</span></h2>
      {r.source_url && <p className="text-sm break-all"><a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">{r.source_url}</a> · HTTP {r.http_status ?? "?"} · page date modified: {r.date_modified ?? "—"}</p>}

      {r.program_status === "draft" && (
        <Notice>
          New program drafted by AI from this page. It is hidden from the public. Check every rule and quote against the page; use &quot;Edit eligibility rules&quot; to fix them. Approving makes it visible to everyone.
        </Notice>
      )}
      {r.kind === "initial_verification" && (
        <Notice tone="info">First fetch of this page. Read the page text below and confirm the program&apos;s rules match it before approving.</Notice>
      )}
      {r.kind === "source_error" && <Notice>The official page failed or disappeared. Find the new official page (update the program&apos;s sources) before approving.</Notice>}

      {s && (
        <div className="rounded-md border border-dashed border-border p-3 text-sm space-y-1">
          <p className="font-semibold">AI draft (may be wrong, verify against the diff)</p>
          {s.error ? <p>Draft unavailable: {s.error}</p> : (
            <>
              <p>{s.summary}</p>
              {s.affected_fields && <p>Possibly affected: {s.affected_fields.join(", ")}{s.cosmetic_only ? " (looks cosmetic)" : ""}</p>}
              {s.suggested_rule_changes && <p>Suggested: {s.suggested_rule_changes}</p>}
              {s.evidence_quotes?.length ? <ul className="list-disc pl-5">{s.evidence_quotes.map((q, i) => <li key={i}><code>{q}</code></li>)}</ul> : null}
            </>
          )}
        </div>
      )}

      {r.diff && (
        <details open={r.kind === "content_changed"}>
          <summary className="cursor-pointer font-medium min-h-11 flex items-center">Diff of the page text</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-background p-3 text-xs leading-5" tabIndex={0} aria-label="Diff">
            {r.diff.split("\n").map((line, i) => (
              <span key={i} className={line.startsWith("+") && !line.startsWith("+++") ? "block bg-likely-bg text-likely-fg" : line.startsWith("-") && !line.startsWith("---") ? "block bg-warn-bg text-warn-fg" : "block"}>
                {line || " "}
              </span>
            ))}
          </pre>
        </details>
      )}

      {r.status === "pending" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 min-h-11">
            <input type="checkbox" className="size-5" checked={editRules} onChange={(e) => setEditRules(e.target.checked)} />
            Edit eligibility rules (JSON Logic) before approving
          </label>
          {editRules && (
            <div>
              <label htmlFor={`rules-${r.id}`} className="block text-sm font-medium">Eligibility rules (validated on save: known variables, official citations, valid JSON Logic)</label>
              <textarea id={`rules-${r.id}`} value={rules} onChange={(e) => setRules(e.target.value)} className="w-full min-h-64 font-mono text-xs rounded-md border border-border bg-card p-2" />
            </div>
          )}
          <div>
            <label htmlFor={`notes-${r.id}`} className="block text-sm font-medium">Reviewer notes</label>
            <textarea id={`notes-${r.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-20 rounded-md border border-border bg-card p-2" />
          </div>
          {errors.length > 0 && <Notice><ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice>}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => act("approve")}>Approve{editRules ? " with edited rules" : ""}</Button>
            <Button disabled={busy} variant="outline" onClick={() => act("reject")}>Reject</Button>
          </div>
        </div>
      )}
      {r.status !== "pending" && <p className="text-sm">{r.status} by {r.reviewer} {r.reviewed_at ? `on ${new Date(r.reviewed_at).toLocaleString("en-CA")}` : ""}{r.reviewer_notes ? ` — ${r.reviewer_notes}` : ""}</p>}
    </Card>
  );
}
