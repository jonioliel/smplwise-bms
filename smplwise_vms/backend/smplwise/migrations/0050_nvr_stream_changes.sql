-- CR-020 S2 (guarded single-stream encoding writes). Two parts, both additive and idempotent in effect.
--
-- 1. The NVR change log learns the target stream, the field diff and the pending phase of the two-phase write
--    (services/nvr_settings.py, docs/architecture/NVR_SETTINGS_API.md section 4). Status values of a `stream_encoding`
--    change: pending | applied | unchanged | no_effect | refused | failed | diverged | rolled_back (free text since 0013).
--    Every NOT NULL column has a default, so older code keeps working and simply ignores the new columns.
--    `batch_id` / `batch_index` belong to the later multi-camera phase and stay NULL for a single write.
-- 2. Owner decision 2026-10-03: the unused sensitive permission `nvr.config.stream` is removed from roles.json (encoding
--    writes are the installer's job: `nvr.configure`, held by the built-in system_admin only and never by a custom role).
--    A custom role that still names it loses it here, so the role editor never meets an unknown permission. A role
--    whose lists changed moves its own `revision`, and the permission revision moves once (the 0042 pattern).
ALTER TABLE nvr_changes ADD COLUMN recorder_id TEXT NOT NULL DEFAULT 'nvr-1';
ALTER TABLE nvr_changes ADD COLUMN camera_id TEXT;
ALTER TABLE nvr_changes ADD COLUMN stream_ref TEXT;
ALTER TABLE nvr_changes ADD COLUMN fields_json TEXT;              -- {"svc": [true, false]}: field names and enumerated values only
ALTER TABLE nvr_changes ADD COLUMN etag_before TEXT;
ALTER TABLE nvr_changes ADD COLUMN etag_after TEXT;
ALTER TABLE nvr_changes ADD COLUMN reboot_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nvr_changes ADD COLUMN device_status TEXT;            -- the device's statusCode ("1", "7") or sub status
ALTER TABLE nvr_changes ADD COLUMN batch_id TEXT;
ALTER TABLE nvr_changes ADD COLUMN batch_index INTEGER;
CREATE INDEX IF NOT EXISTS idx_nvr_changes_camera ON nvr_changes (camera_id, created_at);
CREATE INDEX IF NOT EXISTS idx_nvr_changes_pending ON nvr_changes (status) WHERE status = 'pending';
-- at most ONE pending change per recorder + stream, enforced by the database as well as by the service's check
CREATE UNIQUE INDEX IF NOT EXISTS ux_nvr_changes_pending_stream ON nvr_changes (recorder_id, stream_ref) WHERE status = 'pending' AND stream_ref IS NOT NULL;

CREATE TEMP TABLE stream_perm_before AS SELECT id, permissions_json, sensitive_json FROM custom_roles;

UPDATE custom_roles
   SET permissions_json = (SELECT json_group_array(value) FROM json_each(custom_roles.permissions_json) WHERE value != 'nvr.config.stream')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'nvr.config.stream');

UPDATE custom_roles
   SET sensitive_json = (SELECT json_group_array(value) FROM json_each(custom_roles.sensitive_json) WHERE value != 'nvr.config.stream')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.sensitive_json) WHERE value = 'nvr.config.stream');

UPDATE custom_roles
   SET revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE id IN (SELECT c.id FROM custom_roles c JOIN stream_perm_before b ON b.id = c.id
               WHERE c.permissions_json != b.permissions_json OR c.sensitive_json != b.sensitive_json);

INSERT INTO settings(key, value)
  SELECT 'permission_revision', '2'
   WHERE EXISTS (SELECT 1 FROM custom_roles c JOIN stream_perm_before b ON b.id = c.id
                  WHERE c.permissions_json != b.permissions_json OR c.sensitive_json != b.sensitive_json)
  ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT);

DROP TABLE stream_perm_before;
