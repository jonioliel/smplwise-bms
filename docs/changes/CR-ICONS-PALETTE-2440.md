# CR-ICONS-PALETTE-2440

Code-review batch 16.11, frontend wave 2. Contract: the `pilot/CR-ICONS-PALETTE-2436` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` (D15 = 08:F08 + 07:F22, and 08:F12 step 1).
Base: `origin/release/2437-train` (2.43.7 train).

## What and why

### Icons (D15)

Eleven icon registries stood beside `components/sw-icon.ts`, each with its own `<svg class="ic" viewBox="0 0 24 24"
aria-hidden="true">` + `unsafeSVG` wrapper, and the tickets module re-typed path data the app's set already has.

1. **`components/sw-icon.ts`** exports the path table and the one wrapper. Both are written in a new sibling module,
   **`components/icon-paths.ts`**, and re-exported by `sw-icon.ts`: a module that defines the `<sw-icon>` element cannot be imported
   by the node unit specs (the test transform rejects Lit's field decorators), and the registries are imported by many of them, so
   the registries import `icon-paths.ts` (no element in it):
   - `ICON_PATHS` - the 108 glyphs as plain strings (they were `svg` templates private to the file). `<sw-icon>` draws the same
     markup from it (`unsafeSVG(ICON_PATHS[name] ?? ICON_PATHS.info)`).
   - `iconSvg(inner, cls = 'ic', style?)` - the inline-icon wrapper. The `style` attribute is written only when it is given, so the
     registries that never wrote it still do not, and the ones that always wrote it (`style=""` without a size) still do.
2. **`tickets/icons.ts`** is the ONE file of the tickets module's pictograms: it now holds the five tables (`TICKET_ICONS`,
   `COST_ICONS`, `LIST_ICONS`, `RFQ_ICONS`, `TABLE_ICONS`) and the five helpers (`tIcon`, `cIcon`, `listIcon`, `rIcon`, `tbIcon`)
   over one private wrapper call. `cost-icons.ts`, `list-icons.ts`, `rfq-icons.ts`, `table-icons.ts` re-export their old names, so no
   screen changed an import. 37 glyphs that are path-for-path a glyph of the app's set now read `ICON_PATHS.<name>` instead of
   carrying a second copy of the path data.
3. **`home/home-icons.ts`, `components/automation-icons.ts`, `media-icons.ts`, `media-player-icons.ts`, `notify-icons.ts`** call
   `iconSvg` instead of their own wrapper. Their path tables are untouched; three gain a read-only export of the table
   (`HOME_ICON_PATHS`, `AUTOMATION_ICON_PATHS`, `MEDIA_ICON_PATHS`) so the registry spec can read them.
4. **`design/sw-logo-art.ts`** escapes `alt` before it goes into `aria-label="..."` of the string-built logo markup
   (`& " < >`). Every caller passes a fixed string today; a plain `alt` gives byte-identical markup.

Decision recorded (the plan says "a single typed map"): the tickets tables are **not** merged into one map. Ten names are a
*different glyph* in different tables (`download` x3, `bell`, `filter`, `up`, `down`, `coin`, `hand`, `file`, `table`, `columns`).
One map would have to pick one glyph per name, which changes what some screen draws; "same path data" is the contract. So: one
file, one wrapper, five typed tables, every screen keeps its glyph. Unifying those ten glyphs is a visible change for the owner.

### Status colours (08:F12 step 1)

5. **`styles/status-palette.ts` (new)** holds the four fixed status colours once (`STATUS_HEX`, and `statusCss` for `css`
   templates): `#15803d`, `#c2410c`, `#c81e1e`, `#667085`. `generator/home-widget.ts` (`--sw-gw-ok / warn / fault / unk`),
   `door-windows/home-widget.ts` (`--sw-dw-*`) and `temperature/styles.ts` (`--tc-alarm-solid`) interpolate them instead of typing
   the hex. The same values: no pixel moves.
6. **`tickets/map-element.ts`**: the dot colours of the "pick on the plan" stage were literals inside the SVG markup; they are
   `MAP_PICK_HEX` in the same module now (the same five values). They are not the four status colours (the review listed the file
   under F12; its hex values are its own), so they are named separately.

Not done, as the row says: mapping the status colours onto the theme tokens is owner decision **O19** (recommendation a = keep
fixed, only de-duplicate - which is exactly this step). `--sw-gw-run`, `--sw-gw-trans`, `--tc-warn-solid` are single-use values
and stay where they are.

## Resolved file list

- `frontend/src/components/sw-icon.ts`, new `frontend/src/components/icon-paths.ts` (the table and `iconSvg`, see 1), `automation-icons.ts`, `media-icons.ts`, `media-player-icons.ts`, `notify-icons.ts`
- `frontend/src/tickets/icons.ts`, `cost-icons.ts`, `list-icons.ts`, `rfq-icons.ts`, `table-icons.ts`, `map-element.ts`
- `frontend/src/home/home-icons.ts`, `frontend/src/design/sw-logo-art.ts`
- new `frontend/src/styles/status-palette.ts`; `frontend/src/generator/home-widget.ts`, `frontend/src/door-windows/home-widget.ts`,
  `frontend/src/temperature/styles.ts`
- new `frontend/tests/unit-icon-registries.spec.ts`
- `docs/changes/CR-ICONS-PALETTE-2440.md`

Not touched although they are icon registries: `home/home-p3-icons.ts`, `screens/automation-builder-icons.ts`,
`screens/wiskey-stations-icons.ts`, `xsection/xs-icons.ts` - they are not in the row; the same one-line swap to `iconSvg` fits
them in the closing chain.

Outside my rows:

- `frontend/tests/unit-empty-state-icons.spec.ts` (one line): it looked for `inbox: svg\`` in the text of `sw-icon.ts`; the table
  is strings in `icon-paths.ts` now, so it looks for `inbox: '<` there.

## Pixels

No (plan row): the same path data (held by SHA-1 per icon, 485 icons in 11 registries), the same class names and attributes, the
same hex values. The pixel gate and the evidence / layout specs the row names were NOT run locally (runner only).

## Tests actually run

Workstation, 16.11.2026 (16 GB, under 1 GB free for most of the session):

- `npx playwright test -c playwright.unit.config.ts tests/unit-icon-registries.spec.ts tests/unit-empty-state-icons.spec.ts
  --workers=1`: **19 passed** - 11 registries, 485 icons: every former name resolves and its path data has the SHA-1 it had on
  `release/2437-train`; the wrapper writes the markup each registry wrote (class, `viewBox`, `aria-hidden`, `style` present or
  absent); the four re-export modules are the same functions; `alt` is escaped; the widgets' CSS text carries the same hex values.
  (First run: 1 failed - the `home` fixture, because my scan of the old file had missed the icons added by its second block; the
  fixture was regenerated from the base commit, the code was not touched. An earlier attempt failed to load at all because the
  registries imported `sw-icon.ts`; that is why the table and the wrapper stand in `icon-paths.ts`.)
- The unit specs that import the touched modules or lint their text - `unit-door-windows-home-widget`,
  `unit-generator-home-widget`, `unit-temperature-phase3`, `unit-tickets-rfq`, `unit-tickets-table`, `unit-swlogo-295`,
  `unit-token-lint`, `unit-home-screen`, `unit-home-simple-logic`, `unit-noticepage-295`, `unit-polish4-wp4-home`,
  `unit-uxrest2-295`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-home-clock`, `unit-home-reload-2436`
  (`--workers=1`): **136 passed, 0 failed**.
- `npx tsc --noEmit` (whole frontend): TSC_RESULT

NOT_RUN:

- `evidence-tickets-*`, `layout-tickets-*`, `evidence-generator-home.spec.ts`, `evidence-elevators-home.spec.ts`, the home widget
  pixel specs and the pixel gate (the row's named browser tests): they need a build and a browser; free memory stayed under the
  1.5 GB floor of the batch brief. **First real run: the combined entry check.**
