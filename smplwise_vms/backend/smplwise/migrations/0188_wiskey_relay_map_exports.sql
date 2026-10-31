-- WISKEY-RELAYEXPORT-2320: the numbered, sealed export log of the WisKey relay map snapshot (services/wiskey_relay_map_export.py).
-- Arx is the source of the relay map counters (agreed with the WisKey Windows team 31.10): an export seals the FULL map (inactive
-- tombstones with their physical relay, the api relays without a row) as canonical JSON with its sha256 content digest under a
-- monotonic number that is never reused (AUTOINCREMENT). The map tables themselves are never written by an export, an ack or a rollback.
-- Number 0188: the next free number on pilot/WISKEY-RELAYMAP-2310 (ends at 0187). Additive only; older code never reads it.
-- Rollback of the migration: drop the table and the triggers - the relay map rows stay valid. Not a backup table
-- (services/backup.py NEVER_EXPORTED_TABLES, as the relay map itself). Ids and user ids only.

CREATE TABLE IF NOT EXISTS wiskey_relay_map_exports (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL CHECK (kind IN ('export', 'rollback')),
  rollback_of     INTEGER REFERENCES wiskey_relay_map_exports(seq),
  content_digest  TEXT NOT NULL CHECK (length(content_digest) = 71 AND substr(content_digest, 1, 7) = 'sha256:'),
  snapshot_json   TEXT NOT NULL,                      -- canonical JSON (sorted keys, no whitespace, UTF-8) of the snapshot
  exported_by     TEXT NOT NULL,                      -- the Arx user / service id that sealed it; never a token
  exported_at     TEXT NOT NULL,
  acked_by        TEXT,
  acked_at        TEXT,
  CHECK ((kind = 'rollback') = (rollback_of IS NOT NULL)),
  CHECK ((acked_by IS NULL) = (acked_at IS NULL))
);

-- An export record is never deleted and its sealed content never rewritten; the only change is the one-time ack.
CREATE TRIGGER IF NOT EXISTS wiskey_relay_map_exports_kept BEFORE DELETE ON wiskey_relay_map_exports
BEGIN SELECT RAISE(ABORT, 'wiskey_relay_map_exports is append-only'); END;

CREATE TRIGGER IF NOT EXISTS wiskey_relay_map_exports_sealed BEFORE UPDATE ON wiskey_relay_map_exports
WHEN NEW.seq IS NOT OLD.seq OR NEW.kind IS NOT OLD.kind OR NEW.rollback_of IS NOT OLD.rollback_of OR NEW.content_digest IS NOT OLD.content_digest
  OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.exported_by IS NOT OLD.exported_by OR NEW.exported_at IS NOT OLD.exported_at
  OR OLD.acked_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'wiskey_relay_map_exports record is sealed'); END;

-- The relay map itself: an inactive tombstone is never deleted, and a row revision (the value WisKey grants carry as
-- mapping_revision) only ever moves forward.
CREATE TRIGGER IF NOT EXISTS wiskey_relay_map_tombstone_kept BEFORE DELETE ON wiskey_relay_map
WHEN OLD.active = 0
BEGIN SELECT RAISE(ABORT, 'wiskey_relay_map tombstone is kept'); END;

CREATE TRIGGER IF NOT EXISTS wiskey_relay_map_revision_forward BEFORE UPDATE OF revision ON wiskey_relay_map
WHEN NEW.revision <= OLD.revision
BEGIN SELECT RAISE(ABORT, 'wiskey_relay_map row revision only moves forward'); END;
