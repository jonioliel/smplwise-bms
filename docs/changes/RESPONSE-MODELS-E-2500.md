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
| `test_templink_2320.py::test_5a_a_whatsapp_link_over_the_limit_is_skipped_and_audited_and_nothing_is_sent` | 1 | see section 4 | `assert (0 == 1)` (the audit row count); no route of this row is involved |
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

RESULTS_PENDING

## Boarding

BOARDING_PENDING
