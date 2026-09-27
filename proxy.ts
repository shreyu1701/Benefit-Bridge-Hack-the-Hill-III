import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * Next.js 16 proxy (formerly middleware). When Auth0 is configured it mounts
 * /auth/login, /auth/callback and /auth/logout and keeps sessions rolling on
 * every page, which is why the matcher is broad (per the @auth0/nextjs-auth0
 * v4 README). Without Auth0 it passes everything through: everyone is a guest.
 */
export async function proxy(request: Request) {
  if (auth0) return auth0.middleware(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
