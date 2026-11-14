-- WXD10-DOOR-JOBS-2400 (CR-033 slices D10a / D10b, owner decision 19; owner go-ahead 2026-11-04): the register of the "disable and
-- list" run over the saved items that open a WisKey door (services/door_conversion.py). One row per action an administrator
-- confirmed on ONE item: `disabled` (an autonomous automation or schedule switched off through the existing write path),
-- `converted` (M1: the automation's direct door steps removed in Home Assistant and an Arx door job - a draft CR-AUTODOORS-295
-- block - created for its doors) or `handed_over` (M3: a recurring fixed schedule switched off and a draft weekly door window -
-- the CR-039 hold-open program - created for its doors). The row is what makes the action reversible ("undo"): the item's state
-- and live revision after the action, and the Arx objects it created. The audit log holds every attempt (`door.path_disabled`,
-- `door.path_converted`, `door.path_handed_over`, `door.path_restored`); this table holds the successful ones.
-- No secret, no entity id of a person, no address: item keys, names, revisions, door keys (station config entry id + relay).
-- Number 0205: the 2.40.0 train (release/2400-train) ends at 0203; 0204 is reserved for another branch of the same train (the wall
-- setting). Until 0204 exists `scripts/release_check.py` reports the sequence as not contiguous on this branch only.
-- Additive only; older code never reads it. Not a backup table (services/backup.py PROJECT_TABLES does not list it): it describes
-- the state of one installation's Home Assistant items, which a restore does not bring back. Rollback: drop the table.

CREATE TABLE IF NOT EXISTS door_path_conversions (
  id                 TEXT PRIMARY KEY,
  item_key           TEXT NOT NULL,                       -- automation:<item id> | schedule:<schedule id> (the inventory key)
  item_kind          TEXT NOT NULL CHECK (item_kind IN ('automation', 'schedule')),
  item_id            TEXT NOT NULL,
  item_name          TEXT NOT NULL DEFAULT '',
  action             TEXT NOT NULL CHECK (action IN ('disabled', 'converted', 'handed_over')),
  state              TEXT NOT NULL CHECK (state IN ('done', 'undone')),
  was_enabled        INTEGER NOT NULL DEFAULT 1,
  revision_before    TEXT,                                -- the live revision the administrator confirmed
  revision_after     TEXT,                                -- the live revision right after the action (an undo needs it unchanged)
  door_job_id        TEXT,                                -- converted: door_automations.id (a draft; never armed by this run)
  program_rule_id    TEXT,                                -- handed_over: door_window_rules.id (a draft; never enabled by this run)
  removed_steps_json TEXT,                                -- converted: the Home Assistant steps removed (kept for the record only)
  doors_json         TEXT NOT NULL DEFAULT '[]',          -- [[station config entry id, relay], ...]
  done_by            TEXT NOT NULL,
  done_by_name       TEXT NOT NULL DEFAULT '',
  done_at            TEXT NOT NULL,
  undone_by          TEXT,
  undone_by_name     TEXT,
  undone_at          TEXT
);

CREATE INDEX IF NOT EXISTS door_path_conversions_item ON door_path_conversions(item_key, done_at DESC);
-- at most one action in force per item: a second one needs the first undone
CREATE UNIQUE INDEX IF NOT EXISTS door_path_conversions_one_active ON door_path_conversions(item_key) WHERE state = 'done';
