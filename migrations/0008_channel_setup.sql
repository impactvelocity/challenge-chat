ALTER TABLE channels ADD COLUMN setup_completed INTEGER NOT NULL DEFAULT 1 CHECK (setup_completed IN (0, 1));

-- The original demo deployment shipped with a visible NightShift board. Convert only
-- the untouched seed into an internal setup slot so existing creator boards survive.
UPDATE channels
SET display_name = 'Unconfigured board',
    broadcaster_login = 'setup-pending-demo-channel',
    setup_completed = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'demo-channel'
  AND display_name = 'NightShift'
  AND broadcaster_login = 'nightshift'
  AND NOT EXISTS (SELECT 1 FROM challenges WHERE channel_id = channels.id)
  AND NOT EXISTS (
    SELECT 1 FROM rounds
    JOIN sessions ON sessions.id = rounds.session_id
    WHERE sessions.channel_id = channels.id
  );
