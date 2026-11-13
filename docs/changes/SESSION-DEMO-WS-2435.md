# SESSION-DEMO-WS-2435 - a failed /me no longer turns into the demo; /me/ws gets a liveness check

Branch `pilot/SESSION-DEMO-WS-2435`, cut from `origin/main` @ `665ec8f24` (2.43.4). No version bump, no CHANGELOG entry, no backend
change, no migration, no new setting. No device, NVR, go2rtc or Home Assistant was contacted.

Source: code review 2026-11-13, frontend core (`private/code-review-2026-11-13/07-frontend-core.md`), findings F1 and F6 (session part).

## 1. A failed `GET /me` became the demo (F1)

**Finding.** `api/session.ts` `loadSession`: a 401 was `unauthenticated`; every other `ApiError` and every thrown error set
`mode: 'demo'`. The shell then showed fabricated data, the demo user and role, and `cap()` / `webrtcServer()` /
`installationSupported()` opened every gate. A 502 from HA Ingress while the add-on restarts was enough.

**How the demo is selected today (kept).** No spec or build sets a flag; the demo is "no backend behind the page":

- the pixel and layout specs `page.route('**/api/v1/**', r => r.abort())` - a network `TypeError`;
- specs that run the preview with no backend - `vite preview` proxies `/api` to `127.0.0.1:8099`, and with nothing there its proxy
  answers a bare `500 text/plain` with an empty body (vite 6.4.3 `proxy.on('error')`, read in `node_modules/vite`);
- fixture specs whose catch-all answers `404 {code:'not_found'}` and do not mock `/me`.

**Change** (`api/session.ts`, `shell/sw-app.ts`):

- `demoOnMeFailure(err, path)` decides. Never under `/api/hassio_ingress/` or on the remote channel (`remoteBase(path)`): a real
  installation. At the origin root: demo for a network failure, the preview proxy's bare 500 and any 4xx (as before); not for
  502 / 503 / 504 or a 5xx carrying the server's error model (a backend is there and failing for now).
- Otherwise the session stays `loading` with `retrying: true`, `NO_CAPABILITIES` (every boolean capability off), and `/me` is asked
  again after 1 s, 2 s, 4 s, then every 10 s (`ME_RETRY_MS`), and at once on `online`. A session that already answered (`api`,
  `no_access`, e.g. the re-read after `permissions_changed`) keeps its last answer and retries; it never becomes the demo.
- `cap()`, `webrtcServer()`, `installationSupported()` read the capabilities while retrying (all off). The demo and the first
  moments before `/me` answers keep everything on, as before.
- The shell shows the existing offline state while retrying: `sw-state-panel state="stale"` "אין חיבור לשרת" with the server's
  message if any, "מנסה להתחבר שוב…" and a "נסה עכשיו" button (`data-session-retry`), in the gate slot of the main shell and in the
  kiosk / embed views. `data-shell-ready` stays off (mode is `loading`).

**Visuals.** Nothing existing changes: the demo, the loading, the sign-in and no-access paths render as before; the retry panel is a
new state that no baseline reaches (it needs a 502/503/504 or a server-model 5xx on `/me`).

## 2. `/me/ws` had no liveness check (F6, session part)

**Finding.** `watchPermissions` reconnected only on `onclose`; a constructor throw returned and never retried; no watchdog, no
resume. A half-open socket after a phone sleep stayed silent (no `permissions_changed`, no live notifications through `onMeEvent`).

**Change.** New `api/reconnecting-socket.ts` (`openReconnectingSocket`, `wsUrl`), the HOMELIVE-295 pattern of `api/ha.ts`
`subscribeHa` as a shared helper with an injectable `SocketEnv` (clock, timers, page events, constructor):

- back-off 2 s doubling to 60 s (as before for /me/ws) with ±20 % jitter, reset after a good open;
- a throwing constructor schedules the same reconnect;
- watchdog every 20 s while visible: OPEN but silent > 75 s (the server's heartbeat is 30 s, `routers/me.py` `ME_HEARTBEAT_S`), or
  CONNECTING > 20 s, is released (handlers nulled, closed) and replaced at once; a closed socket waiting for its back-off is left to
  its timer;
- visibilitychange / focus / pageshow run the same check now (and reconnect a closed one at once - its timer may have been frozen);
  `online` replaces any socket that is not OPEN;
- `stop()` clears the timers, the listeners and the socket; `finalClose(code)` is available (not used by /me/ws, which reconnected
  after every close before and still does).

`watchPermissions(onChanged, env?)` now uses it; the frame handling moved to `meFrame` unchanged (listeners first, then
`permissions_changed` / the `hello` fingerprint check, which also covers a change missed while a dead socket was replaced).

**Not ported (for later, branch 12 of the review).** The same hand-written loop, without a watchdog and without a retry after a
constructor throw, remains in:

- `api/events.ts` `subscribeEvents` (`events/ws`, back-off to 30 s);
- `api/intercom.ts` (around line 639);
- `api/schedules.ts` `subscribeSchedules` (`ha/ws`, stops on 4401/4403);
- `api/ha.ts` `subscribeHa` already has the watchdog, but keeps its own copy (live-socket count, `onSocket`) and still does not
  retry a throwing constructor until its next watchdog tick.

Not trivial to move safely here: each has its own `onSocket` / state callback semantics and evidence specs, and the watchdog needs
each server's heartbeat cadence checked. Media / talk sockets (`sw-live-player`, `wk-*`, `sw-incoming-call`, `sw-wall`,
`video-conn-test`) are session sockets with their own lifecycles and are out of scope.

## Tests

- `tests/unit-session-me-failure-2435.spec.ts` (preview build, page.route): 502 then 200 - the retry panel, nothing granted, no demo
  marker or demo user ever, the real user after the 1 s retry; 503 repeated - back-off gaps and the "נסה עכשיו" button; all
  `/api/v1` aborted - still the demo; bare 500 and catch-all 404 - still the demo; 401 - still the sign-in gate; Node: the
  `demoOnMeFailure` table (Ingress, remote, root).
- `tests/unit-reconnecting-socket-2435.spec.ts` (Node, fake clock and sockets): constructor throw retried with back-off; silent
  socket replaced after missed heartbeats; resume / stuck-connecting / online; back-off doubling, cap and reset; `finalClose` and
  `stop()` leave nothing behind.

Results: see the commit message (local run) and the runner entry check (`~/pre/entry_sessfix.log`).

## Rollback

Revert the commit. No data, setting or server state is involved.
