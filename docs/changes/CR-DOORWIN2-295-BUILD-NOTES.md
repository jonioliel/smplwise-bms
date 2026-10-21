# CR-DOORWIN2-295 - the second DOORWIN build: design delta on CR-039 (event windows, holiday list, single-permission roles, foreign program, announce, home widget, Fable review 2)

Status: BUILT ON FAKES, SHIPPED OFF (branch `pilot/DOORWIN2-295` from `origin/integ/2102` @ `9a8adbaf8`). Design authority: `CR-039-DOOR-WINDOWS-AND-EMERGENCY.md`
and `CR-DOORWIN-295-BUILD-NOTES.md` (the first build). This note records only the DELTA: what this branch adds, every deviation from CR-039, and what stays
blocked. Nothing here touched a WisKey, a station, a door, a bridge, Home Assistant or a person. `door_windows_engine.GO_LIVE_PERMITTED` is still `False`; no
switch default changed (`doors.windows.enabled`, `doors.emergency.*`, `doors.automation_actor`, `doors.windows.event_extend_owned`, `doors.emergency.home_widget`
ship off; `doors.emergency.announce_phrase` ships empty). Activation is ECCACT-295's job.

**Migration number: PROVISIONAL 0138** (`0138_door_windows_events.sql`, after `0137_door_windows_emergency` on integ/2102). The lead renumbers at integration;
the content does not depend on the number. It rebuilds `door_window_occurrences` (wider `origin` CHECK, new `trigger_ref`) with the same rows, and adds
`door_window_triggers`, `door_window_trigger_log`, `door_window_exclusions` and two columns on `door_window_engine`.

## 1. What was built, per feature

| Feature (CR-039 section) | Where | Notes |
|---|---|---|
| Event-triggered windows, slice W4 (9) | `services/door_window_triggers.py`, `routers/door_windows.py`, `ha_sync.py` (one allow-listed event type), `automations.py` (one hook) | three sources: `arx_button` (a person's confirmed click, `POST /doors/windows/doors/{station}/{relay}/open-for`, needs `access.windows.manage`), `ha_event` (custom event `smplwise_arx_door_window {rule_id, token}`), `arx_automation` (an HA automation entity named in the trigger, matched with the live revision the approver saw) |
| Simulate vs armed (9.4) | `door_windows.AUTOMATION_ACTOR_PROBE` (False), `doors.automation_actor`, `POST /rules/{id}/arm` | an `ha_event` / `arx_automation` rule is SIMULATED unless a person armed it AND the setting is on AND the contract reports the W1 automation actor (never, in this build). A simulated trigger writes a log row, an audit row and an inbox notice, creates no occurrence. Arming and the setting are refused with 409 `automation_actor_unavailable`. |
| Anti-loop and rate rules (9.2) | `decide_door` | per-door per-day (rule cap and the installation cap over every origin), cooldown, allowed hours, quiet hours, `max_hours`, no window across local midnight, no `closed` day, no exterior door, storm cap of 20 per hour (+ `door.windows.storm` alert), SR-5 / override pause / emergency block, one delivery of one event is one trigger (the context id), a later event touching a waiting event hold extends it once; extending a RUNNING hold needs `doors.windows.event_extend_owned` (the program blinks ~15 s) |
| Forged events (T4) | `fire_rule`, `on_door_window_event` | per-rule token stored as SHA-256 only (shown once at creation and on `POST /rules/{id}/token`), constant-time compare, shape-checked payload, templates never rendered, refusal audits capped at 60 an hour |
| Holiday list (5.4) | `services/special_days.py`, `door_windows.calendar_for`, `GET /doors/windows/calendar` | a thin wrapper over `energy_calendar` (one source of truth; that file is NOT touched - the "extraction" is a wrapper), generator `doors.windows.calendar_generator` = `israel` (default) / `none`; manager overrides (`regular`, `closed`, `holiday`, `holiday_eve`) win; the list shows generated and manual days for 400 days |
| Single-permission roles (7.2) | `roles.json`, `routers/access.py` | `door_windows_manager`, `door_windows_guard`, `emergency_lock`, `emergency_open`: exactly the permission plus `access.read` and `access.stations.read`; only `door_windows_guard` is delegable by default; `emergency_open` stays a per-user grant (system_admin only among built-ins) |
| Foreign program (8.2, 19.3) | `door_windows.pause_door(allow_foreign=True)`, `foreign_paused_list`, `POST .../foreign-handled` | an emergency LOCK pauses a program a person made in the intercom window (audited with the incident). Arx NEVER re-activates it: the door is listed on the emergency state and on the windows state until the program is enabled again (detected by a read) or a person marks it handled. There is no Arx-side "resume": WisKey has none (reactivation is save-and-activate, which would overwrite the person's program). |
| Announce (11) | `services/announce_channel.py`, setting `doors.emergency.announce_phrase` | the `announce` policy channel is off by default for the emergency sources AND nothing is spoken until the owner types his own phrase (owner decision 2026-10-13: OFF until heard in a drill). The phrase is spoken verbatim (a drill says "תרגיל" first), never the title, never filtered by the lock-screen level. |
| Home widget (8.1) | `frontend/src/door-windows/home-widget*.ts`, `i18n/door-windows-widget.ts`, `doors.emergency.home_widget` | widget id `doors` appended last; absent unless the doors tab is on and a door is visible; one line + rows by size; the emergency button only for the holders of an emergency permission when the installation switched the entry on; opens the existing sheet (hold, then confirm). he/en/ar/ru (ar/ru dev-marked), no hint paragraphs, no platform names, no service-request action of any kind (so nothing to gate on the tickets module; a unit test pins it with the module off and on). |

## 2. Fable review 2 (2026-10-21) - fixes folded in

| ID | Fix |
|---|---|
| W-01 | A guard's cancel of a FUTURE occurrence now reaches the engine: it writes an exclusion by window token (`door_window_exclusions`), the compile subtracts it (the engine's program carries an exception with no period for that date), `_store_plan` never re-plans a row whose resolution is `override`, and the route runs the compile at once. Tests: `test_doorwin2_review2.py`. |
| E-01 | A RELEASE never reads the master switch or the permit (`prepare` checks them for a start only); `update_settings` refuses turning the master switch off while a real incident is in effect (409 `incident_active`). Note: on a build whose permit is False the live engine itself refuses every call (`not_permitted`) - a release on such a rollback is a recorded refusal; nothing is sent. |
| E-02 | OPEN over LOCK now writes release-phase rows for the superseded LOCK and sends them to the engine BEFORE the OPEN apply (one attempt; the OPEN goes out whatever the answer: evacuation beats lockdown). The W13-e request should still say that an `open` apply supersedes a `lock_secure` per door. |
| E-03 | A deadline at the seam (`ENGINE_DEADLINE_S` = 8 s per door call, mapped to UNKNOWN `deadline`), and `age_pending` ages a row still `pending` after `PENDING_MAX_S` = 30 s into UNKNOWN so the incident settles and the bounded retry and the partial headline apply. The live engine must also bound its own calls. |
| E-04 | Owner decision 2026-10-21 (option C: "in an emergency we always open"): the bounded E-1 retry of an UNKNOWN OPEN STAYS (3 attempts, 10 s apart). Every attempt carries the SAME per-door `request_id` (tested), so an engine that de-duplicates by `request_id` cannot open a door twice. **WisKey must confirm that idempotency by `request_id` in the W13-e contract**; until it does, the retry exists only against the fakes (the live engine does not support OPEN at all). CR-039 19.5 stays recorded as a deliberate exception. |

Owner decisions of 2026-10-21 applied: operators may BOTH end a window and confirm a relock by eye (`access.windows.cancel`, as built; no restriction to managers);
NO second approver for windows (W-02: self-approval accepted, nothing added).

## 3. Deviations from CR-039 (recorded, not silently resolved)

1. `duration_s`, the allowed hours, the caps and the token of an event rule live in `door_window_triggers`, not in `door_window_rules` (the rules table of 0137 stays untouched). `arx_button` has no rule row (`rule_id` NULL, synthetic id `button`).
2. `origin` of an occurrence is `weekly | once | event`; there is no `manual_extend` origin: an extension edits the event occurrence (end and token) and is recorded as the log decision `extended` (once per occurrence).
3. An event hold starts at the next whole minute at least 20 s away (WisKey's window token has minute resolution and the compile must reach the engine first; a window that starts before it was written is `not_started`, the safe direction) and is a date exception of the door's program appended by the compile - never a hold-until (U3 is unanswered), never an Arx timer (SR-1; a static test pins the trigger module as unable to call an engine).
4. Extending a rule-derived window (weekly / once) by an event is NOT built: such a trigger is refused (`inside_window` / `overlaps_window`).
5. The typed automation step "חלון פתיחה לדלת" in the automation builder, the `door_windows_conversion.py` conversion source and the lift of the door-step editor block are NOT built (they exist only to arm a rule, which needs the W1 automation actor). An `arx_automation` rule matches an HA automation entity directly and runs in simulation.
6. The generated holiday list is the energy calendar's arithmetic via a wrapper (`special_days.py`), not a moved copy.

## 4. What stays BLOCKED (and why)

- **Emergency OPEN**: (a) WisKey's answer to W13 U3 (a hold-until / `emergency_open` command with auto-relock and an idempotent `request_id`) - `open_supported` is False, so `doors.emergency.open_enabled` cannot be switched on; (b) the owner's life-safety attestation (CR-039 8.9) - text prepared in `private/planning/EMERGENCY_ATTESTATION_DRAFT_HE.md`, NOT approved, NOT recorded; (c) the owner's hardware / escape-route review.
- **Emergency LOCK live**, tier B live writes: the WisKey coordinators are NOT_IMPLEMENTED; U2 (signed program writes) unanswered; a lab session with the owner (W9). Fakes only.
- **Armed event rules**: the W1 automation actor. Simulation only.
- **Tier A (station schedules), Lockdown**: U1, U4 unanswered.
- ar / ru strings of the widget and of the earlier door-windows module need a native review.
- Not run: see the report (browser / screenshot specs, the visual matrix, the full suites, `scripts/release_check.py`, a fresh-database migration run 0129..0138 beyond the selected tests).

## 5. Test map (fakes only)

`test_doorwin2_events.py` (rule + token, validation, simulate / armed, forged events, caps, extension, SR-5, authorising actor, open-for, SR-1 static pin),
`test_doorwin2_calendar.py`, `test_doorwin2_roles.py`, `test_doorwin2_foreign.py`, `test_doorwin2_announce.py`, `test_doorwin2_review2.py`; frontend
`unit-door-windows-home-widget.spec.ts`; updated pins: widget order lists (`doors` appended), `test_door_emergency.py` (E-1 with the same request id),
`test_doorwin_api.py`, `test_custom_roles.py`, `test_wiskey_door_path.py` (the four new built-in roles).
