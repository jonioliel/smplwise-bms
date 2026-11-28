# FIX-FE-2570 - frontend core findings of the 2.56 deep review (FE-02 .. FE-06)

Base: `origin/release/2570-train` (= v2.56.0, `6ea807b2e`). Review: `docs/review/DEEP-REVIEW-2560-FRONTEND-CORE.md`
(branch `review/DEEP-2560-FRONTEND-CORE`).

## Status per finding

| Finding | Status at the base | This row |
|---|---|---|
| FE-02 (medium) home administration switches not put back after a refused save | OPEN | FIXED |
| FE-03 (low) server-clock offset without a round-trip bound | already FIXED by FIX-SERVER-CLOCK-2560 (`f5c6f3c2f`): `api/server-clock.ts` drops samples with a round trip > 2 s, keeps the smallest error, an old sample (> 60 s) gives way; test `tests/unit-fix-server-clock-2560.spec.ts` "FE-03 ..." | untouched |
| FE-04 (low) HA entity actions / alarm commands stamp `expires_at` on the device clock | already FIXED by FIX-SERVER-CLOCK-2560 (`f5c6f3c2f`): `api/ha.ts:208` and `api/alarm.ts:55` use `serverNow()`; tests in `tests/unit-fix-server-clock-2560.spec.ts` (VD-01, FE-04 and the source scan for `expires_at ... Date.now() +`) | untouched |
| FE-05 (low) bare `decodeURIComponent` on route segments in five screens | OPEN | FIXED |
| FE-06 (low) push-approval watcher stuck `showing = true` | already FIXED by FIX-PUSH-APPROVAL-2560 (`823d31f1c`): `shell/push-approval-watch.ts` `look()` has `try/catch/finally { showing = false }`; test `tests/unit-push-approval-fix-2560.spec.ts` "FE-06 ..." | untouched |

## What changed

- FE-02 `frontend/src/home/sw-home-admin.ts`: the seven save-at-once `sw-toggle`s (visitor invitations, wall rest, wall night, and the
  per-person "may switch", "home only", "wall panel mode", "guests") carry `controlled` (HONEST-STATES-2540). A press only asks
  (`detail.checked`, which the handlers already read); the switch moves when the saved answer re-renders it (`this.vis`, `this.inst`, or
  `load()` after a policy PUT). A refused or failed save leaves the switch on the server's state, with the existing red error line. The
  look of the switches is unchanged (no pixel baseline, no compare page).
- FE-05: `screens/automations-logic.ts` (`parseAutomationsRoute`), `screens/devices-automations.ts` (scenario id),
  `screens/devices-schedules.ts` (schedule id), `screens/infra-generator.ts` (alert id, in `render`) and `home/home-recordings.ts`
  (camera@time argument) decode with `router.ts decodeSegment` (LOWS-FRONTEND-2550): a broken escape such as `50%` is kept as written
  instead of throwing `URIError`.

## Same class seen outside this row (not edited)

- `frontend/src/calendars/cal-page.ts:179` (`get sub()`): a bare `decodeURIComponent` on a route segment, the same FE-05 class.
- `frontend/src/api/download.ts:11`: `decodeURIComponent` on a `Content-Disposition` file name (not a route; throws on a malformed header).

- FE2-17 (deep review 2.57, test quality; added by the lead) `frontend/tests/unit-controlled-toggles-2540.spec.ts`: the per-file guard
  lists `home/sw-home-admin.ts: 7`, and a new structural test finds the save-at-once switches itself (every `sw-toggle` in `src` whose
  `@change` calls a `save*` / `put*` / `post*` / `patch*` / `apply*` / `set*Setting` function must be `controlled`). The 23 switches in 15
  files that matched when it was added are a ratchet (`KNOWN_UNCONTROLLED`, counts may only go down; not reviewed one by one in this row -
  some put themselves back after a failure, as `generator/gen-routing.ts` does). A handler that is a named method (`this.toggle(...)`) is not
  seen by the discovery; the per-file counts still cover those.

## Tests

- `frontend/tests/fix-fe-2570.spec.ts` (page behaviour, desktop, mocked backend): a refused / failed PUT leaves "home only", "guests"
  (a non-administrator person), the visitor switch, wall rest and wall night on the server's state (`aria-checked="false"`).
- `frontend/tests/unit-fix-fe-2570.spec.ts` (Node): `parseAutomationsRoute` with `50%`, a cut escape and a Hebrew escape (behaviour); the
  five FE-05 screens use `decodeSegment` (source scan).
- `frontend/tests/unit-controlled-toggles-2540.spec.ts`: the FE2-17 guard above.

Results (runner, slot B, real runs):

| Run | Unit (Node) | Page (desktop) |
|---|---|---|
| Before - tests at `a132778c5` on base source | `unit-fix-fe-2570`: 7 failed | `fix-fe-2570`: 2 failed (visitor switch stayed `aria-checked="true"` after a refused save) |
| Before - guard at `9f2f165a3` with base `sw-home-admin.ts` | `unit-controlled-toggles-2540` + `unit-fix-fe-2570`: 2 failed (home administration count; FE2-17 discovery found 7), 11 passed | `fix-fe-2570`: 2 failed (visitor switch stayed on) |
| After - `9f2f165a3` | 13 passed | 2 passed |

Also at the fix (`a13039daa`): `vite build` OK; `tsc --noEmit -p tsconfig.json` exit 0; `npm run typecheck` exit 0; `tsc -p
tsconfig.tests.json` exit 0 at `9f2f165a3`; `eslint` on the six changed source files exit 0; `unit-automations-list` +
`unit-lows-frontend-2550-core` 40 passed; page specs `home-simple-2420`, `home-v3-followup-a`, `home-wall-night-2500`, `home-v3-p1`
(desktop) 55 passed.

NOT_RUN: the tablet / phone projects, the full evidence / layout / pixel suites, backend tests (no backend change), any lab run.
