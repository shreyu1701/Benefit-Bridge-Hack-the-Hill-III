"use client";

import { parseProfile, type Profile } from "./schema";

/**
 * Where a person's profile lives:
 *  - signed in: the encrypted profiles table, through /api/profile
 *  - guest: this browser tab only (sessionStorage), gone when the tab closes
 * Every read is re-validated with the one ProfileSchema.
 */
const GUEST_KEY = "bb.profile";

export interface ProfileState {
  signedIn: boolean;
  authAvailable: boolean;
  email: string | null;
  profile: Profile | null;
}

function readGuest(): Profile | null {
  try {
    const raw = sessionStorage.getItem(GUEST_KEY);
    return raw ? parseProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeGuest(p: Profile) {
  try {
    sessionStorage.setItem(GUEST_KEY, JSON.stringify(p));
  } catch {
    /* storage disabled: the profile still works for this page */
  }
}

export async function loadProfileState(): Promise<ProfileState> {
  let account = { signedIn: false, email: null as string | null, authAvailable: false };
  try {
    const r = await fetch("/api/account", { cache: "no-store" });
    if (r.ok) account = await r.json();
  } catch {
    /* offline or no server: treat as guest */
  }
  if (!account.signedIn) return { ...account, profile: readGuest() };
  const r = await fetch("/api/profile", { cache: "no-store" });
  const profile = r.ok ? ((await r.json()).profile as Profile | null) : null;
  return { ...account, profile: profile ? parseProfile(profile) : null };
}

/** Save for a signed-in user (server) or a guest (this tab). Throws if the server rejects it. */
export async function saveProfileState(signedIn: boolean, profile: Profile): Promise<void> {
  const valid = parseProfile(profile);
  if (!signedIn) return writeGuest(valid);
  const r = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: valid }),
  });
  if (!r.ok) throw new Error("Could not save your profile");
}

export function clearGuestProfile() {
  try {
    sessionStorage.removeItem(GUEST_KEY);
  } catch {}
}
