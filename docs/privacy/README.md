# Privacy documents for an organisation using SmplWise Arx / מסמכי פרטיות לארגון המשתמש ב-SmplWise Arx

Status: DRAFT, documents and text only (no product code changed). Not legal advice; nothing here promises compliance with any law. Facts were first verified on
`origin/integ/290` @ `018795f96` (2026-10-19) and **re-verified on `origin/release/2241` @ `f1ef67c68` (version 2.24.1, 2026-10-27) and checked again on `origin/main` @ `8bd92456a` (version 2.27.1, 2026-10-29, LEGAL-PACK-2291)** by reading the code and
migrations; they cite file paths. Every statement that needs a lawyer is marked **REQUIRES COUNSEL REVIEW (Cn)**.
סטטוס: טיוטה, מסמכים וטקסט בלבד (לא שונה קוד מוצר). אין זו חוות דעת משפטית ואין כאן הבטחה לעמידה בדין. העובדות אומתו מחדש מול `origin/release/2241` @ `f1ef67c68` (גרסה 2.24.1, 27.10.2026) ונבדקו שוב מול `origin/main` @ `8bd92456a` (גרסה 2.27.1, 29.10.2026); כל קביעה שדורשת יועץ משפטי מסומנת.

Source of the task: backlog item `privacy-org-documents` (decision 10 of the technician-privacy decisions of 2026-10-18: a database-definition template, a retention policy, an incident-procedure line).
The lawyer-bound analysis stays in the internal legal pack and is not copied here.

## Index / אינדקס

| # | Document | English | עברית |
|---|---|---|---|
| 01 | Data-processing summary: what the product stores, where, who receives it | [en/01](en/01-data-processing-summary.md) | [he/01](he/01-data-processing-summary.md) |
| 02 | Retention and access summary (what is deleted automatically, what is manual, who can see what) | [en/02](en/02-retention-and-access-summary.md) | [he/02](he/02-retention-and-access-summary.md) |
| 03 | Steps for handling people's requests (access, correction, deletion) | [en/03](en/03-data-subject-request-handling.md) | [he/03](he/03-data-subject-request-handling.md) |
| 04 | Organisation privacy notice template | [en/04](en/04-organisation-privacy-notice-template.md) | [he/04](he/04-organisation-privacy-notice-template.md) |
| 05 | Database definition document template + incident-procedure line | [en/05](en/05-database-definition-and-incident-line-template.md) | [he/05](he/05-database-definition-and-incident-line-template.md) |
| 06 | Retention policy template | [en/06](en/06-retention-policy-template.md) | [he/06](he/06-retention-policy-template.md) |

Technician notice, final wording in he / en / ar / ru (pending legal review): [technician-notice-final.md](technician-notice-final.md).

01-03 are factual. 04-06 are templates the organisation fills in and sends to its counsel. The English files are the exact source; the Hebrew files follow them section by section.
Related security material: `docs/security/` (identity and RBAC, dependency and secrets audit, tickets public-surface checklist).

## Counsel-review items / פריטים לבחינת יועץ משפטי

C1-C13 are unchanged from 2026-10-19. C14-C17 were added on 2026-10-27 (C14 widened on 2026-10-29) because the code added features that raise questions C1-C13 do not cover.

| Id | Question (not answered here) | Where marked |
|---|---|---|
| C1 | Roles: who is the database owner / controller / holder, SmplWise as supplier or processor, any supplier access for support | 01, 04, 05 |
| C2 | Notice versus consent for technicians; the vendor (or manager) attesting on the technician's behalf; sufficiency of the n2 notice wording and of "no legal obligation to provide" | 01, 04 |
| C3 | Open-ended retention ("until the organisation deletes it") for directory persons and door-system persons; whether the notice must state a period | 01, 02, 04, 06 |
| C4 | Whether a database definition document / registration / a security level applies; whether the listed measures are adequate | 01, 04, 05 |
| C5 | WhatsApp through an unofficial Home Assistant component, Meta metadata, transfer abroad, platform terms | 01, 04, 05 |
| C6 | Cloudflare tunnel carrying public pages (names and phones typed on them), processing agreement, location of servers | 01, 04, 05 |
| C7 | Door system (WisKey): retention of entry records and entry pictures (not verified), access by an outside maintainer | 01, 02, 03, 05, 06 |
| C8 | Where the host, disk and backups are; backup copies; deletion versus backups | 01, 03, 05, 06 |
| C9 | Staff phone app (location/presence, required-sensors policy, employment-law implications), push relay operator and location | 01, 04 |
| C10 | Mandatory retention (financial 7 years, audit 365 days) versus deletion requests; exceptions | 02, 03, 04, 06 |
| C11 | Requests from people: who may ask, identity checks, deadlines, fees, exemptions, completeness of a manual export, what to tell the person | 02, 03, 05, 06 |
| C12 | Incident duties: whom to notify, thresholds, deadlines | 05 |
| C13 | Camera frames / event pictures and any surveillance-specific duties (video itself is outside Arx) | 01, 04 |
| C14 | Voice announcements: announcement text sent to an outside speech service (the optional cloud engine is fixed to OpenAI; a Home Assistant speech engine may itself be a cloud service), processing agreement, transfer abroad; emergency-announcement text kept in the audit log; (added 2026-10-29) the optional automatic translation of announcements, which sends the Hebrew text to a translation provider (default: the free Google endpoint, no key; or an OpenAI-compatible one) after an approval is recorded | 01, 04, 05 |
| C15 | Partner API: disclosure of ticket text (on by default per token) and, optionally, requester/assignee names to an outside system chosen by the organisation; agreement with that party; whether the default is acceptable | 01, 04, 05 |
| C16 | Visitor invitations: what visitors must be told (the code has no visitor-specific notice; the host's optional "told" tick is stored as the technician notice version `n2`); the visitor's number confirmed through the host; 30-day default erase of name and number while entry rows stay | 01, 02, 04 |
| C17 | Staff visibility features: notice-board read receipts that show managers each reader's name and time (names on by default), and the "who is in the building" list that names staff placed by the phone app (names on by default, self opt-out); employment-law implications | 01, 04 |

## Places where the code does not match an existing notice, brief or decision / אי-התאמות

Re-verified on `origin/release/2241` @ `f1ef67c68` (2026-10-27) and checked again on `origin/main` @ `8bd92456a` (2026-10-29): items 1-11 still hold exactly as written (each was re-opened in the code on 2026-10-29); items 12-14 are new. Items 1-6 are the list of 2026-10-19 with their current state; items 7-11 were added on 2026-10-27.
`B/` = `smplwise_vms/backend/smplwise/`.

1. **OPEN - Closed tickets are never purged automatically.** `purge_after` is written on the ticket (closed + `retention.closed_days`, default 730, clamped 90-3650, on the automatic-close path,
   `B/services/tickets/monitor.py`; a fixed `PURGE_DAYS = 730` when a person closes the ticket, `B/services/tickets/service.py`), but no code deletes tickets when it passes:
   `B/services/tickets/retention.py` says the purge "belongs to the slices that own those tables", and the only `DELETE FROM tickets` (`store.purge_ticket`) is reached from the manual delete routes only.
   `retention.closed_days` is still absent from the settings schema (`B/services/tickets/settings_doc.py`). Any statement of "closed tickets are deleted after N days" would currently be untrue.
2. **RESOLVED WHEN CONFIGURED - Technician notice n2 versus the decisions of 2026-10-18.** Since PRIVORG-291 / PRIVTEXT-293: when the installation sets an organisation name (tickets setting
   `organization_name`) and a privacy contact (`privacy.contact`, optional `privacy.link`), the notice names the organisation and contact instead of "the building manager" (`notice_text`, `NOTICE_CONTACT`),
   the entry-code message starts with the organisation name instead of "SmplWise Arx" (`CODE_MESSAGE_SENDER`), and the phone-verification message to a technician carries the short notice
   (`B/services/tickets/phone_verify.py` `_privacy_variant`, templates `verify_technician*`). **When those settings are empty, the texts are exactly the old ones** (`B/services/privacy_org.py`).
   The vendor-attests model (decision 3) and the four languages (decision 7) are in the code.
3. **RESOLVED - Technician id in the log (decision 4).** The `access.grant.request` row and the approve/amend row now carry `technician_id` (`B/services/access_grants.py`), as do the
   notice-acknowledgement rows. The grant row is deleted 12 months after the grant ends; audit rows stay 365 days by default. (The visitor approve row carries no `technician_id`.)
4. **STILL TRUE, MORE SO - The 2.7.1 legal brief is out of date.** Besides the reject action, the "needs review" report and the four-language notice (already noted on 2026-10-19): the brief's statement
   that the feature cannot be enabled is no longer true (item 7); the contact export now includes access grants and notice acknowledgements (`B/services/tickets/contacts.py` `export` ->
   `B/services/access_external.py` `rights_export`); undecided vendor-typed technicians are now erased automatically after 90 days by default (`B/services/pending_retention.py`). The brief
   (in the internal legal pack) was not edited in this pass.
5. **OPEN - Notice n2 versus the system's own retention behaviour:** n2 says data is kept "until the organisation deletes it, in line with its retention policy". There is still no policy object in the code;
   until an organisation fills document 06 the sentence refers to something that does not exist. Partly narrowed: undecided technicians are now erased automatically (item 4), visitors after 30 days (item 9).
6. **OPEN - Entries and pictures:** the notice says each entry's time and door (and a picture where enabled) are kept. Arx stores no door events of technicians; they live in the door system, whose retention was
   not verified (C7). Arx now stores entry events of visitors (`access_visitor_entries`, ids, door and time only - item 9).
7. **NEW - Technician door access can now be enabled.** `GO_LIVE_PERMITTED = True` in `B/services/access_grants.py` (owner decision 2026-10-21, ECCACT-295). The switch `access.external_grants` stays `off`
   by default and only a system administrator can turn it on (`B/routers/access_grants.py` `put_settings`: `system.configure` plus system administrator). The module docstring at the top of
   `access_grants.py` and the docstrings of `access_cards.py`, `access_grant_engine.py` and `access_station_permissions.py` still say the permit is `False`; the constant is what counts.
   Earlier texts that say "cannot be turned on in this build" (documents 01 and 05 of 2026-10-19, `technician-notice-final.md`, the 2.7.1 brief) were wrong from that date; 01, 05 and the final-notice file are corrected here.
8. **NEW - Presence Wi-Fi matching has two modes.** `presence.wifi_match_mode` default `phone` (the phone decides and no network fingerprint is stored; a hash an older app sends is dropped);
   `server` makes the phone send a salted SHA-256 hash of the network name, which the server matches and stores (`B/services/presence.py`). The employee notice draft (internal) says no hash is
   sent - true only in the default mode. Enabling presence is not refused while the staff notice text `presence.notice_text` is empty (default empty).
9. **NEW - Visitors have no notice of their own.** The visitor invitation (`B/services/access_visitors.py`) reuses the technician grant engine; the host may tick "told", which is stored as an `n2`
   acknowledgement (`access_grant_notices`, via `approver`), but `n2` is the technician text. The code message to the visitor is the technician code message. The visitor's name and number are erased
   `access.visitors.erase_after_days` (default 30) after the invitation ends; the invite, grant and entry rows stay (entry rows have no deletion job). (C16)
10. **NEW - Notice-board read receipts survive account purge.** `notice_reads` (notice id, user id, read time) is not in the local-account purge list (`B/services/local_privacy.py` `DELETE_ROWS`) nor in the
    personal-data export; read marks of a published notice without an end date that is never archived are never swept (`B/services/notices/store.py` `retention_sweep`).
11. **NEW - Emergency contacts have no automatic deletion.** `emergency_contacts` rows (name, role, phone, e-mail, optional user link) are blanked only by a manual delete (`B/services/emergency/service.py`
    `delete_contact`); the user link is not cleared by the local-account purge. (C3)
12. **NEW (2026-10-29) - Announcements can be machine-translated by an outside provider.** `announce.translate.enabled` is `false` by default; turning it on needs an approval recorded with who and when,
    per provider; the default provider is the free Google endpoint (`translate.googleapis.com`, no key), the alternative an OpenAI-compatible endpoint fixed in code. The Hebrew text leaves the building
    for each translation (`B/services/announce_translate.py`). (C14)
13. **NEW (2026-10-29) - Supplier-document reading exists, off by default.** `docread.enabled` is `false`; text-layer PDFs only, no OCR and no model; proposals (short snippets, never the document text) are
    deleted 14 days after the last activity (`B/services/docread/service.py`, mig 0182). A security review gates switching it on in a release (comment in `B/routers/settings.py`). Rows of document 01: S.
14. **UPCOMING, not in `main` (2026-10-29) - building presence.** Anonymous room / building occupancy from sensors the administrator tags, with an optional history (time, room, status; no person), planned for
    2.28.0 on branches `pilot/BUILDING-PRESENCE-2271` and `pilot/PRESENCE-2280` (read only). Off by default, switched on by the system administrator. Per-person presence stays the separate, existing
    phone-app feature (rows G, N). Not described as live anywhere in these documents; row T of document 01.
