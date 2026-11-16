# CR-SPLIT-ACCESS-2440 - `routers/access.py` split: a service module and five route modules

Branch `pilot/CR-SPLIT-ACCESS-2440`. Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`)
section 3.4, wave 3A, row `CR-SPLIT-ACCESS-2436`. No version bump, no migration, no frontend change, no pixel change,
no route change.

**Base: `pilot/CR-SPLIT-ACCESS-CONTROL-2440`** (my first branch of this batch, itself on
`origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4). The two splits are independent in the product code; this one
sits on the other only because both edit the same tuple of `tests/test_get_routes_read_conn.py` (`ACCESS_MODULES`),
which would otherwise conflict in the combined branch.

## Findings covered

- **05:P2-08 (giant router)** - the 1,507 lines of `routers/access.py` are split into one service module and five
  route modules. The split is a **pure move**: every non-blank line of the old body is present, unchanged, in exactly
  one new module (checked by a line multiset comparison; the only added lines are module docstrings, import blocks and
  `router = APIRouter()`). No statement was edited.
- **05:P2-09 (services import routers)** - everything other code imported from this router now lives in
  `services/rbac_admin.py`: `PERMISSION_LABELS`, `SYSTEM_PERMISSIONS`, `SENSITIVE`, `DEFAULT_DELEGABLE`, `BindingBody`,
  `_subject_name`, `_scope_exists`, `_terminate`, `active_user_ids`, `user_known`, `local_binding_check`,
  `validate_binding`, `insert_binding`, `revoke_one`, `check_delegation`, `keep_an_admin`, ... The five services that
  imported `routers.access` (`automation_scope`, `backup`, `door_emergency_grants`, `local_identity`, `schedule_view`;
  ten import statements, all function-local) import `rbac_admin` instead. No service imports `routers.access` any more.
- **05:P2-07 (SQL in routers), this router** - 44 of the router's 61 `execute` calls moved with their functions into
  the service module. The 17 left are written inline in route handlers (custom roles 10, bindings 3, audit 2,
  directory 1, roles 1); moving those means rewriting the handlers, which is not a move, so they stay for a later
  branch.

## Resolved file list

| Module | Old lines | Holds | Routes |
|---|---|---|---|
| `services/rbac_admin.py` | 32-469, 472-480, 483-893, 920-953, 1002-1009, 1022-1148, 1163-1177, 1330-1393 | the label catalogue and the permission sets; `_rid`, `rendered_labels`; the whole "shaping" section (users, bindings, delegation rules, reach, `_terminate`, `keep_an_admin`); `_delegated_directory`; `BindingBody` and the binding checks / writes; the custom-role checks and `_role_impact` | - |
| `routers/access_directory.py` | 896-917, 956-971 | `GET /identity/users`, `POST /identity/sync` | 2 |
| `routers/access_roles.py` | 974-997 | `GET /access/roles` | 1 |
| `routers/access_bindings.py` | 1000-1001, 1012-1019, 1151-1160, 1180-1189 | bindings: list, create, revoke | 3 |
| `routers/access_audit.py` | 1192-1293 | `POST /access/preview`, `GET /audit` | 2 |
| `routers/access_custom_roles.py` | 1296-1327, 1396-1507 | custom roles and the delegation allow-list | 6 |

`routers/access.py` is now the re-export: the original docstring plus a note, `PARTS` (the five part routers in the old
route order), `router` (includes the parts in that order), `pb` (a test patches `smplwise.routers.access.pb.close`) and
every one of the old top-level names, listed in `__all__`. The routers that import from it (`access_groups`, `ha`,
`local_identity`, `wall`) and the ~70 test modules that import the label catalogue from it are unchanged.

`SENSITIVE` is read from `roles.json` relative to the module file (`parents[1]`): the same file from `services/` as from
`routers/`.

## Proof that the API did not move

- Line multiset comparison of the old `routers/access.py` (1,507 lines, 1,352 non-blank) against the six new modules,
  re-run by the resuming agent: the only old lines absent are the module docstring (kept in the re-export) and the old
  import block; the only new lines are docstrings, import blocks and `router = APIRouter()`.
- All 77 top-level names of the old module are importable from `routers/access.py` and listed in `__all__` (AST check).
- `scripts/api_inventory.py`: `contracts/API_INVENTORY.md` regenerated, `git diff` empty (1908 routes).
- An ordered dump of the application's route table (method, path, endpoint name; 1912 rows including sockets and the
  non-API routes) before and after: byte-identical, so the route order is kept.
- The full OpenAPI document (`app.openapi()`, sorted JSON) before and after: identical **except one component name**.
  Eight routers define a class called `PreviewBody`, so FastAPI names each schema by its module:
  `smplwise__routers__access__PreviewBody` is now `smplwise__routers__access_audit__PreviewBody` (the schema itself and
  the `POST /access/preview` request body are unchanged; only the `$ref` name moved). Nothing in the repository reads
  that name (`git grep` for `routers__access__` is empty; the frontend has no generated client). Left as it is, since
  pinning it would need a `__module__` override, which is not a move. For the lead: say so if the name must be kept.

## Outside my rows

- `services/automation_scope.py`, `services/backup.py`, `services/door_emergency_grants.py`,
  `services/local_identity.py`, `services/schedule_view.py` - the import source only (`from .rbac_admin import ...`),
  ten lines; in `backup.py` also the comment on that line.
- `tests/test_get_routes_read_conn.py` - `ACCESS_MODULES` names the five parts instead of `access` (each declares a GET route), so the
  read-connection inventory keeps covering the same GET routes.
- `tests/test_tickets_naming.py` - the article-before-token scan reads `services/rbac_admin.py` (where the labels are
  now) instead of `routers/access.py`.

## Left as it is (for the closing chain or a later branch)

- The 17 inline statements listed above.
- `routers/access_groups.py`, `routers/local_identity.py`, `routers/wall.py`, `routers/ha.py` keep importing through
  the re-export (files of other rows); they can import `services/rbac_admin` directly later.
- `management/upstream_watch.json` lists `routers/access.py` as a pydantic dependent; the new modules are not added.
- Comments elsewhere that say "routers/access.py PERMISSION_LABELS" are not rewritten.

## Tests actually run (workstation, Python 3.12, `pytest -p no:xdist`)

Resumed 16.11 PM (the first agent ran out of usage before running anything; the placeholders in this note were filled
by the resuming agent, who found the move complete and changed no code).

- `tests/test_access.py`, `test_custom_roles.py`, `test_rbac.py`, `test_rbac_groups.py`, `test_rbac_matrix.py`,
  `test_rbac_camera_scope.py`, `test_rbac_eval_2438.py`, `test_admin_gate_2438.py`, `test_camera_reboot_2407.py`,
  `test_t06_admission_295.py`, `test_get_routes_read_conn.py`, `test_tickets_naming.py`, `test_local_identity.py`,
  `test_local_identity_units.py`, `test_wall.py`, `test_door_emergency.py`, `test_door_emergency_roles_emrole_295.py`,
  `test_backup.py`, `test_automations_scope.py`, `test_ha_users.py` in one run:
  **1000 passed, 1 failed, 1 skipped, 3 xfailed**.
- The one failure is not from this branch:
  `test_t06_admission_295.py::test_the_installed_client_sends_only_the_pinned_installation_and_read_commands` reads
  `services/wiskey_auto_install.py` (untouched here) and expects a `whatsapp/template_send_v3` call the base
  (97080bbc4) does not have. `origin/pilot/CR-WAVE2-COMBINED-2439` has since changed that test (now 4e52e5e4a); it
  goes away when the lead merges up.

## NOT_RUN

- The runner entry check (batch rule: push only; the lead runs one entry check per combined branch).
- The whole backend suite and the frontend suites.
