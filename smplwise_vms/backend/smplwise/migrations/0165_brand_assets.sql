-- CR-LOGOS295 (docs/changes/CR-LOGOS295.md section 5.2 / 10): the installation's own logo - the developer / property-management
-- company's - one row per (kind, variant). PROVISIONAL number 0165 (main ends at 0151, release/2150 takes 0152+): the integrator
-- renumbers it at integration, like every pilot migration.
-- The image is stored as base64 TEXT (not a BLOB as the CR first drew it): services/backup.py writes every table as JSON, so a
-- text column travels in a project backup with no new restorable folder, and a restore can never land a stamp without its image.
-- Settings keys (no schema): brand.company.name, brand.company.kind, brand.company.logo ({"light": stamp|null, "dark": stamp|null}),
-- brand.logo_size, brand.dark_mode, brand.title.prefix, brand.title.mode, brand.project.name.
-- Down: DROP TABLE brand_assets; and delete the brand.* settings rows. Additive only - the previous version ignores the table.
CREATE TABLE IF NOT EXISTS brand_assets (
  kind        TEXT    NOT NULL,                 -- 'company' (reserved: 'product_override', not built)
  variant     TEXT    NOT NULL,                 -- 'light' | 'dark'
  stamp       TEXT    NOT NULL,                 -- 16 hex of sha256(bytes): the content hash, the cache key
  mime        TEXT    NOT NULL,                 -- image/png | image/svg+xml
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  data_b64    TEXT    NOT NULL,                 -- the normalised image (re-encoded PNG / sanitised SVG), base64
  uploaded_by TEXT,
  uploaded_at TEXT    NOT NULL,
  PRIMARY KEY (kind, variant),
  CHECK (kind IN ('company', 'product_override')),
  CHECK (variant IN ('light', 'dark'))
);
