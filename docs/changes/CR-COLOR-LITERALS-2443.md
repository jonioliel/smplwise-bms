# CR-COLOR-LITERALS-2443 - the colour-literal ratchet back to (below) 2512, no pixel change

Design-debt follow-up for 2.43.9. Base: `release/2438-train` at `aa20f05ae`.

## Why

The 2.43.8 train raised the `color-literal` baseline of the design-debt ratchet (`scripts/design_ratchet.py`,
`scripts/design_ratchet_baseline.json`) from 2512 to 2520 with the owner's approval, on the condition that the eight new
literals are cleaned in the next release (`docs/changes/RELEASE-2438-TRAIN.md`, "the design-debt ratchet"): MODAL-STACK +
DIALOG-DRAWER-ONE added sixteen `#000` in `components/sw-drawer.ts` (12) and `components/sw-dialog.ts` (4), PLAN3D-R32 added
five literals, W3-FE removed seven.

The train note calls the sixteen `#000` "sheet shadows"; they are the opaque MASK image of the entrance reveal
(`mask-image: linear-gradient(#000, #000)` in the `sheet-rise` / `drawer-in-rtl` / `drawer-in-ltr` keyframes, whose
`mask-size` is what animates). Shadows were not touched.

## What changed

The ratchet's rule: a hex / `rgb()` / `hsl()` colour counts everywhere in `frontend/src` EXCEPT the token and palette
definitions (`src/design/`), `src/fixtures/` and `*-mock.ts`. A value that lives in a token of `src/design/tokens.ts` is
therefore not a literal, and the component reads it with `var()`.

| Where | Before | After | Literals |
| --- | --- | --- | --- |
| `components/sw-drawer.ts` (3 keyframes, from + to) | `mask-image: linear-gradient(#000, #000)` x 6 | `mask-image: var(--sw-mask-solid)` | -12 |
| `components/sw-dialog.ts` (`sheet-rise`, from + to) | `mask-image: linear-gradient(#000, #000)` x 2 | `mask-image: var(--sw-mask-solid)` | -4 |
| `map/room-pill-view.ts` `:host([data-stack-dark])` (sw-plan-3d, round 28) | `background: linear-gradient(180deg, #060b18 0%, #152442 100%)` | `background: var(--sw-map-stack-night)` | -2 |
| `map/room-pill-view.ts` `:host([data-stack-light])` (sw-plan-3d, PLAN3D-R32) | `background: linear-gradient(180deg, #dfe8f4 0%, #f3f6fa 100%)` | `background: var(--sw-map-stack-day)` | -2 |

Three new tokens in the base table (`src/design/tokens.ts`), each with the exact text that was in the component and ONE value for
both schemes (`same(...)`); no skin, dark rail or look bundle overrides them, so every skin / scheme / look resolves the same value:

- `--sw-mask-solid`: `linear-gradient(#000, #000)` (group `shape`, next to `--sw-glass-sheen`)
- `--sw-map-stack-night`: `linear-gradient(180deg, #060b18 0%, #152442 100%)` (group `canvas`, next to `--sw-map-sky-horizon`)
- `--sw-map-stack-day`: `linear-gradient(180deg, #dfe8f4 0%, #f3f6fa 100%)`

No existing token had these values (`--sw-map-sky` / `--sw-map-sky-horizon` are scheme-dependent and differ: `#dbe7f8` / `#f5f8fc`),
so an existing token could not replace them without a pixel change.

`color-literal`: 2520 -> **2500** (-20; the owner's target was <= 2512).

### Not changed (the other PLAN3D-R32 literals)

Counted file by file across the train's PLAN3D-R32 merge (`b5db2bdee^1` -> `b5db2bdee`), the branch added four literals to the
train tree: `map/room-pill-view.ts` 2 -> 4 (the day backdrop, tokenised above) and `map/floor-finish.ts` 4 -> 6. The two in
`floor-finish.ts` are the new travertine finish (`tint: { light: '#ffffff', dark: '#857f76' }`) - material data read by the 3D
renderer as JavaScript (three.js colours), not CSS: a `var()` cannot stand there, and moving the finish catalogue would be a
refactor, not a swap. They stay counted.

### The baseline

`py -3.12 scripts/design_ratchet.py --update` (it never raises) lowered `color-literal` 2520 -> 2500. The tool lowers EVERY
metric that is below its number, and four others already were on the train (not this branch's work): `px-literal` 25911 ->
25621, `undefined-token` 14 -> 13, `native-select` 582 -> 548, `hand-switch` 378 -> 377. Those four were put back to the
train's numbers by hand, so the committed baseline differs from the train's in `color-literal` only: taking away the slack of
the other metrics would turn a queued branch red for one new `px` value and is the lead's decision, not this change's
(one `--update` on the train does it).

## Proof of "no pixel change"

A custom property is substituted before the computed value is made, so `var(--sw-mask-solid)` computes to the very
`linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))` the literal computed to - provided the token is defined where the component
renders. It is defined on `:root` by the token sheet (`tokensCss()`, injected at boot for every skin); `sw-dialog`, `sw-drawer`
and `sw-plan-3d` are not used by the two pages without that sheet (`notice-tv`, `public-ticket`).

Measured, base (`aa20f05ae`) against this branch, same script, a fresh vite dev server (port 4371) for each side, Chromium:

- 7 skins (`classic`, `domus`, `crystal`, `tesla`, `infra`, `soft`, `bubble` - which resolves to `domus`) x light / dark x desktop
  1440x900 / mobile 390x844 = **28 states**, `look=performance:full`, `motion=full` (so the entrance really runs).
- In each state, for `dir=rtl` and `dir=ltr`: `sw-dialog` (plain, `wide`, `xl`, `fit`) and `sw-drawer` (plain `<aside>`, `modal`
  `<dialog>`) are opened; the entrance animation of the box / panel is restarted, paused and sampled at 0 %, 25 %, 50 %, 75 % and
  99.9 % - the FULL computed style of the element each time; then, when nothing in the page moves any more (shadow trees included),
  the full computed style of the host and of every element in its shadow root with `::before`, `::after` (and `::backdrop`).
- `sw-plan-3d`: the full computed style of the host, plain, `data-stack-dark`, `data-stack-light` and both.
- **9212 rows compared (329 per state), 0 different**, 0 states with an error. The dump is not empty-handed: 1120 samples carry
  `mask-image: linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))` with a moving `mask-size` (`sheet-rise` in 168 cases, `drawer-in-rtl`
  28, `drawer-in-ltr` 28), 28 host styles carry the night backdrop and 56 the day backdrop.

Scripts and dumps (not committed): scratchpad `colorlit\verify.mjs`, `colorlit\vcmp.mjs`, `colorlit\v-base.json`,
`colorlit\v-new.json` (adapted from FE-1's `render.mjs` / `cmp.mjs`). No PNG is committed; no pixel baseline changes.

## Tests actually run (this workstation; no runner, no entry check - by instruction)

| Check | Result |
| --- | --- |
| `py -3.12 scripts/design_ratchet.py` | exit 0 - `color-literal` 2500 (baseline 2500), no count above the baseline |
| backend `pytest tests/test_build_guards_2438.py -p no:xdist` (the ratchet's own tests, `test_the_checkout_is_at_or_below_its_baseline` among them) | 10 passed |
| `npx tsc --noEmit` | exit 0 |
| node-only unit specs, `--project=desktop --workers=1` (21 files): `unit-design-tokens`, `unit-designtokens-297`, `unit-token-lint`, `unit-skinfound-297`, `unit-skincomp-297`, `unit-motionsetting-297`, `unit-polish-classic-domus-297`, `unit-polish-phone-297`, `unit-dialog-toplayer-2381`, `unit-modal-stack-2441`, `unit-no-native-dialogs`, `unit-home-edit-drawer`, `unit-plan3d-r28-ui`, `unit-plan3d-r32-answers`, `unit-pill-layout`, `unit-still-bake`, `unit-menu-surfaces`, `unit-menu-lint`, `unit-palettes`, `unit-a11y-polished-lint`, `unit-glass-bridge-audit30a` | 175 passed |
| computed-style comparison base vs branch (above) | 9212 rows, 0 different |
| `tests/evidence-dialog-drawer-one-2439.spec.ts`, `--project=desktop --project=mobile --workers=1`, against the dev server (the dialog as a phone sheet, the drawer, every skin; its screenshots go to the ignored output folder) | 34 passed, 2 skipped (the spec's own skips) |

NOT_RUN: the full unit / layout / pixel suites and the runner entry check (the lead's instruction for this task: push and
report); `vite build` (the comparison ran on the dev server).

