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

CREATE TABLE infra_elevator_alerts (
  elevator_id     TEXT NOT NULL REFERENCES infra_elevators(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,                   -- fire_service | fault | out_of_service (the notification sources elevator.<role>)
  raised_at       TEXT NOT NULL,
  notification_id TEXT,                            -- the notification-centre row it opened (NULL when the source is disabled)
  PRIMARY KEY (elevator_id, role)
);
