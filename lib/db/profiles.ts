import { decryptJson, encryptJson } from "@/lib/crypto";
import { parseProfile, type Profile } from "@/lib/profile/schema";
import { query, withTransaction } from "./pool";

/** Stored accounts and profiles. Profiles are encrypted at rest and re-validated on read. */

export async function upsertUser(auth0Id: string, email: string | null): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO users (auth0_id, email) VALUES ($1, $2)
     ON CONFLICT (auth0_id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
     RETURNING id`,
    [auth0Id, email],
  );
  return rows[0].id;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const rows = await query<{ encrypted_data: Buffer; iv: Buffer }>(
    `SELECT encrypted_data, iv FROM profiles WHERE user_id = $1`,
    [userId],
  );
  if (!rows[0]) return null;
  return parseProfile(decryptJson(rows[0].encrypted_data, rows[0].iv));
}

export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const { data, iv } = encryptJson(parseProfile(profile));
  await query(
    `INSERT INTO profiles (user_id, encrypted_data, iv, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET encrypted_data = $2, iv = $3, updated_at = now()`,
    [userId, data, iv],
  );
}

/** Delete the profile row, then the user row, in one transaction. Returns whether a user existed. */
export async function deleteAccount(auth0Id: string): Promise<boolean> {
  return withTransaction(async (c) => {
    const u = await c.query<{ id: string }>(`SELECT id FROM users WHERE auth0_id = $1 FOR UPDATE`, [auth0Id]);
    if (!u.rows[0]) return false;
    await c.query(`DELETE FROM profiles WHERE user_id = $1`, [u.rows[0].id]);
    await c.query(`DELETE FROM users WHERE id = $1`, [u.rows[0].id]);
    return true;
  });
}
