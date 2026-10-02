-- CR-019 (docs/changes/CR-019-SWITCH-PROTECTION.md section 6): switch protection. A switch takes part in group actions
-- ("turn everything off", floor / area / building switch actions) UNLESS it is protected here - the inverse of the opt-in
-- device_bulk_safe of CR-007 section 7.10. The classifier (services/switch_protection.py) seeds the protection at the
-- first reconcile pass after this migration and for every switch first seen later; an administrator reviews it once.
-- Number 0049: 0045 (CR-017) and 0046-0048 (CR-018) belong to other branches; Database.migrate() applies gaps.

-- a switch takes part in group actions unless protected here (the inverse of device_bulk_safe)
CREATE TABLE device_bulk_protected (
  entity_id          TEXT PRIMARY KEY,
  registry_id        TEXT,                -- HA entity registry id: follows an entity id rename (section 6.4)
  source             TEXT NOT NULL CHECK (source IN ('manual', 'auto')),
  category           TEXT,                -- auto: the classifier category (section 6.3); manual: NULL
  rule               TEXT,                -- auto: the signal that matched, e.g. "name:משאבה", "platform:hassio"
  marked_by          TEXT,                -- user id; NULL for the classifier
  marked_by_username TEXT,
  marked_at          TEXT NOT NULL,
  reviewed           INTEGER NOT NULL DEFAULT 0,   -- 1 = confirmed by an administrator (manual rows are born 1)
  reviewed_by        TEXT,
  reviewed_at        TEXT,
  gone_at            TEXT                 -- the entity left HA at this instant (row kept, section 6.4); NULL while present
);
CREATE INDEX idx_device_bulk_protected_registry ON device_bulk_protected (registry_id);

-- every switch the classifier has judged, once, so its verdict is never repeated over an administrator's choice.
-- `gone_at` (beyond the CR's sketch): a verdict of an entity that left HA is purged after the same 90 days as a
-- protection row, so an entity id reused much later - maybe another device - is judged anew, never inherits "allowed".
CREATE TABLE device_switch_classified (
  entity_id          TEXT PRIMARY KEY,
  registry_id        TEXT,
  verdict            TEXT NOT NULL CHECK (verdict IN ('protected', 'allowed', 'was_safe', 'admin_cleared')),
  category           TEXT,
  rule               TEXT,
  classifier_version INTEGER NOT NULL,
  classified_at      TEXT NOT NULL,
  gone_at            TEXT
);
CREATE INDEX idx_device_switch_classified_registry ON device_switch_classified (registry_id);

-- decision 2a: a switch an administrator had marked safe stays unprotected and is never auto-protected
INSERT OR IGNORE INTO device_switch_classified (entity_id, registry_id, verdict, rule, classifier_version, classified_at)
  SELECT b.entity_id, e.registry_id, 'was_safe', 'device_bulk_safe', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM device_bulk_safe b LEFT JOIN ha_entities e ON e.entity_id = b.entity_id;

-- the first reconcile pass after this upgrade writes the owner-facing record `devices.switch_model.migrated`; a fresh
-- installation (no switch known yet) has nothing to report and gets no marker
INSERT OR IGNORE INTO settings (key, value)
  SELECT 'switch_protection.migration_pending', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE EXISTS (SELECT 1 FROM ha_entities WHERE domain = 'switch') OR EXISTS (SELECT 1 FROM device_bulk_safe);

-- device_bulk_safe is kept, frozen: no code writes or deletes it after this migration (rollback to 0.1.150 reads it).
