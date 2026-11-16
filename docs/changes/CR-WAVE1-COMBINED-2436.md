# CR-WAVE1-COMBINED-2436 - the finished wave-1 code-review branches in one branch, for one runner entry check

Branch `pilot/CR-WAVE1-COMBINED-2436`, cut from `origin/main` @ `665ec8f24` (2.43.4). Plan: `private/code-review-2026-11-13/MASTER_PLAN.md`
section 3. No version bump, no CHANGELOG entry, no migration of its own. No device, NVR, go2rtc, Home Assistant or lab host was contacted.

## Merged heads (in this order, `git merge --no-ff`)

| # | Branch | Head | Conflicts |
|---|---|---|---|
| 1 | `pilot/CR-BE-GATES-2436` | `0cf517853` | none |
| 2 | `pilot/CR-READCONN-A-2436` | `04790298c` | none |
| 3 | `pilot/CR-UPLOAD-SYNC-2436` | `d574091ca` | none |
| 4 | `pilot/CR-SETTINGS-STORE-2436` | `761e8f552` | none |
| 5 | `pilot/CR-GO2RTC-ADAPTER-2436` | `72d30aecf` | none |
| 6 | `pilot/CR-TK-HISTORY-2436` | `4fe49fad5` | none |
| 7 | `pilot/CR-FE-GATES-2436` | `5616cbd9a` | none |
| 8 | `pilot/CR-API-BLOB-2436` | `e83f050a4` | none |
| 9 | `pilot/CR-HOME-RELOAD-2436` | `18ae23563` (contains `pilot/CR-POLL-SCREENS-A-2436` @ `be4486204`) | none |
| 10 | `pilot/CR-RECIPIENTS-2436` | `0c3508129` (pushed during the combine, merged before the entry check was queued) | none |

Each branch's own note stays in `docs/changes/<name>.md`.

## Interactions checked

- `AUTH-REVOKE-GATE-2435` is **not** in this branch, so the strict xfail of `test_async_routes_no_inline_db.py::test_pending_offenders_are_fixed`
  (`routers/wiskey_lineage.py::resolve`) stays correct: it ran as XFAIL.
- The three inventory tests agree after the merge: `test_async_routes_no_inline_db.py` (BE-GATES), `test_async_routes_hold_no_write_conn.py`
  (UPLOAD-SYNC) and `test_get_routes_read_conn.py` (READCONN-A) passed together. `get_write_allowlist_rest.txt` does not exist (READCONN-B is not
  in this wave), so the READCONN-A inventory stays scoped to the access-area routers, and `GET /settings` (moved to the read connection by
  SETTINGS-STORE) is outside it. No allow-list needed a change.

## One addition of this branch: the backend lint lane in the entry check

`scripts/gate/branch_check.sh`: after the engine worktree is checked out, the entry check runs `lint_backend.py` (from CR-BE-GATES) with
`GATE_LINT_ROOT=$WT`, i.e. the branch under check, under `timeout 300`, `nice`, `|| true`. It prints the ruff F count to the entry log only;
it never changes the verdict. `GATE_BACKEND_LINT=0` turns it off. The runner copy (`~/gate2/branch_check.sh`) was installed with the same
content (previous copy kept as `branch_check.sh.bak-20261113`; the repo copy and the runner copy were byte-identical before the edit).

Runner setup done for the lane: `lint_backend.py` copied to `~/gate2/` next to `gate_entry.py`; `ruff==0.17.5` (the version CR-BE-GATES
measured with) installed in the gate venv `~/smplwisebms/.venv` - `pip install --user` is refused inside that venv (user site not visible),
and the gate scripts put that venv first on `PATH`. The runner's `gate_entry.py` is still main's copy (no `lint` sub-command), so the
release-gate path (`gate_release.sh` -> `gate_entry.py decide`) prints nothing until the normal install after this merges to main.

## Tests run (workstation, Windows, Python 3.12.10 venv, Node 24.21.0; `-p no:xdist` / `--workers=1`)

| Command | Result |
|---|---|
| `pytest` the new tests of every backend branch (`test_local_auth_inventory`, `test_async_routes_no_inline_db`, `test_get_routes_read_conn`, `test_async_routes_hold_no_write_conn`, `test_setting_value_parity`, `test_go2rtc_stream_sync_2436`, `test_autosync`, `test_cast_relay`, `test_tickets_history_domains`) + `test_read_mode.py` + `test_settings_*.py` (3 files), before the RECIPIENTS merge | 194 passed, 1 xfailed, rc 0 (counted from the progress line; the summary line is hidden by `-q` twice) |
| `pytest test_notify_recipients.py test_async_routes_no_inline_db.py test_async_routes_hold_no_write_conn.py test_get_routes_read_conn.py`, after the RECIPIENTS merge | 97 passed, 1 xfailed (5 min 21 s) |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (built in 2 min 50 s) |
| `npx playwright test -c playwright.unit.config.ts --workers=1 unit-entry-chunk unit-client-blob unit-client unit-home-reload-2436 unit-poll-controller` | 59 passed |
| `bash -n scripts/gate/branch_check.sh`; `lint_backend.py` on the runner with ruff 0.17.5 | syntax OK; the lane printed its count, rc 0 |

NOT_RUN locally: the full backend and Playwright suites, pixel specs - that is the runner entry check.

## Entry check

Queued on the runner: `ENTRY_TOTAL_SECS=10800 ~/gate2/branch_check.sh pilot/CR-WAVE1-COMBINED-2436 --max-wait 0`. The verdict is recorded
in a follow-up commit on this branch.

### Entry check round 1 (2026-11-13/14): NOT RUN - infrastructure

`entry_pilot-CR-WAVE1-COMBINED-2436_94ba976b8.md`: NOT RUN after 359 min in the queue, run 0 min - `git worktree add failed`. The entry log
shows `No space left on device` while checking out the engine worktree: the runner root volume was 100 % full (234 MB free; `~/work` 179 GB,
of which 43 `gate-*` worktrees 82 GB at about 2 GB each). Classified **infra**, not a test failure; no test ran. `~/gate_clean.sh` (the
owner's conservative cleanup) freed only about 2 GB (one worktree; it never touches `gate-*` or anything newer than 6 h), which is not
enough for another gate worktree, so the check was **not re-queued**. Next step for the lead: free space (for example `gate-*` worktrees of
branches already merged or abandoned), then re-queue the same command.

### Fixes from the CR-WAVE1B-COMBINED-2436 entry check (2026-11-14)

`pilot/CR-WAVE1B-COMBINED-2436` (built on this branch) came back RED with 24 failures
(`entry_pilot-CR-WAVE1B-COMBINED-2436_ffb4af2d5.md`). 22 of them come from this branch's wave-1 merges, so they are fixed here (the
other two: see that branch's note). All are test-side: each spec pinned a definition in the file it lived in before a wave-1 move.

| Failure | Cause (wave 1) | Fix |
|---|---|---|
| `unit-designtokens-297:169`, `unit-settings-cards-accordion-2402:57`, `unit-settings-intercom-cards-2401:70`, `unit-wall-phone-bar-2401:54`, `unit-wkdirect-talk-max:18`, `unit-wxmedset:48`, each on desktop / tablet / mobile (18) | CR-SETTINGS-STORE moved `DEFAULTS`, `stored_skin`, `FROZEN_SKINS` and the `_stored_*` normalisers from `routers/settings.py` to `services/settings_store.py`; the specs read only the router's text | new `frontend/tests/backend-settings-source.ts` exports both files' text (`SETTINGS_STORE`, `SETTINGS_ROUTER`); every assertion now reads the file that owns the fact (PATCH patterns / bounds: router; defaults, normalisers, frozen set: store). No assertion was removed or loosened |
| `test_gate_always_run.py::test_every_package_scanner_is_listed_or_reviewed` | CR-BE-GATES / READCONN-A / UPLOAD-SYNC added four scanners (`test_async_routes_hold_no_write_conn`, `test_async_routes_no_inline_db`, `test_get_routes_read_conn`, `test_local_auth_inventory`) without listing them | the four added to `tests/gate_always_run.json` `backend` (they walk the router registry / package / `app.routes`) |
| `test_provision_backchannel.py::test_playback_stream_source_has_backchannel_off`, `test_provision_playback.py::test_go2rtc_session_through_the_existing_engine_stays_in_the_namespace` | CR-GO2RTC-ADAPTER: a playback generation is written with `Go2rtc.create_stream` (no listing first); both tests spied only on `ensure_stream`, so the first wrote to the real (unresolvable) host and the second saw no source | both spy on `create_stream` too, with the same assertions on the written source |

Tests run (workstation, `--workers=1` / `-p no:xdist`): the six specs + `unit-tts-default-2400` + `unit-tabset-registry` through
`playwright.unit.config.ts`: 78 passed; `pytest test_provision_backchannel.py test_provision_playback.py test_gate_always_run.py`: 92 passed;
`npx tsc --noEmit`: exit 0. Re-queued: the entry check of this branch at the new head.
