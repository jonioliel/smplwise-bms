# CR-SPLIT-TICKETS-ADMIN-2440 - `routers/tickets_admin.py` split along its section comments

Branch `pilot/CR-SPLIT-TICKETS-ADMIN-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4 (backend base of
the 16.11 code-review batch). Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.4,
wave 3A, row `CR-SPLIT-TICKETS-ADMIN-2436`. Independent of my two other branches of this batch
(`CR-SPLIT-ACCESS-CONTROL-2440`, `CR-SPLIT-ACCESS-2440`). No version bump, no migration, no frontend change, no pixel
change, no route change.

## Finding covered

**05:P2-08 (giant router)** - the 1,400 lines / 34 models / 11 sections of `routers/tickets_admin.py` are split into
six sibling modules. The split is a **pure move**: every non-blank line of the old body is present, unchanged, in
exactly one new module (checked by a line multiset comparison; the only added lines are module docstrings, import
blocks and each part's `router = APIRouter(dependencies=[Depends(module_gate)])`). No statement was edited.

## Resolved file list

| Module | Old lines | Sections | Routes |
|---|---|---|---|
| `routers/tickets_admin_base.py` | 34-54 | `KEY`, `ICON`, `COLOR`, `DOMAIN`, `GRANT_ROLES`, `_configurer`, `_clean` | - |
| `routers/tickets_admin_settings.py` | 57-566 | the display settings document, the logo, the display name | 7 |
| `routers/tickets_admin_departments.py` | 569-853 | departments | 5 |
| `routers/tickets_admin_catalogue.py` | 856-1117 | categories and priorities, the SLA matrix, ticket templates | 8 |
| `routers/tickets_admin_people.py` | 1120-1259 | members, a staff member's mobile, pickers and the permissions overview | 5 |
| `routers/tickets_admin_locations.py` | 1262-1400 | the organisation's locations | 7 |

`routers/tickets_admin.py` is now the re-export: the original docstring plus a note, `PARTS` (the five part routers in
the old route order), `router` (includes the parts in that order) and every one of the old top-level names, listed in
`__all__`. `main.py` is unchanged (it still mounts `tickets_admin.router` before `routers/tickets.py`).

**The module gate.** The old router was `APIRouter(dependencies=[Depends(module_gate)])`. Every part declares its own
router the same way, so each route carries the gate exactly as before; the re-export's router has no dependency of its
own (the gate is not listed twice). The nested `include_router` is the pattern `routers/wiskey_installer.py` uses.

## Proof that the API did not move

Checked on the workstation on 16.11 (second account, resuming the unfinished worktree; the split itself was found complete
and correct against the row, nothing had to be fixed forward):

- **Line multiset.** The old body (everything below the import block) has 1,157 non-blank lines; the six parts have 1,161. No old
  line is missing; the only four extra lines are the parts' `router = APIRouter(dependencies=[Depends(module_gate)])` (the fifth
  replaces the old one).
- **AST.** The 95 top-level definitions (functions, classes, constants) of the old module are the same 95 in the parts, with
  identical `ast.dump` and in the same order. All 95 are importable from `routers/tickets_admin` and listed in `__all__`.
- **API inventory.** `python scripts/api_inventory.py` regenerates `contracts/API_INVENTORY.md` with an empty diff (1,908 routes).
- **OpenAPI document** of the whole application, base tree (97080bbc4) against this tree: 1,543 paths and 1,897 operations in both,
  same order; the documents are identical except for one generated schema component name -
  `smplwise__routers__tickets_admin__SettingsBody` is now `smplwise__routers__tickets_admin_settings__SettingsBody` (FastAPI
  prefixes the module path because another router also has a `SettingsBody`). The application does not serve the OpenAPI
  document (`openapi_url=None`) and nothing in the repository refers to that name, so no client sees it.
- No part has an unused import.

**For the combine with the TK-* branches** (TK-SQL, TK-MONEY-UTILS, TK-OUTBOX-FILTER, TK-EXCEPT-LOG, TK-CATALOGUE): this branch
changes no statement, so a conflict in `routers/tickets_admin.py` is resolved by taking this branch's re-export and re-applying
the other branch's hunk in the part that now holds the lines (table above gives old line ranges -> module).

## Outside my rows

Tests that walk the old router's routes, read the old file or patch one of its module-level values follow the move (no
assertion was weakened):

- `tests/test_tickets_module.py` (the "every route answers 404 while the module is off" list) and
  `tests/test_tickets_visibility.py` (the "every route with a ticket id" list) walk `tickets_admin.PARTS` instead of
  `tickets_admin.router` (an included router is not a flat list of routes in this FastAPI version).
- `tests/test_tickets_visibility.py::test_ticket_sql_lives_in_the_store` and `tests/test_tickets_naming.py`
  (`TICKETS_SOURCES`) scan the six new files too.
- `tests/test_tickets_251_security.py`, `tests/test_tickets_public_prefix.py`, `tests/test_tickets_public_theme.py`,
  `tests/test_tickets_vendor_portal.py` patch `is_remote` on `tickets_admin_settings` (the module that reads it).

## Tests actually run (workstation, Python 3.12, `pytest -p no:xdist`)

`pytest -p no:xdist -q` on 18 files: `test_tickets_admin.py`, `test_tickets_251_security.py`, `test_tickets_module.py`,
`test_tickets_naming.py`, `test_tickets_public_prefix.py`, `test_tickets_public_theme.py`, `test_tickets_vendor_portal.py`,
`test_tickets_visibility.py`, `test_tickets_departments_restore.py`, `test_tickets_router_common_2438.py`,
`test_tickets_org_locations.py`, `test_tickets_mgrdash_settings.py`, `test_tickets_notify_matrix.py`,
`test_tickets_s4_directory.py`, `test_tickets_directory_permission.py`, `test_tickets_template_migration.py`,
`test_tickets_location_change.py`, `test_tickets_phone_verify.py` - **922 passed, 2 skipped, 0 failed** (one run).

## NOT_RUN

- The runner entry check (batch rule: push only; the lead runs one entry check per combined branch).
- The whole backend suite (the other 86 tickets test files included) and the frontend suites.
- ruff (not installed in the workstation environment).
