# PERF-HOME-DEVICES-2342 - load time of the home screen and the devices screens

Branch `perf/HOME-DEVICES-LOAD-2342`, cut from `origin/release/2340-train` @ `24e128583` (2.34.0). Owner-approved task (01.11): measure
first, then the safe wins only - no behaviour change, no version bump, no migration. No device, NVR or Home Assistant was contacted.

## 1. What was measured and how

- **Backend:** `smplwise_vms/backend/tests/bench_home_devices.py` (not collected by pytest; run it by hand). It builds the app exactly as
  `tests/test_devices.py` does, with a synthetic installation of **15 floors x 20 areas = 300 areas, 2000 entities, 16 cameras**, and
  times every GET the home screen (`#/devices/building`) and the devices screens (area, tiles panel, synoptic) make on load:
  median wall time over 9 calls (TestClient, same process), the SQL statements of one call (sqlite3 trace callback on every
  connection the app opens), and the JSON size. Workstation: Windows, Python 3.12, low on memory - absolute numbers are slow;
  compare the columns, not the machine.
- **Frontend:** no local build (workstation low on memory). The built 2.34.0 entry chunk shipped in the base commit
  (`smplwise_vms/www/assets/index-J9tfngWC.js` + its source map) was attributed byte by byte to its source modules; the entry
  chunk after the change is projected from the same map by removing the modules that now load lazily (the static import graph,
  `frontend/scripts/lazy-tags-check.mjs`). Browser timing: `frontend/tests/perf-home-load.spec.ts` on the runner (section 4).

## 2. Findings

| # | Where | Finding | Action |
|---|---|---|---|
| 1 | `routers/devices.py` tree / area / items | Every entity loaded and parsed **twice** per request (`load_entities` in `_visible_entities`, again in `_bulk_flags`); `alarm.managed_controls` (a fingerprint over every alarm-relevant row) computed **2-4 times**, all inside ONE read transaction | Fixed: `_RequestReads` reads each once per request (never kept past it) |
| 2 | `services/device_bulk.scope_flags` | Built the per-entity exclusion sets (alarm-managed, media-managed, scheduler switches) it never used | Fixed: `_held_scope` (the scope half of `bulk_scope`) |
| 3 | `routers/settings.read_settings` (GET /settings + ~190 internal readers) | **One SELECT per key: 529 statements** per call | Fixed: `db.get_settings_many` - 2 statements, identical values |
| 4 | `api/client.ts` | Several components ask for the same address at the same moment on the first render (the shell's `/settings` read and the home screen's own, `/me`, the tree) | Fixed: concurrent plain GETs of one address share one request; each caller parses its own copy; nothing cached past the answer |
| 5 | `shell/sw-app.ts` | **All ~90 screens imported eagerly: one 11.6 MB entry chunk** (11.05 M characters, 1173 modules) for every first load, the home screen included | Fixed: `shell/lazy-screens.ts` - every route screen except the home is a chunk of its own, started when the shell first renders its tag |
| 6 | `screens/devices-building.ts` | Imported the plan map (`explore-floor-map` + plan canvas) eagerly though it shows only in the plan view | Fixed: loaded when the plan view renders |
| 7 | `screens/devices-media-card.ts` | Rendered `<media-screen-card>` without importing it (worked only because the shell imported everything) | Fixed: imports it (found by the new static check) |
| 8 | `db.Database._open` (every request) | **Opening a connection costs ~40-50 ms here**: SQLite parses the full schema (1256 objects: 189 migrations' tables, indexes, triggers) on the first statement of every new connection, and every request opens at least one | NOT changed - a connection pool changes the transaction / write-gate lifecycle; proposed as a separate task (section 6) |
| 9 | `services/devices.load_entities` | ~60% of its cost is per-row JSON parsing + scrubbing of `attributes_json` (2000 rows) | NOT changed - a cross-request cache would be invalidated by nearly every HA state push; recorded only |
| 10 | Entry chunk after the change | Still eager: `schedule-editor` (61 K, via the long-press `device-activity` popup), the demo mocks (`schedules-mock`, `media-players-mock`, `tickets-rfq-mock`, `tickets-costs-mock`, ~150 K together, only used in demo mode), `i18n/access-external` (93 K, via `shell/nav.ts` for one tab label) | Recorded for a next step (section 6) |

N+1 / indexes: no missing index on these paths (`ha_entities` has `domain` and `area_id` indexes; the routes read the whole visible
set by design). The only N+1 was finding 3.

## 3. Before / after

### Backend (300 areas, 2000 entities, 16 cameras; median of 9; same session, base files vs branch files)

| Screen | Call | Before ms | After ms | Change | SQL before | SQL after | JSON |
|---|---|---:|---:|---:|---:|---:|---:|
| home | `GET /devices/tree` | 397 | 193 | **-51%** | 45 | 31 | 238 KB |
| home | `GET /settings` | 69 | 65 | -6% | **540** | **36** | 12 KB |
| home | `GET /me` | 60 | 50 | (noise) | 45 | 45 | 8 KB |
| home | `GET /presence/building`, `/sites?tree=true`, `/home-links` | 33-41 | 45-47 | (noise, = connection floor) | 7-15 | 7-12 | < 1 KB |
| area | `GET /devices/areas/ar7` | 418 | 269 | **-36%** | 62 | 37 | 11 KB |
| tiles | `GET /devices/items?kind=lights&scope=building` | 421 | 254 | **-40%** | 52 | 32 | 179 KB |
| tiles | `GET /devices/items?kind=switches&scope=building` | 409 | 200 | **-51%** | 51 | 34 | 88 KB |
| tiles | `GET /devices/items?kind=climate&scope=floor` | 388 | 249 | **-36%** | 45 | 32 | 12 KB |
| synoptic | `GET /events?limit=50` | 46 | 45 | - | 11 | 11 | 1 KB |

The small calls sit on the per-request floor of finding 8 (~40-50 ms of schema parsing on this workstation), so their differences
are noise. `/settings` is the same: 504 fewer statements, but the connection open dominates its time here.

### Frontend entry chunk (static, from the 2.34.0 source map)

| | Before (2.34.0 build) | After (projected) |
|---|---:|---:|
| Entry chunk (`index-*.js`), characters | 11.05 M | **~3.58 M (-68%)** |
| Entry chunk, bytes (UTF-8, Hebrew strings) | 11.57 MB | ~3.75 MB |
| Modules in the eager closure of `main.ts` | 1173 | 388 |
| Screens loaded on the home route | ~90 (all) | the home screen only (+ the area screen warmed while idle) |
| Route screens as lazy chunks | 0 (only 3D, tickets overview, wall) | 88 tags / 86 modules |

The projection counts every module that leaves the eager closure; Rollup will place modules shared by several lazy screens in shared
chunks (fetched with the first screen that needs them), so the real entry chunk can differ slightly. The real numbers come from the
runner build (section 4).

## 4. Browser timing (runner)

`frontend/tests/perf-home-load.spec.ts` on the runner's built preview (demo data, no backend), `run_smart.py preview <branch>
perf-home-load --workers=1 --machine runner`, the three Playwright projects (desktop / tablet / mobile), each address opened cold in a
fresh context. **Before** = branch `perf/HOME-DEVICES-LOAD-2342-baseline` (`cd3330e9a`: 2.34.0 + this spec only, a measurement branch,
not for merge); **after** = `perf/HOME-DEVICES-LOAD-2342`. The runner was carrying the night's release gates (load 34-39), so absolute
times are pessimistic; both runs saw the same load. Median of the three projects, ms from navigation start:

| Address | DOMContentLoaded before | after | Shell ready before | after | Screen upgraded before | after | Change (screen) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` (home) | 1905 | 923 | 2465 | 1521 | 2521 | 1616 | **-36%** |
| `#/devices/building` | 1944 | 893 | 2427 | 1400 | 2470 | 1480 | **-40%** |
| `#/devices/areas/lobby` | 1869 | 884 | 2161 | 1428 | 2187 | 1467 | **-33%** |
| `#/devices/synoptic` | 1968 | 922 | 2276 | 1272 | 2309 | 1299 | **-44%** |
| `#/live` (another area, lazy) | 1894 | 950 | 2278 | 1406 | 2309 | 1443 | **-38%** |

| JavaScript fetched (same for all three projects) | Before | After |
|---|---:|---:|
| `#/devices/synoptic`: requests / transferred / decoded | 3 / 3139 KB / 11553 KB | 4 / 1132 KB / 3836 KB |
| `#/live`: requests / transferred / decoded | 3 / 3139 KB / 11553 KB | 7 / 1139 KB / 3843 KB |
| home and `#/devices/building`, incl. the idle warm-up of the area screen: requests / transferred / decoded | 3 / 3139 KB / 11553 KB | 37 / 1850 KB / 4555 KB |

The real entry chunk (about 3.8 MB decoded, the synoptic row minus its own chunk) matches the projection of section 3. The home row
includes the area screen's chunk and its shared chunks, fetched while idle after the home is up (Rollup splits the modules the area
screen shares with other screens into ~30 small chunks; `modulePreload` is off in this build, so they arrive as one short waterfall).
API GETs: 1 per load in demo mode (the session probe), so the GET sharing (finding 4) is not visible here; it is covered by the unit
spec. Also run on the branch in the same runner session: `evidence-devices`, `layout-devices-break-297`, `evidence-device-cards`,
`evidence-tickets-device`, `evidence-infra-tabs` + this spec - **121 passed, 212 skipped (fixture / live-only), 0 failed**.

## 5. How the lazy screens stay safe

- `sw-app` renders exactly the same tags as before. After each render it starts the chunk of every undefined route element
  (`loadPendingScreens`); Lit carries the properties set before the upgrade over (the path `tickets-overview` used since MGRDASH).
- `data-shell-ready` stays off while a route chunk is in flight, so every spec and helper that waits for it sees the screen.
- A chunk that fails to load (a tab left open across a release: the add-on's `www` is replaced, the old chunk names are gone) reloads
  the page once (not again within a minute; never offline; never for the idle warm-up).
- `frontend/scripts/lazy-tags-check.mjs` (run by `tests/unit-perf-home-devices.spec.ts`): builds the static import graph of `src/`
  (eager imports and `import.meta.glob(..., {eager: true})`; `import()` edges are lazy) and fails when a module renders a tag
  (template, `createElement`, a `tag:` data entry) whose definition is not loaded where it is rendered, when a lazy-screens entry
  does not define its tag, or when a listed screen is still imported eagerly (it would stay in the entry chunk).
- Modules that left the entry chunk were scanned for top-level side effects: only `api/recordings` (a `pagehide` release of its own
  sessions), the demo seeds of the tickets / bills mocks and a local label table - all used only by the screens that load them.
- Not lazy on purpose: the home screen, the settings navigation column (`system-nav`), the cast pages (`system-cast`), the global
  popups and banners, and `schedule-editor` (imported by the long-press device popup).

## 6. Proposed next steps (not done here)

1. **Connection reuse** (finding 8): a small per-thread pool of read connections (schema parsed once per connection) would take
   ~40 ms off EVERY API request on this workstation (expected less on the Linux host, still the largest fixed cost). It touches the
   transaction / write-gate lifecycle of `db.Database.connection`, so it needs its own review and owner approval.
2. Lazy demo mocks (finding 10): ~150 K of the entry chunk serve only the demo mode.
3. `device-activity` -> `schedule-editor` as a lazy import when the popup opens its schedule tab (61 K).
4. `shell/nav.ts` -> `i18n/access-external` for one label (93 K): move that label to `i18n/he.ts`.

## 7. Tests

| Run | Where | Result |
|---|---|---|
| `pytest tests/test_devices.py tests/test_alarm.py tests/test_scheduler_exclusions.py tests/test_media_review_fixes.py tests/test_switch_protection_migration.py tests/test_security_review_wxd_fixes.py` | workstation, one process | 167 passed |
| `pytest tests/test_perf_home_devices.py tests/test_ui_settings.py tests/test_polish_display_settings.py tests/test_settings_nav_pref.py` | workstation, one process | 27 passed |
| `npx tsc --noEmit` | workstation | exit 0 |
| `npx playwright test -c playwright.unit.config.ts` (unit-perf-home-devices, unit-fleet-report, unit-messaging-accounts, unit-automations, unit-media-players, unit-media-queue, unit-notifications, unit-public-rfq, unit-empty-state-icons, unit-swlogo-295, unit-tickets-naming, unit-tickets-quotes, unit-uxfix-nav-295) `--workers=1` | workstation | 271 passed |
| `node scripts/lazy-tags-check.mjs` | workstation | OK (388 eager modules, 116 lazy groups, 88 route tags) |
| `python scripts/gate/lint_spec_waits.py` on the two new specs | workstation | 0 findings |
| `run_smart.py preview` (section 4) | runner | 121 passed, 212 skipped, 0 failed; timing 15 + 15 passed |
| Full backend suite, full frontend suites, pixel baselines | - | NOT_RUN (the release gate covers them) |

Files: `smplwise_vms/backend/tests/test_perf_home_devices.py` (read-once per request, scope flags
unchanged, `get_settings_many` == `get_setting`, `read_settings` identical to the per-key read, `/settings` statement count),
`frontend/tests/unit-perf-home-devices.spec.ts` (GET sharing: one request, separate copies, no caching, failures and 204;
the lazy-tags check; no lazy screen imported eagerly), `frontend/tests/perf-home-load.spec.ts` (runner, section 4).

Rollback: revert the two commits; no data, schema or setting changes.
