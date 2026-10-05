# Glass dashboards (GlassHome and Magic Frame) - design analysis for a further skin and a wall-tablet module

Research only (2026-10-02, branch `pilot/design-glasshome-research`, based on `pilot/design-bubble-research`). No application code,
no secrets, no device access. Purpose: the owner asked to learn as much as possible about https://glasshome.app/ and to consider a
further design skin "in the style they present"; the scope was then extended to Magic Frame (https://magicframe.dev/). This document
says what each product is, what we may legally reuse (almost nothing), measures the GlassHome look from its public demo, compares
it with our skins (classic, Domus, Tesla, Bubble and its `ui.look` dials), and proposes what to build.

Rules followed: only publicly visible material was used for inspiration. No code, asset, image or text of either dashboard is copied
into this repository. Screenshots were taken for private study only and live in `C:\cloude\smplwisebms\private\design-refs\glasshome\`
(gitignored, never committed). "Measured" = read from computed styles / stylesheets of the public demo with the browser pane
(`javascript_tool`, inspection only). "Documented" = stated in public docs. "Inferred" = my reading, flagged where used.

## 0. Sources read, and what was unreachable or not done

| Source | Result |
|---|---|
| https://glasshome.app/ | Read (fetch tool summary). |
| https://glasshome.app/llms.txt | Read: full URL map of the docs, widget dev, hub, blog (all `/md/...` pages are plain-text mirrors of `/docs/...`). |
| https://glasshome.app/pricing.md | Read. |
| https://glasshome.app/docs , /widgets , /blog | Read as landing pages. `/widgets` is a navigation hub, not a catalogue (no list of the 21 hub widgets was readable there). Blog index read: 6 posts. |
| https://glasshome.app/md/dash/{concepts,themes,layouts,editing,widgets,people-and-access,guides/kitchen-tablet,widget-security,changelog} | Read. The changelog page returned no dated entries in the fetched text. |
| https://glasshome.app/md/widgets/widget-styling | Read. |
| Blog posts (`vs-home-assistant-dashboard`, `best-home-assistant-dashboards`) | Read. The three widget-dev tutorial posts were only listed, not read. |
| Not read | `/md/dash/{installation,addon,docker,remote-access,faq,troubleshooting}`, `/md/hub/*`, the terms and privacy pages (so the dashboard's end-user terms are NOT reviewed), the widget-dev pages other than styling and security. |
| https://demo.glasshome.app | Used live in the built-in browser pane (demo mode with sample data; I typed placeholder names "Reviewer" / "Demo Home" into the onboarding, nothing else was submitted). Computed styles measured; screenshots at 390, 820, 1280x800 (wall tablet landscape) and 1440, dark and light, private only. |
| GitHub org https://github.com/glasshome | Read: repository list and licences (also via the public GitHub API); READMEs of `ui`, `widget-sdk`, `widget-contract`; `ui/SPEC.md` summary. No source code was cloned or copied. |
| Discord https://discord.gg/FJYdeDmrzv | Link only; not opened, not joined. |
| https://magicframe.dev/ and https://github.com/jeremiaa/magic-frame | Read: site landing, README, licence file, wiki pages `themes-and-styling`, `the-editor`, `views-and-displays`, `wallpapers`, `users-and-security`, `stacking-and-visibility`, `widgets-home-assistant`, `custom-modules`, `ROADMAP`. **No public live demo exists** (the site links only docs, GitHub, discussions), so Magic Frame design values come from its documented settings, not from computed styles. The product screenshots in its README were not viewed or stored. |
| Preset themes of GlassHome | I clicked the nine presets in the demo's settings and read the root variables after each click: nothing changed (all nine readings equal the default dark theme). Either the demo does not apply presets without Pro or my click did not hit the apply control. **Per-theme values are therefore NOT measured**; only the default theme is. |
| Widget internals | The tiles' inner DOM was not reachable (`innerText` of the page shows only "Add widget"; the widgets render in encapsulated trees, consistent with the documented per-widget shadow DOM). Text sizes inside tiles are read from screenshots only (approximate), not from computed styles. |
| Performance | No frame-rate or GPU measurement was possible. Statements on performance are inferences from the public CSS and docs. |

## 1. What they are, licensing, and what we may reuse

### 1.1 GlassHome

**What.** A standalone dashboard app for Home Assistant, aimed at wall tablets and family use. It runs on the home network (HA
add-on, Umbrel, Docker; port 3123), holds its own HA login via OAuth and a WebSocket, and keeps layouts and state in a local
database. Free tier: official widgets, nine themes with dark/light, no account. PRO: one-time USD 39.99, adds community widgets and
custom theming. Optional cloud "Hub" only for the widget registry and licences. Sources: https://glasshome.app/ ,
https://glasshome.app/pricing.md , https://glasshome.app/md/dash/concepts .

**Licensing (precise).**

| Part | Licence | Source |
|---|---|---|
| Dashboard app ("Dash") | **Proprietary**, closed source | https://glasshome.app/ ; blog https://glasshome.app/md/blog/best-home-assistant-dashboards |
| `glasshome/ui` (SolidJS component library, 70+ components, tokens, `.glass` material, Tailwind v4 preset) | **MIT**, "Copyright (c) 2026 GlassHome Labs" | https://github.com/glasshome/ui , licence file via https://api.github.com/repos/glasshome/ui/license |
| `glasshome/widget-sdk`, `widget-cli`, `widgets` (official widgets), `widget-contract`, `ha-types`, `sync-layer` | **MIT** (SPDX MIT per the GitHub API; `widget-sdk` file reads "Copyright (c) 2026 GlassHome Labs") | https://github.com/glasshome , https://api.github.com/orgs/glasshome/repos |
| `glasshome/homeassistant-addon` | **No licence declared** (API: none). Treat as all rights reserved | same API call |
| `glasshome/CasaOS-AppStore` (fork) | Apache-2.0 | same |
| Name "GlassHome", logo, wallpapers, product photos in the widgets, demo copy | Not covered by the MIT repos as far as I can tell; not to be reused | - |

**What we may reuse (engineering reading, not legal advice).**

| Use | Allowed? | Obligation |
|---|---|---|
| Take the look, interaction patterns and layout ideas as inspiration (public demo) | Yes | none |
| Re-express measured numeric values (blur radius, opacity, radii, durations) in our own token names | Yes | none for plain numbers |
| Copy or closely translate code from the MIT repos (`ui`: `.glass` CSS, token generator, motion classes, OKLCH helpers; `widget-contract`: capability grammar) | Yes under MIT | Keep the copyright line "Copyright (c) 2026 GlassHome Labs" and the MIT permission notice with the copied portion (a `THIRD_PARTY_NOTICES` entry). No warranty. |
| Use `@glasshome/ui` as a dependency | Technically yes, **not recommended** | It is SolidJS (we are Lit); ESM-only; pulls Kobalte and Tailwind v4; its SPEC says the `.glass` class is driven by ~15 custom properties - cheaper to re-implement the idea in our token layer. |
| Reuse the dashboard app, its themes, its wallpapers, product images, copy, or the `.glasshome-theme.json` format as our own format | No for the app and assets; the theme file format is a data format described publicly but not licensed as code - do not adopt it, define our own | - |
| Show their name or branding in our UI | No (product rule; also "no HA branding" rule) | - |

**Recommendation:** inspiration plus our own implementation. If we ever want the `.glass` formula verbatim, copy only the small CSS
block under MIT with the notice; I did not read the stylesheet source in the repo, only the public demo's computed CSS and the
`SPEC.md` summary, so the repository's exact formula is unverified.

### 1.2 Magic Frame

**What.** A self-hosted "home display" app: browser-based, one URL per "view" (a display), drag-and-drop editor on a 24x24 grid,
19 built-in widgets (clock, weather, environment, calendar, HA entity, HA notifications, camera, sensor, image, buttons, timer,
messages, shopping, todos, media player, RSS, QR, status, text), Immich/WebDAV photo wallpapers, live sync by WebSocket, custom JS
modules, TOTP 2FA, Docker, Kubernetes, HA add-on. Stack: Next.js 16 with PostgreSQL (per the owner's brief; the README shows Next.js
16 and Docker). Latest release tag read from the API: v1.5.5 (2026-09-24). Sources: https://magicframe.dev/ ,
https://github.com/jeremiaa/magic-frame .

**Licence: Polyform Noncommercial License 1.0.0** (GitHub API: `NOASSERTION`/"Other"; file `LICENSE.md`). Permits personal,
household, educational and non-profit use, modification and distribution under the licence's own conditions; **prohibits commercial
use, SaaS and embedding in commercial products**; commercial use needs a separate agreement with the author (contact address in the
licence file). Source: https://github.com/jeremiaa/magic-frame/blob/main/LICENSE.md .

**For us (a commercial product): nothing in Magic Frame is reusable.** Not code, not CSS, not wiki text, not images. Inspiration of
ideas only, expressed in our own words and implementation. Do not paste its settings tables or wiki sentences into our documents.

## 2. The GlassHome design language, measured (default theme, public demo)

Measured on 2026-10-02 at https://demo.glasshome.app in the built-in browser. The page root carries `class="dark perf-blur"` and
`data-motion="live"`. Values below are token-level facts; they are not their code.

### 2.1 Colour logic

- All colours are **OKLCH**. Tokens follow the familiar shadcn naming (`--background`, `--card`, `--primary`, `--border`...) plus
  semantic `--tone-*`, `--chart-1..5`, `--love`, `--scrim`.
- **Dark:** background `oklch(0.12 0.01 250)` (near-black with a faint blue cast, hue 250), card `oklch(0.17 0.01 250)`, border
  `oklch(0.26 0.012 250)`, muted text `oklch(0.81 0 0)` (i.e. text stays very bright), foreground pure white.
- **Light:** background `oklch(0.995 0.003 250)`, card `0.96`, border `0.855`, foreground pure black, muted text `0.34` (dark,
  high contrast).
- **Accent:** `--primary` `oklch(0.48 0.2 215.2)` (a deep cyan-blue) and `--accent` `oklch(0.6 0.2 195)` (teal), identical in light
  and dark; separate **tint-foreground** variants per scheme for text on tinted glass (primary `42%` light / `78%` dark lightness) -
  this is the same idea as our `--sw-*-text` tokens.
- **Semantic tones** (dark): success `oklch(0.74 .18 145)`, warning `.82 .17 75`, danger `.68 .22 27`, info `.70 .20 245`, neutral
  `.69 .02 250`, accent `.78 .18 60`. Light variants are about 0.04 darker.
- **Tonal glass:** each tile is *tinted by its state tone* (observed: a locked door tile greenish, heating tile warm red-brown,
  lights off neutral dark). The tint is a gradient wash (default wash strength 28%, per the UI SPEC summary) from the tone to
  transparent. This is the strongest colour idea in the product: colour carries state on the surface itself, not on a badge.
- **Accent use:** sparing. The accent appears on the active dock item (cyan glow behind the icon), the slider/arc fills, the primary
  buttons' rim, and as a thin 1px orbiting/edge highlight (`glass-edge-orbit`, `glass-edge-gradient`). Body surfaces are neutral.

### 2.2 The glass material (the core, and why it is more than "blur")

One CSS class `.glass` is parameterised by five owner-facing "material dials" on the root, defaults measured:

| Dial | Default | Meaning |
|---|---|---|
| `--material-blur` | 24px | backdrop blur radius |
| `--material-clarity` | 60% | card fill opacity ratio (how see-through) |
| `--material-depth` | 1 | multiplier of light, shade, rim and lift |
| `--material-tint` | 1 | multiplier of the tone wash |
| `--material-glow` | 0px | outer bloom (18px in the documented Neon material) |

plus edge terms (`--material-edge-width` 1px, `--material-edge-ink`, `--material-edge-accent`) and an "ink" level (0 by default)
which, when raised, turns the surface into a hand-drawn chalk look (irregular radii, rotated 3px outline).
Documented presets ("materials"): **Frosted, Paper, Chalk, Neon** (https://glasshome.app/md/dash/themes ; names of the knobs from
https://raw.githubusercontent.com/glasshome/ui/main/SPEC.md , read as a summary).

A surface is built from five layers (measured from the stylesheet rule of `.glass`):

1. optional **grain**: a 160px SVG fractal-noise tile at about 5% alpha (frost texture; opt-in class `glass-frost`);
2. a **top-left sheen**: radial gradient 120% x 120% at 22% 8%, white at `0.05 x depth` (tinted variant `0.16`);
3. a **bottom-right shade**: radial gradient at 82% 100%, black at `shade x depth` (0 by default);
4. the **tone wash**: linear gradient 135deg tone to base (`card` colour);
5. the **bevel rim** (box-shadow, all inset): a 1px top highlight `white .22 x rim x depth`, a soft inner light edge `2px 2px 5px -3px`
   white `.5 x rim x depth`, and a dark inner opposite edge `-2px -2px 4px -2px` black `.12 x rim x depth`; plus a coloured inner
   bottom glow (`inset 0 -2px 4px` tone), a tone drop `0 1px 3px`, and the lift shadow `0 10px 30px -16px black`.

Measured on live elements (dark, `perf-blur` active):

| Element | backdrop-filter | border | radius | notes |
|---|---|---|---|---|
| Floating dock (464 x 71 at 1440) | `blur(24px) saturate(1.8)` | 1px, `srgb .124 .143 .164` at 60% alpha (dark) / `.787 .817 .849` at 60% (light) | 26.4px | padding 8.64px; rim insets at `.066 / .15 / .036` (low depth on the dock), lift shadow black `.55`, accent glow `0.65` |
| Round buttons (e.g. 122 x 37, 88 x 35) | `blur(24px) brightness(1.1) saturate(1.2)`; tinted variant `blur(14.4px) brightness(1.1) saturate(1.6)` (blur is 0.6 x the dial) | 1px at 90% (neutral) or accent at 45% (tinted) | 26.4px / 22.4px | rim `.11 / .25 / .06` neutral; `.22 / .5 / .12` tinted |
| Modal scrim | `blur(12px)` (a Tailwind `backdrop-blur-md`) | none | 0 | fill `oklab(0.12 ...) / 0.7` |
| Widget tiles (the large cards) | **`none`** under `perf-blur` | 1px `oklch(0.26 .012 250)` | 26.4px outer, 22.4px inner element | the tiles still look frosted in screenshots; see 2.8 |

**Border/stroke:** always 1px, a mix of the border token at 60% alpha with the tone or ink (`color-mix`), never a heavy line.
**Shadows:** shared tokens are *light* (`0 2px 3px #00000029` family, y offsets 2 to 8px); the glass lift shadow is the long,
negative-spread `0 10px 30px -16px`, i.e. soft ground contact, not a floating blur.

### 2.3 Radii, spacing, grid

- `--radius` **1.4rem = 22.4px**; shell elements use `+4px` = **26.4px** (tiles, dock, header); icon boxes and round buttons 22.4px;
  buttons in the dock are 52 x 52 with radius 22.4px (a superellipse-like rounded square, not a circle).
- `--spacing` 0.27rem (4.32px unit). Widget gap **16px**; page side margin 16px (phone) to about 85px (desktop with the left
  inset of the page container at 1440).
- **Grid (measured and documented):** 12 columns at >=1024px, 8 at >=768px, 4 below 768px (https://glasshome.app/md/dash/layouts).
  Measured at 1440: column about 90px, gap 16px (a 4-col tile is 407px, 8-col 831px, 12-col 1254px); row unit about 70px with a
  16px gap (tile heights 70, 156, 242, 328, 414 = n rows). At 820: column about 79.5px, gap 16px, row about 67px. At 390: 4 columns,
  full-width tile 358px, half tile about 171px. Row height scales a little with the viewport. **Each breakpoint keeps its own
  layout** (editing on the phone does not change the tablet).

### 2.4 Typography

`Geist Variable` for all text, `GeistMono Variable` for numbers/mono, optional display faces `Bebas Neue` and `Caveat` (theme
choices). Hierarchy seen in screenshots (approximate, not measured): a very large light-weight/bold number for the headline value
(temperature about 64 to 80px on the 1440 hero tile), 13 to 15px bold titles, 10 to 11px small caps-like labels above titles
("Lock", "Heat", "Light"), 20 to 28px state words ("Locked", "Off"). The header tile shows a small greeting line and a bold name.
Letter-spacing token `--tracking-normal` 0em.

### 2.5 Iconography

Filled glyph icons, 24px viewBox, `fill: currentColor` (Material-like: home, sofa, fork and knife, bed, door, tree, bolt, gear).
Each tile has an **icon box**: a rounded-square glass chip (about 40 to 52px at 1440) that takes the tone colour when active
(green lock, orange flame). Product **photographs** of the real device (a wall lamp, thermostat, ceiling light) sit inside tiles as
a decorative right-hand image; the widget SDK calls these escape patterns where the widget "owns its visual surface".

### 2.6 Motion

Measured tokens: micro **120ms**, state **160ms**, expand **200ms**, morph **400ms**; easings `cubic-bezier(.22,1,.36,1)` (emphasis),
`(.16,1,.3,1)` (expand), `(.4,0,1,1)` (contract), `(.32,.72,0,1)` (morph). Documented rules (UI SPEC summary): colours morph on the
state duration, shapes grow from their origin, children stagger in (80ms base, 60ms per row), exits contract at **half** the arrival
speed, and **ambient motion** (weather animation, vinyl, glows) runs only when `data-motion="live"` (a 30s window that is
re-armed by pointer activity) - a wall tablet that nobody touches stops animating. The SDK exposes `useReducedMotion()` and
`useIntersectionPause()`; there is a "Reduce motion" setting. Widgets can enter "Rise, one by one" in reading order (setting).

### 2.7 Light / dark and wallpaper

- Dark mode is Off / On / Auto (sunrise/sunset), per home or "just me" (https://glasshome.app/md/dash/themes ; settings screen).
- **The wallpaper is the main visual**: a full-bleed photograph (`background-size: cover`) behind everything; the demo swaps to a
  different (daytime) photo in light mode. No CSS vignette or dimming layer was present in the demo's default theme (the wallpaper's
  parent has a single child). The theme studio documents background controls: visibility, softness (blur) and vignette; Pro users
  can upload photos.
- Light mode uses lighter glass over the same blurred photo; text flips to black.

### 2.8 Performance mode (important for tablets)

The settings screen has a **Blur** option whose default is "Performant" ("same frosted look, a fraction of the cost", recommended),
and the root class `perf-blur` was active in the demo. In that mode the large widget tiles had `backdrop-filter: none` while still
appearing frosted in screenshots, and only the small floating elements (dock, buttons) and the modal scrim kept a real backdrop
filter. **Inference (not verified):** the product probably paints a pre-blurred copy of the wallpaper behind the tiles instead of
blurring the live backdrop per tile. The stylesheet also contains a `.reduce-blur` rule that falls the control fills back to the
opaque card colour, and the documentation says glass controls fall back to the opaque card on a reduced-blur theme
(https://glasshome.app/md/widgets/widget-styling). This is the single most useful engineering idea for our kiosk.

## 3. The layout model

**GlassHome** (documented unless marked):

- **Free widget grid**, per-breakpoint layouts (12/8/4), several dashboards per home; "rooms" are simply dashboards, switched from a
  **floating dock** at the bottom (Home, Living room, Kitchen, Bedroom, Hallway, Outside, Energy, Settings in the demo). On a phone
  the dock becomes a **paged** pill (page dots under it). **Observed:** at 1280x800 the floating dock overlaps the lower tiles;
  there is no reserved bottom inset.
- **Header tile:** greeting + home name + summary chips (lights on count, locks unlocked count).
- **Widget types:** 14 official ones named in the docs (Light, Switch, Sensor, Climate, Fan, Cover, Scene, Area, Batteries, Binary
  Sensor, Button, Camera, Locks, Blinds); the demo also shows weather, media player, scenes strip, room cards; 21 hub widgets in the
  demo's count. Sources: https://glasshome.app/md/dash/widgets , demo settings screen.
- **Edit mode:** press and hold the dock about 500ms (or a background menu); faint grid overlay; auto-save; tap selects, long-press
  300ms opens the widget's settings sheet, drag the centre grip to move (others make room when a third overlaps), drag the corner
  grip or pinch to resize within min/max per widget, an X to remove; a second finger scrolls while dragging; drag a tile onto another
  dashboard via the dock. In live mode, holding a tile opens a **sheet** with extra controls (colours, modes, history).
  (https://glasshome.app/md/dash/editing)
- **People and permissions:** roles Owner, Admin, Member; per-person **rooms** (others become invisible), **control level** (full or
  view-only), sensitive devices (locks, alarms, cameras, garage) **off by default**, dashboard access, "can edit dashboards", an
  **expiry date** for guests. Local accounts by a one-time invite link (7 days). HA users can be restricted without losing HA access.
  (https://glasshome.app/md/dash/people-and-access)
- **Wall tablet / kiosk:** a tablet shows a six-digit code on its sign-in screen; an admin enters it on a computer; the tablet gets a
  **shared-device profile** with its own dashboards, rooms, view-only vs control, start dashboard and theme; "nobody's account stays
  signed in on the wall"; unpair signs it out at once. Always-on / screensaver behaviour is **not documented**.
  (https://glasshome.app/md/dash/guides/kitchen-tablet)
- **Themes:** nine presets - Midnight Glass, Monochrome Pro, Tide, Forest Zen, Liquid Glass, Sunrise Studio, Lavender Dreams,
  Chalkboard, Retrowave - each with dark and light. Custom theming (Pro): start from a preset, a photo or a colour; background
  visibility/softness/vignette; accent, glass tint, corner radius, material (Frosted, Paper, Chalk, Neon) with strength; twelve
  colours for light and dark; up to 50 themes per home; export/import as a `.glasshome-theme.json`; creator and admins edit, everyone
  applies; per user theme preference. (https://glasshome.app/md/dash/themes) Per-theme token values: not measured (section 0).
- **Widget platform:** SolidJS components + Zod config, shadow-DOM isolation, a CSP that blocks external network, **capability
  grants** ("Climate wants permission to: control your thermostat") enforced server-side so the HA token never reaches a widget;
  one grant equals one consent sentence generated from the same object that is enforced.
  (https://glasshome.app/md/dash/widget-security , https://github.com/glasshome/widget-contract)

**Magic Frame** (documented):

- A **view** is one display; its URL `/view/<id>` needs **no login** by design; the editor is a separate login with roles Admin and
  View-only(editor). Anyone on the network can operate what the screen shows (the wiki says so explicitly).
  (https://github.com/jeremiaa/magic-frame, `wiki/users-and-security.md`, `wiki/views-and-displays.md`)
- **24x24 grid**, widgets snap to whole cells, stack freely (no push-away), a layer list for overlaps, an inspector with three tabs
  (layout, type, content), no undo (snapshot before each save), save pushes to all displays within about a second, a 5s polling
  fallback, version-based reload, optional periodic full reload (1 to 24 h) against memory growth.
- **Photo-frame / ambient mode:** wallpapers from Immich (up to 1,500 images) or WebDAV, rotation 10s to 24h, crossfade / Ken Burns /
  slide / cut (0.3 to 4s), top/bottom gradients (30% / 80% default), vignette and blur for readable text. The wiki warns that Ken Burns
  and the timer ring are the expensive effects (timer ring measured by the author at about 37% of one core vs 2% off on an old
  browser).
- **Notification tiles:** rule based; a trigger entity state shows a message tile with icon and colour; dismissed by acknowledgement or
  a clear entity or a duration counted from `last_changed`; "pulse" shows an overlay for a fixed time; a doorbell/motion can pop a
  camera **full screen**. Widgets can be hidden by an HA entity state or by a button (pop-up overlays).
- **Glass settings that are documented:** card opacity 0 to 100% (default 40), card blur 0 to 40px (default 12), card theme
  auto/dark/light, text shadow blur 0 to 40px (default 4px offset, 80% black), fonts Geist/Inter/Roboto/Montserrat/SF Pro/Playfair/
  Lato/Oswald/Outfit, weight 100-900, text size 8 to 150px, theme mode dark/light/sun/time/entity with 07:00/20:00 fallbacks.
  (wiki `themes-and-styling.md`). Radii, borders and shadows of its cards are **not documented and not measured**.
- Custom modules run with full browser rights (no sandbox). A glass tile there is a plain card with the opacity and blur above.

## 4. Comparison with our design systems

Our skin layer (`pilot/design-foundation`, `pilot/bubble-foundation-b`, `docs/design/SKIN_AUTHORING_HE.md`): one token table
`{name:{light,dark}}` (145 `--sw-*` names), skins = token overrides plus at most 50 shadow-root rules, registry `SKIN_IDS`,
`ui.skin` / `ui.scheme`, and for Bubble the `ui.look` dials: `density`, `surface` (flat/glass/gradient/fill), `popup`, `radius`
(pill/soft/square), `transparency` (40 to 100, floored by a contrast threshold), `scale`, `touch`, `palette` (reserved). The device
screens have their own `--dv-*` knob family (`devices.style` smplwise|glass, four palettes, light/dark, density) documented in
`docs/design/DEVICE_THEMES.md`, plus a 12-column (4 on phone) layout editor.

### 4.1 Measured side by side

| Aspect | GlassHome (measured) | Domus skin | Bubble skin / dials | Tesla skin |
|---|---|---|---|---|
| Surface idea | tonal glass over a photo, parametric (5 dials) | glass panels on a two-bloom canvas | flat opaque pills; glass only on sheets; `surface=glass` dial | flat, hairline |
| Blur | 24px + saturate 1.8 (dock), 24px control, 12px scrim; tiles can run with none (`perf-blur`) | 24px / 20px nav / 32px sheet, saturate 1.5-1.6 | 10px on sheets only (tokens), `glass` surface dial | none |
| Fill opacity | clarity 60% (dial) | light .52, dark .66 | `transparency` 40..100, default 72 (sheet alpha) | opaque |
| Rim | bevel: 1px top highlight + inner 2px light edge + inner dark edge + tone inner glow | `inset 0 1px` highlight + 1px border `rgba(255,255,255,.72)` | none (no border) | 1px strong line |
| Radii | 22.4 / 26.4px (single dial) | 10 / 16 / 24 / 28 px tiers | pill / soft / square dial (12 / 18 / 28 / 42 px base tiers) | 4 / 6 / 8 px |
| Shadow | long negative-spread lift `0 10px 30px -16px` + inner rims | two-layer soft, 3 elevations | none except sheet | none |
| State colour | whole tile tinted by tone | glow on "on" tiles (`--dv-glow-*`) | accent fill = on | accent underline |
| Accent | deep cyan-blue + teal, on dock glow, fills | blue `#2a63f0` | our blue / Bubble azure | blue |
| Backdrop | **photo wallpaper**, day and night variants | designed colour blooms | flat colour | flat |
| Type | Geist, big numerals, tiny labels | system + Heebo | Heebo, 12-15px | system |
| Icons | filled glyphs in tone-coloured rounded-square boxes; device photos | outline in round badges | round ring badge | outline |
| Motion | 120/160/200/400ms, stagger 80/60, exit at half speed, ambient gated by 30s activity | 220ms, hover lift -2px | 200/300ms, state fade 1.5s (token) | none |
| Navigation | floating bottom dock = list of dashboards/rooms (paged on phone) | floating glass rail | floating pill dock on phone | rail |

### 4.2 What is genuinely new versus Bubble and Domus

1. **A parametric material, not a palette.** Five homeowner dials (blur, clarity, depth, tint, glow) and a family of materials
   (frosted, paper, chalk, neon) all produced by one `.glass` formula. We have Domus as one fixed point and Bubble `surface=glass` as
   one dial value; we have no "depth" (bevel rim) or "tint" (state wash) dial and no material presets.
2. **The bevel rim** (inset highlights on two edges and an inner dark edge). Domus has a flat top highlight and a pale border; this
   rim is what makes the surfaces read as thick glass. It is a few box-shadow lines, i.e. **a rule, not a structure**.
3. **State colour on the surface (tonal glass)** instead of badges/glows. Closest relative: `--dv-tile-on-*` glows in the device
   screens. Notably compatible with our rule that state is "shape + text, not colour alone" only if the text/shape remains; the
   product itself relies on both (the word "Locked", the icon).
4. **Wallpaper-led design with day/night photos** and a dedicated background pipeline (visibility, softness, vignette, uploads).
   Domus uses painted blooms, Bubble flat colour. The wallpaper is also why the rest looks glassy: glass needs something to refract.
5. **The performance tier** (`perf-blur`, reduce-blur fallback, ambient-motion gating). Our Domus/Bubble rules already fall back to
   solid surfaces for `prefers-reduced-transparency`, but we have no user-visible "cheap blur" mode and no activity-gated ambient motion.
6. **Dashboard-as-product structure**: per-breakpoint free grid, edit mode by gestures, widgets as sandboxed plug-ins with consent
   sentences, shared-device pairing by code. None of this is a skin; it is a **module** (section 5.3).

### 4.3 What would be only a palette or a dial

- Deep-cyan accent, Geist typeface, 22/26px radii: a palette (`ui.look.palette` is reserved) plus the radius dial (`soft` base 18/28 is
  already near).
- Blur radius 24px, saturate 1.8, 60% clarity: these are exactly the `surface=glass` + `transparency` dials we already have (Domus
  uses the same 24px/saturate 1.6).
- Light/dark switching with sunrise/sunset: `ui.scheme=auto` exists (OS-based); sun-based is a small addition.
- Nine named presets: a palette list; a "Chalkboard" or "Retrowave" variant is a palette plus a rule or two.
- The floating dock: our Bubble phone dock is the same idea (floating pill dock on a grid row); the GlassHome dock overlapping content
  contradicts our finding "floating elements never cover content" (`pilot/design-bubble-taste` commit 699e5d3f) - we keep ours.

### 4.4 Owner rules checked against the GlassHome pattern

| Rule | GlassHome / Magic Frame | Consequence for us |
|---|---|---|
| Floors/areas tree survives every skin and design | Both products have **no tree**: rooms are a flat dock of dashboards (GlassHome) or separate views (Magic Frame) | The dock cannot replace our tree on desktop operator screens. On a kiosk the room dock may be **fed by the tree** (floor groups, collapse = paging), but the tree stays the source. Any glass skin must keep the `devices-building nav.tree` selectors prominent (SKIN_AUTHORING section 4). |
| List/table view in every design | Neither product has list/table views; everything is tiles | A glass skin must add `row` density (already in the Bubble dials) and keep tables as tables; a wall dashboard is the only screen where tiles-only is acceptable. |
| Operator screens clean (no hints/badges/paragraphs) | GlassHome tiles are busy by our standard (label + name + state + photo + secondary chips) | Use the tone wash plus one state word; no device photos in operator screens; photos only on the owner-chosen wall dashboard. |
| Every option editable in the UI | GlassHome yes (dials in a theme studio, but custom themes are PRO); Magic Frame yes (inspector) | Match: dials live in the existing "look" card (`system-look`); no hard-coded values in a skin. |
| No HA branding in operator UI | GlassHome is named HA-first; Magic Frame mentions HA widgets | Widget names in our UI use our neutral wording ("תשתית המערכת" rule). |
| Floating elements never cover content | GlassHome dock overlaps (observed) | Reserve the dock row as a grid row (as our Bubble phone dock does). |
| Security: authorize every server operation | Magic Frame's `/view/<id>` is unauthenticated and `/api/ha/action` has no session check (documented) | **Do not adopt.** AGENTS.md requires authorising every operation and bars unrestricted service calls; our kiosk must be a restricted principal (SC31 says "no admin controls and restricted principal"). |

## 5. Proposal

### 5.1 Verdict on "a further skin in their style"

The look is mostly **expressible as a palette plus dials we already have**; what is new is small and mostly in two places: the
**bevel rim + tonal wash** (two dials) and the **wallpaper pipeline with a cheap-blur tier** (a feature). I recommend:

- **Option 1 (recommended, small): add material dials to the existing glass-capable skins** instead of a fourth skin: `depth`
  (rim and lift multiplier) and `tint` (state wash multiplier) as new `ui.look` dials, and a `material` preset (frosted / paper /
  chalk / neon) that sets them. Domus and Bubble `surface=glass` benefit at once.
- **Option 2 (if the owner wants the full GlassHome-like mood): a skin entry `crystal`** (display name "Crystal", Hebrew "קריסטל";
  avoid the names "Glass" because `devices.style=glass` already exists, and "Liquid Glass" because it is also a GlassHome preset and
  an OS trademark-like term) with the token set below, **requiring a wallpaper**.

### 5.2 Skin entry `crystal` (proposal, nothing implemented)

Fits the skin layer: `frontend/src/design/skins/crystal.ts` (token overrides, always both columns, names that already exist in
`tokens.ts` unless marked NEW), at most about 35 rules, registry `SKIN_IDS` + `^(classic|domus|tesla|bubble|crystal)$` in
`routers/settings.py`. Attribute: `<html data-skin="crystal" data-theme>` as today, and dial attributes on `<html>` in the style of
`data-bubble-*`: `data-glass-*`.

| Token | Light | Dark | Basis (measured) |
|---|---|---|---|
| `--sw-bg` | `#eef2f7` | `#0b0e14` | background oklch .995 / .12, hue 250 |
| `--sw-canvas` | wallpaper layer (NEW `--sw-wallpaper`, image + day/night pair) over `--sw-bg` | same | full-bleed photo; no overlay by default |
| `--sw-surface` | `rgba(255,255,255,.60)` | `rgba(24,28,38,.60)` | clarity 60% |
| `--sw-surface-2` | `rgba(255,255,255,.45)` | `rgba(255,255,255,.07)` | nested chips |
| `--sw-surface-solid` | `#f4f6fa` | `#171b24` | mandatory fallback (reduced transparency, no backdrop-filter, perf tier) |
| `--sw-border` | `rgba(255,255,255,.60)` | `rgba(60,70,90,.60)` | 1px at 60% alpha |
| `--sw-highlight` | `rgba(255,255,255,.22)` | `rgba(255,255,255,.22)` | rim top highlight x depth |
| `--sw-accent` | `#0b7aa8` (deep cyan-blue, contrast to be computed) | `#4cc3e8` | primary `oklch(.48 .2 215)` / tint-foreground `.78` dark |
| `--sw-r-sm / md / lg / xl` | 12 / 18 / 22 / 26px | same | 22.4 / 26.4 measured |
| `--sw-glass-blur` | `blur(24px) saturate(1.8)` | same | dock |
| `--sw-glass-blur-nav` | `blur(24px) saturate(1.8)` | same | dock |
| `--sw-glass-blur-sheet` | `blur(12px)` | same | scrim 12px (our sheets are solid-ish) |
| NEW `--sw-rim` | `inset 0 1px 0 rgba(255,255,255,.22), inset 2px 2px 5px -3px rgba(255,255,255,.5), inset -2px -2px 4px -2px rgba(0,0,0,.12)` | same | measured rim (depth 1) |
| NEW `--sw-lift` | `0 10px 30px -16px rgba(0,0,0,.45)` | `... .55` | measured |
| NEW `--sw-tone-wash` | `28%` | `28%` | UI SPEC default |
| `--sw-t-fast / med` | 160ms / 400ms | | state / morph |
| `--sw-ease` | `cubic-bezier(.22,1,.36,1)` | | emphasis |
| NEW `--sw-motion-ambient` | `0` or `1` | | gated by activity, see risks |

Typography: keep our Hebrew-capable stack (Heebo); **do not** adopt Geist for Hebrew (the demo showed Hebrew day names in a fallback
face, unverified for quality). Components: tiles and KPIs as tinted glass with the rim; dock = the existing Bubble dock row;
sheets use `--sw-surface-solid`; all state still expressed as shape + text.

**Dials** (extension of `ui.look`, same mechanism and validation as `density`/`surface`): `material` (frosted | paper | chalk | neon,
default frosted), `blur` (0 to 40px, default 24; 0 = solid), `clarity` (40 to 100%, default 60, **floored by the contrast
threshold** exactly like `transparency`), `depth` (0 to 2), `tint` (0 to 2), `glow` (0 to 24px), `wallpaper` (none | built-in |
uploaded, with `softness` 0 to 24px and `vignette` 0 to 60%), `blurTier` (live | performant | off), `motion` (live | calm). New
dials need `services/look.py` and `design/look.ts` lists and the `system-look` card; no skin value is hard-coded.

### 5.3 Wall-tablet widget dashboard module (idea) and CR-007 mapping

**What we already have** (from the repo): CR-007 device control (floors -> areas -> per-domain cards, bulk actions, remotes,
editable layouts) with a 12-column desktop / 4-column phone layout editor using grid units, per-device variants, a layout stored
per screen, `devices.read` / `devices.control` permissions, `screen.personalize` for personal overrides of layout and rows
(`docs/architecture/MEDIA_API.md`, `docs/changes/CR-015-MEDIA-SCREENS.md`), kiosk and editor roles that hold no control permissions
(CR-005, CR-007 section 7, CR-010: kiosk does not see the alarm), and a planned screen **SC31 Kiosk / wall display** (route
`/kiosk/:view`, BETA, task T057: grid readable from a distance, reconnect/status, no admin controls, restricted principal,
`docs/design/SCREEN_CATALOG.md`). Remote access is CR-008. So the **grid, the role split and the kiosk shell are already planned**;
the gap is a *widget model* (free tiles of mixed type) and the **pairing + shared-profile** flow.

**Ideas worth taking** (from both products, re-implemented):

| Idea | Source | Fit with Arx | Verdict |
|---|---|---|---|
| Per-breakpoint independent layouts (12/8/4) | GlassHome | We have 12/4 plus per-device variants; add a tablet (8) tier | Build (small) |
| Shared-device **pairing by six-digit code**; the wall device gets its own profile (dashboards, areas, view-only vs control, theme); "no personal account stays signed in" | GlassHome | Exactly our restricted-principal kiosk (SC31); needs an admin "devices" list + code issue + revoke (CR-001 identity model) | Build (core of the module) |
| Rooms as a dock that can be paged | GlassHome | Feed from our area tree; **tree stays the source** and desktop operator screens keep the tree | Build for kiosk only |
| Per-person rooms and **sensitive defaults off** (locks, alarms, cameras, garage), expiry on guests | GlassHome | Matches our permission split; add `expires_at` on kiosk/guest principals | Build |
| Capability-grant consent sentences for plug-in widgets | GlassHome (`widget-contract`, MIT) | We have no third-party widgets; take the idea only if plug-ins ever come; core widgets stay in our code | Skip for now |
| Edit mode: long-press, grid overlay, drag grip, pinch, auto-save | GlassHome | Our 6b editor already drags/resizes on the grid with keyboard fallback; add long-press entry on touch, **keep numeric/keyboard alternatives** (design contract) | Reuse existing editor |
| Edit has no undo, backups only | Magic Frame | Worse than our 409 stale-revision + reset; keep ours | Skip |
| Live sync of layout changes to all displays within about a second | Magic Frame | We have a WebSocket channel for HA state; add a layout-revision event; 5s polling fallback and version reload as safety | Build (small) |
| Periodic full reload against memory growth | Magic Frame | A real kiosk issue on old tablets | Build (a setting, default 6 h) |
| **Ambient / photo-frame mode** (wallpaper rotation, clock, tap to wake the controls) | Magic Frame | Needs a media source: uploaded images in our own storage; no Immich/WebDAV in v1; owner question | Optional, later |
| **Notification tiles** (rule-driven pop-up, acknowledge, pulse, camera full screen on doorbell/motion) | Magic Frame | Overlaps CR-018 notifications and the camera/door work; reuse our event model, no new rule engine | Fold into CR-018 follow-up |
| Activity-gated ambient motion (30s) | GlassHome | Cheap and valuable on kiosks | Build (tiny) |
| Unauthenticated view URLs; actions without a session; modules running with full browser rights | Magic Frame | Violates AGENTS.md | **Never** |
| Product-photo tiles | GlassHome | Asset licensing and clean-screen rule | Skip |

**Proposed module "wall display" (working name)**: a kiosk route using SC31, a widget set limited to what CR-007/015 already
render (light, switch, cover, climate, scene, media, camera tile, area summary, clock, weather if HA exposes it), the existing grid
editor, a paired-device record with its own principal and permissions, and the `crystal` look (or any skin) with wallpaper.

### 5.4 Effort (hours, engineering judgement, not measured)

| Item | Hours |
|---|---|
| A. `depth` + `tint` + `material` dials on existing skins (Option 1): tokens, `look.ts`/`look.py`, `system-look` card, contrast floor, tests | 10 to 14 |
| B. Skin `crystal` (Option 2) on top of A: tokens, about 30 rules, wallpaper layer, evidence matrix (light/dark x 1440/390) | 14 to 20 |
| C. Wallpaper pipeline: upload to our storage, day/night pair, softness/vignette, `blurTier`, scrim for contrast | 10 to 14 |
| D. Mockup first (same method as Bubble: one HTML file, tokens named as the real ones), kiosk + home + area boards, light/dark, 1280x800 | 14 to 20 |
| E. Kiosk module core: SC31 grid view, paired device principal (six-digit code, revoke, expiry), restricted permissions, layout-revision push, periodic reload | 36 to 52 |
| F. Tablet (8-column) tier and long-press edit entry in the 6b editor | 8 to 12 |
| G. Ambient / photo frame mode (later, optional) | 14 to 20 |
| H. Notification tiles / camera pop-up (inside CR-018 scope) | 10 to 16 |

Reasonable first slice: D (mockup) then A, about 24 to 34 hours, before the owner decides on B and E.

### 5.5 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **backdrop-filter cost on wall tablets** | Jank, heat, battery on always-on devices | Adopt the `perf-blur` idea: blur only on small floating elements, tiles on a pre-blurred wallpaper copy or solid fill; `blurTier` dial default `performant` on kiosk principals; honour `prefers-reduced-transparency`; measure on the real tablet before choosing (no measurement exists yet). |
| **Contrast over a photo** | Text unreadable on bright regions; our test checks only solid surfaces | Clarity floor from the computed threshold (as `transparency`), optional wallpaper dim/vignette dial, text shadow tokens, test with worst-case bright and dark wallpapers; tone wash must never be the only state cue. |
| Ambient motion and Ken Burns on old browsers | CPU 30%+ per the Magic Frame author | Default off on kiosk, gate on pointer activity, `prefers-reduced-motion` = 0. |
| Floating dock covering tiles (GlassHome behaviour) | Hidden content, breaks our layout guard | Dock occupies its own grid row. |
| Hebrew typography | Geist has no Hebrew; mixed faces look uneven | Keep Heebo/Noto; check numerals alignment. |
| Photo wallpaper privacy and storage | Uploaded family photos on the system; backup size | Store in our media storage with the existing size caps and backup rules; no third-party photo services in v1. |
| Licensing of copied code | Missing MIT notice | Prefer re-implementation; if any `glasshome/ui` snippet is copied, add the "GlassHome Labs" MIT notice in `THIRD_PARTY_NOTICES`. Magic Frame: never copy anything. |
| Third skin multiplies the evidence matrix | Cost per release grows | Option 1 first; a skin only if the owner picks it after the mockup. |
| Security model drift when borrowing kiosk ideas | Unauthenticated actuation | Restricted principal, server-side authorisation of every action, no queued/blind physical commands (AGENTS.md). |
| Source freshness | Both products ship weekly (GlassHome demo reports v1.4.0-beta.5, SDK v1.18.1; Magic Frame v1.5.5 on 2026-09-24) | Re-measure before quoting numbers in a Design ADR. |

## 6. Open questions for the owner (Hebrew questions will be asked by the coordinator; English here)

1. Is "the GlassHome style" mainly (a) the glass material with the bevel rim, (b) the photo-wallpaper-led look, or (c) the wall-tablet
   dashboard with free widgets and pairing? The answer decides between Option 1, Option 2 and the kiosk module.
2. A separate skin `crystal` (needs a wallpaper), or only new material dials on Domus/Bubble?
3. Should a wallpaper be required, optional, or uploaded by the owner (family photos)? Day/night pair?
4. Wall tablets: how many, which models (Android/Fire/iPad), always-on? We should measure blur cost on the real device first.
5. Kiosk access: pairing by six-digit code with a restricted principal per tablet (recommended), view-only by default, with a per-device
   list of areas and optional control of lights/covers/climate/media (never locks, alarm, siren, script, scene per the existing rules)?
6. Do we want an ambient/photo-frame mode, and from where (uploaded images only in v1)?
7. Rule-driven notification tiles and camera pop-up on doorbell/motion: part of CR-018 or separate?
8. Hebrew typography: keep Heebo for the glass skin?
9. Accent: deep cyan-blue as in GlassHome, or keep our blue `#2767ed`?

## 7. Citations

- GlassHome site: https://glasshome.app/ , https://glasshome.app/llms.txt , https://glasshome.app/pricing.md , https://glasshome.app/docs ,
  https://glasshome.app/widgets , https://glasshome.app/blog
- GlassHome docs (text mirrors): https://glasshome.app/md/dash/concepts , /md/dash/themes , /md/dash/layouts , /md/dash/editing ,
  /md/dash/widgets , /md/dash/people-and-access , /md/dash/guides/kitchen-tablet , /md/dash/widget-security , /md/dash/changelog ,
  /md/widgets/widget-styling
- GlassHome blog: https://glasshome.app/md/blog/glasshome-vs-home-assistant-dashboard , https://glasshome.app/md/blog/best-home-assistant-dashboards
- Live demo (measured values): https://demo.glasshome.app
- GlassHome GitHub: https://github.com/glasshome , https://github.com/glasshome/ui , https://github.com/glasshome/widget-sdk ,
  https://github.com/glasshome/widget-contract , https://raw.githubusercontent.com/glasshome/ui/main/SPEC.md ,
  https://api.github.com/orgs/glasshome/repos , https://api.github.com/repos/glasshome/ui/license
- GlassHome Discord (link only, not opened): https://discord.gg/FJYdeDmrzv
- Magic Frame: https://magicframe.dev/ , https://github.com/jeremiaa/magic-frame , `.../main/LICENSE.md` ,
  `.../main/wiki/{themes-and-styling,the-editor,views-and-displays,wallpapers,users-and-security,stacking-and-visibility,widgets-home-assistant,custom-modules}.md` ,
  `.../main/ROADMAP.md` (all under https://raw.githubusercontent.com/jeremiaa/magic-frame/main/ ), https://api.github.com/repos/jeremiaa/magic-frame
- Our repository: `docs/design/research/BUBBLE_CARD_ANALYSIS.md`, `docs/design/DEVICE_THEMES.md`, `docs/design/DESIGN_CONTRACT.md`,
  `docs/design/SCREEN_CATALOG.md` (SC31), `docs/changes/CR-007-DEVICE-CONTROL.md`, `docs/changes/CR-015-MEDIA-SCREENS.md`,
  `docs/architecture/MEDIA_API.md`; branches `pilot/design-foundation` (skins, tokens), `pilot/bubble-foundation-b`
  (`frontend/src/design/skins/*.ts`, `docs/design/SKIN_AUTHORING_HE.md` section 6, the `ui.look` dials), `pilot/design-bubble-taste`
  (mockup, "floating elements never cover content").
- Private, not committed: `C:\cloude\smplwisebms\private\design-refs\glasshome\` (7 screenshots: GlassHome demo at 1440 dark and light,
  1280x800 tablet landscape, 820 tablet portrait, 390 phone, settings; Magic Frame site landing).
