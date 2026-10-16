# CR-038 TK251 remainder (2.5.8) - implementation notes

Scope: the deep review of 2026-10-15 items TK251A did not take (A4, A6, B6) and the older TK251 leftovers (CSV formula guard,
the "link opened" line, SLA exposure to limited viewers, cost evidence negative tests, the link in cost messages). No migration.
Tests: `smplwise_vms/backend/tests/test_tickets_tk251r.py`.

## Decisions (fail closed where the finding was open)

| Item | Decision |
|---|---|
| SLA for limited viewers | A limited viewer (a creator or internal assignee who is not a member, section 8 / T18-2) sees **no SLA data at all**: `sla` is `null` in the list item, the detail and the board item; `stuck` / `sla_cell` are `null` on the board item; the table and the CSV already blanked `stuck` / `sla`. A `stuck` filter (table, facets) never matches a limited row and the facets count stuck kinds over full rows only. Full viewers are unchanged. Residual, accepted: a limited viewer who sorts the table by `sla` / `stuck` sees the relative order of the rows they can see (their own tickets only), never a value. An internal assignee still receives the reminders addressed to them (13.3) - that is the ladder, not a data exposure. |
| Table cursor | The keyset cursor is sealed (AES-GCM, a per-process random key, AAD bound to its purpose). Before, a short page returned the last scanned row's sort values in readable base64 - that row may be invisible to the caller (a title, place or SLA due of another ticket) or limited. A cursor that does not open is `422 validation / cursor`; after an add-on restart a list starts over. The cards list cursor (`last_activity_at` + id only) is unchanged. |
| A4 orphan files | Only names the module writes (`<16 hex>.jpg`, `<16 hex>.pdf`, `.up.<x>.tmp`) directly under `<ticket>/` or `<ticket>/costs/`, unchanged for 1 h and named by no `ticket_attachments` / `ticket_cost_files` row, are removed by the costs janitor; anything else (other names, other sub-folders, symbolic links) is left alone. At most 2,000 files per sweep. |
| A6 internal photos | The staff route runs `image_intake.reencode` + `store_image`. Consequence: the staff route now has the public page's caps - PNG and progressive JPEG at most 8 MP (was 16 MP for every image), scan-count / segment limits - and Pillow never parses an upload's EXIF (orientation comes from the bounded IFD0 reader). The staff route keeps its own decode slot (`attachments._DECODE`), its codes and Hebrew messages. |
| B6 entry-id-less replies | The ambiguity count adds every WhatsApp account the add-on can see (configured, discovered, used - `AccountsService.all_keys`). An unreadable list counts as two (the reply is ignored, `account_unknown`). Buttons still match by nonce. |
| "Link opened" per generation | "קישור חדש" resets `first_opened_at`, `last_opened_at` and `open_count`; the first open of the new generation writes its own timeline line (`data.generation`) and its device row; the card's device count is the generation's; the "link not opened" clock counts from `generation_at`. |
| Link in cost messages | `cost_rejected` and `cost_reopened` carry `{link}` (mandatory in their templates, starters updated in he / en / ar / ru - ar / ru still need the native review of 9.7). The URL is taken when the link serves the page OR only the claim step (claim mode: closed / cancelled / cannot-handle, claim window open); otherwise the row is cancelled `link_not_live` and nothing is sent. `cost_approved` carries no link. A cost message that left with the link marks the link as sent (the D6 e-mail rule sees it). Existing custom templates without `{link}` keep sending (validation runs at save time). |
| CSV | Both CSVs of the module (`tickets/export.csv`, `tickets/costs/export.csv`) already routed every cell through `text_hygiene.csv_cell`; regression tests cover hostile values on every text column, and a tripwire test fails when a new `csv.writer` appears in the module without the guard. |
| Cost evidence | Already correct; negative tests added: 403 without `tickets.costs.view` (audited), 403 for a limited viewer holding it, the uniform 404 for an invisible ticket, no crossing of file / claim / revision ids between tickets, a pending file is never served, the vendor page never serves an invoice file. |

## Files

Backend: `services/tickets/{access,attachments,board,channel,costs_retention,deletion,handler_actions,handler_links,inbound,
message_templates,messaging,monitor,outbox,present,store,store_links,table}.py`, `services/messaging_accounts.py` (`all_keys`),
`routers/{tickets_messages,tickets_table}.py`. Frontend: the `sla` type of a ticket item may be `null`. Not touched: the public
server allowlist / prefix files (TK255).

## Rollback

Revert the commit(s); no data migration. Sealed cursors issued before a rollback stop opening (the list starts over).
