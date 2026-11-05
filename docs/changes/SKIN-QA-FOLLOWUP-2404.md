# SKIN-QA-FOLLOWUP-2404 — the owner's round-22 answers to SKIN-QA-2403

Branch `pilot/SKIN-QA-FOLLOWUP-2404`, cut from `origin/release/2403-train` at `5573b8e58` (SKIN-QA-2403 is merged there). No merge, no
version bump, no changelog entry, no UI rebuild, no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or station contact: mocks and fakes
only.

## 1. The answers

| Q (SKIN-QA-2403 §6) | Owner, 05.11 round 22 | Done here |
|---|---|---|
| Q4 - on a remote tile under 160 px the tag gave way to the profile badge | "I didn't understand; it needs to be made to work" - hiding is not accepted; the fallback stays visible without covering the camera's name | §2 |
| Q5 - the filled success badge ("מצומד"), white on green | a: dark ink on green, AA in every skin and theme; re-take every baseline it is in | §3 |
| Q6 - the classic dark primary key, 4.1:1 | a: deepen it to >= 4.5:1; re-take the affected baselines | §4 |

## 2. Q4 - the chip of a narrow tile (`sw-live-player.ts`, `sw-camera-tile.ts`)

A phone wall of three columns at 390 px gives a ~116 x 65 px tile. On the remote channel its top row is the profile badge
("main·WebRTC", 87 px, at the right because it is `direction: ltr`) and its bottom row is the camera's name. The full words
"עבר לזרם הראשי" (93 px) fit in neither row, and no third row exists.

Options weighed (design skills: impeccable Operate mode - precision over expression, a pattern the operator already reads; Emil -
press feedback, long press, no flash):

- **One word, "ראשי":** it repeats the "main" the badge already shows and says nothing about the move. A 36-50 px pill also pushes a
  normal-length name ("מצלמה 1") into its ellipsis.
- **An arrow inside the profile badge:** only a few px of slack at 116 px, and none at 105 px (a 360 px phone).
- **Chosen: a 20 px chip with the "up" glyph** (`arrowUp`: stepped up from the sub stream to the main one). It sits in the bottom-end
  corner (the left, in RTL), on the name's row and opposite the name. It uses the HUD's own scrim, blur and on-video ink, like the
  status pill beside it.

Rules:

- The tile keeps the name clear of the chip (`sw-live-player[data-subchip] ~ .foot { padding-inline-end: 22px }`), so a long name ends
  in its ellipsis before the chip, never under it.
- The words never leave the DOM:
  - visually hidden inside the chip, so they stay its accessible name;
  - the chip's `title`, as a tooltip under a mouse;
  - a bubble on a long press. The bubble sits over the tile above the chip, wraps rather than running off, and uses the wall phone
    bar's timings (450 ms hold, 2.5 s shown, 10 px of movement counts as a scroll). The release that ends a long press does not open the
    camera. A short tap passes on to the tile as before.
- The chip has a 36 px press area that is drawn nowhere. A long press raises no context menu or text selection.
- The narrow state is the player's own width (`ResizeObserver`, `SUB_CHIP_MAX = 160`), reflected as `data-subchip`.
- It applies to every tile under 160 px, local channel too: one rule, and the words would take ~80 % of such a tile's top row even
  alone.
- Tiles of 160 px and wider keep the words, under the profile badge on the remote channel, as in SKIN-QA-2403.
- The 2403 rule that hid the tag is removed.

## 3. Q5 - dark ink on the filled success badge (`sw-badge.ts`, `tokens.ts`, `palette.ts`)

- New token `--sw-on-success` = `#04140b` (both schemes). It follows the precedent of `--sw-on-warning` (ROUND4-LEFTOVERS-2390).
- `:host([filled][kind='live'])` draws `color: var(--sw-on-success)`; the dot follows (`currentColor`).
- A device palette (`design/palette.ts`) picks this ink or white by contrast with its own green. Some palettes carry a deep green
  (#047e39), where white reads better.

| Skin | light: new (white before) | dark: new (white before) |
|---|---|---|
| classic | 8.30 (2.28) | 10.60 (1.78) |
| domus | 5.42 (3.49) | 10.60 (1.78) |
| tesla | 5.39 (3.51) | 9.35 (2.02) |
| crystal | 5.42 (3.49) | 10.60 (1.78) |
| infra | 8.30 (2.28) | 10.60 (1.78) |
| soft | 8.30 (2.28) | 9.36 (2.02) |
| bubble (frozen) | 5.74 (3.30) | 10.60 (1.78) |

Where it shows:
- the pairing verdict "מצומד";
- the investigation screens: an acknowledged event "טופל", a rule's dry run "היה מפעיל", and case / severity badges of kind `live`.

## 4. Q6 - the classic dark primary key (`skins/classic.ts`)

The classic raised key's top was `color-mix(in srgb, var(--sw-accent) 86%, #ffffff)`, a fixed white. It now mixes in
`var(--sw-highlight)`, the skin's own "light catching the top" token:

- in light the highlight is the same opaque white, so the colour is unchanged;
- in dark it is 7 % white, so the top is no longer whitened and the key is deeper.

The same change applies to the selected chip (`sw-chip[selected]`, the same rule) and to the sign-in key (classic 12), which used the
same mix.

| classic | under the label (30-70 % of the key) | top edge | bottom |
|---|---|---|---|
| light (unchanged) | 4.85 | 4.17 | 6.91 |
| dark, before | 4.02 | 3.60 | 5.24 |
| dark, now | **4.76** | **4.57** | 5.24 |

## 5. Tests

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | workstation @ `ed53c92cb` and `fb55f8793` (the last code change) | exit 0 |
| Unit `unit-skin-qa-followup-2404` (new, 4: the ink in 7 skins x 2 schemes, the palette's choice, the classic key model, the chip's source guards) | workstation | **4 passed** |
| Unit, 34 files (the new one; token lint, design tokens x2, palettes, muted contrast, HUD opaque, dark polish, a11y x2, menu x2, RTL, white label, motion, phone buttons, glass x2, skincomp, skinfound, round4 leftovers, settings cards 2401 / 2402, wall phone bar, sub fallback, video 2403, camera card, still bake, uxrest, wxmedset, wxsch, plan skin control, page background, empty-state icons) | workstation @ `ed53c92cb`, `--workers=1` | 261 passed, **1 failed: `unit-wxmedset:31`, which passes alone (7 / 7)**. With the default workers the same set gave 260 passed and 2 failed (`unit-still-bake:289`, which also passes alone 15 / 15). Both are order-dependent and do not touch files this branch changes. |
| impeccable detector over the four changed UI files | workstation | no findings |
| `layout-skin-qa-followup-2404` (new) + `layout-skin-qa-2403` (its known list now empty, so the badge and the key are measured like every other text), desktop + mobile | runner `preview` @ `ed53c92cb` | 75 passed, **12 failed**: the chip's long press, every skin. The tile's name row spanned the chip's corner and took the press. Fixed in `32e2df80b` (the row takes no pointer events while the chip is drawn). Every other check of the 12 passed, including the badge and key contrast in all 12 skin x scheme combinations. |
| `layout-skin-qa-followup-2404`, mobile | runner @ `32e2df80b` | **13 passed, 0 failed**. 12 skins x schemes: the tile is 116 x 65 px; the chip is 20 px; its glyph reads at 7.0-16.7:1 on the drawn picture and 4.76:1 over a white one; it covers neither the badge nor the name; the long name ends before it; the long press shows the words and does not open the camera. Plus 2 columns (words kept) and local 3 columns (chip). |
| `pixel-skin-qa-followup-2404`, `--update-snapshots` | runner @ `32e2df80b` (chip, mobile) and @ `fb55f8793` (badge, desktop) | **5 PNG written**, looked at (§6) |
| `layout-skin-qa-followup-2404`, desktop (the badge in 12 skin x scheme combinations) | runner @ `fb55f8793` | **12 passed**: ink `#04140b`, 5.39-10.60:1 rendered, the same values as the token model |
| Every screenshot spec (32 files), desktop + mobile + tablet, workers 1, **without** refresh | runner @ `3764cbabc` | **503 passed, 352 skipped, 0 failed** |
| The same 32 files with `--update-snapshots=all` (to compare old against new) | runner @ `3764cbabc` (+ `visual-matrix` and `pixel-wiskey-station-media` again: the same counts, so the differences reproduce) | 503 passed; 184 images rewritten, 70 byte-identical in pixels; sorted in §6 |
| Final, **without** refresh, desktop + mobile + tablet, workers 1: `pixel-skin-qa-followup-2404`, `pixel-wiskey-people`, `pixel-wiskey-messaging`, `pixel-round4-leftovers-2390`, `visual-matrix`, `pixel-skin-qa-2403`, `pixel-settings-intercom-cards-2401`, `pixel-settings-cards-accordion-2402`, `evidence-video-sub-fallback-2402`, `evidence-wall-pano`, `evidence-remote-video`, `evidence-mobile-wall-kiosk`, `layout-dropdown-fit`, `evidence-wall-live-cap`, `layout-a11y-295` | runner `preview` @ `c0b311070` | **214 passed, 179 skipped, 0 failed** |
| `scripts/release_check.py` | workstation @ the final head | every item `[ok]` (one version 2.40.2, tag `v2.40.2`; 2.40.3 is the train coordinator's); RESULT: ready |

Runner: before every job `~/smplwise-results/gate_status.json` was read and `release_gate` was looked for.

- The 2.40.3 gate (`release/2403-train`, started 12:46 UTC) ran while this branch was being built. No job of this branch started until
  it had ended (`pass`, 13:36 UTC).
- One job ran at a time.
- `.tmp_skinqa` in this branch's runner worktree was removed before the evidence jobs and after the last one.
- This branch's helpers live in its own worktree (`.tmp_sqtools/`, never committed). SKIN-QA-2403 kept its helpers in the lead's
  scratchpad and overwrote the lead's `fetch.py` there (coordinator, 05.11); that folder is not touched any more.

## 6. Baselines: old against new

**New (5):**
- `pixel-skin-qa-followup-2404`: `chip-3col-{classic-light,crystal-dark,domus-dark}-390`, the tile as an element image over the fake
  media's still grey;
- `badge-verdict-classic-{light,dark}`, the pairing verdict as an element image. No existing baseline draws the filled success badge:
  the investigation screens have no pixel spec, and no baseline opens the pairing card.

**Re-taken (10), the classic dark primary key.** Each was rewritten on the runner and compared with the committed image (pixels moving by
more than 16 levels; bounding box), then looked at old / new / difference. The whole difference is the key, deeper at its top:

| Image | Differing px | Box |
|---|---|---|
| `pixel-round4-leftovers-2390` wk-overview-classic-dark-1440 / -390 ("כל הדלתות") | 626 / 652 | 852,260-930,269 / 297,349-376,358 |
| `pixel-wiskey-messaging` tab-classic-dark-1440 | 1 240 | 1134,847-1211,863 |
| `pixel-wiskey-people` list-classic-dark-1440 / -390 ("הוספת אדם") | 1 695 / 1 768 | 253,75-360,91 / 117,117-226,133 |
| `pixel-wiskey-people` drawer-classic-dark-1440 ("עריכה") | 1 238 | 1253,847-1330,863 |
| `visual-matrix` security-alarm-ready-dark desktop / mobile / tablet ("דריכה מלאה") | 1 271 / 1 745 / 1 271 | 292,180-403,191 / 76,220-189,235 / 292,180-403,191 |
| `visual-matrix` sites-ready-dark-tablet ("אתר חדש") | 1 113 | 31,86-127,97 |

**Not re-taken.** The other rewritten images differ in ways this branch does not cause, so re-taking them would bake in changes that
are not the key or the badge. All of them pass without refresh (above). Reported for the coordinator:

- **Drift this branch does not cause.** It reproduces with the same counts on a second render. These changes cannot come from this
  branch: the light key is unchanged by construction, and no image draws the chip, the long-press words or the filled badge. Not traced
  to their branch.
  - In dark, the top bar's selected pill ("לייב", "מבט על", "כללי") is now a white pill, where the baseline has a dark-blue one:
    `visual-matrix` devices-building / live-wall / settings-diagnostics dark, and part of devices-home / devices-schedules /
    map-floor / settings-notifications dark.
  - A toolbar chip "בעמדות בלבד" appears and the search field is gone on the WisKey people screen behind its drawer:
    `pixel-wiskey-people` drawer-classic-dark-390, `pixel-wiskey-messaging` tab-classic-dark-390, and `pixel-wiskey-people-writes`
    writes-cards / writes-menu classic dark. These images also hold the primary key; because of the extra content they were left.
  - An icon now sits beside the "מחובר" badge: `pixel-wiskey-station-media` drawer / talking dark.
  - `visual-matrix` sites-ready-dark-desktop (the key plus a second region).
  - The light images of devices-schedules, settings-notifications, sites, devices-home and multimedia (mobile).
- **Noise:** 1-5 px columns at x 1358; anti-aliasing of single labels (`door-tech`, `messaging` forms); the shell's floating button in
  `pixel-access-events` / `schedules` 390; the rounded corners of `pixel-incoming-call` dark; `pixel-bustimes-295` (its clock line);
  `pixel-access-events` table-1440 and `pixel-wall-plan` dark.

## 7. NOT_RUN

- A physical phone (the long press was driven by Playwright's mouse on the Pixel 7 profile); browsers other than Chromium; Windows pixel
  baselines.
- The full unit sweep, the backend suite (unchanged), the release gate, `build:addon`.
- The user guide: the chip is a drawing of an existing tag. `30-cameras_HE.md` could name it at the release.
- Any lab, Home Assistant, WisKey or station contact.

## 8. Rollback

Revert the branch's commits. `--sw-on-success` is a new token that nothing else reads; the re-taken baselines go back with the revert.
