# CR-ROUTER-COMMON-2438 - one copy of the router request helpers (`routers/_common.py`)

Branch `pilot/CR-ROUTER-COMMON-2438`, from `origin/pilot/CR-WAVE1B-COMBINED-2436` at ffb4af2d5 (the row edits routers that
wave 1 already changed: READCONN-A, UPLOAD-SYNC, SETTINGS-STORE). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.3, wave 2, theme T10, row `CR-ROUTER-COMMON-2436`.
No version bump, no migration, no frontend change, no pixel change, no route change.

## Findings covered

- **D5 = 01:F-13 (`_rid`), 02:P2-2, 05:P2-06; 03:F26 (`_raw_body`)** - the request helpers were copied per router:
  `_rid` x108, `_raw_body` x11, `_is_json` x9, `_db` x15 on the base. All copies of each helper were compared by a
  normalised AST hash (body without its docstring, argument names and annotations, decorators): **every copy was
  identical**, so all four moved. New `smplwise/routers/_common.py` holds `rid`, `raw_body`, `is_json`, `db_of`.
- Routers import them under their **old local names** (`from ._common import rid as _rid, ...`), so no call site changed,
  sibling imports of these names keep working, and `dependency_overrides[module._raw_body]` in tests still hits the
  routes' dependency (it is now the same function object in every converted router).
- Sibling coupling (02:P2-2): routers that took a helper from an unrelated sibling (`from .access_control import _raw_body`,
  `from .nvr_write import _rid`, `from .devices import _is_json, _raw_body`, `from .nvr_connection import _raw_body`, ...)
  now take it from `_common`; their other sibling imports (`_parse`, `_envelope`, ...) are unchanged.
- The docstrings of the dropped `_raw_body` copies (permission dependency first, write connection after) are merged into
  `raw_body`'s docstring. `_parse` and `_gate` differ per router and stay local (plan row).
- Five routers lost their last use of `Database` with `_db`; the now-unused `from ..db import Database` was removed
  (ruff F401 on the edited files: no new finding; the pre-existing findings are untouched).

## Routers converted (93)

access_control, access_control_diag, access_control_door_tech, access_control_messaging, access_control_ops,
access_control_profiles, access_control_reads, access_control_schedule_writes, access_control_station_ops,
access_control_station_people, access_control_triage, access_control_writes, access_groups, alarm, anchors, announcements,
app_brand, app_refresh, app_secrets, automations, backup_offbox, brand, building_presence, bulk_people, calendar,
calendar_sync, camera_image_health, camera_sources, capture_lease, cast, compliance_export, demo, device_layouts, devices,
docread, door_windows, doors, emergency_readiness, energy_meters, fleet, floor_images, home_family, home_interface,
home_mapping, home_v3, incidents, intercom_listen, intercom_media, local_identity, local_passkeys, local_privacy,
maintenance, mask_copy, messaging_accounts, mobile_notifications, multimedia, notices, notifications, notify_whatsapp,
nvr_batch, nvr_connection, nvr_settings, occupancy, offline_field, partner, plan_bakes, plan_catalog, plan_geometry,
plan_ifc, plan_package, presence, push, quiet, readiness, recorders, rules, scenarios, schedules, skins, system_update,
transit, ui_background, wall, water, water_billing, white_label, wiskey_installer_clock, wiskey_installer_lifecycle,
wiskey_installer_platform, wiskey_installer_technical, wiskey_relay_map, wiskey_validation, zones.

## Routers left for `CR-ROUTER-COMMON-TAIL` (resolved exclusion list)

- Owned by another wave-2 row: the ADMIN-GATE routers (`access_visitors`, `wiskey_managed`, `wiskey_switches`,
  `access_station_permissions`, `access_grants`, `access_wiskey_visits`, `wiskey_pairing`, `service_identity`, `access`,
  `ha_users`, plus `bridge_key` and `door_automations` which the ADMIN-GATE branch also edits); `tickets*.py` and
  `home_ticket_photo.py` (CR-TK-ROUTER-COMMON, which imports `rid` from here); `settings`, `plans`, `energy_billing`, `backup`.
- CR-SETTING-CALLERS has not recorded its resolved file list yet; its named routers are excluded: `cases`, `events`,
  `frames`, `nvr_write`, `recordings`.
- Held by open branches on 2026-11-14 (checked with `git diff --name-only <merge-base> <branch>`): `catalog`
  (BACKEND-SAFETY, PATH-CONFINE), `wiskey_lineage` (AUTH-REVOKE-GATE), `video_services` (RBAC-EVAL, MAIN-RUNTIME,
  SYNC-GATE, NVR-GUARD, ...), `cameras` and `nvr_privacy` (NVR-GUARD).
- Of these, `events`, `frames`, `recordings`, `settings`, `service_identity`, `video_services` and `nvr_privacy` hold no copy
  (`nvr_privacy` imports `_rid` from `nvr_write`); they were not edited. The routers that still hold a copy are pinned as
  `WAITING` in the new guard test (19 + `tickets*` + `home_ticket_photo`); the tail branch removes names as it converts them.

## Tests

- new `tests/test_router_common_helpers.py`: no router outside `WAITING` defines `_rid` / `_raw_body` / `_is_json` / `_db`
  (AST over `routers/*.py`); `WAITING` names only routers that still hold a copy (so it can only shrink); an `is_json`
  table; the converted routers share one function object.
- `tests/test_raw_body_order.py`: `BODY_READERS` also recognises `raw_body` (the shared dependency's `__name__`); without
  this the order check would silently stop seeing the converted routes and its `checked >= 34` floor would fail.
- Run locally (workstation saturated; focused files only, `-p no:xdist`): `tests/test_raw_body_order.py` +
  `tests/test_router_common_helpers.py` - **28 passed** (16 + 12).
- `scripts/api_inventory.py` regenerated `contracts/API_INVENTORY.md`: **no diff** (1,905 routes).
- NOT_RUN locally: the whole router / backend suite - it runs in the runner entry check.

Behaviour: unchanged (identical function bodies; no route, dependency order, status, audit row or text changes), so there is no
failing-before test for this row.
