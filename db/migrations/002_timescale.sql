-- requires: timescaledb
-- no-transaction
-- Hypertables + continuous aggregate for the public dashboard.
-- Skipped automatically on plain PostgreSQL (see scripts/migrate.ts);
-- 900_fallback_views.sql provides equivalent plain views there.

-- 900_fallback_views may have created a plain view on a previous plain-Postgres run.
DROP VIEW IF EXISTS match_daily;

SELECT create_hypertable('source_snapshots', 'fetched_at', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('bill_status_events', 'occurred_at', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('match_events', 'matched_at', if_not_exists => TRUE, migrate_data => TRUE);

-- Keep raw anonymous match events 13 months; the aggregate keeps the history.
SELECT add_retention_policy('match_events', INTERVAL '13 months', if_not_exists => TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS match_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket(INTERVAL '1 day', matched_at) AS day,
       program_id,
       region,
       confidence,
       count(*) AS matches
FROM match_events
GROUP BY 1, 2, 3, 4
WITH NO DATA;

SELECT add_continuous_aggregate_policy('match_daily',
  start_offset => INTERVAL '30 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);
