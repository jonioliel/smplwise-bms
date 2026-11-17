# CR-SETTINGS-PATCH-A-2440 - `PATCH /settings` checks move to `routers/settings_patch` (first half)

Branch `pilot/CR-SETTINGS-PATCH-A-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.3, wave 2, theme T8, row `pilot/CR-SETTINGS-PATCH-A-2436`
(finding 05:P1-10 step 2, first half). No version bump, no migration, no frontend change, no pixel change. No setting value,
default, message, error code or audit row changes.

## What and why

`patch_settings` was one 397-line function (complexity 184 in the review). Its checks move into a package, one small handler
per key or key family, run from a table `{prefix: handler}` in the order the function ran them.

1. **The order test first** (commit 372959898, green on the unsplit function before any code moved):
   `tests/test_settings_patch_audit_order.py`.
2. **New package `routers/settings_patch/`**:
   - `__init__.py`: `Patch` (the request on its way: `conn`, `request`, `principal`, `changes`), the ordered table `VALIDATORS`
     and `validate(patch)`. A handler runs when a key of the request starts with its prefix; every handler still checks its
     exact keys, so a prefix only has to be wide enough (`ui.tabs` also matches `ui.tabs_mode`, and the handler does nothing).
   - `ui.py` (17 table entries): the deprecated design names, tab bars, navigation size, look, palettes, tabs mode per group, the four
     drop-down per-group options, phone options, cross-section options, timeline colours, the two brand colours, the area and
     floor rows. Thirteen of them were the same six lines around a different normaliser; they share one factory
     (`normalised(key, normalize, message)`), with each key's own message and `details={key: error text}` as before.
   - `content.py` (9 table entries): home screen options, plan surfaces, the realistic-3D dials, the site position, the prepared
     images, schedule device classes, the automations lists and limits, the default remote, the Android download.
3. **`routers/settings.py`**: those 120 lines are replaced by `settings_patch.validate(settings_patch.Patch(...))`; everything
   after them (the administrator-only keys, the module switches, the site checks, the store, the followers and the audit rows)
   is unchanged and is the second half (CR-SETTINGS-PATCH-B). The service imports the router no longer uses are removed;
   `SCHEDULE_CLASSES`, `PLAN_SURFACES` and `normalize_tabs` stay as re-exports.

## How identical behaviour was checked

- A literal comparison over the syntax trees: every string and number of the old function is in the new code the same number
  of times, except the `422` / `"validation"` pairs and key names of the fourteen factory-made handlers, which the factory holds once (the Hebrew messages
  are byte-identical, including the invisible direction mark in the colour message). New literals: the table keys only.
- `tests/test_settings_patch_audit_order.py` (5 tests; the first four ran green before the move and after it):
  - 45 refused requests, one per check, in the function's order; for every neighbouring pair sent together (the later key
    first in the body) the earlier check answers with the same status, code, message and details; nothing is stored;
  - the 8 administrator-only keys for a holder of `system.configure` alone: 403, one `denied` row each
    (`not_system_admin`), the same pair rule, nothing stored;
  - one large accepted request (sent in the reverse of the audit order): the 14 audit rows in order, their details, the last
    row carrying the stored values in the order of the model's fields with `forced: true`, no helper key stored;
  - a request that repeats the stored values writes the single `settings.update` row;
  - (after the move) the table names declared settings only, no prefix twice, and is in the order of the checks.

## Files

- new `smplwise_vms/backend/smplwise/routers/settings_patch/__init__.py`, `ui.py`, `content.py`
- `smplwise_vms/backend/smplwise/routers/settings.py`
- new `smplwise_vms/backend/tests/test_settings_patch_audit_order.py`
- this note

## Outside my rows

None.

## Tests

Runs (local Windows, `C:\cloude\smplwisebms\.venv`, Python 3.12, `-p no:xdist`, from the worktree; the workstation had
0.25-0.4 GB of free memory and other agents running, so the runs were kept to the row's tests and the suites of the moved keys):

| Run | Result |
|---|---|
| `test_settings_patch_audit_order.py` on the unsplit function (before the move) | 4 passed |
| `ruff check` (rule F) on `routers/settings.py`, `routers/settings_patch/`, the new test | the 2 findings the base already has in `routers/settings.py` (`ui_background`, `home_screen` imported but unused), none new |
| after the move: `test_settings_patch_audit_order`, `test_settings_nav_pref`, `test_settings_cards_accordion_2402`, `test_settings_intercom_cards_2401`, `test_setting_value_parity`, `test_ui_settings`, `test_ui_tabs_config` | 58 passed |
| RUNA4_PLACEHOLDER | RUNA4_RESULT |

NOT_RUN locally (left to the lead's combined entry check): the full backend suite, and the other feature suites that send
`PATCH /settings` (about 115 test modules; of the moved keys: `test_automations_*`, `test_schedules_*` other than
`test_schedules_settings`, `test_home_screen`, `test_media_api`, `test_multibuilding_home_2330`, `test_popup_layout_2290`,
`test_plan_area_links`, `test_tree_unassigned_2331`, `test_security_review_247_poc`). No runner, pixel, device or lab action.

## For the closing chain

- `routers/settings_patch/*.py` are not routers (no `router` object). Static guards that walk `routers/*.py` do not descend
  into the package; `test_router_common_helpers` and the read-connection inventory are unaffected.
- The two unused imports the base already has in `routers/settings.py` are left for CR-PYFLAKES-ENFORCE (PATCH-B removes the
  import line they sit on only if it becomes unused as a whole).
