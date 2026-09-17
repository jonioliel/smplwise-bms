-- 0012: saved views (live review F3). A view is a named set of cameras with a layout (cols × rows) that opens the
-- live wall or the kiosk. Personal views belong to their owner; shared views are visible to everyone and need
-- rbac.assign to create. Soft-deleted rows keep their id for audit.

CREATE TABLE saved_views (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  cameras_json    TEXT NOT NULL,
  cols            INTEGER NOT NULL DEFAULT 2,
  rows            INTEGER NOT NULL DEFAULT 2,
  shared          INTEGER NOT NULL DEFAULT 0,
  kiosk           INTEGER NOT NULL DEFAULT 0,
  owner_user_id   TEXT NOT NULL,
  owner_username  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);
CREATE INDEX idx_saved_views_owner ON saved_views(owner_user_id, deleted_at);
