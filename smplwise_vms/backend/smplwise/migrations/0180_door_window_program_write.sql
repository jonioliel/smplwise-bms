-- Number 0180 (built as PROVISIONAL on pilot/DOORWRITE-297 from pilot/SPLITSWITCH-297 where 0179 is the highest; another branch may take
-- the same number - renumber at integration). The content does not depend on the number.
-- DOORWRITE-297 (docs/changes/DOORWRITE-297.md, board r129): the door-window program write path to WisKey - versioned writes, read-back
-- verification, drift detection and bounded retries. Per door, on the existing `door_window_engine` row:
--   write_state     idle | written | verified | retry_wait | failed | drift | foreign | blocked | invalid | prepared (NULL = never evaluated)
--   write_attempts  failed write attempts since the last success (reset to 0 by a verified write or by a person's "write again")
--   next_attempt_at the instant (UTC ISO) before which the sync does not try this door again (NULL = no wait)
--   verified_at     the last instant a read of the engine proved that it holds exactly what Arx wrote
--   drift_at        the instant a read found the engine's program different from what Arx wrote (NULL = no drift open)
--   drift_kind      missing | disabled | changed | foreign (why the drift was declared)
--   program_version Arx's own counter of programs written to this door (+1 per write the read-back proved)
-- Additive only: earlier code never reads the columns and ignores them. Rollback = run the previous version (the columns stay unused);
-- dropping them is optional (`ALTER TABLE door_window_engine DROP COLUMN ...`, SQLite >= 3.35).
ALTER TABLE door_window_engine ADD COLUMN write_state TEXT;
ALTER TABLE door_window_engine ADD COLUMN write_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE door_window_engine ADD COLUMN next_attempt_at TEXT;
ALTER TABLE door_window_engine ADD COLUMN verified_at TEXT;
ALTER TABLE door_window_engine ADD COLUMN drift_at TEXT;
ALTER TABLE door_window_engine ADD COLUMN drift_kind TEXT;
ALTER TABLE door_window_engine ADD COLUMN program_version INTEGER NOT NULL DEFAULT 0;
