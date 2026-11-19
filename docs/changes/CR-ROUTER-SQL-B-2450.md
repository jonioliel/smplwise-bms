# CR-ROUTER-SQL-B-2450 - SQL out of the routers, second step (14 routers)

Branch `pilot/CR-ROUTER-SQL-B-2450`, base `origin/pilot/CR-ROUTER-SQL-2450` at `0a5d0431e` (the first step: pattern, inventory,
16 routers). Code review 2026-11-13, finding **05:P2-07**, `MASTER_PLAN.md` section 3.6. Targets 2.45.0. No version bump, no
migration, no route change, no frontend change, no pixel change.

## Pattern

Unchanged from `docs/changes/CR-ROUTER-SQL-2450.md`: one `services/<router>_store.py` per router with typed functions (`conn`
first), the router imports it as `store`; same SQL text and arguments, same statement order and transaction, same read / write
connection, old-database guards stay in the router, names other modules import from a router are kept, savepoints go through
`services/savepoints.py`. Arguments the router evaluated inline (`now_iso()`, `json.dumps(...)`, `model.iso(...)`) are still
evaluated by the router, in the same left-to-right order.

## Moved on this branch: 14 routers, 169 statements

The next largest open routers of the inventory, in order, skipping the excluded ones (`ha.py`, `energy_billing`, `energy_meters`,
`water`, `water_billing`, `wiskey*`, `intercom*`). One commit per router. After the change these 14 routers hold **0** `.execute(`
calls.

| Router | Statements | Store module | Notes |
|---|---|---|---|
| `calendar_feeds.py` | 15 | `services/calendar_feeds_store.py` | The document query keeps its `IN (?,..)` builder and gets `MAX_EVENTS` from the router at call time; the `users.disabled_at` old-database guard stays in the router; the last-used stamp still runs on the router's `write_aside` connection, the document on its token-free `feed_conn`. `render`, `feed_conn`, `RedactFeedToken`, `_FILTER`, `_RATE` kept. |
| `door_windows.py` | 15 | `services/door_windows_store.py` | The override's cancel + exclusion stay two calls in the old order, before the audit and the commit. |
| `frigate.py` | 15 | `services/frigate_store.py` | The two review queries move with their builders (`reviews_page`, `review_counts`). `_scope_sql` keeps the permission part (row scope, 403 for a caller with none) and takes the fragment from `store.scope_clause`. `_camera_row` (imported by `frigate_config`, `frigate_control`, `frigate_f2b`) unchanged. |
| `devices.py` | 13 | `services/devices_store.py` | The area assignment still writes the local mirror after the bridge answered; the bulk duplicate check still runs on the action's connection. `_envelope`, `READ`, `_configure_holder(_ro)`, `_visible_entities`, `_last_refresh` kept. |
| `generator.py` | 13 | `services/generator_store.py` | The device update keeps its `SET` builder over the router's fixed column allow-list. |
| `doors.py` | 12 | `services/doors_store.py` | The two active-binding reads use `services/rbac_admin._active_bindings_sql` (the function `routers/access` re-exported) with the same extra clauses; the `door_grant_bindings` old-database guard stays in the router. |
| `rules.py` | 12 | `services/rules_store.py` | The alert-scope WHERE builder moves to the store; `_alert_scope_sql` stays as an alias. The rule delete keeps alerts first, then the rule. |
| `notices.py` | 12 | `services/notices/router_store.py` (imported as `rstore`) | Placed in the notices package next to `services/notices/store.py`, which the router already imports as `store` and other modules import as `notices_store` - a `services/notices_store.py` would have been ambiguous. The five identical board change stamps share `touch_boards`. |
| `tickets_costs.py` | 12 | none - `services/savepoints.py` | All 12 statements were the two savepoints (`tk258_mark_paid`, `svc215_budget`): same names, same places, `ROLLBACK TO` + `RELEASE` = `rollback_savepoint`. |
| `views.py` | 10 | `services/views_store.py` | The soft delete still takes two `now_iso()` values from the router. |
| `access_custom_roles.py` | 10 | `services/access_custom_roles_store.py` | The name check still runs only when no built-in name matched; every name `routers/access.py` re-exports from the module is unchanged. |
| `recorders.py` | 10 | `services/recorders_store.py` | The list keeps its optional `removed_at` filter, the update its `SET` builder over the router's fixed columns. `create_recorder_row`, `destination_taken`, `recorder_settings`, `PERMISSION`, `_may_read` (imported by `cameras`, `nvr_connection`, `nvr_write`, `frigate*`, `recorder_health`) unchanged. |
| `calendar.py` | 10 | `services/calendar_store.py` | `Body`, `_audit`, `_body`, `_errors`, `module_gate`, `_now` (imported by `calendar_feeds` / `calendar_sync`, patched by the calendar tests) unchanged. |
| `notifications.py` | 10 | `services/notifications_store.py` | The two delivery lists move with their builders; the `since` check (422) stays in the router before the query. Note: `tests/test_switch_protection_reach_guard.py` globs `routers/notifications.py` and `services/notify*.py`; the new `notifications_store.py` is outside that glob (it names none of the guarded words). |

## Singletons (CR-BE-COMPLEXITY-2450)

The three router caches that branch left unregistered (`routers/cameras._CAPS_CACHE`, `routers/cameras._ZONES_CACHE`,
`routers/health._EVENTS_COUNT`, recorded in `tests/singletons_unregistered.txt` on `origin/pilot/CR-BE-COMPLEXITY-2450`) belong to
`cameras.py` (moved by the first step, not this batch) and `health.py` (not reached in this batch). None of them is in this batch,
so no reset was registered here. `routers/calendar_feeds._FILTER` (in this batch) is an older entry of the same list: a logging
filter installed once on import, not a per-test cache; left as recorded.

## Proof that the SQL did not change

The comparison script of the first step (AST: every string literal of the router at the base containing SQL, docstrings excluded,
whitespace normalised, must be present in the router + its store module after the change), run against `0a5d0431e`:

| Router | Literals at base (distinct) | Absent after |
|---|---|---|
| calendar_feeds | 15 (14) | 0 |
| door_windows | 15 (15) | 0 |
| frigate | 15 (15) | 0 |
| devices | 13 (11) | 0 |
| generator | 14 (14) | 0 |
| doors | 10 (10) - the two other statements are `_active_bindings_sql(...)` calls, kept verbatim | 0 |
| rules | 13 (13) | 0 |
| notices | 12 (8) | 0 |
| views | 10 (9) | 0 |
| access_custom_roles | 10 (8) | 0 |
| recorders | 12 (12) | 0 |
| calendar | 10 (6) | 0 |
| notifications | 11 (11) | 0 |
| tickets_costs | 12 (6) | 6 - the savepoint statements, composed in `services/savepoints.py` from the same names (`f"SAVEPOINT {name}"`, ...) |

Plus an AST check that no function of a changed router binds `store` / `rstore` / `savepoints` locally (none).

## Tests actually run

`pytest -p no:xdist -q -rf`, focused runs: every test file that names a moved router, its routes or its imports. Runs 1-2 and 6+11 on the
runner (owner's permission for this row, no gate running then, `nice -n 19`, own folder `~/work/routersqlb`, deleted after), the rest on
the workstation (`py -3.12`, `C:/cloude/smplwisebms/.venv`) after the 2.44.0 gate started on the runner; the PC was at 100% CPU
throughout, hence the wall times. Head of each run: runs 1-2 at `5a4d981e5` (calendar_feeds .. access_custom_roles), runs 3-11 at
`709642c0b` (all 14 routers).

| Run | Where | Routers | Test files | Result |
|---|---|---|---|---|
| 1 | runner | calendar_feeds | `test_calendar_connect_2330`, `test_calendar_feed_review_2351`, `test_local_auth_inventory` | **50 passed, 0 failed** (47 s) |
| 2 | runner | door_windows | `test_capemergency(2)_295`, `test_door_emergency*` (3), `test_door_engine_live_2310`, `test_doorwin2_*` (6), `test_doorwin_api`, `test_doorwin_watch`, `test_doorwrite_297`, `test_f3a_doorwin_dw03/05/06_295`, `test_f3c_e05_295`, `test_fake_doorwin_closed_rule_sr1`, `test_fake_doorwin_emergency`, `test_owner30_doors`, `test_splitswitch(2)_297`, `test_wiskey_rc4_deadline_2310`, `test_wiskeya06_297`, `test_wkr5_295_emergency` (27 files) | **444 passed, 0 failed** (13 min) |
| 3 | PC | frigate, generator, doors, rules | `test_frigate2_295`, `test_frigate_api`, `test_frigate_join`, `test_frigate_playback`, `test_frigate_wire_0182`, `test_generator`, `test_generator_home_widget`, `test_genlog_092`, `test_home_v3_p3`, `test_access_permissions_wxperm`, `test_bridge_key_pause_295`, `test_security_review_wxd_fixes`, `test_unlock_reason_2370`, `test_wiskey_d6_d8`, `test_wiskey_door_gate`, `test_wiskey_door_overrides`, `test_wiskey_door_path`, `test_wiskey_door_signed`, `test_wxd10_door_jobs`, `test_rules`, `test_rbac_camera_scope`, `test_security_review_220`, `test_p2_batch`, `test_announcements`, `test_push` | **555 passed, 0 failed** (26 min) |
| 4 | PC | devices | `test_devices`, `test_ha_structure_refresh`, `test_device_activity`, `test_device_types`, `test_installation_capabilities`, `test_area_row`, `test_area_redesign`, `test_scheduler_exclusions`, `test_service_identity_extended`, `test_raw_body_order`, `test_security_review_246_poc`, `test_media_bulk`, `test_media_review_fixes`, `test_home_interface`, `test_alarm` | **447 passed, 0 failed** (22 min) |
| 5 | PC | notices, tickets_costs | `test_notices_106`, `test_notices_info/perm/push/security_295`, `test_notice_boardv2_297`, `test_board_answers_2400`, `test_board_mgmt_2381`, `test_board_decisions_2407`, `test_notice_rss_sources_295`, `test_bustimes_295`, `test_announce_screens_b295`, `test_home_v3_p2`, `test_notice_slides_295`, `test_tickets_costs`, `test_tickets_budgets`, `test_tickets_tk251r`, `test_tickets_vendor_accounts`, `test_tickets_claim_instalments`, `test_tickets_detail`, `test_tickets_251_security` | **521 passed, 2 skipped, 0 failed** (86 min) |
| 7 | PC | views, access_custom_roles | `test_saved_views`, `test_correlation_helper_2440`, `test_custom_roles`, `test_access`, `test_rbac_groups` | **26 passed, 0 failed** (10 min) |
| 8 | PC | calendar (+ calendar_feeds again) | `test_calendar_attendees_2343`, `test_calendar_connect_2330`, `test_calendar_engine_2300`, `test_calendar_feed_review_2351`, `test_calendar_grid_edit_2343`, `test_calendar_recurrence_2300`, `test_calendar_sync_2300` | **187 passed, 0 failed** (15 min) |
| 9 | PC | recorders (+ its importers) | `test_multi_nvr`, `test_multi_nvr_live`, `test_camera_reboot_2407`, `test_nvr_system`, `test_security_lows`, `test_xsecfix_297`, `test_nvr_h264_bulk_2341`, `test_remote_access`, `test_nvr_write_guard_2438`, `test_cameras`, `test_nvr_cameras_settings`, `test_frigate_api` | **226 passed, 0 failed** (53 min) |
| 10 | PC | notifications | `test_notify_core`, `test_notify_channels`, `test_notify_email`, `test_notify_whatsapp`, `test_mobile_push`, `test_push`, `test_switch_protection_reach_guard`, `test_critical_sound`, `test_tickets_notify_matrix` | **285 passed, 0 failed** (42 min) |
| 6+11 | PC + runner | all (guards) | `test_get_routes_read_conn` (every GET route of the app still answers on the read connection while another connection holds the write lock), `test_async_routes_no_inline_db`, `test_f3c_g03_295`, `test_singletons_registered`, `test_routers_table_2440`, `test_db_locking`, `test_local_auth_inventory` | PC (without `test_local_auth_inventory`): **762 passed, 0 failed** (2 h 22 min); runner, all 7 files at `709642c0b` (the 2.44.0 gate had finished): **766 passed, 0 failed** (64 min) |

A first attempt of run 3 on the PC ended in 405 setup errors (`--basetemp` parent folder missing - my harness, not the code); it was
rerun as listed. Static: `ruff check smplwise` (rule set F): **All checks passed**; `scripts/gate/lint_backend.py --root .`:
**0 findings**.

NOT_RUN: the full backend suite (about 1,000 files; covered only by the next runner entry check / gate, not queued by this row);
the ~200 test files that reach these routes only through fixtures. Frontend: nothing changed.

## Left on purpose / remaining

- The excluded routers and `ha.py` (own row, see the first step's note).
- After this step **74 routers** still call `.execute(` (counted on this branch's head): `ha.py`, the 6 excluded ones and **67
  open** routers. Next by size `multimedia`, `remote`,
  `search` (9), `device_layouts`, `partner`, `plan_catalog` (8), `nvr_write` (7, source-guarded by `test_nvr_write_guard_2438.py`:
  run that guard first), then the long tail of 1-6 statements.
- No helper was de-duplicated across stores (e.g. `groups`, `live_entity_domain`, `live_sites` exist in several stores, each with its
  router's exact text).

## Outside my rows

None. New: the 13 store modules listed above. Changed: the 14 routers.

## Merge

`origin/release/2440-train` (`51da93753`) was merged into the branch after the tests (brief: merge the train before the final push). Its only
backend change since the base is `smplwise/__init__.py` (the version); none of the 14 routers, their stores or `services/savepoints.py`
changed, so the runs above stand for the merged head. Not rerun after the merge.
