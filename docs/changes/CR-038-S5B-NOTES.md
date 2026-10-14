# CR-038 slice 5b - the ticket message channel: implementation notes

Branch `pilot/TICKETS-s5b`, cut from `origin/pilot/TICKETS-s1` @ `11f21002`, with `origin/pilot/TICKETS-s4`, `origin/pilot/TICKETS-s5a`
(which carries `pilot/TICKETS-msg-core`), `origin/pilot/TICKETS-public-core` and `origin/pilot/TICKETS-s2` merged (re-merged as they
advanced). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` section 20 row 5b, sections 9 (9.1-9.9.5), 10.2 (redeem link), 10.5 (D6), 13.4,
14.1/14.2, 15.1, 17; decisions D4, D6, D13, D14, D26, D27, D29, D33. Nothing here ran against a real Home Assistant, `ha-whatsapp`,
phone, SMTP server or network: the fake `ha-whatsapp` (`tests/fake_ha_whatsapp.py`) and a fake SMTP sender only.

**The master WhatsApp switch (`tickets.settings.whatsapp.enabled`) is OFF by default.** Until an administrator turns it on, nothing
leaves on WhatsApp, no reply subscription is made, and an assignment to a contact goes by e-mail (contact with an address, SMTP
configured, e-mail fallback on) or is copied by the manager - exactly slice 4's behaviour.

## 1. What slice 5b delivers

**Migration `0081_ticket_messaging.sql`** - `ticket_outbox` (the spec's table + `held_since`, `first_attempt_at`, `resend_of`, `code_id`,
`idempotency_key` (unique when set), `send_now`, as the message core's notes proposed) and `ticket_inbound` (the spec's table +
`assignment_id`, `reason`, `candidates_json`, `claimed_by` / `claimed_at`, `handled_kind`). No column for a number, an address, a token,
a code or a text (a test asserts it). The migration-list tests know 0081 (`test_migrations`, `test_media_api`, `test_media_players_api`,
`test_notify_core`).

**Backend**
| File | What |
|---|---|
| `services/tickets/outbox_store.py` | the storage layer of 0081 (the store-only-SQL rule of section 5 / `test_ticket_sql_lives_in_the_store`): `SqliteOutboxStore` (the core's `OutboxStore`, compare-and-set `save`), `BoundSendLedger` (5a's ledger table on the BOUND connection), the inbound rows, the matcher's queries, health counts, retention, message-template SQL |
| `services/tickets/messaging.py` | the runtime: `DbOutbox`, the ports (directory, links, templates, context, hooks), the channels, `OutboxDispatch` (= `external.DISPATCH`), `OutboxCodeSender`, the inbound processor wiring and `apply_decision`, the worker pass (`run_once`), the account-state watch, retention, health, the registrations below |
| `services/tickets/channel_email.py` | the e-mail adapter: the contact's own address, the product's SMTP (`notify_email.smtp_send`), the redeem link, outcome classes |
| `services/tickets/message_templates.py` | the message core's `templates.py`, RENAMED (slice 2 owns `services/tickets/templates.py`, ticket templates - the two files would have collided at integration) |
| `routers/tickets_messages.py` | the routes below (mounted before `/tickets/{ticket_id}`) |
| `services/ha_sync.py` | `TICKET_EVENTS` subscribed only while wanted (module on, switch on, a ticket use mapped), unsubscribed when not - the channel route and the worker's minute watch (`follow_subscription`) follow a change made on any screen; the frame is handed to a bounded queue (never written or logged on the websocket thread; `media_url` never read) |
| `main.py` | `configure` at app creation, the `tickets-outbox` thread in `_start_janitor` / `_stop_janitor`, a guarded janitor step (retention) |
| `services/tickets/settings_doc.py` | `whatsapp.enabled` (false), `whatsapp.use_buttons` (false), `whatsapp.reply_window_h` (72, 1-336), `email_fallback` (true) |
| `services/tickets/handler_links.py` | hooks `NOTICE` (closed / reassigned notices) and `CHANNEL_OK` (the link block's `can.resend`) |
| `services/tickets/external.py` | the assign preview merges `DISPATCH.preview_extra` (the template text, the account, the send-hours line, "send now" default) |
| `services/tickets/present.py` | the ticket detail carries `messages` (managers / tickets.external only) |
| `services/tickets/public_runtime.py` | hook `CODE_SENDER` (the public page's code sender = `OutboxCodeSender`) |

**Routes**
| Route | Gate | What |
|---|---|---|
| `GET /tickets/channel` | system.configure | the channel switches, the ticket uses' accounts READ-ONLY (from slice 5a's view), account states + last successful send, warnings, e-mail configured, reply listening, health |
| `PUT /tickets/channel` | system.configure | `{revision, whatsapp: {enabled, use_buttons, reply_window_h}, email_fallback}`; 409 `settings_stale`; audit `tickets.settings.update`; the reply subscription follows at once |
| `POST /tickets/{id}/outbox/{oid}/send-now` | visible + tickets.external (D29) | a message held by the send hours leaves now; audit `ticket.message.send_now` |
| `POST /tickets/{id}/outbox/{oid}/resend` | manager + tickets.external | "שלח שוב" of an unknown / not-sent / refused message: a NEW row, the old keeps its state; audit `ticket.message.resend` |
| `POST /tickets/{id}/send-update` | manager + tickets.external | "שלח עדכון" (purpose `update`) after an edit; clears `external_stale`; audit `ticket.message.update` |
| `GET /tickets/inbound` | managers of a candidate department | unmatched replies: the sender's DIRECTORY name and the time only |
| `POST /tickets/inbound/{iid}/claim` / `attach` / `dismiss` | the same; attach / dismiss only by the claimer | claim-before-reveal (compare-and-set; the text to the claimer only, audited); attach = a note on one candidate ticket; the text leaves the table on attach / dismiss |
| `GET|POST /tickets/admin/message-templates`, `PATCH|DELETE .../{tid}`, `POST .../preview` | tickets.configure | message templates per purpose x language x department (D26), server-validated (9.7), audited with a before/after diff; the preview renders sample values and the configured module name |

**Frontend**
| File | What |
|---|---|
| `api/tickets-messages.ts` | the client of the routes above (+ a small demo store) |
| `tickets/message-lines.ts` (pure) + `tickets/ticket-messages.ts` | the ticket page's "הודעות" block (D14 lines, "שלח עכשיו", "שלח שוב", "נשלח לפני השינוי" + "שלח עדכון") and the timeline lines of the message / reply / link events |
| `tickets/settings-channel.ts` | Settings › the module › "ערוץ הודעות" |
| `tickets/settings-message-templates.ts` | Settings › the module › "תבניות הודעה" |
| `tickets/inbound-queue.ts` | `<tickets-inbound-chip>`: one chip in the list header while unmatched replies wait (managers), opening the claim / attach / dismiss dialog |
| `tickets/messages-text.ts` | the texts (Hebrew + English; the module name through tokens only) |
| `tickets/ticket-detail.ts`, `screens/system-tickets.ts`, `screens/tickets-list.ts` | one-line wiring each (the block, the two tabs - each shown to the permission that can use it, the chip) |
| slice 4's `tickets/external-assign.ts`, `tickets/link-panel.ts`, `api/tickets-s4.ts` | the assign dialog for a contact shows the channel and account, a warning when the account cannot send now (the message waits, then falls back), the send-hours line with "שלח עכשיו" (D29, preselected for critical priorities) and sends `send_now`; the link panel offers "שלח קישור שוב" when the server allows it (`can.resend`) |

## 2. Registrations (each a module attribute set by `messaging.RUNTIME.configure`)

`external.DISPATCH = OutboxDispatch` (channel plan, queue, `code_ready`, `queue_code`, `preview_extra`) · `messaging_runtime.QUEUED_COUNTER`
(queued + held rows per use and department) · `messaging_runtime.TEST_SENDER` (5a's per-account test send; the button opens only with
`SW_MESSAGING_TEST_SEND=1`, 5a's rule) · `monitor.EXTERNAL_REMINDER` (slice 6's SLA monitor, when present) · `handler_links.NOTICE` /
`CHANNEL_OK` · `public_runtime.CODE_SENDER`. Slice 6's `notify_bridge.send_failed` / `reply_unmatched` / `channel_state` are called through
`getattr` (no-ops before slice 6 lands).

## 3. The connection rule (why `outbox_store` binds connections)

The write gate (`db.WriteGate`) is one FIFO writer per database and is NOT re-entrant: a thread that holds a write transaction and opens a
second write connection waits for itself. So every outbox write runs on ONE connection bound to the thread (`outbox_store.bound`):
requests bind their own transaction (the outbox row, the timeline row and the audit row are one transaction - "if the row cannot be
written, nothing is sent"), the worker binds one write connection per tick, an unbound write raises `Unbound`. Lock order everywhere:
the database gate first, then the outbox's in-process lock; the provider call (WhatsApp, SMTP) runs with NEITHER held - `DbOutbox`
commits the claim (`sending`) before it and takes both back after (`test_a_slow_provider_call_never_holds_the_write_lock`). This is also
why the ledger is `BoundSendLedger` (5a's `DbSendLedger.record` opens its own write connection and would wait for the worker's own gate),
with ONE `PacingGate` per process as 5a asked.

## 4. Readings taken (safest reading; recorded, not asked)

1. **Channel plan (D13).** The contact's `preferred_channel` first: `manual` = copy link; `email` = e-mail when SMTP is configured, else
   copy; `whatsapp` = WhatsApp when the master switch is on and the contact has a number, else e-mail when the e-mail fallback is on, the
   contact has an address and SMTP is configured, else copy. The ACCOUNT's state is not checked at queue time: a row of a disconnected
   account is held (`channel_down`) up to `hold_when_down_min`, then falls back (9.2 / 9.9.4).
2. **The switch turned off with messages queued**: they are held (`account_unmapped`) and then fall back - nothing leaves on WhatsApp.
3. **Template choice (D26)**: the contact's language first INCLUDING its starter text, Hebrew only for a purpose without a starter in that
   language (the cost notices of slice 9). The message core had chosen "a configured Hebrew text before the contact's-language starter";
   an Arabic-speaking vendor would then get an administrator's Hebrew. Its test was updated with the reason.
4. **One naming source (lead's instruction)**: `message_templates.DEFAULT_DISPLAY_NAME` comes from slice 1's `naming.DEFAULTS` for all four
   languages; the outbox renders `{module_name}` / `{module_name_plural}` from `naming.names_for` (the `tickets.name` document).
5. **A real link is never cut**: the save-time worst case keeps 120 characters for `{link}`; at send time the system-made URL is used whole
   (a public base URL may be up to 300 characters; the 1000-character total still applies).
6. **"Copy link" text stays slice 4's** (`external.render_message`): the configured templates invite "השב 1 = התקבל", which only the ticket
   account can read - a text the manager pastes from his own phone must not promise that.
7. **Notices**: "closed" (close / cancel - the read-only grace starts) and "reassigned" (the old contact's link is revoked) go only when
   the link actually left by WhatsApp or e-mail (a copied link was the manager's own message), held by the send hours.
8. **Reopened**: a reassignment of a closed ticket sends the `reopened` text (11.2).
9. **E-mail**: host + sender + port are enough (the CR-018 administrator list is not involved); a failure before the hand-over is
   `not_sent`, a recipient refusal `refused`, a timeout `unknown` (never retried or re-routed, the WhatsApp rule).
10. **E-mail codes** need the e-mail fallback switch on, and never when the link itself went by e-mail (D6).
11. **Inbound rows**: an ambiguous reply keeps the contact id of its candidates, and the queue shows the DIRECTORY name (a WhatsApp
    profile name is sender-chosen, never stored). Advisory status changes are `status` timeline rows with `actor_kind = 'inbound'`,
    `via = 'whatsapp'`, `data.unverified`; notes are `inbound` rows; late replies `late_reply` rows + "waiting for the manager"
    (`late_reply`). A status decision is re-checked in the apply transaction (the ticket may have moved: it becomes a note).
12. **Duplicates** of an inbound event are recorded with a unique-ified dedupe key (the UNIQUE index keeps the 24-hour dedupe exact).
13. **Idempotency scope (code review V19)**: slice 4's public writes and public-core now share `link:<id>:<generation>` (slice 4 made the
    same change; the merge took its `idempotency_scope`).
14. **Settings shape**: the `PUT /tickets/settings` body combines slice 2 (links, send hours, urgent as critical) and slice 4 (organization,
    public); the channel keys have their own route (`PUT /tickets/channel`) so slice 1/2's body stays as it is.
15. **A link "sent"**: the outbox marks it through slice 4's `handler_links.mark_sent` once a link message is handed over - the first send
    time of the generation stays (slice 6's "link not opened" counts from it) and a link that ever went by e-mail stays `email` (D6).
16. **"שלח קישור שוב"** (slice 4's `POST /tickets/{id}/link/resend`) queues a new `assign` message for the current link; an older open
    `assign` row of the same assignment is superseded (never two pending copies).

## 5. Not built in 5b (and why)

- `POST /tickets/channel/test` (spec 8.1): the per-account test send of slice 5a (`POST /messaging/whatsapp/test`) is the test; a second
  route would be a second way to send a typed number.
- 9.6 step 7 (an internal user with a directory phone gets WhatsApp deep links): internal assignees get CR-018 in-app only; no outbox
  row is ever written for an internal user, so no reply can match one.
- CR-018 `ticket.send_failed` / `ticket.reply_unmatched` / `ticket.channel_down` signals: slice 6's notify bridge (called when present).

## 6. When slice 7 is merged (verification codes)

Slice 7's `code_flow.SqlCodeSender` calls `external.DISPATCH.queue_code(...)` - implemented here (`OutboxDispatch.queue_code`). At the
merge keep slice 7's `public_runtime` line (`code_sender=SqlCodeSender(...)`) and drop this branch's `CODE_SENDER` hook line; both paths
end in the same `queue_code`. `ticket_link_codes.outbox_id` is set by `queue_code`.

## 7. UNVERIFIED (needs the owner-approved live checks on his installed `ha-whatsapp`; guide `private/planning/TICKETS_WHATSAPP_LIVE_CHECKS_HE.md`)

- `send_message` / `send_buttons` accept `account` = the config entry id (step 7 of the guide); the REST `?return_response` shape
  (`success`, `message_id`) (step 8); buttons rendering (step 9);
- `entry_id` on `whatsapp_message_received` / `whatsapp_button_pressed`, the shape of `sender_number` (digits / JID / `@lid`) and of
  `timestamp` (epoch s / ms / ISO) (steps 10-12) - the matcher accepts every documented shape and works without `entry_id`;
- the REST status / body of an unknown account (`ServiceValidationError`);
- slice 5a's discovery facts (steps 1-5).

## 8. Tests

Backend: `tests/test_tickets_s5b_channel.py` (32) over the real store with the fake `ha-whatsapp`: assignment -> outbox -> WhatsApp, the
preview (and its warning when the account cannot send), the link panel's "send the link again", send hours + "send now" (403 without tickets.external), the switch off (manual; and queued rows held), unknown never retried +
"send again", retries then the e-mail fallback with the redeem link (never the fragment), disconnected -> hold -> nobody -> waiting for
the manager -> no resend on reconnect, unmapped -> remapped (D27), the D6 refusal, a code request from the public page (the row keeps the
code id only), inbound status / note / late / ambiguous claim-before-reveal / account filter / LID button nonce / switch off, the reply subscription following a mapping changed on another screen, message
templates (validation, preview, rendering, English starter), send-update + the closed notice, reassigned notice, the test send (the typed
number never in the database file), the channel settings gate, the uniform 404 of the new ticket routes, an unbound write refused, crash
recovery (`sending` -> `unknown`), the lock order under a slow provider, an idle installation never takes the write lock, log / row hygiene, migration 0081. The message core's tests
updated for the rename and the D26 reading; guards updated: `test_ticket_sql_lives_in_the_store` (the storage layer gains
`outbox_store.py`), `test_remote_access` (slice 4's probe route in the local-only list), `test_display_settings_document`.
Frontend: `tests/unit-tickets-messages.spec.ts` (node), the D33 lint (`unit-tickets-naming.spec.ts`) covers the new files.
Counts and runner results: see the slice report.
