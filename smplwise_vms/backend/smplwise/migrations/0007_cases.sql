-- 0007: investigation cases (MASTER_SPEC ch. 27, T049). A case links events and recording clips from several
-- cameras with notes, tags and a status. A clip is a bookmark into the NVR until an export job preserves a copy;
-- the export job id is a loose reference (jobs are swept by retention, the item then reports its state honestly).

CREATE TABLE cases (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'closed')),
  tags_json      TEXT NOT NULL DEFAULT '[]',
  owner_user_id  TEXT NOT NULL,
  owner_username TEXT NOT NULL DEFAULT '',
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  closed_at      TEXT
);
CREATE INDEX idx_cases_updated ON cases (updated_at DESC);
CREATE INDEX idx_cases_status ON cases (status);

CREATE TABLE case_items (
  id                TEXT PRIMARY KEY,
  case_id           TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('event', 'clip', 'note')),
  camera_id         TEXT,
  event_id          TEXT,
  export_job_id     TEXT,
  from_at           TEXT,                  -- UTC ISO window of the evidence (event: around it; clip: as chosen)
  to_at             TEXT,
  note              TEXT NOT NULL DEFAULT '',
  added_by          TEXT NOT NULL,
  added_by_username TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_case_items_case ON case_items (case_id, created_at);
CREATE INDEX idx_case_items_event ON case_items (event_id);
