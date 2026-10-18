# CR-WA-CONSENT-LINK - opt-in consent by link for WhatsApp messages to people (branch `pilot/WA-CONSENT-LINK`)

**Status:** implemented on `pilot/WA-CONSENT-LINK` (base `origin/integ/264`), **OFF by default**. Owner decision 2026-10-17 (via the lead).
**This is a NEW PUBLIC SURFACE** (a page and two routes on the tickets public listener). **A Fable public-surface security review is
REQUIRED before release** - the checklist `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` (sections 1, 2, 6) plus the threat model in
section 7 below. Nothing here has run against a real WisKey, phone, WhatsApp account or tunnel (fake WisKey only, like the rest of CR-036 WA).

## 1. What the owner decided

- Today a person whose consent is `unknown` may still be messaged. **That stays** (the default; the setting below is off).
- NEW: `consent_by_link` (default OFF). While it is ON and a person's consent is `unknown`, the FIRST message Arx sends that person is not
  the requested content but a fixed, code-owned **consent request** (he / en / ar / ru) carrying a **single-use signed link**.
- The link opens a minimal public page with two buttons, approve / decline. Approve stores `granted` (time + the version of the notice text
  the page showed) and the originally requested message is released. Decline stores `declined` (the Arx opt-out list semantic is
  preserved) and nothing is sent. No answer within N days (setting, default 7) = the message is dropped with an audit row and the sender is
  told in the app. Further messages while pending are held / collapsed; at most ONE consent request per person per 30 days.
- Granted people are messaged normally; declined never. The credential guard is not weakened. Audit: ids / counts only.

**Naming:** the request called the switch `messaging.consent_by_link`. The messaging settings are one JSON document under the setting key
`access.messaging` (deliberately not a `routers/settings.py` default, so `GET /settings` never carries the templates - CR-036 WA); the switch
is therefore the field `consent_by_link` of that document (`access.messaging.consent_by_link`), edited on the same Settings page.

## 2. Settings (Settings > access control > messages, `system.configure`, audited as `intercom.messaging.settings`)

| Field | Default | Meaning |
|---|---|---|
| `consent_by_link` | `false` | The switch. Turning it on requires the organisation name (the request says who asks): 422 `organization_missing`. |
| `consent_wait_days` | `7` | 1-30: how long a request waits; then the held messages are dropped (`no_answer`). |
| `consent_language` | `he` | The language of the consent request text and of the page (he / en reviewed; **ar / ru dev-marked**, need a native review). |
| `consent_wa_template` | `""` | The WhatsApp Business template name for a first contact outside the 24-hour window (`[a-z0-9_]{1,128}`). |
| `consent_wa_language` | `""` | Its language code (`he`, `en_US`, ...); empty = `consent_language`. |

All five are OPTIONAL in the PUT (an editor that predates them keeps the stored values). The reply carries `consent: {page_problem,
notice_version, resend_days, held_per_person, wait_days, languages, dev_marked_languages}`; `page_problem` is null when the public page can
serve a link now, else `module_off` (the tickets module - its listener answers 404 to everything while off), `public_page` (option /
listener / public address) or `key` (the module key).

**WhatsApp Business rules (owner's action):** a business-initiated first message outside the 24-hour customer-service window must be an
approved template. The template must be created and approved by Meta **by the owner**; its body must take the parameters in this order:
`{{1}}` the person's first name, `{{2}}` the organisation, `{{3}}` the link, `{{4}}` the days. **Not yet forwarded:** WisKey rc.37's
`whatsapp/send` takes a text only (`intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED = False`); the adapter's `send(..., wa_template=)`
carries the configured template as part of the contract, and W11 must give Arx a template send. Until then the code-owned TEXT goes out and
WhatsApp itself decides whether a business-initiated text reaches a person outside the window.

## 3. The send path (routers/access_control_messaging.py `_consent_path`, services/intercom_consent.py)

Order of checks of `POST /access-control/people/{id}/messages` is unchanged up to the consent decision (permission, body, confirmation,
messaging on, text / template, the person rule, phone, `declined` -> 409 `message_no_consent`, service connected). Then, when
`consent_by_link` is on and the effective consent is `unknown`:

| Situation | Answer | What happens |
|---|---|---|
| no request in the last 30 days, template | **202** `{message: {id, outcome: "consent_requested", held: true, consent: "pending", until}}` | the consent request is recorded (an `intercom_messages` row, `template_id = "~consent"`, + audit) BEFORE it is sent; the request row (state `sending` -> `open`) and the held row are written; the code-owned text with the link is sent |
| the same, free text | 202, `held: false` | the consent request goes out; the free text is NOT kept (Arx never stores a message text) - the sender sends it again after approval |
| a request is open, template | 202 `{outcome: "held", collapsed}` | held on that request; the same template (same body) collapses into the waiting one; at most 3 waiting -> 409 `message_consent_pending` |
| a request is open, free text | 409 `message_consent_pending` | nothing kept, nothing sent |
| a request in the last 30 days, now over | 409 `message_consent_recently_requested` (`retry_after_days`) | nothing sent |
| the public page cannot serve a link | 409 `message_consent_unavailable` (`reason`) | nothing sent, nothing recorded but the audited refusal |
| the consent message itself fails | the normal send errors (`message_not_registered`, `message_uncertain`, ...) | refused / not sent -> the request is `failed` (does not count for the 30 days) and its held message is dropped; unknown -> the request stays open (it may have reached the person) |

The bulk run is the browser calling the route per person: each person gets the same treatment (a consent request is never part of the run's
`bulk_id`); `message_consent_unavailable` halts the run (it would repeat for everyone).

**Release (approve):** the public route marks the held rows `due` and kicks `intercom_consent.RELEASER` (a daemon thread; the janitor also
ticks it every 30 s). The public listener never waits for WisKey. `release_due` sends each held message through the normal rules AGAIN:
messaging on; the template still has the SAME body (`body_hash`) - else dropped `template_changed`; the sender still may message the person
(`may_message` with the sender's principal rebuilt from the held row) - else `forbidden`; consent still `granted` (an opt-out set meanwhile
wins) - else `no_consent`; a phone; the service connected (else it stays due); the hourly allowance; the attempt recorded before the send
(`client_request_id = held-<id>`: never sent twice). An unknown outcome is never retried. Every drop is audited and notifies the sender.

**Expiry:** `intercom_consent.tick` (janitor, every 30 s) and every consent decision first close requests past their end: state `expired`,
held rows dropped (`no_answer`), one audit row `intercom.person.consent_answer {outcome: expired}`, a notification per held message.

**The sender's notification:** notify source `intercom.message_dropped` (category automations, info, recipient rule `initiator`, subject
`session`, no push by default): "ההודעה "<template label>" לא נשלחה: <reason>." - never the person's name, a number or the text.

**The person's tab:** `GET /access-control/people/{id}/messages` lists held (`outcome: "held"`) and dropped (`outcome: "dropped"`, `reason`)
messages with the rest, and `consent_request: {state: "pending", since, until} | null`.

## 4. Data (migration `0113_intercom_consent_link.sql`, additive)

- `intercom_consent_requests` - one request = one link: `id` (128-bit, the HMAC input), `person_id`, `key_id`, `token_hash` (SHA-256 of the
  token, unique - the public lookup key), times, `actor_user_id`, `message_id`, `lang`, `state` (sending | open | granted | declined | expired |
  failed), `answered_at`, `notice_version`.
- `intercom_consent` - grants by link (`person_id`, `granted`, time, `notice_version`, the request id). A decline is written to
  `intercom_message_optout` (`by_user_id` NULL, `by_name` "קישור הסכמה"): the opt-out list keeps its meaning and an administrator can clear it.
- `intercom_held_messages` - the waiting TEMPLATE messages: who, which template, `body_hash` of the body the sender saw, state (held | due |
  releasing | released | dropped), reason word.
- Never stored: a phone number, a message text, the token, the person's name, a PIN. Rows older than 400 days are pruned.
- `store_links.key_ids_in_use` / `any_keyed_row` count live consent requests (a key retirement never kills a live link; a lost key is never
  silently re-minted).
- **Migration number 0113** (provisional 0116 on the branch; renumbered at the integ/270 integration for 2.7.0, where the release set
  0107..0114 is contiguous).

## 5. The public page

Routes on the public listener (`services/tickets/public_consent.py`; edge `ROUTES` in `public_http.py`):

| Route | Edge kind | Answer |
|---|---|---|
| `GET /t/api/consent` (token in `X-Ticket-Token`) | `token_read` | `{organization, logo, theme, notice_version, lang, expires_at}`; the uniform 404 for no / unknown / used / expired / failed token |
| `POST /t/api/consent` `{choice: approve \| decline, notice_version}` | `token_write` (1 KiB JSON) | `{ok, answer: approved \| declined}`; the token is resolved BEFORE the body (no live token = the same 404 whatever the body); a stale `notice_version` = 409 `notice_changed`; malformed = 422 `invalid` (never echoing input) |

Frontend: `#c.<token>` in the fragment (`.` is not a base64url character: never a ticket or RFQ token). `main.ts` replaces the address bar,
hands the token to the lazy chunk `consent/consent-page` (its own cap **5 KB gzip**: measured 3.4 KB js + 0.2 KB css) and keeps it in
memory only (no sessionStorage). DOM from text nodes only, `credentials: 'omit'`, `redirect: 'error'`, `no-referrer`, the CSP of the public
listener. Shown: the organisation name (messaging `organization`, else the public pages' name) and logo; **no personal data** (the request
did not show the first name - the WhatsApp message itself greets by first name; the page needs nothing personal). Strings he / en; ar / ru
dev-marked.

**Budget:** the handler page's main budget (61 KB gzip) measured on a local build of this branch: **62 441 of 62 464 bytes - 23 bytes
left** (the `#c.` boot added ~106 bytes). The next change to the main chunk will need a budget decision.

## 6. The token (why it is not a credential)

`links.derive_token(module key, id, 1, domain="wac")` - 192 bits, a new token domain (`wac`) so the same id never yields a ticket (`tkt`) or
RFQ (`rfq`) token; stored only as SHA-256; looked up by one indexed read; single use (compare-and-set on the state); bounded in time
(`consent_wait_days`); answered by the uniform 404 in every dead state. It is a signed CAPABILITY for one consent answer of one person: it
authenticates nobody, opens nothing else, carries no PIN or code, and the credential guard (`intercom_messaging.looks_like_credential`, the
template / free-text rules) is untouched - the consent text is code-owned and never passes through a sender.

## 7. Threat model

| Threat | Control | Residual |
|---|---|---|
| Token guessing / enumeration | 192-bit token; the edge's failure caps (20 unknown tokens / minute per client network, 300 installation-wide), per-token windows; identical 404 bytes for unknown / used / expired / foreign-domain / tampered tokens (tested) | timing of "row found but dead" vs "no row" (one indexed read either way; the tickets precedent) |
| Replay / double answer | single use by compare-and-set; a second answer, on any device, is the 404 | - |
| CSRF / cross-site answer | token in a request HEADER (a form / image / navigation cannot set it, and the listener sends no CORS headers), JSON-only body (415 otherwise), no cookie read or set on these routes | - |
| Link-preview bots / scanners auto-answering | the token is in the fragment (never sent by a preview fetcher), the page needs JavaScript and a button press; a GET never answers | a person forwarding the link lets the recipient answer for them (the capability is the link) |
| Answer for another person | the request row binds the person; the body carries no person id (an extra field is 422) | - |
| Spam / cost | one request per person per 30 days; held messages capped at 3 and collapsed; consent messages count in the hourly allowance; the edge's per-token write budget (20 / hour) | - |
| Stale notice | the answer must carry the CURRENT `notice_version`; the stored consent records it | the version is bumped by hand when the notice text changes meaning (`NOTICE_VERSION`) |
| Release after circumstances changed | every rule checked again at release (template body, permission, consent / opt-out, phone, allowance); unknown never retried | a concurrent double send to the same unknown person within milliseconds can create two requests (no unique constraint on the live request per person) |
| Personal data on a public page | the page answer is an allow-list without name, number or ids (tested) | the organisation name and logo are public while a link is live (intended) |
| Key rotation | live requests keep their key (`key_ids_in_use`) | - |

## 8. Tests

- Backend `smplwise_vms/backend/tests/test_intercom_consent_link.py` (33, negative first): off by default (an unknown person is messaged as
  before, nothing created); optional fields kept by an old client; 10 validation cases; permission + audit names only; page not ready ->
  409 and nothing sent; the code-owned request goes first and the template waits, no token / phone / name / text in audit, records or logs;
  held + collapsed + capped + free text refused while pending, one WhatsApp message for all of it; a free text starts the request and is never
  kept; granted -> normal, declined -> never; the uniform 404 for no / empty / tampered / foreign-domain (tkt, rfq) / second-generation /
  random / truncated / extended / case-changed tokens on both routes; CSRF (form 415, text/plain 415, no header 404, no body parsed without a
  live token, no cookie set, no CORS header); malformed answers 422 without echo, stale notice 409, nothing changed; the page shows no
  personal data, `no-store`, CSP; the edge's failure cap (429 after 20); used / expired / unknown byte-identical; approve -> granted with the
  notice version, released once (never twice), replay 404, later sends normal; decline -> opt-out list, dropped, sender notified, later 409;
  no answer -> expired, dropped, audit row, notification, 409 within 30 days, a new request after; a token acts on its own person only;
  release re-checks the template body and a later opt-out; release re-checks the sender's permission; a live link keeps its module key; the
  credential guard unchanged and the consent text first-name-only, no placeholder injection.
- Backend regression: `test_intercom_messaging.py` (the wire fixture `frontend/tests/fixtures/messaging_wire.json` gained the new keys),
  the tickets public app / server / vendor portal / links / RFQ public suites, notify suites, migrations - see the branch report for the
  exact runs.
- Frontend: `tests/unit-public-consent.spec.ts` (6: chunk guards, main.ts never keeps the token, `#c.` boot, four languages same
  placeholders + dev-marked, the notice words, the answer mapping) and the budget test in `unit-public-ticket.spec.ts` (`consent-page-*`:
  own 5 KB cap); `tsc --noEmit`; the messaging / people unit specs.

## 9. NOT_RUN / limits

- No runner job (runner busy): the full backend suite, Playwright layout / evidence / pixel suites (desktop / mobile / RTL, loading / empty /
  error / ready screenshots of the consent page and the new Settings card) are NOT_RUN. `smplwise_vms/www-public/` was NOT rebuilt (release
  step); the budget was measured on a local build in the scratchpad.
- No live WisKey, WhatsApp, phone or tunnel. The WhatsApp template send is not forwarded (rc.37) - W11.
- `contracts/API_INVENTORY.md` not regenerated (release-prep artifact): two public routes added; the people send route gained 202 answers.
- Arabic and Russian (request text and page) need a native review.
- **Fable public-surface review required before release.**

## 10. Integration at integ/270 (2.7.0)

- **Review C1 (fail closed, owner informed).** The messaging adapter cannot forward a WhatsApp Business template yet
  (`intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED = False`; WisKey rc.37 `whatsapp/send` takes a text only - ask W11). While that is so:
  a non-empty `consent_wa_template` or `consent_wa_language` in `PUT /access-control/messaging/settings` is refused (422
  `message_settings_invalid`, `{path, code: "template_send_unsupported"}`); a value stored by any earlier build reads as "" (so no template is
  ever handed to the adapter and nothing records a template as sent); the settings reply carries `consent.template_send_supported: false`
  and the Settings card hides the two template fields and shows one line saying that the consent request goes out as plain text and may not
  reach a person outside WhatsApp's 24-hour window. Tests: `tests/test_intercom_consent_link.py::test_a_template_is_refused_while_the_adapter_cannot_forward_it`
  (both fields), `::test_a_stored_template_name_is_never_claimed_or_passed_on_while_unsupported` (red before the change). When W11 lands,
  flipping the adapter constant re-enables both fields with their existing validation. **Still NOT_RUN:** a real WhatsApp delivery of the
  consent request outside the 24-hour window.
- **Merged with WA-SEND-FIX (review 2.6.5 F3-F6) in the same release:** the consent request and each released held message now pass the
  person's number and stations to `begin_attempt`, so they count against the per-recipient day cap, the per-station hour cap and the sender's
  hour like any message (a consent request + two released messages fill the default 3-per-day cap); the opt-out and the consent are read by
  record AND by number (`consent_of(..., phone)`); the releaser keeps a held message waiting (retry) outside the administrator's send hours
  and drops it only once it is stale (reason `outside_hours` / `message_rate_limited`, a sender notification word for each). A "decline" on
  the page writes the opt-out row by record only (the public listener does not have the number); the number-based match applies once a staff
  opt-out of the same number exists.
- Migration renumbered: provisional 0116 -> **0113** (WA-SEND-FIX's 0117 -> 0114).

## 11. HARDEN271 (2.7.1, `pilot/HARDEN271`) - review residuals

Tests: `tests/test_harden271_consent.py` (5 cases, all red on integ/270 before the change) + `frontend/tests/unit-messaging-logic.spec.ts`.

- **One live request per person** - `create_request()` repeats `plan()` inside the write transaction that inserts (SQLite serialises the
  writers), raising `ConsentRaced`; the send path withdraws its attempt record (`not_sent`, reason `consent_race`), sends nothing and
  answers 409 `message_consent_pending` (or `message_consent_recently_requested`). A transactional guard, no migration.
- **Bulk summary** - `bulkSummary()` counts `held` apart (`{sent, held, failed, unknown}`); the dialog line says how many wait for the
  person's approval and is a warning, never "sent".
- **C2** - the releaser builds the sender through `sender_principal()` (explicit `factor_ok = False`); `RELEASE_PERMISSIONS` must stay
  disjoint from `rbac.LOCAL_ADMIN_PERMISSIONS` (pinned by a test); a build where they meet keeps the held message `due` (retry
  `factor_unavailable`, logged) instead of dropping it `forbidden`.
- **C3** - a decline writes the opt-out row with `by_user_id = "~consent"` (`OPTOUT_BY_ID`, never a user id, never NULL); the person's tab
  still shows "קישור הסכמה" and an administrator can clear it (tested).
- Backups: the whole `access.messaging` document (messaging switch, caps, send hours, `consent_by_link`) and `access.messaging.phone_key` are
  in `backup.SETTINGS_KEEP`.
- Still open before enabling: the real WhatsApp delivery check outside the 24-hour window and the template send (WisKey W11).
