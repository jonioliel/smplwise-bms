# DEEP-REVIEW-2560 - FRONTEND-CORE (id prefix `FE`)

Reviewed head: `origin/release/2560-train` at `3739e3ded` (add-on 2.56.0). Read-only worktree; nothing was built or executed
(no unit, tsc or browser run: a 2.56 release gate holds the runner, and the PC rules forbid Playwright / tsc). Range read for new code:
`v2.52.0..3739e3ded` on the FRONTEND-CORE paths of `docs/review/FINAL-REVIEW-PLAN-2560.md` section 3, area 8.

## 1. Summary

| Id | Severity | Title | File:line |
|---|---|---|---|
| FE-01 | medium | A physical command confirmed through step-up is replayed with its old envelope: a WisKey door release fails as "expired - fix your device clock" whenever the confirmation takes more than 15 s | `frontend/src/api/client.ts:231-238`, `frontend/src/api/intercom.ts:346-350`, backend `routers/access_control_door.py:43,85` |
| FE-02 | medium | FC-01 residual: the home administration page's save-at-once switches are uncontrolled and never put back after a refused save | `frontend/src/home/sw-home-admin.ts:176-211, 196, 243-252, 329, 333, 491-497` |
| FE-03 | low | Server clock: one slow or late answer replaces the offset without any round-trip bound; a poisoned exact sample cannot be corrected by headers | `frontend/src/api/server-clock.ts:16-22` |
| FE-04 | low | SCR-13 class remains: Home Assistant entity actions (door tile, alarm via HA) and alarm commands stamp `expires_at` on the device clock | `frontend/src/api/ha.ts:205-208`, `frontend/src/api/alarm.ts:53-55` |
| FE-05 | low | FC-10 class remains outside the shell: five screens decode route segments with a bare `decodeURIComponent` | `screens/automations-logic.ts:46`, `screens/devices-automations.ts:544`, `screens/devices-schedules.ts:339`, `screens/infra-generator.ts:205`, `home/home-recordings.ts:169` |
| FE-06 | low (outside area: 1 SECURITY-ADMIN) | Push-approval watcher: a failed sheet chunk or sheet leaves `showing = true` for the life of the page - no approval request is shown again | `frontend/src/shell/push-approval-watch.ts:302-309` |

Counts: critical 0, high 0, medium 2, low 4.

## 2. Findings

### FE-01 (medium) - step-up replay of a physical command re-sends a stale envelope

Code path:
- `api/intercom.ts:346-350`: every WisKey command (door release included) carries `expires_at = serverNow() + COMMAND_TTL_MS` with
  `COMMAND_TTL_MS = 15_000`.
- Backend `routers/access_control_door.py:43` runs `_envelope()` (`routers/access_control_command.py:285-296`: `expires <= now` ->
  409 `expired`, text "the request expired before it reached the server ... if your device clock is wrong, fix it") BEFORE
  `open_door()`, which calls `step_up.guard_action(... ACTION_DOOR_OPEN)` at line 85. So the first request passes the envelope and is
  refused 403 `step_up_required`.
- `api/client.ts:231-238`: the shell dialog asks for the proof (`components/sw-step-up-dialog.ts`, `STEP_UP_DIALOG_MS = 90_000`), then
  `attempt()` re-sends the SAME `init` - the same body, the same `expires_at`. `replayAllowed()` allows physical actions for
  `STEP_UP_REPLAY_MS = 120_000`.
- The replay reaches `_envelope()` again: after 15 s it is refused 409 `expired`. (The duplicate check does not trip: the refused
  first attempt never wrote an attempt row, `services/access_control_core.py:165-172`.)

Failure scenario: step-up for physical actions switched on (opt-in, owner Q2 = b). An operator presses "open door" on the WisKey
screen, the code dialog opens, the operator unlocks the phone, opens the authenticator and types the 6 digits (typically 15-30 s) or
approves on the phone (push). The proof is recorded, the replay is refused "expired - fix your device clock". The door does not open
(fail-safe), but the operator is told the wrong cause and has to press again (now inside the 5-minute window it works). The same
mismatch, at 60 s, exists for the alarm commands (`api/alarm.ts:54`) and the devices door tile (`api/ha.ts:207`), while the client
window is 120 s and the dialog 90 s.

Suggested fix (client, smallest): for a refusal whose `details.action` is in `PHYSICAL_STEP_UP_ACTIONS`, read `expires_at` from the
JSON body of the refused request; when it has passed (on `serverNow()`), do not replay - resolve with a dedicated result that the
screens show as "confirmed - press again" (or let a physical call pass a `rebuild()` that mints a fresh envelope and request id).
Align `STEP_UP_REPLAY_MS` with the shortest envelope (or drop it in favour of the body's own `expires_at`). Add a unit spec: refused
door release, confirm after 16 s -> no second `fetch`.

### FE-02 (medium) - FC-01 residual on the home administration page

FC-01 re-read with the 370-switch adoption (five families sampled, see section 5). Four families are honest; one is not:
`home/sw-home-admin.ts` renders save-at-once switches WITHOUT `controlled` and without `live()` or a revert:
- visitors switch (line 196 -> `saveVisitors`, 176-187): on failure `this.vis` is unchanged, so `?checked=${on}` renders the same value
  and Lit does not touch the element; the switch stays on the value the server refused;
- wall rest / night mode (329, 333 -> `saveInstall`, 243-252): same, `this.inst` unchanged on failure;
- the per-user policy switches "may switch", "home only", "wall panel mode", "guests" (491-497 -> `save`, 199-211): the failure path
  does not reload, the rows keep the unsaved state.

Failure scenario: the administrator turns "home only" on for a user, the PUT is refused (permission, validation, offline, or the
step-up dialog cancelled when the settings gate applies). The red error line appears, but the switch shows "on"; a later glance at the
page reads a policy that is not in force. (Code area: 7 MAPS-HOME; the finding is FC-01's, so it is reported here.)

Fix: add `controlled` to these eight `sw-toggle`s (the handlers already read `e.detail.checked`), or bind `.checked=${live(...)}` and
`await this.load()` in the failure path as `generator/gen-routing.ts:330-342` does.

### FE-03 (low) - the server-clock offset has no round-trip bound

`api/server-clock.ts:16-22` takes every sample as the truth: `offset = at - (sentAt + receivedAt) / 2`, error up to half the round trip.
A header sample replaces any earlier header sample, a body sample replaces anything, and a header sample never replaces a body sample
(line 18). `api/client.ts:204-216` feeds every answer, including ones whose round trip was long.

Failure scenario: a phone or wall tablet sleeps with a request in flight (the intercom overview read, which feeds an exact `body`
sample); the answer is delivered after a 10-minute sleep. The midpoint is 5 minutes off, `serverNow()` is 5 minutes behind, and every
door release / answer / reject (`expires_at = serverNow() + 15 s`) is refused 409 `expired` until the next body sample arrives
(header samples cannot correct it, line 18). The same happens, smaller, after a slow write (the server's `Date` is taken at the end
of a long request).

Fix: drop samples whose round trip exceeds a bound (for example 3 s), or keep the sample with the smallest round trip of the last few
minutes; let a header sample replace a body sample that is older than a minute.

### FE-04 (low) - device-clock `expires_at` left in the HA entity action and alarm clients

SCR-13 moved the WisKey commands to `serverNow()`. `api/ha.ts:207` (`runAction`: every HA entity action, including the door tile that
reaches `open_door`, and the alarm actions through HA) and `api/alarm.ts:54` (`envelope()`) still use `Date.now() + 60_000`. A wall
tablet whose clock is more than 60 s behind gets 409 `expired` on every tile press and alarm command (`routers/ha.py:287`,
`routers/access_control_door.py:210`, `routers/alarm.py:203`); the server text there says only "try again".
Fix: `serverNow()` in both (the import is already used by `api/intercom.ts`).

### FE-05 (low) - bare `decodeURIComponent` on route segments in five screens

LOWS-FRONTEND-2550 fixed the shell's three segments with `router.ts:22-30 decodeSegment`. The same class remains in
`screens/automations-logic.ts:46`, `screens/devices-automations.ts:544`, `screens/devices-schedules.ts:339`,
`screens/infra-generator.ts:205` (inside `render`) and `home/home-recordings.ts:169`. A pasted or cut link such as
`#/devices/automations/scenarios/50%` throws `URIError` in the screen's route handler or render: the screen keeps its previous state
(or renders nothing) with no message. Fix: use `decodeSegment` there (owners: 6 for the generator, 7 for home, 8/4 for the rest).

### FE-06 (low, outside area: 1 SECURITY-ADMIN) - the push-approval watcher can stop for good

`shell/push-approval-watch.ts:302-309`: `showing = true; ... await import('../components/sw-push-approval-sheet');
await showPushApproval(first, keyId); showing = false;` has no `try/finally`. A chunk that fails to load (exactly the case of a page
left open across an add-on update, whose chunk names changed) or a sheet that throws leaves `showing = true`; every later `look()`
returns at line 293 without asking, so no approval request is ever shown again on that page. The rejection is also unhandled
(`run()` / `schedule()` lose the chain). Fix: `try { ... } finally { showing = false; }` and a `.catch()` on the look chain.

## 3. Re-verification of old findings (area 8)

| Old id | Status at `3739e3ded` | Evidence |
|---|---|---|
| FC-01 | PARTIAL | `components/sw-toggle.ts:27,157-162` (`controlled`), `toggle-value.ts:195-200`; 97 controlled + 17 `switchPress` of 377 switches; four sampled families honest, the home administration page not: FE-02 |
| FC-03 | FIXED (1ff111f25 / CLIENT-RESILIENCE-2540) | `arx/auth.ts` `refreshOutcome` (`retry` vs `ended`), `arx/boot.ts` 401 handler returns `'unreachable'`, `api/client.ts:225-230` `ApiUnreachable('signin_unreachable')`, `arx/arx-reconnect.ts` + `boot.ts showReconnect` |
| FC-04 | FIXED (FE-SAFETY-FIX-2520) | `components/confirm-dialog-keys.ts:18-23`, `confirm-dialog.ts:93-104,108-121` |
| FC-05 | FIXED (CLIENT-RESILIENCE-2540) | `api/client.ts:88,160-187,194-266,327-332`: per-attempt deadline, body covered, paused during 401 refresh / step-up; shared GETs get the default deadline. By design `apiResponse` / `apiBlob` / writes have none (4 `apiResponse` callers, none a poll) |
| FC-06 | FIXED (CLIENT-RESILIENCE-2540) | `pwa/register.ts noteServerBuild / showUpdate / updateLater`, `pwa/arx-pwa-prompts.ts` hello listener; backend `routers/me.py:287` sends `__version__`; navigations are network-first (`pwa/sw.ts:120`) so "רענון" without a waiting worker loads the new shell |
| FC-07 | FIXED (LOWS-FRONTEND-2550) | `arx/boot.ts` `startApp` calls `syncUiLang()` after the remote session exists |
| FC-08 | FIXED (LOWS-FRONTEND-2550) | `api/client.ts:382-397` (`FETCH_FAILURE`, `http_<status>` sentence) |
| FC-09 | FIXED (LOWS-FRONTEND-2550) | `api/session.ts:209-227` (check first, each listener in its own `try`), `api/ha.ts:498-525` |
| FC-10 | FIXED in the shell (LOWS-FRONTEND-2550) | `router.ts:22-30`, `shell/sw-app.ts` (incidents, devices area, schedule editor); same class elsewhere: FE-05 |
| FC-11 | FIXED (LOWS-FRONTEND-2550) | `api/session.ts:152-199,230` (4401/4403 final, reload once, doubling reopen 2-60 s), `api/reconnecting-socket.ts:163-173` |
| FC-12 | FIXED (CLIENT-RESILIENCE-2540) | `shell/step-up.ts:19-41` (one dialog per action, once-actions each their own, queued) |
| SCR-23 | FIXED (PHYSICAL-CONFIRM-2540 / CLIENT-RESILIENCE-2540) - see FE-01 | the dialog expires (`sw-step-up-dialog.ts:22,195-196`) and the client caps physical replays (`api/client.ts:109-110,237-245`); the replay itself is stale against the server envelopes: FE-01 |
| SCR-43 | FIXED (PHYSICAL-CONFIRM-2540) | `components/confirm-dialog.ts:93-99` (`e.repeat` never answers), `focusCancel` at 142 |

Still open 0, partial 1 (FC-01), fixed 12 (SCR-23 fixed, with FE-01 as a new finding that cites it).

## 4. Improvements (short)

- `api/client.ts`: `apiResponse` / `apiBlob` have no deadline at all; a `timeoutMs` option (opt-in) would let the four image / pack
  reads give up instead of hanging a thumbnail strip.
- `shell/step-up.ts`: two physical refusals of the same action at the same moment share one dialog and both replay; the relay guard
  refuses the second (409 in progress), so this is safe today, but a `once`-style key for `PHYSICAL_STEP_UP_ACTIONS` would make it
  explicit.
- `pwa/register.ts`: the update card compares `hello.build` (`__init__.py __version__`) with `__ARX_BUILD__` (`config.yaml`); the
  two already must match (`scripts/release_check.py:612-615`), so no change - noted so nobody drops that check.

## 5. Checked and fine / not covered

Checked and fine:
- `api/client.ts` end to end: path / query encoding, deadline plumbing (`fetchApi`, `send`, `deadlineOf`), in-flight sharing, 401 retry
  once, step-up inline header stripped, error envelope normalisation, `describeError`, field-error readers.
- `api/session.ts` (demo rules, /me retry schedule, `/me/ws` final close and listener isolation), `api/reconnecting-socket.ts` close path.
- `api/server-clock.ts` (beyond FE-03), `api/stream-errors.ts` (no raw code shown; denial codes without retry hint),
  `api/physical-outcome.ts` (4xx / structured `not_sent` / `refused` = refused, everything else unknown; no retry).
- `arx/auth.ts` new code (`adoptSignIn` revokes only a different refresh token; `refreshOutcome` settled-promise reset; `resume`
  retry on network / 5xx, the only 503 is transient `remote_unavailable`), `arx/boot.ts` reconnect loop (single timer, `online`
  listener removed, busy guard), `arx/arx-reconnect.ts`.
- `components/confirm-dialog.ts` (+ keys), `components/sw-toggle.ts` / `toggle-value.ts`, `components/focus-return.ts`,
  `components/modal-stack.ts` additions (`focusLost`, disabled-opener wait bounded to 3 s), `components/announcer.ts`.
- `pwa/register.ts` update card logic, `pwa/arx-pwa-prompts.ts` focus return, `shell/sw-app.ts` diff (onboarding row and landing,
  `decodeSegment`, announcer mount), `shell/nav.ts` diff (onboarding tab is installation-scope `system.configure`), `router.ts`,
  `main.ts`.
- `frontend/scripts/build-stamp.mjs` + inputs list (CRLF normalisation, missing files hashed, stamp written last), `package.json`
  (only the stamp script; no dependency change since v2.52.0).
- FC-01 families sampled: `pwa/notifications-settings.ts` (draft + save button: fine), `components/sw-offbox-backup.ts`
  (`saveScopeDefault` reverts; config switches are a draft), `components/frigate-event-control.ts` (`toggleRetain` reverts and
  reloads), `components/nvr-writes-switch.ts` (puts the server state back before asking), `generator/gen-routing.ts` (`live()` +
  reload); `home/sw-home-admin.ts`: FE-02.
- Listener / timer balance scan of `sw-user-menu`, `sw-dropdown`, `sw-sheet`, `sw-drawer`, `sw-table`, `sw-tabs`, `tabs-mode`,
  `header-fit` (every add has its remove; observers disconnected).

Not covered (honest list):
- Nothing executed: no unit spec, no tsc, no browser run (the gate holds the runner). The i18n packs (ar / ru) were not checked for key
  parity beyond the existing `tests/unit-i18n-arru-completeness-2550.spec.ts`, which was not run.
- `shell/nav.ts` tab tables and landing rules, `tabs-mode.ts`, `header-fit.ts`, `sw-user-menu.ts`, and the internals of `sw-dropdown`,
  `sw-sheet`, `sw-drawer`, `sw-table`, `sw-tabs` were only scanned for listener / timer balance, not read line by line.
- The small screens of section 3 (`screens/media*`, `scenarios*`, `kiosk*`, `bubble*`, `messaging*`, ...), `sw-step-up-dialog.ts`
  beyond its timers, the generated wire types, `frontend/public/`, `vite*.config.ts` beyond `buildId`, and the quality of the area's
  unit specs (assertions not sampled).
- `pilot/A11Y-FOLLOWUPS-2560` is not on this train; `components/announcer.ts` is (merged as part of the 2.56 train) and was read.
