-- WISKEY-ADOPT-2272 review L3 (docs/changes/WISKEY-ADOPT-2272.md): the two tables of the installed-client consumers
-- (services/wiskey_installed_features.py), created here instead of at runtime. Number 0183: the next free number on this branch and
-- on origin/main (both end at 0182); release_check needs a contiguous sequence. NOTE: pilot/BUILDING-PRESENCE-2271 (not merged) also
-- uses 0183 (building presence) - whichever of the two merges second renumbers its file.
-- Additive only. IF NOT EXISTS: a development database that ran this branch before the migration existed already has them (same
-- columns). Neither table is a backup table (services/backup.py PROJECT_TABLES lists tables explicitly): both describe THIS
-- installation's exchange with WisKey. Ids, states and codes only - never a phone number, a parameter value or an event body.

-- Arx's journal of WisKey's durable template queue: the row is written BEFORE the enqueue leaves (one enqueue per operation, ever).
CREATE TABLE IF NOT EXISTS wiskey_template_jobs (
  operation_id TEXT PRIMARY KEY,
  request_id   TEXT NOT NULL UNIQUE,
  template_id  TEXT,
  person_id    TEXT,
  state        TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  code         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- The event ids already handed on (at-least-once de-duplication of events/resume_v1; the last SEEN_LIMIT ids are kept).
CREATE TABLE IF NOT EXISTS wiskey_event_seen (
  event_id TEXT PRIMARY KEY,
  seq      INTEGER NOT NULL
);
