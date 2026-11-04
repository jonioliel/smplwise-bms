-- WISKEY-OPS-VIEWS-2400 (integration plan T11, capability row 82): Arx's own trend history of the intercom stations' capacity.
-- WisKey's `platform/capacity` (rc.10 capacity_history.py) keeps up to 64 samples per station for 30 days but answers only the latest
-- count and a derived growth rate - never the series. Settings › תפעול האינטרקום draws the trend from these rows: one per station and
-- WisKey inventory time (`sampled_at`), written when a fresh capacity report is read (services/wiskey_ops_views.record_samples), kept
-- 400 days and at most 1000 per station. Counts and advertised limits only - no person, no card number, no device address.
-- Number 0200: the next free number after 0199 (pilot/WISKEY-LIVE-VALIDATION-2390, pilot/XSCENARIO109-295). Additive only; older code
-- never reads it. Rollback: drop the table (nothing else refers to it). Not in a backup archive (the archive is an allow-list).

CREATE TABLE IF NOT EXISTS wiskey_capacity_samples (
  station_id   TEXT NOT NULL CHECK (length(station_id) BETWEEN 1 AND 128),
  sampled_at   TEXT NOT NULL CHECK (length(sampled_at) BETWEEN 20 AND 40),  -- WisKey's inventory time, UTC ...Z
  users        INTEGER CHECK (users IS NULL OR users >= 0),
  cards        INTEGER CHECK (cards IS NULL OR cards >= 0),
  max_users    INTEGER CHECK (max_users IS NULL OR max_users >= 1),
  max_cards    INTEGER CHECK (max_cards IS NULL OR max_cards >= 1),
  recorded_at  TEXT NOT NULL,
  UNIQUE (station_id, sampled_at)
);

CREATE INDEX IF NOT EXISTS wiskey_capacity_samples_time ON wiskey_capacity_samples(sampled_at);
