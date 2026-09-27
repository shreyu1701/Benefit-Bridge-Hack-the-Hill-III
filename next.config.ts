import type { NextConfig } from "next";

/**
 * Security headers for every response. On Vultr, Caddy sets similar ones
 * (deploy/Caddyfile); on Vercel these are the only ones, so they live here.
 * A full Content-Security-Policy is left out on purpose: Next.js injects inline
 * scripts, and a strict CSP needs nonces wired through the app first.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone is used for voice input on this site only; nothing else.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
  // No framing by other sites (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
