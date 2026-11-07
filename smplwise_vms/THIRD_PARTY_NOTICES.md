# Third-party notices

This file lists the third-party components that are bundled with SmplWise Arx or installed into its add-on image, with their
licences. SmplWise Arx itself is proprietary (`LICENSE`, all rights reserved); the components below keep their own licences and
nothing in `LICENSE` restricts the rights those licences give.

Full inventory, licence analysis, vulnerability scans and findings: `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`.
Last complete re-check: **2026-11-06 at v2.40.5** (T005-AUDIT-2406). Python versions are the ones pinned in
`smplwise_vms/backend/requirements.txt`, or for range pins and transitive packages the ones pip resolved from PyPI on that date
(CPython 3.12); the Supervisor resolves the same file again when it builds the image, so a range pin can resolve higher there.
`smplwise_vms/backend/tests/test_third_party_notices.py` fails when a direct requirement, a web UI runtime package or a
vendored licence file is missing here.

## Bundled files

| Component | Where | License |
|---|---|---|
| Noto Sans and Noto Sans Arabic fonts (subsets: Cyrillic, Arabic; weights 400 and 700; files `NotoSans-cy-*.ttf`, `NotoSansArabic-ar-*.ttf`) - Copyright 2012 Google Inc., Noto Project Authors (https://github.com/notofonts) | `smplwise_vms/backend/smplwise/assets/bill/fonts/` (the bill PDF, names in Cyrillic or Arabic; since 2.0.2) | SIL Open Font License 1.1 - full text in `smplwise_vms/backend/smplwise/assets/bill/fonts/OFL.txt`. Modified (subset) versions; "Noto" is a Reserved Font Name, so the files carry the `-cy` / `-ar` names and are not distributed as "Noto" |
| Heebo font (subset: Hebrew and Latin, weights 400 and 700, converted to TrueType) - Copyright 2016 The Heebo Project Authors (https://github.com/OdedEzer/heebo) | `smplwise_vms/backend/smplwise/assets/bill/fonts/` (the bill PDF) | SIL Open Font License 1.1 - full text in `smplwise_vms/backend/smplwise/assets/bill/fonts/OFL.txt`, which travels with the fonts. Modified (subset, converted) versions; "Heebo" is not a Reserved Font Name |
| Heebo UI fonts (woff2) | `frontend/public/fonts/`, `smplwise_vms/www/fonts/` | SIL OFL 1.1 - `OFL-Heebo.txt` next to the files |
| Lobby fonts: Bodoni Moda, David Libre, Frank Ruhl Libre, IBM Plex Mono, IBM Plex Sans Hebrew | `frontend/public/fonts/lobby/`, `smplwise_vms/www/fonts/lobby/` | SIL OFL 1.1 - one `OFL-*.txt` per family |
| Plan Studio 6 models and textures (Kenney and others) | `smplwise_vms/www/plan3d/` | CC0-1.0 - per-file source and hash in `plan3d/MANIFEST.json` |
| WisKey native integration `hikvision_intercom` 2.0.1-rc.10 (source-pinned in `smplwise_vms/integration/hikvision_intercom.pin.json`; 389 files including its panel bundle, audio worklet, Heebo font and JSON schemas) - Copyright (c) 2026 Hikvision Intercom Manager contributors | `smplwise_vms/integration/hikvision_intercom/` (shipped in the add-on image, staged into Home Assistant by `services/wiskey_auto_install.py`) | MIT - `LICENSE` in that folder; its panel bundle lists the BSD-3-Clause lit notices in `frontend/panel.js.LEGAL.txt`; its Heebo font carries `frontend/OFL.txt` (SIL OFL 1.1) |
| WisKey command / error catalogue rc37-contract.4 | `docs/integrations/wiskey/catalog/rc37-contract.4/` | MIT (`LICENSE` in that folder) |
| WisKey embed-api-v1 reference client (adapted as `frontend/src/wiskey/embed-connector.ts`) | the web UI bundle | MIT - WisKey root LICENSE, confirmed by the WisKey team 2026-10-31 (sample SHA256 d3324a40...); full notice below and in `frontend/src/wiskey/LICENSE-embed-api-v1.txt` |
| WisKey Core runtime observer (`core_runtime_observation.py`, contribution M12-POLICY-B.20261102.01, byte-identical) | the SMPLWISE Bridge integration (`custom_components/smplwise_bridge/`, mirrored into the add-on image as `smplwise_vms/integration/smplwise_bridge/`) | MIT - same WisKey notice as below, shipped next to the file as `LICENSE-WISKEY-core-runtime-observation.txt` |
| AndroidX (appcompat 1.7.0, activity-ktx 1.10.1, webkit 1.14.0, core-splashscreen 1.0.1, biometric 1.1.0), Material Components 1.12.0 | the Android shell APK (`mobile/android-shell`, shipped under `downloads/` when staged) | Apache-2.0 |
| Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`) | `mobile/android-shell/` (build tooling, not in the add-on image) | Apache-2.0 |

## Web UI bundle (npm runtime packages, `frontend/package-lock.json`)

Shipped in `smplwise_vms/www` and `smplwise_vms/www-public`. The bundler keeps the packages' `@license` comments in the built
chunks.

| Package | Version | License |
|---|---|---|
| lit | 3.3.3 | BSD-3-Clause |
| lit-html | 3.3.3 | BSD-3-Clause |
| lit-element | 4.2.2 | BSD-3-Clause |
| @lit/reactive-element | 2.1.2 | BSD-3-Clause |
| @lit-labs/ssr-dom-shim | 1.6.0 | BSD-3-Clause |
| three (including `three/addons` OrbitControls, GLTFExporter, RoundedBoxGeometry) | 0.186.1 | MIT |
| qrcode-generator | 1.4.4 | MIT |
| @types/trusted-types | 2.0.7 | MIT (type declarations only, nothing in the bundle) |

Build tooling (vite, rollup, esbuild, TypeScript, Playwright, gltf-validator and their dependencies: MIT, Apache-2.0, ISC,
BSD-3-Clause) is not distributed. The two Cloudflare Workers (`services/push-relay`, `services/fleet-receiver`) have no runtime npm
dependency; their dev tooling (wrangler, vitest) is not distributed either.

## Python packages of the add-on image (installed from PyPI by the Supervisor build)

Direct requirements are in **bold**.

| Package | Version | License | Role |
|---|---|---|---|
| **fastapi** | 0.141.1 | MIT | HTTP API |
| starlette | 1.10.0 | BSD-3-Clause | ASGI framework under FastAPI |
| **uvicorn** (with `[standard]`) | 0.53.0 | BSD-3-Clause | ASGI server |
| **uvloop** (Linux only) | 0.22.1 | MIT OR Apache-2.0 | event loop |
| **httptools** | 0.8.0 | MIT | HTTP parser of uvicorn |
| watchfiles | 1.3.0 | MIT | uvicorn extra (reload; unused in production) |
| python-dotenv | 1.2.4 | BSD-3-Clause | uvicorn extra |
| PyYAML | 6.0.3 | MIT | uvicorn extra |
| click | 8.5.0 | BSD-3-Clause | uvicorn command line |
| **websockets** | 15.0.1 | BSD-3-Clause | Home Assistant WebSocket, go2rtc / WisKey relays |
| **python-multipart** | 0.0.32 | Apache-2.0 | uploads |
| **pillow** | 13.0.0 | MIT-CMU (HPND) | image decode / re-encode |
| **httpx** | 0.27.2 | BSD-3-Clause | outbound HTTP (NVR, go2rtc, Home Assistant, Frigate, push relay) |
| httpcore | 1.0.9 | BSD-3-Clause | transport of httpx |
| h11 | 0.16.0 | MIT | HTTP/1.1 of httpcore |
| anyio | 4.16.0 | MIT | async layer |
| sniffio | 1.3.1 | MIT OR Apache-2.0 | async library detection |
| idna | 3.20 | BSD-3-Clause | host names |
| certifi | 2026.10.23 | MPL-2.0 | CA bundle of httpx; used unmodified (MPL-2.0 is file-level: the files stay under MPL-2.0, source at https://github.com/certifi/python-certifi) |
| **pydantic** | 2.13.5 | MIT | validation |
| pydantic_core | 2.46.5 | MIT | validation core |
| annotated-types | 0.8.0 | MIT | pydantic |
| annotated-doc | 0.0.5 | MIT | FastAPI |
| typing-inspection | 0.4.5 | MIT | pydantic |
| typing_extensions | 4.16.0 | PSF-2.0 | typing backports |
| **tzdata** | 2026.6 (pin `>=2024.1`) | Apache-2.0 | time zones |
| **numpy** | 2.5.4 (pin `>=2.0,<3`) | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | plan stylization, room detection |
| **cryptography** | 50.0.2 (pin `>=45,<51`) | Apache-2.0 OR BSD-3-Clause | AES-GCM store, Ed25519, push encryption, backup sealing |
| cffi | 2.1.1 | MIT-0 | cryptography and WeasyPrint bindings |
| pycparser | 3.12 | BSD-3-Clause | cffi |
| **paramiko** | 5.1.0 | LGPL-2.1 | SFTP off-box backups; used unmodified as a separate library |
| bcrypt | 5.0.0 | Apache-2.0 | paramiko |
| PyNaCl | 1.6.2 | Apache-2.0 | paramiko |
| invoke | 3.0.3 | BSD-2-Clause | paramiko |
| **ezdxf** | 1.4.5 (pin `>=1.3,<2`) | MIT | DXF plan import |
| pyparsing | 3.3.3 | MIT | ezdxf |
| **weasyprint** | 70.0 | BSD-3-Clause | bill / building-report PDF engine |
| pydyf | 0.13.0 | BSD-3-Clause | PDF writer of WeasyPrint |
| tinycss2 | 1.5.1 | BSD-3-Clause | CSS parser of WeasyPrint |
| cssselect2 | 0.10.1 | BSD-3-Clause | CSS selectors of WeasyPrint |
| tinyhtml5 | 2.1.0 | MIT | HTML parser of WeasyPrint |
| webencodings | 0.6.1 | BSD-3-Clause | tinycss2 |
| Pyphen | 0.18.1 | GPL-2.0-or-later OR LGPL-2.1-or-later OR MPL-1.1 (tri-licensed; used here under LGPL-2.1-or-later) | hyphenation dictionaries pulled in by WeasyPrint (not used by the layout: `hyphens: manual`) |
| fontTools | 4.68.0 | MIT | font subsetting inside WeasyPrint |
| brotli | 1.2.1 | MIT | WOFF2 support of fontTools |
| zopfli | 0.4.3 | Apache-2.0 | font compression of fontTools |
| **fpdf2** | 2.8.9 | LGPL-3.0-only | the fallback (simple) PDF engine; used unmodified as a separate library |
| **uharfbuzz** | 0.57.0 (pin `>=0.50,<1`) | Apache-2.0 (bundles HarfBuzz, "Old MIT" license) | Hebrew text shaping for fpdf2 |
| defusedxml | 0.7.1 | PSF-2.0 | XML parsing in fpdf2 |

The LGPL packages (paramiko, fpdf2, Pyphen under its LGPL option) are installed unmodified from PyPI as separate, replaceable
libraries; the add-on does not modify or statically combine them.

### Installed by Home Assistant for the bundled WisKey integration (not by the add-on image)

`smplwise_vms/integration/hikvision_intercom/manifest.json` asks Home Assistant core to install `defusedxml==0.7.1` (PSF-2.0),
`httpx==0.28.1` (BSD-3-Clause) and `cryptography>=48.0.1,<51` (Apache-2.0 OR BSD-3-Clause). The SMPLWISE Bridge integration has
no requirements.

## System packages of the add-on image (Alpine)

The image is built **on each Supervisor** from `ghcr.io/home-assistant/{amd64,aarch64}-base-python:3.12-alpine3.22` (Apache-2.0
base image plus Alpine packages, referenced by tag) and `apk add poppler-utils jpeg zlib libpng ffmpeg pango`. The owner does not
distribute a prebuilt image (`config.yaml` has no `image:` key).

| Package | License | Use |
|---|---|---|
| poppler-utils | GPL-2.0 / GPL-3.0 | `pdftoppm` / `pdfinfo` run as a separate process, not linked |
| ffmpeg | LGPL-2.1-or-later / GPL-2.0-or-later (the Alpine build enables GPL parts) | frame grabs and export remux run as a separate process, not linked |
| pango, HarfBuzz, FriBidi, cairo, fontconfig, FreeType, GLib | LGPL-2.1-or-later (Pango, FriBidi, GLib); LGPL-2.1 or MPL-1.1 (cairo); Old MIT (HarfBuzz); FreeType License or GPL-2.0 (FreeType); MIT-style (fontconfig) | dynamically linked system libraries of WeasyPrint |
| jpeg (libjpeg-turbo), zlib, libpng | IJG / BSD-3-Clause, zlib, libpng | image codecs |

Their licence texts ship in the image under the packages' own directories. If a prebuilt image is ever published, the GPL
source-offer duties for ffmpeg and poppler apply (audit finding I2) - a legal decision before that switch.

NOT VERIFIED: the exact Alpine package versions of a built image are not recorded here (the image is not built on the
workstation).

## WisKey embed-api-v1 reference client - MIT notice

The same notice covers the WisKey native integration, the WisKey catalogue and the WisKey Core runtime observer listed above.
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
