# CR-BE-DEAD-CODE-B-2442 - backend dead code, chain step BE-4: the 20 names BE-2 listed for the lead; one flaky assertion

Branch `pilot/CR-BE-DEAD-CODE-B-2442`, from `origin/pilot/CR-PYFLAKES-ENFORCE-2442` at b2ba874ca (BE-3; main 2.43.7 cc69447f1 is
contained). Follow-up of `docs/changes/CR-BE-DEAD-CODE-2442.md`, section "Found during verification, NOT on the plan's list".
Owner decisions (round 32, 14.11): Q-CODE-1 = O10 a (delete only verified-unused code; test-used code stays, marked), Q-CODE-2 =
O15 a (code built ahead stays, tagged `# built ahead for <task>`). No version bump, no migration, no route change, no frontend
change, no pixel change. No device, recorder, go2rtc or Home Assistant was contacted. No runner job, no entry check (as instructed).

Counts: **17 names deleted** (20 definitions on the list; 3 of the names exist twice) in 9 modules, plus 4 module constants that
only two of the deleted functions read; **3 kept** (2 tagged built-ahead, 1 kept as interface documentation); 1 test assertion
made exact.

## Verification used (each name, on this head)

- V1: `git grep -n -I -w -F <name>` over the whole tracked tree (backend, `tests/`, `frontend/`, `scripts/`, `custom_components/`,
  `smplwise_vms/integration/`, `mobile/`, `management/`, `contracts/`, `docs/`, YAML / JSON / shell), excluding only the built
  bundles (`smplwise_vms/www*`, `*.map`). A word search also finds string uses (`getattr(x, "name")`, patch targets, registries).
  Result for all 17 deleted names: the definition line only (and, for `redeem_token`, the docstring of the function after it).
  No test names any of them, so none is "test-used".
- Dynamic lookups in `smplwise/` (`globals()`, `getattr` with a computed name, `import_module`): read again; none builds a name
  that can reach a deleted one (the computed ones are field names of request bodies, signal names, router / service module names,
  the janitor registry, `intercom_parity` screens).
- The "holder" names of `routers/alarm.py` / `routers/devices.py`: they are FastAPI dependency functions, not lock-holder hooks.
  Nothing wires a dependency by name: every route names its gate in `Depends(<object>)`, and the routes use the read-connection
  twins built by `read_gate(_check_...)` (`_control_holder_ro`, `_bypass_holder_ro`, `_alarm_actor_ro`,
  `_configure_holder_early_ro`, `_bulk_holder_ro`) since 0241b46fe ("raw-body routes read the body before the write connection is
  opened", review L7). The write-connection originals lost their last route there.
- History (`git log -S`) and documents (`docs/`, `management/`) for "built ahead for a task": see the table.

## The 20 names

| Symbol | File (under `smplwise/`) | Result | Why |
|---|---|---|---|
| `_control_holder`, `_bypass_holder`, `_alarm_actor` | `routers/alarm.py` | **deleted** | V1: definition only. Replaced by the `_ro` gates in 0241b46fe; no task plans to bring the write-connection form back. The rule their docstrings stated now sits on `_check_control` / `_check_actor` (the functions the gates run) |
| `_configure_holder_early`, `_bulk_holder` | `routers/devices.py` | **deleted** | same; the docstring of `_bulk_holder` moved to `_check_bulk`, the one of `_configure_holder_early` to a comment above its `_ro` twin |
| `_any` | `routers/door_windows.py` | **deleted** | V1: definition only (CR-039; the emergency routes read `permissions_anywhere` themselves) |
| `need_role` | `services/calendar/access.py` | **deleted** | V1: definition only since the calendars phase 1 commit (ce46c8ba0); the router raises `Denied` itself. No document names it |
| `janitor_due` | `services/calendar/guests.py` | **deleted** | V1: definition only since ce46c8ba0; the erasure job is `services/calendar/jobs.py`, which loops over the due events itself (it also audits) |
| `_check_version`, `_due_periods`, `_record_run` | `services/energy_billing.py` | **deleted** | V1: definition only. One-line wrappers left behind when the lifecycle and the automatic generation moved to `services/bill_ledger` (0ffef8af7, b5501c1c9); `auto_generate` hands `bill_ledger` its own hooks and none of them is one of these |
| `_check_version`, `_due_periods`, `_record_run` | `services/water_billing.py` | **deleted** | same |
| `redeem_token` | `services/notify.py` | **deleted** | V1: definition + the docstring of `redeem_token_ex`. The action route and the tests call `redeem_token_ex`. The single-use rule text of its docstring moved into `redeem_token_ex` |
| `parse_lease`, `parse_talk_open` | `services/wiskey_media_contract.py` | **deleted** | V1: definition only; the v1.1 readers `parse_lease_v11` / `parse_talk_open_v11` replaced them (WKDIRECT-295; wave 2 already reported them). With them went the four constants only they read: `R_STREAM`, `STREAM_RE`, `MAX_LEASE_S`, `FRAME_CODECS` (the copy of this module; `intercom_media.FRAME_CODECS` is untouched) - V1 on each: no other reader. The module docstring's line about the `go2rtc_stream` alternative now says the alternative went with its reader |
| `record_door_arrival` | `services/tickets/visits.py` | **kept**, tagged `# built ahead for SVC215` | `docs/changes/CR-SVC215.md` (section 3.2 and the test list) and migration 0156 (`arrived_by IN (..., 'door')`) define the `door` arrival signal; the caller is the grants model "once external grants go live" |
| `WindowProbe` | `services/wa_template_send.py` | **kept**, tagged `# built ahead for W11TPL` | `docs/changes/CR-W11TPL-295.md` names it as the seam of the 24-hour window; the live transport does not exist yet (WisKey open question 3). `NoWindowProbe` (test-only, marked in BE-2) is its only shape today |
| `HealthReader` | `services/recorders/base.py` | **kept**, comment | not dead in substance: three adapters implement `read_health` and `recorder_health` calls it; the Protocol is the written interface (`docs/changes/CR-026-NVR-HEALTH.md` points a new vendor at it). Same treatment as `OAuthFlow` in BE-2 |

Not deleted although only the removed functions used them: the `stream` field of `StreamLease` (a dataclass field, read through
the object; out of this row). For the lead: `STREAM_NS` of the same module has no reader either (V1: definition only, also
before this step); it is not on the list, so it was not touched.

## Flaky test

`tests/test_wiskey_door_tech.py::test_a_code_needs_the_typed_confirmation_and_valid_digits` asserted `bad not in r.text` for the
refused code `"12"`. The 422 answer carries one random value, `correlation_id` (12 hex digits, also the `x-correlation-id`
header), and `"12"` can occur inside it by chance - about one run in 24 (11 positions, 1/256 each). The code under test is right; the assertion read
more than it meant. Now: the `correlation_id` field is taken out and must equal the response header (and not the code), and the
code is searched in the JSON of **every other field**. Nothing was weakened: every field that could echo input is still searched,
including fields added later; only the server's own random id is compared exactly instead of by substring.

## Commits

- 9dc4b0521 `routers/alarm.py`; 20ee0eb73 `routers/devices.py`; 7505e332e `routers/door_windows.py`;
  9b5b6b015 `services/calendar/access.py`; 1a02693fb `services/calendar/guests.py`; 0e8218b0b `services/energy_billing.py`;
  a22dc6626 `services/water_billing.py`; 88ed8f2c8 `services/notify.py`; fa2e8d5a3 `services/wiskey_media_contract.py`.
- d543d5b7f - the three kept names (comments only).
- 5ff80f4ea - the door-tech assertion.
- this note.

## Proof (actually run, workstation, Windows, Python 3.12 venv, `-p no:xdist`)

- `python -c "import smplwise.main"`: ok.
- ruff 0.17.5 (system Python 3.12; the venv has no ruff), rule set `F`, `smplwise/`: **0** (`All checks passed!`).
- `python scripts/api_inventory.py`: 1908 routes, `contracts/API_INVENTORY.md` has no diff.
- The door-tech test alone, 20 separate pytest runs: **20 of 20 passed**. The whole `tests/test_wiskey_door_tech.py`: **31 passed**.
- `routers/alarm.py`, `routers/devices.py`, `routers/door_windows.py`: `tests/test_alarm.py`, `test_raw_body_order.py` (the order
  "permission, body, write connection" of the raw-body routes), `test_devices.py`, `test_doorwin_api.py`, `test_door_emergency.py`:
  **165 passed, 0 failed** (15 min 55 s).
- `services/energy_billing.py`, `services/water_billing.py`: `tests/test_energy_billing_api.py`, `test_water_billing_s3.py`,
  `test_bill_ledger_cross_kind.py`, `test_bill_ledger_lifecycle_b.py`, `test_energy_elecbill77.py`: **116 passed, 0 failed** (15 min 32 s).
- `services/wiskey_media_contract.py`, `services/notify.py`, `services/calendar/access.py`, `services/calendar/guests.py`:
  `tests/test_wiskey_contract.py`, `test_wiskey_media_v11.py`, `test_wkdirect_295.py`, `test_notify_core.py`,
  `test_calendar_engine_2300.py`, `test_calendar_attendees_2343.py`: **262 passed, 0 failed** (7 min 7 s).
  All runs with `-o addopts=""` so the count line is printed (the project's `-q` hides it).

## NOT_RUN

- The full backend suite: not run (runner not used, as instructed). Of the test files that touch the changed modules only the
  ones above ran; the others that reach them indirectly (for example the 40 other door-window files, `test_janitor.py`,
  `test_energy_integration.py`, the other 8 files that import `wiskey_media_contract`) were not run.
- Tests of the three comment-only files (`tickets/visits.py`, `recorders/base.py`, `wa_template_send.py`) and the source-reading
  tests BE-2 ran: not run.
- Entry check: not queued (as instructed).
- Frontend, pixels: nothing in `frontend/` changed.
