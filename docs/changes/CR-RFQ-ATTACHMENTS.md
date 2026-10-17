# CR-RFQ-ATTACHMENTS - files and pictures on a request for quotation

Status: built on `pilot/RFQATT` (from `integ/264` @ 75f41b19), 2026-10-17; hardened after the Fable security review
(`private/planning/RELEASE_264_REVIEW_RFQATT.md`, F1..F10) on `pilot/RFQATT-FIX`, 2026-10-17; not released. Contract:
`docs/tickets/RFQ_BACKEND_CONTRACT.md` v1.5 section 19. Migration: `0104_ticket_rfq_attachments.sql` - **PROVISIONAL number**, the lead renumbers at integration.

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

1. **One table + a reference table, migration 0104 (provisional).** `ticket_attachments` cannot be reused (its `ticket_id` is NOT NULL and
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
7. **Office documents are accepted only as plain OOXML packages, and only while the installation setting
   `rfq.attachments.allow_office` is on (OFF by default - decision 11).** After the review (F1 / F2) the checks PARSE every XML part
   with expat (character references decoded, a DTD refused anywhere, every relationship judged whatever its tag length, Word field codes
   joined across their runs, every spreadsheet formula location) and allow-list the parts by `[Content_Types].xml`: anything not on the
   list - altChunk MHT / HTML, data connections, query tables, external pivot caches, Power Query, EMF / WMF / SVG, embedded fonts,
   unknown types - is refused, never "cleaned" (contract 19.2 has the list). Legacy `.doc` / `.xls`, macro-enabled `.docm` / `.xlsm`,
   templates and anything else are not accepted. Like the invoice PDFs, this is a filter; the real control is that Arx never opens, renders
   or converts a document and serves it only as a download. An unusual but harmless document may be refused: save it as PDF.
8. **Thumbnails are re-encoded from our own fresh JPEG** (480 px), never from upload bytes.
9. **Vendor downloads:** fetched with the token header (never a token in an address), handed to the browser as `application/octet-stream`
   so nothing renders inline; the server answers `Content-Disposition: attachment` + nosniff + `private, no-store` + the listener's CSP
   (`default-src 'none'; ...`) anyway. Correction (review F7): the route's own `Content-Security-Policy: sandbox` reaches only the INTERNAL
   API (the remote channel keeps a route CSP); the public edge replaces every route CSP with the listener's, which is at least as strict for
   a download. `test_document_headers_leaving_the_real_public_listener` asserts the bytes that leave the edge.
10. **Messages:** `{files}` = a count text in the vendor's language; the order message does not carry it.
11. **Word / Excel behind an installation switch (owner question 1, decided by the lead 2026-10-17: "keep, default off until the
    hardening is verified").** `rfq.attachments.allow_office` in `tickets.settings` (`PUT /tickets/settings` `{"rfq": {"attachments":
    {"allow_office": true}}}`, `system.configure`, audited `tickets.settings.update`). Off: upload -> 422 `office_disabled` before the scan
    (audited `denied`); `meta.attachment_limits.types` without `docx` / `xlsx` (+ `office: false`), so the form hides them from the picker
    and refuses them by name before upload; office files already attached stop travelling to vendors and work orders until it is on again
    (fail closed); managers still see them. PDF and pictures never depend on it. No settings card exists for the RFQ settings, so the
    switch has no UI card yet (API only) - recorded.
12. **PDF structure (review F3):** nothing but whitespace after the last `%%EOF` and no ZIP directory inside (the PDF/ZIP polyglot is now
    refused by rule, not incidentally); an office package with `%PDF-` in its first KiB or another format's magic in its first entry's
    header is refused. The shared invoice check (`cost_files.check_pdf`) is unchanged - the stricter rules apply to RFQ files only.
13. **Public read budget (review F4):** the two full-file public routes use a new edge kind `file_read` (20 / min, 60 / h per link; at
    most ~600 MiB an hour from one link instead of ~20 MB/s); thumbnails stay on `photo_read`. The Cloudflare side (no "Cache Everything" on
    `/support/api/*`, a rate rule for the file paths) is in the user guide's part 7.
14. **Hygiene (review F6 / F9):** the storage cap's cached size is told about every stored RFQ file and thumbnail and credited on delete /
    purge; the upload route refuses the role / state / quota before the `visible_vendors` form check; the office scan runs inside the
    route's decode slot (429 `busy` when taken).

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
* **Migration number 0104 with 0101..0103 unused** on integ/264 (as the owner asked for a provisional 0104); `release_check` contiguity will
  flag it until the lead renumbers.

## Owner questions - answered (lead decision 2026-10-17, after the Fable review)

1. Keep Word / Excel, or PDF + pictures only? -> **keep, but behind the installation setting `rfq.attachments.allow_office`, OFF by
   default until the hardening (F1 / F2) is verified** (decision 11). The reviewer's (c) "internal-only by default" was replaced by a
   switch that keeps office files away from vendors entirely while off.
2. Per-vendor files? -> **(a) the same files for all invited vendors** (as built; a per-vendor picker would be a second visibility rule on
   the same public route and needs its own review).
3. A file added after the invitations went out? -> **(a) silent** (as built; the manager writes if needed).
4. Vendor -> manager files? -> **(a) not now** (as built; a public upload route needs its own public-surface review).
5. The limits? -> **(a) keep** 10 files, 8 MiB picture / 10 MiB document, 40 MiB per request (as built), plus the public read budget of
   decision 13.
6. Delete for good after a quote arrived? -> **(a) mark only** (as built).

## Review findings (RELEASE_264_REVIEW_RFQATT.md) - disposition

| Finding | Disposition |
|---|---|
| F1 regex over raw XML (character references, padding, split DDE runs, formulas outside cells, DOCTYPE late) | FIXED - expat parse, decoded values, joined field codes, every formula location, DTD anywhere; built counterexamples in `test_tickets_rfq_files.py` |
| F2 part allow-list gaps (altChunk, connections, query tables, pivot connections, EMF / WMF / fonts) | FIXED - content-type allow-list + refused relationship types / elements / names |
| F3 PDF polyglot incidental; office head; ZIP64 docstring | FIXED - trailing-bytes and ZIP-inside rules, office head rule; ZIP64 wording corrected (not refused: read by `zipfile`, judged from the directory) |
| F4 public read bandwidth | FIXED - edge kind `file_read`; Cloudflare rate rule documented |
| F5 ticket viewers read referenced vendor-visible files without RFQ visibility | RECORDED as design (contract 19.3 / 19.6); office files additionally stop travelling while the switch is off |
| F6 storage cap accounting | FIXED |
| F7 `sandbox` CSP never reaches the public side | DOCUMENTED (contract 19.2, decision 9) + a header test on the real public listener |
| F8 Cloudflare cache / rate guidance, checklist 5.11 | FIXED in the user guide part 7 and the checklist row |
| F9 refusal order; caption `max_length=2000`; office scan without the decode slot | FIXED order and slot; caption form cap left at 2000 (raw text is cleaned before the 200 limit, so a lower form cap would refuse captions that clean to <= 200; the 422 comes from one place either way) |
| F10 thumbnail `blob:` URLs not revoked on the vendor page | NOT FIXED - it would grow the public ticket page (about 440 B headroom); ten 480 px thumbnails per page view are small and freed with the page |

## Tests (this branch)

* `tests/test_tickets_rfq_files.py`, `tests/test_tickets_rfq_attachments.py` and the touched existing suites - see the branch report for
  the exact commands and results. `pilot/RFQATT-FIX`: the review's evasion shapes are BUILT as real packages in the tests (character
  references, a 5000-space / 6000-character Relationship, split / referenced / nested-QUOTE DDE fields in document and header parts,
  `definedName` / validation / conditional-format / `xm:f` formulas, a DOCTYPE behind 10-20 KiB of comment or in UTF-16, altChunk MHT /
  HTML / RTF / text parts also under innocent names, connections / query tables / external pivot caches / DataMashup, EMF / WMF / SVG,
  embedded fonts, PDF + small ZIP, PDF + ZIP + re-appended `%%EOF`, a ZIP inside a PDF stream, `%PDF-` / picture magic in an office head);
  each was run against the previous module and failed there (accepted or wrong code) before the fix.
* NOT RUN: the Playwright evidence / layout suites (screenshots desktop / mobile / RTL, loading / empty / error / ready) - runner jobs were
  out of scope for this task; no real phone, browser or vendor test; no security review of the new public read routes yet (they add no
  upload surface, but they are new public routes - a review is due before release).

## Rollback

Revert the branch; drop `ticket_rfq_attachments` and `ticket_rfq_attachment_refs`; delete `<data>/tickets/*/rfq/` (or let the orphan
sweep remove the folders once the rows are gone - note: the pre-RFQATT sweep would treat request folders as orphans and delete them,
which is the intended effect after a rollback).
