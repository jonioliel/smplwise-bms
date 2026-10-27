# WISKEYA06-297 - identity source + role + scope -> admission, and the work-state mapping (board "WisKey A06", r152; WisKey W-031 / T06)

Branch `pilot/WISKEYA06-297` from tag `v2.23.2` (1b0ddd85c). Tests only (plus this note and the registry rows); no product code changed, no
migration, no setting. Fakes only: no WisKey, Home Assistant, station, door, network or runner device was touched.

Test file: `smplwise_vms/backend/tests/test_wiskeya06_297.py`.

## What the item asks

WisKey's open row W-031 (aliases `T06`, `A06-admission`, board r152) in `ALL_OPEN_CURRENT_34.json`: "Static status.active is not proof;
admitted/pending/running are not accepted. Arx verifies that the combined candidate maps service identity, role and scope to admission for
every signed direct command, with no new gate." Owner: Arx; disposition READY_ARX; implementation "partly built (WKDIRECT)".

## What was already in place (not repeated)

| Part | Where | State |
|---|---|---|
| Every signed command -> its admission gate (identity, permission, scope) | `tests/test_t06_admission_295.py`, `docs/changes/T06-ADMISSION-MAPPING-295.md` | on v2.23.2 |
| Three admission gaps closed (feature principals == actor, rename needs a decision, talk re-checks read + call) | `tests/test_w031_295.py`, `docs/changes/W031-295.md` | on v2.23.2 |
| Work states of the direct feature client (`features/start`, `features/result`, `fx.settle_feature`) | `pilot/WISKEYNEXT-297` slice A (`2a03f9130`), `docs/changes/WISKEYNEXT-297-T06-WORK-STATES.md` | NOT on v2.23.2 (branch) |

## What this slice adds

### A. The identity source is the current Arx RBAC, read at each signed command

The emergency v2 engine is given the same `Principal` object for two commands; between them the RBAC changes. The second command is refused
and never signed. Nothing about the role travels with the caller (`fx.resolve_policy` builds an `Authority` per call; `rbac._active_bindings`
drops revoked and expired rows on every read).

| Change between the two commands | Second command | Test |
|---|---|---|
| binding revoked | refused, not signed | `test_the_same_person_is_refused_on_the_next_command_once_the_rbac_changed[revoke]` |
| binding expired | refused | `[expire]` |
| binding deleted | refused | `[binding_deleted]` |
| explicit deny at the building | refused | `[deny_at_building]` |
| explicit deny at the installation | refused | `[deny_at_installation]` |
| (role) `emergency_lock` holder asks to open | snapshot carries the lock words only; open refused | `test_the_signed_snapshot_names_only_what_the_current_rbac_grants_on_the_station` |

### B. EMROLE on the signed emergency command (the rows the T06 note left open)

T06 (`T06-ADMISSION-MAPPING-295.md`, "Local-identity exception") recorded that EMROLE was not in its candidate and "needs its own admission
rows when it lands". EMROLE landed in 2.20.0. World: site `s1`, building `b1` holds station `st-a`, building `b2` holds `st-b`.

| Identity | Role / how it was given | Scope | `features/start` (emergency v2, open) | Test |
|---|---|---|---|---|
| guard (person) | `emergency_open`, granted by a security manager through `POST /doors/emergency/grants`, 8 h | building `b1` | `st-a` admitted (actor = the guard, snapshot names `st-a` only); `st-b` refused | `test_a_guard_granted_by_a_security_manager_at_a_building_is_admitted_on_that_buildings_station_only` |
| security manager | `security_manager` (`emergency.open.grant`) | building `b1` | refused (the grant right is not an open right); a grant at `b2` is refused `grant_not_allowed` | same |
| guard after revoke | revoked through `POST /doors/emergency/grants/{id}/revoke` | - | refused | `test_a_revoke_through_the_grant_module_stops_the_next_signed_command` |
| temporary guard | granted by a system administrator, 1 h, then lapsed | building `b1` | refused at use time (no sweeper) | `test_an_emrole_grant_that_lapses_is_refused_at_use_time_without_a_sweeper` |
| local (Arx-only) identity | its one role `operator` + the `emergency_open` addition; refused without an expiry (`expiry_required`) | building `b1` | `st-a` admitted; `st-b` refused; refused after the expiry | `test_a_local_identity_holds_the_emergency_role_as_an_addition_only_with_an_expiry_and_only_on_its_scope` |

### C. Work states outside the feature client

The words `admitted`, `pending`, `running`, `accepted`, `active`, `queued`, `in_progress`, `started`, `ok`, `success`, `done`, `true`, and a
static `status.active` / `active: true` flag:

| WisKey answer | Arx reader | Mapping | Tests |
|---|---|---|---|
| `door_open` / `door_open_status` answer (direct or wrapped in HA's `service_response`), and `stored_result.outcome` | `trusted_door.classify` | any of the words, or a status flag without the closed `acknowledged`: `unknown` (never `sent`); `sent` only for `acknowledged` of THIS request id; another request id or none: `unknown` | `test_a_door_answer_with_a_work_state_word_is_unknown_never_sent`, `test_a_static_active_status_on_a_door_answer_is_never_proof`, `test_only_the_closed_acknowledgement_of_this_request_is_sent` |
| native people-write receipt (`wiskey-native-peer-source.v2`) | `wiskey_native_write.verify_receipt` | `central_state` other than `committed`: `receipt:state`; `device_application` other than `unknown` (also `applied`, `delivered`, `confirmed`): `receipt:state`; an extra `active` / `status` / `accepted` / `execution_result` key: `receipt:fields` - the write is `unknown`, never `committed` | `test_a_native_write_receipt_in_a_work_state_is_not_a_committed_write`, `test_a_native_write_receipt_never_claims_a_device_application`, `test_a_native_write_receipt_with_a_status_flag_is_refused_whole` |
| people-CSV `finished.receipt` | `wiskey_people_csv.read_receipt` | a job state outside `paused / running / completed / completed_with_errors / cancelled`: unreadable; a row counts only when its state is `central_committed`; `running` is reported as `running`; `device_application` stays `unknown`; a status flag or a device claim: unreadable | `test_a_people_csv_receipt_with_a_job_state_outside_the_closed_set_is_unreadable`, `test_a_people_csv_row_counts_as_committed_only_when_wiskey_says_central_committed`, `test_a_running_csv_job_is_reported_as_running_and_never_as_device_proof` |

## Findings

None new. Every row above held on v2.23.2 without a product change.

## Tests run

`cd smplwise_vms/backend && C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/test_wiskeya06_297.py -q -p no:cacheprovider` on the
Windows workstation (fakes only): 88 passed. Regression on the same base: `tests/test_t06_admission_295.py tests/test_w031_295.py
tests/test_door_emergency_roles_emrole_295.py`: 87 passed, 3 xfailed (the remaining strict FINDING xfails of T06).

NOT_RUN: anything against a real WisKey / Home Assistant / station / door; the full backend suite (no product code changed); the WISKEYNEXT
slice A tests (not on this base).

## Open for the lead

- When `pilot/WISKEY-OWNER26-297` lands, its automation sender (`wiskey_auto_door.py`) is a second `features/result` caller: its completion read
  needs a row in the WISKEYNEXT work-state matrix, and its door command an admission row in the T06 table (`test_every_signed_command_in_the_code_has_a_row_and_a_documented_gate` will fail until it has one if it adds a command).

## Rollback

Delete the test file, this note and the registry rows. No migration, no setting, no product code.
