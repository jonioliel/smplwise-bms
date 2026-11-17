# CR-PYFLAKES-ENFORCE-2442 - backend pyflakes findings cleared, the ruff lane becomes blocking (chain step BE-3)

Branch `pilot/CR-PYFLAKES-ENFORCE-2442`, from `origin/pilot/CR-BE-DEAD-CODE-2442` at 6de49c824 (BE-2). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.5, wave 3B, row BE-3 (named `CR-PYFLAKES-ENFORCE-2436` there), theme D4
(04:F06, 01:F-17) and T6. No version bump, no migration, no route change, no frontend change, no pixel change. No device, recorder,
go2rtc or Home Assistant was contacted. No runner job, no entry check (as instructed).

## What was there

The plan expected "about 50 unused imports, 4 unused locals". On this head ruff 0.17.5 with the project rule set
(`[tool.ruff.lint] select = ["F"]`) reported **109 findings in `smplwise/`**: F401 87, F841 13, F541 4, F811 2, F821 2, F402 1.
After this step: **0**.

## Unused imports (F401): 86 removed, 1 kept

How each was checked before removal (one syntax-tree pass over the 2527 tracked `*.py` files of this head, legacy excluded):
no `from <module> import <name>` anywhere, no `<module alias>.<name>` attribute read, no `setattr / getattr / patch` with the name
on that module, no string holding `<module>.<name>` (patch targets), no `import *` of the module, and the name is not in an
`__all__`. Imports that load a module (`from . import x`) were also checked for import-time effects: the set of `smplwise.*`
modules loaded by `import smplwise.main` (357) and by `create_app` (808), and the third-party top-level packages loaded (200), are
identical before and after. The two the plan named: `tickets/phone_verify.py` `rbac.require` and `tickets/public_runtime.py`
`module_key.ModuleKeyError` have no reader through those modules (tests take `ModuleKeyError` from `module_key` itself): removed.

Kept: `services/automation_model.py` `MASK` - `tests/test_automations_mirror.py` reads `model.MASK`. It now stands on its own
line with `# noqa: F401 - re-export: tests read it as this module's attribute`.

Existing `# noqa: F401` lines were not touched, except `services/plan_render.py:15` (`image_guard`): its marker went because the
import is now used (see F811 below); the comment about the import-time effect stays.

| File (under `smplwise/`) | Unused imports found (all removed, except `automation_policy.MASK`) |
|---|---|
| `main.py` | `services.playback_groups`, `services.wiskey_direct_join` |
| `routers/access_control_template_v2.py` | `pydantic.StrictBool` |
| `routers/access_control_triage.py` | `fastapi.Path` |
| `routers/access_wiskey_visits.py` | `pydantic.Field` |
| `routers/automations.py` | `rbac.authorize` |
| `routers/cameras.py` | `json` |
| `routers/door_windows.py` | `fastapi.Query` |
| `routers/energy_billing.py` | `auth.current_principal_ro` |
| `routers/exports.py` | `rbac.require`, `services.access.camera_allowed` |
| `routers/frigate.py` | `fastapi.Body` |
| `routers/ha.py` | `services.timeutil.iso_utc` |
| `routers/media.py` | `asyncio` |
| `routers/multimedia.py` | `auth.current_principal` |
| `routers/notifications.py` | `services.user_events` |
| `routers/playback.py` | `services.timeutil.UTC` |
| `routers/recorders.py` | `fastapi.Query` |
| `routers/recordings.py` | `auth.current_principal`, `auth.get_conn`, `rbac.require`, `services.access.camera_allowed` |
| `routers/search.py` | `auth.current_principal`, `auth.get_conn` |
| `routers/settings.py` | `ui_background` |
| `routers/tickets_costs.py` | `fastapi.Form` |
| `routers/tickets_messages.py` | `fastapi.Query` |
| `routers/wiskey_installer_technical.py` | `services.wiskey_installer` |
| `services/access_grants.py` | `db.now_iso` |
| `services/alarm.py` | `json` |
| `services/announcements.py` | `db.now_iso` |
| `services/automation_blueprints.py` | `automation_policy` |
| `services/automation_model.py` | `automation_policy.MASK` |
| `services/automation_ops.py` | `db.get_setting`, `ha_sync` |
| `services/automation_runs.py` | `automation_policy`, `timeutil.iso_utc` |
| `services/automation_scope.py` | `rbac.INSTALLATION`, `rbac.authorize`, `alarm` |
| `services/automation_view.py` | `json`, `automation_trace` |
| `services/automations.py` | `uuid`, `rbac.INSTALLATION`, `rbac.Principal`, `rbac.authorize`, `automation_scope`, `automation_trace`, `ha_bridge`, `timeutil.zone` |
| `services/bill_pdf_engine.py` | `io` |
| `services/calendar/recurrence.py` | `dataclasses.field` |
| `services/door_automation.py` | `db.now_iso` |
| `services/emergency/engine.py` | `json`, `time` |
| `services/energy_calibration.py` | `db.now_iso` |
| `services/events_ingest.py` | `re` |
| `services/frigate_auto_profile.py` | `datetime` |
| `services/ha_client.py` | `typing.AsyncIterator` |
| `services/intercom_adapter.py` | `datetime.timezone` |
| `services/intercom_calls.py` | `db.now_iso` |
| `services/local_identity.py` | `second_factor` |
| `services/ma_direct.py` | `os`, `secrets` |
| `services/media_commands.py` | `db.get_setting` |
| `services/notices/news_sources.py` | `bill_pdf_logo.LogoError` |
| `services/notify_sensors.py` | `json` |
| `services/notify_sources.py` | `os`, `re` |
| `services/offbox_restore.py` | `hashlib` |
| `services/partner/api_app.py` | `db.get_setting` |
| `services/plan_dxf.py` | `ezdxf` |
| `services/readiness.py` | `pathlib.Path`, `timeutil.parse_utc` |
| `services/recorders/frigate_events.py` | `dataclasses.field` |
| `services/tickets/intake.py` | `channel.phone_digits` |
| `services/tickets/message_templates.py` | `channel.LINK_PURPOSES` |
| `services/tickets/phone_verify.py` | `rbac.require` |
| `services/tickets/public_runtime.py` | `module_key.ModuleKeyError` |
| `services/tickets/public_store.py` | `db.new_id` |
| `services/tickets/rfq_attach.py` | `audit.audit` |
| `services/tickets/rfq_orders.py` | `audit.audit` |
| `services/transit/poller.py` | `typing.Callable` |
| `services/wiskey_emergency_direct.py` | `typing.Iterable` |
| `services/wiskey_feature_exec.py` | `typing.Callable` |
| `services/wiskey_installed_features.py` | `typing.Awaitable` |
| `services/wiskey_native_projection.py` | `typing.Any` |

`services/plan_dxf.py`: `import ezdxf` stood next to `from ezdxf import recover` inside the same `try` - the second line still
raises the same `ImportError` when the package is missing.

## The other findings

| Rule | Where (under `smplwise/`) | Fix |
|---|---|---|
| F821 x2 | `routers/ha.py` (failed-row closure) | the closure `_failed` read `exc`, the name of the `except` clause. It worked only because the closure is called inside the block; Python unbinds the name when the block ends. The code is now bound to `err_code` in the block and the closure reads that. Same values written |
| F811 | `routers/doors.py` | a second, identical `class ConfirmBody` (one field) 350 lines below the first: removed, both routes use the first. OpenAPI document identical |
| F811 | `services/plan_render.py` | a local `from . import image_guard` inside `normalize_image` repeated the module-level import: removed |
| F402 | `services/nvr.py` `stream_document` | the loop variable `field` shadowed `dataclasses.field` inside the function: renamed `key` |
| F541 x4 | `routers/ha.py`, `services/automation_ops.py`, `services/bill_pdf_html.py`, `services/recorders/frigate_http.py` | `f"..."` without a placeholder: the `f` removed, same string |
| F841 | `routers/access_control_schedule_writes.py` `user`, `services/calendar/events.py` `conn`, `services/push.py` `st` (in `record`), `services/media_model.py` `idx`, `services/schedule_model.py` `out` (in `_overlaps`), `services/notify.py` `cursor` (2 assignments) | assignment removed; the right side was an attribute read, a literal or a comprehension |
| F841 | `routers/access_control_template_v2.py` `account`, `services/schedule_view.py` `refusal`, `services/plan_detect.py` `dt` | dropped from a tuple unpack (dict reads of keys the builder always sets) |
| F841 | `services/local_passkeys.py` `cred_row` | dropped from a chained `= None` |
| F841 | `services/wiskey_listen_adapter.py` `exc` | `except Exception as exc` -> `except Exception` |
| F841 | `services/schedule_ops.py` `warnings` (schedule copy) | **the call has an effect and stays**: `if not core["enabled"]: keep_disabled(...)`; only the unused binding went |
| F841 | `services/local_identity.py` `ctx` (in `sign_in`) | removed together with its right side, `_context_words(conn, user)`: one read of `sites` whose result nobody used. The only behaviour note of this step: a sign-in for an existing local user runs one query less (which also brings it closer to the unknown-user path). `_context_words` itself stays (3 other callers) |

## The lane is blocking

Rule set enforced: **`F` (the whole pyflakes family, as configured in `smplwise_vms/backend/pyproject.toml`) over the package
`smplwise/`**, 0 findings on this head with ruff 0.17.5. The tests directory is not linted by the lane (3018 findings there,
mostly star imports and redefinitions in fixtures; not in the scope of this step).

- `smplwise_vms/backend/pyproject.toml`: the marker line `# ruff-lane: blocking`.
- `scripts/gate/lint_backend.py`: `enforced(root)` reads the marker; `--gate` exits 1 on a finding in a tree that carries it;
  a blocked run prints the first 10 findings. `--strict` (manual) is unchanged: 1 on any finding, 2 when the lint could not run.
- `scripts/gate/gate_entry.py`: `decide` exits 3 (`LINT_BLOCK_RC`) after printing its decision when the lane blocks; `lint` exits 1.
- `scripts/gate/gate_release.sh`: exit 3 of `decide` ends the release gate RED before anything runs (any other non-zero keeps the
  old behaviour: FULL tier).
- `scripts/gate/branch_check.sh`: the entry check ends RED through `verdict` before the engine starts.

Two deliberate limits:

1. **A tree without the marker is only reported.** Every branch cut before this change still has the 109 findings; a lane that
   blocked them all would turn the whole queue red the moment the runner copy is synced. A branch gets the marker (and the clean
   tree) by merging main after this lands.
2. **NOT_RUN never blocks** (ruff missing, timeout, no backend tree): the line is printed. If ruff is not installed for the
   gate python of the runner the lane enforces nothing - the lead should read the first lint line of a log after the sync.

Switches: `GATE_BACKEND_LINT=0` off, `GATE_BACKEND_LINT=warn` report only.

Known weakness, not changed here: `gate_entry.py decide` lints `GATE_LINT_ROOT`, else the checkout the script sits in, else
`~/smplwisebms` - on the runner that is the main checkout, not the branch under release. The precise check of a branch is the
entry check (`branch_check.sh` lints the worktree of the branch itself).

**After the merge the lead must sync the `~/gate2` copy on the runner** (`lint_backend.py`, `gate_entry.py`, `gate_release.sh`,
`branch_check.sh`). Nothing on the runner was touched by this step.

## Commits

- 492cf3dff - the 109 findings (80 files under `smplwise/`).
- 02abfdcdf - the gate scripts and the marker.
- this note.

## Proof (actually run, workstation, Windows, Python 3.12 venv, `-p no:xdist`)

- ruff 0.17.5, `smplwise/`: **109 -> 0** (`All checks passed!`). Whole backend directory (with tests): 3127 -> 3018.
- `python -c "import smplwise.main"`: ok. Each of the 81 touched modules imported alone in a fresh interpreter: 81 imported, 0 failed.
- Loaded-module sets (after import: 357, after `create_app`: 808), third-party packages (200) and the sha-256 of the full OpenAPI
  document: identical before and after.
- `python scripts/api_inventory.py`: 1908 routes, `contracts/API_INVENTORY.md` has no diff.
- The lane, on this tree: clean -> `--gate` 0, `decide` 0. With one unused import injected (then restored): `--gate` 1, `decide` 3,
  `GATE_BACKEND_LINT=warn` 0, `=0` 0; with the marker removed (then restored): reported, 0. With a python that has no ruff:
  NOT_RUN, 0. `bash -n` on both shell scripts ok. `scripts/gate/selftest_gate_fast.py`: SELFTEST PASSED.
- Backend tests of the modules whose code (not only an import line) changed: `test_nvr_stream_document`, `test_automations_mirror`:
  **19 passed**. Then `test_outage_run_t035`, `test_schedules_review2`, `test_local_identity`, `test_local_identity_units`,
  `test_local_passkeys`, `test_passkey_only`, `test_push`, `test_plan_detect_doors_v2`, `test_wiskey_door_path`,
  `test_image_open_formats_2310`, `test_schedules_model`, `test_schedules_review`, `test_media_model`, `test_wkaudin_295`,
  `test_tplv2_295`, `test_bill_pdf`, `test_dxf`, `test_frigate2_295`, `test_exports`, `test_recordings`, `test_search`,
  `test_local_auth_inventory`, `test_notify_core`, `test_calendar_attendees_2343`, `test_async_routes_no_inline_db`:
  **640 passed, 29 skipped, 0 failed, 2 errors** (57 min 34 s). The 2 errors are `test_bill_pdf.py::test_logo_refusals[...]` at
  setup: `ValueError: the environment variable is longer than 32767 characters` (pytest puts the parameter id, a large byte
  string, into `PYTEST_CURRENT_TEST`; a Windows limit). The same 2 errors appear on the main checkout (cc69447f1) with
  `-k test_logo_refusals`: not caused by this step.

## NOT_RUN

- The full backend suite (1071 test files): not run (the proof column of the plan asks for it; it belongs to the runner, and this
  step was told not to use the runner and not to queue an entry check).
- Module tests of the ~60 files where only an unused import line was removed (beyond the import of every module and the files
  listed above): not run.
- `branch_check.sh` and `gate_release.sh` end to end: not run (they need the runner); only `bash -n` and the python parts.
- Whether ruff is installed for the gate python of the runner: not checked (runner not used).
- Frontend, pixels: nothing in `frontend/` changed.
