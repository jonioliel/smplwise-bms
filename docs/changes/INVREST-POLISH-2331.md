# INVREST-POLISH-2331 — investigation leftovers polish (cases, one case, exports, the event page)

Branch `pilot/INVREST-POLISH-2331` from `origin/main` 52a8d9129, with 6e32f2cbb cherry-picked from `pilot/EVENTS-POLISH-2331`
(`frontend/src/i18n/event-codes.ts`, the Hebrew names of raw device codes). No version bump, no backend change, no shared component
or design-token change.

Scope: `frontend/src/screens/investigate-cases.ts` (the cases list and the case page), `investigate-exports.ts`,
`investigate-event-detail.ts`, plus one private helper `investigate-time.ts` ("how long ago"). Aligned with the just-polished events
list (EVENTS-POLISH-2331): no page scroll on a control screen from a tablet up, Hebrew names for device codes, raw values behind
"פרטים טכניים", relative time beside absolute time, information quiet / alerts filled.

## Critique (impeccable critique + polish, emil-design-eng, ui-ux-pro-max for the tables)

Method: one reviewer, rendered screenshots of the `52a8d9129` build against a faked backend (invented sample data, no device) at
1920x1080, 1440x900, 1180x820, 1024x768 and 390x844 (`docs/evidence/INVREST-POLISH-2331/before-*.png`). Not split into isolated
sub-agent critiques (scope and cost); scores are one reviewer's read.

### Cases list (`#/investigate/cases`)

| # | Heuristic | Score (0-4) | Finding (before) |
|---|---|---|---|
| 1 | Visibility of status | 3 | Status chips fine; no count of what the filter shows |
| 2 | Match real world | 3 | Hebrew throughout; "עודכן" only as a mono timestamp (`01.11.2026 13:54`) |
| 3 | User control | 2 | A search with no match showed "אין תיקים עדיין" (as if no case existed) and no way back |
| 4 | Consistency | 2 | The list grew with the page (other control screens never scroll); tags in a `font-size:11px` literal |
| 6 | Recognition | 2 | "How long ago" had to be computed from the timestamp |
| 7 | Efficiency | 1 | Rows reachable by mouse only (sw-table rows have no tabindex) |
| 9 | Error recovery | 1 | A failed load showed a red line above the "no cases yet" empty state, no retry; 403 not distinguished |
| — | Phone | 1 | Each case a card of six stacked captions (≈1 screen per case), the LTR "עודכן" cell floated to the far side |

### One case (`#/investigate/cases/:id`)

- The column was sized by `calc((100dvh - 470px) * 16 / 9)` (a leftover of the demo video stage): at 1920x1080 a ~860 px column in the
  middle of a wide screen; at 1440x900 the page scrolled to reach the note composer and the evidence bundle.
- The header subtitle carried five facts in one run-on line (status, owner, items, preserved, updated); the preservation picture
  (how many preserved / copying / bookmark-only / missing) had to be counted from the badges.
- The composer (note, camera picture) sat under the evidence list, the bundle card under that; the bundle card ended with a five-line
  legal paragraph always open.

### Exports (`#/investigate/exports`)

- "מחק" removed a finished job and its files on one click (no confirmation) - the only destructive action here without one.
- Server mode had no display numeral for progress (the demo did), and failed / partial / paused jobs were not tinted (the demo tints
  were keyed on demo-only values) - every job looked the same.
- No overview: how many run, how many finished, how many need a look. Running and finished jobs interleaved.
- The time range repeated the day on both ends (`01.11, 11:43:16 → 01.11, 11:53:16`), twice per job with the actual range.
- The list grew with the page; the trust note floated after it. Errors with jobs listed were a plain line; 403 was a generic error.

### The event page (`#/investigate/events/:id`)

- Raw device vocabulary in the operator path: the source fact read "אירוע NVR / חניה מקורה raw linedetection"; the type read
  "נגזר (inferred)"; the player caption "לפי keyframe"; correlation deltas "−36s".
- The title used the product kind (`EVENT_LABEL`), the events list now uses the device code's Hebrew name - the two disagreed for
  e.g. `fielddetection` (list: "חדירה לאזור", page: the kind label).
- No severity on the page at all; no "how long ago"; duration as `00:48`.
- The context column was as tall as its content (facts, map, correlation, route, nearby): the page scrolled ~2 screens at 1440x900
  and the player went off screen while reading the correlation.
- Phone: fine structurally (one column), the actions wrap above the player.

## What changed

### Cases list

- From 768 px up the screen takes the height the shell leaves it (`:host` flex column, `sw-page` block-size 100%); the table scrolls in
  its own box with its sticky header; the page does not scroll. Phone keeps the page scroll.
- Toolbar: status chips (with `aria-pressed`, `data-case-status-filter`), the count of listed cases ("9 תיקים", `aria-live`), the search
  (280 px; full width on a phone; Esc clears it).
- Table: the title is a real link (`<a href="#/investigate/cases/:id">`) - keyboard reachable, opens in a new tab; fixed widths for the
  status / owner / items / preserved / updated columns; preserved as "0 / 2" (tabular); updated as "לפני 3 שע׳" with the absolute time
  under it. No px literals (the 11 px tag line now reads `--sw-fs-xs`).
- Phone: one compact card per case - title with the status badge, then "dana · 3 פריטים · 0/2 שמורים · לפני 3 שע׳", then the tags.
- States: loading; forbidden (403) as the forbidden panel; a failed load as the error panel with "נסה שוב"; no match for the filter as
  "לא נמצאו תיקים" with "הצג את כל התיקים" (resets search and status); no case at all keeps the original empty state.

### One case

- From 1000 px up two columns bounded by the viewport, each scrolling in its own box: the evidence (provenance of an imported case,
  then "ראיות והערות") at the start; the case's own panel at the end - description and tags, "הוספה לתיק" (note, camera picture) and the
  evidence bundle. Header actions (status, edit, delete, back) never leave the screen. Narrower: one column, the page scrolls.
- A preservation strip at the top of the evidence card: items, preserved (success tone), copying, bookmark-only (warning tone), missing
  (danger tone) - only the non-zero ones beyond the first two.
- Header subtitle shortened to status · owner · "עודכן לפני …" (the counts moved to the strip).
- Ctrl/Cmd+Enter in the note field adds the note.
- The bundle card's legal paragraph is behind "מה החבילה מוכיחה" (text unchanged).
- The demo-mode case page (`.wrap`, video stage) is unchanged.

### Exports

- Summary row (`data-export-summary`): in progress / completed in full / need attention (warning tone when non-zero).
- The list in its own scrolling panel, grouped "פעילות" (queued, running, paused for disk) and "הסתיימו", sticky group heads with counts.
- Each job: camera + state badge; the range on one day as "01.11 · 11:43:16–11:53:16" (both days when it crosses midnight); files /
  estimate / actual range in one meta line; the percent as a display numeral over the bar (bar green when done, amber when partial,
  red when failed); the bar is a `role="progressbar"` with its value. Failed / interrupted jobs tinted danger, partial / paused tinted
  warning; finished-ok jobs stay quiet. "הורדה" is the primary action of a ready job.
- Delete asks first (`sw-dialog`: what goes - the downloaded files - and what stays - the NVR recording).
- 403 shows the forbidden panel; an error while jobs are listed is a warning line with `role="alert"`.

### The event page

- Title, crumbs, nearby events: the device code's Hebrew name (`rawCodeLabel`, same as the events list), falling back to the kind.
- Subtitle: time · "לפני 42 דק׳" · source in words ("התראה מה־NVR", the list's words).
- Facts: status, severity (information quiet, alert / critical filled), time with "how long ago", type, duration ("48 שנ׳") with
  repeats, location, source · camera. No raw code, no English.
- "פרטים טכניים" (collapsed): device code, device text (Hebrew when known, else verbatim LTR), time precision (Hebrew + tag), device
  clock, received, source · confidence keys, recorder · channel, event id.
- From 901 px up the page is bounded: the player column stays in view (the player capped at `100dvh - 300px`), the context column
  scrolls in its own box (gap-based spacing instead of per-card margins). Phone unchanged (one column, page scroll).
- Correlation deltas read "−36 שנ׳"; the player caption's precision is "לפי פריים מפתח".
- `data-ack` on the handled action (test hook).

## Not changed / proposals for shared code

- `sw-table` rows are not focusable and have no Enter handler (shared component, out of scope). Proposal: `tabindex="0"` on clickable
  rows plus Enter / Space -> `row-select`. The cases list works around it with a link in the title cell.
- The events list's "פרטים טכניים" and this page's are two implementations of the same block; a shared `sw-tech-details` would be cheap.
- `investigate-reviews`, `investigate-incidents`, `investigate-events`, `investigate-ha-events`: not touched (other agents / done).
- The case page's item rows, the import-bundle dialog and the snapshot composer keep their structure (only placement changed).

## Tests and evidence

Run on the workstation (2026-11-01):

- `npx tsc --noEmit`: exit 0.
- Gating lint specs (`unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, desktop project, `--workers=1`, no web server):
  25 passed.
- Evidence spec `frontend/tests/evidence-invrest-polish.spec.ts` (faked backend; desktop 1440x900 + 1920x1080, tablet 1024x768 +
  1180x820, phone 390x844): **before** phase only, against the 52a8d9129 build on a local preview - 14 passed, 1 skipped by design
  (the tablet states shot). Screenshots in `docs/evidence/INVREST-POLISH-2331/before-*.png`.
- **after** phase (the assertions: no page scroll on desktop / tablet, actions in view, Hebrew event name, no raw code in the facts):
  NOT_RUN - the workstation ran out of memory (16 agents) and the coordinator stopped all local builds, previews and Playwright
  evidence runs. To run on the runner gate: build, serve, then
  `SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-invrest-polish.spec.ts --workers=1` (writes `after-*.png`).
  The after screenshots are therefore not in this branch yet. The existing evidence specs of these screens (`evidence-cases`, `evidence-event-detail`,
`evidence-bundle*`, `evidence-signing`) need `SW_LIVE=1` and the lab backend - not run here.

Pixel baselines likely affected: any `pixel-*` baseline or shoot that renders `#/investigate/cases`, `#/investigate/cases/:id`,
`#/investigate/exports` or `#/investigate/events/:id` in server mode (the r5 investigate shoot `r5-investigate-shoot.spec.ts`,
`layout-page-background.spec.ts` if it captures these routes). Demo-mode renders of the cases list and the case page are unchanged
except the exports demo list (now in the scrolling panel without the card wrapper).
