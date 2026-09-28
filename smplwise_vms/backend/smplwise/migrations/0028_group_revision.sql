-- 0028: VMS groups as managed objects (T082). A revision guards concurrent edits (rename, membership, the group's
-- own bindings) exactly like custom_roles.revision; updated_at / updated_by record the last change (ids only).
ALTER TABLE groups ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN updated_at TEXT;
ALTER TABLE groups ADD COLUMN updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
