import { requireAdmin } from "@/lib/auth0";
import { listDraftRequests, requestDraft } from "@/lib/db/program-drafts";
import { errorResponse, json } from "@/lib/http";

/** GET /api/admin/program-drafts — recent requests to draft a new program. Reviewers only. */
export async function GET() {
  try {
    await requireAdmin();
    return json(await listDraftRequests());
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/admin/program-drafts { url, jurisdiction } — queue a new program to be drafted
 * from an official page. The draft stays invisible until its first review is approved.
 */
export async function POST(req: Request) {
  try {
    const actor = await requireAdmin();
    return json(await requestDraft(await req.json(), actor.email ?? actor.id), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
