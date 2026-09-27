-- New programs drafted from an official page. A 'draft' program is never shown
-- to the public: the page-watch job opens its first review, and approving that
-- review is what makes it active.
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_status_check;
ALTER TABLE programs ADD CONSTRAINT programs_status_check
  CHECK (status IN ('active','needs_verification','retired','draft'));

CREATE TABLE IF NOT EXISTS program_draft_requests (
  id                bigserial PRIMARY KEY,
  url               text NOT NULL,
  jurisdiction_code text NOT NULL REFERENCES jurisdictions(code),
  requested_by      text NOT NULL,
  status            text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','drafted','failed')),
  program_id        text REFERENCES programs(id) ON DELETE SET NULL,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS program_draft_requests_status ON program_draft_requests (status, created_at);
