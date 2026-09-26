import { z } from "zod";
import { errorResponse, json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasVoice, textToSpeech } from "@/lib/voice";

const Body = z.object({ text: z.string().trim().min(1).max(1500) });

/** POST /api/tts { text } → audio/mpeg stream (multilingual voice). */
export async function POST(req: Request) {
  if (!hasVoice()) return json({ error: "voice_unavailable" }, { status: 503 });
  if (!rateLimit("tts:" + clientKey(req), 20)) return json({ error: "rate_limited" }, { status: 429 });
  try {
    const { text } = Body.parse(await req.json());
    const upstream = await textToSpeech(text);
    return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
