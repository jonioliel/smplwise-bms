# CR-ROUTER-SQL-HA-2450 - SQL out of routers/ha.py

Branch `pilot/CR-ROUTER-SQL-HA-2450`, base `origin/pilot/CR-ROUTER-SQL-2450` at `0a5d0431e` (the 16-router step; this is the
row its change note left open under "Left on purpose"). Code review 2026-11-13, finding **05:P2-07**. Targets **2.46.0** (the
2.45.0 train closed without it; lead, 2026-11-19 - the branch name keeps its `-2450` suffix).
No version bump, no migration, no route change, no frontend change, no pixel change. No other router touched.

## What moved

All **24** `.execute(` calls of `routers/ha.py` move to the new `services/ha_store.py`, imported as `store` (the pattern of
`CR-ROUTER-SQL-2450.md`: typed functions, `conn` first, same SQL text, same arguments, same order of calls, run on the
connection the route hands them; nothing opens, commits or releases a connection). After the change the router holds **0**.

| Commit | Statements | Where |
|---|---|---|
| `ba6f4eb87` | 9 | `_entity`, `status` (directory user count), `list_entities` (its dynamic `WHERE` builder moved unchanged, plus the domain / area / chip queries), `get_entity` recent actions, `_door_gate` config entry, `_building_gate` entity row |
| `73aa9d96f` | 10 | `_run_action`: idempotency lookup, the pending `INSERT ... ON CONFLICT(id) DO NOTHING` (4 call sites: not-paired, pending, failed, answer), the two duplicate re-checks, the not-paired / failed / answer status `UPDATE`s |
| `58a8e15ea` | 5 | `bridge_directory` upsert + `NOT IN (?,?,..)` deactivation (builder moved unchanged), `_apply_directory_to_users` admin lookup, mirrored-user scan, active flag `UPDATE` |

What stayed in the router, on purpose:

- **The single-entity action route.** `run_action` is byte-identical (the switch-protection guard reads its body). In
  `_run_action` only the SQL lines changed: every check and its order, `_claim` / `_unclaim`, the `write_aside` blocks (label,
  `wait_s=PENDING_WAIT_S`, `priority=True`), the `connection(mode="read")` re-checks, `retry_locked`, the timing hops and the
  audit rows are unchanged. `now_iso()` is still evaluated by the caller at the same point; the pending row's argument tuple
  is still built once in the router. The local `insert_sql` became `ha_store.INSERT_ACTION_SQL` (same text).
- **Read / write connections.** No route signature changed: GETs and `run_action`'s checks still run on `get_read_conn`,
  the directory push on `conn_after(...)`, `get_action` on `get_conn`.
- Text pinned by source-reading tests stays in `routers/ha.py`: `open_from_tile`, `lock.unlock`,
  `schedule_identity.note_directory_push(conn, message)`, `_ping_screened` / `_directory_screened`, `_dev_only`,
  `PENDING_WAIT_S`, `_apply_directory_to_users`. None of these tests needed a change.

## Tests that read ha.py source or pin its routes (found first)

`grep` over `tests/` for `routers/ha.py`, `"ha.py"`, `routers.ha`, `inspect.getsource`, route paths:

- `test_switch_protection_reach_guard.py` - reads `run_action`'s body (AST) for switch-protection words.
- `test_schedimpact_295_addon.py::test_the_directory_route_records_the_fences` - a text pin in `routers/ha.py`.
- `test_wiskey_door_path.py::test_d4_no_other_module_signs_a_door_open` - `open_from_tile` in `routers/ha.py`; package-wide
  scan for door signers.
- `test_fake_doorwin_closed_rule_sr1.py` - package-wide AST scan; pins `("smplwise/routers/ha.py", "lock.unlock")`.
- `test_local_auth_inventory.py` - pins `smplwise.routers.ha._ping_screened` / `_directory_screened`.
- `test_plan_circuits_search.py` - imports `ha_router._dev_only`; `test_capture_lease_triggers.py` imports
  `_apply_directory_to_users`; `test_lat1_toggle_latency.py` reads `ha_router.PENDING_WAIT_S`.
- Route-wide: `test_get_routes_read_conn.py`, `test_plan_routes_unique.py`; storage scans: `test_sql_boundary_report.py`,
  `test_async_routes_no_inline_db.py`, `test_db_gate.py`, `test_router_common_helpers.py`.

**Baseline** (before any change, at `0a5d0431e`, PC): the first seven files above - **68 collected, 68 passed, 0 failed**
(11 min). After each commit the static guards were re-run (switch-protection, fake-doorwin, schedimpact pin, door-path pin,
sql-boundary): all green.

## Proof that the SQL did not change

The AST comparison script of `CR-ROUTER-SQL-2450.md` (not part of the branch): every string literal / f-string of
`routers/ha.py` at `0a5d0431e` that contains SQL (docstrings excluded, whitespace normalised) - **26 literals** (24 statements
plus the builder fragments `" AND disabled = 0"` etc.) - looked up in `routers/ha.py` + `services/ha_store.py` after the change:
**0 missing**, no composed or rewritten statement.

## Tests actually run

All at the branch head `58a8e15ea` unless noted. `-p no:xdist`, `-o addopts=` (so the summary line is printed).

| Run | Where | Files | Result |
|---|---|---|---|
| Baseline (before the change, `0a5d0431e`) | PC | the 7 source-reading / route-pinning files listed above | **68 passed, 0 failed** |
| Per-commit static guards | PC | `test_switch_protection_reach_guard.py`, `test_fake_doorwin_closed_rule_sr1.py`, `test_schedimpact_295_addon.py::test_the_directory_route_records_the_fences`, `test_wiskey_door_path.py::test_d4_no_other_module_signs_a_door_open`, `test_sql_boundary_report.py` | green after each commit (13 / 9 / 1 passed, 0 failed) |
| Full ha.py set | runner (`nice -n 19`, own folder, between gates, no gate running at start) | **53 files**: every test file that calls `/ha/entities`, `/ha/entities/{id}/actions`, `/ha/actions/{id}`, `/ha/status` or `/ha/bridge/directory` (43 files), plus the source guards and route / storage scans above (`test_get_routes_read_conn.py`, `test_plan_routes_unique.py`, `test_async_routes_no_inline_db.py`, `test_db_gate.py`, `test_router_common_helpers.py`, `test_capture_lease_triggers.py`, ...) | **1678 passed, 0 failed, 0 errors** (2 h 23 min) |
| `test_lat1_toggle_latency.py` alone, `-m "not timing_lane"` | runner | 4 tests (1 timing_lane test deselected, as the gate does) | first run (runner quiet): **4 passed**; second run (runner load ~15): 3 passed, 1 failed - see below |

**The one load-sensitive failure** (`test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock`, wall-clock
bound: dispatch < 1900 ms with a 1.5 s write lock held). Not a regression: run alone, alternating head and base (`ha.py` at
`0a5d0431e`), 8 pairs on the runner at load ~14:

| | dispatch ms (8 runs) | pass |
|---|---|---|
| head | 1697, 2001, 1976, 1717, 1826, 1639, 1808, 2125 | 5 / 8 |
| base | 1541, 1894, 1982, 1829, 1783, 2022, 2897, 2003 | 4 / 8 |

On the workstation (CPU at 100% from other agents) it fails at both: head 5942 ms, base 3792 ms. The bound is a timing bound
(the record budget plus 400 ms); the moved code adds one Python call per statement and changes no lock, block or order. It is a
candidate for the `timing_lane` marker like its sibling test (recommendation only, not changed here).

Static: `ruff check smplwise` (rule set F, whole package): **All checks passed**; `scripts/gate/lint_backend.py --root .`: **0 findings**.

NOT_RUN: the full backend suite (the next runner entry check covers it); frontend (nothing changed).

## Open

- `CR-ROUTER-SQL-2450.md` still lists `routers/ha.py` as "open"; not edited here to avoid a conflict with the batch-B row,
  which edits the same note. Recommendation: the lead updates that row when the branches merge.
