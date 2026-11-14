-- CR-028 phase 1 (docs/changes/CR-028-CAST-TO-SCREENS.md section 12): cast ONE camera to a media screen through Google Cast.
-- Additive only (rollback = run the previous version; it ignores the new column and table). Numbering: 0057 is the phone app
-- (main), 0058 the manual electricity readings (pilot/EL6-manual-reading), 0059 is reserved for the map investigation
-- (pilot/investigate-map-improvements carries a second 0057 that is renumbered at its merge); 0060 is the next free number
-- on every origin branch (checked with git ls-tree, 2026-10-05).

-- The administrator's per-screen cast settings (section 12.4): {allow, method, minutes, permanent, allow_main}. NULL = the
-- defaults: casting OFF for this screen (owner decision 2026-10-05: the administrator turns casting on per screen), the
-- detected method, the installation's minutes, no permanent cast, the installation's main-stream rule.
ALTER TABLE media_devices ADD COLUMN cast_json TEXT;

-- One row per cast. The token the TV fetches with is never stored: only its SHA-256 (`token_hash`, the relay's lookup key); the
-- token itself is HMAC-SHA256(installation cast secret, session_id|generation) and can be recomputed by the server alone.
-- `token_gen` rises on every camera switch (the old token dies at once). `expires_at` NULL = a permanent cast (only on a
-- screen the administrator marked permanent). `restore_json` = {was_off, power_off_after}: what is done after the stop and
-- nothing else (no app, input or queue is ever restored). Audit rows never carry the token, the URL or the origin.
CREATE TABLE cast_sessions (
  session_id        TEXT PRIMARY KEY,                -- 32 hex
  device_key        TEXT NOT NULL,                   -- the target screen (media_devices.device_key)
  target_entity_id  TEXT NOT NULL,                   -- the Cast media_player the bridge plays on
  kind              TEXT NOT NULL DEFAULT 'camera',  -- camera | test (the administrator's 60 s test); wall = phase 2
  camera_id         TEXT NOT NULL,
  profile           TEXT NOT NULL,                   -- sub | main
  stream_name       TEXT NOT NULL,                   -- always smplwise_*: the go2rtc stream the relay serves
  token_hash        TEXT NOT NULL UNIQUE,
  token_gen         INTEGER NOT NULL DEFAULT 0,
  started_by        TEXT NOT NULL,                   -- the VMS user id (the HA user the bridge acts as)
  started_by_name   TEXT,
  channel           TEXT NOT NULL DEFAULT 'local',   -- local | remote (/arx): the press may be remote, the playback is on the LAN
  client_request_id TEXT,
  state             TEXT NOT NULL DEFAULT 'starting',-- starting | playing | not_confirmed | stopped
  started_at        TEXT NOT NULL,
  expires_at        TEXT,                            -- NULL = permanent
  extended_n        INTEGER NOT NULL DEFAULT 0,
  first_segment_at  TEXT,                            -- the honest "playing": the relay served the first segment
  stopped_at        TEXT,
  stop_reason       TEXT,                            -- user | timeout | replaced | target_gone | error | admin | refused
  stopped_by        TEXT,
  ha_action_id      TEXT,                            -- the request id of the bridge call that started the current camera
  restore_json      TEXT NOT NULL DEFAULT '{}',
  power_off_state   TEXT                             -- NULL | sent | failed | skipped | cancelled
);
-- one live cast per screen (a new start on the same screen replaces the old one first)
CREATE UNIQUE INDEX cast_sessions_open_target ON cast_sessions(device_key) WHERE stopped_at IS NULL;
-- the same client request of the same user never starts two casts
CREATE UNIQUE INDEX cast_sessions_request ON cast_sessions(started_by, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX cast_sessions_open ON cast_sessions(stopped_at, expires_at);
