-- ============================================================
--  001_sync_schema.sql
--  Brings an EXISTING database in line with what the code expects.
--  Safe to run more than once (idempotent). Fresh installs don't need it —
--  schema.sql already includes everything below.
--
--  Run:  psql "$DATABASE_URL" -f migrations/001_sync_schema.sql
--        (or paste into the Supabase SQL editor)
-- ============================================================

BEGIN;

-- Columns the app uses that the original schema.sql lacked
ALTER TABLE sessions      ADD COLUMN IF NOT EXISTS invite_token     TEXT;
ALTER TABLE sessions      ADD COLUMN IF NOT EXISTS results_released BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE session_pairs ADD COLUMN IF NOT EXISTS pin              TEXT;

-- Give any pre-existing session a join token, then make tokens unique
UPDATE sessions SET invite_token = gen_random_uuid()::text WHERE invite_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_invite_token ON sessions(invite_token);

-- 'archived' is a status the app sets; allow it in the CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD  CONSTRAINT sessions_status_check
  CHECK (status IN ('setup', 'active', 'completed', 'archived'));

-- Housekeeping: stop expired / revoked refresh tokens piling up
-- (run occasionally, or schedule it in Supabase)
-- DELETE FROM refresh_tokens WHERE revoked OR expires_at < NOW() - INTERVAL '1 day';

COMMIT;
