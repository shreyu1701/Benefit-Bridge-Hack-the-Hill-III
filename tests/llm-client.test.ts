import { describe, expect, it } from "vitest";
import { z } from "zod";
import { classify, GeminiClient, LlmOutputError, LlmQuotaError, LlmUnavailableError } from "@/lib/llm/client";

// The real 429 body Gemini returns when a free-tier key runs out.
const QUOTA = Object.assign(
  new Error('{"error":{"code":429,"message":"You exceeded your current quota ... Please retry in 51.534673118s.","status":"RESOURCE_EXHAUSTED"}}'),
  { status: 429 },
);

function clientReturning(...results: (string | Error)[]) {
  return clientWith(null, ...results);
}

function clientWith(fallback: string | null, ...results: (string | Error)[]) {
  const c = new GeminiClient("test-key", "main-model", "embed", fallback);
  let calls = 0;
  const models: string[] = [];
  // Replace the SDK call; everything else (retries, validation, classification) is real.
  (c as unknown as { ai: unknown }).ai = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        models.push(model);
        const r = results[Math.min(calls++, results.length - 1)];
        if (r instanceof Error) throw r;
        return { text: r };
      },
    },
  };
  (c as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
  return { c, calls: () => calls, models };
}

const req = { task: "t", system: "s", user: "u", jsonSchema: {}, validator: z.object({ ok: z.boolean() }) };

describe("Gemini error handling", () => {
  it("classifies quota, transient and fatal errors", () => {
    expect(classify(QUOTA)).toEqual({ kind: "quota", retryAfter: 52 });
    expect(classify(Object.assign(new Error("UNAVAILABLE"), { status: 503 })).kind).toBe("transient");
    expect(classify(Object.assign(new Error("Invalid JSON schema"), { status: 400 })).kind).toBe("fatal");
  });

  it("a quota error is reported as quota and never retried (retries would burn more quota)", async () => {
    const { c, calls } = clientReturning(QUOTA);
    await expect(c.generateJson(req)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(calls()).toBe(1);
  });

  it("on quota, retries once on the fallback model (separate quota)", async () => {
    const { c, models } = clientWith("lite-model", QUOTA, '{"ok":true}');
    await expect(c.generateJson(req)).resolves.toEqual({ ok: true });
    expect(models).toEqual(["main-model", "lite-model"]);
  });

  it("if the fallback is out of quota too, reports quota", async () => {
    const { c, models } = clientWith("lite-model", QUOTA);
    await expect(c.generateJson(req)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(models).toEqual(["main-model", "lite-model"]);
  });

  it("invalid output gets exactly one retry", async () => {
    const { c, calls } = clientReturning('{"nope":1}');
    await expect(c.generateJson(req)).rejects.toBeInstanceOf(LlmOutputError);
    expect(calls()).toBe(2);
  });

  it("recovers when the retry is valid", async () => {
    const { c } = clientReturning('{"nope":1}', '{"ok":true}');
    await expect(c.generateJson(req)).resolves.toEqual({ ok: true });
  });

  it("503s are retried, then reported as unavailable", async () => {
    const { c, calls } = clientReturning(Object.assign(new Error("UNAVAILABLE"), { status: 503 }));
    await expect(c.generateJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(calls()).toBe(5);
  });

  it("a rejected request (e.g. schema refused) is not retried", async () => {
    const { c, calls } = clientReturning(Object.assign(new Error("Invalid JSON payload"), { status: 400 }));
    await expect(c.generateJson(req)).rejects.toThrow(/Gemini request failed/);
    expect(calls()).toBe(1);
  });
});
