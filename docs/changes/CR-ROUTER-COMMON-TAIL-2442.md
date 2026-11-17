# CR-ROUTER-COMMON-TAIL-2442 - the routers wave 2 skipped take the shared request helpers; the last one-key setting readers; the held GET routes

Branch `pilot/CR-ROUTER-COMMON-TAIL-2442`, from `origin/pilot/CR-W2-FOLLOWUPS-2441` at 59e4215fe (wave 2 + the wave-3 backend
combination + main 2.43.7; the 2.43.8 train had not merged when this started - the lead rebases / merges onto main after it).
Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.5, wave 3B, row BE-1 (named
`CR-ROUTER-COMMON-TAIL-2436` there), theme T10. Findings: the rest of D5 (01:F-13, 02:P2-2, 05:P2-06), the rest of 05:P1-03
and of 05:P1-02. No version bump, no migration, no frontend change, no pixel change, no route change.

## 1. Request helpers (rest of D5)

Scripted edit (syntax tree): a top-level `_rid` / `_raw_body` / `_is_json` / `_db` whose body equals the one in
`routers/_common.py` (docstring, annotations ignored; argument names compared) is removed and imported under its old local
name (`from ._common import rid as _rid, ...`), as wave 2 did. **Every remaining copy was identical; none was left.**

Routers converted (18):

| Router | Helpers |
|---|---|
| `access_grants`, `access_station_permissions`, `access_visitors` | `_rid`, `_db` |
| `energy_billing` | `_is_json`, `_raw_body`, `_rid`, `_db` |
| `nvr_write` | `_rid`, `_raw_body` |
| `access_wiskey_visits`, `backup`, `bridge_key`, `cameras`, `cases`, `catalog`, `door_automations`, `ha_users`, `plans`, `wiskey_lineage`, `wiskey_managed`, `wiskey_pairing`, `wiskey_switches` | `_rid` |

Two more routers of the row's list, without a helper definition:

- `service_identity` (ADMIN-GATE's list): its three inline `getattr(request.state, "correlation_id", None)` are `_rid(request)`.
- `nvr_privacy`: took `_rid` from its sibling `nvr_write`; now from `_common` (02:P2-2). Its other sibling imports stay.

Resolved list against the row: `cases`, `catalog`, `plans`, `energy_billing`, `backup` and ADMIN-GATE's routers
(`access_visitors`, `wiskey_managed`, `wiskey_switches`, `access_station_permissions`, `access_grants`,
`access_wiskey_visits`, `wiskey_pairing`, `service_identity`, `ha_users`, `bridge_key`, `door_automations`) are converted.
`settings` and `access` hold no copy and no inline form (nothing to edit; `access` was split by CR-SPLIT-ACCESS-2440).
`nvr_write`, `wiskey_lineage` and `cameras` are not named by the row but were the rest of the guard's `WAITING` list
("held by other open branches" in wave 2); they are swept here so the list is empty.

`tests/test_router_common_helpers.py`: `WAITING` is now the empty set - no router defines one of the four helpers.

Not changed: inline `getattr(request.state, "correlation_id", None)` expressions in routers outside the row's list (about 30
files, e.g. `ha`, `remote`, `devices`, `second_factor`). They are not helper copies and wave 2 left them; a later row may
sweep them with the same import.

## 2. One-key setting readers (rest of 05:P1-03)

- The two files the guard still pinned: `routers/energy_billing.py` (`_tz`) and `services/access_grants.py` (`zone_of`) read
  `time.zone` with `setting_value(conn, "time.zone")`. The import stays inside the function, from `services/settings_store`
  (the service no longer imports a router for it). `tests/test_setting_callers_2440.py`: `WAITING` is empty.
- Five readers the guard cannot see, because the whole document was first bound to a name and then one plain key was read
  from it (found by a syntax-tree scan of `smplwise/**`: a name bound to the store's `read_settings(...)` whose every use is
  the same constant plain key): `routers/events.py` (`_list_window`, `summary`, `camera_events`: `time.zone`),
  `routers/recordings.py` (`camera_recordings`: `time.zone`), `routers/skins.py` (`skins_test`: `skins.privacy_ack`).
  `events` and `recordings` lost their last use of `read_settings`; the import was removed. After this the scan finds none.

Values: identical (`tests/test_setting_value_parity.py` covers every plain key). The one known difference is the one
CR-SETTING-CALLERS-2440 recorded: a corrupt stored value of another integer key no longer breaks a caller that wanted only
its own key (`access_grants.zone_of` fell back to the default zone in that case; it now answers the stored zone).

## 3. GET routes that were held for this row (rest of 05:P1-02)

`tests/get_write_allowlist_rest.txt` listed nine routes of `routers/cases.py` and `routers/catalog.py` as "held for wave 3B",
unreviewed. Each handler was read:

| Route | Result |
|---|---|
| `GET /catalog/images/{kind}/{obj_id}`, `GET /sites`, `GET /floors/{floor_id}`, `GET /home-links` | read only -> `current_principal_ro` + `get_read_conn` |
| `GET /cases/{case_id}`, `GET /cases/{case_id}/items/{item_id}/file`, `GET /cases/{case_id}/bundles` | read only (the NVR coverage probe runs inside `unlocked`, which handles a read connection; `recordings.search_segments` already runs on one) -> read connection |
| `GET /cases/{case_id}/bundles/{name}` | stays: audit row `case.bundle.download` on success (same group as the other downloads) |
| `GET /evidence/signing` | stays: `bundle.installation_id(conn, create=True)` stores the installation id on the first call |

Signatures only; no handler body changed. The allow-list went from 45 entries to 38 (7 + 38 with the access file). An
audited refusal (`require`) on these routes is written aside on the read connection, as on every converted route.

## Files

- `smplwise_vms/backend/smplwise/routers/`: the 18 routers of section 1, `service_identity.py`, `nvr_privacy.py`, `events.py`,
  `recordings.py`, `skins.py`
- `smplwise_vms/backend/smplwise/services/access_grants.py` (`zone_of`)
- `smplwise_vms/backend/tests/test_router_common_helpers.py`, `tests/test_setting_callers_2440.py` (the two `WAITING` lists),
  `tests/get_write_allowlist_rest.txt`
- this note

## Checks and tests

Local Windows workstation, `C:\cloude\smplwisebms\.venv` (Python 3.12), `-p no:xdist`, from the worktree. No runner, no entry
check (the row's instruction for this branch: push and report).

| Check | Result |
|---|---|
| `scripts/api_inventory.py` regenerated `contracts/API_INVENTORY.md` | **no diff** (1,908 routes) |
| `ruff check smplwise` (the repository's rule set), before and after | the same 109 findings (none new) |
| Guards and inventory tests: `test_router_common_helpers`, `test_setting_callers_2440`, `test_raw_body_order`, `test_setting_value_parity`, `test_plan_routes_unique`, `test_local_auth_inventory`, `test_wiskey_door_inventory`, and the two inventory tests of `test_get_routes_read_conn` | 63 passed, 0 failed |
| `test_get_routes_read_conn.py -k "cases or catalog or sites or floors/ or home-links"` (the converted routes answer while the write lock is held, and open no write connection) | 26 passed, 0 failed |
| The touched areas, 63 test files in one run (names matching cases, catalog, site, floor, home links / mapping, energy billing, access grants, visitors, station permissions, nvr write, privacy, backup, plans, events, recordings, skins, service identity, the wiskey managed / switches / pairing / lineage / visits routers, ha users, bridge key, door automations, cameras, evidence, bundle, read mode, signing) | 1,495 collected: 1,486 passed, 9 skipped, 0 failed (JUnit report; 2 h 52 min on the loaded workstation) |

NOT_RUN: the rest of the backend suite (about 925 of the 990 test files), the whole parametrised
`test_converted_get_answers_while_the_write_lock_is_held` (only the 26 cases above), the frontend and the pixel gate (no
frontend file changed), the runner entry check.

Behaviour: unchanged for sections 1 and 2 (identical function bodies; identical setting values), so there is no
failing-before test for them. Section 3 changes which connection seven GET routes use, not their answers.
