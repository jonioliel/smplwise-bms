# CR-014 — Schedules screen ("תזמונים") on top of the scheduler component

> **CR-019 (switch protection) supersedes the bulk-safe requirement named below:** a switch is schedulable whatever its protection mark; the `switch_not_marked` refusal no longer exists. This design text is kept as history.

Status: DESIGN PROPOSAL (documents and a static mockup only; no product code, no version bump). Owner request 2026-09-30.
Author: design agent, branch `pilot/CR014-scheduler-design`. Hebrew mirror: to be produced by the coordinator; the one-page
owner summary is `CR-014-scheduler-decisions-HE.md`. Mockup: `docs/design/mockups/scheduler/index.html`.

Vocabulary rule (UI copy rules, `docs/design/UI_COPY_RULES.md`): operator screens never name Home Assistant, HA, Supervisor,
add-on or HACS. On screen the platform is "תשתית המערכת" and the component is "רכיב התזמונים". Exact technical names appear only
inside הגדרות › מערכת. This note is a repository document and names things exactly.

## 0. How the facts below were gathered, and how to read the marks

Every scheduler-component / scheduler-card statement was fetched from GitHub on 2026-09-30 (README, `const.py`, `store.py`,
`switch.py`, `websockets.py`, `actions.py`, `timer.py`, `__init__.py`, `manifest.json`, `hacs.json`, the GitHub releases API for both
repositories, and the card's `README.md`, `package.json` and `src/data/**`). The fetch tool returns the page through a summarising
model, so long files were read as extracted excerpts, not byte-for-byte. Therefore:

- **VERIFIED (url)** = read in the named file at fetch time (excerpt or summary of that file). A schema quoted as code is what the
  extraction returned; a re-read on a real instance before phase 2 is still required (task P0 below).
- **UNVERIFIED** = not seen in any fetched file; inferred, remembered from Home Assistant core, or a gap the extraction left open.
- **REPO** = read in this repository at HEAD of this branch (`2df6d9e`).
- **PROPOSAL** = our design choice, not a fact about anyone's software.

Nothing here was checked against the owner's Home Assistant (no access was used or requested).

Base URLs used below: `C` = `https://raw.githubusercontent.com/nielsfaber/scheduler-component/master/`, `K` =
`https://raw.githubusercontent.com/nielsfaber/scheduler-card/master/`.

## 1. How the scheduler component works

### 1.1 Identity, versions, requirements

| Fact | Mark | Source |
|---|---|---|
| Custom integration, domain `scheduler`, name "Scheduler", `config_flow: true`, `dependencies: ["http","websocket_api"]`, `iot_class: local_push`, codeowner @nielsfaber | VERIFIED | `C custom_components/scheduler/manifest.json` |
| Licence GPL-3.0 (repository tree listing `LICENSE (GPL-3.0)`) | VERIFIED | github.com/nielsfaber/scheduler-component |
| Latest release `v3.3.8`, published 2024-11-16 ("deprecation warning STATE_ALARM_TRIGGERED in HA 2024.11"); `const.py` `VERSION = "3.3.8"` | VERIFIED | `api.github.com/repos/nielsfaber/scheduler-component/releases/latest`, `C .../const.py` |
| `hacs.json` requires Home Assistant **2024.11.0 or later** (extraction: "requires ... 2024.11.0 or later") | VERIFIED (via summary) | `C hacs.json` |
| Install: HACS ("scheduler component") or manual copy of `custom_components/scheduler`, restart, then *Settings > Devices & services > Add integration > Scheduler* (config flow; "may need to clear browser cache"). The component ships **no** Lovelace card; the card is a separate repository | VERIFIED | `C README.md` |
| Files: `__init__.py actions.py config_flow.py const.py manifest.json services.yaml store.py switch.py timer.py websockets.py` (no frontend files) | VERIFIED | GitHub contents API |
| The scheduler-card is a separate Lovelace resource, latest `v4.0.19` (2026-06-30), depends on `home-assistant-js-websocket ^8`, `lit ^2.7` | VERIFIED | `api.github.com/repos/nielsfaber/scheduler-card/releases/latest`, `K package.json` |
| Card <-> component minimum-version matrix | UNVERIFIED | not found in fetched files |
| Whether the WebSocket commands are admin-only (`require_admin`) | UNVERIFIED | only one decorator was returned for `handle_subscribe_updates`; the others were not shown with decorators |

### 1.2 Entities

- Each schedule becomes one `switch` entity. Platform = `switch`, `unique_id` = the internal `schedule_id`; `entity_id` = `switch.schedule_<slug(name)>`
  when the name slugifies to something, else `switch.schedule_<schedule_id>` (README says "random 6-digit token"; the code says name slug first). VERIFIED (`C switch.py`, `C README.md`).
- Whether renaming a schedule renames its entity_id: the switch code sets `entity_id` only at construction, while the coordinator
  extract says a name change "triggers entity removal/recreation". **Contradictory -> UNVERIFIED.** Design consequence (PROPOSAL): Arx keys
  every schedule by `schedule_id`, never by `entity_id`.
- **States** (`switch.py`): `on` (enabled, waiting), `off` (disabled), `unavailable` (no upcoming entries), `completed` (last slot finished), `triggered`
  (actions being executed, held 60 s). The README lists `off/on/triggered/unknown` — the README and the code differ; treat the code as authoritative. VERIFIED (both).
- **Entity attributes** (`state_attributes`): `weekdays`, `timeslots` (strings `"HH:MM - HH:MM"` or `"HH:MM"`), `entities` (entity ids from all actions),
  `actions` (the service call of the *first* action of each slot only), `current_slot`, `next_slot`, `next_trigger` (ISO datetime), `tags`. VERIFIED (`C switch.py`).
  These attributes are a lossy summary: no `service_data`, no conditions, no second and later actions, no `repeat_type`, no dates, no name-independent id.
  **An entity mirror alone cannot support editing.**
- Entity services: `scheduler.run_action` (registered on the entity platform, see 1.3).

### 1.3 Services

Registered in `__init__.py` / `switch.py` (VERIFIED, `C __init__.py`, `C const.py`, `C services.yaml`, `C README.md`):

| Service | Fields (exact) | Notes |
|---|---|---|
| `scheduler.add` | `weekdays` (list, default `["daily"]`), `start_date` (`yyyy-mm-dd`), `end_date`, `timeslots` (list, required), `repeat_type` (`repeat`/`single`/`pause`; **required by the code schema**, README says optional/default `repeat`), `name` (string/None), `tags` (list of strings) | README lists all but `tags`; the schema in `const.py` has `tags` |
| `scheduler.edit` | `entity_id` (string, **the schedule's switch entity**), plus any subset of the `add` fields | "only the parameters to change have to be provided" (README). `timeslots`, when given, replaces the whole list. |
| `scheduler.remove` | `entity_id` | |
| `scheduler.copy` | `entity_id`, `name` (optional) | |
| `scheduler.run_action` | `entity_id` (target, entity service), `time` (optional `cv.time`; a single-slot schedule always runs its slot), `skip_conditions` (bool) | runs the slot's actions now; with `skip_conditions` conditions are cleared before queueing |
| `scheduler.enable_all` / `scheduler.disable_all` | none | bulk switch for every schedule |
| `scheduler.reload_storage` | none | reloads `.storage/scheduler.storage` |

- **There is no `scheduler.enable` / `scheduler.disable` for one schedule.** Enabling/disabling one schedule is `switch.turn_on` / `switch.turn_off` on its entity
  (`async_turn_on` / `async_turn_off` exist: turning off empties the action queue and disables via the coordinator). VERIFIED (`C switch.py`).
- The component also exposes the storage over **WebSocket** and **HTTP**:
  - WS commands: `scheduler` (list all), `scheduler/item` (`schedule_id`), `scheduler/tags`, and a subscription command whose type is the event name
    `scheduler_updated` that pushes `{"event": <item_created|item_updated|item_removed|timer_updated|timer_finished>, "schedule_id": ...}`. VERIFIED (`C websockets.py`, `C const.py`).
  - HTTP views `/api/scheduler/list`, `/api/scheduler/add`, `/api/scheduler/edit`, `/api/scheduler/remove` (the extraction names them for `{domain}`). The **card** reads with
    `hass.callWS({type:'scheduler'})` and writes with `hass.callApi('POST','scheduler/add'|'edit'|'remove', body)` (`update_schedule.ts`, `delete_schedule.ts`, `fetch_items.ts`). VERIFIED (`K src/data/store/*.ts`).
  - The schedule dict returned by `scheduler` (per the card's `LegacySchedule` type): `schedule_id`, `entity_id`, `name`, `enabled`, `weekdays`, `timeslots`, `timestamps`, `next_entries`, `repeat_type`, `tags`, `start_date`, `end_date`. VERIFIED (`K convert_legacy_schedule.ts`).
  - Exact JSON shape of a timeslot inside that WS response (start/stop strings, actions as service/entity_id/service_data): **UNVERIFIED** as a byte-level example (the schema below is the input schema).
  - Whether `scheduler.add` can return the new `schedule_id` as a service response: UNVERIFIED (no `SupportsResponse` seen). The `item_created` event carries the id, and a before/after `scheduler` list diff finds it.

### 1.4 Data model (input schema in `const.py`, VERIFIED via extraction)

```
weekdays   : list of  mon|tue|wed|thu|fri|sat|sun|daily|workday|weekend   (unique, min 1; whole schedule, not per slot)
start_date, end_date : "yyyy-mm-dd" | null      (validate_date)
repeat_type: repeat | single | pause
name       : string | null
tags       : list of strings
timeslots  : list (min 1) of
    start            : "HH:MM[:SS]" | "sunrise±HH:MM" | "sunset±HH:MM"     (regex ^([a-z]+)([-|+])([0-9:]+)$, word must be sunrise|sunset)
    stop             : optional, same format          (README: range 00:01 .. 00:00 = start of next day)
    conditions       : optional list (min 1) of { entity_id, attribute?(optional), value (int|float|str), match_type: is|not|below|above }
    condition_type   : optional  and | or
    track_conditions : optional  bool   ("watch condition entities, repeat the actions when conditions become valid")
    actions          : list (min 1) of { service: "domain.service", entity_id?: entity id, service_data?: dict }
```

Semantics that matter for the UI (all VERIFIED via `C switch.py`, `C timer.py`, `C actions.py`):

1. **Actions fire at the slot's START.** At the slot's STOP nothing is executed; the action queue is emptied (pending or postponed actions are cancelled). A slot with `start` and `stop` is a *window*
   in which conditions may still be waiting (`track_conditions`), not a "turn on from A until B" pair. To get "on 08:00, off 18:00" you need **two slots** (08:00 on, 18:00 off). The table column
   "to-time" therefore means "window end", and the UI needs an explicit helper "turn off at the end" that creates the companion slot (PROPOSAL, marked as an Arx convenience, not a component field).
2. Next trigger = the earlier of "end of current slot" and "start of next slot" (`timer.py`).
3. Sun times come from the `sun` entity attributes `next_rising` / `next_setting`; an offset that would push the time outside the day is clamped to 00:00 (minus) or 23:59 (plus) (`timer.py`). Only `sunrise` and `sunset` exist; no dawn/dusk/elevation.
4. `weekdays` `workday` follows the `binary_sensor.workday` integration when present (the tracker reschedules when it changes by more than 60 s). The component then **depends on the Workday integration** for that option — UNVERIFIED which entity id it expects.
5. **`repeat_type`**: `repeat` = restart the cycle; `pause` = after the last slot the schedule turns itself off and reports `completed` (kept in storage); `single` = after the last slot the schedule is **deleted**. The card calls them Repeat / Stop / Delete.
6. Conditions belong to a **timeslot**, not to the schedule; there is no time or sun condition type (sun can be expressed as a state condition on `sun.sun` `above_horizon`/`below_horizon` — PROPOSAL, UNVERIFIED that the component accepts a non-`sensor` entity there, the schema takes any `entity_id`). Conditions are evaluated only when the actions are about to fire (card README), unless `track_conditions`.
7. Actions are executed one after another (`ActionQueue`) with `async_call_from_config`; **no user context** is set (the call runs as the system), a climate action that sets both HVAC mode and temperature is split into two calls, an unavailable entity/service is only logged at debug level. So the component gives **no failure signal** to build a "failed runs" list on (see 2.6).
8. Overlapping slots: the card refuses overlaps (`validate_schedule.ts` `OverlappingTime`); whether the component itself rejects them is UNVERIFIED.
9. The component's schema uses `vol.Schema` without `extra=ALLOW_EXTRA` in the excerpts returned, so **unknown keys in a timeslot or action are rejected** on add/edit — a client cannot stash private metadata inside a slot. (UNVERIFIED: the extraction did not show an `extra=` argument either way.)

### 1.5 Storage and persistence

- File `<config>/.storage/scheduler.storage`, storage key `scheduler.storage`, **storage version 3**; migrations v1->v2 (adds `start_date`/`end_date`) and v2->v3 (equalises condition counts across slots). Entities are created from that file at start. Included in HA snapshots. VERIFIED (`C store.py`, `C README.md`).
- Stored entries (attrs classes): `ScheduleEntry(schedule_id, weekdays, start_date, end_date, timeslots, repeat_type, name, enabled)`, `TimeslotEntry`, `ActionEntry(service, entity_id, service_data)`, `ConditionEntry(entity_id, attribute, value, match_type)`, `TagEntry(name, schedules[])`. VERIFIED.
- **There is no revision / etag / modified-at field** on a schedule (VERIFIED by absence in `ScheduleEntry`). Concurrency control must be built by Arx (2.5).
- There is **no order field, no folder field, no owner/creator field, no description field**. The only organisation primitive is `tags` (many-to-many, stored as tag -> schedule ids).

### 1.6 What the scheduler-card can and cannot do (the opportunity)

Verified from `K README.md` and `K src/data/**` (file names and summaries):

| Card can | Card cannot / is weak at (our opportunity) |
|---|---|
| List of schedules with a header toggle, tap to edit; sort by `relative-time`, `title`, `state` (`sort_by`) | No table of from-time / to-time rows; no per-entity or per-area overview; no week-wide view |
| Entity picker -> action picker (per-entity supported actions, custom actions and variables in YAML), days, time picker with sunrise/sunset, options (conditions, period, completion behaviour, name) | Configured mostly in YAML (`include`, `exclude`, `customize`, `display_options`); no admin UI for who may do what |
| Time-scheme editor with draggable slot markers (per schedule, one day pattern) — `insert_timeslot.ts` splits a slot at its midpoint (rounded to 15 min); `remove_timeslot`, `move_timeslot`; overlap and missing-action validation | One 24 h bar per schedule; **no week grid**, no copy to other days, no snapping choice (`time_step` default 10 min is a card option) |
| Tags to split schedules between several cards (`tags`, `exclude_tags`, special values `none/enabled/disabled`), `discover_existing` | No manual ordering, no folders/floors/areas, no archive, no bulk select, no duplicate/import/export in the UI |
| Conditions per slot (`states` configured in YAML), period (start/end date), completion Repeat/Stop/Delete | Conditions "only evaluated at the time the actions should fire" (README) — the card never explains `track_conditions` |
| Multi-language (Hebrew included) | No permissions: whoever sees the dashboard can change every schedule; no audit; no run history; no "next 5 runs"; no conflict detection between schedules |
| Exports a multi-target action by expanding it to one action per entity (`save_schedule.ts`) | README statement that the card "can only be used to create schedules to trigger a single action at a certain point in time" is in the README (VERIFIED as text); how it applies to multi-action slots is UNVERIFIED |

## 2. How Arx would talk to it

### 2.1 What exists today in this repository (REPO)

- `smplwise_vms/backend/smplwise/services/ha_client.py`: reads over the Supervisor proxy (`/api/states`, `/api/config`, and a WebSocket session with `ws_session(...)`
  giving an `await call(type, **kw)` helper that already runs registry commands); **the only write path is the signed bridge service `smplwise_bridge.execute`** (and `set_entity_area`).
  Comment in the file: the add-on's token never impersonates a user.
- `ha_sync.py` mirrors states into `ha_entities` (columns include `platform`, `config_entry_id`, `attributes_json` trimmed by an allow-list `ATTR_ALLOW`, domains in `STATE_DOMAINS_SKIP` dropped).
  `switch` is **not** skipped, so `switch.schedule_*` entities are mirrored today as ordinary switches, but `ATTR_ALLOW` keeps none of the scheduler attributes (`weekdays`, `timeslots`, `next_trigger`, `tags`, ...).
- `integration/smplwise_bridge/__init__.py` (v0.2.6): `execute` verifies the HMAC signature, checks `(domain, service)` against `ALLOWED_SERVICES`, resolves the HA user and calls the service with `Context(user_id=...)`, so Home Assistant's own per-user entity permission applies.
  It also holds the second write, `set_entity_area`. The add-on repeats the allow-list in `services/ha_bridge.ACTIONS` with argument validation, risk classes (`routine` / `attention` / `sensitive`) and extra grants (`door.unlock`, `alarm.disarm`).
- Permissions and scope: `services/ha_scope.py` (`CONTROL_PERMISSIONS = ha.entity.control | devices.control`, `DEVICES_CONTROL_DOMAINS`, `devices_control_reaches` refusing door/gate covers and the door layer), `routers/ha.py` `run_action` (audited `ha.action`, `_refuse_alarm_managed` -> 409 `use_alarm_screen`), `services/alarm.py` `managed_controls` / `is_managed_control`, `services/device_bulk.py` (administrator "bulk-safe" marks in `device_bulk_safe`), `roles.json` (`sensitive_permissions_not_implied`).
- `services/bridge_install.py` copies the bridge into `<ha config>/custom_components` when the add-on has the `homeassistant_config` mapping. It ships only our own integration; a GPL-3.0 third-party component is not ours to bundle (see open question 5).

### 2.2 Read path (PROPOSAL)

Two complementary sources; the WebSocket is the source of truth, the mirrored entity gives cheap live state.

1. **Schedule definitions: HA WebSocket command `scheduler` / `scheduler/item` / `scheduler/tags`** through the add-on's existing `ws_session` (Supervisor token; admin-level, so the "admin-only WS" question does not block us). A small `ScheduleMirror` service (new `services/schedules.py`):
   - full pull at start and after a reconnect (`scheduler` list -> table `schedules_cache(schedule_id, entity_id, revision, json, seen_at)`, revision = SHA-256 of the canonical JSON without the volatile keys `timestamps`, `next_entries`);
   - subscription to the `scheduler_updated` event (`item_created|updated|removed` -> refetch that item; `timer_updated|finished` -> refresh live fields), debounced like `ha_sync`;
   - detects "component missing": WS answers `unknown_command` for `scheduler` -> status `component_missing`; component present but no schedules -> empty state.
2. **Live state**: keep mirroring `switch.schedule_*` through `ha_sync` and add `next_trigger`, `current_slot`, `next_slot` to `ATTR_ALLOW` (a one-line change) so the list shows on/off/triggered and the next run without polling. The other attributes stay out (they are lossy).
3. **Device catalogue hygiene**: rows whose registry `platform == "scheduler"` (already stored in `ha_entities.platform`) must be **excluded from the devices area, tiles and bulk actions** and from the generic `POST /ha/entities/{id}/actions` (today a `devices.control` holder could `switch.turn_off` a schedule from the devices screen, bypassing every schedule permission). PROPOSAL, small, safety-relevant, worth doing even before the feature ships.

Cache is a read model only; it never becomes the authority (HA storage is). All reads served from the cache are filtered per viewer (2.4).

### 2.3 Write path (PROPOSAL)

Never call `scheduler.*` directly from the add-on (that would be the "unrestricted HA service call" `AGENTS.md` forbids). Extend the bridge (**version 0.3.0**):

- New signed service `smplwise_bridge.schedule` (`SupportsResponse.ONLY`), fields: `user_id`, `op`, `request_id`, `ts`, `nonce`, `sig` and `payload`. `op` allow-list: `add`, `edit`, `remove`, `copy`, `run`, `enable`, `disable`. Same envelope, signature, replay protection as `execute`.
  Mapping: add/edit/remove/copy -> `scheduler.add|edit|remove|copy`; run -> `scheduler.run_action`; enable/disable -> `switch.turn_on|turn_off` on the schedule's entity; **never** `enable_all`, `disable_all` or `reload_storage` from the product (an admin can do that in HA).
- The bridge **re-validates the payload independently of the add-on** (defence in depth, like `ALLOWED_SERVICES` today): every action's `service` must be in a *schedule allow-list* that is a strict subset of `ALLOWED_SERVICES` (lights, switches, covers open/close/set position, climate set mode/temperature/fan/preset, fans, humidifiers, media_player on/off/volume; **no** `lock.*`, **no** `alarm_control_panel.*`, **no** `button/script/scene` unless the settings switch of 2.4 is on, **no** free service names); `service_data` keys per service follow the same argument specs as `ha_bridge.ACTIONS`; entity ids must exist in the registry; the schedule's `entity_id` (for edit/remove/copy/run/enable/disable) must belong to platform `scheduler`.
- The bridge additionally asks Home Assistant whether the HA user may control **each** action entity (`user.permissions.check_entity(entity_id, POLICY_CONTROL)` — HA core API from memory, **UNVERIFIED here**, verify on the lab before use). Reason: `scheduler.add/edit` are not entity services, so HA itself would not check the entities inside `timeslots`. The check must be in the bridge, and it intersects with the Arx scope check in the add-on.
- The add-on runs after the bridge answers: re-reads `scheduler/item`, updates the cache, writes the audit row, and answers the client with the new `revision`.
- Creating: the id of a new schedule is learned from the `item_created` event or a list diff (1.3); the API answers 202 with `client_request_id` and completes as soon as the schedule shows up in the mirror (timeout -> `unknown`, never retried blindly — AGENTS.md: never blindly retry physical commands).
- Editing keeps the whole schedule in one `scheduler.edit` call (timeslots are replaced as a unit).

### 2.4 Backend API (routes, scoping, audit) — PROPOSAL

Router `routers/schedules.py`, prefix `/api/v1` like the rest. All handlers authorise per operation and per schedule; the body never carries authority.

| Route | Purpose | Permission (scope) |
|---|---|---|
| `GET /schedules/status` | `{available, component_version?, feature_enabled, bridge_version, can:{view,manage,run}, hidden_count (admin only)}` | any signed-in user; values computed per caller |
| `GET /schedules?q=&area=&floor=&entity=&state=&day=&tag=&folder=&archived=&sort=&group=` | list, already filtered to what the caller may see; each item carries `revision`, `editable`, `read_only_reasons[]`, `next_run`, `entities[]` (id+name+area), `slots[]` summary | `schedule.view` |
| `GET /schedules/{schedule_id}` | full model (slots, actions, conditions, tags, dates) + `raw` round-trip blob (2.5) | `schedule.view` |
| `POST /schedules` | create; body validated to the schedule allow-list; `client_request_id` | `schedule.manage` + control on every action entity |
| `PUT /schedules/{id}` | replace; body carries `base_revision`; 409 `schedule_changed` with the current version if the revision moved | `schedule.manage` + control on every entity **old and new** |
| `PATCH /schedules/{id}/state` `{enabled}` | enable/disable | `schedule.manage` + control on every entity |
| `POST /schedules/{id}/run` `{slot?, skip_conditions:false}` | run now | `schedule.run` + control on every entity; `attention`-risk actions need `confirm:true` (same rule as `ha.action`) |
| `POST /schedules/{id}/copy` | duplicate, name "העתק של ..." | `schedule.manage` |
| `DELETE /schedules/{id}` `{base_revision, confirm:true}` | delete; a snapshot goes to Arx's trash first (2.7) | `schedule.manage` |
| `POST /schedules/{id}/restore` | from trash | `schedule.manage` |
| `GET /schedules/preview` `POST` body | server-side "next runs" for an unsaved draft (sun times from the mirrored `sun.sun`, IANA zone from settings, weekday/period rules) | `schedule.view` |
| `GET/PUT /schedules/organisation` | Arx-owned order, folders, pins, archive flags (2.7) | `schedule.manage` |
| `GET /schedules/history?schedule=&result=&since=` | derived activity list (2.6) | `schedule.view` |
| `POST /schedules/export`, `POST /schedules/import` | JSON bundle (Arx format wrapping the component's fields) | `schedule.manage`; import only creates (never overwrites) |
| `GET/PUT /settings` keys `schedules.*` | feature flag, allowed domains, snap, safety switches | `system.configure` |

Scoping rule (one function, reused by every route, same style as `ha_scope`):

- `entities(schedule)` = every `entity_id` in every action of every slot (conditions' entities need only `entity.state.read`, not control).
- **View**: the caller must be allowed to *see* all entities of the schedule (`entity.state.read` at the entities' floors); otherwise the schedule is **absent** from the list (not masked). The admin's status shows `hidden_count`. (Open question 1 offers a "masked row" variant.)
- **Change (create/edit/enable/disable/delete)**: the caller must hold `schedule.manage` **and** a control grant (`ha.entity.control` or `devices.control`, at the entity's own floor scope, `devices_control_reaches` for `devices.control`) on **all** entities of the old and the new version. One uncontrolled entity makes the whole schedule read-only for that caller with a per-entity reason ("אין הרשאת שליטה בתריס המחסן").
- **Run now**: `schedule.run` plus the same control test (running a schedule is controlling its devices).
- Excluded from schedules altogether, whoever asks (server-enforced, echoed by the bridge): `alarm_control_panel.*` and every alarm-managed control (`alarm.is_managed_control`), `lock.*` (unlock is a `sensitive` grant, lock alone is not worth an unattended path), door/gate/garage covers and anything on the door layer (`devices_control_reaches` rules), `siren`, `button`, unknown domains. `script.turn_on`, `scene.turn_on`, `input_boolean` and `switch` are governed by the safety switches below; `switch` requires the entity's **bulk-safe mark** (REPO `device_bulk_safe`), the same administrator decision that already says "this switch is a light, not a door strike".
- A schedule the caller may see but that contains something Arx does not understand (2.5) is `editable:false` with reason `unsupported_content`, and can still be enabled/disabled/run only by a caller with `schedule.manage` (toggle does not touch content).

Audit (`audit(...)`, existing helper): actions `schedule.create`, `schedule.update`, `schedule.delete`, `schedule.enable`, `schedule.disable`, `schedule.run`, `schedule.copy`, `schedule.import`, `schedule.restore`, `schedule.settings`; `resource_type = "schedule"`, `resource_id = schedule_id`; `details` hold the entity ids, a short diff (slots added/removed/changed, days, dates) and the new revision — never full `service_data` of unknown services; denied attempts are audited with the reason (`entity_not_controllable`, `service_not_allowed`, `stale_revision`, `feature_disabled`). An unattended run is not an Arx action: it is recorded as history (2.6), attributed to the schedule's last editor as "owner of record" in the UI text only.

Permissions (PROPOSAL, additions to `roles.json` and the `access.py` catalogue):

| Permission | Meaning | In default roles |
|---|---|---|
| `schedule.view` | see schedules (scoped as above), next runs, history | viewer, operator, editor, site_admin, system_admin |
| `schedule.manage` | create/edit/copy/enable/disable/delete/organise | site_admin, system_admin; listed in `sensitive_permissions_not_implied` (never implied by a role name, granted explicitly, scoped to floors like `devices.control_bulk`) |
| `schedule.run` | run now | operator, site_admin, system_admin; sensitive (physical) — still needs control on every entity |

`system.configure` alone administers the settings section; it does **not** grant `schedule.manage`.

### 2.5 Concurrency with HA and the scheduler-card (PROPOSAL)

Anyone can edit the same schedules in HA or the card; the component has no revision (1.5).

- **Revision** = SHA-256 of canonical JSON of the schedule (all fields but the volatile ones). Every read returns it; every write sends `base_revision`.
- **Server check**: immediately before the bridge call the add-on refetches `scheduler/item`; different revision -> 409 `schedule_changed` (audit `stale_revision`) with the current version. A window of a few milliseconds between the check and the service call remains and is accepted, since the component offers no compare-and-set; documented, not hidden.
- **Live conflict banner**: the `scheduler_updated` event moves the open editor's base; if the schedule changed while the editor holds unsaved edits, the editor shows "התזמון שונה במקום אחר" with three choices: reload (discard mine), compare, keep mine (overwrite after the new revision is adopted).
- **Round-trip fidelity**: Arx stores and sends back what it read. The editor model holds `raw` (the untouched slots, actions and conditions as JSON) next to the parsed view. Anything Arx cannot render exactly — an action with no `entity_id`, a service outside the allow-list, `service_data` keys the form does not know, a condition with `attribute`, a multi-entity or multi-action slot beyond what the editor shows, unknown keys of a future component version — is preserved verbatim if untouched; if the person edits a slot that contains such content, that slot becomes read-only with an explicit "ערוך ברכיב המקורי" note. A schedule made only of unsupported content is fully read-only (`unsupported_content`).
- **Names vs ids**: key by `schedule_id`; a rename never changes what Arx tracks.
- **Component storage reload / restart**: entities re-appear; the mirror does a full pull and keeps Arx's own organisation rows keyed by `schedule_id`.

### 2.6 Run history is derived, not native

The component fires only internal dispatcher events (VERIFIED, `actions.py`), records nothing about results, and logs failures at debug level. So the "activity" list (screen 5) is **best effort and must say so**:

- A run = the schedule's switch going to `triggered` (already arriving through `state_changed`, and reconstructable from the recorder history via the existing `ha_history.py`). Result = the target entities' states after 20 s versus the expected effect, using the same confirmation logic as `ha_actions.refresh` (`confirmed` / `unknown`), plus "skipped" when the entity was unavailable. It is never reported as a certain failure — wording "לא אושר" (not confirmed).
- Next/last run come from `next_trigger` and the last `triggered` timestamp.
- Table `schedule_runs(schedule_id, started_at, result, detail)` in the add-on DB, pruned to 90 days.

### 2.7 Organisation (PROPOSAL)

- **Groups / tags**: use the component's `tags` (native, many-to-many, visible in the card as `tags` filter) for user-visible grouping ("משרדים", "תאורת חוץ"). Round-trips in HA.
- **Order, folders, pins, archive, notes**: the component has none, so they live in an add-on table `schedule_meta(schedule_id, folder_id, sort_key, pinned, archived_at, note)`; if Arx is uninstalled HA keeps working and the schedules stay intact (only the order is lost).
- **Archive** = component `enabled=false` **plus** `archived_at` in Arx (hidden from the default list, restorable). **Trash** = a JSON snapshot of the schedule kept 30 days in `schedule_trash` before the component's own remove — the only undo (HA has none).
- **Per-floor/area views**: computed from the entities' HA area/floor (mirrored `area_id`, `ha_floor_id`) and Arx placements (the same scope that `ha_scope` uses); a schedule touching several floors appears under each.

### 2.8 Component not installed / feature off

| Situation | Operator view (any user) | Admin view (`system.configure`) |
|---|---|---|
| Feature disabled in settings | the "תזמונים" tab is not shown at all | Settings section shows the switch |
| Component missing (`unknown_command`) | tab shown only if `schedule.view`; short neutral state: "אין תזמונים להצגה. הפעלת התזמונים מנוהלת בהגדרות." No product names. | Same screen plus the button "פתח את הגדרות התזמונים" -> the settings section explains, exactly: install the "Scheduler" custom integration (HACS or manual), restart, add the integration, minimum Home Assistant 2024.11.0, and shows a live check ("רכיב התזמונים לא נמצא / נמצא בגרסה 3.3.8") |
| Component present, bridge too old (< 0.3.0) | read-only list works; writes disabled with "נדרש עדכון של רכיב החיבור" (admin: bridge update) | version numbers exact |
| Bridge missing/unpaired | list works (WS read only needs the add-on token), writes disabled | pairing hint as the devices area shows it today |
| No permission | "מצב צפייה" banner; controls disabled with tooltips | — |

### 2.9 Bridge / allow-list changes needed (summary)

1. Bridge 0.3.0: `schedule` service + `SCHEDULE_ALLOWED_SERVICES` + per-op schemas + `user.permissions.check_entity` per action entity (verify the API). `manifest.json`/`const.py` version bump. Keep `execute` unchanged.
2. Add-on: `ha_bridge` gains `SCHEDULE_ACTIONS` (allow-list + argument specs, reusing `ACTIONS` entries) and `sign_schedule_op`; `ha_client.call_bridge_schedule` (a separate audited function, like `call_bridge_set_area`).
3. `ha_sync.ATTR_ALLOW` += `next_trigger`, `current_slot`, `next_slot`; devices/tiles/bulk/`run_action` refuse `platform == "scheduler"` entities.
4. `roles.json`, `routers/access.py` permission catalogue, settings keys `schedules.*`, migrations for `schedule_cache`, `schedule_meta`, `schedule_trash`, `schedule_runs`.
5. `ha_scope`: a `schedule_scope(conn, principal, entities)` helper reusing `control_decision` / `devices_control_reaches_checker`.

## 3. UI decisions that follow from the component model

- **One schedule = one weekday set + a list of slots.** The week grid (7 x 24 h) is therefore a *view over schedules*, not a data structure of the component. In the schedule editor the grid shows only the schedule's own days; days that share the same slots are shown "linked" (one edit changes all of them, with a badge "משפיע על 5 ימים"). Editing a slot for **only one day** asks to split the schedule ("נפצל לשני תזמונים: יום ג׳ / שאר הימים") — an explicit, confirmed action creating a second schedule with the same name plus a suffix and tags. A read-only **area week view** composes all schedules of an area on the same grid; clicking a bar opens its owner.
- **Slot = window with an action at its start.** The bar's start edge carries the action icon; the end edge is labelled "סוף חלון". The helper "כיבוי בסיום" (turn off at end) creates the companion off-slot; the table shows both rows and links them.
- **Table view** columns: from, to, action, entities, days, conditions, next run; inline editing of from/to/action; "all days" or per day; the same underlying model as the graph, so the two views always show identical rows.
- **Time types**: fixed (`HH:MM`) and `sunrise/sunset` with `±HH:MM` offset; the graph draws sun markers using the mirrored `sun.sun` next rising/setting for *today* (the marker moves daily — the UI says "משוער להיום").
- **Snap** 5/15/30 minutes is an Arx editor setting only; the component stores any minute (seconds optional).
- **Conditions**: entity state or numeric attribute comparison, `and`/`or` per slot, `track_conditions` ("המשך לבדוק עד סוף החלון"). Time and sun are not conditions in the component: time = the slot itself, sun = the sun time type or a state condition on the sun entity. The mockup labels this mapping.
- **Repeat types** wording: `repeat` "חוזר", `pause` "פעם אחת ואז מושהה (נשמר)", `single` "פעם אחת ואז נמחק" — the last one is destructive and gets a warning.
- Preview of next runs is computed by Arx (server, `preview` route) because the component only exposes `next_trigger` for saved schedules.

## 4. Phased plan, effort, risks

Estimates are agent-hours of focused work including tests and screenshots, ± 30 %. They assume the mockup is the visual source.

**Phase 0 — spike on the lab (read-only), 4-6 h.** With the owner's approval: install nothing; if the component is already on the lab HA, call WS `scheduler`, `scheduler/item`, `scheduler/tags`, read `switch.schedule_*` attributes, confirm the JSON shapes, the `admin-only` question, whether `scheduler.add` can return a response, whether an edit that renames changes the entity id, and `user.permissions.check_entity` in the bridge. Output: fixtures (redacted) + a corrected section 1.

**Phase 1 — read-only list and table, 30-38 h.** Tabs restructure ("מבט על" | "תזמונים", the overview moves under the first tab, no behaviour change), `ScheduleMirror` + cache + status route, list/cards/table modes, search/filter/sort/group, summary strip, next-run display, area/floor filter, states (loading, empty, component missing, no permission), `ATTR_ALLOW` change, exclusion of scheduler entities from the devices area, permissions `schedule.view`, settings section (feature flag), tests (backend unit + route + frontend + screenshots 1440/390 x loading/empty/error/ready). No bridge change, no writes. Breakdown: backend 12 h, frontend 16 h, tests/screens 6 h, docs 2 h.

**Phase 2 — create / edit / run / delete, 64-80 h.** Bridge 0.3.0 + write path + allow-list + audit + revisions/conflicts + trash + `schedule.manage`/`schedule.run`; drawer editor (entities picker, actions, conditions, days, repeat, dates, preview, validation, unsaved guard), 24 h day timeline + week grid with drag/resize/move/snap/copy-to-day, sun markers, graph<->table toggle, phone variant, create flow with templates and the 3-tap quick create, split-schedule flow. Breakdown: bridge + backend 26 h, editor and grids 30 h, create flow/templates 8 h, tests/screens 12 h, lab verification (with approval) 4 h.

**Phase 3 — organisation, 26-34 h.** Tags UI, folders, drag + keyboard reorder, pins, archive/restore, per-floor/area views, bulk select + bulk enable/disable/tag/move, import/export, `schedule_meta`, area week composition view.

**Phase 4 — extras, 28-36 h.** Derived activity/history (2.6), conflict detection between schedules (same entity, overlapping slots, opposite actions), seasonal templates, failed-run notification through the existing push, kiosk display of "next runs", admin "who-may-do-what" matrix, accessibility pass.

Total 152-194 h for everything; phases 1+2 (a usable, safe product) 94-118 h.

**Risks**

1. Third-party component: fields, storage version and WS shapes can change; GPL-3.0 (no bundling); we depend on a single maintainer. Mitigation: phase 0 fixtures, version gate in status route, everything unknown stays read-only, contract test per component version.
2. No revision/CAS in the component: residual lost-update window (2.5). Mitigation: recheck + live banner + audit.
3. Unattended physical actions: a schedule keeps acting after the creator loses rights or the entity is repurposed. Mitigation: allow-list, bulk-safe requirement, alarm/lock exclusion, per-domain switches, nightly "schedule audit" (phase 4) listing schedules whose creator no longer controls all entities; run-now needs confirmation for `attention` actions.
4. Actions fire without a user context (component runs as system): Arx's scope check is the only per-person gate at write time; a compromised add-on token cannot write (bridge signature) but HA users with direct access can still edit schedules in HA — the documented limit that "Arx restrictions do not restrict the original HA UI" (`AGENTS.md`).
5. Week-grid expectations vs the component's one-weekday-set model (section 3): splitting creates several schedules; the UX must make this understandable. Mitigation: linked-days badge, split dialog, area week view.
6. Derived history can be wrong (2.6). Mitigation: label it, never show "failed", only "not confirmed".
7. Existing `switch.schedule_*` exposure in the devices area (2.2, item 3) is a present-day gap; independent of this feature.
8. Time-axis direction: the existing weekly grid (`frontend/src/components/sw-week-grid.ts`, REPO) draws its hours with `direction: ltr` (00 at the left) inside the RTL page, day labels on the start side. The mockup follows that precedent (time runs left to right, day names at the right edge). Confirm with the owner (question 10).

## 5. Open questions for the owner (short; Hebrew version in the decisions file)

1. Visibility: a schedule that includes a device the person may not see — (a) hide it, (b) show a masked row "תזמון (כולל התקנים שאינך רואה)", (c) show fully, read-only.
2. Who may create/edit — (a) only site/system admins, (b) also operators inside the devices they can control, (c) per-schedule owner.
3. Which devices may be scheduled — (a) lights, bulk-safe switches, climate, fans, (b) plus blinds (not doors/gates), (c) plus scenes and scripts.
4. Alarm and locks — (a) never from a schedule, (b) arming only, with admin approval, (c) never disarm.
5. Component not installed — (a) instructions in Settings only, (b) a guided installer later (needs a separate approval; GPL-3.0 licence review).
6. Grouping — (a) component tags (visible in the original card), (b) Arx-only folders.
7. Delete — (a) permanent after confirmation, (b) 30-day trash inside Arx (recommended).
8. Schedules created in the original card — (a) editable when fully understood, else read-only, (b) always read-only in Arx, (c) Arx may rewrite them.
9. Day-specific edits — (a) split the schedule with confirmation, (b) edit only whole schedules.
10. Time axis direction — (a) 00:00 at the left as in today's weekly grid (recommended, consistent), (b) 00:00 at the right (Hebrew reading order).
11. First step — (a) start with phase 0 on the lab then phase 1, (b) phases 0+1 together.

## 6. Mockup mapping index

Screenshots of every screen and state (1440, 820, 390) are in `docs/design/mockups/scheduler/screens/`. The product has no general dark scheme (`tokens.css` is light only; only the devices area has its own dark palettes), so the mockup has no dark toggle. Interaction checks run against the built file with Playwright (drag create / resize / move with 15-minute snap, keyboard move, table inline edit and sun-time parsing, overlap clamping, unsaved-changes guard, search, bulk bar, delete/run confirmations, quick create, keyboard reorder): all passed, no console errors.

The mockup (`mockups/scheduler/index.html`) annotates each control with the field/service in the side panel "הערות עיצוב". Highlights: name -> `name`; days -> `weekdays`; period -> `start_date`/`end_date`; repeat -> `repeat_type`; slot bar -> one `timeslots[]` item (`start`, `stop`); sun marker -> `start: "sunset+00:30"`; action chip -> `actions[]` (`service`, `entity_id`, `service_data`); conditions -> `conditions[]`, `condition_type`, `track_conditions`; enable toggle -> `switch.turn_on/off`; run now -> `scheduler.run_action`; duplicate -> `scheduler.copy`; delete -> `scheduler.remove` (after an Arx trash snapshot); tag chip -> `tags`; order/folder/archive -> Arx tables (no component field).
