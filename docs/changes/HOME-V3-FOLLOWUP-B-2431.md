# HOME-V3-FOLLOWUP-B-2431 - home interface v3 follow-up B: wall panel calendar event, ticket photo

Branch `pilot/HOME-V3-FOLLOWUP-B-2431` from `origin/release/2430-train` (60d20c9de, v2.43.0) with `origin/pilot/HOME-V3-P2-2431`
(85f4c5e0a, migration 0214) merged in (93efee343). Owner answers of 2026-11-11, questions 1-3. No migration, no version bump, no
CHANGELOG, API inventory not regenerated. Nothing in `private/`, `secrets/`, `management/*.json` or the lab was touched. The parallel
branch `pilot/HOME-V3-FOLLOWUP-A-2431` (per-person lists, the visitor-invite switch, new categories, the bill button) is not touched:
this branch's code lives in new files, with small hooks in `home-calendar.ts`, `home-tickets.ts`, `home-styles-v3.ts`, `main.py`,
`body_limit.py` and `services/home_interface.py`.

## Merge of P2 into the train (conflicts resolved)

`home-api.ts`, `sw-home.ts`, `sw-home-admin.ts`, `services/home_interface.py`: both phases kept (module lists, labels, imports, room
chips). `MODULES` order: phase 2's categories first, phase 3's six stay the tail (`test_home_v3_p3` pins the tail). The train will meet
the same four conflicts when P2 joins it; this branch's resolution can be reused.

## What changed

### 1. Wall panel: add an event to the family calendar (owner q1)

* `POST /home/wall/events` (new, `routers/home_wall_events.py`): only for a wall panel (`kiosk` policy; anyone else 403
  `wall_panel_only` - they use the module's own `POST /calendar/events`). Body `{title, start, end, all_day?, calendar_id?}`, every
  other field refused (422): always kind `event`, never a room, series, guest, attendee or maintenance window. The calendar must be a
  family calendar (type `team` / `event`, not archived; a room -> 403 `wall_family_calendar_only`); without `calendar_id` the first
  family calendar where the panel's role is `book`+. The module's own `events.create` runs with the panel's own principal, so its role
  rule (`book` + `calendar.book`) and every validator apply. Module off -> 404 `feature_disabled`; the panel's hidden `calendar`
  category -> 403 `home_module_off`. Audited `calendar.event.create` with `via: wall_panel`.
* Allowlist (`services/home_interface.py`): `/home/wall/events` added to `HOME_ALLOWED_EXACT` (one POST route). New
  `KIOSK_REFUSED_WRITES_*`: for a wall panel the module's calendar writes - `POST /calendar/events`, `/calendar/availability`,
  `/calendar/events/preview`, anything under `/calendar/events/{id}` (cancel, withdraw, patch) - are refused 403
  `kiosk_calendar_add_only` (audited at most once per person per `GATE_AUDIT_EVERY_S`). Before this branch a wall panel could reach a
  booking by calling the module route directly (the UI only hid it). Reads stay open. A home-only person who is not a wall panel keeps
  the module routes (booking etc.) unchanged. Notice posting stays refused for every home-only person (no notice write is allowlisted).
* UI (`home-calendar.ts`): "אירוע חדש" is now offered on a wall panel; its save goes to the wall route. The shared-rooms tab stays
  hidden on a wall panel.

### 2. Photo on a new ticket (owner q2)

* The tickets module already had the photo pipeline (`services/tickets/attachments` + `image_intake`: structure walk before Pillow,
  pixel budget, metadata-free re-encode to a fresh JPEG - EXIF / GPS never stored - 2048 px, storage cap, decode slot, confined random
  name). Reused as is.
* `POST /home/tickets/{ticket_id}/photos` (new, `routers/home_ticket_photo.py`, multipart `file`): the caller's OWN ticket only
  (creator; anything else the uniform 404), only while it is `new` and at most 30 minutes after it was opened (409 `ticket_not_new`),
  at most 3 photos from this route (409 `too_many_photos`), `image/jpeg` / `image/png` only (415 `image_type`; a lying file is refused
  by the pipeline). The module's own `check_attach` / `record_attachment` (write rule, 60-photo cap, timeline row, audit `ticket.photo`)
  run, re-checked after the decode (the lock is released for it). Tickets module off -> 404 `feature_disabled`; hidden category -> 403.
  Body limit row `home_ticket_photo` (8 MiB + framing). Allowlisted for home-only through the existing `/home/` prefix; the module's own
  `POST /tickets/{id}/attachments` stays refused to a home-only person.
* UI (`home-tickets.ts`, `home-fb-api.ts`, `home-styles-v3.ts`): the new-ticket sheet gets the mockup's three-button row with
  "צרף תמונה" (a file picker label, JPEG / PNG, 8 MB, up to 3), small previews with a remove button, then the photos are sent one by one
  after the ticket is opened; a refused photo still leaves the ticket sent and says so. Hidden when the tickets module is off (the whole
  screen is) and on a wall panel (no new ticket there, unchanged).

### 3. Open ticket (owner q3)

No change: an open ticket keeps "הוסף הערה" only; the photo route refuses a ticket that is no longer new.

## Tests

(see the report below)

## Rollback

Revert the branch's commits. No migration, no stored setting; photos already attached stay as ordinary ticket photos.
