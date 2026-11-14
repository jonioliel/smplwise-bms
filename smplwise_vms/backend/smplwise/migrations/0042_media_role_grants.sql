-- CR-015 (multimedia), data only: nobody loses the control of a TV they had through the devices area. A managed screen is
-- operated only from "מולטימדיה" (the generic route answers 409 use_media_screen), so every CUSTOM role that held
-- devices.read gains media.read and every one that held devices.control gains media.control and media.power - and media.read
-- too, even when it lacked devices.read, so the grant is usable (a screen is listed and opened under media.read). The two
-- sensitive permissions (media.public, media.bulk) are never granted here. Built-in roles get theirs in roles.json.
-- A role whose permissions changed moves its own `revision` (the editor's stale-write guard, as routers/access.py does on every
-- role edit) and the permission revision moves once. Idempotent: a permission already present is not added twice, nothing
-- moves when nothing changed, so the file can run again on a restored database.
CREATE TEMP TABLE media_grants_before AS SELECT id, permissions_json FROM custom_roles;

UPDATE custom_roles
   SET permissions_json = json_insert(permissions_json, '$[#]', 'media.read')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'devices.read')
   AND NOT EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'media.read');

UPDATE custom_roles
   SET permissions_json = json_insert(permissions_json, '$[#]', 'media.control')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'devices.control')
   AND NOT EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'media.control');

UPDATE custom_roles
   SET permissions_json = json_insert(permissions_json, '$[#]', 'media.power')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'devices.control')
   AND NOT EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'media.power');

-- a role that may control or power a screen must also be able to see it
UPDATE custom_roles
   SET permissions_json = json_insert(permissions_json, '$[#]', 'media.read')
 WHERE EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value IN ('media.control', 'media.power'))
   AND NOT EXISTS (SELECT 1 FROM json_each(custom_roles.permissions_json) WHERE value = 'media.read');

UPDATE custom_roles
   SET revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE id IN (SELECT c.id FROM custom_roles c JOIN media_grants_before b ON b.id = c.id WHERE c.permissions_json != b.permissions_json);

-- a role change moves the permission revision: the shell re-reads /me (only when a role changed)
INSERT INTO settings(key, value)
  SELECT 'permission_revision', '2'
   WHERE EXISTS (SELECT 1 FROM custom_roles c JOIN media_grants_before b ON b.id = c.id WHERE c.permissions_json != b.permissions_json)
  ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT);

DROP TABLE media_grants_before;
