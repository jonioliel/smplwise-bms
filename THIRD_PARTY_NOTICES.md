# Third-party notices

This file lists third-party components that are bundled with SmplWise Arx or installed into its add-on image, with their
licenses. It was started at the electricity integration (CR-023, bill PDF) and covers that part first; other components are
added as they are reviewed. Versions are the ones pinned in `smplwise_vms/backend/requirements.txt` (or resolved by pip on the
test runner on 2026-10-04 for transitive packages); re-check them whenever the pins change.

## Bundled files

| Component | Where | License |
|---|---|---|
| Noto Sans and Noto Sans Arabic fonts (subsets: Cyrillic, Arabic; weights 400 and 700; files `NotoSans-cy-*.ttf`, `NotoSansArabic-ar-*.ttf`) - Copyright 2012 Google Inc., Noto Project Authors (https://github.com/notofonts) | `smplwise_vms/backend/smplwise/assets/bill/fonts/` (the bill PDF, names in Cyrillic or Arabic; since 2.0.2) | SIL Open Font License 1.1 - full text in `smplwise_vms/backend/smplwise/assets/bill/fonts/OFL.txt`. Modified (subset) versions; "Noto" is a Reserved Font Name, so the files carry the `-cy` / `-ar` names and are not distributed as "Noto" |
| Heebo font (subset: Hebrew and Latin, weights 400 and 700, converted to TrueType) - Copyright 2016 The Heebo Project Authors (https://github.com/OdedEzer/heebo) | `smplwise_vms/backend/smplwise/assets/bill/fonts/` (the bill PDF) and `frontend/public/fonts/` (the UI) | SIL Open Font License 1.1 - full text in `smplwise_vms/backend/smplwise/assets/bill/fonts/OFL.txt`, which travels with the fonts. Modified (subset, converted) versions; "Heebo" is not a Reserved Font Name |

## Python packages of the electricity bill PDF (installed from PyPI into the add-on image)

| Package | Version | License | Role |
|---|---|---|---|
| WeasyPrint | 70.0 | BSD-3-Clause | the PDF engine (HTML + CSS to PDF) |
| pydyf | 0.12.1 | BSD-3-Clause | PDF writer used by WeasyPrint |
| tinycss2 | 1.5.1 | BSD-3-Clause | CSS parser used by WeasyPrint |
| cssselect2 | 0.10.1 | BSD-3-Clause | CSS selectors used by WeasyPrint |
| tinyhtml5 | 2.1.0 | MIT | HTML parser used by WeasyPrint |
| webencodings | 0.6.1 | BSD-3-Clause | used by tinycss2 |
| Pyphen | 0.18.1 | GPL-2.0-or-later OR LGPL-2.1-or-later OR MPL-1.1 (tri-licensed; used here under LGPL-2.1-or-later) | hyphenation dictionaries pulled in by WeasyPrint (not used by the layout: `hyphens: manual`) |
| fontTools | 4.66.1 | MIT | font subsetting inside WeasyPrint |
| brotli | 1.2.0 | MIT | WOFF2 support of fontTools |
| zopfli | 0.4.3 | Apache-2.0 | font compression of fontTools |
| cffi | 2.1.1 | MIT-0 | binding of WeasyPrint to Pango |
| fpdf2 | 2.8.9 | LGPL-3.0-only | the fallback (simple) PDF engine; used unmodified as a separate library |
| uharfbuzz | 0.56.2 (pin `>=0.50,<1`) | Apache-2.0 (bundles HarfBuzz, "Old MIT" license) | Hebrew text shaping for fpdf2 |
| defusedxml | 0.7.1 | PSF-2.0 | XML parsing in fpdf2 |
| Pillow | 12.3.0 (already a dependency) | MIT-CMU | logo decoding and re-encoding |

## System libraries of the add-on image (Alpine packages)

`pango` was added to the image for the bill PDF (`smplwise_vms/Dockerfile`); it brings or reuses HarfBuzz (Old MIT), FriBidi
(LGPL-2.1-or-later), cairo (LGPL-2.1 or MPL-1.1), fontconfig and FreeType (FreeType License or GPL-2.0), GLib (LGPL-2.1-or-later)
and Pango itself (LGPL-2.1-or-later). They are dynamically linked system libraries installed by the distribution's package manager;
their license texts ship in the image under the packages' own directories.

NOT VERIFIED: the real add-on image (Alpine 3.22, amd64 and aarch64) has not been built with these packages yet; the versions of
the Alpine packages are therefore not recorded here (see docs/architecture/ELECTRICITY_BILL_PDF.md section 8).

## Components reviewed in the T005 refresh (2026-10-31, v2.29.0)

Full inventory, versions and the licence analysis: `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md` sections 1-2.

| Component | Where | License |
|---|---|---|
| paramiko 5.1.0 (+ bcrypt, PyNaCl: Apache-2.0; invoke: BSD-2-Clause) | add-on image (PyPI), SFTP off-box backups | LGPL-2.1; used unmodified as a separate library |
| lit 3.3.3 / lit-html / lit-element / @lit/reactive-element / @lit-labs/ssr-dom-shim | the web UI bundle | BSD-3-Clause |
| three 0.186.1 (including `three/addons` OrbitControls, GLTFExporter, RoundedBoxGeometry) | the web UI bundle (3D plans) | MIT |
| qrcode-generator 1.4.4 | the web UI bundle | MIT |
| Heebo UI fonts (woff2) | `frontend/public/fonts/`, `smplwise_vms/www/fonts/` | SIL OFL 1.1 - `OFL-Heebo.txt` next to the files |
| Lobby fonts: Bodoni Moda, David Libre, Frank Ruhl Libre, IBM Plex Mono, IBM Plex Sans Hebrew | `frontend/public/fonts/lobby/`, `smplwise_vms/www/fonts/lobby/` | SIL OFL 1.1 - one `OFL-*.txt` per family |
| Plan Studio 6 models and textures (Kenney and others) | `smplwise_vms/www/plan3d/` | CC0-1.0 - per-file source and hash in `plan3d/MANIFEST.json` |
| WisKey command / error catalogue rc37-contract.4 | `docs/integrations/wiskey/catalog/rc37-contract.4/` | MIT (`LICENSE` in that folder) |
| WisKey embed-api-v1 reference client (adapted as `frontend/src/wiskey/embed-connector.ts`) | the web UI bundle | MIT - WisKey root LICENSE, confirmed by the WisKey team 2026-10-31 (sample SHA256 d3324a40...); full notice below and in `frontend/src/wiskey/LICENSE-embed-api-v1.txt` |
| AndroidX (appcompat, activity-ktx, webkit, core-splashscreen, biometric), Material Components | the Android shell APK | Apache-2.0 |

## WisKey embed-api-v1 reference client - MIT notice

Arx adds its own changes in `frontend/src/wiskey/embed-connector.ts`; those changes are not relicensed by this notice.

```
MIT License

Copyright (c) 2026 Hikvision Intercom Manager contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
