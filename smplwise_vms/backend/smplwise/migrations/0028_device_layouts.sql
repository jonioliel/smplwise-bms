-- CR-007 slice 6b (owner decisions 7.11): the device-control screens' edited layouts. One layout per installation and
-- screen, shown to everyone, edited only with system.configure (routers/device_layouts.py).
-- scope 'building' (scope_id 'main': the building screen's floor cards and area tiles) or 'area' (scope_id = the HA
-- area id, or 'unassigned': that area screen's domain cards). variant 'desktop' (a 12-column grid) or 'phone' (a
-- 4-column grid, created from the automatic one-column derivation the first time it is edited). No row = the
-- automatic layout ("אפס לברירת מחדל" deletes the rows). revision: optimistic concurrency, +1 on every write.
CREATE TABLE device_layouts (
  scope        TEXT NOT NULL CHECK (scope IN ('building', 'area')),
  scope_id     TEXT NOT NULL,
  variant      TEXT NOT NULL CHECK (variant IN ('desktop', 'phone')),
  layout_json  TEXT NOT NULL,
  revision     INTEGER NOT NULL,
  updated_by   TEXT,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id, variant)
);
