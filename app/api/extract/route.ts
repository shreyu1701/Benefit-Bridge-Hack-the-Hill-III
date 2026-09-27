import { z } from "zod";
import { getLlm } from "@/lib/llm/client";
import { extractFacts, MAX_INPUT_CHARS } from "@/lib/llm/tasks";
import { errorResponse, json } from "@/lib/http";
import { diffFacts } from "@/lib/profile/merge";
import { ProfileSchema } from "@/lib/profile/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  text: z.string().trim().min(3).max(MAX_INPUT_CHARS),
  /** The person's profile (guest: from their tab; signed in: loaded client-side from /api/profile). */
  profile: ProfileSchema.partial().nullish(),
});

/**
 * POST /api/extract { text, profile? }
 *   → { detected_language, facts, evidence, sensitive_data_ignored, rejected_values,
 *       diff: { merged, sources, new, agreed, conflicts } }
 * Gemini only extracts facts; the diff against the profile is deterministic.
 * The text is processed in memory and never stored or logged.
 */
export async function POST(req: Request) {
  if (!rateLimit("extract:" + clientKey(req), 10)) return json({ error: "rate_limited" }, { status: 429 });
  try {
    const { text, profile } = Body.parse(await req.json());
    const extraction = await extractFacts(getLlm(), text);
    return json({ ...extraction, diff: diffFacts(profile ?? null, extraction.facts) });
  } catch (e) {
    return errorResponse(e);
  }
}
