# 04 - Privacy notice template for an organisation using SmplWise Arx

Status: TEMPLATE, DRAFT. Not legal advice. The organisation fills the `[BRACKETS]`, removes parts that do not apply, and sends the result to its counsel before use.
The whole template is **REQUIRES COUNSEL REVIEW (C2, C3, C4)**: whether a notice is required, to whom, in which form, and with which mandatory content under the law that applies
to the organisation is a legal question this repository does not answer.

How this relates to the texts the product already shows (do not contradict them):

- Technician notice `n2` on the vendor arrival page and the one-line text inside the entry-code message: `B/services/access_grants.py` (`NOTICE_TEXT`, `TEMPLATES`).
  Those texts are fixed in code and say the information is kept "until the organisation deletes it, in line with its retention policy" and that requests go to "the building manager".
  This template is the longer document the organisation can point to, and the retention policy referred to is `06-retention-policy-template.md`.
- Staff presence notice for the phone app: editable text with a version, `presence.notice_text` / `presence.notice_version` (`B/services/presence.py`); a changed text or a newly allowed sensor
  forces every device to acknowledge again. The app feature is off by default.
- Verified wording differences with the technician-privacy decisions of 2026-10-18 (internal; see README, section on mismatches): the product's texts say "the building manager", not the organisation's name; the entry-code message starts with the
  product name "SmplWise Arx", not the organisation's name; the phone-verification message to the technician has no privacy line.

## Template (English; a Hebrew version is in `../he/04-organisation-privacy-notice-template.md`)

---

**Privacy notice - [ORGANISATION NAME]** (version [N], date [DATE])

**1. Who we are.** [ORGANISATION NAME], [ADDRESS], operates the building [BUILDING / SITE NAME]. Contact for privacy questions: [ROLE, e.g. building manager], [PHONE / E-MAIL].
[Role of the organisation and of the software supplier SmplWise: to be stated by counsel.] **REQUIRES COUNSEL REVIEW (C1)**

**2. What this notice covers.** People who deal with the building's management system (SmplWise Arx): external vendors and their technicians, people who open service requests,
people with door access, and staff who use the system or its phone app. [Delete categories that do not apply at this site.]

**3. What information we keep, and why.**

| Who | Information | Purpose |
|---|---|---|
| Technician sent by a vendor | name, phone number; when entering the building: time and door (door system) [, a picture at entry, if enabled at this site] | allow entry for the approved job; building security; managing entries for that job |
| Vendor and its contact people | company, name, phone, e-mail, messages and files related to quotes and jobs, invoices | managing service requests, quotes, work and payment |
| People who open or are named in a service request | name, free text they or staff write, photos | handling the request |
| Staff using the system | account name, display name, optional e-mail, sign-in records (time, masked address, country, device), actions they perform (audit log) | access control and accountability |
| Staff using the phone app (only if switched on) | device details, notice acknowledgement, location/presence information as configured, push token | [PURPOSE AS DEFINED BY THE ORGANISATION] **REQUIRES COUNSEL REVIEW (C9)** |
| People appearing in camera frames | event pictures taken from the recorder at the event time | [PURPOSE] **REQUIRES COUNSEL REVIEW (C13)** |

Each row above corresponds to the verified data list in `01-data-processing-summary.md`; edit it to match what is actually switched on at the site.

**4. Whether providing the information is required.** For technicians: [there is no legal obligation to provide the details, but an entry code cannot be issued without them] (the sentence used in the product's notice).
**REQUIRES COUNSEL REVIEW (C2)**

**5. Who receives it.** Staff with the relevant permission; the building's door system; WhatsApp (the entry code and some service messages are sent by WhatsApp from the organisation's account);
[Cloudflare, which carries traffic of the web pages vendors open]; [e-mail provider, if used]; [other recipients]. **REQUIRES COUNSEL REVIEW (C5, C6, C7)** (including any transfer outside [COUNTRY]).

**6. How long we keep it.** As set out in our retention policy [LINK / ATTACHMENT: `06-retention-policy-template.md` filled in]. [Summary table from the filled policy.] **REQUIRES COUNSEL REVIEW (C3, C10)**

**7. Your requests.** To see, correct or delete information about you, contact [CONTACT]. [How we verify identity, how long we take to answer: stated by counsel.] **REQUIRES COUNSEL REVIEW (C11)**

**8. Security.** [Short, factual list the organisation can stand behind, based on section 6 of `01-data-processing-summary.md` and the organisation's own database definition document.] No statement of
legal adequacy is made here. **REQUIRES COUNSEL REVIEW (C4)**

**9. Changes.** We update this notice when the system's data practices change; the version and date above show the current text.

---

## How to use

1. Fill in the placeholders using the filled copies of documents 05 and 06.
2. Compare each sentence with the product texts quoted above; if the organisation wants its own name in the technician-facing texts, that is a code change (README mismatch 2), not a document change.
3. Send to counsel. Do not publish before counsel's reply.
