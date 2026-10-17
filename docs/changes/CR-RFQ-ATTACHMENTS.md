# CR-RFQ-ATTACHMENTS - files and pictures on a request for quotation

Status: built on `pilot/RFQATT` (from `integ/264` @ 75f41b19), 2026-10-17, not released. Contract: `docs/tickets/RFQ_BACKEND_CONTRACT.md`
v1.4 section 19. Migration: `0102_ticket_rfq_attachments.sql` (provisional 0104 on the branch; renumbered at the integ/264 integration).

## Owner request (2026-10-17)

"In a request for quotation the manager must be able to ATTACH FILES AND IMAGES so that as much detail as possible reaches the vendors we
want quotes from (photos of the site, plans, specs, PDFs)." With: drag / drop and the phone camera, an optional caption per file, removal
before sending; an allow-list (jpg / png / webp, PDF, docx / xlsx), strict size / count limits on the server, content sniffing, images
re-encoded metadata-free through the existing pipeline, non-images only as downloads with nosniff and a safe name; files belong to the
request and are copied by REFERENCE to the work order's request; deletion rules with audit rows (ids only); only the vendors selected for
the request see the files, through their existing signed link, uniform 404 otherwise, never listed publicly; the send preview lists what
each vendor receives; a per-file "visible to vendors" switch (default on); the vendor page shows thumbnails / a lightbox and download
buttons within the public bundle budgets; messages may say "N attachments" but never name a file or carry another URL.

## What was built

* Backend: `services/tickets/rfq_files.py` (the file side: kind by content, the office package checks, names, captions, storage, headers),
  `services/tickets/rfq_attach.py` (rows, permissions, visibility, removal, the order's references, the `{files}` text), store functions in
  `store_rfq.py`, the manager routes in `routers/tickets_rfq.py`, the vendor routes in `public_rfq.py` / `public_routes.py` (+ the edge's
  route table in `public_http.py`), WebP as an OPT-IN of `image_intake.reencode` (`allow_webp`, default False), the `{files}` placeholder in
  `message_templates.py`, the orphan sweep and folder rules in `store.py` / `deletion.py`, the purge and janitor in `store_rfq.py` /
  `rfq.py`, the reference copy in `rfq_orders.py`, a `body_limit` row.
* Manager UI: `<tickets-rfq-files>` (drop zone, picker, camera, caption, visible / internal, remove, thumbnails), in the new-request sheet
  (files kept locally and uploaded onto the draft right after it is created) and as a card on the vendors board; both send dialogs list
  exactly what each vendor receives (names, sizes, thumbnails) and how many internal files stay behind; the invitation preview shows the
  "N files" line.
* Vendor page: a lazy chunk `rfq-files-*` - thumbnails with a native `<dialog>` lightbox for pictures, download buttons for documents; also
  on the handler page of the service request a work order opened (only when it references files).
* Tests: `tests/test_tickets_rfq_files.py` (56 unit cases), `tests/test_tickets_rfq_attachments.py` (13 integration cases over the real
  store and the real public app), `frontend/tests/unit-rfq-attachments.spec.ts`; existing guards updated (see "Deviations").

## Decisions

1. **One table + a reference table, migration 0102 (provisional 0104, renumbered at integ/264).** `ticket_attachments` cannot be reused (its `ticket_id` is NOT NULL and
   its kind CHECK allows `photo` only; a rebuild would cascade). The files live in the SAME store (`<data>/tickets/<rfq id>/rfq/`, the 2 GiB
   cap, the orphan sweeps) - the sweeps were taught the `rfq` sub-folder and the request folders, otherwise they would have deleted them.
2. **Reference, not copy, at the work order.** `ticket_rfq_attachment_refs` (ticket, attachment). A purged request keeps the referenced
   files (`rfq_id` NULL); the janitor deletes a file nobody names.
3. **Removal:** deleted outright while no quote has arrived; after a quote arrived only MARKED removed (the record of what the vendors priced
   against), invisible to vendors at once. Always with a timeline row and an audit row in the same transaction ("no audit row, no removal").
4. **Same files for every invited vendor.** "Only vendors selected for that RFQ" = the invited vendors (a link exists only for them, a
   removed vendor's link is revoked). Per-vendor selection was not built; "visible to vendors" vs internal-only is the one switch.
5. **Files are editable while the request is a draft or collecting** (sent / collecting / due_passed), locked after an award, close or
   cancel. Adding a file after the send does not notify anyone automatically and never bumps the request's revision.
6. **WebP only for the signed-in manager's route.** The image pipeline refused WebP on purpose (decoder attack surface, CVE-2023-4863) for
   ANONYMOUS uploads; here only RFQ managers upload, the file is structure-walked first (still images only, metadata dropped, 8 MP), and
   the output is the same fresh JPEG. The public routes still refuse WebP.
7. **Office documents are accepted only as plain OOXML packages** (decision list in the contract 19.2): macros, ActiveX, embedded objects,
   external links / templates, DDE, DTDs, encryption, ZIP bombs and polyglot shapes are refused, never "cleaned". Legacy `.doc` / `.xls`,
   macro-enabled `.docm` / `.xlsm`, templates and anything else are not accepted. Like the invoice PDFs, this is a filter; the real control
   is that Arx never opens, renders or converts a document and serves it only as a download.
8. **Thumbnails are re-encoded from our own fresh JPEG** (480 px), never from upload bytes.
9. **Vendor downloads:** fetched with the token header (never a token in an address), handed to the browser as `application/octet-stream`
   so nothing renders inline; the server answers `Content-Disposition: attachment` + nosniff + the listener's CSP anyway.
10. **Messages:** `{files}` = a count text in the vendor's language; the order message does not carry it.

## Deviations (recorded, not silently resolved)

* **Contract section 17 (design, v1.2) said "no Office / archive / executable types at all" and "PDF: image | pdf only"; the owner's
  request (17.10) names docx / xlsx explicitly.** The owner request wins (an approved change request precedes the contract); section 17 is
  marked superseded by 19 and the structural checks above were added. Owner question 1 confirms it.
* **Section 17 proposed 10 MB per file; pictures stay at the pipeline's 8 MiB** (`image_intake.MAX_BYTES`, enforced inside `reencode`).
* **W20 (the public page never builds a link):** ONE reviewed exception in `public-ticket/rfq/rfq-files.ts` `save()` - an anchor that is
  never attached to the page hands a downloaded blob to the save dialog. `unit-public-rfq.spec.ts` now cuts exactly that function out and
  still applies every rule to the rest (and asserts there is only one such anchor and that it uses `application/octet-stream`).
* **Bundle guard:** the new lazy chunk `rfq-files-*` is counted in the RFQ page's 20 KB budget (`/^rfq-(page|files)[-.]/` in both guard
  copies), because a ticket link fetches it only when a work order referenced files. Measured with the guard's method on a build into a
  scratch folder (the committed `www-public` was NOT rebuilt): ticket page 62 024 B of 62 464 (61 KB), RFQ page 16 683 B of 20 480 (rfq-page
  14 834 + rfq-files 1 849). The ticket page's own growth: +166 B JS (the lazy hook) +83 B CSS.
* **Starter template `rfq_invite` changed** (a `{files}` line in he / en / ar / ru). Existing installations that EDITED that template keep
  their text (no `{files}` line) until they add the placeholder.
* **Migration number**: provisional 0104 on the branch; renumbered to 0102 at the integ/264 integration (contiguous 0101..0105).

## Open owner questions

1. Keep Word / Excel (with the refusal list above), or PDF + pictures only (section 17's original "refuse what cannot be proven simple")?
   a. keep docx / xlsx (built)  b. PDF + pictures only  c. keep, but internal-only by default for office files
2. Per-vendor files (e.g. a plan only for the electrician)?  a. no, the same files for all (built)  b. yes, a per-file vendor picker later
3. A file added AFTER the invitations went out:  a. silent, the manager writes if needed (built)  b. an automatic "new file" notice
   (`rfq_update`)  c. ask the manager each time
4. Vendor -> manager files (a PDF quote, a spec sheet on his quote - section 17 direction b):  a. not now (built)  b. next stage (a public
   upload route = a dedicated public-surface security review first)
5. The limits (10 files, 8 MiB picture / 10 MiB document, 40 MiB per request):  a. keep  b. other numbers
6. After a quote arrived, may a manager delete a file for good (not only mark it)?  a. no, mark only (built)  b. yes, with a reason in the
   audit row

## Tests (this branch)

* `tests/test_tickets_rfq_files.py`, `tests/test_tickets_rfq_attachments.py` and the touched existing suites - see the branch report for
  the exact commands and results.
* NOT RUN: the Playwright evidence / layout suites (screenshots desktop / mobile / RTL, loading / empty / error / ready) - runner jobs were
  out of scope for this task; no real phone, browser or vendor test; no security review of the new public read routes yet (they add no
  upload surface, but they are new public routes - a review is due before release).

## Rollback

Revert the branch; drop `ticket_rfq_attachments` and `ticket_rfq_attachment_refs`; delete `<data>/tickets/*/rfq/` (or let the orphan
sweep remove the folders once the rows are gone - note: the pre-RFQATT sweep would treat request folders as orphans and delete them,
which is the intended effect after a rollback).
