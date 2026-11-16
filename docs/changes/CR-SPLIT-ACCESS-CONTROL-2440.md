# CR-SPLIT-ACCESS-CONTROL-2440 - `routers/access_control.py` split along its section comments

Branch `pilot/CR-SPLIT-ACCESS-CONTROL-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4 (backend base of
the 16.11 code-review batch). Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.4,
wave 3A, row `CR-SPLIT-ACCESS-CONTROL-2436`. No version bump, no migration, no frontend change, no pixel change,
no route change.

## Findings covered

- **05:P2-08 (giant router)** - the 2,123 lines of `routers/access_control.py` are split into ten sibling modules and
  one service module. The split is a **pure move**: every non-blank line of the old body is present, unchanged, in
  exactly one new module (checked by a line multiset comparison of the old file against the new ones; the only added
  lines are module docstrings, import blocks and `router = APIRouter()`), before the four small edits listed under
  "Edits after the move".
- **05:P2-09 (services import routers)** - `PersonData` / `CardData` and their field patterns moved to the service
  layer (`services/access_control_core.py`); `services/bulk_people.py` imports `PersonData` from there.
- **05:P2-07 (SQL in routers), this router** - the router held four statements; all four now sit in
  `services/access_control_core.py` behind named functions, statement text and parameters unchanged.
- **02:P3-3 (socket log line)** - the entry-center WebSocket no longer ends with `except Exception: pass`: it logs
  `entry-center socket ended (<exception type>)` at debug. The listen-pump half of P3-3 belongs to
  `CR-INTERCOM-SHARED`.

## Resolved file list

New modules (the old line ranges are those of `routers/access_control.py` on the base):

| Module | Old lines | Holds | Routes |
|---|---|---|---|
| `routers/access_control_base.py` | 64-123 | permission names, read gates, `_instant`, `log` | - |
| `routers/access_control_entry.py` | 126-253 | overview, background, diagnostics, events, people, person | 6 |
| `routers/access_control_stills.py` | 256-348 | the station camera still and its disk cache | 1 |
| `routers/access_control_credentials.py` | 350-431 | per-station camera credentials | 4 |
| `routers/access_control_command.py` | 433-795 | the shared write path: envelope, `_Action`, `_parse`, `_envelope`, `_station`, `_perform`, `_relay_of`, the relay guard (`RELAYS`), the call / TTS bodies and gates | - |
| `routers/access_control_door.py` | 797-1018 | the release route and the one door path: `open_door`, `_perform_signed`, `open_from_tile` | 1 |
| `routers/access_control_calls.py` | 1020-1073 | call signal, TTS engines, TTS speak | 3 |
| `services/access_control_core.py` | 1104-1244 | `PERSON`, the field patterns, `CardData`, `PersonData`; the four SQL functions | - |
| `routers/access_control_people.py` | 1075-1103, 1247-1532 | the person editor: bodies, `people_writer`, `gated`, `people_send`, six routes | 6 |
| `routers/access_control_capture.py` | 1534-2076 | card capture and the capture-lease route | 5 |
| `routers/access_control_ws.py` | 2078-2123 | the entry-center WebSocket | 1 (WS) |

`routers/access_control.py` is now the re-export: the original docstring plus a note, `PARTS` (the eight part routers
in the old route order), `router` (includes the parts in that order) and every one of the 129 top-level names the old
module defined, plus `_raw_body`, listed in `__all__`. The routers and services that import from it
are unchanged, except `services/bulk_people.py` (below).

The nested `include_router` is the pattern `routers/wiskey_installer.py` already uses.

## Edits after the move

1. `access_control_command._envelope`: the duplicate-command `SELECT` is `access_control_core.command_already_sent(...)`.
2. `access_control_door.open_from_tile`: the three `ha_actions` statements are `tile_action_id`, `tile_action_pending`,
   `tile_action_answer` of `access_control_core`.
3. `access_control_ws.intercom_ws`: the debug log line (02:P3-3).
4. `services/bulk_people.py`: `from .access_control_core import PersonData` (was `from ..routers.access_control import`).

## Proof that the API did not move

- `scripts/api_inventory.py`: `contracts/API_INVENTORY.md` regenerated, `git diff` empty (1908 routes).
- An ordered dump of the application's route table (method, path, endpoint name, 1912 rows including sockets and the
  non-API routes) before and after: byte-identical, so the route order is kept.
- The full OpenAPI document (`app.openapi()`, 2.7 MB as sorted JSON) before and after: byte-identical (same schemas,
  same schema names, same parameters).

## Outside my rows

Tests that name the old file or patch one of its module-level values follow the move (no assertion was weakened):

- `tests/test_capture_lease_ledger.py` - the one caller of `capture_lease.issue(` is `access_control_capture.py`.
- `tests/test_capture_lease_triggers.py` - the two `person_changed` triggers are read from `access_control_command.py`.
- `tests/test_fake_doorwin_closed_rule_sr1.py` - the three pinned door sites are in `routers/access_control_door.py`.
- `tests/test_wiskey_door_gate.py`, `tests/test_wiskey_door_path.py` - the only router that sends a release, calls
  `open_door`, signs a `door_open` or calls `door_authority.check` (twice) is `routers/access_control_door.py`.
- `tests/test_wkpeer_295.py` - the "no peer reference" scan covers the re-export, the ten parts and the service module.
- `tests/test_intercom.py` - `UNKNOWN_HOLD_S` / `SEND_WITHIN_S` are patched on `access_control_command` (the module
  that reads them).
- `tests/test_wxd10_door_jobs.py` - "no door is opened" patches `open_door` on the re-export (read by
  `services/door_run_guard.py`) and on `access_control_door` (read by the release route and the tile).
- `tests/test_intercom_adapter.py` - the three legacy reads are taken from `access_control_entry.router`.
- `tests/test_get_routes_read_conn.py` - `ACCESS_MODULES` names the six parts that declare a GET route, so the
  read-connection inventory keeps covering them.
- `services/bulk_people.py` - the one import line above and the docstring that names the model's module.

## Left as it is (for the closing chain or a later branch)

- `services/door_run_guard.py` still imports the router (`_Action`, `_relay_of`, `open_door`, `SEND_WITHIN_S`): moving
  the one door path into the service layer is not a pure move of this size and the door tests pin the path to one
  router file. It keeps working through the re-export.
- `management/upstream_watch.json` lists `routers/access_control.py` as a dependent of two upstream items; the parts are
  not added there.
- Comments and documents that say `routers/access_control.py:<line>` (`docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md`)
  are historical and are not rewritten.

## Tests actually run (workstation, Python 3.12, `pytest -p no:xdist`)

- `scripts/api_inventory.py` on the final tree: 1908 routes, `git diff -- contracts` empty.
- Ordered route table and OpenAPI document, base against branch: identical (taken after the four edits; `PARTS` was
  added to the re-export afterwards and the inventory above was run again on that tree).
- `ruff check` (rule set F, the project's configuration) on the eleven new modules, the re-export and
  `services/bulk_people.py`: no finding.
- One pytest run, 12 files, **297 passed, 0 failed** (42 min 54 s on the loaded workstation):
  `test_get_routes_read_conn.py`, `test_raw_body_order.py`, `test_router_common_helpers.py`, `test_plan_routes_unique.py`,
  `test_fake_doorwin_closed_rule_sr1.py`, `test_wkpeer_295.py`, `test_capture_lease_ledger.py`,
  `test_capture_lease_triggers.py`, `test_wiskey_door_gate.py`, `test_wiskey_door_path.py`, `test_wxd10_door_jobs.py`,
  `test_intercom_adapter.py`.
  A first run of the same list stopped at its first failure
  (`test_get_routes_read_conn.py::test_allowlist_is_well_formed_and_access_modules_exist`: `access_control` no longer
  declares a GET route itself); the list of modules in that test was corrected and the whole list run again.

## NOT_RUN

- `test_intercom.py` (the router's main suite, about 400 s on the runner), `test_capture_lease_review_fixes.py`,
  `test_t06_admission_295.py`, `test_wiskey_join_live_2382.py`, `test_building_scope_single_2351.py`,
  `test_bulkpeople_295.py`, `test_outage_run_t035.py`, `test_wiskey_door_signed.py` and the other suites that import
  `routers.access_control`: NOT_RUN at the time of this commit (the workstation was at 100% CPU with under 0.5 GB free;
  the 12 files above took 43 minutes). Two of these have edited lines that were therefore not executed here:
  the `UNKNOWN_HOLD_S` / `SEND_WITHIN_S` patches in `test_intercom.py`. A later commit on this branch records any of
  them that were run afterwards.
- The runner entry check (batch rule: push only; the lead runs one entry check per combined branch).
- The whole backend suite and the frontend suites.
