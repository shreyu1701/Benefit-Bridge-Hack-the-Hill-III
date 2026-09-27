"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { ImpactRow, ImpactStatus } from "@/lib/db/bill-impacts";
import { ENUM_LABELS } from "@/lib/facts/labels";
import { LIFE_EVENTS, NEEDS } from "@/lib/profile/schema";

/**
 * Reviewer queue for "who does this bill affect". The model's draft is only a
 * starting point: the reviewer checks it against the official text, edits it,
 * and approves. Only approved rows ever reach anyone's results.
 */
export function BillImpactQueue() {
  const [status, setStatus] = useState<ImpactStatus>("pending");
  const [rows, setRows] = useState<ImpactRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(s = status) {
    const res = await fetch(`/api/admin/bill-impacts?status=${s}`);
    setError(null);
    if (!res.ok) {
      setError(res.status === 401 || res.status === 403 ? "You need a reviewer account to see this." : "Could not load bill drafts.");
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
      <div role="tablist" aria-label="Bill draft status" className="flex flex-wrap gap-2">
        {(["pending", "approved", "not_relevant", "rejected"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 min-h-11 ${status === s ? "border-primary font-semibold" : "border-border"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      {error && <Notice>{error}</Notice>}
      {rows === null && <p>Loading…</p>}
      {rows?.length === 0 && !error && <p>Nothing here.</p>}
      {rows?.map((r) => <ImpactItem key={r.bill_id} r={r} onDone={() => load()} />)}
    </div>
  );
}

function ImpactItem({ r, onDone }: { r: ImpactRow; onDone: () => void }) {
  const [needs, setNeeds] = useState<string[]>(r.needs);
  const [events, setEvents] = useState<string[]>(r.life_events);
  const [conditions, setConditions] = useState(JSON.stringify(r.conditions, null, 2));
  const [whoEn, setWhoEn] = useState(r.who.en);
  const [whoFr, setWhoFr] = useState(r.who.fr);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const title = r.titles.short_en || r.titles.long_en || r.bill_number;
  const id = `bi-${r.bill_id}`;

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErrors([]);
    let body: Record<string, unknown> = { action, notes: notes || undefined };
    if (action === "approve") {
      try {
        body = { ...body, edit: { needs, life_events: events, conditions: JSON.parse(conditions), who: { en: whoEn, fr: whoFr } } };
      } catch {
        setErrors(["Conditions are not valid JSON."]);
        setBusy(false);
        return;
      }
    }
    const res = await fetch(`/api/admin/bill-impacts/${r.bill_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) return onDone();
    const data = await res.json().catch(() => ({}));
    setErrors(data.errors ?? [data.error ?? "Failed"]);
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const editable = r.status !== "approved" && r.status !== "rejected";

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={r.status === "not_relevant" ? "outline" : "possibly"}>{r.status.replace("_", " ")}</Badge>
        <Badge variant="outline">{r.royal_assent_at ? "law" : "proposed"}</Badge>
        <span className="text-sm text-muted">{r.jurisdiction_code} {r.bill_number} · drafted {new Date(r.created_at).toLocaleString("en-CA")}</span>
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm break-all">
        Official text used: <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">{r.source_url}</a>
      </p>

      {r.draft && (
        <div className="rounded-md border border-dashed border-border p-3 text-sm space-y-1">
          <p className="font-semibold">AI draft (may be wrong, check it against the official text)</p>
          {r.draft.evidence_quotes?.length ? <ul className="list-disc pl-5">{r.draft.evidence_quotes.map((q, i) => <li key={i}><q>{q}</q></li>)}</ul> : <p>No quotes given.</p>}
          {r.draft.dropped?.length ? <p>Conditions dropped as unusable: {r.draft.dropped.join("; ")}</p> : null}
        </div>
      )}

      <fieldset disabled={!editable} className="space-y-3">
        <div>
          <label htmlFor={`${id}-en`} className="block text-sm font-medium">Who it affects (English, one plain sentence)</label>
          <textarea id={`${id}-en`} value={whoEn} onChange={(e) => setWhoEn(e.target.value)} className="w-full min-h-16 rounded-md border border-border bg-card p-2" />
        </div>
        <div>
          <label htmlFor={`${id}-fr`} className="block text-sm font-medium">Who it affects (French)</label>
          <textarea id={`${id}-fr`} value={whoFr} onChange={(e) => setWhoFr(e.target.value)} className="w-full min-h-16 rounded-md border border-border bg-card p-2" />
        </div>
        <Picks legend="Needs it is about" values={NEEDS} chosen={needs} onToggle={(v) => toggle(needs, setNeeds, v)} />
        <Picks legend="Life events it relates to" values={LIFE_EVENTS} chosen={events} onToggle={(v) => toggle(events, setEvents, v)} />
        <div>
          <label htmlFor={`${id}-c`} className="block text-sm font-medium">
            Conditions (all must hold). Each is {`{"fact": …, "op": …, "value": …}`}; checked on save. Leave [] if the bill names no specific group.
          </label>
          <textarea id={`${id}-c`} value={conditions} onChange={(e) => setConditions(e.target.value)} className="w-full min-h-32 font-mono text-xs rounded-md border border-border bg-card p-2" />
        </div>
      </fieldset>

      {editable ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={`${id}-n`} className="block text-sm font-medium">Reviewer notes</label>
            <textarea id={`${id}-n`} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-16 rounded-md border border-border bg-card p-2" />
          </div>
          {errors.length > 0 && <Notice><ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice>}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => act("approve")}>Approve</Button>
            <Button disabled={busy} variant="outline" onClick={() => act("reject")}>Reject</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm">{r.status} by {r.reviewer} {r.reviewed_at ? `on ${new Date(r.reviewed_at).toLocaleString("en-CA")}` : ""}{r.reviewer_notes ? `: ${r.reviewer_notes}` : ""}</p>
      )}
    </Card>
  );
}

function Picks({ legend, values, chosen, onToggle }: { legend: string; values: readonly string[]; chosen: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {values.map((v) => (
          <label key={v} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3">
            <input type="checkbox" className="size-5" checked={chosen.includes(v)} onChange={() => onToggle(v)} />
            {ENUM_LABELS[v]?.en ?? v}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
