import { z } from "zod";

/**
 * Convert a Zod schema into the JSON Schema subset Gemini accepts as
 * `responseJsonSchema`. The Zod schema stays the single source of truth; this
 * only reshapes the output of `z.toJSONSchema`:
 *  - drops keywords outside Gemini's supported set (e.g. `$schema`, `maxLength`)
 *  - rewrites `type: ["boolean", "null"]` as `anyOf: [{type:"boolean"},{type:"null"}]`
 * Zod still re-validates every response, so dropped constraints are enforced there.
 */
const SUPPORTED = new Set([
  "type", "enum", "format", "title", "description", "properties", "additionalProperties",
  "required", "items", "minItems", "maxItems", "minimum", "maximum", "anyOf", "prefixItems",
]);

type Json = Record<string, unknown>;

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const src = node as Json;
  const out: Json = {};
  for (const [k, v] of Object.entries(src)) {
    if (!SUPPORTED.has(k)) continue;
    if (k === "properties") {
      out.properties = Object.fromEntries(Object.entries(v as Json).map(([p, sub]) => [p, clean(sub)]));
    } else if (k === "additionalProperties") {
      out.additionalProperties = typeof v === "object" ? clean(v) : v;
    } else {
      out[k] = clean(v);
    }
  }
  if (Array.isArray(out.type)) {
    const { type, ...rest } = out;
    return { anyOf: (type as string[]).map((t) => ({ ...rest, type: t })) };
  }
  return out;
}

export function toGeminiSchema(schema: z.ZodType): Json {
  return clean(z.toJSONSchema(schema, { target: "draft-7", io: "input" })) as Json;
}
