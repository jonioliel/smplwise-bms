# Electricity bill PDF (CR-023 P3) - renderer interface, security and image notes

Owner: `pilot/elec-pdf`. Callers: `pilot/elec-billing` (issue, draft preview, re-render), `pilot/elec-server` (routes).
Input contract: `docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md` v1 (`arx.energy.bill_snapshot/1`), section 5.
Status: built and tested on the Ubuntu runner (amd64, glibc) and, since EL8 (2.0.1), inside the real add-on image for amd64
(Alpine 3.22, musl, rebuilt from the Dockerfile without Docker): 156 tests, the add-on's own start-up and the evidence renders pass
there. aarch64 is checked for installability only (every wheel exists); running it needs emulation - see section 8.

## 1. Call

```python
from smplwise.services.bill_pdf import render_bill_pdf, bill_pdf_filename, BillPdfError, BillSnapshotError
pdf: bytes = render_bill_pdf(snapshot, logo=None, watermark=None)   # blocking, ~1-2 s
name: str = bill_pdf_filename(snapshot["bill"]["number"])           # "bill-2026-12-0001.pdf", "bill-draft.pdf"
```

- `snapshot`: the parsed snapshot JSON, exactly as stored. The renderer prints stored values and never recomputes a total.
- `logo`: the logo bytes (PNG or JPEG) or `None`. They are decoded and re-encoded inside the renderer (section 5). A logo that
  fails the checks is dropped and the bill still renders (the logo is decoration); `sanitize_logo(bytes) -> bytes` and
  `LogoError(code)` are exported so the settings upload can refuse a bad logo up front with the same rules (codes:
  `logo_empty`, `logo_too_large` (over 1 MB), `logo_type` (not PNG/JPEG by magic bytes: SVG, GIF, PDF ... refused),
  `logo_dimensions` (over 25 megapixels), `logo_undecodable`).
- `watermark`: `None` | `"draft"` | `"void"` | `"copy"` (printed "טיוטה" / "בוטל" / "העתק", diagonal on every page). A snapshot whose
  `bill.state` is `draft` is always marked "draft", whatever is passed. "void" also prints the line "חשבון זה בוטל ואינו בתוקף".
- The call is blocking (it starts a child process): call it from a worker thread (`anyio.to_thread.run_sync`) in async routes.
  It is safe to call concurrently; the server should still limit it (plan: 10 renders per minute per user).
- Errors: `BillSnapshotError` (ValueError; malformed snapshot, a caller bug, not retryable) and `BillPdfError(code, retryable)`:

| code | meaning | HTTP suggestion |
|---|---|---|
| `pdf_render_failed` | child failed, crashed, was out of memory, or returned no PDF | 503, retryable (`pdf_render_failed` of the plan) |
| `pdf_timeout` | exceeded the wall-clock limit (default 20 s) | 503, retryable |
| `pdf_page_limit` | more than 40 pages | 422, not retryable (the bill itself is beyond the limit) |
| `pdf_too_large` | output over 10 MB | 422, not retryable |

## 2. Printed content (approved A4 mockup)

Header: title and "אינו חשבונית מס" (from `doc`), bill number (or "טיוטה"), "מחליף את <number>" on a correction, issue date,
business name, registration number, address, phone, email and the logo. Boxes: customer (name, address, customer number,
account) and period (from - to as FROM date TO date, number of days, tariff name, due date; a draft shows the expected due date).
Big total. Meters table (name, start reading, end reading, consumption, share, billed kWh; a sub-meter is "−", a 30% share "30%";
readings print as stored, 3 places, one trailing zero trimmed). Formula sentence. Charges table (one row per price/VAT segment, the
period of each when there are several, price per kWh before VAT, amount), subtotal, VAT per rate, a "הפרשי עיגול" row only when the
per-rate VAT does not add up to the stored VAT total, total. Notes: the price-mode note, "readings are cumulative meter readings",
the previous period's consumption (only when the directly preceding period is present and complete), the server's data notes
(`notes[].text_he`, dates and decimals laid out left-to-right), the business footer note under "הערות:". A meter that did not report
up to the end (`reported_to_end: false`) is starred in the table and gets a framed note with the server's sentence; if that sentence
does not contain the last report date the renderer appends it ("תאריך הדיווח האחרון: dd.mm.yyyy HH:MM", account time zone).
Footer on every page: "עמוד X מתוך Y", "הופק ב-SmplWise Arx", first 12 hex of the snapshot hash (sha256 of the canonical JSON, computed here
with the documented rule, because the stored hash is not part of the snapshot itself).

## 3. History chart (owner round 3)

Drawn from `snapshot.history` as an inline SVG bar chart (no JavaScript, no external resource) above the notes, kept in one block
(never split across pages), with a numbers table under it as the accessible fallback (period from-to and kWh, three pairs per row).

- Bars, oldest at the left, newest (the current period) at the right, then the same period last year as the last bar. At most the 12
  latest previous periods. Bar label = month.year of the period's last day; value above the bar.
- Black-and-white safe: current = accent colour fill with a heavy black outline and bold value; previous = light grey with a thin
  outline; last year = diagonal hatching plus a dashed reference line across the chart; partial data (`status: "partial"`) = dashed
  outline and a "+" after the value ("a lower bound"), explained in the legend.
- Never invented: entries with `kwh: null` (status missing), duplicates, negative values and periods that overlap or follow the
  current one are dropped; missing months leave a gap in the sequence rather than a zero bar. If nothing remains (no previous
  periods and no last year) the whole chart, legend and table are omitted. A zero value draws no bar, not a negative one.
- Hebrew text is HTML around the SVG; the SVG itself contains only digits and Latin (labels `MM.YY`, values).

## 4. Engine and fallback

WeasyPrint 70.0 (HTML + CSS to PDF, Pango/HarfBuzz/FriBidi shaping and bidi) with Heebo; fpdf2 2.8.9 + uharfbuzz as the fallback
(plan decision, spike result: WeasyPrint recommended). `SW_BILL_PDF_ENGINE` = `auto` (default: WeasyPrint, and fpdf2 when the
WeasyPrint stack cannot load or render, e.g. a missing Pango library on the image) | `weasyprint` | `fpdf2`. A hard limit (page
cap, size cap) never falls back. The fallback layout is plainer (no boxes, a simple bar chart without hatching/partial marks,
bold faked by an outline); it prints the same facts. If the owner wants only one engine, delete the other and the `auto` branch.

Template: one server-side HTML string builder (`bill_pdf_html.py`), stdlib `html.escape` on every value, its own small CSS; no
Jinja2 (the plan left this open: a new dependency was not needed). A4 portrait, RTL, `@page` margin boxes for page numbers, running
element for the hash, repeated table headers (`thead` as header group), rows never split. Numbers, dates and codes are `.n`
spans (`direction: ltr; unicode-bidi: isolate`) inside the RTL text. House style for the shekel sign: after the number
("497.35 ₪"), as in the mockup. Fonts: Heebo 400/700 as TTF, Hebrew and Latin subsets, bundled with its OFL (section 7).

### 4.1 Integration (2026-10-04): engine self-check and the 5-second fallback

- Owner round 4: in `auto`, the WeasyPrint render gets `SW_BILL_PDF_FALLBACK_S` (default 5 s, 1-60); when it runs out the child is
  killed and the bill is rendered again with fpdf2 under the normal time limit. Only when the total limit is larger than the
  fallback budget; an explicit engine never falls back; hard limits (pages, size) never fall back. Counted in `slow_fallbacks`.
- `bill_pdf.self_check()` runs once at start-up (background thread from `main.create_app`; `SW_BILL_PDF_SELFCHECK=0` turns it off,
  the tests do): a tiny render in the isolated child reports which engine can render here. Logged (INFO for WeasyPrint, WARNING
  when the simple engine is active, ERROR when none works) and exposed by `bill_pdf.engine_status()` as `pdf_engine` in
  `GET /energy/billing-settings` and as `pdf.engine` on every bill, so a silent fallback to fpdf2 is visible.
- The billing seam (`services/energy_billing_pdf.py`) calls `render_bill_pdf` and maps the errors: `pdf_render_failed`,
  `pdf_timeout` -> 503 retryable; `pdf_page_limit`, `pdf_too_large` -> 422; a malformed snapshot -> 503 `pdf_render_failed`, not
  retryable. Failures are recorded as bill events and shown as `pdf.state = failed`.
- The logo upload of the business settings uses `sanitize_logo` (the same rules as at render time).

### 4.2 Found in the add-on image (EL8, 2.0.1)

- **The self-check crashed in the image, so the add-on refused every bill PDF.** The image has no system font at all (Alpine, no
  font package). The self-check rendered a bare `<p>` without the bundled `@font-face` rules, Pango found no font and the child died
  (`pango_font_get_hb_font: assertion 'PANGO_IS_FONT (font)' failed`). Result in 2.0.0: start-up log "NO PDF engine works",
  `pdf_engine.active = null`, and `energy_billing_pdf._real()` then answers every `GET /bills/{id}/pdf` with 503 `pdf_unavailable` -
  although a real bill (bundled Heebo) renders fine in the same image. The runner never showed it because it has system fonts.
  Fix: the self-check page uses the bill's own CSS and fonts (`bill_pdf_html._css`), Hebrew + digits + Latin + the shekel sign.
  Regression: `test_self_check_finds_weasyprint_on_a_system_without_fonts` reproduces the image on any Linux with an empty
  fontconfig (`FONTCONFIG_FILE`), red before the fix.
- **A crashed WeasyPrint child now falls back to fpdf2 in `auto`.** Before, the child's own fallback only covered Python errors; a
  native crash (or the memory limit) gave 503. Now `render_bill_pdf` renders again with fpdf2 when the `auto` child returns
  `pdf_render_failed` (counted as `crash_fallbacks`, logged as a warning, visible in `pdf_engine` and `pdf.engine`), and
  `self_check` asks for fpdf2 alone when the WeasyPrint check dies without an answer (detail "weasyprint self-check crashed: ...").
  Page and size limits never retry; an explicit engine never falls back.
- **Wide logos ran off the page.** `.logo` was `height: 17mm; width: auto; max-width: 34mm`, and WeasyPrint kept the natural width
  of a wide logo (400 x 120 px -> 57 mm), past the left page edge. The printed size is now computed from the re-encoded logo's
  pixel size, fitted into 34 x 17 mm by its aspect ratio (`logo_box_mm`; numbers computed in code, never data text), with
  `max-width/max-height` as the CSS fallback. Regression: `test_logo_of_any_shape_stays_inside_the_page_margins` (rasterised page,
  the outer 12 mm must stay white; red for 400 x 120 and 800 x 60 before the fix).
- **Visual polish from the review:** chart values of bars near the last-year line were struck through by the dashed line; they now
  sit on a white plate (only when the line exists). Phone and e-mail are separated by an em space instead of " · ", so a wrap next
  to a wide logo no longer leaves a dangling dot at the end of the line.

## 5. Security

- No network: the child process replaces `socket.connect/getaddrinfo/create_connection` with refusals at start-up, and WeasyPrint is
  given a *closed* URL fetcher (`LockedFetcher`, not derived from WeasyPrint's urllib-based fetcher) that serves only `bill-asset:<one of
  four font names>` and `bill-logo:logo.png` (the re-encoded logo, only when one exists). `http`, `https`, `file`, `data`, `ftp`,
  relative paths, traversal, unknown names are refused and counted. The HTML never contains another URL anyway.
- No HTML from data: every person-written value (names, addresses, notes, meter and tariff names, business details, footer note, even
  title text) goes through `html.escape` once and only into element text; the accent colour must match `#rrggbb` or the default is used;
  no attribute, style, href or src is built from data. Control characters and bidi overrides/isolates (U+202A-202E, U+2066-2069) are
  stripped; lengths are capped (names 200, lines 300, notes 2000); line counts are capped (meters 400, charge lines 24, history 24,
  notes 40); an over-limit snapshot is refused, never silently truncated.
- Logo: decoded with Pillow restricted to PNG/JPEG, size <= 1 MB, <= 25 megapixels, scaled to <= 800 px, EXIF/text chunks dropped by
  rebuilding the pixels, re-encoded as a new PNG. The raw upload never reaches WeasyPrint.
- Resource limits (child process, own session/process group; only this child's group is ever signalled): wall-clock timeout 20 s
  (`SW_BILL_PDF_TIMEOUT_S`, 1-120), address space 1536 MB (`SW_BILL_PDF_MEMORY_MB`, 256-8192), CPU seconds = timeout + 5, output file size
  limit, pages <= 40 (`SW_BILL_PDF_MAX_PAGES`, 1-200), PDF <= 10 MB. The limits are applied by the child itself at start (a `preexec_fn`
  in the parent would not be thread-safe in the web server). The environment passed to the child is scrubbed (no tokens, no proxy
  variables; only PATH, PYTHONPATH, HOME=/tmp, locale and font-config paths). Child stderr is logged truncated, never returned to callers.
- The PDF contains no `/URI`, `/JavaScript`, `/Launch`, `/EmbeddedFile` or `/OpenAction` (asserted on a hostile snapshot).
- Filenames: `bill_pdf_filename()` accepts only the bill-number format and maps `/` to `_`; anything else gives `bill-draft.pdf`.
  Serve with `Content-Disposition: attachment` and that name only.
- WeasyPrint's own log is silenced (it would echo user strings); no data is written outside the child's memory and Python's temporary
  font files.

## 6. Tests (backend/tests/test_bill_pdf.py, 75 tests; fake data in tests/bill_pdf_samples.py)

Model validation and limits; hash rule; local time of the last report; escaping and bidi stripping; logo (PNG, JPEG with EXIF,
transparency, SVG/GIF/PDF/garbage refusals, size, decompression bomb); chart (present, trimmed to 12, omitted, partial, gaps,
missing, partial marks, irregular periods, zero values); fetcher allow-list (14 hostile URLs) and a WeasyPrint run that tries
http/https/file/data; socket denial; golden renders (A4 size, one page, Heebo embedded in every font, phrase text and section order
by word position, digits in logical order, draft/void/copy/revision/missing-report, VAT split with a rounding row, price-mode note,
mixed Hebrew + digits + Latin, long unbroken names wrapping inside the margins, hostile strings printed as text with no active PDF
objects, empty and minimal snapshots, a 150-meter bill with repeated headers and "עמוד X מתוך Y" on every page); fpdf2 fallback and the
automatic fallback; timeout kills and reaps the child; page cap; limits parsing and clamping; memory and file-size limits of the child;
scrubbed environment. Render tests skip with a stated reason when WeasyPrint or poppler is missing (Windows workstation): they ran on
the runner. `pdftotext` shows Hebrew in logical order with bidi marks around runs; tests strip the marks.

EL8 added: logo box (sizes, printed style, any logo shape inside the margins on the rasterised page), value plates on the chart, and
`tests/test_energy_bill_pdf_pipeline.py` - the whole add-on path with the REAL renderer: real readings store -> billing engine ->
snapshot -> `GET /bills/{id}/pdf` -> child -> PDF, then A4, embedded Heebo only, no active PDF objects, Hebrew phrases and digits in
order, the chart labels, the snapshot hash in the footer, stored once and byte-identical, a watermarked copy; the self-check on a
system without fonts; the crash fallback of renders and of the self-check; the engine reported by the billing settings.
`SW_REQUIRE_BILL_PDF=1` (set by the image check) turns every "WeasyPrint/poppler missing" skip into a failure and requires the active
engine to be WeasyPrint. `SW_BILL_PDF_EVIDENCE_DIR` keeps the pipeline PDFs for the visual review.

## 7. Fonts

`backend/smplwise/assets/bill/fonts/`: `Heebo-he-{400,700}.ttf` (Hebrew subset), `Heebo-la-{400,700}.ttf` (Latin subset), `OFL.txt` (SIL OFL 1.1,
copyright line of the Heebo project), `README.txt` (provenance: the product's own WOFF2 subsets converted to static TrueType with fontTools).
Total 67 KB. These are subsets, not the complete Heebo; characters outside Hebrew, Latin, digits and common punctuation are not covered
(none is printed by the layout; user text outside those scripts would show missing-glyph boxes). Listed in `THIRD_PARTY_NOTICES.md`
("Heebo - SIL OFL 1.1"); the OFL text travels with the fonts.

## 8. Add-on image

### 8.0 Verified on the real image (EL8, 2.0.1, amd64)

`scripts/addon_image/check_bill_pdf.sh` (runner, `sudo -n`, no Docker) rebuilds the add-on image with `scripts/addon_image/addon_rootfs.py`:
the base image is pulled from the registry exactly as `BUILD_FROM` names it (OCI distribution API, zstd layers, whiteouts, paths
resolved inside the tree), and the Dockerfile's RUN steps are replayed in a chroot inside a private mount namespace (`unshare --mount`,
nothing is mounted on the host), COPY/WORKDIR/ENV applied. It builds a second tree without the bill PDF additions (no `pango`, no
`weasyprint`/`fpdf2`/`uharfbuzz`) to measure the growth, then runs inside the full tree. Evidence: `docs/evidence/electricity-pdf-addon-image/`.

| Check (inside the image unless stated) | Result |
|---|---|
| Base image | `ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22`, Alpine 3.22.5, Python 3.12.14, musl |
| pip installs only wheels (no compiler) | yes, all `musllinux_1_2_x86_64` or pure Python |
| Native stack | pango 1.56.3, harfbuzz 11.2.1, fribidi 1.0.16, cairo 1.18.4, fontconfig 2.15.0, freetype 2.13.3, poppler-utils 25.04.0; `/usr/share/fonts` does not exist |
| Image growth for the bill PDF (gate 60 MB) | **33.4 MB** (baseline 489.6 MB -> 523.1 MB, apparent size of the unpacked tree incl. `.pyc`) |
| WeasyPrint 70.0 loads and renders | yes (warning "No fonts configured in FontConfig" is expected: fonts are bundled) |
| Engine self-check | WeasyPrint, 0.33 s (after the fix in 4.2; before it: "no PDF engine") |
| Evidence samples (generate.py) | all render; 1 page 0.51 s, 4 pages 1.03 s, fpdf2 0.36 s / 0.67 s (median of 5 cold children), peak RSS 77.5 MB |
| Tests with `SW_REQUIRE_BILL_PDF=1`: test_bill_pdf, test_energy_bill_pdf_pipeline, test_energy_integration, test_energy_billing_api, test_energy_billing_engine | 156 passed, 0 skipped |
| The add-on's entry point `python3 -m smplwise` in the tree | start-up log "bill pdf engine: WeasyPrint (self-check 0.33 s)"; `GET /api/v1/energy/billing-settings` over HTTP: `pdf_engine.active = weasyprint` |
| aarch64 installability | every requirement has a `musllinux_1_2_aarch64` (or pure Python) wheel |
| Visual review (110 dpi pages in the evidence folder) | Hebrew RTL, digits, dates, the shekel sign, the chart and the watermarks correct; three layout defects found and fixed (4.2) |

Not verified here: **running on aarch64** (needs qemu-user + binfmt on the runner, a host change the owner has not approved; or a
Docker host with buildx) and the **5-second gate on the owner's ARM hardware** (step 5 below). The real `docker build` itself was not
run (the replay follows the same Dockerfile; differences would be in Docker-only behaviour such as layer metadata, not in files).

Previously listed changes and the manual Docker steps (still valid on a machine with Docker):
- `smplwise_vms/Dockerfile`: `apk add ... pango` added to the existing `apk add` line (poppler-utils already pulls cairo, fontconfig, freetype,
  harfbuzz, fribidi, glib; the spike measured pango + libxft at 0.7 MB on x86_64 and 0.9 MB on aarch64 on top of that).
- `smplwise_vms/backend/requirements.txt`: `weasyprint==70.0`, `fpdf2==2.8.9`, `uharfbuzz>=0.50,<1`. All wheels exist for musllinux_1_2 on
  x86_64 and aarch64 (spike: `pip download --only-binary=:all:`), so no compiler is needed in the image.

NOT VERIFIED (no Docker on the runner; steps for the lead, on any machine with Docker buildx and QEMU, or in CI):
1. Build both images: `docker buildx build --platform linux/amd64 -t arx-test:amd64 --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22 smplwise_vms`
   and the same for `linux/aarch64` (`--platform linux/arm64`, `aarch64-base-python`). Expect the pip step to download wheels only.
2. Image growth: `docker image inspect --format '{{.Size}}' arx-test:<arch>` for the image at `main` and at `pilot/elec-pdf`; gate: growth <= 60 MB.
   Runner estimate (glibc wheels, `--no-compile`): WeasyPrint stack +41 MB, fpdf2 + uharfbuzz +6 MB, pango +1 MB, fonts 0.07 MB = about 48 MB;
   the Docker pip step also writes `.pyc` files, which can add several MB, so the margin to 60 MB is narrower than it looks. If it is over:
   drop the fpdf2 fallback (-6 MB), install with `pip --no-compile`, delete `fontTools` sub-packages the renderer never imports.
3. Libraries load on musl: `docker run --rm arx-test:<arch> python -c "import weasyprint; from weasyprint import HTML; print(len(HTML(string='<p>x</p>').render().pages))"`
   (fails with `cannot load library 'libpango-1.0-0'` if a library is missing; the renderer would then fall back to fpdf2 silently, so also run step 4).
4. Render inside the image with the real code (mount the repository; the script and the tests use the mounted code):
   `docker run --rm -v "$PWD:/w" arx-test:<arch> sh -c 'cd /w/smplwise_vms/backend && python ../../docs/evidence/electricity-pdf/generate.py /w/out-<arch>'`
   then compare `out-<arch>/*.txt` with `docs/evidence/electricity-pdf/*.txt` (same text) and run `pdffonts` on a PDF (Heebo embedded). Then the
   golden tests: `docker run --rm -v "$PWD:/w" arx-test:<arch> sh -c 'pip install pytest && cd /w/smplwise_vms/backend && python -m pytest -q -o addopts= tests/test_bill_pdf.py'`
   (the conftest also needs the add-on's normal requirements, which the image has); no test may be skipped for "WeasyPrint not importable".
5. Timing on the target: a 4-page bill (`bill-3-pages` in generate.py) must be <= 5 s on the owner's ARM hardware; record `measurements.json` there.
   Runner numbers (x86_64, glibc, 16 cores, load 4): cold child, 1 page 0.81 s, 4 pages 1.42 s (median of 5); fpdf2 0.39 s / 0.85 s; peak RSS 78 MB.
   Guess, not a measurement: a small ARM board may be several times slower per core, so step 5 is the real gate and may need the
   fpdf2 engine (`SW_BILL_PDF_ENGINE=fpdf2`) or a smaller font/CSS footprint.
6. Alpine specifics to watch: fontconfig warning about an empty font directory (harmless: fonts are served from the package); `pyphen`
   hyphenation dictionaries are installed but not used (`hyphens: manual`); WeasyPrint finds libraries by soname through the default musl paths.

## 9. Decisions and open points for the owner/lead

- House style for the shekel sign: "497.35 ₪" as in the mockup (spike note asked for one decision). Change in `with_shekel` if wanted.
- Image size gate is tight (section 8, step 2): decide whether the fpdf2 fallback is worth its ~6 MB.
- Time gate on ARM is unmeasured; if missed, choose between the fpdf2 engine and a lighter layout.
- Third-party notices: `THIRD_PARTY_NOTICES.md` at the repository root (Heebo OFL 1.1, the WeasyPrint / fpdf2 / uharfbuzz stack), added at integration.
- Fonts are subsets: a customer name in Arabic, Russian, Cyrillic etc. would show missing glyph boxes. Tell me if full Heebo (about 100 KB per weight more) or a fallback font family is wanted.
  EL8 measured this in the image (`bill-name-outside-heebo`): Cyrillic and Arabic print as empty boxes there (on the runner they came
  from the system fonts, so the old evidence hid it), and the fpdf2 fallback silently drops those characters. Full Heebo would not help
  (Heebo has no Cyrillic or Arabic); the options are a bundled Noto Sans subset for Cyrillic (+ Noto Sans Arabic), or refusing such
  names at input. Still open for the owner.
- Snapshot suggestion for billing: store the pre-computed `snapshot_sha256` inside the row (already so) and also let the PDF print it instead of
  recomputing; today the PDF prints the first 12 hex of the same canonical hash, so they match as long as the canonical rule is unchanged.
