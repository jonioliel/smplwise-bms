-- 0207 (T068-INGEST-LOCK-2406): the alert stream's merge lookup without a table scan.
-- store_alert looks for the open row of a camera / kind last seen within the merge window ("COALESCE(ended_at, occurred_at)
-- >= now - DEDUP_WINDOW_S"). No index covered that expression, so every new burst scanned the whole events table under the
-- write lock (the 15.6 h soak: holds up to 17.5 s by events_ingest._write, 27 "database is locked" for other writers).
-- A partial index over the open alert-stream rows, keyed by kind, camera and last-seen time, bounds the lookup to the rows
-- seen inside the window, whatever the size of the table. IF NOT EXISTS: harmless if another branch reuses the number.
CREATE INDEX IF NOT EXISTS idx_events_alert_open ON events (type, COALESCE(camera_id, ''), COALESCE(ended_at, occurred_at))
    WHERE source = 'alertstream' AND state = 'active';
