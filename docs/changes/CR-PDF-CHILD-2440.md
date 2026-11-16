# CR-PDF-CHILD-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-PDF-CHILD-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; finding 04:F11.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`).

## What and why

The render children of the building report and the temperature report were copies of each other, and so were their
parents. The shared parts now exist once, next to the bill PDF they were borrowed from. No behaviour change: same
command line (`python -s -m smplwise.services.<engine>`), same scrubbed environment, same process group, same
timeout and kill, same page / size / memory limits, same exit codes, same log texts.

1. **The child (`services/bill_pdf_engine.py`).**
   - `render_html_weasyprint(page_html, max_pages)`: the WeasyPrint step over a ready HTML page.
   - `run_report_job(job, weasyprint, fpdf2)`: the engine choice with its fallback (a refusal is never retried on
     the other engine).
   - `child_main(run, selfcheck=None)`: the child's entry (network lock, one JSON job on stdin, resource limits,
     PDF on stdout, `engine=<name>` on stderr, exit 3 for a refusal). The bill child's own `main()` is
     `child_main(run_job, self_check)`; only it answers a `selfcheck` job, as before.
   - `services/building_report_engine.py` and `services/temperature_pdf_engine.py` keep their own `render_fpdf2`,
     the name `render_weasyprint` (now the shared function), `run_job(job)` and `main()`. The two renderers are read
     from the module at each job, so a test that patches them still works.
2. **The parent (`services/bill_pdf.py`).** `run_report_child(job, timeout_s, *, module, what, error, logger)`: the
   launch both reports share. `building_report_pdf._run` and `temperature_pdf._run` are one-line calls to it with
   their module, their log name and their own `PdfError`. The bill's own `_run_child` is unchanged (its error codes
   and its `retryable` flag differ).

## Files

Changed: `smplwise_vms/backend/smplwise/services/bill_pdf.py`, `bill_pdf_engine.py`, `building_report_pdf.py`,
`building_report_engine.py`, `temperature_pdf.py`, `temperature_pdf_engine.py`.
New: `smplwise_vms/backend/tests/test_pdf_child_2440.py` (engine choice and fallback, the child entry of all three
engines, the parent launch: command line, environment, outcome mapping, timeout kill).

Outside my rows: none.

## Tests actually run

See the end of this file (filled after the run).
