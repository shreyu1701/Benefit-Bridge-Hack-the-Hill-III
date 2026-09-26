import { listBills } from "@/lib/bills-repo";
import { errorResponse, json } from "@/lib/http";

/** GET /api/bills?jurisdiction=CA|ON&limit=50 — current-session bills, most recent activity first. */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const j = u.searchParams.get("jurisdiction");
    const limit = Math.min(200, Math.max(1, Number(u.searchParams.get("limit") ?? 50)));
    return json(await listBills({ jurisdiction: j === "CA" || j === "ON" ? j : undefined, limit }));
  } catch (e) {
    return errorResponse(e);
  }
}
