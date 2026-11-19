# CR-ROUTER-SQL-C-2450 - SQL out of the routers, the small end (64 routers, 1-8 statements each)

Branch `pilot/CR-ROUTER-SQL-C-2450`, base `origin/pilot/CR-ROUTER-SQL-2450` at `0a5d0431e` (the programme step that moved the
16 largest routers; its change note `docs/changes/CR-ROUTER-SQL-2450.md` holds the pattern, the inventory and the proof method).
Review finding **05:P2-07**. Targets 2.46.0 (the 2.45.0 train closed without this row; lead 19.11). No version bump, no migration, no route change, no frontend change, no pixel change.

Split of the open inventory today: batch B (`pilot/CR-ROUTER-SQL-B-2450`) works from the largest open router down; this row
works from the smallest up and stops at 8 statements. Before every router `origin/pilot/CR-ROUTER-SQL-B-2450` was fetched;
batch B (finished at `205434ecc`) touched none of the 64 routers here (its routers: `access_custom_roles`, `calendar`, `calendar_feeds`,
`devices`, `door_windows`, `doors`, `frigate`, `generator`, `notices`, `notifications`, `recorders`, `rules`,
`tickets_costs`, `views`), and the two branches share no file. Excluded as briefed: `ha.py` (own row), `energy_billing`,
`energy_meters`, `water`, `water_billing`, `wiskey_installer_common`, `wiskey_relay_map`.

## Pattern (unchanged from CR-ROUTER-SQL-2450)

One `services/<router>_store.py` per router with typed functions (`conn` first, plain arguments, `sqlite3.Row` /
`list[sqlite3.Row]` / `int` / `None` back), imported as `store`; the inline `conn.execute(...)` becomes the store call at the
same place. For every statement: same SQL text and arguments (builders such as `IN (?,..)` lists and the audit screen's filter
fragments moved verbatim), same order and transaction, same read / write connection (no route signature changed), old-database
guards (`except sqlite3.OperationalError` / `sqlite3.Error`) stay in the router around the call, arguments the router evaluated
inline (`now_iso()`, `json.dumps(...)`, `device_id[:64]`, `core.iso(core.utcnow())`) are still evaluated by the caller in the
same order, and names other modules import from a router keep their signatures (`recordings.camera_for_playback`,
`calendar_attendees.snapshot / on_restore`, `device_layouts._row / _revision / _write`, `plan_catalog.COLUMNS / _ts`).

Choices specific to this row:

- **Deferred `BEGIN`.** Ten access-control routers re-open the request connection's transaction with a lock-free
  `conn.execute("BEGIN")` in a `finally` after a WisKey call (`access_control_command`, `_door`, `_ops`, `_people`,
  `_profiles`, `_capture` x4, `_door_tech`, `_station_ops`, `_triage`, `_diag`). They now call the new
  `services/savepoints.begin_deferred(conn)` next to the savepoint helpers (same statement; `test_db_gate`'s rule allows a
  deferred BEGIN anywhere). Five of those routers had no other SQL, so they got no store module.
- **Store name clashes.** Where the router already binds `store` (`automation_ext` -> services/automations,
  `skins` -> services/skins/store, `tickets_admin_settings` -> services/tickets/store, `plan_geometry` and `plan_package` ->
  services/geometry_store) the new module is imported under its own name. `routers/media.py`'s store is
  `services/media_routes_store.py` because `services/media_store.py` (the media device model) already exists.
- **plan_catalog / plan_package.** The INSERT / UPDATE builders (`COLUMNS`, `_INSERT`, `_UPDATE`) moved to
  `services/plan_catalog_store.py` (`COLUMNS`, `INSERT`, `UPDATE`); the router keeps `COLUMNS` as an alias. `plan_package`
  (its import of catalog items) now calls `plan_catalog_store.insert_item` instead of executing the router's `_INSERT`, so the
  temporary `_INSERT` alias the plan_catalog commit kept for it is dropped in the plan_package commit.
- **access_audit.** The audit screen's whole statement builder (the fixed fragments per `view` / `channel` / `actor_kind`, the
  `sw_username_norm` function registered on the connection, the parameters in order) moved into `access_audit_store.audit_rows`;
  `normalize_username` is no longer imported by the router.
- **partner.** The five form pickers iterated the cursor; the store answers `fetchall()` (same rows, same order).
- **Duplicates kept per router** (as the base row did): the camera row `SELECT * FROM cameras WHERE id = ?` exists in several
  stores, and `home_interface_store` / `home_v3_store` hold the same room-image statements (the caller's own image vs the
  shared one). Merging them is the programme's later clean-up.

## Routers moved: 64 routers, 141 statements (one commit each)

| Router | Statements | Store module | Commit |
|---|---|---|---|
| `routers/access_control_command.py` | 1 | `services/savepoints.py` | `73ec00847` |
| `routers/access_control_door.py` | 1 | `services/savepoints.py` | `ebd6ed48a` |
| `routers/access_control_ops.py` | 1 | `services/savepoints.py` | `611c73097` |
| `routers/access_control_people.py` | 1 | `services/savepoints.py` | `b6579fb2d` |
| `routers/access_control_profiles.py` | 1 | `services/savepoints.py` | `acb047366` |
| `routers/access_control_station_people.py` | 1 | `services/access_control_station_people_store.py` | `15fc80e28` |
| `routers/access_control_wa_queue.py` | 1 | `services/access_control_wa_queue_store.py` | `4d61be090` |
| `routers/access_directory.py` | 1 | `services/access_directory_store.py` | `b7daacdcb` |
| `routers/access_grants.py` | 1 | `services/access_grants_store.py` | `fe8779924` |
| `routers/access_roles.py` | 1 | `services/access_roles_store.py` | `fac067c90` |
| `routers/announcements.py` | 1 | `services/announcements_store.py` | `0fffa4e2c` |
| `routers/app_brand.py` | 1 | `services/app_brand_store.py` | `e5548f065` |
| `routers/app_secrets.py` | 1 | `services/app_secrets_store.py` | `2b515f256` |
| `routers/automation_blueprints.py` | 1 | `services/automation_blueprints_store.py` | `b571219c8` |
| `routers/automation_ext.py` | 1 | `services/automation_ext_store.py` | `ca4f08ca3` |
| `routers/camera_image_health.py` | 1 | `services/camera_image_health_store.py` | `5d4cef839` |
| `routers/exports.py` | 1 | `services/exports_store.py` | `93005ffa9` |
| `routers/floor_images.py` | 1 | `services/floor_images_store.py` | `96377d491` |
| `routers/frames.py` | 1 | `services/frames_store.py` | `78fd932bb` |
| `routers/frigate_control.py` | 1 | `services/frigate_control_store.py` | `dc46ff272` |
| `routers/home_gaps.py` | 1 | `services/home_gaps_store.py` | `e28ca5800` |
| `routers/home_wall_events.py` | 1 | `services/home_wall_events_store.py` | `051dc7f63` |
| `routers/me.py` | 1 | `services/me_store.py` | `2d2c3297f` |
| `routers/messaging_accounts.py` | 1 | `services/messaging_accounts_store.py` | `350de5b51` |
| `routers/nvr_privacy.py` | 1 | `services/nvr_privacy_store.py` | `995ca2cbe` |
| `routers/playback.py` | 1 | `services/playback_store.py` | `61028882e` |
| `routers/playback_groups.py` | 1 | `services/playback_groups_store.py` | `5cc1ae639` |
| `routers/popup_layout.py` | 1 | `services/popup_layout_store.py` | `159856eb7` |
| `routers/recordings.py` | 1 | `services/recordings_store.py` | `3b786c4bc` |
| `routers/second_factor.py` | 1 | `services/second_factor_store.py` | `669407d8a` |
| `routers/settings_patch/identity.py` | 1 | `services/settings_patch_identity_store.py` | `446ce3a19` |
| `routers/skins.py` | 1 | `services/skins_store.py` | `3b14e87c6` |
| `routers/storage.py` | 1 | `services/storage_store.py` | `51b8aee8d` |
| `routers/transit.py` | 1 | `services/transit_store.py` | `222f26ef7` |
| `routers/access_audit.py` | 2 | `services/access_audit_store.py` | `d38f3d8f4` |
| `routers/access_control_door_tech.py` | 2 | `services/access_control_door_tech_store.py` | `0617b19dc` |
| `routers/access_control_station_ops.py` | 2 | `services/access_control_station_ops_store.py` | `ec05612f2` |
| `routers/access_control_triage.py` | 2 | `services/access_control_triage_store.py` | `a9d2c8270` |
| `routers/app_refresh.py` | 2 | `services/app_refresh_store.py` | `007ea8ff3` |
| `routers/door_automations.py` | 2 | `services/door_automations_store.py` | `375b55dbd` |
| `routers/fleet.py` | 2 | `services/fleet_store.py` | `20790c338` |
| `routers/occupancy.py` | 2 | `services/occupancy_store.py` | `1edb10071` |
| `routers/plan_area_links.py` | 2 | `services/plan_area_links_store.py` | `83dda6552` |
| `routers/settings_patch/site.py` | 2 | `services/settings_patch_site_store.py` | `eca564f9a` |
| `routers/tickets_admin_settings.py` | 2 | `services/tickets_admin_settings_store.py` | `d328e5c58` |
| `routers/access_bindings.py` | 3 | `services/access_bindings_store.py` | `471d4629e` |
| `routers/access_control_diag.py` | 3 | `services/access_control_diag_store.py` | `d75ee17f2` |
| `routers/incidents.py` | 3 | `services/incidents_store.py` | `f3da0313d` |
| `routers/local_passkeys.py` | 3 | `services/local_passkeys_store.py` | `c0c20d284` |
| `routers/media.py` | 3 | `services/media_routes_store.py` | `bd294891d` |
| `routers/offline_field.py` | 3 | `services/offline_field_store.py` | `f12e6d529` |
| `routers/plan_geometry.py` | 3 | `services/plan_geometry_store.py` | `ad69b92c5` |
| `routers/push.py` | 3 | `services/push_store.py` | `161530ae0` |
| `routers/access_control_capture.py` | 4 | `services/savepoints.py` | `4063f327c` |
| `routers/camera_suggest.py` | 4 | `services/camera_suggest_store.py` | `5debe264e` |
| `routers/home_v3.py` | 4 | `services/home_v3_store.py` | `292aea355` |
| `routers/health.py` | 5 | `services/health_store.py` | `75f08a5bd` |
| `routers/calendar_attendees.py` | 6 | `services/calendar_attendees_store.py` | `e436c7a58` |
| `routers/home_interface.py` | 6 | `services/home_interface_store.py` | `b96f255f7` |
| `routers/nvr_write.py` | 7 | `services/nvr_write_store.py` | `b36244c47` |
| `routers/device_layouts.py` | 8 | `services/device_layouts_store.py` | `fe30e0600` |
| `routers/partner.py` | 8 | `services/partner_store.py` | `4f8e8c918` |
| `routers/plan_catalog.py` | 8 | `services/plan_catalog_store.py` | `aa1b28fde` |
| `routers/plan_package.py` | 1 | `services/plan_catalog_store.py` | `79cd01d81` |

After the change none of the 64 routers holds a `.execute(` / `.executemany(` / `.executescript(` call. Open after this row
and batch B: the routers with 9+ statements batch B has not reached, plus `ha.py` and the excluded ones.

## Proof that the SQL did not change

The base row's AST comparison (every SQL string literal and every literal part of an f-string of the router at `0a5d0431e`,
docstrings excluded, whitespace normalised, must be present in the router + its store after the change) was run for each
router before its commit: **64 of 64 routers, 0 literals absent**. For `access_audit` the wider variant (clause fragments such
as `" AND resource_id = ?"` included) was run too: 10 of 10 present. The deferred `BEGIN` literals are not SQL-keyword matches
in that script; they were checked by hand (13 call sites in 10 routers, all now `savepoints.begin_deferred`, the only new SQL text being
`conn.execute("BEGIN")` inside `services/savepoints.py`). The partner templates statement is a triple-quoted string whose
continuation-line indentation changed with the move (whitespace only).

## Checks and tests actually run

Static (workstation, Python 3.12):

- `ruff check smplwise` (rule set F, the blocking lane): **All checks passed**; `scripts/gate/lint_backend.py --root .`:
  **0 findings** (at `79cd01d81`, all 64 routers; and per router before each commit: ruff F on the router + store).
- An AST check per router that no function binds the name `store` locally (0 everywhere).
- Import of every module under `smplwise.routers` and `smplwise.services` with the workstation venv: **0 failures**
  (at `d328e5c58`, after the first 46 routers).

- `test_db_gate.py::test_no_manual_transaction_control_outside_db_py` (part of the runner run below) passes with the new
  `begin_deferred`.

Backend tests, all at `79cd01d81` (the code head; later commits are this note and the train merge):

The file list: every backend test file that names one of the 64 routers (`routers.<name>` / `routers/<name>.py` / an import
of it), whose file name contains the router's name (names of 5+ characters), or that calls one of the routers' URL prefixes,
plus the guards (`test_db_gate`, `test_get_routes_read_conn`, `test_sql_boundary_report`, `test_setting_callers_2440`,
`test_capture_lease_triggers`, `test_capture_lease_ledger`, `test_wiskey_final3_281`, `test_tickets_naming`,
`test_async_routes_hold_no_write_conn`): **563 files**, split into 29 chunks of 20.

| Where | What | Result |
|---|---|---|
| Runner (own worktree `~/work/routersqlc`, `nice -n 19`, own basetemp; only while `gate_status.json` showed no gate, a watcher killed the run when one started) | 20 of 29 chunks = **383 files** | **9,937 passed, 10 skipped, 3 xfailed, 3 failed**. The 3 failures are load / timing flakes, each re-run on the runner on this branch and passing: `test_media_players_commands::test_seek_and_shuffle_are_rate_limited_per_device_and_the_limit_is_audited` and `test_media_review_fixes::test_l4_the_group_volume_bucket_...` (a token bucket refilled between calls on the loaded runner, load 15-20; both pass alone), `test_notify_channels::test_rule_alerts_are_notifications_folded_and_acknowledged_both_ways` (passes alone twice and with its whole file, 19 passed). None of the three files reaches a router of this row (media players, rules / notifications) |
| Workstation (`py -3.12`, the main venv, `-p no:cacheprovider`) | group 1: the guards + the access-control suites (`test_sql_boundary_report`, `test_capture_lease_triggers`, `test_capture_lease_ledger`, `test_wiskey_door_path`, `test_wiskey_door_gate`, `test_tickets_naming`, `test_setting_callers_2440`, `test_async_routes_hold_no_write_conn`, `test_wiskey_access_diag`, `test_wiskey_door_tech`, `test_wiskey_station_ops`, `test_wiskey_station_people_2390`, `test_wiskey_triage_2400`, `test_wiskey_wa_queue_2400`, `test_intercom_capture_lease`) | **734 passed, 1 skipped, 0 failed** (44 min) |
| Workstation | group 2: `test_access`, `test_username_normalisation`, `test_access_grants`, `test_announcements`, `test_app_refresh_295`, `test_automation_blueprints_80`, `test_automations_extra`, `test_brand_logos_295`, `test_calendar_attendees_2343`, `test_device_layouts`, `test_door_automation_295`, `test_exports`, `test_fleet_report_215`, `test_floor_images`, `test_frames` | **424 passed, 0 failed** (66 min) |
| Workstation | the router suites of the chunks the runner could not finish: `test_frigate_control`, `test_nvr_write`, `test_nvr_write_guard_2438`, `test_offline_field_295`, `test_partner_api_113`, `test_plan_area_links`, `test_plan_catalog_api`, `test_plan_catalog`, `test_plan_geometry_api`, `test_plan_package`, `test_plan_skins`, `test_popup_layout_2290`, `test_recordings`, `test_playback_release`, `test_playback_sync`, `test_device_layout_cards`, `test_exports_housekeeping_2440` | **294 passed, 0 failed** (36 min) |
| Workstation | `test_get_routes_read_conn.py` (every GET route still answers while another connection holds the write lock; the read-connection allow-list did not move) | **722 passed, 0 failed** (89 min) |

NOT_RUN:

- **9 runner chunks = 180 of the 563 files** (chunks 005-007, 014-018, 023): the 2.44.0 re-gates and then the 2.45.0 release
  gate took the runner. Of them, the router suites were run on the workstation (the last two rows above); still NOT_RUN are
  the 34 wider files that name a router of this row - `test_fake_doorwin_closed_rule_sr1`, `test_fleet_receiver_fixtures_215`,
  `test_frigate_api`, `test_frigate_playback`, `test_frigate_restream`, `test_go2rtc_big_media`, `test_go2rtc_stream_sync_2436`,
  `test_plan_detect_api`, `test_plan_door_tool`, `test_plan_geometry_{binding,db,export,integration,model,objects,render,render2,stairs,store}`,
  `test_plan_package_pln2`, `test_playback_{cap,race,scrub_2341,stall_settings,stress_2332,timing_t074}`,
  `test_provision_{live_source_cache,nvr_write_script,playback}`, `test_rbac_camera_scope`, `test_readyfleet_295`,
  `test_recorder_health`, `test_recorder_health_nn6`, `test_remote_hardening` - and the 124 files of those chunks picked only by
  URL prefix. They are left to the next runner entry check / gate.
- The full backend suite (999 files); frontend: nothing changed; no pixel run (no UI change).
