import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
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

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      ssl: process.env.PGSSLMODE === "disable" ? undefined : process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: true } : undefined,
    });
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
