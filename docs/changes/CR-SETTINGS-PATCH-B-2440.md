# CR-SETTINGS-PATCH-B-2440 - the rest of `PATCH /settings` runs from `routers/settings_patch` (second half)

Branch `pilot/CR-SETTINGS-PATCH-B-2440`, **based on `pilot/CR-SETTINGS-PATCH-A-2440`** at 5a4fce7db (itself from
`origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4): it needs the package and the order test of the first half, so the two
merge in that order. Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.4, wave 3A, row
`pilot/CR-SETTINGS-PATCH-B-2436` (finding 05:P1-10 step 2, second half). No version bump, no migration, no frontend change, no
pixel change. No setting value, default, message, error code or audit row changes.

## What and why

After the first half, `patch_settings` still held the administrator-only keys, the module switches, the site checks, the store,
the followers and the audit rows (about 280 lines). They move into the package; the route is now:

```python
require(conn, principal, "system.configure", INSTALLATION)
patch = settings_patch.Patch(conn, request, principal, {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None})
settings_patch.apply(patch)
return {"settings": read_settings(conn, private=True), "can_edit": True, **_capacity_info(conn)}
```

- `settings_patch/identity.py`: alarm disarm in schedules, the Arx-only identity switch, its extended mode, the public address
  of its links, the two passkey settings, the purge switch and period; `_local_only_identity_key`, `ALLOW_DISARM_WORD`,
  `LOCAL_PURGE_WORD`, `LOCAL_ONLY_HE`, `LOCAL_ONLY_IDENTITY_KEYS` move with them (`routers/settings.py` re-exports the five
  names). After the store: the identity flag, the end of the local sessions with its row, the disarm row.
- `settings_patch/modules.py`: the five switches that get their own audit row for an actual change (self-update, tickets,
  maintenance, document reading, emergency readiness) - the check that notes the change and the step that writes the row.
- `settings_patch/site.py`: the Shabbat sensor (with the explicit override), the map's default floor, the home title, floor
  order and widgets, the time zone, the analysis provider.
- `settings_patch/effects.py`: the store (which keys are stored as compact JSON is now the named tuple `JSON_STORED`), the
  schedules and automations mirrors, the remote CSP, the WisKey join, the microphone policy, and the request's own
  `settings.update` row, written last.
- `settings_patch/__init__.py`: `Patch` gains the eight notes a check leaves for the steps after the store (`disarm_change`,
  `update_switch`, `local_switch`, `tickets_switch`, `maintenance_switch`, `docread_switch`, `emergency_switch`, `forced`).
  `VALIDATORS` is the one ordered table of the 44 checks; `AFTER` is the ordered tuple of the 15 steps that run once every
  check passed (no prefix there: several of them read more than one key, and one runs for any `security.local_*` key);
  `apply(patch)` runs both.

The code of every check and step is the old code, line for line, with `changes` / `conn` / `request` / `principal` taken from
`patch` and the eight local variables that crossed from the checks to the steps after the store turned into fields of `Patch`. The
function-level imports (`is_system_admin`, `is_remote`, the services) stay function-level, so a test that patches them on their
own module still reaches them.

## How identical behaviour was checked

- The literal comparison of the first half, over the whole function: every string and number of the old `patch_settings` and
  `_local_only_identity_key` is in the new code the same number of times, apart from the fourteen factory-made handlers of the
  first half. New literals: the table keys and the moved module constants only.
- `tests/test_settings_patch_audit_order.py`, written before any code moved (first half) and unchanged in its four behaviour
  tests: the 45 checks pairwise, the 8 administrator-only refusals with their denied rows, the 14 audit rows of one large
  request in order with their details, the repeated-values request. New here:
  - the two tables are pinned as explicit lists (a new check or step has to be placed on purpose);
  - the package never imports `routers.settings`;
  - the followers are told after the store and in the table's order, and a refused request tells nobody.

## Files

- new `smplwise_vms/backend/smplwise/routers/settings_patch/identity.py`, `modules.py`, `site.py`, `effects.py`
- `smplwise_vms/backend/smplwise/routers/settings_patch/__init__.py`
- `smplwise_vms/backend/smplwise/routers/settings.py` (683 -> 394 lines; 801 before the first half; `patch_settings` 397 -> 6 lines over both halves)
- `smplwise_vms/backend/tests/test_settings_patch_audit_order.py`
- this note

## Outside my rows

None.

## Tests

Runs (local Windows, `C:\cloude\smplwisebms\.venv`, Python 3.12, `-p no:xdist`, from the worktree; the workstation had
0.25-0.4 GB of free memory and other agents running):

| Run | Result |
|---|---|
| `ruff check` (rule F) on `routers/settings.py`, `routers/settings_patch/`, the test | 1 finding, which the base already has (`ui_background` imported but unused in `routers/settings.py`; the class has a field of that name); the base's second one (`home_screen`) is gone with its import line |
| RUNB1_PLACEHOLDER | RUNB1_RESULT |
| RUNB2_PLACEHOLDER | RUNB2_RESULT |

NOT_RUN locally (left to the lead's combined entry check): the full backend suite and the remaining feature suites that send
`PATCH /settings` (about 115 test modules, among them `test_local_identity`, `test_local_reset`, `test_remote_access`,
`test_remote_hardening`, `test_service_identity`, `test_schedules_api`, `test_maintenance_215*`, `test_docread_297`, the
`test_tickets_*` set and `test_automations_*`). No runner, pixel, device or lab action.

## For the closing chain / the lead

- Merge order: CR-SETTINGS-PATCH-A-2440, then this branch.
- CR-ROUTER-COMMON-TAIL: `routers/settings.py` holds no `_rid` copy; the handlers read `request.state.correlation_id` as the
  function did (21 places in `settings_patch/`). Moving them to `_common.rid` is a one-line change per place for the tail
  branch if `rid` is exactly `getattr(request.state, "correlation_id", None)`; not done here (behaviour-neutral split only).
- The remaining unused import in `routers/settings.py` (`ui_background`) is left for CR-PYFLAKES-ENFORCE.
