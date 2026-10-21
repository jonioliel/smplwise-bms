-- Final number 0139 (built as PROVISIONAL 0136 on pilot/HMACACT-295; renumbered at the 2.11.0 integration, integ/2111). The content does not depend on the number.
--
-- Bridge HMAC key rotation, activation slice (owner decision 2026-10-21, option A):
--  - bridge_keys.hw_ts: the per-key HIGH-WATER of the largest accepted message timestamp (Fable review H-04). After a restart the nonce cache
--    is empty; a message at or below the value found at the first verify of that key is refused as a replay, so a captured message cannot be
--    replayed once inside the +-60 s window of a restart.
-- Additive (one column with a default). Nothing else changes in the schema: the switch `bridge.key_rotation` is a settings row (absent = on).
-- Rollback: older code ignores the column. NOTE for a rollback to a build before this slice: such a build does not know the sealed key set -
-- after the first rotation completed it can no longer sign for the bridge (the pairing secret was cleared from `settings`); re-pair in that case.
ALTER TABLE bridge_keys ADD COLUMN hw_ts INTEGER NOT NULL DEFAULT 0;
