# CR-SMS118 - an SMS channel for service-request notifications

Board item r118. Branch `pilot/SMS118-295` from `origin/main` (v2.12.4, 320e5555). Status: PROPOSED (design only, no code).
Migrations are **PROVISIONAL from 0170**, one file (`0170_sms_channel.sql`); main is at 0145 today and other branches will claim numbers first, so the number is renumbered at integration.
Related: CR-038 (tickets module, D13 / 9.5 / 18A: "SMS is a future work item, the interface is ready"), CR-WA-PACING-295, CR-018 (notifications).

## 1. Goal

Reach people who are not on WhatsApp or the app: vendors, department handlers, and requesters of a service request. SMS carries a short Hebrew message with a **redeem link** (never bearer data), and nothing else. It is a fallback and an explicit per-contact preference, not a broadcast tool.

Non-goals: two-way SMS conversation (the reply buttons "1 / 2" of WhatsApp are not offered; replies are handled only as STOP, see 7); marketing; sending to internal users who have the app (push/inbox stay first); any change to WhatsApp or e-mail behaviour.

## 2. Where SMS fits in the channel model (as found in the code)

- Ticket messages: `services/tickets/channel.py` defines `TicketChannel` (five methods: `status`, `can_reach`, `send`, `supports_buttons`, `parse_inbound`), `CHANNELS = ("whatsapp", "email")`, `FALLBACK_ORDER = ("whatsapp", "email")` (comment: "SMS slots in later (18A)"), and the outcome words `sent / refused / not_sent / unknown` (unknown is never retried or re-routed). Adapters: `channel_whatsapp.py`, `channel_email.py`. Rows live in `ticket_outbox` (`channel` has a CHECK of those two values; the outbox is rebuilt by migration when a value is added).
- Contacts have `preferred_channel IN ('whatsapp','email','manual')` (migration 0081 area, `routers/tickets_contacts.py`).
- System notifications (CR-018): `services/notify_channels.py` `Channel` interface (`plan` / `prepare` / `send`, source policy per channel, quiet hours, delivery log `notification_deliveries`). SMS is **not** added there in slices 1-5 (administrators are internal and have push/e-mail); a later slice may add a `sms` notify channel for critical alerts to a duty phone, behind its own owner decision.

Priority (recommendation): `whatsapp -> sms -> email -> copy link` for contacts whose `preferred_channel` is not set; a contact whose `preferred_channel = 'sms'` goes SMS first, then e-mail. Reasoning: an SMS reaches a handset with no data or app and is read quickly, but costs money per message; e-mail is free but slow to be seen. The order is a setting (`tickets.channel_order`), not a constant, so the owner can put e-mail before SMS. Purposes that carry a one-time code (`code`, `phone_verify`) are WhatsApp-only today and stay so unless the owner asks otherwise (SMS OTP is the most abused channel; Q7).

## 3. Provider options (from general knowledge, UNVERIFIED, no sign-up made)

All three are HTTPS APIs callable from an add-on (outbound 443 only; sending needs no inbound port; delivery callbacks need a public URL, see 6). Prices and rules must be re-checked with the vendor before a decision.

| Option | Pros | Cons |
|---|---|---|
| **A. Israeli local aggregator (e.g. 019 SMS, Inforu, Sms4Free-type)** | Direct Israeli carrier routes, good delivery on all networks and with Hebrew; billing in ILS with Israeli invoices; Hebrew support; prepaid packages, typically a few agorot per segment (order 0.05-0.15 ILS, UNVERIFIED) | API quality and docs vary, some legacy XML/HTTP; account approval and sender registration take days; callback formats differ per provider |
| **B. Twilio (or Vonage / MessageBird-class global CPaaS)** | Best API, REST, signed status callbacks, test credentials and magic numbers that fit our fake-provider tests; documented STOP handling | Higher price to Israel (order 0.04-0.08 USD per segment, UNVERIFIED), dollar billing; alphanumeric sender to Israel needs pre-registration and may be rewritten by routes; delivery on some Israeli numbers lower than local routes; non-Israeli invoices (tax-invoice friction for the customer) |
| **C. Regional gateway with Israeli routes (e.g. CM.com / Infobip-class)** | Mid-way: good API, Israeli routes through partners, sender registration handled for you | Contract or minimum-volume onboarding; more sales process for a small installation |

Facts that hold for every option: a GSM-7 message is 160 characters; **a message with any Hebrew letter is UCS-2: 70 characters in one segment and 67 per segment when concatenated**, so a typical Hebrew message with a link is 2-3 segments (cost x2-3). Sender ID: an alphanumeric sender is at most 11 characters (Latin letters and digits) and cannot receive replies; a numeric/long-code sender can. Israeli rules (to be confirmed with counsel and the provider): the communications law's anti-spam provisions require prior consent and an opt-out for **advertising**; a purely service message about a request the person is party to is outside advertising, but we treat opt-out as mandatory anyway (section 7). Some carriers filter unknown shortened URLs; we use our own domain only.

Recommendation: **A or C for production (local routes, ILS invoices), with the adapter written against a closed interface so B can serve as the test account and as a switch.** The first slices build only the fake provider; no provider is chosen in code until Q1 is answered.

## 4. Provider abstraction

A new `services/tickets/channel_sms.py` implements `TicketChannel` with `key = "sms"`, `supports_buttons() = False`; `parse_inbound` handles only opt-out keywords. It delegates the wire to an `SmsProvider` protocol in `services/sms/provider.py`:

```
send(to_e164, text, sender_id, client_ref) -> ProviderResult(outcome, provider_message_id, segments, code)
status_from_callback(headers, body)        -> DeliveryEvent | None   # verifies the provider's signature or shared secret
balance()                                  -> Balance | None         # optional, for the budget guard
```

- A closed registry of implementations selected by name (`fake`, plus one module per chosen provider); the setting is validated against the registry, never a free URL (no SSRF through settings). Each module holds its base URL as a constant.
- Credentials (API key or token, callback secret) are new entries in `services/secrets_store.SPECS` (`sms.api_key`, `sms.callback_secret`), written by the existing secrets screen, **never** in settings, logs, delivery rows, exceptions, `repr` or backups. Provider responses are reduced to an outcome word and a short code; raw bodies are not stored.
- Outcome mapping follows the existing rule: failure before the request left = `not_sent` (retried a few times, then fallback); provider refused this message (bad number, blocked, sender not allowed) = `refused` (no retry, fallback); timeout after the request was written, 5xx, malformed answer = `unknown` (never retried, never re-routed: a duplicate SMS costs money and confuses).
- Phone normalisation reuses `phone_digits` and requires an Israeli or valid E.164 mobile; landlines and premium prefixes are `refused` before any call (`no_mobile`).

## 5. Message templates (short, Hebrew, redeem link)

- `message_templates.py` gets a `channel = 'sms'` variant per purpose (`assign`, `reminder`, `update`, `closed`, `rfq_invite`, `rfq_reminder`, ...). Language per contact (D26); SMS templates ship for `he` and `en` first, other languages fall back to `he`.
- The link is always the redeem link `/t/r/<rid>` (as the e-mail channel does, review T3-2), never the fragment token and never a code, price, address or person's name. No ticket body text beyond the template's fixed words and at most the ticket number.
- Budget: **at most 2 UCS-2 segments (134 characters) including the link**, enforced by a template test; the link is our own short path (about 35 characters). Example (he): "SmplWise: נפתחה בקשת שירות {n}. לפרטים: {link}  להסרה השב הסר". The opt-out line is added to the first message to a number and then every 5th (saves a segment); a setting can force it on every message.
- The sender text is the organisation name (setting) when the customer wants their own brand.
- One function `sms_segments(text) -> (encoding, segments)` serves the template test, the budget guard and the cost counter.

## 6. Delivery status callbacks

- Route `POST /api/v1/sms/callback/<provider>`: public, signature or secret verified by the provider module (constant-time compare), unknown ids ignored, body size capped, replay-safe by `(provider_message_id, status)` idempotency. Added to the public-surface and API inventories.
- The outbox outcome word stays "handed to the provider" (`sent`). Receipts go to `sms_delivery` (`delivered` / `undelivered`) and never rewrite the outbox outcome. UI wording: "handed to the SMS provider" and, when a receipt arrives, "delivered to the handset"; a missing receipt is never shown as a failure (many routes give none).
- An `undelivered` receipt on a message that carried a link raises the existing `ticket.send_failed` manager notice; it does not auto-resend ("send again" stays the manager's act).
- With no public URL (add-on behind a tunnel only), callbacks are off and the provider's polling endpoint is used if it has one; otherwise delivery is "no receipt". Not a blocker.

## 7. Opt-out and consent

- Contact fields: `sms_consent` (`unknown | allowed | declined`), `sms_consent_at`, `sms_consent_source` (`manager_entry | vendor_page | reply_stop`). A contact is reachable by SMS when the module is on, the number is a valid mobile, and consent is not `declined`. Existing contacts start as `unknown`, treated as allowed for service messages about a request they are party to, with the opt-out line present. Q5 asks whether an explicit opt-in is wanted instead.
- Inbound STOP: if the provider supports replyable numbers, the keywords (`הסר`, `עצור`, `STOP`) mark `declined`. With an alphanumeric sender (no replies) the opt-out is a button on the redeem / vendor page ("do not send me SMS") and a manager toggle. `can_reach` returns `REACH_OPTED_OUT` and the planner falls to the next channel. Clearing an opt-out needs the contact's own action or an administrator (same rule as the WisKey opt-out in `access_control_messaging`).
- Every opt-out change is audited (who, when, source), without the number.

## 8. Rate limits, budget caps, pacing and ledger

- **Reuse** the WhatsApp machinery, no second one: sends are counted in the shared `messaging_send_ledger` with `channel = 'sms'` and paced like `messaging_accounts.PacingGate` (minimum gap, per hour, per day, per recipient). The CR-WA-PACING priority classes (alert, code, ticket, reminder) and the backoff on HTTP 429 apply too. A separate account key `sms:default` keeps SMS from consuming the WhatsApp budget.
- Defaults (all settings): 6 per minute, 60 per hour, 300 per day, 3 per recipient per day, 1 reminder per ticket per day over SMS.
- **Money cap**: `sms.monthly_cap_segments` (default 500) and optional `sms.monthly_cap_amount` (uses the configured price per segment), counted in `sms_usage_month` (messages, segments, estimated cost, by purpose). At 80 percent a manager notice; at 100 percent new SMS rows are **held** `budget` (not dropped, not sent) and the fallback proceeds to e-mail; a manager can raise the cap or "send once". Code messages are not exempt. Held rows expire as `budget_expired` through the normal failed path, so nothing disappears silently.
- Kill switch `sms.enabled` (default OFF) stops all sends at once; rows are held `channel_down`.

## 9. Privacy

- The number, text, link and credentials are never logged or placed in exceptions (same rule as the whole package; fields `repr=False`). The outbox stores template id and params without link and number; the number is read from the directory at send time.
- SMS leaves the installation to a third party and crosses the carrier network in clear text: no third-party names, addresses, amounts or codes; the link opens a page that uses the existing redeem flow (rate limited, revocable, expiring).
- The provider is a data processor: the settings screen shows its name, the country of processing and the retention as entered by the owner; the vendors' privacy notice gets one line. Counsel reviews before SMS is enabled for requesters who are private individuals (Q6).
- No real number, key or provider response is committed; the fake provider and fixtures use reserved test numbers.

## 10. Default OFF and who may enable

`sms.enabled = false`, provider = none. Enabling needs: provider selected, credentials stored, sender ID set, monthly cap set, and one successful **test message to the administrator's own phone** (purpose `test`, counted in the cap). New permission `settings.sms.manage` (administrators; `tickets.manage` alone is not enough because the setting spends money). With the tickets module off there is no SMS anywhere and no ticket action (same rule as WhatsApp; tested).

## 11. Data model (PROVISIONAL migration 0170, one file)

- `ticket_outbox` rebuilt with `channel IN ('whatsapp','email','sms')`, `held_reason` plus `'budget'`, and `use_key` plus `'sms'`.
- `ticket_contacts`: `preferred_channel` CHECK adds `'sms'`; new `sms_consent`, `sms_consent_at`, `sms_consent_source`.
- `sms_delivery(provider_message_id PK, outbox_id, status, status_at, segments, error_code)`.
- `sms_usage_month(month, purpose, messages, segments, est_cost_agorot)`.
- `messaging_send_ledger`: no change if `channel` is free text, otherwise `'sms'` is added in the same file.
- Settings (not tables): `sms.enabled`, `sms.provider`, `sms.sender_id`, `tickets.channel_order`, caps, pacing numbers, price per segment. Secrets through `secrets_store`.
- Backup and restore: settings and usage included, secrets excluded (existing rule); a restore leaves SMS disabled until credentials are re-entered.

## 12. Tests plan (fake provider; no network, no real number)

- `FakeSmsProvider`: scripted outcomes (accept, refuse, 429, timeout after write, 5xx, malformed), callbacks with valid and invalid signature, replay, out-of-order statuses, segment counts.
- Unit: `sms_segments` (ASCII, Hebrew, mixed, emoji, boundaries 70/71/134/135); every SMS template within 2 segments with the longest link and ticket number; redeem link only (no token, no code); mobile validation.
- Channel contract: the five methods; outcome words; `unknown` never retried or re-routed; privacy tests (number, text, key never in logs, exceptions, repr or responses).
- Planner: fallback order variants, `preferred_channel = 'sms'`, opted-out falls through, no mobile falls through, WhatsApp down goes to SMS, SMS disabled goes to e-mail, tickets module off sends nothing.
- Pacing, ledger and budget: ledger rows with `channel = 'sms'`, WhatsApp budget unaffected, per-recipient cap, 429 backoff, hold at 100 percent, notice at 80 percent, `budget_expired`.
- Callbacks: signature, size cap, idempotency, `undelivered` raises the manager notice, no outbox rewrite.
- Opt-out: STOP keywords (Hebrew and Latin), redeem-page button, manager toggle, audit, clearing needs authority.
- Settings and permissions: default OFF, `settings.sms.manage` required, secrets never returned by any GET, provider name validated against the registry, test-message gate for enabling.
- Migration 0170 on a populated database copy (outbox rows preserved, CHECKs); API and public-surface inventories regenerated; UI in Hebrew/RTL and mobile width for the settings card, the contact consent chip and the delivery wording.
- No live send in the suite; one owner-approved live test message is a manual step after the provider is chosen.

## 13. Slices

1. **S1 model**: migration 0170, `sms_segments`, `SmsProvider` protocol, fake provider, `channel_sms.py` registered but disabled, templates and their tests.
2. **S2 planner and outbox**: channel-order setting, preferred channel `sms`, consent fields, opt-out via manager toggle and redeem page.
3. **S3 pacing, ledger, budget**: shared ledger, caps, notices, held `budget`.
4. **S4 settings UI and secrets**: provider card, sender, caps, test message, permission, inventories.
5. **S5 real provider module and callbacks** (after Q1; one module, signature verification, STOP inbound if replyable).
6. **S6 (optional)** notify channel `sms` for critical alerts to a duty phone; monthly usage report.

S1-S4 need no provider and can ship dark. S5 is the only slice that touches a third party.

## 14. Owner questions (recommendation first)

1. **Which provider?** Recommend an Israeli local aggregator (A), or one regional contract (C); Twilio only as the test account. Owner asks for a quote first. Options: A Israeli aggregator, B Twilio, C regional gateway, D decide later (build S1-S4 first).
2. **Sender ID?** Recommend the organisation's Latin brand name, up to 11 characters, alphanumeric, no replies (opt-out via the link page). A: alphanumeric brand. B: replyable number (more cost and setup; enables STOP and later "1/2" replies).
3. **Budget cap?** Recommend 500 segments a month to start (about 250 two-segment messages), hold at 100 percent, notice at 80. A: 500. B: 2000. C: custom segments and ILS limit.
4. **Who may enable and change it?** Recommend administrators only (`settings.sms.manage`), because it spends money. A: administrators only. B: also ticket managers within a limit.
5. **Consent model?** Recommend the service-message basis with a visible opt-out and per-contact decline. A: as recommended. B: explicit opt-in per contact before the first SMS.
6. **Requesters who are private individuals?** Recommend vendors and handlers first, requesters after counsel confirms the wording. A: vendors and handlers only. B: all three.
7. **SMS for verification codes?** Recommend no (stay WhatsApp-only). A: no. B: yes, last-resort fallback for `phone_verify`.
8. **Channel order?** Recommend whatsapp, sms, email. A: as recommended. B: whatsapp, email, sms (cheaper).
