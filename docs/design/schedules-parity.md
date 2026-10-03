# Schedules screen: parity with the automations and scenes screens

Owner request 2026-10-04: the schedules screen ("תזמונים", `#/devices/schedules`) is designed exactly like the automations and scenes
screens (`#/devices/automations`, `screens/devices-automations.ts`, `scenes-panel.ts`, `components/sw-automation-card.ts`,
`automation-drawer.ts`). Branch `pilot/schedules-parity`.

The rule followed: reuse the automations area's shared styles, never fork them. The schedules list, its drawer and its
confirmation dialogs now start from `styles/automations-glass.ts` (`automationsStyles`: the device theme layer, the media glass
knobs and controls, the bubble knobs) plus `styles/media-page.ts` (`mediaPageStyles`, the sticky page header), call
`applyAutomationsGlass()` like every automations component, and keep `styles/bubble-chrome.ts` first, exactly as
`devices-automations.ts` does. The editor takes the same token layer (see row 13). No new design tokens were added; the only
shared addition is one icon (`grid`, the cards view) in `components/automation-icons.ts`.

Status column: **same** = the schedules screen now uses the same element / class / component as automations or scenes;
**kept (capability)** = a schedules capability automations does not have, kept and drawn with the shared elements;
**deviation** = a deliberate difference, with the reason.

| # | Element | Automations / scenes | Schedules after this change | Status |
|---|---------|----------------------|-----------------------------|--------|
| 1 | Page frame | `.page` + sticky `header.dh` (media-page.ts), the host scrolls, the bar compacts at 40 px, `measureHeaderBar()` | Same frame, same scroll / compact logic, same `measureHeaderBar()` call (was `sw-page`) | same |
| 2 | Title | `h1` large title, no subtitle | `h1` "תזמונים", the old summary subtitle removed (the counts moved into the segment and state controls) | same |
| 3 | Floors | `.rooms` chips (`.rc`) in the title row: "הכל" + one per floor | Same chips, same row; filter `floor` in the address as before | same |
| 4 | Segment strip | `.seg.kinds` (role tablist) inside `.dh-det`: תזמונים · אוטומציות · סצנות · סקריפטים with counts | Same control and position (was its own `.kseg`); `data-kavarnit-segments` kept | same |
| 5 | State filter | `.seg.sm.stf` radiogroup with counts (הכל · פעילות · כבויות · ...), folded behind "סינון" on the phone | Same control: הכל · פעילים · מושבתים · מתבצעים · הסתיימו with counts; folded behind "סינון" on the phone (was a native select) | same |
| 6 | "סינון" | `.btn.foldbtn` with the active count (phone only: it reveals the state filter) | Same button, shown on every width because schedules have more filters: area, days, Shabbat / holiday presets, "עם תנאי", condition, tags, grouping and sorting sit behind it (chips `.rc`, `sw-dropdown` for the four former selects) | kept (capability) |
| 7 | Search | `label.search` in the header row, placeholder by segment, "חיפוש" on the phone | Same element and behaviour (was `sw-field`) | same |
| 8 | New | `.btn.primary.newbtn` "+ חדש"; hidden without the right, disabled with the reason when saving is blocked | Same button and rules; opens the create dialog as before | same |
| 9 | Views | none | cards · table · week as a `.seg.sm` icon switch at the end of the title row (where the media pages keep their floor menu) | kept (capability) |
| 10 | List | `.cgrid` of `<automation-card>`; scenes: `.groups` > section with `.sh h2` headings | `.cgrid` of cards; grouping (area / floor / tag / state) uses the scenes' `.groups` / `.sh h2` sections | same |
| 11 | Card | `.acard` glass card, radius 24 (22 on the phone), name link covering the card, `.where` line (layers icon, floor bold, areas), `.tog` switch or a state chip for a caller who may not switch it, `⋯` menu (`.pop`) with only the allowed items, footer run line with a dot, `data-picked` ring | Same shape and classes; the body is the schedule's own content (24 h bar, day chips, period chip, condition chip, sensitive / lowering markers, state chip); menu: עריכה · הרץ עכשיו · שכפול · מחיקה (copy and delete are new on the card) | same |
| 12 | Selection | automation card has the `data-picked` style, no checkbox | A checkbox in the card header (44 px hit area on touch) and the bulk bar as the glass `.editbar`, sticky at the bottom (static in the bubble skin, by bubble-chrome.ts) | kept (capability) |
| 13 | Editor | `automation-builder` / `scene-editor`: a 620 px glass side sheet over the list | The schedule editor stays a full page (route `.../<id>/edit`) and takes the same material: the glass token layer bridged to every `--sw-*` token it and its components read (light / dark by `devices.scheme`, the bubble knobs) | deviation: the week board (seven day rows x 24 h, drag to create / resize) needs the page width; in a 620 px sheet it would lose its drag precision and the side panel |
| 14 | Editor form selects | native styled `<select>` (`.selx`, `.inp`) in the automation, scene and script forms | native `<select>` inside `sw-field` (unchanged) | same (the editors' own pattern) |
| 15 | Drawer | modal `sw-drawer`, banners, `.sentence`, `.sect > h4` sections, `.blk` rows, footer `.foot2` of `.btn` (עריכה primary, הרץ, then quiet שכפול / מחיקה) | Same drawer, banners, sections (מתי · משבצות · תנאים · ההרצות הבאות · הרצות אחרונות), `.blk` rows, the same footer buttons | same |
| 16 | Drawer: allowed actions | buttons the caller may not use are hidden | buttons stay, disabled with the server's reason as the title | deviation: the schedules design (docs/design/CR-014-scheduler.md, states table: "controls disabled with tooltips") - the reason is the only place a view-only or scope-limited user learns why |
| 17 | Drawer: switch | none (the card's switch only) | a "פעיל" row with the same `.tog` | kept (capability) |
| 18 | Dialogs | `sw-dialog` with the sheet material, `.dlgform` line + `.dlgrow` of `.btn` (ביטול, then primary / danger) | Same, for run (slot choice, "run even if the conditions do not hold"), copy (name), delete, purge; the lowering confirmation stays S4's `<schedule-lowering-dialog>` | same |
| 19 | Toast | `.toast[popover]` pill, check / warning icon, an action button (שחזור), short confirmations | Same element; texts shortened to the automations style (`"שם" נמחק` + שחזור, `"שם" הופעל`, `שוכפל`) | same |
| 20 | States | `.statebox.glass` ring icon + title + one action; loading skeleton of glass cards | Same boxes for loading, error (+ נסו שוב), no permission, off (+ settings for an administrator), component missing (operator / administrator), empty (+ new), no match (+ נקה סינון), trash empty, review empty; explanatory paragraphs removed | same |
| 21 | Banners | `.banner` warn / bad / info with an action | Same: stale (+ נסו שוב), saving blocked for a manager (info), "דורשים בדיקה" for an administrator (+ לבדיקה, opens the review list) | same |
| 22 | View-only user | no "חדש", no banner, a state chip instead of the switch, no `⋯` menu | Same | same - contradiction recorded below |
| 23 | Trash | user menu "סל מחזור" (registerScreenEdit) opening a drawer | user menu "סל מחזור" (registerScreenEdit), opening the existing trash page `.../trash` in the same frame (back button + title, glass rows, restore, purge for administrators) | deviation: the page and its address are kept (old links, the 30-day list with purge); the entry point is the same |
| 24 | Review list | none | `.../review`, same frame and rows, bulk disable in the `.editbar` | kept (capability) |
| 25 | "Today" | none | one quiet glass row with the runs still to come today (time, name, "בתנאי", tone dot) above the cards / table; not in the week view | kept (capability) |
| 26 | Phone | header grid (title, rows of chips), kinds full width, state filter folded, search + סינון + חדש on one row, one card column, 44 px targets | Same layout; the view switch sits beside the title | same |
| 27 | Tablet / desktop | auto-fill grid `minmax(360px)`, header in two rows | Same | same |
| 28 | Skins | classic / domus / tesla: the glass material (light / dark by `devices.scheme`); bubble: the bubble knobs and bubble-chrome | Same mechanism, same result | same |
| 29 | Light / dark | glass light / dark from `devices.scheme`, not the app theme (bubble follows its own scheme) | Same | same |
| 30 | RTL Hebrew | logical properties, `bidi()` on names, numbers isolated | Same (`bidi()` added on names, floors, tags) | same |
| 31 | Branding | no Home Assistant / HA wording on operator screens | none | same |
| 32 | Floors / areas tree | automations and scenes show the floors as chips and group scenes by area; no tree | floors as chips; grouping by area or floor | same |

## Contradiction recorded (owner to confirm)

`docs/design/CR-014-scheduler.md` (states table, "No permission") specified a "מצב צפייה" banner and controls disabled with
tooltips on the list. The owner's later rules - clean operator screens (2026-09-30) and this request (2026-10-04, "exactly like the
automations screen") - point the other way, and the automations screen hides what a viewer cannot use. The list follows the
newer rules (row 22); the drawer keeps CR-014's disabled-with-reason buttons (row 16), so a viewer still sees every action and
why it is unavailable. If the owner prefers CR-014 on the list too, it is a small change in `devices-schedules.ts`
(`bannerRow`, `switchOf`, the new button) and the view-only test.

## Not changed

- The settings page (`system-schedules.ts`) already matches `system-automations.ts` (both `sw-page` + `sw-card` settings pages);
  it keeps its native selects, like every settings page.
- The week view (`schedules-week-view.ts`) and the 24 h bar keep their drawings; they follow the glass tokens through the bridge.

## Tests

- `frontend/tests/evidence-schedules-list.spec.ts`: selectors moved to the new structure; new cases for the floor chips and the
  state filter, and for the card (shape, menu, copy, edit); the view-only case follows the automations rules.
- `frontend/tests/evidence-kavarnit.spec.ts`: the strip has the same height and position on both screens; 44 px asserted in the
  touch layout, as for the automations strip.
- `frontend/tests/unit-schedules-logic.spec.ts`: the state segments' counts and the "סינון" count.
- `frontend/tests/layout-schedules-parity.spec.ts` (new): the layout guard over cards, table, week, "סינון" open, the card
  menu, the drawer, the trash, the review list, the empty state and the editor - bubble skin all classes; classic, domus and
  tesla the geometry classes (44 px at the phone width).
