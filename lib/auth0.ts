import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { cookies, headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";

/**
 * Auth is OPTIONAL. It is only used to save a profile across visits and for
 * admin reviewer accounts. Nothing forces a login: no session = guest, and a
 * guest's profile lives only in their browser tab.
 *
 * Sign-in goes straight to Google through Auth0 (GOOGLE_LOGIN_URL skips the
 * Auth0 login screen). Reviewers are the verified emails in ADMIN_EMAILS.
 * Local development without Auth0: set ADMIN_TOKEN and send it as the
 * `x-admin-token` header or `bb_admin` cookie. It is ignored in production.
 */
const AUTH0_VARS = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;
const missingAuth0Vars = AUTH0_VARS.filter((k) => !process.env[k]?.trim());

export const auth0Enabled = missingAuth0Vars.length === 0;

// Some but not all set is almost always a deployment mistake (e.g. a variable added only
// to Vercel's Preview environment). Log the NAMES only, never values.
if (missingAuth0Vars.length > 0 && missingAuth0Vars.length < AUTH0_VARS.length) {
  console.warn(`Auth0 sign-in is OFF: missing ${missingAuth0Vars.join(", ")}. Everyone is a guest until all four are set.`);
}

export const auth0 = auth0Enabled
  ? new Auth0Client({ authorizationParameters: { scope: "openid profile email" } })
  : null;

/** Auth0's name for its Google social connection. */
export const GOOGLE_CONNECTION = process.env.AUTH0_GOOGLE_CONNECTION ?? "google-oauth2";

/** The SDK forwards login query params to Auth0, so `connection` goes straight to Google. */
export function googleLoginUrl(returnTo = "/onboarding"): string {
  return `/auth/login?${new URLSearchParams({ connection: GOOGLE_CONNECTION, returnTo })}`;
}

export interface SignedInUser {
  sub: string;
  email: string | null;
  name: string | null;
}

/** The signed-in user, or null for a guest (including when Auth0 isn't configured). */
export async function getUserSession(): Promise<SignedInUser | null> {
  if (!auth0) return null;
  const session = await auth0.getSession();
  if (!session) return null;
  return {
    sub: session.user.sub,
    email: (session.user.email as string | undefined)?.toLowerCase() ?? null,
    name: (session.user.name as string | undefined) ?? null,
  };
}

export interface Actor {
  id: string; // stable subject
  email: string | null;
  isAdmin: boolean;
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function currentActor(): Promise<Actor | null> {
  if (auth0) {
    const session = await auth0.getSession();
    if (!session) return null;
    const email = (session.user.email as string | undefined)?.toLowerCase() ?? null;
    const verified = session.user.email_verified !== false;
    return { id: session.user.sub, email, isAdmin: Boolean(email && verified && adminEmails().includes(email)) };
  }
  const token = process.env.ADMIN_TOKEN;
  if (token && process.env.NODE_ENV !== "production") {
    const provided = (await headers()).get("x-admin-token") ?? (await cookies()).get("bb_admin")?.value;
    if (provided && safeEq(provided, token)) return { id: "dev-admin", email: null, isAdmin: true };
  }
  return null;
}

export async function requireAdmin(): Promise<Actor> {
  const a = await currentActor();
  if (!a?.isAdmin) throw new AuthError(a ? 403 : 401);
  return a;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Sign in required" : "Not a reviewer");
  }
}
