CREATE TABLE twitch_connections (
  channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  broadcaster_user_id TEXT NOT NULL,
  broadcaster_login TEXT NOT NULL,
  broadcaster_display_name TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connecting', 'connected', 'attention', 'error')),
  connected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_event_at INTEGER,
  last_error TEXT
);

CREATE INDEX twitch_connections_broadcaster_idx
  ON twitch_connections(broadcaster_user_id);

CREATE TABLE twitch_oauth_states (
  state_hash TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX twitch_oauth_states_expiry_idx
  ON twitch_oauth_states(expires_at);

CREATE TABLE twitch_eventsub_subscriptions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES twitch_connections(channel_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(channel_id, type)
);

CREATE INDEX twitch_eventsub_channel_idx
  ON twitch_eventsub_subscriptions(channel_id);

CREATE TABLE twitch_event_messages (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'ignored', 'error')),
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  error TEXT
);

CREATE INDEX twitch_event_messages_received_idx
  ON twitch_event_messages(received_at);
