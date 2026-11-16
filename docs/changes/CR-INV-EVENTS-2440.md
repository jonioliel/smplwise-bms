# CR-INV-EVENTS-2440 - stale answers and push filtering in the event centre, the event page and the case page

Plan row: `pilot/CR-INV-EVENTS-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md` (batch suffix `-2440`).
Review findings: 06:RACE-3, 06:RACE-4, 06:EVT-1, 06:EVT-2, 06:RACE-7 (case detail only).

Base: `pilot/CR-POLL-SCREENS-B-2440` (4eddadb04), not the train directly - this branch uses `frontend/src/api/latest.ts`
(the "newest read wins" guard) that was added there. Merge order for the lead: CR-POLL-SCREENS-B-2440 first.

## What changed and why

| Finding | Before | Now |
|---|---|---|
| 06:RACE-3 | every filter control of the event centre read the list; a slow answer for an earlier filter overwrote the rows of the filter that is selected | `load()` takes a `Latest` token; an answer (or a failure) of a read that is no longer the newest is dropped |
| 06:RACE-4 | the event page read `this.eventId` after an await with no guard, then fanned out route / correlation / nearby / map reads and started playback for whichever answer landed last | the id is captured before the first await; the page checks after `stopPlayer()` and after `getEvent()`, in the try and the catch; each fan-out answer (route, correlation, nearby, the map, a player error) is applied only while its event is the one shown |
| 06:EVT-1 | a pushed event was tested against date, camera, recorder and type only, so it was prepended to a list filtered by source, by "handled / to review", by place or by text | `pushedAction()` also tests the source and the handled filter in the browser; with a place or a text filter set a new event is not guessed in - one `load()` is scheduled 1 s later, shared by a burst of pushes. A row the list already shows is refreshed as before |
| 06:EVT-2 | the thumbnail poll was scheduled from inside the table's render with "attempt 0", so the 14-attempt cap restarted on every render and a thumbnail that never arrives was polled for ever; `cameraId` / `date` changed by the route on a mounted screen did not read again; the search debounce and the hover-preview timer stayed armed after the screen left | `ThumbPoller` keeps the count per event id (at most 14 requests, two in flight); the render only records the ids and hands them over in a microtask; `willUpdate` reads again when the route changes `cameraId` / `date` (the screen's own controls are not read twice); `disconnectedCallback` clears the search, hover and push-reload timers and cancels reads in flight |
| 06:RACE-7 (case detail) | `InvestigateCaseDetail.load()` applied the case, the bundles and the error of a case that was left meanwhile | the case id is compared after each await and in the catch |

Behaviour is otherwise identical. Visible differences are exactly the defects above: a non-matching pushed event no longer
appears in a filtered list, and a thumbnail that stays pending stops being asked for after 14 requests.

## Resumed work (16.11 PM)

The previous account stopped mid-branch with the three screens, `investigate-events-logic.ts` and the unit spec written but
not committed, and no change note. The second pass read the diff against the row and the five findings and found nothing
to correct; it added this note, ran the checks below and committed.

Decisions taken without an owner answer (recommendation applied):
- 06:EVT-2 suggested scheduling from `updated()`. The rows are drawn inside `sw-table`'s render, not this element's, so the
  ids are collected during the paint and handed to the poller in a microtask right after it. Nothing is scheduled from a render.
- A thumbnail that used its 14 requests is not asked for again while its row stays in the list (also across a re-read of the
  same list); a push that says it is ready still shows it. The count is forgotten when the row leaves the list.
- 06:EVT-1 "the range": a pushed event is new, so the existing day test covers it; no separate range test was added.

## Files

- `frontend/src/screens/investigate-events.ts`
- `frontend/src/screens/investigate-events-logic.ts` (new: `pushedAction`, `ThumbPoller`, no DOM)
- `frontend/src/screens/investigate-event-detail.ts`
- `frontend/src/screens/investigate-cases.ts` (`InvestigateCaseDetail.load` only)
- `frontend/tests/unit-inv-events-2440.spec.ts` (new)
- `docs/changes/CR-INV-EVENTS-2440.md`

Outside my rows: none.

## Tests actually run

Workstation, 16.11 PM:
- `npx tsc --noEmit` (frontend): exit 0.
- `npx playwright test -c playwright.unit.config.ts tests/unit-inv-events-2440.spec.ts --workers=1`: 13 passed, 0 failed
  (reversed answers for two filters and for two event ids; a push with a non-matching source while filtered; a pending
  thumbnail makes at most 14 requests across 200 renders; the three screens' sources pinned).

NOT_RUN:
- `tests/evidence-events.spec.ts` (the row's existing spec): it runs only with `SW_LIVE=1` against the developer backend and
  the lab recorder; this batch has no device or lab access. For the runner / the closing chain.
- The other browser specs of the event centre (`evidence-events-polish`, `evidence-events-hover`, pixel and layout suites):
  no local build or preview in this batch. No entry check (batch rule).

## Pixels to refresh

None expected: no markup or style changed.
