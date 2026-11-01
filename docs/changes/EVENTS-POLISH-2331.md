# EVENTS-POLISH-2331 — event centre polish (Security › investigate › events)

Branch `pilot/EVENTS-POLISH-2331` from `origin/main` 52a8d9129. No version bump, no backend change.

## Owner complaint

The event centre's side panel (snapshot, source, confidence, time, repeats, handling, description) had its action buttons
("סקירה מלאה", "נגן כאן", "להקלטה", "סמן טופל") at the very bottom of the whole page: the panel was as tall as the list, so reaching
them meant scrolling the entire list. The screen also felt raw: a technical source line in the header, raw values (`device_offset`,
`raw: VMD`), English device text ("Motion alarm"), empty table columns and an odd floating dot top-left.

## Critique (impeccable critique + polish, emil-design-eng)

Method: single-context review, then the mechanical detector (`impeccable detect`) and rendered screenshots at 1920x1080, 1440x900,
1180x820, 1024x768 and 390x844 against a faked backend (36 invented events). The critique was not split into two isolated
sub-agents (scope and cost of this task); findings below are one reviewer's read plus the detector.

Root cause of the complaint: `sw-drawer` (non-modal) is `position: absolute; inset-block: 0` inside `.stage`, and `.stage` grew with
the list. The drawer therefore took the list's height (thousands of px), and its footer sat at the list's bottom. The shell's `<main>`
scrolled the whole page.

| # | Heuristic | Score (0-4) | Key issue (before) |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Ingest/live status mixed into a long technical banner; a disconnect looked like the healthy line |
| 2 | Match system / real world | 1 | `VMD`, `linedetection`, `raw:`, `device_offset`, `inferred`, English "Motion alarm" in an operator screen |
| 3 | User control and freedom | 2 | No reset of filters, no way to see which filters were active; drawer actions out of reach |
| 4 | Consistency and standards | 2 | Every severity a filled chip (information as loud as an alert); other control screens already never scroll |
| 5 | Error prevention | 3 | Bulk ack carries a count and a tooltip (fine) |
| 6 | Recognition over recall | 2 | Event time only absolute; "how long ago" had to be computed by the reader |
| 7 | Flexibility / efficiency | 1 | No keyboard: every next event needed a mouse trip back up the list |
| 8 | Aesthetic and minimalist | 2 | Header subtitle with the time-zone id, a 3-line banner and a facets paragraph before the list |
| 9 | Error recovery | 3 | Errors and unsupported filters shown as warning banners (kept) |
| 10 | Help and documentation | 3 | NVR-side setup hint present (kept, moved into the technical details) |

Priority issues:

1. P0 — panel actions below the fold (the complaint). The drawer must be bounded by the viewport, its body scrolling, the footer fixed.
2. P1 — the page scrolls on a control screen (owner rule: no page scroll in control screens). The list must scroll inside its own box.
3. P1 — raw device vocabulary in the operator path (`VMD`, `raw:`, `device_offset`, English text).
4. P2 — filter bar: one long undifferentiated row of 7-9 fields + chips + bulk action + view toggle; no active-filter summary or reset.
5. P2 — table density: thumbnail column 104 px, the raw code under the camera, a status hidden in the subtitle of the type, equal weight
   for informational and critical severity.
6. P3 — phone: 7 single-row filter fields fill the first screen; the drawer was a 62 dvh sheet with its actions under the image.

Detector (`impeccable detect --json` over `investigate-events.ts` and `investigate-ha-events.ts`, after the change): `[]`, no findings.
A clean scan is not a quality claim; the rendered shots were reviewed at every size listed above.

The "odd floating dot top-left" is the shell's floating search / status pill in the corner beside the SmplWise logo
(`shell/sw-app.ts`, `.float`), not part of this screen; it is out of this task's scope (the shell is shared) and is left as is.
The ingest dot inside the old banner is now part of the one-line data-sources summary.

## What changed

Events screen (`frontend/src/screens/investigate-events.ts`):

- Layout: from 768 px up the screen takes exactly the height the shell leaves it (`:host` flex column, `sw-page` block-size 100%,
  `.stage` flex 1). The list (`sw-table`, already `overflow: auto` with a sticky header) scrolls inside its own box; the page does not
  scroll. The drawer, absolute inside `.stage`, is now viewport-bounded: its body scrolls, its footer (the actions) is always in view.
- Wide desktop (>= 1280 px): the drawer docks beside the list (`.stage.docked` reserves its width), so the selected row and its
  neighbours stay visible; drawer width `clamp(360px, 28vw, 440px)`. 768-1279 px: the drawer overlays the list's start side.
- Phone (< 768 px): the drawer is `modal` — a full-screen sheet (`--sw-drawer-sheet-h: 100dvh`) with focus trap, Escape, and the
  actions in a bottom bar (primary across, the others two by two, full-width 44 px targets). The page scrolls on a phone as before
  (rows are cards there).
- Keyboard (desktop / tablet, drawer open): Esc closes, ↑ / ↓ move to the previous / next event (the row scrolls into the list's own
  view, clear of the sticky header), Enter opens the full review. Keys typed into a field, with a modifier, or on a focused button are
  left alone. Also for the review-windows drawer. A small key reminder sits at the footer's end (hidden under 1100 px / coarse pointer).
- Table: columns picture (80 px) | event | camera | time (190 px) | severity (96 px) | handling (140 px). Event name in Hebrew from the
  device code (VMD -> "זיהוי תנועה", linedetection -> "חציית קו", …; the raw code on hover and in `data-raw-type`), the source in words
  under it. Camera with its channel. Time: clock (tabular) plus "לפני 12 דק׳ · 01.11 · 48 שנ׳" (relative, day, span), refreshed every
  30 s. Severity: information is a quiet outline chip, alert / critical stay filled. Handling column: "ממתין" (warning ink) or
  "טופל · user · time". Cell padding 9 px 14 px (denser than the R5 12 px 16 px).
- Drawer: heading = Hebrew event name, subheading = camera · time · how long ago, severity + handling chips under the title. Facts:
  time (range + span), camera, source, confidence, repeats, handling, description only when a Hebrew mapping says more than the title.
  A collapsible "פרטים טכניים" holds the device code, the device's own text, the time-precision (Hebrew + tag), the device clock,
  received time, source / confidence keys, recorder + channel, coalesced count and the event id.
- Filter bar: fields on one wrapping row; a second row with the status segment (הכל / לבדיקה / טופלו), the view segment
  (אירועים / חלונות), the active-filter chips (each removable) with "איפוס", and the bulk "סמן הכול כטופל (n)" at the end.
  On a phone the fields are two by two (search and range across).
- Header subtitle: "חיפוש, סינון וסקירה של אירועי המצלמות והחיישנים" (the time-zone id moved to the technical details).
- The data-sources banner and the facets paragraph became one collapsible line: "● קליטה מחוברת · עדכונים חיים פעילים … פרטים טכניים";
  a "NVR does not send alerts" condition shows a warning flag on that line; the details (heartbeat, time zone, inferred-events note,
  NVR setup hint, fields with data, unavailable types) open on demand; the open state is remembered per viewer (localStorage).
  A disconnected ingest is a visible warning banner above the bar (not hidden).
- Demo mode: same drawer behaviour (modal sheet on a phone, footer bar class).

New module `frontend/src/i18n/event-codes.ts`: raw device code -> Hebrew, device "<code> alarm" text -> Hebrew, time-precision tag ->
Hebrew, span text. Only known values are translated; unknown values are shown raw in the technical details (no invented meaning).

Sensor events list (`frontend/src/screens/investigate-ha-events.ts`, same stage + drawer pattern, same bug): the same viewport-bounded
layout (list scrolls in its box, drawer bounded), the drawer is a modal full-screen sheet on a phone, Esc / ↑ / ↓ with the drawer open,
information-severity chips quiet.

## Sibling screens — reached / not reached

- investigate-ha-events: done (above).
- investigate-reviews: its drawer is already `modal` (top layer, viewport height); embedded events-windows view inherits the events fix.
  Not changed otherwise.
- investigate-incidents: already a no-scroll board (NO SCROLLING rule 2026-10-24); no shared drawer. Not changed.
- investigate-cases, investigate-exports: no side drawer and no shared list component with the events screen; their dialogs are
  `sw-dialog`. Not changed (no cheap shared fix applies). Candidates for a later pass: cases list density and filter chips.
- investigate-event-detail (the full review page): not changed in this slice.
- Not reached: Hebrew labels for raw types inside the review-windows table (it uses the product kind label, already Hebrew), and a
  user setting for the docked vs overlay drawer (currently by width; a setting would be cheap to add if the owner wants it).

## Tests and evidence

See the report in the task hand-off for the exact runs and totals. Evidence spec: `frontend/tests/evidence-events-polish.spec.ts`
(faked backend; desktop 1440x900, tablet 1024x768, phone 390x844, plus 1920x1080 and 1180x820). Screenshots:
`docs/evidence/EVENTS-POLISH-2331/before-*.png` (52a8d9129 build) and `after-*.png`.

Pixel baselines likely affected: any `pixel-*` baseline that renders `#/investigate/events` or `#/investigate/events` with the sensor
list (`investigate-ha-events`), the reviews tab's windows view, and the r5 investigate shoot (`r5-investigate-shoot.spec.ts`, not a
gated baseline). `pixel-access-events` is a different screen (access control) and should be unaffected.
