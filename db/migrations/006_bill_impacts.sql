-- Who a bill affects, so results can say "this change may affect you".
-- The worker DRAFTS a row from the bill's official text; nothing is shown to
-- the public until a reviewer approves it (status = 'approved').
CREATE TABLE IF NOT EXISTS bill_impacts (
  bill_id         bigint PRIMARY KEY REFERENCES bills(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','not_relevant')),
  needs           jsonb NOT NULL DEFAULT '[]',   -- NEEDS values (lib/profile/schema.ts)
  life_events     jsonb NOT NULL DEFAULT '[]',   -- LIFE_EVENTS values
  conditions      jsonb NOT NULL DEFAULT '[]',   -- [{fact, op, value}] (lib/rules/conditions.ts)
  applies_if      jsonb,                         -- JSON Logic built from conditions; null = topics only
  who             jsonb NOT NULL,                -- {en, fr}: one plain-language sentence
  source_url      text NOT NULL,
  draft           jsonb,                         -- the model's draft, kept for reviewers
  reviewer        text,
  reviewer_notes  text,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bill_impacts_status ON bill_impacts (status, created_at);
