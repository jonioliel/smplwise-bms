# CR-EVENTS-TABLE-2443: the review-window table styles its cells; one severity badge mapping

Branch `pilot/CR-EVENTS-TABLE-2443`, cut from `origin/release/2438-train` at `5bcea468d` (merge of FIX-2438-REDS).
Code review 2026-11-13: 06:EVT-3, 06:INFILE-1 (severity badge part). MASTER_PLAN row `pilot/CR-EVENTS-TABLE-2436`;
owner decision O17 = a (fix, small visual change, new baseline); lead decision L13 (the one correct severity mapping).

`pilot/CR-A11Y-ROWS-2443` (`8cde23d51`, same base) does not touch `screens/investigate-events.ts` (its diff covers
explore-sites, investigate-incidents, schedule-table-view, system-notices and the new `activate-keys.ts`), so the two branches
cannot conflict; nothing of its `activateKeydown` wiring is in this file.

## What changed (`frontend/src/screens/investigate-events.ts`, `investigate-events-logic.ts`)

1. **06:EVT-3 - the "חלונות" (review windows) table.** `sw-table` renders cells inside its own shadow root, so the screen
   stylesheet's `.ty`, `.sub` and `.spot` never reached the window columns: the title had no weight or tone dot, the count, the
   types line, the camera list and the date were plain body text, the spotlight label had no accent. The window columns now use the
   inline constants the raw list (`apiColumns`) already uses: `C_TITLE` + `C_DOT` (tone dot), `C_SUB`, `C_TIME` for the time, and a new
   `C_SPOT` for the spotlight label. The `.ty`/`.sub`/`.spot` rules stay: the window drawer (light DOM of the screen) uses them.
2. **The window picture** was 64x40 when ready next to an 88x56 placeholder in the same 104 px column; both are now 88x56
   (`C_WTHUMB`). The raw list's picture (80 px column) is unchanged.
3. **Dead CSS removed:** `sw-scene.thumb`, `.thumb.none`, `.thumb img`, `.thumb.pending` and `@keyframes shimmer` - every thumbnail
   is drawn inside `sw-table`, where these rules never applied (the pending shimmer never ran). The cells already carry their size
   inline, so nothing that is drawn today changes.
4. **06:INFILE-1 / L13 - one severity mapping.** The screen mapped severity to a badge four times; three used
   critical = `error` (red), alert = `stale`, info = `neutral`, but the window drawer used critical = `offline` - the grey of a device
   that is down, unfilled. Verified as a bug (a critical window looked calmer than an alert one). One mapping now: `sevKind()` in
   `investigate-events-logic.ts` and `sevBadge()` in the screen, used by the list, the event drawer, the window drawer and the demo
   table. Only an alert / critical is a filled field (EVENTS-POLISH-2331); the demo table keeps its "every severity filled" look
   (`sevBadge(sev, true)`) so the demo baselines (audit30b shared screenshots) do not move.

## Pixel impact

- **Changes (expected):** the review-window table (title weight + tone dot, sub lines, spotlight accent, time weight, 88x56
  pictures) and the window drawer's badge for a critical window (red filled instead of grey). No pixel spec covered windows mode
  before; new `tests/pixel-events-windows-2443.spec.ts` (classic, desktop 1440 + phone 390, mocked backend: three windows - critical
  with a spotlight, alert regrouped by hand, info floor group) takes `events-windows-classic-table` and
  `events-windows-classic-drawer`. Without a baseline the compare is skipped (the design-foundation rule); its structural asserts
  (the spotlight label is inline-flex/semibold inside the shadow root, the critical badge is `kind="error"` and filled) always run.
- **Unchanged:** the raw list, the event drawer (same mapping as before), the demo table.

## Tests

| Run | Where | Outcome |
|---|---|---|
| `npx tsc --noEmit` | workstation | exit 0 |
| new `tests/unit-events-table-2443.spec.ts` (4) + `tests/unit-inv-events-2440.spec.ts` (13), unit config, `--workers=1` | workstation | 17 passed |
| `unit-dark-polish-beds`, `unit-a11y-polished-lint`, `unit-empty-state-icons`, `unit-designtokens-297` (they read this screen's source), `--workers=1` | workstation | 25 passed |
| `py -3.12 scripts/design_ratchet.py` | workstation | no count above the baseline (px-literal 25625 -> 25619, scroll-container unchanged) |
| `tests/pixel-events-windows-2443.spec.ts` (new) | - | **NOT_RUN** - refresh on the runner after 2.43.8: `npx playwright test tests/pixel-events-windows-2443.spec.ts --project=desktop --project=mobile --update-snapshots`, review the two images x two widths, commit them; then a run without `-u` |
| `evidence-event-windows`, `evidence-map-improvements`, `evidence-review-fixes` (SW_LIVE only), `evidence-audit30b-shared` | - | **NOT_RUN** (runner reserved for the 2.43.8 gate; no entry check queued, by instruction) |
