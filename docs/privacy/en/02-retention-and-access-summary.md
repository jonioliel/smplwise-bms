# 02 - Retention and access summary (tickets, directory, technician data and related records)

Status: DRAFT, factual. Not legal advice. Verified against `origin/integ/290` @ `018795f96` (2026-10-19) and re-verified against `origin/release/2241` @ `f1ef67c68`
(version 2.24.1, 2026-10-27). `B/` = `smplwise_vms/backend/smplwise/`.
"Default" means the value in the code when nobody changed a setting. Items marked **REQUIRES COUNSEL REVIEW** carry an id (C1...) listed in `../README.md`.

**Re-checked 2026-10-29 (LEGAL-PACK-2291) against `origin/main` @ `8bd92456a` (version 2.27.1):** only the changes listed in `legal-pack/CHANGELOG_2026-10-29_HE.md` were made; the rest of the document was spot-checked against the code, not re-read line by line.

## 1. Retention: what the code deletes by itself, and when

| Data | Deleted automatically | Mechanism (file) | Can the organisation change it? |
|---|---|---|---|
| Audit log rows | older than 365 days | `B/main.py` janitor -> `B/audit.py` `prune` | yes, setting `audit.retention_days` (30-3650) - `B/routers/settings.py` |
| Directory person (contact, vendor, accepted technician) | **never automatically**; only an administrator's erase (`contacts.erase`). Exceptions: the two rows below | - | n/a |
| Pending technician added by a vendor, never decided | **erased automatically** after `access.external.pending_retention_days` (default 90, range 7-365, 0 = off): name replaced by the tombstone, phone cleared, links revoked, open request ends as refused; skipped if a door-system link or a decided grant exists. Also listed in the "needs review" report after `directory.review_pending_days` (default 30, range 7-365) | `B/services/pending_retention.py` (hourly, via `B/main.py`) | yes (setting) |
| Visitor (name and number) | **erased automatically** `access.visitors.erase_after_days` (default 30, range 1-365) after the invitation ends (tombstone "visitor (deleted)"); the invitation, grant and entry rows stay (see below) | `B/services/access_visitors.py` `erase_due`, run by the access-grants worker | yes (setting) |
| Visitor invitation rows and visitor entry log (`access_visitor_invites`, `access_visitor_entries`: ids, door, station, result, time) | **no deletion job found**; entry rows go only with their invitation row | mig 0180 | n/a |
| Door-access grant rows (ids, doors, dates; no name), technicians and visitors | 365 days after the grant ended/was refused/failed/revoked | `B/services/access_grants.py` `alert_and_prune`, `RETENTION_DAYS = 365` | no (constant) |
| Code-send cap ledger (keyed number hash, time, outcome) | 2 days | same function | no |
| Idle technician (known for door access, no live grant, no activity) | **not deleted automatically**; appears in the "needs review" report after `directory.review_idle_months` (default 12, range 1-60); a yearly reminder is emitted in January | `B/services/needs_review.py` | yes (setting) |
| Person record in the door system | **never automatically**; manual per-person delete ("delete" typed) after all grants are revoked, only for persons Arx created | `B/services/access_grants.py` `delete_person_now` | n/a |
| Door-system entry records and entry pictures | decided by the door system, **not verified** | n/a | **REQUIRES COUNSEL REVIEW (C7)** |
| Closed tickets | a date `purge_after` is recorded on the ticket (closed + `retention.closed_days`, default 730, bounded 90-3650, when the system closes it - `B/services/tickets/monitor.py`; closed + a fixed 730 days when a person closes it - `B/services/tickets/service.py` `PURGE_DAYS`), **but no code deletes tickets when that date passes** (`B/services/tickets/retention.py` docstring: the purge "belongs to the slices that own those tables"). A manager can delete a ticket fully by hand | `B/services/tickets/deletion.py`, `B/services/tickets/store.py` `purge_ticket` (manual routes only) | the retention key is read by `monitor.py` but is not in the settings schema (`B/services/tickets/settings_doc.py`) |
| Ticket request idempotency rows | 24 hours | `B/services/tickets/retention.py` | no |
| Ticket outbound message log / inbound log | 90 days / 30 days | `B/services/tickets/messaging.py` `OUTBOX_KEEP`, `INBOUND_KEEP` | no |
| Handler-link access log, codes, sessions | access log 90 days; codes and sessions 1 day after expiry | `B/services/tickets/public_runtime.py` | no |
| Vendor-portal codes and sessions | codes 2 days; sessions at expiry | `B/services/tickets/vendor_portal.py` | no |
| Phone-verification rows | 2 days | `B/services/tickets/phone_verify.py` `KEEP` | no |
| Vendor-portal technician requests | decided: 180 days after the decision; pending: 90 days after sending | `B/services/tickets/portal_more.py`, mig 0112 | no |
| Cost claims, invoice files | claim `purge_after` = approval/payment + `costs.retention_days` (default 2555 days = 7 years, minimum 730) | `B/services/tickets/costs_retention.py`, `settings_doc.py` | yes (setting); legal minimum **REQUIRES COUNSEL REVIEW (C10)** |
| Requests for quotation and quotes not selected | `rfq.retention_months` (default 24, range 6-120) | `B/services/tickets/rfq.py` `retention` | yes |
| People-messaging records (`intercom_messages`) | 400 days | `B/services/intercom_messaging.py` `KEEP_DAYS` | no |
| Consent-by-link requests and held messages | requests (not still open) and released/dropped held messages after 400 days (`KEEP_DAYS` shared with people messaging); a granted-consent row stays until the person later declines (then it is deleted and an opt-out row is written) | `B/services/intercom_consent.py` `prune` | no |
| WhatsApp send ledger | 2 days | `B/services/messaging_runtime.py` | no |
| Temperature report link documents (`outbound_documents`) | the PDF bytes are dropped at expiry (`report_link_hours`, default 24, at most 168), revocation or when the downloads are used up; the row (ids, digest, counts) 90 days after expiry | `B/services/tickets/out_documents.py` `purge` | yes (lifetime and downloads are settings) |
| Phone-app presence event log | `presence.retention_days`, default 30, range 1-365 | `B/services/presence.py` `janitor` | yes (setting) |
| Home Assistant entity state history (`ha_state_history`: state, change time, receipt time; used by the historical map) | 30 days after receipt | `B/main.py` janitor -> `B/services/ha_history.py` `prune`, `RETENTION_DAYS = 30` | no (constant) |
| Presence-sensor states in that history (binary sensors of class motion / occupancy / presence) | `history.presence_retention_days`, default 7 (1-30), applied only while the time scrub (`history.timescrub`) is on; otherwise the 30 days above. Reading them on the map needs `history.presence` and writes one audit row per user, floor and day | same, `prune_presence` (CR-TIMESCRUB101) | yes (setting); whether it should apply with the time scrub off is an open owner question |
| History gaps (`ha_state_history_gaps`: from, to, reason - no personal data) | with the state history (30 days) | same | no |
| Device activity log (who changed an electrical device) | `device_activity.retention_days`, default 90 (7-365), plus size caps | `B/services/device_activity.py` `prune` | yes (setting) |
| Elevator state history (derived state only, no person) | 8 days | `B/services/elevators.py` `HISTORY_KEEP_S` | no |
| Revoked phone-app device rows | 30 days after revocation | `B/services/presence.py` `REVOKED_KEEP_DAYS` | no |
| Phone-app push messages | 1 day after expiry (24 h life) | same | no |
| Phone-app sign-in codes and sessions | codes 1 day after expiry; revoked sessions 30 days; ended refresh-token families 30 days | `B/services/app_session.py`, `B/services/app_refresh.py` | no |
| Camera event thumbnails and `events` rows | `events.retention_days`, default 30 (1-3650) | `B/main.py` janitor, `B/services/thumbnails.py` | yes |
| People-counting samples (numbers per area, no person) | `occupancy.retention_days`, default 7 (1-90); all samples deleted when the feature is switched off | `B/services/zone_counts.py` `prune`, `janitor` | yes (setting) |
| Supplier-document reading drafts (row S of document 01) | 14 days after the last activity on the draft, or with its file (`RETENTION_DAYS = 14`, hourly janitor); the feature is off by default | `B/services/docread/service.py` `janitor`, `B/main.py` | no (fixed) |
| Building-presence history (row T; **upcoming, not in the current main**) | `retention_days` 0-365 (0 = nothing recorded); everything erased when the master switch is turned off | branch `pilot/PRESENCE-2280`, `building_presence_history.py` | yes (planned) |
| Voice-announcement log (who, text, targets) | 90 days; queued announcements dropped after 24 h | `B/services/announcements.py` `prune(days=90)`, `QUEUE_EXPIRE_H` | no (fixed) |
| Emergency contacts | **never automatically**; manual delete blanks name, phone, e-mail and user link and keeps the row as a tombstone. The readiness history (verdicts and counts only) follows `history_keep_days` (default 365, 30-3650) | `B/services/emergency/service.py` `delete_contact` | contacts: n/a. **REQUIRES COUNSEL REVIEW (C3)** |
| Notices and their read receipts | archived or expired notices are soft-deleted after `notices.retention_days` (default 365, 30-3650) and purged 30 days later with their read receipts; a published notice without an end date that is never archived is never swept, so its read receipts stay | `B/services/notices/store.py` `retention_sweep` | yes (setting) |
| Partner API tokens, delivery log, outbox | ended tokens 90 days; delivery log 30 days; delivered/dead events 14 days; idempotency answers 24 h; no retention found for partner clients and partner-ticket links | `B/services/partner/core.py`, `B/services/partner/webhooks.py` | no |
| Closed incidents | 365 days (30-3650) | `B/services/incidents.py` | yes (setting) |
| Notification inbox / delivery log | 30 days after resolution (inbox, floor 365 days for any row) / 14 days (deliveries) | `B/services/notify.py` | partly (`retention_days` choices) |
| Browser push subscriptions | not synced for 120 days | `B/services/push.py` `STALE_DAYS` | no |
| Local-login records | used/expired links 1 week; revoked/expired sessions 1 month; reset codes about 1 hour after expiry; reset sends 24 h | `B/services/local_identity.py`, `B/services/local_reset.py` | no |
| Disabled or deleted local accounts | **off by default.** When `privacy.local_purge` is on, a local account inactive for `privacy.local_purge_days` (default and minimum 30, max 3650) is purged: personal rows in 27 tables deleted (credentials, sessions, passkeys, TOTP, preferences, push, phone devices and presence events, notification rows, remote sign-ins, ...), the typed name replaced in tickets, ticket events, saved views and announcements, the `users` row kept as an anonymised tombstone. Audit rows are not touched; notice read receipts and emergency-contact user links are not included | `B/services/local_privacy.py` (hourly) | yes; switching on needs a system administrator on the local channel and a typed word (`B/routers/settings.py`) |
| Remote revoked-session chains | 365 days | `B/services/ha_user_auth.py` | no |
| Project backups | 5 "pre-upgrade" and 7 "daily" archives kept; manual/uploaded never removed by code | `B/services/backup.py` `KEEP` | no |
| Off-box backup copies | by default the newest 3, 14 daily, 4 weekly, 6 monthly; only files Arx wrote are removed | `B/services/backup_offbox.py` `RetentionPolicy` | yes (per target) |

Not listed (no personal data, or outside this summary): automation and schedule runs, energy, water, generator, temperature and maintenance-reminder records, export files (7 days), capture leases and media cache.

Whether "until the organisation deletes it" without a fixed period is acceptable for directory persons, door-system persons and emergency contacts: **REQUIRES COUNSEL REVIEW (C3)**.
Whether the audit period (365 days) and the 7-year financial period are right, and how they interact with a deletion request: **REQUIRES COUNSEL REVIEW (C10)**.

## 2. What an erase of a directory person does and does not do

`B/services/tickets/contacts.py` `erase_checked` and `B/services/tickets/store_links.py` `erase_contact`:

- Does: revokes the person's live handler links, replaces the name with the fixed tombstone text, clears company, phone, keyed phone
  index, e-mail, notes, user link and phone-confirmation fields, marks the row inactive and erased, removes department rows and phone-verification
  rows; with the "also from history" option, replaces the person's frozen name on assignments, ticket timeline rows and RFQ timeline rows and neutralises
  the names of files the person uploaded; cost claims keep the company, amounts and files (`costs.on_contact_erased`). One audit row `ticket.contact.erase` (ids and counts).
- Does not (from the code): remove names or numbers a person typed into free-text ticket descriptions or notes; remove the row itself (it stays as a tombstone);
  delete the door-system person (a separate, manual, per-action step); delete the access-grant rows, which expire 12 months after they end; touch backups
  already written.
- Refused while a live door grant exists (`B/services/needs_review.py`, 409 `needs_review_live_grant`); a vendor with persons cannot be erased (409 `contact_has_persons`).
- "Reject and delete" of a pending technician (`B/services/access_grants.py` `reject_pending_contact`) ends open requests and runs the same erase; it is refused if a door-system link or a decided grant exists.
  The automatic erase of undecided technicians (`B/services/pending_retention.py`) and of visitors (`B/services/access_visitors.py` `erase_due`) use the same `erase_contact`.

## 3. Who can see what

Permissions are role-and-scope based (`B/rbac.py`; model in `docs/security/HA_IDENTITY_RBAC_HE.md`). The host administrator can reach data outside Arx's access control (same document, section 2).

| Data | Who | Rule (file) |
|---|---|---|
| Directory list, create/edit/erase/export | holders of `tickets.configure` at installation scope | `B/services/tickets/contacts.py` docstring |
| Directory contacts allowed in a department | managers of that department with `tickets.manage` | same |
| Full phone number | `tickets.configure`; or `tickets.external` plus managing an allowed department; others see the last four digits. Setting `directory.managers_full_phones` (default off) | `contacts.py`, `settings_doc.py` |
| Turn technician door access on or off | `system.configure` and system administrator | `B/routers/access_grants.py` `put_settings` |
| Approve / refuse / revoke technician door access | permission `access.external.grant`, only for stations the approver is bound to; by default administrators | `B/services/access_grants.py` `PERMISSION`; `access.external.local_approvers` default off |
| Reject a pending technician | `access.external.grant` anywhere, or `tickets.configure` | `reject_pending_contact` |
| "Needs review" report and delete-now | `tickets.configure` at installation scope | `B/services/needs_review.py` |
| Delete a person in the door system | `access.external.grant` and unrestricted `people.manage`; interactive session | `delete_person_now` |
| Invite a visitor | `access.visitor.invite`, station-scoped (held by `system_admin` only by default) | `B/services/access_visitors.py` |
| A visitor's name and number | the host: name and the last two digits; others who can see the grant: the invitation without name or number | `B/services/access_visitors.py` |
| Visitor settings; "revoke all" visitors | `system.configure` and system administrator; system administrator | `B/routers/access_visitors.py`, `B/services/access_visitors.py` |
| Full ticket deletion | `tickets.delete`, manager of the department; interactive session | `B/services/tickets/deletion.py` |
| Vendor on the arrival page | own technicians only: first name plus the last two phone digits; the request state | `B/services/access_arrival.py` |
| Audit log | permission `audit.read` (listed in the `system_admin` role) | `B/rbac.py`, `B/roles.json` |
| Presence events and device status | the user for own devices; holders of `presence.sensors.view` for any device; `system.configure` to change settings | `B/routers/presence.py` |
| "Who is in the building" (names by floor/area) | `presence.view`; names hidden when `people.show_names` is off or the person opted out | `B/services/presence_people.py` |
| Notice read receipts (who read, when, who did not) | `notices.manage` on the notice's audience; counts only when `notices.reads_names` is off (default on) | `B/routers/notices.py` |
| Emergency contacts with phone and e-mail | `maintenance.manage` or `emergency.manage`; `maintenance.view` / `emergency.view` see the count only | `B/services/emergency/access.py`, `service.py` |
| Voice announcements: make / configure and history | `media.announce`; `system.configure` | `B/routers/announcements.py` |
| People counts per area | `occupancy.view` on every camera feeding the area | `B/routers/occupancy.py` |
| Partner clients and tokens | `partner.manage` and system administrator | `B/routers/partner.py` |
| Personal-data export of a local account | the account holder (own data), or `identity.local.manage` for any local account; both only while `privacy.personal_export` is on (default off) | `B/routers/local_privacy.py` |
| Off-box backup targets and keys | `backup.manage` | `B/services/backup_offbox.py` |
| Access-rights compliance export | `access.events.export` and `access.people.read` per station, while `access.compliance_export` is on | `B/routers/compliance_export.py` |
| Managers' notifications about access and visitor arrivals | content-free (no name or phone; a visitor arrival notice names the door and time only) | `_notify` in `access_grants.py`, `needs_review.py`, `B/services/access_entries.py` |
| Technician's or visitor's personal code | the person only (WhatsApp); nobody in Arx | `access_grants.py` |

Whether holders of a general "view people/contacts" permission can see a pending technician was not verified in this pass: **REQUIRES COUNSEL REVIEW (C11)** (technical check first).
