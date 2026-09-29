-- 0036: CR-010 security area - the intrusion alarm (docs/changes/CR-010-SECURITY-ALARM.md).
--
-- ha_entities.config_entry_id: the entity registry's config entry, so the zones and bypass controls of one alarm
-- system are told apart from those of a second system of the same integration (two Risco sites, two PAI panels).
-- Filled by the registry refresh like platform / device_id; NULL until the next refresh and for state-only entities.
ALTER TABLE ha_entities ADD COLUMN config_entry_id TEXT;

-- alarm_zone_overrides: the administrator's corrections to the automatic zone / bypass pairing (services/alarm.py).
-- One row per zone (a binary_sensor entity id). Nothing about state is stored here - state is the entity mirror.
--   panel_entity_id   the panel this zone belongs to (NULL = automatic); also adds a sensor of another integration
--                     to a panel (Alarmo watches sensors of other integrations)
--   bypass_entity_id  the bypass control paired by hand (NULL = automatic, '' = "this zone has no bypass")
--   excluded          1 = not a zone of any panel (an auxiliary sensor the automatic rules took for a zone)
CREATE TABLE alarm_zone_overrides (
  zone_entity_id   TEXT PRIMARY KEY,
  panel_entity_id  TEXT,
  bypass_entity_id TEXT,
  excluded         INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL,
  updated_by       TEXT
);

-- alarm_panel_codes: the panel's own code, typed once by an administrator (owner decision 2026-09-29), stored ENCRYPTED
-- (AES-256-GCM, services/alarm_codes.py; the key is <data>/keys/alarm-codes.key, mode 0600, never in a project backup).
-- Write-only: the API reports only whether it is set, when and by whom. Not a project-backup table.
CREATE TABLE alarm_panel_codes (
  panel_entity_id TEXT PRIMARY KEY,
  ciphertext      TEXT NOT NULL,
  set_at          TEXT NOT NULL,
  set_by          TEXT
);

-- alarm_user_policy: per HA user, whether arming / disarming needs a code (no_code | code_required, default
-- code_required; bypass follows disarm) and the user's personal Arx PIN as a salted scrypt hash only (never the panel
-- code). Not a project-backup table.
CREATE TABLE alarm_user_policy (
  user_id       TEXT PRIMARY KEY,
  arm_policy    TEXT NOT NULL DEFAULT 'code_required',
  disarm_policy TEXT NOT NULL DEFAULT 'code_required',
  pin_hash      TEXT,
  pin_set_at    TEXT,
  pin_set_by    TEXT,
  updated_at    TEXT NOT NULL,
  updated_by    TEXT
);

-- alarm_lockouts: a code-entry lock in force (5 wrong codes in 5 minutes), keyed "user:<id>" or "panel:<entity id>",
-- with its wall-clock expiry, so a restart does not lift it (security review L8). Never a code.
CREATE TABLE alarm_lockouts (
  key         TEXT PRIMARY KEY,
  until_epoch REAL NOT NULL
);
