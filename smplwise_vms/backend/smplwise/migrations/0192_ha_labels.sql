-- HA-LABELS-SYNC-2351: the home system's label registry and the labels of its areas, mirrored like the floor / area
-- registries (0025). Rewritten whole on every registry refresh (services/ha_sync.apply_structure); never written by the
-- API. Read-only for the mapping assistant ("בתווית" rules, label conflicts, the health card's coverage by label).
CREATE TABLE ha_labels (
  label_id    TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  icon        TEXT,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,   -- order in the registry listing
  updated_at  TEXT NOT NULL
);
-- An area's labels, by label id, in the area's own order. Rewritten with the area table (same listing); an id the
-- label table does not know (the label listing failed, or a label deleted in between) is kept and skipped on read.
CREATE TABLE ha_area_labels (
  area_id    TEXT NOT NULL,
  label_id   TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (area_id, label_id)
);
CREATE INDEX idx_ha_area_labels_label ON ha_area_labels (label_id);
-- One row: when the label registry was last listed successfully (NULL = never: an old core without labels, or not
-- synced yet). Lets the screens tell "no labels in the home system" from "labels not read yet".
CREATE TABLE ha_label_sync (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  synced_at TEXT
);
INSERT INTO ha_label_sync(id, synced_at) VALUES (1, NULL);
