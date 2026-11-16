# CR-DUP-NVR-BATCH-2440 - one shell for the two NVR batch dialogs

Branch `pilot/CR-DUP-NVR-BATCH-2440`, based on `origin/release/2437-train` at `6c5541485` (frontend base of batch -2440).
Plan row: `pilot/CR-DUP-NVR-BATCH-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md` (06:DUP-3).
Behaviour change: none. Pixels: none expected.

## What and why

`screens/nvr-camera-batch.ts` (the multi-camera SVC dialog and the progress / result of every batch) and `screens/nvr-encoding-batch.ts`
(the multi-camera encoding dialog) each carried their own copy of the checklist's look, of the windowed list and of the rule for a start
whose answer was lost (210 identical lines in the review). Every polish pass since (R5-LIVE-297, CAMADMIN-POLISH-2331, A11Y-POLISHED-2342,
DARK-REVIEW-2342) had to be written twice.

`frontend/src/screens/nvr-batch-shell.ts` (new) now holds the shared part:

- `nvrBatchShellCss`: the tools row, the count, the windowed list in its well (`.vl`, `.space`), the 44 px checkbox row (`.sel`, `.box`,
  `.nm`, `.meta`, `.ltr`) with its hover / press / chosen / unchecked-edge rules, and the message well (`.msg`);
- `NvrBatchShell` (the element both dialogs extend): the list's state (`listTop`, `viewH`), `measureList()`, `resetScroll()`,
  `onListScroll`, `windowRows()` (the rows in view inside the padded `.space`), and `emit()`;
- `takeActiveAfterLostAnswer(err, take)`: a start (or an undo) is sent once; after a lost answer (no answer or a 5xx) the active batch is
  read and handed over, the request is never repeated;
- `errorShape(err, withDetails?)`: what the error lines read from a failed request;
- `CHECK`: the tick glyph.

The two dialogs keep what is their own: their rows, steps, words, the `.vl` element with its own `data-nvr-batch-list` /
`data-nvr-enc-list` hook, and the call that applies the change. `nvr-camera-batch.ts` 919 -> 726 lines, `nvr-encoding-batch.ts` 753 -> 561.

The review's wording was "styles + run loop". Only the multi-camera dialog has a run loop (the poll, "עצור", the result, the undo); the
encoding dialog hands its batch to it (`encoding-started`). So the loop stays where it is, and what the two really shared in logic - the
lost-answer rule - is the shared function.

## How "identical" was kept

- **DOM**: unchanged (elements, attributes, `data-*` hooks, texts, the whitespace inside `.vl`).
- **CSS**: a script compared, per selector and media query, the final declarations of each dialog's old style sheet with
  `shell + own rules`: identical for the multi-camera dialog (55 selectors); for the encoding dialog (44 selectors) the only difference is a
  dropped `.box { border-color: var(--sw-border-strong) }`, which repeated the colour of the `border` shorthand of the same selector.
  Declarations that were overridden later in the same file by the same selector are written once, with their final value (for example the
  encoding dialog's 20 % chosen-row tint, replaced by 26 % a few lines below; the SVC dialog's `.box { background: transparent }`). Each
  dialog's own rules follow the shell, so a rule that differs between the dialogs (the list's height, the disabled row and box, the encoding
  count, `.meta` clipping, `user-select`, the chosen row's hover) still wins exactly as before.
- **Behaviour**: the same requests in the same order. In the lost-answer path the hand-over (`adopt(await full(a))` / `handOff(a)`) still
  runs inside the guarded read, so a failure there still falls through to the error line. `errorShape` carries `details` only at the two
  call sites that did (the SVC start and the undo).

## Resolved file list

New: `frontend/src/screens/nvr-batch-shell.ts`.
Changed: `frontend/src/screens/nvr-camera-batch.ts`, `frontend/src/screens/nvr-encoding-batch.ts`.

## Outside my rows

Two source-reading unit specs asserted that the unchecked-box edge rule
(`.sel:not([aria-checked='true']) .box { border-color: light-dark(...) }`) is written in BOTH dialog files. The rule now lives once, in
the shell, so one line in each spec reads `screens/nvr-batch-shell.ts` instead:

- `frontend/tests/unit-a11y-polished-lint.spec.ts` (the light-scheme marks),
- `frontend/tests/unit-dark-polish-beds.spec.ts` ("the modelled values are the ones in the screens").

The assertions themselves (the regular expression and the exact text) are unchanged.

`unit-a11y-polished-lint.spec.ts` also lists the shell in its `POLISHED` files, so the rules that covered the moved CSS (no bare state
colour as text ink, the tab-list rule) still cover it.

## Tests actually run (workstation)

Node 24, Windows; browser specs against the Vite dev server of this worktree (`SW_BASE_URL=http://127.0.0.1:5442/`), `--workers=1`.

| What | Result |
|---|---|
| `npx tsc --noEmit` | clean (0 errors) |
| CSS comparison script (old sheet vs `shell + own`, per selector and media query) | multi-camera dialog identical (55 selectors); encoding dialog identical but for the one redundant `.box` `border-color` (44 selectors) |
| `playwright.unit.config.ts`: `unit-nvr-batch-logic`, `unit-nvr-encoding-logic`, `unit-nvr-h264-preset`, `unit-nvr-verify-report`, `unit-a11y-polished-lint`, `unit-dark-polish-beds` | **59 passed**; the last two again after the shell joined the `POLISHED` list: **13 passed** |
| desktop: `evidence-nvr-cameras-batch.spec.ts`, `evidence-nvr-encoding-batch.spec.ts`, `layout-nvr-cameras-batch.spec.ts` (132 checks, 0 findings), `layout-nvr-encoding-batch.spec.ts` (320 checks, 0 findings), `evidence-nvr-h264-bulk.spec.ts`, `evidence-nvr-verify-report-2361.spec.ts` | **37 passed** (25 minutes on the loaded workstation) |

## NOT_RUN

- The full frontend suite, the pixel suites (`pixel-nvr-encoding-batch.spec.ts`, `pixel-dialog-toplayer-2381.spec.ts`), the tablet and
  mobile projects (runner only; no entry check in this batch).
- `evidence-multi-nvr.spec.ts`, `r5-live-shoot.spec.ts` (wider sweeps that pass through these dialogs).
- `npm run build` (not needed by the row).

## Pixels to refresh

None expected (same DOM, same computed styles). No PNG was regenerated or committed. `pixel-nvr-encoding-batch.spec.ts` and
`pixel-dialog-toplayer-2381.spec.ts` are the runner's proof.
