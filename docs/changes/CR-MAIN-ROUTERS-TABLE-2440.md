# CR-MAIN-ROUTERS-TABLE-2440 - the routers as an ordered table, the start-up steps in their own module, a lifespan

Branch `pilot/CR-MAIN-ROUTERS-TABLE-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Code review
2026-11-13, MASTER_PLAN section 3.4 row `CR-MAIN-ROUTERS-TABLE-2436`: report 05 P2-05, P3-01, P3-03. Behaviour is identical:
the route table of the application is the same, route by route and in the same order.

## What changed

| Finding | Change |
|---|---|
| 05:P2-05 | `routers/__init__.py` (was empty) holds `ROUTERS`, the include order of the application as data: 181 `Mount(module, tag, attr, prefix, when)` rows, 18 `Load(module)` rows (a module that was imported earlier than it was mounted keeps that import at its old place) and 9 `Step(name)` rows (the service wiring that always ran between two includes). The file imports no router module. `EAGER` is the list of 57 router modules `main` imports at its own import, in the old order. |
| 05:P2-05 | `main.create_app` loops over the table (14 lines) instead of about 180 `from .routers import x` / `include_router` pairs. The one conditional include (`ha.dev_router`, developer identity mode outside the add-on) is a row with `when="dev_identity"`, resolved by `main.MOUNT_CONDITIONS`. |
| 05:P2-05 | New `startup_steps.py`: `AFTER_MIGRATE`, the 11 guards / one-time repairs that ran inline right after `migrate()` (same order, each still guarding itself; `record_version` and `settle_update_run` still unguarded, as before), and `WIRING`, the 9 wiring steps the table names. The code was moved by a script, line for line, not retyped. It logs on the `smplwise` logger as before. `migrate()` itself stays in `create_app` (the test database template recognises that caller). |
| 05:P3-01 | The two `@app.on_event("startup" / "shutdown")` handlers (deprecated) run from one `lifespan` context passed to `FastAPI(...)`: the same two functions, the same order, and as with the event handlers the stop does not run when the start raised. |
| 05:P3-03 | `services/plan_stylize.py` imports numpy inside the four functions that compute with it (`otsu_threshold`, `label_regions`, `_resize_mask`, `stylize`), not at import. |

`main.py`: 1232 lines before, 759 after.

## Proof that nothing moved

A snapshot script (not committed) built the application before and after the change, in both modes (developer identity mode
and add-on mode), and recorded: every route as the application matches it (`fastapi.routing.iter_route_contexts`: path, methods,
name, endpoint, tags) in order; the top-level route list; the registered exception handlers; the middleware stack; the keys of
`app.state`; and the order in which `smplwise.*` modules were imported, at `import smplwise.main` and after `create_app`.

| Compared | Developer mode | Add-on mode |
|---|---|---|
| routes, in matching order | identical (1912) | identical (1910) |
| top-level route entries | identical (183) | identical (182) |
| exception handlers, middleware stack, `app.state` keys | identical | identical |
| import order of `smplwise.*` at `import smplwise.main` (325 modules) | identical, plus the new `smplwise.startup_steps` | same |
| import order after `create_app` (769 modules) | identical, plus the new `smplwise.startup_steps` | same |

## P3-03, measured: numpy still loads at start-up

The finding names `plan_stylize` (through `routers/plans`) as what pulls numpy in. That module no longer does, but after this
branch `import smplwise.main` still loads numpy: `routers/plan_geometry` imports `services/plan_detect`, `routers/zones` imports
`services/plan_zones` and `routers/camera_image_health` imports `services/camera_image_health`, and each imports numpy at its
top (so do `plan_detect_doors`, `plan_detect_hollow`, `plan_detect_objects`, `plan_door_tool`). The 6.5% of import time is
therefore **not** saved yet. Left for the closing chain (3B): the same in-function import in those seven modules
(`camera_image_health.py` is held by `CR-HEALTH-POLLERS` in this wave).

## Resolved file list

Row files: `smplwise/main.py`, `smplwise/routers/__init__.py`, new `smplwise/startup_steps.py`, `smplwise/services/plan_stylize.py`.
New: `tests/test_routers_table_2440.py`.

### Outside my rows

Two tests asserted the old text of `main.py` and were moved to the table (same intent, minimal change):

| File | Change |
|---|---|
| `tests/test_messaging_accounts_runtime.py` (`test_the_main_janitor_runs_the_step`) | `'include_router(messaging_accounts_router.router' in main.py` became "the table has exactly the row `Mount("messaging_accounts", "messaging")` for that module" |
| `tests/test_wiskey_live_validation_2390.py` (`test_nothing_runs_by_itself`) | the "only these two lines of main.py name the feature" check became "only this one row of the routers table names it, and neither `main.py` nor `startup_steps.py` does" |

The other tests that read `main.py` as text keep passing unchanged, because what they look for stays in `main.py`
(`test_tickets_s4_wiring` W14, `test_board_answers_2400`, `test_wiskey_adopt_2272_installer`, `test_async_routes_no_inline_db`).

## For whoever adds a router after this merges

A new router is one `Mount(...)` row in `routers/__init__.py` at the right place (before the router whose `{parameter}` path
would swallow it), not two lines in `main.py`. Branches that still add the two lines to `main.py` will conflict with this one;
the resolution is always "make it a row".

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

TESTS_PLACEHOLDER

`ruff check` (rule set F) on the four source files: the same two pre-existing findings in `main.py` before and after
(unused `playback_groups`, `wiskey_direct_join` imports inside the start-up function).

NOT_RUN locally: the full backend suite - left to the combined branch's entry check.
