# SKIN-QA-2403 — the 2.40.1 / 2.40.2 surfaces in every shipped skin, light and dark

Branch `pilot/SKIN-QA-2403`, cut from `origin/main` at `ccb77f28d` (v2.40.2). No merge, no version bump, no changelog entry, no UI
rebuild (`www` is main's 2.40.2 build), no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or station contact: every test runs against
mocks and fakes (`page.route`, drawn video from `tests/live-fake-media.ts`).

## 1. Why

The NOT_RUN lists of four 2.40.1 / 2.40.2 changes said the same thing: checked in the classic light skin only.

| Change | Surface |
|---|---|
| SETTINGS-INTERCOM-CARDS-2401 + SETTINGS-CARDS-ACCORDION-2402 | Settings › "מתגי מסכי כניסה" in its four layouts: cards with the headers at the side (default), cards that open in place, two tabs, one list |
| WALL-PHONE-TOOLBAR-2401 | the camera wall's phone toolbar: the icon row (default) and the two rows of labels, with the long-press name bubble |
| VIDEO-SUB-FALLBACK-2402 | the wall tile's tag "עבר לזרם הראשי" |

Skins checked: every skin the picker offers - classic, domus, tesla, crystal, infra, soft (`PICKER_SKINS`, `tests/helpers/frozen-skins.ts`).
Bubble is frozen (BUBBLE-FREEZE-295): a stored bubble is drawn as domus, so domus covers it. Each in light and dark: 12 combinations.

## 2. How it was measured

New spec `frontend/tests/layout-skin-qa-2403.spec.ts` with the probe `frontend/tests/helpers/skin-qa-probe.ts`.

- **Contrast on the rendered pixels**, not on the token model. The glass skins draw translucent surfaces over a gradient or picture
  canvas, so a word's background is known only once it is painted. For every visible text under the surface (walked through the shadow
  roots and the slotted light DOM; a slotted text takes its slot's colour), the colour, opacity, size and weight are read. One screenshot
  is then taken with every glyph and icon transparent, and each text colour is composited over the background pixels inside its own box.
  The value kept is the second-lowest of up to 24 samples. Thresholds: WCAG AA 4.5:1, 3:1 for large text, icons and focus rings. Inactive
  controls are exempt (`:disabled`, a custom control's `disabled`, `aria-disabled`). A text that is partly under a sticky bar or a
  floating shell control is not measured while it passes there.
- **Fit (owner rule: no scroll in control screens):** layout a at 1440x900 and 1366x768, every card opened in turn. The page (document,
  shell main, screen wrapper, screen) must not scroll, the open card must not scroll inside, and the last header must leave room for the
  acceptance-check header.
- **States:** hover changes something visible; keyboard focus draws a ring at 3:1 or better; press follows the skin's `--sw-press-scale`
  (0.97 in classic, domus, infra and soft; 1 in the flat crystal and tesla, which draw no press scale anywhere).
- **Touch targets:** fold headers, phone icon keys, label-mode controls and the kiosk key must each be 44 px or larger.
- **RTL:** the headers' column sits at the right with its titles on the right edge, the phone icon row starts at the right, and the
  tile tag sits in the top-start (right) corner.
- **Sideways scroll:** none anywhere, in all four layouts, on the phone and on the wall.
- **Tag:** it must stay inside its tile and cover no other overlay (status, profile badge, H.265 tag, name). Its contrast is measured
  over the drawn picture and as a worst case: the scrim over a white, a grey and a black picture.

Every measurement goes to `<repo>/.tmp_skinqa/*.json`, with a screenshot of each state.

## 3. Defects found and fixed

| # | Where | Skins / schemes | Measured before | Fix | After |
|---|---|---|---|---|---|
| 1 | Tile tag "עבר לזרם הראשי" (`sw-live-player.ts` `.subtag`) | all 12 (the on-video tokens do not vary by skin) | 3.33:1 over a bright picture: the 72 % on-video ink under the 55 % scrim | full `--sw-on-video` ink (as the status pill beside it), the HUD's backdrop blur; still quiet (weight 500, the smallest size) | 4.76:1 worst case, all 12 |
| 2 | Tag vs the remote channel's profile badge (`.vbadge`) | remote channel, every skin | the badge is `direction: ltr`, so its inline end is the RIGHT edge, the same corner as the tag's inline start in RTL. The two lay on top of each other on every remote tile. The 2402 note says "the badges sit top-end"; in RTL that was not true for this badge. | the tag steps down one row under the badge. The player is a named inline-size container (`swlp`). Under 240 px the tag also steps under the H.265 tag. Under 160 px (a phone wall of three columns, ~116 x 65 px) no row is free of the camera name, so the tag gives way to the badge, which already reads "main·...". Section 6 asks the owner about this. | desktop remote and phone 2-column remote: no overlap; 3 columns: the badge alone |
| 3 | Phone icon row: the quality and camera-count keys (`live-wall.ts` `.ikey`) | classic, domus, infra, soft (the skins with a press scale) | no pressed state (`transform: none`); the kiosk key and the columns key beside them sink on press | `:active` with the skin's press scale, the press timing, none under reduced motion (the kiosk's own rule) | press = skin token in all 12 |
| 4 | Phone wall, the two-row mode (`ui.wall_phone_bar = labels`): the kiosk key | all 12 | 40 x 40 px (< 44) | 44 x 44 px (the icon row already had 44) | 44 px |
| 5 | Layout a at 1366x768: the switches card and the WisKey-area card (`sw-fold-cards.ts`, `system-diagnostics.ts`) | domus light / dark, tesla light (tesla dark not reached before the fix) | the open card scrolled inside: domus 9 px / 25 px, tesla 12 px / 7 px. These skins' page head is about 22 px taller, so the cards start at y 227 instead of 205. | below 520 px of room for the open card (`FOLD_TIGHT_ROOM`), the wide list draws its headers' column at 232 px (the open card gets the width back, so its rows wrap less) and the rows one step denser (`--sw-set-row-pad: 6px 12px`). The window and the page head decide it, never the open card, so the column never jumps between cards. Classic at 1366x768 has 531 px and stays exactly as it was (the 2401 receipts' numbers came out the same: 518 / 515 / ... px). | no inner scroll and no page scroll, 12 of 12, both sizes |
| 6 | Fold headers in the glass skins (`sw-fold-cards.ts` `.head`) | domus, crystal, soft | a header was the bare translucent `--sw-surface` with no blur, on the raw canvas (the bloom, the night city). The open header's tint REPLACED the surface, so in the glass skins and every dark scheme it was see-through: its accent title read 4.44-4.48:1 in domus light and 4.34-4.42:1 in soft light. | a header is drawn in the skin's card material: `--sw-glass-sheen` over the surface and the `--sw-glass-blur` backdrop, through the `--sw-perf-*` switches as the skins' own cards. The tint is layered over the surface. In classic, tesla and infra the sheen is transparent and the blur `none`, so they draw what they drew; classic light's opaque tint gives the same pixels. | lowest header text 4.53:1 (soft), all 12 pass |
| 7 | Long-press name bubble (`live-wall.ts` `.khint`) | glass skins | hardening, not a measured failure: its ink was `--sw-surface`, which is translucent in the glass skins (crystal dark about 5:1, passing) | ink = `--sw-surface-solid` | - |

Not changed: the desktop wall toolbar, the kiosk, the accordion / tabs / list structure, any token, any skin file, any shared component.

Other things measured and found correct in every skin:

- The header column stays at the start side and every header is 44 px or taller (44-46).
- Header titles are never cut. Summary lines end with an ellipsis by design; the full text is the tooltip.
- The focus ring reads at 3:1 or better.
- The phone icon row is 44 px tall (≤ 56), and the two-row mode is 94 px (≤ 120). No label is cut, nothing scrolls sideways, and the
  long-press bubble stays on the screen.

## 4. Found and NOT fixed: shared components (for the owner)

These failures belong to components every screen draws, not to these surfaces. A fix changes other screens and their baselines. The
spec lists them under `known` in each result file and does not count them.

| Id | What | Where | Measured |
|---|---|---|---|
| K1 | `sw-badge filled kind="live"` puts inverse ink (white) on `--sw-success` (green). There is no `--sw-on-success` token. | here: the pairing card's verdict "מצומד: ..."; elsewhere: investigate events, cases, rules | 1.78:1 classic dark, 2.02 soft dark, 2.28 classic / infra / soft light, 3.49-3.51 domus / tesla / crystal light |
| K2 | `sw-button` primary in classic dark: the raised-key gradient under white ink | here: "הרץ בדיקה", "בדוק חיבור חתום", "בדיקה" | 4.08-4.24:1 |

Suggested fix: an `--sw-on-success` ink token (dark ink on the light greens), and a slightly deeper classic dark primary gradient. Each needs
the owner's approval and a re-take of the affected investigate / classic-dark baselines.

## 5. The matrix (final, runner @ `07cc37649`)

Columns: lowest open-card bottom and inner scroll at 1440 / 1366; the lowest header and body text contrast across all four layouts and
the phone (need in brackets; K1 / K2 excluded); the lowest icon contrast (need 3); header states (hover delta in colour levels / focus
ring ratio / press); problems in the accordion, tabs + list and phone-cards tests; phone wall (problems, bar heights, lowest text); the
tag's worst case.

| skin | scheme | cards 1440 / 1366 | text min | icon min | hover Δ / ring / press | acc. | tabs+list | phone cards | phone wall | tag | known |
|---|---|---|---|---|---|---|---|---|---|---|---|
| classic | light | 707 of 900, 0 / 723 of 768, 0 | 4.56 (4.5) | 5.11 | 18 / 4.33 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 6.55 | 4.76 | K1 |
| classic | dark | 707 of 900, 0 / 723 of 768, 0 | 5.76 (4.5) | 4.18 | 23 / 7.96 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 6.91 | 4.76 | K1, K2 |
| domus | light | 729 of 900, 0 / 730 of 768, 0 | 4.77 (4.5) | 5.30 | 237 / 4.26 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 7.04 | 4.76 | K1 |
| domus | dark | 729 of 900, 0 / 730 of 768, 0 | 4.70 (4.5) | 4.86 | 20 / 8.66 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 7.08 | 4.76 | - |
| tesla | light | 735 of 900, 0 / 730 of 768, 0 | 5.14 (4.5) | 5.05 | 41 / 5.14 / 1 (token 1) | 0 | 0 | 0 | 0 · 44 / 94 px · 5.78 | 4.76 | K1 |
| tesla | dark | 735 of 900, 0 / 730 of 768, 0 | 5.55 (4.5) | 5.18 | 36 / 9.32 / 1 (token 1) | 0 | 0 | 0 | 0 · 44 / 94 px · 6.24 | 4.76 | - |
| crystal | light | 705 of 900, 0 / 719 of 768, 0 | 4.89 (4.5) | 4.72 | 204 / 4.77 / 1 (token 1) | 0 | 0 | 0 | 0 · 44 / 94 px · 5.62 | 4.76 | K1 |
| crystal | dark | 705 of 900, 0 / 719 of 768, 0 | 4.64 (4.5) | 4.77 | 20 / 10.32 / 1 (token 1) | 0 | 0 | 0 | 0 · 44 / 94 px · 7.12 | 4.76 | - |
| infra | light | 694 of 900, 0 / 704 of 768, 0 | 4.56 (4.5) | 4.94 | 14 / 4.57 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 5.22 | 4.76 | K1 |
| infra | dark | 694 of 900, 0 / 704 of 768, 0 | 4.77 (4.5) | 4.77 | 19 / 7.61 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 6.76 | 4.76 | K1 |
| soft | light | 699 of 900, 0 / 709 of 768, 0 | 4.53 (4.5) | 4.53 | 23 / 3.68 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 5.75 | 4.76 | K1 |
| soft | dark | 699 of 900, 0 / 709 of 768, 0 | 4.53 (4.5) | 4.53 | 26 / 10.48 / 0.97 | 0 | 0 | 0 | 0 · 44 / 94 px · 7.50 | 4.76 | K1 |

Page vertical scroll was 0 with every card open in every row. Sideways scroll was 0 everywhere. In the accordion (layout a, opened in
place) the page may scroll vertically, as the owner accepted for that option.

## 6. Open for the owner

- **#2, very narrow remote tiles:** on a tile under 160 px (a phone wall of three columns on the remote channel) the tag is not drawn,
  because the profile badge already says "main·...". The alternative is a tag that covers the camera name. VIDEO-SUB-FALLBACK-2402 said
  "shown on compact wall tiles too"; that still holds for every tile 160 px or wider and for every local-channel tile.
- **K1 / K2:** section 4.

## 7. Tests

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (src + tests) | workstation @ every commit, last @ `07cc37649` | exit 0 |
| Unit (Node only), 20 files: token lint, design tokens x2, a11y x2, menu x2, RTL, white label, motion setting, phone buttons 44, dark polish beds, glass scheme, glass wall, skincomp, empty-state icons, `unit-settings-intercom-cards-2401`, `unit-settings-cards-accordion-2402`, `unit-wall-phone-bar-2401`, `unit-video-sub-fallback-2402` | workstation @ the `07cc37649` tree | **160 passed** |
| `layout-skin-qa-2403` before the fixes (measurement run) | runner @ `4cafc5a61` | 40 of 84 result files written before the runner's ssh session dropped (the job ended with it). Section 3 is built from these files and two partial reruns @ `1bb512821` / `ed922d09f`. |
| `layout-skin-qa-2403` (new; 74 tests = 6 skins x 2 schemes x 6 + 2 remote), desktop + mobile, three jobs (classic + domus / tesla + crystal / infra + soft + remote) | runner `preview` @ `07cc37649` | **74 passed, 74 skipped (project-scoped), 0 failed** |
| `pixel-skin-qa-2403` (new), `--update-snapshots`, workers 1 | runner `preview` @ `07cc37649` | 5 passed; **5 PNG written** (section 8) |
| Regression `preview` **without** refresh, desktop + mobile + tablet, workers 1: `pixel-skin-qa-2403`, `pixel-settings-intercom-cards-2401`, `pixel-settings-cards-accordion-2402`, `pixel-access-s12`, `visual-matrix`, `layout-settings-nav-fit-402`, `evidence-mobile-wall-kiosk`, `layout-dropdown-fit`, `evidence-video-sub-fallback-2402`, `evidence-wall-pano`, `evidence-wall-live-cap`, `evidence-remote-video`, `evidence-webrtc-first`, `evidence-video-transport-2400`, `layout-a11y-295`, `evidence-wall-phone` | runner @ `f941b5d5c` | **180 passed, 195 skipped, 0 failed** |
| `spec` job (Vite dev server), desktop + mobile + tablet: `layout-settings-intercom-cards-2401`, `evidence-settings-intercom-cards-2401`, `layout-settings-cards-accordion-2402`, `evidence-settings-cards-2380` | runner @ `f941b5d5c` | **35 passed, 25 skipped, 0 failed**; classic at 1366x768 measures exactly as in the 2401 receipts |
| `scripts/release_check.py` | workstation @ `f941b5d5c` | every item `[ok]` (one version 2.40.2, tag `v2.40.2` exists, migrations 205); RESULT: ready |
| impeccable detector over the three changed UI files | workstation | no findings |

Runner: before every job, `~/smplwise-results/gate_status.json` was read (`pass`, the 2.40.2 gate of `ccb77f28d`) and no `release_gate`
process existed. One job ran at a time. `.tmp_skinqa` in this branch's runner worktree was removed before each job and after the
last one. No other branch's folder was touched.

## 8. Pixel baselines (runner, `preview`, workers 1, Linux)

**New:** `pixel-skin-qa-2403`, 5 PNG.

- `cards-screens-{domus-light,domus-dark,crystal-dark}-1440`: the whole page.
- `wall-icons-{crystal-dark,domus-light}-390`: the icon row as an element image, against snapshot-only cameras so the image is stable.

These were looked at. Old vs new was compared by script (pixels differing by more than 16 levels; bounding box) against the
measurement run's shots of the same state taken before the fix:

| Image | Differing px | Box (x0, y0, x1, y1) |
|---|---|---|
| crystal dark | 18 179 | 800, 214, 1076, 631 |
| domus dark | 22 507 | 801, 253, 1076, 661 |
| domus light | 10 559 | 801, 228, 1078, 270 |

All changes are inside the headers' column. In domus light only the open header changed (the tint now lies over the surface); in the
dark glass skins every header gained the skin's top sheen. Classic's 2401 / 2402 baselines and `visual-matrix` passed without refresh,
so nothing changed there. The foundation skins (infra, soft) get no baseline: SKINFOUND-297 keeps them out of the pixel matrix until
the owner's round 2. The layout spec measures them.

Evidence (committed, `docs/design/evidence/SKIN-QA-2403/`):
- the switches card at 1440x900 in all 12 skin x scheme combinations;
- the top third of the phone wall's icon row in all 12, and the two-row mode in crystal dark;
- the remote tag on the desktop and on phone walls of two and three columns.

## 9. NOT_RUN

- A physical phone or tablet, and browsers other than Chromium (Firefox, WebKit / Safari): `backdrop-filter`, container queries and
  the long press were not checked there.
- The tablet project of the new specs: they cover desktop and phone only. The regression runs above included tablet.
- Windows pixel baselines.
- The full unit sweep, the backend suite (the backend is unchanged), the release gate, `build:addon`.
- `prefers-contrast: more`, `prefers-reduced-transparency` and the "lite" performance look. The probe ran with `look=performance:full`,
  which is the most translucent case.
- Bubble on its own: it is frozen and drawn as domus.
- The K1 / K2 fixes (section 4).
- The user guide is not updated: this change adds no setting, and the narrow-tile tag rule waits for the owner (section 6).
- The registry (`management/tasks.json`) entry is left to the train's coordinator, as for the 2.40.x branches.
- Any lab, Home Assistant, WisKey, NVR or station contact (none allowed).

## 10. Rollback

Revert the branch's commits. No setting, migration or token was added; the new baselines and specs go with the revert.
