"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { DraftRequest } from "@/lib/db/program-drafts";

const JURISDICTIONS = [
  ["CA", "Federal (Government of Canada)"],
  ["ON", "Ontario"],
  ["ON-TORONTO", "City of Toronto"],
] as const;

/** Ask the worker to draft a new program from an official page. It appears in the review queue, never straight to the public. */
export function ProgramDraftForm() {
  const [url, setUrl] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("CA");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<DraftRequest[] | null>(null);

  async function load() {
    const res = await fetch("/api/admin/program-drafts");
    setRows(res.ok ? await res.json() : []);
  }
  useEffect(() => {
    // Data fetch on mount; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/admin/program-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, jurisdiction }) });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      return load();
    }
    const data = await res.json().catch(() => ({}));
    setErrors(data.issues ?? [data.error ?? "Failed"]);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="draft-url" className="block text-sm font-medium">Official page describing one program (canada.ca, ontario.ca, toronto.ca…)</label>
          <Input id="draft-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} className="min-h-11 bg-card" placeholder="https://www.canada.ca/…" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="draft-j" className="block text-sm font-medium">Who runs it</label>
          <select id="draft-j" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="min-h-11 rounded-md border border-input bg-card px-3">
            {JURISDICTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        {errors.length > 0 && <Notice><ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice>}
        <Button type="submit" disabled={busy}>Draft this program</Button>
        <p className="text-sm text-muted">The worker drafts it within about 15 minutes. It then appears above as a first-time review. Nobody sees it until you approve.</p>
      </form>
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={r.status === "failed" ? "warn" : r.status === "drafted" ? "likely" : "outline"}>{r.status}</Badge>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{r.url}</a>
              {r.program_id && <span className="text-muted">→ {r.program_id}</span>}
              {r.error && <span className="text-destructive">{r.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
