# RESPONSE-HINTS-2480 - the conflict hint names what holds the slot (N57) and the announce channel in the channel lists (N58)

Owner decisions Q18 (N57) and Q19 (N58), both "yes". Base `main` 619f94d04 (release 2.47.0). Branch `pilot/RESPONSE-HINTS-2480`.

## Q18 (N57) - calendars: the conflict names the entry

* Server: every row of `details.conflicts` (409 `conflict`, `maintenance_window`, `slot_held`, `displace_disabled`, the
  maintenance-window `conflict`, and `POST /calendar/events/preview`) gains `title`
  (`services/calendar/events.py: name_conflicts`). The title is sent only where the caller would read it on the grid of the
  calendar that holds the slot (contract 6.3 `detail_level`, the same rule as `occurrences()`); otherwise `title: null`.
  The time range is the row's existing `start` / `end`. Additive: the error envelope keeps its five keys and the extra data
  is under `details` (ADR-019 on `pilot/API-CONTRACT-ADR-2490`; ADR-015 compatibility rule). `wire.CalConflict.title`
  (optional, nullable) and the regenerated `frontend/src/api/generated/wire-calendar.ts`.
* UI: `frontend/src/calendars/conflict-hint.ts` (`calErrorText`): the refusal text is followed by
  `מתנגש עם "<title>" · dd.mm hh:mm–hh:mm` / `מתנגש עם הזמנה אחרת · ...` (hidden) / `מתנגש עם המועד ...` (an older server
  without the key); the time range is a left-to-right isolate. Used by the booking drawer (create, edit), the grid (quick
  create, move / resize, duplicate, undo, approve), the resident flow, the maintenance drawer and the approvals list.
  The drawer's live "המועד תפוס" hint shows the full range and "הזמנה אחרת" for a hidden title; the displace question uses the
  server's title first. English in `i18n/lang/en/i18n/msg/calendars.ts`.

## Q19 (N58) - notifications: "הכרזה" in the channel lists

* `Channel` gains `announce`; `CHANNEL_LABEL.announce` = הכרזה / Announcement (glossary); the delivery log column keeps the
  channel as text (no pictogram), the failures panel names it, the own-delivery line says "בהכרזה".
* Settings > Notifications: a "הכרזה" switch in every source row (the policy flag `channels.announce` the server already
  validates) and a card in "ערוצים" (on while a source routes to it). Pictogram `horn` added to `NOTIFY_ICONS` (the same path
  data as the home screen's announcement tile). The demo log has one spoken announcement.
* Known: at 1440 px the sources matrix already scrolled sideways before this change (WhatsApp / Companion clipped); the new
  switch sits after WhatsApp. Question to the owner in the compare page.

## Tests

* Backend: `tests/test_calendar_engine_2300.py` (+3: named for a reader, hidden for a busy-only viewer incl. preview, named on
  `slot_held`), `tests/test_wire_calendar_2470.py` (the key set of a conflict row).
* Frontend unit: `tests/unit-calendars-conflict-hint-2480.spec.ts`, `tests/unit-notify-announce-2480.spec.ts`;
  `unit-notify-center` (failures panel), `unit-icon-registries` (the added `horn`); evidence `evidence-notifications`
  (log row count 14 -> 15, the announce card and row) - evidence / pixel suites run on the runner only.
* Before / after captures (demo data, 1440 and 390): `private/planning/response_hints_2480_compare_2026-11-23.html`.

Rollback: revert the branch commits; the server change is additive (a client that ignores `title` is unaffected).
