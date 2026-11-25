# WISKEY-SCHED-READS-2520 - WisKey's signed schedule inspection jobs (`wiskey-schedule-reads.v1`), adopted explicitly

Branch `pilot/WISKEY-SCHED-READS-2520`, cut from `origin/release/2520-train` `b5604b743` (R1-R7, R5, the channel registry and the
B2-ABI pieces already merged). Target version: 2.52. Owner / lead decisions applied: B2-ABI = a (settled), A2 deferred to 2.53,
PAIRING-Q2 = a. Status: implemented and tested against fakes only. Nothing installed, no lab, no Home Assistant, no WisKey contact.

## 1. Inputs (read only; the WisKey checkout was not modified)

| what | identity |
|---|---|
| WisKey PRODUCT rc20 | `dcebb9f34c8f95638e498115a2aeb5ce2711981e` - `docs/contracts/schedule-reads-v1/` (README.md, start / status / result schemas); source read for facts only: `bridge_command_auth.py` (the two commands dispatched only for a signed pairing principal, no peer row), `websocket.py` (`pairing_authentication_required` on the classic socket, even for an HA owner), `direct_bridge_discovery.py` (`business_contracts` names both commands `{"contract": "wiskey-schedule-reads.v1"}`), `docs/integrations/WISKEY_VMS_PANEL_COMMANDS.json` (the business keys), `tests/ha/test_arx2520_adoption.py` (read, not run). |
| WisKey hand-off | `57e4615e0b943638b7e6cdcd4565c183e559483e` `docs/owner-development-2026-11-25/mac-arx-adoption/FORWARD_TO_ARX_HE.txt` (4.2: both B2 commands appear in the signed pairing identity's command list; 4.5: "adopt the B2 ABI explicitly") and `CONTRACT_INDEX.json` (`new_ABI: docs/contracts/schedule-reads-v1`). |

## 2. What the contract requires and how Arx meets it

| requirement | where | how |
|---|---|---|
| discover both commands for the current identity; send nothing if not listed | `JoinPort.support` | both `schedules/read_start_v1` and `schedules/read_status_v1` must be selected on the CURRENT direct connection (its discovery lists them for the connection's service subject) AND its `business_contracts` must name each exactly `{"contract": "wiskey-schedule-reads.v1"}`. Otherwise `unsupported` (`not_listed` / `contract_mismatch`) or `unavailable` (no direct join, not selected, not connected, discovery missing): no row, no frame. No version-label inference, no fallback to the synchronous read. |
| UUID created and PERSISTED before start | `start()` | canonical lowercase UUID; the row (`state = sending`, requester, action, station / plan, requested revision) is committed in its own transaction (`write_aside`) BEFORE the frame; a test reads the row from inside the transport call. |
| start once; a lost start reply = UNKNOWN, checked only via status | `start()` / `status()` | the transport's outcome contract: `not_sent` (proven no byte) -> `not_sent`; a verified refusal with a definite code -> `refused`; everything else (timeout, lost connection, unverifiable or out-of-contract reply, a refusal whose code says nothing about admission: `bridge_outcome_unknown`, `Unauthorized`, ...) -> `unknown`. There is no code path that sends start for an existing row; a new operator start makes a NEW UUID. A row left `sending` by a crash becomes `unknown` (`start_outcome_lost`) after 120 s. |
| each status read: fresh signed proof, timeout <= 58 s | `status()`, `check_timeout` | each call is a new `DirectLink.call_command` frame (fresh nonce, its own 10 s window); `0 < t <= 58` checked before anything is persisted or sent (`timeout_exceeds_abi`, not_sent) - start 10 s, status 15 s. Tested over real signed frames: a status 11 s after the start (start proof expired at the server's clock) carries a valid fresh proof. |
| keep the returned plan revision | `project_completed` | `revision` of a plan result (`plan_preview`, `plan_recheck`), `plan_revision` of a claim preview, stored as returned (tested: larger, equal and smaller than requested) next to the requested revision. |
| closed schemas, undeclared keys reject the whole | `check_start`, `check_status`, `read_result` | start: exactly `{request_id, command, parameters}`, one of the six operations, exactly that operation's parameter set with strict JSON types (a bool is not an integer); recursive `schedules/read_start_v1`, `operations_decide_v1`, `users/create` refused. Result: exactly the ten keys, the constants (`contract`, `scope`, `history_complete: false`, `replay_available: false`, `max_status_wait_seconds: 0` as an integer), the status / operation enums, the asked request id, the started operation (null only with `unknown`). Any deviation -> `contract_mismatch`: a start becomes `unknown` (it was sent), a status read changes nothing. |
| this is a READ; A2 stays deferred; no self-approval | module scope | the six inspection operations only; nothing confirms, deploys, approves, grants or executes. The existing deploy warning (`deployWritesOff`) is unchanged; legacy schedules are never shown as open. |
| `unknown` never means no effect; a known result is never downgraded | `status()` | a WisKey status `unknown` (restart / eviction / never admitted) keeps the row UNKNOWN (`status_unknown`), never "not sent"; a final row (`completed`, `refused`, `not_sent`) is not read again, so an eviction cannot turn a result back into unknown. |
| a genuine pairing principal only | transport | the commands go only over the installed direct join's signed connection; they are on no WebSocket channel of the live Home Assistant session (WisKey refuses them there). |

## 3. Files

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_schedule_reads.py` (new) | the cycle, schemas, `JoinPort` over `wiskey_direct_join.installed()`, persistence, projection (reuses `wiskey_schedule_writes.project_*`, tokens removed recursively). |
| `smplwise_vms/backend/smplwise/migrations/0225_wiskey_schedule_reads.sql` (new) | table `wiskey_schedule_reads` (ids, action, subject, revisions, state, codes, closed result JSON, requester, times). Additive; renumber at the train if 0225 is taken. Rollback: drop the table. |
| `smplwise_vms/backend/smplwise/routers/access_control_schedule_reads.py` (new) | `GET /access-control/schedules/reads`, `POST /access-control/schedules/reads` ({action, parameters}), `POST /access-control/schedules/reads/{request_id}/status`. Gate: the schedules administrator (the synchronous device reads' gate, audited 403). Arx value checks (station id, UUIDs, revision range, WisKey's draft normalisation, the bindings model), served-copy station online check, Arx's device-read limits. Start audited `intercom.schedule_read_start`. |
| `smplwise_vms/backend/smplwise/wire/access_control_schedule_reads.py` (new), `frontend/src/api/generated/wire-access-control-schedule-reads.ts` (generated) | response models. |
| `smplwise_vms/backend/smplwise/routers/__init__.py`, `scripts/gen_wire_types.py` | one mount line, one wire family line (registry changes allowed in this row). `services/wiskey_channels.py` is NOT changed: these are signed direct-envelope commands, not WebSocket channel commands (R1's own finding for `service_grants/current_v3` / `direct/pairing_status_v2`). |
| `frontend/src/components/wk-schedule-reads.ts` (new), `frontend/src/components/wk-schedule-library.ts` (+2 lines) | the block "קריאות לוחות זמנים מהעמדה" in the schedule library's management view, under the plans / jobs cards: support line, station picker + "קריאת מוכנות" / "קריאת תלויות" (only when supported), the newest five rows with honest badges, "בדיקת מצב" for accepted / running / unknown rows only. Existing components and tokens only (`sw-card`, `sw-badge`, `sw-dropdown`, `wk-action-button`); no new colours or sizes; no inner scrolling. |
| `frontend/src/api/schedule-reads.ts`, `frontend/src/access-control/schedule-reads-logic.ts` (new) | calls and pure rules. |
| `frontend/src/i18n/schedule-editor.ts`, `frontend/src/i18n/lang/en/i18n/schedule-editor.ts` | `sr_*` strings, Hebrew and English. |
| tests | `smplwise_vms/backend/tests/test_wiskey_schedule_reads_2520.py`; `frontend/tests/unit-schedule-reads-2520.spec.ts`, `evidence-wiskey-schedule-reads-2520.spec.ts`, `pixel-wiskey-schedule-reads-2520.spec.ts` (+ Linux baselines), `schedule-writes-mocks.ts` (the reads routes; default `unsupported`). |

## 4. Tests (real results)

| command | where | exit | result |
|---|---|---|---|
| `python -m pytest -q tests/test_wiskey_schedule_reads_2520.py` (repo venv) | PC | 0 | 73 passed |
| `py -3.12 -m ruff check` on the 4 new Python files | PC | 0 | all checks passed |
| `gen_wire_types.py --check`, `wire_ratchet.py` | PC + runner | 0 / 0 | generated files match; 897 unmodelled = baseline (the 3 new routes are modelled) |
| runner slot B (`~/work/slotb.sh ~/work/sr_run.sh`, head `bc4c5a942`), backend one process per shard: | | | |
| - `tests/test_wiskey_schedule_reads_2520.py` | runner | 0 | 73 passed |
| - `tests/test_wkjoin_295.py tests/test_wiskey_direct_v2_2520.py` | runner | 0 | 62 passed |
| - `tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_wiskey_rc10_pin.py tests/test_calendar_attendees_2343.py` (registries, migration sequence) | runner | 0 | 174 passed, 8 skipped |
| - `tests/test_wire_routers_b/c/d/e`, `test_wire_consumption_2450`, `test_error_envelope_family2_2500` | runner | 0 | 413 passed |
| - `tests/test_get_routes_read_conn.py test_local_auth_inventory.py test_plan_routes_unique.py test_secfix2_pub07_guard_first.py test_gate_always_run.py test_capabilities.py test_singletons_registered.py test_raw_body_order.py` | runner | 1 | 819 passed, **1 failed**: `test_gate_always_run::test_every_package_scanner_is_listed_or_reviewed` names `test_wiskey_system_status_2520.py` (R1's file, already on the train base) as unlisted - not this row's file; this row's test file is not flagged. Belongs to the train / R1. |
| - `tests/test_wiskey_schedule_writes.py` | runner | 1 | 23 passed, **1 failed**: `test_audit_rows_name_the_actor_and_resource_and_never_a_token_or_a_window` asserts the text `07:00` (a draft window) is absent from the audit rows; the run happened at 13:06:45 UTC and an envelope's `expires_at` was `...13:07:00Z`, which contains `07:00`. A clock-dependent false positive of the existing test (this row changes neither the writes router nor that test); it passes at any other minute. Not re-run (slot B queue was ~3.5 h). |
| - frontend `tsc --noEmit -p .` / `-p tsconfig.tests.json` | runner | 0 / 0 | 0 errors / 0 errors |
| - `eslint` on the 10 changed / new frontend files | runner | 0 | clean |
| - `playwright -c playwright.unit.config.ts tests/unit-schedule-reads-2520.spec.ts` | runner | 0 | 6 passed |
| - `npm run build` | runner | 0 | built |
| - `tests/evidence-wiskey-schedule-reads-2520.spec.ts` desktop + mobile | runner | 0 | 8 passed (images in `docs/design/evidence/wiskey-schedule-reads-2520/`) |
| - `tests/pixel-wiskey-schedule-reads-2520.spec.ts` desktop + mobile, light + dark: `--update-snapshots=all`, then re-check | runner | 0 / 0 | 8 passed / 8 passed (8 Linux baselines committed) |
| - existing `pixel-wiskey-schedule-writes`, `evidence-wiskey-schedule-writes`, `layout-audit30wk-components` (check, unchanged baselines) | runner | 0 | 31 passed, 1 skipped |
| full backend suite, full Playwright | - | - | **NOT_RUN** (not in this row; the train gate runs them) |
| real WisKey rc20 / lab / bridge | - | - | **NOT_RUN** by rule |

Compare page (Hebrew, before / after, desktop + phone, light + dark): `private/planning/wiskey_sched_reads_compare_2026-11-25.html`
(main checkout, not in git).

## 5. Not done / limits

- Real WisKey rc20, the lab, the bridge: NOT_RUN by rule. The lab has WisKey rc.10: both commands are not listed there, so the block
  says "unsupported" and nothing is sent - the tested path.
- The UI starts the two station-only reads (readiness, dependencies). The backend accepts all six operations; assess / plan preview /
  plan recheck / claim preview from the UI stay with the existing synchronous preview flow, because WisKey binds every preview token to
  the actor that asked: a token issued to the pairing principal could not be used by the existing writes (open question 1).
- The synchronous device reads (`/schedules/actions/{readiness,...}`) are unchanged.
- v2 transport: the ABI rides whatever protocol the join's connection has (R7's v2 path with kid when the key is rotated). Only v1
  frames were exercised end to end here; the v2 cap / kid rules are R7's tests.

## 6. Open questions

1. UI scope: a) keep the UI to the two station reads now; plan / claim inspections via the signed ABI later, once the preview flow is
   redesigned around pairing-bound tokens (recommended) b) expose all six now as display-only results.
2. Status refresh: a) one click per status check, no polling (recommended: nothing runs by itself) b) poll every few seconds while
   the block is open.
3. Migration number 0225: a) keep, renumber at the train if another row takes it (recommended) b) reserve now in the train.
