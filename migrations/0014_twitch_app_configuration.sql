CREATE TABLE twitch_app_configuration (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  eventsub_secret TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
