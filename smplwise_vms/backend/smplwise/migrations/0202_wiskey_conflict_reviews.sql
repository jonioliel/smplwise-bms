-- WISKEY-CONFLICTS-2400 (plan 2026-11-03 T5): the reviews behind a WisKey conflict resolution (services/wiskey_triage.py).
-- Arx asks WisKey's `conflicts/review` (a read of the station) and keeps the answer here under a random id: the operator who asked,
-- the station, the WisKey person id, WisKey's record revision, WisKey's `review_token` (an HMAC fingerprint of the device record; it
-- never leaves the server and is blanked once used) and the closed impact the operator was shown (field names, counts, flags - no
-- PIN, no card number, no photo). The resolution names the review id; the row is single use and expires after 10 minutes.
-- Number 0202: built as 0198 on the branch (the next free number on release/2382-train); renumbered at the 2.40.0 train
-- (release/2400-train), where 0198 / 0199 are the 2.39.0 train's and 0200 / 0201 are WISKEY-OPS-VIEWS-2400 / WISKEY-EVENT-CURSOR-2400.
-- It depends on nothing but its own table. Additive only; older code never reads it. Not a backup table (an operational record with
-- its own retention: 30 days, services/wiskey_triage.REVIEW_KEEP_DAYS). Rollback: drop the table.

CREATE TABLE IF NOT EXISTS wiskey_conflict_reviews (
  id              TEXT PRIMARY KEY,
  actor_user_id   TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('person', 'removal')),
  station_id      TEXT NOT NULL,
  person_id       TEXT NOT NULL,
  revision        INTEGER,
  review_token    TEXT NOT NULL,
  impact_json     TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  used_at         TEXT,
  used_direction  TEXT CHECK (used_direction IS NULL OR used_direction IN ('central', 'device', 'delete')),
  outcome         TEXT CHECK (outcome IS NULL OR outcome IN ('ok', 'refused', 'unknown', 'not_sent'))
);

CREATE INDEX IF NOT EXISTS wiskey_conflict_reviews_created ON wiskey_conflict_reviews(created_at);
