-- NVR writes (owner-approved 2026-09-17): every configuration change keeps the document before and after, so it
-- can be shown, audited and rolled back. Nothing here touches recordings.
CREATE TABLE nvr_changes (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,            -- notify_center | detection | privacy | smart | schedule | osd | time | ...
  permission      TEXT NOT NULL,            -- the VMS permission that allowed it (also the one a rollback needs)
  target          TEXT NOT NULL,            -- human target: channel 3 / VMD-3 / hdd 1
  path            TEXT NOT NULL,            -- ISAPI path written
  before_xml      TEXT,
  after_xml       TEXT,
  status          TEXT NOT NULL,            -- applied | unchanged | rolled_back | failed
  error           TEXT,
  rollback_of     TEXT,                     -- the change this one undid
  note            TEXT NOT NULL DEFAULT '',
  actor_id        TEXT,
  actor_username  TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_nvr_changes_created ON nvr_changes (created_at);
