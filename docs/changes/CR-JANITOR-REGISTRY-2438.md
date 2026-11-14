# CR-JANITOR-REGISTRY-2438 - the housekeeping pass as a registry

Branch `pilot/CR-JANITOR-REGISTRY-2438` (MASTER_PLAN entry `CR-JANITOR-REGISTRY-2436`, wave 2). Source: the code review of
2026-11-13 (`private/code-review-2026-11-13/`): D10 = 04:F17 + 05:P2-04, and the janitor part of 05:P1-03.

## Base

- Cut from `origin/pilot/CR-WAVE1B-COMBINED-2436` (`ffb4af2d5`): it carries `services/settings_store.py` with `setting_value`
  (`CR-SETTINGS-STORE-2436`), which this branch uses, and the `CR-NOTIFY-FANOUT-2436` change of `services/maintenance/reminders.py`.
- `origin/pilot/BACKEND-SAFETY-2435` (`300945228`) merged in (one merge commit): it rewrote the head of `janitor_tick` (the
  per-step guard). This branch replaces the whole function, so it must sit on top of that change, not beside it.
- `origin/pilot/CR-MAIN-RUNTIME-2438` and `origin/pilot/CR-SYNC-GATE-2438` also change `main.py` (imports at line 18, the
  exception handlers around 551-600, the lifespan / shutdown from 1291 and `CommitBeforeSend`, numbering of `origin/main`). None of
  those lines is touched here: this branch changes `janitor_tick` (31-398) and three lines of the `_tz` / `_tz_of` closures
  (1045-1096). The 30-second loop that calls `janitor_tick` (changed on `origin/main` by HEALTH-GO2RTC-FOLLOWUP-2431) is untouched.

## What changed

1. **`services/janitors.py` (new)**: `STEPS`, the pass as an ordered tuple of `Step(name, target, needs, failure, nvr_only)`.
   `target` is `"module:attr.path"` under the `smplwise` package (looked up at call time, so a test that patches a module attribute
   still reaches the pass) or a small function for the three steps that are more than one call (announcements, partner, ticket
   costs) and the WAL checkpoint. `run_pass(db, settings)` is the old function's control flow: the demo check and the settings read
   end the pass on failure (as BACKEND-SAFETY-2435 left it), every step with a `failure` text is guarded (log on logger `smplwise`
   with the same text, go on), the three steps that were never guarded (NVR storage warm-up, manual-recording stop, WAL checkpoint)
   still raise and end the pass, and the four NVR steps are skipped in NVR-less mode (`mode.is_ha_only`, evaluated once, at the
   same point as before).
2. **`main.janitor_tick`**: a two-line wrapper over `janitors.run_pass` (it stays in `main.py`: tests and docstrings import it from
   there). `_janitor_step` (BACKEND-SAFETY-2435) is gone; the registry loop is its replacement.
3. **Settings (05:P1-03)**: the pass read `read_settings()` (261 keys, ~45 JSON parses) on the write lock every 30 s for five
   values. It now reads the five keys with `setting_value` on a read connection (`janitors.SETTING_KEYS`). `schedules.janitor`
   receives that mapping (it reads only `schedules.runs_retention_days`); `automations.janitor` receives it and reads nothing.
   `_tz` (called for every NVR alert by `events_ingest`) and `_tz_of` read `time.zone` with `setting_value` instead of
   `read_settings()["time.zone"]` (same value: `tests/test_setting_value_parity.py`). The few-second zone cache in the alert listener
   belongs to `CR-SETTING-CALLERS` (it owns `services/events_ingest.py`) and is not done here.
4. **One throttle object**: `janitors.Every(seconds, clock=None)` - `due(now=None)`, `mark(now=None)`, `reset()`, thread-safe, the
   first call always due, `seconds` mutable. The seven hand-made throttles named in the plan use it, each with its interval:
   `needs_review` 3600 s, `maintenance/reminders` 900 s (still re-set from the setting at each pass), `docread/service` 3600 s
   (its injectable clock kept), `device_activity` 900 s (`force=True` still runs and records the run), `insights_delivery` 55 s on
   the wall clock (its `now_ts` argument kept), `calendar/jobs` 3000 s and 55 s, `calendar/attendee_notices` 3000 s (the
   notices themselves still every pass). The dict-based throttles of `energy_sampler`, `water_sampler` and `energy_billing` are not
   in this row's file list and are unchanged.

## Same behaviour

- Same steps, same order, same arguments, same warning texts on the same logger: the golden list in `tests/test_janitor.py`
  was written from the old function, and a second test patches every named target with a recorder and checks the calls of a real
  pass in order with their arguments.
- A failing guarded step is logged and the next one runs; an unguarded one ends the pass; unreadable settings / demo state skip it.
- Import errors of a step are now inside that step's guard. Before, the imports of the first eleven steps sat at the top of the
  function (an import error there ended the pass); the steps from `ha_user_auth` to `push` imported unguarded mid-pass. Only the
  failure path changes, in the direction BACKEND-SAFETY-2435 already took.
- Two throttle edge cases, both on the "run" side: `device_activity.prune_db` compared with 0 without a "never ran" check, so in a
  process whose monotonic clock was below 900 s its first prune waited; it now runs on the first pass like every other throttle.
  `attendee_notices` used `> 3000` where the others use `>= interval`; equality at float precision is the only difference.
- Test seams: `device_activity._last_prune`, `maintenance.reminders._every_s` and the other module globals are replaced by the
  throttle objects (`_PRUNE`, `_CHECK`, ...). Two tests touched them and were updated (`test_device_activity.py` resets
  `_PRUNE`; `test_maintenance_215b.py` reads `_CHECK.seconds`). The `reset()` / `reset_for_tests()` functions are kept.

## Tests

Run locally (`.venv` Python 3.12, `-p no:xdist -o addopts=""`, the workstation is saturated, so only the touched files):

- `tests/test_janitor.py` (2 existing + 11 new), `tests/test_maintenance_215b.py`, `tests/test_device_activity.py`,
  `tests/test_backend_safety_2435.py::test_one_failing_early_janitor_step_never_skips_the_later_ones` - **62 passed** (13 min 11 s).

New in `tests/test_janitor.py`: the golden order; every named target resolves; a real pass calls every step in order with its
arguments; the five values equal `read_settings`; a failing guarded step is logged and the next runs; an unguarded step ends the
pass; NVR steps skipped in NVR-less mode; unreadable settings skip the pass; `Every`; each converted throttle keeps its interval.

NOT_RUN locally (runner entry check): the full backend suite, in particular `test_needs_review.py`, `test_insight215_slice3.py`,
`test_docread_297.py`, `test_calendar_*`, `test_nvr_less.py`, `test_setting_value_parity.py`, `test_events*.py`.
