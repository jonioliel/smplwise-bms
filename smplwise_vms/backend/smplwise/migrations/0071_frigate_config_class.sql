-- FRGS (docs/changes/CR-029-FRIGATE-PROVIDER.md section 13): the write class `config` (zones and schema-driven camera settings through
-- Frigate's `PUT /api/config/set`). The only change is the rebuild of frigate_write_policy, whose CHECK list gains one class; the rows are
-- copied unchanged, so every class keeps its state and `config` is OFF until an administrator switches it on.
-- Rollback = run the previous version: it never writes the new class name, and it ignores a stored `config` row (its policy() reads only
-- the classes it knows). Number 0071 (the next free number after 0070; pilot/SEC3-block-counter, if merged later, renumbers to 0072).

CREATE TABLE frigate_write_policy_new (
  recorder_id TEXT NOT NULL,
  class       TEXT NOT NULL CHECK (class IN ('analytics', 'record', 'profile', 'review', 'events', 'ptz', 'exports', 'cases', 'config')),
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  changed_by  TEXT,
  changed_at  TEXT NOT NULL,
  PRIMARY KEY (recorder_id, class)
);
INSERT INTO frigate_write_policy_new (recorder_id, class, enabled, changed_by, changed_at)
  SELECT recorder_id, class, enabled, changed_by, changed_at FROM frigate_write_policy;
DROP TABLE frigate_write_policy;
ALTER TABLE frigate_write_policy_new RENAME TO frigate_write_policy;
