-- CAL-GRID-EDIT-2343: Outlook-style editing on the calendar grid (owner answers 02.11, round 13).
--
-- * cal_calendars.approved_move (owner answer 3C, a per-calendar setting): moving or resizing an APPROVED booking in a calendar that would
--   need an approval for the new time: 'reapproval' (default, contract section 7: the change becomes a request, the old slot stays held
--   until the decision and comes back on reject) | 'managers' (only an editor / manager of the calendar changes it; a booker asks him).
-- * cal_events.held_json: the approved slot a pending change request keeps (calendar, instants, local times); NULL when there is none.
--   The occurrence cache carries it as a confirmed row of the pseudo event id '<id>#held', so every conflict check sees it.
-- * cal_events.cancelled_from: the state an entry had before cancel / withdraw, so "בטל" (undo) can restore it within the undo window.
-- * cal_notices: notices to an organizer whose entry someone else cancelled or moved, held back `cancel_notice_delay_s` (default 6 s) so an
--   undo inside that time withdraws the notice before it is sent (never "cancelled" followed by "booked again").
ALTER TABLE cal_calendars ADD COLUMN approved_move TEXT NOT NULL DEFAULT 'reapproval';
ALTER TABLE cal_events ADD COLUMN held_json TEXT;
ALTER TABLE cal_events ADD COLUMN cancelled_from TEXT;

CREATE TABLE cal_notices (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL,
  kind              TEXT NOT NULL,          -- calendar.booking.cancelled | calendar.booking.changed
  recipient_user_id TEXT NOT NULL,
  actor_user_id     TEXT,
  payload_json      TEXT NOT NULL DEFAULT '{}',  -- ids and instants only, never a title or a name
  created_at        TEXT NOT NULL,
  due_at            TEXT NOT NULL,
  sent_at           TEXT,
  withdrawn_at      TEXT
);
CREATE INDEX cal_notices_due ON cal_notices(due_at) WHERE sent_at IS NULL AND withdrawn_at IS NULL;
CREATE INDEX cal_notices_event ON cal_notices(event_id);
