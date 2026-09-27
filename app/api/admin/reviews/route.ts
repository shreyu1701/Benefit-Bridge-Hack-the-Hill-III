import { requireAdmin } from "@/lib/auth0";
import { listReviews } from "@/lib/db/reviews";
import { errorResponse, json } from "@/lib/http";

/** GET /api/admin/reviews?status=pending — the human review queue. Reviewers only. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const s = new URL(req.url).searchParams.get("status");
    return json(await listReviews(s === "approved" || s === "rejected" ? s : "pending"));
  } catch (e) {
    return errorResponse(e);
  }
}
