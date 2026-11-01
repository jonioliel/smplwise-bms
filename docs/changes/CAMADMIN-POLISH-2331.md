# CAMADMIN-POLISH-2331 - camera admin polish, wave 3

Branch `pilot/CAMADMIN-POLISH-2331` from `origin/main` 52a8d9129. No version bump, no migration, no API change, no copy change.
Scope: `frontend/src/screens/system-security-privacy-masks.ts`, `nvr-camera-batch.ts`, `nvr-cameras-edit.ts`. The reference is the
polished R5-LIVE-297 camera screens (`nvr-camera-editor.ts`, `system-security-cameras.ts`, and their sibling `nvr-encoding-batch.ts`).
Skills followed: impeccable (polish, craft floor), emil-design-eng.

## Critique (before)

Screenshots: `docs/evidence/CAMADMIN-POLISH-2331/before/` - desktop 1920x1080 and 1440x900, tablet 1180x820 and 1024x768, phone 390x844.
They were taken from the committed 2.32.0 add-on bundle (`smplwise_vms/www`). Between that build and the branch base, nothing changed
in the scoped files or the components they use.

### Privacy masks (Settings > Security > Privacy masks)
1. **The primary action is below the fold on every desktop and tablet.** The picture takes the full content width (960 px at
   1920, ~800 px at 1440) with no height cap. So the region list, the change history and "בדיקת השינויים" all need a page scroll at
   1920x1080, 1440x900, 1180x820 and 1024x768. This breaks the owner rule (no page scroll on a control screen), and the review button
   cannot be seen while you draw.
2. Wasted space: the camera column holds three 44 px rows next to a 540-800 px tall picture, and the rest of that column is empty.
3. Drift from the R5 language: everything is a 1 px outlined box (camera rows, region rows, history rows, results, review cards). The
   chosen camera is only a tinted outline. Names are 13 px regular, the region count is grey 13 px, the section labels are grey 13 px.
4. The lock banner ("writing is off") is a neutral grey box with the same weight as the rest, so it does not read as a state.
5. Review step: the cards are outlined with 13 px names. The status chip has a border and 12 px type. A camera that will not be
   written gets no tint beyond the chip.
6. Confirmation dialog: "N cameras will be written" is a 13 px medium line. In the R5 `nvr-confirm`, the count is the one thing read
   before the press (an accent field).
7. Literal colour in the draw ghost (`rgba(59,130,246,0.2)`) instead of the accent token.
8. Phone: the camera strip, toolbar and picture work. The region list, history and review button come after the picture and need a
   scroll, and the review button is not in reach while you edit.
9. States: loading / error / forbidden / empty use `sw-state-panel` (fine). The mask read error and the per-camera loading are fine.
   Keyboard: the region keys, Delete and the focus moves are fine.

### Multi-camera SVC change (`nvr-camera-batch`: checklist, progress, result)
1. Off-language next to its own sibling: the multi-camera *encoding* dialog got the R5 pass (a well, filled chosen rows with a start
   bar, bold counts, no hairlines). The SVC checklist and the progress of both batch kinds are still outlined lists with hairlines,
   13 px names and a ticked box as the only sign of a chosen row.
2. The list always takes `clamp(180px, 46dvh, 440px)`, so a batch of 3 cameras floats in a box that is half empty (visible at every size).
3. A failed or unknown row is only a red / amber icon. Its line is grey. Error and status messages are the same grey well.
4. Hover tints are not gated to a fine pointer (sticky hover on touch). There is no press feedback on rows.
5. Token drift: `var(--sw-text-4, #9aa3b2)` (an undeclared token with a hex fallback, the only reason for the file's ALLOW_HEX entry),
   a `2px` radius on the progress bar, and literal fallbacks on declared tokens.

### `nvr-cameras-edit.ts`
Pure logic (control states, confirmation model, error lines, the editor draft). It has no visual surface. I reviewed the copy: it is
consistent with the editor and the camera table. **No change.**

## Changes

### Privacy masks
- **Fit-to-window wide layout** (content at least 760 px wide and a window at least 560 px tall; a container query on the editor). Two
  columns: the start column holds the cameras (a well, at most 40 % of the height, scrolls inside), the inspector (regions, history;
  scrolls inside) and the review button at its foot. The main column holds the toolbar and the picture. The picture is sized by a
  size container: `min(100cqw, 100cqh * W / H)`, so it keeps the camera's aspect ratio and never goes past the window. The height is
  measured after each render and on resize: the layout's top in the page to the window's bottom, minus 24 px. Review and result
  steps scroll inside the main column, and their back / next footer sticks to its bottom.
- **Narrow (phone):** the same order as before (camera strip, toolbar, picture, regions, history). The review button is now a footer
  that sticks to the bottom of the view.
- R5 language: camera rows, region rows, history and results are rows inside wells (surface-2, no outlines). The chosen camera or
  region is a 22 % accent field with a 4 px bar at its start edge and bold heading ink. The channel number is a small pill. Hover
  tints only under a fine pointer, and rows give on press. The toolbar is a well, and the region count is a bold numeral. The
  picture frame is a media card (radius media, shadow 2, the video ground).
- The lock banner is a warm-toned field in bold heading ink. Error lines are danger wells (`--sw-danger-text` on `--sw-danger-soft`).
- Review cards: shadow-2 instead of an outline, the camera name in 15 px / 800, and filled status chips. A camera that will not be
  written gets a light danger tint. Thumbnails take the media radius.
- Confirmation dialog: the count is the R5 accent field (as in `nvr-confirm`). The camera names are wells.
- The draw ghost uses `color-mix` of the accent. No literal colours were added.
- DOM: `renderEditor()` returns three parts (main / inspector / footer), placed by grid areas. All `data-pm-*` hooks and the Tab order
  (picture, regions, history, review) are kept.

### Multi-camera batch
- The list is a well with no hairlines, sized to its rows (at least 3 rows, at most the old clamp). The checklist sizes to the whole
  candidate list, so it does not jump while you search. The windowed 44 / 52 px rows are unchanged.
- A chosen camera is a 26 % accent field with a 4 px start bar, its name bold. The 22 px box is raised. Hover is gated, rows give on
  press, and the count is a bold numeral.
- Progress rows: bold names, 14 px outcome line. A failed row is a light danger field with danger ink, and an unknown row a light
  warning field. The progress bar is 6 px pill-shaped and eases with tokens. Messages are wells, and an error message is a danger well.
- Token clean-up: `--sw-text-3` replaces the undeclared `--sw-text-4` and its hex, and the literal fallbacks on declared tokens are
  gone. The file's `ALLOW_HEX` entry in `tests/unit-token-lint.spec.ts` is removed, because the lint fails on a stale entry.

## Not changed / proposals (shared files, not edited)
- `sw-dialog`: a multi-camera list dialog would gain from a `fit` mode that sizes the body to its content. Here this is done locally.
- `sw-page` / the shell: a shared "fit-to-window" helper (the measured height below the page header) would replace the local
  `measure()` in the privacy-mask screen and could serve the other editor screens.

## Tests
See the segment report. The coordinator ordered no local builds, previews or Playwright evidence runs (the workstation is out of
memory), so the evidence specs run on the runner gate.

## Pixel baselines likely affected
- `evidence-maskui-295` and `evidence-breakui-masks` shots (all states, desktop / tablet / mobile, light / dark).
- `evidence-nvr-cameras-batch` (`batch-*`), `layout-nvr-cameras-batch` (measures only, no pixels) and `evidence-nvr-encoding-batch`
  progress shots (the encoding batch's progress is drawn by `nvr-camera-batch`).
- Any pixel baseline of `#/system/security/privacy-masks`. The `after/` screenshots are not taken yet (no local build was allowed).
