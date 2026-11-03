-- WISKEY-ACCESS-DIAG-2400 (plan 2026-11-03 T10): the periodic access-review decisions an Arx operator took from Arx's "אבחון הרשאות"
-- screen (services/wiskey_access_diag.py, routers/access_control_diag.py). WisKey keeps the receipt itself (`users/access_review_decide`,
-- access/permission_reviews.py) but records as its actor the add-on's service identity, never the Arx operator; this table keeps WHO in
-- Arx decided, so the reviews list can say "decided in Arx by <name>" next to WisKey's receipt. The audit log holds the attempt and the
-- outcome rows of every decision as well (actions `intercom.access_review_decide`); this table holds the successful ones only.
-- No access is changed by a decision (WisKey: "decisions never mutate admission policy or equipment"); no credential, phone or device
-- address is stored here: the WisKey ids, the decision, the operator's reason and cadence, WisKey's receipt times, the Arx actor.
-- Number 0200: the next number free on every ref (0198 and 0199 are taken by other 2.39 / 2.40 branches); a train that already holds
-- 0200 renumbers this file. Additive only; older code never reads it. Not a backup table (services/backup.py PROJECT_TABLES does not list
-- it): a log, re-creatable from WisKey's receipts minus the Arx actor. Rollback: drop the table.

CREATE TABLE IF NOT EXISTS wiskey_access_review_decisions (
  receipt_id      TEXT PRIMARY KEY,                       -- WisKey's receipt id (32 hex)
  user_id         TEXT NOT NULL,                          -- the WisKey person id
  station_id      TEXT NOT NULL,
  lock_id         INTEGER NOT NULL CHECK (lock_id IN (1, 2)),
  person_revision INTEGER NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('keep', 'followup')),
  reason          TEXT NOT NULL,
  cadence_days    INTEGER NOT NULL CHECK (cadence_days BETWEEN 1 AND 365),
  decided_at      TEXT NOT NULL,                          -- WisKey's receipt time (`at`)
  due_at          TEXT NOT NULL,                          -- WisKey's next review (`due_at`)
  actor_user_id   TEXT NOT NULL,                          -- the Arx user who decided
  actor_name      TEXT NOT NULL DEFAULT '',
  command_id      TEXT NOT NULL,                          -- the audit rows' command id
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS wiskey_access_review_decisions_door ON wiskey_access_review_decisions(station_id, lock_id, user_id, decided_at DESC);
