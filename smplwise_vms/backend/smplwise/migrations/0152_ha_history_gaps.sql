-- CR-TIMESCRUB101 slice 1 (board r101), PROVISIONAL number 0152 (renumber at integration if another branch takes it): the stretches
-- when the local Home Assistant state history was NOT fed (the HA sync was disconnected or the add-on was down for more than 60 s).
-- Written when the sync (re)connects after such a stretch (services/ha_history.note_connect_gap), pruned with the history itself.
-- Without it the historical map cannot tell "nothing changed" from "Arx was not listening": a state is never carried across a gap.
-- Additive: dropping the table is the down path; no existing row is rewritten.

CREATE TABLE ha_state_history_gaps (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  from_utc  TEXT NOT NULL,                 -- the last state the mirror had seen before the stretch (UTC ...Z)
  to_utc    TEXT NOT NULL,                 -- the (re)connection
  reason    TEXT NOT NULL DEFAULT 'disconnected'
);
CREATE INDEX idx_ha_history_gaps_to ON ha_state_history_gaps (to_utc);
