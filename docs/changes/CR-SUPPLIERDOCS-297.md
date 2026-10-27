# CR-SUPPLIERDOCS-297 - reading supplier documents, slice 1 (certificates, text-layer PDFs, proposals decided field by field)

Status: BUILT on `pilot/SUPPLIERDOCS-297` (from `release/2240` @ `b6996284f`, v2.24.0), switch OFF by default. Builds on
`docs/changes/CR-OCR119.md` (the design) and the 2026-10-27 build plan (PDFOCRSPEC-297). **PROVISIONAL**: the owner questions
q52-q56 are still open; this slice follows the recommended answer of each (table below), and every one of them sits in one constant
or one function so a different answer is a small change.

## What is built

| Part | Where |
|---|---|
| Ports (seams) with null implementations: text-layer reader, OCR reader (tier 2, not built), model extractor (tier 3, not built) | `smplwise/services/docread/ports.py` |
| Tier-1 text source: poppler `pdftotext -layout` (already in the add-on image), minimal child environment, 20 s timeout, page cap via `-l 11`, 1 MiB output cap | `smplwise/services/docread/pdftext.py` |
| Deterministic certificate rules: supplier, document number, issue date, expiry date, scope / standard. Hebrew + English label anchors, RTL layout (label after the value), date formats incl. Hebrew / English month names, validity ranges, visual-order Hebrew recovery (capped `low`), snippet scrubbing (id / company numbers, bank accounts, card-like numbers), tax id cut from the supplier name | `smplwise/services/docread/certificate_rules.py` |
| Storage: proposals only, decisions per field, retention, janitor | `smplwise/services/docread/service.py`, migration `0182_doc_extractions.sql` (renumbered from the provisional 0180 on `pilot/SUPPLIERDOCS2-297`: `release/2241` holds 0180 external access codes and 0181 door-window write; the release check requires contiguous numbers) |
| API (6 routes, inventory regenerated) | `smplwise/routers/docread.py` |
| Switch `docread.enabled` (default `"false"`, `system.configure`, audited `docread.enable` / `docread.disable`) | `smplwise/routers/settings.py` |
| Backup: `doc_extractions` is never exported (drafts tied to `maint_files`, which do not travel either) | `smplwise/services/backup.py` |

Gating order of every route: signed-in -> `maintenance.enabled` -> `docread.enabled` -> permission -> the task's visibility rule.
Reading and deciding need `maintenance.manage` on the task (audited 403); looking needs `maintenance.view`. Only files already
attached to a `certificate` / `vendor_document` task are read: no upload route, no read at upload time, nothing public.

## API contract (for the confirmation screen of a later slice)

* `GET /api/v1/maintenance/docread/module` -> `{enabled, kinds:["certificate"], fields:[...5], text_reader, ocr:false, model:"none", confirm:"per_field", provisional:true}`.
* `POST /api/v1/maintenance/tasks/{task_id}/files/{file_id}/read` -> 201 a new proposal; 200 the live proposal of the same file
  (no second read); 503 `reader_unavailable` when no `pdftotext` is installed (nothing stored); 409 `docread_kind_not_supported`
  for other task kinds. A picture -> state `needs_ocr` / `ocr_not_available`; a PDF without a text layer -> `needs_ocr` /
  `no_text_layer`; `failed` with `unreadable` / `too_many_pages` (> 10) / `timeout`. Never a 500 for a bad file.
* `GET /api/v1/maintenance/tasks/{task_id}/files/{file_id}/extraction` -> the live proposal or null.
* `GET /api/v1/maintenance/docread/extractions/{id}` -> the proposal. Each field: `proposed`, `confidence` (`high|medium|low|none`,
  a label, never a percentage), `evidence` (the label it was found next to), `snippet` (<= 80 chars, scrubbed), `status`
  (`proposed|confirmed|edited|rejected`), `value` (the person's final value), `decided_by_name`, `decided_at`.
* `PUT /api/v1/maintenance/docread/extractions/{id}/fields/{field}` body `{decision: confirm|edit|reject, value?, revision}` - ONE
  field. `confirm` takes no value and needs a proposed one (422 `docread_nothing_to_confirm`); `edit` needs a value (dates
  `YYYY-MM-DD`, text <= 120, document number <= 60, control / bidi characters stripped); `reject` takes none. 409
  `revision_conflict` on a stale revision. When all five fields are decided the state becomes `reviewed`.
* `POST /api/v1/maintenance/docread/extractions/{id}/discard` -> state `discarded`, values deleted at once; the file may be read again.
* **There is no "approve all" route** (tested: `confirm`, `approve`, `confirm-all`, `approve-all`, `apply` answer 404/405; field
  `all` is 422).

The UI contract: one control per field (confirm / edit / reject), the document beside the fields, the confidence chip and the
evidence; no bulk action. No screen is built in this slice.

## What this slice deliberately does NOT do

* It does not write the decided values into the task (`due_date`, `doc_type`, ...). Applying a `reviewed` proposal through the
  existing task edit / renewal path with the person's own permission is the next slice (CR-OCR119 S2 "targets").
* No OCR (tier 2), no model (tier 3), no invoices / quotes / service reports, no screen, no rate limit / global queue yet,
  no process RLIMITs / process-group kill for the child (CR-OCR119 S4 hardening). **A security review of the reader boundary
  gates switching `docread.enabled` on in any release.**

## Privacy

The row stores parsed candidates and <= 80-character scrubbed snippets, never the document text. The audit (`docread.read`,
`docread.field`, `docread.discard`) holds ids, counts, field names and decisions, never a value. Drafts are deleted 14 days after
the last activity and at once when their file is removed (`janitor`, hourly). Fixtures are synthetic: invented suppliers, numbers
and dates; nothing from `private-evidence/`.

## Decisions that still depend on the owner

| Question | Built as (recommended answer) | Where to change it |
|---|---|---|
| q52 which document first | certificates (`KINDS = ("certificate",)`) | `services/docread/service.py`; the table already accepts invoice / quote / service_report |
| q53 OCR in the first version | text-layer PDFs only; scans / pictures -> `needs_ocr` | `ports.OcrReader` + `service.set_ocr_reader` |
| q54 external or LAN model | not allowed: the port exists with a null implementation only | `ports.ModelExtractor`, `service.MODEL` |
| q55 field by field or "approve all" | field by field, no bulk route | `routers/docread.py` (a bulk route would be an addition) |
| q56 real redacted samples | synthetic only; real accuracy is UNKNOWN | rules in `certificate_rules.py`, fixtures in the tests |
| CR-OCR119 q10 retention | 14 days after the last activity | `service.RETENTION_DAYS` |
| CR-OCR119 q12 switch default | OFF | `routers/settings.py` DEFAULTS |
| Date reading | numeric dates day-first (Israel); day/month both <= 12 -> `medium` | `certificate_rules.find_dates` |
