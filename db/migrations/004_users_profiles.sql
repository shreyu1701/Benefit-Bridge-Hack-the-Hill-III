-- Optional accounts (Auth0 / Google) with one encrypted profile each.
-- Guests never touch these tables: their profile lives in the browser tab.

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_id    text UNIQUE NOT NULL,       -- Auth0 subject, e.g. "google-oauth2|1234"
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The profile holds residency status and income, so it is only ever stored
-- encrypted (AES-256-GCM, see lib/crypto.ts). encrypted_data = ciphertext || auth tag.
CREATE TABLE IF NOT EXISTS profiles (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_data  bytea NOT NULL,
  iv              bytea NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Superseded by profiles (it stored the same kind of data, keyed by user_sub).
DROP TABLE IF EXISTS saved_results;
