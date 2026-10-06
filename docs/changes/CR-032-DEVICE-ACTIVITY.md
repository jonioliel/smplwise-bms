# CR-032 - Device activity popup (long press): history and schedules of an electrical device

Status: PROPOSED (mockup + feasibility, task DEVHIST, half-version 2.0.6; design round 2 done: compact 380 px popup, 12 entity types). No product code, no migration, no live-system access.
Branch `pilot/DEVHIST-mockup`. Mockups: `docs/design/mockups/device-history/` (index.html, gallery.html, screens/*.png).

## 1. Owner request (paraphrased from Hebrew)

A LONG PRESS on any electrical device (switch, light, cover, climate, fan, outlet, ...) opens a popup in the same design
language as the multimedia popups and the settings dialogs, with two tabs:

1. "פעילות" (activity): who turned it on or off, who changed the temperature, who closed the shutter - any recorded
   activity, with its source (a person by name, an automation, a schedule, the physical button, a scene, the system).
2. "תזמונים" (schedules): the schedules this device belongs to, with the ability to see and edit them (reuses CR-014).

## 2. Design summary (see the mockups)

| Screen (gallery `#s=`) | What it shows |
|---|---|
| `press`, `press-phone` | Long-press feedback (500 ms ring around the icon, tile sinks 2 %, short haptic), accessible alternatives, conflict table, a live demo of the gesture |
| `desk-activity`, `desk-filters` | Centered dialog, tab "פעילות": filters (period, actor type, event type), day groups, rows with actor avatar or source glyph, before/after chips, "load more", retention footnote |
| `desk-schedules`, `desk-editor` | Tab "תזמונים": next run, days, enable switch, edit (opens the existing editor inside the popup), "add schedule for this device", read-only rows |
| `phone-activity`, `phone-filters`, `phone-schedules`, `phone-editor` | Bottom sheet; filter pickers follow `ui.dd_phone` (sheet shown; centred / inline are the same component's other modes) |
| `states`, `states-sched` | Loading, empty after filtering, no permission, history unavailable, partial coverage (gap banner), loading more; schedules empty and no permission |
| `variants` | Board of all 12 entity types (light, switch, outlet with power, cover with position and tilt, garage door, climate, heater, fan, water heater, valve / irrigation, vacuum, generic fallback): icon, state line, recorded values, Hebrew event wording with before/after, a schedule row |
| `domains` | Which entity domains qualify and how the UI knows |

Rules applied: Hebrew RTL, v2 tokens and the four skins, light and dark, 44 px targets, no permanent hint on operator
screens (discovery is the "פעילות" menu item), no platform name outside Settings (the unavailable state says "תשתית המערכת"),
motion tokens collapse under `prefers-reduced-motion`, times and numbers are isolated LTR.

### 2.1 Long press: interaction contract

- Threshold 500 ms, 8 px slop (movement beyond it cancels, so scroll and drag win). The click that follows a completed long
  press is swallowed, so the device is NOT toggled. A normal tap behaves as today.
- Feedback: conic ring fills over 500 ms around the tile icon, tile scale 0.98, `navigator.vibrate(10)` where available
  on completion. Under `prefers-reduced-motion` the ring appears full at completion with no scale.
- Accessible and non-touch alternatives (the gesture is never the only way): context menu (right click, the tile's "more"
  button, Shift+F10 or the menu key) with the item "פעילות" (and "תזמונים"); `Alt+Enter` on a focused tile opens the popup
  directly; Enter and Space keep toggling. Touch: the browser's own context menu is suppressed on tiles (`contextmenu`
  preventDefault) so it does not appear beside the ring.
- Conflicts: edit mode of the plan or layout (long press disabled, drag wins; the menu item still works); multi-select
  (long press unchanged, menu item works); controls with their own gestures (dimmer slider, cover slider, media player) -
  only the tile body and title respond; media players keep their own popup.

### 2.2 Which entities are "electrical", and how the UI knows

The client does not guess from names or icons. The server adds `activity: true|false` to each card row, derived from the
same table that already decides which entities get controls (`services/devices.py: card_of`): cards `lighting`,
`switches` (incl. outlets and `input_boolean`, marked virtual), `climate` (climate, fan, humidifier) and `covers`. Later
phase: `water_heater`, `valve`. Excluded: sensors, binary sensors, cameras, scenes, scripts, automations (those are
SOURCES, not devices), media players (own popup), and `lock` / `alarm_control_panel` (security has its own sensitive log;
open question). The popup, the long press and the menu item exist only when `activity` is true and the user holds the
view permission on the entity's scope.

## 3. Feasibility (read from the code; nothing was run against a live system)

### 3.1 What exists today

| Source | Holds | Gap for this feature |
|---|---|---|
| `ha_state_history` (migration 0009, `services/ha_history.py`) | entity_id, state string, change time, receipt time; retention 30 days | NO attributes (brightness, target temperature, cover position), NO `context`, so no who/why. Fine for "on to off", not for "22 to 24" |
| HA `state_changed` push (`services/ha_sync.py: handle_state_event`) | the full new and old state object. HA state objects carry `context {id, parent_id, user_id}` | `ha_sync` does not read `context` today: it is dropped. Capturing it is a small change at the point where the event is already handled |
| `ha_users` (migration 0004; synced registry) | HA user id to name and username | Works for user id to display name (already used by `automation_runs._user_name`). A removed user needs a name snapshot |
| `ha_actions` (migration 0004) + `audit_log` | Every action taken THROUGH Arx: principal user and username, entity, action, arguments, time, `via` | Arx calls HA with the bridge identity, so HA's `context.user_id` is the bridge, NOT the person (AGENTS.md: token privilege is not user identity). The person comes only from `ha_actions`, correlated by HA `context.id` (needs the call's returned context id stored in a new nullable column) or, as a fallback, by entity plus a short time window |
| Automation mirror (CR-017, `automation_runs`, `AUTOMATION_PREFIXES` hook in `handle_state_event`) | The app already receives `automation.*`, `script.*`, `scene.*` state changes | A map `context.id -> source entity` is needed to say WHICH automation, script or scene caused a device change |
| Schedule engine (CR-014: `schedule_cache`, `schedule_runs`, `Mirror._start_run`) | Schedules, their actions and derived runs | `GET /schedules?entity=` already filters schedules by action entity; a run gives a time window to attribute a device change as "inferred: schedule X" |
| HA logbook / history over the WebSocket (`logbook/get_events`, `history/history_during_period`) | Logbook rows carry `context_user_id`, `context_entity_id` (the automation or script), `context_event_type`, `context_domain`, `context_service`; history carries attributes | Not used by Arx today. Read-only commands, but recorder retention is HA's (default 10 days), the token's permission must be verified, and each query costs HA CPU. Good for backfill and gap recovery, not as the primary live source |

### 3.2 Attribution rules (proposed)

1. `context.id` matches an `ha_actions` row, status confirmed: ACTOR = the Arx operator (exact), `via` = Arx.
2. `context.user_id` set and it is not the bridge: ACTOR = that HA user's name (exact): changes made in the HA UI or app.
3. `context.parent_id` or an `automation.*` / `script.*` / `scene.*` context match: SOURCE = the automation, script or scene
   (exact when the context map matches; "automation" without a name otherwise). A schedule run in the same window: "schedule X" (inferred).
4. No user, no parent, no Arx action: "manual at the device or an external system" (physical button, vendor app, a voice
   assistant through the cloud, another integration). HA cannot tell which, and NEVER who. Shown as "ידני בהתקן (משוער)".
   Optional later phase: where the integration emits device events (Zigbee / Z-Wave button events), mark a physical press as
   "button pressed" with higher confidence. Who pressed a physical button is not knowable and the UI never claims it.
5. Power loss or an `unavailable` to value transition: SOURCE = system, kind = availability.
6. Unknown is shown as unknown (dashed avatar), never as a guess ("Historical unknown is not current state").

### 3.3 What is missing

- Capture and storage of `context`, and of the watched attributes per domain (light: brightness, colour temperature; climate:
  hvac mode, target temperature, fan mode; cover: position; fan: percentage). Only these attributes, never the full object;
  coalesce changes within about 2 s (a dimmer drag stores the final value); current-temperature drift is not an event.
- A new table (next free migration, `0060`) `device_activity(id, entity_id, at_utc, actor_type, actor_ref, actor_name_snapshot,
  source_ref, kind, from_json, to_json, context_id, confidence, via)` with indexes on `(entity_id, at_utc)` and a janitor
  using the existing retention pattern. Retention default proposed 90 days (the existing history table is 30, audit 365).
- `ha_actions.context_id` (nullable) so Arx actions attribute exactly.
- The user id to person mapping beyond the name: `ha_users.name` gives a display name; an avatar is initials (a person photo
  is optional later). Arx operator bindings are separate from HA users; for HA-originated changes the HA name is used.
- Backfill before the feature went live: not available from our store; an optional one-time pull from the HA logbook (about
  10 days) is possible but unverified (see open question 5). Gaps while Arx was disconnected are recorded as coverage gaps
  ("partial" banner in the mockup), never invented.
- Physical-button identity: not available, by design (3.2 rule 4).

### 3.4 API sketch (new routes under the existing devices router; read-only)

```
GET /api/devices/{entity_id}/activity
    ?since=ISO&until=ISO&actor=person|automation|schedule|scene|device|system|unknown
    &kind=power|value|availability&limit=50&cursor=...
 -> { items: [ { id, at, kind,
                 actor: { type, name?, user_ref? },        // names only when the caller may see them
                 source: { type: "automation|script|scene|schedule", id?, name? } | null,
                 from: { state, value? }, to: { state, value? }, unit?,
                 via: "arx|ha|device|unknown", confidence: "exact|inferred|unknown" } ],
      next_cursor, retention_days, coverage: { from, gaps: [ {from, to} ] },
      availability: "ok|partial|unavailable" }
GET /api/devices/{entity_id}/schedules      // thin wrapper over GET /schedules?entity=...; each item keeps its `can` and `read_only.reasons`
```

Existing routes are reused unchanged for the schedules tab: `POST /schedules` (prefilled with the device as an action
entity), `PUT /schedules/{id}`, `POST /schedules/{id}/enable|disable`. Card rows gain `activity: bool`. No WebSocket frame
in phase 1 (the popup polls on open and on a manual refresh; a frame can follow).

### 3.5 Permissions

Reuse where possible. Proposed: viewing the feed needs `devices.read` on the entity's scope (the same gate as seeing the
device); the schedules tab needs `schedule.view`, editing needs `schedule.manage` with scope (the server already returns
`can.edit` and `read_only.reasons` per schedule, which the UI shows as the read-only tag). NEW only if the owner agrees
(open question 1): `devices.activity`, because "who did what and when" is behavioural data about people, not a device
state. Proposed default: every role that holds `devices.control`. Person names are omitted (shown as "משתמש") for callers
without it. Every read of another person's activity goes to the audit log only if the owner asks for that (not proposed).

## 4. Effort estimate (agent-hours, calibrated: a typical Sonnet UI feature such as the cast UI took under 1 hour)

| Phase | Content | Estimate |
|---|---|---|
| S0 | Read-only proof on the lab: that `context` arrives on `state_changed`, that automation contexts map to an entity, which attributes arrive per domain (a recorded fixture, redacted) | 0.5 h |
| S1 | Migration `0060`, capture in `handle_state_event` (domain allow-list, watched attributes, coalescing), `ha_actions.context_id`, attribution rules 1, 2, 5, janitor, `GET .../activity`, `activity` flag, backend tests | 2 to 3 h |
| S2 | Long-press controller (threshold, slop, click swallow, edit/multi-select guards, haptics), context menu item, `sw-sheet` based popup with the activity tab, filters, states, load more, desktop and phone specs | 1.5 to 2 h |
| S3 | Schedules tab: list with next run, days, switch, read-only tags; edit opens the existing editor in the popup; "add schedule for this device"; specs | 1 to 1.5 h |
| S4 | Attribution rules 3 and 4 (context map to automation, script, scene; schedule-run window), value before/after for climate, cover, light; optional HA logbook backfill | 1.5 to 2 h |
| S5 | Review round, fixes, screens, release notes (bilingual) | 1 h |
| Total | | about 9 to 11 agent-hours after design round 2 (per-type formatters add about 1 h to S2 and S4), about 5 hours of wall time with two agents |

## 5. Proposed split into half-versions

- Half-version A (backend + activity tab): S0, S1, S2 with people, Arx actions and "manual / unknown" rows, automations
  and schedules shown by type without name.
- Half-version B (schedules tab): S3. Independent of A except for the popup frame, so it can run in parallel on a branch.
- Half-version C (richer attribution): S4 + S5 polish, retention setting, logbook backfill if approved.

## 6. Risks and limits

- A big home produces many events: store only watched domains and attributes, coalesce, retain 90 days, index
  `(entity_id, at_utc)`; the write happens in the same short transaction as the existing mirror update (no extra fsync class).
- `context` on `state_changed` and the automation context mapping are verified only against HA documentation and the code
  paths here, not against the lab: S0 proves them first, read-only.
- "Manual at the device" is an inference, shown as such.
- No production recording, HA user, or device setting is touched by any phase; the popup only reads, and schedule edits go
  through the existing CR-014 routes with their existing permission and audit behaviour.

## 7. Open questions

See `docs/design/mockups/device-history/index.html` (Hebrew, numbered, with a recommended option).

## 8. Design round 2 (owner feedback: calmer, smaller, every electrical type)

Scope changes versus round 1:

- Compact popup: 380 px wide on desktop (was 600), a one-line header (name, area and state), a two-segment tab control, activity rows
  of about 52 px (was about 86), hairline dividers instead of boxes, one soft shadow, small outlined filter chips with short labels,
  a one-line footnote. On a phone it is a bottom sheet (about 66 to 88 % height). Before/after: `compare.html`.
- Twelve entity types are designed (board `variants`): light, switch, outlet (power shown only when a power sensor is linked to the
  same device), cover (position, direction, tilt), garage door, climate / AC, heater, fan (speed, direction), water heater,
  valve / irrigation (duration when a timer exists), vacuum, and a generic fallback ("שינוי מצב") for any other qualifying entity.
- Server contract addition: card rows carry `activity_kind` (one of the twelve) next to `activity`, derived from the domain,
  device class and supported features on the server; the client only picks the icon, the value formatter and the Hebrew verbs
  from it. A new domain needs one registry entry, otherwise it falls back to the generic kind. Per-type formatter table lives in
  one frontend module and is unit tested (before/after text per kind, including unit, percent and degree formatting).
- Phasing change: the first half-version covers the four core kinds (light, switch / outlet, cover / garage, climate / heater);
  the other kinds ride the same registry and ship in the second half-version (open question 4 in the index).

## 8. Evidence S0 (read-only proof on the lab Home Assistant, 2026-10-05) and S1 (backend) - branch `pilot/DEVHIST-backend`

No identifiers (hosts, tokens, user ids, entity ids, serials) are recorded here. The probe only used GET `/api/states`, the WebSocket
commands `config/auth/list` and `logbook/get_events`, and a passive `subscribe_events state_changed`; it wrote nothing.

### 8.1 What the lab proved

- The lab is small (about 420 states: 38 switches, 9 locks, no lights, covers, climate, automations, scripts or scenes), so only part of the
  attribution chain could be observed live; the rest rests on the HA code paths and is covered by fixtures.
- `context` is present on every state object (`id`, `parent_id`, `user_id`), and on the `state_changed` event it is the SAME context id as
  `new_state.context.id` (15 of 15 live events). One state, among 38 switches, carried a `user_id`; 37 carried none.
- The logbook (72 h, 5 824 rows) returns, for a change made by a user, `context_user_id`, `context_domain`, `context_service` and
  `context_event_type` (171 switch rows and 9 lock rows); rows with no user carry no `context_*` field at all. All 180 user ids resolved to
  an entry of `config/auth/list` (7 users, 2 of them system-generated), whose fields are `id, name, username, is_owner, is_active,
  system_generated, local_only, group_ids`: user id to a display name works with the registry Arx already syncs (`ha_users`).
- A physical or vendor-side change looks like a state change whose context has NO `user_id`, NO `parent_id` and, in the logbook, no
  `context_*` fields: 484 of 495 electrical logbook rows. It is indistinguishable from an integration poll or a cloud voice assistant, so it is
  shown as "manual at the device (estimated)", never as a person.
- NOT proven live (no automation, script or scene exists in the lab, and no actuation is allowed): that a device changed by an automation carries
  that automation's context id (or a `parent_id` pointing at it). The code relies on HA's own behaviour (the automation entity's state is
  written with the trigger context that its actions then use) and handles both orders (the automation state before or after the device
  change). Re-prove on an installation that has automations before relying on the name in the UI; a wrong guess degrades to "automation
  (unnamed)" or "manual", never to a person.
- Finding that changes the design sketch of section 3.1: the Arx bridge (`smplwise_bridge.execute`) already calls HA with `Context(user_id=<the
  operator's own HA user>)`, so HA's `context.user_id` of an Arx-made change IS the person, and the bridge's answer already returns the
  `context_id`. The `ha_actions.context_id` link is therefore an exact marker (via `arx`) rather than the only way to find the person.

### 8.2 What S1 built (owner decisions of 2026-10-05 applied)

- Migration `0063_device_activity.sql` (renumbered at merge: 0060 cast, 0061 generator and 0062 wall profiles are unmerged): `device_activity`,
  `device_activity_gaps`, `ha_actions.context_id`, indexes `(entity_id, at_utc, id)`, `at_utc`, `context_id`, `parent_id`.
- Capture in `services/ha_sync.handle_state_event` (same transaction, no extra HA call, never raises): twelve kinds - light, switch, outlet,
  cover, garage door, climate, heater, fan, water heater, valve, robot vacuum, generic (humidifier, lock, alarm panel) - with the watched
  attributes per domain; sensors, media players, scenes, scripts and automations are never stored; a first sight of an entity and a drift of
  an unwatched attribute (current temperature) are not events.
- Attribution order: Arx action by context id (exact, `arx`), HA user (exact, `ha`), automation / script / scene source by context or parent
  (exact when named, with a back-fill when the item's own state arrives later), parent without a known source ("automation", inferred), no user and
  no parent ("device", inferred), `unavailable` transitions ("system", exact), no context ("unknown").
- Coalescing (a dimmer drag, a light transition, a cover / valve / lock run is one row), a write-rate guard (30 rows per entity per minute, 2 000
  overall) that records a coverage gap instead of dropping silently, a connect gap, retention with the setting `device_activity.retention_days`
  (default 90, range 7..365), a per-entity cap (5 000) and a table cap (500 000), pruned by the janitor at most every 15 minutes.
- `GET /api/v1/devices/{entity_id}/activity` (filters `since`, `until`, `actor`, `kind`, paging by `cursor`); card rows gain `activity`,
  `activity_kind` and, for security devices, `activity_permission`; outlets gain `power` only from a power sensor of the same registry device.
- Decisions: no new permission (whoever sees the device sees its activity, names included); a lock needs `door.unlock` or `ha.entity.control` (operator and above; `door.unlock` alone is held by no default role) and an alarm panel
  `alarm.arm` (plus `alarm.view`), reusing the existing family without widening who sees them; history starts from zero (`tracked_since`).
- Not in S1: rule 3's schedule-run window (a schedule's action is shown as "manual" or "automation (unnamed)" until S4), the optional logbook
  backfill, a WebSocket frame, the UI.
