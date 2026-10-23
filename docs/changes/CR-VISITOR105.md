# CR-VISITOR105 - visitor pre-registration with a temporary door code (board item r105)

**CR number:** provisional; the lead assigns the next free CR number at integration.
**Status:** PROPOSED (design only, 2026-10-23). Branch `pilot/VISITOR105-295` from `origin/main` @ 320e55551 (v2.12.4).
No product code, no migration file, no test, no runner job, no device, door, reader, WisKey, WhatsApp account or live system was
touched to write this. **Nothing here is an approval to build, to switch anything on, or to put a code on a real door.**
**Migration:** PROVISIONAL `0170_visitor_invites.sql`, one file (section 9); the lead renumbers at integration.

**The request (board r105, condensed):** a resident or an employee pre-registers a visitor (name, phone, time window, door /
station); the visitor receives a temporary code by WhatsApp / SMS, valid only inside the window and only at the chosen door; the
visitor types it at the intercom / door keypad; the entry is logged.

**Short answer:** yes, as a **new front door onto the existing external-access grant**, not as a new door path. A visitor
invitation creates one `access_grants` row (`credential = 'pin'`) for a minimal visitor contact; from there the grant engine that
already ships (`services/access_grants.py` + `services/access_grant_engine.py`) does everything that touches WisKey: create the
person inert, provision the door map / validity / daily hours, generate the PIN at the due time, hand it to the WhatsApp
transport and drop it, revoke at the end with read-back proof. What this CR adds is only what a visitor needs and a vendor
technician does not: a host (the inviting Arx user), an approval envelope, per-host caps, a visitor page for the privacy notice and
the number confirmation, a "single entry" option, an arrival notice to the host, and shorter retention.

Companions (read, not edited): `CR-ARX-WISKEY-SHARED-IDENTITY.md` (+ build notes) - the grant model, triggers R1-R11, code rules
4.1-4.4, threat table T1-T12; `CR-STATION-PERMISSIONS-295.md`; `CR-USR2-ARX-ONLY-IDENTITY.md` (local identities); `CR-018-NOTIFICATIONS.md`
(content-free payloads); `NOTIFWA-WHATSAPP-CHANNEL.md`; `CR-036-WISKEY-NATIVE-SCREENS.md` (rows 16, 26, 33); `CR-ACR7-FENCE-02.md`
(intents); `docs/security/HA_IDENTITY_RBAC_HE.md`; `docs/security/PROPOSAL_PUB03_PENDING_TECHNICIAN_RETENTION.md`.

## 0. Sources, precedence, evidence marks

Precedence (CLAUDE.md): approved change request > `MASTER_SPEC_HE.md` and `docs/security/` > `AGENTS.md` > this document.
Contradictions are listed in section 14, not resolved.

Marks: **V** read in Arx code at 320e55551; **R** reported by a source document; **W?** WisKey behaviour Arx has not verified;
**D** a design proposal of this CR.

Closed decisions this CR keeps and does not reopen: Arx RBAC is the only authority (AUTH01), WisKey executes; door actions on the
real installation are approved by the owner action by action, sub-agents use fakes only (2026-10-12); WisKey door windows and
emergency stay OFF, and nothing here depends on them; the capture lease stays OFF (`capture_lease.GO_LIVE_PERMITTED = False`); the
PIN safety design (PG: the value is never stored, logged, cached, audited, hashed or measured; intents carry no PIN - migration 0145
header); the code never travels in a message that carries a link, and never on a page; one live grant per person (owner answer 12);
a temporary grant lasts at most 14 days (owner answer 8); a code goes only to a number the person confirmed (owner answer 3).

## 1. Today's facts

| # | Fact | Mark |
|---|---|---|
| F1 | `access_grants` (0107 + 0126 + 0127 + 0140) holds a time-bounded door grant of a **contact** (`subject_kind = 'contact'`, a `ticket_contacts` row of kind `person`): `doors_json` {station: [relay]}, `valid_from` / `valid_until`, `timing_json` (daily hours), `credential` pin / card / none, states `requested` -> `approved` -> `provisioning` -> `active` -> `revoking` -> `ended` / `revoked` / `refused` / `failed` / `unknown`, closed `end_reason`, `source_kind IN ('manual','ticket','rfq_order')`, one live grant per subject (partial unique index). | V |
| F2 | `request_grant` creates `requested` or merges a narrowing / holds a widening; `approve` needs, on EVERY station of the grant, `access.external.grant` + `access.people.manage` + `access.people.sensitive` (+ `access.pin.generate` for a PIN), an interactive human session, and refuses self-approval except for a system administrator (ACCESSREQ decision (a)). | V |
| F3 | The worker (`WORKER.run_once`, one process, OS lock) creates the WisKey person inert (`created_from_arx`, opaque `employee_no`, `access_category = visitor` for a contact without `vendor_id`, `responsible_person` = the approver's display name), provisions, and at `code_due_at` runs `users/pin_generate` + `users/update` in one `deliver_code` call; the PIN is handed to `send_code` (WhatsApp, use `access.codes`) and dropped. A restart while `queued` -> `not_delivered`; rotation is the only way on. | V |
| F4 | Revocation is at-least-once with read-back proof (`revoking` until WisKey shows the strip and the central sync shows no pending revocation; `revoke_proof` verified / unverified). Triggers R1-R10 run in-transaction and in the backstop `reconcile`; R7 re-decides every live grant against its **approver's** current permissions on every `permission_revision` bump, fail closed. | V |
| F5 | Code caps: 3 sends per grant, 3 per number per day, 50 per installation per day, 60 s gap (`access_code_sends`, number keyed by `phone_key`). Code message: fixed, code-owned templates he / en / ar / ru, no link, names the doors, dates and hours. | V |
| F6 | Number rule (`number_problem`): `phone_confirmed_via IN ('user','code')`, confirmed within `access.external.phone_fresh_days` (180), and `tickets/phone_verify.confirmed`. Never a manager's mark. | V |
| F7 | Switch `access.external_grants` default `off`; `GO_LIVE_PERMITTED = True` since ECCACT-295 (owner decision 2026-10-21, option A), so the switch is the gate now. `access.external.local_approvers` default off. | V |
| F8 | WisKey events (`events/list`, a READ) carry `employee_no`, `station_id`, `door`, `authentication` (card / pin / unknown), `result` (granted / denied / unknown) and `event_type` (incl. `access_granted`, `access_denied`, `attempt_limit`). WisKey keeps 5,000 records / 30 days. | V (`intercom_adapter.project_event`, `routers/access_control.py`) |
| F9 | WisKey also has a native visit flow (`visits/create / request / decide / list / operators`, `guest_templates/*`): a WisKey policy flow with a WisKey "second operator" approver. Not wired in Arx (CR-036 row 26: "under Arx authority it needs its own design"). | V (catalog rc37-contract.4) |
| F10 | WisKey has no one-time or use-counted PIN in the catalog Arx holds; a PIN is a person credential bounded by the person's validity and timing policy. | V (catalog) / W? (no hidden capability) |
| F11 | SMS is not a channel: `messaging_runtime` lists `sms` as `soon`, `tickets/channel.FALLBACK_ORDER = ("whatsapp", "email")`. | V |
| F12 | Notifications: payloads and push bodies never carry a person's name, a visitor or an image (CR-018; `notify_sources` header). | V / R |
| F13 | `TECHNICIAN_SQL` counts any contact with a grant row as a "technician" (notice wording, needs-review report). | V |
| F14 | No "resident" concept or role exists in Arx; a resident / employee who can sign in is a `users` row (HA or USR2 local). | V |

## 2. Goal and non-goals

**Goal.** A signed-in host invites one named visitor for a short window to one or a few doors marked for visitors; the visitor
confirms his own number and reads the notice on a page; the personal code reaches him by WhatsApp in a separate message without a
link; the code works only at those doors, only inside the window (and daily hours), optionally only for the first entry; the
access ends by itself; the host is told when the visitor entered; every step is audited with ids only.

**Non-goals.** No remote door opening for a visitor (the existing door rule is unchanged and is not called from here); no door
window, no emergency interaction; no cards or capture for visitors; no QR / Bluetooth / plate credentials; no public
self-registration by visitors; no use of WisKey's native `visits/*` flow (D1); no SMS in the first delivery (D9); no free-text
message to the visitor; no billing.

## 3. Design decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Reuse the grant engine; do not use WisKey `visits/*`.** One invitation = one `access_grants` row (`source_kind = 'manual'`, `source_ref = <invite id>`) plus one `access_visitor_invites` row. | A second door path would duplicate revocation, proof, caps and audit, and `visits/decide` puts the approval inside WisKey (against AUTH01). The grant already solves the hard parts (F3, F4). |
| D2 | **The visitor is a minimal `ticket_contacts` row** (`kind = 'person'`, no `vendor_id`, no `user_id`, `employee = 0`), created by the invite and marked as a visitor by the invite row. It is hidden from every tickets directory list, picker and export, and seen only through the visitor screens. | The grant subject, the number rule (F6), the phone verification and the erase tombstone all live on `ticket_contacts`; a separate person table would fork them. Hiding keeps tickets managers from seeing visitors (minimisation). |
| D3 | **No rebuild of `access_grants`.** `source_kind` stays `manual`; the visitor-specific end reasons (single entry used, host cancelled, host inactive, ...) live on the invite row; the grant's own `end_reason` uses the existing closed values (`ended`, `manual`, `approver_lost_authority`, `contact_erased`, ...). | A SQLite CHECK change means a table rebuild of the most security-critical table; nothing in the engine needs the finer reason. |
| D4 | **The host is the approver inside an envelope** (owner question 1): an invitation that fits the envelope (section 5.2) is approved by the host's own interactive act, recorded as `approved_by = host`; outside the envelope it waits for a second person through the existing `approve`. | Makes R7 re-decision cover the host for free: when the host loses the permission or is deactivated, his visitors' grants are revoked. |
| D5 | **A separate per-station flag "visitor entrance"** (`access_station_visitor_entrance`), set by `access.external.grant` holders in Settings. An invitation may name only flagged stations. | A lobby door is not a service entrance; visitors never reach internal doors by construction. |
| D6 | **Opaque name in WisKey** (owner question 6): the WisKey person is created as `display_name = "Visitor " + ref` (the 8-hex grant reference), `responsible_person` = the host's display name (WisKey requires it for a visitor), fixed `access_purpose`. The visitor's typed name stays in Arx only. | WisKey events, its panel and its exports then hold no visitor name; Arx maps the reference back for the host. |
| D7 | **Window by default; "single entry" is an option and best effort** (owner question 3): the first `access_granted` event of the person ends the grant (revoke through the existing path). | WisKey has no one-time PIN (F10); the window between the entry and the strip (event poll + revoke) is a stated residual (T3). |
| D8 | **The visitor confirms his own number** on the visitor page with the existing phone verification code (`phone_confirmed_via = 'code'`), and acknowledges the notice there. The host's word is never enough. | Owner answer 3 / F6; a mistyped or hostile number never receives a door code; the page is also where the notice is shown. |
| D9 | **WhatsApp only in the first delivery** (owner question 5). SMS joins later as its own slice when the SMS channel exists, under the same rules (separate message, no link, fixed text). | There is no SMS channel (F11); SMS adds carrier-side retention of the code. |
| D10 | **Retention shorter than technicians** (owner question 7): the visitor's name and number are erased (contact tombstone) N days after the grant ends (default 30); the WisKey person is deleted once the revoke is proven. | A visitor is a one-off; owner answer 10 (manual delete) was given for regular vendors' technicians. Recorded as contradiction C2. |
| D11 | **A visitor live-build constant** `VISITORS_LIVE_PERMITTED = False` (owner question 12): while False, the visitor switch cannot be turned on; flipped only by the commit that carries the owner's approval after the first lab run (done action by action with the owner). | The capture-lease / door-windows pattern: a release never needs it, a setting cannot bypass it. |

## 4. Flows

### 4.1 Host creates an invitation

```
host (signed in, interactive)   -> POST /access/visitors  {visitor_name, phone, lang, stations[], window, hours?, mode, purpose, client_request_id}
server (one transaction)        -> checks 5.1 + 5.2; visitor contact row (D2); access_grants row via request_grant (requested)
                                   + access_visitor_invites row; inside the envelope: approve as the host (D4) -> approved
                                   outside: stays requested, managers notified (content-free), existing approve screen
after commit                    -> invitation message to the visitor's number (WhatsApp, fixed template, carries the page link)
```

- Fields: visitor first name (+ optional last-name initial; at most 40 characters, `access_request.clean_text` rules), phone (E.164,
  the tickets parser), language he / en / ar / ru, one or more visitor-entrance stations (relays from the served WisKey copy),
  window start and end in the installation's IANA zone, optional daily hours from `HOURS_CHOICES`, mode `window` | `single_entry`,
  purpose from a closed list (guest, meeting, delivery, service, other) - no free text reaches the visitor or WisKey.
- Refused: a phone equal to the host's own directory number or to any `users`-linked contact (a host does not mint himself a second
  credential); a number that belongs to a live vendor technician contact (one live grant per person - the invitation is refused
  rather than merged into a technician's grant); a phone that already has a live visitor grant from another host (refused with a
  neutral text: no disclosure of who invited).
- A repeated invitation of the same number by the same host re-uses the visitor contact (a narrowing / same scope merges at once; a
  widening is a new approval - the existing `request_grant` outcomes).

### 4.2 Approval policy - who may invite and how many

See section 5. In one line: an invitation within the envelope is approved by the host's own act; anything else needs a second
person holding the existing approve permissions; caps are per host and per installation.

### 4.3 The visitor receives the invitation and confirms

```
invitation message (WhatsApp)   -> "<host first name> invited you ... confirm here: <link>"   (no code, no door names)
visitor opens the link          -> GET /v/api/visit  (public app; token resolved once; uniform 404)
                                -> shows the notice (n-visitor version), the host's first name, the date window, the door names
visitor taps "send me a code"   -> phone_verify code to the same number (existing caps), typed back on the page
                                -> POST /v/api/visit/confirm {code, notice_ack: true, client_request_id}
                                -> contact.phone_confirmed_via = 'code'; access_grant_notices(via = 'page'); invite.confirmed_at
```

- The link token: 128-bit random, stored as SHA-256 only (the handler-link pattern), valid until the grant's `valid_until` or the
  first successful confirmation + 1 hour, whichever is earlier; single purpose (it can never show or resend the door code).
- A forwarded invitation link lets the forwardee read the window and door names, nothing more: the confirmation code and the door
  code both go only to the invited number.
- Not confirmed by `valid_from`: the grant stays `approved`, no code is generated; at `valid_until` it ends with invite reason
  `expired_unconfirmed`; the host is told.

### 4.4 The code is created in WisKey through the existing grant engine

Unchanged worker path (F3): provisioning creates the WisKey person inert (D6 name), writes door map + validity + daily hours;
`code_due_at` = the existing `code_due` (the evening before at `code_hour`, or at once when nearer) but never before the number
confirmation; at due time `deliver_code` generates the PIN, writes it with a revision check, hands it to `send_code` and drops it.
The code message is the existing fixed template (doors, dates, hours, "personal - do not pass it on", reference); a visitor
variant changes only the first sentence ("an entry code for your visit") - code-owned, four languages, no link.

### 4.5 Auto-expiry, revocation, one-time vs window

| Mode | Ends when | How |
|---|---|---|
| `window` | `valid_until` (R1) | WisKey validity expires the credential (offline too where the device holds validity, W-a); the worker also strips PIN, doors and `active` (F4) |
| `single_entry` | the first event `access_granted` with `employee_no` = the link's employee number at one of the grant's stations, or `valid_until` | the arrival watcher (4.6) calls `mark_revoking(..., 'manual')` with invite reason `single_entry_used`; the strip follows at least once with proof |
| any | host cancels (`DELETE /access/visitors/{id}`), a manager revokes, the host is deactivated / loses `access.visitor.invite` on the station (R7 via D4), the visitor contact is erased (R3), a station loses the visitor-entrance flag or leaves the host's chain (R9 narrow / revoke), the visitor switch or `access.external_grants` goes off ("revoke all visitors", system administrator, confirmation word) | the existing `mark_revoking` + at-least-once strip |

Revoke never waits for the visitor or the network: the row moves to `revoking` in the same transaction; the screen shows "pending on
station X" for an offline station, as for technicians (T7 of the shared-identity CR).

### 4.6 Arrival notice to the host and the entry log

- An arrival watcher (inside the existing worker pass, READ only) pages `events/list` from a stored cursor every 60 s while at
  least one visitor grant is `active`, filtered to the stations of live visitor grants, and matches `employee_no` to the visitor
  links. Nothing is polled while no visitor grant is active.
- On a match with `result = granted`: `access_visitor_entries` gets one row (ids, station, door, event time, WisKey event id); the
  host receives `access.visitor.arrived` (in-app + push): "Your visitor has arrived - <door name>", no visitor name, no image, no
  phone (F12). Details (first name, time) are in the host's "my visitors" screen only.
- `result = denied` / `attempt_limit` for a visitor person is counted; three denials in 10 minutes notify the host and the managers
  (content-free); `attempt_limit` at a visitor-entrance station with no person notifies the managers (T2).
- The entry log is WisKey's event log (F8) plus Arx's `access_visitor_entries` (ids only), shown to the host for his own visitors
  and to managers with `access.people.read` on the station.

## 5. Permissions and the approval envelope

### 5.1 Who may do what

| Action | Required (rbac.authorize, deny-overrides, station chain) |
|---|---|
| Invite (create) | **new `access.visitor.invite`** on EVERY station of the invitation; interactive human session (bearer-token clients refused); a USR2 local identity only while `access.external.local_approvers` is on (owner question 11); the host's own `users` row active |
| Approve inside the envelope | the same act as inviting (D4); recorded as `approved_by = host`, `approval_kind = host_envelope` |
| Approve outside the envelope | the existing `approve` permissions (F2) on every station; never the host himself unless system administrator (ACCESSREQ (a)) |
| Cancel own invitation / see own visitors and their entries | the host (owner of the invite) - no further permission; a host who lost `access.visitor.invite` can still cancel |
| See / revoke every visitor on a station | `access.external.grant` OR `access.people.manage` on one station of the grant (revoking stays easy - F2 rule) |
| Mark a station "visitor entrance" | `access.external.grant` on the station + `system.configure` |
| Settings of the feature | system administrator |

`access.visitor.invite` is station-scoped and sensitive; built-in holder `system_admin` only; the owner hands it out through a
custom role (for example "resident" or "employee") or the per-user grant pattern (owner question 2). It never implies
`access.people.*`, `access.pin.generate` or any door-open permission; the worker - not the host - calls `users/pin_generate`, and
the PIN is never shown to the host.

### 5.2 The envelope (defaults; settings may only tighten below the code caps)

| Rule | Default | Code cap |
|---|---|---|
| Stations | visitor-entrance only, every one held by the host (`access.visitor.invite`) | `access.external.max_doors` (4) |
| Length of one invitation | 24 hours | 72 hours (outside the envelope: up to the existing 14 days) |
| Starts no later than | 30 days ahead | 90 days |
| Live invitations per host | 3 | 10 |
| New invitations per host per day | 5 | 20 |
| Live visitor grants per installation | 30 | 100 |
| Daily hours | optional | - |

Outside the envelope (more doors, longer, a non-visitor-entrance station, over a cap): stored as `requested`, the managers are told
(content-free), approval by a second person through the existing screen. Caps are counted from the tables (they survive a
restart), inside the same transaction as the insert.

### 5.3 Re-decision

`Worker._decide` today checks `approve_permissions(credential)` for the approver. For a grant whose invite row says
`approval_kind = host_envelope`, the re-decision checks `access.visitor.invite` (+ the host active, + the visitor-entrance flag) on
every station instead; for `second_person` it stays as today. Fail closed, unchanged.

## 6. Threat model

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | **Code sharing / forwarding** - the visitor forwards the code message or tells a friend | one person per code (one WisKey person per visitor); short window; visitor-entrance doors only; `single_entry` option; host told on every entry (an unexpected second entry is visible); "personal - do not pass it on" in the message; the invitation link and the code are separate messages, the page never shows the code | a PIN proves knowledge, not identity: accepted and stated in the host's screen; within the window a forwarded code works once (single entry) or many times (window) |
| T2 | **Brute force at the keypad** - more live PINs raise the chance a random 6-digit guess opens a visitor door | installation cap of live visitor grants (30) on top of technicians'; visitor doors only; daily hours; short windows; WisKey `attempt_limit` / denied events alert the managers (4.6); PIN removed at the end | device lockout policy is WisKey's / the device's (**W?**, WV-2); with N live PINs at a door, one guess succeeds with N / 10^6 |
| T3 | **Replay** - a code seen over the shoulder or reused after the visit; a replayed API call | window end in WisKey validity; `single_entry` strips after the first entry; API: `client_request_id` replayed by the stored row, the link token single purpose and bounded in time, the confirmation code single use (phone_verify) | `single_entry` gap: event poll (<= 60 s) + strip (seconds, more when a station is offline) - a second entry in that gap works; stated in the UI as "best effort" |
| T4 | **Reaching beyond the chosen door** | explicit station + relay map; visitor-entrance flag only; person created by Arx with no groups (`group_ids` not writable) and `created_from_arx` (no write onto a matched person, F3 rule); scope proof by read-back; timing policy; R9 narrows when a station loses the flag or leaves the chain | a WisKey-side edit in WisKey's own panel (shared-identity T12): drift shown, never silently re-applied |
| T5 | **Resident abuse** - mass invitations, a second credential for himself, invitations after moving out, invitations to doors he does not hold | per-host caps; own number / staff numbers refused; station permission per station; host deactivation or permission loss revokes all his visitors (D4 + R7); managers see every live visitor per station and can revoke all of one host; weekly digest counts invitations per host (content-free) | a host inside his caps can still invite someone undesirable - accepted; that is the host's authority by design |
| T6 | **Public page abuse** - enumerating tokens, flooding confirmation codes to a victim's number | 128-bit token, uniform 404, public-app rate limits; phone_verify caps (1 per 60 s, 5 per day per row and per number, 50 per installation); an invitation needs a signed-in host, so no anonymous sender exists | a host can make Arx message a number he typed - bounded by his caps and audited |
| T7 | **Data minimisation and leaks** | Arx keeps first name (+ initial), phone, language - no ID number, no plate, no photo; WisKey gets an opaque name (D6), no phone; notifications content-free; audit ids only; the code never stored, logged, audited (the existing sentinel-PIN scan over DB, WAL and logs extended to visitor flows) | the WhatsApp provider sees the code in transit (true for technicians already) |
| T8 | **Retention creep** | contact erased N days after the end (default 30); WisKey person deleted after proven revoke; grants / invites / entries ids only, 12 months (the existing `RETENTION_DAYS`); WisKey event log 30 days (F8) | WisKey's own backups (W?) |
| T9 | **Number recycling / wrong number** | the visitor confirms his own number on the page (D8); a number change on the contact revokes (R3) | a number recycled between confirmation and the visit (days): accepted |
| T10 | **Stale host authority** | R7 re-decision on every permission revision (5.3) | seconds between bump and re-decision |
| T11 | **Visitor treated as a technician** (F13) | `TECHNICIAN_SQL` excludes contacts that have an invite row; a visitor notice version of its own | none known |

## 7. Notifications

| Source key | To | When | Payload |
|---|---|---|---|
| `access.visitor.arrived` | the host | a granted entry of his visitor (4.6) | door name, time; no visitor name / image / phone |
| `access.visitor.confirmed` | the host | the visitor confirmed his number | none beyond "confirmed" |
| `access.visitor.not_delivered` | the host + managers | the code could not be delivered (F3 restart / unknown) | "rotate" action for the host (counts against the grant's 3 sends) |
| `access.visitor.expired_unused` | the host | window ended with no entry or no confirmation | none |
| `access.visitor.denied` | the host + managers | 3 denials in 10 min / `attempt_limit` | station name only |
| `access.visitor.needs_approval` | managers holding the approve permissions on the stations | an invitation outside the envelope | no names |

All through `notify_policy` sources (default channels: in-app + push; WhatsApp only if the administrator adds it in the policy and
the NOTIFWA rules allow it).

## 8. Audit (ids only)

New actions on `resource_type = 'access_visitor_invite'`: `access.visitor.invite`, `.approve_envelope`, `.needs_approval`,
`.message_sent` / `.message_not_sent`, `.confirm` (the page), `.notice_ack`, `.cancel`, `.arrived`, `.single_entry_used`,
`.expired`, `.erase`, `.station_flag_set` / `.station_flag_cleared`, `.revoke_all`. Details: invite id, grant id, host user id,
station ids (count in the history view), window, mode, purpose code, outcome / reason codes, cap name on a refusal. The grant keeps
its own `access.grant.*` rows (request, approve, provision, code_*, revoke ...). **Never** the visitor's name, phone, the code, its
hash or length, the link token or its hash, a message text.

## 9. Migration (PROVISIONAL 0170, one file `0170_visitor_invites.sql`)

Additive only; nothing is read while the switch is off; `access_grants` is not rebuilt (D3).

```sql
-- PROVISIONAL 0170 (CR-VISITOR105). Additive. Ids, codes and instants only: never a name, a phone, a PIN, a token.
CREATE TABLE access_visitor_invites (
  id                 TEXT PRIMARY KEY,                               -- uuid4 hex
  grant_id           TEXT NOT NULL UNIQUE REFERENCES access_grants(id) ON DELETE CASCADE,
  host_user_id       TEXT NOT NULL,                                  -- users.id of the inviting host
  visitor_contact_id TEXT NOT NULL,                                  -- ticket_contacts.id (tombstoned on erase, id kept)
  mode               TEXT NOT NULL CHECK (mode IN ('window', 'single_entry')),
  approval_kind      TEXT NOT NULL CHECK (approval_kind IN ('host_envelope', 'second_person')),
  purpose            TEXT NOT NULL CHECK (purpose IN ('guest', 'meeting', 'delivery', 'service', 'other')),
  token_sha256       TEXT CHECK (token_sha256 IS NULL OR length(token_sha256) = 64),  -- NULL once spent / expired
  token_expires_at   TEXT,
  message_state      TEXT NOT NULL DEFAULT 'pending' CHECK (message_state IN ('pending', 'sent', 'not_sent', 'unknown')),
  confirmed_at       TEXT,                                           -- the visitor confirmed his number on the page
  first_entry_at     TEXT,
  entries            INTEGER NOT NULL DEFAULT 0 CHECK (entries >= 0),
  end_reason         TEXT CHECK (end_reason IS NULL OR end_reason IN ('window_ended', 'single_entry_used', 'host_cancelled',
                       'manager_revoked', 'host_inactive', 'host_lost_permission', 'station_changed', 'visitor_erased',
                       'expired_unconfirmed', 'feature_off', 'refused', 'failed')),
  erase_due_at       TEXT,                                           -- D10: when the visitor contact is erased
  erased_at          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  revision           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_avi_host ON access_visitor_invites (host_user_id, created_at);
CREATE INDEX idx_avi_contact ON access_visitor_invites (visitor_contact_id);
CREATE INDEX idx_avi_erase ON access_visitor_invites (erase_due_at) WHERE erased_at IS NULL;
CREATE UNIQUE INDEX idx_avi_token ON access_visitor_invites (token_sha256) WHERE token_sha256 IS NOT NULL;

CREATE TABLE access_visitor_entries (                                -- the arrival watcher's matches (4.6)
  invite_id          TEXT NOT NULL REFERENCES access_visitor_invites(id) ON DELETE CASCADE,
  event_id           TEXT NOT NULL,                                  -- WisKey event id
  station_id         TEXT NOT NULL,
  door               INTEGER CHECK (door IS NULL OR door IN (1, 2)),
  result             TEXT NOT NULL CHECK (result IN ('granted', 'denied', 'attempt_limit')),
  event_at           TEXT NOT NULL,
  seen_at            TEXT NOT NULL,
  PRIMARY KEY (invite_id, event_id)
);

CREATE TABLE access_station_visitor_entrance (                       -- D5
  station_id         TEXT PRIMARY KEY,
  set_by             TEXT NOT NULL,
  set_at             TEXT NOT NULL
);
```

Settings (the `settings` key/value table, no schema change): `access.visitors` (off), `access.visitors.max_hours` (24),
`.max_ahead_days` (30), `.host_live_max` (3), `.host_day_max` (5), `.installation_live_max` (30), `.erase_after_days` (30),
`.single_entry_default` (off). The events cursor is a setting too (`access.visitors.events_cursor`, an opaque WisKey cursor).
None of these tables is in a project backup's allow-list (the `access_*` rule); erase is a tombstone on `ticket_contacts` (the
tickets 15.2 path). Rollback: additive; older code ignores the three tables; run "revoke all visitors" before a downgrade so the
PINs are stripped (validity expires them anyway).

## 10. Switches (all default OFF)

1. `VISITORS_LIVE_PERMITTED` (code constant, False) - D11.
2. `access.visitors` (setting, `off`) - cannot be `on` unless the constant is True AND `access.external_grants` is `on`; while
   off every visitor route answers 404 (screens hidden), the watcher does nothing, nothing is messaged.
3. `access.external_grants` (existing, `off`) - turning it off stops new visitor invitations too; existing visitor grants run to
   their end unless "revoke all" is used (R10 rule).
4. Door-write approvals: the first provisioning against the real WisKey, the first code on a real keypad and the first strip are
   each done with the owner, action by action, on a lab door he names (2026-10-12 rule); sub-agents never.
5. Emergency and door windows: untouched. Emergency activation has no effect on visitor grants (R11 stays reserved); no visitor
   flow calls `door_emergency`, `door_windows_*` or the door-open rule.
6. Capture lease: not used (visitors never get a card; `access_cards.check_request` already refuses a non-vendor contact).

## 11. Test plan (fakes only; PLANNED_NOT_RUN)

All tests use `tests/fake_wiskey.FakeAccessEngine`, a fake code transport (`access_grants.TRANSPORT`), a fake events feed and the
fixed clock (`access_grants.set_clock`). No test reaches a station, a door, a reader, WhatsApp or the runner's lab hosts.
Negative first:

1. Switch off / constant False: every route 404; the setting cannot be turned on (409); turning `access.external_grants` off blocks
   new invitations.
2. Invite refused: no `access.visitor.invite` on one of the stations; a non-visitor-entrance station; a bearer-token client; a local
   identity while `local_approvers` is off; the host's own number; a staff / technician number; over each cap (host live, host day,
   installation live) - counted after a simulated restart; a window over 72 h inside the envelope routes to `requested`.
3. Envelope approval: `approved_by = host`, `approval_kind = host_envelope`; outside the envelope the host cannot approve (403
   `access_grant_self_approval`) and a second person can.
4. Re-decision: removing the host's `access.visitor.invite` on one station narrows, on all stations revokes; deactivating the host
   revokes; clearing the visitor-entrance flag narrows / revokes.
5. Visitor page: uniform 404 for unknown, expired and spent tokens; the page never contains a code (sentinel); confirmation code
   caps; notice ack stored with its version; a forwarded link without the confirmation code cannot confirm.
6. No code before confirmation: `deliver_code` is not called while `confirmed_at` is NULL; `expired_unconfirmed` at the window end.
7. Code path: PIN generated and written once, transport called once, the sentinel PIN absent from the DB file, WAL, logs, audit
   rows, intents and exceptions; restart while queued -> `not_delivered`; rotation counts against 3 sends.
8. Single entry: a fake `access_granted` event with the visitor's `employee_no` -> `revoking` -> strip proven -> `ended`; an event of
   another person or another station does nothing; duplicate events are idempotent (PK).
9. Arrival notice: one `access.visitor.arrived` per entry, payload without the visitor's name / phone; three denials -> one alert.
10. Expiry and revocation: window end, host cancel, manager revoke, erase, "revoke all visitors" - each strip is at-least-once with
    read-back; an offline station leaves `revoking` and alerts after 2 minutes.
11. WisKey person: `display_name` opaque, no phone sent, `access_category = visitor`, `responsible_person` = host's name, no groups,
    `created_from_arx`; a visitor invite never writes onto a matched person.
12. Directory hiding: visitor contacts absent from tickets contact lists, pickers, exports and the needs-review technician report;
    `is_technician` is False for a visitor.
13. Retention: contact erased at `erase_due_at`; WisKey person deleted only after the proven revoke; grant / invite / entries rows
    removed after 12 months; nothing of a visitor in a project backup.
14. Audit allow-list scan: no name, phone, token, code in any `access.visitor.*` row.

## 12. Slices (smallest first; estimates in agent-hours, design estimates, not measured; Opus for every security slice)

| # | Slice | Depends on | Est. |
|---|---|---|---|
| V0 | This CR + owner answers | - | done |
| V1 | Migration 0170, settings, switches + constant, visitor-entrance flag (route + Settings toggle), directory hiding, `TECHNICIAN_SQL` exclusion; tests 1, 12 | V0 answers | 3 |
| V2 | Host invite API + envelope + caps + second-person path + re-decision rule; visitor contact creation; tests 2-4 | V1 | 5 |
| V3 | Visitor page (public app): token, notice, number confirmation, invitation message template (4 languages, ar / ru native review); tests 5-6 | V2 | 5 |
| V4 | Code path wiring (no-code-before-confirmation, visitor template variant), cancel / expiry / revoke-all, retention and erase; tests 7, 10, 11, 13 | V3 | 4 |
| V5 | Arrival watcher (events cursor), entries table, notifications, single-entry revoke; tests 8, 9 | V4 | 4 |
| V6 | Screens: host "my visitors" (list + table views), invite form, managers' per-station visitors view - after an owner-approved mockup | V2 (API) | 6 |
| V7 | Security review (Fable) of the public page and the envelope, then the lab run with the owner, action by action; flip the constant | V1-V6 | 3 + owner time |
| V8 | SMS delivery, when the SMS channel exists | SMS channel | later |

## 13. Questions for WisKey (to be forwarded by the owner, one message)

- **WV-1** Is there any one-time or use-counted credential (a PIN valid for N entries) per person or per station? If yes, Arx would
  use it for `single_entry` instead of the event-and-strip approach.
- **WV-2** The keypad lockout policy per station (attempts, lock time) and whether `attempt_limit` / denied PIN events are reported
  without a person.
- **WV-3** The latency from a keypad entry to its `events/list` row, and whether `employee_no` is always present on a PIN
  `access_granted` event.
- **WV-4** Is the person's validity window held on the device for offline expiry (the shared-identity W-a question, still open)?
- **WV-5** PIN quarantine: can a freed PIN be kept out of `pin_generate` for N days (shared-identity T2)?

## 14. Contradictions and risks recorded (not resolved)

- **C1** ACCESSREQ decision (a) ("the requester may not approve his own request") vs D4 (the host approves inside the envelope).
  The envelope is a narrower power (visitor doors only, short, capped), but it is self-approval. Owner question 1.
- **C2** Owner answer 10 ("WisKey keeps a person until a manual delete") vs D10 (automatic delete for visitors). Owner question 7.
- **C3** The board text says "WhatsApp / SMS link"; the closed rule says the code never travels with a link, and SMS does not
  exist (F11). This CR sends a link (invitation, no code) and the code separately, WhatsApp only. Owner question 5.
- **C4** The board text says "one-time"; WisKey has no one-time PIN (F10). `single_entry` is best effort (T3). Owner question 3.
- **C5** Shared-identity principle 3.1.3 ("no automatic grant; every grant approved by a human in an interactive session"): the
  envelope approval IS a human interactive act (the host's), so this CR reads it as compliant; the owner may read it otherwise.
- **C6** WisKey's native `visits/*` and `guest_templates/*` exist (F9) and are deliberately unused (D1). If WisKey later makes
  them the supported path, this CR must be revisited rather than run in parallel.
- **C7** `responsible_person` sends the host's display name into WisKey (WisKey requires it for a visitor); that is personal
  data of the host in WisKey. Accepted as the host's own role; noted for the privacy summary.
- **R1** The visitor page is a new public surface: it needs the tickets public-surface checklist and an independent review before
  the switch can be on (V7).
- **R2** The installation-wide count of live PINs grows with visitors (T2); the cap is the control.

## 15. Owner questions (בעברית; ההמלצה ראשונה ומסומנת *)

1. מי מאשר הזמנה של מבקר?
   א* המזמין עצמו, בתוך מסגרת קבועה (דלתות מבקרים בלבד, עד 24 שעות, עד 3 הזמנות פעילות); כל מה שמחוץ למסגרת - אדם שני מאשר.
   ב כל הזמנה באישור אדם שני (מנהל).
   ג רק מנהלי גישה יכולים להזמין.
2. למי תהיה ההרשאה החדשה "הזמנת מבקרים"?
   א* לאף תפקיד מובנה (רק מנהל מערכת); אתה מחלק אותה לפי תפקיד או לפי משתמש.
   ב תפקיד מובנה חדש "דייר / עובד" שמקבל אותה.
3. קוד חד-פעמי או קוד לחלון זמן?
   א* ברירת מחדל: חלון זמן; "כניסה אחת" כאפשרות, מסומנת "במאמץ מיטבי" (יכולה לעבור כניסה שנייה בשניות שעד הביטול).
   ב ברירת מחדל: כניסה אחת.
   ג חלון זמן בלבד.
4. אימות מספר הטלפון של המבקר:
   א* המבקר מאשר בעצמו בקוד אימות בדף ההזמנה (וקורא שם את הודעת הפרטיות) - רק אחר כך נשלח קוד הדלת.
   ב מספיק שהמזמין הקליד את המספר (סותר את הכלל הקיים: קוד רק למספר שבעליו אישר).
5. ערוץ המשלוח:
   א* וואטסאפ בלבד עכשיו; SMS בשלב נפרד כשיהיה ערוץ SMS.
   ב לא להפעיל את התכונה עד שיהיה SMS.
6. השם שנרשם במערכת הכניסה:
   א* שם אטום ("מבקר" + מספר אסמכתא) - שם המבקר נשאר רק ב-Arx.
   ב השם הפרטי של המבקר.
7. שמירת נתוני מבקר:
   א* מחיקה אוטומטית של שם וטלפון 30 יום אחרי סוף הביקור, ומחיקת הרשומה במערכת הכניסה אחרי שהביטול הוכח (שונה מההחלטה לטכנאים - שם המחיקה ידנית).
   ב כמו טכנאים: מחיקה ידנית בלבד.
   ג מספר ימים אחר (נא לציין).
8. אילו דלתות מותרות למבקרים?
   א* סימון חדש ונפרד לכל עמדה: "כניסת מבקרים".
   ב אותו סימון קיים: "כניסה לגורמים חיצוניים".
9. מגבלות ברירת מחדל - האם מקובל: עד 3 הזמנות פעילות למזמין, עד 5 ביום, עד 30 מבקרים פעילים בכל המתקן, עד 24 שעות להזמנה (תקרה 72)?
   א* כן.
   ב ערכים אחרים (נא לציין).
10. הודעה למזמין כשהמבקר נכנס:
    א* באפליקציה ובהתראת טלפון, בלי שם המבקר (רק הדלת והשעה).
    ב גם בוואטסאפ למזמין.
    ג בלי הודעה.
11. האם משתמש מקומי של Arx (בלי חשבון במערכת התשתית) יכול להזמין?
    א* לפי ההגדרה הקיימת למאשרים מקומיים (כבויה כברירת מחדל).
    ב תמיד.
12. נעילה בקוד עד בדיקה במעבדה:
    א* קבוע בנייה כבוי עד הרצה ראשונה איתך על דלת מעבדה, פעולה אחר פעולה; רק אז פותחים אותו בקומיט.
    ב רק המתג בהגדרות (כמו שאר מתגי הגישה החיצונית מאז 21.10).
