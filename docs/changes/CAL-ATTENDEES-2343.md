# CAL-ATTENDEES-2343 - named attendees of calendar entries

Branch `pilot/CAL-ATTENDEES-2343` (from `release/2340-train`). Owner approval 2026-11-02 (calendar Outlook round, answers 6C and 7B).
The sibling branch `pilot/CAL-GRID-EDIT-2343` builds the grid editing, the editable drawer and delete-with-undo; it plugs this branch's
picker in. This branch owns the attendee data model, the API, the notices and a self-contained picker component.

## 1. Owner decisions implemented

| Decision | What it means here |
| --- | --- |
| 6C - who can be invited | Arx **users** (`users.id`), **residents** (people in the directory the access module uses: `ticket_contacts` kind `person`), and external **guests** (name + phone or e-mail, no system access). |
| 7B - how they are told | An **in-app Arx notification** (the CR-018 pipeline) for users and for residents linked to an Arx account; the **configured messaging channel** for guests and for residents without an account (WhatsApp today; SMS and e-mail are registered as "soon"). |
| delete with undo (approved 02.11) | A cancel notice waits the undo window (`cancel_notice_delay_s`, default **6 s**) and goes out only if the entry is still cancelled. |
| every behaviour is a setting | Installation document `calendar.attendees` + a per-calendar policy row (section 5). |

## 2. Data model - migration `0190_calendar_attendees.sql`

0190 is the next number after the highest on the base (0189, `0189_home_mapping.sql`); the sequence stays contiguous (pinned by
`test_migration_0190_tables_constraints_and_sequence`). If another branch with a 0190 departs first, the lead re-sequences at assembly.
Additive only; rollback = drop the three tables.

- `cal_attendees` - one row per attendee of the ROOT entry (the series id of a recurring entry; an override row's attendees are its
  series'): `kind` user | resident | guest, `ref_id` (users.id / ticket_contacts.id; NULL for a guest - a CHECK enforces it), the guest's
  `name_sealed` / `phone_sealed` / `email_sealed` (connection_store `v1:`, associated data `cal_att|<attendee id>|<field>`), `has_phone` /
  `has_email`, `role` required | optional, `invite_status` invited | accepted | declined | tentative, `notified_at`, soft removal
  (`removed_at`, `removed_by`), `erase_after` / `erased_at` (guest retention). A unique index stops a user / resident appearing twice.
- `cal_attendee_policy` - per calendar (a missing row reads as the defaults).
- `cal_attendee_notices` - the notice outbox (`invite` | `change` | `cancel` | `removed`, optional `occurrence_start`, `channel` chosen at
  send time, `state` queued | sent | skipped | retracted | failed, `reason`, `not_before`, `attempts`). Never an address or a text.

Users and residents are references only; their phone / e-mail stay in their own directory and are read at send time.

## 3. Permissions

Same order as every calendars route: signed in -> module switch (404 `feature_disabled`) -> the entry's calendar visible (uniform 404) ->
permission (audited 403, `calendar.attendees`) -> validation (422) -> state (409).

- **Organizer** (with at least `book`) and the calendar's **editors / managers** (`edit`+): add anyone, remove anyone, change a role.
- **Anyone else who sees the entry** ("a resident"): only himself (`self_join` on), and - once he is an attendee - guests of his own
  (`guests_mode = anyone`); he removes himself and his own guests; he answers for himself (`PUT .../attendees/me`).
- Guests at all: `guests_mode` organizer (default: organizer and managers) or anyone; `off` refuses every guest (422 `guests_not_allowed`).
- `max_attendees` per calendar (422 `too_many_attendees`). Writes only while the entry is pending / confirmed and not finished.
- The picker's directory: users for holders of `calendar.book`; residents only for holders of `calendar.book_for_others` /
  `calendar.manage` (or the administrator). Names only. A resident linked to an account is offered once, as that user.

## 4. API (routers/calendar_attendees.py)

| Route | Purpose |
| --- | --- |
| `GET /calendar/events/{eid}/attendees` | the view: `count`, `list_visible`, `attendees`, `me`, `can {manage, join, add_guest, respond, leave, contacts}`, `policy` |
| `POST /calendar/events/{eid}/attendees` | `{attendees: [...]}`; `{"kind": "user", "ref_id": "@me"}` = the caller (the drawer's "join") |
| `PATCH /calendar/events/{eid}/attendees/{aid}` | `{role}` |
| `DELETE /calendar/events/{eid}/attendees/{aid}` | remove (soft) |
| `PUT /calendar/events/{eid}/attendees/me` | `{status: accepted | declined | tentative}` |
| `GET /calendar/attendees/directory?q=` | the picker's search |
| `GET/PUT /calendar/calendars/{cid}/attendee-policy` | the calendar's policy (`manage` role; `revision` optional, 409 `stale`) |
| `GET/PUT /calendar/attendee-settings` | the installation document (`calendar.configure`) + the channel list (`live` / `soon`) |

The entry routes of routers/calendar.py accept attendees too:
- `POST /calendar/events` - `attendees: [...]` (checked BEFORE the entry is written: an API error still commits the transaction);
- `PATCH /calendar/events/{eid}` - `attendees` = the full desired list (users / residents matched by reference, existing guests kept by
  `keep_attendee_ids`). A PATCH with only `attendees` (+ `revision` / `scope`) does not touch the entry.
- Item shape: `{kind: user | resident, ref_id, role?}` or `{kind: guest, name, phone?, email?, role?}` (phone or e-mail required; phone
  normalised like the existing guest details: local `0` -> `+972`, `00` -> `+`).

## 5. Settings

Installation (`calendar.attendees`, validated, unknown keys refused):
`enabled` (true), `cancel_notice_delay_s` (6; 0-120), `guest_channel_order` (["whatsapp", "sms", "email"]), `notify_users_inapp` (true),
`notify_guests` (true).

Per calendar (`cal_attendee_policy`): `guests_mode` off | organizer | anyone (organizer), `self_join` (false), `max_attendees` (50; 1-500),
`notify_on_change` (true), `list_visibility` organizer | attendees | viewers (organizer).

No settings screen in this branch (the drawer slice belongs to the sibling branch); the API is ready for a "מוזמנים" block in
Settings > יומנים and in the calendar's manage view.

## 6. Privacy

- A viewer gets the **count only**; at the `busy` detail level not even that (`count: null`). The list goes to the organizer and managers,
  plus the attendees (`attendees`) or every viewer with titles (`viewers`). An attendee always sees his own row.
- A guest's phone and e-mail go to the **organizer and managers only** - never to a resident (not even for a guest he added), never into a
  notice row, a notification, an audit row or a log line (tests assert it on the raw tables).
- Audit rows carry ids, kinds and counts (`calendar.attendee.add | update | remove | role | respond | policy | settings | notice`,
  `calendar.attendees.erase`).
- Guest contacts are erased on the calendars' guest retention (`guest_retention_days` after the entry's end; recomputed on edit and
  cancel), hourly, always - also while the module is off.

## 7. Notices (services/calendar/attendee_notices.py)

Written in the request's transaction, sent by the janitor tick (every ~30 s) after the commit; the decision is taken at SEND time:

- **invite** (on add; never to the person who added himself), **change** (time / recurrence / rooms changed and `notify_on_change`; one
  queued change per attendee, its text built at send time), **cancel** (whole entry or one occurrence; waits `cancel_notice_delay_s`;
  an attendee whose invitation never left is not told), **removed** (only if something already reached him; queued invites are
  retracted).
- An invite / change goes out only while the entry is `confirmed`; a `pending` request waits (re-checked every 2 min); a rejected,
  withdrawn, expired or cancelled entry retracts it; a finished single entry retracts it.
- A cancel goes out only if the entry is still cancelled (or the occurrence still excluded). **The undo hook**:
  `routers.calendar_attendees.on_restore(conn, event_id, now)` (= `attendee_notices.retract_cancel`) retracts the queued cancel notices; the
  send-time check catches a restore without the hook too. The sibling branch should call `on_restore` from its undo path.
- In-app: `notify.emit` with the new sources `calendar.attendee.invite | change | cancel | removed` (category `building`, inbox + web push +
  phone app by default, recipient rule `calendar_attendee` = exactly the attendee, subject kind `calendar_event`, visible only to that
  attendee while the module is on). Params: the entry's title, time and room - never another person.
- External: the guest's address from the seal (a resident's from his directory row; a resident who declined WhatsApp in the directory is
  not sent WhatsApp), the text cleaned like every notification-channel message (`notify_whatsapp.clean`), sent outside the transaction,
  the outcome recorded and audited; `retry` up to 3 attempts, `unknown_outcome` never retried.

### 7.1 Channel selection and THE E-MAIL PLUG POINT

`choose_channel(order, addresses, available)`: the installation's `guest_channel_order`, the FIRST channel that is configured now AND has
the person's address (`phone` for whatsapp / sms, `email` for e-mail). No address -> `skipped: no_address`; an address but no configured
channel for it -> `skipped: channel_unavailable` (shown to the organizer as `last_notice`).

Channels are `GuestChannel` objects in `attendee_notices.CHANNELS`:
- `whatsapp` - live: the messaging module's account for the use `calendar.attendees` (registered here; INHERITS the notifications account
  until an administrator maps another in Settings > ערוץ ההודעות), the shared pacing ledger, the tickets WhatsApp adapter.
- `sms`, `email` - `SoonChannel` (never available).

To add e-mail: implement `key = "email"`, `address = "email"`, `state = "live"`, `available(db) -> bool` (e.g. the notification e-mail
channel's SMTP is configured) and `send(db, notice_id, address, text, now) -> (status, reason)` with status `sent | retry | failed`, then
call `attendee_notices.register_channel(EmailChannel())` at import of the e-mail module. Nothing else changes: the order setting already
contains `email`, the guest form already takes an e-mail, and e-mail-only guests are queued today (skipped with `channel_unavailable`
until the channel exists). SMS plugs in the same way with `key = "sms"`, `address = "phone"`.

## 8. Frontend

New files only, plus one clearly scoped insertion in the drawer:
- `src/api/calendar-attendees.ts` - types, the HTTP client and a demo client (no backend).
- `src/calendars/attendee-logic.ts` - pure logic (Hebrew labels, guest validation mirroring the server, drafts, payload).
- `src/calendars/attendee-picker.ts` - `<cal-attendee-picker>`: a combobox search (arrows / Enter / Escape, `aria-activedescendant`),
  chips with a required / optional toggle (`aria-pressed`) and a remove button, the guest form (labelled inputs, `aria-invalid` +
  `aria-describedby` messages), a polite live region; 44 px targets on the phone. Controlled: emits `attendee-add | attendee-remove |
  attendee-role`.
- `src/calendars/attendees-section.ts` - `<cal-attendees-section>`: new entry = a local list read by the drawer (`payload()`); existing
  entry = loads the view, edits live when `can.manage`, RSVP buttons, join, the count for a viewer.
- `src/calendars/event-drawer.ts` - import + one `<cal-attendees-section>` in the new-entry form and one in the existing-entry view + two
  lines in `body()` that add `attendees` to the create body.

## 9. Tests

- Backend: `smplwise_vms/backend/tests/test_calendar_attendees_2343.py` (19 tests: migration and sequence, create with attendees,
  validation, resident rules, limits and closed entries, desired-list PATCH, privacy and no contact leakage on the raw tables, directory,
  in-app + guest delivery, channel selection incl. the e-mail plug point, change notices and the calendar switch, the cancel undo window,
  pending requests and removal rules, RSVP, residents with / without an account, settings and policy documents, retention, module-off
  visibility, the real WhatsApp path on the fake ha-whatsapp adapter).
- Frontend: `frontend/tests/unit-calendars-attendees-2343.spec.ts` (node; logic + static a11y checks of the markup).

## 10. Not in this branch / open items

- The settings screen blocks for the installation document and the per-calendar policy (API ready).
- A deep link from the notification to the entry (the notification opens `#/calendars/cal`).
- WhatsApp send hours (the tickets `send_hours` window) are not applied to attendee messages; an invite can leave at any hour.
- `contracts/API_INVENTORY.md` is regenerated by the release lead at the train (scripts/api_inventory.py).
- The frontend notification-settings list of sources does not list the four new sources yet (the backend catalogue does).
- Visual evidence (desktop / tablet / phone, RTL) of the drawer section: NOT_RUN in this branch - the sibling branch owns the drawer layout.
