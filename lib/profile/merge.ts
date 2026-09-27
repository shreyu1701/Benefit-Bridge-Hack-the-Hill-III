import { emptyProfile, PROFILE_KEYS, type Profile, type ProfileKey } from "./schema";

/**
 * Compare a saved profile with the facts extracted from what the person just
 * said. Pure and deterministic, so the confirm screen can show where every
 * value came from and ask about each disagreement instead of silently picking one.
 */
export type FactSource = "profile" | "said";

export interface FactConflict {
  fact: ProfileKey;
  profile_value: Profile[ProfileKey];
  said_value: Profile[ProfileKey];
}

export interface FactDiff {
  /** What the check will run on. Conflicts default to what they just said (the newest statement). */
  merged: Profile;
  /** Where each non-null merged value came from. */
  sources: Partial<Record<ProfileKey, FactSource>>;
  /** Facts the profile didn't have that they mentioned now. */
  new: ProfileKey[];
  /** Mentioned now and the same as the profile. */
  agreed: ProfileKey[];
  conflicts: FactConflict[];
}

function normalize(key: ProfileKey, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (key === "city" && typeof v === "string") return v.trim().toLowerCase();
  if (key === "children_ages" && Array.isArray(v)) return [...v].sort((a, b) => a - b);
  if (key === "years_in_canada" && typeof v === "number") return Math.round(v * 10) / 10;
  return v;
}

export function sameValue(key: ProfileKey, a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(key, a)) === JSON.stringify(normalize(key, b));
}

export function diffFacts(profile: Partial<Profile> | null | undefined, said: Profile): FactDiff {
  const base = { ...emptyProfile(), ...(profile ?? {}) };
  const merged = emptyProfile() as Record<ProfileKey, unknown>;
  const sources: FactDiff["sources"] = {};
  const out: FactDiff = { merged: merged as Profile, sources, new: [], agreed: [], conflicts: [] };

  for (const k of PROFILE_KEYS) {
    const p = base[k];
    const s = said[k];
    if (s === null) {
      merged[k] = p;
      if (p !== null) sources[k] = "profile";
    } else if (p === null) {
      merged[k] = s;
      sources[k] = "said";
      out.new.push(k);
    } else if (sameValue(k, p, s)) {
      merged[k] = p;
      sources[k] = "profile";
      out.agreed.push(k);
    } else {
      merged[k] = s;
      sources[k] = "said";
      out.conflicts.push({ fact: k, profile_value: p, said_value: s });
    }
  }
  return out;
}
