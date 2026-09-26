-- unless: timescaledb
-- Plain-PostgreSQL stand-in for the match_daily continuous aggregate (local dev / CI).
CREATE OR REPLACE VIEW match_daily AS
SELECT date_trunc('day', matched_at) AS day,
       program_id,
       region,
       confidence,
       count(*) AS matches
FROM match_events
GROUP BY 1, 2, 3, 4;
