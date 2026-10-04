# Electricity bill PDF - evidence (CR-023 P3)

Generated on the Ubuntu test runner (x86_64, glibc, Python 3.12.3, WeasyPrint 70.0, fpdf2 2.8.9) from branch `pilot/elec-pdf`
by `generate.py` (fake data only: `smplwise_vms/backend/tests/bill_pdf_samples.py`). Each sample has the PDF, a page PNG (70 dpi),
and the `pdftotext -layout` text. `measurements.json` holds the timings and memory of the real child-process path.
These are **not** Alpine/musl and **not** aarch64 results: see `docs/architecture/ELECTRICITY_BILL_PDF.md` section 8.

| Sample | What it shows |
|---|---|
| `bill-issued` | Issued bill, logo, two meters (one 30% share), previous 11 periods + current + same period last year |
| `bill-draft` | "טיוטה" watermark, no number, expected due date |
| `bill-void` | "בוטל" watermark and the cancellation line |
| `bill-revision` | Corrected bill `2026-09-0001-2`, "מחליף את 2026-09-0001" |
| `bill-missing-meter-note` | A meter that did not report: star in the table, framed note with the last report date, other server notes |
| `bill-no-chart` | First bill ever: no history, so no chart at all |
| `bill-chart-partial-data` | A gap month, a partial month ("500+", dashed), partial last year, only existing bars drawn |
| `bill-3-pages` | 120 meter lines, 4 pages, repeated table header, "עמוד X מתוך Y" |
| `bill-fallback-engine` | The fpdf2 fallback (plainer layout, same facts) |

Measured here (median of 5 cold child processes, load 3-6): WeasyPrint 1 page 0.81 s, 4 pages 1.42 s, peak memory of the child about 78 MB;
fpdf2 0.39 s and 0.85 s. PDF sizes 18-45 KB. Python packages added to the image: about 41 MB (WeasyPrint stack) + 6 MB (fpdf2, uharfbuzz)
measured as unpacked glibc wheels without byte-code; pango adds about 1 MB (spike); fonts 67 KB.
