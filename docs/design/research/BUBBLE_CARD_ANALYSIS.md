# Bubble Card — design analysis for a "bubble" skin of SmplWise Arx

Research only (2026-10-02, branch `pilot/design-bubble-research`). No application code, no device access, no secrets.
Purpose: the owner loves the look of Bubble Card and wants a clickable mockup of the WHOLE system in that style as part of
the design phase (release 0.1.153). This document says what Bubble Card is, measures its design language from its real CSS,
maps it to our screens, proposes a token set that plugs into the existing skin layer, and estimates the mockup.

All CSS numbers below were read from a shallow clone of `Clooos/Bubble-Card` at commit `061ed837` (2026-09-25, version `v3.4.1`,
`src/var/version.js`). File references are relative to `src/` of that clone. "Verified" = read in source or fetched; "UNKNOWN" = not
established. Where the repository inherits a value from the Home Assistant theme rather than defining it, that is stated, because
that is the single most important fact for how we reuse the look (section 2.1).

## 0. Sources read, and what was unreachable

| Source | Result |
|---|---|
| Repository https://github.com/Clooos/Bubble-Card (README 2,8xx lines, `src/` 270 files, `DEVELOPERS.md`, `LICENSE`, `hacs.json`, `dist/`) | Read from a local clone: all card CSS (`components/base-card`, `sub-button`, `slider`, `dropdown`; `cards/pop-up`, `horizontal-buttons-stack`, `button`, `media-player`, `cover`, `climate`, `separator`), `tools/style.js`, `cards/pop-up/{create,style,backdrop,slide-to-close}.js`, README sections Pop-up, Horizontal buttons stack, Sub-buttons, Card layouts, Styling, Modules |
| GitHub API (repo, releases) | Read: 4,619 stars, 190 forks, MIT, created 2023-08-18, last push 2026-09-25, no wiki (`has_wiki:false`, no homepage). Releases v3.2.5 (2026-07-10), v3.3.0-beta.1..3 / rc.1 (2026-08-09..25), v3.3.0 (2026-08-28), v3.4.0 (2026-09-18), v3.4.1 (2026-09-25) |
| Releases page https://github.com/Clooos/Bubble-Card/releases (via fetch tool) | Read, but the summariser printed the year 2024; the GitHub API says 2026. The API dates are used here |
| "Docs / wiki site" | **There is no separate docs site or wiki.** The README IS the documentation (translated into 60+ languages under `i18n/`); module authoring is in `src/modules/module-documentation.md` (53 KB, not read in full) |
| Theme repo https://github.com/Clooos/Bubble (linked from the README "Styling" section) | Read the full `themes/bubble.yaml` (v1.2): this is where the actual colours and the 28 px card radius come from |
| Bubble-Card-Tools https://github.com/Clooos/Bubble-Card-Tools (backend of the Module Store) | Read the repository summary only (MIT; stores modules as YAML files under `/config/bubble_card/modules`) |
| HA Community thread https://community.home-assistant.io/t/bubble-card-a-minimalist-card-collection-for-home-assistant-with-a-nice-pop-up-touch/609678 | The page itself failed once (ECONNRESET); the Discourse JSON of the thread was reachable. Metadata read: 3,098 posts, 426,685 views, 2,052 likes, 2023-09-02 to 2026-09-26. Original post and a systematic sample of 259 of 3,098 posts (every 12th) read; keyword-filtered. **Not a full read of the thread** |
| GitHub Discussions categories "Share your modules" and "Share your custom styles, templates and dashboards" | Listing pages read via the fetch tool (titles, dates, authors only). Discussion #1672 "Frosted Glass" module read for its default values |
| Subreddit https://www.reddit.com/r/BubbleCard/ | **Unreachable.** The fetch tool refuses reddit.com; a plain HTTP request returned Reddit's "Welcome to Reddit" interstitial instead of data; a web search returned no subreddit content. Nothing from r/BubbleCard is used |
| YouTube channel https://www.youtube.com/@cloooos | **Unreadable** (footer text only, no video titles or transcripts). Per the brief, text sources only; the README says a styling tutorial video is "coming soon" |
| Demo images in the README (github-hosted `assets/...` PNG/GIF) | Not viewed (this agent read text, not images). All visual claims below come from CSS, not from screenshots. The owner's screenshots remain the visual ground truth, and the mockup must be reviewed against them |

## 1. What it is, and what we may reuse

**What.** Bubble Card is a Home Assistant custom card collection (one JS bundle, `bubble-card.js`, built with Webpack from Lit-based
sources; `package.json` depends on `lit ^3.2.1`). One config key, `card_type`, selects: `button` (switch, slider, state, name),
`pop-up`, `horizontal-buttons-stack`, `media-player`, `cover`, `climate`, `select`, `calendar`, `separator`, `empty-column`,
`sub-buttons` (a buttons-only row). Sub-buttons (three kinds: default, slider, dropdown) attach to most cards. A "Module" system
(v3.0.0, July 2025) lets users save/share CSS + JS templates and even editor fields; a Module Store inside the card editor installs
community modules (the README says 100+). Styling is also possible by themes (CSS variables), per-card `styles:` CSS and Jinja/JS
templates. It supports 60+ UI languages including RTL (v3.3.0).

**Identity of the look.** The look is a combination of the card (round, borderless, flat) and the companion Bubble theme (Catppuccin-like
palette, 28 px card radius). The card CSS itself uses almost no colour literals; it inherits from the Home Assistant theme (2.1).

**License: MIT** (`LICENSE`, "Copyright (c) 2023 Cloos"; GitHub API: `spdx_id MIT`). The theme repo and Bubble-Card-Tools are MIT too.

What that allows for us (engineering reading, not legal advice):

| Use | Allowed? | Condition |
|---|---|---|
| Take the visual language as inspiration: shapes, proportions, behaviours, interaction patterns | Yes | None. Design ideas are not copyrightable subject matter in the way code is |
| Re-measure and re-express numeric values (radii, blur radius, durations) in our own token names | Yes | None for plain numbers; they are facts of a design |
| Copy or closely translate its CSS/JS source (e.g. the slide-to-close gesture code, the stack's `from-bottom` keyframes, the marquee) into our code | Yes under MIT | Keep the MIT copyright + permission notice with the copied portion (a `THIRD_PARTY_NOTICES` entry) |
| Use the Bubble name/logo/screenshots in our product | Not granted by MIT; avoid | Product rule anyway: the UI must not show another product's branding (see `feedback-no-ha-branding`) |
| Embed Bubble Card itself in our UI | Not applicable | We are Lit-based but render our own components, not HA cards; HA is hidden from operators |

**Recommendation:** reuse ideas and numbers, write our own components. We are Lit-based (as is Bubble Card), so a port would be
technically cheap, but it would drag in HA-card assumptions (`hass`, `ha-card`, `--mdc-*`, jinja) and in a large editor and
module code we do not need. The distinct, small pieces worth considering for a real implementation later (not for the mockup) are the
slide-to-close gesture (a 24 KB file incl. slider-conflict handling) and the pill-stack scroller; if copied, add the notice.

## 2. The design language in measurable terms

### 2.1 Where the values come from (a critical point)

Bubble Card does not own a palette. Almost every surface is `var(--bubble-X, var(--bubble-Y, ..., var(--card-background-color, var(--ha-card-background))))`:
the card draws with whatever HA theme is active, and exposes `--bubble-*` variables as optional overrides. So "the Bubble look" the owner
loves = **the card shapes + the Bubble theme** (https://github.com/Clooos/Bubble, `themes/bubble.yaml`). I therefore measured both.

Fallback chain for a card background (`components/base-card/styles.css`, `.bubble-container`):
`--bubble-card-type-main-background-color` -> `--bubble-main-background-color` -> `--background-color-2` -> `--secondary-background-color`.
Icon/sub-button/slider surfaces: `--bubble-icon-background-color` -> `--bubble-secondary-background-color` -> `--card-background-color` -> `--ha-card-background`.

### 2.2 Geometry (verified in CSS)

| Element | Value | File |
|---|---|---|
| Button / card row height | **50 px** (normal); `large` = `var(--row-height,56px) x rows + row-gap 8px x (rows-1)` | `base-card/styles.css` `.bubble-container`, `.large` |
| Card radius | `--bubble-border-radius`, default **`calc(var(--row-height,56px)/2)` = 28 px**, i.e. a full pill at row height; HA theme `ha-card-border-radius` is also 28 px | base-card, `bubble.yaml` |
| Card shadow / border | **none / none** by default (`--bubble-box-shadow`, `--bubble-border` empty); flat fills only, no hairlines | base-card |
| Icon container | min 38 x 38 px (large: 42), margin 6 px (large: 8 px inline-start), **circle** (`50%`), icon 24 px in large | base-card `.bubble-icon-container` |
| Name / state text | name **13 px / 600**, state **12 px / 400 at opacity .7**, line-height 18 px; name margin 4 px start, 16 px end; "state only" 14 px | base-card |
| Sub-button | height **36 px**, min-width 36 px, padding 0 8 px, font **12 px**, radius 18 px (full pill), icon 16 px with state text / 20 px alone, group gap **8 px**, container inset 8 px from the end edge | `sub-button/styles.css` |
| Two-row sub-button mode | height 20 px, gap 4 px | same |
| Main buttons container (media, cover, climate) | gap **4 px**, 36 x 36 round buttons (media/cover), +/- steppers 34 x 34 with 2 px margin, icon 16-20 px | `media-player`, `cover`, `climate` styles |
| Slider track | fills the whole button; fill = accent, width follows value; **drag disables the transition** | `slider/styles.css` |
| Horizontal buttons stack | bar height **51 px**, buttons 50 px tall, radius 32 px, padding 0 16 px, icon 24 px, icon-name gap 8 px, **bottom: 16 px**, fixed; width = viewport - sidebar - 8 px (mobile: 100% - 16 px, inset 8 px); content centred, scrolls horizontally with a **28 px edge fade mask**; optional 100 px high bottom gradient behind it (`has-gradient`) | `horizontal-buttons-stack/styles.css` |
| Pop-up | radius **42 px** (`--bubble-pop-up-border-radius`; content radius defaults to it), inner padding **18 px**, gap between cards **14 px**, desktop width **540 px** (mobile 100%, 7 px inset), top offset 56 px (HA header height), header min-height 50 px with padding 18 18 22, header overlap -50 px so content tucks under the header | `pop-up/styles.css` |
| Pop-up scroll fade | top 24 px, bottom 16 px alpha mask when scrollable | pop-up styles |
| Pop-up modes | `default` (full-height bottom sheet), `fit-content`, `centered`, `adaptive-dialog` (sheet on phone, dialog on desktop) | pop-up styles/README |
| Page grid (theme) | `grid-card-gap` **18 px**, `horizontal-stack-card-margin` 0 10 px, `control-button-border-radius` 50 px | `bubble.yaml` |
| Dashboard column (theme) | on desktop `max-width: 520px`, centred: the design is a single phone-width column | `bubble.yaml` `card-mod-view-yaml` |

Spacing is a 2/4/6/8/14/16/18 px family; 8 px is the dominant step. Radii are 18 / 28 / 32 / 42 / 50 px: everything interactive is a pill or circle.

### 2.3 Colour and opacity logic

**Palette (Bubble theme v1.2, `bubble.yaml`), verified:**

| Role | Dark | Light |
|---|---|---|
| Page background (`background-color`) | `rgba(57,54,70,1)` = #393646 (a muted aubergine) | `#eff1f5` |
| Card / button surface (`ha-card-background`) | `rgba(79,69,87,1)` = #4F4557 | `#dce0e8` |
| Secondary surface (`background-color-2`, sliders, inactive chips) | `rgb(92,83,103)` = #5C5367 | `#ccd0da` |
| Text | `#ffffff`; secondary `rgb(244,238,224)`; medium `#A0A2A8`; disabled `#626569` | `#4c4f69`; secondary `#5c5f77`; medium `#6c6f85` |
| Accent (`accent-color`) | `rgb(80,110,172)` = #506EAC | `#e69c9c` (dusty rose) |
| "Active card" fill (`ha-card-background-active`) | `rgba(103,114,209,.4)` + radial gradient from bottom `rgba(103,114,209,.5)` to transparent at 70% | `rgba(220,224,232,.4)` + same gradient |
| Badge colours | red `rgba(73,85,108)`, blue `rgba(26,137,245)`, green `rgba(0,202,139)`, yellow `rgba(222,176,107)` | same |
| Alarm armed | `rgba(247,53,67)` | n/a |
| Scrim behind HA dialogs | `rgba(0,0,0,.6)` + `blur(15px)` | same |

Note the light and dark palettes are **different hues** (the light theme is Catppuccin Latte: `#eff1f5`, `#dce0e8`, `#ccd0da`, `#4c4f69`).
The card itself defaults to HA's colours when no Bubble theme is used.

**Default Bubble blue (card code, `tools/style.js` `createBubbleDefaultColor`):** `rgb(0,145,255)` mixed 70 % with the page background
(30 %), written to `--bubble-default-color`. Fallback backgrounds: dark `[17,17,17]`, light `[250,250,250]`. So the default accent
is a vivid azure pulled toward the page, not a fixed hex.

**Active / inactive logic (verified, `cards/button/changes.js`, base-card):**
- Switch ON: button fill = accent at **opacity 1**; light entities use the light's real colour at **opacity .7**; an "attention" state (alarm) = red at opacity 1.
- Switch OFF: fill `rgba(0,0,0,0)` at opacity **.5** (the secondary surface shows through).
- Icon: ON opacity 1, OFF opacity **.6**; unavailable: whole card opacity **.5**, `cursor: not-allowed`, sub-buttons hidden.
- Sub-button ON: accent background (`--bubble-sub-button-light-background-color`); on a light fill the text switches to `rgba(0,0,0,.65)` automatically (contrast fix, v3.4.1).
- Slider fill: accent at opacity 1; for lights the light colour at .7 (`rgb(225,225,210)` default).
- State = **fill + icon opacity + text**, never colour alone (good match with our "shape + text" accessibility rule).
- Climate temperature colours reuse HA's `--state-climate-*` variables (heat/cool/auto/dry/fan).

**Pop-up surface (`cards/pop-up/style.js`, `create.js`):** Bubble style defaults: `bg_opacity` **88**, `bg_blur` **10 px**, `bg_lightness` **1.02**
(channels x 1.02), `shadow_opacity` **0**, width 540 px. The HA-style variant is the opposite: opacity 100, blur 0, shadow 100, width 580 px.
So the signature Bubble pop-up is **a 88 %-opaque page-coloured sheet with a 10 px backdrop blur and no shadow**; when "is-popup-opened" a
`0 0 50px rgba(0,0,0,var(--custom-shadow-opacity))` shadow is available (default 0).
Backdrop behind the sheet: theme background at **alpha .8, channels x .6** (`convertToRGBA(bg, 0.8, 0.6)`), optional `backdrop_blur` (default 0), fade **.3 s**.

### 2.4 Glass and blur: what is real and what is not

Bubble Card is **not** a glass UI by default. The base cards have no blur. The only built-in blur is the pop-up sheet (10 px at 88 % opacity)
and an opt-in backdrop blur. The "frosted glass" look people post is a community module ("Frosted Glass", discussion #1672, Pscharumbel,
July 2025, 183 comments): defaults blur 10 px, radius 32 px, light effect size 1 / brightness .4, `background-blend-mode: overlay`, inset
highlight `rgba(255,255,255,.4)` and inset dark edge `rgba(0,0,0,.1)` (visionOS / "liquid glass" inspired). The performance code comments are
explicit that a `blur(0px)` is expensive on weak GPUs, so blur is skipped when 0 (`pop-up/create.js`). **For the owner's brief this matters:**
the loved look is primarily flat pills + colour fill + sheet pop-ups; our existing Domus skin already provides the glass. A bubble skin should
default to **flat** and offer glass only on floating layers.

### 2.5 Typography

No font is set by the card: it inherits the HA font (`--ha-font-family-body`, Roboto fallback); the Bubble theme sets `sans-serif` for all roles.
Sizes: 12 / 13 / 14 px, weights 400 and 600, line-height 18 px, text is `user-select: none`, long text becomes a marquee (8 px fade masks).
There is no large display type. Compared with our Domus skin (44 px page titles), Bubble is a **small-type, single-line** system.
For Hebrew the Heebo stack we ship works unchanged (13 px/600 and 12 px/400 are fine for Heebo; verify legibility at 12 px on desktop).

### 2.6 Motion

| Where | Value |
|---|---|
| Card background colour change | `transition: background-color 1.5s`; the wrapper `all 1.5s` (slow, soft state fade: a Bubble signature) |
| Icon colour/opacity | `.3s ease-in-out` |
| Slider fill | `.5s ease-in-out`, **none while dragging** |
| Sub-buttons | `all .5s ease-in-out`; slider overlay in/out `.2s ease-in-out` + 14 px translate |
| Media/cover buttons | `all .3s ease`; cover-art crossfade `2 s ease` |
| Pop-up open/close (sheet) | `transform .3s ease`; closed = `translate3d(0,100%,0)`; fast-open keyframe from `translateY(14px)` and opacity .84 |
| Pop-up centered/dialog | open `.35s cubic-bezier(.16,1,.3,1)` + opacity `.25s`; from scale .85; close `.2s ease-in` to scale .9 |
| Backdrop | opacity `.3s` |
| Pop-up blur layer | opacity `.4s ease` |
| Stack rise | `from-bottom .6s`: keyframes 0% `translate(-50%,100px)`, 26% -8 px, 46% +1 px, 62% -2 px, 70% 0 (a small **spring overshoot**); button translate `1s`; highlight pulse `1.4s infinite alternate` brightness .7 -> 1.3 |
| Slide to close | closes past **50 % of height** or velocity > **0.5 px/ms** within 100 ms; drag slop 8 px; rubber-banding (`slide-to-close.js` constants) |

Our existing tokens: `--sw-t-fast` 120 ms, `--sw-t-med` 200 ms/220 ms (Domus), `--sw-ease: cubic-bezier(.2,0,0,1)`,
`--sw-ease-thumb: cubic-bezier(.34,1.3,.64,1)` (Domus). Bubble's characteristic motion is **slower and softer** (300-500 ms, 1.5 s colour
fades) with one springy entrance.

### 2.7 Light and dark handling

Bubble Card does not branch on scheme in its CSS; it reads the HA theme (`--primary-text-color`, `--card-background-color`) and, for the
default accent, measures the page background's luminance in JS (`tools/style.js`) to pick dark/light fallbacks. The Bubble theme ships two
separate palettes (`modes: dark | light`, section 2.3). For us: two token columns, as our token table already does (`{light, dark}`).

### 2.8 CSS variables Bubble exposes (verified by frequency scan of `src/`)

Core: `--bubble-border-radius`, `--bubble-main-background-color`, `--bubble-secondary-background-color`, `--bubble-icon-background-color`,
`--bubble-accent-color`, `--bubble-default-color`, `--bubble-icon-border-radius`, `--bubble-box-shadow`, `--bubble-border`, plus per-card
variants via the `card-type` token (`--bubble-button-*`, `--bubble-media-player-*`, `--bubble-cover-*`, `--bubble-climate-*`,
`--bubble-select-*`, `--bubble-calendar-*`, `--bubble-horizontal-buttons-stack-*`, `--bubble-sub-button-*`, `--bubble-sub-slider-*`).
Pop-up: `--bubble-pop-up-border-radius`, `--bubble-pop-up-content-border-radius`, `--bubble-pop-up-main-background-color`,
`--bubble-pop-up-background-color`, `--bubble-pop-up-gap`, `--bubble-pop-up-border`, `--bubble-pop-up-mask-*`, `--bubble-backdrop-background-color`,
`--bubble-backdrop-filter`. State colours: `--bubble-state-climate-{heat,cool,auto,dry,fan-only,heat-cool}-color`, `--bubble-state-humidifier-on-color`.
The **cascade design** (specific -> general -> theme -> default) is the best idea to copy: every component token falls back to one shared token,
so a skin only sets 6-8 values and optionally overrides single components.

## 3. Components and interaction patterns

| Pattern | How Bubble does it | Notes for us |
|---|---|---|
| **Button card** (types: switch, slider, state, name) | One 50 px pill: round icon container on the inline-start, name + state stacked, sub-buttons at the end. Tap = toggle, hold = more-info/popup. In slider mode the pill is the slider; fill is the accent | The row-pill is the unit of the system. The slider-in-button (drag the whole pill) is directly reusable for lights/blinds/volume; touch targets are 50 px so fine |
| **Pop-up** (hash-opened, `#kitchen`) | Bottom sheet that rises over a dimmed + blurred dashboard; header is itself a button card (icon, name, state, sub-buttons, close); content = any cards in a 14 px-gap column; swipe-down / Escape / outside-click / hash removal close it; can auto-open from an entity state ("trigger"); modes `fit-content`, `centered`, `adaptive-dialog` | This is the central pattern: **an area, a camera, a player = a sheet**. On desktop it is 540 px wide - far too narrow for our operator density (see 4) |
| **Horizontal buttons stack** | Floating bottom bar of pill buttons (icon + name), scrolls with edge fade, **auto-reorders by last-triggered motion sensor** (`auto_order`, PIR sensors), highlights the current view, rises on page load with a spring | Nice for phone room navigation; auto-reorder is a "recently active room first" idea that maps to our areas (needs a clear off-switch; our users reorder tabs manually) |
| **Sub-buttons** | Up to many 36 px pills at the end of a card or fixed to the bottom; kinds: default (icon/text/state), **slider**, **dropdown**; groups with inline/column layout; `main` vs `bottom` placement; auto-switches card to "large" | Our tiles already carry controls; a "secondary actions row" pattern is useful on area cards (e.g. scene chips) |
| **Media player card** | Pill with cover-art crossfade background (2 s), 36 px play/prev/next/volume buttons; volume = expanding slider overlay with mute | Matches our media drawer; cover-art backdrop works if the art is licensed/available |
| **Cover card** | Open/stop/close + tilt buttons, position slider; a 30 % dimmed state | Maps to shutters in our area screen |
| **Climate card** | Pill with +/- steppers, target temperature display, mode colours from state-climate variables, separate low/high temperature chips | Maps to our climate tiles |
| **Select / dropdown** | Pill with arrow button, floating list with accent-selected item | Reuse for our scene/source selects |
| **Calendar, separator, empty column** | Date-grouped event list; labelled divider line; layout spacer | Separator = section title in dense lists |
| **Editor** | A Home Assistant form editor; a full **Module Editor** (YAML + JS, live preview) and a **Module Store** (browse, search, install, update, import/export, global enable, exclude single card) | Not something to build; the Store is the model for a future "skin gallery" if designers (Astra/Figma) add skins |
| **Section view layouts** | `normal`, `large`, `large-2-rows`, `large-sub-buttons-grid` (columns/rows in HA sections) | Our home editor already has a 12-column grid; Bubble's `large` card (n rows tall) maps to our tile sizes |
| **State-triggered conditions / templates / actions** | `trigger`, `visibility conditions`, Jinja and JS templates in names/icons/styles | Out of scope for a skin |

**What users say (HA community thread, sample).** Praise centres on mobile-first pop-ups and the module system; recurring requests and
complaints in the 259-post sample: the unused top space on mobile (the theme hides the HA header), pop-ups "too small to read on a wall
tablet" (June 2024 post about a PIN pad), the horizontal stack cutting off the 5th button on a landscape tablet (Sept 2023), border-radius
and theme override difficulty, and blur performance on some browsers. These **confirm that the design is mobile-first and phone-column
shaped** and weaker for wall tablets and desktops - exactly our operator-density concern. Community "wall mounted dashboard" and "desktop
display" showcases exist (discussion titles dated 2026-01-07), so desktop use is possible but is built by users, not by the card defaults.

## 4. Mapping to OUR screens

Our invariants (AGENTS.md, `docs/design/*`, memory): RTL Hebrew shell; video, map and timeline never mirrored; four primary areas (ראשי,
אבטחה, מפה, WisKey; plus Multimedia in the recent design) on a **side rail** (phone: bottom bar); operator screens are **clean** (no hints,
badges or paragraphs); no Home Assistant branding on operator screens; **the floors/areas tree survives every skin** (desktop: prominent panel
with per-floor collapse, bulk menu, lit counts, selection; phone: floor cards); **every screen family has a list/table variant**
(אריחים | כרטיסים | רשימה) in light and dark; touch targets >= 44 px; text contrast >= 4.5:1; state = shape + text; skin = tokens + <= 50 rules
(SKIN_AUTHORING_HE.md). Screen ids (H, S, M, W, G, F) are from `docs/design/handoff/SCREEN_INVENTORY.md`.

### 4.1 Pattern fit

| Our screen | Bubble pattern | Verdict |
|---|---|---|
| **Shell / navigation** (rail, bottom bar, corner float, user menu) | Horizontal buttons stack for the **phone bottom bar**: floating pill bar 51 px high, 16 px above the bottom, scrollable with edge fade, active pill filled. Desktop rail: vertical stack of the same pills (icon above label, 46-76 px items per nav-size preset) | Phone: fits well, replaces the flat bottom bar with a floating pill bar and keeps 44-94 px sizing from the nav-size setting. Desktop: keep the side rail; give it Bubble shapes (pill items, flat fills). Do not adopt the bottom stack on desktop. Auto-reorder: do not adopt (users already reorder tabs; unpredictable order harms muscle memory) |
| **H1 Home / building overview** (widgets, KPI tiles, tree, floor cards) | Section of pill cards on an 18 px grid; KPI tiles become pills with a ring icon and state text; widgets (clock, weather, alarm) become `large` cards | Fits as visual language; structure stays ours (3 selectable directions, 12-col editor). **The building tree panel stays** (see 4.2) |
| **H2 Area screen** (domain cards, device tiles, sensor readings, camera cards, bulk) | Each device = a button pill (icon ring, name, state, toggle or slider-in-pill, sub-button chips); lights/covers/climate/media use the Bubble card variants; section "כבה הכל" = a sub-button or separator action | The best fit in the system. A device tile as a 50-56 px pill is naturally a **list row**, so Bubble gives us the list mode almost for free (pills in a column), and a 2-3-column pill grid for cards mode |
| **H1a Tiles panel / H2a Bulk dialog / drawers / user menu** | Pop-up sheet: bottom sheet on phone; on desktop `adaptive-dialog`/`centered` (540-580 px) or our existing side drawer | Sheet on phone fits well and replaces our bottom sheets with a Bubble sheet (42 px top radius, 88 % + 10 px blur, grabber/slide-to-close). Keep the **side drawer** on desktop; Bubble's 540 px centred pop-up is the closest equivalent for confirmations |
| **H4-H6 Schedules** (cards / table / week, 24 h grid, slot panel) | Cards: pill cards with `sw-schedule-bar` inside. Editor grid: **no Bubble equivalent** | Restyle only (pill chips, sheet for slot panel, flat fills). The 7 x 24 grid and 24 h axis (LTR by decision) are not a Bubble pattern and must not be forced into it |
| **S1 Live overview** | KPI pills, list of events as pill rows, storage ring | Fits as styling |
| **S2 Live wall / S3 Single camera / K1 Kiosk** | Pop-up with a camera (the README's own "security" popup example), media-card-like overlays for controls | **Video does not transfer** as a card: tiles stay rectangular, edge-to-edge, LTR, dark canvas (`--sw-video-bg`). Bubble contributes only the **chrome**: pill overlay chips ("חי", name), a pill control bar under/over the video, sheet for settings. Wall density (up to 32 tiles) cannot use 50 px rows |
| **S5-S6 Event centre, Playback / timeline** | List rows as pills (thumbnail ring + title + time) | Event list: fits (list mode). **Timeline is a data visualisation**: tracks, gaps, event markers, seek, never mirrored; only chips/buttons/controls get Bubble shapes |
| **S8, M1-M6 Maps, floor browser, plan editor, Plan Studio 2D/3D** | Floor browser = floor pills / cards; floor selector = horizontal stack; entity drawer = pop-up sheet | Map canvas, plan geometry and 3D stay as they are; skin tokens already cover canvas colours (`--sw-map-*`). Controls over the map (layer toggles, zoom) become round buttons. **Tree/floor switch must remain** (floors are first-class here) |
| **Media (F4-F6): TVs, players, groups, remote** | Media-player card: cover-art pill, 36 px transport buttons, expanding volume slider; remote = sheet (already a side panel/bottom sheet in our mockup) | Fits best after area. Remote keypad (D-pad, number keys) is not a Bubble pattern: style the keys as round 44+ px buttons |
| **F1-F2 Automations / scenes / scripts** (list + node/flow editor) | List: pill rows with enable toggle. Editor: none | Same as schedules: list restyled; the editor's canvas and forms use the shared form skin |
| **F3 Notifications centre** | Pill rows grouped by day with separator cards; pop-up for detail | Fits as list |
| **G1-G12 Settings** (tabs, forms, tables, wizard, audit, users, storage) | **Little**: Bubble has no forms, tables, wizards or dense admin UI (its own editor is HA's) | Restyle only: inputs as 36-44 px pill fields (radius 18-22), segmented pill tabs, cards; **tables stay tables** with pill row hover. This is where the style is thinnest and where the risk of looking "toy-like" is highest |
| **W1-W4 WisKey** | List of people/events as pills | Embedded WisKey iframe (W1) cannot be reskinned; our own screens (W2-W4) can |
| **L1 Remote sign-in, L2 PWA prompts, A1 Android** | Sheet/dialog | Restyle |
| **Alarm** (S15, G4) | Button card with attention state (red fill, opacity 1) and a pop-up keypad; the card has an "alarm" attention colour in the theme | Fits; PIN pad needs 56 px+ keys for wall tablets (community complaint about small pop-ups) |

### 4.2 The tree must survive (desktop and phone)

Bubble has no tree. The skin keeps `devices-building nav.tree` exactly as the other skins do: a prominent panel with floors (collapsible), areas,
lit counts, bulk menu, selected row. In Bubble style: panel = flat surface, 28 px radius, rows = **pills** (radius `--sw-r-pill`, 44 px high),
selected row = accent fill (opacity 1) with start-edge icon ring, collapse chevron as a 36 px round sub-button, counts as 24 px pill chips.
This is consistent with Domus 5 (`.tree-row` pill rows, selected = accent-soft) so the tree rule set is a small variation of an existing one.
Phone equivalent (already required): floor cards; in Bubble style floors are **a horizontal stack of floor pills** (stack pattern) over the
area pill list, with all tree actions in the floor card's `...` sub-button. Both variants must be drawn in the mockup, desktop + phone, light + dark.

### 4.3 What does not transfer (and the adaptation)

| Gap | Why | Adaptation in the bubble skin |
|---|---|---|
| **RTL Hebrew** | Bubble supports RTL (v3.3.0, `:dir(rtl)` masks, `inset-inline-*` in the CSS). But icons sit on the inline-start (right in RTL) and sub-buttons at the end: this mirrors correctly | Logical properties only (our rule). Edge fade masks and spring-in translate must be direction aware (Bubble does it for the marquee and stack). **Never mirror** video, map, timeline, 24 h axes, 3D, plan geometry |
| **Desktop operator density** | The card is a single-column 520-580 px design with 50 px rows; community built wall dashboards themselves | Use the pill as the *row component* but let the page use our grids (desktop: 2-4 columns, compact density = 44 px pill, 8 px gap). Pop-ups: widths 540 (confirm) / 720 (area) / side drawer 360-480 on desktop; full sheet on phone |
| **Video** | Rectangular, LTR, real streams, no radius games | Tiles with a modest radius (`--sw-r-md` 16-20 px, not 28-42), chips overlaid; no glass over video |
| **Tables and lists** | The owner wants list/table views in every design; Bubble has none | Pill-row list (50 px, scroll, sticky separators) for devices/events/notifications; real **tables** for audit, users, storage, device catalogue, exports, schedules table view: header row in `--sw-text-3`, row height 44, hover = `--sw-surface-3`, pill chips inside cells, no card-per-row |
| **Dense admin forms** | No form language in Bubble | Reuse the shared `sw-*` form controls with pill fields; keep labels above inputs |
| **Colour-only meaning** | Bubble accent fill/opacity carries state | Always add text/shape (our accessibility rule); our `--sw-*-text` tokens keep 4.5:1 |
| **Contrast** | Bubble accent `#506EAC` dark / `#e69c9c` light with white or `#4c4f69` text is low contrast on `#e69c9c` (about 2:1 for white; unverified numerically here) | Our tokens test (4.5:1 per skin and scheme) must pass: pick a deeper accent for light; do not copy Bubble's rose accent unless it clears the test |
| **Large type** | Bubble type is 12-14 px | Keep our 14-15.5 px body, 12 px only for state lines; page titles 22-26 px, not Domus 44 px |
| **Clean operator screens** | Bubble tiles often show sub-buttons, states, chips | Obey the rule: one name + one state + one control per pill; no badges/hints |
| **No HA branding** | Bubble's pop-up has a `home-assistant` style and mentions HA in places | Not used; mockup copy follows `UI_COPY_RULES.md` |

## 5. Proposed token set for a "bubble" skin

Plugs into the existing skin layer on branch `pilot/design-foundation` (read with `git show`; not merged here): ONE token table
`frontend/src/design/tokens.ts` (`{name:{light,dark}}`, `--sw-*`, 145 names), skins in `frontend/src/design/skins/<id>.ts` = token
overrides (always both columns, only names that exist in `tokens.ts`) + <= 50 component rules written for the shadow roots
(`:host(sw-card) {}` etc., only `var(--sw-*)`), registry `SKIN_IDS` in `skins/index.ts` (+ the validation list in
`routers/settings.py`: `^(classic|domus|tesla)$`), per-installation `ui.skin` and `ui.scheme`, `<html data-skin data-theme>`.
Tests: `unit-design-tokens.spec.ts` (completeness, rule budget, contrast 4.5:1 per skin x scheme), evidence matrix.
**Everything below is a proposal, not implemented; for the mockup it would be written as CSS custom properties with the same names so the
mockup tokens can become `skins/bubble.ts` almost verbatim.** Hex values are starting points chosen to pass 4.5:1 text contrast; the
contrast numbers have NOT been computed here.

### 5.1 Principle

Bubble = flat, opaque, coloured pill surfaces on a quiet page; accent fill = on; blur only on floating sheets; soft slow transitions.
Opposite of the Domus skin (blooms + glass everywhere), so it is a genuinely different third direction, not a recolour of Domus.

### 5.2 Token proposal (names exist in `tokens.ts` unless marked NEW)

| Token | Light | Dark | Basis |
|---|---|---|---|
| `--sw-bg` (page) | `#eef1f6` | `#1d1b27` | Bubble page bg (#eff1f5 light, #393646 dark) deepened for dark so 44 px pills read |
| `--sw-canvas` | `linear-gradient(var(--sw-bg), var(--sw-bg))` | same | flat, no blooms |
| `--sw-surface` (pill / card) | `#dde2ec` | `#2e2a3c` | Bubble `ha-card-background` (#dce0e8 / #4F4557) |
| `--sw-surface-2` (inactive chip, slider track, input) | `#cdd3e0` | `#3a3549` | Bubble `background-color-2` (#ccd0da / #5C5367) |
| `--sw-surface-3` (hover, selected row hint) | `#bfc7d8` | `#463f58` | one step further |
| `--sw-surface-solid` (floating layers, no-blur fallback) | `#eef1f6` | `#242130` | sheet colour (88 % of this over blur 10 px) |
| `--sw-surface-2-solid`, `--sw-surface-3-solid` | `#dde2ec`, `#cdd3e0` | `#2e2a3c`, `#3a3549` | |
| `--sw-border`, `--sw-border-strong` | `transparent`, `rgba(34,49,76,.18)` | `transparent`, `rgba(255,255,255,.16)` | Bubble has no borders; strong = focus/input only |
| `--sw-highlight` | `transparent` | `transparent` | no glass sheen |
| `--sw-overlay` | `rgba(15,20,30,.45)` | `rgba(0,0,0,.6)` | Bubble scrim (.6 dark); backdrop = bg x .6 at .8 |
| `--sw-text` | `#232a41` | `#ffffff` | Bubble dark text #fff; light deepened from #4c4f69 for contrast |
| `--sw-heading` | `#1b2236` | `#ffffff` | |
| `--sw-text-2` | `#4a5068` | `#d8d3e6` | |
| `--sw-text-3` | `#5d647c` | `#a9a3bc` | Bubble medium-light (#A0A2A8) |
| `--sw-accent` (on fill) | `#2563eb` -> candidate; or Bubble default azure `rgb(0,145,255)` mixed 70/30 with bg | `#5b82d6` | Bubble default `rgb(0,145,255)`; owner's current blue is `#2767ed`: keeping our blue keeps brand continuity (open question Q1) |
| `--sw-accent-hover` | `#1d4fc4` | `#7b9be0` | |
| `--sw-accent-soft` | `rgba(37,99,235,.14)` | `rgba(91,130,214,.26)` | |
| `--sw-accent-text` | `#1d4fc4` | `#a9c0f0` | text on surface |
| `--sw-on-accent` (text/icon on accent fill) NEW-or-`--sw-text-inverse` | `#ffffff` | `#ffffff` | Bubble auto-switches to `rgba(0,0,0,.65)` on light fills; we keep white on a dark enough accent |
| `--sw-focus` | `#2563eb` | `#9bb6f2` | 2 px ring, offset 2 |
| state set (`live`, `recorded`, `offline`, `stale`, `unknown`, `danger`, `warning`, `success`, `forbidden` and their `-soft`, `-text`) | reuse the Domus values (already contrast-tested) | same | Bubble badges palette is close (blue #1A89F5, green #00CA8B, yellow #DEB06B, red); keep the tested set |
| `--sw-r-sm` | 12px | | sub-button inner |
| `--sw-r-md` | 18px | | sub-button, chip, input (Bubble sub-button radius 18) |
| `--sw-r-lg` | 28px | | card / pill (Bubble row radius = row-height/2) |
| `--sw-r-xl` | 42px | | pop-up / sheet top radius (Bubble 42) |
| `--sw-r-pill` | 999px | | |
| NEW `--sw-pill-h` | `50px` (compact density 44px) | | Bubble `.bubble-container` height; large 56 + |
| `--sw-touch` | 44px | | our rule |
| NEW `--sw-icon-ring` | `38px` | | Bubble icon container (42 large) |
| NEW `--sw-gap` / `--sw-gap-grid` | 8px / 18px | | Bubble 8 px inside, 18 px grid, 14 px in sheets |
| `--sw-s-*` | keep 4/8/12/16/20/24/32/40 | | add 6, 14, 18 as needed (NEW `--sw-s-1h`=6, `--sw-s-3h`=14, `--sw-s-4h`=18) |
| `--sw-page-pad` | 18px (phone 14px) | | |
| `--sw-fs-xs/sm/md/lg` | 12 / 13 / 14 / 15px | | name 13 / 600; state 12 at 70 % |
| `--sw-h1` | 26px | | not Domus 44 |
| `--sw-fw-semibold` | 600 | | name weight |
| `--sw-shadow-1` | `none` | `none` | Bubble flat |
| `--sw-shadow-2` (floating) | `0 6px 18px rgba(20,28,45,.12)` | `0 6px 18px rgba(0,0,0,.4)` | only the sheet; Bubble's optional `0 0 50px` is available as `--sw-shadow-3`: `0 0 50px rgba(0,0,0,.25)` |
| `--sw-glass-blur` | `none` | `none` | cards are flat |
| `--sw-glass-blur-nav` | `none` | `none` | pill bar is opaque (Bubble stack has a gradient under it, no blur) |
| `--sw-glass-blur-sheet` | `blur(10px)` | `blur(10px)` | the real Bubble pop-up blur; `--sw-surface-solid` at 88 % alpha behind it, plus fallback |
| `--sw-glass-sheen` | `linear-gradient(transparent, transparent)` | same | none |
| NEW `--sw-sheet-alpha` | `.88` | `.88` | `bg_opacity` 88 |
| NEW `--sw-fade-edge` | `28px` | | stack fade mask; 24 / 16 px for sheet scroll fade |
| `--sw-t-fast` | 200ms | | sub-button/slider 0.2 s |
| `--sw-t-med` | 300ms | | sheet / icon 0.3 s |
| NEW `--sw-t-state` | 1500ms | | background colour fade on state change (honour reduced-motion = 0) |
| `--sw-ease` | `ease-in-out` or `cubic-bezier(.4,0,.2,1)` | | Bubble uses plain ease / ease-in-out |
| `--sw-ease-dialog` NEW | `cubic-bezier(.16,1,.3,1)` | | centred/dialog open |
| `--sw-ease-thumb` | `cubic-bezier(.34,1.3,.64,1)` | | reuse for stack rise overshoot |
| `--sw-hover-lift` | `0px` | | Bubble has no lift |
| NEW `--sw-active-fill` | accent at opacity 1 | | ON pill |
| NEW `--sw-inactive-opacity` | `.6` (icon), `.5` (unavailable card) | | Bubble opacities |

Component rules (the <= 50 budget; ~30 expected): sw-card/sw-kpi as flat pills with `--sw-r-lg`; round icon ring; pill buttons (primary = accent,
secondary = surface-2, ghost = none) 44 px; chips = 36 px pills; input = surface-2 with 22 px radius, no border (border-strong on focus);
toggle: track surface-2 / on accent; segmented/tab rail = pill; the **rail** as pill items with accent fill for active; the **phone bottom
bar** as the floating pill stack (inset 8 px, bottom 16 px, edge fade); sw-drawer/sw-dialog = sheet (42 px radius, 88 % + blur 10 px); sw-popover
= pill-radius list; tables = hairline-less rows, 44 px; **the tree** = pill rows as in 4.2; camera tiles unchanged except chips. Component
state rules by token: `--sw-active-fill`, `--sw-inactive-opacity`.

Rule budget and risks to the skin layer: the foundation's `docs/design/SKIN_AUTHORING_HE.md` already says structure (order, content, states)
belongs to the base, not the skin. Bubble implies two **structural** items that the skin layer cannot do alone: (1) the phone bottom bar becoming a
floating scrolling pill stack (a different bar, not only restyled), (2) pill-row list as the default row for device tiles (a layout mode, which the
direction work already asks for: אריחים | כרטיסים | רשימה). Both need base changes, not skin rules; record as design decisions before building.

## 6. Mockup plan, effort and risks

### 6.1 Form

Follow the existing mockup practice: single self-contained HTML files under `docs/design/mockups/<name>/index.html` with embedded Heebo
(previous files are 180-290 KB each), a top bar to switch screen / viewport / scheme / skin. For this task: ONE file `docs/design/mockups/bubble/index.html`
(+ per-board PNG evidence in `docs/evidence/bubble-mockup/`), light and dark, desktop (1440) and phone (390), RTL, with the `--sw-*` token names
of section 5 so the CSS can be lifted into `skins/bubble.ts`. Interactions in the mockup (clickable): rail/bottom-stack navigation, pop-up
sheets open/close with the real motion values, pill toggles/sliders, tree collapse, list/cards/table switch, scheme switch. Static for the rest.
No real data, no device access; fixtures use Hebrew placeholder names (no private floor plans or lab data).

### 6.2 Boards and estimate

Hours are for one design-and-build agent session (Fable-class for design decisions, Sonnet-class for repetitive boards), including light + dark
and desktop + phone; "x2" = both scheme/viewport variants. Estimates are engineering judgement, not measured.

| # | Board | Content | Hours |
|---|---|---|---|
| 0 | Foundations | Token sheet (light/dark), type, radii, spacing, motion demo, state matrix (on/off/unavailable/attention), the pill anatomy at 50/44 px | 4 |
| 1 | Component sheet | Pill button (switch, slider, sub-buttons, dropdown), media/cover/climate pills, chip, input, toggle, segmented, tabs, sheet, dialog, popover, toast, table row, empty/error/loading states | 8 |
| 2 | Shell | Desktop rail (pill items, nav-size presets s/xl), phone floating pill stack with fade, corner float/search, user menu (popover + sheet), banner | 5 |
| 3 | Home overview (H1, 3 directions condensed) | Widgets, KPI pills, building tree panel (desktop) and floor cards + floor stack (phone), floor cards, "כבה הכל" confirmation | 8 |
| 4 | Area screen (H2) | Domain sections, device pills in cards / tiles / **list** modes, sensor readings, camera card, bulk popover, edit-arrange state | 8 |
| 5 | Schedules (H4-H6) | List (cards / table / week), editor week grid + slot sheet, phone day view, new-schedule templates | 7 |
| 6 | Security live (S1-S3, K1) | Overview KPI + lists, live wall (6/9/16 tiles), single camera with pill control bar, kiosk | 7 |
| 7 | Investigate (S5-S12) | Event centre list + detail sheet, playback timeline, synchronised playback, cases/exports lists, search | 7 |
| 8 | Maps (M1-M5, S8) | Sites, floor browser, live floor map with entity sheet, plan editor chrome, 3D chrome | 6 |
| 9 | Media (F4-F6) | Screens (TV pills), players/speakers/groups, remote sheet, media card in area | 5 |
| 10 | Automations + notifications (F1-F3) | Lists, rule/automation editor chrome, notification centre | 5 |
| 11 | Alarm + WisKey (S15, W2-W4) | Alarm card and keypad sheet, entry centre, activity, people | 4 |
| 12 | Settings (G1-G11) | Tabs, forms, tables (users, audit, storage, catalogue), wizard, connections, skin picker incl. "bubble" | 8 |
| 13 | States and a11y pass | loading/empty/error/forbidden/read-only per family; RTL check; contrast check against 4.5:1; focus rings; reduced-motion; screenshots | 6 |
| 14 | Owner review pack | Decision list in Hebrew (HE), screenshot index, tokens-to-skin mapping note | 3 |
| | **Total** | | **~91 h** |

Reduction options: a "core" cut (boards 0-4, 6, 12 partial, 14) is **~45 h**; a "foundation + 3 representative boards" cut (0, 1, 4 and the shell)
for a first owner verdict is **~20 h**. Wall-clock is lower with parallel agents (boards 3-12 are independent once 0-2 exist); the repository
rule "few agents, owner's UI requests first" (feedback-batched-releases) suggests running boards 0-2 first, then at most 2-3 in parallel.

### 6.3 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The owner's mental image of "Bubble" is the screenshots/video; this analysis read CSS and text only (images, YouTube not read) | The mockup could miss a visual quality the owner loves (e.g. the exact colours of his dashboard, glow, icon colours) | First deliver board 0 + 1 (about 12 h) and ask the owner to compare with his reference screens; ask for 2-3 screenshots of the Bubble dashboards he likes |
| Bubble's strength is mobile single-column; our desktop operator density is the opposite | A literal copy looks like a phone UI stretched on a monitor | Treat the pill as a component, not as the layout; keep our grids, tree, tables |
| Pill/radius extremes (28-42 px) conflict with video tiles, maps, tables and dense lists | Toy-like admin screens | Two radius tiers (pill for controls, 16-20 px for media/canvas); tables stay tables |
| Light accent contrast (Bubble rose `#e69c9c`, dark accent `#506EAC`) | Fails our 4.5:1 test | Use our tested accent (or deeper variant) and verify with `unit-design-tokens` |
| Structural changes hidden inside "a skin" (floating phone bar, list mode) | The foundation's skin budget (<= 50 rules) cannot carry them; drift risk | Decide them as base changes (new CR or part of the home/area structural work) before implementing the skin |
| Third skin = more screens to keep consistent (each skin x scheme is an evidence matrix at 1440 and 390) | Cost per release grows | Mockup first; implement only after the owner picks the direction; reuse skin tests |
| Slow transitions (1.5 s colour fades) | Feels laggy for operators who toggle many lights | Keep the 1.5 s fade as a skin token (`--sw-t-state`), default 300-500 ms for control feedback; zero under reduced-motion |
| Blur cost on weak GPUs/wall tablets (Bubble's own comments: blur(0px) still costs a render pass) | Jank on kiosks | Sheet-only blur; `none` when 0; fall back to solid surfaces (existing rule) |
| MIT obligations if code is ever copied | Missing notice | Do not copy for the mockup; if copying later, add notice and keep it with the file |
| Branding | Using "Bubble" visible in the product | Skin name for the owner may be "בועה/Bubble" in settings only (settings screens may name styles); the operator UI shows none |
| Source freshness | Findings are from `v3.4.1` (2026-09-25) and a moving project | Re-check the clone commit hash (`061ed837`) before quoting numbers in a design ADR |

### 6.4 Open questions for the owner (Hebrew, numbered, for the report)

1. Which of the following is "the Bubble look" for you: the flat pills of the base card, the Bubble theme colours (aubergine dark / Catppuccin light), or the frosted-glass community module? Our proposal is flat pills + our blue, glass only on sheets.
2. Accent: keep our current blue (`#2767ed`) or the Bubble azure/rose?
3. Desktop: keep the side rail and our grids (recommended), or also a Bubble-style centred single column?
4. Phone bottom bar: replace with the floating pill stack (a structural change)?
5. Pop-up sheets on desktop: side drawer (current) or centred 540 px sheet?
6. Mockup scope: full ~90 h, core ~45 h, or foundation + 3 boards ~20 h first?
7. May the mockup include Bubble-style auto-ordering of floors/areas by recent motion (not recommended)?

## 7. Citations

- Repository, README, source, license: https://github.com/Clooos/Bubble-Card (commit 061ed837, v3.4.1; files cited in sections 2-3 under `src/`)
- Releases: https://github.com/Clooos/Bubble-Card/releases (dates verified via https://api.github.com/repos/Clooos/Bubble-Card/releases)
- Bubble theme (palette, 28 px radius, dialog scrim blur 15 px): https://github.com/Clooos/Bubble , file `themes/bubble.yaml` (https://raw.githubusercontent.com/Clooos/Bubble/main/themes/bubble.yaml)
- Backend and Module Store storage: https://github.com/Clooos/Bubble-Card-Tools
- HA Community thread (3,098 posts): https://community.home-assistant.io/t/bubble-card-a-minimalist-card-collection-for-home-assistant-with-a-nice-pop-up-touch/609678 (Discourse JSON `/t/609678.json` and `posts.json`)
- Community modules and dashboards listings: https://github.com/Clooos/Bubble-Card/discussions/categories/share-your-modules , https://github.com/Clooos/Bubble-Card/discussions/categories/share-your-custom-styles-templates-and-dashboards
- Frosted Glass module: https://github.com/Clooos/Bubble-Card/discussions/1672
- Our side: `docs/design/handoff/SCREEN_INVENTORY.md`, `docs/design/handoff/TOKEN_CONTRACT.md`, `docs/design/DESIGN_CONTRACT.md`, `docs/design/SCREEN_CATALOG.md`; branch `pilot/design-foundation`: `docs/design/SKIN_AUTHORING_HE.md`, `frontend/src/design/tokens.ts`, `frontend/src/design/skins/{index,domus,tesla,classic}.ts`; owner feedback notes on keeping the area tree and list modes in every design (memory entries `feedback-keep-area-tree`, `feedback-design-directions`, `project-design-unification`, `feedback-clean-operator-screens`, `feedback-no-ha-branding`).
- Not reachable / not read: r/BubbleCard (reddit.com), YouTube @cloooos, README demo images/GIFs, `src/modules/module-documentation.md` (listed only), the 2,839 unsampled community-thread posts.
