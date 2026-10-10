# HOME polish - the home, area and tiles-panel screens (Design ADR) - 2026-10-10

Branch `pilot/HOME-polish`, cut from `pilot/DU1-design-unification` (c151ae20, the unified token layer). The home screen
(`devices-building`: the widget band, the summary strip, the floors tree with its per-floor collapse, the floor cards, the area
tiles), the area screen (`devices-area`: the security strip, the section cards, the device tiles and rows, the main sensors) and
the tiles panel (`devices-tiles-panel`) are raised one level in hierarchy, control states, motion and the non-ready states. CSS
and markup only, inside the four feature files; no behaviour, API contract, setting or migration changed; every colour, size and
duration is an existing `--sw-*` token (`unit-token-lint` passes with two allow-list entries fewer).

Invariants kept: the floors / areas tree with per-floor collapse (every skin, light and dark); the cards view AND the tiles view of
the building, the dense-tiles AND the sequential-sections directions of an area; clean operator screens (shorter empty-state
hints, no new badges or paragraphs); no platform name outside the settings; Hebrew RTL first (logical properties only).

## Decisions

| Area | Before | After | Why |
|---|---|---|---|
| Floor card title | `--sw-fs-md` text | `--sw-fs-lg`, `--sw-heading`, -0.01em | the floor is the card's subject; it read at the weight of a row |
| Tree floor rows | `--sw-fs-xs` `--sw-text-2` captions | `--sw-fs-sm` `--sw-text` semibold, grey glyph | the grouping level was lighter than the rows it groups |
| Keyboard focus | tree rows, area rows, tiles, chips and the segmented buttons: `outline: none` + a wash (invisible on a hovered row) | one ring everywhere: `var(--sw-focus-w) solid var(--sw-focus)`, inset on rows, offset on tiles | WCAG focus visibility; the ring policy of DU1 |
| Hover | `--sw-surface-2` fills | `--sw-hover-wash` / `--sw-pressed-wash` (the control tokens) | one hover on every surface, in every skin and scheme |
| "On" marks | a plain warm dot | the dot with a 3 px halo `color-mix(--sw-warning 22%)` | the state reads at a glance, and in dark |
| Floor count chips | outlined pills, the lit chip outlined too | quiet `--sw-surface-2` pills; the lit chip `--sw-warning-soft` / `-text` when something is on | fewer outlines on a card; the one number that matters carries the tone |
| Area tile icon | text colour | `--sw-text-2`, `--sw-warning-text` when on | the icon follows the state like the dot |
| Area dense tile names | one line, ellipsis (`תאורה אולם ספור…`) | two lines, then ellipsis | the owner's names are long; a cut name is a wrong name |
| State motion | none (tiles: hover only) | background / border / colour fade over `--sw-t-state`, hover over `--sw-t-fast`, a tile lift of `--sw-hover-lift` (0 in classic, -2 px in Domus); a triggered alarm's icon pulses | a state push should be seen changing, not jump; everything inside `prefers-reduced-motion: no-preference` |
| Loading | a centred spinner panel | a skeleton in the screen's own shape (band, strip, tree + cards; the area: strip + three cards) on `--sw-skeleton` with the `--sw-skeleton-shine` shimmer (static under reduced motion) | no layout jump when the tree arrives; the same tokens the other screens use |
| Load error | heading + the server's text | + "נסה שוב" (the panel's own action) on the home, the area and the panel | a dead end on an operator screen |
| Empty hints | two-sentence instructions | one line ("המבנה יופיע כאן כשיוגדרו קומות ואזורים.", "התקנים שישויכו לאזור יופיעו כאן.") | clean operator screens |
| Quick actions / media chips | hover `--sw-surface-2` | hover wash + `--sw-text-3` edge, pressed wash, `--sw-disabled-opacity`; the danger button hovers on `--sw-danger-soft` | the shared control states |
| `--sw-on-accent, #fff` | a fallback for a token that never existed | `--sw-text-inverse` | DU1 rule; the two files leave `ALLOW_HEX` |

## Evidence

`docs/design/evidence/home-polish/before/` (c151ae20) and `after/` (this branch), captured by
`frontend/tests/evidence-home-polish.spec.ts` against the devices fixture backend (`tests/fixtures/devices_fake_ha.py`, no
lab): `home-cards`, `home-tiles`, `panel-lights`, `area` for classic / domus / tesla / bubble x light / dark at 1440, classic at
1024 and 390 (+ `home-floors-*-390`, the phone's cards), `area-sections` (the second direction), `home-loading`, `home-error`,
`area-empty`, `home-tree-folded` and `home-focus` (the keyboard ring on a tree row). Fixed clock, `?design=a&look=performance:full`.

The win32 pixel baselines `classic-home-1440` and `classic-dialog-1440` of `evidence-design-foundation.spec.ts` were regenerated
on this branch (the diff was the tree and the floor cards only - the intended change); the 390 baselines did not move.

## Not done

- The bubble skin's own pill rows and the `--dv-*` glass knobs keep their values (the skin layer is another agent's).
- A table / list view of an area (one row per device across sections) is a product decision, not a polish: the cards view's
  rows and the sequential-sections direction are the list presentations today.
- `sw-kpi`, `sw-card`, `sw-state-panel` are shared components and were not touched; their hover / focus already follow the tokens.
