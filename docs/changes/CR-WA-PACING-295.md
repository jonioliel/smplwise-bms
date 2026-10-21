# CR-WA-PACING-295 - one WhatsApp send budget for Arx and WisKey

Task: `tickets-wiskey-send-pacing` (plan `private/planning/versions_plan_data_2026-10-20.json`, blocked on WisKey, accelerated by the owner
2026-10-21). Branch `pilot/WAPACE-295` from `origin/main` (v2.10.0). Migration **0144** (built as provisional 0150; renumbered at integ/2111).
Revision 2 (2026-10-21, after the owner's numbers and WisKey's reply, `private/planning/wa_pacing_2026-10-21/WISKEY_REPLY_2026-10-21.md`).

## 1. Problem

Several senders can use one WhatsApp number: ticket messages and codes (tickets outbox, through `ha-whatsapp`), system notifications
(`notifications.whatsapp`), temperature reports, access and reset codes - all counted in the shared ledger `messaging_send_ledger`, paced by
`messaging_accounts.PacingGate` (minimum gap, per hour, per day, per recipient) - and WisKey's own messages (the people screen, through
`services/intercom_messaging.py`, which keeps its own hourly caps in `intercom_messages`). Nothing made them one budget, nothing slowed down
when the platform said "too many", and a message that kept waiting on pacing had no end.

## 2. What Arx guarantees on its own side

The contract lives in `services/wa_pacing.py`. It adds to the legacy gate, never replaces it (the tickets outbox takes the later of the
two decisions).

| Rule | Value |
|---|---|
| Modes | `conservative` (default), `standard`, `off` (= the legacy gate alone, byte for byte). Setting `messaging.pacing`, kept out of project backups. |
| Numbers (owner 2026-10-21: WhatsApp was tested at 10 a minute) | conservative **10 per minute, burst 5 per 10 s**; standard 20 and 8. `per_minute` and `burst` are settings that override the profile (1-120, 1-60). **300 per hour and 1500 per day** are the account's own `Pacing` (`per_hour`, `per_day`; ranges raised to 2000 / 10000). The owner gave the hour and day numbers as an extrapolation; they are settings. |
| Legacy defaults moved | `messaging_accounts.Pacing` defaults are now min gap 5 s, jitter 1 s, 300 an hour, 1500 a day (they were 15 s, 10 s, 30, 150: a 15 s gap alone would have capped the account at 4 a minute). An account whose pacing is already stored keeps its stored numbers; only accounts that never saved pacing move. |
| Priority classes | alert 100 %, code 95 %, ticket 80 %, reminder 60 %. A class may start a send only while the account's TOTAL use in the window (Arx senders + WisKey) is below its share of each cap (at least one). Class: `notifications.whatsapp` = alert; codes and administrator tests = code; assignments, updates, closing notices = ticket; reminders, reports, temperature reports = reminder. Inside the tickets outbox the existing order (codes, assignments, the rest) still decides who goes first. |
| Alerts | Counted, **never delayed by a backoff, a pair backoff or a WisKey throttle** (owner decision). They are still held back by nothing here; today the notification worker does not consult the pacer at all, so its behaviour is unchanged. |
| WisKey as foreign load | (a) Arx's own record of messages handed to WisKey (`intercom_messages` pending / sent / unknown) when `wiskey_shared` (default on); with a `senders` mapping only the mapped accounts carry it. (b) WisKey's `wiskey_own.charged_*` counters (section 3). (c) Leases granted through the reservation port (section 4). |
| Backoff | HTTP 429, 130429, 131048, "rate limit" / "too many requests" -> the whole account waits 60 s, doubling to 30 min, reset by the next accepted send. 131056 / "pair rate" -> only that sender/recipient pair waits 5 min, doubling to 1 h. The message did not leave: it is requeued without using a retry attempt. |
| Never silently dropped | A message waiting on the budget (or on backoff) has an age clock per class (defaults: alert 60 min, code 5, ticket 360, reminder 720; settable 1-2880). At the limit it ends `not_sent` with code `pacing_expired` through the normal path: manager notice (`ticket.send_failed`), e-mail fallback where it exists. |
| Visible counters | Per account and class, per hour: sent, deferred, backoff, pair_backoff, expired, lease_granted, lease_denied (table `wa_pacing_counter`, 8 days); queue waiting (count, oldest age); the backoff in force; sends of the last hour (Arx and WisKey); WisKey's counters or `unknown`. `GET /messaging/whatsapp/pacing`. No number, text or recipient. |
| Tickets module off | The tickets outbox does not tick (messages are held `module_off`), so the pacer is never consulted and no counter moves. The route reports `applies: false`. No ticket action exists in this UI (tested). |
| `shared_budget_guaranteed` | **false** in the route, until WisKey reserves through the port for every shared sender (section 4) - a polled counter is not a reservation. |

Platform assumption, UNVERIFIED on the installed `ha-whatsapp`: how it reports a rate answer (HTTP status or text in the service
response). `channel_whatsapp.classify` recognises both; the fake follows HTTP 429. No real send was made.

## 3. WisKey's contract `whatsapp_pacing_status_v1` (tolerant reader, Arx side only)

WisKey's reply (a specification of additions, not implemented on its side yet) adds per `accounts[]` of `whatsapp/status`: `pacing_schema_version`,
`sender_ref` (opaque, stable), `sender_match_verified`, `counters_complete`, `wiskey_own.charged_1m/1h/24h`, `throttled_until`,
`throttle_scope`, `retry_after_s`. `intercom_messaging_adapter.project_status` keeps only those keys (plus the existing ones) and the adapter
remembers them; the outbox worker reads that cache and never waits on WisKey. Rules, all tested:

1. Only `wiskey_own.charged_*` is counted against the Arx budget. `sent_*` is ignored (Arx already counts the messages it handed on, so counting it would charge twice).
2. A null counter, `counters_complete != true`, an absent or unverified sender, or a cache older than 5 minutes is **unknown, never zero**: nothing is added to the budget and the route says `unknown`.
3. An Arx account is matched to a WisKey sender only through the configured map `senders` (account key -> `sender_ref`) AND WisKey's own `sender_match_verified`. Never by name or last four digits.
4. A verified `throttled_until` with scope account / sender / absent holds every class except alerts until then; any other scope is not applied account-wide.
5. Once the reservation port is used for an account, its leases are WisKey's sends: `charged_*` is then ignored for that account (WisKey's `charged` includes its reservations, so both would count the same send twice).

Error classes (`intercom_messaging_adapter.classify`): `rate_limited` (already), `pair_rate_limited` (not sent, retry hint 300 s, HTTP 429
`message_pair_rate_limited`), `pacing_expired` (not sent, HTTP 410 `message_pacing_expired`) are refusals that provably left nothing;
`whatsapp_send_uncertain` and `status_unknown` are always `unknown` - never a refusal, never resent by Arx. The existing `rate_limited` of
the preview cache is not treated as a provider slowdown and starts no backoff.

## 4. The reservation port

The full wire, authentication, lease, outcome, reconciliation and fail-open contract is **`CR-WA-PACING-295-PORT-CONTRACT.md`**. Summary: `POST
.../pacing/reserve`, `POST .../pacing/release`, `GET .../pacing/lease/{request_id}`; idempotent by `request_id`; 60 s leases (max 300, no renewal);
release outcomes `accepted_by_provider | not_sent | unknown | expired` (unknown and an unreleased expiry are never credited); authentication is the
HA bearer token of a dedicated owner-created HA user on the remote channel, authorised by the single new permission `messaging.pacing.reserve`
(not `messaging.accounts.manage`); `charged_unreserved_*` prevents double charging against WisKey's `wiskey_own.charged_*`.

## 5. Files

- `services/wa_pacing.py` (pacer, WisKey reader, reservations, stores, config, snapshot); migration `0144_wa_pacing.sql` (state, wait, counter, lease; operational tables, not project tables).
- `services/tickets/channel_whatsapp.py`, `services/tickets/outbox.py`, `services/tickets/messaging.py` (rate answers, Ports.pacer, backoff requeue, release, wiring, janitor prune).
- `services/intercom_messaging_adapter.py`, `routers/access_control_messaging.py`, `services/intercom_consent.py` (pacing block, error classes).
- `services/messaging_runtime.py` (`pacer_on`, `pacing_for`, `wiskey_pacing`), `routers/messaging_accounts.py` (`GET/PUT .../pacing`, `POST .../reserve`, `POST .../release`; audit `messaging.pacing.update`), `services/backup.py` (setting kept out of backups), `services/messaging_accounts.py` (Pacing defaults and ranges).
- Frontend: `api/messaging-pacing.ts`, `messaging/pacing-model.ts`, `i18n/messaging-pacing.ts` (he/en/ar/ru; ar/ru dev-marked), `screens/messaging-pacing-card.ts` in Settings > messaging channel.
- `roles.json` / `routers/access.py`: the sensitive permission `messaging.pacing.reserve` (no built-in role holds it).
- Tests: `tests/test_wa_pacing.py`, `frontend/tests/unit-messaging-pacing.spec.ts`.

## 6. Open questions

1. `remote_access` on (the only existing channel a non-human caller can use) or a bridge relay - see the port contract, section 2.
2. Does WisKey's `sender_ref` for the tickets number exist yet, and who sets the `senders` map - the administrator by hand, or a pairing step?
3. The hour and day numbers (300 / 1500) are the lead's extrapolation from 10 a minute; confirm against the account's real history.
4. How `ha-whatsapp` reports a rate answer is unverified (section 2).

## 7. Rollback

Set the mode to `off` (legacy gate alone), or run the previous version; the four tables are ignored by it. The raised legacy `Pacing` defaults
apply only to accounts that never stored pacing; a stored account is unchanged.
