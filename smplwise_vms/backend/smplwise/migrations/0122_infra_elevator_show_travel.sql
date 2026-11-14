-- ELEVTRAVEL-291: per-elevator option "show travelling when not on standby and without a fault" (default 0 = the states exactly as before).
-- When 1, the derived states active / moving_up / moving_down are reported as `travelling` (services/elevators.py derive). Nothing else changes.
ALTER TABLE infra_elevators ADD COLUMN show_travel INTEGER NOT NULL DEFAULT 0;
