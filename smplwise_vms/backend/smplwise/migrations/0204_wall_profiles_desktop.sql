-- WALL-ANSWERS-2400 (owner answer 04.11, round 18 question 20 = ב): the "מסך קיר גם במחשב" switch ("wall mode on desktop",
-- WALL-FOLLOWUPS-2390) moves out of the profile's settings blob into a column of its own. In config_json it made a rollback
-- dangerous: older code validates config_json with `extra="forbid"` and, on any unknown key, falls back to the DEFAULT
-- configuration of that profile (cameras, layout, alerts, frame ... all shown as defaults). A column is invisible to older code.
--
-- Number 0204: the next free number after release/2400-train's 0203 (checked against every recent remote branch, none uses 0204).
--
-- Additive: one new column with a default. The existing values move into it (a JSON `true` in config_json reads as 1), and the
-- key is then removed from config_json, so a database written by this version reads cleanly on every older version. No other
-- key of config_json is touched (json_remove keeps the order of the rest). Rows whose config_json is not valid JSON are left as
-- they are (older code already shows the defaults for them).
--
-- Rollback: nothing to do before downgrading. Older code never reads the column; the profiles keep their settings; only the
-- desktop switch itself is lost on a version that never had it (2.39 and older), which is the intended degradation. If the
-- column must go (it never has to): ALTER TABLE wall_profiles DROP COLUMN desktop (SQLite 3.35+).

ALTER TABLE wall_profiles ADD COLUMN desktop INTEGER NOT NULL DEFAULT 0;

UPDATE wall_profiles SET desktop = 1
  WHERE json_valid(config_json) AND json_type(config_json, '$.desktop') = 'true';

UPDATE wall_profiles SET config_json = json_remove(config_json, '$.desktop')
  WHERE json_valid(config_json) AND json_type(config_json, '$.desktop') IS NOT NULL;
