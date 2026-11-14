-- CAL-ATTENDEES-2343 (owner 2026-11-02, answers 6C + 7B; docs/changes/CAL-ATTENDEES-2343.md): named attendees of a calendar entry, the
-- per-calendar attendee policy and the attendee notice outbox. Number 0190 = the next after the highest on release/2340-train (0189); if
-- another branch departs first the lead re-sequences at assembly (train-departure order, no gaps).
-- Additive only: no existing table is altered. Rollback = DROP the three cal_attendee* tables (nothing else refers to them).
-- Personal data: a GUEST's name, phone and e-mail are sealed (connection_store `v1:`, associated data bound to the attendee id and field)
-- and erased by the retention job on the calendars' guest retention (`guest_retention_days`); users and residents are REFERENCES only
-- (users.id / ticket_contacts.id) - their contact details are read from their own directory at send time and never copied here.

CREATE TABLE cal_attendees (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL,                      -- the entry or series (an override row's attendees are its series')
  kind             TEXT NOT NULL CHECK (kind IN ('user', 'resident', 'guest')),
  ref_id           TEXT,                               -- users.id (user) | ticket_contacts.id of a person (resident); NULL for a guest
  name_sealed      TEXT,                               -- guest only
  phone_sealed     TEXT,                               -- guest only, E.164 digits with '+'
  email_sealed     TEXT,                               -- guest only
  has_phone        INTEGER NOT NULL DEFAULT 0,         -- guest: which contact exists (channel choice and the UI hint without opening the seal)
  has_email        INTEGER NOT NULL DEFAULT 0,
  role             TEXT NOT NULL DEFAULT 'required' CHECK (role IN ('required', 'optional')),
  invite_status    TEXT NOT NULL DEFAULT 'invited' CHECK (invite_status IN ('invited', 'accepted', 'declined', 'tentative')),
  added_by         TEXT NOT NULL,
  added_at         TEXT NOT NULL,
  responded_at     TEXT,
  notified_at      TEXT,                               -- the last notice that reached the attendee (any channel)
  removed_at       TEXT,
  removed_by       TEXT,
  erase_after      TEXT,                               -- guest only: when the sealed contact is destroyed
  erased_at        TEXT,
  revision         INTEGER NOT NULL DEFAULT 1,
  CHECK ((kind = 'guest' AND ref_id IS NULL) OR (kind <> 'guest' AND ref_id IS NOT NULL))
);
CREATE UNIQUE INDEX cal_attendees_live_ref ON cal_attendees(event_id, kind, ref_id) WHERE ref_id IS NOT NULL AND removed_at IS NULL;
CREATE INDEX cal_attendees_event ON cal_attendees(event_id, removed_at);
CREATE INDEX cal_attendees_ref ON cal_attendees(kind, ref_id);
CREATE INDEX cal_attendees_erase ON cal_attendees(erase_after) WHERE kind = 'guest' AND erased_at IS NULL;

CREATE TABLE cal_attendee_policy (                     -- one row per calendar that differs from the defaults (a missing row reads as defaults)
  calendar_id      TEXT PRIMARY KEY REFERENCES cal_calendars(id),
  guests_mode      TEXT NOT NULL DEFAULT 'organizer' CHECK (guests_mode IN ('off', 'organizer', 'anyone')),
  self_join        INTEGER NOT NULL DEFAULT 0 CHECK (self_join IN (0, 1)),
  max_attendees    INTEGER NOT NULL DEFAULT 50 CHECK (max_attendees BETWEEN 1 AND 500),
  notify_on_change INTEGER NOT NULL DEFAULT 1 CHECK (notify_on_change IN (0, 1)),
  list_visibility  TEXT NOT NULL DEFAULT 'organizer' CHECK (list_visibility IN ('organizer', 'attendees', 'viewers')),
  updated_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE cal_attendee_notices (                    -- the outbox: written in the request's transaction, sent by the janitor tick after the commit
  id               TEXT PRIMARY KEY,
  attendee_id      TEXT NOT NULL,
  event_id         TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('invite', 'change', 'cancel', 'removed')),
  occurrence_start TEXT,                               -- the local start of the ONE occurrence a change / cancel is about; NULL = the whole entry
  channel          TEXT,                               -- decided at send time: inapp | whatsapp | sms | email
  state            TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'sent', 'skipped', 'retracted', 'failed')),
  reason           TEXT,
  not_before       TEXT NOT NULL,                      -- a cancel waits the undo window (`cancel_notice_delay_s`, ~6 s)
  attempts         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  done_at          TEXT
);
CREATE INDEX cal_attendee_notices_due ON cal_attendee_notices(state, not_before);
CREATE INDEX cal_attendee_notices_event ON cal_attendee_notices(event_id, state);
