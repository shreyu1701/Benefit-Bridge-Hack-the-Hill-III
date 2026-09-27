"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/lang-provider";

/**
 * Reads text aloud with ElevenLabs multilingual TTS; falls back to the
 * browser's built-in speech synthesis if the voice service is unavailable.
 */
export function ListenButton({ text, lang }: { text: string; lang: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => stop(), []);

  function stop() {
    audio.current?.pause();
    if (audio.current?.src) URL.revokeObjectURL(audio.current.src);
    audio.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setState("idle");
  }

  async function play() {
    setState("loading");
    try {
      const res = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = stop;
      await a.play();
      setState("playing");
    } catch {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.onend = () => setState("idle");
        window.speechSynthesis.speak(u);
        setState("playing");
      } else setState("idle");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={state === "idle" ? play : stop} disabled={state === "loading"} className="no-print">
      {state === "playing" ? <Square aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}
      {state === "playing" ? t("results.stopListening") : t("results.listen")}
    </Button>
  );
}
