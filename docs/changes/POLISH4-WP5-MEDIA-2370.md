# POLISH4-WP5-MEDIA-2370 - multimedia groups / screens, cast-my-screens, generator pages, electricity pages (polish round 4)

Branch `pilot/POLISH4-WP5-MEDIA-2370` on top of `origin/release/2360-train` @ `eb9525d9b` (contains v2.34.2 and 2.35.0). No version bump,
no behaviour or data change, no shared file touched. Skills: impeccable (polish / harden), emil-design-eng. Scope: D19 (page side),
D20, D21; elevators / temperature verified only.

## Corrections to the survey (recorded, not silently resolved)

- D20 / D21 say the generator and electricity pages have "no `@media`". The pages share `gen-styles.ts` (phone <= 767, tablet <= 1100)
  and `electricity/styles.ts` (the same two steps), which already had them; the real gaps were the missing press / hover / focus
  answers, the hex / rgba literals in the generator diagram, the phone history filters and the missing error retries.
- D19 "7 px radii, 4 rgba": the groups page had no px radius left (all tokens); it had 5 rgba shadows and 3 inline px radii in the
  skeleton. It had no `:hover` at all (nothing to gate); the missing piece was press feedback.

## Defects fixed

| # | Screen | Before | After |
|---|---|---|---|
| D19 | Groups page | rgba shadows (play key, slider thumbs), `rgb(var(--art) / .34)`, 999 px / 12 / 14 px inline skeleton radii; links with no press; no tablet step; edit chips pinned to the start edge (over the group icon and the first words of the name); no reduced-motion block | `--dv-shadow-control`, `color-mix` art tints, radius tokens; link press + gated underline; slider thumb lifts while held + focus ring; a 768-1099 px grid / member-row step; chips back at the card end and the title row reserves their width while editing (84 px, 112 px on touch); reduced-motion block |
| D19 | Screens page | header bar shadow `rgba(0,0,0,.08)`, 999 px radii (chips, toast), floor link with no press, 28 px target on touch, skeleton px radii | `--dv-shadow-1`, `--sw-r-pill`, press feedback, 44 px hit area on touch (negative margin: the heading row keeps its height), reduced-motion block |
| D19 | Cast my screens | blocked rows at 0.65 opacity (name under AA); long names could overflow; duration squeezed the name on a phone | quieter by ink (`--sw-text-2`), `overflow-wrap`, duration under the name on a phone, heading margins logical |
| D20 | Generator diagram (`gen-styles.ts`) | `--gen-load #6b5bd6/#a99bff`, `--gen-shadow #1e2e47/#000`, `--gen-base rgba(...)` with per-scheme overrides, `fill:#fff` wire dot, 3 px radius | `--sw-purple`, `--sw-overlay`, `color-mix` of the ink, `--sw-text-inverse`, pill radius; the per-scheme blocks are gone (the token sheet carries both schemes) |
| D20 | Alerts / charts cards | alert rows and clickable chart cards: no press, no focus ring, no hover; an alert row also opened when Enter was pressed on its own acknowledge button, and ignored Space | press (token duration), ring, border hover on a fine pointer only; Enter / Space open the row only when the row itself has focus |
| D20 | Phone history filters | a sideways strip of full-width fields (only the first was in view) | a two-column grid: search and window switch full row, selects in pairs |
| D20 | Phone alert row | the acknowledge button took a third of the row beside the title | title takes the row, the button drops to the end of a second line |
| D20 | States | alerts and log error panels had no retry; a failed live poll was silent; a generator whose own load failed showed a skeleton forever | retry on both panels; "the refresh failed" banner with retry on the live page (the last values stay); error panel with retry on the page shell; `aria-busy` on the loading blocks |
| D21 | Electricity (`styles.ts`) | segmented switch, wizard steps, formula presets / tokens, list rows and menus: no press, no hover, no focus ring; link / row-link / menu hover ungated; tiles 4 -> 2 only at 767 px (a 3 + 1 split risk at 800-900) | one interaction block (press, ring, hover on a fine pointer, reduced motion); gated hover on links and menus; tiles go 2 x 2 from 900 px; primary highlight, progress and legend radii from tokens; px font sizes and radii inline in the settings / wizard / TOU editor / chart legend use the scale |

Left on purpose: the printable bill paper and its chart (`elec-bill-paper.ts`, the `print` chart palette) keep their own colours (a
document, not a screen); the screens page keeps its own copy of the region model (MEDIA 5.1 - shared, WP1 / later); the groups and
screens pages keep `.statebox` (the `bare` state-panel variant is WP1's and has not landed).

Verified, not changed: `infra-elevators.ts`, `infra-temperature.ts` - hover is inside `(hover: hover) and (pointer: fine)`, reduced
motion, a phone `@media`, skeleton and error states are there. Only the `rgba(255,255,255,.35)` inset of the status dot (`.kpi .dot`)
is a literal; the files are outside this package's exclusive list.

## Proposals for other packages

- `generator/gen-chart-set.ts`: the clickable chart card (`div.card.chartcard.clickable`, `@click`) has no `tabindex` / `role="button"` /
  key handler, so it is mouse-only. The CSS ring and press are ready in `gen-styles.ts`.
- `generator/gen-flow.ts`: the node drop-shadow flood opacity (0.35) now multiplies `--sw-overlay` (alpha .45 / .62) instead of an opaque ink, so the
  shadow is lighter than before; raise the flood opacity there if the old weight is wanted.
- `components/media-screen-card.ts` (no package): its edit-mode chip overlap with long titles (MEDIA 5.2) is the card's, as for the player card.

## Tests (real totals)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `playwright.unit.config.ts --workers=1`: unit-token-lint, unit-a11y-polished-lint, unit-dark-polish-beds, unit-electricity-billing, unit-generator, unit-uxfix-nav-295, unit-lead-reserve, unit-uxfix-rtl, unit-media-players-layout | 107 passed, 0 failed |
| Runner capture (`spec`, temporary spec on throwaway branches, base vs this branch): groups, groups edit, screens, cast, 5 generator pages, 6 electricity pages, 5 widths (1920 / 1440 / 1180 / 1024 / 390) x light + dark | 150 + 150 shots, 3 + 3 tests passed; 48 shots differ (see below) |
| Runner `visual --screens multimedia-screens` (committed baselines) | **NOT_RUN**: the runner's test lock was held by a gate / nightly for the 15-minute wait (exit 3) |
| Runner re-capture after the touch-target fix, screens page at 390 px light, base vs branch | 3 passed; 0 changed pixels |

Capture reading (pixel-diff of base vs branch, share of changed pixels): desktop generator alerts / live 0.01-0.28 % (shadow and
colour tokens), groups 1024 px 0.5-0.8 % (the new tablet grid step), generator alerts / history at 390 px 4.6-14.7 % (the filters and
the acknowledge button, intended), screens at 390 px 10 % before the touch-target fix (a 16 px shift) - fixed in `74ddcbf1f`; every
electricity page is unchanged to the pixel except 0.01-0.02 % on the history chart tooltips area (the radius token).

## Baselines

Pixel specs showing these screens: none besides `visual-matrix` `multimedia-screens-ready-{light,dark}-{desktop,tablet,mobile}`.
Expected: unchanged at desktop / tablet (verified by the capture: 0 changed pixels at 1440 / 1024 on the screens page); mobile
unchanged after `74ddcbf1f` (0 changed pixels at 390 light in the re-capture). The visual-matrix itself could not run (lock held); the lead
may confirm it centrally. No baseline was refreshed, none is expected to change.

## NOT_RUN

- Groups edit mode with its chips and the group-name overlap: the demo session cannot enter edit mode (no layout permission), so the
  chip placement is verified by the CSS only. The runner's `evidence-media-players` / `layout-bubble-screens` specs were not run.
- The generator error / failed-poll states and the electricity states other than ready were not captured (code and unit run only).
- Keyboard walk-through of the new focus rings.
