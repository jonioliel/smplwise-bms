# TV-FIT-2380 - the TV notice board fits a real screen

Branch `pilot/TV-FIT-2380` (from `release/2360-train`). Plan row D1 of `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md`.
Frontend only (`frontend/src/notice-tv/**` and its specs). No version bump, no merge.

## 1. Why

- **Portrait footer dropped a chip.** Since TVNOTICE2-297 the default "updated" wording is "עודכן · <place> 09:12". It is longer than
  the old "עודכן 09:12 · <board>", so in the portrait footer of template 1 the status line squeezed the building chips into a third line
  that the chips box (a fixed height, overflow hidden) cut off - the parking chip disappeared. The owner was told on 28.10; no test saw
  it because the two pixel specs pinned `updated: 'full'` (`pixel-bustimes-295.spec.ts:26`, `pixel-notice-tv-mock.spec.ts:67`).
  The same wording also cut the **time** off the line wherever the line is capped with an ellipsis (the one-row header, Ink / Sign at
  400 px), because the place wording puts the time last; and in the lobby styles a long line made `fitInfo` remove building entries.
- **H7** (TVNOTICE-297-GAPS): a tall crest logo was drawn at the row's height, about 27 px wide.
- **T11 leftovers**: the Hebrew date line was simply missing on a TV browser without the Hebrew calendar; no safe-area / overscan margin.

Owner question Q3 (two rows / priority drop / short wording) is still open; this branch applies the recommendation **(a) two rows** and
keeps **(b) priority drop** as a setting.

## 2. What changed

| Piece | Change |
|---|---|
| `tv-fit.ts` (new, pure) | `chipFitOf` (rows / drop, `?chips=` test hook), `dropOrder` (healthy first, then off, warn, alarm last; later chip first), `safeMarginOf` / `safeInset` (0..5 %, halves; `?safe=` wins), `logoArea` (size factors by shape) |
| `heb-date.ts` (new, pure) | The arithmetic Hebrew calendar (Dershowitz & Reingold) printed exactly as Chromium's ICU prints it ("12 בחשוון 5787"); `hebrewDate()` uses the browser's own Hebrew calendar when it really has one (calendar = hebrew and Hebrew letters in the output), else the computed date |
| `tv-logic.ts` | `Display.portrait_chips` and `Display.safe_margin` (optional; absent = rows / 0) |
| `main.ts` | Classic footer: `data-chips` on the canvas; `fitFooter()` after layout - portrait (rows) is always two rows by CSS, landscape turns to two rows (`.ft.two`) only when a chip would be cut, `drop` / last resort hides chips in `dropOrder`. One-row header: only the words around the time end in an ellipsis. `hebDate()` uses `hebrewDate()`. Safe margin: `#host` inset, the canvas fits the host (zoom and transform paths). H7: the light logo's ratio is read once per file; `--coa` / `--cow` on the document root; V2's `--b2co` grows for a crest up to the xl box |
| `skin-board.ts` | `SkinInput.chips`, `data-chips` on `#nbk`, in the redraw signature; the "updated" line as `.nb-lw` with `.nb-lt` words (ellipsis) and the time outside them; `fitCanvas` fits the host (safe margin) |
| `hx-engine.ts` | `fitInfo` removes entries in `dropOrder` (an alarm last) instead of "last healthy, else the last one" |
| `tv.css` | TV-FIT block: two-row footer (`#cv.portrait[data-chips="rows"]`, `.ft.two`), `.ch[hidden]`, the company logo heights x `--coa` capped at max(old size, 128 / 120 / 72 / 160 px), width caps x `--cow`; black safe-area frame |
| `tv-v2.css` | Portrait footer may wrap ("powered by" to a second row before it runs into the status); logo width cap x `--cow` |
| `tv-skins.css`, `tv-hitech.css`, `tv-luxury.css` | `.nb-co` heights x `--coa` (capped at the style's largest box: hi-tech 100, luxury 78, footers 40, Ink / Sign 44, idle 96 px), width caps x `--cow`; the `.nb-lw` / `.nb-lt` rules; portrait `.nb-st8` may use the whole row; Gallery portrait (rows): entries, then the status line with the logos, then the news |

An ordinary logo (ratio 2:1 .. 4:1) gets no `--coa` / `--cow`, so every computed size equals the old one. A board with nothing set gets
rows and margin 0. Landscape footers that fit are unchanged.

### Per design (portrait, default wording)

| Design | Before | Now |
|---|---|---|
| Classic template 1, header as before | chips + status in one row; the 4th chip cut | chips on row 1, status + mark on row 2 (each keeps its side) |
| Classic template 1, one-row header a / b | chips alone in the footer (fine); the time could be cut in the header | the place gives way, the time stays |
| Classic templates 2 / 3 | chips in the card / bottom block, not beside the status | unchanged (covered by the new spec) |
| V2 | no chips by design; the status line and "powered by" could collide | "powered by" wraps to a second row |
| Lumen / Axis / Prism / Concierge / Stone | already stacked; a long status line could make `fitInfo` remove entries | the line ends in an ellipsis before the time; entries leave only in priority order |
| Gallery | entries and the status line shared a wrapping row | entries, status, news on their own rows |
| Ink / Sign | 2 x 2 entries grid (fine); the status capped at 400 / 420 px cut the time | the line uses the row; the place gives way, the time stays |

## 3. Settings

| Setting | Values | Default | Where today |
|---|---|---|---|
| `display.portrait_chips` | `rows` (two rows; landscape only when needed), `drop` (one row, healthy chips leave first) | `rows` | read by the TV page; test hook `?chips=` |
| `display.safe_margin` | 0, 0.5 .. 5 (% of each side) | 0 | read by the TV page; the TV's own address `?safe=<n>` overrides it (overscan belongs to the device, e.g. `/b/<slug>?safe=3#t=...`; `?safe=0` turns a board margin off on a TV without overscan) |

**Not wired yet (outside this package's files):** the backend keeps only known display keys (`services/notices/model.py`,
`routers/notices.py`) and the Settings screen is `system-notices.ts` (polish round 4, WP8). So the two keys are not yet saved or editable;
the TV page already reads them, and `?safe=` works today per device. Wiring belongs to D3 BOARD-ADMIN (after 2.37.0): add both keys to
the TV2 choices / factory (`portrait_chips: rows`, `safe_margin: 0`), the router model, the settings form, and a backend test.

## 4. Tests

| Spec | What |
|---|---|
| `tests/unit-tv-fit-2380.spec.ts` (new, node) | chips setting and drop order; margin parsing and insets; logo factors (band, continuity, caps); the computed Hebrew date equals Node's ICU for every day 1990-2059; anchors (Rosh Hashana, Adar I / II); fallback with no formatter, a Gregorian fallback, Latin month names, a throwing formatter, and the board zone's day |
| `tests/pixel-notice-tv-portrait-chips.spec.ts` (new, desktop) | 13 designs in portrait with the default wording and with a worst-case place: every chip drawn and not cut by any clipping box, the time drawn whole, nothing over the status line, no scroll; one screenshot per design (baseline set generated on the runner); landscape `.two` only when needed; `drop` keeps the warning; safe margin by address and by board on classic, V2, Lumen, Sign; H7 crest taller (capped), box logo 72 px; the Hebrew date with `Intl` refusing `ca-hebrew` |
| `tests/pixel-notice-tv-mock.spec.ts` | the parity check now names the mock-up's own footer explicitly (`updated: 'full'`, `portrait_chips: 'drop'`); new per-case test with the product default footer (4 chips whole, the time whole, the place wording) |
| `tests/pixel-bustimes-295.spec.ts` | `updated: 'full'` removed: the baselines cover the default footer |

## 5. Evidence and open items

- Local: `tsc --noEmit` clean; unit specs (`--workers=1`): see the commit report.
- Runner: see the final report (the browser specs and the baselines need the runner; the workstation runs no browser).
- Baselines to (re)generate on the runner: all 12 of `pixel-bustimes-295.spec.ts-snapshots/` (the footer wording, and the portrait
  footer's two rows) and the new `pixel-notice-tv-portrait-chips.spec.ts-snapshots/` (13 images).
- Specs that read the portrait classic footer's geometry may need a look on the runner (the footer is now two rows in portrait).
- The real-TV check of overscan, the Hebrew date and the logo sizes is D2 (REAL-TV-SESSION).
- Owner Q3 still open: if the owner picks (b) or (c), (b) is the `drop` setting (flip the default), (c) is a wording change in
  `updatedLineParts`.
