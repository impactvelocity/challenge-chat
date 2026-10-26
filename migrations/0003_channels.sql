ALTER TABLE channels ADD COLUMN active_session_id TEXT;
UPDATE channels SET active_session_id = (SELECT id FROM sessions WHERE channel_id = channels.id ORDER BY created_at DESC, id LIMIT 1);

CREATE TABLE channel_memberships (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);
INSERT INTO channel_memberships (channel_id, user_id, created_at)
SELECT c.id, u.id, u.created_at FROM channels c CROSS JOIN auth_users u
WHERE c.id = 'demo-channel' AND u.role = 'mod' AND u.active = 1;
ALTER TABLE auth_invites ADD COLUMN channel_id TEXT;
UPDATE auth_invites SET channel_id = 'demo-channel';

CREATE TABLE channel_integration_tokens (
  channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  last_four TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE leaderboards (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sponsor TEXT,
  game TEXT,
  starts_at TEXT,
  ends_at TEXT,
  rules_json TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX leaderboards_channel_idx ON leaderboards(channel_id, archived);
INSERT INTO leaderboards (id, channel_id, name, rules_json)
SELECT 'community:' || id, id, 'Community XP', '{"approved":1,"finalist":2,"played":5}' FROM channels;

CREATE UNIQUE INDEX one_live_session_per_channel ON sessions(channel_id) WHERE status = 'live';
