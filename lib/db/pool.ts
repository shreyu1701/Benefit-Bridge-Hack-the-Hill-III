import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * TLS for the database connection, decided here in one place (the `ssl*`
 * URL parameters are removed so `pg` doesn't apply its own, stricter reading):
 *  - DATABASE_CA_CERT set (PEM text) → TLS, certificate verified against that CA
 *    (managed providers with their own CA, e.g. Supabase)
 *  - sslmode=require | verify-ca | verify-full → TLS, verified against public CAs
 *  - sslmode=no-verify → TLS without certificate verification (last resort)
 *  - no sslmode / sslmode=disable, or PGSSLMODE=disable → no TLS (local Docker database)
 */
export function buildPoolConfig(url: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  let connectionString = url;
  let mode: string | null = null;
  try {
    const u = new URL(url);
    mode = u.searchParams.get("sslmode");
    for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(k);
    connectionString = u.toString();
  } catch {
    /* leave malformed URLs to the driver's own error */
  }
  // Env UIs (Vercel, Docker env files) often store a PEM on one line with literal "\n".
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
  let ssl: PoolConfig["ssl"];
  if (env.PGSSLMODE === "disable" || mode === "disable") ssl = undefined;
  else if (ca) ssl = { ca, rejectUnauthorized: true };
  else if (mode === "no-verify") ssl = { rejectUnauthorized: false };
  else if (mode && mode !== "prefer" && mode !== "allow") ssl = { rejectUnauthorized: true };
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
