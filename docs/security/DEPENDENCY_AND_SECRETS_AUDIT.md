# Dependency, licence and secrets audit (T005)

Date: 2026-09-16 (first audit at 0.1.21) · re-run 2026-09-22 at 0.1.81 · **refreshed 2026-10-31 at v2.29.0**
(branch `chore/DEPAUDIT-2310`, from `origin/main` 72c06e88e) · Scope: the add-on repository (backend, bridge integration,
frontend, add-on image), the two Cloudflare Workers (`services/push-relay`, `services/fleet-receiver`), the Android shell
(`mobile/android-shell`) and every bundled or vendored asset · Method: inventory from `requirements.txt`, the npm lock files and
the Dockerfile; `pip-audit` and `npm audit` on the workstation; a tracked-tree scan (`git ls-files`, text files) for keys, tokens,
passwords, URL credentials, private IPv4, serial numbers and MAC addresses that reports **file:line and kind only, never the
value**; a review of the log paths that could print a credential. `secrets/lab.env` and `private-evidence/` were not read.

Re-run before each release:

```
python -m pip_audit -r smplwise_vms/backend/requirements.txt        # in a throw-away venv
cd frontend && npm audit --omit=dev && npm audit                    # runtime, then runtime + dev
cd services/push-relay && npm audit ; cd services/fleet-receiver && npm audit
python -m pytest smplwise_vms/backend/tests/test_no_ip_literals.py smplwise_vms/backend/tests/test_font_licences.py
```

plus the tracked-tree secret scan of §4.1 (the pattern list is reproduced there).

## 1. Runtime inventory and licences (v2.29.0)

### 1.1 Add-on image

| Component | Version | Licence | Use | Notes |
|---|---|---|---|---|
| Home Assistant base image `{amd64,aarch64}-base-python:3.12-alpine3.22` | tag, not digest-pinned (`smplwise_vms/Dockerfile:1`, `build.yaml`) | Apache-2.0 (HA base) + Alpine packages | image base | built **on each Supervisor** from the Dockerfile: `config.yaml` has no `image:` key, so the owner does not distribute a prebuilt image |
| poppler-utils (Alpine) | distro | GPL-2.0 / GPL-3.0 | `pdftoppm` / `pdfinfo` **as a subprocess** | not linked |
| ffmpeg (Alpine) | distro | LGPL-2.1+ / GPL-2.0+ (Alpine build enables GPL parts) | frame grabs, export remux **as a subprocess** | not linked; command lines redacted in logs |
| pango (+ HarfBuzz, FriBidi, cairo, fontconfig, FreeType, GLib) | distro | LGPL-2.1+ / MPL-1.1 / Old MIT / FTL | WeasyPrint text shaping (bill PDF) | dynamically linked system libraries, see `THIRD_PARTY_NOTICES.md` |
| jpeg, zlib, libpng (Alpine) | distro | IJG / zlib / libpng | Pillow codecs | permissive |

### 1.2 Backend Python (resolved with `pip install -r requirements.txt`, CPython 3.12, 2026-10-31)

Direct requirements are in **bold**. Versions are the resolved ones; a range pin in `requirements.txt` can resolve higher on
the image (cryptography, numpy, websockets, uharfbuzz, ezdxf, tzdata). The image resolves `uvloop` (MIT / Apache-2.0)
in addition, through `uvicorn[standard]` on Linux.

| Package | Version | Licence | Role |
|---|---|---|---|
| **fastapi** | 0.141.1 | MIT | HTTP API |
| starlette | 1.10.0 | BSD-3-Clause | ASGI framework under FastAPI |
| **uvicorn[standard]** | 0.53.0 | BSD-3-Clause | ASGI server (extras: httptools MIT, watchfiles MIT, python-dotenv BSD-3, PyYAML MIT, websockets) |
| **pydantic** / pydantic_core | 2.13.5 / 2.46.5 | MIT | validation (with annotated-types, annotated-doc, typing-inspection: MIT; typing_extensions: PSF-2.0) |
| **httpx** / httpcore / h11 | 0.27.2 / 1.0.9 / 0.16.0 | BSD-3 / BSD-3 / MIT | NVR, go2rtc, HA, Frigate, Provision-ISR, push relay calls (anyio MIT, sniffio MIT/Apache, idna BSD-3) |
| **websockets** | 15.0.1 (`>=13,<16`) | BSD-3-Clause | HA WebSocket, go2rtc / WisKey relays |
| **python-multipart** | 0.0.32 | Apache-2.0 | uploads |
| **pillow** | 12.3.0 | MIT-CMU (HPND) | every image decode / re-encode (plans, photos, tickets, logos, frames) - **see finding H1** |
| **numpy** | 2.5.4 (`>=2,<3`) | BSD-3 AND 0BSD AND MIT AND Zlib AND CC0-1.0 | plan stylization, room detection |
| **cryptography** | 50.0.2 (`>=45,<51`) | Apache-2.0 OR BSD-3-Clause | AES-GCM secrets store, Ed25519 signing, VAPID / RFC 8291 push, backup sealing (cffi MIT-0, pycparser BSD-3) |
| **paramiko** | 4.0.0 | **LGPL-2.1** | SFTP transport of off-box backup copies (DATASTORE-295) - **new since 0.1.81; see finding M2** (bcrypt Apache-2.0, PyNaCl Apache-2.0, invoke BSD-2) |
| **ezdxf** | 1.4.5 (`>=1.3,<2`) | MIT | DXF plan import |
| **weasyprint** | 70.0 | BSD-3-Clause | bill / building-report PDF engine (pydyf, tinycss2, cssselect2, webencodings: BSD; tinyhtml5 MIT; fonttools MIT; brotli MIT; zopfli Apache-2.0) |
| pyphen | 0.18.1 | GPL-2.0+ OR LGPL-2.1+ OR MPL-1.1 (used under LGPL-2.1+) | pulled in by WeasyPrint; hyphenation not used |
| **fpdf2** | 2.8.9 | **LGPL-3.0-only** | fallback PDF engine, unmodified library (defusedxml PSF-2.0) |
| **uharfbuzz** | 0.57.0 (`>=0.50,<1`) | Apache-2.0 (bundles HarfBuzz, Old MIT) | Hebrew shaping for fpdf2 |
| **tzdata** | 2026.6 | Apache-2.0 | time zones |

### 1.3 Frontend (`frontend/package-lock.json`, lockfileVersion 3)

Shipped in `smplwise_vms/www` and `smplwise_vms/www-public` (9 production packages; previous audit: `lit` only):

| Package | Version | Licence | Use |
|---|---|---|---|
| lit, lit-html, lit-element, @lit/reactive-element, @lit-labs/ssr-dom-shim | 3.3.3 / 3.3.3 / 4.2.2 / 2.1.2 / 1.6.0 | BSD-3-Clause | UI components |
| three (incl. `three/addons` OrbitControls, GLTFExporter, RoundedBoxGeometry) | 0.186.1 | MIT | 3D plan / Plan Studio 6 (`frontend/src/map/three-bundle.ts`) |
| qrcode-generator | 1.4.4 | MIT | QR codes (pairing, tickets) |
| @types/trusted-types | 2.0.7 | MIT | types only |

Notable dev tools (not shipped): vite 6.4.3 (MIT), rollup via `@rollup/wasm-node` 4.x (MIT), esbuild (MIT), typescript 5.9
(Apache-2.0), @playwright/test 1.63 (Apache-2.0), gltf-validator 2.0.0-dev.3.10 (Apache-2.0), @dimforge/rapier3d-compat
(Apache-2.0), @types/node, @types/three (MIT). Dev licences by count: MIT 45, Apache-2.0 6, ISC 1, BSD-3-Clause 1 - no copyleft.

### 1.4 Cloudflare Workers and the Android shell

| Component | Dependencies | Licence | Notes |
|---|---|---|---|
| `services/push-relay` (CR-027), `services/fleet-receiver` (CR-FLEET215) | **no runtime npm dependency**; dev only: wrangler ^4, vitest ^3.2.4, typescript ^5.9 | MIT / Apache-2.0 | the deployed Worker bundles only its own `src/`; dev advisories in §3 |
| `mobile/android-shell` (release APK shipped in the image under `downloads/`) | androidx appcompat 1.7.0, activity-ktx 1.10.1, webkit 1.14.0, core-splashscreen 1.0.1, biometric 1.1.0, material 1.12.0; junit 4.13.2 (test) | Apache-2.0 (junit EPL-1.0, test only) | Gradle 8.11.1 wrapper with `distributionSha256Sum` set; `gradle-wrapper.jar` tracked (Apache-2.0) |
| `mobile/ios-shell` | handoff document only | - | no code in the tree |

### 1.5 Bundled and vendored material

| Material | Where | Origin / licence | Status |
|---|---|---|---|
| Heebo UI fonts (8 woff2) | `frontend/public/fonts/`, `smplwise_vms/www/fonts/` | Heebo Project Authors, SIL OFL 1.1 | **OFL text was missing next to the UI copies; fixed in this refresh** (`OFL-Heebo.txt`, test `test_font_licences.py`) |
| Lobby fonts (Bodoni Moda, David Libre, Frank Ruhl Libre, IBM Plex Mono, IBM Plex Sans Hebrew) | `frontend/public/fonts/lobby/`, `smplwise_vms/www/fonts/lobby/` | SIL OFL 1.1, one `OFL-*.txt` per family | OK |
| Bill PDF fonts (Heebo, Noto Sans subsets) | `smplwise_vms/backend/smplwise/assets/bill/fonts/` | SIL OFL 1.1, `OFL.txt` + README | OK (see `THIRD_PARTY_NOTICES.md`) |
| Plan Studio 6 models and textures (19 + 53 files) | `smplwise_vms/www/plan3d/` | Kenney and others, **CC0-1.0 only** (owner Q6); every file listed with source URL, source hash and own sha256 in `plan3d/MANIFEST.json`, checked by `frontend/tests/unit-plan3d-assets.spec.ts` | OK |
| WisKey command / error catalogue `rc37-contract.4` | `docs/integrations/wiskey/catalog/rc37-contract.4/` | WisKey (`hikvision_intercom`) 2.0.0-rc.37, source commit pinned in `PIN.json`, **MIT** (`LICENSE`, "Hikvision Intercom Manager contributors"), sha256-pinned | OK; consumed as data |
| WisKey embed API v1 reference client | `docs/integrations/wiskey/embed-api-v1/examples/wiskey-embed-client.mjs` | written by the WisKey developers; **no licence header** | ported line by line into `frontend/src/wiskey/embed-connector.ts` - **finding L6 (licence confirmation)** |
| WisKey native panel source (rc.37) | `private-evidence/wiskey-native-rc37/` (git-ignored, not read here) | WisKey | reference only; CR-036 records it as "not copied". No WisKey panel source is tracked in this repository; the native screens in `frontend/src/screens/wiskey-*.ts` and `frontend/src/wiskey/` are Arx code. Not modified by this audit |
| WisKey exchange schemas / golden vectors | `docs/wiskey-exchange/`, `docs/contracts/wiskey-capture-lease/`, backend `tests/fixtures/wiskey_*` | jointly authored contract artefacts (Arx + WisKey) | data, not code |
| G.711 encoder / decoder | `frontend/src/wiskey/g711.ts`, `g711-decode.ts` | own implementation of the public ITU-T G.711 algorithm | OK |
| Legacy add-on `legacy/hikvision_nvr_v1.5.27` | **no longer in the tracked tree** (0 files at v2.29.0) | owner's own code, no licence file | reference only, audit documents in `docs/legacy/` |
| Brand and design assets | `smplwise_vms/www/icons`, `docs/brand`, `docs/design` | owner-supplied | not third-party |

No third-party library source is copied into the product tree; the only vendored third-party files are fonts (OFL), the CC0
3D assets and the MIT WisKey catalogue.

## 2. Licences that affect distribution

| Licence class | Components | How they are used | Consequence |
|---|---|---|---|
| GPL-2.0+/GPL-3.0 | poppler-utils, ffmpeg (GPL-enabled Alpine build), Pyphen (one option of three) | separate processes from the distribution's package manager; Pyphen taken under LGPL | the add-on's own code is not a derivative work. As long as the image is **built by each Supervisor** from Alpine packages, the owner does not convey these binaries. If a prebuilt image is ever published (`image:` in `config.yaml`, a registry push), the GPL source-offer duties for ffmpeg / poppler apply - **legal decision before that switch** |
| LGPL | paramiko (2.1), fpdf2 (3.0-only), pango / GLib / FriBidi / cairo (2.1+) | unmodified, imported / dynamically linked, replaceable by the user in the image | compatible with a proprietary add-on; keep them unmodified and keep the notices (`THIRD_PARTY_NOTICES.md`) |
| AGPL / SSPL / BUSL / unknown | none found in the resolved Python set, the frontend lock or the Android dependencies | - | - |
| Product licence | **the repository has no top-level LICENSE file** | the add-on store repository (`repository.yaml`) points at it | without a licence the code is "all rights reserved"; the intended licence (proprietary / source-available / open) is an **owner / counsel decision** (finding I1) |

## 3. Vulnerability scan (2026-10-31, v2.29.0)

Run on the workstation (Windows 11, CPython 3.12, Node 24.21.0) against the public advisory databases (PyPI / OSV for
pip-audit, the GitHub advisory database for npm). No package was upgraded.

| Scan | Result |
|---|---|
| `pip-audit -r smplwise_vms/backend/requirements.txt` (pip-audit 2.x, fresh venv) | **2 vulnerable packages, 41 advisories.** `pillow 12.3.0`: 39 advisories (18 PYSEC-2026-43xx + 21 CVE-2026-11xxxx: heap use-after-free / out-of-bounds read and write in the TIFF, MPO, PSD, DCX, MIC, GIF, WMF loaders, decompression-bomb bypasses through multi-frame `seek()`, uninitialised memory returned as pixels, TarIO infinite loop, PILfont integer overflow); every one is fixed in **13.0.0** (finding H1). `paramiko 4.0.0`: PYSEC-2026-2858 / GHSA-r374-rxx8-8654 / CVE-2026-44405 (`rsakey.py` still accepts SHA-1 `ssh-rsa` signatures), no fixed 4.x release; 5.x carries the fix (finding M2) |
| `npm audit --omit=dev` (frontend) | **0 vulnerabilities** (9 production packages) |
| `npm audit` (frontend, runtime + dev) | 2 high, dev only: `vite <=6.4.3` (GHSA-9jrq-w75r-8gcw cross-origin script execution through custom middleware, GHSA-rq7h-c2jc-7f22 `server.fs.allow` bypass, three `launch-editor` advisories) and `source-map-js 1.0.0-1.2.1` (GHSA-68fv-2mgg-jv7q event-loop DoS). Affects only the local dev / preview server, never the built bundle (finding L1) |
| `npm audit` (`services/push-relay`) | 8: 2 critical (`vitest` GHSA-82fw-gwwq-j7x9 path traversal via the mocker; `tinypool` GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr prototype-pollution RCE), 5 high (`wrangler`, `miniflare`, `undici` x8 advisories, `sharp` librsvg, `vite`), 1 moderate (`@vitest/mocker`). All dev / deploy tooling (finding M3) |
| `npm audit` (`services/fleet-receiver`) | 6: 2 critical (`vitest`, `tinypool`), 1 high (`undici`), 3 moderate (`wrangler`, `miniflare`, `@vitest/mocker`). Dev / deploy tooling only (finding M3) |
| Android shell | not scanned (no Gradle dependency-check run offline); the six androidx / material versions are listed in §1.4 for a manual check (NOT_RUN) |
| Alpine packages of the image | not scanned (the image is not built on this workstation; NOT_RUN) |

The rule of the first audit stands: a finding of severity high or above in a **shipped** dependency blocks a release until the
dependency is updated or the exposure is documented as not reachable. H1 meets that rule at v2.29.0; see §7.

## 4. Secret, identifier and log-leak scan of the tracked tree

### 4.1 Method

`git ls-files` (13,826 tracked files at 72c06e88e); binary files (images, fonts, glTF, jar, PDF) and `*.js.map` skipped, every
other file read as text. Patterns: PEM private-key headers; AWS (`AKIA...`), GitHub (`ghp_`, `github_pat_`), Slack (`xox?-`),
Google (`AIza...`) keys; JWTs (`eyJ...eyJ...`); long `Bearer` literals; `password|passwd|pwd|secret|api_key|token = "<literal>"`
assignments (placeholder words filtered); credentials in URLs (`scheme://user:pass@`); MAC addresses; Hikvision serial shapes
(`<8 digits>CCRR...`); RFC 1918 / CGNAT / link-local IPv4. A second pass grepped for public tunnel host names (Nabu Casa,
DuckDNS, trycloudflare, workers.dev, ngrok, ts.net), `<serialNumber>` / `"serial": "..."` values, Worker account / KV ids, and
sensitive file types (`.pem .key .p8 .p12 .jks .env .sqlite .db .har .pcap`). The scan prints file:line and the kind only;
no value is reproduced here.

### 4.2 Results

| Kind | Hits | Classification |
|---|---|---|
| Private key | 1 | `services/push-relay/test/relay.test.ts:39` - a PEM wrapper template around a key **generated at test time**; no key material in the file |
| AWS key | 2 | `smplwise_vms/backend/tests/test_offbox_s3.py:27` - AWS's own published SigV4 documentation example key pair (test vector) |
| JWT / Bearer | 2 | `smplwise_vms/backend/tests/test_fake_doorwin_asserts.py:124`, `frontend/tests/unit-video-conn-test.spec.ts:111` - fake tokens fed to the redaction / "no secrets" assertions |
| Password / token literal | 78 | all in tests and fixtures (`fixture-pass-*`, `viewer-pass-*`, planted tokens the leak tests must not find in output) or false positives in source (setting / store key names such as `ha_users_token`, `partner.api`, `receipt_unknown`; a Hebrew UI placeholder) |
| URL credentials | 78 | docstrings and design documents with placeholder `user:pass` (`go2rtc.py`, `playback.py`, `frigate_*`, `stream_source_service.py`, CR / API study documents), and fixtures using `fixture-user:fixture-pass@*.invalid` |
| MAC address | 59 | RFC 7042 documentation range `00:00:5E:00:53:xx` and pattern-like test values; 2 false positives (clock times `12:48:37` style) |
| Serial number | 0 | fake values only (`FAKESERIAL0001`, `DS-2CD-FAKE`); `scripts/lab/nvr_probe.py` redacts `<serialNumber>` before writing |
| Private IPv4 | 222 | Home Assistant's add-on network 172.30.32.0/23 (supervisor / ingress proxy, not lab data) in docs and code; RFC 1918 / link-local / CGNAT literals only in files listed in `smplwise_vms/backend/tests/ip_literal_allowlist.txt` (SSRF, address-class and redaction tests that must feed private addresses to a guard) and in the CIDR lists of the SSRF guards. `test_no_ip_literals.py` **passes** (run 2026-10-31) |
| Public tunnel host names, Worker ids | 0 | `wrangler.toml` files carry `REPLACE_WITH_THE_KV_NAMESPACE_ID` placeholders; the admin token is a Worker secret, never in git |
| Sensitive file types | 4 | `docs/evidence/electricity-pdf-addon-image/*.log` - build / pytest logs, 0 pattern hits |

**No live secret, lab address, serial number or MAC address was found in the tracked text files.** Not covered (NOT_RUN):
a cross-check of the tree against the actual values in `secrets/lab.env` (that file is out of bounds for this audit; the
segment loop's pre-commit gate does that comparison on the owner's machine), and a visual review of the ~7,500 tracked
files (mostly screenshots) under `docs/design/` and `docs/evidence/` for unredacted camera frames, device labels or addresses on screenshots.

### 4.3 Log-leak review

| Path | Finding |
|---|---|
| httpx / httpcore / websockets request logs | forced to WARNING in `main.py:373` whatever `log_level` is, because their INFO lines print full URLs and go2rtc `src=rtsp://user:pass@...` queries |
| Pillow | kept at INFO (`main.py:377`): its TIFF / EXIF reader logs tag values (GPS, serials) at DEBUG |
| go2rtc | `redact_source` / `redact_url` in every log and audit detail; errors wrapped as `{"op", "error": <class name>}`; the raw source is sent only once per process to register a stream, later grabs use the name |
| HA token validation | `ha_user_auth.py:1211` logs `HaUnavailable`, whose messages are fixed strings or exception class names - no token, no URL |
| Secrets store, WisKey camera passwords, connection store, music-server token | log the secret's **name** and counts only |
| Backend `print()` | only in the CLI tools `backup_drill.py` and the PDF engine fallbacks (exception class names) |
| Frontend `console.*` | no call prints a token, password or authorization value |
| uvicorn access log (main listener) | on; logs path + query. No main-app URL carries a credential in its query (cache-busters `t=` only); the public ticket listener runs with `access_log=False` and its own scrubbed log (`tickets/public_log.py`) |
| paramiko | at `log_level: debug` paramiko's transport DEBUG lines (host-key types, user name, remote banner) reach the add-on log - no password or key material (info I3) |

## 5. Secrets handling (design record, unchanged unless noted)

- Secrets never live in the repository or the database, except where an approved change request names the
  exception, its protection and its limits. NVR credentials, go2rtc credentials and (in
  development) the HA token come from the add-on options / `secrets/lab.env`, which is git-ignored together
  with `private-evidence/` and `data/`. The bridge shared secret is stored in the settings table of the
  add-on database and excluded from backups (`SETTINGS_KEEP` in `services/backup.py`).
- Approved exception (CR-022, owner decision 2026-10-04; backend implemented on `pilot/nn4-backend`, ships with the CR-022 release): the NVR connection password
  moves from the add-on options into `recorder_connections.password_enc`, encrypted with AES-256-GCM under its
  own key file `<data>/keys/connections.key`; neither the table nor the key enters an Arx backup or bundle, and
  the password is never returned by an API or written to a log or the audit trail. It protects against a leaked
  database file or Arx backup, not against a reader of the whole data folder. Scope, threat model and tests:
  `docs/changes/CR-022-NVR-CONNECTION-IN-ARX.md` §3. Until that release the add-on options remain the source.
- Project backups, encrypted sensitive section (BACKUP-HASH-ENC, owner decision 2026-10-17; `services/backup_sensitive.py`):
  the Arx-only accounts' password hashes (`auth_local_credentials.password_hash`, scrypt PHC) and the media HMAC keys
  (`multimedia.item_secret`, `multimedia.cast.secret`) never appear in an archive's data files. With a backup password typed at
  export time they are sealed into `secure/sensitive.bin`: AES-256-GCM (`cryptography`), key = scrypt(password, 16-byte random salt,
  N=2^17, r=8, p=1); the header (salt, nonce, KDF settings, counts) sits in the manifest and is authenticated as associated data
  together with the archive's `created_at` / `schema_version` / `format`. Without a password the section is omitted (never
  plaintext); automatic (daily / pre-upgrade) backups always omit it. Restore: the password is required, or the operator explicitly
  chooses "restore without the passwords" - then an account keeps the current hash of the same user id on this installation, and
  otherwise needs an administrator's reset link. A wrong password and a changed / truncated section are refused before anything is
  written (the GCM tag is the only, constant-time, password check; no verifier is stored). Downgrade guards: a ciphertext member
  without its header, or a header saying "omitted" next to one, is refused even with the skip choice; plaintext hashes / keys
  injected into an archive that has a header are ignored; KDF settings above what the build writes are refused before any
  derivation (one derivation at a time, ciphertext size-capped). Archives from before the rule (no header) still import their
  plaintext hashes, with a warning in the answer and the log. The password and the derived key are never logged, audited, stored
  or returned. Residual risk: an attacker with the archive can run an offline guess against the backup password at the scrypt cost
  (minimum length = setting `backup.password_min`, default 12, an administrator may set 8-64; values outside are refused, a stored value is clamped, so 8 is a hard floor; the setting is never exported or restored); the rest of the archive stays unsigned and unencrypted as before. Tests:
  `tests/test_backup_sensitive.py`.
- Repository scan (`git grep` for `password=`, `token=`, lab address patterns; the pre-commit scan used by
  the segment loop refuses commits containing lab addresses or device identifiers): no hits apart from an
  obviously fake fixture string in `tests/test_media.py`.
- Logs: go2rtc URLs are redacted (`services/go2rtc.redact_url`), ffmpeg error output is redacted before it
  is stored (`services/thumbnails._redact`), health details name error classes rather than addresses, and
  the developer launcher never echoes option values. Uvicorn's access log shows the client address, which
  inside the add-on is the Supervisor proxy.
- The UI never receives credentials: the browser talks only to the add-on, which relays go2rtc signalling
  and NVR pictures itself (ADR-005 / ADR-011).

## 6. Dangerous write paths (reviewed)

| Path | Guard |
|---|---|
| Plan uploads → `/data/plans` | content sniffing (PDF/PNG/JPG only, SVG rejected), 40 MB / 20 pages, derived images written next to the original, originals immutable |
| Backups → `/data/backups` | zip written to a temp name then renamed; restore extracts only `files/…` members under the data directory and refuses `..` segments; rows and files in one transaction |
| Exports → `/data/exports` | job directory per export, temp + rename, size accounted in the health report |
| Event pictures → `/data/thumbs` | one worker, temp + rename, negative cache, ffmpeg with timeout |
| Bridge install → Home Assistant `custom_components/smplwise_bridge` | only when the `homeassistant_config` mapping is granted, only that directory, version-marked, re-copy on version change; documented in DOCS.md |
| go2rtc streams | only names with the `smplwise_` prefix are created, updated or deleted; foreign streams are listed but never touched |
| NVR | read-only ISAPI calls; no configuration writes, no reboots (AGENTS.md rule; `nvr.config.write` is a sensitive permission that no role grants) |
| Add-on infrastructure API (Supervisor), **approved exception** (CR-021 owner decision D1; S3 backend on `pilot/CR021-s3`, ships with the S3 release) | the manifest requests `hassio_role: manager`, which in principle allows backups, other add-ons, host and store-repository calls. Arx confines itself to ONE egress door, `services/self_update.py`: an exact (method, path) allow-list (`/addons/self/info`, `/store/reload`, `/store/addons/{slug}/update`, `/jobs/info`, `/core/info`, `/core/check`, `/core/restart`, `/addons/self/options`, `/addons/self/restart`), exact body keys, a slug pattern for the one templated path, no redirects, no upstream text echoed or stored; a CI test fails when an infrastructure write path is spelled anywhere else. Only `system.update` holders (system administrators, never delegable) trigger the two actions; permission and audit before the body is read; one active run at a time; the update can only go to the store's latest version (never an attacker-chosen one); the platform restart runs only after a passed configuration check. Residual risk (accepted by D1): a compromised Arx process could use the role directly - see `docs/changes/CR-021-SELF-UPDATE.md` sections 3.2, 11 and 13. Release gate: branch protection + required review on the store repository (owner answer 11) |

## 7. Findings (v2.29.0 refresh)

Severity: **High** = shipped code, plausible memory-safety or remote impact; **Medium** = shipped with limited reach, or tooling
that runs with the owner's credentials; **Low** = hygiene / dev-only; **Info** = decision or record, no defect.

| ID | Severity | File | Finding | Fix | Status |
|---|---|---|---|---|---|
| H1 | High | `smplwise_vms/backend/requirements.txt:4` (`pillow==12.3.0`) | 39 advisories fixed in Pillow 13.0.0 (§3). Reach: images from operators (plans, floor and wall photos, logos, skins, catalogue pictures) and from the **public ticket listener** (`services/tickets/image_intake.py`, vendor / RFQ uploads), plus camera frames. Most call sites pre-sniff magic bytes and several pass `formats=`, but a JPEG-magic file can still open as MPO, one of the affected loaders | Bump to `pillow==13.0.0` on its own branch: check musllinux wheels for amd64 + aarch64, run the full backend suite and the image / PDF tests (bill PDF, plan render, ticket intake), then release. Until then document the exposure in the release notes | OPEN - release blocker by the §3 rule |
| M1 | Medium | `routers/catalog.py:72`, `services/floor_images.py:85`, `services/wall_photos.py:116`, `services/skins/store.py:173`, `services/plan_bakes.py:406`, `services/camera_image_health.py:193` (NVR / camera frames) | `Image.open()` on uploaded or fetched bytes without `formats=`; magic-byte sniffing precedes most of them, but Pillow picks the plugin itself | Pass the allowed `formats=` at every untrusted decode (as `image_intake.py`, `brand_assets.py`, `bill_pdf_logo.py` already do). Defence in depth only - H1 is the actual fix | OPEN |
| M2 | Medium | `smplwise_vms/backend/requirements.txt` (`paramiko==4.0.0`), `services/offbox_sftp.py` | CVE-2026-44405: SHA-1 `ssh-rsa` signatures still accepted; reach limited to the SFTP server the operator configures for off-box backups, but a downgrade weakens host / user authentication of the backup copy | Upgrade to paramiko 5.x (5.1.0 is current), or pass `disabled_algorithms={"pubkeys": ["ssh-rsa"], "keys": ["ssh-rsa"]}`; re-run `test_offbox_sftp*` | OPEN |
| M3 | Medium | `services/push-relay/package.json`, `services/fleet-receiver/package.json` (+ locks) | dev / deploy tooling with 2 critical (`vitest`, `tinypool`) and up to 5 high (`wrangler`, `miniflare`, `undici`, `sharp`, `vite`) advisories; wrangler runs on the owner's machine with the Cloudflare credentials. The deployed Workers bundle no npm runtime dependency | `npm i -D vitest@^5 wrangler@latest` in each Worker on a branch, re-run `npm test` and `npm run typecheck` | OPEN |
| L1 | Low | `frontend/package.json` (`vite ^6.4.3`) | dev server / preview advisories (vite, source-map-js); never in the built bundle | bump vite to the patched 6.x (or 7.x) with the next frontend tooling update; keep the dev server bound to 127.0.0.1 (already the default script) | OPEN |
| L2 | Low | `smplwise_vms/Dockerfile:1`, `smplwise_vms/build.yaml` | base image referenced by tag, not by digest: a re-tag upstream changes the image silently | record the resolved digest in each release's technical review, or pin `@sha256:` and update deliberately | OPEN (owner choice) |
| L3 | Low | `frontend/public/fonts/`, `smplwise_vms/www/fonts/` | Heebo UI fonts shipped without the OFL text that must accompany them | added `OFL-Heebo.txt` to both directories; `tests/test_font_licences.py` checks every shipped font directory | **FIXED** in this branch |
| L4 | Low | `genalert_msg.txt` (repository root) | a commit-message scratch file committed by accident (b3d9e5cd4); no secret in it | removed | **FIXED** in this branch |
| L5 | Low | `private/planning/*` (6), `private/design-system-2026-10-27/audit/*` (2) | 8 files tracked under `private/`, which `.gitignore` marks "local-only"; the scan found no secret in them, but they are review notes that travel with every clone | owner: keep (then document that `private/` may hold tracked review notes) or `git rm --cached` them | OPEN (owner decision) |
| L6 | Low | `docs/integrations/wiskey/embed-api-v1/examples/wiskey-embed-client.mjs`, `frontend/src/wiskey/embed-connector.ts` | the WisKey reference client carries no licence header; Arx ships a line-by-line typed port of it. The WisKey catalogue in the same delivery is MIT | owner: get a one-line confirmation from the WisKey side that the embed-api-v1 examples are MIT like the catalogue (or add the MIT header to the next delivery) | OPEN (owner decision) |
| L7 | Low | `smplwise_vms/www/assets/*.js.map` (16 files) | source maps ship in the add-on, so any signed-in Ingress user can read the full frontend source and comments | decide: keep (debuggability) or build with `build.sourcemap: false` for `build:addon` | OPEN (owner decision) |
| I1 | Info | repository root | no product LICENSE file (§2) | owner / counsel: choose and add the product licence | OPEN (legal) |
| I2 | Info | `smplwise_vms/config.yaml` | GPL ffmpeg / poppler are conveyed by the owner only if a prebuilt image is ever published | legal review before adding `image:` / a registry push | RECORD |
| I3 | Info | `services/offbox_sftp.py` | paramiko DEBUG lines reach the add-on log at `log_level: debug` (no secrets) | none required; optionally pin the `paramiko` logger to INFO next to httpx in `main.py` | RECORD |
| I4 | Info | `docs/design/`, `docs/evidence/` | ~7,500 tracked evidence files (mostly screenshots) were not visually reviewed for camera frames or on-screen identifiers | sample review before the repository is shared outside the owner's account | NOT_RUN |

Counts: **High 1 · Medium 3 · Low 7 (2 fixed) · Info 4.** Earlier findings that still hold: GPL tools stay separate
processes; the legacy add-on is never redistributed (it is now absent from the tracked tree); the audit commands are part of
each release's technical review; the access log shows the Supervisor proxy address inside Home Assistant.

## 8. Decisions needed from the owner / counsel

1. Pillow 13 upgrade (H1) before the next release, or a documented exception for v2.29.x.
2. The product licence (I1), and whether a prebuilt image will ever be published (I2: GPL source-offer duties).
3. Tracked review notes under `private/` (L5) and source maps in the add-on (L7): keep or remove.
4. WisKey embed example licence confirmation (L6).

## 9. Re-scan log

| Date | Version | pip-audit | npm audit (frontend, prod) | tree scan | New since the previous scan |
|---|---|---|---|---|---|
| 2026-09-16 | 0.1.21 | clean | 0 | fake fixture only | - |
| 2026-09-22 | 0.1.81 | clean | 0 | 0 | `cryptography` (signing), `ezdxf` (DXF import) added to the inventory with their licences; dev tooling moved to Playwright 1.63 / Vite 6.4 / TypeScript 5.9; the secret scan now also refuses serial numbers and MAC addresses (the segment loop's pre-commit gate has done so since 0.1.6x). The pre-commit gate ran with 0 hits on every release commit of 2026-09-22 (0.1.76-0.1.81). |
| 2026-10-31 | 2.29.0 | **pillow 12.3.0: 39 advisories (fix 13.0.0); paramiko 4.0.0: 1** | 0 (9 prod packages); dev: 2 high (vite, source-map-js); Workers dev tooling: 2 critical + 5 high | 0 live secrets / lab identifiers in 13,826 tracked files; `test_no_ip_literals.py` pass | inventory gained paramiko (LGPL-2.1), WeasyPrint stack, fpdf2 (LGPL-3.0), uharfbuzz, pango; frontend runtime gained three and qrcode-generator; new Workers (push relay, fleet receiver), Android shell, CC0 3D assets, OFL lobby fonts, MIT WisKey catalogue; legacy tree no longer tracked; Heebo OFL text added; stray `genalert_msg.txt` removed |

Still open from T069 that this re-scan does not cover: oversized media pushed through go2rtc (needs the relay), the
go2rtc API/RTSP exposure review on the owner's host (owner), and Ingress-session token replay, which is Home
Assistant's session layer and is recorded as an explicit exclusion (the add-on never sees or stores that token; the
bridge's own HMAC replay window is tested in `tests/test_security.py`).
