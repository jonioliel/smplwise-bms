# Bubble taste mockup

A quick, clickable "taste" of SmplWise Arx in the Bubble Card style the owner asked for (pop-ups and transparency first).
Design only: no application code, no device access, fixture data with invented names. Branch `pilot/design-bubble-taste`
(from `pilot/design-bubble-research`, whose `docs/design/research/BUBBLE_CARD_ANALYSIS.md` is the measured basis).

Open `index.html` in a browser (static files, no build, no network: works from `file://`).

## Files

| File | What |
|---|---|
| `index.html` | Links the three boards, lists the switches, live token swatches for the current scheme |
| `home.html` | Board 1 - Home: status card (clock, date, alarm, weather, Shabbat), quick controls (all lights, all covers, climate, now playing), areas grouped by floor (cards or table), the area pop-up, a centred "turn everything off?" confirmation, the room-picker pop-up |
| `area.html` | Board 2 - Area: head pill (area, state, temperature, area-brightness mini slider, all-off), sections Lights / Climate / Covers / Media / Sensors, the "ambience" scene dropdown, device pop-ups (light, climate, cover, player), cards or table |
| `media.html` | Board 3 - Media: now playing (glass panel over the blurred cover art), players and speakers (cards or table, filtered by the tree), the volume morph on every player pill, group / join pop-up, groups list |
| `bubble-skin.css` | The skin: tokens (light + dark) on the existing `--sw-*` names, then the component rules, then the presentation variants |
| `shared.js` | Icons, fixture, shell (rail, building tree, phone pill stack, floating home button), pop-up sheet controller, sliders, renderers, the mockup chrome |
| `mockup.css` | Mockup chrome only (board / viewport / scheme / variant switches); not part of the skin |
| `fonts.css` | The embedded Heebo subsets (copied from `docs/design/mockups/media/players-index.html`) |
| `layout-check.mjs` | Layout safety sweep (Playwright): bubbles, overflow, floating elements, clipped text, touch targets over every board x width x style; exit 1 on any finding |
| `contrast.mjs` | WCAG contrast check of the tokens, including text on translucent surfaces (`node docs/design/mockups/bubble-taste/contrast.mjs`) |
| `screens/` | 49 screenshots (Playwright, Chromium, the static files): every board at 1440 / 820 / 390 in light and dark, every pop-up, every variant |

## Switches (top bar of every board; also URL parameters)

| Switch | Values | Attribute / token | URL |
|---|---|---|---|
| Viewport | 1440, 820, 390, full window | container queries on `.device` | `vp=` |
| Scheme | light, dark | `html[data-theme]` | `scheme=` |
| Surface | fill (calm, slider-fill pills), gradient (per-entity hue wash), glass (frosted cards) | `html[data-bubble-surface]` | `surface=` |
| Density | wide, regular, compact, row (grouped one-column list) | `html[data-bubble-density]` -> `--sw-pill-h`, `--sw-icon-ring`, `--sw-sub`, `--grid-min`, `--grid-gap`, `--pill-nm`, `--pill-st` | `density=` |
| Pop-up transparency | 88 % (Bubble default), 72 % (default here), 58 % | `html[data-glass]` -> `--sw-sheet-alpha` | `glass=` |
| Cards / list | per board, a segmented control on the page | `view=` | `view=` |

Other URL parameters: `open=area|confirm|light` (home), `open=light|climate|cover|tree` (area), `open=player|group|vol` (media), `area=<id>`.
Surface and density are plain data attributes + tokens on purpose, so they can become per-user settings later
(the owner asked for "several styles within the style", not one locked look).

## What is in it (interaction)

- **The pop-up (hero).** One sheet component for every pop-up: translucent (`rgba(--sw-sheet-rgb, --sw-sheet-alpha)`) with a
  26 px backdrop blur + saturation, a 1 px light top edge and a hairline ring, over the live page which is dimmed and blurred 3 px.
  Pills inside the sheet are translucent layers again (`--sw-layer`), so you see layer over layer over the live page. Phone: bottom sheet
  with grabber, swipe down to close (35 % of its height or a fast flick), rubber band upwards. Tablet/desktop: centred dialog
  (560 px, area pop-up 760 px). Opening: spring (`--sw-ease-thumb`, 460 ms); the content "focuses in" (blur 6 px -> 0, staggered),
  taken from the Bubble intro video. Closing 200 ms ease-in. Sheet-to-sheet swap (player -> group, room picker -> area) cross-fades the
  content without closing. Esc, scrim click and the close button close it; focus moves in, Tab is trapped, the page behind is `inert`,
  focus returns to the opener. `prefers-reduced-motion`: no transitions or animations. `prefers-reduced-transparency` or no
  `backdrop-filter` support: solid `--sw-surface-solid`.
- **Pills.** A light is a slider pill: tap toggles, drag along it sets brightness, keyboard arrows step 5 % (RTL: ArrowLeft = up), Enter toggles.
  The label is drawn twice and clipped at the fill edge (dark on the warm fill, normal text on the rest) so text keeps contrast on both
  sides; Bubble itself keeps one colour. The round icon opens the device pop-up.
- **Climate** pill with a +/- stepper; pop-up with a big target temperature, mode and fan chips. **Covers**: pill (position as fill) + up / stop / down.
- **Media** pill (Bubble media-player card): cover-art ring, group count, volume, big round play/pause; the volume button morphs the pill into a
  slider row (mute, slider, close, play), as in the video. Player pop-up: art, progress (LTR), transport (LTR), volume, group row.
  Group pop-up: master volume, every speaker with join / leave and its own volume slider, dissolve group.
- **Scene dropdown** (Bubble select): "אווירה" pill at the top of the lights section; floating list (בהיר, חמים, רגוע, מעומעם, קולנוע, ...)
  with the current item filled, arrow keys, Enter, Esc.
- **Building tree** kept on every board (desktop and tablet panel, per-floor collapse, lit counts, current area). Phone: the area board has a
  floor + area pill strip; the floating home button opens the **room picker** pop-up (the owner's "Choisir une pièce"): floors as collapsible
  separators, areas as pills; picking one on Home swaps the picker into that area's pop-up.
- **List / table mode** on every board (areas, devices, players) with pill-shaped rows.
- Operator screens have no hint paragraphs, no badges beyond counts, and no system branding ("תשתית המערכת" rule respected: nothing names the platform).

## Tokens (the `bubble` skin)

Existing names from `frontend/src/design/tokens.ts` (branch `pilot/design-foundation`) unless marked NEW. Values are light / dark.

| Token | Light | Dark | Note |
|---|---|---|---|
| `--sw-bg` | `#eceef5` | `#2b2a37` | dark measured in the Bubble video: page `#31303e`, deepened a step |
| `--sw-canvas` | bg + 2 soft blooms | bg + 2 soft blooms | blooms give the glass something to refract; `surface=glass` adds a third and makes them stronger |
| `--sw-surface` | `#dfe3ee` | `#4a4356` | pill; video pill `#524a5c` |
| `--sw-surface-2` / `-3` | `#cfd5e3` / `#c1c9da` | `#5a5268` / `#675e77` | sub-buttons, tracks / hover |
| `--sw-surface-solid` | `#f4f5fa` | `#3b3548` | no-blur fallback; video sheet about `#443c4e` |
| `--sw-text` / `--sw-text-2` / `--sw-text-3` | `#20263b` / `#3d4459` / `#4f566c` | `#ffffff` / `#ddd6e8` / `#d0c9dc` | |
| `--sw-accent` / `--sw-accent-text` | `#2767ed` / `#1d4fc4` | `#4c6fd9` / `#c9d6ff` | our blue kept (open question 2) |
| `--sw-overlay` | `rgba(30,36,56,.28)` | `rgba(14,12,22,.42)` | dims the live page behind a pop-up |
| `--sw-highlight` | `rgba(255,255,255,.85)` | `rgba(255,255,255,.16)` | 1 px top edge of floating glass |
| `--sw-r-sm/md/lg/xl/pill` | 12 / 18 / 28 / 42 / 999 px | same | Bubble sub-button 18, row 28, pop-up 42 |
| `--sw-shadow-1/2/3` | none / soft / deep | none / soft / deep | cards flat, floating layers lifted |
| `--sw-glass-blur` | `none` | `none` | cards flat in the default surface |
| `--sw-glass-blur-nav` | `blur(18px) saturate(150%)` | same | rail, tree panel, phone stack |
| `--sw-glass-blur-sheet` | `blur(26px) saturate(160%)` | same | Bubble uses 10 px; more here for the owner's transparency |
| `--sw-t-fast` / `--sw-t-med` | 200 / 300 ms | same | Bubble 0.2 / 0.3 s |
| `--sw-ease` / `--sw-ease-thumb` | `cubic-bezier(.4,0,.2,1)` / `cubic-bezier(.34,1.32,.64,1)` | same | spring = Bubble stack rise overshoot |
| NEW `--sw-sheet-rgb` + `--sw-sheet-alpha` | `246,247,252` + `.72` | `59,53,72` + `.72` | sheet colour composable with alpha; 0.88 = Bubble default |
| NEW `--sw-layer` / `--sw-layer-2` | `rgba(255,255,255,.55)` / `.8` | `rgba(255,255,255,.08)` / `.14` | pill on a translucent sheet |
| NEW `--sw-nav-glass` | `rgba(246,247,252,.62)` | `rgba(43,42,55,.6)` | rail / tree / phone stack |
| NEW `--sw-backdrop-blur` | `blur(3px)` | same | the live page behind the sheet |
| NEW `--sw-lit` / `--sw-lit-cool` / `--sw-on-lit` / `--sw-lit-soft` | `#f3a43c` / `#ece4c9` / `#2b1a05` / 32 % | `#f19e33` / `#e3e0cf` / `#2b1a05` / 34 % | warm light fill measured in the video (`#f19e33`) |
| NEW `--sw-hue-1..8` | 8 area / entity hues | 8 (video room colours) | icon rings and the gradient surface; decoration, never meaning |
| NEW `--sw-cool` / `--sw-heat` | `#2f8fb8` / `#e0662f` | `#4aa8d8` / `#ff7a45` | climate pill fills |
| NEW `--sw-pill-h` / `--sw-icon-ring` / `--sw-sub` | 56 / 40 / 36 px | same | density changes them (wide 76/54/42, compact 46/32/32, row 54) |
| NEW `--sw-gap` / `--sw-gap-grid` / `--sw-s-1h,3h,4h` | 8 / 14 / 6,14,18 px | same | Bubble spacing family |
| NEW `--sw-t-sheet` / `--sw-t-state` | 460 / 900 ms | same | spring sheet; slow state fade (Bubble 1.5 s, shortened for operators) |
| NEW `--sw-ease-dialog` | `cubic-bezier(.16,1,.3,1)` | same | Bubble centred pop-up |
| NEW `--sw-tree-w` / `--sw-sheet-w` / `--sw-sheet-w-wide` | 286 / 560 / 760 px | same | layout |

The state colours (`--sw-success-*`, `--sw-warning-*`, `--sw-danger-*`) follow the foundation set, with three text tones deepened for contrast
(`--sw-success-text` light `#116330`, `--sw-danger-text` light `#a01515` / dark `#ffc8c3`). Structural items that a skin cannot do alone
(the floating phone stack, the floating home button, pill-row list mode, the room picker) are base changes, as the analysis already noted.

## Contrast (computed, `contrast.mjs`)

68 pairs, light and dark. Translucent surfaces are composited over the dimming overlay and the worst plausible content behind them
(page bg, warm light fill, accent, a vivid ring, pure white, near black); blur only averages, so a large uniform area of that colour is the
worst case. `color-mix(in oklab)` of the gradient surface is reproduced in OKLab.

Result: **66 pass, 2 fail**, both only at the 58 % "maximum transparency" position:

| Scheme | Pair | Ratio |
|---|---|---|
| light | secondary text on the sheet at 58 % over near-black content | 3.43 |
| dark | secondary text on the sheet at 58 % over white content | 4.40 |

At the default 72 % and at Bubble's 88 % every pair passes (lowest: light secondary text on the sheet at 72 % over near-black, 4.93;
dark white on accent 4.58; light cool-pill text 4.58). Fixed during the work (they failed first): light `text-3` on surface-2, light white on the
weather hue, light success text, danger text on its soft fill (both schemes), dark accent text on accent-soft, and the gradient surface's light
fill with white text (2.92) - the lit part is now a light tint with dark text. Not computed: icons (3:1 rule), text over cover art (the art
is under a 72 % glass layer in the hero; real artwork varies), and every intermediate point of a gradient (both ends are checked).

## What the references showed (and what was taken)

**The YouTube video** (https://www.youtube.com/watch?v=0hSQOlBxKKI, "Bubble Card for Home Assistant - Introduction", Clooos, 2:45,
published 2024-09-04). Read in the built-in browser: title, description and the auto chapters (Intro 0:00, Popup 0:28, Button 0:41,
Horizontal Button Stack 1:03, Media Player 1:20, Cover 1:30, Select 1:43, Separator 1:53, Conclusion 2:04). **The transcript could not be read**
(the caption endpoint returned an empty body and the transcript panel stayed empty). Frames were paused and captured at 1080p at about
10, 30, 32, 34, 37, 39, 46, 50, 58, 70, 84, 88, 96, 108, 118 and 126 s, and pixel colours were sampled from the video frames:
- dark dashboard page `#31303e`, pill `#524a5c`, icon ring on a coloured pill `#463c49`, weather pill `#2a7ea3`, media pill `#f19e33`,
  room rings in vivid hues (`#ef3464`, `#7b84eb`, ...), pop-up sheet about `#443c4e` (mauve, translucent);
- the pop-up is a tall rounded sheet whose header is itself a pill with sub-buttons (temperature, scene dropdown, power) and a close button;
  sections are separators (icon + bold label + a rounded 6 px line);
- lights are slider pills, the fill is the light's colour (warm orange, beige for white lights), partial width = brightness;
- the media pill's volume button turns the pill into a slider row (mute, track, %, close, play) - reproduced;
- covers = a pill + three round buttons (up, stop, down); select = a pill with a round chevron that opens a floating list;
- the horizontal buttons stack at the bottom: outlined pills, the active one filled;
- motion: the pop-up content appears blurred and sharpens as the sheet lands - reproduced as "focus-in".

**The owner's references** (private, not in git; `private/design-refs/bubble/`: 9 images, 16 + 18 frames of two screen recordings).
The images include two of our own phone screens (live cameras, media screens) used only as context, never copied. Extracted:
- room picker pop-up "Choisir une pièce" over a dimmed live dashboard, opened from a floating round home button (bottom corner) - reproduced as "בחירת אזור";
- the colourful variant: every pill is a hue-to-hue gradient wash with a solid saturated icon ring and white/near-white text, the brightness
  fill is a stronger band of the same hue - reproduced as `surface=gradient` (fill is a light tint with dark text for contrast);
- the calm variant: slider-fill pills, "67 %" value inside the pill - reproduced as `surface=fill` (default);
- the room pop-up head: name, an amber brightness pill ("100 %", "75 %"), a blue power button, close - reproduced (area-brightness mini slider);
- the scene list "Ambiance": Clair, Chaleureux, Détente, Tamisé, Cinéma, Cinéma sombre, Fête, Musique, Custom - reproduced in Hebrew;
- big rounded glass tiles on a blurred gradient wallpaper (calendar, weather, media with blurred album art, ambience carousel) - reproduced as
  `surface=glass` and the media hero over blurred art; the ambience carousel and calendar tile were **not** built (scope);
- a top header with avatar + three pill nav buttons + gear - **not adopted**: our shell keeps the side rail (owner rule), see question 4;
- bottom room chips (icon + label, one filled, others outlined) - present as the phone floor/area strip and the phone pill stack;
- light and dark versions of the same pop-up - both schemes built for everything.

## Layout safety check (`layout-check.mjs`)

Owner rule (2026-10-02): a floating element must never overlap or clip content, and nothing may leave its bubble. The first version broke it
(the floating home button sat over the "all lights" pill around 600-800 px, the phone pill bar covered the last rows). Fix, by design rather
than by offsets: the phone **dock** (pill bar + home button) is now a **row of the layout grid** (`.app` rows `1fr auto`), so the scrolling
column ends above it and nothing can ever sit under it; on tablet and desktop the home button is not shown (the tree panel does its job).
The pop-up grabber is a 44 px in-flow row of the sheet. The toast is transient and sits above the dock.

```
node docs/design/mockups/bubble-taste/layout-check.mjs            # full sweep, ~25 min, exit 1 on any finding
node docs/design/mockups/bubble-taste/layout-check.mjs --quick    # 4 widths, ~8 min
node docs/design/mockups/bubble-taste/layout-check.mjs --json out.json
```

Playwright comes from `SW_PLAYWRIGHT`, a global `playwright`, or `frontend/node_modules/playwright` (also the main checkout's when run
from a worktree). The sweep runs every board x width (320, 360, 390, 480, 600, 768, 800, 820, 1024, 1280, 1440) x density (wide,
regular, compact, row) x surface (fill, gradient, glass) x theme (light, dark), plus transparency (88 / 72 / 58 %) x theme at the default
style; for each it checks the page (cards and list; media also the volume morph) with the main column scrolled to the top and to the bottom,
and the board's pop-ups (home: area, confirm; area: light, climate, cover; media: group, player). Reduced motion is on so every state is
measured settled. Classes:

| Class | Fails when |
|---|---|
| escape | an element, or a text run, lies outside the box of the bubble that contains it (pill, card, chip, sub-button, sheet, ...) |
| overflow | the page, the device, the main column or a pop-up body scrolls horizontally |
| floating | an absolutely / fixed / sticky positioned element intersects interactive content outside itself (modal layers excluded) |
| clipped | text cut by an overflow box without an ellipsis, or text sitting in a bubble's rounded corner |
| target | an interactive element below 44 x 44 px in touch layouts (<= 1100 px) or 32 x 32 px in desktop pointer layouts |

Fixes that came out of it: the dock as a layout row; phone dock sizing (five 44 px items + the home button from 320 px); every target
44 px in touch layouts (sub-buttons, steppers, chips, table icons, segmented buttons, the grabber); pills wrap their sub-buttons under the
label instead of pushing them out (pop-up head with the brightness pill, climate stepper, media pill at narrow widths); tables use a fixed
layout with truncating cells and drop secondary columns by the width of their column (container query), not the window; the media hero
stacks by its column width (it overflowed at 800 px with the tree panel); row-density covers stack below 440 px; the tree hides floor
counts on touch so the floor names fit; pop-up rows never shrink (the player volume slider was squeezed to 34 px at 480 px).
Visually hidden screen-reader text (`.sr`) and the decorative clipped label layers are excluded.

Results (full sweep, 4,312 checks each; "distinct" = unique element + board + state + finding):

| Class | Before the fix (commit `78175390`): instances / distinct | After |
|---|---|---|
| escape | 1,308 / 71 | 0 |
| overflow | 114 / 14 | 0 |
| floating | 5,602 / 115 (pill bar and home button over pills, sub-buttons, play buttons at 320-820 px) | 0 |
| clipped | 0 / 0 (the rounded-corner rule was added later, after a wrap regression the screenshots showed) | 0 |
| target | 44,562 / 530 (36 px sub-buttons, 40 px rings, 34 px steppers, 22 px grabber, 42 px dock items at 320 px) | 0 |

The final full run: 0 findings, 0 page errors (about 25 minutes).

## Verification (actually run)

- Layout sweep `layout-check.mjs`: full run 4,312 checks, **0 findings** (table above).
- Screenshots: `screens/` - 49 PNGs (re-shot after the layout fixes) via Playwright Chromium (the frontend's installed Playwright) on the static files; console errors and warnings collected on every capture: **0**.
- Interaction script (Playwright, not committed - scratchpad): pop-up opens from the keyboard, focus moves in, background inert, Tab trapped
  after 60 presses, Esc closes, focus returns to the opener, scrim click closes, light slider +10 % with ArrowLeft, Enter toggles, scene
  list keyboard selection, phone swipe-down closes, reduced motion removes the sheet transition, no console errors: **14 / 14 pass**
  (the swipe check failed on the first run - a detection bug, fixed).
- `contrast.mjs`: 68 pairs, 2 fail (above).
- Not run: real phones / Safari (backdrop-filter performance on wall tablets is the known Bubble risk), screen readers.

## Open questions for the owner

1. Surface default: calm slider-fill (`fill`), colourful gradient, or glass? (All three stay available as per-user styles.)
2. Accent: keep our blue `#2767ed` (light) / `#4c6fd9` (dark), or the Bubble mauve/azure palette?
3. Pop-up transparency: 72 % (all text passes) or 58 % (secondary text fails over very dark / very light content)?
4. The reference header (avatar + pill nav + gear) vs our side rail: keep the rail on desktop (recommended) and the floating pill stack on the phone?
5. Floating round home button that opens the room picker: wanted on desktop too, or phone only?
6. Light pills: dual-colour label (keeps contrast) vs Bubble's single colour (prettier on the fill edge, fails contrast on warm fills in dark)?
7. Media progress and transport stay LTR (like timelines) - correct for Hebrew users?
8. Next step: extend to more boards (security chrome, schedules, settings) or iterate these three first?
