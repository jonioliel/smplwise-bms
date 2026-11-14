-- Plan Studio phase 2 (T085, CR-003): the installation's custom object items. The built-in library is a versioned
-- file (catalog/objects.json), not a table; a custom item may be "based on" a built-in one and then inherits what
-- its row does not carry (services/plan_catalog.py). Rows are project data: backups include them.
CREATE TABLE catalog_items (
  id           TEXT PRIMARY KEY,
  based_on     TEXT,
  names_json   TEXT NOT NULL,
  category     TEXT NOT NULL,
  tags_json    TEXT NOT NULL DEFAULT '[]',
  role         TEXT NOT NULL,
  shape        TEXT NOT NULL,
  size_json    TEXT NOT NULL,
  z_m          REAL NOT NULL DEFAULT 0,
  params_json  TEXT NOT NULL DEFAULT '{}',
  icon         TEXT NOT NULL,
  color_token  TEXT NOT NULL,
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_catalog_items_updated ON catalog_items (updated_at);
