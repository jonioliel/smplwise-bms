# CR-READCONN-B-2440 - the rest of the GET routes off the write lock

Branch `pilot/CR-READCONN-B-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4 (contains CR-READCONN-A-2436 and
CR-UPLOAD-SYNC-2436). Code-review master plan 2026-11-13, section 3.2 (wave 1, backend), theme T1, finding 05:P1-02 (the
rest). No version bump, no migration, no frontend change, no pixel change. **Route signatures and `..auth` import lines
only; no handler body was edited.**

## What changed

A GET handler that only reads now resolves its principal with `auth.current_principal_ro` and reads on `auth.get_read_conn`
(a deferred, query-only connection) instead of `current_principal` + `get_conn` (BEGIN IMMEDIATE: SQLite's single write
lock for the whole request). 110 routes in 45 router files moved; 44 stay and are listed with the reason in the new
`smplwise_vms/backend/tests/get_write_allowlist_rest.txt`.

The existence of that file switches `tests/test_get_routes_read_conn.py` (owned by CR-READCONN-A, not edited here) from the
12 access-area routers to **every router module**: 803 GET routes are in scope; a GET that reaches `auth.get_conn` must be
allow-listed, a stale allow-list entry fails, and every GET that is not allow-listed must answer while another connection
holds the write lock.

Route inventory (GET routes whose dependency tree reaches `auth.get_conn`): 161 before, 51 after
(7 access-area entries of READCONN-A + the 44 of this branch).

## Resolved file list (the row gives it as a rule)

Converted, 110 routes in 45 files:

- `routers/alarm.py` (4): `/alarm/panels`, `/alarm/me`, `/alarm/config`, `/alarm/users/{user_id}` (the last two through the
  existing `_configurer_ro` instead of `_configurer`, which keeps its DELETE users)
- `routers/anchors.py` (1): `/floors/{floor_id}/anchors`
- `routers/announcements.py` (4): `/announcements/areas`, `/announcements/config`, `/announcements/templates`, `/announcements/history`
- `routers/app_secrets.py` (1): `/system/secrets`
- `routers/automation_blueprints.py` (3): `/automation-blueprints/status`, `/automation-blueprints`, `/automation-blueprints/{blueprint_id}`
- `routers/automations.py` (3): `/automations/templates` (`_ctx(sync=False)`: no mirror pull), `/automations/trash` (its gate
  already was on the read connection; only `conn` moved), `/automations/{kind}/{item_id}/versions` (through the existing
  `_kind_viewer_gate` instead of `_kind_viewer`, which keeps its users)
- `routers/backup.py` (3): `/backups`, `/backups/drill`, `/backups/{name}`
- `routers/backup_offbox.py` (2): `/backups/offbox`, `/backups/offbox/targets/{target_id}/copies`
- `routers/calendar.py` (1): `/calendar/calendars/{cid}/members`
- `routers/calendar_feeds.py` (1): `/calendar/feeds`
- `routers/calendar_sync.py` (2): `/calendar/connections`, `/calendar/connections/{cid}/calendars`
- `routers/camera_image_health.py` (2): `/camera-image-health`, `/camera-image-health/settings`
- `routers/camera_sources.py` (1): `/cameras/{camera_id}/source`
- `routers/cameras.py` (3): `/cameras/{camera_id}/snapshot.jpg`, `/cameras/{camera_id}/zones`, `/cameras/{camera_id}/capabilities`
- `routers/capture_lease.py` (1): `/access/capture-lease/settings`
- `routers/cast.py` (5): `/multimedia/cast/config`, `/multimedia/cast/screens`, `/multimedia/cast/targets`, `/multimedia/cast/sessions`, `/multimedia/cast/sessions/{session_id}`
- `routers/device_cameras.py` (1): `/devices/camera-card/still`
- `routers/events.py` (4): `/events/{event_id}/thumbnail`, `/events/{event_id}`, `/events/{event_id}/correlation`, `/events/{event_id}/route`
- `routers/exports.py` (3): `/exports`, `/exports/{job_id}`, `/exports/{job_id}/manifest`
- `routers/frames.py` (1): `/cameras/{camera_id}/frame`
- `routers/ha.py` (3): `/ha/status`, `/ha/entities`, `/ha/entities/{entity_id}`
- `routers/health.py` (1): `/health/report`
- `routers/home_mapping.py` (1): `/sites/{site_id}/mapping`
- `routers/incidents.py` (3): `/incidents/{incident_id}`, `/incidents/{incident_id}/cameras`, `/incidents/{incident_id}/doors`
- `routers/local_passkeys.py` (2): `/auth/passkeys`, `/identity/local-users/{user_id}/passkeys`
- `routers/maintenance.py` (1): `/maintenance/scan/{token}`
- `routers/media.py` (4): `/media/streams`, `/media/sessions`, `/media/video-policy`, `/media/live/{camera_id}`
- `routers/nvr_connection.py` (2): `/nvr/vendors`, `/nvr/connection`
- `routers/nvr_privacy.py` (1): `/cameras/{camera_id}/privacy-mask`
- `routers/nvr_settings.py` (2): `/nvr/recorders`, `/nvr/cameras/{camera_id}/streams/{stream_ref}/options`
- `routers/nvr_write.py` (9): `/nvr/notify`, `/cameras/{camera_id}/record`, `/nvr/system`, `/cameras/{camera_id}/reboot`, `/cameras/{camera_id}/osd`, `/cameras/{camera_id}/schedules`, `/cameras/{camera_id}/smart`, `/nvr/changes`, `/nvr/changes/{change_id}`
- `routers/offline_field.py` (1): `/field/offline/round-points/{point_id}/tag`
- `routers/plans.py` (10): `/floors/{floor_id}/plan-assets`, `/plan-assets/{asset_id}/pages/{page}/preview.png`, `/floors/{floor_id}/plan-versions`, `/plan-versions/{version_id}/image.png`, `/plan-versions/{version_id}/diff`, `/plan-versions/{version_id}`, `/plan-versions/{version_id}/source.png`, `/plan-versions/{version_id}/stylized.png`, `/plan-assets/{asset_id}/dxf`, `/plan-assets/{asset_id}/dxf/entities`
- `routers/playback.py` (2): `/playback/sessions`, `/playback/sessions/{session_id}`
- `routers/playback_groups.py` (1): `/playback/groups/{group_id}`
- `routers/recorder_health.py` (2): `/recorder-health`, `/recorder-health/settings`
- `routers/recorders.py` (5): `/recorders`, `/recorders/{recorder_id}`, `/recorders/{recorder_id}/connection`, `/recorders/{recorder_id}/writes`, `/recorders/{recorder_id}/health`
- `routers/remote.py` (1): `/csp-reports`
- `routers/rules.py` (2): `/rules`, `/rules/{rule_id}`
- `routers/second_factor.py` (3): `/auth/second-factor`, `/auth/second-factor/users`, `/auth/second-factor/overrides`
- `routers/tickets_budgets.py` (2): `/tickets/costs/budgets`, `/tickets/costs/budgets/summary`
- `routers/tickets_costs.py` (2): `/tickets/{ticket_id}/costs`, `/tickets/costs/departments`
- `routers/tickets_rfq.py` (2): `/tickets/rfqs/{rfq_id}/vendors/{vendor_id}/award-notice`, `/tickets/rfqs/{rfq_id}/awards/{award_id}/order/preview`
- `routers/ui_background.py` (1): `/settings/background/{slot}`
- `routers/zones.py` (1): `/floors/{floor_id}/zones`

Import lines: each file's `from ..auth import ...` gained `current_principal_ro` / `get_read_conn` where missing and lost
`current_principal` / `get_conn` where no user is left in the file (`automation_blueprints`, `frames`, `health`,
`nvr_connection`, `recorders`), so the pyflakes lane sees no new unused import.

Kept on the write connection, 44 routes (`tests/get_write_allowlist_rest.txt`, each line with its reason):

| Group | Routes | Why |
|---|---|---|
| Automations mirror (11) | `/automations/status`, `/automations/catalog`, `/automations/review`, `/automations`, `/automations/{kind}/{item_id}`, `.../runs`, `.../runs/{run_id}`, the three `/automations-ext/...` routes, `/home/schedules` | `store.MIRROR.ensure(conn)` pulls and rewrites the mirror cache on the request's connection when it was never synced - the same case READCONN-A kept for the schedules mirror |
| Writes of its own (4) | `/ha/actions/{action_id}`, `/ha/bridge/pairing`, `/field/offline/bundle`, `/wall/config` | `ha_actions.refresh` updates the action; `ha_bridge.ensure_pairing` creates / resets the secret; `build_bundle` registers the device; `wall.touch_seen` (kept by UPLOAD-SYNC) |
| Audit row on success (20) | `/notices/boards/{board_id}/link` (kept by UPLOAD-SYNC), `/backups/{name}/download`, `/calendar/events/{eid}/guests`, `/exports/{job_id}/download`, the two personal-data exports, `/messaging/whatsapp/pacing/lease/{request_id}`, `/nvr/cameras`, `/nvr/cameras/{camera_id}`, `/plan-versions/{version_id}/export.ifc`, `/tickets/contacts/{contact_id}/export`, five `/tickets/.../costs...` routes, the two `/tickets/contacts/{contact_id}/stats...` routes, `/infra/water/consumption.csv`, `/brand/white-label/pack` | the handler writes an audit row when it succeeds (see "Decision" below) |
| Outside this branch (9) | 5 in `routers/cases.py`, 4 in `routers/catalog.py` | the row excludes these two files (converted in wave 3B, BE-1); listed so the inventory is complete, not reviewed here |

`routers/settings.py` has no GET on `get_conn` any more (CR-SETTINGS-STORE). The seven upload routers of CR-UPLOAD-SYNC were
not edited; its two kept GETs (`/wall/config`, `/notices/boards/{board_id}/link`) are listed in the new allow-list because
the inventory test now covers every router.

## Decision recorded (no owner or lead answer exists; the conservative option was taken)

A GET that records an audit row **on success** stays on the write connection. READCONN-A moved two such routes and
exempted them inside the test (`AUDITS_ON_SUCCESS`: on the read connection the row is written aside and waits for the
lock). Moving the 19 of this branch the same way would need 19 more entries in that test, which this branch does not own
and its row says is "not edited here"; CR-UPLOAD-SYNC took the same decision for `stored_link`. A refusal's audit row is not
a reason to stay (every read route writes it aside). Follow-up for the closing chain: decide once for all success-audit
GETs (the slow ones are `/nvr/cameras*`, which talk to the recorder, and the ticket cost reports).

## How each route was judged

1. Route enumeration from each router module's own `APIRouter` objects (as the inventory test does): 161 GET routes reached
   `auth.get_conn` on the base.
2. A static reachability pass (a throw-away AST script, not committed) followed the connection - and every object that
   carries it (`Ctx`, `Viewer`, `W`, `Access`, context managers) - from each handler and its dependencies through the
   services, and reported every reachable `INSERT / UPDATE / DELETE / REPLACE / CREATE / DROP`, `audit(...)`,
   `set_setting`, savepoint, `commit` and every call it could not resolve. Refusal audits through `rbac.require` were
   ignored; every other audit call was read by hand and classed refusal (moves) or success (stays).
3. The unresolved calls of the routes that move were read by hand: module-level aliases of read helpers
   (`ha_scope.visible_floors / placements / entity_allowed`), time-zone lookups and dictionary / list methods - no write.
   Dynamic SQL text in the moved routes is `SELECT` text built from fragments (`building_scope._rows`, `rbac.dead_places`,
   `correlation`, `incidents`, the tickets stores).
4. `db.unlocked(conn)` (18 moved routes: recorder / go2rtc / bridge calls) and `db.release(conn)` (2) are supported on a
   read connection (`_relock` restarts a deferred read; `tests/test_read_mode.py`).

Limits of the method: a write reached only through a callback passed as a value, or through an object whose class the
script could not resolve, would not be seen statically. Such a write fails loudly on the read connection
(`attempt to write a readonly database`, a 500 in any test that reaches it).

## Behaviour

Identical answers: the same queries on a deferred, query-only connection. By design of the read connection
(`auth.get_read_conn`): the throttled user touch and a refusal's audit row are written through `db.write_aside()` instead of
inside the request's transaction; the request no longer holds the write lock while it talks to a recorder, go2rtc or the
bridge, or while it renders a plan image.

## Tests

Local workstation (Windows, Python 3.12, the main checkout's `.venv`, one process, `-p no:xdist`). The workstation had
0.1-0.5 GB of free memory and was CPU-saturated by other sessions during this work.

Run:

- `python -m pytest -p no:xdist -q tests/test_get_routes_read_conn.py -k "allow_list or well_formed"`: **2 passed** - the
  inventory over all router modules (803 GET routes): nothing on `get_conn` outside the two allow-lists, no stale entry.
- Route inventory script before / after: 161 -> 51 GET routes on `auth.get_conn`.
- Import check: each changed module imports (the inventory imports every router module).

NOT_RUN at the time of this commit (see the end of this file for anything run later):

- The parametrised `test_converted_get_answers_while_the_write_lock_is_held` - now about 750 cases, one fresh app each.
- The API tests of the 45 touched routers.
- No runner entry check (the lead combines the batch). No pixel run (no UI change).

## Outside my rows

Nothing. `tests/test_get_routes_read_conn.py` was not edited.
