# Investigation / map improvements — evidence (M043, M047, M064)

Branch `pilot/investigate-map-improvements` (from `origin/main` 0b50f9b0, 2.0.1). Three improvements, one commit each,
screenshots before / after at the reference widths (desktop 1440, tablet 1024, mobile 390) in the classic skin, light,
plus the bubble skin in dark on desktop for each screen. Spec: `frontend/tests/evidence-map-improvements.spec.ts`,
run against a throwaway developer backend (port 8372, an empty data directory, placeholder NVR, an unreachable localhost
go2rtc URL so the playback screens render; nothing is contacted). `before/` = the `origin/main` build served from
`dist-before` against the same backend; `after/` = this branch's build.

## M043 — suggested adjacent cameras and Back to the selection (T043)

- `m043-01-suggestions`: the lobby camera picked; the pick bar offers the cameras next to it ("מוצע בסמוך"): the desk
  (same room), the corridor (a room that shares a wall), the yard (within a fifth of the plan). The store, far and
  without a shared wall, is not offered. The relation is the chip's caption; nothing is picked without a click.
- `m043-02-picked`: the corridor added from its suggestion chip; the address now carries `picks=`.
- `m043-03-playback`: synchronized playback opened from the selection (`from=map`); "חזרה למפה" in the page actions.
- `m043-04-back`: Back - the same floor, the same two picks, the picking mode still on, the plan at the same place.
- `m043-05-suggestions-bubble-dark`: the bubble skin, dark scheme.

Rules: `frontend/src/map/adjacent-cameras.ts` (same room → shares a wall → within 0.2 of the plan; the smallest room
containing a pin is its room). The view is kept per floor in `sessionStorage` while picking; the picks in the `picks=`
route parameter written with `replaceRoute` (no history entry).

## M047 — review spotlights and manual grouping corrections (T047)

- `m047-01-windows`: the review windows with the "זרקור" column: the lobby window (motion, motion, person) is lit by
  "זיהוי חכם", the store's video-loss window by "חומרה קריטית · תקינות וידאו". A "זרקורים (n)" chip filters to the lit
  windows.
- `m047-02-drawer-summary`: the window's drawer opens on the summary - severity, confidence, sources, the rules met
  with their reasons; the raw events stay behind "N אירועים מקוריים".
- `m047-03-drawer-events`: the raw events opened, each with a tick.
- `m047-04-split`: the person event split off into its own window ("קיבוץ ידני"); the pair of motions stays automatic.
- `m047-05-spotlights-only`: the spotlight filter.
- `m047-06-windows-bubble-dark`: the bubble skin, dark scheme.

Rules: `smplwise/services/spotlights.py` (critical 3, smart detection 2, video integrity 2, door + activity 2, several
cameras 1, burst of 5+ 1, 10+ minutes 1; lit at 2 or more; deterministic over the events, no time of day). Manual groups:
migration `0059_event_window_groups.sql` (written as 0057, renumbered at the 2.0.3 integration), `POST /events/windows/groups`, `DELETE /events/windows/groups/{id}`; the raw
events are never changed.

## M064 — route ranking through floor connectors and one-click confirm into a case (T064)

- `m064-01-route`: the route card of a person event in the lobby: the desk (same room), the corridor (adjacent), the
  yard (nearby), then the stairwell camera on floor 1 reached through the lobby's stairs ("מדרגות ↑ קומה 1"), each with
  a tick and the window's activity; the case choice and "אשר מסלול לתיק (4)".
- `m064-02-confirmed`: one click - a new case with the event and a clip per suggested camera over the route window,
  every clip's note saying it is a hypothesis, never an identification.
- `m064-03-route-bubble-dark`: the bubble skin, dark scheme.

Ranking: `smplwise/services/correlation.py` (`floor_connectors`, `suggest_route`): the published stairs / elevators within
0.35 of the event camera (or in its room) lead to the cameras within 0.2 of their twin on the other floor (or in the
twin's room), ranked after everything on the floor. Confirm: `POST /events/{id}/route/confirm` (`routers/cases.py`),
only cameras the route suggests, `cases.manage` + `video.playback` per camera, audited as `case.route.confirm`.
