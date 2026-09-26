"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useT } from "@/components/lang-provider";
import { emptyFacts } from "@/lib/facts/schema";
import { saveFlow } from "@/lib/session-state";

export function SituationInput() {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "extract" | "stt">(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

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
      saveFlow({ facts: data.facts, detected_language: data.detected_language, sensitive_data_ignored: data.sensitive_data_ignored, evidence: data.evidence });
      router.push("/confirm");
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  function manual() {
    saveFlow({ facts: emptyFacts(), detected_language: null, sensitive_data_ignored: false, evidence: [] });
    router.push("/confirm");
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
    <form onSubmit={submit} className="space-y-4" aria-busy={busy !== null}>
      <div>
        <label htmlFor="situation" className="block text-lg font-semibold">
          {t("home.title")}
        </label>
        <p id="situation-help" className="text-muted">
          {t("home.help")}
        </p>
      </div>
      <textarea
        id="situation"
        aria-describedby="situation-help situation-privacy"
        className="w-full min-h-40 rounded-lg border border-border bg-card p-3 text-base"
        placeholder={t("home.placeholder")}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
      />
      <p id="situation-privacy" className="text-sm text-muted">
        {t("home.privacy")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={busy !== null || text.trim().length < 3}>
          {busy === "extract" ? t("home.working") : t("home.submit")}
        </Button>
        <Button variant="outline" size="lg" onClick={toggleRecording} disabled={busy !== null} aria-pressed={recording}>
          {recording ? <Square aria-hidden size={18} /> : <Mic aria-hidden size={18} />}
          {recording ? t("home.stop") : t("home.record")}
        </Button>
      </div>
      <div aria-live="polite" className="space-y-2">
        {busy === "stt" && <p>{t("home.transcribing")}</p>}
        {error && <Notice>{error}</Notice>}
      </div>
      <p>
        <button type="button" onClick={manual} className="underline text-primary min-h-11">
          {t("home.manual")}
        </button>
      </p>
    </form>
  );
}
