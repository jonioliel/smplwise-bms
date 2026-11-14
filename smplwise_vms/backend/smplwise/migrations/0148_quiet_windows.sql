-- CR-QUIET103 slice 1 (docs/changes/CR-QUIET103.md): time-boxed quiet windows per floor or area.
-- Final number 0148 (built as PROVISIONAL 0155; renumbered at the 2.14.0 integration, release/2140).
-- Additive only (rollback = run the previous version; the table is ignored by it). The feature ships OFF (setting quiet.windows.enabled = off).
-- A window is ACTIVE while ended_at IS NULL and started_at <= now < ends_at; the janitor only stamps the row (end_reason 'expired',
-- ended_at = ends_at) - the end instant itself is decided by the clock, never by the janitor having run.
CREATE TABLE quiet_windows (
  id          TEXT PRIMARY KEY,
  scope_type  TEXT NOT NULL CHECK (scope_type IN ('floor', 'area')),
  scope_id    TEXT NOT NULL,                 -- floors.id | ha_areas.area_id
  floor_id    TEXT,                          -- the floor judged for permission at start (area: ha_areas.floor_id; NULL = installation scope)
  label       TEXT NOT NULL DEFAULT '',      -- the place name at start (display only)
  started_at  TEXT NOT NULL,                 -- UTC ISO-8601 with Z
  ends_at     TEXT NOT NULL,                 -- UTC ISO-8601 with Z; the automatic end
  started_by  TEXT NOT NULL,
  ended_at    TEXT,                          -- NULL while it has neither expired nor been stopped
  ended_by    TEXT,                          -- user id of an explicit stop; NULL for an expiry
  end_reason  TEXT CHECK (end_reason IS NULL OR end_reason IN ('stopped', 'expired', 'switched_off')),
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_quiet_windows_open ON quiet_windows (ended_at, ends_at);
CREATE INDEX idx_quiet_windows_scope ON quiet_windows (scope_type, scope_id);
