# NOTIFWA - the `whatsapp` notification channel (design note)

Status: built on `pilot/NOTIFWA-whatsapp-channel`; **master switch OFF by default**; an independent security review is
requested before anyone switches it on. Code: `services/notify_whatsapp.py`, `routers/notify_whatsapp.py`,
`frontend/src/components/notify-whatsapp-section.ts`. No migration (delivery rows, settings key and send ledger exist).

## Data flow

1. A source emits (cameras, sensors, recorders, automations, generator, tickets - every source in `notify_policy.SOURCES`;
   electricity sources join the same way when they are added). The administrator's policy row may now carry
   `channels.whatsapp = true` (the 422 `channel_reserved` answer is removed for this channel only; `ha_mobile` stays reserved).
2. `notify_channels.dispatch` plans the channel (READ phase, no I/O) through the unchanged `Channel` interface:
   master switch -> the account of the use `notifications.whatsapp` (Settings › ערוץ ההודעות, the tickets module's account
   mapping) -> per recipient user: visibility (`Reach.can_see`), the NUMBER RESOLVER, consent and the user's own opt-out,
   snooze, quiet hours (pass-through matrix column `whatsapp`, critical passes by default, an escalation always passes),
   de-duplication (a sent WhatsApp for the same notification and user within `dedupe_min`), the per-user hourly cap
   (non-critical only). Every decision is one `notification_deliveries` row (`queued` or `skipped` + reason).
3. `send` (notifier thread) only hands the queued targets to the channel's own worker thread. The worker re-checks
   everything that can change (switch, policy, state, visibility, number, consent), resolves the account at send time,
   applies the account's pacing over the shared send ledger (`messaging_send_ledger`: shared with ticket messages, so one
   number has one budget), calls the tickets module's adapter `channel_whatsapp.WhatsAppChannel` (allow-listed
   `whatsapp.send_message` only, `account` always sent), records the outcome on the delivery row, the ledger row
   (sent / unknown) and one content-free audit row `notify.whatsapp.send`.

## Recipient resolver (interface for TKSTAFF1)

`NumberResolver.resolve(conn, user_id) -> ResolvedNumber | None` with `digits` (never logged, hidden from repr), `lang`
(he / en / ar / ru), `source` and `consent` (`granted` | `declined`). Resolvers are tried in registration order
(`register_resolver(r, first=True)` puts a new one in front). Today: `directory` - the tickets contact directory row whose
`user_id` is the Arx user (active, not erased, a valid number); consent = the contact's preferred channel is WhatsApp.
The user's own opt-out (`PUT /me/notify-whatsapp`) overrides any resolver. TKSTAFF1 registers a `profile` resolver for the
new staff mobile field; nothing else changes.

## Failure modes

| Failure | Behaviour |
|---|---|
| switch off / use unmapped | one `skipped / channel_unavailable` row per dispatch; nothing is called |
| account disconnected / missing | the job waits (60 s steps) up to the account's `hold_when_down_min`, then `failed / channel_down` |
| pacing (gap, hour, day, per-recipient) | the job waits until the ledger frees, at most 10 min (30 min critical / escalation), then `skipped / rate_limited` |
| `not_sent` (HA unreachable, service missing ...) | retried 3 times (1, 5, 15 min), then `failed / <code>` |
| `refused` | `failed / provider_refused`, never retried |
| `unknown` (timeout after the request, 5xx, malformed) | `failed / unknown_outcome`, NEVER retried (it may have left) |
| restart with jobs in memory | rows left `queued` / `retry` become `failed / interrupted` (housekeeping), never re-sent |
| worker queue full (200) | `failed / unavailable` |

## Abuse cases

- **Recipient enumeration.** No route takes a phone number. The test send goes only to the CALLER's own resolved number;
  the settings answer gives a COUNT of reachable users, never names or numbers; delivery rows show `····NN` (last two
  digits) to `notify.manage` holders only; `/me/notify-whatsapp` shows a user only their own masked number.
- **Flooding.** Policies are per source (notify.manage); the fold / dedupe window of the notification core, the channel's own
  de-duplication, the per-user hourly cap (default 4, 1-30), the account pacing (15 s gap + jitter, 30/h, 150/day,
  4/recipient/h, shared with tickets), the hold ceiling and a bounded queue. The test send: 3/hour per user + 5/hour per account.
- **Template injection.** Texts are code-owned (he / ar / ru / en), not editable. Values (title, place, body) are one line,
  Cc / Cf stripped, capped, WhatsApp markup characters removed, URLs replaced by `[…]`, rendered in ONE pass. The
  administrator's lock-screen level applies (`generic` = no title, no place). Personal subjects follow the same rule.
- **PII in logs.** Numbers and texts are never logged, never audited and never stored: the delivery row keeps `····NN`, the
  ledger keeps an HMAC of the number under `k_messaging`, the audit row keeps ids, outcome code and account KEY. The settings
  key `notify.whatsapp` is never exported or restored by a project backup (a restore can never switch WhatsApp on).
