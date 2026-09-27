import { z } from "zod";
import { requireAdmin } from "@/lib/auth0";
import { approveImpact, ImpactError, rejectImpact } from "@/lib/db/bill-impacts";
import { errorResponse, json } from "@/lib/http";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), edit: z.unknown().optional(), notes: z.string().max(4000).optional() }),
  z.object({ action: z.literal("reject"), notes: z.string().max(4000).optional() }),
]);

/**
 * POST /api/admin/bill-impacts/:billId { action: "approve", edit?, notes? } | { action: "reject", notes? }
 * Approval is the only way a bill appears in anyone's results. Edits are re-validated server-side.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/bill-impacts/[id]">) {
  try {
    const actor = await requireAdmin();
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) return json({ error: "bad_id" }, { status: 400 });
    const body = Body.parse(await req.json());
    const reviewer = actor.email ?? actor.id;
    return json(
      body.action === "approve"
        ? await approveImpact(id, reviewer, { edit: body.edit, notes: body.notes })
        : await rejectImpact(id, reviewer, body.notes),
    );
  } catch (e) {
    if (e instanceof ImpactError) return json({ error: "impact_rejected", errors: e.errors }, { status: 422 });
    return errorResponse(e);
  }
}
