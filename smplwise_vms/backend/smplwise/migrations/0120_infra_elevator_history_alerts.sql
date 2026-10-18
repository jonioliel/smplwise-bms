-- CR-INFRA-ELEVATORS 2.8.0 (docs/changes/CR-INFRA-ELEVATORS.md section 9): the elevators' state history (the 24-hour bar of the
-- Infrastructure screen) and the transition memory of the elevator notifications. Written only by the 15 s evaluator
-- (services/elevators_runtime.py) from the state mirror; nothing is ever sent to an elevator.
-- NUMBERING: 0119 is reserved for another branch (owner / coordinator 2026-10-18); this branch takes 0120. The migration runner applies
-- every unrecorded file in order, so a later 0119 still runs on a database that already holds 0120.

CREATE TABLE infra_elevator_states (
  elevator_id TEXT NOT NULL REFERENCES infra_elevators(id) ON DELETE CASCADE,
  at          TEXT NOT NULL,                       -- ISO UTC instant the state began (the deciding sensor's last change when known)
  state       TEXT NOT NULL,                       -- the derived state (services/elevators.py STATES); 'unknown' while the mirror is not connected
  PRIMARY KEY (elevator_id, at)
);

-- A row = the role's sensor has been live `on` for its hold time ("the condition holds"). It is kept whether or not alerts are on, so
-- turning alerts on never notifies a condition that began earlier (only a new transition does).
CREATE TABLE infra_elevator_alerts (
  elevator_id     TEXT NOT NULL REFERENCES infra_elevators(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                   -- fire_service | fault | out_of_service (the notification sources elevator.<role>)
  raised_at       TEXT NOT NULL,                   -- when the condition started to hold
  notification_id TEXT,                            -- the notification it opened; NULL = none (alerts were off, or closed by turning them off)
  PRIMARY KEY (elevator_id, role)
);

-- The elevator alert settings (owner decision 2026-10-18): ONE row. Master switch and per-state switches default OFF; per state the
-- recipients (roles, named users, groups - nothing selected = nobody) and the extra channels (push, app; the inbox always). Changed only by
-- holders of system.configure (services/elevator_alerts.py).
CREATE TABLE infra_elevator_alert_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  enabled     INTEGER NOT NULL DEFAULT 0,
  states_json TEXT NOT NULL DEFAULT '{}',          -- {role: {"enabled": bool, "recipients": {"roles": [], "users": [], "groups": []}, "channels": []}}
  row_version INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TEXT
);
