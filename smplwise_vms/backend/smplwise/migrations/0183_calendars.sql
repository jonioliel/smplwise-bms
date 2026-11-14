-- CALENDARS-298 phase 1 (docs/changes/CALENDARS-CONTRACT-298.md, section 3 and 14): calendars, events and bookings, per-calendar roles, the approval
-- log, sealed guest details, the occurrence cache and the (empty until phases 4-6) sync tables. Number 0183 (renumbered from a provisional 0190 at the 2.28.0 train; train-departure order, no gaps).
-- (if another branch departs first the lead re-sequences at assembly).
-- Additive only: no existing table is altered. The module is OFF after this migration (`calendar.settings` is not written; a missing document
-- reads as defaults with enabled=false). Instants are UTC ISO-8601 text. cal_events.visitor_invite_id is a plain text column (no FK) so the
-- rollback (DROP the cal_* tables) leaves nothing behind.

CREATE TABLE cal_calendars (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  name_key         TEXT NOT NULL,                      -- case-folded name, unique among non-archived calendars
  type             TEXT NOT NULL CHECK (type IN ('room', 'team', 'maintenance', 'event')),
  description      TEXT NOT NULL DEFAULT '',
  color            TEXT NOT NULL,                      -- a palette KEY (blue rose cyan orange violet brown magenta slate); never green
  tz               TEXT NOT NULL,
  owner_user_id    TEXT NOT NULL,
  area_ref         TEXT,
  floor_id         TEXT,
  capacity         INTEGER,
  equipment_json   TEXT NOT NULL DEFAULT '[]',
  conflict_policy  TEXT NOT NULL CHECK (conflict_policy IN ('exclusive', 'overlap')),
  buffer_before_min INTEGER NOT NULL DEFAULT 0,
  buffer_after_min  INTEGER NOT NULL DEFAULT 0,
  slot_step_min    INTEGER NOT NULL DEFAULT 15,
  min_minutes      INTEGER,
  max_minutes      INTEGER,
  lead_min         INTEGER NOT NULL DEFAULT 0,
  horizon_days     INTEGER NOT NULL DEFAULT 180,
  hours_mode       TEXT NOT NULL DEFAULT 'always' CHECK (hours_mode IN ('always', 'working_hours', 'custom')),
  hours_json       TEXT,
  holiday_rule     TEXT NOT NULL DEFAULT 'warn' CHECK (holiday_rule IN ('ignore', 'closed', 'warn')),
  approval_mode    TEXT NOT NULL DEFAULT 'none' CHECK (approval_mode IN ('none', 'always', 'outside_hours', 'on_behalf')),
  approval_timeout_h INTEGER DEFAULT 2,
  overlap_override TEXT CHECK (overlap_override IS NULL OR overlap_override IN ('first_holds', 'override_notify', 'block', 'ask')),
  visibility       TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('members', 'busy_to_all', 'details_to_all')),
  sync_binding_id  TEXT,
  kiosk_visible    INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  archived_at      TEXT,
  revision         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX cal_calendars_name_live ON cal_calendars(name_key) WHERE archived_at IS NULL;

CREATE TABLE cal_events (
  id               TEXT PRIMARY KEY,
  calendar_id      TEXT NOT NULL REFERENCES cal_calendars(id),
  kind             TEXT NOT NULL CHECK (kind IN ('booking', 'event', 'maintenance', 'ticket_visit', 'maint_task', 'external', 'block')),
  title            TEXT NOT NULL,
  notes            TEXT NOT NULL DEFAULT '',
  starts_at        TEXT NOT NULL,
  ends_at          TEXT NOT NULL,
  all_day          INTEGER NOT NULL DEFAULT 0,
  tz               TEXT NOT NULL,
  local_start      TEXT NOT NULL,                      -- wall clock YYYY-MM-DDTHH:MM in tz (recurrence anchor)
  local_end        TEXT NOT NULL,
  rrule            TEXT,
  series_until     TEXT,
  exdates_json     TEXT NOT NULL DEFAULT '[]',         -- local start datetimes removed from the series
  holiday_skip     INTEGER NOT NULL DEFAULT 0,
  override_of      TEXT,                               -- the series id this row replaces one occurrence of
  override_start   TEXT,                               -- the ORIGINAL local start of that occurrence (RECURRENCE-ID)
  state            TEXT NOT NULL CHECK (state IN ('pending', 'confirmed', 'rejected', 'withdrawn', 'expired', 'cancelled', 'displaced', 'done')),
  contested        INTEGER NOT NULL DEFAULT 0,         -- C2: pending because another confirmed entry held the window
  organizer_user_id TEXT NOT NULL,
  on_behalf_kind   TEXT NOT NULL DEFAULT 'self' CHECK (on_behalf_kind IN ('self', 'team', 'class', 'customer', 'department', 'vendor')),
  on_behalf_label  TEXT,
  headcount        INTEGER,
  equipment_req_json TEXT NOT NULL DEFAULT '[]',
  maint_overlap_mode TEXT,
  expected_deviation_json TEXT,
  source           TEXT NOT NULL DEFAULT 'arx' CHECK (source IN ('arx', 'ics', 'google', 'microsoft', 'ticket', 'maintenance')),
  source_ref       TEXT,
  sync_flag        TEXT,                               -- C9: 'conflict' when an external change collided with an Arx entry (phase 5)
  visitor_invite_id TEXT,                              -- D9: always NULL in phases 1-7
  automation_hold  INTEGER NOT NULL DEFAULT 0,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX cal_events_cal_start ON cal_events(calendar_id, starts_at);
CREATE INDEX cal_events_cal_until ON cal_events(calendar_id, series_until);
CREATE INDEX cal_events_state ON cal_events(state);
CREATE INDEX cal_events_override ON cal_events(override_of);

CREATE TABLE cal_event_rooms (
  event_id         TEXT NOT NULL REFERENCES cal_events(id),
  room_calendar_id TEXT NOT NULL REFERENCES cal_calendars(id),
  state            TEXT NOT NULL CHECK (state IN ('pending', 'confirmed', 'rejected', 'withdrawn', 'expired', 'cancelled', 'displaced', 'done')),
  contested        INTEGER NOT NULL DEFAULT 0,
  decided_by       TEXT,
  decided_at       TEXT,
  decision_note    TEXT,
  PRIMARY KEY (event_id, room_calendar_id)
);
CREATE INDEX cal_event_rooms_room ON cal_event_rooms(room_calendar_id, state);

CREATE TABLE cal_members (
  calendar_id      TEXT NOT NULL REFERENCES cal_calendars(id),
  subject_kind     TEXT NOT NULL CHECK (subject_kind IN ('user', 'role', 'department', 'everyone')),
  subject_id       TEXT NOT NULL,
  cal_role         TEXT NOT NULL CHECK (cal_role IN ('view', 'book', 'edit', 'manage')),
  added_by         TEXT NOT NULL,
  added_at         TEXT NOT NULL,
  PRIMARY KEY (calendar_id, subject_kind, subject_id)
);
CREATE INDEX cal_members_subject ON cal_members(subject_kind, subject_id);

CREATE TABLE cal_approvals (                           -- append-only decision log
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL,
  room_calendar_id TEXT,
  action           TEXT NOT NULL CHECK (action IN ('request', 'approve', 'reject', 'withdraw', 'expire', 'reopen', 'displace')),
  actor_user_id    TEXT,
  note             TEXT NOT NULL DEFAULT '',
  at               TEXT NOT NULL
);
CREATE INDEX cal_approvals_event ON cal_approvals(event_id);

CREATE TABLE cal_guest_details (                       -- personal data, sealed (connection_store `v1:` format), separate on purpose (D10)
  event_id         TEXT NOT NULL,
  seq              INTEGER NOT NULL,
  name_sealed      TEXT,
  phone_sealed     TEXT,
  erase_after      TEXT NOT NULL,
  erased_at        TEXT,
  PRIMARY KEY (event_id, seq)
);
CREATE INDEX cal_guest_due ON cal_guest_details(erase_after) WHERE erased_at IS NULL;

CREATE TABLE cal_occurrences (                         -- a rebuildable cache of expanded occurrences; never the source of truth
  event_id         TEXT NOT NULL,
  holder_calendar_id TEXT NOT NULL,                    -- the calendar whose time this occupies (home or a held room)
  room_calendar_id TEXT,                               -- NULL = the home half
  occ_start        TEXT NOT NULL,
  occ_end          TEXT NOT NULL,
  local_start      TEXT NOT NULL,
  state            TEXT NOT NULL,
  PRIMARY KEY (event_id, holder_calendar_id, local_start)
);
CREATE INDEX cal_occ_holder ON cal_occurrences(holder_calendar_id, occ_start);
CREATE INDEX cal_occ_range ON cal_occurrences(occ_start, occ_end);

-- Sync tables (phases 4-6): created now so the model is stable; nothing writes them in phase 1.
CREATE TABLE cal_connections (
  id               TEXT PRIMARY KEY,
  provider         TEXT NOT NULL CHECK (provider IN ('ics_out', 'ics_in', 'google', 'microsoft')),
  label            TEXT NOT NULL,
  owner_user_id    TEXT NOT NULL,
  account_hint     TEXT,
  token_ref        TEXT,
  scope            TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'read_write')),
  state            TEXT NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'needs_reauth', 'error', 'paused', 'revoked')),
  last_sync_at     TEXT,
  next_sync_at     TEXT,
  error_code       TEXT,
  error_text       TEXT,
  created_at       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE cal_sync_bindings (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES cal_connections(id),
  calendar_id      TEXT NOT NULL UNIQUE REFERENCES cal_calendars(id),
  external_calendar_id_sealed TEXT,
  direction        TEXT NOT NULL CHECK (direction IN ('export', 'import', 'two_way')),
  detail           TEXT NOT NULL DEFAULT 'busy' CHECK (detail IN ('busy', 'titles', 'details')),
  dedicated        INTEGER NOT NULL DEFAULT 0,
  sync_token_sealed TEXT,
  created_by       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1,
  CHECK (direction <> 'two_way' OR dedicated = 1)
);
CREATE TABLE cal_sync_map (
  event_id         TEXT NOT NULL,
  binding_id       TEXT NOT NULL,
  ext_uid          TEXT NOT NULL,
  ext_etag         TEXT,
  last_pushed_revision INTEGER,
  last_pulled_at   TEXT,
  origin           TEXT NOT NULL CHECK (origin IN ('arx', 'external')),
  PRIMARY KEY (binding_id, ext_uid),
  UNIQUE (event_id, binding_id)
);
CREATE TABLE cal_feeds (
  id               TEXT PRIMARY KEY,
  calendar_ids_json TEXT NOT NULL,
  detail           TEXT NOT NULL DEFAULT 'busy' CHECK (detail IN ('busy', 'titles')),
  token_hash       TEXT NOT NULL,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  last_used_at     TEXT,
  revoked_at       TEXT
);
