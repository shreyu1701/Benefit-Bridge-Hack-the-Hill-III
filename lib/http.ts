import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { LlmOutputError, LlmUnavailableError } from "@/lib/llm/client";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return json({ error: "invalid_request", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (e instanceof LlmUnavailableError) return json({ error: "llm_unavailable", message: e.message }, { status: 503 });
  if (e instanceof LlmOutputError) return json({ error: "llm_invalid_output" }, { status: 502 });
  console.error(e);
  return json({ error: "internal_error" }, { status: 500 });
}
