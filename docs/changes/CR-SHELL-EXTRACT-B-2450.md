# CR-SHELL-EXTRACT-B-2450 - two more shell controllers (overlay history, permissions notice); the /me first-load note translated

Branch `pilot/CR-SHELL-EXTRACT-B-2450` (2.45.0 row, owner N5 on 19.11: "further `sw-app.ts` extracts approved"). Base
`origin/release/2440-train` (e9d17b5ab). Same pattern as CR-SHELL-EXTRACT-2440 (`shell/notify-wiring.ts`): Lit `ReactiveController`s
in `shell/`, the browser and session calls passed in by the shell, a Node unit spec with a fake host.

## 1. The overlays' history entry - `shell/overlay-history.ts` (`NavOverlay`)

Review M4 / CR-013, behaviour unchanged. While the phone sheet, the tab-order dialog or the notification center is open, one history
entry (same address, `swOverlay: true`) stands for it, so Back closes the overlay instead of leaving the screen.

Moved out of `sw-app.ts`: the fields `overlayEntry` and `pendingRun`, the `popstate` listener (`onPopState`, now added in
`hostConnected` and removed in `hostDisconnected`), and the bodies of `pushOverlay` / `popOverlay` / the shared half of
`navigateFromOverlay` and `runFromOverlay`. The controller has `push()`, `pop()`, `forget()` (the CR-013 route change: the entry stays
behind the new one) and `leave(then)` (a menu item: drop the overlay's own entry first and run `then` on its `popstate`, or at once
when there is none). The shell passes `window.history`, `window` and `onBack` (what Back on the entry closes: the tab-order dialog,
the center, the menu with focus back on the avatar - the same three statements as before).

The shell keeps what the overlays are and when they open or close; `navigateFromOverlay` (with the HOME-SIMPLE-2420 `me/interface`
write) and `runFromOverlay` remain shell methods and now read `dismissOverlays(); this.overlay.leave(...)`.

Order note (checked, no observable difference): the `popstate` listener is now registered inside `super.connectedCallback()` instead of
the fifth statement after it, and removed inside `super.disconnectedCallback()`. It is the shell's only `popstate` listener besides
`tickets/camera-viewfinder.ts`, which registers when that dialog opens (always later). The fields were plain (not `@state`), so no
render was and none is requested.

## 2. "Your permissions were updated" - `shell/permissions-notice.ts` (`PermissionsNotice`)

T055, behaviour unchanged. Moved out of `sw-app.ts`: `stopPermissions`, `@state permEpoch`, `@state permToast`, `permToastTimer` and
`onPermissionsChanged`. The controller has `follow(mode)` (api / no_access open the /me/ws channel once), `epoch` (the shell still keys
the current screen on it: `keyed(this.perm.epoch, view)`) and `text`. A change runs in the old order: `loadSession()`,
`resetAlarmPresence()`, epoch + 1, the notice's text, its 5 s timer restarted, `sw-permissions-changed` on `window`. Renders are
requested only on a real change (the `@state()` rule). The channel and the timer end in `hostDisconnected` (inside
`super.disconnectedCallback()`, as CR-SHELL-EXTRACT-2440 did for the notification store). The notice's markup and CSS stay in the shell
(`renderPermToast`, `.perm-toast`).

`sw-app.ts` 3,415 -> 3,380 lines.

## 3. Small shell items (REMAINING_WORK_2026-11-18 section B)

**GET /me "first-load error note".** What the item names was already done twice in the base: the "my screen" first read
(`sw-home-personal.ts`, lead question 2 of CR-FE-PROMISES-2442) shows its reason since CR-UI-POLISH-2443 (c48f3e32a), and a failing
first `/me` shows the retry panel since SESSION-DEMO-WS-2435 (`renderRetry`, `data-session-retry`). The gap left: that panel's three
texts were bare Hebrew, so an English interface showed them in Hebrew. They now go through `tr()` (the shell catalogue,
`i18n/msg/shell.ts`) and the English pack has them (`i18n/lang/en/i18n/msg/shell.ts`: "No connection to the server",
"Trying to reconnect…", "Try now", the terms the home screen's pack already uses). Hebrew is unchanged.

**RTL-1.** All nine sites of code-review finding 06:RTL-1 are under `screens/` / `automation-*` / `explore-*` / `investigate-*` /
`system-*` - none in `shell/` or `router.ts`, so none is touched here (another agent owns `screens/*`). A search of `shell/` for the same
kind of fault found one: `.perm-toast` was centred with `inset-inline-start: 50%` + `transform: translateX(50%)`, which is centred
right-to-left only; in a left-to-right interface the notice started at the middle and was pushed half its width further right (off the
edge on a phone). It is now centred by `inset-inline: 0; margin-inline: auto; inline-size: fit-content` - the same place in Hebrew.

## Files

- `frontend/src/shell/overlay-history.ts` (new), `frontend/src/shell/permissions-notice.ts` (new), `frontend/src/shell/sw-app.ts`,
  `frontend/src/shell/notify-wiring.ts` (doc comment only).
- `frontend/src/i18n/lang/en/i18n/msg/shell.ts` (three English texts; outside `shell/` but the shell catalogue's own pack).
- `frontend/tests/unit-shell-extract-b-2450.spec.ts` (new, Node), `frontend/tests/unit-perf-home-devices.spec.ts` (the pinned
  `keyed(this.perm.epoch, view)` line).

## Tests actually run

Workstation (C:/cloude/smplwise-shellb; CPU at 100 % from other agents):
- `tsc --noEmit -p tsconfig.json` rc 0; `tsc --noEmit -p tsconfig.tests.json` rc 0 (head ad7d80c1a).
- `tsconfig.scripts.json` and ESLint: not run locally - the shared workstation `node_modules` (junction to the main checkout) has
  no `eslint` / `typescript-eslint`; both ran on the runner.
- `playwright.unit.config.ts --workers=1`: unit-shell-extract-b-2450, unit-shell-extract-2440, unit-perf-home-devices,
  unit-shell-timers: first run 31 passed / 1 failed (my own centring check matched the word "translateX" in the new CSS comment;
  fixed in 5867e8103), then **49 passed** on 5867e8103.

Runner (own folder `~/work/shellb`, `nice -n 19`, `--workers=2`; the 2.43.9 release gate was running, load 45-65):
- Pass 1, head ad7d80c1a: `tsc -p tsconfig.json` rc 0; `npm run typecheck` (tests + scripts) rc 0; `npm run lint` rc 0;
  `vite build` rc 0; `bundle-budget --enforce` OK; `unused-exports --enforce` OK; `lazy-tags-check` OK.
- Pass 1 unit set (12 shell / notification / modal-stack / user-menu / home-personal specs): 165 passed, 1 failed (the same
  comment-word check, fixed in 5867e8103).
- Pass 1 evidence, `playwright.config.ts --project=desktop --project=mobile`, 22 files (the CR-SHELL-EXTRACT-2440 set plus the
  Back-button / overlay specs evidence-mobile-scroll, evidence-mobile-structure, evidence-media-screens, evidence-map-improvements,
  evidence-automations-list, evidence-home-edit-drawer-2351, the permissions notice evidence-camera-scope and the /me failure
  page spec unit-session-me-failure-2435): **418 passed, 14 failed, 134 skipped**. The failures:
  11 x evidence-mobile-scroll (mobile) - "Failed to fetch dynamically imported module /src/api/media-screens-mock.ts": the spec
  needs the Vite dev server, not the preview (harness); 1 x evidence-automations-list:1221 (mobile, screenshot timeout under load);
  evidence-nav-size:86 and evidence-shell-hidden-poll-2439:23 (desktop).
- Pass 2, head 5867e8103: unit set **166 passed**; `vite build` rc 0; evidence-nav-size + evidence-shell-hidden-poll-2439 (desktop,
  `--workers=1`) **7 passed**; evidence-automations-list "no product name" (mobile, alone) **2 passed**; evidence-mobile-scroll on a
  Vite dev server of the head (mobile) **11 passed**. Base e9d17b5ab, same two desktop specs: 7 passed. So all 14 pass-1 failures
  were load / harness, none reproduced.
- Skips are the specs' own project / backend conditions (no developer backend on the runner); evidence-camera-scope's notice test
  needs the developer backend and was among them, so the permissions notice ran only through the unit spec.
- Runner folders removed afterwards (worktrees, the `node_modules` symlinks, the dev server this run started); logs kept in
  `~/work/shellb-out`, `~/work/shellb-out2`.

## NOT_RUN

- Runner entry check (`branch_check.sh`): not queued (gates have priority today; the brief says push only).
- Tablet project: not run (the brief asks desktop + mobile for these specs).
- Pixel suites: not run. CSS change is the `.perm-toast` centring only; the notice appears only after a live
  `permissions_changed` and is in no baseline. No baseline refreshed.
- The English interface with the retry panel was not rendered in a browser (unit source check + the English pack only).
- The full `tests/unit-*` run and the full evidence suites: not run (targeted sets only).

## Open questions (recommendation first)

1. The English texts of the /me retry panel: a) "No connection to the server" / "Trying to reconnect…" / "Try now" (recommended:
   the home screen pack's wording); b) other wording from the glossary owner.
2. The two items from REMAINING_WORK section B were already done in the base (the "my screen" note, the /me retry panel);
   recommendation: close the "GET /me first-load error note" item with this branch (the translation was the only gap).
