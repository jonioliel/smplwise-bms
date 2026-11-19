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

`sw-app.ts` 3,415 -> 3,385 lines.

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

See the end of this note (filled in after the runs).
