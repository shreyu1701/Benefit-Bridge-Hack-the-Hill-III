Overview

This document maps the data ingestion pipeline described in the architecture diagram to the repository code, explains scheduling and responsibilities, and lists recommended short-term improvements.

Pipeline components & code mapping

- Bill feeds (every ~15–60 minutes)
  - Code: `lib/ingest/bills.ts`
  - Worker: `worker/jobs.ts` (schedules/dispatch)
  - Purpose: fetch government bill feeds, parse updates, enqueue status updates.

- Program pages (every ~6–24 hours)
  - Code: `lib/ingest/page-extract.ts`, `lib/ingest/page-watch.ts`, `lib/ingest/ontario-bills.ts`, `lib/ingest/legisinfo.ts`
  - Purpose: fetch program pages, extract structured fields, compute diffs for review.

- Laws and open data (weekly)
  - Code: `lib/ingest/gazette.ts`, `lib/ingest/legisinfo.ts`
  - Purpose: load acts and reference datasets used for validation and linking.

- Status updater / Change detector
  - Status updater: auto-apply simple state transitions when source metadata indicates a change (see `lib/ingest/bills.ts` and `lib/rules/engine.ts` for update logic)
  - Change detector: computes diffs and generates reviewer summaries (`lib/ingest/page-extract.ts` + `lib/llm/tasks.ts` for optional summarization)

- Human review
  - Interface: reviewer UI pages and review flows (search for `review` components and `lib/db/reviews.ts`) and `worker` tasks that create review events.

- Storage / DB
  - Postgres (Tiger Data): `lib/db/pool.ts`, migrations in `db/migrations/*.sql`.

Scheduling and runner

- The primary runner is `worker/index.ts` and `worker/jobs.ts`. The worker may be run continuously (long-lived process) or executed via cron/containers.
- Key script commands in `package.json`:
  - `npm run worker` — run worker continuously
  - `npm run worker:once` — one-shot execution
  - `npm run db:migrate` — run DB migrations

Operational notes / behavior

- Idempotency: ingestion tasks should be idempotent — handlers check for existing records and update state instead of duplicating.
- Rate limits: fetchers respect politeness settings in `.env.local` (e.g., `FETCH_MIN_INTERVAL_MS`) to avoid hammering upstream sites.
- Sensitive data: page text is scrubbed before being sent to LLMs (`lib/llm/tasks.ts::scrubSensitive`).

Short-term improvements (recommended)

1. Health checks and readiness
   - Add a lightweight `/health` endpoint that checks DB connectivity and `worker` health. Fail fast in CI when migrations are missing.

2. Observability & metrics
   - Export ingestion metrics (items processed, errors, queue depth) via Prometheus or simple logs.

3. Retry & backoff
   - Ensure fetchers and LLM calls use exponential backoff and a dead-letter path for repeatedly failing pages. (Note: `lib/llm/client.ts` already has retry/backoff added.)

4. Backfill tooling
   - Add `scripts/backfill-<source>.ts` helpers to re-process historical pages when a parser changes.

5. Reviewer batching
   - Group similar diffs into a single review task to reduce reviewer load.

6. Documentation & runbook
   - Add a runbook with steps to bring up a local ingestion environment (Postgres + worker + env vars). This repo already includes `.env.example` and `db/migrations` to bootstrap.

How to run locally (dev)

- Use seed-mode (no DB) for UI work. To enable DB-backed ingestion locally:
  1. Start Postgres (Docker):

```bash
docker run --name benefit-bridge-db -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=benefit_bridge -p 5432:5432 -d postgres:15
```

2. Set `DATABASE_URL` in `.env.local` and run migrations:

```bash
npm run db:migrate
```

3. Run the worker once to seed data:

```bash
npm run worker:once
```

4. Run the web app:

```bash
npm run dev
```

Next concrete tasks I can do (pick one)

- Implement a `/health` endpoint that checks DB and (optionally) LLM availability.
- Add basic Prometheus-style metrics (via simple JSON endpoint) for ingestion counts and failures.
- Add a `scripts/backfill-pages.ts` one-shot script to re-run `page-extract` on a list of URLs.

Tell me which next task you'd like, and I'll implement it.
