# GATE-NIGHTLY-2560 - nightly script parity with the runner, and the green-gate rule in release_check (TR-03, partial)

Base: `origin/release/2550-train` (15ba75f92). Branch `pilot/GATE-NIGHTLY-2560`. Nothing was installed on the runner.

## 1. Nightly script: repo copy vs. the installed `~/nightly_tests.sh`

The installed script (read-only over the runner helper, modified 25.11 17:34) was diffed against `scripts/gate/nightly_tests.sh` at the base.
Result: the only difference is that the repo copy is NEWER - it has `--local-hour=HH` (LOWS-BRIDGE-GATE-2550). The runner-only lightening line
(`GATE_PW_SLOTS=${SW_NIGHTLY_PW_SLOTS:-8}`, `GATE_BACKEND_SHARDS=${SW_NIGHTLY_SHARDS:-4}`, `GATE_PW_MAX_WORKERS=${SW_NIGHTLY_PW_MAX_WORKERS:-4}`,
`GATE_MIN_FREE_MB=${SW_NIGHTLY_MIN_FREE_MB:-3000}`) and the warn-only engine drift check (`engine_sync.py check --set nightly`) are already in the repo copy
(they came in with GATE-HARDEN-2520 / the 2.55 train). No runner-only difference is left to bring over, so `scripts/gate/nightly_tests.sh` is unchanged.

Added: `smplwise_vms/backend/tests/test_nightly_lightening_2560.py` - a static check (no bash, runs on the PC too) that the four knobs and their defaults are set in the
command that runs the engine, that the drift check is there and warn-only, and that `--local-hour` plus the `Asia/Jerusalem` logic are still there.
It fails if the lightening is dropped from the repo copy.

## 2. TR-03 (partial): green nightly / green full gate before a tag

`scripts/release_check.py` has a new check `green nightly or full gate at this head or an ancestor (TR-03)`:

- reads the engine reports `gate_<branch>_<sha>.json` from `~/smplwise-results` and `~/smplwise-results/nightly` (`SW_RESULTS_DIR` replaces the base);
- a report counts when verdict is `pass`, tier is `L`, its commit is HEAD or an ancestor of HEAD in this checkout, it finished at most 7 days ago
  (`--green-max-age-days`) and the commit is at most 150 commits behind HEAD (`--green-max-commits`);
- no results directory (the PC) or not a git checkout: `NOT_CHECKED`, reported as a WARNING, never a silent pass;
- results present but no qualifying report: WARNING on a plain run (the release gate runs release_check before its own verdict exists, so it must not fail there),
  FAILURE with `--tag` or `--require-green`.

Not covered (TR-03 remainder): the check cannot know the commit that is actually tagged by a person who tags a different commit than the one checked; it checks the
checkout it runs in. The limits (7 days / 150 commits) are a proposal, see the question below.

Tests (PC, one file per process, `--noconftest` because the PC python has no fastapi):
- `py -3.12 -m pytest -o addopts="" -q -p no:cacheprovider --noconftest smplwise_vms/backend/tests/test_release_check_green_2560.py` - exit 0, 12 passed.
- same for `test_release_check.py` - exit 0, 3 passed (its `--tag` case now points `SW_RESULTS_DIR` at a missing directory).
- same for `test_nightly_lightening_2560.py` - exit 0, 2 passed.
- `test_nightly_local_hour_2550.py` - 8 skipped on the PC (needs GNU date zone data); NOT_RUN here, unchanged by this row.
- Runner: NOT_RUN (a release gate was running).

## Install steps (owner/lead, never while a gate or nightly runs: `~/.smplwise-tests.lock` free, no `~/.gate-pending`)

The nightly script itself does not change in this row, so step 1 only matters if the installed copy is older than the repo copy
(it lacks `--local-hour`; today that is the case).

1. On the runner, in a checkout of the release (or main) that has this change:
   `python3 ~/gate2/engine_sync.py install --src <checkout> --files nightly_tests.sh --suffix .bak_DDMM` (dry run), then the same with `--apply`.
   This keeps a `~/nightly_tests.sh.bak_DDMM` backup and refuses while a gate or nightly runs (no `--force-busy`).
   Check: `~/nightly_tests.sh --local-hour=02 --dry-run` prints the branches only at 02:xx Asia/Jerusalem, and
   `grep -c 'GATE_PW_SLOTS' ~/nightly_tests.sh` prints 1.
2. Then the cron line (`crontab -e`), replacing only the `0 2 * * *` line and keeping its date guards in front (note: at 23:00 UTC `date` is still the previous UTC day):
   `0 23,0 * * * [ "$(date +\%Y\%m\%d)" -ge 20261104 ] && [ "$(date +\%Y\%m\%d)" != 20261119 ] && /home/sw/nightly_tests.sh --local-hour=02 >> /home/sw/smplwise-results/cron.log 2>&1`
   If the guards no longer apply, the plain line is `0 23,0 * * * /home/sw/nightly_tests.sh --local-hour=02 >> /home/sw/smplwise-results/cron.log 2>&1`.
   Keep the one-shot lines and comments of the existing crontab as they are.
3. `release_check.py` needs no install: it runs from the checkout (also inside the gate). To use the new rule at tag time:
   `python3 scripts/release_check.py --tag` on the runner (implies `--require-green`).

## Open questions

1. Limits of "within limits": A) 7 days and 150 commits (as built, recommended), B) same day only, C) any age.
2. Should the release gate itself pass `--require-green` at tag time? A) no, only the person tagging runs `--tag` (as built, recommended); B) yes, from the next release.
