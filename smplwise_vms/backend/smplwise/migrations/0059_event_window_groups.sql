-- Review windows (T047 / M047): manual grouping corrections. A review window is computed on every read from the raw
-- events (group_windows: proximity in time per camera / room / floor); nothing about the grouping was stored. An
-- operator who splits a window, or joins two, records a group here: its member events form one window whatever the
-- gap, and leave the automatic grouping. The raw events are never changed; dissolving the group (DELETE) restores the
-- automatic windows. Members follow their events (ON DELETE CASCADE: an event pruned by retention leaves its group).
CREATE TABLE IF NOT EXISTS event_window_groups (
  id TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_by_username TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS event_window_members (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES event_window_groups(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_window_members_group ON event_window_members(group_id);
