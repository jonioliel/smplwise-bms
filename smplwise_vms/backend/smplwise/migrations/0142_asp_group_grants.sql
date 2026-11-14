-- Final number 0142 (built as PROVISIONAL 0140 on pilot/GRANTDENY-295; renumbered at the 2.11.0 integration, integ/2111). The content does not depend on the number.
--
-- Owner decision 2026-10-21 (9a), lab finding LAB_GRANTS_DRYRUN_2026-10-21: removing a person's personal allow does NOT revoke a station
-- that one of the person's groups still grants - only an explicit personal `deny` does. When Arx writes that deny itself (a removal of
-- a personal allow, or a block of a group-granted station) it records here that a group still grants the station, so the person's page
-- can say "denied personally while the group grants it". 1 = a fresh read showed the station enabled by a group when the deny was written.
--
-- Additive only (one column, default 0 = unknown / no). Rollback: older code ignores the column.
ALTER TABLE access_station_permissions ADD COLUMN group_grants INTEGER NOT NULL DEFAULT 0 CHECK (group_grants IN (0, 1));
