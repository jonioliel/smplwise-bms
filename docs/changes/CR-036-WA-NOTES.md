# CR-036 slice WA - WhatsApp from the people screen ("אנשים"), single and bulk

Branch `pilot/WISKEY-whatsapp` (base `origin/integ/248` @ 10620d30). Owner decision of 2026-10-12 (binding, answers 9 and 10 of the screens
questionnaire): everything is in stage 1, no splitting - approved TEMPLATES **and** free text; administrators edit the templates; the free-text
box NEVER inserts a PIN or any credential by itself; every send is audited in Arx (who, request id, which person, outcome - never the text);
sending to several people at once with one template is in stage 1.

**The WisKey side is unanswered (question W11).** Nothing here has run against a real WisKey, a real phone or a real WhatsApp account: every
test drives the fake (`tests/fake_wiskey.py` + `tests/fake_wiskey_messaging.py`). The master switch (Settings > access control > messages) is
**OFF until an administrator turns it on**, and the realization on today's WisKey commands (rc.37) is isolated behind a three-method adapter so
W11's answer replaces one module. Live behaviour is NOT_RUN until slice S14.

## What it is

| Part | Where | What |
|------|-------|------|
| Permission | `access.people.message` | sensitive (never implied by a wildcard), site_admin and system_admin by default; scoped by the station chain like every `access.people.*`; a person may be messaged only when the caller holds it on EVERY station the person is assigned to |
| Settings + templates | Settings > access control > **הודעות** (`#/system/access-control/messaging`, `system.configure`) | the master switch (OFF), free-text on/off, bulk limit (50), messages per hour (60, installation-wide), the organization's name (`{organization}`), the messaging account when WisKey has several, and the approved TEMPLATES (add / edit / delete, placeholders `{name}` and `{organization}` only) |
| The dialog | the people screen (row action, the person's page, the selection bar) | one person or a selection; template chips + free text; ONE confirmation for a bulk run; progress with a stop button; a per-recipient result table; the hourly allowance; every refusal said in words |
| The person's tab | the person's page, 4th tab **הודעות** | the message history (who, which template or "free", when, the outcome) and the "asked not to be messaged" switch |
| The record | migration `0076_intercom_messages.sql` | `intercom_messages` (never the text, never a number) and `intercom_message_optout` |
| The adapter | `services/intercom_messaging_adapter.py` | the contract Arx needs from the messaging provider + the rc.37 realization (see below) |

## Routes (`routers/access_control_messaging.py`, all under `/api/v1`)

| Route | Gate | What |
|-------|------|------|
| `GET /access-control/messaging` | `access.people.message` anywhere | the dialog's configuration for this caller: feature on/off, the service state, the templates (`{organization}` filled in, `{name}` left for the person; none served while the feature is off), limits, the allowance, `pace_ms`, the templates revision |
| `POST /access-control/messaging/recipients` | the same | the preview of a selection (at most 6 lookups, each spends one read token of the sender; the rest are decided as each message goes): who can be messaged and who cannot, and why |
| `GET /access-control/people/{id}/messages` | + the person | the person's history (50 newest) + opt-out + consent |
| `POST /access-control/people/{id}/messages` | + the person | send ONE message (a bulk run is the browser calling this once per person, under one `bulk_id`) |
| `PUT /access-control/people/{id}/messages/optout` | + the person | mark / unmark "asked not to be messaged" |
| `GET /access-control/messaging/settings`, `PUT ...` | `system.configure` | the administrator's document; the PUT is revision-checked (a stale save is a 409 conflict, never an overwrite) and validated as a whole (422 `message_settings_invalid` with `[{path, code}]`) |

A send follows the physical actions' discipline: permission before the body, strict JSON (a template send carries `template_id` +
`templates_revision` and NO text; a free send carries `text` and no template), explicit `confirmed: true`, `client_request_id` (a repeat is a
409 `message_duplicate`), the ATTEMPT recorded (message record + audit row in ONE transaction) BEFORE anything is sent (if it cannot be written
nothing is sent), then the outcome row. Refusals are audited `denied` with `outcome: not_sent`.

Error codes the browser handles: 429 `message_rate_limited` (`scope: hour|burst`, `retry_after_s`, `quota`), 410 `message_expired`,
503 `message_service_unavailable` (no WisKey / not connected), 502 `message_not_registered` (the number is not on WhatsApp) /
`message_refused`, 504 `message_uncertain` (handed on, no usable answer - NEVER retried by Arx, never reported as sent), 404 uniform
person-not-found, 403 `message_forbidden`, 409 `message_no_consent` / `message_duplicate` / `message_disabled` / `message_template_changed`,
422 `message_no_phone` / `message_forbidden_content` / `message_too_long` / `message_empty` / `message_bulk_*`.

## What is audited, and what never is

Audit rows (`intercom.person.message`, `intercom.person.message_optout`, `intercom.messaging.settings`) carry: actor, `request_id`, the person
(WisKey's id), template id or `free`, the character count, `bulk_id`, the outcome (`sent` = WisKey accepted it - NEVER "delivered", there is no
receipt; `refused`; `unknown`; `not_sent`) and WisKey's own refusal code. They NEVER carry the text, a phone number, a PIN, or WisKey's
one-use token. The settings audit row carries the revision and counts, never the template bodies. A `not_sent` outcome removes the message
record again (the history lists what was handed on); a `refused` or `unknown` one stays. Records older than 400 days are removed.

## The credential rule (the owner's "never an auto-inserted PIN")

Nothing in Arx knows a PIN, so nothing can insert one. The guards are about what a person TYPES or an administrator SAVES: a template body may
hold only `{name}` and `{organization}` (any other placeholder, a `{pin}`/`{code}`-style one, a credential word followed by 4-8 digits, control
characters: refused at save time with a field-level problem); the free-text box refuses the same patterns (`message_forbidden_content`, said
in the dialog as the sender types, before anything is sent). The guard is best effort by nature; it is a belt over a design that never holds
the value.

One more place a PIN could leak, and it is closed: rc.37's `whatsapp/send` needs a one-use token that only `whatsapp/preview` issues, and
`preview` ALSO returns a message WisKey builds for its renewal flow which contains the person's PIN. The adapter reads **only the token**
from that reply (`_token_of`) and discards the rest (the message, the number, the warnings): the text that goes out is the one Arx rendered.
The PIN does pass through the add-on's memory for that one call - **W11 must give Arx a send that needs no preview.**

## The adapter contract (what Arx asks of WisKey) and the questions for W11

| Adapter method | Arx needs to know | Realization today (rc.37) | Proposed for W11 |
|---|---|---|---|
| `status` | is the service connected; which accounts; its own allowance | `whatsapp/status` `{available, history, accounts[{id,name}]}` (cached 20 s per feed session) | + `quota {limit, used}` |
| `recipient` | does the person have a usable number; the person's consent | `users/get` (the phone) + `whatsapp_consent` when present (rc.37 has none: `unknown`) | a consent field on the user |
| `send` | send ONE text to ONE person, once, with nothing in it Arx did not write | `whatsapp/preview` (token only) then `whatsapp/send {user_id, account, token, message, confirmed, api_contract: 1}` | one send command, text only |

`whatsapp/history`, `whatsapp/media` and `whatsapp/templates_*` are never sent (not in the allow-list `wiskey_channels.MESSAGING`). The send runs on
its own feed lane (`message`: one in flight, per-user burst 6 / 0.5 per second, global burst 6 / 0.5 per second, 50 s timeout), so a bulk run
never starves the read, action, config or capture lanes.

Outcome mapping (`classify`): `sent` = `{accepted: true}`. `not_sent` = provably never left (session not ready, no free slot, service not
connected, token expired, rate refusal, person gone). `refused` = the service answered the SEND with a refusal about this message or number
(`SEND_REFUSED`: `whatsapp_invalid_phone`, `invalid_fields`, ...). Everything else - a timeout, a dropped session, `whatsapp_send_uncertain`,
a code the table does not prove to come BEFORE the provider call - is `unknown`, shown as "may or may not have been sent", never retried.

**Questions for W11** (still unanswered, `private/wiskey-foldin/ARX_ASKS_W1_W10_2026-10-11_HE.md`): (1) the send command for one person - its
body, and whether it takes free text; (2) a send that needs no preview (so no PIN ever reaches the add-on); (3) the consent / opt-out model -
whether WisKey keeps a per-person consent Arx should read (the adapter reads `whatsapp_consent: granted|declined` when present), and whether
Arx's own opt-out list should be pushed to it; (4) delivery receipts (without them Arx can only say "accepted"); (5) the service's own limits
(per number / per hour) and the error codes for: no phone, no consent, WhatsApp not connected; (6) whether the add-on's service identity may
send at all.

## The fake (what the tests drive)

`tests/fake_wiskey_messaging.py` `MessagingWiskey(FakeWiskey)`: switches `wa_available`, `wa_accounts` (none / one / several), `wa_quota`,
`wa_unregistered` (the number is not on WhatsApp), `wa_preview_pin` (the preview carries a PIN - proves the adapter never keeps it),
`wa_uncertain` (the provider call fails after the message may have left), `wa_sent` (what was accepted, text and number - for the test only),
plus the person's `phone` / `whatsapp_consent`, `errors_once`, `slow`, `unlist`.

## Decisions made here (every one is an administrator setting or a constant in `services/intercom_messaging.py`)

- Master switch default **OFF**; free text default ON (the owner said templates AND free text); bulk limit 50 (range 1-200); 60 messages per
  hour installation-wide (range 1-1000); the dialog paces a bulk run 2.2 s between sends (the message lane refills 0.5 per second).
- Three starter templates (card ready, validity reminder, entrance closed) are stored as the initial document; the owner edits them in Settings.
- Consent: the dialog shows what is known (granted / declined / unknown). A person marked "asked not to be messaged" (Arx's opt-out, or
  WisKey's `declined`) is never messaged - `message_no_consent`, enforced on every send whatever the browser says. `unknown` is allowed
  (the owner has not defined a policy): see open question 2.
- The history lists what was handed on; the text is never stored, so the history shows the template's label (or "free text") and the
  character count only.
- A bulk run is the browser sending one person at a time (one WisKey command in flight, the burst budget respected, `Retry-After` honoured up
  to 3 times for a burst refusal); it HALTS on rate / no service / disabled / template changed (the same answer would repeat for everyone).
  A person the run did not reach is listed as "not sent - stopped".
- The settings document is one JSON value under the setting key `access.messaging`, deliberately not one of the `routers/settings.py`
  DEFAULTS (so `GET /settings`, which every signed-in user may read, never carries the templates); a corrupt value reads as OFF with the starter
  templates (fail closed).

## The 2.6.5 security review (branch `pilot/WA-SEND-FIX`, base `integ/264` @ 5fa03e7a)

The review of the send surface (private planning file `RELEASE_265_REVIEW_WA_SEND.md`, not in the repository) found F1-F13. Every
counterexample is a test in `tests/test_intercom_messaging_review265.py` that failed before its fix. Still OFF by default, still fakes only.

| # | Fix |
|---|-----|
| F2 | `POST /messaging/recipients` serves `phone_masked`, `has_phone` and `consent` ONLY for a person the caller may message AND only to a caller at the sensitive level there; otherwise `null` (the dialog shows nothing; the send answers for itself). |
| F3 | Three caps below the installation's hour, each an administrator setting (Settings > access control > messages): **per sender per hour** (default 50, range 1-1000; refusals by the service count - F9), **per recipient per day** (default 3, range 1-50; by WisKey id AND by phone number), **per station per hour** (default 50, range 1-1000; the people of each station the recipient is on). A refusal is 429 `message_rate_limited` with `scope` `sender` / `person` / `station` (`hour` stays the installation's). The dialog shows the tighter of the installation's and the sender's allowance (`sender_quota` in `GET /messaging`); a person / station refusal skips that person in a bulk run, a sender refusal halts it. |
| F4 | `bulk_max` is enforced by the server whatever `bulk_id` says: more than `bulk_max` messages of one sender in 10 minutes (`RUN_WINDOW_S`) is 422 `message_bulk_too_many` (`scope: window`). The `bulk_id` checks (same template, same sender, declared total) stay. |
| F5 | Send hours, with the tickets' send-hours rules (`services/tickets/hours.py`: `{from, to}` local time in the installation's zone, `from < to`, end exclusive, no window across midnight). Default **08:00-21:00**, an administrator may set another window or switch it off (`send_hours: null`). Outside: 409 `message_outside_hours` with `details.next_allowed_at`, before anything about the text or the person; `GET /messaging` carries `send_hours {from, to, open_now, next_opening}` and the dialog blocks the button. A stored window that cannot be read is the default window, never "always". |
| F6 | The opt-out follows the NUMBER as well as the record: `intercom_message_optout.phone_hash` (HMAC-SHA256 of the normalised number under a random per-installation key, setting `access.messaging.phone_key`, never served) - a second record with the same phone is refused `message_no_consent`. Any sender may SET an opt-out; CLEARING it needs `system.configure` (403 `message_optout_clear_forbidden`, audited `denied`; an allowed clear is audited with how many rows went - the record's own and any of the same number). The person's tab locks the switch for a sender who may not clear it (`can_clear_opt_out`), and the Settings page says the list applies to messages sent from here only. Pushing the list to WisKey stays open (W11). |
| F1 | The credential guard matches NORMALISED forms: NFKC, format characters (Cf: zero-width space, bidi marks, soft hyphen) and combining marks (Mn: Hebrew points) dropped, any script's digits as ASCII (Arabic-Indic, Extended Arabic-Indic, ...), digits written as words (en / he / ru / ar), letters spelled apart joined (`P.I.N.`), separators between digits collapsed (`4 8 2 1`, `48-21`, a line break), look-alike Cyrillic / Greek letters mapped to Latin. The word list gained `pass`, `passwort`, `kennwort`, `mot de passe`, `ססמ`, `код`, `пин`, `пароль`, `رمز`, `كود`, `كلمة السر`, `كلمة المرور`, `رقم سري`; no anchor after `pin` or around `code` (`pincode`, `Zugangscode`), the gap is 30 characters. Still best effort; the floor stays 4 digits. Mirrored in `messaging-logic.ts` (same counterexamples). |
| F8 | `{organization}` is credential-checked on its own, and each template is checked as RENDERED (`{name}` as a placeholder name, the organization filled in) at save time; at send time the rendered text (with the person's real name) is checked again (422 `message_forbidden_content`). A stored document that fails these reads as OFF (fail closed). |
| F9 | Refusals by the service count toward the sender's hourly cap (not toward the installation's allowance). |
| F10 | The masked number has a fixed width (`••••••` + the last two digits). |
| F11 | The preview's `validation` and `message_disabled` refusals are audited like every other refusal; the history returns the 50 newest (`HISTORY_MAX`). |
| F7 | NOT fixed here: needs WisKey W11 (a send without a preview). F12 / F13: informational, unchanged. |

Migration **0117** (`0117_intercom_message_caps.sql`, additive): `intercom_messages.phone_hash` + `station_ids` (JSON list) and
`intercom_message_optout.phone_hash`, with indexes. 0107-0116 are allocated to the parallel 2.6.5 slices: until they land the sequence has a
gap (`scripts/release_check.py` "migrations contiguous" fails on this branch alone) - renumber at merge if the allocation changes. A 2.6.4
editor that does not send the new settings fields keeps the stored values (the fields are optional in the PUT).

## Tests - what ran, where, at which commit

Everything ran against the fake WisKey and the mocked backends; nothing touched a real WisKey, phone, NVR or Home Assistant. Local runs: the
Windows workstation, one process at a time (Playwright `--workers=1`). Runner runs: the shared Ubuntu runner through `run_smart.py ... --machine
runner` at `e907c58e` (the commit before the migration renumbering below), nothing killed, no exclusive lock.

| Suite | Where | Result |
|-------|-------|--------|
| Backend: `tests/test_intercom_messaging.py` (126, new) + 21 adjacent files - authority 27, channels 31, fake WisKey 21 + 7, intercom 179, adapter 33, S7 people 15, access-control wire 16, WisKey contract 46, background 18, diagnostics 14, RBAC 7 + 2 + 14, access 4, custom roles 3, me-permissions 1, migrations 4, media 37 + 23, notify core 27 | local | **655 passed**, 0 failed (at `9c39519d`) |
| Backend, the full suite (two shards) | runner | 6864 passed, 4 skipped, **1 failed**: `test_release_check.py::test_repository_is_release_consistent` - "migrations contiguous" (this branch's 0079 left a gap after 0075). Fixed by the renumbering to 0076 below; the migration-sensitive files re-ran green - locally (release check, migrations, media x 2, notify core, messaging: 219 tests) and on the runner at `115d544e` (the same plus authority and channels: **277 passed**) |
| `tsc --noEmit` | local + runner | clean |
| Node unit specs, 11 files (messaging logic 26, templates 10, strings 4, people logic / nav / strings, token lint, Settings index, status logic / feed, native tabs) | local | **128 passed** |
| Layout guard `layout-wiskey-messaging.spec.ts` - the person's tab, the dialog (single, bulk, confirmation, running, result table), the Settings page; five skins x light / dark x 11 widths (320..1440) | local + runner | 10 tests, 990 width checks, **0 findings** on both |
| Layout guard of the S10 Settings page, all skins / widths (a system administrator now has five segments) and the S7 people screen | runner (full), local (quick) | 10 + 2 passed (runner); 2 + 2 passed (local quick) |
| Evidence `evidence-wiskey-messaging.spec.ts`, `-messaging-settings`, `evidence-wiskey-people-native` (S7; its dialog tests follow the real routes now), `evidence-access-status` (S10; five segments), three projects | runner | 182 passed, 244 skipped by design (the behaviour runs on desktop) |
| The same four evidence specs | local | 31 + 25 + 85 + 28 passed (62 + 44 + 92 + 1 skipped by design) |
| Pixel `pixel-wiskey-messaging.spec.ts` (desktop + phone) and S7's `pixel-wiskey-people.spec.ts` | local | 26 + 22 passed - the flows ran; the screenshot compare is skipped on Windows (the baselines are Linux-only; this slice generated none) |

The mocks cannot drift from the server: `tests/fixtures/messaging_wire.json` holds the reply shapes of the message and settings routes and
`test_intercom_messaging.py::test_the_mock_replies_have_the_shape_of_the_real_routes` drives the real routes against it.

Evidence screenshots (desktop, plus the Settings page at tablet and phone): `docs/design/evidence/CR-036-WA/`.

### What the runs found and fixed

- The result table's layout check measured the wrong container at 768 px (a finding in all ten skin / scheme combinations): the check is fixed,
  the table itself was always inside the dialog.
- The bulk "stop" evidence test raced a timer under load: it holds the first message in flight now.
- A template with `{organization}` reached the dialog unfilled (a sender who edited it sent the literal braces): the server fills it.
- The migration number: see "Shared files" below (0079 -> 0076).

### NOT_RUN

- Every Linux pixel baseline: `pixel-wiskey-messaging.spec.ts` has none yet (generate on the runner with `--update-snapshots`); S7's
  `msg-single`, `msg-sent` (the drawer behind the dialog has a fourth tab now; the dialog itself changed too) and probably `msg-quota` /
  `msg-bulk` need a refresh, and S10's `status-*` baselines for the administrator persona show a fifth segment.
- A second FULL backend run on the runner after the renumbering (only the 8 migration-sensitive / messaging files re-ran there).
- Anything live: a real WisKey, a real WhatsApp account or phone (slice S14, after W11 is answered). `contracts/API_INVENTORY.md` is a release-prep
  artifact and was not regenerated: seven routes were added (the table above).

## Shared files this slice touches, and merging with the parallel slices

Own files (new): `routers/access_control_messaging.py`, `services/intercom_messaging.py`, `services/intercom_messaging_adapter.py`,
`migrations/0076_intercom_messages.sql`, `tests/fake_wiskey_messaging.py`, `tests/test_intercom_messaging.py`; frontend
`api/access-messaging.ts`, `access-control/messaging-templates.ts`, `i18n/access-messaging.ts`, `screens/system-access-messaging.ts`,
`screens/wiskey-person-messages.ts` and the specs / fixtures named above.

Shared files edited (small, additive): `services/intercom_sync.py` (a fifth lane `message`: slot, buckets, `message_send`),
`services/wiskey_channels.py` (the `messaging` channel and its allow-list), `services/intercom_authority.py` (`PEOPLE_MESSAGE`, in
`SENSITIVE_PERMISSIONS`), `roles.json` and `contracts/examples/role-catalog.design.json` (site_admin, system_admin, not implied by a wildcard),
`routers/access.py` (the permission's Hebrew label), `main.py` (one import + one `include_router`), the pinned migration lists of
`test_media_api.py`, `test_media_players_api.py`, `test_migrations.py`, `test_notify_core.py`, `test_intercom_authority.py` (defaults),
`test_wiskey_channels.py`; frontend `access-control/access.ts` (the permission + `message` flag), `i18n/access-people.ts` (message strings),
`screens/wiskey-people.ts`, `screens/wiskey-person-drawer.ts`, `screens/wiskey-message-dialog.ts`, `screens/system-access-control.ts` (a fifth
segment), `screens/system-index.ts` (one index entry), `tests/wiskey-people-mock.ts`, `tests/evidence-wiskey-people-native.spec.ts`,
`tests/unit-people-strings.spec.ts`, `tests/evidence-access-status.spec.ts` (a system administrator now has five segments).

Dry-run merges of this branch (`git merge-tree`, base `integ/248` @ 10620d30) against the parallel branches - every conflict is an adjacent-line
addition; the resolution is to keep both sides:

- `pilot/WISKEY-s12-gaps`: no conflict.
- `pilot/WISKEY-media-s18`: `main.py` (two `include_router` blocks).
- `pilot/WXD-integration` (the door path): `main.py` (two `include_router` blocks) and the four pinned migration lists - the union is
  `[..., 75, 76, 77, 78]`. **0076 is deliberate**: `scripts/release_check.py` (so `test_release_check.py::test_repository_is_release_consistent`)
  requires a contiguous migration sequence; this slice takes the next free number on its base, and the door path's 0077 (station scope) and
  0078 (door map) follow it with no gap - that line alone leaves 0076 unassigned and is not contiguous until something fills it. Renumber
  only if another slice takes 0076 first. (The first version of this branch used 0079, following the S3 / S4 interface notes' "next free
  number after CR-033's 0078"; the full backend run on the runner caught the gap.)
- `pilot/WISKEY-s11-writes`: `frontend/src/access-control/access.ts` (the demo flag object: `message: true` + S11's `capture: true, pin: true`),
  `main.py` (two blocks), `services/intercom_authority.py` (`SENSITIVE_PERMISSIONS` gains `PEOPLE_MESSAGE` and S11's `PIN_GENERATE`),
  `screens/wiskey-people.ts` (state fields `messagesRev` + S11's `acting` / `result` / `pendingDelete`; the drawer's property list gets both
  groups) and `screens/wiskey-person-drawer.ts` (imports `MessagingTransport` + S11's `wt`; properties `transport` / `messagesTab` /
  `messagesRev` + S11's `canAct` / `resultLine`). The drawer's footer has "שלח הודעה" and S11's "פעולות" side by side after the merge.
