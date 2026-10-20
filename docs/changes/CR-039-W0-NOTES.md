# CR-039 slice W0 - fakes and test harness for door windows and emergency controls

Status: built on `pilot/DOORWIN-w0` (from `origin/main` 19dbbbcc, release 2.4.10, with `origin/pilot/DOORWIN-spec` merged).
Test-support code only: no product module, shared file, setting, role, permission, route or migration was touched. Nothing
here contacts a WisKey, a station, a door, a bridge or Home Assistant.

All files live in `smplwise_vms/backend/tests/` (prefix `fake_doorwin_` / `test_fake_doorwin_`). Every fake runs on one fake
clock and a deterministic scheduler: time moves only when a test advances it, and the same scenario yields the same logs.

## 1. The fakes, their switches, the spec section each models

| File / class | Models (CR-039) | Switches |
|---|---|---|
| `fake_doorwin_clock.py` `FakeDoorwinClock`, `DoorwinScheduler` | 4.5 (zones, no fixed offsets), T2 / SR-1 (restart) | `start`; `skewed(s)` views; jobs carry an `owner` (`wiskey`, `station`, `arx`, `ha`, `test`), `cancel_owner("arx")` = an add-on restart; `every`, `call_at`, `call_later`, `step`, `advance`, `run_until`; a failing job is recorded in `errors`, the run goes on |
| `fake_doorwin_door.py` `FakeDoor`, `FakeDoorBank` | 3.1 (no position sensor, optimistic lock entity), 4.4, U5, 18.2 | per door `power_behaviour` (`fail_secure` / `fail_safe` / `unknown` = worst case open), `hold_survives_reboot` (True / False / None = worst case survives), `open_duration_s`, `exterior`; bank `lock_entity_reflects_hold` (W?, default False). Truth only through `truth_*`; `observable()` gives the lock entity state and `position_sensor: False`, nothing else |
| `fake_doorwin_door.py` `confirmation_verdict`, `relock_verdict` | 4.4 steps 1-5 | oracles: idle and not owned and lock not in `door_path.OPEN_STATES` -> `closed_confirmed`; grace passed without that -> `relock_unconfirmed` (feed loss fails loud); a later engine idle resolves it |
| `fake_doorwin_program.py` `FakeProgramEngine` | 3.1, 4.2 tier B, 4.3, 4.4, 9.3; U2, U6, U7 | `ha_running` / `ha_stop()` / `ha_start()` / `restart_ha()`, `arx_link_up`, `station_link_up[station]`, `close_refused[door]` (count / True), `open_refused[door]`, `close_ack_lost`, `status_unavailable` (code), `errors_once[command]`, `lose_answer[command]` (`before_effect` / `after_effect`), `u2_trusted_writes`, `dedupe_request_ids`, `push_on_status_change`, `ha_clock_skew_s`, `max_programs`, `tick_s`; fixture `add_foreign(...)`; forms: `command(...)`, `respond(msg)`, `as_call()` (the `intercom_client` `Call` shape), `attach(FakeWiskey)` |
| `fake_doorwin_station.py` `FakeStationScheduleEngine` | 4.2 tier A; U1, U5, T15 | `available` (U1), `supported_doors` / `support()` / `unsupport()` (per door), `ha_running`, `arx_link_up` (writes only), `station_clock_skew_s[station]`, `relock_fault`, `errors_once`, `lose_answer`, `tick_s`; idempotent on `request_id` |
| `fake_doorwin_station.py` `FakeHoldUntilEngine` | 9.3, 8.4; U3 (W13-b) | `supported` (U3), `relock_side` (`device` / `wiskey`), `ha_running`, `arx_link_up`, `station_link_up`, `errors_once`, `lose_answer`, `status_unavailable`, `release_refused`; idempotent on `request_id` |
| `fake_doorwin_emergency.py` `FakeEmergencyEngine` | 8.2-8.8, E-1; U3, U4, W13-e | `script[door]` / `release_script[door]` (`ok`, `refused`, `unknown` = applied but answer lost, `unknown_lost` = not applied, `slow`), `attempt_script[door]`, `latency_s`, `latency[door]`, `slow_s`, `timeout_s`, `slots` (the incident lane, 4), `batch_command` (W13-e), `open_supported` (U3), `lockdown_supported` (U4), `reachable`, `dedupe_request_ids`; `for_drill(...)` = every kind offered, no door bank, no transport |
| `fake_doorwin_events.py` `FakeHaEventSource` | 9.1, 9.2, 9.5; T4, T5 | `connected` (False drops: HA never replays), `deliver_twice`, `origin`; `door_window(rule_id, token)`, `automation_triggered(entity_id)`, `fire_at`, `storm(n, every_s)`, forgeries (`forged_wrong_token`, `_unknown_rule`, `_template`, `_extra_keys`, `_types`) |
| `fake_doorwin_asserts.py` | SR-3, SR-4, E-1, 4.4 step 3, T13, 12 | `assert_failed_close_reported`, `assert_no_silent_open`, `assert_unknown_open_not_retried` (E-1: `emergency_open` only, <= 3 attempts, >= 10 s apart), `assert_close_retries_bounded` (30 / 60 / 120 s, <= 3), `assert_no_secrets` / `find_secrets` (explicit values, JWT, Bearer, private keys, phone numbers, credential-bearing keys; messages never echo the secret) |
| `fake_doorwin_world.py` `DoorwinWorld` | 3.2 (the dependency map) | `unknowns={"U1".."U7", "W13e"}` -> the switches below; `ha_down/up()`, `network_loss(station)`, `arx_link(up)`, `arx_restart()`; `classify(code)` (U7) |

The unknowns and their defaults (the worst case Arx must assume until WisKey answers):

| Key | Default | Switch |
|---|---|---|
| U1 station-side schedules | False | `stations_engine.available` (+ `support(door)` per door) |
| U2 generalized trusted writes (request id, actor) | False | `programs.u2_trusted_writes` |
| U3 hold-until | False | `holds.supported`, `emergency.open_supported` |
| U4 lockdown | False | `emergency.lockdown_supported` |
| U5 power / reboot | (`unknown`, None) | every door's `power_behaviour`, `hold_survives_reboot` |
| U6 status push | False | `programs.push_on_status_change` |
| U7 pre-effect codes | empty | `world.pre_effect_codes`; `classify` says `refused` only for those, else `unknown` |
| W13-e emergency batch | False | `emergency.batch_command` |

The static closed-rule test `test_fake_doorwin_closed_rule_sr1.py` (slice table W0) parses `smplwise/` and pins today's
door-opening sites (`alwaysOpen`, `stations/test_unlock`, `door_open`, `doors/hold_until`, `doors/emergency_open`, calls of
`release_door` / `hold_command` / `open_door`), the `lock.unlock` / `lock.open` sites, and the program-write sites (none
today); a timer-shaped module (`*_watch`, `watchdog`, `*scheduler*`, `*_tick`, `*_jobs`, `notify_sources`) may never name an
open primitive or save a program.

## 2. Self-tests (103, all local, all passed on 2026-10-13)

`test_fake_doorwin_program.py` 30, `_station.py` 18, `_door.py` 13 (clock, scheduler, door, oracles), `_emergency.py` 10,
`_events.py` 6, `_asserts.py` 11, `_world.py` 10 (incl. a reference watchdog: clean window, HA down at end, network loss at
end, the optimistic-entity trap, Arx restart, no secrets), `_closed_rule_sr1.py` 5. Run:
`python -m pytest tests/test_fake_doorwin_*.py` from `smplwise_vms/backend` (about 11 s).

## 3. What the product slices must provide to plug in

- **Time** (W1, W3, W4, W5): take a `now` callable (or a clock object with `now()`) instead of reading the real clock; the
  watchdog and any background family expose a `tick()` that a test registers with `world.scheduler.every(30, tick,
  owner="arx")` - so `world.arx_restart()` kills it and the test proves the engine relocks without it.
- **Tier B transport** (W3): the `ProgramEngine` adapter sends through a `Call` (`await call(kind, **fields)` -> frame), so a
  test passes `world.programs.as_call()`; or it goes through the real `intercom_client` socket path with
  `world.programs.attach(FakeWiskey(...))`. Unknown outcomes appear as `FakeOutcomeUnknown` (direct) or as no answer at all
  (attached); transport loss as `FakeTransportDown`.
- **Tier A / U3** (W3, W4): adapters call `create / delete / list / status` and `hold_until / hold_release / hold_status` -
  W? shapes; when WisKey answers W13 the fakes' method names and payloads are renamed to match, the switches stay.
- **Emergency** (W5): the incident service calls `batch(...)` when `batch_command`, else `one(...)` per door, and maps
  `EmergencyRun.doors[*].state` to `door_emergency_doors.state`; the drill route binds `FakeEmergencyEngine.for_drill(...)`.
- **Event triggers** (W4): the handler accepts the HA event frame dict (`{"id", "type": "event", "event": {...}}`), the same
  object `ha_sync`'s socket loop hands to `automations.MIRROR.on_ha_event`; tests subscribe it with
  `world.events.subscribe(...)`.
- **Assertions**: reports are dicts `{door: (station, index) | station + physical_index, state, at, resolution?}` - the
  occurrence state changes the watchdog writes; command logs are the fakes' `device_log` / `requests`, or the product's own
  rows with `at, station, door, command, outcome, key`.
- **SR-1 pin**: W3 / W4 / W5 extend `PINNED` / `ENGINE_WRITES` in the commit that adds a site, with the reason.

## 4. Spec findings: contradictory or untestable on fakes

1. **4.3 "a change outside a window is one save" contradicts 3.1 and R.** rc.37's `hold_programs.update` refuses an edit of
   any **enabled** program (`hold_pause_before_edit`), owned or not. Every edit of a live Arx program is therefore
   pause + save-and-activate, also outside a window (no physical blink there, but two writes and two revisions). The same
   applies to 9.3's date-exception append for event windows: the program is always enabled, so the pause is always needed.
   Pinned by `test_editing_an_enabled_program_needs_a_pause_even_outside_a_window`.
2. **4.4 step 3 calls the retry `pause` idempotent** - true for the door, not for the record: every `technical_program_action`
   bumps `revision` (R), so each retry must re-read the revision first, and a retry with a stale revision is a
   `revision_conflict`, not a no-op. Pinned by `test_pause_is_idempotent_in_effect_but_bumps_the_revision`.
3. **4.3 envelope vs the pinned catalog**: the three program commands are `additionalProperties: false` without
   `client_request_id` / `expires_at` / `confirmed` / `request_id`; the CR-036 envelope can only live in Arx's own route,
   and a request id reaches WisKey only with U2. The fake answers `invalid_format` otherwise.
4. **`device_unavailable`** (named by the extraction as WisKey's mapping of Hikvision errors and by spec 16) is **not** in the
   pinned catalog's `errors.static.json`. The fake uses it for an enabled save without the station; U7 / W5 must confirm the
   real code.
5. **The lock entity veto of 4.4 step 2 is weak**: whether a program hold marks the relay released in WisKey's lock entity is
   unknown (W?); if it does not (the fake's default), the entity says `locked` during every program hold and only the
   engine status can confirm or deny. Tested as a trap in `test_a_watchdog_that_trusts_the_entity_alone_would_be_caught`.
6. **WisKey retries `close` itself** every 15 s while it owns a door whose close failed (R: the executor's first branch). The
   Arx retry of 4.4 step 3 (`pause`) runs on top of that; it is not the only retry.
7. **8.7 "all 30 doors sent within 5 s"** depends on WisKey's per-command latency: with the 4-slot incident lane it holds
   only below about 0.7 s per door (8 rounds of 4) (or with the W13-e batch). The fake measures it; it cannot guarantee it.
8. **4.5 DST**: a spring-forward gap only partly covering a window (e.g. 01:30-02:30 on the change day) is executed partly
   by WisKey (its token compares wall-clock strings), not dropped; Arx's computed occurrence must follow `window_token`,
   not "drop the day". The fall-back case behaves as 4.5 says (one token, one hold).
9. **Untestable on fakes** (stays NOT_RUN by design, slice W9 with the owner): U5 physical behaviour of real relays, real
   WisKey latency and deduplication, the real W13 shapes, whether a station reboot keeps `alwaysOpen`, the lock entity's
   real behaviour during a hold.
10. **Spec 16 asks to extend `fake_wiskey.py` and `fake_trusted_bridge.py`**; W0's scope keeps them untouched (new files
    only). The program commands are served through `FakeProgramEngine.attach(FakeWiskey)`, and the W1 automation-actor
    shape is validated by `FakeProgramEngine` under U2. A later slice may move them into the shared fakes.
