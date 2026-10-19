# 06 - Retention policy template

Status: TEMPLATE, DRAFT. Not legal advice. The technician notice shipped in the product (`n2`) tells people the information is kept "until the organisation deletes it, in line with its retention policy"
(`NOTICE_TEXT` in `smplwise_vms/backend/smplwise/services/access_grants.py`). This template is where the organisation writes that policy. The periods are the organisation's decision; this file
only shows what the product does by itself, what it can be configured to do, and what stays manual. Appropriate periods, legal minimum or maximum periods, and whether an open-ended "until deleted" is
acceptable: **REQUIRES COUNSEL REVIEW (C3, C10)**.

## 1. Policy statement (fill in)

[ORGANISATION NAME] keeps personal information in SmplWise Arx only as long as the table below says. The building manager ([NAME]) is responsible for the manual steps. The policy is reviewed every [PERIOD]
and last reviewed on [DATE]. Version [N].

## 2. Table (fill the "Our period" and "Our manual step" columns)

"Product behaviour" is verified against `origin/integ/290` @ `018795f96`; details and file paths are in `02-retention-and-access-summary.md`.

| Data | Product behaviour | Configurable in the product? | Our period | Our manual step and who |
|---|---|---|---|---|
| Directory persons: technicians, contacts, vendors | never deleted automatically; erase by hand; "needs review" report lists pending technicians after `directory.review_pending_days` (default 30) and idle ones after `directory.review_idle_months` (default 12), with a yearly January reminder | review thresholds yes; automatic deletion no | [e.g. review every __ months] | [e.g. building manager works the report: reject-and-delete / delete-now] |
| Door-system persons created by Arx | never deleted automatically; manual "delete person" per person | no | [__] | [who / when] |
| Door-system entry records and entry pictures | decided in the door system (not verified) | not from Arx | [__] | [door-system operator] **REQUIRES COUNSEL REVIEW (C7)** |
| Door-access grant rows (ids, doors, dates) | deleted 12 months after the grant ended | no | 12 months (fixed) | none |
| Closed tickets | a deletion date (closed + 730 days by default) is recorded; **no automatic deletion was found**; a manager can delete a ticket fully | the date's length: read from the tickets settings, not found in the settings schema | [__] | [who deletes closed tickets older than __, how often] |
| Ticket photos, message log, link logs | tied to the ticket (photos); message log 90/30 days; link access log 90 days | no | per product | none |
| Cost claims and invoice files | 7 years after approval/payment by default (minimum 730 days) | yes, `costs.retention_days` | [__] | none |
| Requests for quotation and unselected quotes | 24 months by default | yes, `rfq.retention_months` (6-120) | [__] | none |
| Audit log | 365 days by default | yes, `audit.retention_days` (30-3650) | [__] | none |
| People-messaging records | 400 days | no | per product | none |
| Phone-app presence events | 30 days by default | yes, `presence.retention_days` (1-365) | [__] | none |
| Camera event pictures and events | 30 days by default | yes, `events.retention_days` | [__] | none |
| Notifications | 30 days after resolution; delivery log 14 days | partly | [__] | none |
| Backups | 5 pre-upgrade + 7 daily kept; manual and uploaded copies are never removed by the product | no | [__] | [who deletes manual copies and off-site copies, when] **REQUIRES COUNSEL REVIEW (C8)** |

## 3. Deletion requests and backups

A deletion done in Arx does not change backups already written. The policy must say what is done about that (for example: backups age out under the table above; restored backups are
re-cleaned): [ORGANISATION DECIDES]. **REQUIRES COUNSEL REVIEW (C8, C11)**

## 4. Exceptions

Data needed for a legal duty, a dispute or an incident may be kept longer: [WHO DECIDES, HOW RECORDED]. **REQUIRES COUNSEL REVIEW (C10)**

## 5. Annual review checklist (the product helps with part of it)

- Work the "needs review" report (handlers page, segment review); the product emits a content-free reminder every January when the report is not empty (`B/services/needs_review.py`).
- Review holders of the access-approval and directory permissions.
- Delete closed tickets past the period in section 2.
- Delete manual backup copies past the period.
- Review the audit log period.
