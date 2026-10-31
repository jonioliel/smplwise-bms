-- WISKEY-RELAYMAP-2310: the station revision of the WisKey relay map (services/wiskey_relay_map.py, routers/wiskey_relay_map.py).
-- `wiskey_relay_map` (0145) keeps one row per (station, api relay) with its own row revision, which WisKey grants carry as
-- `mapping_revision`. The approval screen saves a whole station at once, so one row here per station is the compare-and-set guard of
-- that save (a stale revision is refused, nothing written) and records who approved it last and when (the full before / after is in
-- the audit log, `wiskey.relay_map.approved`). Number 0187: the next free number on pilot/WISKEY-RC4-2310 (ends at 0186; origin/main
-- ends at 0185). Additive only; older code never reads it. Rollback: drop the table - the relay map rows themselves stay valid.
-- Not a backup table (services/backup.py NEVER_EXPORTED_TABLES, as the relay map itself). Ids and user ids only.

CREATE TABLE IF NOT EXISTS wiskey_relay_map_stations (
  station_id    TEXT PRIMARY KEY CHECK (length(station_id) BETWEEN 1 AND 128),
  revision      INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  approved_by   TEXT NOT NULL,                      -- the Arx user id who approved the last save; never a token
  approved_at   TEXT NOT NULL
);
