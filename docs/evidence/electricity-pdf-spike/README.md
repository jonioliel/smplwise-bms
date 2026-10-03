# Electricity bill PDF feasibility check (CR-023 P0)

Light spike on the Ubuntu test runner, 2026-10-04 (load was rising from about 2.5 to 13 during the run; timings are
therefore conservative). Fake data only. No device, no infrastructure, no product code.

Files: `render.py` (WeasyPrint bill with a locked URL fetcher and injection probes), `fpdf_fallback.py` (fpdf2 + uharfbuzz),
`alpine_size.py` (dependency closure from the public Alpine 3.22 package indexes), `spike.sh` (the driver),
`spike.out` (raw output of the run), `sample-1p.pdf` / `page1-1.png` (one-page bill), `sample-3p.pdf` / `page3-3.png`
(bill plus three daily tables, 5 pages), `fpdf-1p.pdf` / `fpdf-1.png` (fallback).

Re-run: copy the folder to a Linux machine with Python 3.12, `pdftotext`/`pdftoppm` and a repository checkout, then
`bash spike.sh <this folder> <repo checkout>`.

## Results

| Item | Result | How it was established |
|---|---|---|
| Hebrew RTL layout with Heebo | Correct: right-aligned blocks, table column order, mixed Hebrew + numbers, `₪`, `״` | Rendered PDF, page image `page1-1.png`, `pdftotext` (logical order) |
| Fonts embedded | Heebo subsets embedded (`pdffonts`: CID TrueType, emb yes, sub yes) | `spike.out` |
| Render time, WeasyPrint 70.0, amd64 | 1 page: 0.20-0.27 s warm; 1.41 s cold in a fresh process (including the 0.82 s import). 5 pages: 0.61-1.24 s | `render.json` part of `spike.out` |
| Memory | Peak RSS 88 MB (10 renders in one process), 62 MB for a cold single render | `/usr/bin/time` |
| PDF size | 18 KB (1 page), 29 KB (5 pages) | file sizes |
| Locked URL fetcher | Refused `http://`, `https://` and `file:///etc/hostname`; render still finished | `blocked_urls` |
| Injection strings | `<script>`, `<img src=http://...>`, `url(http://...)` printed as text | page image |
| Wheels for Alpine (musllinux_1_2), Python 3.12 | All 16 wheels exist for **x86_64 and aarch64** (WeasyPrint stack, fpdf2, uharfbuzz, Pillow 12.3.0 as pinned by the add-on): no compiler needed | `pip download --only-binary=:all: --platform musllinux_1_2_<arch>` |
| System packages on Alpine 3.22 | Pango 1.56.3 on both architectures. With the add-on's current `poppler-utils` (which already pulls cairo, fontconfig, freetype, harfbuzz, fribidi, glib) `apk add pango` adds only `pango` + `libxft`: 0.7 MB (x86_64) / 0.9 MB (aarch64) installed | Public APKINDEX files, dependency closure |
| Python packages size | About 42 MB installed (fontTools 29 MB, Pyphen 6.3 MB, WeasyPrint 3 MB, zopfli 2.7 MB, others small) | venv `du` on the runner (glibc wheels; musl wheels are of the same order: 22 MB download for both sets) |
| Estimated image growth | about 45 MB uncompressed (below the 60 MB gate of the plan) | sum of the two lines above |
| fpdf2 fallback | Works: Hebrew shaped and right-aligned with uharfbuzz, 0.035 s; tables and page breaks would be manual | `fpdf-1.png` |

## Not proven (needs the real image)

- No Docker on the runner, so the add-on image (`ghcr.io/home-assistant/{amd64,aarch64}-base-python:3.12-alpine3.22`) was
  **not built**; WeasyPrint was **not run on musl/Alpine** and **not run on aarch64** at all.
- Render time and memory on the owner's ARM hardware are unknown; the amd64 numbers above are not a proxy for a small ARM board.
- The base image's own package list was not subtracted, so the size numbers are an upper bound for the system packages and
  an estimate for the Python packages.
- Fonts: the spike used static instances cut from the product's Hebrew/Latin WOFF2 subsets with two fallback families; the
  product should bundle full Heebo TTF instances. Glyph coverage beyond the bill text was not checked.
- `pdftotext` shows bidi control marks around runs; the order is logical, but golden-text tests must normalise them.
- Detail for P3: in table cells WeasyPrint placed `₪` on the left of the amount (the usual RTL reading of "497.35 ₪");
  decide the house style once.

## Plan for the open part (P3, first task)
Build the add-on image with `apk add pango` and the pinned wheels for amd64 and aarch64 (CI with QEMU, or any machine with
Docker buildx), run `render.py` inside both images, record image growth (`docker image inspect`) and render times on
aarch64. Gate: growth ≤ 60 MB and ≤ 5 s for a 3-page bill on aarch64. If WeasyPrint fails the gate, switch to fpdf2 (the
layout code is the main extra cost).
