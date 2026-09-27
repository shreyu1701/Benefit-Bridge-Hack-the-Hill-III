import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";
import { isSupabaseHost, SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Pull every PEM certificate out of DATABASE_CA_CERT, tolerating how env UIs
 * mangle multi-line values: surrounding quotes, literal "\n", Windows line endings.
 */
export function parseCaCerts(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const text = raw.trim().replace(/^["']|["']$/g, "").replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r/g, "");
  return text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}

export interface DbTls {
  ssl: PoolConfig["ssl"];
  /** Human-readable summary for logs (never includes secrets). */
  describe: string;
  warnings: string[];
}

/**
 * TLS for the database connection, decided here and only here. The `ssl*` URL
 * parameters are removed so `pg` doesn't apply its own reading of them (which
 * verifies against public CAs only and fails on Supabase with
 * SELF_SIGNED_CERT_IN_CHAIN).
 *
 *  - sslmode=disable or PGSSLMODE=disable → no TLS
 *  - sslmode=no-verify                   → TLS, certificate NOT verified (explicit opt-out)
 *  - a CA is known → TLS, verified against it:
 *      · DATABASE_CA_CERT (any provider with its own CA), and/or
 *      · the bundled Supabase root CA, automatically for *.supabase.com / *.supabase.co
 *  - other sslmode (require, verify-*)   → TLS, verified against the public CAs
 *  - nothing                             → no TLS (local Docker database)
 */
export function resolveDbTls(url: string, env: Record<string, string | undefined> = process.env): DbTls & { connectionString: string } {
  let connectionString = url;
  let mode: string | null = null;
  let host = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    mode = u.searchParams.get("sslmode");
    for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(k);
    connectionString = u.toString();
  } catch {
    /* leave malformed URLs to the driver's own error */
  }

  const warnings: string[] = [];
  const userCas = parseCaCerts(env.DATABASE_CA_CERT);
  if (env.DATABASE_CA_CERT?.trim() && userCas.length === 0) {
    warnings.push("DATABASE_CA_CERT is set but contains no -----BEGIN CERTIFICATE----- block; it was ignored.");
  }
  const supabase = isSupabaseHost(host);
  const cas = [...userCas, ...(supabase ? [SUPABASE_ROOT_CA_2021] : [])];

  if (env.PGSSLMODE === "disable" || mode === "disable") {
    return { connectionString, ssl: undefined, describe: "no TLS (disabled)", warnings };
  }
  if (mode === "no-verify") {
    warnings.push("sslmode=no-verify: the database certificate is NOT verified.");
    return { connectionString, ssl: { rejectUnauthorized: false }, describe: "TLS, not verified", warnings };
  }
  if (cas.length) {
    const from = [userCas.length ? "DATABASE_CA_CERT" : "", supabase ? "bundled Supabase root CA" : ""].filter(Boolean).join(" + ");
    return { connectionString, ssl: { ca: cas, rejectUnauthorized: true }, describe: `TLS, verified against ${from}`, warnings };
  }
  if (mode && mode !== "prefer" && mode !== "allow") {
    return { connectionString, ssl: { rejectUnauthorized: true }, describe: "TLS, verified against public CAs", warnings };
  }
  return { connectionString, ssl: undefined, describe: "no TLS", warnings };
}

export function buildPoolConfig(url: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  const { connectionString, ssl } = resolveDbTls(url, env);
  return { connectionString, ssl, max: Number(env.PG_POOL_MAX ?? 10) };
}

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

    // Validate common placeholder mistakes (e.g. DATABASE_URL from .env.example)
    try {
      const u = new URL(process.env.DATABASE_URL);
      const host = u.hostname;
      if (!host || host === "host" || host === "your-host" || host === "db-host") {
        throw new Error(
          `DATABASE_URL appears to contain a placeholder hostname ('${host}'). Please set DATABASE_URL to a real Postgres URL (see .env.example).`,
        );
      }
    } catch (e) {
      // If URL parsing fails, still surface a helpful error instead of letting the underlying driver emit ENOTFOUND.
      if (e instanceof Error && /placeholder hostname/.test(e.message)) throw e;
      // fall through and let pg driver report parse/connect errors for truly malformed URLs
    }

    // Say once, in the server log, how the connection is secured (visible in Vercel → Logs).
    const tls = resolveDbTls(process.env.DATABASE_URL);
    console.info(`Database connection: ${tls.describe}`);
    for (const w of tls.warnings) console.warn(`Database connection: ${w}`);
    pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool?.end();
  pool = null;
}
