# CR-ROUTER-SQL-2450 - SQL out of the routers (programme step, 16 routers)

Branch `pilot/CR-ROUTER-SQL-2450`, base `origin/release/2440-train` at `e9d17b5ab`. Code review 2026-11-13, finding
**05:P2-07** ("business and SQL in routers") and `MASTER_PLAN.md` section 3.6 ("SQL out of the remaining routers", the
programme after the three splits `CR-SPLIT-ACCESS-2440`, `CR-SPLIT-ACCESS-CONTROL-2440`, `CR-SPLIT-TICKETS-ADMIN-2440`).
Targets 2.45.0. No version bump, no migration, no route change, no frontend change, no pixel change.

## Pattern (copied from the three splits)

One service module per router, `services/<router>_store.py`, holding typed functions (`conn` first, plain arguments,
`sqlite3.Row` / `list[sqlite3.Row]` / `int` / `bool` back). The router imports it as `store` and calls it where the inline
`conn.execute(...)` stood. Rules kept for every statement:

- **Same SQL text and arguments.** The literal text moved verbatim; where the router built a statement (dynamic `WHERE`,
  `IN (?,?,..)`, `SET a = ?, b = ?`) the builder moved with it unchanged.
- **Same order of statements and the same transaction.** A store function runs on the connection the route hands it; nothing
  opens, commits or releases a connection. A function that wraps several statements (`delete_case`, `remove_connection`,
  `delete_unit`, `write_rows`, ...) issues them in the old order. Arguments that the old code evaluated inline (`now_iso()`,
  `new_id()`, `json.dumps(...)`) are evaluated by the caller in the same left-to-right order.
- **Same read / write connection (READCONN).** No route signature changed: every `GET` that ran on `get_read_conn` still does,
  audited GETs and write routes still run on `get_conn`, the routers' own `write_aside` / `connection(mode="read")` blocks
  pass their connection to the store. The read-connection inventory (`tests/test_get_routes_read_conn.py`) is untouched.
- **Old-database guards stay in the router.** `try: ... except sqlite3.OperationalError` around a statement now wraps the
  store call (the store function's docstring says it raises).
- **Names other code imports from a router are kept** (signatures unchanged): `events._facet_rows` (alias), `catalog.get_site
  / get_building / get_floor / floor_row`, `plans.get_version / version_row / version_at / needs_alignment`,
  `anchors.camera_row / removed_recorder_cameras / _editor_version`, `zones.floor_zones / zone_row`, `cameras.*`.
- **Savepoints** (`ha_users`, `local_identity`, `wall`, `access_groups`) go through the new `services/savepoints.py`
  (`savepoint`, `rollback_savepoint` = `ROLLBACK TO` + `RELEASE`, `release_savepoint`), same names, same pairs.

05:P2-09 (services importing routers) is closed for one more router on the way: `services/mapping_auto.py` imported
`_labels, _site_buildings, _site_floors, _new_version, site_rows` from `routers/home_mapping.py`; they now live in
`services/home_mapping_store.py` (the router keeps the old names as aliases) and `mapping_auto` imports them from there.

## Inventory (step 1)

Every router module under `smplwise_vms/backend/smplwise/routers/` (207 files at the base) that still called
`.execute(` / `.executemany(` / `.executescript(` at the base commit: **104 routers, 905 calls**. Count = calls at
`e9d17b5ab` (`grep -cE '\.execute(many|script)?\('`), lines = file length at the base. Status: moved on this branch,
EXCLUDED (owned by other agents today: `electricity* / water* / tariff* / billing* / bill* / meter* / wiskey* / intercom*`),
or open (later rows of the programme).

| Router | SQL calls | Lines | Status |
|---|---|---|---|
| `routers/events.py` | 47 | 908 | moved (store module, this branch) |
| `routers/catalog.py` | 43 | 561 | moved (store module, this branch) |
| `routers/home_mapping.py` | 43 | 512 | moved (store module, this branch) |
| `routers/cases.py` | 41 | 1049 | moved (store module, this branch) |
| `routers/ha_users.py` | 41 | 408 | moved (store module, this branch) |
| `routers/local_identity.py` | 38 | 940 | moved (store module, this branch) |
| `routers/temperature.py` | 35 | 1206 | moved (store module, this branch) |
| `routers/calendar_sync.py` | 29 | 472 | moved (store module, this branch) |
| `routers/plans.py` | 26 | 760 | moved (store module, this branch) |
| `routers/wall.py` | 26 | 621 | moved (store module, this branch) |
| `routers/alarm.py` | 25 | 914 | moved (store module, this branch) |
| `routers/anchors.py` | 24 | 672 | moved (store module, this branch) |
| `routers/ha.py` | 24 | 928 | open |
| `routers/energy_billing.py` | 20 | 1077 | EXCLUDED (owned by another agent today) |
| `routers/access_groups.py` | 19 | 484 | moved (store module, this branch) |
| `routers/elevators.py` | 18 | 352 | moved (store module, this branch) |
| `routers/cameras.py` | 17 | 412 | moved (store module, this branch) |
| `routers/zones.py` | 17 | 576 | moved (store module, this branch) |
| `routers/water.py` | 16 | 908 | EXCLUDED (owned by another agent today) |
| `routers/calendar_feeds.py` | 15 | 484 | open |
| `routers/door_windows.py` | 15 | 779 | open |
| `routers/frigate.py` | 15 | 599 | open |
| `routers/devices.py` | 13 | 1016 | open |
| `routers/generator.py` | 13 | 548 | open |
| `routers/water_billing.py` | 13 | 563 | EXCLUDED (owned by another agent today) |
| `routers/doors.py` | 12 | 551 | open |
| `routers/notices.py` | 12 | 1218 | open |
| `routers/rules.py` | 12 | 247 | open |
| `routers/tickets_costs.py` | 12 | 638 | open |
| `routers/access_custom_roles.py` | 10 | 169 | open |
| `routers/calendar.py` | 10 | 507 | open |
| `routers/notifications.py` | 10 | 479 | open |
| `routers/recorders.py` | 10 | 460 | open |
| `routers/views.py` | 10 | 146 | open |
| `routers/multimedia.py` | 9 | 1062 | open |
| `routers/remote.py` | 9 | 518 | open |
| `routers/search.py` | 9 | 247 | open |
| `routers/device_layouts.py` | 8 | 621 | open |
| `routers/partner.py` | 8 | 348 | open |
| `routers/plan_catalog.py` | 8 | 169 | open |
| `routers/nvr_write.py` | 7 | 713 | open |
| `routers/calendar_attendees.py` | 6 | 302 | open |
| `routers/home_interface.py` | 6 | 502 | open |
| `routers/health.py` | 5 | 225 | open |
| `routers/access_control_capture.py` | 4 | 572 | open |
| `routers/camera_suggest.py` | 4 | 84 | open |
| `routers/home_v3.py` | 4 | 129 | open |
| `routers/access_bindings.py` | 3 | 55 | open |
| `routers/access_control_diag.py` | 3 | 408 | open |
| `routers/energy_meters.py` | 3 | 550 | EXCLUDED (owned by another agent today) |
| `routers/incidents.py` | 3 | 277 | open |
| `routers/local_passkeys.py` | 3 | 297 | open |
| `routers/media.py` | 3 | 734 | open |
| `routers/offline_field.py` | 3 | 220 | open |
| `routers/plan_geometry.py` | 3 | 809 | open |
| `routers/push.py` | 3 | 152 | open |
| `routers/access_audit.py` | 2 | 123 | open |
| `routers/access_control_door_tech.py` | 2 | 469 | open |
| `routers/access_control_station_ops.py` | 2 | 270 | open |
| `routers/access_control_triage.py` | 2 | 440 | open |
| `routers/app_refresh.py` | 2 | 540 | open |
| `routers/door_automations.py` | 2 | 180 | open |
| `routers/fleet.py` | 2 | 161 | open |
| `routers/occupancy.py` | 2 | 135 | open |
| `routers/plan_area_links.py` | 2 | 85 | open |
| `routers/settings_patch/site.py` | 2 | 82 | open |
| `routers/tickets_admin_settings.py` | 2 | 537 | open |
| `routers/wiskey_installer_common.py` | 2 | 206 | EXCLUDED (owned by another agent today) |
| `routers/access_control_command.py` | 1 | 388 | open |
| `routers/access_control_door.py` | 1 | 244 | open |
| `routers/access_control_ops.py` | 1 | 350 | open |
| `routers/access_control_people.py` | 1 | 342 | open |
| `routers/access_control_profiles.py` | 1 | 458 | open |
| `routers/access_control_station_people.py` | 1 | 615 | open |
| `routers/access_control_wa_queue.py` | 1 | 335 | open |
| `routers/access_directory.py` | 1 | 61 | open |
| `routers/access_grants.py` | 1 | 524 | open |
| `routers/access_roles.py` | 1 | 41 | open |
| `routers/announcements.py` | 1 | 223 | open |
| `routers/app_brand.py` | 1 | 71 | open |
| `routers/app_secrets.py` | 1 | 204 | open |
| `routers/automation_blueprints.py` | 1 | 180 | open |
| `routers/automation_ext.py` | 1 | 255 | open |
| `routers/camera_image_health.py` | 1 | 99 | open |
| `routers/exports.py` | 1 | 132 | open |
| `routers/floor_images.py` | 1 | 109 | open |
| `routers/frames.py` | 1 | 313 | open |
| `routers/frigate_control.py` | 1 | 259 | open |
| `routers/home_gaps.py` | 1 | 77 | open |
| `routers/home_wall_events.py` | 1 | 88 | open |
| `routers/me.py` | 1 | 304 | open |
| `routers/messaging_accounts.py` | 1 | 446 | open |
| `routers/nvr_privacy.py` | 1 | 160 | open |
| `routers/plan_package.py` | 1 | 235 | open |
| `routers/playback.py` | 1 | 264 | open |
| `routers/playback_groups.py` | 1 | 207 | open |
| `routers/popup_layout.py` | 1 | 77 | open |
| `routers/recordings.py` | 1 | 75 | open |
| `routers/second_factor.py` | 1 | 235 | open |
| `routers/settings_patch/identity.py` | 1 | 231 | open |
| `routers/skins.py` | 1 | 196 | open |
| `routers/storage.py` | 1 | 68 | open |
| `routers/transit.py` | 1 | 183 | open |
| `routers/wiskey_relay_map.py` | 1 | 193 | EXCLUDED (owned by another agent today) |

Moved on this branch: **16 routers, 489 statements** (largest first, skipping the excluded ones and `ha.py`,
see "Left on purpose"). After the change the 16 routers hold **0** `.execute(` calls.

| Router | Statements | Store module | Commit |
|---|---|---|---|
| `events.py` | 47 | `services/events_store.py` | `bb8634255` |
| `catalog.py` | 43 | `services/catalog_store.py` | `71a7f2865` |
| `home_mapping.py` | 43 | `services/home_mapping_store.py` (+ the link writes of `catalog_store`) | `343e8a243` |
| `ha_users.py` | 41 | `services/ha_users_store.py` + `services/savepoints.py` | `bb9a9175c` |
| `cases.py` | 41 | `services/cases_store.py` | `48f8f6b32` |
| `local_identity.py` | 38 | `services/local_identity_store.py` | `74880d941` |
| `temperature.py` | 35 | `services/temperature_store.py` | `2e058250a` |
| `calendar_sync.py` | 29 | `services/calendar_sync_store.py` | `f3c8d196f` |
| `wall.py` | 26 | `services/wall_store.py` | `54bcf005a` |
| `plans.py` | 26 | `services/plans_store.py` | `b7bcfed61` |
| `alarm.py` | 25 (the commit message says 24; 25 is right) | `services/alarm_store.py` | `e31991f89` |
| `anchors.py` | 24 | `services/anchors_store.py` | `4d6941560` |
| `access_groups.py` | 19 | `services/access_groups_store.py` | `df8dc03cc` |
| `elevators.py` | 18 | `services/elevators_store.py` | `1f2932775` |
| `zones.py` | 17 | `services/zones_store.py` (imported as `zones_store`: one function binds `geometry_store` to `store` locally) | `834c38617` |
| `cameras.py` | 17 | `services/cameras_store.py` | `35c5ef88b` |

## Proof that the SQL did not change

A script (AST, not part of the branch) collected every string literal containing SQL of each router at the base commit
(docstrings excluded, whitespace normalised) and looked for it in the router + its store module(s) after the change.
Every literal is present, except two kinds that are now composed from the same parts:

- the savepoint statements of `ha_users`, `local_identity`, `wall`, `access_groups`: `f"SAVEPOINT {name}"` etc. in
  `services/savepoints.py`, with the router's own savepoint name (`usr1_probe`, `usr1_bind`, `usr1_cleanup`, `usr2_create`,
  `usr2_role`, `wall_create`, `wall_patch`, `wall_remove`, `t082_all_or_nothing`);
- the three `PATCH` statements of `catalog`: `f"UPDATE {table} SET {sets}, updated_at = ? WHERE id = ?"` in
  `catalog_store.patch_row`, with `table` in a fixed allow-list (`sites`, `buildings`, `floors`) - the same text the three
  `f"UPDATE sites SET {sets}, ..."` produced.

## Tests actually run

Workstation, Python 3.12 (`C:/cloude/smplwisebms/.venv`), `pytest -p no:xdist`, run while other agents loaded the PC
(CPU at 100% throughout, so the wall times are long). Each run is the router's own API suites plus the guards around it:

| Run | Routers | Test files | Result |
|---|---|---|---|
| 1 | events, catalog, home_mapping | `test_events.py`, `test_events_cache.py`, `test_event_detail.py`, `test_event_windows.py`, `test_spatial_search.py`, `test_soak_dbgrowth_2412.py`, `test_ha_events_list.py`, `test_correlation.py`, `test_route.py`, `test_thumbnails.py`, `test_frigate_api.py`, `test_get_routes_read_conn.py`, `test_catalog.py`, `test_home_links.py`, `test_mapping_assist_2330.py` | **819 passed, 0 failed** (99 min). `test_get_routes_read_conn.py` covers every GET route of the application (the REST allow-list exists): every converted GET still answers while another connection holds the write lock, and the allow-list did not move |
| 1a | catalog, home_mapping | `test_catalog.py`, `test_catalog_images.py`, `test_home_links.py`, `test_mapping_assist_2330.py`, `test_building_reach_round14.py`, `test_building_scope_control_2351.py`, `test_multibuilding_home_2330.py`, `test_site_location.py`, `test_floor_images.py`, `test_body_limit.py` | 83 passed, 0 failed (count read from the progress dots; the summary line was hidden by `-qq`) |
| 2 | ha_users, local_identity, cases | `test_ha_users.py`, `test_templink_2320.py`, `test_local_identity.py`, `test_local_identity_units.py`, `test_local_user_create_2438.py`, `test_capture_lease_local_actor.py` (the source guard on `routers/local_identity.py`), `test_cases.py`, `test_bundle.py`, `test_bundle_import.py` | **257 passed, 0 failed** (33 min) |
| 3 | temperature, calendar_sync, wall, plans, alarm, anchors | `test_infra_temperature.py`, `test_infra_temperature_phase3.py`, `test_infra_temperature_report.py`, `test_temperature_registry_295.py`, `test_tempvendor_295.py`, `test_calendar_connect_2330.py`, `test_calendar_sync_2300.py`, `test_wall.py`, `test_wall_alerts.py`, `test_plan_versions.py`, `test_plans.py`, `test_plan_anchor_scope_plns.py`, `test_alarm.py`, `test_alarm_managed_cache.py`, `test_anchor_3d.py`, `test_anchor_coverage.py` | **295 passed, 0 failed** (32 min) |
| 4 | access_groups, elevators, zones, cameras | `test_rbac_groups.py`, `test_infra_elevators.py`, `test_infra_elevators_280.py`, `test_infra_elevators_travel.py`, `test_elevator_alert_recipients_295.py`, `test_zones.py`, `test_zones_nvr.py`, `test_zonecount107_295.py`, `test_cameras.py`, `test_camera_card.py`, `test_camera_sources_2410.py`, `test_nvrless_cameras_2411.py`, `test_nvr_cameras_settings.py`, `test_multi_nvr.py`, `test_nvr_less.py`, `test_shared_spaces.py`, `test_permcam63_shared_spaces.py`, `test_db_locking.py`, `test_capabilities.py` | **475 passed, 0 failed** (52 min) |

Static:

- `ruff check smplwise` (rule set F, the blocking lane): **All checks passed**; `scripts/gate/lint_backend.py --root .`:
  **0 findings**. (`ruff check tests` reports 3,049 pre-existing findings in test files this branch does not touch; tests
  are outside the blocking lane.)
- The SQL-literal comparison above (16 routers): no literal absent except the two composed kinds listed.
- An AST check that no function of a changed router binds the name `store` locally (found one in `zones.py`, hence
  `zones_store`).

NOT_RUN:

- **The full backend suite on the PC.** 999 test files; at the measured rate on this loaded workstation (19 files in
  52 min for run 4) it is well over a day of wall time. Instead every test file that names one of the 16 routers or its
  routes in its file name or imports was run (the table above, 66 distinct files). About 210 test files reach these
  routes indirectly (fixtures that create sites / floors / cameras through the API); they are covered only by the next
  runner entry check / gate, which this row did not queue (brief: no gate, runner busy).
- Frontend: nothing changed. Runner: nothing run.

## Left on purpose

- **Excluded routers** (other agents today): `energy_billing.py`, `energy_meters.py`, `water.py`, `water_billing.py`,
  `wiskey_installer_common.py`, `wiskey_relay_map.py`. `services/intercom_sync.py` and `services/wiskey_background_feed.py`
  untouched.
- **`ha.py` (24)** is next in size but holds the single-entity action route whose body is pinned by source guards
  (`test_switch_protection_reach_guard.py` reads `run_action`, `test_schedimpact_295_addon.py` and
  `test_wiskey_door_path.py` read the file) and its own timing / write-aside choreography; it deserves its own row with
  those guards run first.
- The 83 open routers of the inventory (`calendar_feeds`, `door_windows`, `frigate` at 15; `devices`, `generator` at 13; ...).
- No helper was de-duplicated across stores beyond `catalog_store`'s link writes (reused by `home_mapping_store`): e.g.
  `user_ids`, `camera_exists`, `live_entity_domain` exist in several stores, each with its router's exact text. Merging them is
  a later clean-up once the programme is done.

## Outside my rows

- `services/mapping_auto.py` (two function-local import lines), `services/mapping_engine.py` (one comment).
- New: `services/savepoints.py` and the 16 `services/*_store.py` modules.
