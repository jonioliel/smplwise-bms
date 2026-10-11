# MEDIA-polish - multimedia, the notification centre, electricity (design pass) - 2026-10-10

Branch `pilot/MEDIA-polish`, from `pilot/DU1-design-unification` (c151ae20, the unified token layer). The Design ADR for the
intentional visual changes of this pass (DESIGN_CONTRACT: "intentional visual changes get a Design ADR"). Scope: the three
feature areas only - multimedia (screens, players, groups, the player panel with its queue, the remote), the notification
centre (sheet, rows, detail, the settings screen's shared controls) and electricity (meters, the meter card, accounts with the
history chart, bills, the bill page, the wizard, the prices settings). No behaviour, API, setting or migration changed.

Invariants kept: clean operator screens (no hint paragraphs or badges added), management only in Settings, the platform named
only on settings screens, Hebrew RTL first, video and artwork never mirrored, the printable bill's layout and print palette.

## 1. What was found (before: `docs/design/evidence/media-polish/before/`)

| Area | Finding |
|---|---|
| Multimedia (players, screens, groups, panel, remote) | Already on the glass layer and following the scheme (DU1 §2.3). Left over: the toasts were a literal dark glass (`rgba(28,28,30,.88)` + `#fff`), 12 `color: #fff` / `background: #fff` on accent fills, slider thumbs and HUD marks, ~65 px font sizes in the media / remote / player knob files outside the type scale, the groups' glyph tile a fixed blue gradient. `screens/multimedia-groups.ts` and `multimedia-screens.ts` sat in the lint's allow list for this. |
| Notification centre | The `--nt-*` knobs declared the mockup's iOS colours twice (light / dark blocks: `#ff9f0a`, `#d70015`, `#007aff`, ...), so a skin's warning / danger / accent never reached the severities, the unread dot or the pinned wash. The row menu and the source menu had no arrow-key navigation (Tab only). The centre's toast as above. |
| Electricity charts | The account history / bill chart drew bars up to 46 px thick (saturated blocks in dark mode), a value on every bar, no hover layer and no keyboard reach; the meter card's chart the same, with an opacity instead of a tint for the previous periods. Lists, tables, cards, empty / loading / error states and the skin matrix were already in place (CR-023 rounds). |

## 2. Decisions (ADR)

### 2.1 Tokens, not literals, on the media and notification surfaces

- Toasts (players page, screens page, the centre): `--sw-toast-bg` / `--sw-toast-text`, the icon `--sw-success` / `--sw-danger`, the
  border a 12 % mix of the toast text, the shadow `--sw-shadow-3`. In dark mode they are a lifted slate, not a black pill.
- Text on an accent / danger fill: `--sw-text-inverse`. Text, progress bars and spinners on artwork or a snapshot: `--sw-on-video`
  (video and art are dark in both schemes - DU1 §2.2). Slider thumbs: `--sw-toggle-thumb`. The "playing" dot: `--dv-success`.
- Every `font-size: <px>` of `styles/media-glass.ts`, `components/media-remote-css.ts` and the player / queue components snapped to
  the type tiers (DU1 §2.1: 13.5 -> base, 16 -> lg, 18 -> xl, 19 -> 2xl, 11.5 -> xs, 10.5 -> 2xs). Sizes of keys, pads and covers
  stay knobs (`--mm-*`, `--mr-*`), as DU1 §4 documents.
- The groups' glyph tile and the detail's snapshot placeholder derive from `--dv-accent` / `--sw-video-bg` / `--sw-on-video-2`.
- `screens/multimedia-groups.ts` and `screens/multimedia-screens.ts` carry no literal any more and leave `ALLOW_HEX`
  (`frontend/tests/unit-token-lint.spec.ts`).

### 2.2 The notification knobs read the product's state colours

`components/notify-css.ts` (`notifyKnobs`) is one block for both schemes: `--nt-sev-alert` = `--dv-warning`, `--nt-sev-critical` =
`--dv-danger`, `--nt-sev-info` = `--dv-text-3`, the soft fills the `-soft` knobs or a `color-mix`, `--nt-unread-dot` = `--dv-accent`,
the pinned-critical wash a 9 % -> 2 % mix of the danger, the timeline line `--dv-border-strong`, the matrix header `--dv-surface-2`,
the warning text `--sw-warning-text`. The `--dv-*` default palette takes these from `--sw-product-*` (DU1 §2.4), so a skin's
colours reach the severities, light and dark, and the settings screen's severity segments and push preview follow. Reviewable
with one block: restore the two literal blocks to return to the mockup's iOS values.

Integration 2.4.6 (`integ/246`): 2.4.5's security-screens polish had already moved the same knobs to the product's state colours,
reading `--sw-product-*` directly (plus a dark-scheme re-tune of the critical glow and the pinned wash). The merge kept that 2.4.5
block; with the default palette both resolve to the same colours. The centre's toast keeps this pass's blur and 12 % border on the
`--sw-r-pill` radius token, and its icon colours are the 2.4.5 `--sw-product-success` / `--sw-product-danger`.

### 2.3 Keyboard in the centre's menus

`menuArrow()` (`components/notify-logic.ts`, unit-tested): ArrowDown / ArrowUp move between the `role^="menuitem"` buttons and
wrap, Home / End jump; an opened menu (the row's ⋯, the source filter) takes the focus on its first item, Escape closes it and
returns the focus to its button. `focus({ preventScroll })`: the filter row scrolls sideways and must not be dragged along.

### 2.4 The electricity charts follow the data-viz rules

`electricity/elec-chart.ts` (+ the pure `elec-chart-data.ts`: `BAR_MAX`, `barPath`, `labelledBars`) and the meter card's `barChart`:

- Thin marks: a bar is at most 24 px thick, drawn as a path with a 4 px rounded data end and a square baseline; the band's leftover
  is air. The previous periods are the soft tint (`color-mix(accent 38 %, surface-3)`), the current period the accent, last year's
  bar keeps its dashed ring, a partial period its 45° hatch; the baseline is a solid 1 px hairline.
- Values selectively: the current period, the highest period and the same period last year carry a value; every other value is in
  the hover / focus tooltip and in the table twin (the `טבלת מספרים` toggle; visible on the printed bill). No number on every bar.
- Hover layer by default: an invisible band-wide hit area per period (wider than the mark), a tooltip (`--sw-toast-*`) with the
  kWh and the period, the hovered band washed. Keyboard: every band is focusable (Tab), the tooltip follows the focus, the focus
  wash is the product focus colour at 10 %.
- Accessibility: the `aria-label` of the chart and of every band, the legend for the three series, the table twin unchanged.
- **Bug found on the way**: the meter card's consumption chart never painted (its bars came from Lit's `html` tag inside an
  `<svg>`, so they were HTML-namespace elements - the `before` screenshots and the CR-023 evidence show the blank area). Fixed
  with the `svg` tag; `tests/electricity-meters.spec.ts` now asserts a bar is an `SVGElement` with a width.
- **The printable bill** (`elec-bill-paper.ts`, `elec-chart print`): the paper's layout, type, colours (the print palette) and the
  visible numbers table are untouched; only the chart's marks inside it changed (24 px bars, three labelled values instead of
  twelve). Documented here as the reason the bill's chart pixels moved; every value stays printed in the table under the chart.

## 3. Evidence

`docs/design/evidence/media-polish/before/` (c151ae20) and `.../after/` (this branch), written by
`frontend/tests/evidence-media-polish.spec.ts` (`SW_POLISH_PHASE=before|after`): `<area>-<screen>-<skin>-<scheme>-<width>.png`
for media (screens, players, the panel, groups, a filtered list), notify (the centre, a detail, the source menu, the settings
screen, loading / empty / error) and elec (meters table and cards, the meter card, empty / error, accounts, account status and
history, bills, a bill, wizard step 1, the prices settings); classic light + dark at 1440 and 390, Domus light + dark, Tesla
light and Bubble dark at 1440. Demo / mock mode, no backend.

## 4. Not done / next (with the reason)

- **A list view for the players and screens pages.** The task asked for list AND card views; electricity has both (table /
  cards), the notification centre is a list. Multimedia has cards with three sizes and a layout editor; a compact list is a new
  layout mode of the shared layout document (`group_by` / card sizes are persisted per tab) - a behaviour and contract change,
  outside this pass. Proposed as a follow-up (a per-tab `density: list` in `multimedia-layout.ts`).
- **The glass radii** (`--dv-radius-*` 14 / 22 / 28 and the remote's 18 px popovers) stay the mockup's - DU1 §4's owner decision.
- **The remote's `--mr-*` colours** (keys, d-pad material) stay knobs; only its type sizes were snapped.
- **The settings screen's phone mock** (`screens/system-notifications.ts`) keeps its drawn-phone literals (allow-listed, a dark
  device in both schemes); its door-action glyph now reads `--nt-sev-alert`.
- The Playwright pixel baselines of other suites are not affected (none covers these three areas); the CR-015 / CR-016 / CR-018 /
  electricity evidence folders were not regenerated - the new folder stands beside them.
