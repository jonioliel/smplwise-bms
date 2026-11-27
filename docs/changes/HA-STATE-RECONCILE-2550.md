# HA-STATE-RECONCILE-2550 - periodic full state reconcile of the platform mirror

Branch `pilot/HA-STATE-RECONCILE-2550`, base `origin/pilot/CORE-RELIABILITY-2540` (`abfd96a73`). Target 2.55. Spec: deep review
**CORE-03**, its second suggestion (`docs/review/DEEP-REVIEW-2520-BACKEND-CORE.md`), taken up as the follow-up row that
`docs/changes/CORE-RELIABILITY-2540.md` open question 1 recommended (answer a). No version bump, no changelog entry, no UI change, no
lab / Home Assistant / NVR / go2rtc contact, no device writes.

## 1. What and why

CORE-RELIABILITY-2540 closed the window between the connect snapshot and the `state_changed` subscription. Two ways of losing a state
remained: an update whose write the database refused (`handle_state_event` makes ONE attempt - it runs on the socket's loop, and ~30 s
of retries would miss the ping deadline; its own docstring says "corrected by the next push of that entity or the next snapshot"), and
anything else that drops one event. Until the entity changed again or the session reconnected, the mirror kept the old state with
`fresh: true` (screens, `notify_sensors`, scenarios).

**Now** the HA sync session runs a periodic full state reconcile (`HaSync.reconcile_now`, the `reconciler` task of `_session`):

- Every `ha.state_reconcile_min` minutes (default 10) it asks Home Assistant for all states once: ONE `get_states` on the existing
  WebSocket session (read-only; the same call the connect snapshot makes). The first cycle is one interval after the connect snapshot.
- `reconcile_states` compares the listing with the mirror (one read transaction) and writes ONLY the states Home Assistant reports as
  strictly newer (`last_updated`) than the stored ones (`reconcile_decision`):
  - newer -> written through `upsert_state` (the mirror row and its `ha_state_history` row at the state's own time), then one
    `entity_state_changed` push per written row on `/ha/ws`, so open screens update;
  - older / same -> kept (an older listing never replaces a newer event);
  - an entity a live `state_changed` event (or a state removal) touched while the cycle ran -> kept: the event is the newer word
    (`HaSync._reconcile_touched`, set from before the listing is asked for until the write ends);
  - a missing or unreadable time on either side -> kept (nothing is guessed);
  - a tombstoned row (`removed_at`) -> kept (the registry refresh and the next state event decide about it);
  - an entity the mirror does not know, or a registry-only row that never had a state -> written;
  - `unknown` / `unavailable` are states like any other: written as they are when newer, never hidden or replaced by a last known value;
  - an entity missing from the listing is left as it is (no tombstoning here; the registry refresh owns that).
  Every candidate is decided again inside its chunk's write transaction (a live event may have written it meanwhile). Chunks of 150
  rows, the same busy retry as the connect snapshot; a chunk the database still refuses stops the cycle (the rest counted as not
  written - the next cycle tries again); a full disk logs the shared once-a-minute line.
- Not run for a reconciled state: the correlation, notification, rule, device-activity and automation / schedule hooks of a live event. A
  reconciled state is up to one interval old; raising "door opened" or a leak notification minutes late, or recording it as a fresh
  transition, would be wrong (question 2). The sensor notifications still follow: `notify_sensors.scan` already reconciles its open
  rows with the mirror (announce once, resolve when the condition ended), so a repaired mirror is picked up by its next scan.
  `STATE.last_snapshot_at` is not changed (the registry refresh's tombstone rule reads it).
- Bounded:
  - skipped (nothing asked, nothing written) while Home Assistant is disconnected, when the session drops while the listing comes in,
    and while the previous cycle still runs (`{"skipped": "busy"}`);
  - a refused or malformed listing writes nothing (`{"skipped": "refused"}`, one warning line);
  - `get_states` has the session's own 60 s call time-out; a failed cycle never ends the loop; the task is cancelled with the session.
- One summary line at info level, counts only (never an entity id):
  `HA state reconcile (periodic) in N ms: N states read, N repaired, N older kept, N unchanged, N updated live during the cycle,
  N removed kept, N without a readable time kept, N not written`. A skip logs at debug level only.
  `HaSync.last_reconcile` keeps the last result for diagnostics (not exposed by any route).

### The setting `ha.state_reconcile_min`

Follows the settings conventions: `DEFAULTS` (`"10"`), `INT_KEYS` (GET `/settings` answers an integer), and `SettingsPatch`
(`int`, `0..1440`, and 1-4 refused with 422 by a validator: "at most every 5 minutes"). `0` = off. The loop reads it once a minute
(`RECONCILE_TICK_S`), so a change applies within a minute without a restart; a damaged stored value reads as the default (10), a value
below 5 as 5, above 1440 as 1440 (`reconcile_interval_min`). No UI control (question 1); documented in `DOCS.md` / `DOCS_HE.md`.

## 2. Files

- `smplwise_vms/backend/smplwise/services/ha_sync.py` - `RECONCILE_*`, `reconcile_interval_min`, `reconcile_interval_s`,
  `reconcile_decision`, `reconcile_states`; `HaSync.reconcile_now`, `_reconcile_done`, `_reconcile_touched`, `last_reconcile`; the
  `reconciler` task in `_session.on_ready`; `on_event` notes the entities a live event touched during a cycle
- `smplwise_vms/backend/smplwise/services/settings_store.py` - `ha.state_reconcile_min` in `DEFAULTS` and `INT_KEYS`
- `smplwise_vms/backend/smplwise/routers/settings.py` - `SettingsPatch.ha_state_reconcile_min` and its validator
- `smplwise_vms/DOCS.md`, `smplwise_vms/DOCS_HE.md` - one paragraph each
- `smplwise_vms/backend/tests/test_ha_state_reconcile_2550.py` (new, 10 tests)

API: additive only (ADR-015) - one new settings key in the GET / PATCH `/settings` document; no route, field or code removed.

## 3. Tests

The new file runs the real `HaSync` session against a fake Home Assistant (`ha_client.ws_session` replaced, `FakeHa` of
`test_ha_structure_refresh`, its state listing deep-copied per test):

| Test | What it proves |
|---|---|
| `test_a_state_update_lost_to_a_busy_database_is_repaired` | a live update refused by a "database is locked" write is lost (precondition checked), the next cycle writes it (row, history, push), nothing else is written |
| `test_an_older_listing_never_overwrites_a_newer_event` | a listing older than the stored event is kept out (`older`) |
| `test_a_live_event_during_the_cycle_wins_over_its_listing` | a state removal arriving while the listing is in flight is not undone by the (newer-looking) listing |
| `test_unknown_and_unavailable_are_kept_as_they_are` | `unknown` at the same time kept; a newer `unavailable` written as `unavailable` (available 0); an unreadable listing time never replaces a known state |
| `test_skipped_while_disconnected_and_while_another_cycle_runs` | a second cycle while the first waits for its listing answers `busy`; disconnected answers `disconnected`; only one `get_states` asked |
| `test_a_refused_listing_writes_nothing` | a refused `get_states` changes nothing |
| `test_the_loop_runs_on_the_interval_and_not_when_off` | the session's loop runs cycles on the interval; 0 = no cycle |
| `test_one_summary_line_without_entity_ids` | exactly one info line for a cycle, no entity id in it |
| `test_decision_rule_and_interval_setting_are_pure` | the decision table and the interval clamp |
| `test_the_interval_setting_round_trip` | default 10 (integer), 1 / 3 / -1 / 1441 / text refused 422, 0 and 30 stored and read by the loop |

PC (Windows, one pytest process, `C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/test_ha_state_reconcile_2550.py -p no:cacheprovider -rA`):

- base sources (`ha_sync.py`, `settings_store.py`, `routers/settings.py` checked out from `abfd96a73`): **exit 1, 10 failed** (no
  reconcile exists at the base: `reconcile_now` / `reconcile_decision` missing, the setting unknown).
- fixed sources: **exit 0, 10 passed**.

Runner (`~/work/p2520_hareconcile_run.sh` through `slotb.sh`, head `5670f92d4`, Linux, `-m "not timing_lane"`, `SW_WIRE_STRICT=1`):

- ruff on the three touched modules and the new test file: exit 0, "All checks passed!".
- 30 backend files of the touched areas (the new file; HA sync / mirror: `test_core_reliability_2540_sync`, `test_ha_structure_refresh`,
  `test_ha_sync_1000`, `test_live_review_fixes`, `test_media_sync`, `test_soak_edges_2450`, `test_soak_edges2_2450`,
  `test_followups_2406`, `test_devices`, `test_ha_client_2438`, `test_schedules_mirror`, `test_schedules_settings`,
  `test_device_activity`, `test_correlation`, `test_notify_sensors`; settings: `test_setting_value_parity`, `test_setting_callers_2440`,
  `test_ui_settings`, `test_settings_patch_audit_order`, `test_body_limit`, `test_f3c_g03_295`, `test_secfix_restore_settings_2520`,
  `test_secfix_restore_validate_2520`, `test_docs_config_consistency`, `test_asyncio_default_2342`; guards: `test_wire_ratchet_2480`,
  `test_singletons_registered`, `test_i18n_errors_en_2520`, `test_async_routes_hold_no_write_conn`), six pytest processes of 5 files,
  two lanes: **489 passed, 3 failed** (492 tests). None of the three is this row:
  - `test_secfix_restore_settings_2520.py::test_every_security_and_remote_setting_is_classified_keep_or_travel` - fails at the base
    `abfd96a73` too (re-run there: 1 failed); the known base failure CORE-RELIABILITY-2540 reports as well.
  - `test_devices.py::test_bulk_lights_kinds_reach_a_switch_typed_light_and_switches_kinds_do_not` and
    `...::test_bulk_lights_with_all_switches_reach_every_switch_through_the_policy` - order-dependent: `test_devices.py` alone at the
    head: 64 passed; the same 5-file group (`test_media_sync`, `test_soak_edges_2450`, `test_soak_edges2_2450`, `test_followups_2406`,
    `test_devices`) at the base `abfd96a73`: the same 2 failed, 100 passed. A test-isolation leak that exists before this row.
- Full backend suite: NOT_RUN (left to the 2.55 train gate).

## 4. Open questions

1. A control for the interval in the settings screen (System › diagnostics, next to the server settings).
   a) not now - the API setting and the docs are enough, the default fits every site (recommended) - b) add it (a UI change: pixel
   baselines and a compare page).
2. A repaired state does not run the live-event hooks (correlation transition, rule alerts, device activity, automation / schedule
   item hooks); the sensor notifications follow through their own scan of the mirror.
   a) keep it so - a repaired state is up to one interval old and is not a transition that just happened; the mirror, the history and
   the screens are corrected (recommended) - b) also record a correlation transition for it (a follow-up row with its own review).
