# CR-ROUTER-SQL-D-2460 - SQL out of the routers, fourth step (3 routers) + one guard

Branch `pilot/CR-ROUTER-SQL-D-2460`, base `origin/pilot/CR-ROUTER-SQL-B-2450` at `205434ecc`. Code review 2026-11-13, finding
**05:P2-07**, `MASTER_PLAN.md` section 3.6. Targets 2.46.0. No version bump, no migration, no route change, no frontend change, no
pixel change.

## Pattern

Unchanged from `docs/changes/CR-ROUTER-SQL-2450.md`: one `services/<router>_store.py` per router with typed functions (`conn`
first); same SQL text and arguments, same statement order and transaction, same read / write connection, old-database guards stay in
the router (none in these three), names other modules import from a router are kept. Arguments the router evaluated inline
(`now_iso()`, `principal.user_id`) are still evaluated by the router, in the same left-to-right order.

## Scope: what was left for this row

The brief listed `multimedia`, `remote`, `search` (9), `device_layouts`, `partner`, `plan_catalog` (8), `nvr_write` (7), then onward
by size. Batch C (`origin/pilot/CR-ROUTER-SQL-C-2450`, working from the smallest end) had already moved **every** open router of 1-8
statements by the time this row started, including `device_layouts`, `partner`, `plan_catalog`, `nvr_write` (checked with
`git fetch` + `git diff --name-only 0a5d0431e origin/pilot/CR-ROUTER-SQL-C-2450 -- .../routers`, before each router and again before
the final push). So this row moved the three 9-statement routers and stopped. (After they were committed the lead re-scoped the programme: a new row `CR-ROUTER-SQL-E-2470` takes the routers of 9-12 statements and this row only those above 12. `search`, `remote` and `multimedia` were already moved and tested here, so E should skip them; the only routers above 12 are excluded.) Otherwise: everything else that still calls `.execute(` on this
base is either batch C's (all 1-8) or excluded (`ha.py` 24 - own agent; `energy_billing` 20, `water` 16, `water_billing` 13,
`energy_meters` 3, `wiskey_installer_common` 2, `wiskey_relay_map` 1). `nvr_write.py` was not touched here (batch C's), so its source
guard was run as a check only.

## Moved on this branch: 3 routers, 27 statements

One commit per router. After the change these three routers hold **0** `.execute(` calls.

| Router | Statements | Store module | Notes |
|---|---|---|---|
| `search.py` | 9 | `services/search_store.py` | All on the read connection. The floor list of the entity explicit-deny check is still read only when the conditional holds (shared rooms present and a scoped caller). The entity query keeps `dsvc.NOT_SCHEDULER_SQL` concatenated the same way (the import moved to the store; nothing patched `routers.search.dsvc`). `search_allowed` (imported by `routers/settings.py`) unchanged. |
| `remote.py` | 9 | `services/remote_store.py` | The CSP counters still run on the router's own `db.connection(label="csp-report")` block; `CSP_ROWS_MAX` (patched by `test_remote_hardening`) and the `not known and count >= max` short-circuit stay in the router. The local revoke's user-agent read stays inside its own connection block. `CSP_BODY_MAX` etc. (read by `body_limit`) unchanged. |
| `multimedia.py` | 9 | `services/multimedia_store.py` (imported as `rstore`) | The router already imports `services/media_store.py` as `store`, so the new module is `rstore` (same convention as `notices` in batch B). The area placement keeps its order: device anchor, area, old area (audited), bridge call without the write lock, then the HA floor name and the local mirror update. |

## Guard: `services/notifications_store.py` scanned (batch B open question 1)

`tests/test_switch_protection_reach_guard.py` now lists `services/notifications_store.py` next to the `services/notify*.py` glob and
asserts the file is in the scanned set (so the guard cannot go vacuous for it if the file is renamed). The file names none of the
forbidden words today; the guard passes.

## Proof that the SQL did not change

The comparison script of the first step (AST: every string literal of the router at the base containing SQL, docstrings excluded,
whitespace normalised, must be present in the router + its store module after the change), run against `205434ecc`:

| Router | Literals at base (distinct) | Absent after |
|---|---|---|
| search | 9 (8) | 0 |
| remote | 9 (9) | 0 |
| multimedia | 9 (8) | 0 |

Plus an AST check that no function of the three routers binds `store` / `rstore` locally (none), and `grep -cE
'\.execute(many|script)?\('` = 0 on the three routers.

## Tests actually run

`pytest -p no:xdist`, focused runs at the branch head before this note (tree `a973375ef`, identical on both machines): every test
file that names one of the three routers, their routes or their imports, plus the guards. Runner chunks 0-1 ran while no gate was
running (`nice -n 19`, own folder `~/work/routersqld`, a `--shared` clone of the runner checkout with the branch's patches applied,
deleted after). The 2.45.0 release gate started during chunk 1; the script stopped before chunk 2 (it checks
`gate_status.json` before every chunk) and chunks 2-5 ran on the workstation (`C:/cloude/smplwisebms/.venv`, basetemp in the
session scratchpad, deleted after). The runner logs ran with `-q` twice (`-qq`), so their counts are read from the progress
characters (no `F` / `E` / `s` character in either log).

| Run | Where | Test files | Result |
|---|---|---|---|
| 1 | PC | `test_switch_protection_reach_guard` (after the guard change) | **4 passed, 0 failed** |
| 2 (chunk 0) | runner | `test_nvr_write_guard_2438` (the source guard on `nvr_write.py`, run first), `test_switch_protection_reach_guard`, `test_building_reach_round14`, `test_global_search_gate_295`, `test_nvr_less`, `test_plan_circuits_search`, `test_rbac_camera_scope`, `test_scheduler_exclusions` | **207 passed, 0 failed** |
| 3 (chunk 1) | runner | `test_search`, `test_semantic`, `test_setting_callers_2440`, `test_shared_spaces`, `test_app_refresh_295`, `test_app_session_295`, `test_app_session_cache_race_2443`, `test_body_limit` | **162 passed, 0 failed** |
| 4 | PC | `test_capture_lease_local_actor`, `test_local_auth_inventory`, `test_local_identity`, `test_remote_access`, `test_remote_admins_default`, `test_remote_auth_first`, `test_remote_hardening`, `test_security_review_220` | **264 passed, 0 failed** (48 min) |
| 5 | PC | `test_tickets_251_security`, `test_tickets_public_theme`, `test_xsecfix_297`, `test_announce_screens_b295`, `test_announce_translate_297`, `test_cast_sessions`, `test_devices`, `test_home_v3_p3` | **193 passed, 0 failed** (20 min) |
| 6 | PC | `test_media_api`, `test_media_bulk`, `test_media_cast_caps`, `test_media_commands`, `test_media_layout`, `test_media_ma_hardening`, `test_media_review_fixes`, `test_media_sync` | **254 passed, 0 failed** (21 min) |
| 7 | PC | guards: `test_async_routes_no_inline_db`, `test_async_routes_hold_no_write_conn`, `test_singletons_registered`, `test_routers_table_2440`, `test_sql_boundary_report`, `test_db_locking`, `test_get_routes_read_conn` (every GET route still answers on the read connection while another connection holds the write lock) | **764 passed, 0 failed** (95 min) |

Total **1,848 passed, 0 failed, 0 skipped**. Static: `ruff check smplwise` (rule set F): **All checks passed**;
`scripts/gate/lint_backend.py --root .`: **0 findings** (ruff 0.17.5).

NOT_RUN: the full backend suite (covered only by the next runner entry check / gate, not queued by this row); test files that reach
these routes only through fixtures. Frontend: nothing changed.

## Left on purpose / remaining

- After this step the only routers that still call `.execute(` on this base are batch C's 1-8 statement routers (moved on
  `origin/pilot/CR-ROUTER-SQL-C-2450`, not merged here), `ha.py` (own row) and the excluded billing / water / WisKey routers.
- No helper de-duplicated across stores (`live_floor_ids`, `device_exists`-style reads exist in several stores with their router's
  exact text). Merging them is the programme's later clean-up.

## Outside my rows

`tests/test_switch_protection_reach_guard.py` (the requested guard extension). New: `services/search_store.py`,
`services/remote_store.py`, `services/multimedia_store.py`. Changed: the three routers.
