# DARK-REVIEW-2342 - dark-mode review of the screens polished on 01.11

Owner-approved task (2026-11-01). Branch `fix/DARK-REVIEW-2342` from `release/2340-train` @ 24e128583.

Scope: every screen the 01.11 branches touched. That is the *-POLISH-2331 round (tickets, tickets settings, devices, access,
calendars and messaging, media, doors / insights, WisKey stations and water, look, camera admin, schedules, investigation, events,
home editing, setup and plan, tabs display), SHARED-POLISH-2342, OWNER-R12-2341, POLISH-LEFTOVERS-2341, LIVE-H265-2341 and
NVR-H264-BULK-2341. In git terms that is `52a8d9129..24e128583 -- frontend/src`: 122 files, about 9,000 added lines.
Nobody took a dark screenshot on 01.11.

## Method

1. **Static scan of the added CSS** (scratch script over the diff). It looked for hex / rgb / named-colour literals, `--sw-*`
   names with no entry in `design/tokens.ts`, `color-mix` toward white or black, and opacity on text. Result: no literal colours
   except the `#000` mask stops of fades, which are allowed. The untabled names were `--sw-well`, which `styles/settings.ts` defines
   and which always has a `--sw-surface-2` fallback, and `--sw-float-reserve`, a size. No icon or SVG had a light-only fill. Every
   token has a dark value.
2. **Contrast of the mixed beds.** The polish branches drew new fills as colour mixes of a token over a surface: a selected row is
   accent 22-32 % over the surface, a failed row is danger 8-10 % over surface-2, the KPI tiles are tinted by their state colour,
   and there is the settings well. The existing guards (`unit-muted-contrast`, `unit-dark-muted-contrast`) only measure inks on the
   plain token beds. The new `tests/unit-dark-polish-beds.spec.ts` evaluates each pair the way the CSS writes it: `var()` chains
   with fallbacks, `color-mix(in srgb, A p%, B q%)` including an under-100 % total, alpha compositing over the card and the page,
   and the ink's own opacity. It runs per live skin (classic, domus, tesla, crystal, infra, soft; bubble is frozen), on the dark
   column. The thresholds are 4.5:1 for text and 3:1 for icons and control boundaries (WCAG 1.4.3 / 1.4.11). It has 55 pairs per
   skin. A second test checks that the modelled values are the CSS the screens ship.
3. **Visual: NOT_RUN.** The runner was running the full L release gate of `release/2332-train` (1 h 41 min in, load about 38, lock
   held). A preview job would have queued behind it for more than the 20 minutes allowed, so no dark captures at 1440 / 390 were taken.

## Findings and fixes (dark column, worst skin unless noted)

| Screen | Issue | Fix | Contrast before | Contrast after |
|---|---|---|---|---|
| NVR H.264 batch (`screens/nvr-camera-batch.ts`) and bulk encoding (`screens/nvr-encoding-batch.ts`) | The edge of an unchecked box (2 px `--sw-border-strong`) was nearly invisible on the dark row, so an unchecked camera or stream showed no checkbox | Dark only: `border-color: light-dark(var(--sw-border-strong), color-mix(in srgb, var(--sw-text-3) 70%, transparent))` | 1.55 infra · 1.78 classic · 1.90 soft · 2.03 crystal · 2.04 domus · 2.28 tesla (need 3) | resting 3.62-4.26 · hovered row 3.21-3.49 |
| NVR H.264 batch | A checked row on hover (accent 32 % over the surface) lifted the bed, so the `--sw-text-2` meta line fell under 4.5 with the light dark-scheme accents | Dark hovers at 28 % (light keeps 32 %) through `light-dark()`; the old 32 % rule stays as the fallback | crystal 4.33 · domus 4.43 | crystal 4.77 · domus 4.82 (others 5.5-6.7) |
| Water meters (`screens/water/page-meters.ts`) | The count on the chosen (accent-filled) area was at opacity 0.85 | Full ink. The bold name keeps the hierarchy | classic 3.76 · soft 3.72 · infra 3.92 | classic 4.56 · soft 4.53 · infra 4.77 |
| Insights filter chips (`insights/styles.ts`) | The count inside a selected chip was at opacity 0.8, accent-text on accent-soft | `.chip.sel .n { opacity: 1 }` (the resting chip keeps 0.8, which reads 5.4-6.4) | domus 4.47 | 6.03-7.16 |
| Home editing (`screens/home-edit-panel.ts`) | The phone line of an "off" widget was at opacity 0.6, and its placement select is still live | Muted ink `var(--sw-text-3)` instead of the opacity (the same step back as the name) | 3.36-3.78 (every skin) | 5.55-6.06 |

**Checked and passing in dark**, no change needed (worst skin):
- privacy-mask banner, current camera / region, diverged history, skipped review card and dialog count: ≥ 4.9
- NVR batch failed / unknown rows: ≥ 4.65 (crystal danger-text)
- insights KPI tiles tinted by danger / warning, heading and secondary lines: ≥ 5; the KPI dot: ≥ 4.19
- primary buttons, the plan-view range and the calendars chip, white or inverse on the accent: 4.53-4.77 (thin but passing, a shared token)
- event filter chip hover: ≥ 5.17
- area-link rows: ≥ 5
- settings well, settings hover row and messaging well: ≥ 5
- cast / players error text: ≥ 5
- toasts (text, action, success icon, the mixed failure icon, the bare danger icon of tickets settings / RFQs): ≥ 3.33 for icons
- the default-position star of plan studio: ≥ 3
- synoptic lights hover: ≥ 9

Not measured on purpose: the 30 % danger hairline of the cast / players error card. It is decoration on a card that is already
tinted, and the card's text states the error, so it is not a 1.4.11 boundary.

## Not fixed - for the owner

1. **Segmented controls in dark** (product-wide, 28+ places: `.seg button[aria-pressed='true'] { background: var(--sw-surface) }`).
   On the dark `--sw-surface-3` track the selected thumb is *darker* than the track (about 1.25:1). It reads as a hole rather than a
   raised thumb; the selection still shows through ink and weight. Fixing it needs a shared thumb token with a lifted dark value, as
   the glass screens already have with `--mm-seg-thumb`. That is a product decision and would change many baselines, so it is not
   in this branch.
2. **Light-scheme fails found by the same model** (out of this review's scope; dark pixels were the brief):
   - the unchecked NVR box edge: 1.3-2.0
   - the insights KPI dot in light: 1.75-2.97
   - the plan-studio star (`--sw-warning` on white): 2.0-2.15
   - the NVR "unknown" row text (`--sw-warning-text` on the warning mix): 4.29 classic
   - the bare `--sw-danger` failure icon on the light toast: 2.8-3.0 in domus / tesla

   The water count, the selected insights chip count and the off-widget phone line were fixed in both schemes, because the same
   CSS line was the cause.
3. **`light-dark()`** is new in this codebase: Chromium 123+, Safari 17.5+, Firefox 120+. An older engine drops the declaration
   and keeps today's edge or hover, so it degrades to the current look. I chose it over `:host-context(html[data-theme='dark'])`
   because Safari and Firefox do not support `:host-context`.

## Baselines likely affected

- **Pixel baselines: none expected.**
  - `pixel-nvr-encoding-batch` runs `scheme=light` and the light branch of `light-dark()` keeps `--sw-border-strong`, so its PNGs
    should not change.
  - No pixel spec covers water meters, insights or home editing.
- **Evidence screenshots that change (they are not compared):**
  - `evidence-nvr-cameras-write` dark shots: the batch picker, if it is shown
  - any water, insights or home-edit evidence shot showing a chosen area count, a selected chip count or an off widget, in both schemes

## Tests

- `npx tsc --noEmit`: clean.
- Unit, `--workers=1`: 55 passed across `unit-dark-polish-beds` (new, 2 tests), `unit-token-lint`, `unit-menu-lint`,
  `unit-dark-muted-contrast`, `unit-muted-contrast`, `unit-design-tokens`, `unit-empty-state-icons`, `unit-entity-id-sweep` and
  `unit-nvr-h264-preset`.
- Visual dark capture at 1440 / 390: **NOT_RUN** (runner busy with the release gate).
