-- CR-015 (multimedia), data only: nobody loses the control of a TV they had through the devices area. A managed screen is
-- operated only from "מולטימדיה" (the generic route answers 409 use_media_screen), so every CUSTOM role that held
-- devices.read gains media.read and every one that held devices.control gains media.control and media.power. The two
-- sensitive permissions (media.public, media.bulk) are never granted here. Built-in roles get theirs in roles.json.
-- Idempotent: a permission already present is not added twice, so the file can run again on a restored database.
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

-- a role change moves the permission revision: the shell re-reads /me (routers/access.py does the same on every role edit)
INSERT INTO settings(key, value) VALUES ('permission_revision', '2')
  ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT);
