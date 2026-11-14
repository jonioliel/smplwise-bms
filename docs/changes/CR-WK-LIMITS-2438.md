# CR-WK-LIMITS-2438 - one shared class for the WisKey command limits, one answer reader

Branch `pilot/CR-WK-LIMITS-2438` (from `origin/main` @ 0a8fb55e1, v2.43.5). MASTER_PLAN wave 2 entry `CR-WK-LIMITS-2436`.
No version bump, no merge, no tag. Code and tests only: nothing contacts WisKey, a station or the lab.

Base: `origin/main`, not `origin/pilot/CR-WAVE1B-COMBINED-2436`. The plan row names no dependency, and wave 1 (B) touches none of
the files below (checked with `git diff --stat` against the merge base: its only WisKey files are `routers/wiskey_relay_map.py` and
two unrelated tests).

## Why

Code review 2026-11-13, report 02 finding P2-3: five near-identical `Limits` classes (a sliding window per operator, a cool-down
per target that starts only when a command was sent, an in-flight cap) in `wiskey_station_ops`, `wiskey_installer`,
`wiskey_schedule_writes`, `wiskey_door_tech` and `wiskey_triage`, and three identical `result_of` readers (station ops, schedule
writes, triage) that differ only in their set of unclear codes.

## What

- New `services/wiskey_write_limits.py`:
  - `WriteLimits(prefix, busy_retry_s)` - the window (`_window_full_locked`), the cool-down (`key_cooldown_left`, rounded first;
    `cooldown_raw` / `_cooldown_raw_locked`, unrounded), the in-flight count per class, `admit_key` (cool-down, then window, then
    slot - the order every copy had), `mark_sent`, `done(cls)`, `reset`. Refusals are `f"{prefix}_cooldown|_rate_limited|_busy"`.
  - `result_of(frame, command, unclear_codes)` - the one reader.
- Each module keeps its own `Limits` (now a subclass), its own `LIMITS` instance, its own constants, its refusal codes and its
  public method signatures, so no router changed:
  - `wiskey_station_ops.Limits` (`station_ops`, busy 2.0 s), `wiskey_installer.Limits` (`installer`, busy 3.0 s),
    `wiskey_triage.Limits` (`triage`, busy 2.0 s, one class per `review` / `write`): thin adapters onto `admit_key`.
  - `wiskey_schedule_writes.Limits` (`schedule`, busy 5.0 s): `admit_write` uses the window only; `admit_device` keeps the
    unrounded cool-down reading and the `device` slot class.
  - `wiskey_door_tech.Limits`: the subclass with the extra code windows (per operator and per station) and the per-station slot set
    inside the installation-wide cap; all its windows and the cool-down still shrink with `SCALE`.
  - The three `result_of` functions keep their signature and docstring and call the shared reader with the module's own
    `UNCLEAR_CODES` (read at call time).
- The constants are read from each module at call time, so a test that patches `ops.USER_MAX` or `dt.SCALE` still changes that
  module only.
- Kept exactly as it was, including the two cool-down readings: station ops / installer / triage round first and admit when the
  rounded rest is 0.0; schedule device reads and door technical writes refuse while any time is left and report `round(rest, 1)`
  (so the last 50 ms refuse with a retry of 0.0). Pinned by the new pin tests.
- Unused imports removed from the five modules (`deque`, `threading`, `time`, `IntercomError` / `UnclearAnswer` where nothing
  else in the module used them; checked that no other module or test reads them through these modules).
- `tests/test_wiskey_station_ops.py`, `test_the_per_operator_window_and_the_inflight_cap`: the line that set the private counter
  (`ops.LIMITS._inflight = ops.MAX_INFLIGHT`, an int) now fills the slots through the public `admit` with other operators. Same
  assertion, same codes. The triage and door-tech tests that poke `_inflight` work unchanged.

## Tests (run on the workstation, `-p no:xdist`)

- New `tests/test_wiskey_limits_pins_2438.py` (39 tests): each module's limits on a fake clock (slots, cool-downs and their rounding,
  windows, scale, reset, the order of checks) and the three readers over a frame table. **Written first and run green against the
  old classes (39 passed)**, then green again after the move.
- New `tests/test_wiskey_write_limits_2438.py` (13 tests): the shared class (slot until done, a refusal changes nothing, cool-down
  only after `mark_sent`, the two readings, the sliding window, reset), every module's `LIMITS` is a `WriteLimits` with its prefix
  and busy retry and has no lock or window code of its own, the three readers delegate with the module's `UNCLEAR_CODES`.
  **Fails before** (run with the services reverted: `ImportError: cannot import name 'wiskey_write_limits'`), passes after.
- Both new files after the move: 52 passed.
- Focused run after the move: `test_wiskey_station_ops.py`, `test_wiskey_installer_clock.py`, `_lifecycle.py`, `_platform.py`,
  `_technical.py`, `test_wiskey_schedule_writes.py`, `test_wiskey_door_tech.py`, `test_wiskey_triage_2400.py` and the two new
  files: **203 passed, 0 failed** (exit 0).

## NOT_RUN

- The full backend suite and the pixel gate: left to the runner entry check (the workstation runs focused tests only).
- No UI change, so no baselines to refresh.
