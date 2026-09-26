import { z } from "zod";
import { getLlm } from "@/lib/llm/client";
import { extractFacts, MAX_INPUT_CHARS } from "@/lib/llm/tasks";
import { errorResponse, json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ text: z.string().trim().min(3).max(MAX_INPUT_CHARS) });

/**
 * POST /api/extract  { text } → { detected_language, facts, evidence, sensitive_data_ignored, rejected_values }
 * The text is processed in memory and never stored or logged.
 */
export async function POST(req: Request) {
  if (!rateLimit("extract:" + clientKey(req), 10)) return json({ error: "rate_limited" }, { status: 429 });
  try {
    const { text } = Body.parse(await req.json());
    return json(await extractFacts(getLlm(), text));
  } catch (e) {
    return errorResponse(e);
  }
}
