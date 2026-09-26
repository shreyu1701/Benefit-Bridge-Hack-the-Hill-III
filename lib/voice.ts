/**
 * ElevenLabs integration (speech-to-text for input, multilingual TTS for results).
 * Audio is streamed through in memory and never written to disk or the database.
 */
const API = "https://api.elevenlabs.io/v1";

export function hasVoice(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function speechToText(audio: Blob): Promise<{ text: string; language_code: string | null }> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1");
  form.append("file", audio, "speech.webm");
  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs STT HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string; language_code?: string };
  return { text: (data.text ?? "").trim(), language_code: data.language_code ?? null };
}

export async function textToSpeech(text: string): Promise<Response> {
  const voice = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok || !res.body) throw new Error(`ElevenLabs TTS HTTP ${res.status}`);
  return res;
}
