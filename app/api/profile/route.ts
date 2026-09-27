import { getUserSession } from "@/lib/auth0";
import { hasDatabase } from "@/lib/db/pool";
import { getProfile, saveProfile, upsertUser } from "@/lib/db/profiles";
import { hasEncryptionKey } from "@/lib/crypto";
import { errorResponse, json } from "@/lib/http";
import { ProfileSchema } from "@/lib/profile/schema";

/**
 * Signed-in users' saved profile (encrypted at rest). Guests get 401 and keep
 * their profile in the browser tab instead. Both directions are validated with
 * the one ProfileSchema.
 */
async function signedInUserId() {
  const user = await getUserSession();
  if (!user) return null;
  if (!hasDatabase() || !hasEncryptionKey()) throw new Error("Profile storage is not configured (DATABASE_URL, PROFILE_ENCRYPTION_KEY)");
  return upsertUser(user.sub, user.email);
}

export async function GET() {
  try {
    const userId = await signedInUserId();
    if (!userId) return json({ error: "guest" }, { status: 401 });
    return json({ profile: await getProfile(userId) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await signedInUserId();
    if (!userId) return json({ error: "guest" }, { status: 401 });
    const profile = ProfileSchema.parse((await req.json())?.profile);
    await saveProfile(userId, profile);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
