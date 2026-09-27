import { requireAdmin } from "@/lib/auth0";
import { listImpacts, type ImpactStatus } from "@/lib/db/bill-impacts";
import { errorResponse, json } from "@/lib/http";

const STATUSES: ImpactStatus[] = ["pending", "approved", "rejected", "not_relevant"];

/** GET /api/admin/bill-impacts?status=pending — drafts of who each bill affects. Reviewers only. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const s = new URL(req.url).searchParams.get("status") as ImpactStatus | null;
    return json(await listImpacts(s && STATUSES.includes(s) ? s : "pending"));
  } catch (e) {
    return errorResponse(e);
  }
}
