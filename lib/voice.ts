/**
 * ElevenLabs integration (speech-to-text for input, multilingual TTS for results).
 * Runs only on the server, so the API key never reaches the browser.
 * Audio is streamed through in memory and never written to disk or the database.
 */
const API = "https://api.elevenlabs.io/v1";

/**
 * A built-in ("premade") voice. Free ElevenLabs plans can't use Voice Library
 * voices through the API (HTTP 402 paid_plan_required), so the default must be premade.
 * Sarah reads English and French well with eleven_multilingual_v2.
 */
export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah; override with ELEVENLABS_VOICE_ID

export function hasVoice(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** ElevenLabs refused the request (bad key, plan/voice not allowed, out of credits, rate limit). */
export class VoiceServiceError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    message: string,
  ) {
    super(message);
  }
}

async function fail(res: Response, what: string): Promise<never> {
  let code: string | null = null;
  let message = "";
  try {
    const body = (await res.json()) as {
      detail?: { code?: string; status?: string; message?: string } | string;
    };
    const d = body.detail;
    if (typeof d === "string") message = d;
    else if (d) {
      code = d.code ?? d.status ?? null;
      message = d.message ?? "";
    }
  } catch {
    /* non-JSON error body */
  }
  // Server log only (no audio or text content): explains e.g. "paid_plan_required".
  console.error(
    `ElevenLabs ${what} HTTP ${res.status}${code ? ` ${code}` : ""}: ${message}`.slice(
      0,
      400,
    ),
  );
  throw new VoiceServiceError(
    res.status,
    code,
    `ElevenLabs ${what} failed (${res.status}${code ? ` ${code}` : ""})`,
  );
}

/** File extension ElevenLabs can recognise from the recorder's MIME type (Chrome: webm, Safari: mp4). */
function extensionFor(type: string): string {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac"))
    return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  return "webm";
}

export async function speechToText(
  audio: Blob,
): Promise<{ text: string; language_code: string | null }> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1");
  form.append("file", audio, `speech.${extensionFor(audio.type)}`);
  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return fail(res, "speech-to-text");
  const data = (await res.json()) as { text?: string; language_code?: string };
  return {
    text: (data.text ?? "").trim(),
    language_code: data.language_code ?? null,
  };
}

export async function textToSpeech(text: string): Promise<Response> {
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const res = await fetch(
    `${API}/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_multilingual_v2",
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok || !res.body) return fail(res, "text-to-speech");
  return res;
}
