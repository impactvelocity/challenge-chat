ALTER TABLE channels ADD COLUMN overlay_config_json TEXT NOT NULL DEFAULT '{"theme":"broadcast","settings":{},"elements":{}}';
ALTER TABLE channels ADD COLUMN session_settings_json TEXT NOT NULL DEFAULT '{"autoNext":true,"autoNextSecs":45,"aiTitles":true,"publicPage":true,"twitchLogin":null}';
