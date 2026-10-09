# Component inventory (designer handoff, 2026-09-30; refreshed 2026-10-09 for product 2.4.2)

Every shared element in `frontend/src/components/`, the shell's own elements (`frontend/src/shell/`), the feature families outside
`components/` (wall, map, electricity, generator) and the recurring screen-level patterns. Sizes are the CURRENT implementation of the
**classic** skin (tokens in `frontend/src/design/tokens.ts`; the old `styles/tokens.css` is deleted); they are facts to start from, not
limits. The designer redraws each component in every listed state, light and dark, RTL (the product default) with the LTR mirror where
the notes say so. Read together with `TOKEN_CONTRACT.md`.

**Refresh 2026-10-09** (code of `main` @ `31fe5d7c`, product 2.4.2, compared with release 0.1.148.1 @ `1fab444b`): rows of §1 that changed
carry **CHANGED (2.4.2)**; everything in §1a, §2a and §3a is **NEW** since 0.1.148.

Counts now: **105 files / 85 custom elements** in `components/` (0.1.148: 30 / 33; `sw-schedule-bar.ts` defines four,
`sw-second-factor.ts` three; 52 elements are new, several without the `sw-` prefix), **5 shell elements** (`sw-app`, `sw-user-menu`,
`sw-nav-order`, `sw-wiskey-prefs`, `sw-home-personal`) plus the `screen-edit` and `screen-view` registries, `sw-wall` (wall display),
`sw-floor-image-align` + `sw-plan-canvas` + `sw-plan-3d` (map), 22 electricity elements, 6 generator elements, and 119 screen elements in
`screens/` (50 of them in files added since 0.1.148). Unchanged gaps: `sw-button` still has no loading / spinner state, `sw-field` no error
prop, `sw-table` no loading skeleton. `sw-floor-glyph` has no usage left in the code (possibly dead).

RTL rule that applies to everything: the shell, text, lists, forms, panels and icons with a direction (chevrons) mirror in LTR; **video,
map / plan geometry, the 3D scene, the recording timeline and the 24 h schedule axis never mirror** (time and space run left → right in
both directions by decision).

## 1. Shared components that existed in 0.1.148 (`frontend/src/components/`)

| Element | What it is | Looks-changing props / variants | States to design | Where used | RTL / notes |
|---|---|---|---|---|---|
| `sw-page` | Page frame: optional breadcrumb, H1 (26 px / 700 / −0.6 px tracking), grey one-line subtitle, actions slot at the inline end, optional always-visible back control (`backHref`) for drill-down screens; `wide`, `flush` | crumbs / no crumbs; back / no back; wide; flush | default; with actions; with back | every screen | Back chevron mirrors (`chevronBack`). Page padding token `--sw-page-pad` 30 px (phone smaller) **CHANGED (2.4.2):** the title row (H1 + back) is drawn only when `heading` or `backHref` is set, so a page can have no H1 row; the header text block cannot be widened by a scrolling chip row in `crumbs` on the phone. |
| `sw-card` | White surface with hairline border, radius `--sw-r-lg`, optional heading / subheading; `flush` (no padding), `interactive` (hover tint, pointer) | heading / none; flush; interactive | rest; hover (interactive); focus-within | everywhere | — |
| `sw-kpi` | Stat tile: icon in a soft square, big value (tabular figures), label, optional detail line, badge, `tone` (state colour), `layout` cards (tall, icon above) or compact (icon at inline-start, value + label on one line, ≥ 60 px tall, whole tile is the target), can be a link (`href`) or a button (`action`, `aria-expanded`) | tone: neutral / live / recorded / stale / offline / forbidden / error / partial; layout cards / compact; icon-end | rest; hover; focus ring; expanded; badge ("3 חדשים"); long label ellipsis | home KPIs, live overview, floor counters | Icon side flips with direction. Knobs `--sw-kpi-compact-*` (from `--dv-kpi-*` / `--lv-tile-*`) **CHANGED (2.4.2):** state greens / ambers now come from `--sw-success-text` / `--sw-warning-text`. |
| `sw-button` | Button: `variant` primary (blue fill) / secondary (white, border) / ghost / danger (red outline or fill); `size` sm 26 px / md 30 px / lg 36 px; optional icon; `iconOnly`; `round` (50 %) | 4 variants × 3 sizes; icon + label / icon only / round | rest; hover; active; focus ring; disabled; loading (**UNKNOWN**: no spinner today) | everywhere | Icon before the label in reading order |
| `sw-chip` | Filter / selection chip, 28 px, radius 8 px, optional icon, count, coloured dot; `selected` | selected / unselected; with count; with dot; with icon | rest; hover; selected; focus; disabled (**UNKNOWN**) | filters, sibling-area tabs, climate chips, compare pills | Dot at inline-start **CHANGED (2.4.2):** new `disabled` prop (text-3, opacity 0.7, no hover) - a camera of another recorder, a comparison at its limit. |
| `sw-badge` | State pill (radius pill, 1×8 px padding, 11 px text) with a dot; `kind` = live · recorded · historic · offline · stale · unknown · forbidden · error · partial · neutral; `onImage` (over video: dark scrim) | 10 kinds; on image | as listed; on image | tiles, tables, lists, headers | Text always present (never colour alone) **CHANGED (2.4.2):** text colours from the new `--sw-*-text` tokens. |
| `sw-toggle` | Switch 24 px high, 18 px thumb, pill track; label or `labelHidden`; `checked`, `disabled` | on / off; with / without label | rest; on; off; disabled; focus | device tiles, settings | Thumb travels toward the inline end when on (mirrors in LTR) |
| `sw-tabs` | Tab row: pill style (light track, 2 px inset, active = white pill with blue text, 5×12 px items) or `underline` (settings / phone: thin blue underline), or `segmented` | pill / underline / segmented; scrollable overflow | rest; active; hover; focus; overflow scroll with edge fade | area tab rows, settings tabs, view switches | First tab at the inline start; horizontal scroll follows direction **CHANGED (2.4.2):** variants are now `pill` / `underline` / `underline-compact` / `dropdown`; new `adaptive` (hybrid: > 3 items become a dropdown), `block`, `group-label`, `dd-style` / `dd-size` / `dd-ring` / `dd-panel` (passed to `sw-dropdown`); items gain `alert` (dot / warn), `icon` and `divider` (capsule style). Dropdown mode = a 32 px chip with a 44 px hit area in a 40 px row. The mode per tab group comes from `shell/tabs-mode.ts`. |
| `sw-field` | Labelled form field wrapper: label, slotted control (input / select / textarea), hint; `inline` | stacked / inline | rest; focus; error (**UNKNOWN**: no error prop today); disabled; read-only | settings, editors, dialogs | Label at inline-start |
| `sw-dialog` | Centred modal ≤ 440 px wide for short forms and confirmations; heading, subheading, ✕, Escape / backdrop close; `locked` (no dismiss) | small / locked | open; locked; with form; confirmation (one question + two buttons + collapsed "פרטים") | bulk off, split day, keypad, tab order, save conflicts | Close ✕ at the inline end **CHANGED (2.4.2):** new `wide` (up to 720 px) for text the person reads and copies. |
| `sw-drawer` | Context drawer: side panel of `--sw-drawer-w` 360 px at the inline START (right in RTL) on desktop / tablet, bottom sheet with a 40 px grab handle on the phone; `modal` variant (480 px, top layer, focus trapped, dimmed backdrop) | side panel / bottom sheet / modal | closed; open; scrolling body; nested confirmation inside | map camera preview, entity controls, schedule details, tiles panel, layout panel | Never covers the whole map **CHANGED (2.4.2):** new header `action` slot between the title and ✕ (e.g. the player panel's power button); shared scroll-lock for stacked drawers. |
| `sw-popover` | Floating 268 px card anchored to a map marker (heading, picture, "Watch live" button), flips to stay in the stage | — | rest; flipped | floor map | Positioned in stage pixels (geometry, not text) |
| `sw-state-panel` | Non-ready state block: icon + title + hint + optional action button; `state` loading · empty · error · forbidden · stale · partial; `compact` | 6 states; compact | as listed | every screen, the gates | Copy rules: short title, one hint line, no platform names |
| `sw-table` | Data table: white card, quiet grey header, 40 px rows (`dense` smaller), thumbnails / avatars via column renderers, hover tint, selected row soft blue, `emptyText`; wide tables scroll horizontally inside | dense; with selection; with thumbnails | rest; hover; selected; empty; loading (**UNKNOWN**: no skeleton) | cases, exports, audit, users, catalogue, health, schedules table | Column order follows direction; numbers stay LTR |
| `sw-camera-tile` | Camera tile: picture (snapshot / live player / illustrated scene tagged "דמו"), name + green dot at the bottom-start corner, state pill at the top when not live, "צילום" pill when snapshot-only; `compact`, `dark`, `selected`, `fit` contain / cover / fill | live / snapshot / demo; compact; selected | live; snapshot; connecting; offline (grey card + icon + reason); forbidden; unknown; stale; selected; hover controls | live wall, kiosk, overview, saved views, area camera card | Overlay text at the inline start; the picture never mirrors **CHANGED (2.4.2):** `stillRefresh` (seconds, ≥ 5) for a recorder without live: the tile re-reads its still while visible and says "תמונה מתעדכנת". |
| `sw-live-player` | Video element with the WebRTC → MSE plan, poster until the first frame, badge (`main·WebRTC`), fallback notice, reconnect back-off, remote cap message, recorded mode with buffer control | compact; fit | poster; connecting; playing; fallback announced; undecodable; cap reached (no retry); reconnecting; error | single camera, wall tiles, playback, kiosk | Controls overlay floats; picture never mirrors **CHANGED (2.4.2):** remembers WebRTC-unreachable per tab (auto starts on MSE); optional notice line (`media.video_notices`, off by default); close codes 4401 / 4403 / 4404 / 4410 never retry. |
| `sw-timeline` | Recording timeline: activity bars (taller where clips exist), event dots by type, case bookmark flags, blue cursor with time bubble, ticks, gaps left empty, zoom דקה … יום, precision label (verified / keyframe-limited / estimated / unknown), follow mode | precision; zoom window; with bookmarks | rest; scrubbing; following; gap; no data | playback, sync | Time runs left → right in RTL too **CHANGED (2.4.2):** event-kind colours from `--sw-tl-*` (installation setting `timeline.colors`); the precision line only when the playback-display item `helper_line` is on; Hebrew wording. |
| `sw-week-grid` | 7 × 24 hourly cells painted with the mouse in a mode (recording modes CMR / MOTION / EDR, or arming); `editable` | modes palette; editable / read-only | rest; painting; read-only | NVR recording schedule, arming schedule | Sunday first at the inline start; hours LTR |
| `sw-schedule-grid` | The 24 h scheduler: week rows or one day, slots as bars (thick start edge), point actions as pins, drag create / move / resize with snap (15 min), keyboard (arrows, Shift / Ctrl + arrows, Delete, Enter), `orientation` horizontal / vertical (phone), sun times, "now" line, selection | horizontal / vertical; compact; editable | rest; selected slot; dragging preview; locked slot; conflict; read-only | schedule editor (H5) | Axis LTR by decision inside the RTL page |
| `sw-schedule-bar` | A schedule's slots on a 24 h strip (coloured span per slot, pin for a point, "now" line); `compact` | compact | rest; with now line | schedule cards, drawer, editor header | Axis LTR **CHANGED (2.4.2):** tones for script, scene, helper, humidifier, vacuum, siren, media, number, select. |
| `sw-day-chips` | Seven day chips, Sunday first; `workday` / `weekend` collapse to a word; `compact` | compact | active days / inactive | schedule cards, editor | Sunday at the inline start |
| `schedule-condition-chip` | Condition badge ("רק בשבת ובחג", "בתנאי: …") | compact | present / absent | schedule list, editor | — |
| `sw-schedule-markers` | Sensitive / lowering ("פותח / מנטרל") markers | — | sensitive; lowering; both | schedule list, editor | — |
| `sw-steps` | Wizard progress: numbered circles with labels, connected by lines; `current` | — | done; current; upcoming | setup wizard, plan import | Steps run inline-start → end |
| `sw-icon` | 24 px stroke icon set (1.8 px, round caps), 86 names; `flip`; chevrons auto-mirror in RTL | size | — | everywhere | Only `chevron` / `chevronBack` mirror **CHANGED (2.4.2):** **98** icons (88 at 0.1.148 by the same count; the "86" above was stale); added media, cast, stopSquare, snow, flame, fan, thermometer, copy, share, mail. |
| `sw-avatar` | Initials avatar, `size` | size | rest; with alert dot (shell adds it) | rail foot, bottom bar, user menu, tables | — |
| `sw-scene` | Illustrated placeholder scenes (12 kinds: entrance, lobby, corridor, hall, parking, warehouse, backyard, driveway, night, building, house, none) for demo tiles | kind | — | demo tiles, site cards | Drawn; never a customer frame |
| `sw-floor-glyph` | Isometric floor-stack glyph with one highlighted slab; `levels`, `active`, `selected` | size | selected / not | floor lists, tree | Geometry: no mirror **2.4.2:** no usage found in the code any more. |
| `sw-floor-iso` | Isometric floor thumbnail from the published structure (real iso) or room rectangles (demo); selected tinted blue; empty = dashed slab | width; selected; empty | real / demo / empty; selected | floor browser, home tree | Geometry: no mirror |
| `sw-case-picker` | "הוסף לתיק" dialog: pick or create a case, add an event / clip / note | — | list; create; saving; error | events, playback | — |
| `sw-share-members` | Members list of a shared space with הסר / הוסף | — | read-only; editable; empty | floor map (CR-009) | — |
| `sw-remote-sessions` | Remote sign-ins list (browser · system, masked address, times, live count), per-row revoke or "התנתק מכל המקומות"; `scope` own / all; `compact` | own / all; compact | loading; empty; rows; current row marked; revoking | user menu › הכניסות שלי, הגדרות › גישה מרחוק | Addresses LTR |
| `sw-csp-reports` | CSP report counters and the enforce switch (admin) | — | empty; counters; switch disabled while reports exist | הגדרות › גישה מרחוק | Technical; settings only |

## 1a. New shared component families (**NEW** since 0.1.148)

All in `frontend/src/components/` unless a path is given. Several families do not carry the `sw-` prefix. Logic / CSS / icon modules
without an element (`*-logic.ts`, `*-css.ts`, `*-icons.ts`, `*-store.ts`, `dd-style.ts`, `multi-select.ts`, `cast-store.ts`) are not listed
as elements.

### Bubble foundation primitives

| Element | What it is | Looks-changing props / variants | States to design | Where used | RTL / notes |
|---|---|---|---|---|---|
| `sw-dropdown` | Compact single- (or `multiple`) choice dropdown: 32 px chip with a 44 px hit area, popover in the top layer with a real listbox and 44 px options, groups, typeahead, keyboard; search field from 8 options (multi lists follow `ui.dd_search` always / 4 / 8 / never); phone: bottom sheet or small list (`ui.dd_phone`, default list) | `dd-style` auto / pill / field / underline / text / prefix / tonal / capsule; `dd-size` sm / md / lg; `dd-ring` 1 / 1.5 / 2 / 3 and `dd-panel` button / 240 / 300 (capsule only); `block`, `tall` (chip itself 44 px); `multiple`, `max`, `camera-picker`; items with count, alert (dot / warn), group, href, icon, divider, disabled + note | closed; open; with search; empty search; grouped; selected / active option; alert dot on the chip; disabled option with a note; multi foot "n מתוך N" + "נקה" / "סיום"; limit refusal "אפשר לבחור עד N" (`role=status`); phone sheet vs list | `sw-tabs` dropdown mode, the shell pair row, live wall, playback, reviews, sync, multimedia, NVR encoding, generator, Frigate panels, device activity | Chevron mirrors; the capsule style has ~33 rules of its own in `sw-dropdown.ts` |
| `sw-sheet` | THE translucent pop-up of the Bubble foundation | `kind` sheet (bottom sheet on the phone with 44 px grabber, swipe to close; centred dialog wider) / centred / inline (in flow, no backdrop) / unset = look dial `popup`; `wide` 760, `narrow` 440, `locked`, `heading`; slots head / default / footer | closed; open (sheet / centred / inline); dragging; locked; solid fallback (no blur or reduced transparency); reduced motion | device sheet, cast picker, electricity dialogs (`elec-dialog`), bubble room picker in `sw-app`, area screen | Spring opening; translucent `rgba(--sw-sheet-rgb, --sw-sheet-alpha)` over a dimmed, blurred page |
| `sw-pill` | Bubble "button" row: icon ring (its own 44 px button, opens the device sheet), label, state line, sub-buttons (`subs` slot) wrapping under the label | `variant` plain / toggle (role switch) / slider (drag 0..1, keys 5 % / 20 %); `on`, `value`, `fill-color`, `hue` 1..8 (decorative), `unavailable`, `readonly`, `accent`, `density` wide / regular / compact / row, `surface` flat / glass / gradient / fill / none | off; on; partial fill; dragging; unavailable; read-only; accent; each density; each surface | bubble area screen, home widgets, phone dock / room picker, media hero, look settings and palette editor | Fill grows from the inline start; the label is drawn twice and clipped at the fill edge so it reads on both sides |
| `sw-vslider` | Bubble vertical slider (BV1): tall pill filling from the BOTTOM, ring at the top, value + label at the bottom; min width 44 px, height `--sw-vslider-h` 160 px | `surface` none (outlined track) / glass; `on`, `value`, `fill-color`, `unavailable`, `readonly` | off; on; dragging; unavailable; read-only | device sheet when look dial `slider = vertical` (`screens/bubble-sliders.ts`) | Never mirrors (vertical) |

### Automations, scenes, scripts ("קברניט", CR-017)

| Element | What it is | Variants / props | States | Where used |
|---|---|---|---|---|
| `sw-block-card` | One builder block (trigger / condition / step): icon, Hebrew sentence, chips; open = holds the slotted form | chips tone sens / lock / bad / warn / acc / code / why; `open`, `locked`, `invalid`, `nested`, `readonly`, move / duplicate | closed; open; locked (hatched + dashed: move / duplicate / delete only); invalid; nested; read-only; drag grip | automation / scene / script editors (`screens/automation-editor-base.ts`) |
| `automation-card` (`sw-automation-card.ts`) | One automation in the list (always glass): name link, floor / areas, toggle (or a state chip without permission), the Hebrew sentence, last run with count and "למה זה רץ", state chips (sensitive, locked parts, missing device, changed outside, view-only), ⋯ menu (edit / run / dry run / trace / versions / copy / delete) | `busy`, picked (multi-select) | enabled; disabled; busy; view-only; sensitive; missing device; changed outside | `screens/devices-automations.ts` |
| `run-trace` | "למה זה רץ": sentence, summary, trigger / conditions (pass / fail) / steps (nested branches indented) with results, durations, variables, errors; secrets masked | — | pass; fail; nested; error | automation drawer |
| `scene-capture` | Scene table: device chips with "עוד", "צלם מצב נוכחי", per-value correction, save / cancel | `phase` idle / busy / done / error; new; read-only; deletable | as phases | scenes panel |
| `script-fields-form` | Form of a script's fields (number, boolean, select, text, entity), 44 px targets | — | valid / invalid | automation drawer (run with fields) |

### Cast to screens (CR-028)

| Element | What it is | Variants / props | States | Where used |
|---|---|---|---|---|
| `sw-cast-picker` | "לאיזה מסך?": panel docked to the button (desktop) or bottom sheet / docked list (phone, `ui.dd_phone`); rows "לאחרונה" then by floor; "קבוע" where allowed | `phone`, `remote`, profile | blocked screen greyed with a reason; screen playing music asks first; empty; link to "המסכים שלי" | single camera |
| `sw-cast-pill` | Global "משדר N" pill in the shell's floating row with a countdown; opens a tray per session: screen, camera, time left, "האריכו" (limit 8, says why at the limit), "החלף מצלמה", stop | — | hidden (no cast); 1 / n sessions; at the extend limit | `sw-app` |
| `sw-cast-stop` | Stop one cast, optional power-off question (ticked by default) | `variant` solid / ghost | rest; confirming | picker, pill, single camera, settings › cast |

### Multimedia (CR-015 screens and remote, CR-016 players) — always the glass style (`styles/media-glass.ts`)

| Element | What it is | Variants / props | States |
|---|---|---|---|
| `media-screen-card` | One card per TV: poster (own hue + glyph or proxied art), name, state, power, volume, mute, source menu, "שלט" | size s / m / l, `compact`, `editing` (edit slot, controls inert), dimmed | pending spinner; not confirmed after 8 s ("המסך לא אישר את הפקודה", last state restored); rate-limited shake; unavailable; off |
| `media-player-card` | One card per speaker / player / receiver: square cover with glow, state line, group chip, title, main key (play / pause or power), volume, mute, receiver source, "נגן" | size, `compact`, `editing`, dimmed, `leader` | capabilities unknown (all grey, "לא זמין"); pending; not confirmed; rate-limited; off; unavailable "מאז HH:MM" |
| `media-remote` | The TV remote in a modal `sw-drawer` (side panel desktop, bottom sheet phone) | `scheme` light / dark / auto, `kind` (brand profile) | loading; error; unavailable; off (big "הפעל" over a dimmed pad); art mode; no remote wake; view-only; pending; not confirmed; rate-limited; edit mode (`media-remote-editor`) |
| `media-remote-pad` | Concentric d-pad or touchpad | `mode` dpad / touch; disabled | **never mirrors** |
| `media-player-panel` | Player panel in an `sw-drawer`: now playing with seek bar ("שידור חי" for a station), transport (never mirrors), volume, transfer, "הבא בתור", library tabs, group section; receiver: power, sources, sound modes, zone 2; power button in the drawer's `action` slot | `scheme` | loading; error; unavailable; off; view-only; pending; not confirmed; rate-limited; conflict ("קיבוץ לא תואם") |
| `media-player-volume` | Single or group volume: mute, slider or −/+ steppers; group slider + "לפי חדר" per-room sliders with outcomes; ceiling marker where set | single / group | per-room outcome |
| `media-queue-list` | Full queue: current and buffered rows locked, drag handle, "העבר לראש התור", delete; "בחר" multi-select (≤ 25); "נקה תור" asks which clear | `canEdit` | read-only; failed read "לא זמין" |
| `media-library-browse` | Library tab: שירים / אלבומים / אמנים / פלייליסטים / תחנות, "עוד" paging, optional search; tap / long-press / "+" | — | loading; empty; more |
| `media-now-hero` | Bubble-skin "now playing" glass hero over blurred art: art, title / artist, room and group chips, LTR progress, LTR transport, volume as an `sw-pill` slider | — | solid fallback |
| `media-group-dialog`, `media-bulk-dialog` | Confirmations: the party rule (4+ rooms or more than one floor), "עצור מוזיקה" per floor, "כבה מסכים" / "כבה הכל" (screens only): question + count, two buttons, folded "פרטים", honest per-item result; focus starts on cancel | — | confirm; running; results |
| `media-preset-editor` | Saved group dialog: name, rooms (same layer), leader, optional volumes | — | 409 conflict |
| `media-ma-connection` | Settings card for the music service connection: switch, address, write-only token ("החלף" / "מחק"), "בדוק חיבור" | — | ok / failed; settings only (technical names allowed there) |

### Notification centre (CR-018)

| Element | What it is | Variants / props | States |
|---|---|---|---|
| `notify-center` | Opened from the user-menu bell: glass sheet at the content's start edge (`notify.center_layout = sheet`, default) or full page (`page`); full-height bottom sheet on the phone; rows grouped by day, open criticals pinned, folded repeats, filters (all / unread / critical + source), row menu, detail view, door confirmation | sheet / page | loading; empty; error; banners: quiet hours, push unavailable, delivery failed |
| `notify-row` | Severity bar, pictogram ring with folded count, title with unread dot, "place · time", one state tag (acked by / resolved / snoozed until / delivery failed / held by quiet hours), ⋯ menu | `selected` | unread; read; each state tag |
| `notify-detail` | What / where / when, tags, snapshot, delivery line, escalation timeline, actions (פתח, אישור, השתק לשעה, עד הבוקר, פתח דלת) | — | with / without snapshot; door action confirmation |

### Frigate analytics (operator and settings)

| Element | What it is | States / notes |
|---|---|---|
| `frigate-review-card` | Review item in the reviews screen; `variant` card / row; `selected`, `focused`, `canReview` | new dot; reviewed (check, dimmed); severity by icon + text |
| `frigate-review-detail` | Drawer body: hero still, facts grid, object timeline, `frigate-event-control`, actions; "פתח הקלטה" disabled with a reason when unavailable | — |
| `frigate-event-control` | Retain flag and sub-label | invisible unless writable |
| `frigate-camera-control` | On the single-camera screen: analytics and recording switches, active profile; confirmation every time | shown only when allowed |
| `frigate-control-settings` | Settings card with tabs: write classes, profiles, exports, cases, manual events, change log with undo, supervision | — |
| `frigate-auto-profile`, `frigate-config-panel`, `frigate-zone-editor`, `frigate-exports-panel`, `frigate-cases-panel`, `frigate-manual-events`, `frigate-supervision`, `frigate-summary` | Auto profile (off / suggest / apply), curated camera settings, **zone editor on the camera still (polygons, always LTR)**, exports / cases tables folding to rows (typed delete confirmation), manual events, supervised writes, what a recorder offers | settings only |

### Recorders, update, device activity, account

| Element | What it is | States / notes |
|---|---|---|
| `nvr-connection-form` | Recorder connection: vendor catalogue ("בקרוב" for planned vendors), write-only password, test before save, typed "שמור" for an unreachable NVR; `context` settings / wizard / add | testing; ok; unreachable; warnings |
| `nvr-recorders-card` | One recorder = the form; two or more = rows (name, type / model, state, cameras, חיבור / שם / השבת-הפעל, "הוסף NVR") | per-row state |
| `nvr-restart-banner` | "נדרשת הפעלה מחדש כדי להחיל את השינוי" + "הפעל מחדש" (confirm first); manual-start line after 2 min; `restart_manual` variant without a button | shell banner |
| `recorder-health-panel` | One card per recorder: connection, disks, recording, cameras, clock, certificate; thresholds editable with manage | per-check ok / warn / error |
| `sw-update-run` (`update-run.ts`) | Status screen of an update or a platform restart | running; waiting for the system (back-off); gave up; rollback guidance; not found; restart needed; outcome; self-reload on version change |
| `sw-restarts-card` (`restarts-card.ts`) | "הפעל מחדש את Arx" / "…תשתית המערכת", one confirmation, a "required" row | busy; required |
| `device-activity` | Compact popup of an electrical device (long press, context menu, Alt+Enter; one instance in `sw-app`): tabs "פעילות" (period / actor / type filters, day groups, load more) and "תזמונים" (device's schedules, enable switch, edit in a sheet, add); **equipment card** (CARD1) for water heater / tap-valve / robot vacuum: state, 1–3 quick actions, time-boxed run, hold-to-confirm for water flow | loading; empty; no permission; unavailable; partial; "tracked since" note |
| `sw-second-factor`, `sw-second-factor-user`, `sw-second-factor-policy` | TOTP in the account level (QR as inline SVG, key to type, code entry, disable with a code); per-user status and audited reset; policy select inherit / optional / required | off; enrolling; on; error; busy |
| `architect-request-dialog` | "בקשה לאדריכל": read / copy / share / download; uses `sw-dialog wide` and the icons copy / share / mail; one shared instance (`openArchitectRequest()`) | — |

### Outside `components/`

| Element | Path | What it is | States |
|---|---|---|---|
| `sw-wall` | `frontend/src/wall/sw-wall.ts` | The wall display (CR-030), mounted by `sw-app` INSTEAD of the app for an enabled wall user on a tablet-class device: no rail, router or menu; layout presets, strip, page rotation, pixel shift / dim, sleep schedule, camera / server offline ladders, alert chip / tile / critical takeover with press-and-hold ack, idle photo frame; 1.2 s long press on the clock = read-only installer panel for 10 s | loading; live; sleeping; offline ladder; alert; critical takeover; photo frame |
| `sw-floor-image-align` | `frontend/src/map/` | Aligns a floor's own picture to the plan: outline + picture, 4 corner handles, body drag, arrow nudge (Shift ×10), opacity 0.7 | aligned; dragging; disabled |
| `sw-plan-canvas`, `sw-plan-3d` | `frontend/src/map/` | Existing (not listed in the 0.1.148 inventory). **CHANGED**: marker clusters (threshold 60), the floor's own picture under the state layer (lit variant clipped to lit rooms), curved walls (curve handles, arc preview), glass walls; 3D night mode (dark sky, moon, lit rooms glow, per browser) | — |
| electricity (22 elements) | `frontend/src/electricity/` | Pages: meters, accounts, account, bills, bill, bill create, customers, settings (calendar, prices, business, retention), account wizard (6 steps), meter card (drawer), readings. Reusable: `elec-dialog` (wraps `sw-sheet`), `elec-chart` (bar chart; table sr / visible / details; print; gaps never invented, partial periods hatched), `elec-bill-paper` (A4, white paper even in dark mode), `elec-formula-editor`, `elec-tou-editor` (price table, 24 h band bars), `elec-meter-picker` | loading; empty; error; forbidden; partial period |
| generator (6 elements) | `frontend/src/generator/` | `gen-live-page` (status strip, power-flow diagram, engine card, dials or charts, phase table; 5 s poll), `gen-chart-set` (cards / big), `gen-charts-page`, `gen-alerts-page` (alerts / history + detail drawer), `gen-settings`, `gen-routing` (alert routing editor with live preview) | live; stale; alarm; offline |

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

### 2a. Shell changes since 0.1.148 (**NEW** / **CHANGED**)

| Element / module | What changed or what it is | States / notes |
|---|---|---|
| `sw-app` rail (**CHANGED**) | Two new areas: **מולטימדיה** (screens / players / groups; drawn only when present) and **תשתיות** (electricity meters, generator). Up to 6 rail areas; the phone bottom bar gets class `crowded` at 6. Bubble skin: the phone shell is a floating **dock** (pill stack + a home button opening a room picker of floors and areas as `sw-pill` rows in an `sw-sheet`) | crowded; dock |
| `sw-app` tab rows (**CHANGED**) | Follow `shell/tabs-mode.ts`: per tab group (home, area, multimedia, security, settings) `tabs` / `hybrid` (segmented up to 3 items, dropdown above) / `dropdown`, at every width since 0.1.157; dropdown dials from `components/dd-style.ts` | tabs / hybrid / dropdown × 8 dropdown styles |
| `shell/tab-pair.ts` (**NEW**) | On the phone in dropdown form, the area's level-1 chip and the screen's level-2 chip share ONE row of two equal chips | — |
| `sw-app` global mounts (**NEW**) | `notify-center` (bell; deep links `#/notifications/<id>`, `#/doors/<id>?confirm=`), `device-activity` popup, `sw-cast-pill` in the corner float, `nvr-restart-banner`, `media-remote` / `media-player-panel` | — |
| `sw-app` gates (**NEW**) | Presence gate "נדרש להפעיל שיתוף נתונים" (required phone sensors off, CR-027); capability-blocked route panel `no_nvr` ("מצב ללא NVR") or `no_media` ("וידאו אינו זמין · האזור הזה דורש שרת מדיה" + "לחיבורים") from `shell/nav-capabilities.ts` | full-screen panels |
| `sw-app` wall mode (**NEW**) | Mounts `sw-wall` instead of the whole app for an enabled wall user on a tablet-class device | see §1a |
| Search popover (**CHANGED**) | No scrim any more; a tap outside closes it (swallowed), a swipe scrolls | — |
| `sw-user-menu` (**CHANGED**) | Bell = a button opening the notification centre (count = unread; bell red while a critical is open); "עדכון זמין" (refresh icon + accent dot) or "נדרשת הפעלה מחדש" (power icon + dot) rows for `system.update` holders (`shell/update-marker.ts`); account level gains "אימות דו־שלבי" (`sw-second-factor`), "המסך שלי" (`sw-home-personal`), WisKey start choices; screen views (`screen-view` registry) | update marker; restart marker; 2FA section |
| `sw-home-personal` (existing, not listed before) | "המסך שלי": personal home settings; since 0.1.149 the `area-row-editor` ("ליד שם האזור") personal over the installation | — |
| `screen-view` registry (existing, not listed before) | A screen registers a VIEW choice shown as a compact "תצוגה" item with a 2–3 option control in the user menu (home: כרטיסים / אריחים / תוכנית - "תוכנית" only when a plan exists) | — |

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

## 3a. Screen-level patterns added since 0.1.148 (**NEW**)

| Pattern | Where | What it does today | States |
|---|---|---|---|
| Skin-structured screens | home, area, multimedia (bubble), ~48 list / settings screens (`styles/bubble-chrome.ts`) | `SkinController` mirrors `data-skin` so a screen can change STRUCTURE for a skin: bubble turns local segmented controls into pill tracks with a solid thumb, bordered boxes into flat layers, inputs into pill fields, sticky bars static, 44 px touch targets | per skin |
| Look-dial preview | הגדרות › כללי (`system-design`, `system-look`, `system-palette-editor`) | Live preview box carrying its own `data-bubble-*` attributes, so a draft shows next to the page as it is; palette editor with contrast warning + auto-fix | draft; saved; warning |
| Bubble area screen | `screens/devices-area-bubble.ts` | Every device an `sw-pill` row: light = slider pill, switch = toggle, cover = position with up / stop / down subs, climate = −/+, player = play / mute; the ring opens the device `sw-sheet`; sections are separators with a bulk button; grid by `--sw-grid-min`; density `row` = list view; device-sheet sliders horizontal pills or `sw-vslider` columns | each density × surface |
| Bubble home widgets (BV1) | `screens/home-widgets-bv1.ts`, `home-edit-bv1.ts` | Clock / weather tile style, agenda tile, quick launcher grid of round buttons, surfaceless widgets | — |
| Automation builder | `screens/automation-builder.ts`, `automation-editor-base.ts`, `script-editor.ts`, `scene-editor.ts` | Glass editor sheet over the list: three stacked sections כאשר · אם · אז of `sw-block-card`s, nested lists for if / choose / repeat, live Hebrew sentence, debounced preview with inline issues per block; banners (conflict, delegation off, missing grant, view-only); "בונה · קוד" toggle (`automation-code`: monospace, line numbers, locked lines shaded); templates gallery; entity picker (popover desktop, bottom sheet phone); dry run, run now, "צור כתזמון", save with revision conflict, unsaved guard | ready; invalid; conflict; view-only; dry-run result |
| Automations list + drawer | `screens/devices-automations.ts`, `automation-drawer.ts` | Segmented kinds (אוטומציות / סצנות / סקריפטים next to תזמונים under "קברניט"), floor chips, state filter, search, "+ חדש"; drawer sub-views detail / trace (`run-trace`) / versions / dry run; trash | loading skeleton; empty per kind; no match; feature off; no permission; stale |
| Command outcome | media cards, device tiles, remote | Spinner until confirmed; after 8 s "… לא אישר את הפקודה" with the last state restored; rate-limited shake; one power command in flight | pending; confirmed; not confirmed; rate-limited |
| Bulk / group confirmation (extended) | `media-bulk-dialog`, `media-group-dialog`, `nvr-confirm` | Same pattern as the device bulk-off: question + count, two buttons, folded "פרטים", honest per-item outcome | confirm; running; results |
| Undo toast | `screens/nvr-undo-toast.ts` | "נשמר" + "בטל" for 10 s (local; no shared toast component yet) | shown; undone; expired |
| Media layout editor | `multimedia-edit-panel`, `multimedia-layout.ts` | Per card show / hide, size קטן / רגיל / גדול, "מועדף" pinned row, order, phone visibility; grouping קומה / חדר / רציף; installation vs personal ("רק אני") scope; mirrors the home edit panel | dirty; saved |
| Wall arrangement | `screens/wall-arrangement.ts`, `system-wall`, `wall-photo-sets` | System-wide camera order, column span and "לא להציג", two groups (shown, then hidden dimmed); footer "N מצלמות" / "מוצגות N מתוך M" | — |
| Area-row editor | `screens/area-row-editor.ts` | "מה מוצג ליד שם האזור" and the floor chips; installation and personal | — |
| Tabs presentation settings | `screens/system-tabs-mode.ts` | Live samples of every dropdown style and the capsule (divider, icons, counts) | — |
| Capability panel | `shell/nav-capabilities.ts` | Neutral full panel instead of errors when the installation lacks a recorder / media server | no_nvr; no_media |
| Plan editor additions | `explore-plan-editor`, `map/*` | Own floor image (`sw-floor-image-align`), curved walls (through points) and glass walls, marker clusters, 3D night mode, plan package import dialog, architect request dialog, plan ↔ area links admin | — |
| Charts (energy) | `elec-chart`, `gen-chart-set`, `gen-live-page` | Bar / line charts with an accessible table twin, never invented gaps, hatched partial periods, power-flow diagram, dials | live; stale; partial |
| Equipment card | `device-activity` (CARD1) | Water heater, tap / valve, robot vacuum: state, 1–3 quick actions, time-boxed run, hold-to-confirm for water | — |

## 4. Illustration and imagery rules

- Camera tiles show a real snapshot or stream when one exists; otherwise the `sw-scene` illustration with a "דמו" tag. No fake frames,
  no customer imagery in the public repository.
- Plans are rendered by the product (thin lines, `--sw-map-*` colours); imported drawings are normalised, never shown as raster truth.
- The 3D scene: sky-gradient backdrop, isometric / perspective / top cameras, cutaway walls, warm room tint when lit, blue presence tint
  that fades, red open-door markers, temperature chips. Level 1 (flat) and level 2 (lit) exist.
- Icons: one stroke set (`sw-icon`), never mixed with a filled set inside one screen. WisKey's frame keeps its own icons.
