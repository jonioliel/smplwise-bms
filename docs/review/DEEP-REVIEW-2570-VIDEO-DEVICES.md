# DEEP-REVIEW-2570-VIDEO-DEVICES - second deep review pass, area 4 (id prefix `VD2`)

Reviewed source: `v2.56.0` = `6ea807b2e` (read-only detached worktree). Scope: the "Not covered" list of
`docs/review/DEEP-REVIEW-2560-VIDEO-DEVICES.md` (branch `origin/review/DEEP-2560-VIDEO-DEVICES`). The findings of that review
(VD-01..VD-04) are not repeated; where this pass found one of them only partly fixed it says so in section 4.
Method: reading every authorization / physical-action / time-zone path end to end, confirmation probes on the runner (one
throw-away test file, not committed, section 3), and the area's existing backend and frontend unit tests on the runner.

## 1. Summary

| Id | Severity | Status | Title | file:line (at `6ea807b2e`) |
|---|---|---|---|---|
| VD2-01 | high | CONFIRMED | A scene whose configuration Arx cannot read (a YAML scene, a scene without id, any scene while the config API is down) is applied with no unlock / disarm grant check and no confirmation, although its members include a lock or an alarm panel | `services/automation_view.py:59-67`; `services/automation_scope.py:497-505,556-563`; `services/automation_ops.py:1127-1158` |
| VD2-02 | medium | CONFIRMED (probe) | "Detect by pressing" (wall buttons) holds the request's SQLite write transaction for the whole listen (30 s by default, up to 130 s): every other write of the add-on fails with "database is locked" meanwhile | `routers/automation_ext.py:172-185`; `services/automation_ext.py:638-651` |
| VD2-03 | medium | CONFIRMED | Automation run / script run / scene apply: a run whose answer was lost or that Home Assistant started and then failed is audited `denied`; the run gap is released on every error, including the time-out ("may have run"), so an immediate re-press runs it again | `services/automation_ops.py:150-157,265-293,314-324,1004-1018,1082-1096,1145-1155` |
| VD2-04 | medium | CONFIRMED | Recording search: a file that spans the autumn DST fold is dropped (its end maps before its start) and the answer still says `coverage: complete`; the repeated hour itself is folded onto the first one | `services/timeutil.py:107-117`; `services/recordings.py:149-156` |
| VD2-05 | medium | CONFIRMED (reading) | Scene / script quick launchers: the home launcher says "not activated" for a time-out that may have run it, the area quick sheet swallows every outcome silently, and neither (nor the scenes panel) can ever send the confirmation a sensitive scene needs | `frontend/src/screens/home-widgets-bv1.ts:552-566`; `screens/area-quick-sheet.ts:582-592`; `screens/scenes-panel.ts:275-290`; `api/launcher.ts:96-97` |
| VD2-06 | low | CONFIRMED | Recording search reports `complete` when the recorder still says `MORE` but repeats a page | `services/recordings.py:103-113` |
| VD2-07 | low | CONFIRMED | `GET /cameras/{id}/recordings?date=2026-02-30` is a 500 (the pattern passes, `date.fromisoformat` raises) | `routers/recordings.py:46-47` |
| VD2-08 | low | PLAUSIBLE | A recording-schedule action that crosses midnight (not ending at 00:00) is read as a reversed range; the week then cannot be saved (422) until the operator deletes that night | `services/nvr_schedule.py:96-114` |
| VD2-09 | low | CONFIRMED (reading) | Smart rules: a PUT with both `line` and `field` that fails on the second document answers an error although the first one was applied | `routers/nvr_write.py:611-635` |
| VD2-10 | low | CONFIRMED (reading) | Saved views: editing a shared view drops the cameras the editor may not watch (for every user); an owner who lost `rbac.assign` keeps editing a shared view | `routers/views.py:54-62,121-132`; `frontend/src/screens/live-views.ts:74,97` |
| VD2-11 | low | CONFIRMED (reading) | Frigate review list: a mark across two recorders that half fails reverts all rows (the done half shows "not reviewed"), and the revert overwrites a list that was reloaded meanwhile | `frontend/src/screens/investigate-reviews.ts:264-280`; `api/frigate.ts:558-562` |

Counts: critical 0, high 1, medium 4, low 6.

## 2. Findings

### VD2-01 (high) - scenes without a readable configuration skip the unlock / disarm grants and the confirmation

- Code path. `automation_view.analyse_row` (`automation_view.py:59-67`): when `row.cfg is None` the facts are built from the scene
  entity's state attributes: `targets = attributes.entity_id`, `steps = []`, `sensitive = False`, `unknown_effects = False`.
  `cfg` is None for every native scene the config API does not return: a YAML-managed scene (`automations.py:346-347`; `_ws_config`
  reads only automations and scripts, `automations.py:131`), a scene without an id (`no_config_id`), and any scene whose first read
  failed (`config_api_unavailable`, `automations.py:352-353`).
- `apply_scene` (`automation_ops.py:1127-1158`) then asks `scope.run_reasons(ctx, "scene", facts, source="yaml")`
  (`automation_scope.py:556-563`): `control_reasons(targets)` - which SKIPS alarm panels on purpose ("a panel is armed / disarmed
  under its own grants", line 501-502) - and `grant_reasons(facts["steps"])`, which iterates the steps only. With `steps = []` no
  `door.unlock` and no `alarm.disarm` / `alarm.arm` grant is ever asked. The confirmation test is
  `facts["sensitive"] or facts["unknown_effects"]`, both False, so no `confirm` either. `scope.visible` (line 445) shows the scene to
  anyone who controls all its targets. The bridge re-checks only the HA user's right on the scene entity
  (`custom_components/smplwise_bridge/config_service.py:187-206`), so Arx is the only authority here.
- Failure scenario. The installer keeps a scene in `scenes.yaml` / a package: "arrival" = `lock.front: unlocked`, `light.hall: on`.
  A resident holds `ha.entity.control` on the lock and the light but deliberately NOT `door.unlock` (manual unlock is refused to
  him). He opens the scenes list, presses "arrival": 202, the door unlocks, no confirmation was asked. Same with an alarm panel member:
  `control_reasons` ignores the panel, so a person with no `alarm.disarm` grant disarms through the scene as long as he controls the
  other members. The capture route builds lock steps for exactly this reason (`routers/automations.py:383`); the apply path of an
  unreadable scene does not.
- Probe (section 3, `test_probe_yaml_scene_with_a_lock_applies_without_confirmation`): a YAML scene with `lock.front` is cached with
  `source = yaml`, `config_json = NULL`, and `POST .../scene/{id}/apply` without `confirm` reaches the bridge. The missing grant check
  is confirmed by reading (`grant_reasons` has no step to judge).
- Fix. When `cfg is None` and the kind is a native scene, synthesize the steps from the state attributes as the capture route does
  (`lock.*` -> a `lock.unlock` step with `sens: lock`; `alarm_control_panel.*` -> an `alarm_disarm` step with `sens: alarm`; the
  other sensitive classes of `pol.SENSITIVE_*`), and mark `sensitive` / `sensitive_classes` from them; when the member list itself
  is missing (no `entity_id` attribute) set `unknown_effects = True` so the scene needs a wide right and a confirmation. Add a test
  with a YAML scene holding a lock and a non-granted caller (403 `grant_required`) and one with an admin (409 `confirmation_required`).

### VD2-02 (medium) - "detect by pressing" holds the write lock for the whole listen

- Code. `POST /automations-ext/wall-buttons/{device_id}/detect` takes `conn = Depends(get_conn)` - the request's write connection,
  `BEGIN IMMEDIATE` (`auth.py:145-163`) - and calls `ext.detect_press` with no `unlocked(conn)`. `detect_press` blocks in
  `_LISTENER.listen(triggers, timeout)` for up to `automations.wall_listen_s` (default 30, max 120) plus 10 s
  (`automation_ext.py:557-594,638-651`). The device trigger list read before it (`_list_triggers`, a WebSocket call) is also under the
  lock. `BUSY_TIMEOUT_S` is 10 s (`db.py:53`).
- Failure scenario. An administrator opens a wall-switch trigger and presses "detect by pressing", then walks to the switch. For the
  next 30 s every other write request of the add-on - an alarm disarm, a door command's audit row, a camera write, a login touch -
  waits 10 s for the write lock and fails with "database is locked". The "one listen per caller" guard is a 1-second spacing
  (`automation_ext.py:642`), so a second tab or a double click starts a second 30 s hold right after.
- Probe (section 3, `test_probe_detect_press_holds_the_write_lock`): inside the listen a second SQLite connection cannot take
  `BEGIN IMMEDIATE`.
- Fix. Run the listen (and `_list_triggers`) inside `with unlocked(conn):` as every other network-bound route does, and make the
  guard real ("one listen per caller at a time": a set of active users, released in `finally`, 409 `listen_running`).

### VD2-03 (medium) - runs and scene applies: lost or partial outcome audited "denied", run gap released after "may have run"

- Code. `bridge_call` (`automation_ops.py:265-293`) records a 504 `config_timeout` as `unknown` but any other transport error as
  `failed`, and so is every `ok: false` answer. The bridge answers `ok: false` with the exception's class name when the service call
  raised after it started (`config_service.py:216-220`): `scene.turn_on` is called `blocking=True`, so a scene whose third member
  timed out has already changed the first two; `automation.trigger` raises the same way inside `TRIGGER_WAIT_S`. A dropped
  connection after the POST left (`httpx.RemoteProtocolError`, `ReadError`) is mapped to 503 `ha_unavailable` (`ha_client.py:261-266`)
  -> `failed`. The `audited` context (`automation_ops.py:150-157`) writes `decision = denied` for every one of them, the 504 included.
  A replay of the same `client_request_id` after a `failed` op answers 409 "the previous request failed; send a new request"
  (line 322). `run_automation`, `run_script` and `apply_scene` call `gap_release(key)` on every `ApiError` (lines 1016-1018,
  1094-1096, 1153-1155), so the per-item run gap (`run_interval_s`, `scene_apply_interval_s`) does not protect the one case it exists
  for: the operator presses again after "may have run".
- Failure scenario. "Open gate + lights" script, Wi-Fi to the HA host drops after the POST: the screen says the system did not answer,
  maybe applied; the operator presses again at once - the gap was released, the script runs twice (the gate gets two pulses).
  The audit trail shows the first run as `denied` / `config_timeout`, so "who opened the gate" finds no allowed run.
- Probe (section 3, `test_probe_run_timeout_releases_gap_and_audits_denied`): after a 504 the op is `unknown`, the audit row is
  `denied`, and a second run with a new request id goes out at once (202, two bridge calls).
- Fix. Keep the gap when the outcome is unknown (504, a transport error that is not a connect error, a bridge `ok: false` whose error
  is an exception class and not a policy refusal). Record those as `unknown` and audit `allowed` with `details.outcome = "unknown"`
  (the FIX-NVR-PULSE-2560 shape: `NOT_SENT_TRANSPORT_ERRORS`). Map the bridge's policy refusals (`not_found`, `unauthorized`,
  `service_unavailable`, `op_not_allowed`, `invalid_*`) to `failed` as now.

### VD2-04 (medium) - recording search across the autumn DST fold

- Code. `nvr_wall_to_utc` maps every device wall-clock string with `fold=0` (the first occurrence) (`timeutil.py:107-117`).
  `_search_uncached` drops any match with `e_utc <= s_utc` as "malformed" (`recordings.py:154`) and keeps `coverage` as the page
  loop set it.
- Failure scenario. Israel, 2026-10-25, 02:00 IDT -> 01:00 IST. A motion file from 01:40 (first hour, 22:40Z) to 01:20 (second hour,
  23:20Z) maps to 22:40Z -> 22:20Z and is dropped: 40 minutes of recorded motion vanish from the timeline of that night while the
  answer says `complete` (AGENTS.md: partial coverage is not empty coverage). Files wholly inside the repeated hour are drawn on the
  first hour (overlapping it) and the second hour shows no recording; a playback asked for 23:30Z is sent as wall 01:30
  (`compact_wall`) and the recorder plays 22:30Z - an hour off, without a word. The history map's minute model
  (`investigate-history-map.ts`, `instantInZone`) cannot address the repeated hour at all.
- Probe (section 3, `test_probe_file_across_the_autumn_fold_is_dropped`).
- Fix. When the end maps before the start, retry the end with `fold=1`; when any match falls in an ambiguous local hour, set
  `coverage = "partial"` and a note ("the hour repeated by the clock change is ambiguous on this recorder"), and show that note on the
  playback and history screens. A playback request inside the repeated hour should say which occurrence it can reach.

### VD2-05 (medium) - quick scene / script launchers: misleading or missing outcome, no confirmation path

- Home launcher (`home-widgets-bv1.ts:552-566`, `api/launcher.ts:96-97`): any error becomes "לא הופעל: <reason>". For a 504
  `config_timeout` the reason itself says the change may have been saved, so the line reads "not activated: ... may have been saved";
  for a scene that may have run, "not activated" is wrong. A sensitive scene / script (409 `confirmation_required`) can never be
  confirmed from here: the launcher shows "not activated: this action needs explicit confirmation" with nothing to confirm.
- Area quick sheet (`area-quick-sheet.ts:582-592`): `runScene` swallows every error ("the automations screen reports" - it does not,
  nothing is shown); a refused, failed or unknown scene looks exactly like a scene that ran.
- Scenes panel (`scenes-panel.ts:275-290`): `activateScene(i.id)` without `confirm`, no confirmation dialog (the scripts panel has
  one, `scripts-panel.ts:192-206`); the same in `onSave` (`scenes-panel.ts:358-375`): a scene with a lock can be neither applied nor
  saved from the scenes panel. Fails closed, but the operator gets a refusal he cannot act on.
- Fix. One shared "run scene / script" helper used by the four entry points: the confirmation dialog on `confirmation_required`
  (resend with the same body + `confirm: true`), the amber "unknown - check on site" outcome for 504 / `maybe_saved`
  (`api/physical-outcome.ts`), a visible error on the area quick sheet.

### VD2-06 (low) - a repeated page is reported as complete

- `list_matches` stops when a page brings no new match (`new == 0`, `recordings.py:110`) and leaves `coverage = "complete"` although
  the recorder still said `MORE`. A recorder that ignores `searchResultPosition` (or a search id that expired) makes the screen show
  only the first page as the full day. Probe: `test_probe_duplicate_page_is_reported_complete`.
- Fix: `coverage = "partial"` with a note when the loop stops on `new == 0` while `page.status == "MORE"`.

### VD2-07 (low) - an impossible date is a 500

- `date` passes `^\d{4}-\d{2}-\d{2}$`, `dt.date.fromisoformat("2026-02-30")` raises `ValueError`, the generic handler answers 500
  (`routers/recordings.py:46-47`). Probe: `test_probe_impossible_date`. Fix: catch `ValueError` -> 422 `validation` (`fields: ["date"]`).

### VD2-08 (low, PLAUSIBLE) - a recording schedule action that crosses midnight

- `record_from_track` turns an action ending on the next day only when it ends at `00:00:00` (`nvr_schedule.py:108`). A track written
  by the recorder's own screens or another tool as Monday 22:00 -> Tuesday 06:00 is read as Monday `{begin 22:00, end 06:00}`.
  `check_week` refuses that day as reversed (422) on the next save of ANY day, so the editor cannot save until the operator removes
  the night range - after which that night is not recorded. Not seen on the lab recorder (its own UI writes whole days); the unit
  tests only use whole days. Fix: split such an action into `[22:00, 24:00)` on its start day and `[00:00, 06:00)` on its end day
  when reading.

### VD2-09 (low) - smart rules: partial write answered as an error

- `set_smart` writes `line` then `field` (`routers/nvr_write.py:631-633`). When the second `apply_change` raises, the first one is
  applied and recorded in the change log, but the route answers the error only; the screen shows "failed" while the line rule
  changed on the recorder. Fix: catch per document and answer `{line: {...}, field: {error}}` with 207-style per-document outcomes, or
  stop before the second write and say which one was applied.

### VD2-10 (low) - saved views: hidden cameras dropped on edit

- `list_views` sends each viewer only the cameras he may watch (`_view_dict`, `views.py:54-62`); the editor starts from that list
  (`live-views.ts:74`) and saves it whole (`live-views.ts:97`, `views.py:128`). A system administrator (`system.configure`) without
  `video.live` on some cameras who renames a shared view removes those cameras from it for everybody. Also `update_view` checks
  `rbac.assign` only when a view BECOMES shared (`views.py:126`): the owner of a shared view keeps editing what every user sees after
  losing the right. Fix: merge the hidden cameras back on the server (keep the ids the caller cannot see), and require
  `_can_manage_shared` for any edit of a shared view.

### VD2-11 (low) - Frigate review marks: all-or-nothing revert over a half-done write

- `markReviewed` posts one request per recorder with `Promise.all` (`api/frigate.ts:558-562`); when recorder B fails, `mark`
  (`investigate-reviews.ts:264-280`) restores `before` for every row, also those recorder A has marked, and `before` may be older than
  a list reloaded meanwhile (no `Latest` guard). Fix: `Promise.allSettled`, revert only the failed recorder's rows, and drop the revert
  when the list changed since.

## 3. Tests run (real results)

All on the runner (slot B, `~/work/slotb.sh`), worktree of `6ea807b2e`, 28.11.

| Run | What | Result |
|---|---|---|
| Confirmation probes | one throw-away file `tests/test_p2570r_vd_confirm.py` (not committed); each test asserts the CURRENT behaviour named by a finding | **6 passed** in 8 s: detect -> a second writer gets "database is locked" (VD2-02); run after 504 -> op `unknown`, audit `denied` / `config_timeout`, second run 202 with 2 bridge calls (VD2-03); fold -> 1 match, 0 segments, `complete` (VD2-04); repeated page -> `complete`, 2 pages (VD2-06); `date=2026-02-30` -> server `ValueError` (VD2-07); YAML scene with `lock.front` -> `source yaml`, config NULL, `sensitive false`, apply 202 without `confirm`, 1 `apply_scene` sent (VD2-01) |
| Backend unit / API | 115 files matching `automation|kav079|discovery|recording|search|nvr|scene|camera|playback|cast|go2rtc|lease|snapshot|stream|history|wall|ptz|osd|motion` (minus wiskey / intercom / media / frigate / review / incident), one pytest process per file, `SW_WIRE_STRICT=1` | **115 / 115 files exit 0: 13,700 passed, 4 skipped** (`test_lease_wire_closed_295.py`), 0 failed |
| Backend media files | `test_media_*` (10 files) were run at the same commit by the WISKEY-ACCESS second pass (`~/work/p2570r_wa_be/summary.txt`) | all exit 0 there; not re-run here |
| Frontend unit | 70 node-only `unit-*.spec.ts` of the area (automation, media, scene, investigate, live, history, nvr, camera, playback, record, incident, review, discovery, wall, kiosk, player, queue, group), `playwright.unit.config.ts`, 2 workers | **850 passed** (15.2 s), 0 failed |
| Page specs / pixel / evidence | browser suites of the screens | NOT_RUN (out of scope of this pass) |

Assertion strength (sampled): `test_nvr_schedule.py`, `test_nvr_system.py`, `test_recordings.py`, `test_automations_writes.py`
(runtime section), `test_kav079_api.py`, `unit-scene-memo.spec.ts`, `unit-recorded-month.spec.ts` assert concrete values (documents,
statuses, codes, UTC instants, call counts) - no assertion that cannot fail was found in the sample. Coverage gaps that match the
findings: no test applies a YAML / unreadable scene with a sensitive member (VD2-01: the existing apply tests use integration and
readable native scenes, `test_automations_writes.py:405-413`); the detect test uses a listener that returns at once, so the write
lock is never observed (VD2-02); no run test checks the gap or the audit after a 504 (VD2-03); no recording test crosses a DST fold
(VD2-04; `test_time_adapter_israel_dst` covers single instants only); the schedule tests use whole days only (VD2-08).

## 4. Checked and fine (and old findings re-read)

- V-04 (VIDEO-SECFIX-2520) re-read: `_require_change_cameras` / `_change_visible` / `_rollback_gate` (`routers/nvr_write.py:661-765`)
  and `nvr_write.change_cameras` (`services/nvr_write.py:177-204`): camera-level rows need the permission on every camera, unknown
  camera fails closed, recorder-level kinds (`time`, `reboot`, `alarm_output`, `storage_test`) have no camera scope. FIXED.
- SCR-02 / SCR-24 (`screens/playback-day.ts`, `investigate-playback.ts:181-189,775-828`): the date follows the playing position in
  the installation zone; camera and day picks use `Latest`, the recordings read uses `recReads`. FIXED. Residual (not a finding):
  A -> B -> A ends the A session while B waited and then returns early on "same camera", so the player stops until play is pressed.
- SCR-26 (`screens/wall-refresh.ts`, `live-wall.ts:811-893`, `kiosk-wall.ts:577-690`): 60 s re-read through the shared poller,
  merge by id, system tile from the health summary. FIXED. Not traced: whether a camera object that changed only in `last_seen_at`
  restarts its tile's player.
- SCR-55 (`investigate-events-logic.ts:166-178`, `investigate-events.ts:1084-1110`): zone day edges via `instantInZone`, 500-row
  limit named. FIXED.
- SCR-27: markers present (`i18n/bidi.ts`, `live-camera.ts`); sampled only.
- VD-02 / VD-04 (2.56): `nvr_system.pulse_output` now has `confirm` + `client_request_id` (120 s dedupe under a lock) and the
  sent / not-sent / unknown mapping (`nvr_system.py:277-366`). PARTIAL for VD-02: the same "lost answer = failed + denied" mapping
  remains for the NVR reboot (`nvr_system.py:422-440` - the case where the device most often drops the link while it restarts),
  the S.M.A.R.T. test (`399-419`), the camera reboot (`camera_reboot.py:107-125`, `finish` 178-193) and `apply_change`
  (`nvr_write.py:226-231`); VD-02's own fix text named them as follow-ups.
- `nvr_system` clock: `device_instant` / `time_document` / `sync_clock` (`nvr_system.py:62-170`) use the IANA zone per instant,
  honour quirk T1 (standard-offset tag in summer), verify the result (`CLOCK_VERIFY_S`) and report a write that left the device off.
  No fixed offset in the time paths (`grep` for `timedelta(hours=2|3)`, `+02:00`, `+03:00`, `7200`, `10800` in recordings,
  timeutil, nvr_system, nvr_schedule, recorded_days, playback and their routers, and for `getTimezoneOffset` / fixed hour
  multiples in the playback, history-map and events screens: only a docstring example).
- `nvr_schedule` writes go through `apply_change` (GET -> mutate -> PUT -> verify, recorded, reversible); the writes switch guard
  (`_guard`) and the camera scope (`_track_of`) come first; a malformed smart spec raises before anything is sent (500, not recorded:
  no device effect).
- `recordings.py`: one search at a time (`_search_lock`, quirk S2), page cap reported `partial`, cache keyed with the zone, never
  under the write lock. `local_day_bounds` handles 23 / 25-hour days.
- `media_groups.py`: join / leave / volume / preset are plans only; media.group + media.control at every involved anchor, party and
  whole-building confirmation / `media.bulk`, ceilings applied, relative volume never raises on a drag down. `media_queue.edit`:
  locked rows, `confirmed` for clears, the network phase under `unlocked`, idempotent by `client_request_id`, no retry.
- Camera discovery (`services/camera_discovery/*`): RFC 1918 site network from the Supervisor only, /22 cap, `follow_redirects=False`,
  every service and stream address pinned to the address that answered (`same_host_xaddrs`, `_same_address`), WS-Security
  PasswordDigest built on the device clock, one attempt per camera per press, credentials only in the scan job, wiped on cancel /
  expiry, the device calls under `unlocked`.
- Automations runtime authority (`automation_ops.py:946-1158`, `automation_scope.run_reasons`): per-target manage / run rights,
  control, sensitive grants for readable items, door items through the door authority with step-up (`_door_plan`), confirmation for
  risky items, idempotency by `(user, client_request_id)`, one signed bridge call never retried. The run frontends with a
  confirmation path (automation drawer, editor, scripts panel) resend with `confirm: true`. `capture_scene` checks read, control,
  lock grants and `scene.manage` per captured member.
- `automation_ext` device test: the server only plans; every step and restore goes through the ordinary device-control route.
- `live-overview.ts` (sampled): 60 s shared poll, each read settled on its own. Residual (not a finding): after a first good read a
  later failed refresh keeps the old health / camera figures without a "stale" mark.
- `screens/investigate-history-map.ts`: every time conversion goes through `minuteInZone` / `instantInZone` / `dateInZone` with the
  installation zone (DST handled except the repeated hour, VD2-04). `investigate-incidents.ts` actions (ack / close / note) are single
  server calls with a busy guard.

## 5. Still not covered (honest)

- `api/automations.ts` (172 KB) was read only around the run / apply / error-mapping entry points; the 19 `automation_*` services were
  read for the runtime (run / apply / enable / capture / ext detect / device test) paths; the authoring paths (`automation_model`,
  `automation_policy` judge, `automation_blueprints`, `automation_draft`, `automation_text*`) were not re-read.
- `media_commands.py` (56 KB) beyond the envelope (VD-03) and `media_query`, `ma_direct`: not read.
- `live-overview.ts`, `scene-editor.ts`, `investigate-reviews.ts` beyond the mark / export paths, SCR-27 (bidi rendering): sampled
  only, no browser run.
- The Provision recorder search (`recorders/vendor_io`, `provision_playback`): not read (its own DST handling).
- Lab-only questions: how the lab recorder names files across the autumn fold (VD2-04) and whether it ever writes a cross-midnight
  schedule action (VD2-08) - not checked (no device access in this pass).
