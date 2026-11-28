# FIX-CALENDAR-2570 - calendar findings of the second deep review of 2.57

Base: `origin/pilot/FIX-COMMS-2570` (it changed `services/calendar/occ.py` and `events.py`). Findings:
`docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md` (branch `origin/review/DEEP2-2570-COMMS-UTILITIES`) - CU2-01, CU2-02, CU2-03,
CU2-12, CU2-13, CU2-30; and, added by the lead, SA2-06 of `docs/review/DEEP-REVIEW-2570-SECURITY-ADMIN.md`.
Each finding was confirmed at the base by reading before it was fixed.

## What changed

### CU2-01 (medium) - a full re-sync no longer cancels entries outside the listed window
- `PullResult.window` (additive): the span a FULL listing covered. Google reports `(timeMin, None)`, Graph `(now - 30 d, now + 400 d)`,
  iCal IN `(now - 30 d, now + 400 d)` (its feed expansion has the same window - the same bug existed there on every feed change).
- `engine._apply_pull`: on a full listing, a mapped entry that was not listed is treated as deleted outside Arx only when it overlaps
  the listed window by more than one day on each side (`_inside_listing`; a series by its occurrences in the window). Entries outside
  it are left alone (not cancelled, rooms not released, the link kept so a later incremental deletion still reaches them).
  A listing without a window (the reference fake) keeps the old rule.
- `FakeAdapter.window` (test control) models a windowed listing.

### CU2-02 (medium, plausible) - a recurring series keeps its master identity
- `ExtEvent.series_uid` / `ExtDeletion.series_uid` (additive): Google `recurringEventId`, Graph `seriesMasterId` (documented fields of
  `events.list?singleEvents=true` and `calendarView/delta`).
- `engine._external_upsert`: an instance of a mapped series is an echo of the series row (never a new entry, never a replacement of
  the row); an instance of our series without a series row (binding recreated, or a row 2.56 overwrote with one instance's id) re-links
  / repairs the row to the master id. A non-series entry that is linked already is never re-linked to a second copy (no more
  `INSERT OR REPLACE`).
- `engine._apply_pull`: a cancelled single occurrence of a mapped series does not cancel the series (occurrence edits made outside Arx
  stay a later refinement, contract 12.4 note); the series itself is cancelled when the provider reports the master deleted, or on a
  full listing when none of its occurrences inside the window is listed.
- Microsoft side effect: Graph delta never returned our marker, so instances of our own series used to be imported as new "external"
  entries on a two-way binding; they are now recognised by `seriesMasterId`. Copies imported by earlier versions are cancelled at the
  next full listing (they are not linked to a listed id any more).

### CU2-03 (medium) - bindings use only the caller's own connection (owner decision a)
- `PUT /calendar/calendars/{id}/binding` and `GET /calendar/connections/{id}/calendars`: the connection must be the caller's own, or the
  caller a system administrator; otherwise the audited 403 (`calendar.connect`, reason `owner`). Unbinding stays an `edit` right.
- `tests/test_calendar_sync_2300.py::test_binding_needs_an_edit_role_in_the_calendar` pinned the old behaviour (cora bound to the
  administrator's connection, 200); it now binds through her own connection and asserts 403 on the administrator's.

### CU2-12 (low) - a sync in flight never overwrites the owner's change; the lease is held
- `_ok` / `_failed` write only when `cal_connections.revision` is still the one the run started with (pause, resume, a new
  authorisation and a client change bump it); the report then carries the current state.
- `run_connection` takes the lease with its own holder id, renews it after each pull, in the apply transaction and every 120 s during
  the pushes; a run whose lease was taken over applies nothing more (`skipped: lease_lost`), records what it already pushed and frees
  only its own lease. `acquire_lease` / `release_lease` keep their old call shape (holder optional).

### CU2-13 (low) - a rotated refresh token never outlives a disconnect / a client change
- `credentials.RUNTIME.store_refresh(cid, token, replaces=...)`: stored only while the connection exists and still holds the token the
  refresh used; `oauth.access_token` passes it and does not cache an access token whose rotation was dropped.
- `credentials.purge_orphans` (run on every connection removal) deletes `calendar.conn.<id>.*` keys of connections that no longer exist.

### CU2-30 (low) + SA2-06 (low, owner decision a) - calendar settings
- `PUT /calendar/settings` and `PUT /calendar/attendee-settings` take `?merge=true` (additive): the body holds only the changed keys,
  laid over the stored document. Without it the old whole-document rule stays.
- SA2-06: the calendar settings document has a version (`calendar.settings.revision`, +1 on every save that changes something).
  `GET` and `PUT` answer `revision` (additive, wire models and the generated types updated); a `PUT` with `base_revision` that is not
  the stored one is `409 revision_conflict` ("הגדרות היומנים שונו בינתיים על ידי מישהו אחר. ההגדרות נטענו מחדש - יש לבצע את השינוי
  שוב." / English in `error_text_en.json`) and stores nothing - a screen left open can no longer roll back the guest retention.
- Screens: `system-calendars.ts` and `system-calendar-sync.ts` send the changed keys only with the version they loaded, save one at a
  time, and on a conflict reload the settings and show the server's text. The steppers use `calendars/step-saves.ts`: one debounce per
  key (two steppers no longer cancel each other), the shown value captured when a burst begins (a refused save restores it), and a
  pending policy change is sent to its own calendar before the calendar picker switches. No visible look change (no compare page,
  no baseline refresh).

## Not changed / notes
- The connections screen still shows "שיוך יומן" on another person's connection; the server now refuses it (the dialog shows the
  403 text). Hiding the button needs an additive `mine` flag on the connection - left for a later row.
- Old clients that PUT the whole settings document without `base_revision` are not refused (additive API).

## Tests (runner, slot B, `SW_WIRE_STRICT=1`, one pytest process per file)

New: `smplwise_vms/backend/tests/test_calendar_sync_fix_2570.py` (19 tests; provider data are fixtures in the documented Google /
Graph shapes, no network) and `frontend/tests/unit-calendar-step-saves-2570.spec.ts` (6 node-only tests).

BEFORE (base `origin/pilot/FIX-COMMS-2570` with the new tests):
- `test_calendar_sync_fix_2570.py`: 18 failed, 1 passed (the CU2-01 window test passes there only because the base fake lists
  everything); re-run with the new fake + adapters and only the base `engine.py`: both CU2-01 tests FAIL (`cancelled` 3 instead of 1;
  2 instead of 0), the no-window control passes.
- `test_calendar_sync_2300.py` (updated CU2-03 test): 1 failed (`assert 200 == 403`), 37 passed.
- `unit-calendar-step-saves-2570.spec.ts`: fails (module `calendars/step-saves` does not exist).

AFTER (branch):
| File | Result |
|---|---|
| `test_calendar_sync_fix_2570.py` | 19 passed |
| `test_calendar_sync_2300.py` | 38 passed |
| `test_calendar_connect_2330.py` | 30 passed |
| `test_calendar_attendees_2343.py` | 20 passed |
| `test_calendar_feed_review_2351.py` | 16 passed |
| `test_wire_calendar_2470.py` | 3 passed |
| `test_calendar_engine_2300.py` | 45 passed |
| `test_calendar_far_series_fail_closed_2570.py` | 3 passed |
| `test_error_contract_inventory_2490.py` | 7 passed |
| ruff (`smplwise` + the two test files) | clean |
| `scripts/gen_wire_types.py --check` | exit 0 |
| `tsc --noEmit` | exit 0 |
| eslint (changed frontend files) | 0 errors |
| `unit-calendars-attendees-2343`, `unit-calendars-feed-remote-2351` | 15 passed |
| `unit-calendar-step-saves-2570` | 6 passed (at 0241dcb3f; at 72cc1e388 one static check still expected the pre-SA2-06 call text) |

NOT_RUN: the browser specs (evidence / layout / pixel - no look change), the rest of the backend suite (the train gate runs it),
any real Google / Microsoft account (no network in this task).
