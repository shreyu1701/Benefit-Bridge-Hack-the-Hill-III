import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth";

/**
 * Next.js 16 proxy (formerly middleware). Only mounts Auth0 routes
 * (/auth/login, /auth/callback, /auth/logout) when Auth0 is configured.
 */
export async function proxy(request: Request) {
  if (auth0) return auth0.middleware(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/:path*", "/admin/:path*", "/api/admin/:path*", "/api/saved/:path*"],
};
