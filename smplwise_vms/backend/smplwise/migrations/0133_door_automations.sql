-- Final number 0133 (CR-AUTODOORS-295; built as PROVISIONAL 0145 on pilot/AUTODOORS-295; renumbered at the 2.10.0 integration, integ/2100 - the content does not depend on the number).
--
-- CR-AUTODOORS-295: automations that open WisKey doors (Arx side). One "open a door" block per CR-017 automation, stored in Arx
-- only (never written into the Home Assistant automation, CR-033 R-17), fired by Arx under its own automation operator when Home
-- Assistant reports that the automation ran. Everything is OFF: `doors.automation_open` defaults to off and cannot be turned on
-- while services/door_automation.GO_LIVE_PERMITTED is False.
--
-- door_automations: the block (policy JSON validated in code), its state (draft -> armed by a person -> disarmed), the automation
--   revision it was armed against, who armed it and until when. Soft delete; one live block per automation (partial unique index).
-- door_automation_fires: one row per door decision of a fire that reached the per-door stage, and one per block-level refusal
--   (door_key NULL). `attempted` = 1 when the door was handed to the sender (cooldown, caps and storm count those).
--
-- Not in the backup allow-list (services/backup.py): a restore never revives an armed block.
-- Rollback: older code ignores both tables; DROP them to remove the feature.

CREATE TABLE door_automations (
  id                   TEXT PRIMARY KEY,                -- 'da_' + 32 hex
  automation_item_id   TEXT NOT NULL,                   -- ha_config_items.item_id (kind 'automation')
  name                 TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'armed', 'disarmed')),
  policy_json          TEXT NOT NULL,
  policy_revision      INTEGER NOT NULL DEFAULT 1,
  bound_item_revision  TEXT,                            -- the automation's revision at arm time
  armed_by             TEXT,                            -- users.id of the person who armed it
  armed_by_username    TEXT,
  armed_by_name        TEXT,
  armed_source         TEXT,                            -- the armer's identity source (ingress | remote | local | dev)
  armed_at             TEXT,
  armed_until          TEXT,
  disarm_reason        TEXT,
  disarmed_at          TEXT,
  disarmed_by          TEXT,                            -- users.id, or 'system' for an automatic disarm
  created_by           TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);
CREATE UNIQUE INDEX idx_door_automations_item_live ON door_automations (automation_item_id) WHERE deleted_at IS NULL;

CREATE TABLE door_automation_fires (
  id               TEXT PRIMARY KEY,
  automation_id    TEXT NOT NULL REFERENCES door_automations(id) ON DELETE CASCADE,
  door_key         TEXT,                                -- '<station config entry id>#<relay>'; NULL for a block-level refusal
  at               TEXT NOT NULL,
  attempted        INTEGER NOT NULL DEFAULT 0,
  outcome          TEXT NOT NULL CHECK (outcome IN ('pending', 'sent', 'refused', 'unknown', 'not_sent')),
  reason           TEXT,
  code             TEXT,
  door_request_id  TEXT
);
CREATE INDEX idx_door_automation_fires_door ON door_automation_fires (automation_id, door_key, at);
CREATE INDEX idx_door_automation_fires_at ON door_automation_fires (automation_id, at);
