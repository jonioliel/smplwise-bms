# GATE-HARDEN-2520 - harden the release gate before the 2.52 gate

Source: `docs/review/DEEP-REVIEW-2520-TESTS-RELEASE.md` (origin/review/DEEP-2520-TESTS-RELEASE, 25bd45c94), findings TR-01, TR-02,
TR-03, TR-04, TR-06, TR-11. Base: `origin/release/2520-train`. Branch `pilot/GATE-HARDEN-2520`.

## What changed and why

### TR-01 (high) - the backend retry needs positive evidence
`scripts/gate/release_gate.py`
- `parse_pytest` takes the node id up to pytest's ` - ` message separator instead of the first blank. `test_gated[GET /api/v1/x]`
  used to become `test_gated[GET`; the retry then answered "not found / no tests ran" (exit 4), ran none of the ids, and every
  backend failure of that gate became FLAKY.
- New `parse_pytest_passed` + `retry_verdicts`: the retry runs with `-rfEp` (a `PASSED <nodeid>` line per passing id). An id is
  FLAKY only when the retry ran cleanly (a pytest summary line, rc 0 or 1, no timeout), printed `PASSED <that exact id>` and did not
  also report it FAILED/ERROR (teardown error). Everything else - not found, skipped, not reached, a crashed / killed / empty retry - stays
  FAIL with the reason (`not positively passed alone: ...`).
- The ids go to pytest as separate argv entries (no shell) and are written to `backend_retry_ids.txt` in the logs.

### TR-02 (high) - engine drift
- New `scripts/gate/engine_sync.py`:
  - `install --src <checkout> [--apply] [--files ..] [--suffix ..]`: one installer (dry run by default), backs up every replaced file once
    (`<file><suffix>`), atomic copy, verifies the hash, writes `~/gate_install_manifest.json` (source commit, sha256 per file, backups);
    refuses while a gate / the nightly / an entry check runs.
  - `check --ref origin/<branch>`: sha256 of the installed files vs `git show <ref>:scripts/gate/<file>`. The engine
    (`~/release_gate.py`, `~/gate2/release_gate.py`) is strict (exit 4); the other gate-2 files are reported loudly. `--allow-drift
    "<reason>"`, `--warn-only`, `--set nightly`.
- `release_gate2.sh` runs the check right after its fetch, before anything else; strict drift = REFUSED (exit 2, nothing run) unless
  `--engine-drift-ok "<reason>"` / `GATE2_ENGINE_DRIFT_OK`. Record: `gate_<b>_<sha>.engine.json`. Dry runs print it (warn only).
- `nightly_tests.sh` writes the same record for `~/nightly-gate/` (warn only) next to its report. It also gains the owner's 25.11 (Q11 a)
  "lighter nightly" lines that had been edited into the runner copy only (that copy and the repository differed by exactly those lines).
- Every engine report's JSON carries `engine_sha256`.
- `scripts/gate/selftest_engine_sync.py` (throw-away repo + fake home); `INSTALL_ON_RUNNER.md` documents the installer, the check and the
  known-issue rule.

### TR-06 (medium) - `~/known_issues.json` needs ticket + expiry
`load_known()` keeps an entry only with a non-empty `ticket` and an `expires` date from today to at most `GATE_KNOWN_MAX_DAYS` (7)
days ahead (the quarantine rule). Refused entries explain nothing (their failures are FAIL) and are listed: report JSON `known_refused`,
a warning line in the report and in the summary line.

### TR-04 (medium) - the shipped bundle must be this version's
`scripts/release_check.py`: new row "shipped UI bundle built for this version (www/arx-sw.js shell cache)": `www/arx-sw.js` must carry
`arx-shell-<config.yaml version>` (vite names the service-worker cache after config.yaml). Once the CHANGELOG head is the release (DRAFT
mark removed) a mismatch FAILS; before that (train branch ahead of its release rebuild) it is a `[WARN]` row. Test:
`tests/test_release_bundle_version_2520.py`.

### TR-03 (high) - the four failures of the 25.11 nightly (main @ fd600e96d)
See "Verdicts" below.

### TR-11 (low) - quiet-hours tests at 23:59
The window `00:00`-`23:59` leaves 23:59 local outside (`start <= hm < end`). WhatsApp (3 tests) and e-mail (1 test, same pattern, not in
the review) now pin the notification clock with `daytime_clock`; the two announcement tests (same pattern, not in the review; their
world clock is the real "now" because the board feed reads it) use a window two hours either side of the test clock.

## Verdicts (TR-03, TR-06)

Nightly 25.11 on main @ fd600e96d (v2.50.0), the four FAIL rows:

| test | verdict | fix |
|------|---------|-----|
| `unit-home-clock.spec.ts:74 [desktop]` midnight roll-over | **test defect (race), not a product defect, not time-of-day.** The test removed the date sensor on the widget (`home-widgets.config`), but `devices-building` hands the widget a freshly normalised config (`homeViewOf` -> `configOf`) on each of its own renders, so the edit was lost at the screen's next render and the widget showed the demo sensor's fixed text `ג׳ בחשוון התשפ״ז` before and after midnight (exactly the failure message). Reproduced in daytime on the runner: the old spec failed 1 of 5 repeats with the same message. The product's midnight roll-over is fine. | the test edits the screen's home block (`devices-building.tree.home`), waits until the computed date is on screen before reading it, and checks after two minutes that it is still computed. New spec: 25/25 passed (5 tests x 5 repeats). |
| `evidence-fleet-report.spec.ts:39 [mobile]` | **budget under load, not a defect.** 13 page loads + 10 full-page captures; on a quiet runner 16.3 s desktop / 16.5 s mobile. In the nightly the mobile run (and its alone-retry) hit the 60 s test timeout in `waitForSelector` / `screenshot` while the machine was overloaded (the 25.11 nightly filled RAM + swap - owner Q11 a). | `test.setTimeout(180_000)`. 2/2 passed on the runner. |
| `evidence-tabs-styles.spec.ts:120 [mobile]`, `[tablet]` | **budget under load, not a defect** (7 cold page loads with a fixed 0.9 s settle + 6 captures; 11.6-12.8 s quiet; `page.goto` itself took > 60 s in the nightly retry). `:153 [tablet]` was FLAKY for the same reason. | `test.setTimeout(180_000)` on `:120` and `:153`. Whole file 18/18 passed on desktop, tablet, mobile. |

TR-06: the runner's `~/known_issues.json` held one entry (`pwa-push-new-release-91`, added 2026-10-02, no ticket, no expiry). Its `line: 91`
no longer matched any test (the spec's tests start at line 93; "a new release" is at 139), so it hid nothing lately: the last two
pwa-push failures in the runner reports (14.11, `:139` / `:171` [desktop]) were reported FLAKY normally. The spec now passes:
`evidence-pwa-push.spec.ts` on desktop, tablet, mobile x 3 repeats = 75 passed, 15 skipped (the live-backend group), 0 failed.
Verdict: entry REMOVED (file is now `[]`; backup `~/known_issues.json.bak_2511`). The engine now refuses such entries anyway.

## Files
- `scripts/gate/release_gate.py`, `scripts/gate/release_gate2.sh`, `scripts/gate/nightly_tests.sh`, `scripts/gate/engine_sync.py` (new),
  `scripts/gate/selftest_gate.py`, `scripts/gate/selftest_engine_sync.py` (new), `scripts/gate/INSTALL_ON_RUNNER.md`
- `scripts/release_check.py`, `smplwise_vms/backend/tests/test_release_bundle_version_2520.py` (new)
- `smplwise_vms/backend/tests/test_notify_whatsapp.py`, `test_notify_email.py`, `test_announce_screens_b295.py`, `test_announce_translate_297.py`
- `frontend/tests/unit-home-clock.spec.ts`, `evidence-fleet-report.spec.ts`, `evidence-tabs-styles.spec.ts`

## Tests (runner, slot B jobs `p2520_gateharden_*`; branch head 8e025887a for the runs, lint fixes after)

| what | command | result |
|------|---------|--------|
| gate engine selftest (incl. TR-01 real-pytest reproduction, TR-06 cases) | `GATE_SELFTEST_REPO=<wt> ~/smplwisebms/.venv/bin/python scripts/gate/selftest_gate.py` | rc 0, `SELFTEST PASSED` |
| engine_sync selftest | `python3 scripts/gate/selftest_engine_sync.py` | rc 0, `SELFTEST PASSED` (also on the workstation) |
| release bundle check | `pytest tests/test_release_bundle_version_2520.py` | 6 passed |
| release_check suite | `pytest tests/test_release_check.py` | 2 passed, 1 failed: `test_repository_is_release_consistent` - "one version everywhere" (CHANGELOG head is the 2.52.0 DRAFT on the train head). Pre-existing on the base train head, unrelated (the new bundle row is a WARN there, not a FAIL) |
| WhatsApp | `pytest tests/test_notify_whatsapp.py` | 111 passed |
| e-mail | `pytest tests/test_notify_email.py` | 47 passed |
| announcements | `pytest tests/test_announce_screens_b295.py`, `tests/test_announce_translate_297.py` | 15 passed, 11 passed |
| home clock (new) | `playwright test tests/unit-home-clock.spec.ts --project=desktop --repeat-each=5` | 25 passed |
| home clock (old spec from main, midnight test) | same, `-g midnight` | 1 failed / 4 passed - the nightly's failure reproduced in daytime |
| fleet report | `evidence-fleet-report.spec.ts -g "the four pages" --project=desktop --project=mobile` | 2 passed (16.3 s, 16.5 s) |
| tab styles | `evidence-tabs-styles.spec.ts` desktop + tablet + mobile | 18 passed |
| PWA push | `evidence-pwa-push.spec.ts` 3 projects x `--repeat-each=3` | 75 passed, 15 skipped (live group), 0 failed |
| ruff | changed Python files | no F (pyflakes) finding; no new style finding vs the base after the lint commit |

The quiet-hours tests were not run at 23:59 local (no faketime on the runner): NOT_RUN at that minute. By construction they no longer
read the wall clock for the quiet decision (pinned `notify.now_utc`), resp. use a window around their own test clock.

NOT_RUN: no release gate, no nightly, no full backend or Playwright suite (owner rule: the lead starts gates).

## Installed on the runner (25.11, ~17:35 UTC, idle: no gate / nightly / entry check; the push watcher held the tests lock for a
## branch pytest run that uses none of these files; every copy is an atomic rename)

`python3 scripts/gate/engine_sync.py install --src ~/work/gateharden --files release_gate.py,release_gate2.sh,engine_sync.py,selftest_gate.py,nightly_tests.sh --suffix .bak_2511 --apply`
from 4b1a424f2, then again from 41426b843 (only `release_gate2.sh` and `nightly_tests.sh` changed: line-continuation tidy). Manifest: `~/gate_install_manifest.json`.

| installed file | sha256 | backup (`.bak_2511`) of the replaced file |
|---|---|---|
| `~/release_gate.py`, `~/gate2/release_gate.py`, `~/nightly-gate/release_gate.py` | `42294cde08ddc1675d0ebc16b366feea7bf052df2b9cf74f1bb621e4011fc097` | `~` and `~/gate2`: `fb0ffea60c3f0652...` (the engine without GATE-ONEPROJECT-2480); `~/nightly-gate`: `9d640cf8888a05ad...` (= train before this row) |
| `~/gate2/release_gate2.sh` | `1b4fd5f411c09b462e6da3d0b6485ca3618abad65af82b2207076aa61bc454c0` | `f5904414ee636dc0...` |
| `~/gate2/engine_sync.py`, `~/engine_sync.py` (new) | `5d594963b612d63bbd6392472cd9f4d9c9f6955d5c1a006420dca0d37ca72624` | - |
| `~/selftest_gate.py` | `d5bdd996e41353eeb142b60f76899312f4d570dfc7d76e330581f64f1055d01f` | `b0683e101ec598e8...` |
| `~/nightly_tests.sh` | `28e7045bd4ed6a3ef7b9f87a0834143b599c44d579d7a9d52bdaaad5396ecb9e` | a `.bak_2511` already existed (07:03 UTC today, the pre-Q11 copy, `23f491f8146b04d7...`) and was kept; the replaced Q11 copy equals the new file minus the engine-record lines |
| `~/known_issues.json` | `[]` (`37517e5f...`) | `30597ced3b7a3be9...` (the 2 Oct pwa-push entry) |

After the install `engine_sync.py check --ref origin/pilot/GATE-HARDEN-2520`: engine in sync; one warning: `~/gate2/gate_budget.py`
differs from the repository (the runner carries the unmerged `chore/GATE-SPEED-2320` version, a superset with a `limit` command that
no installed script calls). `~/nightly_tests.sh --dry-run` OK.

## Consequences and open questions

1. From now on `release_gate2.sh` / `gate_release.sh` REFUSE a branch whose `scripts/gate/release_gate.py` is not the installed one. The
   2.52 train (`release/2520-train`, head af0021b2c at install time) does not contain this row yet, so its gate is refused until this
   branch is merged into it. Options: (a) merge `pilot/GATE-HARDEN-2520` into the train before the gate - recommended; (b) gate the train
   with `--engine-drift-ok "<reason>"` (the old behaviour of TR-01 stays in that tree's file, but the installed engine runs).
2. `~/gate2/gate_budget.py` drift (above): (a) leave it, the warning is printed each gate - recommended until GATE-SPEED-2320 is decided;
   (b) install the repository version.
3. The nightly on main (02:00 UTC) now runs this engine although main does not have it yet: its record says so (warn only). With the
   TR-01 fix a backend failure can no longer hide as FLAKY, so the next nightly may show reds the old engine hid.
4. Not in this row: TR-03 (b)-(d) (tagcheck inside `release_check --tag`, NODISK/SKIPPED as red status, disk), TR-05, TR-07, TR-09.
