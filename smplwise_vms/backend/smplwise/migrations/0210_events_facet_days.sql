-- 0210 (SOAK-DBGROWTH-2412): per-day facet counts of the events table, so GET /events/facets no longer scans every row.
-- The facets count the events of the last `days` (90 by default) per type / source / severity / camera. That was one
-- GROUP BY over every row of the period: ~490 ms at 677k rows in the 17.7 h soak (docs/changes/SOAK-DBGROWTH-2412.md),
-- linear in the table, and recomputed on almost every call because any new row invalidates the cached answer. Each
-- operator screen asks for it, so the API p95 rose with the database size while the host was idle.
-- events_facet_days holds the same counts per UTC day (the first ten characters of occurred_at). Triggers keep it in the
-- SAME transaction as every insert, delete and facet-column update of an event (the alert stream, the recording
-- derivation, HA transitions, pruning, a restore), like the cache counters of 0031. The facets read whole days from it
-- and count only the first, partial day from the events table (routers/events.py, _facet_rows): the same numbers, bounded
-- by one day of events instead of the whole period. camera_key is '' for an event without a camera (a primary key column
-- cannot hold NULL); readers turn it back into NULL. A later migration that rebuilds the events table must recreate the
-- triggers below (and 0031's).
CREATE TABLE IF NOT EXISTS events_facet_days (
  day        TEXT NOT NULL,              -- substr(occurred_at, 1, 10): the UTC day
  type       TEXT NOT NULL,
  source     TEXT NOT NULL,
  severity   TEXT NOT NULL,
  camera_key TEXT NOT NULL,              -- COALESCE(camera_id, '')
  n          INTEGER NOT NULL,
  PRIMARY KEY (day, type, source, severity, camera_key)
) WITHOUT ROWID;

DELETE FROM events_facet_days;
INSERT INTO events_facet_days(day, type, source, severity, camera_key, n)
  SELECT substr(occurred_at, 1, 10), type, source, severity, COALESCE(camera_id, ''), COUNT(*) FROM events GROUP BY 1, 2, 3, 4, 5;

CREATE TRIGGER IF NOT EXISTS trg_efd_events_ins AFTER INSERT ON events BEGIN
  INSERT INTO events_facet_days(day, type, source, severity, camera_key, n)
    VALUES (substr(NEW.occurred_at, 1, 10), NEW.type, NEW.source, NEW.severity, COALESCE(NEW.camera_id, ''), 1)
    ON CONFLICT(day, type, source, severity, camera_key) DO UPDATE SET n = n + 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_efd_events_del AFTER DELETE ON events BEGIN
  UPDATE events_facet_days SET n = n - 1
    WHERE day = substr(OLD.occurred_at, 1, 10) AND type = OLD.type AND source = OLD.source AND severity = OLD.severity AND camera_key = COALESCE(OLD.camera_id, '');
  DELETE FROM events_facet_days
    WHERE day = substr(OLD.occurred_at, 1, 10) AND type = OLD.type AND source = OLD.source AND severity = OLD.severity AND camera_key = COALESCE(OLD.camera_id, '') AND n <= 0;
END;

CREATE TRIGGER IF NOT EXISTS trg_efd_events_upd AFTER UPDATE OF type, source, severity, camera_id, occurred_at ON events
  WHEN substr(OLD.occurred_at, 1, 10) IS NOT substr(NEW.occurred_at, 1, 10) OR OLD.type IS NOT NEW.type OR OLD.source IS NOT NEW.source
    OR OLD.severity IS NOT NEW.severity OR OLD.camera_id IS NOT NEW.camera_id
BEGIN
  UPDATE events_facet_days SET n = n - 1
    WHERE day = substr(OLD.occurred_at, 1, 10) AND type = OLD.type AND source = OLD.source AND severity = OLD.severity AND camera_key = COALESCE(OLD.camera_id, '');
  DELETE FROM events_facet_days
    WHERE day = substr(OLD.occurred_at, 1, 10) AND type = OLD.type AND source = OLD.source AND severity = OLD.severity AND camera_key = COALESCE(OLD.camera_id, '') AND n <= 0;
  INSERT INTO events_facet_days(day, type, source, severity, camera_key, n)
    VALUES (substr(NEW.occurred_at, 1, 10), NEW.type, NEW.source, NEW.severity, COALESCE(NEW.camera_id, ''), 1)
    ON CONFLICT(day, type, source, severity, camera_key) DO UPDATE SET n = n + 1;
END;
