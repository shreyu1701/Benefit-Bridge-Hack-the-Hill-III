import { errorResponse, json } from "@/lib/http";
import { loadProgram } from "@/lib/programs-repo";

/** GET /api/programs/:id — the approved program record with its citations and laws. */
export async function GET(_req: Request, ctx: RouteContext<"/api/programs/[id]">) {
  try {
    const { id } = await ctx.params;
    const p = await loadProgram(id);
    return p ? json(p) : json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
