import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { cookies, headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";

/**
 * Auth is OPTIONAL and only used for: saving results (opt-in) and admin
 * reviewer accounts. Browsing and matching never require an account.
 *
 * Production: Auth0 Universal Login with the passwordless email connection
 * (AUTH0_CONNECTION=email). Reviewers are listed in ADMIN_EMAILS.
 * Local development without Auth0: set ADMIN_TOKEN and send it as the
 * `x-admin-token` header or `bb_admin` cookie. Never set ADMIN_TOKEN in production.
 */
export const auth0Enabled = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID);

export const auth0 = auth0Enabled
  ? new Auth0Client({
      authorizationParameters: {
        scope: "openid profile email",
        ...(process.env.AUTH0_CONNECTION ? { connection: process.env.AUTH0_CONNECTION } : {}),
      },
    })
  : null;

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
