# 03 - Handling requests from people about their data (access, correction, deletion)

Status: DRAFT operating steps for the organisation's building manager. Not legal advice. Verified against `origin/integ/290` @ `018795f96`
(2026-10-19) and re-verified against `origin/release/2241` @ `f1ef67c68` (version 2.24.1, 2026-10-27). `B/` = `smplwise_vms/backend/smplwise/`.
The notices shown to technicians say that requests go to "the building manager", or to the organisation's privacy contact when the installation
set one (`NOTICE_TEXT` / `notice_text` in `B/services/access_grants.py`); this document is what that person does. Everything about the legal side -
who may ask, what must be answered, deadlines, identity checks, fees, exemptions, what may be refused - is **REQUIRES COUNSEL REVIEW (C11)**; the steps
below only describe what the product can and cannot do today.

**Re-checked 2026-10-29 (LEGAL-PACK-2291) against `origin/main` @ `8bd92456a` (version 2.27.1):** only the changes listed in `legal-pack/CHANGELOG_2026-10-29_HE.md` were made; the rest of the document was spot-checked against the code, not re-read line by line.

## 1. Receive and record

1. Write down: date received, how (phone, mail, in person), the person's name as they gave it, what they ask (see / correct / delete / other).
   Keep this log outside Arx (Arx has no request-log feature). Keep the minimum personal data in the log. **REQUIRES COUNSEL REVIEW (C11)**: how long the log is kept.
2. Confirm who is asking before disclosing or deleting anything. The product has no identity-proofing step. A technician's number in the directory
   was typed by a vendor, so a request from "the technician" can be matched by name and phone, but how strongly to verify is **REQUIRES COUNSEL REVIEW (C11)**.
3. Note the deadline the organisation has decided to work to. **REQUIRES COUNSEL REVIEW (C11)** (the period and its start).

## 2. Find the person's data (checklist)

| Where | How | Who can do it (`02-retention-and-access-summary.md`, section 3) |
|---|---|---|
| Directory row (name, company, phone, e-mail, notes, language, assignments) | directory screen / `GET /tickets/contacts`, `GET /tickets/contacts/{id}` (`B/routers/tickets_contacts.py`) | `tickets.configure` |
| Pending / accepted vendor-added technician | access screen "external" tab; `access_pending_contacts` | `access.external.grant` or `tickets.configure` |
| Door-access grants of the person (doors, dates, state, notice acknowledgements) | included in the directory export (section 3); or `GET /access-grants?all=true` (no per-person filter, `B/routers/access_grants.py`) | `tickets.configure` (export); `access.external.grant` (list) |
| Visitor (name, number, invitations, entries) | the visitor invitations screen; the visitor is a hidden directory row and the invitation, grant and entry rows point to it (`B/services/access_visitors.py`) | the host; holders of `access.visitor.invite`; system administrator. Not verified: whether the directory export works for a visitor row |
| Door-system person (name, category, responsible person, purpose, entries, entry pictures if enabled) | the door system itself (WisKey); Arx keeps only the link `access_person_links` | door-system operator. Retention there **REQUIRES COUNSEL REVIEW (C7)** |
| Tickets and timeline lines the person wrote (note text, photos, link-access log) | the tickets screen; the export below returns the timeline lines | department managers |
| Free text that mentions the person (ticket description, notes, place text, voice-announcement text) | search in the tickets screen; the announcement history (`system.configure`). The export does not cover text written by others | department managers; administrators |
| WhatsApp messages sent to the person | `intercom_messages` keeps the sender, time, template and length, not the text; ticket messages: `ticket_outbox` (90 days) | administrators |
| Audit rows about the person | audit screen; rows carry ids (e.g. `contact:<id>`, `technician_id`), not names | `audit.read` |
| Staff member with a local account | the personal-data export of local accounts (section 3) | the person, or `identity.local.manage` |
| Phone-app presence (staff only) | the user's devices and event log; included in the local-account export | `presence.sensors.view` |
| Emergency contact entry | emergency readiness screen, contacts list | `maintenance.manage` or `emergency.manage` |
| Notice read receipts (staff) | the notice's read list | `notices.manage` |
| Backups | zip files in the add-on data directory, off-box targets, and any copies elsewhere | system administrator / `backup.manage`. Handling of backups **REQUIRES COUNSEL REVIEW (C8)** |

## 3. Access ("what do you hold about me")

1. For a directory person, use the directory export: `GET /tickets/contacts/{id}/export` (`B/services/tickets/contacts.py` `export`; audited as `ticket.contact.export`).
   It returns: the directory row (id, kind, name, company, phone, e-mail, channel, flags, language, notes, active, dates, erased time), department ids,
   assignments (ticket number, dates, end reasons), the timeline lines the person wrote (ticket number, time, kind, status change, text), cost claims and,
   since 2026-10-19, an `access` section: the door-system link (origin, state, date) and every door-access grant still kept (window, doors, state, end reason)
   with its notice acknowledgements (`B/services/access_external.py` `rights_export`).
2. For a staff member with a **local** account, an administrator with `identity.local.manage` (or the person, signed in) can download a personal-data export
   (`GET /identity/local-users/{id}/personal-data`, `GET /auth/local/personal-data`; `B/services/local_privacy.py`), only while `privacy.personal_export` is on (default off).
   It contains the profile, sign-in metadata, role bindings, the linked Home Assistant user, up to 19 lists (including presence events with coordinates; up to 5000
   rows each) and audit rows by and about the person; it excludes password hashes, tokens, keys and other people's data. Audited as `identity.local.user.data_exported`.
   It does not include notice read receipts or emergency-contact entries. Staff who sign in through Home Assistant only have no such export.
3. The exports do **not** include: the door-system record and entry log, free text written by others about the person, message logs, the visitor entry log,
   and, for directory persons, audit rows. Add these by hand from section 2. Whether a manual compilation is acceptable: **REQUIRES COUNSEL REVIEW (C11)**.
4. Do not hand over other people's data (for example the vendor's other technicians, other staff names in notes).
5. Record what was sent and when.

## 4. Correction

1. Edit the directory row (`PATCH /tickets/contacts/{id}`). Changing the phone or e-mail, or setting the row inactive, while the person holds a live handler link
   revokes the link at once and puts the ticket in "waiting for the manager" (`B/services/tickets/contacts.py` docstring). A changed number also clears the
   phone confirmation, so a technician's personal entry code will not be sent until the number is confirmed again (`phone_confirmed_at` check in `access_grants.number_problem`).
2. A name or detail held in the door system is corrected in the door system. Arx has a rename call in its door-system client (`B/services/access_grant_engine.py`); whether any screen uses it for a correction was not checked.
3. Names inside free-text ticket notes are not edited by any product feature; a manager decides case by case. **REQUIRES COUNSEL REVIEW (C11)**.
4. An emergency contact is edited in the emergency readiness screen (`maintenance.manage` or `emergency.manage`).

## 5. Deletion

Decide first whether any legal duty to keep the data exists (financial records, audit, security incidents): **REQUIRES COUNSEL REVIEW (C10, C11)**.
Then, in this order:

1. **Live door access.** If the person has a live grant, revoke it first (access screen, `POST /access-grants/{id}/revoke`). The directory erase and the "needs review"
   delete are refused while a live grant exists. Revocation is confirmed by the door system; the grant can stay in state `revoking` until it is.
2. **Pending technician nobody approved.** Use "reject and delete" (`POST /access-grants/pending-contacts/{id}/reject`): ends open requests, then runs the directory erase. It is
   refused if a door-system link or a decided grant exists. If nobody acts, the product erases such a person by itself after 90 days by default (`access.external.pending_retention_days`).
3. **Any other directory person.** `POST /tickets/contacts/{id}/erase` with the "also from history" option (replaces the frozen name on assignments and timeline rows with the
   tombstone). People idle for 12 months and technicians pending for 30 days are listed in the "needs review" segment (`GET /tickets/contacts-review`, handlers page `seg=review`);
   its "delete now" does the same erase after re-checking the rule. A vendor that still has persons cannot be erased until they are.
4. **A visitor.** The name and number are erased automatically 30 days (default) after the invitation ends. Earlier erasure on request: not verified whether a screen offers it
   for a visitor row. The invitation, grant (12 months) and entry rows stay with ids, door and time.
5. **The person in the door system.** Arx never deletes it as part of the steps above. For a person Arx created, an administrator uses "delete person" (type the confirmation
   word; `POST /access-grants/links/{link_id}/delete-person`) after all grants are revoked. For a person created in the door system, delete in the door system. What the door
   system then does with its entry records is not verified: **REQUIRES COUNSEL REVIEW (C7)**.
6. **Tickets.** If the person's data sits mostly in ticket content, a manager with `tickets.delete` can delete the whole ticket (reason is audited; the audit row holds no content,
   `B/services/tickets/deletion.py`). Cost claims in `approved`/`paid` status block deletion unless the manager also holds `tickets.costs`.
7. **A staff member with a local account.** Disable or delete the account; if `privacy.local_purge` is on, the product purges it after `privacy.local_purge_days` (default and
   minimum 30) - see `02-retention-and-access-summary.md`. Not covered by the purge: audit rows, notice read receipts, an emergency-contact entry linked to the user.
8. **Emergency contact.** Delete the entry in the emergency readiness screen (the row stays as a blanked tombstone).
9. **What remains after these steps (facts):** the directory row as a tombstone; access-grant rows (ids, doors, dates, end reason `contact_erased`) until 12 months after they ended; audit rows
   (365 days by default); cost-claim records (company, amounts, files, 7 years by default); free text written by others (including voice-announcement text, 90 days); visitor invitation and
   entry rows; notice read receipts of a purged account; backups already written (5 pre-upgrade + 7 daily, off-box copies under their own thinning, plus any manual copies);
   WhatsApp-provider and door-system copies. Whether and how to tell the person: **REQUIRES COUNSEL REVIEW (C11)**.

## 6. Reply and close

Reply in the language the person used (the notices exist in he/en/ar/ru). Record the date of the reply and what was done. If the request is refused or only partly met, the reason
and what is told to the person: **REQUIRES COUNSEL REVIEW (C11)**.

## 7. Gaps in the product that affect these steps (for the organisation's information)

- The directory export now covers door-access grants and notice acknowledgements; it still lacks the door-system record, entry logs, message logs and audit rows (section 3).
- The local-account export (off by default) exists only for local accounts and lacks notice read receipts and emergency-contact entries.
- No automatic deletion of accepted directory persons, of door-system persons, of emergency contacts or of closed tickets (`02-retention-and-access-summary.md`, section 1).
- Erase does not touch free text written by others and does not touch backups.
- No request log, no deadline tracking, no identity-proofing step.
