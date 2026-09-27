import { describe, expect, it } from "vitest";
import { buildPoolConfig, parseCaCerts, resolveDbTls } from "@/lib/db/pool";
import { SUPABASE_ROOT_CA_2021, isSupabaseHost } from "@/lib/db/supabase-ca";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
const SUPABASE_POOLER = "postgresql://postgres.abcd:pw@aws-1-ca-central-1.pooler.supabase.com:6543/postgres";

describe("database TLS settings", () => {
  it("local Docker database: no TLS", () => {
    expect(buildPoolConfig("postgres://u:p@db:5432/x", {}).ssl).toBeUndefined();
  });

  it("Supabase with NO extra settings: verified against the bundled Supabase root CA (the production fix)", () => {
    for (const url of [SUPABASE_POOLER + "?sslmode=require", SUPABASE_POOLER, "postgresql://postgres:pw@db.abcd.supabase.co:5432/postgres"]) {
      const t = resolveDbTls(url, {});
      expect(t.ssl).toEqual({ ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true });
      expect(t.describe).toBe("TLS, verified against bundled Supabase root CA");
      expect(t.connectionString).not.toContain("sslmode");
    }
  });

  it("the bundled CA is the real Supabase Root 2021 CA", () => {
    expect(SUPABASE_ROOT_CA_2021).toMatch(/^-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+\n-----END CERTIFICATE-----$/);
  });

  it("only real Supabase hosts get the Supabase CA", () => {
    expect(isSupabaseHost("aws-0-ca-central-1.pooler.supabase.com")).toBe(true);
    expect(isSupabaseHost("db.abcd.supabase.co")).toBe(true);
    expect(isSupabaseHost("evilsupabase.com")).toBe(false);
    expect(isSupabaseHost("supabase.com.evil.net")).toBe(false);
  });

  it("sslmode=require on other hosts: verified against public CAs, sslmode removed from the URL", () => {
    const c = buildPoolConfig("postgres://u:p@host.example:5432/x?sslmode=require", {});
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.connectionString).toBe("postgres://u:p@host.example:5432/x");
  });

  it("DATABASE_CA_CERT survives how env UIs mangle it (quotes, literal \\n, CRLF)", () => {
    expect(parseCaCerts(PEM)).toEqual([PEM]);
    expect(parseCaCerts(`"${PEM.replace(/\n/g, "\\n")}"`)).toEqual([PEM]);
    expect(parseCaCerts(PEM.replace(/\n/g, "\r\n"))).toEqual([PEM]);
    expect(parseCaCerts(`${PEM}\n${PEM}`)).toHaveLength(2);
  });

  it("DATABASE_CA_CERT is used alongside the bundled CA for Supabase", () => {
    const t = resolveDbTls(SUPABASE_POOLER, { DATABASE_CA_CERT: PEM });
    expect(t.ssl).toEqual({ ca: [PEM, SUPABASE_ROOT_CA_2021], rejectUnauthorized: true });
  });

  it("a DATABASE_CA_CERT with no certificate in it is ignored with a warning (Supabase still works)", () => {
    const t = resolveDbTls(SUPABASE_POOLER, { DATABASE_CA_CERT: "prod-ca-2021.crt" });
    expect(t.ssl).toEqual({ ca: [SUPABASE_ROOT_CA_2021], rejectUnauthorized: true });
    expect(t.warnings[0]).toMatch(/no -----BEGIN CERTIFICATE-----/);
  });

  it("no-verify is an explicit opt-out; disable wins over everything", () => {
    expect(resolveDbTls("postgres://u:p@h/x?sslmode=no-verify", {}).ssl).toEqual({ rejectUnauthorized: false });
    expect(buildPoolConfig(SUPABASE_POOLER + "?sslmode=require", { PGSSLMODE: "disable", DATABASE_CA_CERT: PEM }).ssl).toBeUndefined();
  });

  it("pool size comes from PG_POOL_MAX (small on Vercel)", () => {
    expect(buildPoolConfig("postgres://u:p@h/x", { PG_POOL_MAX: "3" }).max).toBe(3);
  });
});
