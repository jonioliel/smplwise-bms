# CR-DUP-ADMIN-CARDS-2440 - one base for the device admin cards, one switch row for the access messaging / policy cards

Branch `pilot/CR-DUP-ADMIN-CARDS-2440`, based on `origin/release/2437-train` (6c5541485).
Plan row: `private/code-review-2026-11-13/MASTER_PLAN.md`, `pilot/CR-DUP-ADMIN-CARDS-2436` (06:DUP-6, 06:DUP-7). Behaviour change: no. Pixels: no.

## What and why

Review findings 06:DUP-6 and 06:DUP-7: the same code lived in three files, twice.

### DUP-6 - the device admin cards (Settings > electricity and devices)

New `frontend/src/screens/devices-override-admin.ts`:

- `DevicesOverrideAdmin<Row>` - the read (`fetchRows()` per card, the error kept in `error`), the scroll to the card for its
  `?section=` values, and the loading / error card. Used by all three cards.
- `DevicesOverrideListAdmin<Row, Filters>` - what the two long lists share: filters that reset the paging, the selection with a
  Shift+click range, the floor / area options, the "floor ‹ area" text and the save in batches (`postChunks`, one call per batch,
  the first failure stops the rest - as before).
- `overrideTableStyles` (the table of all three) and `overrideListStyles` (filter bar, selection column, action row, the cards
  with a sticky action bar under 600 px - the two long lists).

Adopters: `devices-protected-switches-admin.ts` ("מתגים מוגנים"), `devices-type-admin.ts` ("סוגי התקנים"),
`devices-climate-kind-admin.ts` ("מיזוג וחימום"). Each keeps its own render, wording, data attributes, its own rule for when the
error card replaces the list, and its own order of steps around a save (they differ and were left as they are).

The override card itself ("דריסה ידנית", named in the batch brief) has no file of its own on this base - the shared base is the
`devices-override-admin.ts` the plan row asks for.

### DUP-7 - the switch row of the access cards

New `frontend/src/messaging/policy-switch.ts`:

- `switchTrackStyles` - the text column, the second line, the track and its thumb (RTL, the `dir="ltr"` mirror, reduced motion)
  and the disabled look: what all three copies had.
- `policySwitchStyles` - the flat settings-card row on top of it (the two settings cards).
- `switchBody(title, text)` - the inside of the `<button class="sw" role="switch">`. The button stays in each screen, so every
  data attribute, click handler and disabled rule is where it was.

Adopters: `system-access-messaging.ts` (4 switches), `system-access-policy.ts`, `wiskey-person-messages.ts` (its boxed row and
its own focus ring stay in the file).

## Why the look is the same

Only declarations that were identical were moved. A shared fragment is listed before the screen's own block; where two rules
could meet on one element the winner is decided by specificity, not by order (`.sw:disabled` over `.sw`, `td:nth-child(2)` over
`td`), or the screen's own rule still comes later (`devices-type-admin` keeps its `gap: 4px 10px` for the phone card inside its own
media block, after the shared `2px 10px`). The DOM is the same except for Lit's own comment markers inside the switch button.

One equivalence worth naming: the climate card used to start with `load()` only; it now goes through the base, which also looks
at `?section=` - its list of sections is empty, so nothing scrolls.

## Files

- new `frontend/src/screens/devices-override-admin.ts`
- new `frontend/src/messaging/policy-switch.ts`
- `frontend/src/screens/devices-protected-switches-admin.ts`, `devices-type-admin.ts`, `devices-climate-kind-admin.ts`
- `frontend/src/screens/system-access-messaging.ts`, `system-access-policy.ts`, `wiskey-person-messages.ts`

Net: 9 files, about 410 lines added (345 of them the two shared files and their comments), about 600 removed.

### Outside my rows

- `frontend/tests/unit-switch-contrast-2380.spec.ts` - its list of "files that draw their own switch track" named the three
  screens; the track now lives in `messaging/policy-switch.ts`, so the three entries became that one. The assertion is unchanged.

## Tests actually run (workstation, Vite dev server of this worktree, `--project=desktop --workers=1`)

- `npx tsc --noEmit` (whole frontend): clean.
- Node / source specs: `unit-protected-switches`, `unit-device-types`, `unit-entity-id-sweep`, `unit-uxfix-rtl`,
  `unit-switch-contrast-2380`, `unit-messaging-strings`, `unit-people-strings`, `unit-a11y-r4-leftovers-2380`,
  `unit-messaging-policy`, `unit-messaging-logic`: 110 passed, 0 failed.
- Browser specs: `evidence-protected-switches`, `evidence-wiskey-messaging-settings`, `evidence-access-status`,
  `layout-access-status` (8 skins x scheme, 110 checks each, 0 findings), `unit-device-types-admin-ui`: 67 passed, 1 skipped,
  1 failed in the first run - `unit-device-types-admin-ui.spec.ts:77` did not find the card within 5 s while the workstation was
  at 100 % CPU; the same file alone right after: 2 passed, 0 failed.

The evidence specs rewrote PNGs under `docs/design/evidence/`; they were restored and are not part of the commit.

## NOT_RUN

- Pixel specs (`pixel-wiskey-messaging`, `pixel-access-status`) and every other pixel lane: runner only.
- `evidence-wiskey-messaging.spec.ts` (the person drawer's "הודעות" tab), `layout-wiskey-messaging.spec.ts`,
  `evidence-devices.spec.ts`, `r5-devices-shoot.spec.ts`: not run locally (memory / CPU budget); they belong to the combined
  entry check.
- The tablet and mobile projects of the specs above (the under-600 px card layout of the two long lists is covered by
  `evidence-protected-switches` at 390 px inside the desktop project only).
- `npm run build`, the full frontend suite, the runner entry check (the lead runs it on the combined branch).

## Pixels to refresh

None expected.
