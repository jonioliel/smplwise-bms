# CR-VENDORQ-294 - reports to vendors through the message queue, the RFQ "system" author, documents by temporary link

**Status:** design + backend slice on `pilot/VENDORQ-294` (base `origin/main` 586f191b3, 2.9.1). **Everything is OFF by default.** No real
WhatsApp send was made (fake ha-whatsapp only). Migration number **0129 is PROVISIONAL** (0124 = 2.9.2; 0125 / 0126 / 0128 are other
provisional branches): it is renumbered at integration, like every provisional file.

Owner items this answers (all kept "do not forget"):

1. *Sending to vendors through the message queue* (owner 2026-10-19 / 2026-10-20 night; CR-INFRA-TEMPERATURE section 9 item 2): an
   external contact is reached only through the tickets message queue (`ticket_outbox`), whose `purpose` CHECK needs a table rebuild.
2. *RFQ reminder thread messages with a `system` author* (backlog `rfq-thread-system-author`; CR-RFQ-PAYMENT-SCHEDULE D21): deferred to
   "the next rebuild of `ticket_rfq_messages`".
3. *WhatsApp document sending* (CR-INFRA-TEMPERATURE section 9 item 1): a temporary link and / or an attached HTML report; first consumer
   the temperature HACCP report (`origin/pilot/TEMPCTL3-293`, not on main yet).

## 1. Shape in one paragraph

A module that wants to send a report to an external contact calls `contact_reports.queue(...)`: it writes ONE outbox row of the new purpose
`report`, naming its module and its own row (`source_module`, `source_id`) and optionally a document (`document_id`). The outbox stores no
text (the rule of 0081): at send time it asks the module's registered provider for the text, rebuilds it from the data, adds the document's
temporary link line, and sends through the existing worker - account mapping, send hours, pacing, number verification, the
`unknown`-is-final rule and the audit row are the outbox's own, unchanged. The outcome goes back to the module through the same provider.
A document is a snapshot (PDF or HTML bytes) in `outbound_documents`, reachable for a short time through a derived, single-purpose link
`#d.<token>` on the public listener.

## 2. Migration 0129 (PROVISIONAL) - one file, two table rebuilds, one new table

`0129_vendor_queue_documents_PROVISIONAL.sql`. The migration runner wraps the file in one transaction (`db.migrate`: `BEGIN; ...; INSERT
schema_migrations; COMMIT`) with `foreign_keys=ON`; any failure leaves the database at 0123 untouched.

### 2.1 `ticket_outbox` (rebuild; last rebuilt by 0089)

* `purpose` CHECK gains `report`.
* New nullable columns: `source_module` (the producing module, `[a-z_]{1,32}`), `source_id` (its row id, <= 64), `document_id` (an
  `outbound_documents` id, no FK - the purge order).
* New CHECK: `(purpose = 'report') = (source_module IS NOT NULL AND source_id IS NOT NULL)` - a report row always names its source, no other
  row ever does.
* Every existing column, row and index is copied (the explicit column list of 0089 + the three new columns as NULL); the 0089 indexes are
  recreated by name plus `idx_ticket_outbox_source (source_module, source_id)`. Nothing references `ticket_outbox` by a foreign key
  (`ticket_link_codes.outbox_id` and `ticket_rfq_messages.outbox_id` are plain text), so the DROP cascades nothing.

### 2.2 `ticket_rfq_messages` (rebuild; created by 0089, columns added by 0104)

* `author_kind` CHECK gains `system`; new CHECK `author_kind <> 'system' OR direction = 'out'` (the system never writes an inbound line).
* Data: the D21 rows (`author_kind = 'user' AND author_id = 'system'`, written by the arrival reminder since 2.6.x) become
  `author_kind = 'system'` (author_id stays `system`). No other row changes.
* All 21 columns and both indexes (`idx_ticket_rfq_messages_vendor`, `idx_ticket_rfq_messages_pending`) are kept. No table references
  `ticket_rfq_messages` by a foreign key (`ticket_rfq_vendor_files.message_id`, `answer_id`, `answers_id` are plain text). Its own FKs
  (to `ticket_rfqs`, `ticket_rfq_vendors`, ON DELETE CASCADE) are re-declared identically.

### 2.3 `outbound_documents` (new)

`id` (32 hex - the token's HMAC input), `key_id`, `token_hash` UNIQUE, `module`, `source_id`, `recipient_kind` (`contact` | `user`),
`recipient_id`, `media_type` (`application/pdf` | `text/html`), `filename`, `size_bytes` (1..2 MiB CHECK), `sha256`, `content` BLOB (NULL
once purged), `max_opens`, `open_count`, `first_opened_at`, `last_opened_at`, `created_by`, `created_at`, `expires_at`, `revoked_at`,
`revoked_reason`, `purged_at`. Indexes on expiry (live rows), recipient, source.

### 2.4 Proof the rebuild preserves data (tests, section 6)

`test_vendorq_294_migration.py` builds a database at 0123 from the real files, fills both tables with every state / purpose / author shape
(incl. 0086 `link_generation`, 0089 `rfq_id`, 0104 question columns), runs the real 0129 and compares every column of every row
(except the intended `author_kind` rewrite), the index names, `PRAGMA foreign_key_check` (empty) and `PRAGMA integrity_check` (`ok`).

## 3. Rollback

Three levels, cheapest first:

1. **Switches off** (no code change): `reports.to_contacts = false` - `contact_reports.queue` refuses (`reports_to_contacts_off`);
   `reports.documents = false` - no document is minted and the public route answers the uniform 404 for every token (also for documents
   minted before). Open `report` rows: they still leave (they were accepted); to stop them, the managers' existing cancel acts on the
   outbox apply.
2. **Code revert, schema kept** (the normal case): the schema is a superset. The pre-0129 code reads `ticket_outbox` by column name
   (`from_db`) and writes an explicit column list (the new columns default NULL); a leftover `report` row ends `not_sent`
   (`template_missing`) because the old code has no text for it. Old code reading a `system` RFQ line shows it with an empty author (no
   lookup fails) - run the data step below to restore the D21 shape.
3. **Data rollback SQL** (tested in `test_vendorq_294_migration.py::test_the_documented_rollback_restores_the_pre_0129_data_shape`):

```sql
BEGIN;
UPDATE ticket_rfq_messages SET author_kind = 'user' WHERE author_kind = 'system';
UPDATE ticket_outbox SET state = 'cancelled', outcome_code = 'rollback', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE purpose = 'report' AND state IN ('queued', 'held');
UPDATE outbound_documents SET content = NULL, purged_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), revoked_at = COALESCE(revoked_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       revoked_reason = COALESCE(revoked_reason, 'manual') WHERE purged_at IS NULL;
COMMIT;
```

The CHECKs stay wide (harmless); a full schema down-migration is not provided (the project never runs migrations backwards - a database
restore from the pre-upgrade backup is the full rollback, as for every release).

## 4. Reports to contacts (`services/tickets/contact_reports.py`)

* `register(module, provider)` - a provider has `body(conn, row, lang) -> ReportBody | None`, `outcome(conn, row)` and
  `still_relevant(conn, row) -> bool`. The temperature module (on its own branch) registers `temperature`; tests register a fake module.
* `queue(conn, enqueue, *, module, source_id, contact_id, use_key, requested_by, idempotency_key, document_id=None)`: refuses (stable codes)
  when `reports.to_contacts` is off, the module is not registered, the contact is unknown / erased / inactive / a company row without a
  number, or WhatsApp cannot carry it (`messaging.plan_channel` must answer `whatsapp`: master switch on, a number, verification when
  required). WhatsApp only in this slice - **no e-mail fallback** (an HTML/PDF report by e-mail is a separate decision); a `not_sent` /
  `refused` report ends there and the provider is told.
* The outbox renders `report` from the code: an optional organisation line, the provider's text (one paragraph, controls stripped, at most
  **700** characters; a provider text that looks like a URL is refused at send time `report_unsafe` - only the system's own document link
  may appear), and, with a document, the line "the report (until <local date/time>): <link>" in the contact's language. The whole message
  stays under the outbox's 1000-character cap. Missing provider / body -> `not_sent` `report_unavailable`; a document that is no longer live
  -> `not_sent` `document_not_live` (never a message promising a dead link). These codes are non-retryable.
* Unchanged rules: held by the send hours (`report` is not in `NEVER_HELD`), `held` / `not_sent` on a down or unmapped account, pacing
  per account and per recipient through the shared ledger, `unknown` is final, a number that needs verification stops the row at send time
  (`number_unverified`), the audit row `ticket.message.send` (ids, states, the source module - never a number or a text).
* The account: the module names its use (`infra.temperature.reports` inherits the notifications account - the temperature branch's own
  `mr.register_uses`); default `tickets.messages`.

## 5. Documents by temporary link (`services/tickets/out_documents.py`)

### 5.1 Token and link design

* Token = `links.derive_token(module key, document id, 1, domain="doc")` - the keyring of the tickets public surface, a new token domain
  `doc` (so a ticket, RFQ or consent token can never equal a document token), 32 base64url characters (192 bits). Only `sha256(token)`
  is stored (UNIQUE: the public listener's ONE indexed lookup). The token is derived again at send time, never stored, logged or audited.
* URL = `<public base>/<prefix>/#d.<token>` (the TK255 prefix like every link). The token rides in the FRAGMENT (never sent to a server,
  never in Cloudflare / proxy logs); the page sends it in `X-Ticket-Token` like the RFQ and consent pages.
* Expiry: `reports.document_hours` (default **72 h**, range 1..168 - a hard 7-day ceiling). Opens: `reports.document_max_opens` (default
  **5**, range 1..20); each byte download counts one (compare-and-set). Revocation: manual, the contact's number / e-mail change or erase
  (`revoke_contact_links` path), a module key rotation (the key id no longer resolves -> unavailable), a failed send of its report row.
* Every non-live case (unknown, expired, revoked, opens used up, purged, documents switched off, key gone) is the same uniform 404.

### 5.2 Size and privacy limits

* Media types: `application/pdf` (checked `%PDF-` magic) and `text/html` (UTF-8, no `<script`, no `<iframe`, no external `src=`/`href=`
  `http(s)://` - a self-contained report); anything else is refused at mint time.
* At most **2 MiB** per document (also a table CHECK) and **64 MiB** of live (not purged) documents per installation (`document_store_full`).
  Filename: `[A-Za-z0-9._-]`, at most 80 characters, the extension must match the type; never a person's name by default.
* Served with `Content-Disposition: attachment` (ASCII name + RFC 5987 `filename*`), the exact type, `X-Content-Type-Options: nosniff`,
  `Cache-Control: private, no-store` and the edge's own security headers: the public edge REPLACES any route CSP with the listener's
  `default-src 'none'; script-src 'self'; ...` and adds `Referrer-Policy: no-referrer` (public_http.SECURITY_HEADERS) - at least as strict
  as `sandbox` for a download. The HTML hygiene check at mint time (no script / frame / object / form / base / link / meta refresh /
  `javascript:` / external `src` / `href` / `url()` / `@import`; `data:image/` allowed) is what keeps a saved HTML report inert when it is
  opened later from the device.
* The bytes are deleted (`content = NULL`, `purged_at`) by the janitor at expiry / revocation; the row (ids, digest, counts - no content,
  no number) goes 90 days later. Audit: `report.document.mint` / `report.document.open` with ids and counts only.
* A document is a snapshot: what the recipient downloads is exactly what was sent (the `sha256` of the bytes is stored and returned in
  `X-Document-Digest`).

### 5.3 Attached HTML report (WhatsApp document message) - designed, NOT built

`whatsapp.send_message` carries text only. Attaching a file needs a media service of `ha-whatsapp` (FaserF). Its name, field shape and
whether it fetches a URL or reads a path are **UNVERIFIED** (no live check was run; upstream watch entry `ha-whatsapp`). The seam exists:
`OutboundMessage` stays text; the adapter would get `supports_documents()` (False) and an allow-listed media service only after the live
check list (private/planning/TICKETS_WHATSAPP_LIVE_CHECKS_HE.md) proves it. Until then the only document mode is the link. The add-on's
source is NOT in this repository (searched 2026-10-20: no `send_document` / `send_image` definition anywhere), so per the lead's rule the
attachment mode was not built.

### 5.4 The public page

The route `GET /t/api/doc` (metadata: filename, type, size, expiry, opens left, digest; kind `token_read`) and `GET /t/api/doc/file`
(the bytes; kind `file_read`, its own per-token window) are built and tested on the public listener (`services/tickets/public_documents.py`,
edge rules in `public_http.ROUTES`; the edge's failure caps per client network and installation-wide apply). The page's `#d.` mode is built (second commit):
`frontend/src/public-ticket/doc/doc-page.ts` + `doc-text.ts`, a lazy chunk like the consent page (it reuses the consent stylesheet), its
own 4 KB gzip cap in `unit-public-ticket.spec.ts`. One card: the organisation (name, logo, look - the meta answer carries them, never a
person), the file name, size, expiry and downloads left, one download button. The bytes become a `blob:` URL of the page with the server's
checked file name (the chunk's only link, revoked after the click); the token stays in memory and travels in `X-Ticket-Token`.
`out_documents.PAGE_READY` is now True; a build without the page sets it False and every mint is refused (`document_page_missing`).
Guards: `tests/unit-public-doc.spec.ts`.
**This is a new public surface: a Fable public-surface security review is required before it is switched on in a release.**

## 6. Test plan

| Test file | What it proves |
|---|---|
| `test_vendorq_294_migration.py` | 0123 -> 0129 on the real files: every outbox and RFQ-message row and column survives; D21 rows become `system`; the new CHECKs accept `report` / `system` and refuse an unknown purpose, a `report` without a source, a non-report row with one, an inbound `system` line; indexes by name; `foreign_key_check` empty; `integrity_check` ok; runs once; the rollback SQL restores the pre-0129 data shape. |
| `test_vendorq_294_reports.py` | Off by default (`reports_to_contacts_off`); queue -> outbox row (no text, no number) -> worker -> fake ha-whatsapp `send_message` with the provider's text; send hours hold it; unmapped account holds; outcome reaches the provider; `unknown` final; unsafe provider text / missing provider / dead document end `not_sent` with non-retryable codes; no e-mail fallback; the link line appears with a live document; logs and rows carry no number / text / token. |
| `test_vendorq_294_documents.py` | Mint limits (type, magic, HTML hygiene, size, total, filename, switch, page-ready guard); token derivation (domain `doc`, hash only); public `GET /t/api/doc` + `/file` with headers, open counting, expiry, revocation, contact erase, key loss -> uniform 404; purge removes bytes. |
| `test_tickets_rfq_*` (existing) + a new case in `test_vendorq_294_reports.py` | The arrival reminder writes `author_kind = 'system'`; `present_message` and the vendor page still mark it `system`. |

Real vs fake: SQLite and the migration files are real; WhatsApp, Home Assistant, the clock and the public network are fakes. No lab device.

## 7. Integration notes for the temperature branch (TEMPCTL3-293)

* `temperature_whatsapp._check_recipients`: accept `kind == "vendor"` when `contact_reports.enabled(conn)`; the send row keeps
  `recipient_kind='vendor'` + `contact_id`; `process()` hands vendor rows to `contact_reports.queue(...)` instead of `_send` (the outbox then
  owns hours, pacing and outcome; the provider's `outcome` updates `infra_temp_report_sends.status`).
* `ATTACHMENT_MODES` gains `"link"`; `attachment_for()` mints the PDF through `out_documents.mint(...)` and returns its id, passed as
  `document_id`. The `html` mode waits for 5.3.
* Register the provider once at import: `contact_reports.register("temperature", Provider(...))`; its `body()` rebuilds
  `rep.text_summary(model)` for the contact's units scope (the installation's managers' choice - a vendor has no unit scope of his own).

## 8. Known limits

* No e-mail fallback for reports; no attached file (5.3); no public page (5.4); no UI (Settings keys are reachable through the existing
  tickets settings API only).
* `ar` / `ru` lines of the report link text are developer translations (native review pending), as for every starter.
* Contiguous-numbering check (`test_migrations_263_upgrade.py::test_the_release_numbers_are_contiguous_and_final`) is red on this branch
  by design while 0129 is provisional over a 0123 main; it is green again once the integration renumbers the file.

## 9. Settings (tickets settings document, `PUT /api/v1/tickets/settings` block `reports`, `system.configure`)

| Key | Default | Range | Meaning |
|---|---|---|---|
| `reports.to_contacts` | `false` | bool | A module may queue a report to an external contact. |
| `reports.documents` | `false` | bool | Documents may be minted and their links answer. Off = every document link is the uniform 404. |
| `reports.document_hours` | `72` | 1..168 | How long a new document link lives (7-day hard ceiling in code too). |
| `reports.document_max_opens` | `5` | 1..20 | Downloads per document. |

No Settings screen was added (no UI in this slice).

## 10. What this branch built / did not build

Built: migration 0129 (PROVISIONAL), `contact_reports.py`, `out_documents.py`, `public_documents.py` + the two edge rules, the outbox
purpose `report` (model, enqueue validation, send-time text port, no e-mail fallback, non-retryable codes, hooks to the module), the
`reports.*` settings, the RFQ arrival reminder written with `author_kind = 'system'`, document revocation on contact change / erase and on
module key rotation, document keys counted as "in use", the janitor purge.

Built in the second commit: the public page's `#d.` mode (5.4). Not built: the attached-file WhatsApp mode (5.3, the add-on's service
cannot be inspected here), e-mail delivery of reports, any Settings UI, the temperature branch's consumer code (section 7 - it lives on
`pilot/TEMPCTL3-293`, not on main).
