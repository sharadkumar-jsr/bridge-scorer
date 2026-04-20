-- ============================================================
--  schema.sql  — Duplicate Bridge Club Scoring App
--  PostgreSQL 14+  (works with Supabase out of the box)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
--  UTILITY — auto-update updated_at on any table that has it
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
--  USERS  (directors & club admins)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  display_name  TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'director'
                            CHECK (role IN ('admin', 'director')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  REFRESH TOKENS  (rolling single-use)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,   -- bcrypt hash of the raw token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);

-- ─────────────────────────────────────────────────────────────
--  SESSIONS  (one session = one club game evening)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  date           DATE        NOT NULL DEFAULT CURRENT_DATE,
  tables_count   SMALLINT    NOT NULL CHECK (tables_count BETWEEN 3 AND 6),
  movement_type  TEXT        NOT NULL DEFAULT 'howell'
                             CHECK (movement_type IN ('howell')),
  num_boards     SMALLINT    NOT NULL,   -- total boards in play (e.g. 20, 21, 18)
  num_rounds     SMALLINT    NOT NULL,   -- rounds in the movement
  has_phantom    BOOLEAN     NOT NULL DEFAULT FALSE,
  phantom_pair   SMALLINT,              -- pair number that is the phantom (if any)
  status         TEXT        NOT NULL DEFAULT 'setup'
                             CHECK (status IN ('setup', 'active', 'completed')),
  created_by     UUID        NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────
--  SESSION PAIRS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE session_pairs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  pair_number  SMALLINT    NOT NULL,
  player1_name TEXT,
  player2_name TEXT,
  is_phantom   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (session_id, pair_number)
);

CREATE INDEX idx_sp_session ON session_pairs(session_id);

-- ─────────────────────────────────────────────────────────────
--  BOARD RESULTS  (one row per (session, board, ns_pair, ew_pair))
-- ─────────────────────────────────────────────────────────────
CREATE TABLE board_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  board_number SMALLINT    NOT NULL,
  round        SMALLINT    NOT NULL,
  table_number SMALLINT    NOT NULL,
  ns_pair      SMALLINT    NOT NULL,
  ew_pair      SMALLINT    NOT NULL,

  -- Null-able for byes or not-yet-entered results
  declarer     CHAR(1)     CHECK (declarer IN ('N','S','E','W')),
  level        SMALLINT    CHECK (level BETWEEN 0 AND 7),
  suit         TEXT        CHECK (suit IN ('C','D','H','S','NT')),
  doubled      TEXT        NOT NULL DEFAULT 'none'
                           CHECK (doubled IN ('none','doubled','redoubled')),
  tricks       SMALLINT    CHECK (tricks BETWEEN 0 AND 13),

  is_bye       BOOLEAN     NOT NULL DEFAULT FALSE,
  ns_score     INT,        -- cached NS-perspective raw score (NULL until entered)

  entered_by   UUID        REFERENCES users(id),
  entered_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each pair faces this board exactly once
  UNIQUE (session_id, board_number, ns_pair, ew_pair)
);

CREATE INDEX idx_br_session            ON board_results(session_id);
CREATE INDEX idx_br_session_board      ON board_results(session_id, board_number);
CREATE INDEX idx_br_session_round      ON board_results(session_id, round);

CREATE TRIGGER trg_board_results_updated_at
  BEFORE UPDATE ON board_results
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────
--  SEED — default admin account
--  Password: "changeme" — MUST be changed in production.
--  bcrypt hash below is cost=10 for "changeme"
-- ─────────────────────────────────────────────────────────────
INSERT INTO users (email, password_hash, display_name, role)
VALUES (
  'admin@bridgeclub.local',
  '$2b$10$rI5bFjN1qB5gYKTqQ3z7FeF8x3SHlvlBSCpwTu0BhHtLW5FRhpZlO',
  'Club Admin',
  'admin'
);
