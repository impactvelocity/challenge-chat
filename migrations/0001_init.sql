PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  broadcaster_login TEXT NOT NULL UNIQUE,
  theme_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('live', 'ended')),
  mode TEXT NOT NULL CHECK (mode IN ('open_queue', 'blitz', 'hype')),
  streamer_score INTEGER NOT NULL DEFAULT 0,
  chat_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_login TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  game TEXT,
  context_json TEXT,
  targets_json TEXT NOT NULL DEFAULT '[]',
  constraints_json TEXT NOT NULL DEFAULT '[]',
  time_limit_seconds INTEGER,
  max_attempts INTEGER,
  failure_conditions_json TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL,
  verification_mode TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  needs_review INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  round_value INTEGER NOT NULL DEFAULT 1,
  parser_status TEXT NOT NULL DEFAULT 'fallback',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS challenges_session_status_idx
  ON challenges(session_id, status, created_at);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
  started_at TEXT NOT NULL,
  ends_at TEXT,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('streamer_won', 'chat_won')),
  resolved_by TEXT,
  resolved_at TEXT,
  resolution_nonce TEXT UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_round_per_session
  ON rounds(session_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS ballots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  ends_at TEXT NOT NULL,
  winner_challenge_id TEXT REFERENCES challenges(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_ballot_per_session
  ON ballots(session_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS ballot_entries (
  ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (ballot_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS votes (
  ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ballot_id, voter_id)
);

CREATE INDEX IF NOT EXISTS votes_ballot_challenge_idx
  ON votes(ballot_id, challenge_id);

CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL,
  challenge_id TEXT REFERENCES challenges(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS points_session_user_idx
  ON points_ledger(session_id, user_id);
