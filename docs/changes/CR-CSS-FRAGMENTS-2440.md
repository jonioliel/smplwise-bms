# CR-CSS-FRAGMENTS-2440

Code-review batch 16.11, frontend wave 2. Contract: the `pilot/CR-CSS-FRAGMENTS-2436` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` (06:CSS-1 fragments, 06:DUP-8, 06:DUP-11 helper, step 1 of 06:CMP-2).
Base: `origin/release/2437-train` (2.43.7 train). Adoption in the settings-card family only; the other families adopt in
`CR-CSS-FRAGMENTS-TAIL` (3B).

## What and why

The same CSS rule bodies are typed again per screen (85 identical declaration sets, 436 copies). This branch creates the shared
pieces and adopts them in one family, without moving a pixel.

1. **`frontend/src/styles/fragments.ts` (new)** - rules that stand under the SAME selector with the SAME declarations in three files
   or more: `segTrackStyles`, `segThumbStyles`, `segThumbPlainStyles`, `dialogRowStyles`, `okLineStyles`, `errLineStyles`,
   `mutedStyles`, `ltrStyles`, `srOnlyStyles`, `hostBlockStyles` (the count is next to each one).
2. **`frontend/src/styles/settings.ts`** - 13 blocks the settings-card family typed more than once (06:DUP-8), each exactly as it
   stood: `settingsPlainRowStyles`, `settingsStackLabelStyles`, `settingsMutedHintStyles`, `settingsSegKeyStateStyles`,
   `settingsFootStatusStyles`, `settingsWrapFootStyles`, `settingsPillSegKeyStyles`, `settingsTabNavStyles`,
   `settingsFieldLabelStyles`, `settingsFieldInvalidStyles`, `settingsOptRowStyles`, `settingsPreviewColStyles`,
   `settingsPreviewButtonStyles`. They are NOT part of `settingsStyles` (those screens keep their own older look and opt in block
   by block).
3. **`frontend/src/api/day-format.ts`** - `isoZ(d)` (06:DUP-11): UTC ISO without milliseconds. Moved from `api/history-scrub.ts`,
   which re-exports it, so every existing import works. Adopted in this family's one file that had copies
   (`system-intercom-ops.ts`, 2 sites); the other 46 copies belong to the TAIL branch.

### How adoption keeps every pixel

A screen replaces its copy with `${fragment}` **in the same place of its own `css` template**. Lit inlines the fragment's text there,
so the screen's stylesheet has the same rules in the same order as before - nothing about the cascade can change. This was checked
mechanically, not by eye: for each of the 12 files, every `css` template was expanded (fragments inlined recursively, comments
stripped, whitespace collapsed) at the base commit and in the working tree, and the two texts compared.

Result: **12 of 12 files identical** (`SAME`, 0 different).

| File | Blocks adopted | Net lines removed |
|---|---|---|
| `screens/system-design.ts` | plain row, stack label, muted hint, seg track, seg thumb, seg key state, foot + status | 51 |
| `screens/system-look.ts` | plain row, muted hint, seg track, seg thumb, seg key state, preview column, preview button, foot + status | 61 |
| `screens/system-nav-size.ts` | plain row, stack label, muted hint, seg track, seg thumb, wrap foot | 36 |
| `screens/system-palette-editor.ts` | plain row, seg thumb, preview column, preview button | 29 |
| `screens/system-brand-logos.ts` | seg thumb | 4 |
| `screens/system-building-presence.ts` | pill seg keys | 18 |
| `screens/system-presence.ts` | wrap foot, ok line, error line, pill seg keys | 29 |
| `screens/system-intercom-installer.ts` | tab strip | 36 |
| `screens/system-intercom-ops.ts` | tab strip, field label; `isoZ` x2 | 42 |
| `screens/installer-clock.ts` | field invalid, muted, option row | 8 |
| `screens/installer-styles.ts` | field label, field invalid, muted, option row | 14 |
| `screens/system-update.ts` | none - see below | 0 |

## Decisions recorded (no owner or lead answer existed; the recommendation / the safe reading was taken)

- **`system-update.ts` adopts nothing.** Its rules look like the family's but none is identical (its chosen key uses shadow 2, its
  keys are 44 px, its track has `max-inline-size`). "Identical declarations, same selectors" is the contract, so it stays as it is.
- **Only whole identical rules were moved.** Near-copies (a `.seg button` with `padding: 0 12px` on one page and `0 14px` on the
  next, `.lbl` with one more declaration) stay local. Making them one rule would move pixels: that is CMP-2 step 2, an owner decision.
- **`ellipsisStyles`, `inputSkinStyles`, `skeletonStyles` are not created.** The review names them, and the declaration sets are
  indeed identical in 10-20 files - but under a different selector in almost every file (`.nm`, `.tt`, `.who`, `.r .l`, ...). A
  fragment "with the screens' existing class names" does not exist for them without touching markup. Left to
  `CR-CSS-FRAGMENTS-TAIL`, which decides per family; said in the header of `fragments.ts`.
- **The handlers of DUP-8 ("one small helper per pair") are not merged.** The row's files and test are about CSS ("identical
  declarations, same selectors", the pixel gate); merging save handlers is a behaviour risk with no test named. Left for the TAIL
  branch or the screen's next edit.
- `dialogRowStyles`, `ltrStyles`, `srOnlyStyles`, `hostBlockStyles` have no adopter in this family; they are here because the row
  makes this branch the owner of `fragments.ts` and the TAIL branch only adopts.

## Resolved file list

- new `frontend/src/styles/fragments.ts`; `frontend/src/styles/settings.ts`
- `frontend/src/api/day-format.ts`, `frontend/src/api/history-scrub.ts`
- `frontend/src/screens/system-design.ts`, `system-look.ts`, `system-nav-size.ts`, `system-palette-editor.ts`,
  `system-brand-logos.ts`, `system-building-presence.ts`, `system-presence.ts`, `system-intercom-installer.ts`,
  `system-intercom-ops.ts`, `installer-clock.ts`, `installer-styles.ts` (`system-update.ts`: read, not changed)
- `docs/changes/CR-CSS-FRAGMENTS-2440.md`

Outside my rows:

- `frontend/tests/unit-dark-polish-beds.spec.ts` (`SEG_INVENTORY`): this source lint looks for the chosen-key rule in the text of
  each listed file. Seven entries (`system-brand-logos`, `system-building-presence`, `system-design`, `system-look`,
  `system-nav-size`, `system-palette-editor`, `system-presence`) are replaced by one entry for `styles/fragments.ts`, where that rule
  now stands. The rule's tokens are still checked, once.

## Pixels

No (plan row). The proof on this workstation is the text comparison above; the pixel gate itself was NOT run locally (runner only)
and must stay green.

## For the closing chain (3B)

- `CR-CSS-FRAGMENTS-TAIL` adopts `fragments.ts` in the other families the same way (`${fragment}` in place), replaces the other 46
  `isoZ` copies, and decides the three selector-less sets above.
- Any other source lint that looks for a rule in a screen's own text will need the same one-line pointer to `fragments.ts` when a
  family adopts.

## Tests actually run

Resumed on 2026-11-16 PM by a second agent (the first ran out of usage before testing and committing). The half-done work was
re-checked against the row and found complete and correct; nothing had to be fixed forward.

- `npx tsc --noEmit` (frontend): exit 0.
- Stylesheet text comparison, written again independently on resume (every `css` template of the 12 row files expanded with the
  fragments inlined recursively, comments stripped, whitespace collapsed; base `32c4a2275` against the tree): 12 of 12 `SAME`,
  0 different; every block that existed in `styles/settings.ts` at the base expands to the same text.
- `npx playwright test -c playwright.unit.config.ts --workers=1` on the 11 node-only specs that read the touched files
  (`unit-dark-polish-beds`, `unit-a11y-polished-lint`, `unit-a11y-r4-leftovers-2380`, `unit-day-format`, `unit-designtokens-297`,
  `unit-history-replay`, `unit-polish4-shared`, `unit-presence-count-2400`, `unit-settings-rows-2380`, `unit-token-lint`,
  `unit-wiskey-installer`): 111 passed, 0 failed.

## NOT_RUN

- The pixel gate (the row's test) - runner only; no baseline was regenerated or committed. Pixels to refresh: none expected.
- Evidence / layout / page specs in a browser, `npm run build`, the entry check (batch rule: push only).
- ESLint: `typescript-eslint` is not installed in this checkout's `node_modules`, so the lint could not start.
