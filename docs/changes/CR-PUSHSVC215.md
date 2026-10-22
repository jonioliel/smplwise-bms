# CR-PUSHSVC215 - phone-app push about service requests

Status: implemented on `pilot/PUSHSVC-295` (from `main` @ `750a1d049`, v2.12.2). Board item r123. No migration, no new permission, no new
channel, no relay change.

## What changes

The phone app (`app` channel, `services/mobile_push.py`, `docs/api/mobile-presence-contract.md`) is told about service requests through the
existing CR-018 pipeline. Two new notification sources join the tickets catalogue (`services/tickets/notify_sources.py`, category
`tickets`, severity `info`, recipient rule `ticket_assignee` = the user in `origin.user_id`, one row per person and event):

| Source | When | Who is told |
|---|---|---|
| `ticket.status_update` | the status changes (any route: manager, assignee, handler link, WhatsApp reply, SLA auto-close) | the requester (`created_by`, an active Arx user) and the internal assignee, except the person who acted |
| `ticket.comment_added` | a note is added (web or handler link) | the same two, except the author, and only if the note is visible to that person by the timeline's own rule (`access.event_visible`): an internal note never reaches the requester |

`ticket.assigned` already told the assignee; it now also has the `app` channel on by default. The `app` default is the catalogue
`Source.app` flag (like the other app sources); it applies to policy rows created from now on, an existing installation's row keeps
its stored channels until an administrator switches `app` on in the notification matrix.

## Rules kept

- Module off: the bridge emits nothing and the policy matrix does not list the sources; there is no "open service request" action.
- Text: ticket number, place and status label only. A note's text, a title, a reason or a name never enters a notification.
- Visibility: the engine re-checks `access.visible` per recipient (also on retries). Rule tickets (`created_by = "system"`) and contacts
  have no requester to tell.
- Mute and quiet: unchanged `AppPushChannel.plan`. Severity is `info`, so the device's per-category mute (`tickets`), quiet hours (the
  matrix's push column) and the per-user push rate all apply. The critical-category rule (`safety` only) and the MUTEFIX-295 behaviour are
  not touched.
- The per-department notification matrix (TKNOTIFMATRIX) lists both sources like the other assignee sources (now / digest / off).

## Tests

`tests/test_tickets_app_push.py`: assignment, status change (requester only / both), comment, internal note, module off, no app
registered, muted category.
