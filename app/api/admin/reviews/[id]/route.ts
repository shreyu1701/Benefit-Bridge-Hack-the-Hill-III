import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { approveReview, rejectReview, ReviewError } from "@/lib/db/reviews";
import { errorResponse, json } from "@/lib/http";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), rules: z.unknown().optional(), notes: z.string().max(4000).optional() }),
  z.object({ action: z.literal("reject"), notes: z.string().max(4000).optional() }),
]);

/**
 * POST /api/admin/reviews/:id { action: "approve", rules?, notes? } | { action: "reject", notes? }
 * Approval is the ONLY path by which eligibility rules change.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/reviews/[id]">) {
  try {
    const actor = await requireAdmin();
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return json({ error: "bad_id" }, { status: 400 });
    const body = Body.parse(await req.json());
    const reviewer = actor.email ?? actor.id;
    const result =
      body.action === "approve"
        ? await approveReview(id, reviewer, { rules: body.rules, notes: body.notes })
        : await rejectReview(id, reviewer, body.notes);
    return json(result);
  } catch (e) {
    if (e instanceof ReviewError) return json({ error: "review_rejected", errors: e.errors }, { status: 422 });
    return errorResponse(e);
  }
}
