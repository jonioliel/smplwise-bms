# CR-ARX-WISKEY-SHARED-IDENTITY - one person in Arx and in WisKey: linked records, time-bounded door grants for external people, personal access codes after an RFQ arrival confirmation

**CR number:** provisional; the lead assigns the next free CR number at integration.
**Status:** PROPOSED (design only, 2026-10-17). No product code, no migration file, no runner job, no device, door, reader, key,
secret or live system was touched to write this. Branch `pilot/CR-WISKEYID` from `origin/integ/264` @ 75f41b19.
**Nothing here is an approval to build, to switch anything on, or to provision a code on a real door.**

**The owner's question (2026-10-17, condensed):** once WisKey is absorbed into Arx, can the SAME person who exists in Arx as a
department member, handler, vendor person or contact also be the same person in WisKey, so that - for example - a vendor created in
Arx can be granted door access (permanent or temporary) through WisKey without being created again there? And a future flow: after
a vendor confirms through his RFQ award link that he will arrive on a date, Arx sends him a message with a personal access code and
the doors he may enter, valid for the work's dates and hours.

**Short answer:** yes - as a **link**, not a merge. Arx keeps the person's identity and contact data; WisKey keeps the access
record (credentials, door rules, validity, station sync). One link row joins them; Arx RBAC decides every write that crosses it;
every door grant to an external person is an explicitly approved, time-bounded object with its own revocation triggers; the
personal code is issued by WisKey, held by Arx in memory only for the one delivery, and sent to the person's verified number in a
message that carries no link. The RFQ flow adds one step to the existing order / handler link ("who arrives, when") that creates a
grant **request** - never a grant.

Companions: `CR-036-WISKEY-NATIVE-SCREENS.md` (S3 projection, S11 people writes, PG), `CR-033-WISKEY-DOOR-PATH.md` (station
scope, door rule), `CR-WISKEY-LEASE-REVOCATION-EVENT.md` (capture lease, triggers), `CR-USR2-ARX-ONLY-IDENTITY.md` (local
identities, `identity_links`, delivery/code rules), `CR-038-TICKETS-MODULE.md` (contacts 7.2, links 10.2, codes 10.5, external
people 15.2), `docs/tickets/RFQ_BACKEND_CONTRACT.md` (award, order 18), `docs/security/HA_IDENTITY_RBAC_HE.md`.

## 0. Sources, precedence, evidence marks

| Source | Where | Version |
|---|---|---|
| Identity/RBAC contract | `docs/security/HA_IDENTITY_RBAC_HE.md` (v1.1 + USR2 amendment) | integ/264 |
| USR2 (local identities, `identity_links`, reset codes, WhatsApp link rules) | `docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md` §1, §8 | integ/264 |
| Lease and revocation triggers | `docs/changes/CR-WISKEY-LEASE-REVOCATION-EVENT.md` §1.4, §4 | integ/264 |
| Agreed WisKey interface decisions | `private/planning/ARX_REPLY_TO_WISKEY_{MAC10,RW10,WRC01_C04,WCC}_*.md` (latest 2026-10-17) | read, not edited |
| Windows "best effort" decision | `private/wiskey-foldin/ARX_OWNER_DECISION_BEST_EFFORT_2026-10-14_HE.md` | 2026-10-14 |
| Arx code facts | `services/intercom_authority.py`, `services/door_authority.py`, `services/intercom_writes.py`, `services/intercom_messaging.py`, `routers/access_control*.py`, `services/tickets/{rfq,rfq_orders,rfq_vendor,rfq_links}.py`, migrations 0076, 0080, 0084, 0087, 0091, 0096, 0097, 0099, 0100 | integ/264 @ 75f41b19 |

Precedence (CLAUDE.md): approved change request > `MASTER_SPEC_HE.md` and `docs/security/` > `AGENTS.md` > this document.
Contradictions are recorded in section 12, not resolved.

Marks: **V** read in Arx code at 75f41b19; **R** reported by a source document; **W?** WisKey behaviour not verified by Arx; **D**
design proposal of this CR.

Closed decisions this CR respects and does not reopen: Arx RBAC is the only authority (AUTH01, 2026-10-03/12); door actions on the
real installation are confirmed with the owner action by action, and sub-agents use fakes only (2026-10-12); WisKey **door
windows and emergency stay OFF** until released (2026-10-14: windows = "best effort", default off, no Arx open-then-close timer);
the capture lease rules (120 s, revoke-all on any `permission_revision` bump, 5 s / 15 s heartbeat; route stays OFF); the PIN
generation safety design (PG: interactive human only, the value never stored, logged, cached, audited, hashed or measured); the
messaging rule that a free-text box never inserts a credential (2026-10-12 answers 9-10); RFQ "an award never sends anything
automatically" (16.10); USR2 §1a.7 "authority is never unioned across linked identities; disabling one only suggests disabling the
other".

## 1. Today's facts (what exists, what does not)

| # | Fact | Mark |
|---|---|---|
| F1 | Arx stores **no WisKey person**. People live in WisKey; Arx projects them through `intercom_authority` (the one filter) and writes them through S11 (`users/create`, `users/update` with revision CAS, `users/delete`, `users/temporary_cancel`, cards, photo, archive). A person is editable only with `access.people.manage` on EVERY station the person is assigned to; sensitive fields need `access.people.sensitive`. | V |
| F2 | A WisKey person has `employee_no` (required), `display_name` (≤32), `phone`, `active`, `valid_from`/`valid_until` (together), `pin`, `cards`, `permission_overrides`, `door_permissions` (stations → relays), `access_category` (`staff`/`visitor`/`contractor`; visitor/contractor need a responsible person and an end date - WisKey `guest_responsible_required`), `responsible_person`, `access_purpose`, `access_timing_draft`, `access_timing_policy` (`ha` = Arx enforcement through WisKey's rolling validity window; `native` = the device's schedule with per-station slot bindings). `group_ids` are not writable from Arx. | V (`routers/access_control.PersonData`) |
| F3 | `users/temporary_cancel` switches a visitor/contractor off but **keeps the credentials and rules** (reason codes `visit_cancelled`/`visit_completed`/`access_no_longer_needed`). | V |
| F4 | `users/pin_generate` returns a free 6-digit PIN, **not reserved** (the save can still hit `intercom_pin_conflict`), to an interactive human session only, `Cache-Control: no-store`; the value is never stored/logged/audited (value, hash or length). Requires `access.pin.generate` + `access.people.manage` (sensitive level on every station of a saved person). | V |
| F5 | `identity_links` (migration 0096) joins exactly one HA user id to one Arx local user (`users.id`, FK ON DELETE CASCADE): PK `(ha_user_id, local_user_id)`, unique on `local_user_id`, `linked_by`, `linked_at`. Informational: no authority union; disable suggests. It cannot hold a ticket contact or a WisKey person. | V |
| F6 | Ticket directory `ticket_contacts`: `kind` `person` / `vendor` (company), `vendor_id` (a person working for a vendor), `user_id` (the row of an internal user), `employee` flag (0084: an employee without an Arx account), `phone_e164` + keyed `phone_key`, `lang` he/en/ar/ru, `active`, `erased_at` tombstone, `revision`; `phone_confirmed_at` + `phone_confirmed_via` `user`/`manager`/`code` (0091). | V |
| F7 | Code and channel rules already shipped: tickets option B (6 digits, 10 min, single use, 5 wrong → lock, separate message without link, **D6**: when the link went by e-mail the code goes by WhatsApp, else refused); USR2-P2 reset codes (keyed MAC under a key outside the database, number-bound, caps per user / number / installation, in-memory sender - **no outbox row, the code never stored**). | V / R |
| F8 | RFQ: award (single approval, optional second) → `rfq_orders.create` opens ONE ticket per awarded vendor with an external assignment (handler link) and the execution window `work_from`/`work_to`; the `rfq_order` message leaves only on the manager's explicit click after a preview. There is **no arrival-confirmation step** today. | V |
| F9 | WisKey door **windows** (scheduled opening) and **emergency** are OFF; nothing in Arx may depend on them. Personal validity and timing policy (F2) are a different thing: they restrict when a person's own credential works, they never open a door. | R / V |
| F10 | The capture lease (card reading) is built on `pilot/LEASE-FIX`, not on main, `access.capture_lease = off`, `GO_LIVE_PERMITTED = False`. | R (WCC reply §2.4) |
| F11 | A WisKey door opened by an Arx principal goes through `door_authority.check` (`access.doors.open` on the station chain or `door.unlock` on the lock entity); an Arx-only (USR2) identity and every external contact hold neither. | V |

## 2. Data model

### 2.1 The three kinds of "person" and what is linked (D)

| Arx anchor | Who | May be linked to a WisKey person |
|---|---|---|
| `users` row (`source` `ha` or `local`) | department members, handlers, staff with an Arx sign-in | yes (staff record; usually created by the facility in WisKey already) |
| `ticket_contacts` row, `kind = 'person'` (incl. `employee = 1`, incl. `vendor_id` set) | external handlers, vendor technicians, employees without an account | yes - the main use of this CR |
| `ticket_contacts` row, `kind = 'vendor'` | a company | **never** - a company cannot hold a credential; its persons can |

A contact with `user_id` set is the directory row of an internal user: the link is made on the `users` anchor, never twice.

### 2.2 The link table (D, provisional migration number = next free at merge)

Decision **D1**: a new sibling table `access_person_links`, not a widened `identity_links`. Reasons: `identity_links` is a
two-login-identity relation with a foreign key to `users` and a unique `local_user_id`; it is part of the USR2 security surface
(backup allow-list, directory-sync exemption). A WisKey person is not a login identity and a contact is not a user. The NEW table
copies `identity_links`' rules verbatim: manual link only, no authority union, disabling one side suggests (never forces) the other
side - except the external-grant revocations of section 3.6, which are the point of this CR. (Owner question 1.)

```sql
CREATE TABLE access_person_links (
  id                 TEXT PRIMARY KEY,                 -- uuid4 hex
  subject_kind       TEXT NOT NULL CHECK (subject_kind IN ('user', 'contact')),
  subject_id         TEXT NOT NULL,                    -- users.id | ticket_contacts.id (kind 'person' only, enforced in code)
  wiskey_person_id   TEXT NOT NULL,                    -- WisKey's opaque person id (<= 128, the routers' Path bound)
  origin             TEXT NOT NULL CHECK (origin IN ('created_from_arx', 'matched')),
  employee_no        TEXT,                             -- the value Arx wrote for a person it created ('x' + 12 hex, opaque); NULL when matched
  linked_by          TEXT NOT NULL,                    -- users.id of the human who linked
  linked_at          TEXT NOT NULL,
  last_pushed_rev    INTEGER,                          -- WisKey revision after Arx's last identity push (drift detection)
  state              TEXT NOT NULL DEFAULT 'linked' CHECK (state IN ('linked', 'unlinking', 'wiskey_missing')),
  revision           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_apl_subject ON access_person_links (subject_kind, subject_id);
CREATE UNIQUE INDEX idx_apl_wiskey  ON access_person_links (wiskey_person_id);
```

One Arx subject ↔ one WisKey person, both directions unique. Ids only: no name, phone, PIN, card or station in the row.

### 2.3 Source of truth (D2 - split by field, never two writers for one field)

| Field group | Source of truth | Direction |
|---|---|---|
| Display name, company, language, phone, e-mail, consent/notice state, active/erased | **Arx** (`ticket_contacts` / `users`) | Arx → WisKey: only `display_name` (truncated to 32), pushed with the WisKey revision (CAS) when it changes; a WisKey-side edit of the name is shown as drift, never pulled back |
| Phone in WisKey | **not copied** (D3, minimisation): Arx delivers every message; WisKey needs no number for an external person. A matched staff person keeps whatever WisKey already holds; Arx does not overwrite it | none |
| `employee_no` for a person Arx created | Arx-generated opaque `x` + 12 hex, never a national id, never a phone | Arx → WisKey once |
| Credentials (PIN, cards), door rules (`door_permissions`, overrides), validity, timing policy, `access_category`, responsible person, purpose, per-station sync state | **WisKey** (the access engine), written only through Arx S11 writes under Arx RBAC | Arx writes; reads come back through `intercom_authority` |
| Grants (who asked, who approved, why, window, doors, state) | **Arx** (`access_grants`, 2.5) | Arx → WisKey projection |

After the absorption (WisKey's person store inside Arx) the same split holds; the link becomes an internal foreign key and section 2
changes in storage only, not in rules. Nothing in this design needs the absorption to be correct; section 9 lists what improves.

### 2.4 Link, match, unlink, delete (D)

- **Create from Arx** ("give door access" on a contact without a link): Arx calls `users/create` with `display_name`,
  generated `employee_no`, `access_category = contractor` (vendor person) or `visitor`, `responsible_person` = the approver's display
  name, `access_purpose` = a fixed text with the ticket / RFQ reference (no free text), `active = false`, no station, no credential.
  The person is inert until a grant (2.5) is provisioned. Needs `access.people.manage` (unrestricted for a person with no station,
  F1) and the external-grant permission (section 3.2).
- **Match an existing WisKey person** (e.g. a regular vendor technician already in WisKey): manual only, by a human holding
  `access.people.manage` on every station of that person AND the right to edit the Arx subject. Never automatic by name or
  phone; a phone-equality hint is shown only at the sensitive level on both sides and only as a hint. Match is audited.
- **Unlink:** removes the row only. Every live grant of the link is revoked first (3.6, reason `unlinked`); the WisKey person stays
  (the facility may still need it) and loses nothing else. Unlinking a `created_from_arx` person offers "also delete in WisKey".
- **Arx subject erased** (tickets 15.2) or **user deleted**: grants revoked; for `created_from_arx`, the WisKey person is
  deleted (`users/delete`, confirmation) after revocation is acknowledged; for `matched`, unlink + a manager notice (suggest, F5 rule).
- **WisKey person deleted elsewhere:** the next read marks the link `wiskey_missing`; live grants become `revoked(wiskey_missing)`;
  nothing is re-created automatically.
- **Merge of two Arx contacts** (duplicates): the surviving contact keeps the link; if both had links, refused until one is unlinked
  (no implicit union of two WisKey records).

### 2.5 Grants (D)

```sql
CREATE TABLE access_grants (
  id                  TEXT PRIMARY KEY,                -- uuid4 hex; appears in audit and in the message's reference
  link_id             TEXT NOT NULL REFERENCES access_person_links(id),
  source_kind         TEXT NOT NULL CHECK (source_kind IN ('manual', 'ticket', 'rfq_order')),
  source_ref          TEXT,                            -- ticket id / award id (ids only)
  doors_json          TEXT NOT NULL,                   -- {station_id: [relay, ...]} - explicit, never "all"
  valid_from          TEXT NOT NULL,                   -- UTC instants; the window is chosen in the installation's IANA zone
  valid_until         TEXT NOT NULL,
  timing_json         TEXT,                            -- optional daily hours: a WisKey timing schedule (F2), validated by intercom_writes.timing_draft
  credential          TEXT NOT NULL CHECK (credential IN ('pin', 'card', 'none')),
  state               TEXT NOT NULL CHECK (state IN ('requested', 'approved', 'provisioning', 'active', 'revoking', 'ended',
                                                     'revoked', 'refused', 'failed', 'unknown')),
  requested_by        TEXT NOT NULL,                   -- users.id, or 'contact:<id>' when the request came from a vendor page
  approved_by         TEXT,
  approved_at         TEXT,
  approval_revision   INTEGER,                         -- permission_revision at approval (re-decision anchor, 3.6)
  wiskey_revision     INTEGER,                         -- WisKey person revision after provisioning
  code_state          TEXT CHECK (code_state IN ('not_needed', 'pending', 'queued', 'sent', 'not_delivered', 'unknown')),
  code_sends          INTEGER NOT NULL DEFAULT 0,
  end_reason          TEXT,                            -- closed enum, section 3.6
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  revision            INTEGER NOT NULL DEFAULT 1,
  CHECK (valid_until > valid_from)
);
CREATE UNIQUE INDEX idx_grants_one_live ON access_grants (link_id)
  WHERE state IN ('requested', 'approved', 'provisioning', 'active', 'revoking', 'unknown');
```

**D4: one live grant per person.** A WisKey person has ONE validity window and one door map; two overlapping grants would have to be
unioned into a wider record than either approval. A second request for the same person amends the live one (a narrowing applies at
once; a widening of doors, dates or hours returns it to `requested` for a new approval).

Never in any table: the PIN, its hash, its length, a card number or mask, a phone number (the contact row holds the phone already).

### 2.6 Privacy, notice and consent for external people (D)

- **Legal frame:** the Israeli Protection of Privacy Law (incl. Amendment 13, in force since August 2025) and, where it applies, the
  GDPR. This CR does not give legal advice; the owner (controller) confirms the notice text and the retention with counsel.
- **Purpose limitation:** the link and the grant exist to let a named person enter named doors for a named job. No other use.
- **Data minimisation in WisKey:** display name, opaque `employee_no`, category, responsible person, fixed purpose text, door map,
  validity, timing, the credential. No phone, no photo, no national id, no e-mail.
- **Notice before the first code:** the vendor page's arrival step (section 5) shows a short fixed notice (entry events with name,
  time and door are recorded; where entry pictures are enabled, a still is kept; retention; who to ask) and records the
  acknowledgement (`grant.notice_ack`, time + text version). For a manual grant without a page, the approver ticks "the person was
  told" (recorded) and the first code message starts with one notice line. (Owner question 9.)
- **Retention:** grant rows 12 months after their end (ids only), then deleted; a `created_from_arx` WisKey person is deleted 30 days
  after the last grant ended unless a manager marks the contact "regular vendor" (owner question 10); WisKey's own event retention
  applies to entry events (W?).
- **Rights:** the existing contact export (`GET /tickets/contacts/{id}/export`) gains the person's grants (window, doors by name,
  state); erase follows 2.4.

### 2.7 Audit (ids only)

New actions: `access.person_link.create|match|unlink|missing`, `access.grant.request|approve|refuse|amend|provision|activate|end|
revoke|fail|unknown`, `access.grant.code_queued|code_sent|code_not_delivered|code_rotated`, `access.grant.notice_ack`. Details: grant
id, link id, WisKey person id, station ids (no relay map - D06 rule), window, source ref, reason codes, `approval_revision`, the 12-hex
code-job id. **Never** a code, its hash or length, a phone number, a message text, a name typed by a vendor, a card value.

## 3. Permission model

### 3.1 Principles

1. **Arx RBAC is the only authority** (AUTH01). WisKey executes; it never decides who may enter for an Arx-originated grant.
2. **A link transfers no authority** in either direction: a WisKey credential gives no Arx permission; an Arx role gives no door
   credential (USR2 §1a.7 rule, applied here).
3. **No automatic grant.** Every grant is approved by a human in an interactive session (bearer-token clients refused, the PG
   pattern). An RFQ confirmation, a ticket state, a schedule or a rule can only create a `requested` grant.
4. **External people are never Arx identities.** A vendor gets no Arx sign-in, no local identity, no HA account (CLAUDE.md: Claude
   never creates accounts; the product neither).

### 3.2 Who may do what

| Action | Required (all decided by `rbac.authorize`, deny-overrides, station chain of CR-033) |
|---|---|
| Request a grant for a contact (manual) | `tickets.manage` + `tickets.external` on the ticket's place (or the contact's department), **or** the approver's permissions below |
| Request from a vendor page (section 5) | the handler link itself (synthetic principal `contact:<id>`, holds no permission) - creates `requested` only |
| **Approve / amend-widen / issue a code** | new sensitive permission **`access.external.grant`** (D5) on EVERY station of the grant **and** `access.people.manage` + `access.people.sensitive` on every station of the person **and**, for `credential = pin`, `access.pin.generate`; interactive human session; a confirmation dialog that names the person, every door, the dates and hours and the delivery target (`····NN`) |
| Revoke / narrow | any holder of `access.external.grant` OR `access.people.manage` on one station of the grant (revoking must be easy: the narrowest right suffices) |
| Read grants | `access.people.read` on the stations (names level); the delivery state at the sensitive level |

**D5:** `access.external.grant` is new because the approval crosses two modules (a ticket manager is not necessarily trusted with
doors) and because the owner wants door grants to stay a deliberate, rare power. Built-in holder: `system_admin` only; grantable per
user through a custom role or the per-user grant pattern (tickets D25), never delegable by a non-system administrator; it never
admits a USR2 local identity to approve unless the owner enables it (it is sensitive, not administrative; owner question 2). This
keeps the closed rule "door matters stay with the owner" true by default: until the owner hands the permission to someone, only
the owner approves.

### 3.3 Grants are time-bounded; windows and emergency are OFF

- Every external grant has `valid_from` and `valid_until` (no permanent grant to an external person through this flow; a
  "permanent" regular vendor is a series of grants or a staff record managed in the people screen, owner question 8). Maximum length
  `access.external.max_days` (default 14, range 1-90). Optional daily hours use the person's **timing policy** (F2).
- WisKey writes `valid_from`/`valid_until` into the person record so the credential expires **in WisKey and, where the device
  supports it, on the device** even if Arx is down or rolled back (D6). Whether WisKey pushes the validity to each device
  (`native`) or enforces it itself (`ha` mode, rolling window) is **W?** and is the first WisKey question (section 10).
- **Windows OFF means:** no door is ever held open for a vendor; the vendor opens only with his own credential at the keypad /
  reader; Arx never schedules an unlock for him; "arrival" never triggers a door. A staff member may still open a door remotely
  through the existing door rule (F11), action by action - unchanged.
- **Emergency OFF means:** nothing here interacts with it; when emergency is released it stays a personal permission for named
  users and external grants are never eligible. Reserved trigger: emergency activation revokes or suspends nothing by default
  (owner decides then); the hook name `emergency` is reserved as in the lease CR (T10).

### 3.4 Interaction with the capture lease (cards)

A card for a vendor (`credential = card`) needs a physical card read: through the classic capture path (shipped) or the lease route
(OFF). This CR adds nothing to the lease: its rules (120 s, revoke-all on any revision bump, heartbeat) are unchanged; a grant
change on a person with a live capture lease is a lease trigger T12 `person_changed`. Phase X3 ships PIN only; cards wait (section 8).

### 3.5 Re-decision on permission change (D7 - differs from the lease on purpose)

A lease lives ≤120 s and is revoked on every revision bump. A grant lives days; revoking every vendor's access whenever anyone edits
any binding would be unusable. Rule: on a `permission_revision` bump, every live grant is **re-decided** against its approver's
CURRENT permissions on every station of the grant (and the approver being active). If the decision fails, the grant is revoked
(`approver_lost_authority`) and the managers are told; if it holds, `approval_revision` moves. Fail closed: an error while
re-deciding is a revoke. (Owner question 5; the lease's revoke-all rule is not touched.)

### 3.6 Revocation triggers

| # | Trigger | Effect | `end_reason` |
|---|---|---|---|
| R1 | `valid_until` reached | WisKey validity ends it (D6); Arx's janitor ALSO removes the PIN (`pin: null`), clears `door_permissions`, sets `active = false` (F3: `temporary_cancel` alone keeps the credential, so it is not enough) | `ended` |
| R2 | Manual revoke | as R1, immediately | `manual` |
| R3 | Contact deactivated (`active = 0`), erased, phone changed (the code went to the old number) | revoke; phone change also forces a new code on any new grant | `contact_inactive` / `contact_erased` / `contact_changed` |
| R4 | **Vendor deactivated** (the company row `active = 0`) or erased | revoke every live grant of every person whose `vendor_id` is that vendor | `vendor_inactive` |
| R5 | Ticket of the grant closed / cancelled / reassigned / returned (`not_mine`, `cannot_handle`) | revoke (with done: owner question 6) | `ticket_ended` / `ticket_reassigned` |
| R6 | RFQ cancelled, award revoked, order withdrawn | revoke | `rfq_ended` |
| R7 | Permission re-decision fails (3.5); approver disabled / removed | revoke | `approver_lost_authority` |
| R8 | Link unlinked / WisKey person missing | revoke | `unlinked` / `wiskey_missing` |
| R9 | Station removed from the overview or moved out of the approver's chain (CR-033 placement revision) | narrow the grant to the remaining stations; revoke if none | `station_changed` |
| R10 | Feature switch `access.external_grants` turned off | no new requests/approvals; existing grants keep being enforced to their end; a separate "revoke all external access" action (confirmation word, system administrator) | `feature_off` (only with that action) |
| R11 | Emergency (when released) | reserved, no effect until the owner decides | `emergency` |

Revocation is **at-least-once**: a revoke that WisKey did not acknowledge stays `revoking` (shown as "pending"), is retried with a fresh
read + CAS (it removes authority and causes no effect in the world - the lease CR 8.1 reasoning), and alerts managers after 2
minutes. A grant is never re-activated by a retry; activation is never retried blindly (section 7).

## 4. Credential and code issuance

### 4.1 Personal code (PIN) - the default credential

1. **Issue** only after approval and only for `state = provisioning`. Arx calls `users/pin_generate` for the linked person, then
   `users/update` with the PIN, `door_permissions`, validity, timing and `active = true` in ONE command (CAS on the revision read in
   the same flow). `intercom_pin_conflict` (the PIN was taken meanwhile, F4) → generate again, at most 3 times, then `failed`.
2. **Who sees the code:** nobody in Arx. The approver's dialog never displays it (D8). The value exists only in the provisioning
   job's memory and the in-memory sender's queue (the USR2-P2 `Sender` pattern: no outbox row, no database row, no log, no audit,
   no exception text; the job object is wiped after send or failure). A process restart loses it - by design (4.4).
3. **Single person binding:** the PIN belongs to one WisKey person record, i.e. one linked contact; it is never shared between the
   persons of a vendor and never issued to the company row. Every entry is logged in WisKey under that person.
4. **No reuse:** a "resend" is a **rotation** (new PIN, old one replaced in the same write); Arx cannot resend a code it does not
   have. On grant end the PIN is removed (R1). A PIN quarantine (WisKey not handing a freed PIN to someone else for N days) is a
   WisKey capability - **W?** (section 10); until it exists, the residual is recorded (threat T2).
5. **Code length / format:** WisKey's 6 digits (F4). Not a setting in Arx.

### 4.2 Delivery channel rules (reusing tickets D6 and USR2-P2)

- **WhatsApp only, to the contact's verified number.** "Verified" = `phone_confirmed_via IN ('user', 'code')` (never the manager's
  mark - USR2-P2 rule) and confirmed within `access.external.phone_fresh_days` (default 180; older → the person must confirm again by
  the existing code flow before a code is issued; threat T3). No e-mail for access codes (corporate mail scanners log content;
  tickets 10.2 residual).
- **Never in the same message as a link, never on any page a link opens**, never in the RFQ/order/handler message: a separate,
  fixed, code-owned template (he / en / ar / ru by the contact's language; ar and ru need a native review), with: organisation
  name, the code, the door names (owner question 11), the dates and daily hours in the installation's time zone, "this code is
  personal - do not pass it on", the grant's short reference. No link, no username, no ticket text, never editable, never held by
  send hours.
- **Channel separation from the link (D6 reuse):** if the handler / RFQ link went by e-mail, the code goes by WhatsApp (the only
  code channel anyway). If the link went by WhatsApp, the code is a separate WhatsApp message on the `access.codes` account use
  (new, inherits `tickets.codes`), so forwarding the link message never carries the code. If no WhatsApp channel is available:
  the grant shows `not_delivered` and the approver's options are "rotate later" or "deliver in person", where the code is shown
  ONCE on the approver's screen (`no-store`) only if the owner allows it (owner question 3).
- **When it is sent:** not at approval but at `valid_from - access.external.code_lead_hours` (default: 18:00 local on the day before,
  or at once when the start is nearer) - a shorter exposure of a valid code (owner question 4). The PIN is valid on the door from
  `valid_from` regardless.
- **Caps:** per grant 3 sends in total (initial + 2 rotations); per number 3 per day; per installation 50 per day; 1 per 60 s per
  grant; shared pacing ledger (`code` kind).
- **Expiry:** the code's validity is the grant's window (WisKey validity), never longer; rotation or end kills it.

### 4.3 Attempts

Keypad attempt limits are the device's / WisKey's (W?). Arx adds: when WisKey's event feed reports denied credential attempts at a
station, N (default 10) within 10 minutes → a managers' notification (content-free); this depends on whether WisKey reports denied
PIN attempts without a person (W?). A PIN space of 10^6 with ~hundreds of valid PINs makes keypad guessing a real residual
(threat T6); short validity and removal at the end are the main mitigation.

### 4.4 Restart and failure of the code path

A code not sent before a restart is never sent (Arx no longer has it): `code_state = not_delivered`, the grant stays active (the
PIN works for nobody who does not know it), managers see "code not delivered - rotate". An unknown WhatsApp outcome is `unknown`,
never re-sent; rotation is the only path.

### 4.5 Cards

`credential = card`: the approver attaches a card through the existing card write (`cards/add`, masked) or a capture (classic path;
lease OFF). Card removal at grant end is part of R1. Phase X5 (section 8), not the first delivery.

## 5. RFQ integration (award → arrival → request → approval → message)

```
award approved (rfq.py)           -> order created (rfq_orders.create: ticket + external assignment, work_from/work_to)
order sent (manual click)          -> vendor opens the handler link
vendor: "who arrives, when"        -> POST /t/api/arrival  {person, dates, hours, notice_ack, client_request_id}
                                   -> ticket timeline row + managers' notification "access request" (content-free)
                                   -> access_grants row state = requested (doors suggested from the ticket's place)
approver (access.external.grant)   -> reviews person, doors, dates, hours -> approve | amend | refuse
provisioning                       -> link/create WisKey person (2.4), users/pin_generate + users/update (4.1)
code message                       -> at valid_from - lead, WhatsApp, separate fixed template, no link (4.2)
work done / ticket closed          -> revoke (R5), PIN removed
```

- **New public step** on the handler link page (public app, tickets 10.3 rules: rate limits, uniform 404, strict JSON,
  `client_request_id`, text hygiene): `POST /t/api/arrival`. Shown only when the assignment's ticket came from an RFQ order or
  the manager ticked "access needed" on the assignment, and the module setting `access.external_grants` is on.
- **Who arrives** (D9): the vendor picks one of his persons already in the directory (by first name + `····NN`, only those under
  his `vendor_id`) or adds a technician (name + phone). An added technician becomes a **pending** contact (not usable until a manager
  accepts it) and must confirm his own number with the existing code (`phone_confirmed_via = 'code'`), because the code will go to
  that number. The vendor company itself never receives a code. (Owner question 7.)
- **When:** dates within the order's `work_from`/`work_to` (a date outside it is allowed only as a request flagged "outside the
  agreed window"); daily hours from a fixed list; the total within `access.external.max_days`.
- **Doors suggested** from the ticket's place: the stations whose CR-033 placement is on the ticket's floor / building, plus the
  building's entrance stations marked in Settings as "entrance for external people" (new per-station flag). The approver may only
  narrow or pick within his own chain; never "all stations"; at most `access.external.max_doors` (default 4).
- **Approval** (interactive): one dialog, exact text preview of the code message without the code ("ישלח ב-… ל-····NN"); approve
  sends nothing at once - consistent with the RFQ rule "approvals never send automatically": the send is the scheduled result of a
  human approval whose message was previewed (recorded in 12.3).
- **Changes:** the vendor changes the date → a narrowing inside the approved window applies at once; anything wider → `requested`
  again. The manager cancels the order / reassigns → R5/R6.
- **Forwarded links:** a forwarded handler link can at most create a request naming a person; the code still goes only to that
  person's verified number after a human approval. Option B (`require_code`) on the link is therefore not required for the arrival
  step, but a department may require it.

## 6. Threat model

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | **Borrowed code** - the vendor gives his code to a colleague / subcontractor | personal-code wording; single person binding (entries logged under his name); short window and hours; removal at the end; entry stills where enabled; a grant names one person (D4) | a PIN identifies knowledge, not a person: accepted, stated in the guide; cards (X5) or a two-factor reader are the stronger options |
| T2 | **Code reuse** - a freed PIN reissued to someone else while the old holder still remembers it | PIN removed on end (R1), so the old holder's record no longer has it; rotation replaces | the new holder's PIN may equal a PIN someone used last week → needs WisKey quarantine (W?, section 10) |
| T3 | **Number reuse** - a phone number recycled by the carrier, or a contact's number edited to an attacker's | code only to a number confirmed by the person (`user`/`code`), fresh within 180 days; a phone change revokes live grants and kills pending codes (R3; tickets 15.2 already revokes links) | an old confirmed number recycled inside 180 days: lower the freshness for high-risk doors |
| T4 | **Over-broad doors** | explicit station + relay map; suggestion from the ticket's place; approver limited to his own chain; max doors; no groups (`group_ids` not writable, F2); one live grant per person; a widening needs a new approval | an approver with wide scope can still approve many doors - audited, reported weekly in the managers' digest (proposal) |
| T5 | **Time-window abuse** - a vendor confirms a long window, or keeps access after the job | max days; daily hours via the timing policy; revoke on ticket done (R5); janitor end; re-approval on widening | hours enforcement depends on WisKey's timing mode (W?) |
| T6 | **Keypad guessing** | short validity; PIN removed at end; denied-attempt alert (4.3) | device lockout policy unknown (W?) |
| T7 | **Offline doors** - a station offline at revoke time keeps the PIN | validity written to WisKey (and to the device where native, D6) so expiry happens offline; per-station sync state shown on the grant; revoke on an offline station shows "pending on station X" and alerts | an EARLY revoke cannot reach an offline device until it reconnects: stated in the revoke dialog |
| T8 | **Forged arrival / request flooding** from a public page | request only, never a grant; rate limits of the public app; one live request per assignment; uniform answers | managers' attention cost |
| T9 | **Insider grant** - a manager grants himself or a friend | `access.external.grant` system_admin-only by default; grants to `users` anchors are not external grants (they are people-screen edits, existing rules); audit and digest | accepted for system administrators |
| T10 | **Code leak in logs / backups** | in-memory sender, no outbox row, no table, audit without value/hash/length, exception scrubbing (tests scan raw DB files, WAL and logs for a sentinel PIN, the USR2-P2B test pattern) | none known |
| T11 | **Stale authority** - approver lost rights after approval | re-decision on every revision bump (3.5) | between the bump and the re-decision (seconds) |
| T12 | **WisKey-side edit bypassing Arx** (someone edits the person in WisKey's own panel) | drift detection by `last_pushed_rev`; the grant shows "changed outside Arx"; Arx never silently re-applies; managers notified | WisKey's own panel remains a second door to the data until the absorption (section 9) |

## 7. Failure modes and rollback

| # | Failure | Rule |
|---|---|---|
| E1 | WisKey unreachable at approval | grant stays `approved`; provisioning is attempted when the operator presses "provision now" or by the scheduler once at most every 5 minutes for 1 hour - a configuration write with CAS, not a physical command; after that `failed` and a manager notice |
| E2 | Outcome unknown (`intercom_outcome_unknown`, 504) | `unknown`; no blind retry; the next step is a fresh read: if the person shows the grant's door map and validity, `active`; otherwise `failed`. A PIN whose write is unknown is never sent (the code job is dropped) |
| E3 | `intercom_revision_conflict` (someone edited the person) | re-read, re-check the door map is still the approved one, apply once more; a second conflict → `failed`, manager notice |
| E4 | Message not delivered / unknown | 4.4 |
| E5 | Revoke not acknowledged | at-least-once revoke (3.6), alert after 2 min; validity end is the backstop |
| E6 | Station offline / sync error | grant `active` with per-station state; offline station listed; revoke shows "pending on station" |
| E7 | Clock | instants in UTC, windows chosen in the installation's IANA zone (AGENTS.md); device clock drift is WisKey's evidence, shown, never corrected by Arx |
| E8 | Arx restart | grants are rows - nothing lost; pending code jobs lost (4.4); the janitor resumes ends and revokes on start |

**Rollback:** switch `access.external_grants` off (no new requests/approvals; existing grants still ended by the janitor and by
WisKey validity). Code rollback to a version without this CR: the two tables are additive and ignored; already provisioned WisKey
persons keep their validity and expire on their own (D6) - the reason validity must live in WisKey and not only in Arx. Their PINs
are not removed by the old code: the rollback note tells the manager to run "end all external grants" before downgrading, or to
remove them in the people screen.

## 8. Phased delivery (agent-hours, design estimates, not measured; Opus for every security-sensitive slice)

| Phase | Content | Needs | Hours |
|---|---|---|---|
| X0 | This CR; owner answers; WisKey questions (section 10) forwarded by the owner | - | done |
| X1 | `access_person_links` + link / match / unlink / create-from-Arx (inert WisKey person) in the contact and people screens; drift view; audit; fakes only | S11 writes (shipped), switch `access.external_grants` default off | 8 |
| X2 | `access_grants`, manual grant request / approve / amend / revoke, permission `access.external.grant`, re-decision hook on `bump_permission_revision`, triggers R1-R10, janitor, provisioning through S11 (`door_permissions`, validity, timing, `active`) - credential `none` | X1; WisKey answer on validity enforcement (Q-W1) | 14 |
| X3 | PIN issuance and delivery: `pin_generate` + update, in-memory sender, `access.codes` account use, fixed templates he/en (ar/ru after native review), caps, freshness, rotation, leak-scan tests | X2; verified numbers (2.6.3 `phone_confirmed_via`); WisKey PIN semantics (Q-W2, Q-W3) | 10 |
| X4 | RFQ arrival step on the handler page, "who arrives", pending technician + number confirmation, requested grant with suggested doors, entrance flag per station, notifications, notice acknowledgement | X2, X3; order flow (shipped) | 10 |
| X5 | Cards for regular vendors (card write; capture only when the lease route is released) | lease route released by the owner (OFF today) | 6 |
| X6 | Gate on fakes, second Opus security pass over X1-X4, bilingual release notes, `management/tasks.json` + `test_catalog.json` + `python scripts/project_status.py --write` | - | 5 |
| | **Total** | | **53** (X1-X4 + X6 = 47 without cards) |

Order: X1 → X2 → X3 → X4 → X6; X5 independent and gated on the lease. **Switch-on on the real installation** = a separate owner
approval after the gate, and the first real code provisioned on a real door is done by the lead with the owner, action by action
(closed decision); sub-agents never touch a real WisKey, door or phone.

### 8.1 What must wait for the WisKey absorption (or for a WisKey change)

- A guarantee that validity reaches every device (offline expiry, T7) - WisKey/device capability.
- PIN quarantine and keypad lockout (T2, T6).
- Closing the "second door" of WisKey's own panel (T12): only the absorption makes Arx the only editor.
- A single person store (the link becomes a foreign key; no drift).
- Denied-attempt events without a person (4.3).
Everything in X1-X4 works before the absorption with WisKey as a separate engine; these items only make it stronger.

## 9. Dependencies on open WisKey decisions (W?)

| # | Needed | By | Status |
|---|---|---|---|
| W-a | Validity (`valid_from`/`valid_until`) and timing: enforced by WisKey (`ha` rolling window) or written to the device (`native`)? Per device model? | X2, D6, T7 | open (W?) |
| W-b | `users/pin_generate` uniqueness scope (installation / station) and a quarantine for freed PINs | X3, T2 | open |
| W-c | Device keypad attempt lockout; denied-attempt events in the feed | 4.3, T6 | open |
| W-d | `guest_responsible_required` / category rules for `contractor` created with `active = false` and no station | X1 | read in Arx validation (V); WisKey behaviour W? |
| W-e | W2 full schemas for `users/*` (shipped writes rely on the current shapes) | X1-X3 | open (stage-1 dependency) |
| W-f | W11 WhatsApp - **not needed** by this design (Arx delivers through its own account); recorded so nobody waits for it | - | n/a |
| W-g | Generalized W1 / trusted-caller for people writes (today S11 writes go over the service channel) - if WisKey moves writes to the signed path, grants follow it | later | open |
| W-h | Windows (W13) and emergency - OFF; this design depends on neither | - | closed OFF |

## 10. Questions for WisKey (to be forwarded by the owner, one message)

1. (W-a) For a person with `valid_from`/`valid_until`, does the credential stop working on the device when the device is offline at
   `valid_until`? Per supported device model.
2. (W-b) Is a PIN from `users/pin_generate` unique across the installation? Can WisKey keep a freed PIN out of the pool for N days?
3. (W-c) Does the event feed report a denied credential at a station when no person matched?
4. (W-d) Is a `contractor` created `active = false`, with no station and no credential, accepted and inert?

## 11. Owner questions (בעברית; ההמלצה מסומנת *)

1. **איך מקשרים אדם ב-Arx לאדם ב-WisKey:**
   א. טבלת קישור חדשה נפרדת, באותם כללים כמו קישור הזהויות הקיים (ידני, בלי איחוד הרשאות) * · ב. להרחיב את טבלת קישור הזהויות הקיימת
2. **מי רשאי לאשר גישת דלתות לאדם חיצוני:**
   א. הרשאה חדשה ונפרדת, שבהתחלה רק לך (מנהל המערכת), ואפשר לתת אותה למשתמש מסוים * · ב. מי שכבר מנהל את האנשים בתחנות האלה · ג. רק מנהל מערכת, בלי אפשרות להעביר
3. **איך הקוד מגיע לספק:**
   א. רק בוואטסאפ למספר שאומת, בהודעה נפרדת בלי קישור; אף אחד ב-Arx לא רואה את הקוד * · ב. כמו א, ובנוסף כשאין וואטסאפ - המאשר רואה את הקוד פעם אחת כדי למסור ביד · ג. גם במייל
4. **מתי נשלח הקוד:**
   א. מיד באישור · ב. בערב שלפני יום ההגעה (או מיד אם ההגעה קרובה) * · ג. בבוקר יום ההגעה
5. **מה קורה לגישות פעילות כשמשתנות הרשאות במערכת:**
   א. בדיקה חוזרת של המאשר, וביטול רק אם הוא כבר לא מורשה * · ב. ביטול כל הגישות (כמו בקריאת כרטיס) · ג. בלי בדיקה
6. **מתי נגמרת הגישה כשהעבודה סומנה "בוצע":**
   א. מיד * · ב. בסוף אותו יום · ג. רק בסוף החלון שאושר
7. **מי מקבל את הקוד כשהספק שולח טכנאי:**
   א. הספק בוחר טכנאי מהרשימה או מוסיף חדש; טכנאי חדש מאושר על ידי מנהל ומאמת את המספר שלו * · ב. רק אנשי קשר שמנהל כבר יצר · ג. קוד אחד לחברה (לא מומלץ)
8. **אורך מרבי של גישה זמנית לספק:**
   א. 14 יום * · ב. 30 יום · ג. 90 יום
9. **הודעת פרטיות לספק לפני הקוד:**
   א. הודעה קצרה בעמוד אישור ההגעה + שורה בהודעת הקוד, והאישור נשמר * · ב. טופס הסכמה חתום · ג. בלי
10. **מה נשמר ב-WisKey אחרי שהגישה נגמרה:**
    א. האדם נמחק אחרי 30 יום, אלא אם סומן "ספק קבוע" * · ב. נשאר עד מחיקה ידנית · ג. נמחק מיד
11. **מה כתוב בהודעת הקוד:**
    א. שמות הדלתות, התאריכים והשעות * · ב. רק "הדלתות שאושרו לך", בלי שמות
12. **כמה גישות פעילות בו-זמנית לאותו אדם:**
    א. אחת; שינוי מרחיב דורש אישור חדש * · ב. כמה, ו-Arx מאחדת

## 12. Contradictions and risks recorded (not resolved)

1. **Messaging credential guard (owner answers 9-10, 2026-10-12) vs. a message that carries a PIN.** The guard forbids a sender from
   typing a credential and a template from holding one. The access-code message is a different path: a fixed, code-owned template
   whose only variable credential is inserted by the system after an approval, never typed, never editable. It needs the owner's
   explicit approval (question 3) and must stay outside `intercom_messaging`'s templates.
2. **PG ("the PIN value only to the requesting operator in the response") vs. a PIN sent to the vendor.** Here the value goes to
   the person it belongs to, and to no operator (D8). Same storage rules (never stored / logged / audited / hashed / measured).
   The PG text should be amended by the owner to name this second recipient.
3. **RFQ "an award never sends anything automatically" vs. a scheduled code message.** The send follows a human approval whose
   message was previewed; nothing is sent by the award, the order or the arrival step. Recorded as consistent; the owner may prefer
   an explicit "send now" click (question 4 option א is closest).
4. **USR2 §1a.7 "disabling one only suggests" vs. R3/R4 automatic revocation.** The suggestion rule stays for the identity link of
   staff (`users` anchors: suggest only); automatic revocation applies to external grants made by this flow, which the owner asked
   for ("vendor deactivation revokes access").
5. **Re-decision (3.5) vs. the lease's revoke-all.** Different objects with different lifetimes; the lease rule is not changed.
6. **AGENTS.md "never queue or blindly retry physical commands".** Provisioning is a configuration write retried only with a fresh
   read and CAS (E1-E3), never blindly; revocation retries remove authority only. No door is ever opened by this design.
7. **`HA_IDENTITY_RBAC_HE.md` "HA is the only human identity source".** External people here are not identities (no sign-in); they
   are directory records that WisKey uses as credential holders. No amendment needed; recorded for the security document's owner.
8. **WisKey's own panel** can still edit linked persons until the absorption (T12) - a second editor outside Arx RBAC, accepted
   for the transition.

## 13. Test plan (negative-first, fakes only; PLANNED_NOT_RUN)

Fakes: `tests/fake_wiskey.py` (people store with revision, PIN generator with injectable conflicts, validity, sync states, offline
station), the tickets public-app harness, a fake WhatsApp transport, a fake clock. Key cases: an RFQ arrival creates only a
`requested` grant and sends nothing; approval without `access.external.grant` on one station refused (403, nothing sent); a
bearer-token approval refused; a widening amendment returns to `requested`; vendor deactivation revokes every person's grant and
removes the PIN; phone change revokes and kills a queued code; a permission bump that removes the approver's station revokes, an
unrelated bump does not; restart drops a queued code and marks `not_delivered`; an unknown provisioning outcome never sends a code;
leak scan (sentinel PIN absent from DB, WAL, logs, audit, exceptions, HTTP answers); unlink revokes first; a forwarded link can
request but the code goes only to the named person's verified number; windows/emergency settings have no effect on any path.
Real-device and real-phone checks are **NOT_RUN** and each needs its own owner approval.
