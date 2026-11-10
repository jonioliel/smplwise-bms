# WARMUP-POLISH-2421 - start-up warm-up, attention card without scrolling, camera player words and bounds

Branch `pilot/WARMUP-POLISH-2421`, cut from `main` @ `b517bb5a3` (2.42.0). For 2.42.1. No version bump, no CHANGELOG entry, no
migration. No device, NVR, media server or Home Assistant was contacted; nothing in `frontend/src/home/*` or the home interface backend
was touched.

## 1. Start-up warm-up (owner-approved)

### What was slow, measured

`smplwise_vms/backend/tests/bench_startup_warmup.py` (new, not collected by pytest) builds the synthetic installation of
`bench_home_devices.py` (300 areas, 2000 entities, 16 cameras) in a fresh process and times the FIRST call of each API call the home
screen makes. A cProfile of that first call showed the cost is not in our reads: FastAPI 0.141 builds the request handling state of
every route (dependencies, parameter and response models - ~880 routes) lazily, the first time a request is matched against them.
That alone was 2-4 s of the first `GET /devices/tree` here.

### What changed

- `smplwise/services/startup_warmup.py` (new): one daemon thread, started at the end of the start-up handler (`main.py`), sleeps 5 s, then
  1. matches one request scope for an address no route serves against every route (`BaseRoute.matches` only - no handler runs, no
     response, no log or audit row), which builds the routes' state exactly as the first real request would;
  2. runs the reads the first screens make: `read_settings`, `load_entities` + `build_tree` + `alarm.managed_controls` +
     `home_screen.payload`, a row count of the catalogue tables, and the import of the services the hot routes import lazily.
  Every read step runs on a `mode="read"` connection (`PRAGMA query_only=1`: SQLite refuses a write). Bounded: 30 s of wall time in all
  (later steps are skipped), a 50 ms pause between steps, every failure logged at debug level and the next step run. It never blocks
  readiness (own thread, after start-up returned) and makes no device, recorder (so no NVR read: its rate limits and leases are
  untouched), media server or Home Assistant call.
- Switch: setting `server.startup_warmup` (`"true"` default, `true|false` in `PATCH /settings`, system.configure as every setting; read at
  start-up), and the environment variable `SW_STARTUP_WARMUP=0` (wins over the setting). `tests/conftest.py` sets it to 0 for the test
  apps (the tests call `startup_warmup.run` directly).
- Frontend `shell/lazy-screens.ts`: `warmCommonScreens()` - once the shell is ready (any route), the chunks of the common screens
  (`devices-area`, `live-overview`, `live-wall`, `live-camera`, `devices-synoptic`, `investigate-events`) are fetched while idle, one
  at a time, each in its own idle slot (the pattern of the home's existing idle warm of the area screen, which stays). Never counted by
  `pendingScreens`, never reloads the page on a failure, nothing rendered. Off with `server.startup_warmup = "false"` (read with the
  product settings in `sw-app`), on a data-saver connection, and paused while the tab is hidden.

### Before / after (workstation, Windows, Python 3.12, heavily loaded - compare the columns, not the machine)

First call of each home-screen GET in a fresh process, three runs each (ms):

| | run 1 | run 2 | run 3 |
|---|---:|---:|---:|
| cold: the six home GETs, sum | 5488 | 5771 | 3785 |
| warm: the same after the warm-up, sum | 262 | 508 | 203 |
| the warm-up itself (background, before the first screen) | 9549 | 14572 | 6696 |

Per call, cold -> warm (run 1): `/devices/tree` 3362 -> 175, `/presence/building` 1469 -> 17, `/settings` 576 -> 20, `/me` 52 -> 30.
The warm-up's own time is almost all step 1 (6.5-14.6 s here); the add-on host should be faster, but if it is slower the 30 s budget
skips the read steps, not the route step (it runs first). Caveat: the bench database was just written, so the OS file cache is warm in
both modes; on the host after a restart the cold case is slower still. Not measured: the real add-on host, and the browser side
(the chunk prefetch was verified functionally, below, not timed).

## 2. The attention card no longer scrolls (live overview, `screens/live-overview.ts`)

At >= 1024 px the card ("דורש תשומת לב") took the room left by the page (NOSCROLL-297) and scrolled inside it - measured in the demo:
body 289 px of content in 118 px at 1024x768 (219 / 147 at 1440x900). Now:
- the card is `sw-card fill clip` (new `clip` attribute: the fill body never scrolls);
- after layout the screen counts the items that fit (`live-overview-logic.ts` `attentionFit`) and pages the rest: "1 מתוך 3" / "1–2 מתוך 3"
  with previous / next buttons; re-measured when the page's box changes (viewport) or the number of items changes;
- on a desktop the meta and reason lines are one line each (ellipsis, full text as tooltip), so more items fit;
- below 1024 px nothing changes (every item, the page scrolls as before). Both render paths (live data and demo) share one renderer.

Not fixed here (recorded): at 1024x768 and 1280x800 the live overview PAGE itself (the shell's main) still scrolls by ~50-80 px in the
demo: the row above (storage + sites health) is taller than the room and the last row keeps its 200 px minimum. The recent-events card
next to the attention card still scrolls inside at those sizes (it has "הצג הכל"). Both need a layout decision for that screen.

## 3. No internal name in the camera player

`components/sw-live-player.ts`: the two remaining "go2rtc לא זמין" (close 4503 and the `upstream_unavailable` error on a LAN tile) now say
"שרת הווידאו אינו זמין", the text the remote tiles already used. A unit check fails on any Hebrew string of the player that names
go2rtc or Home Assistant.

## 4. No endless "מתחבר…"

`components/sw-live-player.ts`:
- `SOCKET_OPEN_MS` (10 s): a socket to the relay that has not opened ends the attempt with "שרת הווידאו אינו עונה", a "נסה שוב" button
  (non-compact tiles) and the usual automatic retry with backoff; the snapshot poster stays behind it;
- `CONNECTING_CAP_MS` (60 s): the safety net of one attempt - every step's own bound (WebRTC connect 5 s / first frame 30 s, MSE 20 s) is
  shorter; this only catches a path none of them covers;
- a browser that refuses `new RTCPeerConnection` (no WebRTC) goes on to the MSE path instead of throwing inside the async start;
- "שרת הווידאו אינו זמין" also offers "נסה שוב"; a manual retry restarts the backoff.
- `screens/live-camera.ts`: the note under the player said "מתחבר…" for an ended stream too; it says "הסתיים".

## 5. Tests (run on this workstation)

| Suite | Result |
|---|---|
| `tsc --noEmit` (frontend) | clean |
| backend `tests/test_startup_warmup_2421.py` (new, 14 incl. parametrized) + `test_asyncio_default_2342.py` + `test_ui_settings.py` | **50 passed** |
| frontend unit: `unit-warmup-polish-2421.spec.ts` (new, 9) + `unit-perf-home-devices.spec.ts` (incl. lazy-tags-check) + `unit-video-conn-test.spec.ts` | **35 passed** |
| `evidence-warmup-polish-2421.spec.ts` (new, 7: card at 1024x768 / 1280x800 / 1440x900 + below desktop, idle prefetch, socket never opens + retry, no WebRTC -> MSE), desktop project, against the Vite dev server (`SW_BASE_URL`) | **7 passed** |
| `evidence-nvrless-cameras-2412`, `evidence-nvr-less`, `evidence-capabilities`, `evidence-perf-plan-shell`, `perf-home-load`, desktop + tablet, dev server | **10 passed, 36 skipped** (live / fixture-only) |
| `layout-noscroll-297`, `evidence-noscroll-295`, `layout-overview-pages-297`, all projects, dev server | **48 passed, 95 skipped, 1 failed** - the failure was `tickets-overview-worst at 1920x1080` (another screen; timed out under the loaded workstation) and **passed on a rerun** (`--last-failed`: 1 passed) |
| `scripts/gate/lint_spec_waits.py` on the two new specs | 0 findings |
| Pixel baselines, the runner's built preview, the full gate | **NOT_RUN** (no build here; the runner gate should run the specs above on the preview and refresh any live-overview / player baselines: the attention card now shows one-line rows and a pager on a desktop) |
| The lab / real add-on host | **NOT_RUN** (not allowed in this task) |

## 6. Revert

Revert the branch commits. The stored `server.startup_warmup` row (if any) is then unused.
