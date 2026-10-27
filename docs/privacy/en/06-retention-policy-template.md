# 06 - Retention policy template

Status: TEMPLATE, DRAFT. Not legal advice. The technician notice shipped in the product (`n2`) tells people the information is kept "until the organisation deletes it, in line with its retention policy"
(`NOTICE_TEXT` in `smplwise_vms/backend/smplwise/services/access_grants.py`). This template is where the organisation writes that policy. The periods are the organisation's decision; this file
only shows what the product does by itself, what it can be configured to do, and what stays manual. Appropriate periods, legal minimum or maximum periods, and whether an open-ended "until deleted" is
acceptable: **REQUIRES COUNSEL REVIEW (C3, C10)**.

## 1. Policy statement (fill in)

[ORGANISATION NAME] keeps personal information in SmplWise Arx only as long as the table below says. The building manager ([NAME]) is responsible for the manual steps. The policy is reviewed every [PERIOD]
and last reviewed on [DATE]. Version [N].

## 2. Table (fill the "Our period" and "Our manual step" columns)

"Product behaviour" is verified against `origin/integ/290` @ `018795f96` (2026-10-19) and re-verified against `origin/release/2241` @ `f1ef67c68` (2026-10-27); details and file paths are in
`02-retention-and-access-summary.md`. Rows for features that are off at the site can be deleted.

| Data | Product behaviour | Configurable in the product? | Our period | Our manual step and who |
|---|---|---|---|---|
| Directory persons: contacts, vendors, accepted technicians | never deleted automatically; erase by hand; "needs review" report lists pending technicians after `directory.review_pending_days` (default 30) and idle ones after `directory.review_idle_months` (default 12), with a yearly January reminder | review thresholds yes; automatic deletion no | [e.g. review every __ months] | [e.g. building manager works the report: reject-and-delete / delete-now] |
| Technicians a vendor added that nobody decided | erased automatically after 90 days by default | yes, `access.external.pending_retention_days` (7-365, 0 = off) | [__] | none, or [who rejects earlier] |
| Visitors (name and number) | erased automatically 30 days after the invitation ends by default; invitation and entry rows (ids, door, time) stay with no deletion job | yes, `access.visitors.erase_after_days` (1-365) for name and number; no for the rows | [__] | [who, if anything, for the invitation and entry rows] **REQUIRES COUNSEL REVIEW (C16)** |
| Door-system persons created by Arx | never deleted automatically; manual "delete person" per person | no | [__] | [who / when] |
| Door-system entry records and entry pictures | decided in the door system (not verified) | not from Arx | [__] | [door-system operator] **REQUIRES COUNSEL REVIEW (C7)** |
| Door-access grant rows (ids, doors, dates) | deleted 12 months after the grant ended | no | 12 months (fixed) | none |
| Closed tickets | a deletion date (closed + 730 days by default) is recorded; **no automatic deletion exists**; a manager can delete a ticket fully | the date's length: read from the tickets settings on automatic close, fixed 730 days on manual close, not in the settings schema | [__] | [who deletes closed tickets older than __, how often] |
| Ticket photos, message log, link logs | tied to the ticket (photos); message log 90/30 days; link access log 90 days | no | per product | none |
| Cost claims and invoice files | 7 years after approval/payment by default (minimum 730 days) | yes, `costs.retention_days` | [__] | none |
| Requests for quotation and unselected quotes | 24 months by default | yes, `rfq.retention_months` (6-120) | [__] | none |
| Audit log | 365 days by default | yes, `audit.retention_days` (30-3650) | [__] | none |
| People-messaging records | 400 days | no | per product | none |
| Phone-app presence events | 30 days by default | yes, `presence.retention_days` (1-365) | [__] | none |
| Camera event pictures and events | 30 days by default | yes, `events.retention_days` | [__] | none |
| People-counting samples (no person) | 7 days by default | yes, `occupancy.retention_days` (1-90) | [__] | none |
| Voice-announcement log | 90 days | no | per product | none |
| Emergency contacts | never deleted automatically; manual delete | no | [__] | [who reviews the list, how often] **REQUIRES COUNSEL REVIEW (C3)** |
| Notices and read receipts | archived/expired notices removed after 365 days by default, read receipts 30 days later; notices without an end date that are never archived are kept | yes, `notices.retention_days` (30-3650) | [__] | [who archives old notices] |
| Partner tokens and delivery logs (if a partner is connected) | ended tokens 90 days; delivery log 30 days | no | per product | [who removes partner clients no longer used] |
| Disabled or deleted local staff accounts | off by default; when on, purged after 30 days by default (minimum 30) | yes, `privacy.local_purge`, `privacy.local_purge_days` | [__] | [who disables accounts of leavers] |
| Notifications | 30 days after resolution; delivery log 14 days | partly | [__] | none |
| Backups | 5 pre-upgrade + 7 daily kept; manual and uploaded copies are never removed by the product | no | [__] | [who deletes manual copies and off-site copies, when] **REQUIRES COUNSEL REVIEW (C8)** |
| Off-box backup copies (if a target is set up) | newest 3, 14 daily, 4 weekly, 6 monthly by default | yes, per target | [__] | [who operates the target] **REQUIRES COUNSEL REVIEW (C8)** |

## 3. Deletion requests and backups

A deletion done in Arx does not change backups already written. The policy must say what is done about that (for example: backups age out under the table above; restored backups are
re-cleaned): [ORGANISATION DECIDES]. **REQUIRES COUNSEL REVIEW (C8, C11)**

## 4. Exceptions

Data needed for a legal duty, a dispute or an incident may be kept longer: [WHO DECIDES, HOW RECORDED]. **REQUIRES COUNSEL REVIEW (C10)**

## 5. Annual review checklist (the product helps with part of it)

- Work the "needs review" report (handlers page, segment review); the product emits a content-free reminder every January when the report is not empty (`B/services/needs_review.py`).
- Review holders of the access-approval, visitor-invitation and directory permissions.
- Delete closed tickets past the period in section 2.
- Review the emergency-contact list.
- Archive notices that have no end date.
- Delete manual backup copies past the period.
- Review the audit log period.
