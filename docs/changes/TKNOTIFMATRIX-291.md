# TKNOTIFMATRIX (2.9.1) - per-department notification matrix and daily digest

Branch `pilot/TKNOTIFMATRIX-291`. Code: `smplwise_vms/backend/smplwise/services/tickets/notify_matrix.py` (design in its docstring),
`notify_bridge.py`, `settings_doc.py` (block `notify`), `routers/tickets_admin.py`, `services/notify.py` (serialize hook),
`services/notify_channels.py` (channel hook); UI `frontend/src/tickets/notify-matrix*.ts`, `frontend/src/i18n/notify-matrix.ts`,
`frontend/src/components/notify-detail.ts`. No migration (everything lives in the `tickets.settings` document and one setting row,
`tickets.notify_digest_queue`).

## Defaults (owner decision 1)

`notify.matrix_enabled = false`, `notify.digest_enabled = false`: every ticket event notifies exactly as before, the channel override
does nothing, and nothing is held. `notify.urgent_immediate = true` (only matters once the matrix is on).

## Settings (`PUT /tickets/settings`, `system.configure`, audited as `tickets.settings.update`)

| key | meaning |
|---|---|
| `notify.matrix` | `{dept id \| "*": {source: now \| digest \| off}}`; a department inherits each cell it does not set from `"*"` (decision 8) |
| `notify.digest_time` | the installation digest time (default 08:00, installation time zone) |
| `notify.departments` | `{dept id \| "*": {digest_time?, recipients?: {managers, users[], roles[]}, channels?: {push\|email\|whatsapp: on\|off}}}`; `digest_time` per department only; each field inherits from `"*"` |
| `notify.urgent_immediate` | high / urgent priority events and SLA crossings (`ticket.stuck`, `ticket.reminder`) go at once whatever the matrix says |
| `notify.sla_urgent` | per SLA policy (`"<dept>/<priority>"`): `immediate` or `matrix`, overriding `urgent_immediate` |

## Behaviour (decisions 2-7)

- Digest per department at its own time; an event held before today's slot goes in today's digest, one held after it waits for tomorrow's.
- One `ticket.digest` row per recipient and department. Recipients: the department's managers (default), plus named users and role
  holders - each only when he may see the ticket (`access.visible`); an assignee-addressed event (`ticket.assigned`, `ticket.reminder`)
  goes into its assignee's own digest. If the narrowed list leaves nobody, the source's own audience stands in.
- Title / body: counts per event type and the department name only (what push / e-mail / WhatsApp can show). The ticket list (number,
  title, event) is never stored or pushed: the row keeps ticket ids and event keys, and `GET /notifications/...` renders `digest.items`
  for the reader, filtered by what he may see now (`digest.hidden` counts the rest). The notification detail shows it folded
  (`<details>`).
- Nothing lost: a full queue or a failed enqueue sends at once; a failed digest sends its events at once (bypassing the matrix); only if
  that fails too does the entry wait for the next pass. Turning the digest or the matrix off releases everything held at the next
  janitor step. Entries of tickets closed meanwhile are dropped.
- Channel override per department (in-app is the inbox row and is always on; push = web push + the phone app): `on` turns on only a
  channel the installation has, `off` turns it off; absent = the source's own channel policy.

## Tests

`smplwise_vms/backend/tests/test_tickets_notify_matrix.py` (fake clock: `notify.now_utc` replaced),
`frontend/tests/unit-tickets-notify-matrix.spec.ts` (model + string tables).

## Open points

- Arabic / Russian strings are an initial translation (native review pending), like the neighbouring settings tables.
- "Push" in the override covers both web push and the phone app; split them if the owner wants separate control.
