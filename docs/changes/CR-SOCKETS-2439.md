# CR-SOCKETS-2439 - the remaining hand-written sockets on the shared reconnecting socket

Branch `pilot/CR-SOCKETS-2439` (master plan row `CR-SOCKETS-2436`, section 3.3 wave 2 frontend; theme T16).
**Base: `origin/pilot/CR-WAVE1B-COMBINED-2436` (1a7e19ae3)** - `api/events.ts` and `api/schedules.ts` were changed by wave 1
(API-BLOB); none of the row's files is held by AUDIT30 - **with `origin/pilot/SESSION-DEMO-WS-2435` (c090f6059) merged in** for
`api/reconnecting-socket.ts` (the row's named dependency, not merged to main yet; it is already part of `CR-WAVE2-COMBINED-2439`).
The merge was clean. No version bump, no backend change, no pixel change.

## Findings covered

- **07:F6 (remaining sockets)**: `/events/ws` (`api/events.ts`), `/intercom/ws` (`api/intercom.ts`), the schedules' own `/ha/ws`
  (`api/schedules.ts`) had the same hand-written loop: reconnect only on `onclose`, a constructor that throws ended the loop for good,
  no liveness check (a half-open socket after a phone slept stayed dead), no resume. `api/ha.ts` had the HOMELIVE-295 watchdog as its
  own copy.
- **08:F24**: the WisKey listen and talk sessions shared the same socket-start block.

## What changed

| Socket | Before | Now |
|---|---|---|
| `/events/ws` `subscribeEvents` | back-off 2 s .. 30 s on close, reconnect always | `openReconnectingSocket`, `maxDelayMs: 30_000`, no final code (as before) |
| `/intercom/ws` `subscribeIntercom` | 2 s .. 30 s, final on 4401 / 4403 | same, `finalClose` 4401 / 4403 |
| `/ha/ws` `subscribeSchedules` | 2 s .. 30 s, final on 4401 / 4403, 1 s throttle | same; the socket part is `schedulesSocket()` (testable, no mode check), the 1 s throttle kept |
| `/ha/ws` `subscribeHa` | own watchdog (SILENT_MS 75 s, CONNECT_MS 20 s, WATCHDOG_MS 20 s), 2 s .. 30 s, final on 4401 / 4403, `haPushLive()` count | the helper **with the same timings** passed in; the OPEN-socket count for `haPushLive()` kept (open +1; close, watchdog release and stop -1) |

Every adopter gains what the helper adds: a small jitter on the back-off (+/-20 %), a retry after a constructor that throws, the
liveness check (a socket OPEN but silent past 75 s, or CONNECTING past 20 s, is released and replaced; the servers' heartbeat is every
30 s on all three endpoints - checked in `routers/events.py`, `routers/ha.py`, `routers/access_control.py`), and resume on visible /
focus / pageshow / online. Same messages to the same listeners; a healthy socket behaves as before. Each `subscribe*` takes an optional
last `env` argument (tests only); no caller changes.

Small differences, on purpose (the helper's contract):
- `stop()` releases the socket with its handlers detached, so the caller no longer receives a late `onSocket(false)` /
  `onState(null, false)` after it unsubscribed (before: the close event fired after stop). `haPushLive()` is still decremented.
- `subscribeHa`: the watchdog no longer cuts short a back-off that is already running (before: a closed socket waiting up to 30 s was
  reopened by the next 20 s watchdog tick); on resume it still reconnects at once. A socket released while still CONNECTING reports
  `onSocket(false)` (before: silent).

WisKey (`wiskey/session-socket.ts`, new): `openSessionSocket(deps, reply, onFail)` - the shared start: open on `ws_path`, binary frames;
a constructor that throws stops the server session and calls the session's `fail('network')`. `listen-session.ts` and `talk-session.ts`
use it. Not a reconnecting socket on purpose (a lost listen / talk socket ends the session).

## Tests (run locally, Windows, Node 24.21.0)

- `npx tsc --noEmit` (full project): **0 errors** (the new spec was written while it ran; then checked with a temporary config
  extending `tsconfig.json` over the two touched specs + `src/vite-env.d.ts`: 0 errors; the temporary config was deleted).
- `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-sockets-2439.spec.ts
  tests/unit-reconnecting-socket-2435.spec.ts tests/unit-live-refresh-295.spec.ts`: **34 passed**.
  - New `unit-sockets-2439.spec.ts` (fake clock, fake page events, fake sockets per adopter): frames, connected state, back-off
    2/4/8/16/30/30 s, silent socket replaced, final codes, constructor retry, the schedules' 1 s throttle and its cancel on stop,
    `haPushLive()` through open / close / watchdog / stop and with two subscribers, `stop()` leaves no timer, listener or socket; the
    WisKey shared start (success, constructor throw) and its use in both sessions.
  - `unit-live-refresh-295.spec.ts`: its source check of `api/ha.ts` follows the move (the resume listeners now live in
    `api/reconnecting-socket.ts`).
- `unit-wiskey-*` (21 specs) + `unit-wkaudin-295.spec.ts` + `unit-wkf01f02-295.spec.ts`: **252 passed**.

## Not run

- `unit-session-me-failure-2435.spec.ts` (from SESSION-DEMO-WS) navigates to `./#/devices`: it needs a running preview (5 failures
  "Cannot navigate to invalid URL" in the node-only config, a harness matter, not this branch). NOT_RUN here.
- Runner entry check and pixel baselines: not queued, by the lead's instruction. Browser evidence specs of the live screens
  (events, intercom, schedules, home): NOT_RUN locally. Pixels: none expected.
