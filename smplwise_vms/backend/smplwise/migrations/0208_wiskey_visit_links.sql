-- WISKEY-VISITS-2407 (card WISKEY-VISITS-2400, owner decision 07.11 option "ב"): Arx's record of what it handed to WisKey's visit
-- mechanism for each Arx visitor invitation (services/wiskey_visits.py). Arx stays the source of truth; this row is the single writer's
-- claim (one push in flight per invitation: the row is claimed `sending` in its own committed transaction BEFORE the frame is sent) and
-- the last known outcome. No name, phone, code, PIN or card is stored here: ids, revisions, WisKey's code and instants only.
-- Number 0208: 0207 is taken by another branch (0207_events_open_alert_index.sql); renumber at the train if needed.
-- Additive only; older code never reads it. Not a backup table: re-creatable by a reconcile read of WisKey's visit list.
-- Rollback: drop the table.

CREATE TABLE IF NOT EXISTS wiskey_visit_links (
  invite_id        TEXT PRIMARY KEY REFERENCES access_visitor_invites(id) ON DELETE CASCADE,
  state            TEXT NOT NULL CHECK (state IN ('sending', 'pushed', 'refused', 'not_sent', 'unknown')),
  sent_revision    INTEGER,                    -- the Arx revision (grant + invitation) of the last frame sent
  pushed_revision  INTEGER,                    -- the Arx revision WisKey last confirmed
  sent_status      TEXT,                       -- the visit status of the last frame (approved | ended)
  wiskey_visit_id  TEXT,                       -- WisKey's visit id, once WisKey answered one
  last_code        TEXT,                       -- WisKey's / the feed's code of the last refusal or unknown outcome
  attempted_by     TEXT,                       -- the Arx user of the last attempt
  attempted_at     TEXT,
  settled_at       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
