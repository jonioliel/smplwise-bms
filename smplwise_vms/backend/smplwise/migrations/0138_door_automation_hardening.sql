-- Final number 0138 (built as PROVISIONAL 0150 on pilot/DOORHARD-295; renumbered at the 2.11.0 integration, integ/2111). The content does not depend on the number.
--
-- DOORHARD-295 (Fable security review 2026-10-21, section 5, owner decisions 2026-10-21):
-- door_automations.corroborated_trigger: the `last_triggered` instant (UTC, fixed-width ISO with microseconds) of the Home Assistant
--   automation entity that the last accepted `automation_triggered` event was matched with (A-01). A run is matched once: an event
--   whose entity moved no further than this value is a replay and is refused (`uncorroborated`).
-- door_automation_fires.operator_id / armed_by / armed_by_name: owner product answer CR 12.1 - every decision row stores BOTH the
--   automation operator that acted (`automation:<block id>`) and the person who armed (approved) the block at that moment.
--
-- Rollback: older code ignores the columns (the block keeps working but without the replay guard); drop the columns to remove.

ALTER TABLE door_automations ADD COLUMN corroborated_trigger TEXT;
ALTER TABLE door_automation_fires ADD COLUMN operator_id TEXT;
ALTER TABLE door_automation_fires ADD COLUMN armed_by TEXT;
ALTER TABLE door_automation_fires ADD COLUMN armed_by_name TEXT;
-- A-03: the per-door cap counts the fires of EVERY block that names the door (door_key alone, not automation_id first).
CREATE INDEX idx_door_automation_fires_key ON door_automation_fires (door_key, at);
