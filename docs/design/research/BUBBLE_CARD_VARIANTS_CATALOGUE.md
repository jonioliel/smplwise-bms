# Bubble Card - variants catalogue and "style families" proposal

Research only (2026-10-02, branch `pilot/design-bubble-catalogue`, built on `pilot/design-bubble-research`). No application code, no
secrets, no device access. This document extends `BUBBLE_CARD_ANALYSIS.md` (which measured ONE look: the default pill) with the owner's
new request: do not lock into one look. The owner wants our system to offer SEVERAL STYLES inside the Bubble skin (wide and large
cards, compact cards, row/list presentations, other variants). So this is a catalogue of every presentation variant shown or described
in the 162 Bubble Card releases, a taxonomy, and a proposal for selectable "style families" expressed as tokens + data attributes that
plug into the existing skin layer.

## 0. Method, coverage, and what was not reachable

| Item | Result |
|---|---|
| Release list | GitHub API `releases?per_page=100`, pages 1-2, plain unauthenticated HTTP: **162 releases**, `v0.0.1-beta.1` (2023-08-28) to `v3.4.1` (2026-09-25). 71 stable, 91 pre-release. Note: there is **no stable v2.5.0** (v2.5.0-beta.1..9 became v3.0.0), no v1.6.1, no v1.2.1 |
| Release notes read | All 162 bodies were fetched and saved locally (scratch, not in git). **Read in full:** all 71 stable releases, v2.5.0-beta.1..7, v3.3.0-beta.2 / rc.1. **Read for context only** (the paragraph around every image, keyword scans for options and CSS variables, first 1.6 KB): the other pre-releases, whose text is mostly repeated inside the next stable. v1.x and v0.0.1 releases have **no images at all** (text-only maintenance notes); their feature lines are folded into section 1 |
| Images | 100 distinct files downloaded (89 PNG/JPG stills and 11 animations: 7 GIF, 4 MP4) into `C:\cloude\smplwisebms\private\design-refs\bubble\releases\<tag>\` (**outside git, gitignored, never commit**). Each asset is stored under the first release that shows it (later betas/stables reuse the same asset ids). **Viewed: 44 stills plus 9 contact sheets** (6 frames each, made with ffmpeg 9.0.1, in `<tag>\frames\`) of 9 of the 11 animations. The rest are editor screenshots, photos of the author's family/desk, and Patreon teaser duplicates; marked "(not viewed)" below where they matter |
| Not reachable | 3 assets return 404 now (images removed from GitHub): `v2.5.0-beta.8` e2503f0f (slider hold GIF), `v2.5.0-beta.9` 9d31ff15 (large-sub-buttons-grid shot), `v3.0.0-beta.1` 6a19c79b (module editor shot; the rc.1 equivalent `272eda01` was viewed). The two GIFs not viewed as frames: `v2.0.0-beta.1\f7270489...gif` (duplicate-style of the v2.0.0 media GIF) and `v2.0.0-beta.10\giphy.gif.gif` (a third-party meme GIF, not a UI). The seven **Patreon modules** (Bubble Weather, Badges 2, Calendar Enhanced, Neon, Custom dropdown, Quick Launcher, Media Player Enhanced) are paid and shown only as teaser images; their CSS/module ids are **not public**, so "how achieved" for them is inferred from the images and from the documented CSS variables, and is marked as such. Reddit, YouTube and Patreon pages were not fetched |
| Image URL forms | `https://github.com/user-attachments/assets/<id>` (2025-2026) and `https://github.com/Clooos/Bubble-Card/assets/36499953/<id>` (2024: the files in v1.5.2, v2.0.0*, v2.1.0*). The local file name is `<id>.<ext>` |

Local root used below: `P = C:\cloude\smplwisebms\private\design-refs\bubble\releases`. Image ids are shortened to the first 8 hex
characters in the tables; the full file name starts with them.

## 1. Per-release notable visual additions

Only releases with a visual or layout change are listed; pure bug-fix releases are summed up at the end of each block.
"Seen" = I looked at the image. "How" = option name / CSS variable / module as given in the notes.

### 1.1 v3.4.x (Sep 2026)

| Release | Visual addition | Images (local under `P`) | How |
|---|---|---|---|
| **v3.4.1** (09-25) | Sub-buttons switch text and icon to dark when their state colour is too light (white / yellow lamp). Seen: a room card with three sub-buttons on a beige, a mustard and an indigo fill; the first two have dark labels | `v3.4.1\b6bc8c05.png`, URL `user-attachments/assets/b6bc8c05-c50f-4092-bd6b-0a58c39b8307` | "Show background" sub-button option; automatic contrast switch (no option). Pop-up `slide_to_close: header|false` (default auto) |
| **v3.4.1 / v3.4.0** Patreon teaser table | One screen of the author's own dashboard (seen): square-ish 2x2 tiles (calendar + clock widget, media player with cover art, animated-rain weather with 4-day forecast, 3x3 launcher grid of round icon buttons, robot vacuum tiles that are tall with a bottom button, person tiles with avatar, energy tile with a sparkline), plus a block of 4 wide room pills with a colour-fill that stops part-way (slider-fill) and a chevron | `v3.1.0-beta.5\a33ad1be.png` (first shown in v3.1.0-beta.5, repeated in v3.4.x), URL `assets/a33ad1be-ec04-4444-90cf-f84c8180cd64` | Modules: Bubble Weather, Calendar Enhanced, Quick Launcher, Neon, Badges 2 (Patreon, source not public) on top of large cards (`card_layout: large` + `rows`) |
| **v3.4.0** (09-18) | New **Home Assistant pop-up style** (third style after Bubble and Classic): white native "more info" dialog, desktop dialog and phone sheet with grabber; filled with native-looking light tiles with horizontal brightness bars (peach, yellow) and a cover with up / stop / down buttons. Seen | `v3.4.0\ab7566f9.png`, `...assets/ab7566f9-6dda-4ab1-b1a6-7e3892d2c988` | pop-up `style`: Bubble / Classic / Home Assistant (YAML key not printed in notes); follows the HA theme |
| v3.4.0 | **State content** list: the line under the name is an ordered list of chips (State, Last changed, attribute, relative time, template); seen in the editor with a tile "Ambilight, On, 1 minute ago" with a peach slider-fill on a purple-to-tan gradient pill and a 60 % value | `v3.4.0\15add7a7.png` | "State content" picker (HA's own); old 5 switches migrated. Relative times: "in 20 hours", weeks/months/years |
| v3.4.0 | Jinja templates in name, icon, sub-buttons, stacks, state content, styles (seen: separator "Hello {{ user }}" rendering "Hello Quentin") | `v3.4.0\eb4c6a83.png` | server-rendered HA templates |
| v3.4.0 | Humidifier and water-heater domains get the climate presentation (target value with +/-, mode menu, colour follows state). Media player line shows series/episode/channel/app | no image | domain cards |
| v3.4.0 | Pop-up swipe-to-close = HA more-info gesture (follows finger, background does not drag). Removed `--bubble-sub-button-outline`, `--bubble-sub-slider-outline` (outline added in 3.3.0 replaced by colour shift) | no image | `slide_to_close_distance` removed |
| v3.4.0 (teaser) | **Bubble Media Player Enhanced** module: media pill / tile with the cover as background, colours extracted from the cover, draggable progress bar, recent-covers slideshow. Seen: a tilted collage of ~10 media players: dark blue pill with cover thumbnail left and blue play button; tall square tile with the cover full-bleed and 3 round buttons; yellow-tinted tile with progress line; wide tile with a red-orange gradient taken from the cover | `v3.4.0\681800de.jpg`, video `v3.4.0\f5b93589.mp4` (contact sheet `v3.4.0\frames\f5b93589-932_tile.jpg`: wide pill with progress + 5 round buttons, tall tile with cover and 3 buttons, small off tile) | module (Patreon). Surface colour is **derived from the artwork** |

### 1.2 v3.3.0 and v3.2.x (Aug and Jul-Apr 2026)

| Release | Visual addition | Images | How |
|---|---|---|---|
| **v3.3.0** (08-28) | **Entity suggestions** in the card picker: 33 domains, "designed cards" per entity (light = brightness slider + colour sub-buttons; cover = position slider + tilt; vacuum = start/pause/dock). Seen: picker for a weather entity offering four variants (plain tile with arrow; with humidity chip; Neon gradient tile; Weather module tile with a 6-day forecast) | `v3.3.0-beta.2\83754825.png`, `...\9aba3efd.png` (module-editor preview, not viewed), `...\aafcc904.png` (language picker, not viewed) | domain suggestions + module-contributed suggestions. **Shows the same entity offered in several styles side by side** |
| v3.3.0 | Full editor localisation (64 languages) and **RTL mirroring** of cards (Arabic, Hebrew) | `aafcc904` | logical properties; relevant to us |
| v3.3.0 | Outlined sub-buttons/sliders that blend into their card (outline later removed in 3.4.0). Calendar multi-day events. Pop-ups no longer reserve layout space | none | `--bubble-sub-button-outline` (removed) |
| **v3.2.5** (07-10) | **Cover tilt**: tilt buttons positionable (top, bottom, left, right, hidden) or a tilt slider. Seen: a tall cover card with open/stop/close buttons row under the title and tilt arrows at the right of the title; second card where the slider is replaced by a tilt-position slider with an X | `v3.2.5\5367ef0f.jpg` | `cover_slider_type: tilt_position`, `open_tilt_service`, `close_tilt_service` |
| v3.2.5 (teaser) | **Bubble Quick Launcher**: a sub-buttons-only card as a launcher grid: 3x3 dark circles with blue active ones; 2x2 big circles; and a free variant of circles with a label below ("Mute - Off", "Covers - Open", "Shopping list", "Security"). Seen | `v3.2.5\0669a866.jpg` | `Sub-buttons only` card + module; sizes from per-sub-button width/height (3.1.0), icon placement (3.1.0) |
| v3.2.5 (teaser) | **Custom dropdown** animation: a slim pill with a colour dropdown (Warm / Cool White, Red, ...); pill colour follows the chosen colour. Seen as 6-frame contact sheet | `v3.2.5\58ecaa1b.gif`, tiles `v3.2.5\frames\58ecaa1b-f4d_tile.jpg` | module (Patreon), select sub-button |
| v3.2.3 (06-07) | HA 2026.6 "card suggestions" by @piitaya: community section "Bubble Card - Climate / Button / Slider" previews shown inside HA's add-card dialog (seen: a slim climate pill with +/- chip, a blue button pill, a slider pill with fill) | `v3.2.3\f70eebc6.png` | contributed upstream |
| **v3.2.0** (05-16) | **Pop-ups as standalone cards** and four **pop-up modes**: Default (full-height sheet), Fit content (adaptive), Dialog (centred), Adaptive dialog (sheet on phone, dialog on desktop); optional **Classic style**; header controls (Previous button, close hidden, buttons left or right); `performance_mode: performance`; `full_width_on_mobile` for centred dialogs. Seen in `a33a17a0.jpg`, four panels: top-left a dark Bubble sheet "Choisir une piece" over the dimmed dashboard with a mixed 1- and 2-column list of colourful gradient room pills and chevrons; top-right a LIGHT Classic pop-up "Salon" with a compact header (name, brightness chip, power, X), a 2-col grid of gradient device pills (one with a dropdown chevron), section titles "Appareils" / "Volets" and a cover row with up / stop / down; bottom-left the same room list as a light fit-to-content sheet with a grabber; bottom-right a dark Classic pop-up with a LARGE header ("Cuisine", 100 % chip, power, X) and big gradient device pills (LED, Bar, Plan de travail, Hotte) | `v3.2.0-beta.1\a33a17a0.jpg`; `...\4d7527e6.png` (header settings: Show previous button, Show close button, Buttons position Left; the pop-up header shows back arrow + X + icon + "Salon" + brightness pill + power); videos `...\7307ebef.mp4` and `...\693b32ea.mp4` (contact sheets in `frames\`: the first shows the tile dashboard, then room sheets "Cuisine" and "Salon" opening over it with scrolling gradient device pills; the second shows the pop-up editor with live preview: drag-and-drop reordering of the room pills, then a slider-button editor whose pill is renamed live) | pop-up `mode`, `style` (Bubble/Classic), header buttons position, `performance_mode`, `full_width_on_mobile`, `bg_opacity` / `bg_blur` / `backdrop_blur`, `margin_top_mobile` |
| v3.2.0 | The author's own dashboard (seen): top row = profile avatar + three pill tabs (Home, Cameras, Alerts) + gear; below a 2-column grid of **square tiles** (clock+calendar, media with cover, weather, "Ambiance" scene carousel with large circle, vacuums) | `v3.2.0-beta.1\a82c3cb8.png` (first at 3.2.0-beta.1), plus family/desk photos `f26c3e09.png` (not viewed) | Bubble top "tabs" = a horizontal-buttons-stack at the top; tiles = large cards with 2-3 rows |
| v3.2.0-beta.4 | Animated pop-up **onboarding** (placeholder skeleton showing Default vs Fit content vs Dialog shapes) seen in contact sheet: skeleton sheet with 2-3 rows, X, rounded outline; dialog drawn smaller | `v3.2.0-beta.4\7a589ee0.mp4`, `frames\7a589ee0-e08_tile.jpg` | editor only, but is a **good wireframe of the three pop-up shapes** |
| v3.2.0-rc.1 | "Performance mode" toggle (not viewed: `73ed2f68.png`, editor) | | |
| v3.2.1 / .2 / .4 | Pop-up fixes only; **v3.2.4** adds the object selector for module authors; header auto-shown when sub-buttons are configured | none | |

### 1.3 v3.1.x (Jan-Apr 2026): sub-buttons grow into a layout system

| Release | Visual addition | Images | How |
|---|---|---|---|
| **v3.1.0** (01-11) | **Slider sub-buttons** (three sub-button kinds: default, slider, select). Seen: three pills - a slider pill whose whole body is fill with a hue rainbow track and a thumb; a pill with a 56 % brightness mini-slider; a full-width rainbow hue slider pill with X | `v3.1.0-beta.1\f5505b68.png` | sub-button `type`; "Always show slider" vs "show on tap"; hue / saturation / white temperature / brightness / temperature |
| v3.1.0 | **Sub-buttons-only card** (footer mode: fixed to the bottom) and layouts. Seen: a rounded container with 2x4 grid of equal rounded-square buttons (kitchen, living, dining, garden filled in beige / orange / dusty rose; bedroom, shower, bed, home dark). Room-picker grid | `v3.1.0-beta.1\8149af59.png` | card type `sub-buttons`; footer option; per-sub-button width/height |
| v3.1.0 | **Design-your-dream-card** overview (seen, `72f07b6a.png`): Shades (cover) card with 100 % slider-fill + three icon buttons; Living-room pill with hue slider and two chips; **remote-control card** made of sub-buttons (D-pad, number keys, volume); **bottom bar of 4 labelled tiles** (TV, Sonos, Ambiance, Blinds; two blue active); a **media player with volume slider and mute and play / skip buttons**; **tall 2-row cards** with icon+name left, 3 sub-buttons right/below and a **purple slider-fill**; **chips row** (people with avatar, Alarm, 21.7 C, Warm dropdown); a card with value slider and three round buttons under | `v3.1.0-rc.3\72f07b6a.png` | all editor-only: sub-button groups, "below" placement, per-sub-button size, icon placement top/bottom/left/right, copy/paste. "All the cards above were created using the editor only, without custom styles" |
| v3.1.0 | Sub-button editor with "Card specific buttons / Main sub-buttons (top) / Bottom sub-buttons", groups placement "Rows (stack groups vertically)", live preview: media card with album-art avatar, volume slider-fill at 25 %, chip row Chill / Party / Sleep, transport buttons | `v3.1.0-beta.1\1cd24564.png` | groups; bottom placement |
| v3.1.0 (beta.5) | **Slider layout**: fill orientation (left, right, **top, bottom**), value position (right, left, centre, hidden), inversion. Seen: one big vertical card filled from the bottom with 70 % centred, and three slim **vertical sliders** (rainbow hue, warm-to-cool white, an orange-to-grey) with a horizontal thumb | `v3.1.0-beta.5\467c11b9.png` | "Slider layout" options; "Show button info (icon, name, state)" with always-show slider (rc.3, `63d923ab.png` not viewed) |
| v3.1.0 | Lock = red when unlocked, error state colours; timer countdown; entity pictures on sub-buttons; text scrolling in sub-buttons; calendar `limit`; smooth cover cross-fade | none | |
| v3.1.0-beta.5 (teaser) | Badges 2 (module): avatar pill with a blue house badge on the avatar corner, a battery chip and a map round button; vacuum pill with orange water-drop warning badge and a blue lightning badge on the battery chip. Seen | `v3.1.0-beta.5\2c866ea7.png` | module (Patreon). **Badge = small circle on the corner of the icon or a sub-button** |
| v3.1.0-beta.5 (teaser) | Weather module GIF: four-day forecast tile, animated rain / snow / sunny gradient / lightning-rain; square-ish tile ~ 200x200, title + state left, row of 4 day columns | `v3.1.0-beta.5\bubble-weather-module.gif`, sheet `frames\bubble-weath_tile.jpg` | module (Patreon). Background is **state-driven animation** |
| v3.1.2 (03-02) | Existing pop-up hashes in the navigation dropdown (editor); exact HA icon rendering | `v3.1.2\b0d79258.png` (not viewed) | |
| v3.1.2 (teaser GIF, shown again in 3.1.2) | **Neon theme**: four pills (Living room, Kitchen, Dining room, Bedroom), each a horizontal gradient from its own colour to a muted tan/greyish tone, a round icon container in the saturated colour, the bedroom pill with a hard-edge slider-fill band at the start; dark and light schemes shown stacked (dark = deep slate/aubergine with desaturated gradients; light = lilac/cream with pastel gradients) | `v3.1.2\7737b2c0.gif`, sheet `v3.1.2\frames\7737b2c0-847_tile.jpg` | module "Bubble Neon" (Patreon): **automatically assigns a vivid colour to every card**. This is the clearest example of a **gradient-per-entity surface plus light/dark pairing** |
| **v3.1.5** (04-02) | Teaser of **Bubble Calendar Enhanced** (seen): three presentations side by side - (1) tall square card with a purple-to-brown gradient: scrolling agenda rows (big date "16 Mar" + coloured bar + "All day" + title blurred) fading at the bottom, then a large clock "20:20" and date line; (2) a wide card with agenda row, clock and date; (3) the same on **no surface at all** (transparent) | `v3.1.5\3f1982f3.png` | module (Patreon); "time and date on buttons or calendar cards with customisable layout" |
| v3.1.1 - v3.1.6 | HA 2026.2/3/4 compatibility, dropdown rendering fixes, performance | none | |

### 1.4 v3.0.x (Jul-Sep 2025): modules, large cards, calendar

| Release | Visual addition | Images | How |
|---|---|---|---|
| **v3.0.0** (07-04) | **All cards can be enlarged** and the large layout becomes the default in section views. Seen: the editor "Card layout: Large with sub-buttons in a grid (Layout: min. 2 rows)", Rows = 2, preview = tall card with a big pink icon at the left, name + "18 seconds ago", a beige slider-fill region, and two round buttons stacked on the right | `v3.0.0-rc.1\74170c2a.png` | `card_layout: large | large-2-rows | large-sub-buttons-grid`, `rows:`, `columns:`; "Layout options for sections" |
| v3.0.0 | **Calendar card** by @brunosabot: a pill with big date "25 Apr" at the start and two events as lines with orange dot + "All day" + bold title (seen); scrollable | `v3.0.0-beta.1\0597c197.png` | `card_type: calendar` |
| v3.0.0 | **Modules and Module Store**: global "this card / all cards" theming; **"Home Assistant default styling" module** turns Bubble pills into HA light tiles (seen: a light page; a bar with mute / cover / cart / camera / gear icons; pop-up header "Living Room" with brightness and temperature chips; 2-col device tiles in white rounded rectangles with a pale peach / blue fill; sections titled Lights, Devices, Shutters; a person tile with avatar, a media tile with album art block; a cover with arrow buttons). A **light** colour scheme of the same layout | `v3.0.0-rc.1\74278fcc.png`; module list UI `v3.0.0-beta.8\da9bcb83.png` (seen: light editor, a Kitchen pill white with blue ring icon + hamburger) | Module `ha-default-styling` (global). **Proves the same card structure can wear a "native HA" surface** |
| v3.0.0 | **Hold-to-slide sliders** (default), tap and double-tap now available; min / max / step; read-only slider (battery, power production); `step`, `min_value`, `max_value`, `read_only_slider: true`; slider animation GIF (not frame-viewed per frame; contact sheet seen: pill that goes from "Living room - Now" with chevron, to a drag handle with 42 %, to a nearly full 84 % bar, back) | `v3.0.0-rc.1\d72dc55b.gif`, sheet `frames\d72dc55b-7e1_tile.jpg` | `light_transition`, `allow_light_slider_to_0` |
| v3.0.0 | Pop-up creation without the vertical stack (editor); `.bubble-container` selector; `--bubble-border`; `.is-on` / `.is-off` classes; default accent changed to an accessible blue (`bubble-accent-color: var(--accent-color)` restores the old one); new default hold/double-tap = none | `59576856.png` (not viewed) | |
| v3.0.0 (teaser) | Badges (4 conditional badges around the icon) - the Patreon module that existed since 2.x; image `88822fd7.png` lives in `v2.3.0\` (not viewed) | | |
| v3.0.1 - v3.0.4 | Relative slider mode (`8c883eac.png`, not viewed); climate "hide temperature control" toggle; stop button on media; select actions; **Custom dropdown teaser** (seen): two cards, a "Living Room" pill with a palette dropdown (colour list with colour dots, selected item = blue pill) and a "Vacuum" pill with battery, home, room-select and play, dropdown listing rooms with icons | `v3.0.2\74190948.png` | `--bubble-light-white-color`, `--bubble-select-arrow-background-color` (now applied to the whole sub-button) |

### 1.5 v2.x (Jun 2024 - Mar 2025): the card collection is born

| Release | Visual addition | Images | How |
|---|---|---|---|
| **v2.0.0** (06-05) | **Sub-buttons** on every card, **media-player card**, **pop-up header is a Bubble button** (can slide, can carry sub-buttons), advanced states, **section view** layouts, new editor, `card_layout: large | large_2_rows`, columns/rows. Seen: (1) vacuum pill: icon ring, "Vacuum / Docked 24 minutes ago", battery 100 %, three buttons (home, pause, play) and below it a kitchen slider pill (orange fill to 72 %, blue bulb button); (2) a separator: icon + "Kitchen" + a line + temperature chip; (3) pop-up with the header slider (Bedroom, 57 %, temperature chip, power, X) and a 2-col list of slider pills (Ceiling, Bed LED) under a "Lights" separator; (4) media player pill GIF: mute, volume slider-fill, X, pause; then cover thumbnail + marquee title + skip + volume + pause; (5) a **full dashboard on white**: left a phone column - five round top icons, separator "home + line + 19:42 + chip", weather pill in teal with two columns of temperatures and "Today" / "Tomorrow" chips, media pill orange, six 2-col room pills with hamburger; right a long list: vacuums (home / pause / play), a cover pill with arrows, separator with "detected - 3 days ago", **two blue person pills with avatar and map button**, an **energy pill with 4 values in 2 columns**; (6) a living-room cover pill with partial blue slider fill | `v2.0.0\c551ec06.png`, `...\725262ee.png`, `...\ec43f365.png`, `...\96ed719b.gif` (+ sheet), `...\0c049498.png`, `...\a9cf693a.png`, editor `...\fb05ef8b.png` (not viewed) | `card_layout: large`, `columns`, `rows`, sub-buttons, `show_header: false` etc. Wide variety: **row, tile, separator, header-slider** |
| v2.0.0 betas | Early 2.0 shots: slider-fill pills with a circular sub-button ("Kitchen 15 seconds ago, 60 %, bulb"; a name-only "prout" pill with a "BBY" chip and "Cat - On" chip); a pop-up "Chambre" with a header slider and sections Lampes / Appareils / Volets (disabled device pill greyed at .5 opacity; cover = two pills each with title row and a 3-button row up / stop / down); a blue-teal weather state button (editor with "Large with 2 sub-buttons rows") | `v2.0.0-beta.1\f3050ee5.png`, `...\4cca9f76.png`, `v2.0.0-beta.7\800834a5.png`; rc.1 `v2.0.0-rc.1\2a33ca06.png` (editor toggle "Always hide the sidebar", seen) ; `v2.0.0-beta.1\9dc38833.png` (editor with the vacuum sub-button list, seen), `5cb65e91.png`, `v2.0.0-beta.7\db07bbe8.png` (not viewed) | |
| v2.1.0 (07-14) | **Select card** (dropdown pill), select sub-buttons, pop-up open/close actions, hide header (`show_header: false`), `open_action` / `close_action`. Images: select card, sub-button select, action editors (editor shots, not individually viewed except `c1600daa.png`: a **pop-up "Salon" with a teal header slider and a "Clair" dropdown chip on a slider pill**, a drop-down list in a rounded floating card with the selected item as a blue pill) | `v2.1.0-beta.1\3342006e.png` (seen: a dark sheet pop-up, header with power and X, scene dropdown pill "Ambiance - Chaleureux", 2-col slider pills, floating list of scenes), `v2.1.0-beta.2\c1600daa.png`, `...\1910d5b1.png`, `...\42669350.png` | `card_type: select`; `input_select` / `select` |
| v2.2.x | No new visuals (pop-up performance; large layout shorter for HA 2024.8 sections; name font 1 px smaller) | `v2.2.1\e304ffde.png` (not viewed) | |
| **v2.3.0** (12-01) | **Climate card** (seen: orange-filled pill, round dial icon, "Test climate / Heat - 21.3 C", a flame mode button with an open dropdown Heat / Cool / Off, and a +/- stepper chip "22.5"; compact design variant with thermometer chip "24 C" and separate round - and + buttons); **Global CSS variables** (seen: the whole dashboard with **8 px corners, squarer 36 px icon containers, and a recoloured teal palette**, i.e. the same layout in a *different corner scale*); sub-button follows light colour; **blurred media cover background** (seen: wide media pill with the album art blurred under the text; a pop-up with rose-coloured header slider and a translucent grey sheet); attribute select lists; slider live update; pop-up backdrop blur default changed to **darker, no blur** (breaking) | `v2.3.0-beta.1\89c299b5.png` (8 px radius dashboard), `...\045e952e.png`, `...\ad917f36.png` (theme YAML screenshot, seen), `v2.3.0-beta.3\58f28aff.png`, `...\4beee6e9.png`, `...\9bcdb56b.png` (not viewed), `...\118f1db7.png` (not viewed), `v2.3.0-beta.5\fa693aca.png` (seen), `...\46e550a6.png`, `...\2758a063.png`, `v2.3.0-beta.4\db1679b7.png`, `...beta.6..8` (editor toggles, not viewed) | Variables: `--bubble-border-radius`, `--bubble-main-background-color`, `--bubble-secondary-background-color`, `--bubble-pop-up-main-background-color`, `--bubble-pop-up-border-radius`, `--bubble-accent-color`, `--bubble-icon-background-color`, `--bubble-select-list-width`, `--bubble-select-list-background-color`, `--bubble-light-color`, `--bubble-line-background-color`; `backdrop_blur: 10`, `slider_live_update`, `state_background: false`, `light_background: false`, `use_accent_color`. Climate: `target_temp_low/high`, `heat_cool` dynamic colour, `hide_target_temp...` |
| v2.3.1 - v2.4.0 | Conditional sub-button visibility, pop-up trigger conditions, `--bubble-box-shadow`, `--bubble-pop-up-gap` (14 px), accent colour for lights (`use_accent_color: true`; seen: a pale peach vs accent slider pair), editor action panel. | `v2.3.2\140a4c73.png`, `...\d74ef0c7.png`, `v2.4.0-beta.1\...` (editor, not viewed) | |
| v2.5.0-beta.1..9 (never stable) | **Module system** (YAML), HA-theme-friendly module, `--bubble-border`; rows in section view (`bd8cc78f.png`, seen: a `Layout` editor with a 2-row x 6-col drag grid and a preview tall card with beige slider-fill, pink icon, hamburger and a lamp button); **slider hold-to-change** (GIF now 404); `card_layout: large-sub-buttons-grid` (screenshot now 404) | `v2.5.0-beta.1\76e6ec6b.png`, `...\ed3110ad.png` (not viewed), `v2.5.0-beta.7\bd8cc78f.png` (listed as 2.5.0-beta.6 text) | |

### 1.6 v1.x and v0.0.x (2023-2024): no images

Text-only. Features that define the early variants: **pop-up** (hash-opened bottom sheet; v1.1 added `bg_color`, `bg_opacity`, `bg_blur`, `shadow_opacity`, `rise_animation`; v1.3 icon backgrounds change colour when on; v1.7 blurred backdrop + `hide_backdrop`, backdrop custom style, `close_on_click`, `auto_close`, `back_open`, `margin`, `column_fix`), **horizontal-buttons-stack** (floating bottom bar; `hide_gradient`, `width_desktop`, `highlight current hash`, `rise_animation`, class per button `.kitchen`), **button** (switch, slider, state, name, `button_type: custom`), **cover** (arrow icons), **separator**, `show_state`, `entity-picture` icons, Styles with JS templates (beta.9), state-based pop-up triggers. v1.5.2 has an editor image `a6887e2d.png` (Regular vs Optimized mode, not viewed).

## 2. Consolidated taxonomy

Notation: **Bubble term** -> what it is -> how it is reproduced with our own tokens.

### 2.1 Layout and size modes (what shapes the card takes)

| # | Variant | Seen in | Geometry (measured from images + `BUBBLE_CARD_ANALYSIS` 2.2) | Bubble option | Our token expression |
|---|---|---|---|---|---|
| L1 | **Normal row pill** (icon ring, name, state, controls at the end) | v2.0.0, 3.1.0 | 50 px high, radius 28, ring 38 | `card_layout: normal` | `--sw-pill-h: 50px`, `--sw-r-lg` |
| L2 | **Large** (1 + n rows tall; sub-buttons wrap into rows or a grid; used for cards, tiles) | v2.0.0, 3.0.0, 3.1.0 tall cards, 3.2 dashboard | 56 x rows + 8 x (rows-1); radius still 28 or smaller | `large`, `large-2-rows`, `large-sub-buttons-grid`, `rows`, `columns` | `--sw-pill-rows` NEW (1..4), height = `calc(var(--sw-pill-unit)*rows + var(--sw-gap)*(rows-1))` |
| L3 | **Square tile** (module cards: weather, clock+calendar, launcher, media, vacuum) | v3.1.2/3.1.5/3.2.0/3.4 teasers | ~2 x 2 rows, aspect ~1:1 to 1:1.3, radius 28, big content (forecast row, large clock) | modules (Patreon) + large card | `--sw-tile-size` NEW; aspect via grid `grid-template-rows: subgrid`; data attribute `data-bubble-shape="tile"` |
| L4 | **Wide card with bottom strip** (2 rows: header row + a row of equal buttons / slider) | v3.1.0 shades, media, cover tilt, v3.2.5 | one pill top, a second row of 36 px pills at the bottom in the same container; fill of the container is the card's | `bottom` sub-buttons / "below" placement, groups | `--sw-pill-strip-h` NEW = 36 |
| L5 | **Sub-buttons only** (no header: chips row, launcher grid, remote keypad, tab bar, footer) | v3.1.0 rc.3, 3.2.5 | grid of 36 px round/pill buttons, icon-only or icon over label; container radius 28 with 8 px inset | card type `sub-buttons`, footer mode | `--sw-chip-h: 36px`, `--sw-gap: 8px` |
| L6 | **Chips row** (people, alarm, temperature, scene select as small pills in one line) | v3.1.0 rc.3 | 36 px pills, avatar chips | sub-buttons only + conditions | `--sw-chip-h`, `sw-chip` rules |
| L7 | **Horizontal buttons stack** (floating nav bar; also top "tabs") | 1.x - 3.2 | 51 px bar, 16 px above bottom, scroll with 28 px edge fade, highlight current | `horizontal-buttons-stack` | phone bottom bar (our nav); `--sw-fade-edge` |
| L8 | **Separator / section header** (icon + title + hairline-ish bar + optional chips) | 2.0.0, 2.1.0 pop-ups | 36-44 px, line = 10 px bar at 20 % | `card_type: separator`, sub-buttons | `sw-section-title` already in our system; bar colour `--sw-surface-3` |
| L9 | **Vertical slider card** (fills from the bottom, value centred; 3 side by side) | 3.1.0 beta.5 | tall (2-3 rows), narrow columns | slider layout: fill orientation top/bottom | `data-bubble-fill="vertical"` NEW |
| L10 | **Empty column / spacer**, vertical and horizontal stack wrappers | all | n/a | `empty-column` | layout only |
| L11 | **Grid spacing** | theme | 18 px grid gap, 14 px inside sheets, 8 px inside cards, 10 px stack margin | HA theme `grid-card-gap` | `--sw-gap-grid` NEW |

### 2.2 Surface styles (what the card is painted with)

| # | Style | Seen in | What it looks like | How achieved |
|---|---|---|---|---|
| S1 | **Flat opaque pill** (default) | everything | surface #4F4557-like, no border, no shadow; icon ring one step darker | `--bubble-main-background-color`, `--bubble-secondary-background-color`, `--bubble-icon-background-color`; `--bubble-border` and `--bubble-box-shadow` empty |
| S2 | **Active = accent fill / entity colour fill** | everywhere | ON pill fully accent (opacity 1), light entity uses the lamp colour at .7; OFF = transparent at .5 | `--bubble-accent-color`, `--bubble-light-color`, `light_background`, `state_background`, `use_accent_color` |
| S3 | **Slider-fill** | 2.0.0, 3.1.0, 3.4 | fill is the lit part of the pill (orange 72 %, purple 70 %, blue 100 %, vertical from bottom); a circular sub-button sits on top; value text at the end | `button_type: slider`, slider layout (orientation, value position, invert), `min_value/max_value/step`, `read_only_slider`, `light_transition` |
| S4 | **Gradient per entity / per card** (Neon) | v3.1.2 GIF, 3.2.0 dashboard, 3.2.0 pop-up | each pill has a left-to-right gradient from a saturated hue to a desaturated tan, hue chosen per card; icon ring in the hue; the slider-fill band is a hard-edged lighter strip | module Neon (Patreon); in 3.2.0 pop-ups the same effect with colours per room |
| S5 | **Media cover surface** | 2.3.0, 3.1.0, 3.4.0 | blurred album art behind the text; gradient colours extracted from art; tall tile with art full-bleed | `Optional - Blurred media cover in background`; module Media Player Enhanced |
| S6 | **State-driven animated** (weather) | 3.1.0 beta.5 | rain streaks, snow, sunny blue gradient, night; with forecast row | Bubble Weather (Patreon) |
| S7 | **Glass / frosted** | 3.2.0 sheet, 3.1.5 calendar tile | sheet = 88 % opaque + 10 px blur; the calendar/clock tile on the purple gradient is translucent over the dashboard | pop-up `bg_opacity: 88`, `bg_blur: 10`, `backdrop_blur`; community "Frosted Glass" module (discussion #1672, per the analysis document) |
| S8 | **No surface** (transparent, text on page) | 3.1.5 (third calendar variant) | content directly on the page background | `--bubble-main-background-color: transparent` |
| S9 | **Native HA surface** (white tile, hairline, ripple) | 3.0.0 module, 3.4.0 pop-up | light page, white rounded rectangles with 1 px border, fills as horizontal bars | module "Home Assistant default styling"; pop-up `style` = Home Assistant |
| S10 | **Corner scale**: pill (28 / 42), square-ish (8 px, 36 px ring) | 2.3.0 theme screenshot | same layout with `--bubble-border-radius: 8px` | theme variable; pop-up radius separately `--bubble-pop-up-border-radius` (42), content radius `--bubble-pop-up-content-border-radius` |
| S11 | **Light and dark schemes** | 3.0.0 (light module), 3.1.2 (Neon dark+light) | different hues, not an inversion: dark aubergine #393646 vs light #eff1f5; accent azure vs dusty rose | HA theme `modes: dark | light` |
| S12 | **Auto text contrast on light fills** | 3.4.1 | dark label on beige / mustard, white on indigo | built in (no option) |
| S13 | **Disabled / unavailable** | 2.0.0 pop-up | whole pill at 50 % opacity, controls hidden, not-allowed cursor | built in |
| S14 | **Badges / avatar overlays** | 3.1.0 teaser | 18-20 px circle on the icon corner or on a sub-button | Badges 2 (Patreon) |
| S15 | **Icon container shapes** | 2.0.0 (circle), 2.3.0 (rounded square 8 px) | circle by default; square at low radius; entity picture avatar | `--bubble-icon-border-radius`, `force_icon`, entity picture |

### 2.3 Row and list presentations

| # | Variant | Seen in | Notes |
|---|---|---|---|
| R1 | **Pill row list**, one column, full width (vacuum, cover, person, energy) | 2.0.0 right column, 3.0.0 HA-styled | row = L1; controls at end; two-line (name + state) or one-line (name only) |
| R2 | **2-column device list in a pop-up**, section separators ("Lampes", "Appareils", "Volets") | 2.0.0, 2.1.0, 3.2.0 | the dominant "area screen" layout; row height 50, gap 14, a pill spans both columns when the content is wide (dropdown) |
| R3 | **Cover row** = title pill + a row of three equal buttons (up / stop / down) under it | 2.0.0, 3.2.5 | two covers side by side, buttons under each |
| R4 | **Calendar agenda rows** (date column + coloured dot/bar + "All day" + title) | 3.0.0, 3.1.5 | list inside one card; fades at the bottom |
| R5 | **Menu list** (dropdown): floating rounded card, selected = accent pill, optional colour dots or icons | 2.1.0, 3.0.2, 3.2.5 | list width `--bubble-select-list-width`, bg `--bubble-select-list-background-color` |
| R6 | **Launcher / room-picker grid** (4 x 2 equal rounded squares, 3 x 3 circles, labelled circles) | 3.1.0, 3.2.5 | non-list "grid of actions" |
| R7 | **Chips line** | 3.1.0 | horizontal scroll, avatar + name |
| R8 | **Remote keypad** | 3.1.0 | D-pad + number keys from sub-buttons |
| - | **No table presentation exists** in Bubble in any release | | Admin lists/tables are ours to design (see 3.4) |

### 2.4 Pop-up kinds

| # | Kind | Release | Shape | Option |
|---|---|---|---|---|
| P1 | **Sheet (default)**: bottom sheet, full height under the HA header; header = Bubble pill (icon, name, state, sub-buttons, close) | 1.x | width 540 px desktop, 100 % - 14 px phone, radius 42 top, 88 % + 10 px blur, backdrop dim `.8` of page at x.6 | `mode: default`, `bg_opacity`, `bg_blur`, `backdrop_blur`, `--bubble-pop-up-*` |
| P2 | **Fit content / adaptive** | 3.2.0 | sheet sized to its content | `mode: fit-content` |
| P3 | **Dialog (centred)**, optionally full width on phone | 3.2.0 | `full_width_on_mobile` | `mode: dialog` |
| P4 | **Adaptive dialog** = sheet on phone, dialog on desktop | 3.2.0 | | `mode: adaptive-dialog` |
| P5 | **Classic style**: more conventional header (back, X, icon, name, controls), larger header text, buttons left or right | 3.2.0 | | `style: classic`, header buttons position |
| P6 | **Home Assistant style**: native more-info look, 580 px, opacity 100, shadow 100 | 3.4.0 | | `style: home-assistant` |
| P7 | **Header-less / slider header** | 2.0.0, 2.1.0 | pop-up header acts as slider or is hidden | `show_header: false`, header slider |
| P8 | **Previous / nested** | 3.2.0 | back button returns to the last pop-up | header setting |
| P9 | **Floating dropdown** (select list) | 2.1.0 | opens above following cards, rounded card, never clipped | `select` |
| P10 | **State-triggered pop-up**, auto-close, close on click, hash navigation, history | 1.x - 2.3 | behaviour, not look | `trigger`, `auto_close`, `close_on_click`, `back_open` |
| P11 | **Gestures**: swipe from header (3.4.0: whole sheet; 3.4.1: `slide_to_close: header|false`), Escape, click outside | 1.6.4, 3.4.x | | |
| P12 | **Perf mode** | 3.2.0-rc.1 | removes blur-on-open cost on old tablets | `performance_mode: performance` |

### 2.5 Per-device-type presentations

| Device | Variants seen | Notes for us |
|---|---|---|
| **Light** | slider-fill pill (brightness), hue / saturation / white-temperature sliders as sub-buttons, colour dropdown (Warm White, red, ...), vertical sliders, light-coloured sub-button | a lamp colour fills the pill (opacity .7) |
| **Cover / blind** | slider-fill (position), 3 button row (up / stop / down), tilt buttons (4 positions) or tilt slider | `cover_slider_type` |
| **Climate / humidifier / water heater** | pill with mode dropdown + target +/- (compact: thermometer chip + two round buttons), low/high target chips, colour by hvac mode | |
| **Media player** | pill with cover thumbnail, 5 transport buttons, volume slider-fill with mute, blurred cover surface, tall tile with art full-bleed, progress bar | |
| **Vacuum** | battery chip, home, pause, play, room select dropdown | |
| **Person** | avatar, state "Home", badge, battery chip, map button | |
| **Weather** | state pill with temperature chips; animated square tile with forecast row | |
| **Calendar** | agenda card, clock + date tile | |
| **Select / input_select** | dropdown pill | |
| **Sensor, battery, power** | read-only slider-fill, value chip | |
| **Lock / alarm / error** | red when unlocked / attention colour, opacity 1 | state must also have text |
| **Timer** | live countdown (3.1.0) | |
| **Scenes / actions** | launcher grid, chips, "Ambiance" carousel with a large circle | |
| **Remote** | keypad grid | |
| **Camera** | no card in Bubble (only inside pop-ups via native cards) | video stays ours |

### 2.6 Interaction patterns

Tap / double tap / hold with a ripple (3.0.0), **hold-to-slide** (3.0.0) vs "tap to slide", haptic feedback, long text **marquee**, slider
live update vs release-only, state content ordering, edit-mode drag and drop in pop-ups (3.2.0), swipe-to-close (3.4.0, HA gesture),
dropdowns that open in the free direction, **entity suggestions** that offer several presentations of one entity (3.3.0), auto-ordering
of stack buttons by recent motion, conditional visibility of sub-buttons, RTL mirroring, performance-aware modes.

### 2.7 Highlights (what to take away)

1. **Bubble is one component with a size dial, not one look.** The same pill appears at 36 / 50 / 56 x n px, as a row, a tile, a strip
   inside a card, a chip, a launcher circle.
2. **Surface is a separate dial from size**: flat, fill, gradient, cover, glass, none, native-HA.
3. **Corner scale is a theme variable**: the 8 px dashboard (2.3.0) and the 28 px dashboard are the same components.
4. **Pop-ups come in four shapes and three chromes.**
5. **There is no table and no dense admin layout** anywhere in the 162 releases: density rows and tables are ours to add.
6. **Colour as decoration vs colour as state**: the Neon and room gradients are decorative; state is separately the fill / opacity.

## 3. Proposal: OUR style families inside the bubble skin

Baseline: the skin layer on `pilot/design-foundation` (read with `git show`, not merged here): one token table `{name:{light,dark}}`
(`--sw-*`), skins as token overrides + at most 50 component rules, `<html data-skin data-theme>`, per-installation `ui.skin` / `ui.scheme`
(`SKIN_AUTHORING_HE.md` §1-4). The `bubble` skin proposed in `BUBBLE_CARD_ANALYSIS.md` §5 defines ONE default (regular, flat, sheet,
pill radius). This proposal makes four orthogonal **dials** selectable inside that skin.

### 3.1 Mechanism: token bundles selected by data attributes

CSS custom properties inherit through shadow roots, so the dials are expressed as **token bundles on `<html>`** (or on any container, to
override a region), not as extra skin rules. The rule budget stays at about 30 + 6 for the skin; the dials cost **0 rules** where they only
change values, and a handful of rules where they change structure (pill grid, pop-up chrome).

```
<html data-skin="bubble" data-theme="dark"
      data-bubble-density="regular"     (wide | regular | compact | row)
      data-bubble-surface="flat"        (flat | glass | gradient | fill)
      data-bubble-popup="sheet"         (sheet | centred | inline)
      data-bubble-radius="pill">        (pill | soft | square)
```

Generated by the existing `css.ts` as `html[data-bubble-density='compact']{--sw-pill-h:44px;...}`. A region can override: e.g. the area
screen's device list container carries `data-bubble-density="row"` while the page stays `regular`. Use `:root` selectors (not
`:host-context`, which Firefox and Safari do not support).

### 3.2 Dial 1 - density (size and layout)

| Token | wide | regular | compact | row |
|---|---|---|---|---|
| `--sw-pill-h` | 56 (x rows; default 2 rows = 120) | 50 | 44 (touch minimum) | 44 |
| `--sw-pill-rows` NEW | 2 | 1 | 1 | 1 |
| `--sw-icon-ring` NEW | 42 | 38 | 32 | 28 |
| `--sw-chip-h` NEW | 36 | 36 | 32 (width >= 44 hit area via padding) | 32 |
| `--sw-gap` / `--sw-gap-grid` NEW | 8 / 18 | 8 / 18 (phone 14) | 6 / 10 | 4 / 4 |
| `--sw-fs-name` / `--sw-fs-state` | 14 / 12 | 13 / 12 | 13 / 12 | 14 / 13 |
| layout shape | tile / large card, controls in a bottom strip (L2, L4) | one-row pill with controls at the end (L1) | one-row pill, state in the same line, controls icon-only (L1, L6) | full-width row, one column; columns allowed (name / area / state / action) - the list or table mode (R1, R2) |
| Columns on desktop | 2-3 | 2-4 | 3-6 | 1 |
| `data-bubble-shape` | tile or card | pill | pill | row or table |

`row` has two flavours selected by the screen, not by the user: **pill rows** (devices, events, notifications: 44 px pills, 4 px gap)
and **table rows** (audit, users, storage, catalogue, schedules table view: `--sw-r-sm` rows, no pill, hairline-less, header row,
hover = `--sw-surface-3`). A table is never drawn as a column of pills.

### 3.3 Dial 2 - surface

| Value | Tokens | Where it is meant for | Constraints |
|---|---|---|---|
| **flat** (default, = Bubble) | `--sw-surface`, `--sw-shadow-1: none`, `--sw-glass-blur: none`, `--sw-pill-bg-image: none` | everywhere, operator screens, tables, low-end tablets | contrast 4.5:1 per skin/scheme (already tested) |
| **glass** | surface at `--sw-sheet-alpha` (.55-.88), `--sw-glass-blur: blur(10-16px)`, optional sheen `--sw-glass-sheen` | **floating layers** (sheet, dialog, drawer, bottom bar), home widgets over a picture/map; never over video | needs `--sw-surface-solid` fallback, `prefers-reduced-transparency`, no blur behind text-dense tables; performance mode off on old tablets (Bubble's own `performance_mode`) |
| **gradient** | `--sw-pill-bg-image: linear-gradient(var(--sw-grad-dir), var(--sw-hue-n) 0%, var(--sw-hue-n-mute) 100%)`, `--sw-icon-ring-bg: var(--sw-hue-n)`; hues from a small palette (`--sw-hue-1..8`, light+dark columns) assigned by area / domain (stable hash), **never** by state | home tiles, area cards, floor cards on phone, scene carousels | decoration only: state keeps fill + text; contrast tested against BOTH gradient ends; `--sw-grad-dir` flips with `dir=rtl` (Bubble mirrors in 3.3.0); off in lists/tables |
| **fill** (slider-fill) | `--sw-fill` (0-100 %), `--sw-fill-color`, `background-image: linear-gradient(var(--sw-fill-dir), var(--sw-fill-color) var(--sw-fill), transparent var(--sw-fill))` on the track | lights, covers, climate setpoint, volume, battery / power read-only; value must be printed (56 %) | for controls, hold-to-slide with a 44 px thumb zone; RTL: fill starts at the inline start, but numeric sliders for time/axes stay LTR (as our schedules grid) |

`fill` is a behaviour layer: it can be combined with flat or gradient by `data-bubble-fill="on|off"` (default `on` for controls, off for
lists). In the matrix it is offered as the fourth surface because the owner named it; implementation = flat + fill.

### 3.4 Dial 3 - pop-up kind

| Value | Phone | Desktop | Tokens |
|---|---|---|---|
| **sheet** (default) | bottom sheet, `--sw-r-xl` 42 top, grabber, swipe-down (header only by default, setting `slide_to_close` semantics), 88 % + blur | **side drawer** 360-480 px (existing sw-drawer), not a 540 px centre sheet - keeps tree and context visible | `--sw-popup-w-sheet`, `--sw-sheet-alpha`, `--sw-glass-blur-sheet` |
| **centred** (dialog) | full width with 14 px inset (`full_width_on_mobile` equivalent) | centred 540 / 720 px | `--sw-popup-w-dialog`; confirmations, PIN pad, forms |
| **inline** (our extension, not in Bubble) | expands under the pill (accordion) or opens as a docked master-detail pane | docked detail pane beside the list (area tree + list + detail) | `--sw-popup-inline-gap`; the **only** kind that never covers the floors/areas tree |

Pop-up chrome alternatives seen in Bubble (Bubble / Classic / HA styles) are **skins' job**, not a dial: our existing `classic` skin is the
analogue of Bubble's "native" style. Alerts that need a decision (PIN, confirm arm/disarm) force `centred` regardless of the dial.

### 3.5 Dial 4 - corner radius scale

| Token | pill (Bubble default) | soft | square (cf. v2.3.0 "8 px") |
|---|---|---|---|
| `--sw-r-sm` | 12 | 8 | 4 |
| `--sw-r-md` (chip, input, sub-button) | 18 | 12 | 6 |
| `--sw-r-lg` (card, pill) | 28 (= row height / 2) | 18 | 8 |
| `--sw-r-xl` (sheet) | 42 | 28 | 12 |
| `--sw-r-pill` | 999 | 999 | 8 (buttons stop being pills) |
| `--sw-r-video` | 16 | 12 | 4 (capped: video never gets the pill radius) |

Radii are independent of density: `row` density always caps the row radius at `min(--sw-r-lg, var(--sw-pill-h)/2)`.

### 3.6 Which screens each option fits

Legend: D = default, ok = allowed, no = disallowed (breaks a rule). Screen ids from `docs/design/handoff/SCREEN_INVENTORY.md`.

| Screen family | wide | regular | compact | row | flat | glass | gradient | fill | sheet | centred | inline | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **H1 Home / overview** (widgets, KPI, floors) | D phone | D desktop | ok | no | D | ok (widgets) | ok | no | D | ok | no | tree panel stays; floors become floor cards on phone in any density |
| **H2 Area screen: device tiles / cards / list** | cards mode | tiles mode D | tiles mode (dense wall) | **list mode D** | D | ok | ok (cards) | D for lights/covers | D | ok | ok | list mode = row density, table flavour only for catalogue |
| **Tree panel (desktop) / floor cards (phone)** | floor cards | D | D | ok (44 px rows) | D | ok | ok (floor hue) | no | n/a | n/a | n/a | must stay in every combination (see 3.7) |
| **S1 Live overview, S5 events, F3 notifications** | no | ok | ok | **D** | D | no | no | no | D | ok | ok | event rows with thumbnail ring |
| **S2 wall / S3 single camera / K1 kiosk** | no | no | no | no | D | no (glass over video forbidden) | no | no | ok (controls) | ok | no | video tiles keep `--sw-r-video`; density only affects chips and control bars |
| **S6 Playback / timeline, schedules grid H4-H6** | no | no | ok (control bar) | table | D | no | no | no | ok | D | D | data visualisations; only controls take the dials |
| **M1-M6 Maps, Plan Studio** | no | ok (layer chips) | D | ok | D | ok (panels over map) | no | no | D | ok | D | canvas unaffected |
| **F4-F6 Media** | D | D | ok | ok | ok | ok | ok | D (volume) | D | ok | ok | cover surface is a media-only variant |
| **F1-F2 Automations, scenes** | no | ok | ok | D | D | no | ok (scenes) | no | ok | D | D | |
| **G* Settings, audit, users, storage** | no | no | ok | **D (table)** | D | no | no | no | ok | D | D | forms use pill fields at regular/compact; tables stay tables |
| **W2-W4 WisKey (own screens)** | no | D | ok | ok | D | ok | no | no | D | ok | ok | iframe W1 untouched |
| **Alarm S15 / PIN** | ok | D | no | no | D | no | no | no | no | **D (forced)** | no | PIN keys >= 56 px |
| **L1/L2/A1** sign-in, PWA, Android | ok | D | ok | no | D | ok | no | no | D | ok | no | |

Operator-density rule of thumb: **desktop operator = compact + flat + inline/drawer; phone = regular/wide + flat or gradient + sheet;
wall tablet = wide + flat + sheet, performance mode on; admin = row (table)**.

### 3.7 Constraints that hold in every combination

- **The floors/areas tree survives**: it is not a card; its rows read `--sw-pill-h` only with a floor of 44 px and are drawn by the existing
  tree rules (`devices-building nav.tree`, `.tree-row`, selected row = accent fill + icon ring + text). On phone the equivalent floor cards
  keep all tree actions. `inline` pop-ups are the only kind that never covers it; `sheet` on desktop is a drawer beside it, never a
  centre overlay of it. A check to add to the evidence matrix: tree visible in every density x popup combination at 1440 and 390.
- **List / table views are mandatory in every family**: `row` density is the list view (pill rows or table rows); every screen listed
  as having tiles/cards must expose a list mode; admin tables never use pill rows.
- State = shape + text (fill amount printed, "On" text), never the gradient or hue alone; touch targets >= 44 px; text contrast >= 4.5:1
  for each dial value (the existing contrast test must run per density x surface x scheme, at least for flat + gradient + glass).
- RTL: logical properties; gradient and fill directions flip with `dir`; video, map, timeline and 24 h axes stay LTR.
- `prefers-reduced-transparency` forces glass -> flat; `prefers-reduced-motion` zeroes `--sw-t-*`; **no hover lift** (Bubble has none).
- Clean operator screens: one name + one state + one control per pill; chips and badges only where the screen already has them.
- Skin budget: new rules only for (a) pill grid and row/table layout switch, (b) pill fill background, (c) inline pop-up pane, (d) popup
  chrome per kind (3); estimate +6 rules on the ~30 of the base bubble skin = about 36 of 50.

### 3.8 New tokens (additions to `tokens.ts`, each with light + dark columns where colour)

`--sw-pill-h`, `--sw-pill-rows`, `--sw-pill-unit` (50 / 56), `--sw-icon-ring`, `--sw-chip-h`, `--sw-gap`, `--sw-gap-grid`, `--sw-fs-name`,
`--sw-fs-state`, `--sw-pill-bg-image`, `--sw-grad-dir`, `--sw-hue-1..8` (+ `-mute`), `--sw-fill`, `--sw-fill-color`, `--sw-fill-dir`,
`--sw-sheet-alpha`, `--sw-popup-w-sheet`, `--sw-popup-w-dialog`, `--sw-popup-inline-gap`, `--sw-fade-edge`, `--sw-inactive-opacity` (.6 icon /
.5 unavailable), `--sw-r-video`. Existing names reused: `--sw-r-sm..xl`, `--sw-r-pill`, `--sw-glass-blur`, `--sw-glass-blur-sheet`,
`--sw-surface*`, `--sw-accent*`, `--sw-shadow-*`, `--sw-t-*`.

### 3.9 Per-user vs per-installation

| Setting | Scope | Why | Storage idea |
|---|---|---|---|
| Skin family `bubble` itself | installation (`ui.skin`) | one product look, support and screenshots | exists |
| Scheme light / dark / auto | installation default + per browser (exists) | exists | `ui.scheme`, browser |
| **Radius scale** (pill / soft / square) | **installation** | brand continuity; mixes badly per user | `ui.bubble.radius` |
| **Pop-up kind** | **installation default**, forced overrides by screen (alarm = centred) | operational consistency and training | `ui.bubble.popup` |
| **Surface** (flat / glass / gradient) | **installation default; user may pick flat** (accessibility, old tablet, reduced transparency) | gradient hues are branding; glass is performance sensitive | `ui.bubble.surface` + user `prefs.surface` limited to `flat` or the default |
| **Density** | **per user AND per device class**: installation default per class (phone -> regular, desktop -> compact, wall tablet -> wide), user override | density is the dial that depends on the person's eyes, hands and the screen; the owner's "screen.personalize" decision (2026-09-30) already allows per-user choices of home layout | `ui.bubble.density = {phone, tablet, desktop}` + user override in the profile; `auto` picks by viewport and `pointer: coarse` |
| **List vs tiles vs cards** view mode | per user per screen (already exists: אריחים / כרטיסים / רשימה) | linked to density: list = `row` | exists |

Backend rules in the style of the foundation: validated enums (422 on unknown), audited changes, a test that keeps the enum list in
sync with the frontend registry, demo mode keeps choices in the browser.

### 3.10 Suggested next step (design phase, not implementation)

One "style board" screen in the whole-system mockup that shows ONE area screen in a 4 x 4 matrix (density x surface) plus the three
pop-up kinds and the three radii, light and dark, desktop and phone, with the tree visible in each; the owner then chooses defaults.
Re-use the image set above as the mood reference (suggested: `v3.1.0-rc.3\72f07b6a.png` for density variety, `v3.1.2\7737b2c0.gif`
sheet for gradient surfaces, `v3.2.0-beta.1\a33a17a0.jpg` for pop-up kinds, `v3.1.0-beta.5\467c11b9.png` for fill orientation,
`v2.3.0-beta.1\89c299b5.png` for the radius scale, `v3.0.0-rc.1\74278fcc.png` for the native/light row list).

## 4. Open questions (for the owner)

1. Gradient surface: decorative hues per area (a), per floor (b), or none in operator screens (c)?
2. Density default per device class: phone regular, desktop compact, wall tablet wide - agree?
3. Radius: lock to pill for the whole installation, or offer soft/square as an installation choice?
4. Inline pop-up (docked detail pane) as the desktop default instead of a drawer?
5. Is the Neon-like auto-colour assignment wanted at all, or only a fixed 8-hue palette?

## 5. Sources

Release notes and assets: `https://api.github.com/repos/Clooos/Bubble-Card/releases?per_page=100` (2 pages), tag pages
`https://github.com/Clooos/Bubble-Card/releases/tag/<tag>`; image hosts `github.com/user-attachments/assets/` and
`github.com/Clooos/Bubble-Card/assets/36499953/`. Local copies (gitignored): `C:\cloude\smplwisebms\private\design-refs\bubble\releases\<tag>\`.
Repository measurements and licence: `docs/design/research/BUBBLE_CARD_ANALYSIS.md`. Skin layer: `git show pilot/design-foundation`
(`SKIN_AUTHORING_HE.md`, `frontend/src/design/tokens.ts`).
