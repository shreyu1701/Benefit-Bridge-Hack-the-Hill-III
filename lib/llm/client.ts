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

export class GeminiClient implements LlmClient {
  private ai: GoogleGenAI;
  constructor(
    apiKey: string,
    private readonly model = process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    private readonly embedModel = process.env.GEMINI_EMBED_MODEL ??
      "gemini-embedding-001",
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
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await this.ai.models.generateContent({
          model: this.model,
          contents: [{ role: "user", parts: [{ text: user }] }],
          config: {
            systemInstruction: system,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        });

        try {
          const parsed = validator.safeParse(JSON.parse(res.text ?? ""));
          if (parsed.success) return parsed.data;
          lastErr = parsed.error;
          // If the model returned an unparsable/invalid payload, do one more quick retry
          if (attempt + 1 < maxAttempts) {
            await this.sleep(200 * (attempt + 1));
            continue;
          }
          break;
        } catch (e) {
          lastErr = e;
          if (attempt + 1 < maxAttempts) {
            await this.sleep(200 * (attempt + 1));
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastErr = err;
        // Detect transient/503/unavailable errors and retry with exponential backoff
        const status =
          err?.status ||
          err?.code ||
          (typeof err === "string" && err.match(/503|UNAVAILABLE/));
        const isTransient = Boolean(
          status === 503 ||
          String(status).toUpperCase().includes("UNAVAILABLE") ||
          /503/.test(String(status)),
        );
        if (isTransient && attempt + 1 < maxAttempts) {
          const backoff =
            Math.pow(2, attempt) * 250 + Math.floor(Math.random() * 100);
          // eslint-disable-next-line no-console
          console.warn(
            `LLM request failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${backoff}ms:`,
            err?.message ?? err,
          );
          await this.sleep(backoff);
          continue;
        }
        // If it's a persistent/unavailable error, surface as LlmUnavailableError so HTTP layer returns 503
        if (isTransient) {
          throw new LlmUnavailableError(String(err?.message ?? err));
        }
        // Non-transient or no attempts left — break and throw below
        break;
      }
    }
    throw new LlmOutputError(
      `Model output failed schema validation or the request failed: ${String(lastErr)}`,
    );
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
