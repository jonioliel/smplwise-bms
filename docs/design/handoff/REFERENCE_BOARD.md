# Reference board (designer handoff, 2026-09-30)

Two kinds of references: **current** screenshots of the product (what exists, to be redesigned; copied into `current/`) and **external**
references (what the owner points at). Each entry says what it shows and how much of it is still true. Nothing here is a pixel spec.

> **Status 2026-10-09 (product 2.4.2):** the `current/` screenshots below were NOT re-shot; they show the 0.1.148 build (2026-09-30). Since
> then the shell gained a dark scheme, skins (classic / domus / tesla / bubble), look dials and three tab modes, and many screens were added
> (see `CHANGES_SINCE_0.1.148.md`). §1a lists the committed screenshot sets of the newer screens. A fresh capture of every screen with
> demo data at 1440 / 1024 / 390 × light / dark is still to be done (NOT_RUN in the 2026-10-09 refresh, which was code-only).

## 1. Current product screenshots (`docs/design/handoff/current/`)

Shell generations, so the chrome is read correctly:

- **UI round 1 (0.1.148, 2026-09-30, current):** no top bar; a 70 px icon rail at the inline start with a blue "S" brand tile; a round
  search + status pill floating in the content's top inline-end corner; the user avatar at the rail's foot; pill tabs under the title.
- **0.1.13x–0.1.141 (September 2026):** the same design with a white top bar (wordmark "smplwise", user chip, bell, health pill, big
  search field, breadcrumb) and a wider labelled rail. Screens shot in this generation are marked *(top-bar chrome)*: the content is
  current, the chrome is not.
- **Design B (removed in 0.1.148):** a wide white sidebar with six text items (סקירה · אתרים · מצלמות …). Only `kiosk-desktop.png` comes
  from that generation, and the kiosk has no chrome anyway.

| File | Screen | Viewport | Generation | What it shows |
|---|---|---|---|---|
| `shell-desktop-home.png` | Home (before the widget strip) | 1440×900 | current | The rail, corner search, KPI tiles, climate chips, כרטיסים/אריחים switch, tree panel, floor cards, "ללא שיוך" card |
| `shell-desktop-user-menu.png` | User menu popover | 1440 | current | Menu beside the rail's foot: header, התראות, מערכת, החשבון שלי |
| `shell-phone-home.png` | Home, phone | 390×844 | current | Compact KPI tiles in two columns, alarm tile, bottom bar |
| `shell-phone-user-menu.png` | User menu bottom sheet | 390 | current | Sheet with grab handle, header with demo pill, three items |
| `shell-desktop-search.png` | Search panel open | 1440 | current | Corner pill expanded into the search dialog with results |
| `shell-nav-size-xl-desktop.png` | Rail preset XL | 1440 | current | The largest preset (76 px items, 30 px icons) |
| `shell-desktop-status-error.png` | Health dot red + banner | 1440 | current | The system banner under the corner |
| `home-control-centre-desktop.png` | Home, direction א (control centre) | 1440 | current (home redesign) | Clock, weather + hourly forecast, Shabbat card, 7 KPI tiles, climate chips, bulk-off buttons, tree, floor cards with area tiles |
| `home-control-centre-phone.png` | Same, phone | 390 | current | Widgets as a horizontal row, tiles two-up |
| `home-edit-desktop.png` | Home edit mode | 1440 | current | Edit bar, grid handles, side panel |
| `area-smplwise-desktop.png` | Area screen, SMPLWISE style | 1440 | current | Domain cards (lighting, switches, climate, covers, security, sensors), device tiles with toggles and sliders |
| `area-smplwise-phone.png` | Area screen, phone | 390 | current | One column, sibling tabs |
| `area-camera-cards-desktop.png` | Area camera cards | 1440 | current | Snapshot cards with "צילום" pill, expand |
| `devices-glass-building-desktop.png` | Building screen, glass style, light | 1440 | top-bar chrome | Glass panels over the gradient backdrop, pill segmented control, blue accent |
| `devices-glass-area-desktop.png` | Area screen, glass, light | 1440 | top-bar chrome | Glass domain cards, icon rings, glow on lit tiles |
| `devices-glass-area-dark-desktop.png` | Area screen, glass, **dark** | 1440 | top-bar chrome | The only dark surface in the product today; the white shell around it shows why a system-wide dark mode is needed |
| `devices-glass-area-phone.png` | Area screen, glass, phone | 390 | top-bar chrome | Glass on a phone |
| `devices-theme-picker.png` | Settings › theme swatches | 1440 | top-bar chrome | Four palettes with light/dark previews and the role dots |
| `security-live-overview-desktop.png` | Security › לייב › תמונת מצב | 1440 | current | Sections segmented control + pill tabs, greeting title, KPI tiles with a red count badge, storage ring, site health list, recent events, attention list |
| `security-live-overview-phone.png` | Same, phone | 390 | current | Section row + underline tabs |
| `live-wall-desktop.png` | Live wall, 11 snapshot tiles | 1440 | current | Quality select, count segmented 1–32, "קיוסק", tiles with name + dot, columns chooser, facts line |
| `live-wall-phone.png` | Live wall, phone | 390 | current | Auto columns on a phone |
| `live-camera-desktop.png` | Single camera | 1440 | top-bar chrome | Back control, player, facts |
| `investigate-playback-desktop.png` | Playback / timeline | 1440 | top-bar chrome | Camera + date + time fields, compare pills, counts chips, dark player with speed pills, timeline with zoom pills, legend |
| `investigate-events-desktop.png` | Event centre (operator) | 1440 | top-bar chrome | Filters and event rows |
| `investigate-history-map-desktop.png` | Historical map | 1440 | top-bar chrome | Plan with a time scrubber |
| `alarm-desktop.png` / `alarm-phone.png` | Intrusion alarm | 1440 / 390 | current | Panel state, arm/disarm, zones list |
| `map-2d-desktop.png` / `map-2d-phone.png` | Live floor map | 1440 / 390 | current | Toolbar with layer toggles and 3D switch, thin-line plan, camera pins with FOV cones, entity pins, zoom, legend, floor chip |
| `map-3d-desktop.png` | Live floor map, 3D | 1440 | top-bar chrome | The isometric scene inside the map screen |
| `plan-3d-iso-state.png` | 3D scene, level 2, state tint | scene only | current renderer | Cutaway walls, lit rooms in warm tint, presence blue, door markers |
| `plan-editor-desktop.png` | Plan Studio editor | 1440 | top-bar chrome | Object library, layers, handles, editor bar |
| `schedules-list-desktop.png` / `schedules-list-phone.png` | Schedules list (cards) | 1440 / 390 | current | Summary strip, cards with 24 h bars and day chips |
| `schedules-editor-week-desktop.png` | Schedule editor, week grid | 1440 | current | 7×24 grid, slot panel, side panel |
| `schedules-editor-day-phone.png` | Schedule editor, phone day view | 390 | current | Vertical day axis, two tabs |
| `state-empty-desktop.png` / `state-view-only-desktop.png` | Empty and view-only states | 1440 | current | `sw-state-panel` and the read-only variant of a list |
| `settings-general-desktop.png` | Settings › כללי | 1440 | top-bar chrome | Underline tabs, section cards with fields and שמור |
| `settings-access-desktop.png` | Settings › roles and permissions | 1440 | top-bar chrome | Roles table, permission preview |
| `settings-tabs-editor-desktop.png` | Settings › לשוניות | 1440 | current | Show / hide / reorder per section |
| `settings-notifications-desktop.png` | Notifications (personal) | 1440 | current | Push on/off |
| `wizard-desktop.png` / `wizard-phone.png` | Setup wizard | 1440 / 390 | top-bar chrome | Steps header, check cards |
| `wiskey-embed-desktop.png` / `wiskey-embed-phone.png` | WisKey embed | 1440 / 390 | current | The third-party panel inside our chrome (rail + tab row); its own visual language |
| `kiosk-desktop.png` | Kiosk wall | 1440 | design B era (no chrome) | Full-screen grid, tile names, wordmark |
| `login-desktop.png` / `login-phone.png` | Remote sign-in | 1440 / 390 | current | Wordmark, fields, Hebrew copy |
| `pwa-install-phone.png` | PWA install banner | 390 | current | Install prompt |
| `mockup-home-a-desktop.png` | Home mockup, direction א | 1440 | mockup (branch `pilot/home-mockup`) | The approved control-centre direction before implementation |
| `mockup-area-a-desktop.png` | Area mockup, direction א dense tiles | 1440 | mockup | Sections flowing into columns, one-line device tiles, four primary sensors |
| `mockup-media-screens-desktop.png` | Media "מסכים" mockup | 1440 | mockup (branch `pilot/media-mockup`, decisions pending) | New area, screen cards per floor, power / volume / source / שלט |
| `mockup-media-remote-desktop.png` | TV remote mockup (Samsung profile) | 1440 | mockup | Side-panel remote: d-pad, back/home/menu, volume, channels, sources and apps tabs, "עוד מקשים" |

More screenshots (all states, three viewports) live under `docs/evidence/` (438 PNGs); the most useful sets: `UIR1-*` (UI round 1, current),
`CR014-s3`, `CR014-s4` (schedules, every state), `CR010` (alarm, three viewports), `T025` (glass), `T087/visual` (3D levels and cameras),
`T007/screens` (every SC screen in three viewports, design B chrome), `docs/user-guide/he/img` (live-system captures, 0.1.141, redacted).

## 1a. Screenshot sets of screens added after 0.1.148 (committed under `docs/evidence/`, added 2026-10-09)

These were captured by the feature work (demo or fixture data, three viewports, often light and dark). They are evidence of the build or
of the approved mockup at the time of the feature, not a curated board; the chrome around them is whatever the build had that day.

| Folder | Screen(s) | Kind |
|---|---|---|
| `docs/evidence/electricity-mockup/` (155) | Infrastructure › electricity meters, meter, accounts, bills, settings | approved mockup, light / dark, 1440 / 390 |
| `docs/evidence/electricity-pdf/`, `electricity-pdf-addon-image/png/` | Electricity bill paper / PDF pages | build |
| `docs/evidence/generator/` (135) | Infrastructure › generator: live, charts, alerts, settings | build, desktop / tablet / mobile × light / dark |
| `docs/evidence/automations-mockup/` (58) | Automations / scenes / scripts list and editors ("קברניט") | approved mockup, light / dark |
| `docs/evidence/notifications-mockup/` (40) | Notification centre and detail | approved mockup, light / dark |
| `docs/evidence/media-mockup/` (57), `media-players-mockup/` (22) | Multimedia: screens, TV remote profiles, players, groups | approved mockup |
| `docs/evidence/CR-019/` | Settings › protected switches review (approve / protect / unprotect dialogs, loading, forbidden, empty) | build, 1440 / 820 / 390 |
| `docs/evidence/CR-020-s1/`, `CR-020-s2/`, `CR-020-encoding/` | Settings › security › cameras: NVR camera list, camera editor, batch encoding checklist | build, demo / empty / error, dark |
| `docs/evidence/tabs-dropdown/`, `dropdown-capsule/`, `sync-dropdown/`, `compare-dropdown/`, `sync-polish/` | The three tab modes (tabs / dropdown / hybrid) and the dropdown styles at phone and desktop widths | build, light / dark |
| `docs/evidence/investigate-map-improvements/` | Historical map and investigation map improvements (before / after) | build |
| `docs/evidence/live-count/` | Live wall tile counts and the columns chooser | build |
| `docs/evidence/0.1.149-area-row/` | Home area row (0.1.149) | build |
| `docs/evidence/CR-030-WDX/`, `docs/design/mockups/wall-display/screens/` | Wall display (fixed tablets): frame, alert takeover, settings drawer, login | build + mockup |
| `docs/design/mockups/{automations,electricity,generator,media,notifications}/index.html` | The approved HTML mockups of the new areas | mockup (static HTML) |
| `docs/design/mockups/bubble-taste/screens/` | The Bubble skin taste board | mockup |
| `docs/design/compare/dropdown-styles/`, `material-dials/` | Dropdown style comparison, material / depth / tint dials | comparison boards |

## 2. External references

| Reference | Where | What to take | What NOT to take |
|---|---|---|---|
| **DomusUI** (open-source HA dashboard, GPL-3.0) | `docs/integrations/domusui/DOMUSUI_EXTRACTION.md` §3 (screens) and §5 (design system facts); owner screenshots were in a chat session only | The canvas-and-glass feel: a wallpaper-like backdrop, "liquid glass" panels (`blur(28px) saturate(1.72)`, alpha surfaces, `0 22px 60px` shadows, 1.25–2 rem radii, nested glass without blur, opaque fallback); big page titles (2 → 3 rem, 700) that compact on scroll; the horizontally scrolling **room row** next to the title; the **floor button** (icon + floor name + chevron) opening a floor layer with floor cards; iOS system colours with a light and a dark theme; iOS-style **segmented controls** and pills; card header anatomy (icon toggle · title/status · secondary button); glass bottom sheet on phones / centred dialog from `sm`; `min-h-11` (44 px) bottom-bar targets; container-query card sizes; reduced-transparency and high-contrast handling | Its **top / side navigation and mobile drawer** (we have a side rail; no top nav bar); the Italian / English copy; MJPEG camera stills (our tiles are WebRTC/MSE or snapshots); the absence of RTL (237 physical-direction utilities: everything must be re-thought logically); the absence of bulk actions and of a whole-building view (we have both); browser-side lock code; any code, CSS, SVG or copy (licence) |
| **UniFi Protect-like boards** (the three original concept boards) | `docs/design/reference/mockups/01_core_vms_screens.png`, `02_ai_mobile_operations.png`, `03_security_admin_system.png`; `docs/design/reference/README.md`, `DESIGN_SYSTEM_SEED.md` | The security-side patterns the owner still likes: photo-like camera tiles with name + green dot, floating video controls, thin-line floor plans with bare blue pins and a floating camera card, the blue activity timeline, thumbnails and avatars in tables, pill tabs, restrained blue, hairline dividers, compact information density | Their flat white six-item sidebar and top search (superseded); fictitious data and labels; they are not pixel specs |
| **SW A 50-screen handoff (v1.3)** | `docs/design/mockups-v1.3/SMPLWISE_50_DESIGN_HANDOFF_HE.txt` (tokens, shell geometry, map contract, M01–M50), `key-screens/*.jpg` (12 downscaled screens); full PNGs with the owner | The current implemented language (what the screenshots above show): four-area shell, 26 px H1, 12–14 px radii, `#2767ed` accent, map contract (bearing 0° = up, clockwise), the M-numbered screen structures | Its top bar (removed), its exact palette (to be replaced by the new direction) |
| **3D dashboard inspiration** (Facebook HA-group post, Mihail Panayotov, 2026-09-28) | memory note `reference-3d-dashboard-inspiration.md` (no image in the repo); CR-006 | Dark sky-gradient backdrop, isometric camera, cutaway walls, soft lighting, floor thumbnails as a switcher, warm room fill when lit, time-decaying presence tint, red door/window markers, per-room temperature chips | Pre-rendered 3ds Max imagery as the mechanism (ours is real-time three.js from detected geometry; renders are an optional skin) |
| **Scheduler mockup (CR-014)** | `docs/design/mockups/scheduler/index.html`, `screens/01–26` | The approved structure of the schedules list, editor, create dialog, states | Its visual skin (SW A light) |
| **Home / area mockup (owner decisions 2026-09-30)** | branch `pilot/home-mockup`: `docs/design/mockups/home/index.html`, `docs/design/home-mockup-decisions-HE.md`; copies above | Directions א/ב/ג for the home, א/ב for the area, widget sizes, rail sizes table | — |
| **Media / TV remote mockup (0.1.149)** | branch `pilot/media-mockup`: `docs/design/mockups/media/index.html`, `decisions-HE.md` (12 open owner questions), `docs/evidence/media-mockup/01–17` | The structure of screen cards and the remote; the "only supported keys" rule | Anything the owner has not answered yet (placement, permissions, public screens) |

## 3. Owner decisions that shape the visual direction (dated)

- 2026-09-14: light / blue design; the three boards as the yardstick ("much more like UniFi").
- 2026-09-16: SW A 50-screen package becomes the product default.
- 2026-09-28: CR-007 approved from the 6-board mockup; "SMPLWISE has a side rail, not a top bar - never design a top nav bar".
- 2026-09-29: glass style "approved as a start, not the peak; document everything so a designer can add themes"; no Home Assistant
  naming outside settings; "show as little as possible" on operator screens (no hints, badges, paragraphs; short confirmations).
- 2026-09-30: home = control centre (direction א) default with ב/ג selectable; rail default large (96 px in the mockup's table; the code's
  `NAV_DEFAULT` is still preset "m" - the change is pending) but never forced; alarm tab always when a panel exists; design B removed; UI round 1 (no top bar, corner search).
- 2026-09-30 (this handoff): scope = the whole system; direction = "hi-tech Domus"; light and dark from day one; redesign after the
  current development ends (~2 weeks).
