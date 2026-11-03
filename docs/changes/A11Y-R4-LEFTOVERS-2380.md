# A11Y-R4-LEFTOVERS-2380 - the five items "not fixed" in the 2.37.0 accessibility pass

Branch `fix/A11Y-R4-LEFTOVERS-2380`, cut from `origin/release/2370-train` (a81f96aa6, 2.37.0). No version bump, no backend change, not merged,
no tag. Input: the "Not fixed" list of `docs/changes/RELEASE-2370-TRAIN.md`. Refinement only: no menu, tab, widget or control-order change;
tokens only (the one literal is the 44 px WCAG target).

## What changed

| # | Leftover | Change | Files |
|---|---|---|---|
| 1 | Plan editor icon bar 36-40 px on touch | The desktop key stays 26 px. On `pointer: coarse` the drawn key stays `--sw-ctl-h-lg` (so the bar does not widen or wrap on a tablet) and an invisible `::after` layer brings the hit area to 44 px: `inset: min(0px, calc((var(--sw-ctl-h-lg) - 44px) / 2))`, i.e. 2-4 px past the key. The bar's gap is 8 px, so two neighbours never overlap (the failure mode of the reverted 2342 hit-layer attempt) | `screens/explore-plan-editor.ts` |
| 2 | Off track of the switch below 3:1 | New token `--sw-toggle-off` (light `#6f7a90`, dark `#7b869e`; bubble overrides `#66708a` / `#ada5c0` because its opaque lilac surfaces are light). Read by `sw-toggle` and by every switch that drew its own track from `--sw-border-strong`: incidents settings, security alarm, access messaging, access policy, brand installer, privacy masks, public security, WisKey person messages; the tesla ring switch draws its ring with it. Computed >= 3:1 against bg, solid surfaces, glass over bg, nav glass, domus blooms and the hovered-row fill, in all 6 skins x 2 schemes; the white thumb stays >= 3:1 on it (bubble dark 2.35: the track has to be lighter than any grey that holds a white thumb at 3:1, and the knob's shadow draws its edge) | `design/tokens.ts`, `design/skins/bubble.ts`, `design/skins/tesla.ts`, `components/sw-toggle.ts` + the 8 screens above |
| 3 | Status-pill note takes no focus | A keyboard open (a click with `detail` 0: Enter / Space) moves the focus onto the note (`tabindex=-1`, focus ring only for `:focus-visible`); a pointer or touch open leaves focus alone. Escape (already wired) closes and returns focus to the key. Tab out of the note closes it behind the focus (it is not modal, so no trap; a focus that leaves the window keeps it open). `aria-expanded` follows the state; `aria-controls="sys-pop"` only while the note exists | `shell/sw-app.ts` |
| 4 | Sticky save row at 390 px | Verified by code: all six rows (`styles/settings.ts` kit, notifications settings, retention, access messaging, announce templates, presence; the diagnostics rows use the kit) are `position: sticky` in the flow, none is fixed, and the phone shell gives `main` its own grid row above the bottom bar. At the end of a page a sticky row sits in its own place, so it covers nothing and a bottom padding equal to the row would only add dead space - not added. The one real gap was focus: a field that takes focus right under the pinned row was left behind it (WCAG 2.4.11), so the phone `main` scroller got `scroll-padding-block-end: calc(var(--sw-s-2) + 66px)` (row = 44 px key + 2 x 10 px padding + 2 px border, 8 px above the edge) | `shell/sw-app.ts` |
| 5 | `sw-tabs` was `aria-pressed` buttons | A real tablist: the row is `role="tablist"` (named by `group-label` when given), every entry `role="tab"` with `aria-selected`, roving tabindex (the selected tab is the one Tab stop, the first when none is selected), arrows (RTL aware) / Home / End on the tablist (already there, kept: focus moves, Enter / Space opens - manual activation), Space opens a link tab. A link tab keeps its `href` and `aria-current="page"` (the shell nav and many specs read it) and gains `role="tab"` / `aria-selected`. New optional `panel` attribute: the id of the content element, which becomes `role="tabpanel"` named by the selected tab's label (an id reference cannot cross the shadow root, so `aria-labelledby` is not possible); used by settings > infrastructure and the notices board settings. The dropdown form and the look are untouched | `components/sw-tabs.ts`, `components/tab-strip.ts` (`rovingStop`), `screens/system-infra.ts`, `screens/system-notices.ts` |

Behaviour change worth knowing: the unselected tabs of a strip are no longer Tab stops (roving tabindex is the ARIA pattern); they are reached
with the arrow keys. Specs that pressed Tab to reach the next tab were updated.

## Specs touched (selectors that depended on the old roles)

- `tests/evidence-shell.spec.ts`: `sw-tabs button[aria-pressed="true"]` -> `button[role="tab"][aria-selected="true"]`.
- `tests/evidence-pwa-push.spec.ts`: `getByRole('link', { name: 'התראות' })` (a sw-tabs anchor) -> `getByRole('tab', ...)`.
- `tests/evidence-tabs-styles.spec.ts`: the WisKey pill strip reached the next tab with Tab; now ArrowLeft (RTL), plus asserts of the tablist roles.
- The polished lint (`tests/unit-a11y-polished-lint.spec.ts`: a `role="tablist"` must carry `@keydown`) stays green: the handler is on the row.
- `a11y-polished-2342` has no sw-tabs coverage; it is unaffected.

## Tests

| Spec | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `tests/unit-a11y-r4-leftovers-2380.spec.ts` (new, node): tablist keys LTR / RTL / Home / End, roving stop, sw-tabs source contract, plan editor hit layer, status note focus, sticky row | passed (inside the 333 below) |
| `tests/unit-switch-contrast-2380.spec.ts` (new, node): `--sw-toggle-off` >= 3:1 on every bed, 6 skins x 2 schemes, thumb >= 3:1 (bubble dark 2.3), every own-track switch reads the token | 4 tests passed |
| 58 unit spec files with names matching token / dark / menu / polish / tabs / tab-strip / contrast / a11y / design / lint / switch / toggle / shell / plan / status / sys / css (includes both new specs, `unit-a11y-polished-lint`, `unit-tab-strip`, `unit-token-lint`, `unit-menu-lint`, `unit-dark-polish-beds`, `unit-muted-contrast`, `unit-dark-muted-contrast`, `unit-design-tokens`, `unit-polish4-*`), `--workers=1` | **333 passed, 0 failed** (about 25 min on a loaded workstation). The full node unit suite (3.7k tests) was not re-run |

## Browser specs to run on the runner (NOT_RUN here: no runner tonight)

1. `tests/a11y-r4-leftovers-2380.spec.ts` (new): sw-tabs tablist roles, one tab stop, arrows / Home / End, tabpanel marking.
2. `tests/a11y-polished-2342.spec.ts`, `tests/a11y-dialog-focus-2310.spec.ts`, `tests/layout-a11y-295.spec.ts` (the existing a11y beds; the 44 px cross probe covers the shared controls).
3. `tests/evidence-tabs-scroll-2331.spec.ts` (arrows / Home / End and the reveal still work on the tablist), `tests/evidence-tabs-styles.spec.ts`, `tests/evidence-tabs-ui.spec.ts`, `tests/evidence-tabset-293.spec.ts`, `tests/evidence-infra-tabs.spec.ts`, `tests/evidence-tabs-live.spec.ts`, `tests/evidence-tabs-pair.spec.ts`.
4. `tests/evidence-shell.spec.ts` (status dot note, desktop / tablet / mobile - open with the keyboard and check the focus is in the note, Escape returns it), `tests/evidence-pwa-push.spec.ts`.
5. The plan editor on a coarse pointer at 768-1199 and 390: `tests/pixel-walk-touch.spec.ts`, `tests/evidence-plan-studio-4.spec.ts` (the bar must not wrap or grow; probe a 44 x 44 box around each `.bar button.icon`).
6. The switch screens, light and dark, every skin that is in the matrix: `visual-matrix` (settings-notifications, settings-security, security-alarm, access screens), `tests/evidence-switchui-295.spec.ts`, `tests/evidence-protected-switches.spec.ts`, `tests/evidence-switch-light-dimmer-2331.spec.ts`.
7. Phone 390 px, settings screens with a sticky save row (notifications, retention, presence, access messaging, announce templates, diagnostics tabs): focus the last field above and below the pinned row and check it is not under it.

## Baselines expected to move (for the lead's central refresh on the train)

- Every picture that shows an OFF switch: the track gets darker in light (about 1.2:1 -> >= 3:1 on the card) and lighter in dark - `visual-matrix` shots of
  settings-notifications, security alarm / public security, access messaging / policy, incidents settings, the brand installer, the privacy masks, and any screen with a `sw-toggle`
  (automation rows, schedules, access, calendars). Tesla: the off ring is stronger. Review each diff: only the off track / ring may change.
- Phone screens: nothing resting changes from `scroll-padding` (it only affects scroll-into-view).
- The plan editor bar: no resting pixel change (the hit layer is invisible); `sw-tabs` strips: no resting pixel change (attributes only).

## Not done / for the owner

- Switches drawn from the device-glass palette (`--dv-surface-3` tracks in automation rows / schedules) use `sw-toggle` inside and so get the new token; no separate glass track exists.
- A bubble palette preset (design/palette.ts) that changes the surfaces is not in the contrast test (it checks the skin token tables); if a preset moves the surfaces, `--sw-toggle-off` should be re-checked against it.
- `sw-tabs` link tabs carry both `aria-current="page"` and `aria-selected`; screen readers read the tab pattern, navigation specs keep their selector.
