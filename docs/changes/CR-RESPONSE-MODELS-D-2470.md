# CR-RESPONSE-MODELS-D-2470 - response models and generated client types for the small routers of CR-ROUTER-SQL-C-2450 (part 1)

Branch `pilot/CR-RESPONSE-MODELS-D-2470`, base `origin/release/2450-train` (`521165ad4`) with `origin/pilot/CR-ROUTER-SQL-C-2450`
(`d228cb84c`) and `origin/pilot/CR-ROUTE-CHAR-2460` (`345bea645`) merged. Target 2.47.0. Code review 07:F8 step 2 (MASTER_PLAN 3.6).
No route, status code, key, value, number type or key order changed; no migration; no version bump; no pixel change expected.
Stopped early (owner's weekly usage limit): 16 of the 61 routers are done, the rest is listed below.

## What changed

- `scripts/gen_wire_types.py`: a separate block `FAMILIES_D` (all 61 routers of the row, one generated file each), merged into
  `FAMILIES` after the parallel batch-B row's block (CR-RESPONSE-MODELS-C-2470) so the two edits merge without a conflict. A router
  without models writes no file.
- `tests/test_wire_routers_d_2470.py`: for every router of the block that has a wire module - every JSON route declares a wire model
  with `exclude_unset`, `NO_JSON` is exact, every model keeps undeclared keys, the generated files are current (`--check`) and name
  every modelled route, no `.execute(` came back into the router.
- `tests/test_wire_local_passkeys_2470.py`: the four public passkey routes answer their own JSONResponse; their real bodies are fitted
  strictly (values, types, key order); rename and the administrator's list go through the oracle.

| Router(s) | Wire module | Frontend on the generated types | Commit |
|---|---|---|---|
| access_directory, access_roles, access_bindings, access_audit | `wire/access_*.py` (binding = `access_groups.AccessGroupBinding`) | `api/access.ts`, `screens/system-audit.ts` | `17ce0894e` |
| second_factor | `wire/second_factor.py` | `api/second-factor.ts`, `components/sw-second-factor.ts` | `dc40e93af` |
| local_passkeys | `wire/local_passkeys.py` (+ `local_identity.LocalSignInSession`) | `api/passkeys.ts`, `arx/local-auth.ts` | `389e1a792` |
| camera_suggest | `wire/camera_suggest.py` | `api/zones.ts` | `f2d270850` |
| home_gaps, home_wall_events | `wire/home_gaps.py`, `wire/home_wall_events.py` | `home/home-gaps-alarm.ts`, `home/home-fb-api.ts` | `601a1f268` |
| popup_layout | `wire/popup_layout.py` | `api/popup-layout.ts` | `7b4b09895` |
| home_interface, home_v3 | `wire/home_interface.py`, `wire/home_v3.py` | `home/home-api.ts`, `home/sw-home-admin.ts`, `home/sw-home.ts`, `home/home-intercom.ts` | `f30fd12f0` |
| me | `wire/me.py` (interface block = `HomePolicy`) | `api/types.ts` (`Me`), `api/me-prefs.ts` | `fd1e5a0af` |

Key order: models declare the routes' own order (fields of `{**a, **b}` answers are written out, not inherited), so the JSON is
byte-identical, not only equal.

### Drift the generated types found (no runtime crash found in these routers)

1. `DirectoryUser.source` / `remote_access_basis` lacked `'local'` (Arx-only identities); `Me.user.source` lacked `local` / `bearer`.
2. `AuditRow.id` typed `string` (server: integer); `permission_revision` `string | number`.
3. `POST /auth/second-factor/confirm|disable` answer without `policy`; the client assigned it to the full status type. The card never
   read `policy`; its state type now says so (`components/sw-second-factor.ts`).
4. The administrator's passkey removal was typed as a bare summary (it carries `user_id`, `removed`, `sessions_ended`, ...).
5. Home policy / overview fields the client had optional (`choose`, `kiosk_exit`, `wallpaper`, `guests`, `room_wallpapers`, `weather`,
   `unlock_reason`, `can_unlock`) are always sent.

## Tests actually run (workstation, Python 3.12 venv, `-p no:xdist`, `SW_WIRE_STRICT=1` + the wire oracle from conftest)

| What | Result |
|---|---|
| Baseline before the models with a shape recorder (scratch plugin, not committed): test_access, test_rbac_groups, test_custom_roles, test_remote_access, test_remote_admins_default, test_username_normalisation, test_tickets_naming, test_second_factor(+_followups), test_local_passkeys, test_passkey_only, test_local_identity, test_kiosk_role, test_access_permissions_wxperm | 792 passed, 1 skipped |
| Run 1 with the models: the same 14 files + test_wire_routers_d_2470 + test_camsuggest138_295 | 830 tests: 829 passed, 1 skipped, 0 failed |
| Run 2: test_wire_routers_d_2470, test_wire_local_passkeys_2470, test_home_followup_b_2431, test_home_interface, test_home_interface_doors_2421, test_home_v3_followup_a, test_home_v3_gaps_2436, test_home_v3_p1/p2/p3, test_popup_layout_2290, test_area_row, test_dd_style, test_nav_size, test_ui_lang_pref, test_settings_nav_pref | 264 passed, 0 failed |
| Oracle coverage (`scripts/wire_route_coverage.py` over both runs) | every modelled route of the 16 routers compared at least once, except `GET /home/room-wallpapers` (model from the code only) and the 4 public passkey routes (own JSONResponse, fitted by the new test) |
| ruff (F, E402) on the wire package, the changed routers, the new tests, the generator | all checks passed |
| `scripts/gen_wire_types.py --check` | rc 0 |
| Frontend `npx tsc --noEmit -p tsconfig.tests.json` | 1 error (unused import in `home/sw-home-admin.ts`), fixed; the re-run after the fix: NOT_RUN (the fix only removes the import) |

NOT_RUN: ESLint, frontend unit specs, browser specs (Vite dev server), runner, the full backend suite, `test_get_routes_read_conn.py`,
`unused-exports.mjs` / `api-client-check.mjs`.

## Remaining (45 routers)

Parked, written but untested (patch kept outside the repo, not committed): recordings, playback, playback_groups.
Not started: access_control_capture, _diag, _door, _door_tech, _ops, _people, _profiles, _station_ops, _station_people, _triage,
_wa_queue, access_grants, announcements, app_brand, app_refresh, app_secrets, automation_blueprints, automation_ext,
calendar_attendees, camera_image_health, device_layouts, door_automations, exports, fleet, floor_images, frames, frigate_control,
health, incidents, media, messaging_accounts, nvr_privacy, nvr_write, occupancy, offline_field, partner, plan_area_links, plan_catalog,
plan_geometry, plan_package, push, skins, storage, tickets_admin_settings, transit (settings_patch/* and access_control_command have no
routes). Also open: a test reaching `GET /home/room-wallpapers`.

## Open questions (recommendation first)

1. Merge order with CR-RESPONSE-MODELS-C-2470: both edit `scripts/gen_wire_types.py` in separate blocks and `api/access.ts`
   (`RoleInfo` stays hand-written here for the custom-roles answers that row models). Recommendation: merge C first, then this row.
