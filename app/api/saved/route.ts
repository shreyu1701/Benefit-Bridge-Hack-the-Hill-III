import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { hasDatabase, query } from "@/lib/db/pool";
import { FactsSchema } from "@/lib/facts/schema";
import { errorResponse, json } from "@/lib/http";

/**
 * Opt-in saved results. Only the structured facts are stored — encrypted —
 * never the free-text description or audio. Requires sign-in.
 */
export async function GET() {
  try {
    const actor = await currentActor();
    if (!actor || actor.id === "dev-admin") return json({ error: "sign_in_required" }, { status: 401 });
    if (!hasDatabase()) return json([]);
    const rows = await query<{ id: string; ciphertext: Buffer; iv: Buffer; auth_tag: Buffer; created_at: string }>(
      `SELECT id, ciphertext, iv, auth_tag, created_at FROM saved_results WHERE user_sub = $1 ORDER BY created_at DESC LIMIT 20`,
      [actor.id],
    );
    return json(rows.map((r) => ({ id: r.id, created_at: r.created_at, facts: decryptJson(r.ciphertext, r.iv, r.auth_tag) })));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await currentActor();
    if (!actor || actor.id === "dev-admin") return json({ error: "sign_in_required" }, { status: 401 });
    const facts = FactsSchema.parse(z.object({ facts: z.unknown() }).parse(await req.json()).facts);
    const enc = encryptJson(facts);
    const rows = await query<{ id: string }>(
      `INSERT INTO saved_results (user_sub, ciphertext, iv, auth_tag) VALUES ($1,$2,$3,$4) RETURNING id`,
      [actor.id, enc.ciphertext, enc.iv, enc.tag],
    );
    return json({ id: rows[0].id });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/saved — erase everything saved for this account. */
export async function DELETE() {
  try {
    const actor = await currentActor();
    if (!actor || actor.id === "dev-admin") return json({ error: "sign_in_required" }, { status: 401 });
    await query(`DELETE FROM saved_results WHERE user_sub = $1`, [actor.id]);
    return json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
