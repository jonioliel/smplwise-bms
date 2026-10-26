# CR-INFRA-ELEVATORS - Elevators under Infrastructure

Status: basic infrastructure released in 2.7.2 (migration 0118). **2.8.0 full feature on `pilot/ELEVATORS280` (section 9, migration
0119), integrated on `integ/280`, not released.** Sections 1-8 describe the 2.7.x basis; where section 9 supersedes a decision it says so. Owner request 2026-10-18: define elevators under
Infrastructure, link the binary sensors his home-platform integration exposes per elevator, and see their status on the
Infrastructure screen and on the home screen. Budget: small; reuse existing patterns, no new design language, no mockup round.

**Owner answers 2026-10-18 (second commit).** His integration exposes per elevator: WAITING, FAULT, FIRE-SERVICE mode (פיקוד כבאים) and
SHUTDOWN (השבתה). No door sensor and no floor sensor today (the model must be ready for them later); up / down sensors were not
mentioned (he may not have them). Notifications are **not decided** (ask later). The home-tile placement is being explained to him by the
coordinator. Implemented: the `fire_service` role with the highest priority, the inferred `active` state, the shutdown role kept as the
key `out_of_service` and labelled "בהשבתה" / "Out of service", the roles stored as keys without a CHECK (section 2).

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
| D8 | Notification source `infra.elevator_fault` **not built** (follow-up, section 6). | Needs a background evaluator with transition memory; over the ~1 h budget. Owner: not decided yet. |
| D9 | `fire_service` is a first-class role above fault; its tile / row uses the error tone with the flame icon and its own label; the summary reads "N מעליות · F בתקלה · K פיקוד כבאים". | Owner 2026-10-18: fire-service mode overrides everything. |
| D10 | `active` (פעילה) is inferred from a live `off` waiting sensor only when no movement sensor is mapped; with movement sensors the up / down inference applies. | The owner's integration has waiting but (probably) no up / down: "not waiting" must not read as unknown. |

## 2. Data

- `infra_elevators(id, name, name_key UNIQUE, area_id?, sort_order, enabled, revision, created_at, updated_at)`
- `infra_elevator_sensors(elevator_id, role, position, entity_id, label?)`; roles `fire_service, fault, out_of_service, moving_up, moving_down, door_open, waiting, extra` (extras: positions 0..3, label required).
- **Adding a role later needs no migration**: `role` is a plain key column (no CHECK); the closed list lives in code - `ROLES` in
  `services/elevators.py` (validation and derivation) and `ELEVATOR_ROLES` in `frontend/src/api/elevators.ts` (dialog order), plus a label in
  `i18n/elevators.ts`. A new flag role also needs its place in `derive()` and a chip in `elevators/model.ts`.
- **Future `floor` (documented only, not built):** a numeric `sensor.*` role, so it is NOT a binary role: it would be stored in the same table
  under the key `floor` with the validator accepting `sensor.*` for that key only, never take part in `derive()`, and be shown next to the
  state chip ("קומה 3"). `door_open` is already a role and works as soon as a sensor exists.
- Validation (server, repeated on every write): name 1..60 and unique case/space-insensitively (409 `duplicate_name`); at least one sensor (`no_sensor`); every id `binary_sensor.<x>` (`not_binary_sensor`); exists in the mirror, not removed, and visible to the setter by `ha_scope` - an invisible sensor answers exactly like a missing one (`sensor_not_found`); no sensor twice (`duplicate_sensor`); at most 4 extras (`too_many_extras`); area must exist (`area_not_found`); optional `revision` (409 `revision_conflict`). Every error has a Hebrew `user_message` and `details.message_en`.

## 3. Derived state (priority, highest first)

| Priority | State | UI label (he / en) | Rule |
|---|---|---|---|
| 1 | `fire_service` | פיקוד כבאים / Fire service | fire_service sensor live `on` (loud tone, flame icon, distinct from fault) |
| 2 | `fault` | תקלה / Fault | fault sensor live `on` |
| 3 | `out_of_service` | בהשבתה / Out of service | out_of_service (the owner's "השבתה", shutdown) sensor live `on` |
| 4 | `moving_up` / `moving_down` | עולה / יורדת | the one movement sensor live `on`; **both `on` = `unknown` (reason `conflict`)**, never a guessed direction |
| 5 | `door_open` | דלת פתוחה / Door open | door_open sensor live `on` (standing with the door open) |
| 6 | `waiting` | ממתינה / Waiting | waiting sensor live `on`, **or** inferred when both movement sensors are mapped and live `off` (reason `inferred_idle`) |
| 6 | `active` | פעילה / In operation | waiting sensor mapped and live `off`, nothing above on, and **no movement sensor mapped** (reason `inferred_active`) |
| 7 | `unknown` | לא ידוע / Unknown | nothing above holds: no sensor mapped / visible, every mapped sensor dead (`no_live_sensor`), or not enough information (`insufficient`, e.g. only a fault sensor that is `off`, or waiting `off` with a dead movement sensor mapped) |

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

- תשתיות › מעליות (`screens/infra-elevators.ts`): one row per elevator - icon, name, area, "מאז hh:mm", extras as small chips, the state badge (`sw-badge` tones: fire service = error with the flame icon, fault = error, out of service = stale, moving / active = live, door open / waiting = neutral, unknown = unknown). Polled every 15 s while shown.
- Home (`devices-building.ts`, KPI row): `sw-kpi` tiles from `elevators/model.ts homeTiles()`; polled every 30 s only while elevators exist.
- הגדרות › תשתיות › מעליות (`elevators/elevator-settings.ts`): list with up / down / edit / delete (confirm dialog), add / edit `sw-dialog` with seven role selects (waiting, fault, fire service, shutdown, up, down, door) and up to four labelled extras.
- Strings: `i18n/elevators.ts` (he, en; ar / ru initial and dev-marked). No platform branding on operator screens.

## 6. Follow-ups

1. Notification source `infra.elevator_fault` through the notification engine (raise on entry to fault, resolve on exit, body = elevator name only, WhatsApp off by default, rules and quiet hours honoured). Needs an evaluator in the runtime loop with per-elevator transition memory.
2. Floor number display if the integration exposes a numeric sensor (would add a `sensor.*` role).
3. Home tile as a configurable home widget (size, order, on/off) if the owner wants it there instead of the KPI row.

## 7. Open questions for the owner

1. ~~Which binary sensors does the integration expose?~~ Answered 2026-10-18: waiting, fault, fire service, shutdown. Open: does it also have up / down sensors?
2. ~~Door / floor sensors?~~ Answered: none today; the model is ready for them (section 2).
3. Can up and down be `on` together in the integration (e.g. during a transition)? Today that shows "לא ידוע".
4. Notifications: not decided by the owner (2026-10-18) - ask later: a fault / fire-service alert to whom, WhatsApp yes / no, and should shutdown alert too?
5. Home: are the KPI-row tiles the right place, or a widget of its own? (being explained to the owner)

## 8. Tests

- Backend `smplwise_vms/backend/tests/test_infra_elevators.py`: invalid / non-binary / missing / removed / duplicate sensors, unknown role, extras limit and label, missing area, duplicate names, permission matrix (viewer / operator / site_admin / kiosk), uniform 404 (missing, disabled, invisible), the derivation table (incl. conflict, partial, unavailable / unknown, stale mirror), the floor-scope rule, extras without ids, reorder / revision / delete, audit rows ids only, the permission registered for admins only.
- Frontend node-only `frontend/tests/unit-elevators.spec.ts`: chip per state, stale = unknown, home tiles (none / per elevator / summary / loudest tone / stale), the dialog draft checks and round trip, reorder, the strings (en complete, ar/ru dev-marked, no branding), the tab gate.
- `frontend/tests/evidence-elevators.spec.ts`: written, not run (needs a preview server).

## 9. 2.8.0 - the full feature (owner-approved mockup `elevators-full-mockup.html`, owner decisions 2026-10-18)

Owner decisions: a designed Infrastructure screen with door icons; a SEPARATE home widget in three sizes (10b) placed and sized in the home
edit mode; a strong, clearly distinct colour for out of service / shutdown (9a); a ready notification mechanism with ONE default recipient
policy (choosing recipients comes later, no selection UI now); the installation has NO up / down sensors, so no direction is shown anywhere.
Owner feedback (same day, through the coordinator): the 2.7.x KPI-row cards ("one small card per elevator") looked bad and could not be
controlled - the owner must choose WHAT is shown and WHERE: one card per elevator, ONE combined card, or both; per-elevator include /
exclude; placement and size via the edit mode; persisted for the installation and, optionally, per user.

### 9.1 Decisions

| # | Decision | Supersedes |
|---|----------|------------|
| E1 | Migration **0119** (built as provisional 0120 while 0119 was reserved for WXROT; WXROT is not shipped, so it was renumbered to 0119 at the 2.8.0 integration): `infra_elevator_states` (history) and `infra_elevator_alerts` (notification memory). | - |
| E2 | `services/elevators_runtime.py`: one read-only thread, every 15 s (env `SW_ELEVATORS=0` turns it off). History row on every derived-state change (the deciding sensor's `last_changed`, normalised to `...Z`); while the mirror is disconnected the elevator is recorded `unknown`. Hourly prune keeps 8 days (and each elevator's last row before the cutoff). | D1 (history was "never stored") |
| E3 | Notifications: sources `elevator.fire_service` (critical), `elevator.fault` (alert), `elevator.out_of_service` (info); category `device_faults`. Each role is judged on its OWN sensor (a fault masked on screen by fire service keeps its condition). Hold 0 / 30 / 30 s. **OFF by default** - see 9.4 (owner decision 2026-10-18, supersedes the first 2.8.0 commit's "on, to the managers"). | D8 |
| E4 | Recipients chosen NOW per state: roles (viewer / operator / site_admin / system_admin), named users, groups - the generator's routing pattern (own table, mirrored onto the CR-018 policy with the recipient rule `elevator`). Nothing selected = nobody. Then intersected with who may see the elevator (new subject kind `elevator`). | - || E5 | `GET /infra/elevators?history=24` adds per-elevator segments `[{state, from, to}]`; only for a caller who sees ALL of the elevator's sensors (the history is derived from every sensor), `null` otherwise. Every item carries `flags` (the visible roles' live values) for the sensor lights. | - |
| E6 | No direction: the frontend shows `moving_up` / `moving_down` as "פעילה" without an arrow; the settings dialog offers waiting / fault / fire service / shutdown and a line "עולה / יורדת / דלת פתוחה / קומה - לא מוגדר (אפשר להוסיף בעתיד)"; a role an elevator already links stays offered. The server derivation is unchanged (section 3). | - |
| E7 | State looks (`elevators/styles.ts`, `--sw-el-*`, solid fills under white text, >= 4.5:1): waiting green, in operation blue (doors slightly open), fault red, **out of service strong orange with a striped edge / square dot** (shape, not only colour), fire service crimson and pulsing (stops under reduced motion), unknown grey. | D9 tones on the new surfaces |
| E8 | Home: widget `elevators` in the home widget configuration (`home.widgets`): `mode` combined / cards / both, `hidden` (elevator ids, <= 50), `filter` all / alerts; sizes s / m / l per direction like every widget. Drawn only when the viewer sees at least one elevator (absent otherwise, no ghost in edit mode). The 2.7.x KPI-row tiles are removed from the home screen. A user holding `screen.personalize` may store his own `mode` and `hidden` (`home.personal.widgets.elevators`). | D5 |
| E9 | Settings › תשתיות › מעליות gains "תצוגה במסך הראשי" (widget on/off, mode, default size for every direction, filter, included elevators, link to the home edit mode) for `system.configure` holders (the home settings' permission); others see one line saying so. | - |

### 9.2 Built vs the mockup

Built: the Infrastructure screen (title, "+ מעלית חדשה", KPI row, cards with door icon / badge / sensor lights / 24-hour bar / "מלפני ...",
the add card); the home widget in three sizes and three modes; edit-mode placement and sizing; the settings card, the display card and the alert settings card (9.4).
Changed from the mockup: the mockup's separate "summary tiles row" is replaced by the widget's `cards` mode (owner feedback); the emoji
glyphs are product icons; the door LED is shown faded ("not linked") as in the mockup. Not built: floor display (no sensor); a longer history range than 24 h (8 days are kept for it).

### 9.3 Tests

- Backend: `tests/test_infra_elevators_280.py` (notification hold / once / dead sensor / disconnected / per-role / unlink / disable / delete /
  restart memory / default recipients / visibility rule / catalogue; history transitions, normalised instants, segments, prune, `?history`
  refusal and partial-visibility hiding, flags); `tests/test_home_config.py` (widget validation, personal override).
- Frontend node-only: `tests/unit-elevators.spec.ts` (looks, no direction, KPIs, lights, bar, relative times, widget view, config, personal).
- `tests/evidence-elevators.spec.ts` (desktop + mobile, light + dark) run against a local Vite dev server with mocked routes; screenshots in
  `docs/evidence/elevators/`. The home widget: `tests/evidence-elevators-home.spec.ts` (2.8.0 integration; the real build against the bubble
  mock layer: mode "both" = the combined card followed by one card per elevator with a hidden elevator left out, mode "cards", and no widget
  at all without elevators; desktop / tablet / mobile; screenshots `home-both-*.png`).
### 9.4 Elevator alerts: off by default, recipients, channels (owner decision 2026-10-18)

- Settings › תשתיות › מעליות › "התראות מעליות" (`elevators/elevator-alerts.ts`; `GET/PUT /api/v1/infra/elevators/alerts`; read: elevator managers
  and system configurators; **write: `system.configure`**, revision-guarded, audited `infra.elevator.alerts.update` with ids / switches only).
- A master switch "שליחת התראות מעליות" and a switch per state (fire service / fault / shutdown). **All default OFF.** A state notifies only while
  the master AND its own switch are on. Stored in `infra_elevator_alert_settings` (one row, migration **0119** extended - no new number).
- Recipients per state: roles, named users, groups (none = nobody). Roles resolve against the current bindings, direct and through a group;
  groups resolve to their members; then only those who may see the elevator.
- Channels per state: the notification centre always; browser push, the phone app and (GENELEV-295, brief 2026-10-24) WhatsApp on request. E-mail
  is not offered for elevators (its pipeline flag is written false). WhatsApp is an external, budget-limited channel shared with the tickets module:
  it is off by default, and adding it, or changing who it reaches (the state's switch, its recipients, the master switch while a state carries it),
  also needs `notify.manage` as for the generator (NOTIFWA). The GET answer carries `can_whatsapp`; the audit row of every change lists the states
  on, each state's channels and the recipient COUNTS (never names). Tests: `tests/test_elevator_alert_recipients_295.py`,
  `frontend/tests/unit-elevator-alert-recipients.spec.ts`. No migration (the `channels` list lives in the existing `states_json`).
- The choices are mirrored onto the CR-018 policy of each source (enabled = master AND state, rule `elevator`, channels). The evaluator ALSO asks
  the elevator settings before raising, so switching the generic policy on in the notification matrix cannot start elevator alerts by itself.
  (Changing the generic matrix's recipient rule for an elevator source is possible there, as for the generator; the next save here rewrites it.)
- **Rules:**
  1. Off: no notification is raised. The evaluator keeps recording the history and keeps tracking which conditions hold (memory rows with no
     notification).
  2. Turning on (master or a state): only NEW transitions notify. A condition that already held keeps its memory row and is never notified
     retroactively; after it ends, its next start notifies.
  3. Turning off (master or a state): the open elevator notifications of the states that went off are resolved at once with the resolution
     `alerts_disabled` (for fire service, which sends a resolve notice, the notice text is "התראות המעליות כובו"). Nothing is closed silently;
     the conditions stay tracked, so turning on again does not re-notify them.
- Tests: `tests/test_infra_elevators_280.py` (off by default + silent tracking, no retroactive notification, master overrides state, turning off
  closes with `alerts_disabled` and never re-notifies, nobody without recipients, roles / users / groups intersected with visibility, permissions
  and validation, revision conflict, the generic switch cannot bypass, the catalogue defaults); `tests/unit-elevators.spec.ts` (helpers).
### 9.5 Independent review 2026-10-19 (head 122d31529) - fixes

| Finding | Fix | Regression test |
|---|---|---|
| H1 notification visibility leak | Subject kind `elevator` is now judged per notification: an `elevator.<state>` row is visible only to who sees THAT state's own sensor (an unknown source needs every sensor) - D3 applied per state (`elevators.visible_to(..., role)`, `notify_visibility`). | `test_review_h1_...` (read rule both ways + recipients) |
| M1 "already notified" with nothing opened | With alerts on, the memory row is written only after a notification really opened; a refused (generic policy off) or failing emit leaves no row and the next tick retries. With alerts off the row is still written on purpose (9.4 rule 2: never retroactive). | `test_review_m1_...` (both scenarios) |
| M2 stale history while disabled | A disabled elevator is recorded `unknown`. | `test_review_m2_...` |
| M3 policy delay ignored | Hold = built-in 0 / 30 / 30 s + the source policy's `after_s`. | `test_review_m3_...` |
| L2 hold across a disconnect | A disconnected tick clears the hold timers. | `test_review_l2_...` |
| L3 dead / removed sensor | An open notification is closed (resolution `sensor_unavailable`) at once when its sensor is removed from the platform, after 1 h without a live value otherwise; the condition stays tracked (no re-notify when the sensor returns still on). | `test_review_l3_...` |
| L4 display card overwrite | Each save re-reads the home settings and changes only the elevators widget; the size control sets the layout direction in use only. | (UI; reviewed by hand) |
| L5 personal hidden replaced the installation list | The personal list is ADDED to the installation's (server `apply_personal`; the personal panel disables boxes the administrator hid). | `test_elevators_personal_override_mode_and_hidden`, unit `review L5` |
| L6 edit-panel move buttons | Indices and ends count only the listed widgets (`moveAmong`). | unit `review L6` |
| L8 colour-only state | Each light has a spoken / tooltip text ("תקלה: פעיל"); the bar has a text summary of hours per state. | unit `review L8` |
| L9 orphans after a rollback | The hourly janitor resolves open `elevator.*` notifications whose elevator no longer exists (resolution `elevator_removed`). | `test_review_l9_...` |
| Nit | `device.battery_low` line restored to its original formatting. | - |

Not changed: L1 (the tick keeps the IMMEDIATE transaction, like the generator runner); L7 (`both` mode renders a second section next to the widget
shell - covered since the 2.8.0 integration by `tests/evidence-elevators-home.spec.ts`); the downtime heartbeat suggested under M2 (the last
state before an add-on stop still spans the outage until the first tick after the start writes the new state).