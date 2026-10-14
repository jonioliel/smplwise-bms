-- CR-038 slice 1 (docs/changes/CR-038-TICKETS-MODULE.md section 7.1): the core tables of the optional tickets module
-- (departments, members, priorities, categories, SLA rules, templates, the running number, tickets, assignments, the
-- timeline, attachments, the device-history snapshot, request idempotency and saved views). Additive only: nothing here is
-- read while the module switch `tickets.enabled` is off. Later slices add 0080 (contacts, links), 0081 (messaging),
-- 0082 (messaging accounts) and 0083 (cost claims). One department ("אחזקה") is seeded with its four priorities and the
-- default SLA matrix of section 13.1 (minutes; NULL = threshold off).

CREATE TABLE ticket_departments (
  id                    TEXT PRIMARY KEY,
  key                   TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  icon                  TEXT,
  color                 TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  active                INTEGER NOT NULL DEFAULT 1,
  auto_close_after_days INTEGER,
  share_history_external INTEGER NOT NULL DEFAULT 0,
  urgent_is_critical    INTEGER,
  link_sliding_days     INTEGER,
  link_cap_days         INTEGER,
  link_grace_hours      INTEGER,
  send_hours_json       TEXT,
  reopen_days           INTEGER NOT NULL DEFAULT 14,
  open_to_all           INTEGER NOT NULL DEFAULT 1,
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);
CREATE UNIQUE INDEX idx_ticket_departments_key ON ticket_departments (key) WHERE deleted_at IS NULL;

CREATE TABLE ticket_department_members (
  department_id TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('user', 'group')),
  subject_id    TEXT NOT NULL,
  member_role   TEXT NOT NULL CHECK (member_role IN ('manager', 'member')),
  notify_new    INTEGER NOT NULL DEFAULT 0,
  added_by      TEXT NOT NULL,
  added_at      TEXT NOT NULL,
  PRIMARY KEY (department_id, subject_kind, subject_id)
);
CREATE INDEX idx_ticket_members_subject ON ticket_department_members (subject_kind, subject_id);

CREATE TABLE ticket_priorities (
  id              TEXT PRIMARY KEY,
  department_id   TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  key             TEXT NOT NULL CHECK (key IN ('urgent', 'high', 'normal', 'low')),
  name            TEXT NOT NULL,
  rank            INTEGER NOT NULL,
  notify_severity TEXT NOT NULL CHECK (notify_severity IN ('info', 'alert', 'critical')),
  is_default      INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (department_id, key)
);

CREATE TABLE ticket_categories (
  id                  TEXT PRIMARY KEY,
  department_id       TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  parent_id           TEXT REFERENCES ticket_categories(id),
  name                TEXT NOT NULL,
  default_priority_id TEXT REFERENCES ticket_priorities(id),
  domains_json        TEXT NOT NULL DEFAULT '[]',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 1,
  deleted_at          TEXT
);
CREATE INDEX idx_ticket_categories_dept ON ticket_categories (department_id, sort_order);

CREATE TABLE ticket_sla_rules (
  department_id             TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  priority_id               TEXT NOT NULL REFERENCES ticket_priorities(id) ON DELETE CASCADE,
  unassigned_after_min      INTEGER,
  link_unopened_min         INTEGER,
  ack_within_min            INTEGER,
  stuck_after_min           INTEGER,
  stuck_waiting_min         INTEGER,
  resolve_within_min        INTEGER,
  remind_every_min          INTEGER,
  max_reminders             INTEGER NOT NULL DEFAULT 2,
  manager_alert_after_steps INTEGER NOT NULL DEFAULT 1,
  revision                  INTEGER NOT NULL DEFAULT 1,
  updated_by                TEXT,
  updated_at                TEXT NOT NULL,
  PRIMARY KEY (department_id, priority_id)
);

CREATE TABLE ticket_templates (
  id            TEXT PRIMARY KEY,
  department_id TEXT REFERENCES ticket_departments(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('ticket', 'message')),
  purpose       TEXT,
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  category_id   TEXT REFERENCES ticket_categories(id),
  priority_key  TEXT,
  lang          TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),
  active        INTEGER NOT NULL DEFAULT 1,
  revision      INTEGER NOT NULL DEFAULT 1,
  updated_by    TEXT,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_ticket_templates_dept ON ticket_templates (department_id, kind);

CREATE TABLE ticket_sequence (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

CREATE TABLE tickets (
  id                    TEXT PRIMARY KEY,
  number                INTEGER NOT NULL UNIQUE,
  department_id         TEXT NOT NULL REFERENCES ticket_departments(id),
  category_id           TEXT REFERENCES ticket_categories(id),
  priority_id           TEXT NOT NULL REFERENCES ticket_priorities(id),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL CHECK (status IN ('new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part',
                                                         'done', 'returned', 'closed', 'cancelled')),
  origin                TEXT NOT NULL CHECK (origin IN ('manual', 'device', 'rule', 'inbound')),
  entity_id             TEXT,
  registry_id           TEXT,
  device_name           TEXT,
  site_id               TEXT, building_id TEXT, floor_id TEXT, zone_id TEXT, area_id TEXT,
  place_text            TEXT NOT NULL DEFAULT '',
  created_by            TEXT NOT NULL,
  created_by_name       TEXT NOT NULL DEFAULT '',
  assigner_user_id      TEXT,
  current_assignment_id TEXT,
  eta_at                TEXT,
  ack_due_at            TEXT, stuck_due_at TEXT, resolve_due_at TEXT,
  last_activity_at      TEXT NOT NULL,
  last_external_activity_at TEXT,
  waiting_on            TEXT NOT NULL DEFAULT 'manager' CHECK (waiting_on IN ('manager', 'assignee', 'none')),
  waiting_reason        TEXT,
  stuck_level           INTEGER NOT NULL DEFAULT 0,
  stuck_kind            TEXT,
  reminders_sent        INTEGER NOT NULL DEFAULT 0,
  next_check_at         TEXT,
  rule_ref              TEXT,
  dedupe_key            TEXT,
  duplicate_of          TEXT REFERENCES tickets(id),
  reopen_count          INTEGER NOT NULL DEFAULT 0,
  external_stale        INTEGER NOT NULL DEFAULT 0,
  done_at               TEXT,
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  closed_at             TEXT,
  closed_by             TEXT,
  close_note            TEXT,
  purge_after           TEXT
);
CREATE INDEX idx_tickets_dept_status ON tickets (department_id, status, last_activity_at);
CREATE INDEX idx_tickets_open_check ON tickets (next_check_at) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_entity ON tickets (entity_id, created_at DESC);
CREATE INDEX idx_tickets_registry ON tickets (registry_id, created_at DESC);
CREATE INDEX idx_tickets_waiting ON tickets (waiting_on, department_id) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_created_by ON tickets (created_by, created_at DESC);
CREATE INDEX idx_tickets_purge ON tickets (purge_after) WHERE purge_after IS NOT NULL;
CREATE UNIQUE INDEX idx_tickets_open_dedupe ON tickets (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status NOT IN ('closed', 'cancelled');

CREATE TABLE ticket_assignments (
  id               TEXT PRIMARY KEY,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignee_kind    TEXT NOT NULL CHECK (assignee_kind IN ('user', 'contact')),
  user_id          TEXT,
  contact_id       TEXT,
  assignee_name    TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('inapp', 'whatsapp', 'email', 'manual')),
  assigned_by      TEXT NOT NULL,
  assigned_at      TEXT NOT NULL,
  acknowledged_at  TEXT,
  last_update_at   TEXT,
  ended_at         TEXT,
  end_reason       TEXT CHECK (end_reason IN ('reassigned', 'returned', 'closed', 'cancelled')),
  return_kind      TEXT CHECK (return_kind IN ('cannot_handle', 'not_mine')),
  return_reason    TEXT,
  share_history    INTEGER NOT NULL DEFAULT 0,
  require_code     INTEGER NOT NULL DEFAULT 0,
  CHECK ((assignee_kind = 'user' AND user_id IS NOT NULL) OR (assignee_kind = 'contact' AND contact_id IS NOT NULL))
);
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments (ticket_id, assigned_at);
CREATE INDEX idx_ticket_assignments_user ON ticket_assignments (user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_ticket_assignments_contact ON ticket_assignments (contact_id) WHERE ended_at IS NULL;

CREATE TABLE ticket_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  at               TEXT NOT NULL,
  kind             TEXT NOT NULL,
  actor_kind       TEXT NOT NULL CHECK (actor_kind IN ('user', 'contact', 'system', 'inbound')),
  actor_user_id    TEXT,
  actor_contact_id TEXT,
  actor_name       TEXT NOT NULL DEFAULT '',
  assignment_id    TEXT,
  from_status      TEXT,
  to_status        TEXT,
  body             TEXT,
  data_json        TEXT NOT NULL DEFAULT '{}',
  via              TEXT NOT NULL CHECK (via IN ('app', 'link', 'whatsapp', 'email', 'system')),
  visible_external INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_events_ticket ON ticket_events (ticket_id, id);

CREATE TABLE ticket_requests (
  scope              TEXT NOT NULL,
  client_request_id  TEXT NOT NULL,
  route              TEXT NOT NULL,
  status_code        INTEGER NOT NULL,
  response_json      TEXT NOT NULL,
  at                 TEXT NOT NULL,
  PRIMARY KEY (scope, client_request_id)
);
CREATE INDEX idx_ticket_requests_at ON ticket_requests (at);

CREATE TABLE ticket_saved_views (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  view_json   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_ticket_saved_views_user ON ticket_saved_views (user_id);
CREATE INDEX idx_tickets_sort_activity ON tickets (last_activity_at DESC, id);
CREATE INDEX idx_tickets_sort_created ON tickets (created_at DESC, id);

CREATE TABLE ticket_attachments (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_id        INTEGER,
  kind            TEXT NOT NULL CHECK (kind IN ('photo')),
  path            TEXT NOT NULL,
  sha256          TEXT NOT NULL,
  bytes           INTEGER NOT NULL,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  uploaded_by_kind TEXT NOT NULL CHECK (uploaded_by_kind IN ('user', 'contact')),
  uploaded_by     TEXT NOT NULL,
  visible_external INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  deleted_at      TEXT,
  deleted_by      TEXT
);
CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments (ticket_id, created_at);

CREATE TABLE ticket_device_context (
  ticket_id     TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  entity_id     TEXT NOT NULL,
  captured_at   TEXT NOT NULL,
  window_from   TEXT NOT NULL,
  window_to     TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('device_activity', 'state_history', 'none')),
  items_json    TEXT NOT NULL DEFAULT '[]',
  coverage_json TEXT NOT NULL DEFAULT '{}',
  truncated     INTEGER NOT NULL DEFAULT 0,
  withheld      TEXT
);

-- seeds: the running number (the first ticket is #1001) and the "אחזקה" department with its priorities and SLA matrix
INSERT INTO ticket_sequence (name, value) VALUES ('ticket', 1000);

INSERT INTO ticket_departments (id, key, name, description, icon, color, sort_order, active, reopen_days, open_to_all, revision, created_at, updated_at)
VALUES ('dept-maintenance', 'maintenance', 'אחזקה', '', 'wrench', NULL, 0, 1, 14, 1, 1,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

INSERT INTO ticket_priorities (id, department_id, key, name, rank, notify_severity, is_default, active) VALUES
  ('prio-maintenance-urgent', 'dept-maintenance', 'urgent', 'דחופה', 0, 'critical', 0, 1),
  ('prio-maintenance-high',   'dept-maintenance', 'high',   'גבוהה', 1, 'alert',    0, 1),
  ('prio-maintenance-normal', 'dept-maintenance', 'normal', 'רגילה', 2, 'alert',    1, 1),
  ('prio-maintenance-low',    'dept-maintenance', 'low',    'נמוכה', 3, 'info',     0, 1);

INSERT INTO ticket_sla_rules (department_id, priority_id, unassigned_after_min, link_unopened_min, ack_within_min, stuck_after_min,
                              stuck_waiting_min, resolve_within_min, remind_every_min, max_reminders, manager_alert_after_steps,
                              revision, updated_by, updated_at) VALUES
  ('dept-maintenance', 'prio-maintenance-urgent',   15, 1440,   30,    60,  1440,   480,   30, 2, 1, 1, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('dept-maintenance', 'prio-maintenance-high',     60, 1440,  120,   480,  4320,  2880,  240, 2, 1, 1, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('dept-maintenance', 'prio-maintenance-normal',  240, 1440, 1440,  4320, 10080, 10080, 1440, 2, 1, 1, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('dept-maintenance', 'prio-maintenance-low',    1440, 1440, 4320, 10080, 20160, 43200, 4320, 2, 1, 1, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
