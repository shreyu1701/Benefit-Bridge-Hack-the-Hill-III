/**
 * Ingestion worker — a separate long-running process (`npm run worker`).
 *
 *   Tier 1 (real-time, automatic):  LEGISinfo every 30 min, ola.org every 60 min, Gazette RSS hourly
 *                                   + hourly drafts of who each bill affects (→ reviewer queue)
 *   Tier 2 (human-approved):        program pages checked every 6–24 h (per page), changes → review queue
 *   Tier 3 (reference):             laws + open datasets weekly, or right after a royal assent
 *
 * A Postgres advisory lock guarantees only one worker runs jobs at a time, so
 * it is safe to run a standby replica. `--once` runs every job once and exits
 * (useful for cron-based hosting and for smoke tests).
 */
import { TIER1, TIER3 } from "@/data/sources";
import { closePool, getPool, query } from "@/lib/db/pool";
import { billImpactsJob, billSummariesJob, gazetteJob, programDraftsJob, legisinfoJob, ontarioBillsJob, pageWatchJob, referenceLawsJob } from "./jobs";

interface Job {
  name: string;
  everyMinutes: number;
  run: () => Promise<unknown>;
}

const JOBS: Job[] = [
  { name: "legisinfo", everyMinutes: TIER1.legisinfo.intervalMinutes, run: legisinfoJob },
  { name: "ontario-bills", everyMinutes: TIER1.ontarioBills.intervalMinutes, run: ontarioBillsJob },
  { name: "gazette", everyMinutes: TIER1.gazette.intervalMinutes, run: gazetteJob },
  { name: "bill-summaries", everyMinutes: 30, run: () => billSummariesJob() },
  // Drafts "who does this bill affect" for reviewers; shown in results only after approval.
  { name: "bill-impacts", everyMinutes: 60, run: () => billImpactsJob() },
  // New programs a reviewer asked for, drafted from the official page (hidden until approved).
  { name: "program-drafts", everyMinutes: 15, run: () => programDraftsJob() },
  // Page watch itself decides which pages are due (per-page interval); tick every 15 min.
  { name: "page-watch", everyMinutes: 15, run: pageWatchJob },
  { name: "reference-laws", everyMinutes: TIER3.intervalHours * 60, run: () => referenceLawsJob() },
];

const LOCK_KEY = 0x62627772; // "bbwr"

async function runJob(job: Job) {
  await query(`INSERT INTO job_runs (job, last_run_at) VALUES ($1, now()) ON CONFLICT (job) DO UPDATE SET last_run_at = now()`, [job.name]);
  try {
    await job.run();
    await query(`UPDATE job_runs SET last_ok_at = now(), last_error = NULL WHERE job = $1`, [job.name]);
  } catch (e) {
    console.error(`[${job.name}] failed:`, e);
    await query(`UPDATE job_runs SET last_error = $2 WHERE job = $1`, [job.name, String((e as Error).message ?? e).slice(0, 2000)]);
  }
}

async function dueJobs(): Promise<Job[]> {
  const rows = await query<{ job: string; last_run_at: Date | null }>(`SELECT job, last_run_at FROM job_runs`);
  const last = new Map(rows.map((r) => [r.job, r.last_run_at]));
  return JOBS.filter((j) => {
    const t = last.get(j.name);
    return !t || Date.now() - t.getTime() >= j.everyMinutes * 60_000;
  });
}

async function main() {
  const once = process.argv.includes("--once");
  // The advisory lock is session-scoped, so hold one dedicated connection for the process lifetime.
  const client = await getPool().connect();
  const tryLock = async () => (await client.query(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK_KEY])).rows[0].ok as boolean;
  let held = await tryLock();

  if (once) {
    if (held) for (const j of JOBS) await runJob(j);
    else console.log("Another worker holds the lock; nothing to do.");
    client.release();
    return closePool();
  }

  let stopping = false;
  const stop = () => (stopping = true);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    if (!held) held = await tryLock(); // standby replica takes over if the active worker dies
    if (held) {
      for (const j of await dueJobs()) {
        if (stopping) break;
        await runJob(j);
      }
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
  client.release();
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
