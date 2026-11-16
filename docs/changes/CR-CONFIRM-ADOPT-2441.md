# CR-CONFIRM-ADOPT-2441 - D12 adoption: nothing left to convert (verification only)

Branch `pilot/CR-CONFIRM-ADOPT-2441`, based on `origin/pilot/DIALOG-DRAWER-ONE-2439` (e7a9fcf52). Code-review row
`pilot/CR-CONFIRM-ADOPT-2436` (D12 adoption; 06:CMP-1, 07:F18; owner decision O7 a) in
`private/code-review-2026-11-13/MASTER_PLAN.md`.

## Finding

The row is already satisfied on the base. No source file changed on this branch; this note records the check.

- The shared dialog `frontend/src/components/confirm-dialog.ts` exists on the base: `origin/pilot/CR-CONFIRM-DIALOG-2438`
  (6f0182a2b) is an ancestor of e7a9fcf52, so no merge of that branch was needed.
- CR-CONFIRM-DIALOG-2438 did the helper AND the adoption in one branch: every native call in `frontend/src` (16 call sites in
  10 files) already goes through `confirmDialog()` with the same Hebrew text / the same i18n keys:
  `screens/explore-plan-editor.ts` (6), `screens/system-local-users.ts` (3), `screens/system-alarm.ts`,
  `components/sw-passkeys.ts`, `generator/gen-routing.ts`, `maintenance/emergency-config.ts`, `temperature/detail.ts`,
  `temperature/wizard.ts`, `tickets/settings-locations.ts`, `tickets/settings-rules.ts`.
- The other files the row lists never held a native call. Checked at `origin/main` before the helper branch (0a8fb55e1) and on
  the base: `plan-studio-panel.ts`, `plan-package-dialog.ts`, `access-external.ts`, `home-site-off.ts`,
  `schedule-entity-picker.ts`, `schedule-lowering-dialog.ts`, `system-door-blocks.ts`, `system-doors.ts`,
  `system-security-wiskey-managed.ts`, `system-security-wiskey.ts`, `wiskey-person-actions.ts`, `wiskey-station-people.ts`
  (and `wiskey-bulk-people.ts`) only have a method or an interface member named `confirm()` that belongs to a component which
  already asks in an `sw-dialog`. The review's "41 places" counted every `confirm(` text match.
- The lint-style guard the row asks for exists: `frontend/tests/unit-no-native-dialogs.spec.ts` fails on any native
  `confirm(` / `alert(` / `prompt(` in `frontend/src` (bare or through window / globalThis / self / top / parent).
- Specs: no spec answers a native box any more. The two remaining `page.on('dialog')` handlers
  (`evidence-confirm-dialog-2438.spec.ts`, `evidence-maskui-295.spec.ts`) only count native dialogs to prove none opens.
- Outside `frontend/src` (frontend html / public, add-on, backend html / js) there is no native call either.

## Open against the row (for the lead)

- The row's test column says "evidence spec per adopted screen". On the base the system dialog is exercised by
  `evidence-confirm-dialog-2438.spec.ts` (local users: text, RTL, focus, Escape / cancel / close, Enter), by
  `evidence-editor-move.spec.ts` and `evidence-shared-space-stations.spec.ts` (plan editor, live backend). The other adopted
  sites (passkey-only switch, generator routing reset, emergency contact delete, alarm bypass pairing, temperature clear /
  remove, tickets locations / rules remove) have no evidence spec that opens the dialog. Not added here: an evidence spec
  needs `npm run build` + preview, which the evening brief keeps off the workstation unless the row needs it, and the
  conversion itself is not part of this branch. A follow-up can add them and run on the runner.

## Tests

Run on the workstation (2026-11-16), on the base tree (e7a9fcf52 + this note):
- `npx tsc --noEmit`: exit 0.
- `npx playwright test -c playwright.unit.config.ts tests/unit-no-native-dialogs.spec.ts --workers=1`: 3 passed (the guard finds no
  native call in `frontend/src`).

NOT_RUN:
- Evidence specs (`evidence-confirm-dialog-2438`, `evidence-editor-move`, `evidence-shared-space-stations`): nothing they cover
  changed here and they need a build + preview or the live backend.
- Full suites, pixel runs, runner entry check (the lead queues it).

## Pixels to refresh

None (no source change).
