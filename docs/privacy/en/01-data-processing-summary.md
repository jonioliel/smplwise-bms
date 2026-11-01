# 01 - Data-processing summary: what SmplWise Arx stores

Status: DRAFT for the organisation and its counsel. Not legal advice and not a statement of legal compliance.
Facts first verified on `origin/integ/290` @ `018795f96` (2026-10-19) and re-verified on `origin/release/2241` @ `f1ef67c68` (version 2.24.1,
2026-10-27) by reading the code and migrations. Paths are relative to the repository root; `B/` below stands for
`smplwise_vms/backend/smplwise/`. Every statement that needs a lawyer is marked **REQUIRES COUNSEL REVIEW** and carries an id
(C1, C2, ...); the full list is in `../README.md`.

**Re-checked 2026-10-29 (LEGAL-PACK-2291) against `origin/main` @ `8bd92456a` (version 2.27.1):** only the changes listed in `legal-pack/CHANGELOG_2026-10-29_HE.md` were made; the rest of the document was spot-checked against the code, not re-read line by line.

## 1. Where the data lives

- SmplWise Arx runs as a Home Assistant add-on on a server at the customer's site. Its database is one local SQLite file,
  `smplwise.db`, in the add-on data directory (`B/config.py`: `data_dir / "smplwise.db"`; the add-on mounts `/data`). Other files
  sit beside it: plan images, ticket photos and invoice files (`<data>/tickets/<ticket id>/`, `B/services/tickets/deletion.py`),
  event thumbnails (`<data>/thumbs`, `B/services/thumbnails.py`) and project backups (`<data>/backups`, `B/services/backup.py`).
- The code contains no feature that copies the database to a SmplWise-operated server. Since 2026-10-19 an administrator can
  configure **off-box backup targets** (an S3-compatible service, an SFTP server or a mounted path) to which the daily backup is copied,
  encrypted (section 4). Parts of the product talk to outside services (section 5). Where the host server, its disk and its off-site
  backups are is a deployment matter this repository does not show: **REQUIRES COUNSEL REVIEW (C8)**.
- Who is the "database owner / controller / holder / processor" for each category (the organisation operating the building,
  SmplWise as the software supplier, others) is a legal question this document does not answer: **REQUIRES COUNSEL REVIEW (C1)**.

## 2. Categories of personal data

"Table" names are SQLite tables; "mig" is the migration file under `B/migrations/` that defines them. Rows K-R were added on 2026-10-27; rows S-T on 2026-10-29; row U on 2026-10-30.

| # | Category | Data subjects | Fields kept (verified) | Table / mig | Switch |
|---|---|---|---|---|---|
| A | Operator accounts | staff who sign in | user id, username, display name, source, optional e-mail, administrator note, first/last seen, disabled/deleted marks, purge mark; password hash (PHC string), sign-in time and masked address, sessions (hashed cookie, masked IP, country, user agent <= 200 chars, device label), first-login/reset links (hash only), passkeys, TOTP, link to the Home Assistant user | `users`, `auth_local_*`, `auth_webauthn_credentials`, `auth_totp*`, `identity_links`, `remote_access_users`, `remote_sign_ins` / mig 0001, 0096, 0098, 0033, 0035, 0147 | always |
| B | Audit log | operators, and `contact:<id>` actors | time, actor user id and username, action, resource type/id, decision, reason, request id, details (ids and counts; see the privacy rule in `B/services/tickets/deletion.py`: no names, phones or content for ticket deletion). Exception: the full text and targets of an **emergency** voice announcement are written to its audit row (`B/services/announcements.py`) | `audit_log` / mig 0001 | always |
| C | Directory of external people | vendors, technicians, contacts, employees (kind `person`, `vendor`); visitors (hidden from the directory, row M) | display name, company, phone (E.164), keyed phone index, e-mail, preferred channel, language, notes, active flag, creator, last assignment, phone-confirmation time and method, department access | `ticket_contacts`, `ticket_contact_departments`, `ticket_phone_verifications` / mig 0080, 0084, 0091, 0111 | `tickets.enabled` |
| D | Tickets | requesters, handlers, vendors, anyone named in free text | title, description, place text, creator id and name, device/place, status history (events with actor name and note text), photos (file path, hash, size, uploader), assignments (frozen assignee name), cost claims and invoice files, quotes/RFQ (vendor, files, messages), outbound/inbound message log (keyed sender index, no number), link access log (time, kind, client key) | `tickets`, `ticket_events`, `ticket_attachments`, `ticket_assignments`, `ticket_cost_*`, `ticket_rfq*`, `ticket_outbox`, `ticket_inbound`, `ticket_link_access` / mig 0079-0117 | `tickets.enabled` |
| E | Technician door access | external technicians sent by vendors | see section 3 | `access_*` / mig 0107, 0108, 0112 | `access.external_grants` (default off; an administrator can turn it on) |
| F | People messaging (WhatsApp from the people screen) | people known to the door system | recipient id (the door system's id), sender user id and name snapshot, template id/label, text length (not the text), outcome, keyed phone hash, station ids; opt-out list; consent-by-link rows (notice version, no number) | `intercom_messages`, `intercom_message_optout`, `intercom_consent*`, `intercom_held_messages` / mig 0076, 0113, 0114 | settings |
| G | Phone-app presence | staff who install the phone app | device name/platform/model/app+OS version, hashed device token, notice-acknowledgement version/time, current presence (inside/outside, site, one latitude/longitude with accuracy), event log (enter/exit/fix/sensor values with coordinates; beacon reports; Wi-Fi reports - see below), push token (opaque relay token), muted categories | `mobile_devices`, `mobile_presence_events`, `mobile_push_messages` / mig 0057 | `presence.enabled`, default OFF (`B/services/presence.py`) |
| H | Camera event pictures | people who appear in camera frames | one JPEG per event grabbed from the NVR recording at event time; event type, camera id, times | files under `<data>/thumbs`, `events` / mig 0003 | events feature |
| I | Notifications | operators | in-app inbox rows, delivery log, browser push subscriptions (endpoint, keys, user agent) | `notifications`, `notification_deliveries`, `push_subscriptions` / mig 0034, 0046 | always |
| J | Backups | all of the above that are exported | see section 4 | `<data>/backups/*.zip`; off-box copies | daily + before upgrade |
| K | Visitor invitations | visitors invited by a signed-in host; the host | visitor: a hidden directory row (name, phone, keyed phone index, language); invitation: host user id, visitor contact id, purpose (guest / meeting / delivery / service / other), token hash, confirmation time, first entry time, entry count, end reason, erase date; entry log: door, station, result and time of each visitor entry read from the door system; one door-access grant per invitation (as in section 3) | `access_visitor_invites`, `access_visitor_entries`, `access_station_visitor_entrance`, `ticket_contacts`, `access_grants` / mig 0180 | `access.visitors`, default off; works only while `access.external_grants` is on (`B/services/access_visitors.py`) |
| L | Voice announcements | staff who announce; anyone named in the free text | who announced (user id, username), text (<= 200 chars) and per-language texts, targets, time; no audio is stored | `announcements` / mig 0067, 0070, 0177, 0178 | `announce.enabled`, default false; cloud engine `announce.cloud_enabled`, default false (`B/services/announcements.py`) |
| M | People counting (occupancy) | none identifiable | a number per area and time, derived from camera events; camera-to-area map with the staff id who set it; no picture, no person | `zone_count_samples`, `zone_count_map` / mig 0149 | `occupancy.enabled`, default off (`B/services/zone_counts.py`) |
| N | "Who is in the building" | staff with the phone app | no new storage: a view over category G that names each placed person by floor/area (names shown by default, `people.show_names`; self-service opt-out); one audit row per view | reads `mobile_presence_events`, `mobile_devices` | `presence.enabled` (`B/services/presence_people.py`) |
| O | Emergency contacts | named emergency contacts (staff or outsiders) | display name, role title, phone, e-mail, optional user link, priority, last verification time and by whom, creator, deletion mark (up to 100 contacts) | `emergency_contacts` / mig 0164 | `emergency_readiness.enabled`, default false (`B/services/emergency/access.py`) |
| P | Notice-board read receipts | staff who read a notice | notice id, user id, read time | `notice_reads` / mig 0165 | `notices.enabled`, default false (`B/services/notices/model.py`) |
| Q | Partner API | ticket requesters and assignees; the partner system | partner clients, tokens (SHA-256 hash and last 4 characters only; last use time, last caller IP address, request count), webhook endpoints (URL and secret sealed with AES-256-GCM), delivery log, links between partner ids and tickets | `partner_*` / mig 0169 | `partner.api`, `partner.webhooks`, default off and **cannot be turned on in this build** (`GO_LIVE_PERMITTED = False` in `B/services/partner/core.py`) |
| R | Access-rights compliance export | people in the door system | nothing stored: a file generated on request listing person id, name, employee number, category, stations, doors, groups, schedule, read from the door system | none | `access.compliance_export`, default off (`B/services/compliance_export.py`) |
| S | Supplier-document reading proposals (maintenance module) | staff who ask for a reading; anyone named in an attached certificate | proposed field values only (each with a scrubbed snippet of at most 80 characters, never the document text), file hash, state, who asked and who decided, purge date; text-layer PDFs only (no OCR, no model) | `doc_extractions` / mig 0182 | `docread.enabled`, default false, needs the maintenance module; drafts are deleted 14 days after their last activity or with their file (`B/services/docread/service.py`, `B/routers/docread.py`) |
| T | Building presence, anonymous - **UPCOMING, not in the current main (planned 2.28.0)** | none identifiable | the presence sensors the administrator tags (entity ids); when history is switched on, one row per change: time, room, status occupied / clear / unknown - no person, phone, picture or sensor id | `presence_building_sensors`, `presence_building_history` / mig 0183, 0195 (branches `pilot/BUILDING-PRESENCE-2271`, `pilot/PRESENCE-2280`, read only here) | master switch off by default, switched on by the system administrator; history days configurable (0 = none); switching off erases the history. Per-person presence is not part of it |
| U | Temperature report by temporary link (added 2026-10-30, TEMPREPORT-2310 review) | system users who receive the WhatsApp report; vendors (TEMPVENDOR); staff named in maintenance windows (only while `report_link_people` is on) | a PDF snapshot of the recipient's units (unit and area names, readings, chart, events), its sha256, recipient id and kind, sender user id, send id, lifetime, download count and first/last download time; never the token (only its sha256), never the phone number. The link travels in the WhatsApp text (the organisation's account, see the WhatsApp row of section 5) and is a bearer link until it expires | `outbound_documents` / mig 0128; audit `infra.temperature.report.document.send` (sender id, recipient id and display name, outcome) | `report_link_users` (users) / `report_attachment` (vendors) and the tickets module's `reports.documents`, all off by default; withdrawing the WhatsApp opt-in or a number change revokes the links sent to that number |

Wi-Fi reports in category G: setting `presence.wifi_match_mode`, default `phone` - the phone decides whether it is on a configured
network and no network fingerprint is stored (a hash sent by an older app is dropped); `server` - the phone sends a salted SHA-256 hash of
the network name, which Arx matches and stores; the network name itself is never stored (`B/services/presence.py`).

Not analysed here: video recordings (they stay on the NVR / Frigate, never in Arx backups - `B/services/backup.py` docstring), the
energy-metering and water-billing modules (customer accounts and bills), maintenance records, temperature, generator and device
telemetry. Whether camera/video surveillance duties apply is **REQUIRES COUNSEL REVIEW (C13)**.

## 3. Technician door access (category E) in detail

The feature lets a vendor tell Arx which technicians will come, and lets an authorised manager approve a time-limited personal
entry code issued in the building's door system ("WisKey"). It is **off** by default (`access.external_grants` default `off`). Since
2026-10-21 (owner decision, `GO_LIVE_PERMITTED = True` in `B/services/access_grants.py`) **a system administrator can turn it on**
(`B/routers/access_grants.py` `put_settings`: permission `system.configure` and system administrator; the change is audited). Every value
below describes what the code does once it is on.

What is stored in Arx:

- The vendor types a name (<= 60 chars after normalisation in `B/services/access_arrival.py`) and a phone number. A technician added
  from the arrival page is saved at once as an inactive directory row (`ticket_contacts.active = 0`) plus a row in
  `access_pending_contacts` (vendor id, assignment id, creator `contact:<id>`, creation time, acceptance/rejection time).
  So the name and phone exist in Arx before any manager has seen them. If no manager decides, the person is erased automatically after
  `access.external.pending_retention_days` (default 90, range 7-365, 0 = off; `B/services/pending_retention.py`); a vendor may hold at most
  `access.external.pending_max_per_vendor` (default 10) undecided technicians.
- The phone number is kept as digits and as a keyed hash (`phone_key`) used for rate limits; the cap ledger `access_code_sends`
  holds the keyed hash, time and outcome, never the number or the code, and is deleted after 2 days.
- The grant (`access_grants`): subject (`contact` id), source (manual / ticket / RFQ order), doors per station, validity window
  (at most 14 days, `MAX_DAYS_CAP`), optional daily hours, code mode (time window, or single entry), state, who requested and approved and when,
  code send state and counters, end reason. Ids only: no name, phone, code or message text.
- The notice acknowledgement (`access_grant_notices`): notice version (`n2`), via (`page` = the vendor ticked, `approver` = the manager ticked
  "the person was told"), who and when. The acknowledgement is by the vendor or manager, not by the technician.
- The link to the door-system person (`access_person_links`): door-system person id, origin, employee number Arx generated
  (`x` + 12 hex), who linked and when.
- Audit rows of the request, approval and notice acknowledgement carry the technician's contact id (`technician_id`).

What is sent to the door system (`B/services/access_grant_engine.py`, `create_payload`): display name (first 32 chars), a random
employee number, category (contractor / visitor), "responsible person" (the approver's name, <= 64 chars), a fixed access purpose
(<= 128 chars), validity, door map and timing; the personal 6-digit code is generated for the person in the door system. The phone
number is **not** sent (`phone` "is simply not sent"). The door system records each entry under the person's name, time and door;
whether it also stores a picture at entry and for how long is decided on the door-system side and was not verified:
**REQUIRES COUNSEL REVIEW (C7)** (and a technical confirmation from the door-system operator).

What is sent to the technician: one WhatsApp message to the number the technician confirmed (confirmation no older than
`access.external.phone_fresh_days`, default 180) with the code, door names, dates/hours and a reference
(`TEMPLATES` in `B/services/access_grants.py`). The message starts with the organisation name when the installation set one
(tickets setting `organization_name`, `B/services/privacy_org.py`); otherwise with the product name ("SmplWise Arx"). The phone-number
confirmation message to a technician carries the short notice (`NOTICE_SHORT`; `B/services/tickets/phone_verify.py` `_privacy_variant`).

What is never stored in Arx: the personal code (not hashed, not its length), in any table, log or error text; an ID number, e-mail or
picture of the technician; message text. The audit rows of this feature carry ids and counts (`_audit` in `B/services/access_grants.py`).

Notice shown (`NOTICE_TEXT`, version `n2`, he/en/ar/ru): says the name and phone number are kept, each entry's time and door (and, where
enabled, a picture), the purposes, that the information is kept "until the organisation deletes it, in line with its retention policy"
(this is why `06-retention-policy-template.md` exists), that providing the details is not legally required but no code can be issued without
them, and that requests go to "the building manager" - or, when the installation set them, to the organisation by name with its privacy
contact and link (`notice_text`, `NOTICE_CONTACT`). Whether this wording is sufficient: **REQUIRES COUNSEL REVIEW (C2, C3)**.

Visitor invitations (category K) use the same grant engine, the same code message and the same door-system payload (category `visitor`).
A visitor has no notice text of their own; the host may tick "told", which is stored as an `n2` acknowledgement
(`B/services/access_visitors.py` `_approve_as_host`). The visitor's number is confirmed by the host typing back the verification code the
visitor received. **REQUIRES COUNSEL REVIEW (C16)**.

## 4. Backups

`B/services/backup.py`: a zip of the "project tables" (settings, sites/buildings/floors, plans, cameras, saved views, notification
settings, energy and water billing accounts and bills, maintenance records, cases, ...) and the access tables (`ACCESS_TABLES`: users, local
credentials, passkeys, groups, bindings, ...), optionally the audit log and events. Password hashes and HMAC keys travel only inside the section
encrypted with the administrator's backup password. The ticket tables (contacts, tickets, access grants) are **not** in `PROJECT_TABLES`; the
code comment says they are "operational data". The tables of rows K, L, O, P and S are not in the backup lists; the partner tables are in
`NEVER_EXPORTED_TABLES`. Automatic backups kept: 5 "pre-upgrade" and 7 "daily" (`KEEP`); manual and uploaded ones are never removed by the code.
A backup taken before a deletion still contains the deleted rows if the deleted rows were in scope; for tickets nothing extra is done
(`B/services/tickets/deletion.py` docstring).

Off-box copies (`B/services/backup_offbox.py`, mig 0136): an administrator with `backup.manage` can add targets (S3-compatible, SFTP, mounted
path); each target is created disabled. Once enabled, the daily backup is copied there, encrypted with AES-256-GCM under a key kept outside the
database (`<data>/keys/offbox_keyring.json`). Copies at a target are thinned by default to the newest 3, 14 daily, 4 weekly and 6 monthly; only
files Arx wrote are removed. Where the zip files and off-box copies are, and who operates the target: **REQUIRES COUNSEL REVIEW (C8)**.

## 5. Recipients and outside services

| Service | What goes there | Evidence | Note |
|---|---|---|---|
| WhatsApp | recipient phone and message text of ticket links, verification codes, people messages, technician and visitor entry codes | `B/services/messaging_accounts.py`, `B/services/tickets/channel_whatsapp.py`, `B/services/access_grants.py` `send_code` | sent through a Home Assistant WhatsApp integration (`ha-whatsapp`, platform `whatsapp`) from the organisation's own WhatsApp account; the existing legal brief records it as an unofficial component. Meta processes message metadata. **REQUIRES COUNSEL REVIEW (C5)** |
| Cloudflare tunnel | traffic of the remote channel and of the public vendor/handler pages (ticket links, vendor portal, RFQ links, arrival page); TLS ends at Cloudflare | `B/remote_channel.py`, `B/config.py`, `B/services/tickets/public_app.py` | names/phones typed on public pages pass through it. **REQUIRES COUNSEL REVIEW (C6)** |
| Door system (WisKey) | person record and grants (section 3), for technicians and visitors | `B/services/access_grant_engine.py` | on-site system; its own retention and any outside maintainer's access are not visible here. **REQUIRES COUNSEL REVIEW (C7)** |
| Push relay (phone app) | an opaque relay token and a generic push; the real title/body is fetched by the app from Arx with its device token (24 h expiry) | mig 0057 comments, `B/config.py` `push_relay_url`, `B/services/mobile_push.py` | relay operator and location not shown in this repository. **REQUIRES COUNSEL REVIEW (C9)** |
| Browser web push | endpoint and keys of the browser's push service | `B/services/push.py` | provided by the user's browser vendor |
| E-mail (SMTP) | notification and ticket e-mails if configured | `B/services/notify_email.py`, `B/services/tickets/channel_email.py` | off unless configured |
| Home Assistant | user identity (Ingress), entities/devices/areas, the WhatsApp integration, and speech for voice announcements (`tts.speak`) | `docs/security/HA_IDENTITY_RBAC_HE.md`, `B/services/announcements.py` | the host administrator can reach data outside Arx's own access control (same document, section 2); the speech engine chosen in Home Assistant may itself be a cloud service. **REQUIRES COUNSEL REVIEW (C14)** |
| Cloud speech engine (OpenAI) | the announcement text | `B/services/announce_engine.py` (`CLOUD_URL` fixed to `api.openai.com`, model `gpt-4o-mini-tts`) | off by default (`announce.cloud_enabled`); the playback step of this engine is not built yet, and whether the text is sent before it fails was not verified. **REQUIRES COUNSEL REVIEW (C14)** |
| Automatic translation of announcements (stage C) | the Hebrew announcement text, to be translated into Arabic / English / Russian | `B/services/announce_translate.py` (`GOOGLE_URL`, host `translate.googleapis.com`, the default provider, no key; or provider `cloud`: an OpenAI-compatible endpoint fixed to `api.openai.com`, model `gpt-4o-mini`, key in the secrets store) | off by default (`announce.translate.enabled`); switching on needs an approval recorded with who and when, per provider; the operator sees and may edit every translation before sending, and the machine-translated mark is stored with the text; at most 20 calls a minute. **REQUIRES COUNSEL REVIEW (C14)** |
| Off-box backup target | encrypted daily backups | `B/services/backup_offbox.py`, `offbox_s3.py`, `offbox_sftp.py` | operator and location chosen by the administrator. **REQUIRES COUNSEL REVIEW (C8)** |
| Partner system | ticket title and description (on by default per token), requester/assignee names (off by default), temperature and elevator data; the partner can create tickets; never phone, e-mail, doors, access, cameras, users or audit | `B/services/partner/core.py` (`PERSONAL_DEFAULTS`, `NEVER_SCOPES`), `reads.py`, `webhooks.py` | cannot be turned on in this build. **REQUIRES COUNSEL REVIEW (C15)** |

## 6. Security measures present in the code (facts, not an assurance)

Role-based access control with scoped permissions (`B/rbac.py`, `docs/security/HA_IDENTITY_RBAC_HE.md`); every write audited;
hashed tokens and sessions; rate limits on codes and links; fixed code-owned message texts; phone numbers never in audit rows or logs
(`B/services/tickets/contacts.py` docstring); public pages answer a uniform 404 on any failure
(`docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md`); encrypted off-box backups (section 4); optional automatic purge of disabled local
accounts and a personal-data export for local accounts (`B/services/local_privacy.py`, both off by default; see document 02);
a password change, or a second-factor rule that forces a code, also ends every phone's device token and push registration of that user (`B/routers/local_identity.py` / `B/services/local_identity.py`, `_end_phone_credentials`; `B/routers/second_factor.py`);
dependency and secrets audit in `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`.
Whether these measures satisfy any legal security standard: **REQUIRES COUNSEL REVIEW (C4)**.
