# CR-RFQ-VENDOR-UPLOAD - a vendor's own files and pictures on his quote

Status: built on `pilot/RFQ-VENDOR-UPLOAD` (two commits: the feature, then the owner's decisions on its questions) (from `integ/264` @ 5fa03e7a), 2026-10-17, not merged, not released.
Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.4.2 section 19.10 (+ the 15.5 exposure row, 19.9, the change log).
Migration: `0110_ticket_rfq_vendor_files.sql` (the number the lead reserved for this branch).
Security checklist: `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` row 5.12.

> **Release gate: a Fable review of this NEW PUBLIC UPLOAD ROUTE is required before the switch `rfq.vendor_uploads.enabled` is turned
> on in any release.** The branch ships the switch OFF; while it is off the public surface only gains two paths that answer the uniform
> 404.

## Owner decision (2026-10-17)

"A vendor may attach files / pictures to his quote, visible to the request opener / managers." This reverses CR-RFQ-ATTACHMENTS
question 4 ("vendor -> manager files: not now"). The lead's brief: design defensively - a new setting OFF by default, the SAME content
scanners and fail-closed rules as the manager's attachments (Office behind `rfq.attachments.allow_office`), smaller limits, per-vendor
and per-IP rate limits through the edge kind mechanism, the uniform 404 for bad tokens, quota accounting, no filename trust, downloads
only with nosniff and a sandbox CSP, never an executable type, audit with ids / counts only, a file links only to that vendor's own
quote, readable by RFQ managers under the visibility rules and never by other vendors.

## What was built

* Backend: `services/tickets/rfq_vendor_files.py` (rows, rules, quotas, presentation), the two public routes in `public_rfq.py`
  (`POST /t/api/rfq/upload`, `POST /t/api/rfq/upload/remove`) + their rows in `public_http.ROUTES`, the edge kind `rfq_upload` in
  `ratelimit.py` (per link `token_rfq_uploads`, per client network `rfq_upload_per_network`), `public_app.UploadGuards` (the photo route's
  own protections - one upload per link, the memory budget, the processing / decoder admission - handed to the RFQ router instead of
  copied), `rfq_files.store(..., allow_webp, semaphore)` (the manager's checks reused unchanged; WebP off and the public decode slot for a
  vendor), `rfq_files.vendor_headers` (always `attachment`), store functions + purge in `store_rfq.py`, the orphan-sweep knowledge in
  `store.folder_in_use` / `stored_paths`, the setting in `settings_doc.py` + `routers/tickets_admin.py`, the page block in
  `rfq_vendor.view`, the comparison's `vendor_files` and `meta.vendor_uploads` in `rfq.py`, the managers' download route in
  `routers/tickets_rfq.py`.
* Vendor page: a lazy chunk `rfq-upload-*` (its own 4 KB gzip cap in both bundle guards) - the card under his submitted quote: picker +
  phone camera, one file at a time, his files listed as text with "remove", the refusals in his language (he / en / ar / ru). The RFQ
  page itself gained only the lazy hook.
* Manager UI: a "קבצים מהספק" row in the comparison (`<tickets-rfq-files>` read-only, fetched lazily; every file opens as a download);
  the timeline knows `vendor_file_added` / `vendor_file_removed`.
* Tests: `tests/test_tickets_rfq_vendor_uploads.py` (15 cases, negative first), `frontend/tests/unit-rfq-vendor-upload.spec.ts`,
  `frontend/tests/evidence-public-rfq-upload.spec.ts` (Playwright, written, NOT_RUN); guards updated in `unit-public-rfq.spec.ts`,
  `unit-public-ticket.spec.ts`, `evidence-public-ui5.spec.ts`.

## Decisions

1. **One table, migration 0110.** `ticket_rfq_attachments` is the manager's (visibility switch, captions, position, the work order's
   reference copy) - a vendor's file has none of those and another owner, so it gets its own table; the files live in the SAME folder
   (`<data>/tickets/<rfq id>/rfq/`) under the same random names, the same 2 GiB cap and the same sweeps.
2. **Attached to HIS current submitted quote.** The upload names `quote_id`; anything but his live submitted version is the withdraw
   route's one answer (409 `quote_closed` `{reason: "vendor"}`) - no oracle about other vendors' ids. The files stay with his vendor row
   when he submits a new version (the comparison shows `quote_version` per file). The quote path needs a submitted quote; files WITHOUT
   a quote go with a question (owner decision 4 below, second commit).
3. **No public read route.** The vendor gets his own list as text; nothing he uploaded is ever served back on the public listener, so the
   new surface is upload-only (one fewer place for a polyglot to be opened in the public origin).
4. **The manager's checks, reused - not re-implemented.** `rfq_files.store` with two parameters: `allow_webp=False` (decision 6 of
   CR-RFQ-ATTACHMENTS: WebP only for signed-in managers) and `semaphore=image_intake._DECODE` (the anonymous photo uploads' slot, so a
   vendor never makes a manager wait). The parsed office allow-list, the PDF trailing-bytes / ZIP-inside rules, the image pipeline and the
   office switch apply exactly as for a manager's file.
5. **Limits (smaller than the manager's, as proposed; administrator settings since the second commit - owner decision 3 below):** 5 live files, 10 uploads in all, 8 MiB picture / 10 MiB document, 20 MiB stored
   per vendor per request - removed files and thumbnails count (they stay on disk). Plus the edge: 12 uploads / h per link (spent at the
   body phase, so refused and `busy` uploads count too), 12 / 10 min and 30 / h per client network (counted at admission for every
   attempt, a valid token or not), one upload in flight per link, the upload memory budget, the 2 GiB cap before the body is read.
6. **Removal marks only.** The record of what a vendor sent stays until the purge (as a manager's file after quotes arrived); a removal
   frees a live place but gives back neither an upload nor bytes (no churn through remove / re-upload).
7. **Managers read with the comparison's rule** (visible + `tickets.costs.view`, audited 403) - a vendor's file is part of his quote and
   may carry prices. Always a download, a picture too (an `<img>` still shows a thumbnail; a click never opens a vendor's bytes inside the
   app's origin), nosniff, CSP `sandbox`, `private, no-store`. Office files from vendors also follow `allow_office` on the managers' side
   (off: left out of the list, 404 on read) - fail closed in both directions.
8. **No filename trust.** The multipart file part's filename is ignored (as on every public upload route); an optional `name` text field
   is a display name only, cleaned by `rfq_files.display_name`, and the extension is always the content's.
9. **No notification, no message.** The quote's own notification already tells the managers a vendor acted; a file is visible in the
   comparison. Timeline / audit rows carry ids and the kind only.
10. **Switch checked first.** While off, both routes answer the uniform 404 before the read-only / code answers, and the write
    transaction re-checks the switch (turning it off mid-upload ends in the uniform 404, the stored bytes deleted).

## Owner decisions on the open questions (2026-10-17, through the coordinator) - the second commit

1. **Visible on the work order: yes.** `POST .../awards/{award_id}/order` references every LIVE file of the awarded vendor row (quote
   and question files) in `ticket_rfq_vendor_file_refs` - no copy of the bytes. The ticket's `rfq_origin.vendor_files` lists them, and
   `GET /tickets/{ticket_id}/rfq-vendor-files/{fid}[/thumb]` serves them, only to a caller who holds `tickets.costs.view` on THAT ticket
   (others: `[]` and an audited 403), with the same serving rules (attachment, nosniff, CSP sandbox, private no-store). The drawer's
   "opened from RFQ" fact shows them as download links. A request purge keeps a referenced file (its `rfq_id` / `rfq_vendor_id` set NULL,
   the file kept), like the manager's files; the janitor drops a row nothing names. The vendor's handler page of the work order shows no
   vendor file (he has the originals) and no public route reads them.
2. **No notification: as built.**
3. **Limits as administrator settings** `rfq.vendor_uploads.max_files` / `max_uploads` / `max_image_mb` / `max_doc_mb` / `max_total_mb`
   (defaults 5 / 10 / 8 / 10 / 20). Hard upper bounds chosen and documented (contract 19.10): files 10, uploads 30 (never below files),
   picture 8 MiB (the image pipeline's own cap), document 10 MiB (the edge's body cap of the route), total 50 MiB. `settings_doc` refuses
   anything outside (422), the server clamps a stored value to the caps again (`rfq_vendor_files.Limits`), the edge keeps its 10 MiB +
   framing body cap and the pipeline its 8 MiB. Settings screen: a "קבצים מספקים" card (the switch + the five numbers, he / en) on the
   tickets settings page. **Arabic / Russian:** the manager app has only he / en catalogues, so the card has none; the VENDOR's card
   (`rfq-upload.ts`) has ar / ru marked "initial, needs native review" (the repository's convention).
4. **CHANGE - files with a QUESTION, no quote needed.** The upload takes EXACTLY ONE of `quote_id` / `message_id`; `message_id` must be one
   of HIS OWN inbound questions from the page (another vendor's, the organisation's answer, a WhatsApp reply, unknown: 409
   `question_not_found`). Same scanners, same request-state rules, ONE shared quota with the quote files, the same edge kind. Managers see
   them next to the question (the thread's `files`, the pending questions' `files`) and read them with the thread's rule (whoever sees the
   request); quote files keep the comparison's costs.view rule; no other vendor ever sees them. The vendor's card offers "a question with
   files" (the question goes through the existing message route first, then each file is bound to it); the quote path is unchanged.

## Deviations (recorded)

* **The comparison's "files" row, the drawer's vendor-file links, the thread's file links and the settings card are management-screen
  additions, not in an approved mock-up.** They reuse existing components / patterns; a design pass may move them. No hint paragraph was
  added on operator screens (owner rule); the settings card has the usual one-line sub-labels.
* **Bundle budgets** (the guards' method, a build into a scratch folder; the committed `www-public` was NOT rebuilt; the main checkout's
  node_modules linked, not a fresh `npm ci`): ticket page 62 337 B of 62 464; RFQ page + files 20 439 B of 20 480 (41 B headroom - the
  second commit added nothing there, all new vendor UI is in the lazy chunk); `rfq-upload` 4 043 B - its own cap raised from 4 KB to
  **5 KB** in both guards for the question-with-files UI (a chunk fetched only with the switch on).
* **Contact erasure:** this branch adds no erasure rule for a vendor's files. How the existing contact-erasure flow treats RFQ rows was NOT
  examined here; recorded for the review.
* **Pre-existing:** the drawer's `rfq_origin` block disappears once the request itself is purged (it needs the request's number), so
  referenced files - like the manager's referenced files - stay readable by their route but are no longer listed there.
* **The pending-questions card** (`rfq-questions.ts`) does not render the new `files` field yet; the thread dialog does.

## Open questions

None left from the first round. For the review: whether question files should also need `tickets.costs.view` (as built they follow the
thread's rule, because a question is not a price; a vendor could still put prices in a question file).

## Tests (this branch)

* Run locally (Windows, the repo venv, Python 3.12): `tests/test_tickets_rfq_vendor_uploads.py` (21 cases after the second commit) and the
  touched suites - see the branch report for the exact commands and results.
* Frontend: `npx tsc --noEmit` clean; node-only unit specs (`playwright.unit.config.ts`): `unit-rfq-vendor-upload`, `unit-public-rfq`,
  `unit-public-ticket`, `unit-rfq-attachments`, `unit-tickets-rfq`.
* NOT RUN: `evidence-public-rfq-upload.spec.ts` and every Playwright browser suite (screens desktop / mobile / RTL / dark,
  loading / empty / error / ready) - the runner was busy; the full backend suite on the runner; no real phone, browser or vendor test;
  **no security review yet (required before release)**.

## Rollback

Revert the branch; drop `ticket_rfq_vendor_file_refs` and `ticket_rfq_vendor_files`; the orphan sweeps then remove the vendor files under
`<data>/tickets/*/rfq/` that no `ticket_rfq_attachments` row names.
