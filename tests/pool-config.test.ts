import { describe, expect, it } from "vitest";
import { buildPoolConfig } from "@/lib/db/pool";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

describe("database TLS settings", () => {
  it("local Docker database: no TLS", () => {
    expect(buildPoolConfig("postgres://u:p@db:5432/x").ssl).toBeUndefined();
  });

  it("sslmode=require: TLS verified against public CAs, and sslmode is removed from the URL", () => {
    const c = buildPoolConfig("postgres://u:p@host.example:5432/x?sslmode=require", {});
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.connectionString).toBe("postgres://u:p@host.example:5432/x");
  });

  it("provider CA (e.g. Supabase): verified against that CA; \n escapes from env UIs are restored", () => {
    const c = buildPoolConfig("postgres://u:p@h:6543/x?sslmode=require", { DATABASE_CA_CERT: PEM.replace(/\n/g, "\n") });
    expect(c.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("no-verify is an explicit opt-out; disable wins over everything", () => {
    expect(buildPoolConfig("postgres://u:p@h/x?sslmode=no-verify", {}).ssl).toEqual({ rejectUnauthorized: false });
    expect(buildPoolConfig("postgres://u:p@h/x?sslmode=require", { PGSSLMODE: "disable", DATABASE_CA_CERT: PEM }).ssl).toBeUndefined();
  });

  it("pool size comes from PG_POOL_MAX (small on Vercel)", () => {
    expect(buildPoolConfig("postgres://u:p@h/x", { PG_POOL_MAX: "3" }).max).toBe(3);
  });
});
