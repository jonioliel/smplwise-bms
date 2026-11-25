# WISKEY-NOFALLBACK-2-2530 - no transport switch after a v2 refusal in the capture lease and the grant engine (WB-01, same root)

Branch `pilot/WISKEY-NOFALLBACK-2-2530`, cut from `origin/pilot/WISKEY-NOFALLBACK-FIX-2520` (`76ee24bcb`). Target version: 2.53; must land
before the bridge-key rotation block (`bridge_rotation.wiskey_present`) is lifted in 2.54.
Source: deep review 2.52, area WISKEY-BRIDGE (`docs/review/DEEP-REVIEW-2520-WISKEY-BRIDGE.md` on `origin/review/DEEP-2520-WISKEY-BRIDGE`),
finding **WB-01** ("Same root for the grant engine ... and for the capture lease"), and open question 2 of
`docs/changes/WISKEY-NOFALLBACK-FIX-2520.md` (recommendation a: route both through `DirectJoin.v2_refusal`). Rule: WisKey rc19 / rc20 R2
`transports.selection` ("never downgrade or switch transport automatically after refusal or UNKNOWN"),
`transport_authentication.fallback_after_key_refusal: false`; v1 / rc10 unchanged.
Status: implemented and unit-tested against in-memory fakes only. Backend only. No lab, no Home Assistant, no WisKey contact, nothing installed.

## 1. What was wrong

WISKEY-NOFALLBACK-FIX-2520 fixed the people routes. Two more selectors had the same "not selected -> the other transport" shape, both
dormant today (the capture lease cannot go live: `capture_lease.GO_LIVE_PERMITTED` is False; the grant engine refuses every write while
`access_grants.GO_LIVE_PERMITTED` is False, and no service writer has a journal connection in production):

- `wiskey_direct_join.SelectingLeaseTransport._pick`: `direct if join.selected(command) else fallback` - after a v2 connect / discovery /
  pairing refusal (or an unknown connect) the signed lease message went to the bridge transport (`BridgeLeaseTransport`, Home Assistant
  `smplwise_bridge.lease_*`).
- `access_service_writer.select_path`: not selected -> `service_channel / direct_not_selected` - after a v2 refusal the grant engine's
  people write went over the local service channel.

## 2. What changed

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_direct_join.py` | `_v2_refusal_of` renamed `v2_refusal_of` (public; the same body, the ONE helper: a configured join's `DirectJoin.v2_refusal`) - its two callers (`people_send`, `people_path`) updated. `SelectingLeaseTransport._pick`: not selected and `v2_refusal_of(join, command)` answers -> raises `v2_refused_lease_error(code)` = `ApiError(503, V2_REFUSED_LEASE_CODE = "wiskey_direct_v2_refused", capture_lease.UNAVAILABLE_TEXT, details={outcome: not_sent, error: <v2 code>})`, not retryable; the bridge transport and the direct transport are never called; `refusals` / `last_refusal` ({command, code, at}) recorded, one log line. Otherwise byte for byte as before. Module note. The error is built here and NOT in `wiskey_capture_direct.py`: that file is source-hash pinned as the receiver chain WisKey mapped against (`test_wk4adopt_295::test_w005_the_arx_receiver_chain_is_the_one_mac_mapped_against`) and stays unchanged. |
| `smplwise_vms/backend/smplwise/routers/access_control_door.py` | `_NOT_SENT_CODES` += `wiskey_direct_v2_refused`: the capture routes (start / confirm / cancel) read it as "nothing was sent" (lease destroyed `start_refused`, audit `not_sent wiskey_direct_v2_refused`), never as an unknown outcome (which would hold the station). One line. |
| `smplwise_vms/backend/smplwise/services/access_service_writer.py` | `PATH_REFUSED = "refused"`, reason `direct_v2_refused` (added to `PATH_REASONS`), `PathChoice.code` (default None - existing equality unchanged). `select_path`: not selected, action in `SERVICE_WRITE_ACTIONS` (users/create, users/update) and `v2_refusal_of(join, None)` answers -> `PathChoice(refused, direct_v2_refused, code=<v2 code>)`. `record(path, reason, code=None)`: a refused choice increments `refusals` and sets `refused_code` / `refused_at` and logs; `path` / `reason` / `writes` / `fallbacks` stay the last real write (the readiness line is unchanged). `last_path()` gains the three keys (additive). |
| `smplwise_vms/backend/smplwise/services/access_grant_engine.py` | `WiskeyServiceEngine._write`: records the choice with its code; `PATH_REFUSED` -> `EngineError("not_sent", <v2 code>)` before anything is sent. The worker's existing not_sent handling applies (provision / revoke retried on the next pass, the link-create journal records the code). Docstring. |
| `smplwise_vms/backend/tests/test_wiskey_nofallback_2_2530.py` (new) | 14 tests, below. |

Not changed: the rule itself (`DirectJoin.v2_refusal`, `selection_refusal`, `V2_NO_FALLBACK`), `people_send` behaviour, `lease_events`,
`BridgeLeaseTransport`, the capture routes' code, the readiness check, the emergency engine, the door automation sender, the bridge.
No setting, no migration, no route, no wire model, no UI, no new user text (the lease refusal reuses `capture_lease.UNAVAILABLE_TEXT`, which has its English). Rollback: revert.

### What is refused now, and what keeps the existing path

| with a v2 (rotated) key, direct not selected because ... | capture lease message | grant engine write |
|---|---|---|
| a v2 connect / hello / identity / reply refusal, the 60 s back-off after it, an unknown connect, a v2 discovery / pairing refusal or failure (exactly `DirectJoin.v2_refusal`) | refused `not_sent wiskey_direct_v2_refused` (details.error = v2 code) | users/create, users/update (revokes included): `EngineError(not_sent, <v2 code>)`; cards/add, cards/remove, users/delete: service channel as before (no contract version carries them directly - nothing to switch from; open question 1) |
| unreachable, not yet tried, command not discovered, clock window, join stopping | bridge transport, as before | service channel, as before |
| provider `local` / no join / a join object without `v2_refusal` | as before | as before |

With a v1 key (pairing secret / `g0-legacy`; WisKey rc10, the lab) `v2_refusal_of` is always None: both selectors are byte for byte as before.

## 3. Tests (real results)

PC only, one pytest process per file, the main checkout venv (`C:\cloude\smplwisebms\.venv`) importing this worktree's `smplwise`
(verified: `smplwise.__file__` in the worktree), in `smplwise_vms/backend`.

| command | exit | result |
|---|---|---|
| `python -m pytest -rA -p no:cacheprovider tests/test_wiskey_nofallback_2_2530.py` (final code) | 0 | **14 passed** |
| the same file with the product files reverted to the base (stash) | 1 | 13 failed, 1 passed (the one that passes pins the unchanged choice for a join without the v2 rule; the v1 / unreachable tests fail on the base only because they also read the new `refusals` / `v2_refusal_of` names) |
| `python -m pytest -p no:cacheprovider -o addopts= -q tests/<file>.py`, untouched files: see the list below | see below | see below |
| `py -3.12 -m ruff check` on the four product files + the new test file | 0 | all checks passed |
| runner (slot B), full backend suite, Playwright | - | **NOT_RUN** (backend-only row, no UI; the train gate runs the full suites) |
| real WisKey / bridge / lab | - | **NOT_RUN** by rule (the lab is v1 / rc10, where nothing here applies) |

Untouched neighbouring files, final code unless marked (one process each, `python -m pytest -p no:cacheprovider -o addopts= -q tests/<file>.py`):

| file | result |
|---|---|
| `test_wiskey_nofallback_2520` | 19 passed |
| `test_wiskey_direct_v2_2520` | 39 passed (first version of this change) |
| `test_wiskey_service_grants_v3_2520` | 58 passed (first version) |
| `test_externalbuild_297` | 32 passed |
| `test_wkjoin_295` | 23 passed |
| `test_wkr5_295` | 31 passed |
| `test_wkr5_295_writer` | 11 passed (first version) |
| `test_wk4adopt_295` | 44 passed (the first version, which edited `wiskey_capture_direct.py`, failed its receiver-chain hash pin - hence the error now lives in `wiskey_direct_join.py`) |
| `test_wkcap_295` | 42 passed |
| `test_wkcapwire_295` | 37 passed (first version) |
| `test_wiskey_owner26_callers_297` | 20 passed |
| `test_wiskey_join_live_2382` | 38 passed |
| `test_smallfixa_lease_hold_295` | 13 passed (first version) |
| `test_capture_lease_events` | 20 passed (first version) |
| `test_intercom_capture_lease` | 15 passed (first version) |
| `test_error_contract_inventory_2490` | 7 passed |
| `test_adoptr6_295` | 25 passed |
| `test_wkpeer_295` | 109 passed |
| `test_wkv2_295` | 153 passed |
| `test_wiskey_door_gate` | 11 passed |
| `test_wiskey_door_path` | 18 passed |
| `test_fake_doorwin_closed_rule_sr1` | 5 passed |
| `test_capmap_295` | 1 failed, 64 passed - **inherited**: `test_the_receiver_source_is_the_one_the_vectors_were_made_from` pins `services/ha_bridge.py`, not touched here |
| `test_t06_admission_295` | 1 failed, 62 passed, 3 xfailed - **inherited**: `test_the_only_modules_that_reach_a_signing_call_are_the_known_ones` lists an extra `wiskey_schedule_reads.py`, not touched here |
| `test_wiskeyarx_291` | 1 failed, 51 passed - **inherited**: `test_n07_arx_sends_api_contract_one_or_omits_it` flags `wiskey_station_ops.py`, not touched here |

The three inherited failures name files outside this diff (`git diff --name-only`: the four product files above + the new test + this
note); they come with the base (`release/2520-train` rows) and are for the train lead.

## 4. Open questions (recommendation first)

1. Grant engine, cards / deletion after a v2 refusal. a) keep them on the service channel - no contract version (v1 / v2 / v3) carries
   them on the direct path, so a v2 refusal switches nothing for them, and a card removal (a revocation) is not blocked (recommended)
   b) refuse every engine write while the v2 path is refused (strictest; also blocks card removals and deletions until the pairing is fixed).
2. Grant engine, a service write after a v2 refusal when no service writer would have been available anyway (today: always - no journal
   connection in production). a) refuse anyway - "not selected because v2 refused" is final whatever would have followed; the decision
   cannot be made without the connection (recommended) b) refuse only when a writer is installed (keeps today's channel write, but the
   choice then depends on state the refused connection cannot prove).
3. Capture lease audit detail. The capture routes and the lease worker audit `exc.code` (`wiskey_direct_v2_refused`); the exact v2 code
   is in `details.error`, the log line and `SelectingLeaseTransport.last_refusal`, not in the audit row. a) keep - the class of the
   refusal is audited, no route change (recommended) b) a follow-up that also records `details.error` in the capture audit rows.
