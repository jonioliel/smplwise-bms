# CR-UPLOAD-SYNC-2436 - upload handlers off the event loop; the upload routers' reads on the read connection

Branch `pilot/CR-UPLOAD-SYNC-2436`, from `origin/main` at 665ec8f24 (v2.43.4). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1, backend. No version bump, no migration, no UI change.

## Findings covered

- **05:P1-05** - ten `async def` upload handlers held the request's write connection (`get_conn`: BEGIN IMMEDIATE) and ran
  Pillow decodes, file writes and SQL on the event loop thread, so every WebSocket, `/healthz` and every other request
  waited meanwhile (`db.unlocked`'s docstring states the rule).
- **03:F05** - `upload_bake` additionally kept BEGIN IMMEDIATE open across `await run_in_threadpool(validate_file)`,
  including the up to 5 s wait for a decode slot, then ran `pb.store` and `audit` on the loop.

## What changed

The ten handlers are plain `def` now; FastAPI runs each in the thread pool. `await file.read(n)` became
`file.file.read(n)` with the same `n` (the multipart body is parsed and rewound before the handler runs). Limits, the order
of checks, errors, rows, files, audit rows and responses are the same lines.

| File | Handler(s) |
|---|---|
| `routers/skins.py` | `upload_control_image` |
| `routers/floor_images.py` | `upload_floor_image` |
| `routers/plan_bakes.py` | `upload_bake`: also `pb.validate_file` now runs directly inside `with unlocked(conn):` (was `await run_in_threadpool`); the `run_in_threadpool` import is gone |
| `routers/wall.py` | `photo_upload` |
| `routers/notices.py` | `put_logo`, `put_news_logo`, `put_slide_image`, `put_board_photo` |
| `routers/home_interface.py` | `put_wallpaper` |
| `routers/home_v3.py` | `put_room_wallpaper_image` |

`upload_bake` and `unlocked`: before the decode the handler has only read (floor, permission, slot, served key, levels),
and `db.connection` commits an expected `ApiError` anyway, so committing before the decode changes no outcome. The decode
(and its slot wait) no longer holds the write lock; the lock is taken back for `pb.store` and `audit`.

GET routes of these seven files that were on `get_conn` (resolved list, from a route inventory on 665ec8f24):

| Route | Result |
|---|---|
| `GET /skins/status` (`skins_status`) | converted to `current_principal_ro` + `get_read_conn` (reads settings, budget, last test) |
| `GET /floors/{floor_id}/skins` (`floor_skins`) | converted (reads floor, geometry key, controls, budget) |
| `GET /wall/config` (`wall_config`) | **kept**: `wall.touch_seen` writes the display's last contact |
| `GET /notices/boards/{board_id}/link` (`stored_link`) | **kept**: writes the `notices.board.link_read` audit row |

Every other GET in the seven files was already on the read connection.

## New test - `tests/test_async_routes_hold_no_write_conn.py` (3 tests)

1. No `async def` route in any router depends (directly or through a sub-dependency) on `get_conn`. One allow-listed
   exception outside this branch's file list: `POST /tickets/address/probe` (`routers/tickets_links.py`, tickets area);
   the test fails when that entry goes stale.
2. The ten upload handlers are not coroutine functions.
3. In the seven upload routers, a GET on `get_conn` must be listed in `GET_WRITERS` with the write it makes (the two kept
   routes above); the test fails when a listed writer moves.

Written before the fix and checked against the pre-fix route inventory on 665ec8f24, which listed 11 `async def` routes on
`get_conn` (the 10 handlers above + the tickets probe) and the 4 GETs above - i.e. tests 1-3 would fail on main. The
red run itself was not executed separately (the inventory script was run, not pytest, before the edit).

## Tests run (local workstation, Python 3.12.10, `.venv` of the main checkout, single process)

Command, per file (one pytest process per file, sequential): `python -m pytest -p no:cacheprovider -q tests/<file>.py`
in `smplwise_vms/backend`. Every file exited 0; **436 passed, 0 failed, 0 skipped** in total.

| File | Passed |
|---|---|
| `test_async_routes_hold_no_write_conn.py` (new) | 3 |
| `test_plan_skins.py` | 30 |
| `test_plan_bakes.py` | 14 |
| `test_floor_images.py` | 6 |
| `test_wall.py` / `_alerts` / `_curve_points` / `_curves` / `_phone_bar` | 15 / 8 / 10 / 25 / 6 |
| `test_notices_106.py` / `_info_295` / `_perm_295` / `_push_295` / `_security_295` | 43 / 14 / 8 / 15 / 59 |
| `test_home_config.py` / `_followup_b_2431` / `_interface` / `_interface_doors_2421` / `_links` | 9 / 11 / 25 / 1 / 4 |
| `test_home_screen.py` / `_screen_options_295` | 33 / 11 |
| `test_home_v3_followup_a.py` / `_gaps_2436` / `_p1` / `_p2` / `_p3` | 8 / 3 / 7 / 42 / 6 |
| `test_read_mode.py` | 4 |
| `test_raw_body_order.py` | 16 |

A first attempt ran all 28 files in ONE pytest process; that process died at about 37 % with a Windows fatal exception
(`0xc000070a`, after an earlier `0x8007000e` out-of-memory report inside `platform._wmi_query` from `ezdxf`), on a heavily
loaded workstation. It produced no test failure; the per-file runs above replace it.

## Skipped / NOT_RUN

- Runner entry check: NOT_RUN by design (the lead combines the wave-1 branches into one entry check).
- Pixel gate: NOT_RUN (no frontend file touched; "Pixels: no").
- `POST /tickets/address/probe` (async route on `get_conn` in `routers/tickets_links.py`) is not converted: outside this
  row's file list. Allow-listed in the new guard; to be picked up by a tickets-area branch.
- The inventory test with an allow-list file (`BT/get_write_allowlist_*.txt`) belongs to `CR-READCONN-A-2436`; this branch
  keeps its own small `GET_WRITERS` map inside its test and does not touch that module.

## Rollback

Revert the commit; no data, schema or configuration change.
