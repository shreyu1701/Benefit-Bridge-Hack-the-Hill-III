import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth0";
import { LlmOutputError, LlmQuotaError, LlmUnavailableError } from "@/lib/llm/client";
import { VoiceServiceError } from "@/lib/voice";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return json({ error: "invalid_request", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (e instanceof VoiceServiceError) {
    // The browser falls back to its own voice / typing; the reason is in the server log.
    return json({ error: "voice_unavailable", reason: e.code ?? String(e.status) }, { status: 503 });
  }
  if (e instanceof LlmQuotaError) {
    return json(
      { error: "llm_quota", retry_after_seconds: e.retryAfterSeconds },
      { status: 429, headers: e.retryAfterSeconds ? { "Retry-After": String(e.retryAfterSeconds) } : {} },
    );
  }
  if (e instanceof LlmUnavailableError) return json({ error: "llm_unavailable", message: e.message }, { status: 503 });
  if (e instanceof LlmOutputError) {
    console.error(e.message); // server log only: says whether Gemini rejected the request or returned bad output
    return json({ error: "llm_invalid_output" }, { status: 502 });
  }
  console.error(e);
  return json({ error: "internal_error" }, { status: 500 });
}
