-- 0011: custom roles (T082). Built-in roles stay in roles.json; a custom role is a named set of ordinary
-- permissions plus explicitly listed sensitive grants (never implied), never a system permission. `delegable`
-- marks roles a delegated (site-scoped) administrator may assign. Soft-deleted rows keep their id for audit.

CREATE TABLE custom_roles (
  id                  TEXT PRIMARY KEY,
  name_he             TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  permissions_json    TEXT NOT NULL,
  sensitive_json      TEXT NOT NULL DEFAULT '[]',
  delegable           INTEGER NOT NULL DEFAULT 0,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_by_username TEXT,
  updated_by          TEXT,
  updated_by_username TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);
