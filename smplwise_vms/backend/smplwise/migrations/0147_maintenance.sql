-- CR-MAINT215 (release 2.15.0, "maintenance and field", docs/changes/CR-MAINT215.md): ONE recurring-task model behind the
-- certificate / inspection ledger, preventive-maintenance plans, rounds (digital checklists), supplier documents with expiry and
-- the QR / NFC tags on equipment. PROVISIONAL number 0147 (0146 is held by another branch); the lead renumbers at integration.
-- Additive only: three new tables, no rebuild, no change to an existing table. Nothing here is read while the module switch
-- `maintenance.enabled` is off (default "false"). Dates of a task (anchor_date, due_date, performed_on, valid_until) are LOCAL
-- calendar dates 'YYYY-MM-DD' in the installation's zone; instants are UTC ISO-8601 text.

CREATE TABLE maint_tasks (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('certificate', 'preventive', 'round', 'vendor_document')),
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',      -- a key of services/maintenance/model.CATEGORIES (closed list in code)
  notes           TEXT NOT NULL DEFAULT '',
  -- where it is (the RBAC target: floor, else building, else site, else the installation)
  site_id         TEXT,
  building_id     TEXT,
  floor_id        TEXT,
  -- what it is about (each optional; vendor_id is required for a vendor_document)
  entity_id       TEXT,                               -- a catalogued Home Assistant entity
  elevator_id     TEXT,                               -- infra_elevators.id
  generator_id    TEXT,                               -- generator_devices.id
  vendor_id       TEXT,                               -- ticket_contacts.id of kind 'vendor' (the inspector / supplier, or the document's owner)
  doc_type        TEXT,                               -- vendor_document only: insurance | electrician_license | work_at_height | other
  owner_user_id   TEXT,                               -- the responsible person (receives the reminders when they may see the task)
  -- when it is due
  interval_unit   TEXT CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  interval_count  INTEGER CHECK (interval_count IS NULL OR interval_count BETWEEN 1 AND 366),
  anchor_date     TEXT,                               -- the first due date: the fixed schedule is anchor + k x interval
  due_date        TEXT,                               -- the next due date / the valid-until date of a certificate or document
  lead_days       INTEGER NOT NULL DEFAULT 30 CHECK (lead_days BETWEEN 0 AND 365),
  checklist_json  TEXT NOT NULL DEFAULT '[]',         -- [{key, label, kind: check|number|text, required, min?, max?}]
  -- a service request on schedule (only while the tickets module is on)
  auto_ticket     INTEGER NOT NULL DEFAULT 0 CHECK (auto_ticket IN (0, 1)),
  department_id   TEXT,                               -- ticket_departments.id
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  -- the worker's own bookkeeping (idempotence: one reminder level and one request per due date)
  reminded_due    TEXT,
  reminded_level  INTEGER NOT NULL DEFAULT 0,         -- 0 none, 1 due soon, 2 overdue - for reminded_due
  ticket_due      TEXT,                               -- the due date a request was opened for
  ticket_id       TEXT,                               -- that request (tickets.id)
  ticket_error    TEXT,                               -- why the last attempt did not open one (a code, never a message)
  last_done_at    TEXT,
  revision        INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  CHECK ((interval_unit IS NULL) = (interval_count IS NULL)),
  CHECK (kind <> 'vendor_document' OR vendor_id IS NOT NULL)
);
CREATE INDEX idx_maint_tasks_due ON maint_tasks (due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_maint_tasks_elevator ON maint_tasks (elevator_id) WHERE elevator_id IS NOT NULL;
CREATE INDEX idx_maint_tasks_generator ON maint_tasks (generator_id) WHERE generator_id IS NOT NULL;
CREATE INDEX idx_maint_tasks_vendor ON maint_tasks (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_maint_tasks_entity ON maint_tasks (entity_id) WHERE entity_id IS NOT NULL;

-- One completion of a task: a certificate renewed, a plan carried out, a round walked (status 'open' while it is being walked).
CREATE TABLE maint_records (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES maint_tasks(id),
  kind            TEXT NOT NULL CHECK (kind IN ('completion', 'run')),
  status          TEXT NOT NULL CHECK (status IN ('open', 'done', 'cancelled')),
  started_by      TEXT NOT NULL,
  started_by_name TEXT NOT NULL DEFAULT '',
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  performed_on    TEXT,                               -- local date
  due_before      TEXT,
  due_after       TEXT,
  valid_until     TEXT,
  note            TEXT NOT NULL DEFAULT '',
  result          TEXT CHECK (result IN ('ok', 'issues')),
  checklist_json  TEXT NOT NULL DEFAULT '[]',         -- the checklist as it was when the run started
  answers_json    TEXT NOT NULL DEFAULT '{}',         -- {key: {ok, value, note, at}} - the time of each mark, never a position
  ticket_ids_json TEXT NOT NULL DEFAULT '[]',
  revision        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_maint_records_task ON maint_records (task_id, started_at);
CREATE UNIQUE INDEX idx_maint_records_one_open_run ON maint_records (task_id) WHERE status = 'open';

-- A QR / NFC tag: an opaque random token printed on a sticker. It resolves only for a signed-in person who may see its target.
CREATE TABLE maint_tags (
  id           TEXT PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  target_kind  TEXT NOT NULL CHECK (target_kind IN ('task', 'entity')),
  target_id    TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT '',
  medium       TEXT NOT NULL DEFAULT 'qr' CHECK (medium IN ('qr', 'nfc')),  -- slice 2: printed sticker or written NFC tag (same token)
  last_scan_at TEXT,                                                         -- slice 2: when a signed-in person last opened it
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  revoked_at   TEXT,
  revoked_by   TEXT
);
CREATE INDEX idx_maint_tags_target ON maint_tags (target_kind, target_id);

-- MAINT215B (owner review 24.10): the certificate / document FILE of a task - a PDF (checked by the tickets cost-file validator, shown
-- as a download) or a photographed page (re-encoded through the tickets image pipeline). The bytes live on the data volume under
-- <data>/maintenance/<task_id>/; this table is never carried in a project backup (the bytes would be missing after a restore).
CREATE TABLE maint_files (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES maint_tasks(id),
  record_id    TEXT,                                  -- the renewal it was attached to, if any
  kind         TEXT NOT NULL CHECK (kind IN ('pdf', 'image')),
  path         TEXT NOT NULL,                         -- relative to <data>/maintenance
  name         TEXT NOT NULL DEFAULT '',              -- a cleaned display name, never used as a path
  sha256       TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  uploaded_by  TEXT NOT NULL,
  uploaded_at  TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX idx_maint_files_task ON maint_files (task_id) WHERE deleted_at IS NULL;

-- MAINT215B: the reminder log - one row per reminder the worker actually sent (or request it opened), so the manager can see what
-- went out and when. The task title is copied (a deleted task keeps its line); never a person, a phone number or a file.
CREATE TABLE maint_reminder_log (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  task_kind  TEXT NOT NULL,
  event      TEXT NOT NULL CHECK (event IN ('due_soon', 'overdue', 'request', 'request_failed')),
  due_date   TEXT,
  detail     TEXT NOT NULL DEFAULT '',                -- a code (request_failed) or a ticket id (request)
  at         TEXT NOT NULL
);
CREATE INDEX idx_maint_reminder_log_at ON maint_reminder_log (at);
CREATE INDEX idx_maint_reminder_log_task ON maint_reminder_log (task_id);
