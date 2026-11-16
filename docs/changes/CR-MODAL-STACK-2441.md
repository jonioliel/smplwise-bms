# CR-MODAL-STACK-2441 - one stack for the dialog, the modal drawer and the sheet

Branch `pilot/CR-MODAL-STACK-2441`. Row `pilot/CR-MODAL-STACK-2436` of `private/code-review-2026-11-13/MASTER_PLAN.md` (finding
07:F13). **Base: `origin/pilot/DIALOG-DRAWER-ONE-2439` (e7a9fcf52), not `origin/main`** - that branch rewrites `sw-dialog.ts` and
`sw-drawer.ts`; this one must board after it.

## Why

The three modal primitives each listen for Escape on their own: `sw-dialog` and `sw-sheet` on the window, the modal `sw-drawer` on
the document in the capture phase. Only dialog-over-dialog was coordinated (A11Y-POLISHED-2342, a private `OPEN_STACK`), and a
dialog inside a drawer (a walk of the drawer's content). Everything else answered one key press twice:

- a confirmation (`sw-dialog`) over an `sw-sheet` - `screens/devices-area.ts` does this - closed the sheet too;
- an `sw-sheet` inside a modal drawer closed together with the drawer;
- with a dialog open beside a sheet, the sheet's Tab trap pulled the focus out of the dialog on every Tab.

The "deep active element" walk was written three times and the Tab wrap twice.

## What

New `frontend/src/components/modal-stack.ts` (no imports, no DOM at load time):

- `pushLayer(layer, { traps? })`, `removeLayer(layer)`, `topLayer()`, `isTopLayer(layer)` - the open layers, oldest first. A layer
  that left the page without closing is skipped (`isConnected`).
- `takesEscape(layer, event)` - true for the top layer, once per key event. The "once" matters: the top layer closes inside its
  listener and leaves the stack before the next listener of the same event runs (the element's update is a microtask), so the
  layer below would find itself on top and close on the very same press. This was a latent fault of `OPEN_STACK` too, whenever the
  upper dialog's listener ran before the lower one's.
- `holdsTab(layer)` - the top layer among those that trap Tab (an inline sheet does not trap and does not take the trap away from a
  modal layer under it).
- `deepActive()`, `trapTab(e, focusables, active, inside)`, `restoreFocus(opener, now?)` - the three helpers, once.

Wired in:

| File | Change |
|---|---|
| `sw-dialog.ts` | `OPEN_STACK` is gone; `track()` pushes / removes on the shared stack at the same three places as before. Escape: `takesEscape`. Tab: only while `holdsTab`; the wrap itself is the shared `trapTab` (the dialog's own rule, moved). |
| `sw-drawer.ts` (modal only) | enters the stack where it calls `showModal()`, leaves where it closes or is disconnected. Escape (the capture listener): the walk for an open confirmation / `data-nested-open` menu stays as it was, then `takesEscape`. The native `cancel` path asks `isTopLayer`. The key is still always `preventDefault`ed. The non-modal context drawer never handled Escape and is not in the stack. |
| `sw-sheet.ts` | every open sheet is a layer (`traps` is false for the inline layout). Escape: `takesEscape`, and `preventDefault` only when it takes the key. Tab: only while `holdsTab`; the wrap is the shared `trapTab`. |

`deepFocusables` stays in `sw-drawer.ts` (three other files import it from there).

## Behaviour

A single open layer: unchanged (it is always the top one) - covered by the old tests of both specs and one new test.

Nested (the row's stated change - the top layer takes the key):

| Case | Before | Now |
|---|---|---|
| dialog over a sheet, Escape | both close | the dialog closes; a second press closes the sheet |
| sheet inside a modal drawer, Escape | both close | the sheet, then the drawer |
| sheet opened over a dialog, Escape | both close | the sheet, then the dialog |
| modal drawer opened from a dialog, Escape | both close | the drawer, then the dialog |
| dialog over a dialog, the upper one's listener first | both close (latent) | the upper one only |
| dialog beside a sheet, Tab | the sheet pulls the focus back into itself | stays in the dialog; after it closes the sheet traps again |
| inline sheet inside a dialog / sheet, Escape | both close | the inline panel first |

Browser-tested rows: 1, 2, 3 and 6 (and dialog over dialog, the old test). Rows 4, 5 and 7 follow from the same rule and are covered
by the unit spec of the stack only.

One small difference in the shared `trapTab` for the sheet: an edge also counts when the focus sits in the edge element's shadow
root (the dialog's rule). The sheet compared by identity only; its focusables are already the innermost elements, so no case is
known where this differs.

Not done here (the finding's last sentence, not in the row): the 42 files that draw their own `role="dialog"` and
`a11y-keys.ts modalKeydown` do not join the stack. A hand-built modal above one of the three primitives still shares the key with
it.

## Files outside the row's list

`tests/unit-a11y-polished-lint.spec.ts` and `tests/unit-dialog-toplayer-2381.spec.ts` pinned the text `OPEN_STACK` in
`sw-dialog.ts`; each got its two assertions re-pointed at `takesEscape` / the import. Nothing else in them changed.

## Tests

Workstation, 2026-11-16, one worker.

| Run | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `playwright.unit.config.ts`: new `unit-modal-stack-2441` (9) + `unit-a11y-polished-lint`, `unit-dialog-toplayer-2381`, `unit-polish4-shared`, `unit-menu-lint` | 43 passed |
| `a11y-polished-2342` (3 old + 4 new) + `a11y-dialog-focus-2310` (2 old + 2 new), desktop | 11 passed |
| the same, mobile | 11 passed |
| the 6 new browser tests against the BASE components (the three component files stashed), desktop | 5 failed, 1 passed - the five nested tests fail without the change, the single-layer test passes with and without it |
| neighbours of the touched area, desktop: `evidence-dialog-toplayer-2381`, `evidence-confirm-dialog-2438`, `unit-devices-tiles` (the modal drawer: trap, Escape, backdrop) | 17 passed, 2 skipped |

The browser runs used the Vite dev server of this worktree on its own port (`SW_BASE_URL=http://127.0.0.1:5241/`), not a build:
no `npm run build` was run.

NOT_RUN: the tablet project; every other spec (the full functional and pixel suites are the entry check, which the lead queues);
the built bundle; a real screen with a sheet and a confirmation together (`screens/devices-area.ts` was read, not opened - the
tests mount throwaway elements on the style guide, as both specs always did); the Android back gesture on a modal drawer
(`cancel` without a key press); a physical phone.

## Pixels to refresh

None. No style, markup or attribute changed.

## Rollback

Revert the branch's commit. No data, migration or setting.
