ALTER TABLE sessions ADD COLUMN submissions_open INTEGER NOT NULL DEFAULT 0 CHECK (submissions_open IN (0, 1));

CREATE INDEX IF NOT EXISTS challenges_channel_inbox_idx
  ON challenges(channel_id, status, created_at);
