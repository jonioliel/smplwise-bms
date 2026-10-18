# CR-INFRA-ELEVATORS - Elevators under Infrastructure

Status: implemented on `pilot/ELEVATORS` (from `integ/271`), not released. Owner request 2026-10-18: define elevators under
Infrastructure, link the binary sensors his home-platform integration exposes per elevator, and see their status on the
Infrastructure screen and on the home screen. Budget: small; reuse existing patterns, no new design language, no mockup round.

## 1. Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Storage follows the generator module: own tables (`infra_elevators`, `infra_elevator_sensors`, migration **0118**), live state never stored, derived on read from the state mirror (`ha_entities`). | Same pattern as CR-031; nothing to prune. |
| D2 | View permission = `devices.read`, scoped by `ha_scope` (the device screens' floor rule). Manage = new `infra.elevators.manage` (installation scope; built-in holders site_admin, system_admin). | A viewer never learns about a sensor he may not see; no new view permission to administer. |
| D3 | A floor-scoped viewer's elevator is derived from **his visible sensors only**; an elevator with no visible sensor answers the same 404 as a missing one and is absent from the list. | No leak through the derived state (e.g. an invisible fault sensor). |
| D4 | The settings dialog reuses the generator mapping's per-role `<select>` filled from a candidates route (binary sensors the setter may see). | "Reuse the existing picker"; the automation picker is tied to its editor. |
| D5 | Home: tiles in the existing KPI row (`sw-kpi`, the building summary row), not a new configurable widget. One tile per elevator up to 4, else one summary tile. Tap = `#/infra/elevators`. | The configurable widget pipeline (home_config, sizes, edit panel) is far over budget; the KPI row already hides empty domains. |
| D6 | Everything is absent until an elevator is defined: the Infrastructure tab is hidden (`applyInfraElevators`), the home row adds nothing, the static demo never shows it. Only the settings section exists for managers (like the generator). | No behaviour change for installations without elevators. |
| D7 | View only: no route sends anything to an elevator. Audit rows carry ids only (`infra.elevator.create/update/delete/reorder`). | Read-only device policy. |
| D8 | Notification source `infra.elevator_fault` **not built** (follow-up, section 6). | Needs a background evaluator with transition memory; over the ~1 h budget. |

## 2. Data

- `infra_elevators(id, name, name_key UNIQUE, area_id?, sort_order, enabled, revision, created_at, updated_at)`
- `infra_elevator_sensors(elevator_id, role, position, entity_id, label?)`; roles `moving_up, moving_down, waiting, fault, door_open, out_of_service, extra` (extras: positions 0..3, label required).
- Validation (server, repeated on every write): name 1..60 and unique case/space-insensitively (409 `duplicate_name`); at least one sensor (`no_sensor`); every id `binary_sensor.<x>` (`not_binary_sensor`); exists in the mirror, not removed, and visible to the setter by `ha_scope` - an invisible sensor answers exactly like a missing one (`sensor_not_found`); no sensor twice (`duplicate_sensor`); at most 4 extras (`too_many_extras`); area must exist (`area_not_found`); optional `revision` (409 `revision_conflict`). Every error has a Hebrew `user_message` and `details.message_en`.

## 3. Derived state (priority, highest first)

| Priority | State | Rule |
|---|---|---|
| 1 | `fault` | fault sensor live `on` |
| 2 | `out_of_service` | out_of_service sensor live `on` |
| 3 | `moving_up` / `moving_down` | the one movement sensor live `on`; **both `on` = `unknown` (reason `conflict`)**, never a guessed direction |
| 4 | `door_open` | door_open sensor live `on` (standing with the door open) |
| 5 | `waiting` | waiting sensor live `on`, **or** inferred when both movement sensors are live `off` (reason `inferred_idle`) |
| 6 | `unknown` | nothing above holds: no sensor mapped / visible, every mapped sensor dead (`no_live_sensor`), or not enough information (`insufficient`, e.g. only a fault sensor that is `off`) |

- "Live" = mirrored state exactly `on` / `off` on an available, non-removed, non-disabled entity while the mirror is connected. `unavailable`, `unknown`, empty or any other text = no information.
- Mirror not connected (stale) = every sensor dead = `unknown`, with `stale: true`. There is no `ok` state.
- `partial: true` when a higher-priority role is mapped but dead while a lower one decided (the screen can say "some sensors unavailable").
- `since` = the deciding sensor's `last_changed` (for `inferred_idle` the later of the two movement sensors); none for `unknown`.

## 4. Permissions and routes (`/api/v1`)

| Route | Permission | Notes |
|---|---|---|
| `GET /infra/elevators` | `devices.read` (scoped) | enabled elevators + live state + summary; no entity ids |
| `GET /infra/elevators/{id}` | `devices.read` (scoped) | uniform 404 for missing / disabled / invisible |
| `GET /infra/elevators/manage` | `infra.elevators.manage` | all elevators with the mapping (entity ids) |
| `GET /infra/elevators/candidates?q=` | `infra.elevators.manage` | binary sensors the setter may see |
| `POST /infra/elevators`, `PUT /infra/elevators/{id}`, `DELETE /infra/elevators/{id}`, `PUT /infra/elevators/order` | `infra.elevators.manage` | audited, ids only |

Labels: `infra.elevators.manage` = "ניהול מעליות: הגדרה וקישור חיישני מצב" (server catalogue); English in `frontend/src/i18n/elevators.ts`.

## 5. UI

- תשתיות › מעליות (`screens/infra-elevators.ts`): one row per elevator - icon, name, area, "מאז hh:mm", extras as small chips, the state badge (`sw-badge` tones: fault = error, out of service = stale, moving = live, door open / waiting = neutral, unknown = unknown). Polled every 15 s while shown.
- Home (`devices-building.ts`, KPI row): `sw-kpi` tiles from `elevators/model.ts homeTiles()`; polled every 30 s only while elevators exist.
- הגדרות › תשתיות › מעליות (`elevators/elevator-settings.ts`): list with up / down / edit / delete (confirm dialog), add / edit `sw-dialog` with six role selects and up to four labelled extras.
- Strings: `i18n/elevators.ts` (he, en; ar / ru initial and dev-marked). No platform branding on operator screens.

## 6. Follow-ups

1. Notification source `infra.elevator_fault` through the notification engine (raise on entry to fault, resolve on exit, body = elevator name only, WhatsApp off by default, rules and quiet hours honoured). Needs an evaluator in the runtime loop with per-elevator transition memory.
2. Floor number display if the integration exposes a numeric sensor (would add a `sensor.*` role).
3. Home tile as a configurable home widget (size, order, on/off) if the owner wants it there instead of the KPI row.

## 7. Open questions for the owner

1. Which binary sensors does the integration really expose per elevator (names / device classes)? Is there a separate "waiting" sensor, or is idle only "not up and not down"?
2. Is there a door-open sensor, and is there a floor-number sensor (numeric)?
3. Can up and down be `on` together in the integration (e.g. during a transition)? Today that shows "לא ידוע".
4. Notifications: a fault alert to whom (roles / people), WhatsApp yes / no, and should "out of service" alert too?
5. Home: are the KPI-row tiles the right place, or a widget of its own?

## 8. Tests

- Backend `smplwise_vms/backend/tests/test_infra_elevators.py`: invalid / non-binary / missing / removed / duplicate sensors, unknown role, extras limit and label, missing area, duplicate names, permission matrix (viewer / operator / site_admin / kiosk), uniform 404 (missing, disabled, invisible), the derivation table (incl. conflict, partial, unavailable / unknown, stale mirror), the floor-scope rule, extras without ids, reorder / revision / delete, audit rows ids only, the permission registered for admins only.
- Frontend node-only `frontend/tests/unit-elevators.spec.ts`: chip per state, stale = unknown, home tiles (none / per elevator / summary / loudest tone / stale), the dialog draft checks and round trip, reorder, the strings (en complete, ar/ru dev-marked, no branding), the tab gate.
- `frontend/tests/evidence-elevators.spec.ts`: written, not run (needs a preview server).
