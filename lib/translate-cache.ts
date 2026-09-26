import { createHash } from "node:crypto";
import { getLlm, hasLlm } from "@/lib/llm/client";
import { translate } from "@/lib/llm/tasks";

/**
 * Machine translation of verified English text into the user's language,
 * with an in-memory LRU-ish cache. Only static program/UI text is cached —
 * never anything the user typed.
 */
const cache = new Map<string, string>();
const MAX = 5000;
const key = (lang: string, s: string) => createHash("sha1").update(lang + "\u0000" + s).digest("base64");

export async function translateMany(texts: string[], lang: string): Promise<string[] | null> {
  if (!hasLlm()) return null;
  const out: (string | undefined)[] = texts.map((s) => cache.get(key(lang, s)));
  const missingIdx = out.map((v, i) => (v === undefined ? i : -1)).filter((i) => i >= 0);
  if (missingIdx.length) {
    // Batch to keep prompts small.
    for (let i = 0; i < missingIdx.length; i += 40) {
      const chunk = missingIdx.slice(i, i + 40);
      const res = await translate(getLlm(), chunk.map((j) => texts[j]), lang);
      chunk.forEach((j, n) => {
        out[j] = res[n];
        if (cache.size > MAX) cache.delete(cache.keys().next().value!);
        cache.set(key(lang, texts[j]), res[n]);
      });
    }
  }
  return out as string[];
}
