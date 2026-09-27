"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe, Mic, Square } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { useLang, useT } from "@/components/lang-provider";
import { LANDING } from "@/lib/i18n/landing";
import { emptyProfile, PROFILE_KEYS, type Profile } from "@/lib/profile/schema";
import type { FactDiff } from "@/lib/profile/merge";
import { saveFlow } from "@/lib/session-state";
import { cn } from "@/lib/utils";

/**
 * "Describe your situation" panel (design canvas style): a text box with voice
 * input and example prompts. The profile goes along with the text so the server
 * can report which facts are new and which disagree with the profile.
 * Audio is sent to /api/transcribe (ElevenLabs runs server-side; the key never
 * reaches the browser) and is not stored.
 */
export function SituationInput({ profile }: { profile: Profile | null }) {
  const t = useT();
  const lang = useLang();
  const c = LANDING[lang].start;
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "extract" | "stt">(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ids = { text: useId(), privacy: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setBusy("extract");
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, profile }),
      });
      if (res.status === 503) {
        setError(t("home.llmUnavailable"));
        return;
      }
      if (!res.ok) throw new Error();
      const data: { detected_language: string; sensitive_data_ignored: boolean; evidence: { fact: string; quote: string }[]; diff: FactDiff } = await res.json();
      saveFlow({
        facts: data.diff.merged,
        sources: data.diff.sources,
        conflicts: data.diff.conflicts,
        detected_language: data.detected_language,
        sensitive_data_ignored: data.sensitive_data_ignored,
        evidence: data.evidence,
      });
      router.push("/confirm");
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  /** Skip describing: check with the profile alone. */
  function checkWithProfileOnly() {
    const facts = profile ?? emptyProfile();
    const sources = Object.fromEntries(PROFILE_KEYS.filter((k) => facts[k] !== null).map((k) => [k, "profile" as const]));
    saveFlow({ facts, sources, conflicts: [], detected_language: null, sensitive_data_ignored: false, evidence: [] });
    router.push("/confirm");
  }

  function applyExample(example: string) {
    setText(example);
    const el = textRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => el.setSelectionRange(example.length, example.length));
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
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
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
    <div className="space-y-5">
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
          rows={4}
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

      <p id={ids.privacy} className="text-sm text-muted">{t("home.privacy")}</p>

      <div aria-live="polite" className="space-y-2">
        {busy === "stt" && <p>{t("home.transcribing")}</p>}
        {error && <Notice>{error}</Notice>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">{c.tryLabel}</span>
        {c.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => applyExample(ex)}
            className="min-h-11 rounded-full border border-border bg-card px-4 text-left text-sm hover:border-primary"
          >
            {ex}
          </button>
        ))}
      </div>

      {profile && (
        <p>
          <button type="button" onClick={checkWithProfileOnly} className="min-h-11 text-primary underline">
            {c.profileOnly}
          </button>
        </p>
      )}
    </div>
  );
}
