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

FILLED IN BELOW AFTER THE RUNNER RUNS.

## Files
- `scripts/gate/release_gate.py`, `scripts/gate/release_gate2.sh`, `scripts/gate/nightly_tests.sh`, `scripts/gate/engine_sync.py` (new),
  `scripts/gate/selftest_gate.py`, `scripts/gate/selftest_engine_sync.py` (new), `scripts/gate/INSTALL_ON_RUNNER.md`
- `scripts/release_check.py`, `smplwise_vms/backend/tests/test_release_bundle_version_2520.py` (new)
- `smplwise_vms/backend/tests/test_notify_whatsapp.py`, `test_notify_email.py`, `test_announce_screens_b295.py`, `test_announce_translate_297.py`
- `frontend/tests/unit-home-clock.spec.ts`, `evidence-fleet-report.spec.ts`, `evidence-tabs-styles.spec.ts`

## Tests

FILLED IN BELOW AFTER THE RUNNER RUNS.
