# Component inventory (designer handoff, 2026-09-30)

Every shared `sw-*` element in `frontend/src/components/`, the shell's own elements (`frontend/src/shell/`) and the recurring screen-level
patterns. Sizes are the CURRENT implementation (design "SW A", tokens v2 in `frontend/src/styles/tokens.css`); they are facts to start
from, not limits. The designer redraws each component in every listed state, light and dark, RTL (the product default) with the LTR
mirror where the notes say so. Read together with `TOKEN_CONTRACT.md`.

Counts: **30 files / 33 custom elements** in `components/` (`sw-schedule-bar.ts` defines four), **4 shell elements** (`sw-app`, `sw-user-menu`, `sw-nav-order`, `sw-wiskey-prefs`) plus the `screen-edit` registry, and about **20
screen-level patterns** listed in §3.

RTL rule that applies to everything: the shell, text, lists, forms, panels and icons with a direction (chevrons) mirror in LTR; **video,
map / plan geometry, the 3D scene, the recording timeline and the 24 h schedule axis never mirror** (time and space run left → right in
both directions by decision).

## 1. Shared components (`frontend/src/components/`)

| Element | What it is | Looks-changing props / variants | States to design | Where used | RTL / notes |
|---|---|---|---|---|---|
| `sw-page` | Page frame: optional breadcrumb, H1 (26 px / 700 / −0.6 px tracking), grey one-line subtitle, actions slot at the inline end, optional always-visible back control (`backHref`) for drill-down screens; `wide`, `flush` | crumbs / no crumbs; back / no back; wide; flush | default; with actions; with back | every screen | Back chevron mirrors (`chevronBack`). Page padding token `--sw-page-pad` 30 px (phone smaller) |
| `sw-card` | White surface with hairline border, radius `--sw-r-lg`, optional heading / subheading; `flush` (no padding), `interactive` (hover tint, pointer) | heading / none; flush; interactive | rest; hover (interactive); focus-within | everywhere | — |
| `sw-kpi` | Stat tile: icon in a soft square, big value (tabular figures), label, optional detail line, badge, `tone` (state colour), `layout` cards (tall, icon above) or compact (icon at inline-start, value + label on one line, ≥ 60 px tall, whole tile is the target), can be a link (`href`) or a button (`action`, `aria-expanded`) | tone: neutral / live / recorded / stale / offline / forbidden / error / partial; layout cards / compact; icon-end | rest; hover; focus ring; expanded; badge ("3 חדשים"); long label ellipsis | home KPIs, live overview, floor counters | Icon side flips with direction. Knobs `--sw-kpi-compact-*` (from `--dv-kpi-*` / `--lv-tile-*`) |
| `sw-button` | Button: `variant` primary (blue fill) / secondary (white, border) / ghost / danger (red outline or fill); `size` sm 26 px / md 30 px / lg 36 px; optional icon; `iconOnly`; `round` (50 %) | 4 variants × 3 sizes; icon + label / icon only / round | rest; hover; active; focus ring; disabled; loading (**UNKNOWN**: no spinner today) | everywhere | Icon before the label in reading order |
| `sw-chip` | Filter / selection chip, 28 px, radius 8 px, optional icon, count, coloured dot; `selected` | selected / unselected; with count; with dot; with icon | rest; hover; selected; focus; disabled (**UNKNOWN**) | filters, sibling-area tabs, climate chips, compare pills | Dot at inline-start |
| `sw-badge` | State pill (radius pill, 1×8 px padding, 11 px text) with a dot; `kind` = live · recorded · historic · offline · stale · unknown · forbidden · error · partial · neutral; `onImage` (over video: dark scrim) | 10 kinds; on image | as listed; on image | tiles, tables, lists, headers | Text always present (never colour alone) |
| `sw-toggle` | Switch 24 px high, 18 px thumb, pill track; label or `labelHidden`; `checked`, `disabled` | on / off; with / without label | rest; on; off; disabled; focus | device tiles, settings | Thumb travels toward the inline end when on (mirrors in LTR) |
| `sw-tabs` | Tab row: pill style (light track, 2 px inset, active = white pill with blue text, 5×12 px items) or `underline` (settings / phone: thin blue underline), or `segmented` | pill / underline / segmented; scrollable overflow | rest; active; hover; focus; overflow scroll with edge fade | area tab rows, settings tabs, view switches | First tab at the inline start; horizontal scroll follows direction |
| `sw-field` | Labelled form field wrapper: label, slotted control (input / select / textarea), hint; `inline` | stacked / inline | rest; focus; error (**UNKNOWN**: no error prop today); disabled; read-only | settings, editors, dialogs | Label at inline-start |
| `sw-dialog` | Centred modal ≤ 440 px wide for short forms and confirmations; heading, subheading, ✕, Escape / backdrop close; `locked` (no dismiss) | small / locked | open; locked; with form; confirmation (one question + two buttons + collapsed "פרטים") | bulk off, split day, keypad, tab order, save conflicts | Close ✕ at the inline end |
| `sw-drawer` | Context drawer: side panel of `--sw-drawer-w` 360 px at the inline START (right in RTL) on desktop / tablet, bottom sheet with a 40 px grab handle on the phone; `modal` variant (480 px, top layer, focus trapped, dimmed backdrop) | side panel / bottom sheet / modal | closed; open; scrolling body; nested confirmation inside | map camera preview, entity controls, schedule details, tiles panel, layout panel | Never covers the whole map |
| `sw-popover` | Floating 268 px card anchored to a map marker (heading, picture, "Watch live" button), flips to stay in the stage | — | rest; flipped | floor map | Positioned in stage pixels (geometry, not text) |
| `sw-state-panel` | Non-ready state block: icon + title + hint + optional action button; `state` loading · empty · error · forbidden · stale · partial; `compact` | 6 states; compact | as listed | every screen, the gates | Copy rules: short title, one hint line, no platform names |
| `sw-table` | Data table: white card, quiet grey header, 40 px rows (`dense` smaller), thumbnails / avatars via column renderers, hover tint, selected row soft blue, `emptyText`; wide tables scroll horizontally inside | dense; with selection; with thumbnails | rest; hover; selected; empty; loading (**UNKNOWN**: no skeleton) | cases, exports, audit, users, catalogue, health, schedules table | Column order follows direction; numbers stay LTR |
| `sw-camera-tile` | Camera tile: picture (snapshot / live player / illustrated scene tagged "דמו"), name + green dot at the bottom-start corner, state pill at the top when not live, "צילום" pill when snapshot-only; `compact`, `dark`, `selected`, `fit` contain / cover / fill | live / snapshot / demo; compact; selected | live; snapshot; connecting; offline (grey card + icon + reason); forbidden; unknown; stale; selected; hover controls | live wall, kiosk, overview, saved views, area camera card | Overlay text at the inline start; the picture never mirrors |
| `sw-live-player` | Video element with the WebRTC → MSE plan, poster until the first frame, badge (`main·WebRTC`), fallback notice, reconnect back-off, remote cap message, recorded mode with buffer control | compact; fit | poster; connecting; playing; fallback announced; undecodable; cap reached (no retry); reconnecting; error | single camera, wall tiles, playback, kiosk | Controls overlay floats; picture never mirrors |
| `sw-timeline` | Recording timeline: activity bars (taller where clips exist), event dots by type, case bookmark flags, blue cursor with time bubble, ticks, gaps left empty, zoom דקה … יום, precision label (verified / keyframe-limited / estimated / unknown), follow mode | precision; zoom window; with bookmarks | rest; scrubbing; following; gap; no data | playback, sync | Time runs left → right in RTL too |
| `sw-week-grid` | 7 × 24 hourly cells painted with the mouse in a mode (recording modes CMR / MOTION / EDR, or arming); `editable` | modes palette; editable / read-only | rest; painting; read-only | NVR recording schedule, arming schedule | Sunday first at the inline start; hours LTR |
| `sw-schedule-grid` | The 24 h scheduler: week rows or one day, slots as bars (thick start edge), point actions as pins, drag create / move / resize with snap (15 min), keyboard (arrows, Shift / Ctrl + arrows, Delete, Enter), `orientation` horizontal / vertical (phone), sun times, "now" line, selection | horizontal / vertical; compact; editable | rest; selected slot; dragging preview; locked slot; conflict; read-only | schedule editor (H5) | Axis LTR by decision inside the RTL page |
| `sw-schedule-bar` | A schedule's slots on a 24 h strip (coloured span per slot, pin for a point, "now" line); `compact` | compact | rest; with now line | schedule cards, drawer, editor header | Axis LTR |
| `sw-day-chips` | Seven day chips, Sunday first; `workday` / `weekend` collapse to a word; `compact` | compact | active days / inactive | schedule cards, editor | Sunday at the inline start |
| `schedule-condition-chip` | Condition badge ("רק בשבת ובחג", "בתנאי: …") | compact | present / absent | schedule list, editor | — |
| `sw-schedule-markers` | Sensitive / lowering ("פותח / מנטרל") markers | — | sensitive; lowering; both | schedule list, editor | — |
| `sw-steps` | Wizard progress: numbered circles with labels, connected by lines; `current` | — | done; current; upcoming | setup wizard, plan import | Steps run inline-start → end |
| `sw-icon` | 24 px stroke icon set (1.8 px, round caps), 86 names; `flip`; chevrons auto-mirror in RTL | size | — | everywhere | Only `chevron` / `chevronBack` mirror |
| `sw-avatar` | Initials avatar, `size` | size | rest; with alert dot (shell adds it) | rail foot, bottom bar, user menu, tables | — |
| `sw-scene` | Illustrated placeholder scenes (12 kinds: entrance, lobby, corridor, hall, parking, warehouse, backyard, driveway, night, building, house, none) for demo tiles | kind | — | demo tiles, site cards | Drawn; never a customer frame |
| `sw-floor-glyph` | Isometric floor-stack glyph with one highlighted slab; `levels`, `active`, `selected` | size | selected / not | floor lists, tree | Geometry: no mirror |
| `sw-floor-iso` | Isometric floor thumbnail from the published structure (real iso) or room rectangles (demo); selected tinted blue; empty = dashed slab | width; selected; empty | real / demo / empty; selected | floor browser, home tree | Geometry: no mirror |
| `sw-case-picker` | "הוסף לתיק" dialog: pick or create a case, add an event / clip / note | — | list; create; saving; error | events, playback | — |
| `sw-share-members` | Members list of a shared space with הסר / הוסף | — | read-only; editable; empty | floor map (CR-009) | — |
| `sw-remote-sessions` | Remote sign-ins list (browser · system, masked address, times, live count), per-row revoke or "התנתק מכל המקומות"; `scope` own / all; `compact` | own / all; compact | loading; empty; rows; current row marked; revoking | user menu › הכניסות שלי, הגדרות › גישה מרחוק | Addresses LTR |
| `sw-csp-reports` | CSP report counters and the enforce switch (admin) | — | empty; counters; switch disabled while reports exist | הגדרות › גישה מרחוק | Technical; settings only |

## 2. Shell elements (`frontend/src/shell/`)

| Element / pattern | What it is | Variants | States | Notes |
|---|---|---|---|---|
| `sw-app` rail | Vertical rail at the inline start: brand tile (blue square "S", 32 px), area items (icon over label; item height and icon size from the nav-size preset: s 46/18, m 52/20, l 64/25, xl 76/30; free 36–96 / 14–40; labels optional), spacer, avatar button with alert dot. Active item: accent-soft fill + 3 px accent bar at the start edge | presets s / m / l / xl / free; 2–4 items; labels on / off | rest; hover; active; focus; alert dot | Never a top bar. Rail width = widest label, never clipped |
| `sw-app` bottom bar (phone) | Same areas as a bottom bar ≥ 44 px high (icon in a pill when active, label under it), avatar last | presets | active; alert dot | `--sw-bottomnav-h` 50 px today (m) |
| `sw-app` corner float | Round white pill group at the top inline-end corner: search button + health dot; the search opens a panel (input + results grouped: pages, rooms, cameras, floors, entities) with a scrim | dot ok / warning / error | closed; open; results; empty | Replaces the removed top bar; must not collide with the page title on the phone |
| `sw-app` sections (security) | Segmented control לייב · חקירה · אזעקה: pills with icon + label on desktop (in the subnav row before the tabs); on the phone a slim sticky text row above the underline tabs | 2–3 sections | active; hover | Three levels: area (rail) › section (segmented) › page (tabs) |
| `sw-app` banners | System error banner (`role=alert`, warning icon, labels, link), setup hint (info icon, bold text, link, dismiss ✕), permission toast (bottom, `role=status`) | — | shown / dismissed | Keep to one line |
| `sw-user-menu` | Popover (D/T, beside the rail foot) or bottom sheet (P): header (avatar, name, role, pills), items with round icon tiles (התראות with count chip, screen edit actions, מערכת, החשבון שלי ›), destructive יציאה at the foot; level 2 "החשבון שלי" (סדר הלשוניות, הגדרות התראות, הכניסות שלי, החלף שרת) with a back row | popover / sheet; with / without settings; with edit actions | level 1; level 2; alerts 0 / n / 99+ | No explanatory text anywhere in the menu |
| `sw-nav-order` | Dialog: vertical list of the rail areas with drag handles, ▲ / ▼ buttons, arrow keys; שמור / איפוס | — | rest; dragging; dirty | — |
| `sw-wiskey-prefs` | WisKey start choices (overview density, wall streams) in the account level | — | — | — |
| `screen-edit` registry | A screen registers its edit mode (label + icon); the user menu shows it while the permission holds and the screen is not already editing | "עריכת המסך הראשי", "עריכת פריסה", "עריכת המפה", "סידור הקיר" | — | Entry points to edit modes live ONLY here |

## 3. Screen-level patterns (recurring, to be designed once)

| Pattern | Where | What it does today | States |
|---|---|---|---|
| Breadcrumb header | every page | `sw-page` crumbs "אזור › (section ›) page" as small grey text above the H1, then the subtitle; a back chevron on drill-downs | — |
| Status dot | tiles, tree rows, lists, corner | 6–7 px round dot in a state colour, always next to text (live green, stale amber, offline grey, forbidden red, unknown light grey; the corner dot uses ok / warning / error) | — |
| Cards vs tiles | home (כרטיסים / אריחים), schedules (cards / table / week) | A segmented view switch; the choice is remembered per browser (home) | — |
| KPI tile strip | home, live overview | 4–7 `sw-kpi` in a row (auto-fill; one row from 1024 px), compact 2-column grid on the phone | tall / compact |
| Widget strip (home) | H1 | Clock, weather + forecast, Hebrew calendar / Shabbat, alarm (display), quick actions; small / medium / large; direction א/ב/ג; unavailable widget takes no space (dashed frame only in edit) | 3 sizes × 3 directions |
| Domain card (area) | H2 | Card header (title, "n התקנים · m פעילים", domain icon badge at the end), device tiles in 1–2 columns, per-section "כבה הכל" | empty domain not drawn; read-only; glass |
| Device tile | H2, tiles panel | Icon ring (36 px) at the start, name, state line, control at the end (toggle / slider / stepper / open-stop-close / segmented); "on" glow (warm for areas, cool for lights, green for switches); unavailable = grey, control disabled, reason only in `title` | on / off / unavailable / unknown / pending (optimistic) |
| Master control | tiles panel, sections | 44 px round icon-only button: accent outline when all off, filled when any on, count badge when some; covers get open + close, locks one lock icon | off / on / partial |
| Bulk-off confirmation | H1, H2, media (planned) | `sw-dialog`: one question with the count, two buttons (danger primary), collapsed "פרטים" with the eligibility list; afterwards honest per-device outcomes; locks and alarm never in bulk | confirm / running / results |
| Bulk popover | H1 tree ⋯ | Small popover anchored to the row's ⋯ with the area / floor actions | — |
| Edit mode bar | H1 / H2 layout editor, wall arrange, plan editor | Sticky bar replacing the tab row: variant switch (מחשב / טלפון), בטל, חזור לאוטומטי, אפס לברירת מחדל, העתק לכל האזורים, שמור; 409 conflict → "טען מחדש"; breadcrumb "כל הכרטיסים › card · סידור התקנים" in the tiles stage | dirty / saving / conflict |
| Edit side panel | layout editor | Side panel (bottom sheet on the phone): title, icon picker, text size s/m/l, background and border role (7 roles, never a raw colour), width / height, move / resize buttons, "מוסתר לכולם", visible-entities checklist | — |
| Grid handles | layout editor | Card drag handle, corner resize handle, selection outline; a covered card moves down; 12 columns desktop / 4 phone, 8 px rows | selected / dragging |
| Sibling tabs | H2 | Pill tabs of the floor's areas with counts, "מחסן (0)" style | active |
| Climate chip strip | H1 | Warm-soft chips "מזגן לובי · קירור · 22°" | — |
| Segmented control (iOS style) | glass toolbar, sections, view switches | Pill track with a white / raised thumb (3 px inset in glass) | — |
| Tree panel | H1 | Building › floors › areas with lit-count column (44 px) and ⋯ column (30 px), sticky, scrolls inside when taller than the viewport, 270–340 px wide | selected row; narrowed |
| Floor card | H1 | Header (floor name, lit-count pill), area rows (dot, name, domain counters), floor climate chips, "פתח קומה" | — |
| Area tile | H1 אריחים | Tile with icon badge (40 px), name, counters; warm glow when something is on; hover lift −2 px | on / off |
| Camera card (area) | H2 | Snapshot with "צילום" pill, name, state, expand → live; picker to choose cameras; forbidden / loading / error frames | snapshot / live / expanded / forbidden / loading / error |
| Alarm panel card | S15, H1 widget | Large state word ("דרוכה (בית)"), partition chips, arm / disarm buttons, keypad dialog with 44 px keys | 6 panel states |
| Schedule card | H4 | Name, `sw-schedule-bar`, `sw-day-chips`, condition chip, markers, enabled toggle, ⋯ | enabled / disabled / stale / view-only |
| Slot panel | H5 | Side panel: hours (from / to), actions and arguments, "כיבוי בסיום החלון", copy to days | locked / unsupported |
| Entity picker | H5, planned editors | Searchable tree of floors › areas › devices with checkboxes and domain filters | empty / filtered |
| Lowering dialog | H5 | Confirmation for a sensitive (disarm / unlock) action in a schedule | — |
| Keypad | S15 | Code entry dialog, 3×4 keys ≥ 44 px, masked digits | error |
| Search panel | corner | Input with placeholder, grouped results with subtitles, keyboard navigation | empty / results |
| Wizard step | G7 | `sw-steps` header, step card with check result (ok / problem / action button), next / back | — |
| Settings section | G1 | Card per section with fields, "שמור" at the end, dirty indicator, saved confirmation | dirty / saved / error |
| Theme swatch | G1 | Palette swatch (light + dark preview and the 7 role dots), selected ring | selected |
| Table + drawer | G3, G5, G9, S11 | `sw-table` with a detail drawer at the inline start | — |
| Legend | map, timeline, week grid | Dots + words in a small pill row at the canvas corner | — |
| Demo pill | shell | "נתוני הדגמה" neutral badge | — |

## 4. Illustration and imagery rules

- Camera tiles show a real snapshot or stream when one exists; otherwise the `sw-scene` illustration with a "דמו" tag. No fake frames,
  no customer imagery in the public repository.
- Plans are rendered by the product (thin lines, `--sw-map-*` colours); imported drawings are normalised, never shown as raster truth.
- The 3D scene: sky-gradient backdrop, isometric / perspective / top cameras, cutaway walls, warm room tint when lit, blue presence tint
  that fades, red open-door markers, temperature chips. Level 1 (flat) and level 2 (lit) exist.
- Icons: one stroke set (`sw-icon`), never mixed with a filled set inside one screen. WisKey's frame keeps its own icons.
