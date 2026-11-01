# CROSS-SECTION-POLISH-2290 - design polish of the cross-section and the synoptic map

Branch `pilot/CROSS-SECTION-POLISH-2290`, cut from `pilot/CROSS-SECTION-2290` (d5413b8e3). Behaviour, settings, copy and i18n keys are unchanged.
Reference: `private/design-system-2026-10-27/round7/cross-section-v3/` (`xs3.css`, `OWNER_DECISIONS_2026-10-29.md`).
Files: `frontend/src/xsection/sw-xsection.ts`, `frontend/src/xsection/sw-fire-bar.ts`, `frontend/src/screens/devices-synoptic.ts`.
Skills were invoked through the Skill tool. Findings come from reading the real component CSS against the mock-up CSS; no screenshots were taken in this pass (see NOT_RUN).

## Skills and findings

| Skill | Found | Changed |
| --- | --- | --- |
| impeccable (critique/audit/polish) | Gaps vs the mock-up: hot/cold rows had a tinted background but a neutral degree number (mock-up colours the number); selected + fire-alarm row lost the alarm ring; inline `style=` for the alarm chip; synoptic tree buttons had no hover/press/transition. The `impeccable context` launcher was not run (project context is AGENTS.md + the v3 owner decisions). | Degree numerals tinted (row + synoptic), double ring (accent + alarm) on selected alarm rows in both views, `.chip.alarm` class instead of inline style, tree buttons get hover (fine pointer), press and a background transition. |
| emil-design-eng | Row entrance used `animation-fill-mode: both`: the finished animation keeps `transform: none` and overrides the `:active` scale, so rows never showed press feedback. Synoptic row transitioned background and transform but not box-shadow (selection ring snapped). Compact card and phone tile had `:active` but no transition. | Fill mode `backwards` (fade and rise); box-shadow added to `.srow` transition; transitions added to `.xtile` and the compact card; compact card gets a hover shadow only for `(hover:hover) and (pointer:fine)`. |
| apple-design | Selection pointer (notch) appeared instantly; depth: compact card had no hover elevation (cards in the floors list do). Spatial consistency and 1:1 feedback otherwise fine (no drag in these views). | Notch grows in (160 ms, `backwards` fill, opacity + scale, reduced-motion gated); hover elevation for the compact card. No blur/translucency added (control screens, restraint). |
| animate | Gate: row hover/press = tens of times a day, so only near-imperceptible 100-120 ms colour/shadow transitions; the entrance is occasional and already optional (`animate` setting, fade by default). Missing: selection-ring easing (added), notch (added). Rejected: animating the temperature number or the facade windows (data the user reads). | As above; durations come from the existing `--sw-t-hover` / `--sw-t-press` tokens, no new curves. |
| animation-performance | Audited all transitions: only `background`, `box-shadow`, `transform`, `opacity`; no `transition: all`, no animated CSS variables, no blur. Box-shadow is paint-only on a handful of rows; acceptable, no `will-change` added. | The fill-mode fix above is also the only correctness issue; nothing else. |
| ui-ux-pro-max (contrast/typography) | White text on `--sw-danger` (#ef4444) is about 3.8:1 (fails 4.5:1 for 12-13 px text): alarm chip in the section and the alarm panel in the synoptic. Several 11.5 px labels (legend, ground label, tile value, fire tag). `--sw-text-3` on surface is about 5.3:1 light and 5.6:1 dark: passes. Hot/cold numerals with the raw `--sw-heat`/`--sw-cool` hues are below 4.5:1 at small sizes (dense steps). | Alarm chip and panel use `danger` mixed 80% with black (about 5.3:1 with white; acknowledged panel 66%); numerals use 62% hue + heading colour; the smallest labels raised to 12 px (12.5 px for the synoptic sub-line). The mini-map rows inside the compact card stay 10.5 px by design (decorative, the button carries the aria-label). |
| mobile-native, break-ui | Done in the previous commit (not repeated). | - |

## Not changed on purpose
Layout, density steps, columns, settings and defaults; no scrolling added; he/en strings untouched; fire-detection column rules (hidden until connected).

## Verification (run on the runner via run_smart.py, commit 12760fb6a)
- tsc: ok.
- evidence-xsection-synoptic: desktop 28 passed / 1 skipped; tablet 12 passed / 17 skipped; mobile 11 passed / 18 skipped (skips are project-scoped tests). 0 failed.
- NOT_RUN: screenshots/visual-diff against the mock-up shots, pixel baselines, other specs, full backend suite, real-device check.
