# FIX-VIDEO2-2570 (2.57, second deep review, area video / devices)

Findings VD2-02, VD2-04, VD2-06..VD2-11 of `docs/review/DEEP-REVIEW-2570-VIDEO-DEVICES.md` (branch
`origin/review/DEEP2-2570-VIDEO-DEVICES`). Base `origin/release/2570-train` = v2.56.0 (`6ea807b2e`); every finding was confirmed still
present at the base (each new test below fails there). Not in this row: VD2-01 / VD2-03 (FIX-AUTOMATION-2570), VD2-05 (FIX-FE2-2570).

## What changed

- **VD2-02** `routers/automation_ext.py`, `services/automation_ext.py`: "detect by pressing" reads the device's trigger list and listens
  (up to `automations.wall_listen_s`) inside `unlocked(conn)`; only the audit row is written afterwards, in a short transaction. The
  per-caller guard is real now: a set of callers whose listen runs, released in `finally`; a second listen of the same caller is
  409 `listen_running` (he/en text `ext.listen_running`). The 1-second spacing (429) stays.
- **VD2-04** `services/timeutil.py` (`wall_is_repeated`, `instant_in_repeated_hour`, `nvr_span_to_utc`), `services/recordings.py`,
  `services/exports.py`, `routers/playback.py`, `routers/recordings.py`, `wire/playback.py`: a recorder file's wall-clock start / end is
  read with the IANA zone and BOTH readings (`fold`) of the hour the autumn change repeats; readings whose end is not after the start
  are discarded, the shortest valid one wins (the first that overlaps the asked window). A file from 01:40 (first occurrence) to 01:20
  (second) is now 22:40Z -> 23:20Z instead of being dropped; a search inside the second occurrence finds that occurrence's files. A
  spring-gap time is not "repeated" (unchanged behaviour). Whenever a file touched the repeated hour, or a file could not be placed at
  all (counted), the search answers `coverage: partial` with a note (he/en, rendered in the reader's language) - never `complete`.
  The playback screen already shows the partial-coverage note. A playback session created / sought inside the repeated hour carries
  `clock_change_note` (additive optional field) saying the recorder takes wall-clock time only and may play the other occurrence; the
  audit row has `repeated_hour: true`. No fixed offsets anywhere. The export estimate uses the same reading and reports `partial`.
- **VD2-06** `services/recordings.py`: the page loop that stops because the recorder said MORE but sent a page already read is now
  `partial` with its own note (`list_matches_why` returns the reason; `list_matches` keeps its 3-tuple for the export path).
- **VD2-07** `routers/recordings.py`: `?date=2026-02-30` is a 422 `validation` with `details.fields = ["date"]` and a problem
  `invalid_date` (he/en), not a 500.
- **VD2-08** `services/nvr_schedule.py`: provable from the code (the reader made a reversed range of any action ending after midnight on
  a later day). `record_from_track` now splits such an action at every midnight (Monday 22:00 -> Tuesday 06:00 = Monday [22:00, 24:00)
  + Tuesday [00:00, 06:00)); the old "ends next day at 00:00 = to 24:00" rule is the one-day case; each day is ordered by begin. The
  writer writes each range as its own action (same recorded hours). Lab question kept open: whether the lab recorder ever writes such
  an action.
- **VD2-09** `routers/nvr_write.py` (`set_smart`, `smart_partial_error`): when the line document was written and the field document
  fails, the answer is an error with code `smart_partial_write` whose message says which rule was written and recorded (and can be
  rolled back) and why the other failed (he/en); `details.applied.line` is the change record, `details.failed.field` the failure,
  `details.cause` the original code and `details.outcome` kept when the second write's outcome is unknown. The HTTP status is the
  second write's own. Nothing written before it = the original refusal unchanged. (The existing screen shows the message as is.)
- **VD2-10** `routers/views.py`: editing a view keeps the cameras the editor may not watch, at their own places (`_keep_hidden`); the
  answer to the edit shows only the cameras the editor may watch (hidden ones counted) instead of every id. If the kept cameras push
  the view past 16, 422 with a he/en text. Editing a shared view (not only making one shared) needs the right to manage shared views.
  Delete is unchanged (owner or system administrator).
- **VD2-11** `frontend/src/api/frigate.ts`, `screens/reviews-logic.ts` (`settleMark`), `screens/investigate-reviews.ts`: the mark is one
  request per recorder settled on its own (`Promise.allSettled`); `markReviewed` returns the failed items (throws only when every
  recorder failed); the screen reverts only those items (counters follow), never over a list reloaded meanwhile, reverts the drawer
  for them too, and keeps them selected so a retry is one click. The existing "the mark was not saved" notice is reused (no look change).

New texts: `smplwise/services/video_text.py` (`recordings.*`, `nvr_smart.*`, `views.*`, he + en) and `ext.listen_running`.

## Known limits

- A file wholly inside the repeated hour cannot be placed with certainty from wall-clock strings: in a whole-day search it is drawn on
  the first occurrence (shortest, then earliest reading) and the day is reported partial with the note. How the lab recorder names
  files across the autumn change is a lab question (no device access in this row).
- The history-map minute model (`investigate-history-map.ts`) still cannot address the repeated hour; the partial note covers the
  recordings answer only. The playback screen does not show `clock_change_note` yet (frontend follow-up; the search note shows there).

## Tests

See the row report for the runner results (before on v2.56.0 + the new test files, after on the branch head).
