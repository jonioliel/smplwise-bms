# CR-038 slice 7 - verification code (option B): notes

Branch `pilot/TICKETS-s7` (from `pilot/TICKETS-s1`, with `pilot/TICKETS-s4` and `pilot/TICKETS-s5b` @ `9d5c6af6` merged - 5b
carries s4, s5a, s2 and public-core). Spec: `CR-038-TICKETS-MODULE.md` 10.5, D2, D6, 7.2, 14.1, section 20 row 7. No migration
(the code tables are slice 4's `0080`; `0084` stays the spare).

## What slice 7 adds

| Piece | Where | What |
|---|---|---|
| Lock signal | `codes.CodeRefused.just_locked` | the guess that STARTS a lock says so (later guesses while locked do not) |
| Code events port | `public_ports.CodeEvents`, `public_app` code/verify | `verified` / `refused` called after the engine decided; a failure is logged by type only and never changes the answer |
| Events over the store | `code_flow.SqlCodeEvents` | correct code: access row `code_ok`, sliding expiry (10.2), timeline `code_verified` (internal), audit; a ticket waiting on `code_locked` goes back to the assignee. Wrong code: `code_bad` + audit (denied). Locking guess: also `locked`, timeline `code_locked` (actor `system` - the guesser may be a stranger, T5a), ticket `waiting_on = manager`, `waiting_reason = code_locked` |
| Code sender | `code_flow.SqlCodeSender` (wired in `public_runtime`) | D6 at send (`codes.code_channel` over `DISPATCH.code_ready` and the link's `sent_via`), D6 re-checked inside the send transaction, the link re-read (same generation, still serving), digits derived under the link's own key and handed IN MEMORY to `external.DISPATCH.queue_code` (5b's `OutboxDispatch`), `outbox_id` on the code row, audit `ticket.link.code_send` (channel only). 5b's `CODE_SENDER` hook is removed (lead decision); `messaging.OutboxCodeSender` is now unused |
| D6 at "new link" | `external.new_link` | a code-protected link is refused (409 `code_channel_unavailable`) BEFORE the generation moves; the new link leaves by the channel when one exists (`DISPATCH.queue`, purpose `assign`) |
| Lock card data | `handler_links.link_block.code_locked_until` | the end of the current generation's lock |
| Code settings | `settings_doc` `code.ttl_min` (1-30) / `max_attempts` (3-10) / `lock_min` (5-240), `PUT /tickets/settings {code}` | the engine reads them (`public_runtime.code_policy_reader`, 30 s cache); the length is not a setting (D2) |
| Lock card UI | `frontend/src/tickets/code-lock-model.ts`, `code-lock.ts`, one line in `ticket-detail.ts` | "נעילת קוד" + "נעול עד ..." + one-tap "שלח קישור חדש" (`POST tickets/{id}/link/new`), inside the ticket page with its own classes - no new CSS, every skin as is |

Already delivered by earlier slices and only verified here: the contact flag and the per-assignment flag (slice 4: raise only,
`require_code_locked` in the preview, live links raised at once, lowering applies to new links only); D6 at assignment (slice 4
`external._code_check`, 5b's `code_ready`); generation-scoped codes / windows / caps and key ids (public-core V8 / V4); the handler
page's code states in four languages (slice 4 `src/public-ticket`).

## Decisions (safest reading)

1. The code-channel rule keeps public-core's stricter form: e-mail only when the link went by WhatsApp or was copied
   (`sent_via` NULL - the link never left - gets no fallback). msg-core's `outbox.code_route` allows e-mail for NULL; it is not used
   on this path.
2. A lock is a ticket-level signal only once (`just_locked`); further guesses while locked write nothing (no write amplification).
3. The lock's timeline line is `system` (not the contact): a forwarded link holder can cause it.
4. "New link" sends the new link with the send hours applied (`send_now = False`); the manager can still "send now".
5. No CR-018 signal for a lock in release 1 (the spec names none); the board shows `code_locked` (slice 6 already maps it).

## Hand-off

- Slice 4 page: `codeSent` says "valid 10 minutes" while the TTL is now a setting; the answer's `expires_in_s` and `channel`
  could drive the line (small change in `src/public-ticket`).
- Slice 8: guide lines for codes and forwarding; Arabic / Russian review of the page strings.
