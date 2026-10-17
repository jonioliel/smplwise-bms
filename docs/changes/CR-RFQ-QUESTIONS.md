# CR-RFQ-QUESTIONS - a vendor's question is visible and answerable

Status: built on `pilot/RFQQUESTIONS` (from `integ/264` @ 75f41b19), 2026-10-17. Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.4
section 21. Migration **0104** (provisional 0106 on the branch, renumbered at the integ/264 integration).

## Owner report (2026-10-17)

When a vendor attaches a question (or a note) to his quote, the manager does not notice it: nothing visible says "a vendor wrote to you".

## What was there before (investigation)

* The vendor page already had a question box (`POST /t/api/rfq/message`): the text went to the vendor's private thread
  (`ticket_rfq_messages`, `direction = 'in'`), a timeline row `vendor_message` (shown as a generic "update") and, since TKRFQ5, the
  `rfq.question` notification (resolved when a manager wrote to that vendor). No unread / answered state, no badge anywhere, the box sat at
  the bottom of the page under the quote.
* The quote form's "הערות" (`ticket_quotes.note`) is where vendors actually wrote questions. It is shown only in the comparison's notes row
  (costs.view holders), never on the list, the board or as anything that waits for an answer.

## Decisions (made here; numbered for the owner's review)

1. **A question is an inbound thread message with a state** (pending / unread / answered), not a new table: the vendor's page box, the
   quote form's NEW separate "שאלה לארגון" field (stored with the quote id - the note stays a note) and a WhatsApp reply (unverified,
   managers only) are all questions. Every inbound message counts as a question.
2. **Visibility**: a red "N שאלות ממתינות · חדשה" badge on the list row (plus a KPI tile), on the request header, on the vendor's row of
   the board, on the vendor's column of the comparison (whose clarifications button turns into "מענה (N)"); a "שאלות ממתינות" section at
   the TOP of the request with "מענה" / "טופל בלי תשובה"; a red count on the "בקשות הצעת מחיר" tab and on the tickets area icon (rail and
   phone bar); the existing `rfq.question` notification plus a new `rfq.question_unanswered` reminder - both to the `rfq_managers` rule,
   through the engine's channel preferences and quiet hours, WhatsApp off by default. A "הערת ספק" chip marks a quote with a note.
3. **Badges count only while the request is open** (sent / collecting / due_passed). After award / close / cancel nobody can act; the
   thread still says "never answered".
4. **Unread is shared** by the request's managers (the first manager who opens the thread or the answer dialog clears "new" for all);
   pending stays until answered. Per-manager unread would need a new table - not built (owner question 1).
5. **The nav badge counts only requests the user MANAGES** (section 6 rule); a plain viewer, who cannot answer, sees no badge.
6. **Answer flow**: "מענה" opens one dialog: the question, the answer, "למי לשלוח" = **only the vendor who asked (default)** or every
   vendor of the request. For "every vendor" the question is shown as the manager words it (default: the vendor's text - editable, e.g.
   to remove a phone number) and the asker is named only when "לציין את שם הספק ששאל" is ticked (default off). Then the preview step
   "לשלוח הודעה לספק?" / "לשלוח הודעה ל-N ספקים?" shows the exact text each vendor will see and whether a notice goes; nothing is stored
   until "שליחת התשובה". Each vendor gets his own copy in his own thread; with "notify" the templated `rfq_update` notice (never the free
   text) goes through the existing outbox, so the send-hours rules apply. Idempotent by `client_request_id`.
7. **A plain message to the vendor also answers his pending questions** (the TKRFQ5 rule, now stored); an award draft does not.
8. **"טופל בלי תשובה"** (answered by phone) clears the badge and sends nothing; the vendor page does not claim "answered" for it.
9. **Reminder**: `rfq.question_reminder_hours`, default 24, 0 = off, once per question. The `rfq` settings section had no route at all;
   `PUT /tickets/settings` now accepts `rfq: {...}` (all six keys, settings_doc ranges). There is no settings UI for it yet (owner question 3).
10. **Award warning**: the confirm dialog of the comparison shows "יש N שאלות של ספקים שלא נענו. מומלץ לענות לפני האישור." and names
    the selected vendors that asked. It warns, it does not block.
11. **Vendor page**: the quote form's question field (optional, <= 2000, he / en / ar / ru), "ההצעה והשאלה נשלחו" after a send, and a
    "נענתה" / "ממתינה לתשובה" chip on his own questions. ar / ru strings are developer translations pending a native review (as before).

## Security / privacy

* A vendor sees only his own thread: a vendor-only answer is stored in the asker's thread only; an answer to every vendor is stored per
  vendor and names nobody unless the manager chooses it; the question text shown to the others is the manager's (editable) wording.
* Manager routes: visibility first (uniform 404 `rfq_not_found`), then the RFQ manager rule (audited 403); another request's / an
  outbound / an unknown message id is 404 `message_not_found`.
* Limits: answer <= 2000, shown question <= 1000, the vendor's question <= 2000, 30 inbound messages per vendor (a refused question stores
  no quote). Text hygiene on every text; the screens render text bindings only (no `innerHTML`).
* Audit and timeline rows: ids, scope, counts - never a text, never a name. Notifications: the reference, the place, the hours - never the
  text or the vendor.

## Tests

Backend `tests/test_tickets_rfq_questions.py` (negative first: who may not answer, unknown ids, limits, a second answer, privacy between
vendors, audit without text, preview / resolve send nothing, no badge for a viewer; then the flows, the reminder, the end of the request,
the migration backfill). Frontend `tests/unit-rfq-questions.spec.ts` (the badge / warning / form rules, the wire body, the demo answer
plan's privacy, the nav badge, the vendor page's field, the words) and `tests/layout-tickets-rfq-questions.spec.ts` (desktop / tablet /
phone: section in view, no overflow, 44 px targets, badges, the answer dialog, the award warning).

## Owner questions

1. Unread is one shared state per request (the first manager who opens it clears "new" for everyone). Keep (א), or per manager (ב - a
   new table)?
2. "Answer every vendor": the question text defaults to the vendor's own words (editable). Keep (א), or start empty and make the manager
   write the general question himself (ב)?
3. The reminder hours (default 24) are settable through the API only. Add a field to the module's settings screen (א), or leave it API-only (ב)?
4. The award warning only warns. Keep (א), or require an explicit "I know" tick before approving with unanswered questions (ב)?
5. Should the nav badge also count questions for an all-departments viewer who is not a manager (א - no, as built; ב - yes)?
