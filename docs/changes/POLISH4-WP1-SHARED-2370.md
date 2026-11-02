# POLISH4-WP1-SHARED-2370 - polish round 4, WP1: shared stage 2 + the shell's floating pill

Branch `pilot/POLISH4-WP1-SHARED-2370`. Scope: the WP1 row of `private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md` (D1, the shared
part of D28, D29 check, the shared stage-2 items with the owner answers Q2a / Q3a / Q7b, MEDIA 5.2 / 5.3). Refinement only: no menu,
tab, widget, logo, title or control order moved. New variants are opt-in; the one deliberate look change is the settings key (Q3a).

## Defects and items

| Item | Before | After | Files |
|---|---|---|---|
| D1 shell pill, user without the settings right | A bare 28 px `span.sysdot` with `role="img"`: no label on touch (only a `title` tooltip), no affordance | The same dot is a key (`aria-haspopup="dialog"`, `aria-expanded`) that opens a small read-only note under the corner: "מצב המערכת: …" and the components behind it. No link (it would end on a refusal). Closes on a second press, a press outside, Escape, or a route change; the search panel takes precedence. `data-sys-pill` / `data-sys-static` kept | `shell/sw-app.ts` |
| D1 hover | `.float button:hover` on every pointer: a tapped key stayed tinted on touch | The wash only under `(hover: hover) and (pointer: fine)`; an open key keeps it; a press wash on `:active` (pointer-down) | `shell/sw-app.ts` |
| D1 hit area | 28 px + `::after inset:-6px` = 40 px on a desktop pointer | `inset:-8px` = 44 px; the touch rule (44 px wide key) is unchanged | `shell/sw-app.ts` |
| D29 phone buttons | - | Shipped in 2.34.2 (PHONE-BUTTONS-44-2342). Not redone | - |
| D28 shared contrast | - | All five light items were fixed in 2.34.2 by A11Y-POLISHED-2342 (NVR box edge, insights KPI dot, plan star, NVR unknown text, the toast failure icon through the shared `styles/media-page.ts` recipe). Nothing left in shared code; verified in the source | - |
| `sw-drawer` footer end | A slotted footer container is a flex item, so `margin-inline-start:auto` inside it did nothing | New slot `footer-end` at the far end of the footer row (destructive actions). Opt-in; the footer shows when either slot has content | `components/sw-drawer.ts` |
| `sw-sheet` footer + surface | Translucent glass under long forms; the `footer` slot already existed (outside the scrolling body) | New `solid` attribute: `--sw-surface-solid`, no backdrop blur. Opt-in. Footer slot documented | `components/sw-sheet.ts` |
| `sw-table hideBelow` | Screens dropped secondary columns with their own media query | `TableColumn.hideBelow: 'phone' \| 'tablet'` (below 768 / 1024 px). Unset = unchanged | `components/sw-table.ts` |
| `sw-table focus-rows` | - | Ready since SHARED-POLISH-2342 (opt-in attribute); screens switch it on in their own packages | - |
| `sw-state-panel bare` (Q2a) | An empty / error state inside a card drew a hero card in a card | `bare`: no surface, shadow or resting height; 48 px tile, 17 px heading, small retry button; states, retry and entrance unchanged. Opt-in | `components/sw-state-panel.ts` |
| One settings key style (Q3a) | `settingsSegStyles`: accent-filled, divided keys with a strong border | The pill-thumb key of the look settings: surface-3 track, 3 px inset, 2 px gaps, no dividers, the selected key a lifted thumb (surface + shadow 1, label in `--sw-accent-text`; dark: `--sw-seg-thumb` / `--sw-seg-thumb-shadow`). Every part is still a `--sw-seg-*` knob, so the glass host (system-tickets) is unchanged | `styles/settings.ts` |
| `.foot.sticky` (Q7b) | - | Present since SHARED-POLISH-2342 in `settingsKitStyles` (part of `settingsStyles`). On a phone the shell's `main` ends above the bottom bar, so the sticky row stays above it. Adoption is per screen (WP7 / WP8) | - |
| `--sw-well` token | A knob on the settings ladder host only | A control token in `design/tokens.ts` (same recipe). The ladder still re-declares it on its host (a glass host keeps its own well). Every current user sits under a ladder host, so no pixel moves | `design/tokens.ts` |
| notices `tr.go:hover` | The wash on every pointer; the home notices page cancelled it locally | Gated to a hovering fine pointer at the source (the local cancel in `devices-notices-css.ts` is now redundant, left to WP4) | `notices/styles.ts` |
| D19 player-card edit chips (MEDIA 5.2) | In edit mode the absolutely placed chips covered long titles at 1440 | The card measures its `edit` slot (ResizeObserver, `--mm-edit-w`) and, while `editing`, the text column keeps that much room at its end: the name ellipsizes before the chips | `components/media-player-card.ts` |
| Remote editor scroll (MEDIA 5.3) | A sticky box stops at the scroll box's padding edge: rows showed in a 14 px strip above the "ביטול / שמירה" bar | While editing, the drawer body has no top padding (`::part(body)`) and the editor carries the 14 px itself: at rest nothing moves, scrolled the bar meets the top edge | `components/media-remote.ts`, `components/media-remote-css.ts` |

Not done here: the maintenance sheet `maintenance/styles.ts` has the same ungated `tr.go:hover` (WP3 area); the media-page region model
(WP5); the cumulative paging measure (behavioural).

## Tests (real totals)

| Check | Where | Result |
|---|---|---|
| `npx tsc --noEmit` | workstation | exit 0 |
| Unit specs touching the changed files (33 files) | workstation, `--workers=1` | **243 passed / 0 failed** |
| New `tests/unit-polish4-shared.spec.ts` (source guards + light contrast of the settings key, every live skin) | workstation | **10 passed / 0 failed** |
| `evidence-shell.spec.ts --grep "status dot"` (updated: the viewer's dot opens the note, no link, Escape closes) | runner, preview | **3 passed** (desktop, tablet, mobile) |
| Visual matrix `--all` (72 shots) | runner | branch: 58 pass / 14 differ; base `release/2360-train @ 44b8383c2`: the same 58 / 14. All 14 branch "actual" images are **pixel-identical** to the base's (PIL difference bbox = none): the 14 are stale baselines on the base, not this branch |
| `pixel-wiskey-people`, `pixel-access-status`, `pixel-access-s12`, `pixel-wiskey-messaging`, `pixel-bustimes-295`, `pixel-notice-tv-mock` | runner, `--workers=1` | branch 60 passed / 25 failed / 65 skipped; base the same 60 / 25 / 65 (failures are pre-existing: wiskey-people mobile, wiskey-messaging, access-status / s12 desktop) |

## Baselines

- Visual matrix: none moved by this branch (proved above). The 14 differing shots differ on the base too (settings-diagnostics,
  devices-schedules dark, devices-home dialog mobile, map-floor mobile, security-alarm mobile) - for the lead's central refresh.
- Expected to move when captured (no pixel spec covers them today): settings screens that use the shared `.seg` - system-automations,
  system-schedules, system-multimedia, system-plan-view, system-brand-logos, the tickets settings cards (`tickets/*`), the home edit
  panel and `sw-list-display-settings`. The tickets settings page keeps its glass knobs and does not change.
- The shell pill: no resting-pixel change (the hit area is an invisible `::after`; on a coarse pointer a viewer's dot is now 44 px
  wide like the admin's).

## NOT_RUN

- Full unit suite (only the 33 touching files + the new spec), full pixel suite, evidence captures of the settings keys at
  1920 / 1440 / 1180 / 1024 / 390 (runner time is for the gates tonight).
- No visual check of `bare`, `footer-end`, `solid` and `hideBelow` in a screen: no screen uses them yet (opt-in by design).
