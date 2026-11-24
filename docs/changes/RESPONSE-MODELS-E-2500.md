# RESPONSE-MODELS-E-2500 - RESPONSE-MODELS-E-2480 brought onto v2.48.0, the two real wire gaps fixed

Branch `pilot/RESPONSE-MODELS-E-2500` = merge of `origin/pilot/RESPONSE-MODELS-E-2480` (`6bf65de99`) into `origin/main` (v2.48.0,
`d6f09395e`). Target 2.50.0. The row itself (the ratchet, `ExactModel`, 299 modelled routes in 51 routers) is described in
`docs/changes/RESPONSE-MODELS-E-2480.md`; this note covers only the re-base, the classification of the failed runner run and the fixes.
No route, status code, key or value changed; no migration; no version bump; no UI change (generated type files only).

## 1. Merge onto origin/main

Three conflicts, all on the same import line: `routers/ha.py`, `routers/health.py`, `routers/wiskey_installer_clock.py`. Main added
`from ..test_reset import register_reset` (CR-SINGLETONS-REST-2480); the branch added `from ..wire import <module> as W` and
`from ..wire import wire`. Both kept. No other conflict; main's other changes in these three routers are `register_reset` seams only.

## 2. The runner run at 6bf65de99 (`~/work/respe2480-results`, 2026-11-23 09:13-11:16 UTC) classified

Totals: shard_00 1 failed (INTERNALERROR, the shard died), shard_01 13 failed / 919 errors, shard_02 38 failed / 690 errors, shard_03
3 failed / 831 errors (55 failed, 2,440 errors). The server's disk was full that night.

| Group | Count | Class | Evidence |
|---|---|---|---|
| shard_00 died at its first file | 1 failed, whole shard not run | ENVIRONMENTAL | `INTERNALERROR ... OSError: [Errno 28] No space left on device` (pytest could not write its own output) |
| setup errors | ~2,440 errors | ENVIRONMENTAL | `OSError: could not create numbered dir with prefix ... in /tmp/respe2480-shard_*`, `[Errno 28] No space left on device`, `sqlite3.OperationalError: database or disk is full` / `disk I/O error` in `tests/db_template.py` |
| `test_access.py` (2), `test_anchor_coverage.py`, `test_backpressure.py` (5), `test_alignment_controller.py` (2), `test_alignment_lock_order.py`, `test_alignment_staging.py` (2) | 13 | ENVIRONMENTAL | `database or disk is full`, `disk I/O error`, `No space left on device`, a missing file under the full `/tmp` |
| `test_bridge_config_service.py` | 25 | ENVIRONMENTAL | `[Errno 28] No space left on device: '/tmp/fake-ha-config-*'` |
| `test_bill_pdf.py` (9), `test_energy_integration.py::test_engine_self_check_reports_the_real_engine` | 10 | ENVIRONMENTAL | weasyprint could not load: `No usable temporary directory found in ['/tmp', ...]`, so the auto engine fell back to fpdf2 and the golden PDFs differ |
| `test_media_bulk.py::test_a_bulk_power_off_arms_the_remote_power_gate` | 1 | ENVIRONMENTAL | `KeyError: 'code'` on a 500 answer; the captured log shows `sqlite3.OperationalError: unable to open database file` |
| `test_templink_2320.py::test_5a_a_whatsapp_link_over_the_limit_is_skipped_and_audited_and_nothing_is_sent` | 1 | ENVIRONMENTAL | `assert (0 == 1)` on the skipped count during the disk-full window; no route of this row is involved, and the file passed in shard s03 of this branch (section 4) |
| `test_get_routes_read_conn.py::test_converted_get_answers_while_the_write_lock_is_held[GET /api/v1/ha/entities]` | 1 | REAL | `ResponseValidationError: ('response', 'sync', 'last_snapshot_at') string_type, input None` |
| `test_get_routes_read_conn.py::test_converted_get_answers_while_the_write_lock_is_held[GET /api/v1/intercom/calls]` | 1 | REAL | `ResponseValidationError: ('response', 'calls', 0, 'outcome')` and `(..., 'ended_at')` `string_type, input None` |

## 3. The fixes

- `smplwise/wire/ha.py` `HaEntitiesSync.last_snapshot_at: str | None` - `sync` is `ha_sync.STATE.as_dict()`, whose stamp is null until the
  first Home Assistant snapshot (`SyncState.__init__`). `HaStatusSync` (the same dict under `GET /ha/status`) already declared it so.
- `smplwise/wire/intercom_calls.py` `IntercomCallsCallLogCall.outcome: str | None`, `ended_at: str | None` - both are null while the call
  rings or is in progress (`migrations/0197_intercom_calls.sql`: `outcome` nullable, `CHECK ((state = 'ended') = (ended_at IS NOT NULL))`;
  `services/intercom_calls.Call` defaults both to `None`; the call log merges the live calls from memory).
- Types widened only: no key dropped. Frontend: the generated types are not consumed by hand-written code for these two routes; the
  hand-written readers already treat the values as optional. `frontend/src/api/generated/wire-ha.ts` and `wire-intercom-calls.ts`
  regenerated.
- Regression test `tests/test_wire_routers_e_2480.py::test_the_states_before_a_snapshot_and_before_a_call_ends_are_declared` (strict).

## 4. Tests actually run

Server (Linux test runner), branch at `54bc7c122` (merge + fix + regenerated types; only this note was added after it), nice 19 via
`~/work/slotb.sh`, one pytest process per shard (`-o addopts=`, `-m "not timing_lane"`, `SW_WIRE_STRICT=1` from conftest). The 1,076
backend test files were split round-robin into 8 shards (`ls tests/test_*.py | sort | split -n r/8`). The server rebooted at 05:54 UTC
and its disk filled to 100 % twice during the day (other jobs); only runs that neither event hit are counted.

| What | Result |
|---|---|
| `scripts/gen_wire_types.py` (write), then `--check` | wrote `wire-ha.ts` and `wire-intercom-calls.ts`; `--check` rc 0 |
| `scripts/wire_ratchet.py` | every count equals its baseline (901 unmodelled JSON routes in 119 router modules), rc 0 |
| frontend `tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | rc 0 / rc 0 |
| ruff `--select F,E402` on the changed wire / router / test files | all checks passed |
| backend shard s01 (130 files) | 2886 passed, 5 skipped, 0 failed |
| backend shard s02 (130 files) | 6022 passed, 4 skipped, 3 xfailed, 1 FAILED: `test_db_gate.py::test_a_waiting_writer_is_handed_the_lock_on_release_and_times_out_as_locked` (lock hand-over took 1.29 s, limit 0.5 s, under nice 19 on a loaded box). The file re-run alone: 31 passed |
| backend shard s03 (130 files) | 2971 passed, 6 skipped, 0 failed (includes `test_templink_2320.py`, `test_wire_routers_b_2450.py`) |
| backend shard s04 (130 files) | 5133 passed, 1 skipped, 0 failed (includes `test_intercom_calls_2382.py`, `test_wire_routers_c_2470.py`) |
| backend shard s05 (130 files) | 5736 passed, 1 skipped, 0 failed (includes `test_get_routes_read_conn.py`: both routes from section 3 now answer. Also includes `test_wire_routers_d_2470.py`) |
| backend shard s00 (130 files) | 4822 passed, 8 skipped, 1 FAILED: `test_intercom_messaging.py::test_a_text_that_may_not_go_is_refused_before_wiskey_hears_of_it[body6-...]`. The test asserts that the code `4821` never appears in the audit rows; it matched by chance inside a random hex digest (`...6ad48219bf...`), so this is not a leak. Re-run on the workstation: 15 passed. The shard also includes `test_bill_pdf.py` and `test_wire_ratchet_2480.py` |
| backend shard s07 (130 files) | 6881 passed, 51 ERRORS, all `sqlite3.OperationalError: database or disk is full` during setup (disk at 99-100 %). ENVIRONMENTAL; re-run queued |
| backend shard s06 (130 files: `test_wire_routers_e_2480.py`, `test_ha.py`, `test_ha_authority.py`, `test_media_bulk.py`, `test_energy_integration.py`, ...) | NOT_RUN (queued behind the 2.50.0 gate) |
| targeted set t0 (36 files) | the first attempt was destroyed by the full disk (log truncated, rc 120), so it is not counted; re-run queued |
| workstation: `test_wire_routers_e_2480.py -k "states_before_a_snapshot or aliased"` | 2 passed |

Counted shards s00-s05: 27,570 passed, 0 real failures (2 flaky failures, both green on re-run). Still to run: s06, s07's 51 disk-full
setups, and t0. All are queued on the runner; results go to `~/work/respe2500-results/progress.txt`.
NOT_RUN: frontend unit / Playwright / pixel specs (no UI change; generated types only), ESLint, the runner entry check.

## Boarding

Not yet. The 6 of 8 shards that ran (27,570 tests) left no real failure. Shard s06 has not yet run green on the runner, and it holds
`test_wire_routers_e_2480.py`, this row's block test. The 51 disk-full setups of s07 have not either. Recommendation: board the next
train (2.51.0) once s06, s07 and t0 are green; they are queued. The 2.50.0 train was already in its gate when these runs finished.
