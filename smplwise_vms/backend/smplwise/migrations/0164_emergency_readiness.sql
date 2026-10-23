-- CR-EMERG104 (emergency readiness view, docs/changes/CR-EMERG104.md, owner answers 24.10 q201-q209 + q284).
-- Final number 0164 (built as PROVISIONAL 0194 for the EMERGREADY104-295 build; renumbered at the 2.16.0 integration, release/2160).
-- Additive only. Nothing here is read while the module switch `emergency_readiness.enabled` is off (default "false").
--   * maint_tasks.emergency_slot: the CLOSED type column (owner q205 b) that binds a ledger task to one slot of the readiness view.
--   * emergency_contacts: the dedicated emergency contact list (owner q203 b); phone / e-mail are shown only to a manager.
--   * emergency_readiness_history: one row per change of the verdict or of any item status (owner q207 c), kept
--     `emergency.history_keep_days` days (owner q284: one year, editable). Item ids and statuses only - no facts, no names.

ALTER TABLE maint_tasks ADD COLUMN emergency_slot TEXT
  CHECK (emergency_slot IS NULL OR emergency_slot IN ('fire_certificate', 'extinguishers', 'hydrants_sprinklers', 'emergency_lighting', 'evacuation_round', 'elevator_inspection'));
CREATE INDEX idx_maint_tasks_emergency_slot ON maint_tasks (emergency_slot) WHERE emergency_slot IS NOT NULL;

CREATE TABLE emergency_contacts (
  id               TEXT PRIMARY KEY,
  display_name     TEXT NOT NULL,
  role_title       TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  user_id          TEXT,                              -- an Arx user this person is (their push / WhatsApp route counts as reachable)
  priority         INTEGER NOT NULL DEFAULT 100,
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_verified_at TEXT,                              -- UTC instant a manager last confirmed the route works
  last_verified_by TEXT,
  revision         INTEGER NOT NULL DEFAULT 1,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);
CREATE INDEX idx_emergency_contacts_active ON emergency_contacts (priority) WHERE deleted_at IS NULL;

CREATE TABLE emergency_readiness_history (
  id          TEXT PRIMARY KEY,
  taken_at    TEXT NOT NULL,                          -- UTC instant
  verdict     TEXT NOT NULL CHECK (verdict IN ('ready', 'ready_with_gaps', 'not_ready')),
  counts_json TEXT NOT NULL DEFAULT '{}',
  items_json  TEXT NOT NULL DEFAULT '{}'              -- {item_id: status}
);
CREATE INDEX idx_emergency_history_time ON emergency_readiness_history (taken_at);
