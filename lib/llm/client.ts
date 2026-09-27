import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";

/**
 * Thin, injectable LLM interface. All LLM calls in the app go through
 * `generateJson`, which enforces a JSON schema on the model (Gemini
 * structured output) AND re-validates the result with zod. Invalid output is
 * retried once, then rejected — it is never passed on "best effort".
 */
export interface LlmClient {
  generateJson<T>(req: {
    task: string;
    system: string;
    user: string;
    jsonSchema: object;
    validator: z.ZodType<T>;
    temperature?: number;
  }): Promise<T>;
  embed?(text: string): Promise<number[]>;
}

export class LlmUnavailableError extends Error {
  constructor(msg = "LLM is not configured (set GEMINI_API_KEY)") {
    super(msg);
  }
}
export class LlmOutputError extends Error {}
/** The API key's quota is used up (HTTP 429 / RESOURCE_EXHAUSTED). Retrying immediately only wastes more quota. */
export class LlmQuotaError extends Error {
  constructor(message: string, public retryAfterSeconds: number | null) {
    super(message);
  }
}

/** Classify a Gemini SDK error by its HTTP status and message. */
export function classify(err: unknown): { kind: "quota" | "transient" | "fatal"; retryAfter: number | null } {
  const e = err as { status?: number | string; code?: number | string; message?: string } | undefined;
  const status = Number(e?.status ?? e?.code);
  const msg = String(e?.message ?? err);
  if (status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg)) {
    const m = /retry in ([\d.]+)s|"retryDelay":"(\d+)s"/i.exec(msg);
    return { kind: "quota", retryAfter: m ? Math.ceil(Number(m[1] ?? m[2])) : null };
  }
  if (status === 503 || status === 500 || /UNAVAILABLE|overloaded/i.test(msg)) return { kind: "transient", retryAfter: null };
  return { kind: "fatal", retryAfter: null };
}

export class GeminiClient implements LlmClient {
  private ai: GoogleGenAI;
  constructor(
    apiKey: string,
    private readonly model = process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    private readonly embedModel = process.env.GEMINI_EMBED_MODEL ??
      "gemini-embedding-001",
    /** Used when the main model's quota is used up (separate quota). "none" disables it. */
    private readonly fallbackModel: string | null = (() => {
      const v = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-flash-lite-latest";
      return v && v !== "none" ? v : null;
    })(),
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async generateJson<T>({
    system,
    user,
    jsonSchema,
    validator,
    temperature = 0,
  }: Parameters<LlmClient["generateJson"]>[0] & {
    validator: z.ZodType<T>;
  }): Promise<T> {
    let lastErr: unknown;
    // Network/server hiccups (503) get up to 5 tries with backoff. An answer that fails
    // validation gets ONE retry: each retry is a billed request, and free-tier keys
    // only allow ~20 per day. Quota errors are never retried here.
    const maxAttempts = 5;
    let invalidOutputs = 0;
    let model = this.model;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let text: string;
      try {
        const res = await this.ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: user }] }],
          config: {
            systemInstruction: system,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        });
        text = res.text ?? "";
      } catch (err) {
        lastErr = err;
        const { kind, retryAfter } = classify(err);
        if (kind === "quota") {
          // 429s aren't billed, so switching to a model with its own quota costs nothing extra.
          if (this.fallbackModel && model !== this.fallbackModel) {
            console.warn(`Gemini quota exceeded for ${model}; retrying with ${this.fallbackModel}`);
            model = this.fallbackModel;
            continue;
          }
          throw new LlmQuotaError(`Gemini quota exceeded for ${model}`, retryAfter);
        }
        if (kind === "transient" && attempt + 1 < maxAttempts) {
          const backoff = Math.pow(2, attempt) * 250 + Math.floor(Math.random() * 100);
          console.warn(`LLM request failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${backoff}ms:`, (err as Error)?.message ?? err);
          await this.sleep(backoff);
          continue;
        }
        if (kind === "transient") throw new LlmUnavailableError(String((err as Error)?.message ?? err));
        // Rejected request (bad key, schema refused, …): not the model's output, so say so.
        throw new LlmOutputError(`Gemini request failed: ${String((err as Error)?.message ?? err).slice(0, 500)}`);
      }

      try {
        const parsed = validator.safeParse(JSON.parse(text));
        if (parsed.success) return parsed.data;
        lastErr = parsed.error;
      } catch (e) {
        lastErr = e;
      }
      if (++invalidOutputs >= 2) break;
    }
    throw new LlmOutputError(`Model output failed schema validation: ${String(lastErr).slice(0, 500)}`);
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.ai.models.embedContent({
      model: this.embedModel,
      contents: text,
      config: { outputDimensionality: 768 },
    });
    const v = res.embeddings?.[0]?.values;
    if (!v) throw new LlmOutputError("No embedding returned");
    return v;
  }
}

let singleton: LlmClient | null = null;

export function getLlm(): LlmClient {
  if (singleton) return singleton;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmUnavailableError();
  singleton = new GeminiClient(key);
  return singleton;
}

export function hasLlm(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) || singleton !== null;
}

/** For tests. */
export function setLlm(c: LlmClient | null) {
  singleton = c;
}
