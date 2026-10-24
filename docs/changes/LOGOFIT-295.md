# LOGOFIT-295: the logos share the page's top row (no extra row above every screen)

Branch `pilot/LOGOFIT-295`, cut from `origin/main` `7551d2a22` (tag `v2.16.0`). Owner bug report on the released 2.16.0 (home screen,
desktop): the brand strip of CR-LOGOS295 (the company logo, the search / status pill, the SmplWise logo) was drawn as a row of its own
above the page and pushed the whole screen down.

## What changed

- `frontend/src/shell/sw-app.ts`: the separate `.brandstrip` row inside `<main>` is gone. The logos are part of the floating corner
  (`.float`, absolute, the same element that has always held the pill): one row `.cornerrow` with, from inline-start to inline-end,
  the company logo (and the white-label installer logo), the pill, a hairline (only beside a company / installer logo, as in mockup
  v3), the SmplWise logo. In RTL: the SmplWise logo at the far left, to the left of the search (owner 24.10), unchanged.
- The row adds no height. Pages keep their end side clear of it through the existing `--sw-float-reserve` contract: the shell
  measures the logos' width (the row minus the pill, ResizeObserver: logo file arrival, size scale, tablet caps) into
  `--sw-corner-brand-w`, and every reserve of that row grows by it (page headers when the page is the first row, the tab row, the
  tab pair, dropdown placements 3 / 4; placement 2 already measures the corner's real extent).
- Not sticky, no hit target (the 2.16.0 gate issue stays fixed): the logos and the hairline are `pointer-events: none` (only the
  pill, the incident pill and the search panel take clicks, exactly the boxes that did before), and they fade out (`visibility:
  hidden`) as soon as `<main>` scrolls, so a page's sticky header never has a logo over it. The pill keeps its place.
- Sizes in the row: company 34 px (max 190 px wide), SmplWise 32 px, both times the administrator's size scale; below 1100 px wide
  the company logo is capped at 130 px and the SmplWise logo at 104 px wide so the page title keeps its room.
- Phone: unchanged (no strip; the home screen's own logo row). Kiosk / embedded / full-screen editors: no logos, the pill as before.
- Deviation from mockup v3 recorded (not silently resolved): the mockup drew the strip as a row of its own with the company logo at the
  far inline-start (the right). Sharing the page title's row puts the company logo inside the corner cluster, at the cluster's
  inline-start (right of the pill), because the page title owns the row's inline-start. The order company -> pill -> SmplWise is kept.

## Measurements (demo mode, company logo set, size `m`; `tests/layout-logo-strip-inline-295.spec.ts`)

`screen offset` = top of `main > .screen` inside `<main>` (demo mode puts the demo banner / home tab row, 44-58 px, above it in both
builds); `no-logo` = the same page with the logo row removed (`[data-brand-strip] { display: none }`); `row` = the logo row's top-bottom
in viewport px.

| Width x height | Skin | Route | 2.16.0 screen offset / no-logo | 2.16.0 row | Fixed screen offset / no-logo | Fixed row | `<main>` scroll height 2.16.0 -> fixed |
|---|---|---|---|---|---|---|---|
| 1440x900 | classic | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 900 -> 900 |
| 1440x900 | classic | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5496 -> 5446 |
| 1440x900 | domus | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 900 -> 900 |
| 1440x900 | domus | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5583 -> 5533 |
| 1440x900 | bubble | home | 108 / 58 | 0-50 | 58 / 58 | 8-44 | 900 -> 900 |
| 1440x900 | bubble | settings | 108 / 58 | 0-50 | 58 / 58 | 8-44 | 5714 -> 5664 |
| 1440x900 | crystal | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 900 -> 900 |
| 1440x900 | crystal | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5551 -> 5501 |
| 1440x900 | tesla | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 900 -> 900 |
| 1440x900 | tesla | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5614 -> 5564 |
| 1366x768 | classic | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 830 -> 780 |
| 1366x768 | classic | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5496 -> 5446 |
| 1366x768 | domus | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 854 -> 804 |
| 1366x768 | domus | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5583 -> 5533 |
| 1024x768 | classic | home | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 959 -> 909 |
| 1024x768 | classic | settings | 98 / 48 | 0-50 | 48 / 48 | 8-44 | 5552 -> 5502 |
| 1024x768 | bubble | home | 108 / 58 | 0-50 | 58 / 58 | 8-44 | 1034 -> 984 |
| 1024x768 | bubble | settings | 108 / 58 | 0-50 | 58 / 58 | 8-44 | 5770 -> 5720 |
| 820x1180 | classic | home | 94 / 44 | 0-50 | 44 / 44 | 8-44 | 1301 -> 1251 |
| 820x1180 | classic | settings | 94 / 44 | 0-50 | 44 / 44 | 8-44 | 5643 -> 5593 |
| 820x1180 | domus | home | 94 / 44 | 0-50 | 44 / 44 | 8-44 | 1335 -> 1285 |
| 820x1180 | domus | settings | 94 / 44 | 0-50 | 44 / 44 | 8-44 | 5730 -> 5680 |

Summary: 2.16.0 added a 50 px row (48 px minimum, 36 px logo + 14 px at size `m`) above every desktop / tablet screen; the fixed build
adds 0 px (screen offset equal to the no-logo layout in all 22 cases, scroll height equal). At 1366 x 768 the home screen no longer
scrolls (2.16.0: 830 px of content in a 768 px column; fixed: 780 px, the same as without logos). The logo row (8-44 px) lies inside
the first row: above the page title's bottom, never over the title, a header control or a tab.

## The SmplWise logo itself (owner feedback 2026-10-24, same branch)

The owner: the mint / green SmplWise logo at the top left is not the one of the approved mockup and looks wrong.

- **Which asset was wrong:** `sw-brand kind="product"` drew `frontend/public/brand/smplwise-logo.png` (wordmark) and
  `smplwise-mark.png` (rail mark). Both are the mint artwork of the T007 design baseline (`0a06b58a3`, 2026-09-14), never replaced.
  CR-LOGOS295 section 4 planned an SVG master pipeline (`frontend/brand/`, `brand-assets.mjs`) that was not built ("the existing
  PNGs are used as they are until the owner's file arrives"). So not a fallback and not a theme tint: the wrong file. The approved
  mockup (`private/review/logos-mockup-v3.html`, symbols `#sw-mark`, `#sw-word`, `#sw-word-dark`) draws a blue tile mark
  (`#2767ed`, white S stroke, `#8fe1ff` dot) and the word "Smpl" + "Wise" in Heebo 800.
- **What it uses now:** `frontend/src/components/sw-brand.ts` draws those mockup symbols inline (SVG, not an img, so the word is set in
  the app's own Heebo): light scheme "Smpl" in the placement's text colour (the corner row: `--sw-text-3`, as the mockup's strip) and
  "Wise" `#2767ed`; dark scheme "Smpl" `#ffffff` and "Wise" `#8fb2ff` (`#sw-word-dark`). The rail mark is the mockup's `#sw-mark`.
  This covers every `sw-brand` product placement (the corner row, the rail, the phone home row, the sign-in card, the Settings preview).
  The SVG carries `data-brand-art="mockup-v3-word"` / `"mockup-v3-word-dark"` / `"mockup-v3-mark"` for the specs.
- **Not changed (still the mint PNG, outside `sw-brand`):** the kiosk wall (`screens/kiosk-wall.ts`), the notice-board TV bundle
  (`notice-tv/main.ts` inlines `smplwise-logo.png`), the backend PDF assets. To be replaced when the owner's final logo file arrives
  (the mockup marks its own artwork as a placeholder).
- Screenshots (demo mode, 1440 x 900): `LOGOFIT-295-shots/logo-before-light.png` (2.16.0, crystal, Settings: mint logo in its own
  row), `logo-after-light.png`, `logo-after-dark.png` (same screen, fixed); home screen `home-1440-classic-after.png`,
  `home-820-domus-after.png` (taken before the logo swap: layout only).

## Tests

- New: `frontend/tests/layout-logo-strip-inline-295.spec.ts` (24 tests, `desktop` project; viewports 1440x900, 1366x768, 1024x768,
  820x1180; skins classic, domus, bubble, crystal, tesla; home and settings routes; no-company case; scrolled-page case). It fails on
  the 2.16.0 build (24 / 24 red: the screen offset differs by 50 px) and passes on this branch.
- Updated: `frontend/tests/evidence-brand-logos.spec.ts` and `evidence-white-label.spec.ts` - the product logo is the inline SVG
  (`[data-brand-img="product"]`, `data-brand-art` checked); the upload test scrolls `<main>` back to the top before it looks at the
  corner (the logos hide while scrolled); the size check reads the company logo's height in the row (34 px at `m`,
  51 px at `xl`) instead of the removed `--sw-brandstrip-h` variable.

## Pixel baselines expected to change (Linux, refreshed by the runner at gate time, not here)

Every desktop / tablet baseline that shows the shell's top: the content moves up by 50 px and the logos sit in the corner row. The
SmplWise logo and the rail mark are the mockup artwork now, so phone baselines showing the bottom-bar mark or the home logo row change
too (artwork only, no layout move). The baselines the LOGOS-295B work and the 2.16.0 gate refreshed for the strip (still present):

- `evidence-design-foundation.spec.ts-snapshots/classic-dialog-1440-desktop-linux.png`
- `evidence-design-foundation.spec.ts-snapshots/classic-home-1440-desktop-linux.png`
- `evidence-design-foundation.spec.ts-snapshots/classic-map-1440-desktop-linux.png`
- `evidence-design-foundation.spec.ts-snapshots/classic-settings-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-bubble-drawer-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-bubble-list-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-drawer-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-empty-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-error-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-export-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-forbidden-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-list-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-period-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-stale-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-classic-table-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-crystal-drawer-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-crystal-list-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-domus-drawer-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-domus-list-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-tesla-drawer-1440-desktop-linux.png`
- `pixel-access-events.spec.ts-snapshots/events-tesla-list-1440-desktop-linux.png`
- `pixel-access-s12.spec.ts-snapshots/s12-classic-audit-person-1440-desktop-linux.png`
- `pixel-access-s12.spec.ts-snapshots/s12-classic-checklist-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-bubble-door-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-door-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-draft-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-empty-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-error-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-error-program-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-forbidden-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-paused-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-classic-table-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-crystal-door-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-domus-door-1440-desktop-linux.png`
- `pixel-access-schedules.spec.ts-snapshots/schedules-tesla-door-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-bubble-drawer-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-bubble-list-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-audit-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-busy-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-drawer-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-empty-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-forbidden-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-groups-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-list-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-lower-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-muted-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-not-connected-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-policy-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-classic-stale-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-crystal-drawer-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-crystal-list-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-domus-drawer-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-domus-list-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-tesla-drawer-1440-desktop-linux.png`
- `pixel-access-status.spec.ts-snapshots/status-tesla-list-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-bulk-confirm-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-bulk-form-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-bulk-results-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-bulk-running-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-credential-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-declined-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-form-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-quota-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-sent-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/msg-uncertain-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-bubble-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-classic-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-classic-dark-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-classic-errors-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-classic-service-down-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-crystal-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-domus-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/settings-tesla-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-classic-dark-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-classic-light-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-crystal-light-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-empty-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-error-1440-desktop-linux.png`
- `pixel-wiskey-messaging.spec.ts-snapshots/tab-optout-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/cards-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/drawer-access-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/drawer-classic-dark-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/drawer-classic-light-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/drawer-crystal-light-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/list-classic-dark-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/list-classic-light-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/list-crystal-light-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/msg-bulk-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/msg-quota-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/msg-sent-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/msg-single-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/operator-drawer-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/operator-list-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/selection-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/state-empty-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/state-error-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/state-forbidden-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/state-loading-1440-desktop-linux.png`
- `pixel-wiskey-people.spec.ts-snapshots/state-stale-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-ask-reason-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-cards-classic-light-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-cards-crystal-light-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-cards-remove-ask-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-delete-pending-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-drawer-result-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-editor-timing-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-menu-classic-light-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-menu-crystal-light-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-not-sent-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-photo-ready-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-saved-1440-desktop-linux.png`
- `pixel-wiskey-people-writes.spec.ts-snapshots/writes-unknown-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-bubble-drawer-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-classic-busy-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-classic-drawer-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-classic-no-talk-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-classic-talking-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-crystal-drawer-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-domus-drawer-1440-desktop-linux.png`
- `pixel-wiskey-station-media.spec.ts-snapshots/station-media-tesla-drawer-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-bubble-cards-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-bubble-drawer-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-announce-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-announce-sent-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-cards-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-drawer-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-empty-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-forbidden-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-list-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-release-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-sent-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-settings-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-stale-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-classic-table-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-crystal-cards-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-crystal-drawer-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-domus-cards-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-domus-drawer-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-tesla-cards-1440-desktop-linux.png`
- `pixel-wiskey-stations.spec.ts-snapshots/stations-tesla-drawer-1440-desktop-linux.png`
