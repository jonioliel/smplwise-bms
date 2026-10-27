# CR-SUPPLIERDOCS-297 - reading supplier documents, slice 1 (certificates, text-layer PDFs, proposals decided field by field)

Status: BUILT on `pilot/SUPPLIERDOCS-297` (from `release/2240` @ `b6996284f`, v2.24.0), switch OFF by default. Builds on
`docs/changes/CR-OCR119.md` (the design) and the 2026-10-27 build plan (PDFOCRSPEC-297). **PROVISIONAL**: the owner questions
q52-q56 are still open; this slice follows the recommended answer of each (table below), and every one of them sits in one constant
or one function so a different answer is a small change.

## What is built

| Part | Where |
|---|---|
| Ports (seams) with null implementations: text-layer reader, OCR reader (tier 2, not built), model extractor (tier 3, not built) | `smplwise/services/docread/ports.py` |
| Tier-1 text source: poppler `pdftotext -layout` (already in the add-on image) as a hardened child - prechecks, private temp directory, generated name after `--`, minimal environment, OS resource limits, 20 s timeout, page cap via `-l 11`, 1 MiB output cap, whole-tree kill (see "Child process security model" below) | `smplwise/services/docread/pdftext.py` |
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
* No OCR (tier 2), no model (tier 3), no invoices / quotes / service reports, no screen, no per-user rate limit / global queue yet,
  no filesystem sandbox (`bwrap` / `nsjail`) for the child. **A security review of the reader boundary gates switching
  `docread.enabled` on in any release** (F4 closed on `pilot/SUPPLIERDOCS-F4-297`; the Linux run of its tests is the lead's gate).

## Child process security model (security review F4, `pilot/SUPPLIERDOCS-F4-297`)

`pdftext.PdftotextReader` treats poppler as a parser of hostile input:

1. **Prechecks before any child starts** (pure Python, linear scans): size <= 10 MiB, `%PDF-` header and `%%EOF`, no `/Encrypt`
   dictionary (no password prompts, no attempts), declared page count (`/Pages` `/Count`, else the number of `/Type /Page`
   objects) <= 10. A refused file never reaches the tool.
2. **No user-controlled path or name**: the checked bytes (not the stored file again) are written as the generated name `in.pdf`
   into a fresh private `sw-docread-*` temp directory that is the child's working directory and is removed afterwards; the
   argument list is fixed and ends `-l 11 -- in.pdf -`. No shell, `close_fds`, stdin from the null device, stderr discarded.
3. **Scrubbed environment**: `minimal_env()` (no `SUPERVISOR_TOKEN`, no secret, no proxy variable), `HOME` / `TMPDIR` = the
   private directory.
4. **Resource limits**, per operating system (`pdftext.enforcement()` reports them):

   | Control | POSIX (add-on, Linux runner) | Windows (developer workstation) |
   |---|---|---|
   | Wall-clock timeout (20 s, max 30) | yes | yes |
   | Output cap (1 MiB, child killed at cap + 1) | yes | yes |
   | Memory | `RLIMIT_AS` 512 MiB | Job Object process + job memory 512 MiB |
   | CPU time | `RLIMIT_CPU` 20 s (SIGXCPU, then SIGKILL) | Job Object per-process user time 20 s |
   | Child processes | `RLIMIT_NPROC` 0 (**not enforced when the add-on runs as root**) | Job Object: one active process |
   | File writes | `RLIMIT_FSIZE` 0 | **not enforced** |
   | Open files | `RLIMIT_NOFILE` 32 | **not enforced** |
   | Core dumps | `RLIMIT_CORE` 0 | n/a (die on unhandled exception, no WER dialog) |
   | Whole-tree kill | own session (`start_new_session`), `os.killpg(SIGKILL)` at timeout / cap / end, the leader kept unreaped until the group kill | `TerminateJobObject` + kill-on-job-close; if no Job Object can be created or assigned: timeout + `taskkill /T /F` (logged as a warning) |
   | Filesystem confinement, network block, seccomp | **not enforced** (runs as the add-on user; poppler opens no network or other file by itself) | **not enforced** |

   POSIX limits are set by a `python -I -S` trampoline on itself, which then `exec()`s the tool (no `preexec_fn`: not thread-safe in
   the web server - the `bill_pdf_engine.apply_limits` pattern). If a required limit cannot be set, it exits 125 and nothing is read
   (fail closed). On Windows the child is created suspended, put into the job, and only then resumed.
5. **Degrade, never fail**: every outcome is a `TextResult` - refused, encrypted, malformed, timeout, output cap, killed by a limit,
   non-zero exit, an unexpected exception in the reader - and the read is stored as `failed` (`unreadable` / `too_many_pages` /
   `timeout`) with a `docread.read` audit row whose details carry a short `reason` (`encrypted`, `malformed`, `file_too_large`,
   `output_too_large`, `killed`, `limits_failed`, `reader_error`, ...). Only a missing binary keeps the 503 `reader_unavailable`
   (audited, nothing stored), as before.

Tests: `tests/test_docread_f4_297.py` (fake binaries: oversized output, huge page count, hanging tool, grandchild tree kill,
malicious file names, missing binary, encrypted / malformed / oversized PDF, limits passed; POSIX-only rlimit / session test and
Windows-only Job Object test; real `pdftotext` with a hostile file name when installed).

## Privacy

The row stores parsed candidates and <= 80-character scrubbed snippets, never the document text. The audit (`docread.read`,
`docread.field`, `docread.discard`) holds ids, counts, field names and decisions, never a value. Drafts are deleted 14 days after
the last activity and at once when their file is removed (`janitor`, hourly). Fixtures are synthetic: invented suppliers, numbers
and dates; nothing from `private-evidence/`.

## Security review (SUPPLIERDOCS2-297, 2026-10-27)

Scope: `routers/docread.py`, `services/docread/*`, migration `0182_doc_extractions.sql`, the `docread.enabled` switch, the
maintenance file intake it reads from (`services/maintenance/files.py`, `tickets/cost_files.check_pdf`). Code review plus regression
tests on fakes and the local `pdftotext`; no device, no lab, no real supplier document.

| # | Severity | Finding | Status / exact fix |
|---|---|---|---|
| F1 | **High** (only while enabled) | ReDoS in the snippet scrubber: the IBAN pattern `(?:[ ]?[A-Z0-9]{2,4}){3,}\b` partitions a run of capitals exponentially before a failing `\b` (36 capitals + a lower-case letter = 0.25 s, x4 per 4 characters; the 80-character snippet = hours). A crafted line next to any label in an attached PDF froze the request - and the rules ran in `store()`, **inside the database write lock**, so the whole add-on stopped writing. | FIXED: one character per repetition `\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b` (linear); the rules now run in `service.analyse()` inside `unlocked()` together with the child, `store()` only writes. Tests `test_f1_*`. |
| F2 | Medium | `subprocess.run(capture_output=True)` buffered the WHOLE stdout before the 1 MiB check: a decompression-bomb PDF could make the add-on hold hundreds of MiB for up to 20 s. | FIXED: `pdftext.run_capped()` reads at most cap + 1 bytes, kills the child at the cap or the deadline, stderr to DEVNULL (never logged), `env=minimal_env()`, stdin closed. Test `test_f2_*` (real child processes). |
| F3 | Medium | No bound on concurrent reads: a manager could discard + read in a loop and run any number of `pdftotext` children and rule passes at once (CPU / memory). | FIXED: `READ_CONCURRENCY = 2` non-blocking slots; a third read answers 429 `busy` (retryable), nothing stored, reader not called. Test `test_f1_the_rules_run_outside_..._f3_reads_are_bounded`. A per-user rate limit stays for the hardening slice. |
| F4 | Medium (gates enabling) | The child has no RLIMITs (address space, CPU, file size), no new session / process-group kill, and runs as the add-on user with read access to the data folder. poppler parses an untrusted file; a parser memory bug would run with those rights (no secret in its environment). | **CLOSED** 2026-10-28 on `pilot/SUPPLIERDOCS-F4-297` (SUPPLIERDOCS-F4-297): `pdftext.run_limited()` - POSIX trampoline sets `RLIMIT_AS` 512 MiB, `RLIMIT_CPU` 20 s, `RLIMIT_FSIZE` 0, `RLIMIT_NOFILE` 32, `RLIMIT_NPROC` 0, `RLIMIT_CORE` 0 then execs the tool in its own session, group killed with `os.killpg`; Windows Job Object (memory, CPU, one process, kill on close) with a `taskkill /T` fallback; prechecks (size, header, `/Encrypt`, page count) before the call; generated name in a private temp dir after `--`; every failure a stored, audited `failed` read. See "Child process security model". Tests `tests/test_docread_f4_297.py` (Windows run 2026-10-28; the POSIX rlimit test runs only on Linux - lead's runner gate). Residual: no filesystem / network sandbox (`bwrap` / `nsjail` not in the image), `RLIMIT_NPROC` void as root. |
| F5 | Low | `GET /maintenance/docread/module` needs only a signed-in user and the maintenance module (no `maintenance.view`): it tells any user whether reading is on and which text reader exists. | OPEN, low value. Fix: `Viewer(conn, p).require_anywhere(VIEW)` in `module_gate`. |
| F6 | Low | Proposals of a soft-deleted TASK (files still attached) stayed in the table until their 14-day retention (invisible, but kept). | FIXED: `purge()` also deletes rows whose task is deleted. Test `test_f6_*`. |
| F7 | Low | Edited values are length-capped and stripped of control / bidi characters but otherwise free text (`=cmd|...`, `<script>`). Harmless in JSON; dangerous later in a CSV/XLSX export or a non-escaping renderer. | OPEN for the apply / screen slice: render as text only; prefix `'` on `= + - @` cells in any spreadsheet export. |
| F8 | Info | Read route answers 409 `docread_kind_not_supported` before the 403 manage check, so a view-only user learns the task kind (which the task view already shows). | Accepted. |
| - | OK | Upload type / size / path: no upload route here; the file came through the maintenance intake (`%PDF-` + `%%EOF`, no active content / encryption, <= 10 MiB; images re-encoded, <= 8 MiB / 16 MP). Stored names are server-generated `<task>/<16 hex>.pdf`; `path_of` checks the pattern and confinement; the URL ids are pattern-bound and never form a path; `pdftotext` gets an absolute path (no option injection) and `-l 11`. | Tightened by F4: the tool now gets only the generated name `in.pdf` after `--` in a private temp directory. |
| - | OK | RBAC: every route passes principal -> module -> switch (uniform 404) -> `maintenance.manage` (read, decide, discard; audited 403) or `maintenance.view` (look) on the task's own target -> the visibility rule; a proposal is shown only while its task is visible and its file attached; the file must belong to the task in the URL. Switch: `system.configure`, audited. | No change. |
| - | OK | Tenant / scope isolation: one installation; scope is the task's floor / building / site target, enforced through `Viewer.holds_where`; `live_for(file_id)` is reached only after the file was proven to belong to the visible task. | No change. |
| - | OK | Injection: every SQL value is a bound parameter (the one f-string only builds `?` placeholders); `FieldName` is a `Literal`; the body forbids extra keys. SSRF: none - no network, model or URL anywhere; poppler fetches nothing. | No change. |
| - | OK | Secrets / privacy in logs: no logging in the module; stderr discarded; the audit has ids, counts, field names, decisions and the engine name, never a value or the text; the child gets `minimal_env()` (no `SUPERVISOR_TOKEN`); the table is never in a project backup. | No change. |

Enabling: keep `docread.enabled` OFF in releases until the F4 tests have passed on Linux (the runner gate; fixed on
`pilot/SUPPLIERDOCS-F4-297`) and the owner questions q52-q56 are answered. The switch default is unchanged (OFF).
F5 and F7 should land with the screen / apply slice.

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
