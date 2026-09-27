-- What each program helps with, and which life events make it relevant.
-- Ranking only: the rules engine never reads this column.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS topics jsonb NOT NULL DEFAULT '{"needs":[],"life_events":[]}';

-- Anonymous count of needs people mention that no program covers for them yet.
-- Tells us which programs to add next. No facts, no text, no identifiers.
CREATE TABLE IF NOT EXISTS need_gaps (
  need         text NOT NULL,
  region       text NOT NULL,          -- jurisdiction code only, e.g. 'ON' or 'ON-TORONTO'
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS need_gaps_time ON need_gaps (occurred_at DESC);
