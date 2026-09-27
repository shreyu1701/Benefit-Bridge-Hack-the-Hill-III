import { errorResponse, json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasVoice, speechToText } from "@/lib/voice";

const MAX_BYTES = 10 * 1024 * 1024;

/** POST /api/transcribe (multipart: audio from MediaRecorder) → { text, language_code }. ElevenLabs runs here, server-side, so the key never reaches the browser. Audio is never stored. */
export async function POST(req: Request) {
  if (!hasVoice()) return json({ error: "voice_unavailable" }, { status: 503 });
  if (!rateLimit("stt:" + clientKey(req), 6)) return json({ error: "rate_limited" }, { status: 429 });
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) return json({ error: "missing_audio" }, { status: 400 });
    if (audio.size > MAX_BYTES) return json({ error: "audio_too_large" }, { status: 413 });
    return json(await speechToText(audio));
  } catch (e) {
    return errorResponse(e);
  }
}
