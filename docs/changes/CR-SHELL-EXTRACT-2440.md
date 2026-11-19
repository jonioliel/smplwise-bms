# CR-SHELL-EXTRACT-2440 - the shell's notification wiring as a controller; router.ts comment

Branch `pilot/CR-SHELL-EXTRACT-2440` (2.44.0 group G10; master plan row `CR-SHELL-EXTRACT-2436`, section 3.4 wave 3A frontend:
findings 07:F24 "notification wiring" and 07:F23). Pure refactor: no behaviour, text, pixel, API or setting change.

**Base:** `origin/pilot/CR-W3B-FE-COMBINED-2443` (41bf2a6d6) with `origin/release/2438-train` (d40eaf5d7, MODAL-STACK-B and DOMUS
included) merged in (85b243455, no conflict); after the refactor commit (4aeefad39) the train's 2.43.8 tip (4679923b4) was merged
too (8b7a85491, no conflict).

## Scope (from the row) and what was already done elsewhere

07:F24 named three pieces of `shell/sw-app.ts` / the shell entry:
- the header-fit logic (`fitDd`) - already extracted by CR-SHELL-TIMERS-2439 (`shell/header-fit.ts`, `HeaderFit` controller);
- `sw-second-factor` imported only when the panel opens - already done by CR-SHELL-LAZY-2436 (`sw-user-menu.ts` `onFactorToggle`);
- **the notification wiring - this branch.**

07:F23: `router.ts` - a carriage return inside the `onRouteChange` doc comment ate the first letter of "replaced" (the comment read
`/** ` + newline + `eplaced is true ...`). Retyped as ``/** `replaced` is true for ...``.

## What changed

New `frontend/src/shell/notify-wiring.ts`: `ShellNotify`, a Lit `ReactiveController`, owns what `sw-app.ts` held for CR-018:
- the notification summary (subscribed to `notifyStore` on connect; unsubscribed and `notifyStore.stop()` on disconnect);
- the rule-alert fallback count and its poll (`poll(mode, chromeless)`: kiosk / Lovelace card view nothing, demo 0, no session null,
  the summary first, `rules/alerts?unacked=true` only when it does not answer, a failed read keeps the last count);
- the badge (`badge(gated)` = `badgeOf(...)`), `startLive(mode, embedded)` (`notifyStore.start()` for api / demo outside the card view);
- the center's open state, focused row and door confirmation (`show` / `hide` / `dismiss`);
- the push deep links (`takeLink(hash)`: `#/doors/<id>?confirm=<nid>` and `#/notifications/<id>`; `takePending(mode)`; `routeChanged()`
  with the "keep open across the shell's own fallback navigation" flag).

Every state change requests a render only when the value really changed (`Object.is`, the `@state()` rule the fields followed), so
the shell renders exactly as often as before. The store and the rules API are passed in by the shell (`NotifyEnv`), which keeps the
controller free of browser-only imports and lets a Node unit spec drive it.

`shell/sw-app.ts` keeps what is not the notifications' own: the user menu, the tab-order dialog and the overlay history entry the
center shares with them (`openCenter` / `closeCenter` / `pushOverlay` / `popOverlay`), the avatar's accessible name (`userLabel`, it
reads the controller) and the `pollAlerts()` method the 60 s `shellPoll` calls (unit-shell-timers pins that line). Removed from the
shell: 8 fields (`alertCount`, `centerOpen`, `centerFocus`, `centerConfirm`, `notifySummary`, `stopNotify`, `pendingCenter`,
`keepCenterOnce`) and the imports `parseDoorConfirmLink`, `NotifySummary`, `badgeOf`, `parseNotificationLink`. `sw-app.ts`
3,448 -> 3,415 lines.

Order notes (checked, no observable difference): the store subscription now starts inside `super.connectedCallback()` (controllers'
`hostConnected`) instead of a few statements later in the same call, and ends inside `super.disconnectedCallback()`; the store's
`subscribe` does not call back synchronously and `stop()` only ends the live events, so nothing is read or rendered differently.

New spec `frontend/tests/unit-shell-extract-2440.spec.ts` (Node): the controller with a fake host and a fake store / rules API
(render requests only on change, poll branches, badge, row and door deep links, pending and keep-once rules, hide / dismiss), plus
the shell's source wiring and the router comment.

## Tests actually run

Workstation (C:/cloude/smplwise-g10, head 4aeefad39):
- `npx tsc --noEmit -p tsconfig.json`: 0 errors.
- `playwright.unit.config.ts --workers=1`: unit-shell-extract-2440, unit-shell-timers, unit-modal-stack-guard-2442,
  unit-modal-stack-2441, unit-notify-center, unit-notifications, unit-shell-lazy-2436, unit-perf-home-devices,
  unit-user-menu-sections: **131 passed**.

Runner (own folder `~/work/g10-shellextract`, `nice -n 10`; a release gate was running at the same time, load 50-70):
- Pass 1, head 4aeefad39: `tsc -p tsconfig.json` rc 0; `npm run typecheck` (tests + scripts configs) rc 0; `npm run lint` rc 0;
  `vite build` rc 0; `bundle-budget --enforce` OK; `unused-exports --enforce` OK (baseline 56 / 88 unchanged);
  `lazy-tags-check` OK.
- Bundle, entry chunk: base 85b243455 raw 3,609,478 B / gzip 1,068,927 B; this branch raw 3,610,343 B / gzip 1,069,330 B
  (+865 B raw, +403 B gzip: the controller's class and accessors). Budget gzip 1,102,000 - within.
- Shell / navigation / modal / notification evidence, `playwright.config.ts` (desktop, tablet, mobile), `--workers=2`:
  evidence-shell, evidence-notifications, evidence-notify-live, evidence-route, evidence-area-nav, evidence-nav-size,
  evidence-shell-hidden-poll-2439, modal-stack-b-2442, layout-overlay-no-shift, evidence-menu-opaque, evidence-media-polish,
  evidence-system-update, evidence-second-factor, evidence-wiskey-embed: **328 passed, 6 failed, 215 skipped** (549).
  The 6 failures were all `evidence-menu-opaque.spec.ts:299` (3D view chip translucent in domus / tesla / crystal light, desktop +
  mobile): the known 2.43.8 gate red fixed on the train by d6c21c7be, not in this branch's base yet. The skips are the specs'
  own project / backend conditions (no developer backend on the runner).
- Then merged `origin/release/2438-train` 2.43.8 (4679923b4, brings d6c21c7be) -> 8b7a85491.
- Pass 2, all `tests/unit-*` specs (`playwright.unit.config.ts`, node mode, --workers=2), run on 4aeefad39 (the merge only adds
  the plan-3d fix and the rebuilt add-on assets): **4872 passed, 6 failed, 8 skipped**. Failures, none in the shell:
  5 x `unit-session-me-failure-2435.spec.ts` ("Cannot navigate to invalid URL": a page spec using `page.goto('./#/...')`, which the
  unit config's page-spec detector does not recognise, so it runs without a baseURL - harness, not product);
  1 x `unit-service-identity.spec.ts:218` ("Unable to capture screenshot" under load 56) - re-run alone: 14 passed.
- Pass 3, head 8b7a85491: `tsc` rc 0, `vite build` rc 0, `bundle-budget --enforce` OK (gzip 1,069,324 B);
  unit-shell-extract-2440 + unit-shell-timers: 26 passed; `evidence-menu-opaque.spec.ts:299` all projects: **16 passed, 8 skipped**.

## NOT_RUN

- Runner entry check (`branch_check.sh`): not queued (the 18.11 evening rule; push only).
- Pixel suites: not run (no CSS or markup change; the controller renders nothing).
- Evidence specs that need a developer backend skipped themselves (215 in pass 1).
- The page-mode unit specs (`SW_UNIT_PAGES=1`) were not run; `unit-session-me-failure-2435` belongs there (see pass 2).
- The full pass-1 evidence set was not repeated on 8b7a85491 (the merge changed only `map/sw-plan-3d.ts` in `frontend/src`).

## Follow-ups (not done here)

- `playwright.unit.config.ts` PAGE_SPEC does not detect `page.goto('./#/...')`: `unit-session-me-failure-2435.spec.ts` fails in
  node mode. Recommendation: extend the detector to relative `./` addresses (one-line harness fix, own small branch).
- Further shell extractions (the overlay history entry: `pushOverlay` / `popOverlay` / `pendingRun` / `onPopState`; the permissions
  toast) are outside this row; candidates for the complexity programme.
