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
`user_id` is the Arx user (active, not erased, a valid number). A resolver's own record can only DECLINE (the directory: the
contact's preferred channel is not WhatsApp). **Consent is the user's own act (review F1):** `PUT /me/notify-whatsapp
{opted_in: true}` stores `HMAC(k_messaging, number)` of the number the user saw (`····NN`); `resolve_number` grants only when
that HMAC equals the HMAC of the number resolved NOW. The default is not opted in; any change of the number (whoever edits the
directory row) reads as `declined` until the user confirms the new one (shown to them as "המספר השתנה"). TKSTAFF1 registers a
`profile` resolver for the new staff mobile field; nothing else changes (the opt-in binds to whatever number resolves first).

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
| worker queue full (200) or more than 500 jobs waiting in memory | `failed / unavailable` |
| notifications used their share of the account budget (default 50 % of the hourly / daily budget, critical 80 %) | held like pacing (`retry / budget`), then `skipped / rate_limited`; ticket messages and codes keep the rest |
| a job held while the user acknowledged / snoozed, or quiet hours began | re-checked at send time: `skipped / acknowledged`, `snoozed`, `quiet_hours` |
| an outbox replay after a crash | never a second send: `new` / `resolved` once per notification and user, an escalation once per step, a renotify once per window (rows that may have left count) |

## Abuse cases

- **Recipient enumeration.** No route takes a phone number. The test send goes only to the CALLER's own resolved number;
  the settings answer gives a COUNT of reachable users, never names or numbers; delivery rows show `····NN` (last two
  digits) to `notify.manage` holders only; `/me/notify-whatsapp` shows a user only their own masked number.
- **Flooding.** Policies are per source (notify.manage); the fold / dedupe window of the notification core, the channel's own
  de-duplication, the per-user hourly cap (default 4, 1-30), the account pacing (15 s gap + jitter, 30/h, 150/day,
  4/recipient/h, shared with tickets) with the notifications share on top (review F3), the hold ceiling, a bounded queue and
  heap, a minimum de-duplication window of 5 minutes. Adding WhatsApp to a generator policy needs notify.manage (review F7). The test send: 3/hour per user + 5/hour per account.
- **Template injection.** Texts are code-owned (he / ar / ru / en), not editable. Values (title, place, body) are one line,
  Cc / Cf stripped, capped, WhatsApp markup characters removed, URLs replaced by `[…]`, rendered in ONE pass. The
  channel has its OWN detail level (`generic` or `type_place`, default `type_place`; never the alert body - review F9), and a
  `generic` lock-screen level is never loosened. Link filter (review F6): any scheme, `www.`, IPv4 and any dotted name ending in a
  letter label is replaced (dotted ids like `ups.battery_level` too); `* _ ~` ` and a leading `>` are removed.
- **PII in logs.** Numbers and texts are never logged, never audited and never stored: the delivery row keeps `····NN`, the
  ledger keeps an HMAC of the number under `k_messaging`, the audit row keeps ids, outcome code and account KEY. The settings
  key `notify.whatsapp` is never exported or restored by a project backup (a restore can never switch WhatsApp on).

## Review 2026-10-16 (private/planning/NOTIFWA_SECURITY_REVIEW_2026-10-16.md)

F1-F10 addressed on this branch (see the sections above). Correction: the first report counted 41 backend tests in
`test_notify_whatsapp.py`; the file had 40 (the reviewer's count is right). Open for the owner: the 50 % / 80 % budget defaults
(F3) and the `type_place` default detail level (F9). Not changed: the cross-worker check-then-record race between the ticket
outbox and this worker over one account (pre-existing design, noted by the reviewer); restore notes (F11).

## Re-review 2026-10-16 (private/planning/NOTIFWA_SECURITY_REREVIEW_2026-10-16.md)

- **R1** `clean()` now normalises first (NFKC; ideographic / fullwidth / halfwidth dots -> `.`), strips the WhatsApp markup and a
  leading `>`, and only then masks links; a TLD may start with any letter, so IDN names (`пример.рф`, `evil.中国`) are masked.
  Zero-width characters were already stripped before matching. Spaced or bracketed dots (`evil . com`, `evil[.]com`) stay text:
  they are not links. The probed inputs are tests.
- **R2** (lead decision) the opt-in PUT must echo the `confirm` token the GET returned for the exact number shown (a change in
  between is 409 `number_changed`); the user sees the last FOUR digits of their own number; when the number behind an opt-in
  changes or disappears, the user is told once per change by the notification `notify.whatsapp_number` (inbox, push and the
  phone app by default; it can never be routed to WhatsApp, so it never reaches the new number) plus an audit row
  `notify.whatsapp.number_changed` (no digits). The sweep runs from the notification housekeeping. **Follow-up option (not
  built):** a possession check - send a short code to the number and grant only when it is typed back.
- **R3** on a generator policy that carries WhatsApp, changing recipients, severity, quiet mode, escalation or the enabled flag
  (or adding WhatsApp) needs notify.manage; other edits and removing WhatsApp do not.
- **R4** both shares are capped at 90 % (critical never below normal), and the share is `per_hour * pct // 100` with no round-up:
  a share of 0 slots means notifications always wait (a 1-2 per hour account stays with tickets).
- **R5** the user can withdraw an opt-in from the UI in every state (also while the contact list declines); a stored value out of
  range is clamped to the nearest allowed value and listed in `normalized` (shown in the section) instead of silently reset.
  **CSRF:** on the remote channel (`/arx`) the shared middleware refuses a state-changing request that carries the Arx session
  cookie without `Sec-Fetch-Site: same-origin` or a matching `Origin` (403 `csrf_refused`) - verified for
  `PUT /me/notify-whatsapp` by a test (no Origin, a foreign Origin: refused; same origin: passes to authentication). The local
  channel is HA Ingress (identity from the Supervisor proxy) and has no separate CSRF layer - unchanged pattern, as for every other
  PUT of the product.

## Second re-review 2026-10-16 (private/planning/TK251R_NOTIFWA_R2_REVIEW_2026-10-16.md, part B)

- **B-1** the opt-in token must be exactly 16 lowercase hex characters (anything else, non-ASCII included, is 422); compared as bytes.
- **B-2** the number-change sweep writes compare-and-set on the stored value it read: a fresh opt-in or a withdrawal in between is
  never overwritten, and a user is only told when the write succeeded.
- **B-3** when the number goes back to the confirmed one the "already told" marker is cleared, so a later change (also to the same
  other number) is told again.
- **B-4** an unreadable messaging key means "unknown": the sweep tells nobody, the key error is logged once per data directory, and
  the settings answer carries the warning  (shown in the section). Consent cannot be verified then, so
  nothing is sent (fail closed). The directory resolver does not depend on the tickets module switch, so a module switched off
  does not read as a removed number.
- **B-5** an old opt-in (number changed or removed) can always be withdrawn (, the stop button).
- **after_s** (decided): on a generator policy that carries WhatsApp, the delay before an alert fires is gated by notify.manage like
  recipients / severity / quiet mode / escalation / enabled - a shorter delay raises how often a flapping alert reaches WhatsApp.
