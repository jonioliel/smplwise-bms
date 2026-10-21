# CR-WA-PACING-295 - one WhatsApp send budget for Arx and WisKey

Task: `tickets-wiskey-send-pacing` (plan `private/planning/versions_plan_data_2026-10-20.json`, blocked on WisKey, accelerated by the owner
2026-10-21). Branch `pilot/WAPACE-295` from `origin/main` (v2.10.0). Migration **0150 is provisional** (the lead renumbers at integration).

## 1. Problem

Several senders can use one WhatsApp number: ticket messages and codes (tickets outbox, through `ha-whatsapp`), system notifications
(`notifications.whatsapp`), temperature reports, access and reset codes - all counted in the shared ledger `messaging_send_ledger`, paced by
`messaging_accounts.PacingGate` (minimum gap, per hour, per day, per recipient) - and WisKey's own messages (the people screen, through
`services/intercom_messaging.py`, which keeps its own hourly caps in `intercom_messages`). Nothing made them one budget, nothing slowed down
when the platform said "too many", and a message that kept waiting on pacing had no end.

## 2. What Arx guarantees on its own side (this change)

The contract lives in `services/wa_pacing.py`. It adds to the legacy gate, never replaces it (the legacy gate still applies; the tickets
outbox takes the later of the two decisions).

| Rule | Value |
|---|---|
| Modes | `conservative` (default), `standard`, `off` (= the legacy gate alone, byte for byte). Setting `messaging.pacing`, kept out of project backups. |
| Per-minute / burst | conservative 3 per minute and 2 per 10 s; standard 6 and 3. A rolling-window form of a token bucket (capacity = burst, refill = per_minute / 60). |
| Per-hour / per-day | The account's own `Pacing.per_hour` (30) and `per_day` (150) - one place to set them. |
| Priority classes | alert 100 %, code 95 %, ticket 80 %, reminder 60 %. A class may start a send only while the account's TOTAL use in the window (Arx senders + WisKey) is below its share of each cap (at least one). Alerts therefore always keep headroom reminders cannot take. Class: `notifications.whatsapp` = alert; codes and administrator tests = code; assignments, updates, closing notices = ticket; reminders, reports, temperature reports = reminder. Inside the tickets outbox the existing priority order (codes, assignments, the rest) still decides who goes first. |
| WisKey as foreign use | Messages Arx handed to WisKey (`intercom_messages`, outcome pending / sent / unknown) count against the same windows when `wiskey_shared` is on (default on, the conservative reading). WisKey sends that Arx did not initiate are invisible to Arx - see section 4. |
| Backoff | HTTP 429, 130429, 131048, "rate limit" / "too many requests" -> the whole account waits 60 s, doubling to 30 min, reset by the next accepted send. 131056 / "pair rate" -> only that sender/recipient pair waits 5 min, doubling to 1 h. During an account backoff only alerts may pass, until 3 consecutive rate answers (then everyone waits). The message did not leave: it is requeued without using a retry attempt. |
| Never silently dropped | A message waiting on the budget (or on backoff) has an age clock per class (defaults: alert 60 min, code 5, ticket 360, reminder 720; settable 1-2880). At the limit it ends `not_sent` with code `pacing_expired` through the normal path: manager notice (`ticket.send_failed`), e-mail fallback where it exists. Pair-rate and 429 waits are not failures until the limit. |
| Visible counters | Per account and class, per hour: sent, deferred, backoff, pair_backoff, expired (table `wa_pacing_counter`, 8 days); queue waiting (count, oldest age); the backoff in force; sends of the last hour (Arx and WisKey). `GET /messaging/whatsapp/pacing`. No number, text or recipient. |
| Tickets module off | The tickets outbox does not tick (messages are held `module_off`), so the pacer is never consulted and no counter moves. The route reports `applies: false`. Notification senders keep their existing budget share rules. No ticket action exists in this UI. |

Platform assumptions, UNVERIFIED on the installed `ha-whatsapp`: how it reports a rate answer (HTTP status or a text in the service
response). `channel_whatsapp.classify` recognises both; the fake follows the documented HTTP 429. A real observation is needed before the
wording is trusted (the owner allows read-only observation; no real send was made).

## 3. Files

- `services/wa_pacing.py` (pacer, stores, config, snapshot), migration `0150_wa_pacing.sql` (state, wait, counter; operational tables, not project tables).
- `services/tickets/channel_whatsapp.py` (rate answers -> `rate_limited` / `pair_rate_limited`), `services/tickets/outbox.py` (Ports.pacer, check, backoff requeue, release), `services/tickets/messaging.py` (wiring, janitor prune).
- `routers/messaging_accounts.py` (`GET/PUT /messaging/whatsapp/pacing`, `messaging.accounts.manage`, audit `messaging.pacing.update`), `services/backup.py` (setting kept out of backups).
- Frontend: `api/messaging-pacing.ts`, `messaging/pacing-model.ts`, `i18n/messaging-pacing.ts` (he/en/ar/ru; ar/ru dev-marked), `screens/messaging-pacing-card.ts` inside Settings > messaging channel.
- Tests: `tests/test_wa_pacing.py`, `frontend/tests/unit-messaging-pacing.spec.ts`.

## 4. What only WisKey can do (request in `private/planning/wa_pacing_2026-10-21/PROMPT_TO_WISKEY_HE.txt`)

1. Report, per messaging account, how many messages left in the last minute, hour and day - all of them, including ones Arx did not ask for - in `whatsapp/status` next to `quota`.
2. Say which WisKey account is the same physical number as an Arx account (so `wiskey_shared` can be per account instead of global).
3. Return rate answers as distinct codes (`rate_limited` account-wide, `pair_rate_limited` per recipient) with `retry_after_s` when known, instead of a generic failure.
4. Self-limit its own non-Arx WhatsApp sends to the shared budget: at most the numbers in section 2 minus Arx's share, alerts first, and honour a backoff Arx or the platform announced.
5. Optionally push a "backing off until T" event so Arx can pause without discovering it by failing.

## 5. Open questions for the owner

1. Is WisKey's number the same as the tickets number on this installation (decides the `wiskey_shared` default per account)?
2. Are the conservative numbers (3 per minute, 30 per hour) acceptable for the account's real history, or has the platform already flagged it?
3. Should the notification worker (alerts) also be gated by the pacer in backoff, or keep its own share rules as today? (Today only the tickets outbox consults the pacer; alerts are counted, never delayed by it.)

## 6. Rollback

Set the mode to `off` (legacy gate alone), or run the previous version; the three tables are ignored by it.
