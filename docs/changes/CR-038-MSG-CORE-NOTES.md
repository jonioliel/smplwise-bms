# CR-038 message-channel core - interface notes for the wiring slices

Branch `pilot/TICKETS-msg-core`, cut from `origin/integ/2410` @ `240424e0`, with `origin/pilot/TICKETS-spec` @ `589afea7` merged.
Spec: `docs/changes/CR-038-TICKETS-MODULE.md` sections 9 (9.1-9.9), 10.5, 13.4, 14.1, 14.3, 15.1, 17, D2-D33.

What this branch is: the **library** of the ticket message channel - the channel interface and message model, the WhatsApp
(`ha-whatsapp`) adapter, the outbox with pacing / send hours / holds / retries / fallbacks, WhatsApp account selection, and
inbound reply matching - with storage and side effects behind small interfaces, tested on fakes (a fake `ha-whatsapp`, a fake
clock). It touches **no shared file**: no `main.py`, `config.yaml`, `roles.json`, nav, router, migration, `ha_sync.py`,
`ha_client.py`, `notify*.py` or `backup.py` edit. Nothing here ran against a real Home Assistant, WhatsApp, phone or network.

## 1. Files

| File | What |
|---|---|
| `smplwise/services/tickets/__init__.py` | package marker (one docstring line; slice 1 may create the same file - keep either) |
| `smplwise/services/tickets/channel.py` | `TicketChannel` protocol + `ChannelRegistry`; message model (`OutboundMessage`, `Recipient`, `AccountRef`, `Button`, `SendResult`, `ChannelStatus`, `InboundMessage`); purposes, kinds, priorities; outcome words; `strip_controls` (Cc/Cf), `phone_digits`, `keyed_hash` |
| `smplwise/services/tickets/templates.py` | placeholders, save-time `problems()`, `check_params()`, starter texts he / en / ar / ru, `choose()` (D26), `render()` with `{module_name}` / `{module_name_plural}` / `{g:f=..|m=..|n=..}` (D33), buttons and footer |
| `smplwise/services/tickets/hours.py` | send window parse / effective window / `in_window` / `next_opening` (DST-correct) / `decide()` (D4, D29); `urgent_is_critical` + `signal_severity` (D28) |
| `smplwise/services/tickets/channel_whatsapp.py` | `WhatsAppChannel` (only `send_message` / `send_buttons`, `account` always sent), `classify()` (9.4 table), `HaServiceTransport` (the connect-vs-transfer split), `outcome_from_api_error()` |
| `smplwise/services/tickets/outbox.py` | `Outbox` (enqueue, tick, send_now, resend, cancel_where, open_count, recover_after_restart), `OutboxThread`, `MemoryOutboxStore` (reference store), D6 helpers `code_route` / `assignment_code_check`, `code_request_check` (10.5 per-link limits), `timeline_kind` (7.1 / D14) |
| `smplwise/services/tickets/inbound.py` | `normalise()`, `parse_reply()`, `advisory_status()`, `InboundProcessor` -> `InboundDecision`, `TicketAccountFilter`, `MemoryDedupe`, `InboundQueue`, `TICKET_EVENTS` |
| `smplwise/services/messaging_accounts.py` | accounts (discovered / manual), `MappingDoc` + `parse_doc` / `validate_doc` / `changed_uses` / `warnings` / `state_transitions`, `UseSpec` / `UseRegistry` / `tickets_uses` / `resolve_key`, mirror reader (`SqliteMirrorReader`, `discover`), state (`account_status`, `SendStateTracker`), labels, the send ledger (`MemorySendLedger`, `SqliteSendLedger`, `LEDGER_DDL`), `PacingGate`, `AccountsService` |
| `tests/fake_ha_whatsapp.py` | the fake `ha-whatsapp`: records calls (incl. `account`), scripted outcomes, mirror rows for 1-2 paired numbers, events with / without `entry_id` |
| `tests/tickets_msg_fakes.py` | fake clock and in-memory ports; `make_env()` builds a full outbox on fakes |
| `tests/test_tickets_msg_*.py`, `tests/test_messaging_accounts.py` | the tests (section 7) |

## 2. Interfaces the wiring slices implement

All are `typing.Protocol`s; the in-memory fakes in `tests/tickets_msg_fakes.py` show the expected behaviour.

**Slice 5b (`ticket_outbox`, `ticket_inbound`, migration 0081):**

| Port (`outbox.py` / `inbound.py`) | Methods | Backed by |
|---|---|---|
| `OutboxStore` | `insert` (raise `OutboxError('duplicate')` on id / nonce / idempotency clash), `get`, `save(row, expect_state)` (compare-and-set: `UPDATE ... WHERE id = ? AND state = ?`), `open_rows` (queued + held by `priority, not_before, created_at`), `in_state`, `by_idempotency_key`, `by_nonce`, `sent_times(channel, since)` | `ticket_outbox` (index `idx_ticket_outbox_queue`) |
| `Directory.recipient(contact_id)` | phone (digits), e-mail, lang, display name, `user_id`, opted-out - read at SEND time | `ticket_contacts` (erased rows -> None) |
| `Links` | `url(link_id)` (fragment URL, None when not live), `redeem_url(link_id)` (mints a `ticket_link_redeems` row), `sent_via`, `requires_code`, `note_sent(link_id, via, purpose, at)` (sets `sent_via`, extends the sliding expiry for reminders / resends) | `links.py` (slice 4) |
| `Templates.pick(purpose, lang, department_id, template_id)` | return a `TemplateText` or None (the outbox falls back to the starter); use `templates.choose()` over the department + installation rows | `ticket_templates` |
| `Context` | `module_on`, `time_zone` (`time.zone`), `send_window(department_id)` (`hours.effective_window(settings.send_hours, department.send_hours_json)`), `display_name` (14.3 block), `email_fallback`, `email_configured` | settings |
| `Hooks` | `queued`, `held`, `outcome(row, result, account)` (timeline row from `timeline_kind(row)` + the account label; audit `ticket.message.send` envelope), `cancelled`, `send_failed` (CR-018 `ticket.send_failed`), `fallback(row, step, new_row)` (`nobody` -> ticket `waiting_on = manager`, reason `send_failed`; `code_unavailable` -> the code route answers 503), `still_relevant` (module re-enabled: false for a reminder of a closed ticket) | tickets services + notify bridge (slice 6) |
| e-mail `TicketChannel` (`key = 'email'`) | `send(msg)` -> `SendResult` via `notify_email.smtp_send`; `msg.text` already carries the REDEEM link; `msg.subject` = "<module name> <number>" | `channel_email.py` |
| `inbound.MatchDirectory` | `by_nonce(nonce)` -> `NonceTarget` (outbox row + link live + assignment current + `require_code` + ticket status + contact `phone_key` + provider message id); `candidates(sender_key, since, account_key)` -> live assignments of contacts with that `phone_key` whose last `sent` row is after `since` | outbox + links + assignments + contacts |
| `inbound.DedupeStore.seen(key, now)` | `INSERT OR IGNORE` on `ticket_inbound.dedupe_key` (UNIQUE) within 24 h | `ticket_inbound` |
| `TicketAccountFilter(mapped_keys, recent_keys)` | `mapped_keys = AccountsService.mapped_keys('tickets')`; `recent_keys(since)` = distinct `ticket_outbox.account_key` of rows sent after `since` | outbox |

Applying an `InboundDecision` (5b): write one `ticket_inbound` row when `decision.record` (`content` only for ambiguous / note /
late); `status` -> the forward-only transition (`decision.action`, `actor_kind = 'inbound'`, `via = 'whatsapp'`, note "via
WhatsApp (unverified sender)"); `note` / `late` -> a note row (late flagged "התקבלה באיחור") and `waiting_reason = late_reply` for
late; `ambiguous` -> CR-018 `ticket.reply_unmatched` to the managers of `candidate_department_ids` (sender display name + time
only; the text after "זה שלי"); audit `ticket.inbound` with `decision.audit()`; `dropped` -> health counter only.

**Slice 5a (`messaging_send_ledger`, migration 0082):** `SqliteSendLedger(conn)` is ready (written against `LEDGER_DDL`, a copy
of the spec's table); `SqliteMirrorReader(conn, ws_connected)` reads `ha_entities`; `AccountsService(load_doc=..., reader=...,
registry=UseRegistry(tickets_uses(module_on)))`. Routes: `GET /messaging/whatsapp` = `doc_to_json` (mask manual values unless
`messaging.accounts.manage`) + `statuses()` + `warnings()`; `PUT` = `validate_doc` (409 on `settings_stale`) + audit
`changed_uses()` + confirm with `Outbox.open_count(use_key)`; `refresh` = `AccountsService.refresh()` + `read_last4()` per
connection entity (keep `last4` only); the test send = `Outbox.enqueue(purpose='test', test_target=..., test_account_key=...)`.

**Slice 6 (notify bridge):** `hours.signal_severity(priority.notify_severity, hours.urgent_is_critical(inst, dept))`;
`messaging_accounts.state_transitions(before, after, mapped)` for `ticket.channel_down` (dedupe `ticket-channel:<key>`).

**Slice 7 (codes):** `outbox.code_request_check(previous_sends_of_link, now)` (1 / 60 s, 3 / h, 6 / day per link);
`code_route(link_sent_via, whatsapp_ok, email_ok)` at `code/send` and `assignment_code_check(...)` at assign time (409
`code_channel_unavailable`); enqueue with `purpose='code', code=<6 digits>` (the code stays in memory, never in the row).

## 3. Registration checklist (one line each; owners per spec section 20)

- `main.py _start_janitor`: build the `Outbox` + `OutboxThread(outbox, clock=utcnow, drain_inbound=...)`, `start()` (it runs
  `recover_after_restart` first); `_stop_janitor`: `stop()`. (5b)
- `main.py janitor_tick`: prune `messaging_send_ledger` older than `messaging_accounts.LEDGER_KEEP` (2 days); prune inbound /
  outbox per 15.1. (5a / 5b)
- `ha_sync.py`: subscribe `inbound.TICKET_EVENTS` when the module is on, WhatsApp is enabled and a ticket use is mapped; the
  `on_message` branch calls `InboundQueue.submit(event)` (never logs the event). (5b)
- `backup.SETTINGS_KEEP`: `messaging.whatsapp` (plus the tickets keys of slice 1). (5a / 1)
- `routers/access.py PERMISSION_LABELS` + `roles.json` + sensitive list: `messaging.accounts.manage`. (1)
- `remote_channel.BLOCKED_ON_REMOTE`: the test-send route. (5a)
- Routes: `POST /tickets/{id}/outbox/{outbox_id}/send-now` -> `Outbox.send_now` (gate `tickets.external` + visibility, audit
  `ticket.message.send_now`); "שלח שוב" -> `Outbox.resend`; link revoke / contact erase -> `Outbox.cancel_where(...)`. (5b / 4)
- `management/upstream_watch.json`: `FaserF/ha-whatsapp` (add-on + integration). (8)
- Installer guide (required): exclude `whatsapp_message_*` events and the integration's "last message" sensor from the HA
  recorder. (8)

**SQLite rule for the wiring:** the provider call must never run inside a write transaction. `Outbox` already releases its own
lock around the call; the SQLite store must commit the claim (`queued -> sending`), call the provider under `db.unlocked(conn)`,
then write the outcome (the CAS `save` keeps a concurrent cancel safe).

## 4. Proposed schema additions (for the owner of 0081)

`OutboxRow` carries five fields the spec's `ticket_outbox` does not have; slice 5b adds them to `0081_ticket_messaging.sql`:

| Column | Why |
|---|---|
| `idempotency_key TEXT` + `CREATE UNIQUE INDEX ... WHERE idempotency_key IS NOT NULL` | a repeated enqueue (same request) returns the first row - no second message |
| `held_since TEXT` | the `hold_when_down_min` clock of channel_down / account_unmapped holds (`updated_at` moves on every write) |
| `first_attempt_at TEXT` | the 30-minute retry span |
| `resend_of TEXT` | "שלח שוב" of an `unknown` / failed row (the old row keeps its state) |
| `send_now INTEGER NOT NULL DEFAULT 0` | D29: the person's release of the send hours |

A `test` row also writes `account_key` at enqueue (the per-account test send names its account); every other row writes it at claim.

## 5. Decisions and interpretations (safest reading; recorded, not asked)

1. Message kinds: "escalation" is not a channel message (managers get CR-018 signals, 13.3); a "status echo" is only a notice a
   manager's act causes (closed / reassigned / reopened / update) - the channel never answers an inbound reply (Q14).
2. `send_now` releases any message held by the send hours (the route table of 8.1), not only `assign`; at enqueue the flag is
   kept for `assign` only (the assign dialog's choice).
3. A verification code waits at most `CODE_HOLD_MIN` = 2 minutes for a down / unmapped account (not 15): it expires in 10.
4. Test sends: never held by send hours, a down account ends `not_sent` at once, no fallback, the typed number lives in memory
   only (a restart ends the row `target_lost`). Codes likewise live in memory only (`code_lost` after a restart).
5. Classification beyond the spec's table: 408, any 3xx and any 5xx -> `unknown`; other 4xx -> `not_sent` (`ha_rejected`);
   400 is split into `account_not_found` / `response_unsupported` / `bad_request` (all `not_sent`). `response_unsupported` makes
   the adapter stop asking for `return_response` for that service (the outbox retry then sends) - safe because a 400 is rejected
   before the service runs.
6. The classified HA call (`call_service_classified` in the spec) lives in the adapter (`HaServiceTransport`) so no shared file is
   edited; it uses `ha_client.configured / _rest_base / _headers`. Moving it into `ha_client.py` later is mechanical.
7. Account state `unknown` holds a row when it comes from the connection entity or the websocket; an account whose state can only
   be learnt from sends (manual without a status entity, or no connection entity) may be tried while `unknown`.
8. A manual account without a label shows "וואטסאפ (ידני)" - a typed value (maybe a number) never becomes a label.
9. Template choice (D26): contact language before Hebrew; department before installation; configured templates before starters.
   The `code` template also refuses `{place}` and `{device}` (the spec names link and title).
10. A line that starts with `{module_name}` renders the noun capitalised (en / ru sentences).
11. Inbound: an event without a usable timestamp is `late` (never a status); an action word counts only when it is the WHOLE
    reply (minus references); a bare number is a reference only in a reply made of numbers; a reference that matches none of the
    sender's live tickets makes the reply `ambiguous` (never guessed); an unknown nonce is `ignored`, a nonce of an ended
    assignment / dead link is `ignored`; action words in he / en / ar / ru, Arabic-Indic digits folded.
12. Retries of `not_sent`: 4 attempts in all (2, 8, 20 minutes apart, within 30 minutes); non-retryable codes go straight to
    the fallback (no phone, no address, opted out, render too long, template missing, code lost, contact missing, link not live).
13. A row found `sending` at start becomes `unknown` (`interrupted`) and counts in the ledger.
14. E-mail fallback rows obey the send hours and the module's 10 e-mails / hour.
15. `messaging_accounts.py` imports the message types from `services/tickets/channel.py`; a later module that uses accounts
    without tickets may want those types moved to a neutral module (no behaviour change).

## 6. UNVERIFIED (needs the owner-approved live checks on his installed `ha-whatsapp`)

Slice 5a (read-only):
- entities of the integration carry `platform = 'whatsapp'` and a `config_entry_id` in the mirror;
- the connectivity binary sensor exists with `unique_id = '<entry_id>_connection'`, states `on` / `off`;
- its `phone_number` attribute (and whether "Mask Sensitive Data" masks it);
- what the "last message" sensor puts into the general entity mirror (spec risk 6).

Slice 5b (one approved test send to the owner's own number, one reply and one button tap from his phone):
- `send_message` / `send_buttons` accept `account` = the config entry id;
- `?return_response` over REST: supported, and the shape (`success`, `message_id`);
- the REST status and body of a `ServiceValidationError` (unknown account, several accounts);
- `entry_id` (and `session_id`) on `whatsapp_message_received` / `whatsapp_button_pressed`;
- the real shapes of `sender_number` (digits, JID, `@lid`), `timestamp` (epoch s / ms / ISO) and the button event fields;
- whether buttons render on current clients (they stay off by default).

## 7. Tests (local, Python 3.12 venv, one process)

`python -m pytest tests/test_tickets_msg_templates.py tests/test_tickets_msg_hours.py tests/test_messaging_accounts.py
tests/test_tickets_msg_whatsapp.py tests/test_tickets_msg_outbox.py tests/test_tickets_msg_inbound.py tests/test_tickets_msg_logscan.py`

| File | Tests | Covers |
|---|---|---|
| `test_tickets_msg_templates.py` | 45 | model, hygiene, reprs, registry, validation codes, starters valid in 4 languages, module-noun lint, rendering, D33 rename + gender, D26 choice, property test |
| `test_tickets_msg_hours.py` | 31 | window validation, overrides, DST days (Jerusalem spring / autumn, a gap opening, New York), who waits, send now, D28, property test |
| `test_messaging_accounts.py` | 30 | discovery edge cases, states, sends-derived state, missing mark, manual accounts, resolution order, document parse / validate / audit diff, labels, warnings, ledger (memory + SQLite), pacing caps, shared budget, property test over a simulated day, SQLite mirror reader, state transitions |
| `test_tickets_msg_whatsapp.py` | 48 | the service call, buttons, unsendable messages, the 9.4 table, unknown account, return-value fallback, exceptions, ApiError mapping, reach, log hygiene, the real httpx transport on a MockTransport (connect vs transfer split) |
| `test_tickets_msg_outbox.py` | 51 | see the commit message; incl. property test over random operations, provider calls outside the lock, concurrent ticks |
| `test_tickets_msg_inbound.py` | 64 | normaliser, timestamps, LID / group, parse table, advisory table, account filter, freshness, dedupe, nonce paths and refusals, text paths, ambiguity, advisory-only property test, log hygiene, queue |
| `test_tickets_msg_logscan.py` | 1 | the end-to-end flow with a root DEBUG capture: no number, token, redeem id, code or text in logs, hooks, envelopes, ledger, rows |

NOT_RUN: the full backend suite and every runner job (a release gate holds the shared runner; this branch adds only new files);
every live check of section 6.

## 8. Known limits

- No SQLite `OutboxStore`, no e-mail adapter, no routes, no `ha_sync` subscription, no CR-018 signals: interfaces + fakes only
  (slices 5a / 5b / 6 / 7).
- Pacing jitter, the sends-derived account state and the `missing` mark live in memory (a restart forgets them: the next gap
  draws a fresh jitter, the state starts `unknown`).
- `MemoryDedupe` is for tests; production dedupe is the UNIQUE `ticket_inbound.dedupe_key`.
- Starter texts in Arabic and Russian need a native speaker's review (slice 8); Russian starters use the nominative only.
- Cost-claim purposes (`cost_*`) are accepted by the model but ship no starter text (slice 9).
