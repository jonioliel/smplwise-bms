# COLOR-LITERAL-A-2480 - colour literals in components/, styles/, screens/ (pixel-neutral)

Branch `pilot/COLOR-LITERAL-A-2480` from `origin/release/2470-train` (2c211966d; the train's 2.47.0 tip 092bbc9a1 merged in
at 2a47580fe). Sister row COLOR-LITERAL-B owns home/, notice-tv/, map/, wall/, public-ticket/ and the rest; this row touches
only `frontend/src/components/`, `frontend/src/styles/`, `frontend/src/screens/`.

## Result

`py -3.12 scripts/design_ratchet.py`: **color-literal 2497 -> 2413 (-84)**, all of it in this row's three folders
(in scope 1091 -> 1007). px-literal fell as a side effect (a repeated `0 1px 2px ...` shadow written once). Baseline lowered
with `--update` (see the last commit).

## Rule applied

A literal was replaced only when the replacement computes to the IDENTICAL value wherever the rule renders:

1. **Dead fallbacks dropped** (`var(--x, #lit)` -> `var(--x)`) only where `--x` is always defined at that element:
   - root tokens (`--sw-accent`, `--sw-surface`, `--sw-focus`, `--sw-video-bg`): emitted on `:root` for every skin; every local
     re-point in src/ points them at a knob that is defined in that context (glass bridge `--dv-focus` is a knob of every glass
     palette, `--mr-focus` comes from remoteTokens on the panel / remote hosts that contain the library and queue lists,
     `--sw-focus: inherit` in the Bubble media sheet). None of the touched components renders in public-ticket or notice-tv
     (their own token sets).
   - the automation editor: its host is ALWAYS glass (`applyDevicesPrefs(..., style: 'glass')` in connectedCallback, before the
     first render), so every `--dv-*` colour knob (devices-palettes COLOUR_KNOBS) is defined on it, and `editorTokens` (`--ab-*`)
     sits on the same top-level host; the parts reading `editorShared` (sw-block-card, entity picker, templates, code view,
     door block) are rendered only inside it (same reasoning as RELEASE-2460-TRAIN section 3).
   - media-now-hero `--a1 / --a2`: always written inline on `.hero` (the view object always carries a1 / a2).
   - NOT dropped: `door-automation-block` (its comment allows use outside the editor; `--dv-on-accent` is never defined, the
     fallback IS the value), `automations-glass` `--dv-offline` (hosts not forced to glass), `sw-floor-iso` `--fc` (a face's
     token name comes from catalog data and may be undefined), `--sw-perf-glass-bg` (`initial` by default: the fallback is
     the value), `--sw-shadow-lg` (not a token: the fallback is the value), `--sky1 / --sky2` (never set).
2. **Exact global tokens that are constant in every skin, scheme and look** (checked: no skin, palette, look or local rule
   overrides them): `--sw-on-video` #ffffff, `--sw-video-scrim` rgba(0,0,0,0.55), `--sw-video-hover`
   rgba(255,255,255,0.14), `--sw-toggle-thumb` #ffffff - used only where the meaning fits (ink / dots / shadows on video,
   cover art or the lock-screen picture; a slider knob, as media-player-css already did).
3. **Module-scoped values written once** (same literal, declared on `:host` of the same sheet or on the element itself;
   no new global token, no shifted shade): the media fade masks and on-art inks (`--mm-fade-art`, `--mm-fade-row`,
   `--mm-on-art-*` in a plain `:host` block of mediaGlassKnobs - every consumer carries mediaGlassStyles), remote / player knob
   shadow and on-accent ink, camera-tile and investigate video ink shadow, floor-iso face / edge / missing-token tone,
   schedule-grid marker, privacy-mask fill, brand-logo / installer preview colours, lock-screen bezel ring, home widget tone
   line / well (BV1_STYLES is always part of homeWidgetsStyles), the Bubble well of the player card, and an element-local
   `--_mask` read by both `-webkit-mask-image` and `mask-image` (sw-sheet, sw-tabs, multimedia-players, area-quick-sheet,
   tickets-overview).

## Kept literals (decided, documented)

| What | Count (in scope, after) | Decision |
|---|---|---|
| `styles/devices-palettes.ts` | 295 | User-selectable palette DATA (`devices.theme` picks it; the settings swatches preview it). Literals are the definition, same category as `design/palettes.json`. Kept. Recommendation: exempt it in the ratchet like `src/design/` (open question 1). |
| `components/sw-scene.ts` | 176 | Drawn placeholder ILLUSTRATIONS (SVG art). Not themeable UI colour. Kept. |
| Module knob declarations (`--dv-*` default palette in devices-themes.ts, `--mm-*` media-glass, `--mr-*` remote, `--ab-*`, the new local values) | ~246 | These ARE the module tokens; their literal is the definition. |
| `styles/status-palette.ts` | 9 | The fixed status colours (already written once, CR-ICONS-PALETTE-2440; mapping to theme tokens is owner decision O19). |
| `rgb(var(--art) / a)`, `rgba(var(--sw-sheet-rgb), a)`, `rgb(var(--dv-tile-on-*) / ...)` | 47 | Already token-based: the ratchet regex counts the `rgb(` of a token composition. |
| Mask stops (`#000` in a mask gradient) | ~15 | Alpha only, not a colour; written once per element now. |
| One-off direct literals (shadows, alphas, art tints in TS data, QR black / white, canvas fill, timeline bookmark data) | ~219 | No identical token exists; a new global token is out of scope and a nearest token would shift pixels. |

Open options, not done (outside the token rule or of small value): the media art tint data repeated in TS across media-now,
media-player-now, media-remote, media-remote-keys and the frame-art SVG in media-remote / media-screen-card could move into one
shared data module (about -15); a few on-video shadow values (`0 1px 2px rgba(0,0,0,0.6)` in 5 files) would want one global
on-video shadow token (owner / lead decision, it is a new global token).

## Tests (actually run)

| Check | Where | Result |
|---|---|---|
| `npx tsc --noEmit` | PC, worktree with all colour edits | PASS (rc 0) |
| `npx eslint` on the 33 touched files | PC, merged head | PASS (rc 0) |
| `py -3.12 scripts/design_ratchet.py` | PC, merged head | PASS: color-literal 2413, px-literal 25461 (both lowered with `--update`), undefined-token 0 |
| Pixel set WITHOUT `-u` (every spec file with a `*-linux.png` baseline, 55 files, desktop / tablet / mobile, `--workers=2 --retries=1`, own runner folder) on the BASE 2c211966d | runner | 821 passed, 6 failed, 520 skipped |
| The same pixel set on the branch head 062ec3bdc (all colour edits, before the train merge) | runner | 816 passed, 6 failed, 5 flaky, 520 skipped |

The 6 failures are the SAME tests on base and head (evidence-intercom-ops:215, evidence-wiskey-installer:226,
pixel-wiskey-people-writes:119, desktop + mobile) and none is a screenshot comparison (pre-existing on the train). The 5 flaky
(nvr-encoding-batch:51 smoke, round4-leftovers:54, wiskey-people:111 skeleton, visual-matrix sites / multimedia-screens dark
tablet) passed on retry against the unchanged baselines - the head run overlapped the 2.47.0 gate (load ~55); a real colour
change fails both attempts. **Zero screenshot changes; no baseline refreshed; no substitution reverted.**

Coverage of the touched surfaces by the pixel set: visual-matrix (multimedia screens, settings notifications lock-screen preview,
live wall camera tiles, devices screens), pixel-sw-tabs, pixel-incoming-call, pixel-frigate-f2b-2405, pixel-audit30g-video,
pixel-wiskey-door-tech, pixel-home-*. Not covered by any pixel baseline: the media remote / player panel, the automation editor,
the investigate cases screen, the privacy-mask editor and the brand-logo settings - there the edits are pixel-neutral by
construction (a `var()` resolving to the identical literal, or a dropped fallback that never applied).

NOT_RUN: the pixel set on the merged head 2a47580fe (the 2.47.0 gate was running on the runner; the merge brought only train
commits and no file of this row conflicted), unit Playwright, the runner entry check.

## Comparison page

None: no visible change (pixel-neutral row, no baseline changed).
