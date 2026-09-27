"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Baby, Briefcase, Globe, GraduationCap, HeartHandshake, Mic, Plane, Square } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { useLang, useT } from "@/components/lang-provider";
import { PROVINCE_LABELS } from "@/lib/facts/labels";
import { emptyFacts, PROVINCES, type ProvinceCode } from "@/lib/facts/schema";
import { LANDING, type StartCopy } from "@/lib/i18n/landing";
import { saveFlow } from "@/lib/session-state";
import { cn } from "@/lib/utils";

const TILE_ICONS: Record<StartCopy["tiles"][number]["id"], typeof Plane> = {
  newcomer: Plane,
  student: GraduationCap,
  family: Baby,
  senior: HeartHandshake,
  worker: Briefcase,
};

/**
 * The "describe your situation" panel from the design canvas: a text box with
 * voice input, example prompts, and starter tiles. Used on the landing page and
 * on /start. The chosen province fills in `province` only when the description
 * didn't mention one — the user can still change it on the next step.
 */
export function SituationInput({ showTiles = true, centered = false }: { showTiles?: boolean; centered?: boolean }) {
  const t = useT();
  const lang = useLang();
  const c = LANDING[lang].start;
  const router = useRouter();
  const [text, setText] = useState("");
  const [province, setProvince] = useState<ProvinceCode>("ON");
  const [busy, setBusy] = useState<null | "extract" | "stt">(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ids = { text: useId(), privacy: useId(), province: useId(), provinceNote: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setBusy("extract");
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503) {
        setError(t("home.llmUnavailable"));
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const facts = { ...data.facts, province: data.facts.province ?? province };
      saveFlow({ facts, detected_language: data.detected_language, sensitive_data_ignored: data.sensitive_data_ignored, evidence: data.evidence });
      router.push("/confirm");
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  function manual() {
    saveFlow({ facts: { ...emptyFacts(), province }, detected_language: null, sensitive_data_ignored: false, evidence: [] });
    router.push("/confirm");
  }

  function applyStarter(starter: string, replace = false) {
    const next = replace ? starter : text.includes(starter.trim()) ? text : (text ? text.trimEnd() + " " : "") + starter;
    setText(next);
    const el = textRef.current;
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      requestAnimationFrame(() => el.setSelectionRange(next.length, next.length));
    }
  }

  async function toggleRecording() {
    if (recording) {
      rec.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        setBusy("stt");
        try {
          const form = new FormData();
          form.append("audio", new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
          const res = await fetch("/api/stt", { method: "POST", body: form });
          if (!res.ok) throw new Error();
          const data = await res.json();
          setText((prev) => (prev ? prev + " " : "") + data.text);
        } catch {
          setError(t("home.voiceUnavailable"));
        } finally {
          chunks.current = [];
          setBusy(null);
        }
      };
      rec.current = r;
      r.start();
      setRecording(true);
    } catch {
      setError(t("home.voiceUnavailable"));
    }
  }

  return (
    <div>
      <div className={cn("space-y-5", centered && "mx-auto max-w-[820px]")}>
        <form
          id="situation"
          onSubmit={submit}
          aria-busy={busy !== null}
          className="scroll-mt-24 rounded-[20px] border border-border bg-card p-2 text-left shadow-[0_1px_2px_rgba(26,26,26,0.04),0_12px_32px_-12px_rgba(26,26,26,0.10)]"
        >
          <label htmlFor={ids.text} className="block px-3 pt-3 sm:px-5 sm:pt-4 text-sm font-semibold">
            {c.label}
          </label>
          <textarea
            ref={textRef}
            id={ids.text}
            rows={3}
            aria-describedby={ids.privacy}
            className="block w-full resize-y bg-transparent px-3 pt-2 pb-3 sm:px-5 text-[17px] sm:text-lg leading-relaxed placeholder:text-muted focus-visible:outline-offset-[-3px]"
            placeholder={c.placeholder}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-2 sm:pl-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleRecording}
                disabled={busy !== null}
                aria-pressed={recording}
                aria-label={recording ? t("home.stop") : t("home.record")}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface disabled:opacity-60",
                  recording && "bg-warn-bg text-warn-fg",
                )}
              >
                {recording ? <Square aria-hidden size={18} /> : <Mic aria-hidden size={20} />}
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <Globe aria-hidden size={16} />
                {c.anyLanguage}
              </span>
            </div>
            <button
              type="submit"
              disabled={busy !== null || text.trim().length < 3}
              className="inline-flex min-h-13 w-full sm:w-auto items-center justify-center gap-2.5 rounded-[14px] bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {busy === "extract" ? t("home.working") : t("home.submit")}
              <ArrowRight aria-hidden size={18} />
            </button>
          </div>
        </form>

        <p id={ids.privacy} className={cn("text-sm text-muted", centered && "sm:text-center")}>{t("home.privacy")}</p>

        <div aria-live="polite" className="space-y-2">
          {busy === "stt" && <p>{t("home.transcribing")}</p>}
          {recording && <p>{t("home.stop")}…</p>}
          {error && <Notice>{error}</Notice>}
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", centered && "sm:justify-center")}>
          <span className="text-sm text-muted mr-1">{c.tryLabel}</span>
          {c.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => applyStarter(ex, true)}
              className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-left hover:border-primary"
            >
              {ex}
            </button>
          ))}
        </div>

        <p className={cn(centered && "sm:text-center")}>
          <button type="button" onClick={manual} className="min-h-11 text-primary underline">
            {t("home.manual")}
          </button>
        </p>
      </div>

      {showTiles && (
        <section aria-labelledby="tiles-h" className="@container space-y-5 pt-12 sm:pt-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="tiles-h" className="font-display text-[28px] sm:text-4xl tracking-tight">{c.tilesHeading}</h2>
              <p className="mt-1 text-muted">{c.tilesHelp}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.province} className="text-[13px] font-semibold text-muted">{c.province}</label>
              <select
                id={ids.province}
                aria-describedby={ids.provinceNote}
                value={province}
                onChange={(e) => setProvince(e.target.value as ProvinceCode)}
                className="min-h-12 w-full sm:w-64 rounded-xl border border-border-strong bg-card px-3 text-base"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{PROVINCE_LABELS[p][lang]}</option>
                ))}
              </select>
            </div>
          </div>
          <p id={ids.provinceNote} className="text-sm text-muted">{c.provinceNote}</p>
          <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-5">
            {c.tiles.map((tile) => {
              const Icon = TILE_ICONS[tile.id];
              return (
                <li key={tile.id}>
                  <button
                    type="button"
                    onClick={() => applyStarter(tile.starter)}
                    className="flex h-full min-h-28 @5xl:min-h-37 w-full flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 @5xl:p-5 text-left hover:border-primary"
                  >
                    <Icon aria-hidden size={26} strokeWidth={1.6} className="text-primary" />
                    <span>
                      <span className="block text-[17px] font-semibold">{tile.title}</span>
                      <span className="mt-1 block text-sm text-muted">{tile.sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
