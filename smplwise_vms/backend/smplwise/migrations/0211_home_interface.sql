-- HOME-SIMPLE-2420 (owner request 2026-11-10, round 25 mockup "home-simple-v2"): the second, simpler "home interface" next to the
-- full one. Three tables, all additive (the previous version ignores them; rollback = leave them):
--
-- home_interface_policy: what an administrator decided for one person - which interface opens first (default_interface), whether the
--   personal menu offers the switch (may_switch), whether the person may never open the full interface (home_only: also refused on the
--   server, services/home_interface.enforce), the wall-panel lock (kiosk + kiosk_area_id: locked to the home interface and that room),
--   and which rooms / modules the home interface shows (rooms_json / modules_json, NULL = all). current_interface is the person's own
--   last choice (only kept while may_switch allows it). No row = the defaults (services/home_interface.default_policy: home for a
--   regular user, full for an administrator). In every backup with the access tables (services/backup.ACCESS_TABLES).
--
-- home_user_prefs: one person's own favourites per room (favourites_json: {room_key: [item, ...]}, "home" = the whole-home set) and
--   their layout choices (layout_json: favourite rooms, hidden rooms, what opens first, theme, big text). Presentation only - no
--   permission, no device command; every control still goes through the device routes. In every backup (PROJECT_TABLES).
--
-- home_favourites_seed: the starting favourites an administrator prepared per room - a person who never edited a room's favourites
--   sees these. In every backup (PROJECT_TABLES).
--
-- Existing users keep the interface they have today: every user known when this migration runs gets an explicit "full" row
-- (may_switch on), so only people who first arrive after the upgrade get the new defaults.
CREATE TABLE home_interface_policy (
  user_id            TEXT PRIMARY KEY,
  default_interface  TEXT NOT NULL CHECK (default_interface IN ('home', 'full')),
  may_switch         INTEGER NOT NULL DEFAULT 1,
  home_only          INTEGER NOT NULL DEFAULT 0,
  kiosk              INTEGER NOT NULL DEFAULT 0,
  kiosk_area_id      TEXT,
  rooms_json         TEXT,
  modules_json       TEXT,
  current_interface  TEXT CHECK (current_interface IS NULL OR current_interface IN ('home', 'full')),
  updated_at         TEXT NOT NULL,
  updated_by         TEXT
);

CREATE TABLE home_user_prefs (
  user_id         TEXT PRIMARY KEY,
  favourites_json TEXT NOT NULL DEFAULT '{}',
  layout_json     TEXT NOT NULL DEFAULT '{}',
  updated_at      TEXT NOT NULL
);

CREATE TABLE home_favourites_seed (
  room_key    TEXT PRIMARY KEY,
  items_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

INSERT INTO home_interface_policy (user_id, default_interface, may_switch, home_only, kiosk, updated_at, updated_by)
  SELECT id, 'full', 1, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'migration:0211' FROM users;
