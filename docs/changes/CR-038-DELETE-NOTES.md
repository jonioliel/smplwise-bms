# CR-038 - full deletion of tickets by a manager (owner decisions 14.10)

Branch `pilot/TICKETS-delete` from `pilot/TICKETS-handlers` @ 07bb27a2. No migration.

## The permission

`tickets.delete` - sensitive (`sensitive_permissions_not_implied`), not on `DEFAULT_DELEGABLE`, granted by no built-in role except
`system_admin`, and a single-permission built-in role `tickets_delete` (like the other ticket grants; listed in `GRANT_ROLES`). Label
`{module}: מחיקה מלאה (כולל הערות, תמונות, קישורים ועלויות)`. Checked **where the ticket lies** (its place target, else any scope) **on
top of** manager rights in its department (`Seen.manager`) and the visibility rule. A `tickets_delete` holder without manager rights
gets 403; another department is the uniform 404.

## Routes

| Route | Answer |
|---|---|
| `POST /tickets/{id}/delete` `{reason, confirm_number, client_request_id}` | `{deleted, id, number, counts:{notes, photos, files, links, claims}}` |
| `POST /tickets/bulk-delete` `{ids (<= 50), reason, confirm_count, client_request_id}` | `{action:"delete", total, done, counts, results:[{id, number?, result}]}` - `ok / not_found / forbidden / cost_claim_approved` |

Order of a single delete: interactive session (403 `interactive_session_required` for a bearer-token client; the remote channel is NOT
blocked) -> idempotency (`client_request_id`, the first answer) -> visible (404 `ticket_not_found`, also after the ticket is gone) ->
`tickets.delete` + manager (403) -> the cost guard (409 `cost_claim_approved` for a claim in `approved` / `paid` unless the caller also
holds `tickets.costs` there; the audit row then says `cost_override`) -> the typed number (422 `confirm_number`) -> the reason (422,
required, <= 300 after cleaning) -> 30 deletions per user per hour (429 `delete_rate`, in memory per process; a bulk request needs room
for all its ids).

## What goes (services/tickets/deletion.py, store.purge_ticket)

In the request's transaction (a bulk item: its own savepoint), in this order: every live link revoked (`manual`) and its sessions
dropped; queued / held outbox rows cancelled; the ticket's open CR-018 notifications resolved (`ticket:<id>:*`); then the rows - link
sessions / codes / failures / access / redeems, links, outbox, inbound (by `ticket_id`), cost revision-files / files / decisions /
revisions / claims (cost claims go too: the owner's decision overrides 11A.11's "claims outlive the ticket" for a manual delete),
photos, device context, events, assignments, the 24 h idempotency answers that carry the ticket id, other tickets' `duplicate_of`
pointing at it, the ticket. The SLA monitor needs nothing: it reads the tickets table. After the commit the folder
`<data>/tickets/<id>/` (photos and invoice files) is removed; a failure there is logged by type and the cost janitor's
`deletion.sweep_orphans` (every 10 min) removes folders no row names any more (older than an hour).

## Audit

One `ticket.delete` row per ticket, kept forever: `number, department_id, status, reason, notes, photos, files, links, claims, events,
links_revoked, messages_cancelled, had_cost_claim, cost_override, bulk, rows`. Never the title, description, notes, names, phones,
tokens or link ids (the test scans the rows). Refusals: `denied` rows with the reason code. A bulk request adds one `ticket.bulk` row.

## Known limits (stated)

- Backups taken before the deletion still contain the ticket; nothing extra is done (owner decision 9).
- Notification rows are resolved, not erased; their stored text stays in the notification history (CR-018 retention).
- An ambiguous inbound reply that listed the ticket among its candidates keeps its row (only rows with `ticket_id` go); attaching it
  to the deleted ticket answers the uniform 404.
- A message already claimed by the outbox worker (`sending`) may still leave; its row is gone afterwards.
- The hourly rate is per process (the add-on runs one).

## UI

`frontend/src/tickets/delete-dialog.ts` (`<tickets-delete-dialog>`), `delete-model.ts`, `delete-text.ts`, `api/tickets-delete.ts`; the
drawer footer and the full-screen header show "מחיקת {ticket}" (danger) when `can.delete`; the table's bulk bar shows "מחיקה" for
`tickets.delete` holders. After a delete the drawer closes and the cards / table drop the row and reload.
