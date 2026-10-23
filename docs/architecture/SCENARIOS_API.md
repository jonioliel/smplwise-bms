# Scenarios API (CR-SCENARIO109, XSCENARIO109-295)

Prefix `/api/v1`. Contract: `docs/changes/CR-SCENARIO109.md` (section 17 binds). Default OFF (`scenarios.enabled = false`): every route but
`/scenarios/status` and `/scenarios/settings` answers `409 scenarios_disabled`. Errors use the common envelope (`code`, `user_message`,
`details`); validation is `422 validation` with `details.errors = [{path, code, message}]` (Hebrew messages).

| route | permission | notes |
|---|---|---|
| `GET /scenarios/status` | none (never 403) | `{enabled, kill_switch, can{view,manage,admin}, can_use, actions{notify,create_service_request,set_flag}, tickets_on}` |
| `GET /scenarios/signals` | scenario.view | catalogue filtered by the caller's reach, with subjects (friendly names), units, ranges, caps, limits, option defaults |
| `GET /scenarios` | scenario.view | list; `redacted_leaves` lists the leaves the caller may not see |
| `POST /scenarios` | scenario.manage | `{name, description?, definition}` -> 201, always disabled |
| `GET /scenarios/{id}` | scenario.view | with `definition` (redacted leaves `{redacted: true, message}`) and `tested_version` |
| `PUT /scenarios/{id}` | scenario.manage | `{version, name, description?, definition}`; `409 version_conflict`; an editor who cannot see a leaf cannot rewrite it |
| `DELETE /scenarios/{id}` | scenario.manage | resolves its open notices |
| `POST /scenarios/{id}/enable` | scenario.manage | `{version, confirm?}`; `409 test_required` until a dry run of this version; `409 confirmation_required` (department + daily cap) for a rule that opens service requests |
| `POST /scenarios/{id}/disable` | scenario.manage | `{version}` |
| `POST /scenarios/{id}/test` | scenario.manage | `{overrides?: {leaf_path: value}}`: dry run on current (or simulated) readings; writes one `test` run row, never acts |
| `POST /scenarios/simulate` | scenario.manage | `{definition, overrides?}`: dry run of an unsaved definition, nothing written |
| `GET /scenarios/{id}/runs` | scenario.view | last 50 runs with per-leaf snapshot (redacted per viewer) |
| `POST /scenarios/{id}/reassign` | scenario.admin | `{owner_user_id}`: a rule stopped for `author_rights_lost` gets a new author |
| `GET /scenarios/flags` | scenario.view | |
| `GET /scenarios/choices` | scenario.manage | the pickers: active users and every role by name, the service departments the caller may open requests in (while the service module is on); answers also while the module is off (the settings card) |
| `GET/PUT /scenarios/settings` | scenario.admin | PUT `{changes, confirmed: true}`; audited `scenario.settings.change` / `scenario.kill_switch` |

## Definition

```
{ "when": node, "actions": [action, ...1-3], "options": {...} }
node   := {"op": "and"|"or", "items": [node...]} | {"op": "not", "item": node} | leaf      depth <= 4, <= 12 leaves
leaf   := {"signal", "subject"?, "cmp", "value"?, "window"?, "hold_s"?, "debounce_s"?, "max_age_s"?, "hysteresis"?: {"clear_margin"}}
action := {"type": "notify", "to"?: {"users": [], "roles": []}, "severity"?}
        | {"type": "create_service_request", "department_id", "priority_key"?, "title"?}
        | {"type": "set_flag", "flag", "value": bool}
options: cooldown_s (60..7d, 900), clear_after_s (0..1d, 60), for_s (0..1d, 0), on_unknown (hold|treat_as_false), unknown_grace_s (0..1d, 600),
         max_fires_per_day (1..1000; default the setting, 100), max_tickets_per_day (0..200; default the setting, 20)
```

Any other action `type` is `scenario_forbidden_action`: a scenario never operates a door, lock, alarm, siren, cover, gate, scene, script or device.

Signals (read-only; UNKNOWN when the module is off, the state mirror is disconnected, the value is missing or older than `max_age_s`):
`time.in_window` (window `{days 0=Mon..6=Sun, from, to}` site time, wraps midnight), `time.after_hours` (setting `scenarios.work_window` or the
service module calendar), `temperature.value | out_of_range | door_open | sensor_offline` (unit id), `door.is_open | open_for_s` (door-class
binary sensor, read only), `presence.count | anyone` (area id; counts only, needs `occupancy.view` and the people-count module), `flag.value`.

## Settings (`scenarios.*`)

`enabled` false, `kill_switch` false, `actions.notify|create_ticket|set_flag` false, `max_fires_per_day` 100, `max_tickets_per_day` 20,
`max_actions_per_hour` 600, `max_rules` 200, `tick_s` 30, `test_per_min` 20, `runs_keep_days` 90, `degraded_notice` false,
`after_hours_source` window|calendar, `work_window` Sun-Thu 08:00-17:00, `default_recipients` `{users: [], roles: ["system_admin"]}`.

## Notifications

Sources `scenario.fired` (to the addressed people who may see every module and subject of the rule), `scenario.fired_generic` (no values,
to the other addressed people), `scenario.degraded` (off by default; to the author). Subject kind `scenario`, recipient rule `scenario`:
visibility is exactly the audience the engine resolved for the row. Listed in the policy matrix only while the module is on.
