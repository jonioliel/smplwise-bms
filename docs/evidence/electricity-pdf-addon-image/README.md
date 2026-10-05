# Electricity bill PDF inside the real add-on image (EL8, 2.0.1)

Produced by `scripts/addon_image/check_bill_pdf.sh` on the Ubuntu test runner (x86_64) at commit `8a5c13f5` of
`pilot/EL8-bill-pdf`: the add-on image rebuilt from `smplwise_vms/Dockerfile` (base `ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22`,
manifest digest in `report.txt`, Alpine 3.22.5, musl, Python 3.12.14) and everything below run INSIDE that tree. Fake data only.
Summary and the fixes it led to: `docs/architecture/ELECTRICITY_BILL_PDF.md` sections 4.2 and 8.0.

| File | Content |
|---|---|
| `report.txt` | Every step, PASS/FAIL, tail of each log |
| `image_size.json` | Base / baseline without the bill PDF additions / full tree: growth 33.4 MB (gate 60 MB) |
| `measurements.json` | Cold render child timings and peak memory in the image (x86_64; not the ARM gate) |
| `pytest_bill_pdf.log` | 156 passed, 0 skipped, with `SW_REQUIRE_BILL_PDF=1` |
| `addon_server.log`, `billing_settings.json` | The add-on's own `python3 -m smplwise`: start-up engine line and `pdf_engine` over HTTP |
| `native_libraries.log`, `aarch64_wheels.log` | Alpine packages of the stack; every requirement as an aarch64 musllinux wheel |
| `pdf/pipeline-*.pdf` | Bills produced through the whole add-on path (readings store -> billing -> `GET /bills/{id}/pdf`): draft, issued, copy |
| `pdf/bill-*.pdf` | The evidence samples of `docs/evidence/electricity-pdf/generate.py`, rendered in the image |
| `png/*.png` | Page images (110 dpi) used for the visual review |
| `pdf/*.txt` | `pdftotext -layout` of each PDF |

Visual review (Hebrew RTL): title, boxes, tables, numbers, dates, the shekel sign, the chart, the watermarks (draft/void/copy),
the missing-report note and the 4-page bill with repeated headers render correctly. Fixed after the review: wide logos ran off the
page, chart values were struck through by the last-year line, a dangling " · " when the contact line wrapped.
Open: `bill-name-outside-heebo` shows Cyrillic/Arabic as empty boxes (no system fonts in the image; the fpdf2 fallback drops them):
owner decision. The fpdf2 fallback (`bill-fallback-engine`) is plainer by design; in it the city part of the business address prints
in a heavier weight (a shaping run of the fallback, cosmetic).
