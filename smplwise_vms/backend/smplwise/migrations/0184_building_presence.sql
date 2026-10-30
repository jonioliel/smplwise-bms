-- Number 0184 (renumbered at integration into release/2280-train from the provisional 0183: 0183 is calendars; the content does not depend on the number).
-- BUILDING-PRESENCE-2271 (board r339, plan PLAN_R339 phase 1): the presence sensors the owner TAGS in Arx settings. Anonymous: an entity id only,
-- never a person. No history is stored (live state comes from the entity mirror). The feature is invisible while this table is empty.
CREATE TABLE IF NOT EXISTS presence_building_sensors (
  entity_id TEXT PRIMARY KEY,
  added_by  TEXT,
  added_at  TEXT NOT NULL
);
