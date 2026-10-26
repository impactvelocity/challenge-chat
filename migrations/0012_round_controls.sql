ALTER TABLE rounds ADD COLUMN paused_at TEXT;
ALTER TABLE sessions ADD COLUMN name_history_json TEXT NOT NULL DEFAULT '[]';
