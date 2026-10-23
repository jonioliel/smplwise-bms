-- VENDORARRIVAL126-295 (board r126 / r127), PROVISIONAL number 0190 (main ends 0151; release/2150 uses 0152-0159, 0165, 0175 provisional
-- ones elsewhere) - renumber at the integration that merges this branch.
--
-- The vendor's one-tap "I have arrived" signal on his public handler page, and the state of the missed-arrival alert. One row per
-- external assignment, created by the first tap or by the first missed-arrival alert. Ids and times only: no name, no number, no text.
-- The feature switch and every window / reminder / recipient value live in the `tickets.settings` document (block `vendor_arrival`,
-- default OFF); nothing here opens a door - a door code is still requested only through the access approval flow (access_arrival.py).
CREATE TABLE ticket_vendor_arrivals (
  assignment_id   TEXT PRIMARY KEY REFERENCES ticket_assignments(id) ON DELETE CASCADE,
  ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  contact_id      TEXT,
  arrived_at      TEXT,                                   -- the vendor's tap (UTC); NULL = not arrived (yet)
  arrived_via     TEXT CHECK (arrived_via IN ('vendor_tap')),
  missed_at       TEXT,                                   -- the first missed-arrival alert of the current window; NULL = none
  alerts_sent     INTEGER NOT NULL DEFAULT 0 CHECK (alerts_sent >= 0),
  last_alert_at   TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_ticket_vendor_arrivals_ticket ON ticket_vendor_arrivals (ticket_id);
