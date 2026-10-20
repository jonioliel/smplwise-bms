# Privacy documents for an organisation using SmplWise Arx / מסמכי פרטיות לארגון המשתמש ב-SmplWise Arx

Status: DRAFT, documents and text only (no product code changed). Not legal advice; nothing here promises compliance with any law. Facts were verified by reading the code and
migrations of `origin/integ/290` @ `018795f96` (2026-10-19) and cite file paths. Every statement that needs a lawyer is marked **REQUIRES COUNSEL REVIEW (Cn)**.
סטטוס: טיוטה, מסמכים וטקסט בלבד (לא שונה קוד מוצר). אין זו חוות דעת משפטית ואין כאן הבטחה לעמידה בדין. העובדות אומתו בקריאת הקוד וההגירות; כל קביעה שדורשת יועץ משפטי מסומנת.

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

## Places where the code does not match an existing notice, brief or decision / אי-התאמות

Verified on `origin/integ/290` @ `018795f96`.

1. **Closed tickets are never purged automatically.** `purge_after` (closed + 730 days by default, `B/services/tickets/monitor.py`, `service.py`) is written on the ticket, but no code deletes tickets when it passes;
   `B/services/tickets/retention.py` says the purge "belongs to the slices that own those tables" and none was found. The retention key `retention.closed_days` is read by `monitor.py` but is absent from the settings schema
   (`B/services/tickets/settings_doc.py`). Any statement of "closed tickets are deleted after N days" would currently be untrue.
2. **Technician notice n2 versus the lead's technician-privacy decisions of 2026-10-18.** n2 (`NOTICE_TEXT`) points to "the building manager", not the organisation's name (decision 1); the entry-code message begins with the product name
   "SmplWise Arx:" (`TEMPLATES`), not the organisation's name (decision 8); the phone-verification message to the technician (`B/services/tickets/message_templates.py`, `phone_verify`) carries no privacy line (decision 2).
   The vendor-attests notice model (decision 3) and the four languages (decision 7) are in the code.
3. **Technician id in the log (decision 4):** the technician's contact id is in the notice-acknowledgement audit row (`acknowledged_for`) but not in the `access.grant.request` / approve rows
   (`B/services/access_grants.py`); the grant row that links the two is deleted 12 months after the grant ends, the audit row stays 365 days by default.
4. **The 2.7.1 legal brief is partly out of date.** It says there is no reject action and the notice is second-person and he/en only. On integ/290 "reject and delete" (`reject_pending_contact`), the "needs review" report with yearly
   reminder (`B/services/needs_review.py`) and notice n2 in four languages exist. The brief's note that the contact export lacks access grants is still true (`B/services/tickets/contacts.py` `export`).
5. **Notice n2 versus the system's own retention behaviour:** n2 says data is kept "until the organisation deletes it, in line with its retention policy". The code has no such policy object; the manual steps and the "needs review" report are
   the only mechanism, and until an organisation writes a policy (document 06) the sentence refers to something that does not exist.
6. **Entries and pictures:** the notice says each entry's time and door (and a picture where enabled) are kept. Arx stores no door events; they live in the door system, whose retention was not verified (C7).
