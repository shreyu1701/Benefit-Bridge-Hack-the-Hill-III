-- Benefit Bridge core schema.
-- Runs on plain PostgreSQL 15+ and on Tiger Data (TimescaleDB). Timescale-only
-- features (hypertables, continuous aggregates) live in 002 and are applied
-- only when the extension is available; pgvector objects likewise in 003.

-- Optional extensions (Tiger Data provides both). Failure is non-fatal.
DO $$ BEGIN
  BEGIN CREATE EXTENSION IF NOT EXISTS timescaledb; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'timescaledb unavailable: %', SQLERRM; END;
  BEGIN CREATE EXTENSION IF NOT EXISTS vector;      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pgvector unavailable: %', SQLERRM; END;
END $$;

-- ---------------------------------------------------------------------------
-- Jurisdictions (data-driven: adding a province/city is an INSERT, not code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jurisdictions (
  code              text PRIMARY KEY,               -- 'CA', 'ON', 'ON-TORONTO'
  level             text NOT NULL CHECK (level IN ('federal','provincial','municipal')),
  name              jsonb NOT NULL,                 -- {"en": "...", "fr": "..."}
  parent_code       text REFERENCES jurisdictions(code),
  province_code     text,
  municipality_code text,
  config            jsonb NOT NULL DEFAULT '{}'     -- city aliases, allowed domains, bill source
);

-- ---------------------------------------------------------------------------
-- Tier 3: laws (consolidated Acts / regulations / council decisions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laws (
  id                 text PRIMARY KEY,
  jurisdiction_code  text NOT NULL REFERENCES jurisdictions(code),
  kind               text NOT NULL CHECK (kind IN ('act','regulation','council_decision')),
  citation           text NOT NULL,
  title              jsonb NOT NULL,
  source_url         text NOT NULL,
  xml_url            text,
  what_changed       jsonb NOT NULL DEFAULT '{}',
  what_changed_approved boolean NOT NULL DEFAULT false,
  last_amended_on    date,          -- from Justice Laws XML @lastAmendedDate where available
  current_to         date,          -- "Current to" / consolidation date
  fetched_at         timestamptz,
  content_hash       text
);

-- ---------------------------------------------------------------------------
-- Programs (Tier 2: human-approved content)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id                    text PRIMARY KEY,
  name                  jsonb NOT NULL,
  level                 text NOT NULL CHECK (level IN ('federal','provincial','municipal')),
  jurisdiction_code     text NOT NULL REFERENCES jurisdictions(code),
  eligibility_rules     jsonb NOT NULL,              -- {version, criteria:[{id, logic (JSON Logic), source_url, ...}], also_required}
  benefit_amount        jsonb,
  deadlines             jsonb NOT NULL DEFAULT '[]',
  how_to_apply          jsonb NOT NULL DEFAULT '{}',
  application_url       text NOT NULL,
  source_url            text NOT NULL,
  source_law_id         text REFERENCES laws(id),
  status                text NOT NULL DEFAULT 'needs_verification'
                          CHECK (status IN ('active','needs_verification','retired')),
  status_reason         text,
  has_pending_review    boolean NOT NULL DEFAULT false,
  last_verified_at      timestamptz,
  approved_by           text,
  summaries_by_language jsonb NOT NULL DEFAULT '{}',
  revision              integer NOT NULL DEFAULT 1,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Immutable history of every approved revision (audit trail).
CREATE TABLE IF NOT EXISTS program_revisions (
  program_id        text NOT NULL REFERENCES programs(id),
  revision          integer NOT NULL,
  eligibility_rules jsonb NOT NULL,
  benefit_amount    jsonb,
  deadlines         jsonb,
  approved_by       text,
  approved_at       timestamptz NOT NULL DEFAULT now(),
  change_review_id  bigint,
  PRIMARY KEY (program_id, revision)
);

-- Pages watched for each program (one program can depend on several pages).
CREATE TABLE IF NOT EXISTS program_sources (
  id                   bigserial PRIMARY KEY,
  program_id           text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  url                  text NOT NULL,
  check_interval_hours integer NOT NULL DEFAULT 12 CHECK (check_interval_hours BETWEEN 1 AND 168),
  last_checked_at      timestamptz,
  last_hash            text,
  last_http_status     integer,
  last_date_modified   date,
  etag                 text,
  http_last_modified   text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  UNIQUE (program_id, url)
);

-- Time series of page fetches (hypertable on Tiger Data).
CREATE TABLE IF NOT EXISTS source_snapshots (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  source_url      text NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  http_status     integer NOT NULL,
  date_modified   date,              -- page's own "Date modified"
  content_hash    text,
  normalized_text text,
  error           text,
  PRIMARY KEY (id, fetched_at)
);
CREATE INDEX IF NOT EXISTS source_snapshots_url_time ON source_snapshots (source_url, fetched_at DESC);

CREATE TABLE IF NOT EXISTS change_reviews (
  id                  bigserial PRIMARY KEY,
  program_id          text NOT NULL REFERENCES programs(id),
  program_source_id   bigint REFERENCES program_sources(id),
  snapshot_id         uuid NOT NULL,
  snapshot_fetched_at timestamptz NOT NULL,
  previous_snapshot_id uuid,
  kind                text NOT NULL DEFAULT 'content_changed'
                        CHECK (kind IN ('content_changed','source_error','initial_verification')),
  diff                text,
  llm_change_summary  jsonb,          -- DRAFT for reviewers only; never shown to the public
  proposed_rules      jsonb,          -- reviewer-edited rules, applied on approval
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer            text,
  reviewer_notes      text,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_reviews_pending ON change_reviews (status, created_at);

-- ---------------------------------------------------------------------------
-- Tier 1: bills and legislative status events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id                  bigserial PRIMARY KEY,
  jurisdiction_code   text NOT NULL REFERENCES jurisdictions(code),
  bill_number         text NOT NULL,           -- 'C-2', 'S-201', '12' (Ontario)
  parliament          integer NOT NULL,
  session             integer NOT NULL,
  external_id         text,                    -- LEGISinfo BillId
  titles              jsonb NOT NULL,          -- {long_en, long_fr, short_en, short_fr}
  current_stage       text,                    -- latest completed major stage (en)
  current_stage_fr    text,
  status_en           text,
  status_fr           text,
  is_government_bill  boolean,
  is_session_ongoing  boolean,
  royal_assent_at     timestamptz,
  statute_ref         text,                    -- e.g. 'S.C. 2025, c. 3'
  coming_into_force   text,                    -- only when the source provides it
  summary             jsonb,                   -- plain-language summary {en, fr, who_affected}
  summary_source_url  text,
  source_url          text NOT NULL,
  content_hash        text,
  raw                 jsonb,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_code, parliament, session, bill_number)
);

-- Time series of stage changes (hypertable on Tiger Data, partitioned by occurred_at).
CREATE TABLE IF NOT EXISTS bill_status_events (
  bill_id      bigint NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  stage        text NOT NULL,          -- 'first_reading', 'second_reading', 'royal_assent', 'status:<text>'
  chamber      text,                   -- 'house', 'senate', 'assembly', null
  label_en     text,
  label_fr     text,
  occurred_at  timestamptz NOT NULL,   -- when it happened (source timestamp, or detection time if unknown)
  occurred_at_is_detected boolean NOT NULL DEFAULT false,
  detected_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, stage, occurred_at)
);
CREATE INDEX IF NOT EXISTS bill_status_events_bill ON bill_status_events (bill_id, occurred_at);

CREATE TABLE IF NOT EXISTS program_law_links (
  id           bigserial PRIMARY KEY,
  program_id   text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  bill_id      bigint REFERENCES bills(id),
  law_id       text REFERENCES laws(id),
  relationship text NOT NULL CHECK (relationship IN ('created','amended','funded','governs')),
  CHECK ((bill_id IS NOT NULL) <> (law_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS program_law_links_uniq
  ON program_law_links (program_id, COALESCE(bill_id, 0), COALESCE(law_id, ''), relationship);

-- Canada Gazette Part II/III items.
CREATE TABLE IF NOT EXISTS gazette_items (
  guid         text PRIMARY KEY,
  part         text NOT NULL CHECK (part IN ('II','III')),
  title        text NOT NULL,
  link         text NOT NULL,
  description  text,
  published_at timestamptz,
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

-- Tier 3: open-data catalogue records we track.
CREATE TABLE IF NOT EXISTS reference_datasets (
  portal            text NOT NULL,     -- 'open.canada.ca', 'data.ontario.ca', 'toronto'
  dataset_id        text NOT NULL,
  title             text,
  url               text NOT NULL,
  metadata_modified timestamptz,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  content_hash      text,
  raw               jsonb,
  PRIMARY KEY (portal, dataset_id)
);

-- Worker bookkeeping: last successful run per job.
CREATE TABLE IF NOT EXISTS job_runs (
  job          text PRIMARY KEY,
  last_run_at  timestamptz,
  last_ok_at   timestamptz,
  last_error   text,
  meta         jsonb NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Anonymous analytics (hypertable on Tiger Data). NO user data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_events (
  program_id  text NOT NULL,
  region      text NOT NULL,          -- jurisdiction code only, e.g. 'ON' or 'ON-TORONTO'
  confidence  text NOT NULL CHECK (confidence IN ('likely','possibly')),
  matched_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_events_time ON match_events (matched_at DESC);

-- ---------------------------------------------------------------------------
-- Opt-in saved results: only structured facts, encrypted (AES-256-GCM).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sub     text NOT NULL,
  ciphertext   bytea NOT NULL,
  iv           bytea NOT NULL,
  auth_tag     bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_results_user ON saved_results (user_sub, created_at DESC);
