# WIRE-DRIFT-2550 - four response-contract drifts from the lab log (target 2.55)

## What and why

The lab (2.53.0, overnight) logged four `response contract drift` errors from `smplwise.wire`: the answers went out unchanged
(production falls back to the route's own dict), but the declared response models did not describe what the routes really answer.
In each case the payload is right and the model was wrong (written from a recorded answer where every value was set). The fix is in the
models only, additive per ADR-015: missing keys declared, nullable where the projection yields null. No route, service or payload change.

| Lab error | Real shape (source) | Model fix |
|---|---|---|
| `AccessControlReadsStationsStationZone`: undeclared `delta`, `end`, `standard`, `start` | WisKey `clock.device_zone()`: a `kind: "device"` zone also carries `standard` / `delta` (seconds) and `start` / `end` (`[month, week, weekday, second]`, null without DST); passed through raw by `intercom_sync._station` / `project_overview` | the four keys declared with defaults (`exclude_unset`: still absent on an IANA zone) |
| `AccessControlReadsEventsEventsRecord`: `door: int_type` | `intercom_adapter.project_event`: `door` is 1 or 2, else null (a ring / station-level event, any other value; never a string) | `door: Num \| None`; `timestamp`, `received_at`, `time_source` nullable too (`_iso` / `_enum` give null) |
| `AccessControlReadsPeoplePeopleRecord`: `valid_until: string_type` | `project_person`: null = no end date, or the access fields withheld | `valid_until` nullable; `revision`, `access_category`, `user_type` nullable (same projection) |
| `WiskeyValidationRun`: `finished_at: string_type` | `wiskey_live_validation.run_view`: `finished_at` NULL while running; `created_by_name`, `station_name` are nullable columns | `finished_at`, `created_by_name` nullable on the run and its pulse runs; station `name` nullable; overview run `created_by_name` nullable |

Siblings found by the same real-shaped payloads (the lab log names only the FIRST failing field of an object, so these were hidden):
- `AccessControlReadsEventDetailEvent` (same projection as the list row): `door`, the times, `person_name`, `employee_no` nullable.
- `AccessControlReadsPersonPerson`: `valid_until`, `revision`, `access_category`, `user_type`, `employee_no` nullable; the station row's
  `sync_state` / `last_sync_at` nullable (never synced); `profile` is the administrator's own profile fields (WisKey's rc37 record has
  `department` and `id_number`), now `dict[str, str] | None` instead of a one-key model (`AccessControlReadsPersonPersonProfile` removed;
  nothing in the frontend imported it).

## Files

- `smplwise_vms/backend/smplwise/wire/access_control_reads.py`, `smplwise_vms/backend/smplwise/wire/wiskey_validation.py` - the models.
- `frontend/src/api/generated/wire-access-control-reads.ts`, `frontend/src/api/generated/wire-wiskey-validation.ts` - regenerated
  (`scripts/gen_wire_types.py`).
- `smplwise_vms/backend/tests/test_wire_drift_2550.py` - new: the payloads built by the real projections (WisKey rc37 fixtures through
  `intercom_adapter` + the `intercom_authority` views; the validation run through `wiskey_live_validation` on its own migration) with
  the null / unknown cases, validated under `SW_WIRE_STRICT=1`.
- `contracts/API_INVENTORY.md` unchanged: it lists routes and docstrings, no route changed.

## Tests (PC, one file per process)

- `pytest tests/test_wire_drift_2550.py` with the OLD models: 13 failed, 2 passed (the two guards: an IANA zone stays two keys, a
  finished run validates). With the fix: 15 passed, exit 0.
- `python scripts/gen_wire_types.py --check`: exit 0. `python scripts/wire_ratchet.py`: exit 0 (897 = baseline).
- `ruff check` on the three Python files: exit 0.
- `tsc --noEmit --strict` on the two regenerated files: exit 0. Nothing else in `frontend/src` imports either file, so the project
  type-check cannot change; the full `tsc -b` was NOT_RUN on the PC (memory rule).
- `pytest tests/test_wiskey_live_validation_2390.py` (46 test functions; drives the run routes through the wire oracle): exit 0.
- `pytest tests/test_access_control_wire.py` (6 test functions): exit 0.
  (This project's pytest setup prints no count line; the counts are the test functions in each file.)
- Full backend suite, Playwright: NOT_RUN (no UI change; the train gate runs them).

## Open questions

None.
