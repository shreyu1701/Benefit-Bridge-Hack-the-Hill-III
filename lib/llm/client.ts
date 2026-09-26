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
    private readonly embedModel = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateJson<T>({ system, user, jsonSchema, validator, temperature = 0 }: Parameters<LlmClient["generateJson"]>[0] & { validator: z.ZodType<T> }): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
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
      } catch (e) {
        lastErr = e;
      }
    }
    throw new LlmOutputError(`Model output failed schema validation: ${String(lastErr)}`);
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
