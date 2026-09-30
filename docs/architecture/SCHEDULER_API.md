# CR-014 Schedules ("תזמונים") — binding API contract and work breakdown

Status: **CONTRACT for phases 1 + 2** (read, create, edit, run, enable/disable, delete, restore). Architect branch
`pilot/CR014-scheduler-arch` (on top of `g0/intake` 0b5bab9 and the design branch 7c9db1d). Typed client:
`frontend/src/api/schedules.ts`; demo data: `frontend/src/api/schedules-mock.ts`. Owner note (Hebrew):
`SCHEDULER_API_HE_NOTE.md`. Design sources: `docs/design/CR-014-scheduler.md` ("the note"),
`docs/design/CR-014-scheduler-decisions-HE.md`, `docs/design/mockups/scheduler/`.

Precedence inside CR-014: this contract > the note's PROPOSAL sections > the mockup. Deviations from the mockup are
listed in §12.4. Contract changes are made only by the coordinator on this branch; implementation branches rebase.

## 0. Decisions this contract implements

Owner answers 2026-09-30 ("as recommended", then overrides A and B and the conditions emphasis the same day):

| # | Decision | Where |
|---|---|---|
| 1a | A schedule whose **action** entity the caller may not see is **absent** (never masked). Condition entities never hide a schedule; out-of-scope conditions are shown read-only and locked | §4.3 |
| 2 (override B) | Who edits = a **permission** the owner grants to any user or role: `schedule.view`, `schedule.manage`, plus `schedule.sensitive`. Defaults: system_admin all three, site_admin view + manage, nobody else. Least-privilege scope: edit only when the binding scope covers **every** action entity | §4 |
| 3/4 (override A) | Allowed: lights, bulk-safe switches, climate, fans, covers/blinds **and** (sensitive) alarm arm/disarm, locks lock/unlock, doors/gates. No scenes/scripts/others | §5 |
| 5a | "כיבוי בסיום" helper adds a companion off slot (UI only) | §2.7 |
| 6a | Editing one day of a multi-day schedule splits it after confirmation (server op `split`) | §3.10 |
| 7a | Delete = confirmation + 30-day Arx trash with restore | §3.11–3.13, §7 |
| 8a | Tags in the component (writing them once verified, §1.3), order and folders in Arx | §7 |
| 9a | External schedules editable when fully understood, else read-only; unknown content never rewritten | §2.6 |
| 10a | Phase 0 read-only first → probe script + checklist; development against a FAKE built from real shapes | §9, §11 |
| — | Conditions are first-class (Shabbat/holiday sensor), with presets "לא בשבת ובחג" / "רק בשבת ובחג" / "מוצאי שבת" | §2.4, §5.8, §12.5 |
| — | Time axis 00:00 at the left (LTR axis inside the RTL page, as `sw-week-grid.ts`) | §12 |

## 1. Facts this contract relies on

Marks: **V-LIVE** = verified read-only on a live production Home Assistant 2026.9.3 with 23 schedules (dump of WS
`scheduler`, `scheduler/item`, `scheduler/tags`, the switch states, the registry rows and the services; 2026-09-30; the
dump is private evidence and never enters the repository). **V-LAB** = verified read-only on the owner's lab HA 2026.9.4
(component loaded, zero schedules). **V-SRC** = from the component's source (the note). **U** = unverified — each has a
mitigation and a phase-0 id (P0-n, §11).

### 1.1 Verified

| Fact | Mark |
|---|---|
| Services under `scheduler` with fields: `add` [end_date, name, repeat_type (required), start_date, timeslots, weekdays], `edit` [+ entity_id], `remove` [entity_id], `copy` [entity_id, name], `run_action` [entity_id, skip_conditions, time], `enable_all` [], `disable_all` []. **`reload_storage` is not registered** (the note listed it) | V-LAB + V-LIVE |
| WS `scheduler` and `scheduler/item` return the same item structure; `scheduler/tags` returns `[{name, schedules: [schedule_id…]}]` | V-LIVE |
| Item keys (all 23 identical): `schedule_id, entity_id, name, enabled, weekdays, start_date, end_date, repeat_type, tags, timeslots, timestamps, next_entries` | V-LIVE |
| `schedule_id`: 6 lower-case hex chars; `entity_id` = `switch.schedule_<slug>` where the slug is HA's slugify of the name (Hebrew transliterated) or the schedule id for an unnamed schedule — **opaque, never derived**; `name` may be empty/null (2 of 23) | V-LIVE |
| Timeslot keys always all present: `start`, `stop` (may be `null`: a point action), `conditions` (`[]` when none), `condition_type` (`or` or `null`), `track_conditions` (bool), `actions` | V-LIVE |
| Time strings `HH:MM:SS` and `sunset+HH:MM:SS` (also for `stop`); sunrise form per V-SRC | V-LIVE |
| Action keys always `service`, `entity_id` (may be `null`), `service_data` (`{}` when empty) | V-LIVE |
| Services in real use: `climate.set_temperature` {hvac_mode, temperature (int or float, e.g. 25.5)}, `climate.turn_off`, `switch.turn_on/off`, `light.turn_on` {brightness 0–255}, `light.turn_off`, `cover.close_cover`, `cover.set_cover_position` {position}, `alarm_control_panel.alarm_arm_home` {} (no code, point slot), `script.<id>` with `entity_id: null` (including scripts that no longer exist) | V-LIVE |
| Conditions `{entity_id, attribute: "state", value: "on", match_type: "is"}` on `binary_sensor` entities (a Jewish-calendar "issur melacha in effect" sensor); **identical conditions in every slot of a schedule** (23/23), `condition_type: "or"` even with one condition; the service description says conditions "should be kept the same for all timeslots" | V-LIVE |
| Slots of a schedule are contiguous (each `stop` = next `start`), typically covering the day 00:00 → 00:00 | V-LIVE |
| `timestamps`: one ISO datetime with offset per slot (its next occurrence); `next_entries`: slot indexes in upcoming order | V-LIVE |
| `weekdays` `["daily"]` (23/23); `repeat_type` `repeat` (22) and `pause` (1); one schedule with a season `start_date`/`end_date` | V-LIVE |
| Switch: state `on` / `off` (disabled = `off`, 5 of 23); attributes `actions` (first action per slot, `{service, data}`), `current_slot` (int or null), `entities`, `friendly_name` (not the schedule name — never displayed), `icon`, `next_slot`, `next_trigger` (ISO with offset), `tags`, `timeslots` (strings `"HH:MM:SS - HH:MM:SS"` or `"HH:MM:SS"`), `weekdays` | V-LIVE |
| Registry rows: platform `scheduler`, `unique_id` = `schedule_id`, domain `switch`, a `device_id` and a config entry, no area | V-LIVE |
| Enable/disable = `switch.turn_on/off` on the schedule switch (no per-schedule service); actions fire at slot START; nothing at STOP; actions run without user context; no failure signal | V-SRC |

### 1.2 Unverified, with mitigation

| Id | Unverified | Mitigation |
|---|---|---|
| P0-1 | Weekday forms other than `daily` (`sun`…, `workday`, `weekend`) as stored | Normaliser accepts all V-SRC tokens; split and Arx next-run computation refuse `workday`/`weekend` |
| P0-2 | `scheduler_updated` subscription frame shape | Three refresh layers (subscription, switch `state_changed`, 10-minute pull) (§6.2) |
| P0-3 | `tags` accepted by `scheduler.add/edit` services (in the extracted schema, absent from the service field list) | Tag **editing disabled** until verified (`capabilities.tags=false`); existing tags shown |
| P0-4 | Whether `add` / `copy` return the new id | Not needed: the bridge diffs the entity registry (§8.4) |
| P0-5 | Rename changes the entity id | Keyed by `schedule_id`; entity id re-read after each write |
| P0-6 | WS commands admin-only | Reads use the Supervisor token; recorded only |
| P0-7 | Negative sun offsets as stored (`sunset-HH:MM:SS`; only `+` seen) | Accepted by the V-SRC regex; Arx writes `-` only after P0-7, until then the editor offers offsets ≥ 0 |
| P0-8 | `user.permissions.check_entity(entity_id, POLICY_CONTROL)` in HA 2026.9 | Bridge fails closed (`permission_check_unavailable`) |
| P0-9 | The component rejects unknown keys | Arx writes only V-LIVE keys; unknown keys ⇒ read-only |
| P0-10 | Overlapping slots rejected by the component | Arx refuses overlaps itself |
| P0-11 | Write form of an empty condition list (`[]` vs omitted) and of `condition_type: null` | Arx writes the stored form (`conditions: []`, `condition_type: null`, `track_conditions: false`) — identical to what it reads, so untouched slots round-trip byte-equal |
| P0-12 | `match_type` `not` / `above` / `below` and non-`state` attributes in real use | Accepted (V-SRC); presets use only the V-LIVE form (`is` + `state`) |
| P0-13 | `switch.turn_on/off` emits `item_updated`; `copy` naming without `name`; `single` repeat behaviour | Arx refetches after writes, always sends a name, warns on `single` |

### 1.3 Capability flags

`GET /schedules/status` → `capabilities: {tags: bool, negative_sun_offset: bool}`, both `false` until P0-3 / P0-7 are
verified; backend constants in `services/schedule_policy.py` (code, not settings) flip in the release after
verification. With `tags=false` a draft may carry tags only when equal to the current ones, else 422
`tags_not_supported`.

## 2. The Schedule model

Component strings are kept as they are stored; instants are UTC ISO-8601 with `Z`. `id` = `schedule_id` (never the
entity id). Day ids are the component's tokens; display order is Sunday first (א׳ = `sun`).

### 2.1 Read model (`Schedule`)

```json
{
  "id": "3f9a1c",
  "entity_id": "switch.schedule_shbt_slvn",
  "name": "סלון – קירור בשבת",
  "display_name": "סלון – קירור בשבת",
  "enabled": true,
  "state": "on",
  "days": { "tokens": ["daily"], "kind": "daily", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] },
  "start_date": null,
  "end_date": null,
  "repeat": "repeat",
  "slots": [
    { "index": 0,
      "start": { "kind": "fixed", "time": "00:00", "raw": "00:00:00" },
      "stop": { "kind": "fixed", "time": "06:00", "raw": "06:00:00" },
      "actions": [ { "service": "climate.set_temperature", "entity_id": "climate.living_room",
                     "data": { "hvac_mode": "cool", "temperature": 25 },
                     "supported": true, "class": "climate", "sensitive": false, "lowering": false } ],
      "supported": true, "unsupported": [] },
    { "index": 1,
      "start": { "kind": "fixed", "time": "06:00", "raw": "06:00:00" },
      "stop": { "kind": "sun", "event": "sunset", "offset_min": 30, "raw": "sunset+00:30:00" },
      "actions": [ { "service": "climate.turn_off", "entity_id": "climate.living_room", "data": {},
                     "supported": true, "class": "climate", "sensitive": false, "lowering": false } ],
      "supported": true, "unsupported": [] }
  ],
  "conditions": {
    "items": [ { "entity_id": "binary_sensor.shabbat_mode", "name": "איסור מלאכה", "attribute": "state",
                 "match_type": "is", "value": "on", "readable": true, "state": "off", "available": true, "locked": false } ],
    "type": "or",
    "track": false,
    "uniform": true,
    "summary": "רק בשבת ובחג",
    "preset": "only_holy_days"
  },
  "entities": [
    { "entity_id": "climate.living_room", "name": "מזגן סלון", "domain": "climate", "role": "action",
      "area_id": "living", "area_name": "סלון", "floor_id": "f0", "floor_name": "קומת קרקע",
      "class": "climate", "sensitive": false, "available": true }
  ],
  "tags": ["שבת-חג"],
  "folder_id": null,
  "order": 10,
  "pinned": false,
  "next_run": { "at": "2026-10-02T21:00:00Z", "slot_index": 0, "source": "component", "conditional": true },
  "upcoming": [ { "at": "2026-10-02T21:00:00Z", "slot_index": 0 }, { "at": "2026-10-03T03:00:00Z", "slot_index": 1 } ],
  "last_run": { "at": "2026-09-27T03:00:01Z", "slot_index": 1, "result": "confirmed" },
  "sensitive": false,
  "sensitive_classes": [],
  "lowering": false,
  "source": "external",
  "owner": null,
  "created_at": null,
  "updated_at": "2026-09-30T08:40:01Z",
  "revision": "9f2c0d1e4b7a6c35",
  "can": { "edit": true, "toggle": true, "run": true, "delete": true, "copy": true },
  "read_only": null,
  "warnings": [],
  "raw": { "schedule_id": "3f9a1c", "…": "the component's item, verbatim (detail route only)" }
}
```

Field rules:

- `display_name` = `name`, or for an unnamed schedule "{first action entity name} · {n} משבצות" ("תזמון ללא שם"
  without actions). The switch `friendly_name` is never shown.
- `state`: switch state (`on | off | triggered | completed | unavailable | unknown`); `enabled` from the item.
- `days.kind`: `days`, `daily`, `workday`, `weekend`, `mixed`; `days.days` resolved for `days` / `daily`, else `null`.
- `start` / `stop`: `{kind: "fixed", time: "HH:MM"}` (seconds dropped for display only; `raw` keeps them) or
  `{kind: "sun", event, offset_min}`; `stop: null` = point action; `"00:00:00"` as stop = end of day.
- `actions[].data` = `service_data` minus `entity_id`; `class` (§5.1) or `null` when unsupported.
- `conditions` (§2.4): the schedule-level block. `entities` = action entities only (conditions live in
  `conditions.items`).
- `next_run` / `upcoming` from the item: `timestamps[next_entries[k]]` (V-LIVE), `source: "component"`; `computed`
  (§6.5) only when the item has no timestamps. **`conditional: true` whenever the schedule has conditions**: the
  component's timestamps do not evaluate conditions, so the UI says "בתנאי" and never promises the run (§12).
- `last_run` from `schedule_runs` (§6.6). `sensitive` / `lowering` (§5.3). `source`: `arx` when Arx created it.
- `owner` = owner of record (last Arx editor, else Arx creator, else `null`). `revision` (§2.5). `can`, `read_only`
  and each condition's `readable` / `state` / `locked` are **per caller** (§4). `raw` only on the detail route.

### 2.2 Write model (`ScheduleDraft`)

```json
{
  "name": "סלון – קירור בשבת",
  "weekdays": ["daily"],
  "start_date": null,
  "end_date": null,
  "repeat": "repeat",
  "tags": ["שבת-חג"],
  "conditions": {
    "items": [ { "entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "match_type": "is", "value": "on" } ],
    "type": "or",
    "track": false
  },
  "slots": [
    { "start": "00:00:00", "stop": "06:00:00",
      "actions": [ { "service": "climate.set_temperature", "entity_id": "climate.living_room", "data": { "hvac_mode": "cool", "temperature": 25 } } ] },
    { "start": "06:00:00", "stop": "sunset+00:30:00",
      "actions": [ { "service": "climate.turn_off", "entity_id": "climate.living_room", "data": {} } ] }
  ]
}
```

- Times in the stored form: `HH:MM:SS`, `sunrise+HH:MM:SS`, `sunset+HH:MM:SS` (negative offsets per P0-7).
- `conditions` apply to **every** slot (the component's own rule); `items: []` = no conditions.
- `weekdays`: explicit tokens or `["daily"]`; `workday` / `weekend` only when unchanged (P0-1).
- `name` required on create; on edit it may stay empty only if it was empty.
- pydantic-closed (`extra="forbid"`). Mapping to the component payload: §8.2.

### 2.3 Day tokens

`sun mon tue wed thu fri sat daily workday weekend`. Hebrew: א׳ ב׳ ג׳ ד׳ ה׳ ו׳ ש׳, "כל יום", "ימי עבודה", "סוף שבוע".

### 2.4 Conditions (first-class)

| Field | Values | Mark |
|---|---|---|
| `entity_id` | any entity id (new conditions: domains `binary_sensor`, `sensor`, `sun`, `input_boolean`) | V-LIVE (binary_sensor) |
| `attribute` | `"state"` (compare the state) or an attribute name `^[a-z_][a-z0-9_]{0,63}$` | `state` V-LIVE; others V-SRC |
| `match_type` | `is`, `not`, `above`, `below` | `is` V-LIVE; others V-SRC (P0-12) |
| `value` | string (1–100 chars) for `is`/`not`; number for `above`/`below` | `"on"` V-LIVE |
| `type` (per schedule) | `and` / `or`; Arx writes `or` for a single condition (as the card does), the user's choice for several | V-LIVE (`or`) |
| `track` | `track_conditions` bool: re-check until the window ends ("המשך לבדוק עד סוף החלון"), needs a slot `stop` | V-SRC |

Read view per condition: `name`, `readable` (the caller may read the entity, §4.3), `state` (current state, only when
readable), `available`, `locked` (§4.4). `uniform: false` when slots carry different conditions (not seen live) — then
the content is read-only (§2.6, sub-reason `conditions_differ`) and `items` shows slot 0's.

`summary` / `preset`: computed server-side. With the Shabbat sensor setting (§10.1) configured and the block equal to
a preset: `only_holy_days` (`is` `on`) → "רק בשבת ובחג"; `not_holy_days` (`is` `off`) → "לא בשבת ובחג". Otherwise
"בתנאי: {name} {op} {value}" joined by "או" / "וגם" (e.g. "בתנאי: איסור מלאכה פעיל"). `null` when no conditions.

### 2.5 Revision

First 16 hex chars of SHA-256 over canonical JSON (`sort_keys=True, separators=(",", ":"), ensure_ascii=False`) of the
item **minus** `timestamps`, `next_entries`, `enabled`, `entity_id`. Opaque to the client.

### 2.6 Fully understood vs read-only content (decision 9a)

**Understood** = every action has an `entity_id`, its service is allowed for the entity's class (§5.2), `data` keys and
values pass §5.4, no `code` key anywhere, no alarm-managed control, conditions uniform across slots, and no key outside
the V-LIVE shapes. Otherwise the whole schedule's **content** is read-only (`unsupported_content`, sub-reasons in
`slots[].unsupported`: `action_without_entity`, `action_not_allowed`, `argument_not_allowed`, `contains_code`,
`alarm_managed_control`, `conditions_differ`, `unknown_fields`). Real example (V-LIVE): a `script.<id>` action with
`entity_id: null`, including a script that no longer exists — shown, round-tripped by never rewriting it, read-only.

Why whole-schedule: `edit` replaces all timeslots and the bridge re-validates every slot, so an unsupported slot could
never be re-sent. Unknown **top-level** keys are never sent (`edit` takes only changed fields). `raw` keeps everything.

### 2.7 "כיבוי בסיום" (decision 5a)

UI helper: for a slot with "on"-type actions (`light.turn_on`, `switch.turn_on`, `fan.turn_on`,
`climate.set_hvac_mode` ≠ off, `climate.set_temperature`), add a slot at the slot's `stop` (contiguous, matching the
V-LIVE pattern) with the off counterparts (`light.turn_off`, `switch.turn_off`, `fan.turn_off`, `climate.turn_off`) for
the same entities. No storage; `pairedOffSlot()` in `schedules.ts` recognises such pairs.

## 3. REST routes

Router `routers/schedules.py`, prefix `/api/v1`, tag `schedules`. Every handler authorises per operation and per
schedule; the body never carries authority. Bodies are pydantic with `extra="forbid"`. Errors use `ApiError`.
Writes carry `client_request_id` (8–80 chars, idempotent per user via `schedule_ops`).

| # | Method | Path | Purpose | Auth (§4) |
|---|---|---|---|---|
| 3.1 | GET | `/schedules/status` | availability, capabilities, caller's `can`, counts | any signed-in user |
| 3.2 | GET | `/schedules` | filtered list | view |
| 3.3 | GET | `/schedules/{id}` | one schedule with `raw` | view + visible |
| 3.4 | GET | `/schedules/catalog` | action entities the caller may schedule, with actions | manage (anywhere) |
| 3.4b | GET | `/schedules/condition-candidates` | entities usable in conditions | manage (anywhere) or `system.configure` |
| 3.5 | POST | `/schedules/preview` | validate a draft + upcoming runs | view or manage |
| 3.6 | POST | `/schedules` | create | manage + control (+ sensitive) |
| 3.7 | PUT | `/schedules/{id}` | replace content (`base_revision`) | editable (old AND new) |
| 3.8 | POST | `/schedules/{id}/enable`, `/disable` | switch on / off | toggle |
| 3.9 | POST | `/schedules/{id}/run` | run now | run |
| 3.10 | POST | `/schedules/{id}/split` | day split | editable |
| 3.11 | POST | `/schedules/{id}/delete` | trash + remove | delete |
| 3.12 | POST | `/schedules/{id}/copy` | copy | copy |
| 3.13 | GET / POST | `/schedules/trash`, `/schedules/trash/{trash_id}/restore`, `/schedules/trash/{trash_id}/purge` | trash | view / create rules / installation-wide manage |
| 3.14 | POST | `/schedules/bulk` | enable / disable many | toggle per item |
| 3.15 | GET / PUT | `/schedules/organisation` | folders, order, pins (UI phase 3) | view / manage |
| 3.16 | GET | `/schedules/runs` | derived activity | view + visible |
| 3.17 | GET | `/schedules/review` | administrator review list | installation-wide manage |
| 3.18 | GET | `/schedules/tags` | tags on visible schedules | view |

Delete is a POST because it carries a body (`base_revision`, `confirm`) and the product's `del()` sends none.

### 3.1 `GET /schedules/status`

```json
{
  "available": "ok",
  "feature_enabled": true,
  "stale": false,
  "last_sync_at": "2026-09-30T13:40:02Z",
  "writable": true,
  "write_block": null,
  "capabilities": { "tags": false, "negative_sun_offset": false },
  "can": { "view": true, "manage": true, "sensitive": false, "configure": true },
  "counts": { "visible": 12, "enabled": 10, "attention": 1, "hidden": 2 },
  "settings": { "snap_minutes": 15, "default_repeat": "repeat",
                "classes": ["light", "switch", "cover", "climate", "fan", "alarm", "lock", "door"],
                "shabbat_sensor": { "entity_id": "binary_sensor.shabbat_mode", "name": "איסור מלאכה", "state": "off", "available": true } },
  "admin": { "component": "found", "component_version": "3.3.8", "bridge_version": "0.3.0", "bridge_required": "0.3.0", "ha_version": "2026.9.4" }
}
```

- `available`: `ok | component_missing | ha_unavailable | not_configured | feature_disabled | error`.
- `write_block`: `null | feature_disabled | component_missing | ha_unavailable | bridge_missing | bridge_unpaired | bridge_too_old`.
- `settings.shabbat_sensor`: `null` when not configured; its name and on/off state are shown to every schedule viewer
  (a calendar fact, §4.3).
- `counts.hidden` and `admin`: only for installation-wide `system.configure`; `null` / absent otherwise.
- Never 403: a caller without view gets `can.view=false` and zero counts.

### 3.2 `GET /schedules`

Query: `q` (name, entity or condition name, tag; ≤ 80), `floor`, `area`, `entity` (action entity), `condition`
(condition entity id), `has_conditions` (bool), `preset` (`only_holy_days | not_holy_days`), `day`, `state`
(`enabled|disabled|triggered|completed|unavailable`), `tag`, `folder`, `source`, `sensitive`, `editable`, `sort`
(`next_run` default | `name` | `order` | `updated`), `limit` (1–500, default 200), `offset`.

```json
{ "items": [ "Schedule without raw" ], "total": 12, "offset": 0, "limit": 200,
  "status": { "available": "ok", "stale": false, "last_sync_at": "…" } }
```

Visibility is applied **before** filters, totals and pagination.

### 3.3 `GET /schedules/{id}`

`Schedule` with `raw`. Invisible or unknown → 404 `schedule_not_found`.

### 3.4 `GET /schedules/catalog`

The editor's action-entity picker (one server-side source of classes, allow-list, bulk-safe, door-layer and alarm rules).
Query `q`, `floor`, `area`, `class`.

```json
{ "entities": [
  { "entity_id": "cover.gym_shutter", "name": "תריס אולם", "domain": "cover", "class": "cover", "sensitive": false,
    "area_id": "gym", "area_name": "אולם ספורט", "floor_id": "f0", "floor_name": "קומת קרקע", "available": true,
    "selectable": true, "reason": null, "attributes": { "current_position": 100 },
    "actions": [
      { "service": "cover.close_cover", "label": "סגירה", "lowering": false, "args": [] },
      { "service": "cover.set_cover_position", "label": "מיקום", "lowering": false,
        "args": [ { "name": "position", "type": "int", "min": 0, "max": 100, "required": true } ] } ] },
  { "entity_id": "switch.boiler", "name": "דוד", "domain": "switch", "class": "switch", "sensitive": false,
    "selectable": false, "reason": { "code": "switch_not_marked", "message": "המתג לא סומן כבטוח לפעולה קבוצתית." }, "actions": [] } ],
  "truncated": false }
```

Non-selectable entities appear (with reason) when visible and their class is enabled; alarm bypass controls and
scheduler switches never appear. `args[].type`: `int | float | enum | str | bool`, with `min/max` or `choices` (taken
from the entity: `hvac_modes`, `fan_modes`, `preset_modes`, `min_temp`/`max_temp`). Limit 500 (`truncated`).

### 3.4b `GET /schedules/condition-candidates`

Query `q`, `domain` (`binary_sensor | sensor | sun | input_boolean`). Entities the caller may **read** (§4.3; an
installation-wide list for `system.configure` holders, used by הגדרות › תזמונים to pick the Shabbat sensor):

```json
{ "entities": [ { "entity_id": "binary_sensor.shabbat_mode", "name": "איסור מלאכה", "domain": "binary_sensor",
                  "device_class": null, "state": "off", "unit": null, "numeric": false, "suggested_shabbat": true } ],
  "truncated": false }
```

`suggested_shabbat` uses the home screen's Jewish-calendar heuristic, extracted by S1 into
`services/home_screen.is_jewish_calendar(entity)` (platform `jewish_calendar` or "jewish" in the id), plus
`issur_melacha` in the id. The existing `/devices/home-candidates` is **not** reused: it lists `sensor.*` only (the
issur-melacha entity is a `binary_sensor`), is unscoped and requires `system.configure`. Limit 500.

### 3.5 `POST /schedules/preview`

Body `{ "draft": ScheduleDraft, "schedule_id": "3f9a1c" | null, "count": 5 }` (count 1–20). Always 200 for a well-formed
body; problems are data here:

```json
{ "valid": false,
  "errors": [ { "path": "slots[1].actions[0].data.temperature", "code": "out_of_range", "message": "טמפרטורה מחוץ לטווח 16–30." } ],
  "warnings": [ { "path": "conditions.items[0]", "code": "sensitive_condition_unavailable", "message": "תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת." } ],
  "upcoming": [ { "at": "2026-09-30T16:00:00Z", "slot_index": 1, "summary": "כיבוי · מזגן סלון" } ],
  "conditional": true, "sensitive": false, "lowering": false,
  "requires": { "sensitive_permission": false, "confirm_lowering": false, "alarm_code": false } }
```

### 3.6 `POST /schedules` (create)

Body `{ "draft": ScheduleDraft, "enabled": true, "client_request_id": "…", "confirm_lowering": false, "alarm_code": null }`.

- Validation (§5), authorisation (§4.4), classes setting, rate limit (§3.19); `confirm_lowering` required for lowering
  drafts (409 `lowering_confirmation_required`); `alarm_code` only when §5.6 asks, verified and discarded.
- Bridge `add` (§8) → re-read `scheduler/item` → `schedule_meta` (`created_via='arx'`), cache, audit → **201**
  `{ "schedule": Schedule, "op_id": "…" }`.
- Bridge ok but `id_unknown` → **202** `{ "status": "unknown", "op_id": "…", "message": "התזמון נשלח; יופיע ברשימה לאחר אישור." }`;
  adopted by the next pull (name + content hash); never re-sent.
- `enabled: false` → created then disabled (two bridge calls, one op).

### 3.7 `PUT /schedules/{id}`

Body `{ "draft": ScheduleDraft, "base_revision": "…", "client_request_id": "…", "confirm_lowering": false, "alarm_code": null }`.

1. Fresh `scheduler/item` read. §4.4 "edit" for the **old** content and the **new** draft, and the locked-condition
   rule (§4.4): 403 `condition_locked` if a condition the caller may not read was changed or removed.
2. `base_revision` ≠ current → **409 `schedule_changed`** `details: {current: Schedule, base_revision,
   current_revision}`, audited `denied/stale_revision`. The window between check and bridge call is accepted (no CAS).
3. Bridge `edit` with only the changed top-level fields (`timeslots` whole when any slot or the conditions changed).
4. 200 `{ "schedule": Schedule, "op_id": "…" }`.

### 3.8 `POST /schedules/{id}/enable` · `/disable`

Body `{ "client_request_id": "…", "confirm_lowering": false, "alarm_code": null }`. Enabling a lowering schedule needs
`confirm_lowering`. Already in state → 200 `changed: false`, no bridge call. Answer `{ "schedule": Schedule, "changed": true }`.

### 3.9 `POST /schedules/{id}/run`

Body `{ "slot_index": 0 | null, "skip_conditions": false, "confirm": true, "client_request_id": "…", "alarm_code": null }`.

- `confirm` required when the slot has an `attention`-risk (`ha_bridge.ACTIONS`) or sensitive action → 409.
- `slot_index` → bridge `run` with `time` = the slot's start (sun times resolved for today); null → only for a
  one-slot schedule, else 422 `slot_required`. `skip_conditions: true` needs `schedule.manage` at installation scope
  when the schedule has locked conditions for the caller.
- One run per schedule per 10 s installation-wide (429 `run_too_soon`). 202 `{ "run_id": "…", "note": "הבקשה נשלחה; התוצאה תופיע בהרצות." }`.
  Never retried.

### 3.10 `POST /schedules/{id}/split` (decision 6a)

Body `{ "base_revision": "…", "days": ["tue"], "name": null, "confirm": true, "client_request_id": "…" }`. `days` =
non-empty strict subset of the resolved days (`daily` expands to seven); `workday`/`weekend` → 422 `split_not_possible`.
(1) bridge `add` the new schedule (same slots, conditions, dates, repeat, tags, enabled; name `name` or "<name> · <days>");
(2) bridge `edit` the original with the remaining days; if (2) fails, (1) is removed; if that fails too → 502
`split_incomplete` with both ids. 200 `{ "original": Schedule, "created": Schedule }`.

### 3.11 `POST /schedules/{id}/delete`

Body `{ "base_revision": "…", "confirm": true, "client_request_id": "…" }`. Snapshot to `schedule_trash` (30 days)
**then** bridge `remove`; bridge failure → the snapshot is removed again. 200 `{ "trash_id": "…", "expires_at": "…" }`.

### 3.12 `POST /schedules/{id}/copy`

Body `{ "name": "העתק של …", "client_request_id": "…" }`. Bridge `copy`; the copy is `source: arx`, owner = caller.
201 `{ "schedule": Schedule }`.

### 3.13 Trash

- `GET /schedules/trash` → `{ "items": [ { "trash_id", "schedule_id", "name", "deleted_at", "expires_at", "deleted_by": {"username", "display_name"}, "entities": [...], "sensitive": bool, "can_restore": bool } ] }`.
- `POST /schedules/trash/{trash_id}/restore` `{ "client_request_id", "confirm_lowering", "alarm_code" }` → re-created
  by bridge `add` under the **current** rules; new `schedule_id`; meta moves; 201 `{ "schedule": Schedule }`. Expired → 404.
- `POST /schedules/trash/{trash_id}/purge` `{ "confirm": true }` — installation-wide `schedule.manage`; Arx data only.
- The janitor purges expired rows daily.

### 3.14 `POST /schedules/bulk`

Body `{ "op": "enable" | "disable", "ids": [...], "confirm": true, "client_request_id": "…" }` (1–100 ids; each checked
like 3.8; ≤ 4 bridge calls in flight). 200 `{ "results": [ { "id", "ok": true, "changed": true } | { "id", "ok": false, "code", "message" } ] }`.
Audit per item + one `schedule.bulk`. Lowering schedules are refused in bulk enable. The administrator's tool for §5.9.

### 3.15 Organisation (backend phase 2, UI phase 3)

`GET` → `{ "folders": [ {"id", "name", "position"} ], "items": [ {"schedule_id", "folder_id", "order", "pinned"} ] }`
(visible schedules). `PUT` (manage anywhere) replaces folders and the given items' placement; names 1–40 chars, ≤ 50
folders; audited `schedule.organise`.

### 3.16 `GET /schedules/runs`

Query `schedule_id`, `since`, `result`, `limit` (≤ 200). `{ "items": [ { "id", "schedule_id", "schedule_name",
"slot_index", "started_at", "settled_at", "result": "pending|confirmed|not_confirmed|skipped|unknown", "via":
"component|run_now", "sensitive", "detail": { "entities": [ {"entity_id", "expected", "observed", "result"} ] } } ] }`.
Best effort (§6.6); wording never "נכשל".

### 3.17 `GET /schedules/review`

Installation-wide `schedule.manage`. `{ "items": [ { "schedule": Schedule, "issues": [...] } ] }`, issues:
`owner_lost_rights`, `owner_inactive`, `no_owner_sensitive`, `contains_code`, `unsupported_content`, `class_disabled`,
`sensitive_condition_unavailable`, `alarm_may_need_code`.

### 3.18 `GET /schedules/tags`

`{ "tags": [ { "name": "שבת-חג", "count": 15 } ] }` over visible schedules.

### 3.19 Limits

- Writes 30/min/user → 429 `rate_limited`; preview 60/min/user; run §3.9.
- Body: product default 1 MiB (`body_limit.py` unchanged). Draft caps: name ≤ 80 chars (no control chars); ≤ 48 slots;
  ≤ 20 actions per slot; ≤ 10 conditions; ≤ 50 distinct action entities; ≤ 10 tags of 1–40 chars; `data` ≤ 8 keys.
- Bridge calls: 15 s timeout, never retried → 504 `scheduler_timeout`, op `unknown`.

### 3.20 Error codes (Hebrew user messages, verbatim)

| Status | code | user_message |
|---|---|---|
| 403 | `forbidden` | אין הרשאה לפעולה זו בהיקף המבוקש. |
| 403 | `entity_not_controllable` | אין לך הרשאת שליטה ב־{name}. |
| 403 | `sensitive_permission_required` | תזמון של אזעקה, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות. |
| 403 | `grant_required` | הפעולה דורשת הרשאה נפרדת ({label}). |
| 403 | `condition_locked` | התנאי "{name}" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו. |
| 403 | `condition_not_readable` | אין לך הרשאה לקרוא את {name}, ולכן אי אפשר להוסיף אותו כתנאי. |
| 403 | `remote_control_disabled` / `remote_disarm_disabled` | the alarm router's existing texts |
| 403 | `wrong_code` | קוד שגוי. |
| 404 | `schedule_not_found` | התזמון לא נמצא. |
| 404 | `trash_not_found` | הפריט אינו בסל המחזור (ייתכן שפג תוקפו). |
| 409 | `schedule_changed` | התזמון שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור. |
| 409 | `confirmation_required` | פעולה זו דורשת אישור מפורש. |
| 409 | `lowering_confirmation_required` | תזמון שמנטרל אזעקה, פותח נעילה, דלת או שער דורש אישור מפורש. |
| 409 | `code_required` | נדרש קוד. (details.prompt as in the alarm router) |
| 409 | `feature_disabled` | התזמונים כבויים בהגדרות המערכת. |
| 422 | `validation` | ערך לא תקין — {field}: {what} (details.errors[] with path / code / message) |
| 422 | `action_not_allowed` | הפעולה אינה מותרת בתזמון. |
| 422 | `class_not_allowed` | סוג ההתקן אינו מותר בתזמונים (הגדרות › תזמונים). |
| 422 | `switch_not_marked` | המתג לא סומן כבטוח לפעולה קבוצתית; רק מתגים מסומנים נכנסים לתזמון. |
| 422 | `alarm_managed_control` | רכיב זה נשלט ממסך האזעקה ואינו נכנס לתזמון. |
| 422 | `alarm_code_needed` | לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה. |
| 422 | `lock_code_needed` | המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו. |
| 422 | `code_not_allowed` | אסור לשמור קוד בתוך תזמון. |
| 422 | `arm_mode_not_supported` | לוח האזעקה אינו תומך במצב דריכה זה. |
| 422 | `condition_domain_not_allowed` | אפשר להתנות רק בחיישנים, חיישנים בינאריים, מתגי עזר או מצב השמש. |
| 422 | `slots_overlap` | משבצות חופפות באותו תזמון. |
| 422 | `slot_required` | בחרו איזו משבצת להריץ. |
| 422 | `split_not_possible` | לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה. |
| 422 | `unsupported_content` | התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי. |
| 422 | `tags_not_supported` | רכיב התזמונים בגרסה זו אינו שומר תגיות. |
| 429 | `rate_limited` | יותר מדי שינויים ברצף; נסו שוב בעוד רגע. |
| 429 | `run_too_soon` | התזמון הורץ ממש עכשיו; נסו שוב בעוד כמה שניות. |
| 429 | `code_locked` | the alarm router's existing text |
| 502 | `scheduler_refused` | רכיב התזמונים דחה את השינוי. (details.error = the bridge code) |
| 502 | `split_incomplete` | הפיצול לא הושלם; בדקו את שני התזמונים. |
| 503 | `scheduler_unavailable` | התזמונים אינם זמינים כרגע. |
| 503 | `ha_unavailable` | תשתית המערכת אינה זמינה כרגע. (existing) |
| 503 | `bridge_not_paired` / `bridge_too_old` | existing / נדרש עדכון של רכיב החיבור כדי לשמור תזמונים. |
| 504 | `scheduler_timeout` | רכיב התזמונים לא ענה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף. |

Operator screens never name Home Assistant, HA, Supervisor, HACS or the component's repository name; "תשתית המערכת"
and "רכיב התזמונים" are the approved words (`docs/design/UI_COPY_RULES.md`). Exact names appear only in
`status.admin` and הגדרות › תזמונים.

## 4. Authorisation

### 4.1 Permissions (roles.json, `routers/access.py` PERMISSION_LABELS, `contracts/examples/role-catalog.design.json`)

| Permission | Hebrew label | Default roles | `sensitive_permissions_not_implied` |
|---|---|---|---|
| `schedule.view` | צפייה בתזמונים | site_admin, system_admin | no |
| `schedule.manage` | ניהול תזמונים: יצירה, עריכה, הפעלה והשבתה, הרצה מיידית, מחיקה ושחזור | site_admin, system_admin | **yes** |
| `schedule.sensitive` | תזמון פעולות רגישות: אזעקה, מנעולים, דלתות ושערים | system_admin | **yes** |

- Nobody else by default. The owner grants them to any user or role through the existing access screens (bindings
  with scope; custom roles — `schedule.manage` / `schedule.sensitive` in the role's **sensitive** list,
  `schedule.view` in its ordinary list). The RBAC has no role templates; the documented recipe is a custom role
  "עורך תזמונים" = `schedule.view` + sensitive `schedule.manage`, bound at the floors the person should edit.
- Reads accept `schedule.view` **or** `schedule.manage`. There is no separate run permission (run = manage).
- `system.configure` administers הגדרות › תזמונים and sees `status.admin`; it grants no schedule right.

### 4.2 Entity scope primitive

For permission P and entity E: `ha_scope.entity_allowed(conn, principal, E, P)` (installation-wide, or E placed on a
floor where P is held; HA areas/floors are never a scope). Build per-request predicates once (`visible_floors` +
`placements`, the `ha_scope.control_checker` pattern).

### 4.3 Visibility (list, detail, trash, runs, tags, counts) — decision 1a, conditions refinement

The caller sees schedule S iff for **every action entity** E of S:
1. (`schedule.view` or `schedule.manage`) at E, and
2. (`devices.read` or `entity.state.read`) at E, and
3. E is an alarm panel → `alarm.view` at the panel's own placements (`ha_scope.own_placements`).

A schedule without any action entity is visible only to installation-wide viewers. Invisible schedules are absent from
every list, count, tag list, run list and search; direct access 404. `counts.hidden` tells administrators how many.

**Condition entities never hide a schedule.** A condition entity C is `readable` for the caller when
(`entity.state.read` or `devices.read`) at C, or C is the configured Shabbat sensor (`schedules.shabbat_sensor`: a
calendar fact shown to every schedule viewer). Readable → name + live state; not readable → name and the condition
itself ("בתנאי: {name} פעיל"), no live state, `readable: false`.

### 4.4 Change rights (`can`) and read-only reasons

For the **old** content and, on edit, the **new** draft, every **action** entity E must pass:

| Rule | Check |
|---|---|
| manage | `schedule.manage` at E |
| control | normal classes: `ha_scope.control_allowed(E)` |
| lock | `ha.entity.control` at E; `lock.unlock` also `door.unlock` at E |
| door | `ha.entity.control` at E (devices.control never reaches doors) |
| alarm | `alarm.arm` (arm modes) / `alarm.disarm` (disarm) at the panel's own placements — the alarm section's authority, not control_allowed |
| sensitive | class ∈ {alarm, lock, door} → `schedule.sensitive` at E |
| classes | the class enabled in `schedules.classes` |

Conditions: a condition whose entity is **not readable** by the caller is `locked: true` — it must reach the bridge
unchanged (same entity, attribute, match_type, value; `type` and `track` unchanged while such a condition exists), else
403 `condition_locked`. Adding a condition needs its entity readable (else 403 `condition_not_readable`). So a
floor-scoped editor edits times and actions of a Shabbat schedule on their floor but never its holiday condition when
the sensor is outside their scope.

`can` per caller:

| Flag | Rule |
|---|---|
| `edit` | understood (§2.6) AND all rules pass AND `writable` |
| `toggle` | all rules pass AND `writable`; not understood → only disable, only installation-wide `schedule.manage` (safety valve) |
| `run` | understood AND all rules pass AND `writable` |
| `delete` | all rules pass AND `writable`; not understood → installation-wide `schedule.manage` only |
| `copy` | `edit` |

`read_only` = `null` or `{ "reasons": [ { "code", "message", "entity_id"? } ] }`; codes: `no_manage_permission`,
`entity_not_controllable`, `grant_required`, `sensitive_permission_required`, `class_disabled`, `unsupported_content`,
`feature_disabled`, `component_unavailable`, `ha_unavailable`, `bridge_unavailable`. A plain `schedule.manage` holder
sees a sensitive schedule **read-only** (never hidden for lack of `schedule.sensitive`: nobody should create a
conflicting schedule blind). Create: the draft alone is evaluated; restore: the snapshot under current rules.

### 4.5 Remote channel

A `source == "remote"` principal follows `alarm.remote_control` / `alarm.remote_disarm` for drafts, enables, restores
and runs with alarm actions (the alarm router's refusals). Everything else is identical.

### 4.6 Audit (`audit.audit`, resource_type `schedule`, resource_id = schedule_id or trash_id)

Actions: `schedule.create`, `schedule.update`, `schedule.enable`, `schedule.disable`, `schedule.run`,
`schedule.split`, `schedule.copy`, `schedule.delete`, `schedule.restore`, `schedule.purge`, `schedule.bulk`,
`schedule.organise`; system rows (actor `None`): `schedule.executed` (a run of a sensitive schedule observed, §6.6) and
`schedule.changed_outside` (a sensitive schedule changed without an Arx op). Settings stay `settings.update`.
`details`: `{op_id, entities, classes, sensitive, lowering, conditions: [entity ids], revision_before, revision_after,
diff: {days, dates, repeat, conditions_changed, slots_added, slots_removed, slots_changed, name_changed}}`; runs
`{slot_index, skip_conditions}`. Never other `service_data` values than allow-listed arguments, never a code, never
`raw`. Denials are audited with the `ApiError` code. `note_grant` records `schedule.manage` (+ `schedule.sensitive`).

## 5. Safety rules and validation

### 5.1 Classes (server-classified from the mirror)

| Class | Entities | Sensitive |
|---|---|---|
| `light` | `light` | no |
| `switch` | `switch`, **bulk-safe marked** (`device_bulk_safe`), not on the door layer, not alarm-managed, not a scheduler switch | no |
| `cover` | `cover`, device_class ∉ {door, garage, gate}, not on the door layer | no |
| `climate` | `climate` | no |
| `fan` | `fan` | no |
| `alarm` | `alarm_control_panel` discovered by the alarm section | yes |
| `lock` | `lock` | yes |
| `door` | covers with device_class ∈ `DOOR_COVER_CLASSES`; `cover` / `switch` / `button` on the map's door layer | yes |

Never schedulable: alarm-managed controls (bypass) → `alarm_managed_control`; unmarked switches →
`switch_not_marked`; scheduler switches, scripts, scenes, plain buttons, sirens, input_*, humidifier, media_player,
vacuum, number, select, notify, every other domain → `action_not_allowed`. WisKey door release is not an HA entity.

### 5.2 Allow-list per class (`SCHEDULE_ACTIONS`, services ⊂ `ha_bridge.ACTIONS`)

| Class | Services (arguments) |
|---|---|
| light | `light.turn_on` (`brightness` int 0–255 **or** `brightness_pct` int 1–100, optional, not both — `brightness` is what the card writes, V-LIVE) · `light.turn_off` |
| switch | `switch.turn_on` · `switch.turn_off` |
| cover | `cover.open_cover` · `cover.close_cover` · `cover.stop_cover` · `cover.set_cover_position` (position int 0–100, required) · `cover.set_cover_tilt_position` (tilt_position int 0–100, required) |
| climate | `climate.set_hvac_mode` (hvac_mode, required) · `climate.set_temperature` (temperature int/float, required; hvac_mode optional — the V-LIVE combined form) · `climate.set_fan_mode` (fan_mode) · `climate.set_preset_mode` (preset_mode) · `climate.turn_off` |
| fan | `fan.turn_on` (percentage int 1–100, optional) · `fan.turn_off` · `fan.set_percentage` (percentage int 0–100) |
| alarm | `alarm_control_panel.alarm_arm_home` (V-LIVE, `{}`) · `_arm_away` · `_arm_night` · `_arm_vacation` · `_arm_custom_bypass` · `alarm_disarm` — no arguments, never `code` |
| lock | `lock.lock` · `lock.unlock` — no arguments, never `code` |
| door | door covers: `cover.open_cover` · `close_cover` · `stop_cover` · `set_cover_position`; door-layer switches `switch.turn_on/off`; door-layer buttons `button.press` |

Labels from `ha_bridge.ACTIONS[...]["label"]`. The bridge 0.3.0 holds the same service set and argument specs; a drift
test compares them (§13).

### 5.3 Lowering actions

`alarm_control_panel.alarm_disarm`; `lock.unlock`; door class: `cover.open_cover`, `cover.set_cover_position` with
position > 0, `switch.turn_on` and `switch.turn_off` on door-layer switches (polarity unknown), `button.press`. Create /
edit / enable / restore need `confirm_lowering: true`, run needs `confirm: true`. UI: a dialog with "התזמון יפתח /
ינטרל {entities} ב־{times} גם כשאיש אינו נמצא במקום." and a checkbox; markers in list and drawer (lowering icon + "פותח /
מנטרל"; a sensitive marker for every sensitive schedule).

### 5.4 Argument validation

Types/ranges per §5.2, then against the mirrored entity when it reports: `temperature` within `min_temp`–`max_temp`
(else 5–35); `hvac_mode` ∈ `hvac_modes`; `fan_mode` ∈ `fan_modes`; `preset_mode` ∈ `preset_modes`;
`cover.set_cover_position` only with `current_position` or SET_POSITION (4); arm mode ∈ the panel's `arm_modes` →
`arm_mode_not_supported`. Any `code` key → `code_not_allowed`. Unknown argument → `validation` (`argument_not_allowed`).

### 5.5 Scheduler switches are not devices (existing functions that change — owner S2)

Helper (new, `services/devices.py`): `is_scheduler_entity(entity_id, platform)` = platform `scheduler` (V-LIVE), or
entity id starting `switch.schedule_` with platform NULL (before the first registry refresh); SQL `NOT_SCHEDULER_SQL`.
Schedule switches have an HA device (V-LIVE), so a device area could otherwise place them in the devices area.

| Function | Change |
|---|---|
| `services/devices.py::load_entities` | exclude them (covers the devices tree, area, items, tiles via `device_layouts`, the bulk-safe list, `device_bulk.resolve`) |
| `services/device_bulk.py::bulk_scope.permitted` | refuse them explicitly |
| `routers/ha.py::run_action` | after the permission check, 409 `use_schedules_screen` "התזמון מנוהל במסך התזמונים.", audited denied (the `_refuse_alarm_managed` pattern) |
| `routers/ha.py::list_entities`, `get_entity` | keep listed; `actions: []`, `schedule_entity: true` |
| `routers/devices.py::set_bulk_safe`, `set_bulk_safe_many` | 422 `not_markable` "תזמון אינו התקן ואינו מסומן כבטוח." |
| `routers/anchors.py` (HA-entity placement check) | 422 `not_placeable` |
| `routers/search.py` (device search over `ha_entities`) | exclude |

### 5.6 Alarm and code rules (override A)

- Alarm panels only under the alarm section's authority (§4.4), with a new public helper in `services/alarm.py`:
  `schedule_panel_check(conn, panel_entity_id) -> {discovered, arm_modes, needs_code_arm, needs_code_disarm}` from
  `_panel_view`.
- **No code ever reaches the component** (HA keeps `service_data` in clear text in its storage). A **new or changed**
  alarm action whose panel needs a code for it (`needs_code_arm` / `needs_code_disarm`) → 422 `alarm_code_needed`; a
  lock reporting `code_format` → 422 `lock_code_needed`. An **unchanged existing** alarm action (e.g. the V-LIVE
  `alarm_arm_home {}` on a Risco panel, which evidently works without a code) is not refused on edit; it carries warning
  `alarm_may_need_code` when the attributes say a code is needed, and the review list shows it. Design case: code-free
  arming with `schedule.sensitive` + `alarm.arm` is allowed; disarm on a panel that needs a code is refused.
- **Creator verification**: when the caller's own alarm code policy for that action is `code_required`, create / edit
  / restore / enable / run of a schedule containing it need `alarm_code`, verified with the alarm router's gate (same
  lockout keys, `code_locked`), then discarded. S1 extracts `routers/alarm.py::verify_code_for(...)` from `_code_gate`
  (behaviour unchanged; the alarm tests stay green).
- Remote channel §4.5. Zone bypass is not schedulable.
- **Phase 2b (not in the four-agent plan, separate approval): code-requiring panels through an Arx relay.** The
  component's action becomes `smplwise_bridge.scheduled_action {ref}` (opaque id, no code); the bridge forwards a signed
  relay to the add-on, which executes the pre-authorised action through the alarm router's send path with the
  encrypted stored panel code under the owner of record's HA identity — only within ±120 s of the slot's expected
  trigger (`timestamps`), once per occurrence, while the schedule is enabled, unchanged and its owner still holds every
  right; audited `alarm.disarm` with `via: schedule`. Residual risk: an HA administrator can call the relay inside the
  window. Estimate 16–22 agent-hours.

### 5.7 Structural validation

Times per §2.2; `stop` after `start` the same day or `"00:00:00"`; fixed-time slots must not overlap (half-open;
contiguous `stop == next start` is the normal V-LIVE case; a point slot occupies one minute) → `slots_overlap`; sun
slots compared with today's sun times → warning `sun_overlap_possible`; `start_date ≤ end_date`; `repeat: single` →
warning `single_deletes`; unknown action entity → `entity_unknown`; unavailable → warning `entity_unavailable`;
`track: true` with a slot without `stop` → warning `track_needs_window`.

### 5.8 Condition validation

≤ 10 conditions; new condition entities in domains `binary_sensor | sensor | sun | input_boolean` (else
`condition_domain_not_allowed`; existing ones of other domains stay as they are); entity must exist in the mirror
(new ones) → `entity_unknown`; `attribute` `state` or a valid name; `is`/`not` need a string value, `above`/`below` a
number and a numeric state/attribute; locked conditions (§4.4). Warnings: `condition_entity_unavailable` (any schedule);
**`sensitive_condition_unavailable`** when the schedule has sensitive actions and a condition entity is unavailable or
unknown now (preview, detail `warnings`, review issue); `holy_day_sensor_missing` when a preset is used but
`schedules.shabbat_sensor` is empty.

### 5.9 Settings gate

Classes off in `schedules.classes`: new drafts refused (`class_not_allowed`); existing schedules read-only
(`class_disabled`), may be disabled or deleted, never enabled or run.

### 5.10 Residual risk: schedules outlive their creator's rights

A schedule keeps running when its owner of record loses a permission, is deactivated or removed, or when an entity is
re-purposed. Mitigations: (1) every Arx write records the owner of record (`schedule_meta`); (2) `GET /schedules/review`
re-evaluates §4.4 for each owner and lists the issues of §3.17; (3) `status.counts.attention` shows the number to
administrators; (4) `POST /schedules/bulk` disables them in one confirmed step; (5) sensitive executions and outside
changes are audited. Arx never disables anything on its own: every write to HA is a person's request (AGENTS.md).
Push notification of new review items is phase 4. HA administrators can still edit schedules in HA ("Arx
restrictions do not restrict the original HA UI").

## 6. Read path

### 6.1 Sources

1. **Definitions**: WS `scheduler` and `scheduler/item` over the add-on's existing HA WebSocket session (`ha_sync.SYNC`,
   Supervisor token). New `HaSync.ws_call(msg_type, timeout=10, **kw)` runs a call on the live session loop from a
   request thread (the `refresh_now` pattern; 503 `ha_unavailable` when disconnected).
2. **Live state**: the entity mirror; `ha_sync.ATTR_ALLOW` += `next_trigger`, `current_slot`, `next_slot` (schedule
   switches) and `next_rising`, `next_setting` (`sun.sun`, for previews).

### 6.2 Mirror (`services/schedules.py`, `MIRROR`)

- **Full pull** at every session start (after the state snapshot, in `HaSync.on_ready`) and after each periodic
  registry refresh (600 s).
- **Subscription**: `on_ready` sends `{"type": "scheduler_updated"}`; `on_message` forwards frames with that
  subscription's `id` to `MIRROR.on_component_event`: `item_created|item_updated` → fetch the item; `item_removed` →
  drop from cache, `schedule_meta.gone_at`; `timer_*` → ignored. Debounce 1 s per id. A refused subscription is logged;
  the other layers remain.
- **State layer**: `ha_sync` calls `MIRROR.on_entity_state(row)` for entity ids starting `switch.schedule_`; an
  unknown entity or a change of `state` / `next_trigger` triggers an item fetch (debounced), and `triggered` feeds §6.6.
- Cache `schedule_cache` (persisted). Every cache change publishes `{"type": "schedules_changed"}` (no ids) through
  `ha_sync.publish`; `/ha/ws` forwards it; screens refetch.
- The cache is a read model; writes re-read the item first.

### 6.3 Component missing, HA unreachable

- `scheduler` answers `success:false` code `unknown_command` → `component_missing` (two answers ≥ 5 min apart before
  the cache is hidden; cache and meta are never deleted by absence). Other failures → `error`, cache kept, `stale`.
- HA disconnected → `ha_unavailable`, reads from cache with `stale: true`, writes 503.
- Operator texts: missing → "אין תזמונים להצגה. הפעלת התזמונים מנוהלת בהגדרות."; stale → "המידע אינו מעודכן — אין כרגע
  חיבור לתשתית המערכת."; administrators also get "הגדרות התזמונים" → הגדרות › תזמונים, which names the product
  (install the "Scheduler" custom integration from HACS or manually, restart, add it; minimum HA 2024.11.0; versions).

### 6.4 Normalisation (`services/schedule_model.py`, pure)

`normalize(item) -> ScheduleCore`, `classify(...)`, `to_component_payload(draft, current_item | None)`,
`validate_draft(draft, ctx) -> (errors, warnings)`, `upcoming(item, now)` (from `timestamps` / `next_entries`),
`next_runs_computed(core, now_utc, tz, sun_today, count)`, `revision(item)`, `diff_summary(old, new)`,
`condition_summary(block, shabbat_sensor, names)`. Accepts `HH:MM` and `HH:MM:SS`, `stop` null or absent,
`service_data` containing `entity_id`, weekday tokens in any order.

### 6.5 Upcoming runs

From the item (V-LIVE): `upcoming[k] = {at: timestamps[next_entries[k]], slot_index: next_entries[k]}` — the next
occurrence of each slot. Computed (preview of an unsaved draft, or no timestamps): days from today in
`settings["time.zone"]`, weekday tokens (`workday`/`weekend` not computed), dates, repeat; sun times from today's
`sun.sun` `next_rising`/`next_setting` for every future day ("משוער"), offsets clamped to 00:00 / 23:59. **Conditions
are never evaluated** by the component's timestamps or by Arx: every upcoming run of a schedule with conditions is
`conditional` and shown as "בתנאי", optionally with the condition's current state ("כרגע: לא מתקיים").

### 6.6 Runs (derived activity)

`MIRROR.on_entity_state`: a schedule switch entering `triggered` creates a `schedule_runs` row (`pending`, slot from
`current_slot`); 20 s later each action entity is settled with the product's confirmation logic
(`ha_bridge.ACTIONS` `expect` / `attribute_reached`): all confirmed → `confirmed`; any unavailable → `skipped`; else
`not_confirmed`. Sensitive schedules also write audit `schedule.executed`. A slot skipped by its conditions produces no
`triggered` state and therefore no row (the UI never claims it ran). Retention `schedules.runs_retention_days`.

## 7. Storage — migration `0039_schedules.sql`

Renumbered by the coordinator at merge if 0039 is taken (nothing else names the number).

```sql
-- CR-014: schedules of the scheduler component. The component (HA storage) is the authority for definitions; these
-- tables hold Arx's read cache, Arx-only organisation, the 30-day trash, derived runs and write ops.
CREATE TABLE schedule_cache (
  schedule_id   TEXT PRIMARY KEY,
  entity_id     TEXT,
  revision      TEXT NOT NULL,
  item_json     TEXT NOT NULL,           -- the component's item, verbatim
  enabled       INTEGER NOT NULL DEFAULT 1,
  seen_at       TEXT NOT NULL,
  changed_at    TEXT NOT NULL
);
CREATE TABLE schedule_folders (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  position      INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT
);
CREATE TABLE schedule_meta (
  schedule_id          TEXT PRIMARY KEY,
  created_via          TEXT NOT NULL CHECK (created_via IN ('arx', 'external')),
  created_by           TEXT,
  created_by_username  TEXT,
  created_at           TEXT,
  updated_by           TEXT,
  updated_by_username  TEXT,
  updated_at           TEXT,
  folder_id            TEXT REFERENCES schedule_folders(id) ON DELETE SET NULL,
  sort_key             INTEGER,
  pinned               INTEGER NOT NULL DEFAULT 0,
  first_seen_at        TEXT NOT NULL,
  last_seen_at         TEXT NOT NULL,
  gone_at              TEXT
);
CREATE TABLE schedule_trash (
  id                   TEXT PRIMARY KEY,
  schedule_id          TEXT NOT NULL,
  name                 TEXT,
  item_json            TEXT NOT NULL,
  meta_json            TEXT,
  entities_json        TEXT NOT NULL,
  sensitive            INTEGER NOT NULL DEFAULT 0,
  deleted_by           TEXT,
  deleted_by_username  TEXT,
  deleted_at           TEXT NOT NULL,
  expires_at           TEXT NOT NULL,
  restored_at          TEXT,
  restored_schedule_id TEXT
);
CREATE INDEX idx_schedule_trash_expires ON schedule_trash (expires_at);
CREATE TABLE schedule_runs (
  id            TEXT PRIMARY KEY,
  schedule_id   TEXT NOT NULL,
  slot_index    INTEGER,
  started_at    TEXT NOT NULL,
  settled_at    TEXT,
  result        TEXT NOT NULL CHECK (result IN ('pending', 'confirmed', 'not_confirmed', 'skipped', 'unknown')),
  sensitive     INTEGER NOT NULL DEFAULT 0,
  via           TEXT NOT NULL DEFAULT 'component',
  detail_json   TEXT
);
CREATE INDEX idx_schedule_runs_schedule ON schedule_runs (schedule_id, started_at);
CREATE INDEX idx_schedule_runs_started ON schedule_runs (started_at);
CREATE TABLE schedule_ops (
  id                 TEXT PRIMARY KEY,
  principal_user_id  TEXT NOT NULL,
  principal_username TEXT,
  client_request_id  TEXT NOT NULL,
  op                 TEXT NOT NULL,
  schedule_id        TEXT,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'ok', 'failed', 'unknown')),
  error              TEXT,
  requested_at       TEXT NOT NULL,
  responded_at       TEXT
);
CREATE UNIQUE INDEX idx_schedule_ops_client ON schedule_ops (principal_user_id, client_request_id);
```

A repeated `client_request_id` returns the first op's answer. Tags stay in the component (no table). Backups include
these tables automatically.

## 8. Writing to Home Assistant — bridge 0.3.0

### 8.1 Path

Add-on → `ha_client.call_bridge_schedule(settings, payload)` → `POST /api/services/smplwise_bridge/schedule?return_response`
→ bridge verifies, re-validates, calls the component with `Context(user_id=<caller's HA id>)`. Never `scheduler.*` from
the add-on, never the component's HTTP views, never `enable_all` / `disable_all` (`reload_storage` does not exist).
Writes need bridge ≥ 0.3.0 (`bridge.integration_version`) → else 503 `bridge_too_old`.

### 8.2 Service `smplwise_bridge.schedule` (SupportsResponse.ONLY)

```json
{ "user_id": "<ha user id>", "op": "edit", "request_id": "<op id>",
  "schedule_id": "3f9a1c", "schedule_entity_id": "switch.schedule_shbt_slvn",
  "payload": { "timeslots": [
     { "start": "00:00:00", "stop": "06:00:00",
       "conditions": [ { "entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is" } ],
       "condition_type": "or", "track_conditions": false,
       "actions": [ { "service": "climate.set_temperature", "entity_id": "climate.living_room", "service_data": { "hvac_mode": "cool", "temperature": 25 } } ] } ] },
  "name": null, "time": null, "skip_conditions": false, "sensitive": false,
  "ts": 1790000000, "nonce": "…", "sig": "…" }
```

| op | Needs | Component call |
|---|---|---|
| `add` | payload (weekdays, timeslots, repeat_type, name; dates / tags optional) | `scheduler.add` |
| `edit` | schedule_entity_id, schedule_id, payload (subset) | `scheduler.edit` |
| `remove` | schedule_entity_id, schedule_id | `scheduler.remove` |
| `copy` | schedule_entity_id, schedule_id, name | `scheduler.copy` |
| `run` | schedule_entity_id, schedule_id, time?, skip_conditions | `scheduler.run_action` |
| `enable` / `disable` | schedule_entity_id, schedule_id | `switch.turn_on` / `turn_off` |

Draft → payload: `repeat` → `repeat_type`; each slot → `{start, stop, conditions, condition_type, track_conditions,
actions}` with the schedule's conditions copied into **every** slot (`[]`, `null`, `false` when none — the stored form,
P0-11); `actions[].data` → `service_data` (`{}` when empty) with `entity_id` beside it; `tags` only with
`capabilities.tags`. Untouched slots are re-sent byte-identical to what was read.

Response: `{ "ok": true, "request_id", "context_id", "schedule_id": "d4e5f6", "entity_id": "switch.schedule_…" }` or
`{ "ok": false, "request_id", "error": "service_not_allowed", "path": "timeslots[0].actions[0]" }`. Errors:
`bad_signature | stale | replay`, `unknown_user`, `op_not_allowed`, `invalid_payload`, `service_not_allowed`,
`argument_not_allowed`, `code_not_allowed`, `sensitive_flag_mismatch`, `entity_not_found`, `not_a_schedule`,
`unauthorized`, `permission_check_unavailable`, `scheduler_missing`, `id_unknown` (with `ok: true`, ids null), else the
exception class name only. The add-on maps `ok:false` to 502 `scheduler_refused`.

### 8.3 Bridge-side checks (independent of the add-on)

1. Signature, replay window, active HA user. 2. `op` allow-list.
3. Schema in a new dependency-free module `integration/smplwise_bridge/schedule_policy.py` (like `signing.py`):
   top-level keys ⊂ {weekdays, start_date, end_date, timeslots, repeat_type, name, tags}; timeslot keys ⊂ {start, stop,
   conditions, condition_type, track_conditions, actions}; action keys ⊂ {service, entity_id, service_data}; condition
   keys ⊂ {entity_id, attribute, value, match_type}; caps of §3.19; time regexes; no `code` key at any depth.
4. Every action: `entity_id` present; `(domain, service)` ∈ `SCHEDULE_ACTION_SERVICES` (⊂ `ALLOWED_SERVICES`); argument
   specs as the add-on; entity exists (`hass.states.get`) with the service's domain.
5. `sensitive` consistency: lock / alarm_control_panel actions, or covers reporting device_class door/garage/gate,
   require `sensitive: true` → else `sensitive_flag_mismatch`.
6. Unless `user.is_admin`, `user.permissions.check_entity(entity_id, POLICY_CONTROL)` for every action entity on
   add/edit (the component's add/edit are not entity services); missing API → `permission_check_unavailable` (P0-8).
7. Every op but `add`: the registry entry of `schedule_entity_id` has platform `scheduler` and `unique_id ==
   schedule_id` (V-LIVE) → else `not_a_schedule`.

### 8.4 New id for add / copy

Snapshot registry entries with platform `scheduler` before the blocking call; poll every 0.25 s up to 5 s after it;
exactly one new → its `unique_id` and entity id; else `{ok: true, error: "id_unknown"}`.

### 8.5 Other bridge changes

`const.py` `VERSION = "0.3.0"`, `SERVICE_SCHEDULE = "schedule"`; `manifest.json` 0.3.0; `services.yaml`,
`strings.json`, `translations/en.json` / `he.json`; unload removes the service; `integration/README.md`. `execute`,
`set_entity_area`, `ALLOWED_SERVICES` unchanged.

## 9. The FAKE scheduler (development and test basis, built from V-LIVE shapes)

File `smplwise_vms/backend/tests/fake_scheduler.py` (beside `fake_alarm.py`); the Playwright live fixture
`frontend/tests/fixtures/schedules_fake_ha.py` imports it like `devices_fake_ha.py` imports backend modules. Pure
Python, deterministic ids (seeded), injectable clock. **No private data**: the seed below is generic and anonymised.

### 9.1 State and switches

`FakeScheduler(installed=True, accept_tags=True, strict_keys=True, event_mode="subscription", trigger_hold_s=60,
rename_changes_entity_id=False, now=callable)`: `items`, `states` (switch entities), `registry` (platform `scheduler`,
unique_id = schedule_id, a device id, no area), `events`, `calls` (for assertions), `fail_next: dict[op, error]`,
`timeout_next: set[op]`, `bridge_version="0.3.0"`.

### 9.2 WebSocket: `fake.ws(msg) -> list[frame]` (result first, then events)

| Command | Answer (not installed → `{"success": false, "error": {"code": "unknown_command", "message": "Unknown command."}}`) |
|---|---|
| `scheduler` | list of items (V-LIVE shape, §9.3) |
| `scheduler/item` {schedule_id} | the item, or `success:false` code `not_found` |
| `scheduler/tags` | `[{"name": tag, "schedules": [ids]}]` (V-LIVE) |
| `scheduler_updated` | `success:true`; events `{"id": <sub>, "type": "event", "event": {"event": "item_updated", "schedule_id": "…"}}`; `event_mode="bus"` → `{"event_type": "scheduler_updated", "data": {...}}`; `"none"` → no events (P0-2) |
| `manifest/get` {integration: "scheduler"} | `{"domain": "scheduler", "version": "3.3.8"}` |
| `get_services` | the V-LAB field lists (no `reload_storage`) |

### 9.3 Item shape (V-LIVE)

```json
{ "schedule_id": "3f9a1c", "entity_id": "switch.schedule_shbt_slvn", "name": "Living room Shabbat cooling",
  "enabled": true, "weekdays": ["daily"], "start_date": null, "end_date": null, "repeat_type": "repeat",
  "tags": ["shabbat"],
  "timeslots": [
    { "start": "00:00:00", "stop": "06:00:00",
      "conditions": [ { "entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is" } ],
      "condition_type": "or", "track_conditions": false,
      "actions": [ { "service": "climate.set_temperature", "entity_id": "climate.living_room", "service_data": { "hvac_mode": "cool", "temperature": 25 } } ] },
    { "start": "06:00:00", "stop": "00:00:00",
      "conditions": [ { "entity_id": "binary_sensor.shabbat_mode", "attribute": "state", "value": "on", "match_type": "is" } ],
      "condition_type": "or", "track_conditions": false,
      "actions": [ { "service": "climate.turn_off", "entity_id": "climate.living_room", "service_data": {} } ] } ],
  "timestamps": ["2026-10-03T00:00:00+03:00", "2026-10-03T06:00:00+03:00"], "next_entries": [0, 1] }
```

Switch per item: state `on`/`off`; attributes `actions` (`[{service, data?}]` first action per slot), `current_slot`,
`entities`, `friendly_name` ("Scheduler " + name), `icon` (`mdi:calendar-clock`), `next_slot`, `next_trigger`, `tags`,
`timeslots` (`"HH:MM:SS - HH:MM:SS"` / `"HH:MM:SS"`), `weekdays`. Entity ids are opaque: the fake uses
`switch.schedule_<ascii slug of name>` or `switch.schedule_<id>` for an empty name; Arx never derives them.

### 9.4 Seed dataset `fake_scheduler.seed_live_like()` (anonymised patterns of the V-LIVE system)

| # | Pattern | Notes |
|---|---|---|
| 1 | Shabbat cooling, 5 contiguous slots 00:00→00:00 alternating `climate.set_temperature {hvac_mode: cool, temperature: 25}` / `climate.turn_off`, condition shabbat sensor `is on`, `or`, tag `shabbat` | the most common real shape |
| 2 | as 1 with `temperature: 25.5` and 3 slots, disabled (`enabled: false`, switch `off`) | float, disabled |
| 3 | Shabbat lights: `switch.turn_on` / `switch.turn_off` contiguous, condition `is on`, tag `shabbat` | bulk-safe marked switch in the fixture |
| 4 | Plain `light.turn_on {brightness: 51}` / `light.turn_off`, no conditions | brightness 0–255 |
| 5 | Covers: `cover.close_cover`, `cover.set_cover_position {position: 10}` | |
| 6 | Alarm: one point slot (`stop: null`) `alarm_control_panel.alarm_arm_home {}`, no conditions | sensitive design case |
| 7 | Unnamed (`name: ""`), entity id `switch.schedule_<id>`, one point slot `script.missing_script` with `entity_id: null` | unsupported → read-only, round-trip |
| 8 | Season `start_date: 2026-10-31`, `end_date: 2027-03-31`, slot start `sunset+00:30:00` | sun + period |
| 9 | `repeat_type: pause` | |
| 10 | Four actions in one slot (four climates off) with condition | multi-action |
| 11 | "Not on Shabbat": condition `is off`, `switch.turn_on` 07:00 | preset `not_holy_days` |
| 12 | Door (sensitive, lowering): `cover.open_cover` on a `gate` cover 07:00, `cover.close_cover` 08:00, disabled | lowering marker |

Tags: `shabbat` on 1, 2, 3, 10; `offices` on 4, 11; `outdoor` on 5, 8; mirroring the V-LIVE distribution (one dominant
tag). Mirror entities (states, device classes, the shabbat binary_sensor, a `gate` cover, a Risco-like panel with
`code_arm_required: false`) are seeded with the fixture's own helpers.

### 9.5 Services: `fake.call_service(domain, service, data, user=None)`

- `scheduler.add`: V-SRC schema + V-LIVE keys (unknown keys → `FakeInvalid` when `strict_keys`; `tags` refused when
  `accept_tags=False`; `repeat_type` required); new id (6 hex); entity id per §9.3; switch `on`; `timestamps` /
  `next_entries` computed from the fake clock; emits `item_created`.
- `scheduler.edit` (entity_id required; given fields replaced, timeslots whole; rename keeps the entity id unless
  `rename_changes_entity_id`) → `item_updated`. `remove` → `item_removed`. `copy` {entity_id, name} → `item_created`.
- `scheduler.run_action` {entity_id, time?, skip_conditions?}: evaluates the slot's conditions against the fake's
  entity states unless `skip_conditions`; when they pass: switch `triggered` for `trigger_hold_s`, `on_action(service,
  entity_id, data)` per action; when they fail: nothing (no `triggered`).
- `enable_all` / `disable_all` exist and are recorded (a test asserts the product never calls them);
  `reload_storage` → `ServiceNotFound`.
- `switch.turn_on/off` on a schedule entity flips `enabled` and state; emits `item_updated`.
- `fake.tick(seconds)`: a slot start that passes fires like `run_action` **with** condition evaluation (tests: a Shabbat
  schedule does not trigger while the sensor is `off`; it triggers when `on`; `track_conditions` re-checks inside the
  window when the sensor turns on; an `unavailable` sensor never satisfies `is on` or `is off`).

### 9.6 Bridge: `fake.bridge_schedule(signed_payload, secret) -> service_response`

§8.2–§8.4 against the fake component (HMAC compatible with `ha_bridge.sign`), allow-list from the **add-on's**
`services/schedule_policy.SCHEDULE_ACTIONS` (drift to the real bridge is caught by the S2 drift test), sensitive flag,
registry check, id diff; `fail_next` / `timeout_next` inject answers and `httpx.ReadTimeout`. Live-fixture HTTP form:
`POST /api/services/smplwise_bridge/schedule?return_response`.

### 9.7 Seams

`services/schedules.py`: `class SchedulerTransport(Protocol)` with `ws(msg_type, **kw) -> dict` and
`bridge(payload) -> dict`; production `HaTransport` (`ha_sync.SYNC.ws_call`, `ha_client.call_bridge_schedule`); tests
`FakeTransport(fake, secret)` via `schedules.set_transport(...)`; component events via
`MIRROR.on_component_event(frame)`, entity states via `ha_sync.upsert_state`.

## 10. Settings and per-user state

### 10.1 Product settings (`routers/settings.py`; read by everyone, changed with `system.configure`, audited)

| Key | Values | Default |
|---|---|---|
| `schedules.enabled` | `true` / `false` — the feature and its tab | `true` |
| `schedules.classes` | JSON array ⊂ [light, switch, cover, climate, fan, alarm, lock, door] (read as an array) | all eight |
| `schedules.snap_minutes` | `5` / `15` / `30` | `15` |
| `schedules.default_repeat` | `repeat` / `pause` / `single` | `repeat` |
| `schedules.runs_retention_days` | int 7–365 (`INT_KEYS`) | `90` |
| `schedules.shabbat_sensor` | `''` or `binary_sensor.<id>` (pattern `^(\|binary_sensor\.[a-z0-9_]{1,100})$`) — the "issur melacha in effect" sensor the presets use, picked once in הגדרות › תזמונים from `/schedules/condition-candidates` | `''` |

Safety rules are not settings (trash 30 days, confirmations, code refusal, the allow-list ceiling).

### 10.2 Per user

Browser-local only (`localStorage`, try/catch): `sw.schedules.view` (`cards|table|week`), `sw.schedules.filters`,
`sw.schedules.editor_view` (`week|day|table`). Per role: the three permissions only.

## 11. Phase 0 — verification (read-only)

### 11.1 Script `scripts/scheduler_probe.py` (S2 writes it; the owner or coordinator runs it)

Read-only by construction: it may send only `auth`, `get_services`, `get_states`, `config/entity_registry/list`,
`manifest/get`, `scheduler`, `scheduler/item`, `scheduler/tags`, `scheduler_updated` (30 s, then close) — an allow-list
constant refuses anything else (tested). URL and token from `SW_PROBE_HA_URL` / `SW_PROBE_HA_TOKEN` (the person running
it takes them from `secrets/lab.env`; never printed). Output `private-evidence/scheduler-probe-<UTC date>/` with the
same six files as the 2026-09-30 dump (`services.json`, `schedules.json`, `items.json`, `tags.json`,
`switch_states.json`, `registry.json`) plus `events.json` and `summary.json` (counts, key sets, time formats, weekday
forms, sun-offset signs, match types, services in use — no names). `--non-admin` records which commands a non-admin
token may use. `--structure` prints only the structural summary (what the architect used on 2026-09-30).

### 11.2 Checklist for the owner

Done 2026-09-30: item and slot JSON, time formats, conditions shape and uniformity, tags shape, switch attributes,
registry platform / unique_id, services and fields (V-LIVE / V-LAB). Open:

| P0 | Check | Needs write approval |
|---|---|---|
| 1 | A card schedule with explicit days (e.g. א׳–ה׳) and one with "ימי עבודה"; probe | no (card edit by the owner) |
| 2 | Probe listening while the owner toggles / edits a schedule in the card | no |
| 3 | One Arx edit with tags through bridge 0.3.0 on the lab | yes |
| 4 | One Arx create on the lab; the bridge returns the id | yes |
| 5 | Rename a sample schedule in the card; probe | no |
| 6 | `--non-admin` probe with a non-admin token | no |
| 7 | A card schedule with a negative sun offset; probe | no |
| 8 | Bridge 0.3.0 edit as a non-admin HA user (`check_entity`) | yes |
| 9 | Edit with an unknown key via Developer Tools on the lab | yes |
| 10 | Overlapping slots via Developer Tools on the lab | yes |
| 11 | Arx edit that writes `conditions: []` on a slot; probe | yes |
| 12 | A card condition with "not" / "above"; probe | no |
| 13 | Toggle the switch in HA while the probe listens; copy without a name | toggle no / copy yes |

Every write step needs the owner's explicit, task-specific approval; the probe writes nothing.

## 12. Frontend: home tabs, routes, components

### 12.1 Navigation (`frontend/src/shell/nav.ts`)

- New shared `DEVICES_TABS: TabItem[] = [{ id: 'building', label: 'מבט על', href: '#/devices/building' }, { id:
  'schedules', label: 'תזמונים', href: '#/devices/schedules' }]` used by **both** `AREA_TABS.devices` and
  `GROUP_TABS.devices`. The existing home screen becomes the "מבט על" tab, unchanged.
- `TAB_PERMISSIONS['#/devices/schedules'] = ['schedule.view', 'schedule.manage']` (any scope).
- `applySchedulesHidden(settings)`: `schedules.enabled == 'false'` → `HIDDEN_HREFS.add('#/devices/schedules')` (the
  `applySnapshotHidden` pattern), called where the shell calls `applySnapshotHidden`.
- `TAB_SECTIONS` += `{ id: 'devices', label: 'ראשי', where: 'לשוניות המסך הראשי', tabs: () => plain(DEVICES_TABS) }`;
  `sectionIdOf` += `[DEVICES_TABS, 'devices']`. `ui.tabs.devices` orders / hides the two tabs; `entryHref` makes
  "תזמונים" the entry when "מבט על" is hidden. The tab row appears only when more than one tab is visible
  (`tabs.length > 1`), so a user without schedule rights sees the home screen exactly as today.
- `activeAreaTab` / `activeTabOf` (`devices`): `s[1] === 'schedules' ? 'schedules' : 'building'`; crumbs "ראשי › תזמונים".
- Settings: `AREA_TABS.system` and `GROUP_TABS.settings` += `{ id: 'schedules', label: 'תזמונים', href: '#/system/schedules' }`,
  `TAB_PERMISSIONS` `['system.configure']`, in `INSTALLATION_ONLY_HREFS`.
- "עריכת המסך הראשי" keeps `#/devices/building?edit=1`. While `?edit=1` is active the devices tab row is hidden (the
  shell's `editor` flag gains this case), so the layout editor is never left by a tab click.
- `ui.start_route` `devices` still lands on `#/devices/building`.

### 12.2 Routes (`sw-app.ts`, `case 'devices'` and `case 'system'`)

| Hash | Element | Owner |
|---|---|---|
| `#/devices/schedules` (query `view`, `q`, `floor`, `area`, `day`, `state`, `tag`, `condition`, `preset`, `sort`) | `<devices-schedules>` | S3 |
| `#/devices/schedules/<id>` | same, detail drawer open | S3 |
| `#/devices/schedules/trash` | same, trash view | S3 |
| `#/devices/schedules/<id>/edit` | `<schedule-editor .scheduleId>` (tab row hidden by the existing `segments[3] === 'edit'` rule) | S4 |
| `#/devices/schedules/new/edit?template=<id>&preset=<id>` | `<schedule-editor>` with a draft | S4 |
| `#/system/schedules` | `<system-schedules>` | S3 |

`new` and `trash` are reserved (component ids are 6-hex).

### 12.3 Element contracts between S3 and S4 (tags only; no compile-time import across agents)

- `<schedule-create-dialog .open @close @created=${(e: CustomEvent<{ id: string }>)}>` (S4): templates, condition
  presets, three-tap quick create. S3's "תזמון חדש" renders it by tag.
- `<schedules-week-view .schedules=${Schedule[]} .sun=${SunTimes | null} .snap=${number} @open-schedule=${(e: CustomEvent<{ id: string }>)}>`
  (S4): read-only area week composition (mockup 03), rendered by S3's list for `view=week`.
- `<schedule-lowering-dialog .open .summary=${LoweringSummary} .needsCode=${boolean} @confirm=${(e: CustomEvent<{ alarm_code: string | null }>)} @close>`
  (S4): used by S3's drawer for enable / run of lowering schedules too.
- `<schedule-condition-chip .conditions=${ScheduleConditions}>` (S3, `components/sw-schedule-bar.ts` module): the
  condition badge ("בתנאי: איסור מלאכה", "רק בשבת ובחג") used by S3's cards / table / drawer and by S4's editor header.
- Registration: S4's `screens/schedule-editor.ts` imports its dialogs and the week view; `sw-app.ts` imports
  `screens/schedule-editor` (S4's one line, §13).

### 12.4 Deviations from the mockup (recorded)

1. Read-only slot (screen 18): the offending slot is marked; the whole schedule's content is locked (§2.6).
2. No tab counts "(12)" (owner rule 2026-09-30: clean operator screens).
3. Settings (screen 12): "אישור מפורש למחיקה", "הרצה עכשיו: אישור לפעולות פיזיות" and "חסימת מנעולים ואזעקה" are not
   settings (fixed safety rules; locks/alarm now allowed under `schedule.sensitive`); "מי רשאי מה" shows the three
   permissions per built-in role read-only with a link to משתמשים והרשאות; a Shabbat-sensor picker is added.
4. Activity (screen 11) is reduced to "הרצות אחרונות" in the drawer (last 10); the full screen is phase 4.
5. Organise (screen 10), import/export: phase 3.
6. Tag editing only with `capabilities.tags`.
7. Conditions are schedule-level in the editor (one block for all slots), per the component's rule (§2.4).
8. "Next run" of a schedule with conditions reads "בתנאי", never a promise.

### 12.5 Conditions in the UI

- **List / table / drawer (S3)**: a condition chip per schedule (`conditions.summary`); filter chips "רק בשבת ובחג" /
  "לא בשבת ובחג" / "עם תנאי" (`preset`, `has_conditions`) next to the tag filter; the table gets a "תנאי" column; next
  run "18:00 · בתנאי"; the drawer lists each condition with its current state when readable, "מחוץ להרשאתך" otherwise.
- **Editor (S4)**: a "תנאים" section in the side panel (schedule-level): add from `/schedules/condition-candidates`
  (binary sensors and sensors first), `is / not` (and `above / below` for numeric), value picker from the entity's
  known states (`on`/`off` for binary sensors), "כל התנאים" / "אחד מהם", "המשך לבדוק עד סוף החלון"; locked conditions
  shown with a lock icon and no controls; warnings from the preview (§5.8).
- **Presets (S4, create flow and editor)**, shown when `status.settings.shabbat_sensor` is set (for administrators
  without it: "בחרו חיישן שבת וחג בהגדרות"):
  - "לא בשבת ובחג" → conditions `[{sensor, state, is, off}]`, type `or`.
  - "רק בשבת ובחג" → `[{sensor, state, is, on}]`, type `or` (the V-LIVE form).
  - "מוצאי שבת" → template: weekdays `["sat"]` (P0-1), one slot `start: "sunset+00:40:00"` (offset editable), condition
    `is off` (so a holiday continuing past Saturday night skips it).
  - "שבת: קירור / חימום" → the V-LIVE pattern 1 (contiguous slots, set temperature / off, condition `is on`).

### 12.6 Frontend API module

`frontend/src/api/schedules.ts` (this branch): types mirroring §2–§3, one function per route, demo mode
(`schedules-mock.ts` in-memory store; mutations work), pure helpers (day labels, time parsing / formatting, minute
math, overlap detection, demo next runs, "כיבוי בסיום" pairing, condition presets and summaries, state / reason /
result labels), `subscribeSchedules()` over `/ha/ws` (`schedules_changed`). S3 / S4 do not edit it; changes go to the
coordinator.

## 13. Parallel work plan (four agents)

All branch from `g0/intake` after this branch is merged (or from this branch). Python:
`C:\cloude\smplwisebms\.venv\Scripts\python.exe` (or `py -3.12`), pytest **workers=1**, targeted files only. Node per
CLAUDE.md; `npx tsc --noEmit` with a `node_modules` junction to `C:\cloude\smplwisebms\frontend\node_modules`. Nobody
bumps versions, edits CHANGELOG / `management/*` / `contracts/API_INVENTORY.md` (regenerated in the release round), or
pushes. `bash C:/cloude/smplwisebms/secrets/scan_staged.sh` before every commit. **Never read or copy
`private-evidence/`** except S2's probe tests, which use synthetic data only.

### S1 — backend (branch `pilot/CR014-s1-backend`)

- **Goal**: §2–§7, §9, §10.1 add-on side: read path, write path (`call_bridge_schedule`), scope incl. condition
  locking, safety classes, alarm/code rules, trash, runs, review, organisation API, settings keys, permissions, the fake
  scheduler with the §9.4 seed, tests.
- **Owns (creates)**: `routers/schedules.py`, `services/schedules.py`, `services/schedule_model.py`,
  `services/schedule_policy.py`, `migrations/0039_schedules.sql`, `tests/fake_scheduler.py`,
  `tests/test_schedules_model.py`, `tests/test_schedules_api.py`, `tests/test_schedules_scope.py`,
  `tests/test_schedules_conditions.py`, `tests/test_schedules_mirror.py`, `tests/test_schedules_trash_runs.py`,
  `frontend/tests/fixtures/schedules_fake_ha.py` (last milestone).
- **Touches minimally (sole editor)**: `main.py` (router after `devices`; janitor prune), `roles.json`,
  `routers/access.py` (three labels), `contracts/examples/role-catalog.design.json`, `routers/settings.py` (six keys),
  `services/ha_sync.py` (`ATTR_ALLOW` += 5, `ws_call`, hooks in `on_ready` / `on_message` / `on_event`),
  `services/ha_client.py` (`call_bridge_schedule`), `services/alarm.py` (`schedule_panel_check`), `routers/alarm.py`
  (public `verify_code_for`, behaviour unchanged), `services/home_screen.py` (extract `is_jewish_calendar`, behaviour
  unchanged).
- **Tests**: model (V-LIVE shapes: `HH:MM:SS`, `sunset+`, null stop, null action entity, uniform conditions, brightness,
  float temperature, `timestamps`/`next_entries`; revision stability; byte-identical re-send of untouched slots;
  validation matrix per class; overlap incl. contiguous; computed next runs with dates/repeat/tz); conditions (schedule
  block ↔ per-slot payload, summaries and presets, locked conditions for a floor-scoped editor, not-readable add,
  sensitive + unavailable condition warning, `run` `skip_conditions` rule); scope (visibility by action entities only,
  alarm.view, floor-scoped manage, sensitive read-only, lowering confirmation, `alarm_code_needed` for new vs
  unchanged-existing arm action, `lock_code_needed`, creator code policy, remote rules, classes); API (every route,
  every §3.20 code, idempotency, 409, split + compensation, trash, bulk, rate limits, never `enable_all` /
  `disable_all`); mirror (pull, both event modes and none, state fallback, missing twice, HA down → stale,
  `schedules_changed` without ids); runs (condition-skipped slot → no row; triggered → settle; sensitive audit). Also
  run `test_ui_settings.py`, `test_ui_tabs_config.py`, `test_alarm.py`, `test_devices.py`, `test_access.py`,
  `test_migrations.py`, `test_home_screen.py`.
- **Milestones**: M1 read path + status + list/detail + catalog + condition candidates + permissions; M2 writes; M3
  trash / runs / review / bulk / organisation; M4 live fixture.
- **Estimate**: 32–38 agent-hours.

### S2 — bridge 0.3.0, device-area exclusions, probe (branch `pilot/CR014-s2-bridge`)

- **Goal**: §8 in the integration; §5.5; §11.1.
- **Why separate**: the bridge is a separate codebase (runs inside HA, own release gate) and must validate
  independently to be real defence in depth; the §5.5 changes touch shared device files S1 does not need.
- **Owns**: `integration/smplwise_bridge/schedule_policy.py` (new, dependency-free), the `schedule` service in
  `integration/smplwise_bridge/__init__.py`, `const.py`, `manifest.json`, `services.yaml`, `strings.json`,
  `translations/*.json`, `integration/README.md`; `scripts/scheduler_probe.py`; tests
  `tests/test_bridge_schedule_policy.py` (module by path; V-LIVE payload shapes incl. conditions, `brightness`,
  `sunset+`, null stop; code refusal at any depth; sensitive flag), `tests/test_bridge_schedule_service.py`
  (structure: registration, unload, schema, never `enable_all` / `disable_all` / `reload_storage`),
  `tests/test_scheduler_probe.py` (WS allow-list, no token or names in `--structure` output, synthetic frames),
  `tests/test_scheduler_exclusions.py`, `tests/test_bridge_schedule_drift.py` (guarded by
  `pytest.importorskip("smplwise.services.schedule_policy")`: service set and argument specs equal S1's
  `SCHEDULE_ACTIONS`, ⊂ `ALLOWED_SERVICES`).
- **Touches minimally**: `services/devices.py`, `services/device_bulk.py`, `routers/ha.py`, `routers/devices.py`,
  `routers/anchors.py`, `routers/search.py` (§5.5 only).
- **Runs**: its files plus `test_devices.py`, `test_bridge_install.py`, `test_release_check.py`,
  `test_lovelace_card.py`, `test_alarm.py -k managed`.
- **Estimate**: 12–16 agent-hours.

### S3 — frontend list, tabs, drawer, states, settings (branch `pilot/CR014-s3-list`)

- **Goal**: §12.1–§12.2 (except the editor element), §12.5 list part; mockup 01, 02, 04, 13–16, 19 (list level), 20,
  22, 23, 12 (per §12.4); trash view; review list with bulk disable; run / enable / delete / copy from the drawer with
  S4's lowering dialog; condition chips, filters and the table's condition column; Shabbat-sensor picker in settings.
- **Owns**: `frontend/src/screens/devices-schedules.ts`, `frontend/src/screens/schedule-drawer.ts`,
  `frontend/src/components/sw-schedule-bar.ts` (24 h bar, day chips, `<schedule-condition-chip>`),
  `frontend/src/screens/system-schedules.ts`, specs `frontend/tests/unit-schedules-nav.spec.ts`,
  `frontend/tests/evidence-schedules-list.spec.ts` (demo mode; 1440 / 820 / 390; loading / empty / component missing
  operator + admin / view-only / stale / ready; RTL; conditional next run; screenshots to
  `docs/design/evidence/CR-014/`).
- **Touches minimally (sole editor)**: `frontend/src/shell/nav.ts`, `frontend/src/shell/sw-app.ts` (routes of §12.2
  incl. `<schedule-editor>` by tag, `applySchedulesHidden`, the `?edit=1` tab-row rule; its imports go directly after
  `import '../screens/devices-area';`), `frontend/src/api/ha.ts` (`HaPush` += `schedules_changed`), existing nav specs
  asserting the devices area.
- **Estimate**: 24–30 agent-hours.

### S4 — frontend editor (branch `pilot/CR014-s4-editor`)

- **Goal**: mockup 05–09, 17, 18, 19 (editor level), 21, 24–26: week grid (7×24, linked days, drag create / move /
  resize, snap, keyboard), day view, table view with inline edit (same model), side panel (details, action entities from
  `/schedules/catalog`, per-slot actions and arguments, **schedule-level conditions with the condition builder and
  presets**, days, repeat, period, upcoming runs from `/schedules/preview`, validation), "כיבוי בסיום", split dialog,
  conflict banner (409 + `schedules_changed`), unsaved guard, save error, read-only states incl. locked conditions,
  create dialog (templates, condition presets, three-tap quick create), lowering dialog with code field, the list's week
  view, phone variant.
- **Owns**: `frontend/src/screens/schedule-editor.ts`, `frontend/src/components/sw-schedule-grid.ts`,
  `frontend/src/screens/schedule-table-view.ts`, `frontend/src/screens/schedule-entity-picker.ts`,
  `frontend/src/screens/schedule-conditions.ts`, `frontend/src/screens/schedule-create-dialog.ts`,
  `frontend/src/screens/schedule-lowering-dialog.ts`, `frontend/src/screens/schedules-week-view.ts`,
  `frontend/src/screens/schedule-templates.ts`, specs `frontend/tests/unit-schedule-grid.spec.ts`,
  `frontend/tests/unit-schedule-conditions.spec.ts`, `frontend/tests/evidence-schedule-editor.spec.ts`.
- **Touches minimally**: `frontend/src/shell/sw-app.ts` — exactly one line, `import '../screens/schedule-editor';`,
  directly after `import '../screens/security-alarm';`.
- **Estimate**: 32–38 agent-hours.

### 13.1 Merge order and conflict-prone files

1. **S2** → 2. **S1** → 3. **S3** → 4. **S4**. Frontend branches work in demo mode and may merge before S1 harmlessly
(the tab is gated on `schedule.view`, which no role holds until S1 merges).

| Shared file | Sole editor |
|---|---|
| `roles.json`, `routers/access.py`, `role-catalog.design.json`, `routers/settings.py`, `main.py`, `migrations/` | S1 |
| `services/ha_sync.py`, `services/ha_client.py`, `services/alarm.py`, `routers/alarm.py`, `services/home_screen.py` | S1 |
| `services/devices.py`, `services/device_bulk.py`, `routers/ha.py`, `routers/devices.py`, `routers/anchors.py`, `routers/search.py` | S2 |
| `integration/smplwise_bridge/*` | S2 |
| `frontend/src/shell/nav.ts`, `frontend/src/api/ha.ts` | S3 |
| `frontend/src/shell/sw-app.ts` | S3 + S4's one import line (anchors above, one unchanged line apart) |
| `frontend/src/api/schedules.ts`, `schedules-mock.ts`, this document | coordinator |
| `management/*`, CHANGELOG, versions, `contracts/API_INVENTORY.md` | release round |

### 13.2 Critical path and totals

S1 (32–38 h) and S4 (32–38 h) run in parallel and bound the calendar; then integration (coordinator or S1): the live
spec `evidence-schedules-live.spec.ts` end-to-end against the real backend with the fake (4–6 h) and a review round.
Totals: S1 32–38 + S2 12–16 + S3 24–30 + S4 32–38 + integration 4–6 = **104–128 agent-hours** (design estimate for
phases 1+2: 94–118; the increase is the sensitive classes and first-class conditions). Phase 2b (coded alarm relay)
+16–22 h, separately approved.

### 13.3 Definition of done (every agent)

Targeted tests actually run and reported (NOT_RUN is not PASS); UI screenshots at 1440 / 820 / 390 and loading /
empty / error / ready; no product names on operator screens; no secrets, lab data or private evidence in fixtures;
commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
