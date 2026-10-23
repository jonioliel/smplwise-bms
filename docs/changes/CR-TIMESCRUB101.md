# CR-TIMESCRUB101 - Time scrub of the whole building on the floor plan ("building twin looking backwards")

Status: APPROVED (owner review 2026-10-24, mockup v2). Slice 1 built on `pilot/TIMESCRUB101B-295` (see "Slice 1 build notes" at the end).
Branch `pilot/TIMESCRUB101-295` from `main` @ 320e55551 (v2.12.4). Mockup: `docs/design/mockups/timescrub-101/index.html`
(v2 after the owner's feedback of 2026-10-24; a copy for review at `private/review/timescrub-101-mockup-v2.html`, screenshots and
the viewport assertions under `private/review/timescrub-101-v2/`).

**Owner feedback 2026-10-24 (v1 not approved):** "the page scrolls so you cannot reach the bottom to get the timeline - that makes no
sense; redesign the screen WITHOUT bottom scrolling". Section 3.1 is the resulting layout rule; the content and the states of v1
are kept unchanged.

## 1. Goal

A timeline on the floor plan that replays the recorded state of the building at a past instant (snapshot at T) or as a
playback over a period: lit rooms, presence, temperature chips, open doors, the alarm panel, device states, elevator
state, and the cameras' recordings linkable at the same timestamp ("play from here", frame at T). It extends the
existing historical map (`#/investigate/floors/{id}/history`, `frontend/src/screens/investigate-history-map.ts`), which
already scrubs one local day and reloads the floor bundle at the cursor (`GET /floors/{id}/map?at=`), but which does not
pass the room-state layer (lit / presence / temperature tints) to the canvas, has no playback, no per-layer legend, and
no per-layer coverage or permission handling.

Honesty rule of this CR (AGENTS.md "Historical unknown is not current state"): every layer below says what IS recorded,
for how long, and what is NOT. The UI never shows a last live value in the past, never interpolates a state across a gap,
and never claims a layer it cannot replay.

## 2. Data sources and retention per layer (as read from the code, 2026-10-23)

Backend paths are under `smplwise_vms/backend/smplwise/`. Migrations are raw SQL in `migrations/NNNN_*.sql`.

| Layer on the plan | Source today | Retention (default, setting / constant) | Replayable? |
|---|---|---|---|
| Lit rooms (light / switch on the lights layer is on; lamp objects) | `ha_state_history` (0009), written by `services/ha_sync.upsert_state` -> `services/ha_history.record`; read by `ha_history.state_at` (forward fill up to `FORWARD_FILL_MAX_S` = 24 h) | **30 days, fixed** (`ha_history.RETENTION_DAYS`), no setting, no row cap | Yes, on/off only. Brightness / colour are attributes and are NOT stored |
| Presence (motion / occupancy / presence binary sensors) | same table | 30 days fixed | Yes (on/off). SENSITIVE - see section 7 |
| Temperature chip of a room | `room-state.ts` reads the climate entity's `current_temperature` ATTRIBUTE, else a temperature sensor's state | sensor state: 30 days; climate attribute: **not stored** | Partly: temperature sensors yes, climate `current_temperature` no |
| Infra temperature (fridges, `#/infra/temperature`) | `infra_temp_samples` (raw, `RAW_KEEP_S` = 35 days), `infra_temp_samples_5m` + `infra_temp_events` (0124/0125), `services/temperature.py` | 5-min rollup and events: `retention_days` default 400 (35..3650) | Yes, numeric time-series |
| Open doors / windows (binary sensors, openings bound to a sensor) | `ha_state_history` | 30 days fixed | Yes (open/closed) |
| Door windows / automations / emergencies | `door_window_occurrences`, `door_window_trigger_log` (0137/0143), `door_automation_fires` (0133), `door_emergency_*` | **no prune found** | Program / occurrence log, not door state. Shown as event marks only |
| Access events (WisKey / intercom: granted / denied) | **not stored in Arx**, proxied live from WisKey (`GET /intercom/events`, `/access-control/events`) | WisKey: ~5 000 records / 30 days (not verified) | Only as marks fetched live for the visible window; may be missing |
| Alarm panel (armed / disarmed / triggered) | panel state via `ha_state_history`; arm / disarm / bypass actions in `audit_log` (0001) | state 30 days; audit `audit.retention_days` default 365 (30..3650) | Yes (state) + action marks. There is NO alarm event table |
| Alerts / notifications / rule alerts | `notifications*` (0045), `rule_alerts` (0010), `services/notify.py` | resolved after `retention_days` default 30, floor 365 for any row; `rule_alerts` never age-pruned | Marks on the timeline |
| Device states (switches, covers, climate mode, fans) | `ha_state_history` (state string) + `device_activity` / `device_activity_gaps` (0063, CR-032 S1: before/after of watched attributes, actor) | state 30 days; activity `device_activity.retention_days` default 90 (7..365), `MAX_ROWS` 500 000, 5 000 per entity | Yes: state at T from history; value changes (cover position, target temperature) only from `device_activity` and only for the four device cards (never sensors) |
| Elevators | `infra_elevator_states (elevator_id, at, state)` + `infra_elevator_alerts` (0118/0119), `services/elevators_runtime.py` 15 s evaluator | `elevators.HISTORY_KEEP_S` = 8 days, pruned hourly | Derived state only (ok / fault / fire service / out of service). **The cab's floor / position is not recorded** |
| Generator | `generator_samples` (1/min, raw 3 days), `generator_samples_5m`, `generator_alerts` (0061) | rollup `generator.history_retention_days` 35 (7..90); alerts 365 (30..1825) | Yes (numeric), as a chip on the generator anchor |
| Electricity | energy.db `readings` / `intervals` (15 min) / `daily` | raw 90 days; intervals 26 months; bills 7 years | Yes (numeric) - optional chip, not in slice 1 |
| Camera recordings | **not stored locally**: NVR / Frigate search (`services/recordings.py`), `GET /cameras/{id}/recordings?date=` (coverage: complete / partial) and `GET /cameras/{id}/frame?at=` | whatever the recorder disk holds | Coverage at T yes (blue / dashed as today); frame at T yes; playback link yes (`#/investigate/playback?camera&t`) |
| Motion / analytics events | `events` (0003), `event_window_groups` (0059) | `events.retention_days` default 30 (1..3650) | Marks on the timeline (as today) |
| Plan geometry and background | `plan_versions` (0001), `plan_geometry` (0018), `geometry_store.at_row(version_id, iso)`; anchors tombstoned (`effective_from` / `effective_to`) | unlimited from first publish | Yes, exact (today's `history="exact"`) |
| Anchor MOVES (a device moved on the plan) | `PATCH /map-anchors/{id}` updates x / y in place; old position only in `audit_log.details_json` (`anchor.update`) | audit 365 days | **No**: a moved device is drawn at its current position |
| Phone presence of people (GPS) | `mobile_presence_events` (0057), `services/presence.py`, master switch off by default | `presence.retention_days` 30 (1..365) | **Out of scope**: never drawn on the plan replay (section 7) |
| Schedules / automation runs | `schedule_runs` (0039), `automation_runs` (0048) | 90 days (7..365); automations 30 fixed | Marks only (optional, slice 2) |

Known gaps the product cannot fill today (stated in the UI as "לא מוקלט", never guessed):
1. elevator cab position; 2. entity attributes (brightness, climate current / target temperature, cover position outside
`device_activity`); 3. anchor moves; 4. access events older than the door system keeps; 5. anything before the local
history began (`ha_history.coverage().from`), or while Arx was down (`device_activity_gaps` for the four cards; for
`ha_state_history` a gap is visible only as "no change recorded" - slice 1 adds an explicit gap record, see 4.3).

## 3. Scope of the feature

- Screen: the existing historical map grows a layer legend, a playback bar and a per-layer coverage model. The URL stays
  `#/investigate/floors/{id}/history?t=`; playback adds `?from&to`. No new area, no new rail item (owner's "clean operator
  screens" rule: the legend is a compact panel, no paragraphs).
- 2D and 3D: the 2D canvas gets `roomStates` from the replay (today it only gets `entityStates`); the 3D replay
  (`map/replay-3d.ts`) already consumes entity states and receives the room-state layer the same way.
- Cameras: each camera anchor shows coverage at T (as today), the selected camera's frame at T (as today), "play from
  here" (as today) and NEW "play all cameras of the floor from here" -> the synchronized playback screen
  (`#/investigate/playback/sync?t=`) with the floor's cameras preselected.
- Default OFF (section 8). With the flag off the screen is exactly today's historical map.

### 3.1 Layout rule (owner 2026-10-24): the page never scrolls, the timeline is always on screen
- The screen is a fixed-height column inside the shell (`100dvh` minus the rail / bottom bar): tab row, compact head (title, time,
  actions in one row), the blue status bar (one line, ellipsis), the plan + panel area, and the **timeline bar pinned to the bottom
  of the viewport**. `document` scroll stays at 0 on every viewport; nothing is reached by scrolling the page.
- The plan canvas takes all the height left between the head and the timeline (`flex: 1`, `min-height: 0`); the plan is fitted
  inside it (never mirrored, never cropped). The side panel (layers, "at the instant", events) is the only scrolling region, with
  internal scroll (`overflow-y: auto`, `overscroll-behavior: contain`).
- The timeline bar: one control row (badge, time, play / speed in playback mode, step chips, window, date) that never wraps - on
  tablets the hour steps, the date and the key hints move to the "..." menu; then the track (lanes + axis). The axis labels and the
  cursor bubble are drawn counter-scaled so the glyphs keep their shape when the track is narrow.
- Tablet (`<= 1023`): the two columns stay (panel 272 px, scrolling) so nothing drops below the timeline.
- Phone (`<= 767`): the layer chips row above the plan, the plan fills the middle, the timeline bar sits above the bottom bar
  (thinner lanes, a shorter axis, labels every 6 h); the detail cards open as a **sheet over the plan** ("פרטים" in the head, close
  button in the sheet), with internal scroll only.
- Minimum viewport check (mockup, headless Chromium, document scroll forced then read back): 1366x768, 1024x768, 375x812 and 375x667,
  light and dark, all states - the timeline's bottom edge is inside the viewport with `scrollTop === 0` and
  `scrollHeight <= innerHeight`; the plan keeps >= 246 px of height on the smallest phone. The product build repeats this check in
  the Playwright suite (section 10.4).

## 4. Query model

### 4.1 Snapshot at T (slice 1)

`GET /api/v1/floors/{id}/history/snapshot?at=<UTC ISO>` (new route in `routers/anchors.py` next to `floor_map`, or an
extension `?at=&layers=1` of the existing one - lead's choice at build time; the mockup assumes the former).

Response (every layer block is independent; a block never fails the whole response):

```
{ at, tz, plan: { version_id, published_at, archived_at, history: "exact"|"current" },
  layers: {
    lights:      { status: "ok"|"empty"|"not_recorded"|"not_permitted"|"gap", retention_days, from, entities: { id: { state, changed_at, known, reason } } },
    presence:    { status, retention_days, from, entities: {...} },           // not_permitted without history.presence
    openings:    { status, retention_days, from, entities: {...} },
    temperature: { status, retention_days, from, entities: {...}, infra: { probe_id: { value, at } } },
    devices:     { status, retention_days, from, entities: {...} },
    alarm:       { status, retention_days, from, panels: { id: { state, changed_at, known } } },
    elevators:   { status, retention_days, from, items: { id: { state, at } }, position: "not_recorded" },
    cameras:     { status, items: { camera_id: { coverage: "recorded"|"gap"|"unknown", segment } } },
    events:      { status, retention_days, near: [ ... +-10 min ... ] }
  },
  coverage: { from, to, gaps: [ {from, to, reason} ] } }
```

Rules: `state_at` stays the single reader of `ha_state_history` (forward fill <= 24 h as today; beyond it `known:false`,
`reason:"forward_fill_exceeded"`). The room-state layer is computed on the client from the entity states exactly as the
live map does (`map/room-state.ts` is pure: same structure + same snapshot = same layer), so the past and the present use
one algorithm. `not_permitted` carries NO data (not even entity ids) - the layer is filtered server-side.

### 4.2 Range playback (slice 2)

`GET /api/v1/floors/{id}/history/range?from=&to=&step=<seconds>&layers=lights,openings,...`

- Returns change-points per entity (`[[t, state], ...]`, step function), plus event marks and a density strip per layer
  (`buckets: [{t, changes}]`, bucket = `step`). The client plays by moving a cursor over the change-points; it never
  queries per pixel or per frame (the sw-timeline rule of chapter 23).
- Downsampling: the server computes `native_rows = count(*)` for the floor's entities in the range (one indexed query on
  `(entity_id, changed_at)`). If `native_rows <= MAX_POINTS` (10 000) the change-points are returned as is. Otherwise the
  range is bucketed into `min(ceil(range / step), 1 440)` buckets and each entity returns the LAST state per bucket plus
  `changes` per bucket; the UI shows the bucket size in the legend ("דגימה כל 5 דק׳") and a state inside a bucket is
  drawn as "changed during" (hatched), not as exact.
- Numeric series (infra temperature, generator) reuse their own rollups (`*_5m`) and `max_points` (300 .. 1000) as their
  screens already do.
- Cameras in playback: coverage segments for the range only (the day search already exists); no frame grabs during
  playback (frames only when the cursor settles, 600 ms, as today). Events for the range via `GET /events?from&to`.

### 4.3 Gap record (slice 1, small)

`ha_history` gains a `ha_state_history_gaps (from_utc, to_utc, reason)` table written when the HA sync (re)connects after
an outage longer than 60 s (the same pattern as `device_activity_gaps`). The snapshot answers `status:"gap"` for the HA
layers when T falls inside a gap, and the timeline hatches the band. Without this the UI cannot tell "nothing changed" from
"Arx was down". Migration: next free number at build time (0144+ at the time of writing; verify).

## 5. Performance limits (to be measured in the tests, 10.3)

| Limit | Value | Why |
|---|---|---|
| Entities per floor in one snapshot | <= 400 anchored entities (the `IN (...)` query of `state_at`) | one query per layer group, index `(entity_id, changed_at)` |
| Snapshot latency target | p95 <= 400 ms on the add-on box with 30 days / 300 entities | the cursor reloads the bundle on settle (600 ms debounce as today) |
| Range query | `MAX_POINTS` 10 000 change-points per response; above it bucketed, at most 1 440 buckets; hard cap 25 000 rows scanned -> 413 with `{limit:"range_too_large"}` and the UI shortens the window | SQLite on the add-on; no table scan |
| Range window | day / 6 h / 1 h / 10 min (the sw-timeline windows); maximum range per request 7 days | retention of most layers is 30 days; 7 days x 300 entities fits the row cap when bucketed |
| Server cache | per `(floor, from, to, step, permission fingerprint)` for 60 s | repeated play / pause / seek |
| Client | one in-flight request per floor (`bundleSeq` pattern), cursor debounce 150 ms during play, 600 ms for frames; playback speeds x1 / x10 / x60 / x600 (a day in 2.4 min); `requestAnimationFrame` only while playing | battery / CPU on phones |
| Pruning | the existing `janitor_tick` (30 s) prunes the new gap table with `ha_history.prune` | no new background job |

## 6. Permissions (a viewer only sees the layers they may see)

The screen gate stays as today (`video.playback` in `nav.ts`, `map.read` on the floor in the API). Each layer block is
authorized separately on the server and the client only draws what came back:

| Layer | Permission (existing unless marked NEW) | Scope |
|---|---|---|
| Plan, structure, anchors | `map.read` | floor |
| Lights, openings, devices, temperature sensors | `devices.read` | floor (entity's anchor floor) |
| Infra temperature, generator, elevators | `devices.read` (as their screens: `routers/elevators.py READ`) | installation |
| Alarm panel state + action marks | `alarm.view` | installation |
| Events | `events.read` | camera's floor |
| Camera coverage, frame at T, play from here | `video.playback` | camera |
| Presence (motion / occupancy / presence sensors in the PAST) | **NEW `history.presence`** | floor |
| Access-event marks | `access.read` | station |

A layer the viewer may not see is listed in the legend as "לא מורשה" with a lock and no data (the owner's rule that a
viewer sees the layers they may see - the legend still names the layer so the viewer knows it exists; owner question 3
offers to hide it entirely instead). Every snapshot and range call writes one audit row per (user, floor, day) when the
presence layer was included (`history.presence.view`), never per cursor move.

## 7. Privacy

- Presence history of people is sensitive (it tells who was where). It gets: (a) its own permission `history.presence`,
  not granted by `devices.read`; (b) its own retention, NEW setting `history.presence_retention_days`, default **7**,
  range 1..30, applied by `ha_history.prune` to rows whose entity is a `binary_sensor` with device_class motion /
  occupancy / presence (today they live 30 days like every other state; the prune only shortens, never lengthens);
  (c) the layer is OFF by default in the legend and remembered per browser; (d) the audit row above; (e) no export and no
  case attachment of the presence layer in this CR.
- Phone presence (GPS, `mobile_presence_events`) is never shown on the plan replay. Out of scope, stated in the UI only by
  its absence.
- Frames and recordings keep their own rules (`video.playback` per camera, redaction rules of the playback screen).
- The retention summary `docs/privacy/en/02-retention-and-access-summary.md` is updated in slice 1 to list
  `ha_state_history`, `device_activity`, elevators, generator, temperature and the new presence retention (the summary
  lists none of them today).

## 8. Default OFF and settings

| Setting | Default | Range |
|---|---|---|
| `history.timescrub` (module flag) | `false` | - |
| `history.presence_retention_days` | 7 | 1..30 |
| `history.range_max_days` | 7 | 1..30 |
| `history.ha_secondary` (existing: HA recorder as a secondary source) | `false` | - |

With the flag off: the historical map is unchanged, the new routes answer 404 (`feature_off`), no new prune runs except
the presence retention (owner question 2 asks whether the shorter presence retention should apply even while the feature
is off - recommendation: yes, it is a privacy default, not a feature).

## 9. Slices

| Slice | Content | Estimate |
|---|---|---|
| **1. Snapshot at T for the existing history layers** | `history/snapshot` route (or `?layers=1`), per-layer status / retention / permission filtering, gap table (4.3), the legend panel on the historical map, `roomStates` passed to the 2D canvas and the 3D replay from `state_at`, infra temperature and elevator state chips at T, alarm panel state, "play all cameras from here", the five screen states, settings + flag, privacy summary | 3-4 days |
| 2. Range playback | `history/range`, downsampling, the playback bar (play / pause / speed), the per-layer density strip and gap hatching on the sw-timeline, 7-day cap | 3 days |
| 3. Presence layer | `history.presence` permission, presence retention prune, legend toggle off by default, audit row | 1 day (after 1) |
| 4. What is not recorded today | elevator cab position column (`infra_elevator_states.floor`, from the HA entity the elevator is bound to, when one exists), climate `current_temperature` and light brightness as watched attributes (extend CR-032's `device_activity` watch list or a small `ha_attr_history`) | 2 days, each its own owner approval |
| 5. Anchor move versioning | `map_anchors` rows become effective-dated on a move (new row + `effective_to` on the old) so a moved device is drawn where it was | 1-2 days, optional |

Slice 1 is the only one this CR asks to schedule. 2 and 3 follow once the owner sees slice 1 on his floor.

## 10. Tests plan

10.1 Unit (backend): snapshot composition per layer (ok / empty / not_recorded / gap / not_permitted); `state_at` forward
fill boundary (24 h) unchanged; presence prune shortens only motion / occupancy / presence rows; gap table written on a
simulated reconnect > 60 s; range downsampling (below and above `MAX_POINTS`, bucket count cap, "changed during" flag);
413 above the scanned-row cap; feature flag off -> 404.

10.2 API / RBAC: a viewer with `map.read` + `video.playback` only gets cameras and plan, every other layer
`not_permitted` with no entity ids in the body; `history.presence` alone does not reveal other layers; the audit row is
written once per (user, floor, day).

10.3 Performance (runner, fixture DB): 300 entities x 30 days of synthetic `ha_state_history` (about 2 M rows): snapshot
p95, range for 1 h / 6 h / day / 7 days, with the numbers recorded in the task card. Not asserted in CI, reported.

10.4 Frontend (Playwright, built-in demo + fixture API): legend toggles change the canvas; the presence layer is off by
default; locked layer draws nothing; the five states (no history, loading, error, layer not permitted, gap); cursor
during a gap hatches the band and the panel says "פער בהקלטה"; playback speed changes; "play all cameras" lands on the
sync screen with the floor's cameras and `t`; keyboard: space = play / pause, arrows = step; `prefers-reduced-motion`
stops the playback animation of tints (states still change). Layout (section 3.1): at 1366x768, 1024x768, 375x812 and 375x667,
after a wheel scroll the document `scrollTop` is 0, `scrollHeight <= innerHeight`, and the timeline bar's bounding box is inside
the viewport (above the phone bottom bar) in every state and both schemes; the phone details sheet scrolls internally only.

10.5 Visual evidence: desktop / tablet / phone x light / dark, RTL; video and map geometry never mirrored.

## 11. Rollback

Flag off restores today's screen. The gap table and the presence retention setting are additive; dropping the table and
the setting rows is the migration's down path. No data is rewritten.

## 12. Owner questions (recommendation first)

1. Presence history retention - recommendation (a) 7 days default, 1..30 range, separate permission; (b) 30 days like the
   other states with the separate permission only; (c) do not replay presence at all.
2. Should the shorter presence retention apply even while the time scrub is off - recommendation (a) yes (privacy
   default); (b) only when the feature is on.
3. A layer the viewer may not see - recommendation (a) listed in the legend as locked, no data; (b) hidden entirely.
4. Elevator cab position (not recorded today) - recommendation (a) record it in slice 4 from the bound HA entity when the
   elevator has one, 8 days like the state; (b) leave elevators as state-only.
5. Climate current temperature and light brightness in the past (attributes, not recorded today) - recommendation (a) add
   them to CR-032's watched attributes in slice 4 (90 days, four device cards); (b) temperature sensors only.
6. Range playback maximum - recommendation (a) 7 days per request, day / 6 h / 1 h / 10 min windows; (b) 30 days.
7. Anchor moves - recommendation (a) keep "drawn at the current position" with a note in the panel, slice 5 later;
   (b) version anchors now (slice 5 inside slice 1).
8. Placement - recommendation (a) grow the existing historical map (same URL, same tab "מפה היסטורית"); (b) a new tab
   "ציר הזמן" in the investigation area.

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 4). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup v2 approved with these answers:

- **Locked layer (this document's Q3):** a layer the viewer may not see is shown in the legend as **locked** (no data). Not hidden.
- **Placement (this document's Q8):** the time scrub lives **inside the existing historical map** (same URL, same tab "מפה היסטורית"). No new tab.
- **Unknown / gap (form Q7):** the markings "unknown" and "gap in the recording" are **clear as drawn** (the owner answered yes, no explanation needed): a moment with no recorded data is shown explicitly as unknown / a gap, never as "off" or as the last value.

## Slice 1 build notes (pilot/TIMESCRUB101B-295, from release/2140)

Built (default OFF behind `history.timescrub`):
- `GET /api/v1/floors/{id}/history/snapshot?at=` and `GET /api/v1/floors/{id}/history/range?from&to&layers&step` (routers/anchors.py,
  services/timescrub.py). Both 404 `feature_off` with the flag off. Layer classification mirrors `map/room-state.ts`; each entity is in
  exactly one layer. Permissions per layer as section 6 (elevators: `devices.read` at installation scope). A locked layer returns no
  entity ids. The range also carries the elevator layer.
- `history.presence` (new, sensitive; site_admin + system_admin), the audit row `history.presence.view` once per (user, floor, UTC day).
  With the flag on, `GET /floors/{id}/map?at=` withholds the presence past from a caller without `history.presence` too.
- Gap table `ha_state_history_gaps`, migration **0160** (built as provisional 0152; renumbered at the 2.16.0 integration, release/2160), written by the HA sync's connect note (`ha_history.note_connect_gap`)
  when the last state the mirror saw is older than 60 s. Rule applied in both routes: a state is unknown when T is inside a gap OR a gap
  lies between its last change and T (stricter than 4.3's "T inside a gap"; it matches section 1's "never interpolates across a gap").
- Settings `history.timescrub`, `history.range_max_days` (7, 1..30), `history.presence_retention_days` (7, 1..30).
- Frontend: the time scrub inside the historical map (same URL, same tab), timeline pinned, no page scroll, legend with locked layers,
  snapshot + playback (one range request per window), gap bar and gap bands, unknown never drawn as off.

Deviations / recorded contradictions (not silently resolved):
1. Section 5 says "hard cap 25 000 rows scanned -> 413" and also "7 days x 300 entities fits the row cap when bucketed". Both cannot
   hold; the build buckets in SQL (one indexed GROUP BY pass) and uses `ROW_SCAN_CAP = 500 000` native rows before the 413. To be
   measured in 10.3 (NOT_RUN) and set from the numbers.
2. Owner question 2 (presence retention while the scrub is off) is not answered in the review of 24.10; the build applies the shorter
   presence retention ONLY while the flag is on (a deletion cannot be undone). Switch to "always" on the owner's word.
3. A bucketed point's `t` is the bucket's start; `n` = changes inside it.

Not in slice 1 yet (remaining): infra temperature probes and generator chips at T; the 60 s server cache; the sync playback screen does not read `t` / camera
parameters, so "all cameras of the floor from here" opens the playback screen with up to four cameras; the tablet "..." overflow menu;
lanes for devices / temperature; `?from&to` in the URL; the performance run of 10.3; access-event marks; the gap row relies on the
mirror's last `state_seen_at` (an installation silent for more than 60 s while connected would show a false gap - a sync heartbeat is
the follow-up).
