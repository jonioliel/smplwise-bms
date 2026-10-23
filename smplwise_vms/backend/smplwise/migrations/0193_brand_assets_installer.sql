-- WHITELABEL097-295 (white-label and customer pack, board row r097): the installer company's own logo joins the developer / management
-- company's in `brand_assets` as kind 'installer'. PROVISIONAL number 0193 (main ends at 0151, release trains take 0152+; this branch also sits on
-- 0165 of pilot/LOGOS295B): the integrator renumbers it at integration, like every pilot migration.
-- SQLite cannot alter a CHECK, so the table is rebuilt with the wider kind list; rows are copied as they are.
-- Settings keys (no schema): brand.wl.enabled ('0' | '1', default '0' = SmplWise branding only), brand.wl.name, brand.wl.contact,
-- brand.wl.accent ('default' or a preset id of services/brand_colors.py), brand.wl.logo ({"light": stamp|null, "dark": stamp|null}).
-- Down: DELETE FROM brand_assets WHERE kind = 'installer'; delete the brand.wl.* settings rows (the wider CHECK is harmless to the earlier version).
CREATE TABLE brand_assets_v2 (
  kind        TEXT    NOT NULL,                 -- 'company' | 'installer' (reserved: 'product_override', not built)
  variant     TEXT    NOT NULL,                 -- 'light' | 'dark'
  stamp       TEXT    NOT NULL,
  mime        TEXT    NOT NULL,                 -- image/png | image/svg+xml
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  data_b64    TEXT    NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT    NOT NULL,
  PRIMARY KEY (kind, variant),
  CHECK (kind IN ('company', 'installer', 'product_override')),
  CHECK (variant IN ('light', 'dark'))
);
INSERT INTO brand_assets_v2(kind, variant, stamp, mime, width, height, data_b64, uploaded_by, uploaded_at)
  SELECT kind, variant, stamp, mime, width, height, data_b64, uploaded_by, uploaded_at FROM brand_assets;
DROP TABLE brand_assets;
ALTER TABLE brand_assets_v2 RENAME TO brand_assets;
