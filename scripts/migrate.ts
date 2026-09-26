/**
 * Minimal migration runner.
 * Header directives (first lines of a .sql file):
 *   -- requires: <extension>   apply only if the extension is installed
 *   -- unless: <extension>     apply only if the extension is NOT installed
 *   -- no-transaction          run outside BEGIN/COMMIT (needed for continuous aggregates)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { closePool, getPool } from "@/lib/db/pool";

async function main() {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), skipped boolean NOT NULL DEFAULT false)`);
  const dir = path.join(process.cwd(), "db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await pool.query(`SELECT name FROM schema_migrations WHERE NOT skipped`)).rows.map((r) => r.name));

  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(dir, f), "utf8");
    const header = sql.split("\n").filter((l) => l.startsWith("--")).map((l) => l.slice(2).trim());
    const requires = header.find((h) => h.startsWith("requires:"))?.split(":")[1].trim();
    const unless = header.find((h) => h.startsWith("unless:"))?.split(":")[1].trim();
    const noTx = header.includes("no-transaction");
    // Extensions are created by 001; re-check installed state for each file.
    const installed = new Set((await pool.query(`SELECT extname FROM pg_extension`)).rows.map((r) => r.extname));

    if ((requires && !installed.has(requires)) || (unless && installed.has(unless))) {
      console.log(`- skip ${f} (${requires ? `requires ${requires}` : `unless ${unless}`})`);
      await pool.query(`INSERT INTO schema_migrations (name, skipped) VALUES ($1, true) ON CONFLICT (name) DO UPDATE SET skipped = true, applied_at = now()`, [f]);
      continue;
    }

    console.log(`+ apply ${f}`);
    if (noTx) {
      // Continuous aggregates cannot run inside a transaction: run statement by statement.
      for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) {
        await pool.query(stmt);
      }
    } else {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(sql);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw new Error(`${f}: ${(e as Error).message}`);
      } finally {
        c.release();
      }
    }
    await pool.query(`INSERT INTO schema_migrations (name, skipped) VALUES ($1, false) ON CONFLICT (name) DO UPDATE SET skipped = false, applied_at = now()`, [f]);
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
