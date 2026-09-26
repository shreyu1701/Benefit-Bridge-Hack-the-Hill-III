# Benefit Bridge

Benefit Bridge helps people in Canada find government benefits they may qualify for, in
any language. It explains the laws behind those benefits in plain language, and every
claim cites an official government page.

- **Eligibility is deterministic.** A rules engine (JSON Logic) runs over human-approved
  program data. The LLM only extracts facts, translates, and summarizes official text.
- **Data stays fresh through three tiers** (see below). Bill status updates automatically.
  Program rules change only after a human approves a detected page change.
- **MVP scope:** federal, Ontario and City of Toronto programs. English and French UI, plus
  machine-translated results in any language.

Read these next:

- [`docs/SOURCE_VERIFICATION.md`](docs/SOURCE_VERIFICATION.md): which endpoints and rules
  are verified, **what differs from the original spec**, and what could not be verified.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system diagram, data model, rules
  engine, and LLM contracts.

> **Status:** every seeded program starts as `needs_verification`. The seed was checked
> through official-domain search results, because the build environment could not reach
> government hosts directly. Run `npm run verify:sources`, start the worker, and approve
> each program's first snapshot in `/admin`.

## Quick start

```bash
cp .env.example .env.local        # fill in what you have; everything but DATABASE_URL is optional
npm install
npm run db:migrate                # PostgreSQL 15+ or Tiger Data (TimescaleDB + pgvector used when present)
npm run db:seed                   # jurisdictions, laws, 10 programs (11 records: OAS and GIS are separate)
npm run dev                       # http://localhost:3000
npm run worker                    # separate process: ingestion on schedule (or `npm run worker:once`)
```

Without `DATABASE_URL`, the web app still runs using the seed file, which is useful for UI
work. Without `GEMINI_API_KEY`, the home page falls back to the manual form, and results
are shown in English or French only. Without `ELEVENLABS_API_KEY`, "Listen" uses the
browser's speech synthesis and voice input is disabled.

### Tests

```bash
npm test                                           # unit + ingestion + extraction pipeline tests (offline)
TEST_DATABASE_URL=postgres://…/scratch npm test     # + Postgres integration (wipes that database!)
LLM_LIVE=1 GEMINI_API_KEY=… npm run test:llm-live   # extraction cases in 5 languages against real Gemini
npm run fixtures:refresh                           # save real LEGISinfo/canada.ca/ola.org responses as fixtures
npm run typecheck && npm run lint && npm run build
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (prod) | Tiger Data / PostgreSQL connection string (`sslmode=require` on Tiger Cloud) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBED_MODEL` | recommended | Fact extraction, translation, summaries, change-review drafts |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | optional | Voice input and multilingual read-aloud |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`, `AUTH0_CONNECTION=email` | optional | Passwordless sign-in for saved results and reviewers |
| `ADMIN_EMAILS` | with Auth0 | Comma-separated reviewer emails (must be verified) |
| `ADMIN_TOKEN` | dev only | Reviewer access without Auth0 (`x-admin-token` header or `bb_admin` cookie). Ignored in production. |
| `SAVED_RESULTS_KEY` | for saving | 32-byte base64 key for AES-256-GCM encryption of saved facts |
| `FETCH_USER_AGENT`, `FETCH_MIN_INTERVAL_MS` | recommended | Identify the crawler (include contact info) and set the per-host rate limit |
| `LEGISINFO_INTERVAL_MIN`, `OLA_INTERVAL_MIN` | optional | Tier 1 polling intervals (defaults 30 and 60) |

## How the freshness tiers work

| Tier | Sources | Cadence | Applied automatically? |
|---|---|---|---|
| **1: real-time** | LEGISinfo JSON, ola.org, Canada Gazette RSS | 30 / 60 / 60 min | **Yes.** Every stage change becomes a timestamped `bill_status_events` row. Parliament/session are detected from the data. |
| **2: approved** | canada.ca / CRA, ontario.ca, toronto.ca program pages | 6 h (federal), 12 h (Ontario), 24 h (Toronto), per page | **No.** A changed page creates a snapshot, a diff, an AI draft and a pending review. Rules change only when a reviewer approves in `/admin`. A missing or failing page sets the program to `needs_verification`, and users see it. |
| **3: reference** | Justice Laws XML, Ontario e-Laws, CKAN portals | weekly, or immediately after a royal assent | Metadata yes; "what this law changed" text needs approval |

Programs whose last human verification is more than 30 days old show "may be out of date".
Each program card shows **Last verified** (human approval) and **Source last changed** (the
page's own "Date modified").

## The review workflow

1. The worker's first fetch of each watched page creates an `initial_verification` review.
2. A reviewer opens `/admin`, reads the page text or diff, and does one of the following:
   - **approves** as is
   - **approves with edited rules** (the JSON is validated: known variables, official
     citations, valid JSON Logic)
   - **rejects**
3. When a program has no pending reviews and no failing pages, it becomes `active`, with
   `last_verified_at` and `approved_by` set. Each approval with rule changes is saved in
   `program_revisions`.

## Adding a program

All steps are data; no engine or UI changes are needed.

1. Add a `ProgramRecord` to `data/programs.ts` (or insert into `programs` directly):
   - `eligibility_rules.criteria`: JSON Logic over the variables in
     `lib/facts/derive.ts#DerivedData`.
   - **Every criterion needs a `source_url` on an official domain.** Add a `source_quote`
     with the exact wording the rule encodes.
   - If a threshold isn't published, **return `null` (data gap)**. Never guess.
   - If a rule needs a new fact (for example "pregnant"), add it to
     `lib/facts/schema.ts`, `lib/facts/derive.ts`, `lib/facts/labels.ts` and the
     extraction schema. This is the one case that needs code.
2. Optionally link it to laws in `data/laws.ts` (`SEED_PROGRAM_LAW_LINKS`).
3. Run `npm run db:seed`. The program and its watched pages (`data/sources.ts#watchedUrlsFor`)
   are created as `needs_verification`.
4. Run the worker. It fetches the pages and queues `initial_verification` reviews. Approve
   them in `/admin`.
5. Add unit tests in `tests/engine.test.ts`, including near-miss boundary cases.

The seed never overwrites a program a human has already approved.

## Adding a province, territory or city

1. Add a `Jurisdiction` in `data/jurisdictions.ts`:
   - `code` and `level`
   - `parent`
   - `province` and `municipality`
   - `cityAliases` for municipalities (for example the former boroughs)
   - `allowedDomains`: its official domains, which also extends the fetch allowlist
2. Add its programs (above). Residence criteria are generated automatically from the
   program's `jurisdiction`.
3. For its bills, add a source in `data/sources.ts` (TIER1) and, if it has no API, a parser
   modelled on `lib/ingest/ontario-bills.ts`.
4. Add the UI heading if it's a new level label (`results.level.*` in `lib/i18n/messages.ts`).
5. `npm run db:seed`.

## Project layout

```
app/                 Next.js App Router pages + route handlers (app/api/*)
components/          UI (shadcn/ui-style primitives in components/ui)
data/                Seed data & config: jurisdictions, programs, laws, personas, sources
db/migrations/       SQL (001 core · 002 Timescale · 003 pgvector · 900 plain-PG fallback)
lib/rules/           Deterministic engine, types, rule validation
lib/facts/           Facts schema, derivation, labels/questions
lib/llm/             Gemini client + JSON contracts + tasks
lib/ingest/          Tier 1–3 parsers and change detection (pure, tested)
lib/sources/         Allowlist, polite fetcher, robots.txt
lib/db/              Postgres stores (bills, page watch, reviews)
worker/              Scheduler + jobs (separate process)
scripts/             migrate, seed, verify-sources, refresh-fixtures
tests/               Vitest suites + fixtures
docs/                Source verification report, architecture
```

## Deployment (Vultr, Toronto)

- **Web:** `npm run build && npm start` behind a TLS reverse proxy on a Vultr Toronto
  (`yto`) instance.
- **Worker:** run `npm run worker` as a separate systemd service. A Postgres advisory lock
  keeps only one worker active, so a standby replica is safe.
- **Database:** Tiger Data (TimescaleDB with pgvector) in a Canadian region, if one is
  available. Otherwise use self-managed TimescaleDB on Vultr Toronto, so data stays in
  Canada.
- **Rate limiting:** the in-memory rate limiter assumes a single web instance. Move it to
  Postgres or Redis if you scale out.

## Disclaimer

This is not legal or financial advice. Always confirm with the official program.
