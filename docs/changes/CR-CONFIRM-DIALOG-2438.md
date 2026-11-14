# CR-CONFIRM-DIALOG-2438 - the system's own confirmation dialog instead of the browser's confirm()

Branch `pilot/CR-CONFIRM-DIALOG-2438`, based on `origin/main` (0a8fb55e1). Owner decision Q-SYS-6 / O7 a; code review findings
06:CMP-1 and 07:F18 (`private/code-review-2026-11-13/`).

## What

- New `frontend/src/components/confirm-dialog.ts`: `await confirmDialog({ body, heading?, confirmLabel?, cancelLabel?, danger? })`
  returns `true` / `false`. It opens the existing `sw-dialog` unchanged (no restyle - the visual unification of dialogs and drawers
  is a separate, later task). Keyboard as the native box: the confirm button has the focus, Enter confirms (Enter on the focused cancel
  button cancels), Escape cancels, and no other key reaches the page while it is open (Tab stays inside through sw-dialog's focus trap).
  The ✕ and the backdrop cancel. RTL and the skin come from the page; focus returns to the opener. When the control that asked sits
  inside a modal `<dialog>` (a modal sw-drawer), the dialog is attached inside it, since everything outside a modal is inert.
- New `frontend/src/i18n/confirm-dialog.ts`: heading / OK / Cancel in he, en, ar, ru (ar, ru marked as initial translation).
- Every native call in `frontend/src` replaced, same question text (Hebrew literals or the same i18n keys), 16 call sites in 10 files:
  `components/sw-passkeys.ts`, `generator/gen-routing.ts`, `maintenance/emergency-config.ts`, `screens/explore-plan-editor.ts` (6),
  `screens/system-alarm.ts`, `screens/system-local-users.ts` (3), `temperature/detail.ts`, `temperature/wizard.ts`,
  `tickets/settings-locations.ts`, `tickets/settings-rules.ts`. Removals / deletes use the danger button; restore-structure and the
  alarm bypass pairing use the primary one; "passkey only" is danger when turning it on.
- About the "~41 sites": the review counted every `confirm(` text match. Most are methods named `confirm()` of components that
  already use sw-dialog (media-bulk-dialog, restarts-card, door dialogs, wiskey screens, ...). Native calls were 16; there was no
  native `alert()` or `prompt()` (`ev.prompt()` in `pwa/register.ts` is the install prompt, not a dialog).
- Guard: `frontend/tests/unit-no-native-dialogs.spec.ts` reads frontend/src and fails on any `confirm(` / `alert(` / `prompt(` call,
  bare or through window / globalThis / self / top / parent (methods of the same name and comments are ignored; the guard tests
  its own pattern).
- Specs that answered the native box with `page.once('dialog')` now click the system dialog through
  `tests/confirm-dialog-helper.ts`: `evidence-editor-move.spec.ts` (2 places), `evidence-shared-space-stations.spec.ts` (2 places).
- New `tests/evidence-confirm-dialog-2438.spec.ts` (mocked backend, desktop): same text, sw-dialog, RTL, OK focused, Escape / cancel /
  ✕ cancel with no DELETE, Enter confirms once, no native dialog event.

## Not changed

- `gen-routing.ts` is in AUDIT30-COMBINED-2435 (appendix A); the only edit there is one line in `reset()` and one import after line 15,
  away from that branch's hunks. No other touched file is held by it.
- No pixel baseline contains a native box, and the dialog only appears after a click: no baseline refresh.

## Tests

Run on the workstation (2026-11-14):
- `npm run build` (tsc --noEmit + vite build): passed. `npx tsc --noEmit` again after the last spec edit: exit 0.
- `npx playwright test -c playwright.unit.config.ts tests/unit-no-native-dialogs.spec.ts --workers=1`: 3 passed.
- `npx playwright test tests/evidence-confirm-dialog-2438.spec.ts --project=desktop --workers=1` (preview of the build): 1 passed.

NOT_RUN locally (live backend specs; the runner entry check runs them):
- `evidence-editor-move.spec.ts`, `evidence-shared-space-stations.spec.ts` (updated to answer the system dialog).
- The full suites and pixel runs (no baseline change expected).
