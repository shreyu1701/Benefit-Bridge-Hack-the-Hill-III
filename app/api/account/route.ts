import { auth0Enabled, getUserSession } from "@/lib/auth0";
import { hasDatabase } from "@/lib/db/pool";
import { deleteAccount } from "@/lib/db/profiles";
import { errorResponse, json } from "@/lib/http";

/** GET: who is signed in (or guest). DELETE: erase the profile, then the user row, then log out. */
export async function GET() {
  try {
    const user = await getUserSession();
    return json({ signedIn: Boolean(user), email: user?.email ?? null, authAvailable: auth0Enabled });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    const user = await getUserSession();
    if (!user) return json({ error: "guest" }, { status: 401 });
    if (hasDatabase()) await deleteAccount(user.sub);
    return json({ deleted: true, logoutUrl: "/auth/logout" });
  } catch (e) {
    return errorResponse(e);
  }
}
