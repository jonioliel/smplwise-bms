-- Number 0183 (PROVISIONAL: built on pilot/BUILDING-PRESENCE-2271 from release/2271-assembly where 0182 is the highest; renumber at integration
-- if another branch took it. The content does not depend on the number.)
-- BUILDING-PRESENCE-2271 (board r339, plan PLAN_R339 phase 1): the presence sensors the owner TAGS in Arx settings. Anonymous: an entity id only,
-- never a person. No history is stored (live state comes from the entity mirror). The feature is invisible while this table is empty.
CREATE TABLE IF NOT EXISTS presence_building_sensors (
  entity_id TEXT PRIMARY KEY,
  added_by  TEXT,
  added_at  TEXT NOT NULL
);
