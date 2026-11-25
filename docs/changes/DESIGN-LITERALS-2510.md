# DESIGN-LITERALS-2510

2.51 cleanup row. RELEASE-2500-TRAIN section 2 (`9c91fca72`) raised the design ratchet for the literals four 2.50 rows added
(colour-literal 1984 -> 1986, px-literal 25462 -> 25612), kept by the lead's decision on 24.11 as a later cleanup. This row
tokenises them without a visible change, and turns the camera wizard's "same user and password for all" check box into the compact
switch (section 5 of the train note). Branch `pilot/DESIGN-LITERALS-2510`, cut from `origin/release/2500-train` at `60fc78e3d`.

## What changed

Only equal-value substitutions (no computed value changes in any skin, look, density or theme):

- **Spacing scale** `--sw-s-1` 4 / `-1h` 6 / `-2` 8 / `-3` 12 / `-3h` 14 / `-4` 16 / `-4h` 18 / `-5` 20 / `-6` 24 / `-8` 32 for the
  `gap`, `padding*` and `margin*` values (also inside `clamp()`). These tokens are `same()` in `design/tokens.ts` and no skin, look
  dial (`design/look.ts`) or density bundle overrides them, so the value is the literal's everywhere. The home module already reads
  them (80 uses in `home/`).
- **`--sw-check-size`** (18 px, the native box size knob of SHARED-CHECKBOX-2480) for the two remaining native boxes 18 x 18
  (`camera-discovery-dialog.ts` device row, `sw-home-admin.ts` `.chk input`).
- **`--hs-black`** (`#000000`, defined once in `home-styles.ts`, the same in every theme and scheme) for the wall panel night layer
  `.wdim` (`#000`): colour-literal back to 1984.
- **Dead fallbacks dropped**: `var(--hs-shadow-3, 0 12px 32px rgb(0 0 0 / .35))` -> `var(--hs-shadow-3)` (the token is set on the
  home host in both schemes; `home-styles-extra.ts` is only ever loaded after `home-styles.ts`), `var(--f-sm, 14px)` -> `var(--f-sm)`
  (same), and the px fallbacks of `--sw-*` tokens that `tokens.ts` always declares on `<html>` (`--sw-gap-lg`, `--sw-fs-*`,
  `--sw-r-lg` / `-md`, `--sw-ctl-h-md`). A fallback is never used while its token is defined, so the rendering is unchanged.

| File | px-literal (2.49.0 -> train -> here) | colour-literal |
|---|---|---|
| `components/camera-discovery-dialog.ts` | 0 -> 87 -> 44 | 0 |
| `home/home-wall-rest-styles.ts` | 0 -> 43 -> 27 | 1 -> 0 |
| `home/home-styles-extra.ts` | 68 -> 80 -> 59 | 1 -> 0 |
| `home/sw-home-admin.ts` | 91 -> 99 -> 47 | 0 |

The older spacing literals of the same four files were tokenised too (same rule), which is why `home-styles-extra.ts` and
`sw-home-admin.ts` end below their 2.49.0 counts.

**The one visible change** - the camera discovery wizard, step 2 "זיהוי": "אותו משתמש וסיסמה לכל המסומנות" is the compact
`sw-toggle` (HAND-SWITCH-2480 pattern: `size="sm" labelHidden in-label`, the label text stays the accessible name, a press on the
text flips it; the `data-discovery-same` hook moved to the switch host; `toggled(e)` reads the value). The row's `.check` label
(gap, font, 32 px row) is kept; the dead `.check input` rule is removed. Logic unchanged (`identifyBlock` still needs it on for several
cameras). Compare page: `private/planning/design_literals_2510_compare_2026-11-24.html` (not in the repository).
`camera-discovery-2500.spec.ts` presses the switch and checks its `checked` attribute instead of `check()` / `uncheck()`.

**Design ratchet** (`scripts/design_ratchet_baseline.json`, `--update`): colour-literal 1986 -> **1984** (= 2.49.0), px-literal
25612 -> **25482** (2.49.0: 25462; +20 left, see below), hand-switch 161 -> **160**.

### Literals kept (no token of the same value, or the token changes with the skin / look)

- 1 px / 2 px borders and hairlines, the 2 px / 3 px / 9 px / 10 px off-scale gaps and paddings (`10px` has no step: `--sw-s-2` is 8,
  `--sw-s-3` 12).
- Radii `8px` / `10px` / `999px`: the radius tokens follow the look dial (`pill` / `soft` / `square`) and the Tesla skin
  (`--sw-r-pill` 6 px) - a token would change those looks.
- Font sizes in px (`13px`, `14px`, the wall rest screen's `clamp()` sizes): the `--sw-fs-*` steps differ per skin and the home `--f-*`
  steps per breakpoint / large text.
- Fixed sizes: the wizard's preview thumb 132 / 112, password field 160, list width 520, spinner 12, progress bar 8, row heights 32 / 44,
  icon sizes 16 / 18 / 22; the wall rest screen's widths (760 / 980 / 220), its icon disc `clamp(72px, 14vmin, 112px)`, the top clamp
  bound 56, the focus ring `3px` / `-6px` (the home focus ring is 3 px, `--sw-focus-w` is 2).
- Media queries (`max-width: 700px / 767px / 899px`) and the wizard's `matchMedia('(max-width: 767px)')`: a custom property cannot
  be used in a media query.

## Tests

Workstation: `scripts/design_ratchet.py` (Python 3.12) - no count above the baseline after `--update` (colour 1984, px 25482,
hand-switch 160). Nothing else ran on the PC (memory rule of the night).

Runner, one job on slot B (`~/work/literals2510_job.sh 60fc78e3d 8baf2a36d`, 24.11 14:41-14:50Z; "before" = the 2.50 train head the
branch was cut from, "after" = this branch; both built with `vite build` and served by `vite preview`):

| Check | Result |
|---|---|
| `tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` (after) | 0 errors / 0 errors |
| ESLint of the 4 changed source files (the 2 spec files are on the ESLint ignore list) | 0 errors |
| `design_ratchet.py` (after) | rc 0, no count above the baseline |
| Backend `test_build_guards_2438.py` + `test_scroll_allow_2480.py` | **15 passed** |
| Unit specs `unit-camera-discovery-2500`, `unit-design-tokens`, `unit-designtokens-297`, `unit-sw-checkbox-2480`, `unit-i18n-home` | **49 passed** |
| `vite build` before / after | rc 0 / rc 0 |
| Pixel specs with Linux baselines, NO `-u`: `pixel-home-auditfix-2437`, `pixel-home-fb-2431`, `pixel-home-gaps-2436` (desktop + mobile) | after **24 passed, 4 skipped** (before: the same 24 / 4) |
| `pixel-home-next-2500` (no committed baseline: written by the "before" build with `-u`, then the "after" build compared to it without `-u`; covers the "מסכי קיר" settings tab) | before `-u` 10 passed; after **10 passed** |
| `camera-discovery-2500.spec.ts` (the updated switch steps), light and dark, desktop + mobile | after **10 + 10 passed** (before, its own spec: 10 + 10) |
| Capture specs, both builds: `home-wall-night-2500-shots`, `home-next-2500-shots`, `home-favorites-2500-shots`, the new `design-literals-2510-shots` (home administration: 4 tabs x desktop / phone x light / dark), the camera wizard's 8 steps x desktop / mobile x light / dark | all passed at both builds; 98 PNG pairs |

**Pixel comparison of the 98 capture pairs.** The capture specs are not pixel-stable on their own (the favourites screens run on the
real clock, the time-of-day background tint moves, a toast fades in the bottom corner, the alarm takeover pulses), so a noise baseline
was measured: a second job (`~/work/literals2510_noise.sh`, 16:01-16:08Z) captured before (A), after (B), before again (C) on the same
builds. A vs C (the same build twice) already differs in 28 files. Every file that differs between before and after falls in one of:

- **The switch** (expected): the wizard's identify, identify-results and recorder-prefill steps, desktop and mobile, light and dark -
  the difference is the row of "אותו משתמש וסיסמה לכל המסומנות" only (bounding box of the row; A vs C 0 there).
- **Run-to-run noise of the same build**: the files that also differ A vs C (same regions: clock digits, the bottom-left toast,
  the alarm pulse, the favourites time-of-day tint).
- **Anti-aliasing of single pixels** (max channel difference 1-4 of 255, 3 pixels): `admin-users-d1440-dark` (the edge of the
  settings menu pill), `homenext phone-dark-room` (a tile corner), `cam result / scan-running` (31-81 pixels, max 1-2).
- **Favourites captures**: a third job (`~/work/literals2510_rep.sh`, 25.11 04:14Z) ran the favourites captures 3 x per build,
  alternating. They vary between runs of the SAME build (before1 vs before3: 250,076 pixels on the grid), and "after" runs reproduce
  the "before" states exactly where the run settles the same way (`x-grid-phone` after2 vs before1 = 68 pixels, the same as before2 vs
  before1; `x-add-phone` 0 for all six runs).

No difference outside the switch row is larger than the same build's own run-to-run noise; the layout (positions and sizes) matched in
every inspected crop. Compare page for the switch: `private/planning/design_literals_2510_compare_2026-11-24.html` (desktop 1440 and
phone 390, light and dark, before / after and a zoom of the row).

NOT_RUN: the full Node unit suite, the full browser suite and the backend suite (not needed for a CSS-value change; the train's own
gate covers them), and any test on the lab (no lab access in this task).

## Open question

1. Keep the switch in the camera wizard? a) yes (recommended: the 2.48 rule for every on/off option) b) back to a check box.
