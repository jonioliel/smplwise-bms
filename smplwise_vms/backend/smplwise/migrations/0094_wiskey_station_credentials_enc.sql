-- TKWISECRYPT (delta review S-5): the per-station WisKey camera password is no longer kept in plaintext. PROVISIONAL number 0094
-- (the next free after 0093_app_secrets in the integ/263 base); the lead renumbers on integration.
--
-- password_enc: AES-256-GCM with the per-install key of recorder_connections (keys/connections.key, never in a backup), associated
-- data "wiskey_station|<station id>|password", `v1:<base64>` (services/connection_store.seal_station_secret).
-- SQL cannot encrypt: the one-time conversion runs at start-up (services/wiskey_camera.apply_at_startup, after the migrations):
-- every row with a plaintext `password` is sealed into password_enc and `password` is blanked ('' - the column stays NOT NULL).
-- Until a row is converted (the key was unreadable) the plaintext keeps working; a new write always seals.
ALTER TABLE wiskey_station_credentials ADD COLUMN password_enc TEXT;
