-- WisKey station camera credentials (T054, owner decision 2026-09-28): every station is assumed to share the RTSP
-- account in the add-on options (wiskey_username / wiskey_password); a station that needs another one gets a row here.
-- A secret: written and cleared by a system administrator only, never returned by the API, never logged, and not part
-- of project backups (services/backup.py copies an explicit table list).
CREATE TABLE wiskey_station_credentials (
    station_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
);
