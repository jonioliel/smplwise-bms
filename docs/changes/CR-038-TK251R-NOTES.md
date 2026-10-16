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

## Review R2 (2026-10-16, TK251R_NOTIFWA_R2_REVIEW Part A) - fixes and decisions

| Finding | Fix / decision |
|---|---|
| A-1 the sweep quota | `limit` counts removals only; the rows are looked up per ticket folder as the walk goes (one indexed query per folder that holds old candidates); the walk starts at a random folder each sweep, so a file that cannot be removed never blocks the rest. Test: 2,200 referenced old files plus orphans in a later folder; a stuck orphan with `limit=1`. |
| A-2 e-mail link in claim mode | `POST /t/api/redeem` (reached as `/<prefix>/api/redeem` under TK255) takes the same claim-mode branch as `link_context`: a released redeem id whose link no longer serves the page releases the token only when `claim_window` is open for that generation; staff links never; the 3-use / 24 h limits are unchanged; everything else stays the uniform 404. Test: close, grace over, e-mail redeem under the prefix, the claim step opens; window closed and a manual revoke stay 404. |
| A-3 cursor binding | The AES-GCM AAD carries the caller's user id and a fingerprint of the filters + sort; the sealed body carries the issue time; a cursor older than 30 min (or from the future by more than 60 s), from another caller or with other filters is the same `422 cursor`. **Residual, accepted and documented:** a short page still ends on the last SCANNED row, so a caller who can edit a sort value of a ticket they see (e.g. the title of their own ticket) can learn, one audited edit per step, where a hidden row of a department they belong to sorts relative to their own row. Values are never readable; each probe is an audited write; anchoring short pages on the last visible row plus a skip count is the follow-up if the owner wants it closed. |
| A-4 delete the checked entry | The sweep records `os.lstat` during the scan and compares device / inode / mtime (and regular-file) again right before `os.unlink(entry)`; `os.unlink` never follows a symbolic link; no resolve-then-unlink. Symbolic-link folder / `costs` / file test (skipped on Windows without the privilege, runs on the runner) and a swap-after-scan test. |
| A-5 open vs new generation | `note_open(..., generation)` updates only `WHERE generation = ?`; an open whose token generation is gone writes nothing (no counter, no line, no device row). |
| CSV tripwire | Also matches `csv.DictWriter(`. |

## Files

Backend: `services/tickets/{access,attachments,board,channel,costs_retention,deletion,handler_actions,handler_links,inbound,
message_templates,messaging,monitor,outbox,present,store,store_links,table}.py`, `services/messaging_accounts.py` (`all_keys`),
`routers/{tickets_messages,tickets_table}.py`. Frontend: the `sla` type of a ticket item may be `null`. Not touched: the public
server allowlist / prefix files (TK255).

## Rollback

Revert the commit(s); no data migration. Sealed cursors issued before a rollback stop opening (the list starts over).
