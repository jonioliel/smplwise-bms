# CR-UI-CONTROLLERS-2440

Code-review batch 16.11, frontend wave 2. Contract: the `pilot/CR-UI-CONTROLLERS-2436` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` (findings 07:F12 controller, helper of D12, component half of D14 / 07:F17).
Base: `origin/release/2437-train` (2.43.7 train). Helpers only; no screen adopts anything here (adoption is wave 3A).

## What and why

1. **`frontend/src/components/toast-controller.ts` (new)** - 07:F12. 39 elements carry a private `flash(text)` with a bare
   `setTimeout`; the copies differ (one never clears the previous timer, so a second message is cut short; one compares the text; none
   stops on disconnect). `ToastController` is a Lit `ReactiveController` with that logic once: `show(text, { tone, ms })`, `clear()`,
   `text` / `tone` / `visible`, ONE timer, restarted by every `show`, stopped on disconnect, `requestUpdate` on every change.
   Default 2500 ms (the most common value); `ms: 0` / `Infinity` keeps the message until cleared. The screen keeps its own markup and
   CSS, so adoption moves no pixel. Nothing imports it yet.

2. **`frontend/src/components/sw-table.ts`** - 07:F17. Rows were tab stops only with `focus-rows`, which 1 of 29 tables sets. Now a
   table is keyboard-operable (tab stop per row, Enter / Space fire `row-select`) when
   `focus-rows` is set **or** a `row-select` listener is registered on the element itself (`@row-select=${...}` in a Lit template
   does exactly that) and `no-focus-rows` is not set. The element counts those listeners by overriding
   `addEventListener` / `removeEventListener`.
   - Chosen over "default `focusRows = true`": 11 of the 29 tables have no `row-select` listener (audit lists, parity, sync tables);
     they would have gained tab stops that do nothing. With listener detection they are unchanged.
   - Tables that gain row tab stops (17 sites; the 18th listener site, `system-devices`, already had `focus-rows`):
     `explore-entities` (2), `investigate-cases` (2), `investigate-events` (3), `investigate-ha-events`, `system-access` (3),
     `system-local-users`, `wiskey-events`, `wiskey-schedules`, `wiskey-stations`, `tickets/vendor-accounts` (2).
   - `no-focus-rows` (new attribute) is the opt-out for a table whose cells already hold the row's link or button. No screen sets it
     here; the screen half of D14 (`CR-A11Y-ROWS`) decides per table.
   - Behaviour change, as the plan row states: **the tab order gains the rows** of those tables. Mouse behaviour and the look are
     unchanged; the focus ring is the existing `tbody tr:focus-visible` rule (keyboard focus only). No CSS was touched.

3. **`frontend/src/components/sw-state-panel.ts`** - 07:F17. New boolean property `forbidden`: while `state` is `error`, the
   caller says the answer was a refusal (`.forbidden=${err instanceof ApiError && err.status === 403}`) and the panel shows the lock
   preset without the retry button. The Hebrew regular expression on the hint stays as the fallback, exactly as before. No caller
   sets the property yet.

## Not done here, on purpose

- **`frontend/src/components/confirm-dialog.ts` and its unit ("helper of D12")**: the helper already exists on
  `pilot/CR-CONFIRM-DIALOG-2438` (`confirmDialog(...)` + `i18n/confirm-dialog.ts` + `unit-no-native-dialogs.spec.ts` +
  `evidence-confirm-dialog-2438.spec.ts`) and that commit is inside `pilot/DIALOG-DRAWER-ONE-2439`, which owns the dialog / drawer /
  modal components in this batch. Writing a second file of the same name on this base would only produce an add/add conflict, so
  this branch does not create it. Nothing is lost: the D12 helper lands with DIALOG-DRAWER-ONE; `CR-CONFIRM-ADOPT` is held until then.
- No screen adoption of the toast controller (plan: "when the screen is next edited").

## Resolved file list

- new `frontend/src/components/toast-controller.ts`
- `frontend/src/components/sw-table.ts`
- `frontend/src/components/sw-state-panel.ts`
- new `frontend/tests/unit-toast-controller.spec.ts`
- `frontend/tests/layout-a11y-295.spec.ts` (three tests appended, desktop only)
- `docs/changes/CR-UI-CONTROLLERS-2440.md`

Outside my rows: none.

## Pixels

No (plan row). No CSS rule was added or changed; `tabindex` on a row draws nothing until it is focused from the keyboard.
The pixel gate was NOT run locally (runner only) - it must stay green as the proof.

## For the combined entry check / closing chain

- A spec that counts Tab presses across a screen with a listened-to `sw-table` now meets the rows on the way. None was found by
  grep (`focus-rows`, `tr[tabindex]` in `tests/`), but only the full suite on the runner can prove it.
- A `row-select` listener on an ANCESTOR of the table (the event bubbles) is not seen by the element; such a table keeps today's
  behaviour and needs `focus-rows`. No such site was found in `src/`.
- A listener added BEFORE the element is defined (a template that renders `<sw-table>` before `sw-table.ts` has loaded) is not
  counted either. Every screen that uses the table imports it statically, so this does not happen today.

## Tests actually run

Workstation, 16.11.2026 (16 GB, under 1 GB free for most of the session, many agents running `tsc` at once):

- `npx tsc --noEmit` (whole frontend, `src` + `tests`): **clean, 0 errors** (43 min wall time under that load). The first run found
  two errors in the new `addEventListener` override (a `null` listener); fixed, second run clean.
- `npx playwright test -c playwright.unit.config.ts tests/unit-toast-controller.spec.ts --workers=1`: **9 passed**
  (replace, same-text replace, expiry, per-call and per-controller durations, 0 / Infinity, clear, disconnect, `onChange`, the real clock).

NOT_RUN:

- `tests/layout-a11y-295.spec.ts` - the three tests added here (`keyboard rows and the forbidden flag`) and the existing ones. They
  need a build or a dev server plus a browser; free memory stayed under the 1.5 GB floor of the batch brief (0.07 - 0.6 GB) for the
  whole session, so no build and no browser run was started. The tests are type-checked only. **First real run: the combined
  entry check.**
- "confirm helper unit" of the plan row: not written here (see "Not done here").
- The pixel gate and every other evidence / layout spec: runner only.
