# CR-LOGOS295 - Product logo and developer / management-company logo ("לוגו המערכת", "לוגו היזם / חברת הניהול")

**Status:** proposed, awaiting the owner's answers (section 13). Mockup: `docs/design/mockups/logos-295/index.html`.
**Owner requirement (2026-10-24):** (1) the SmplWise logo on every system page and on the notice-board TV screens; (2) an additional
developer / property-management-company logo, uploadable, on the same places; (3) replacing either logo must be very easy - the
company logo through a simple upload in Settings, the SmplWise logo by swapping one source file in the repository.
**Authority:** this CR is the authority for logos. It supersedes the logo and placement parts of `CR-READY96` (section 12 lists
exactly which) and supplies the logo slots that `CR-NOTICE106` §4.1 / §8.1 reserve (`logos.product`, `logos.company`).
**Branch:** `pilot/LOGOS-295` from `main` v2.12.4 (`320e55551`). No code in this commit: the change record and the mockup only.

## 1. Goal

Two logos, two owners, one rule set:

| Logo | Owner | Replaced by | Where it comes from at run time |
|---|---|---|---|
| **Product** - SmplWise (mark + wordmark) | SmplWise | the lead: one source file in the repo + one script | built into the bundle (`www/brand/*`), the backend asset folder (PDF), the manifest icons |
| **Company** - the developer or the management company ("יזם" / "חברת ניהול") | the installation's administrator | Settings › כללי › מיתוג: upload, preview, replace, remove | the database (`brand_assets`), served by `/api/v1/brand/...` and mirrored to the public listener and the TV boards |

The company logo is **additional**: it never replaces the SmplWise mark, the "SmplWise Arx" name, or the "מופעל על ידי SmplWise Arx"
line (section 8). Both logos appear together, with a fixed order: company first (the customer's identity), SmplWise second (the
product's), everywhere a brand slot exists.

Today the product has no company logo at all outside two unrelated features (the tickets public pages and the electricity bill PDF,
each with its own upload - section 2.7), the SmplWise mark is a PNG referenced by path in three places, and the shell shows a
blue "S" tile instead of a logo. The real SmplWise logo file arrives from the owner on 2026-10-25; everything below is designed
around a **placeholder** with the same geometry rules (section 4.2) so the swap is a file drop.

## 2. Inventory - where a logo or brand mark appears today (main v2.12.4)

Paths are relative to the repo root; `BE` = `smplwise_vms/backend/smplwise`.

### 2.1 Static product assets (`frontend/public/`)
| File | Bytes | Used by |
|---|---|---|
| `brand/smplwise-mark.png` | 7 066 | favicon (`frontend/index.html:8`), sign-in card (`frontend/src/arx/arx-login.ts:587`), wall tablet header (`frontend/src/screens/kiosk-wall.ts:587`) |
| `brand/smplwise-logo.png` | 21 175 | **nothing** (no reference in src, backend or scripts) |
| `icons/arx-180.png` | 2 894 | apple-touch-icon (`frontend/index.html:10`; checked by `frontend/tests/evidence-pwa-push.spec.ts:269-272`) |
| `icons/arx-192.png` | 6 228 | manifest, push notification icon (`frontend/src/pwa/sw.ts:198`), install prompt (`frontend/src/pwa/arx-pwa-prompts.ts:230`) |
| `icons/arx-512.png` | 17 044 | manifest; **source of the Android launcher icons** (`mobile/android-shell/tools/make_icons.py:8,68`) |
| `icons/arx-badge-72.png` | 1 156 | push badge (`frontend/src/pwa/sw.ts:199`) |
| `icons/arx-maskable-192.png`, `icons/arx-maskable-512.png` | 2 542 / 7 410 | manifest, `purpose: maskable` |
| `icons/arx.svg` | 282 | manifest, `sizes: any` - a generic blue rounded square with a white arch, **not the SmplWise mark** |
| `arx-manifest.webmanifest` | 1 217 | name "SmplWise Arx", short name "Arx", theme `#2f6bff`, the icon list above, two shortcuts on `arx-192` |

Three different pictures stand for the product today (the PNG mark, the `arx.svg` arch, the blue "S" tile). The pipeline of
section 4 makes them one.

### 2.2 Shell, login, wall
- `frontend/src/shell/sw-app.ts:2732` - `<span class="brand-tile" aria-hidden="true"><span>S</span></span>` at the top of the area
  rail (design A); styles `:486-502` (36 px accent square, `--sw-shadow-primary`). Comment at `:781`: the alert banner avoids the
  rail's brand mark. No logo anywhere in the content column, the float corner (`renderFloat`) or the phone bottom bar.
- `frontend/src/arx/arx-login.ts:586-589` - `.brand` row: the PNG mark (44 px, `alt=""`) + `SmplWise <span>Arx</span>` + "גישה מרחוק
  מאובטחת"; styles `:97-125`. Text `:26` "יצאת מ־SmplWise Arx.".
- `frontend/src/screens/kiosk-wall.ts:587` - the PNG mark in the wall tablet header, `alt="SmplWise"`, styles `:149-159` (24 px,
  `filter: brightness(0) invert(1)` - the dark-background treatment is a CSS invert of a PNG).
- `frontend/src/pwa/offline-page.ts:16` - "SmplWise Arx · אין חיבור" (text only).

### 2.3 Public vendor / handler pages (the tickets public listener)
- `frontend/public-ticket.html:10` - favicon `src/public-ticket/icon.svg`: a green check-mark tile, not a product or company mark.
- `frontend/src/public-ticket/brand.ts:15-23` - `brandMark(org, logo)`: the **tickets organisation logo** (`/t/brand/<16hex>.jpg`) or
  the first letter of the organisation name. No SmplWise mark and no "powered by" line on any public page (handler, RFQ, portal,
  consent, document).
- `BE/services/tickets/public_portal.py:419-425` - serves `/t/brand/{name}` (JPEG, `immutable`); edge rule `public_http.py:205`.

### 2.4 Reports and PDF
- Electricity bill, WeasyPrint path `BE/services/bill_pdf_html.py`: header logo box 34 x 17 mm (`:297-308`, `:327-340`, the
  **business** logo of the bill, not a product mark), `@page` bottom-right "הופק ב-SmplWise Arx" (`:243-246`), meta author (`:433`).
  fpdf2 fallback `BE/services/bill_pdf_engine.py:109` footer "הופק ב-SmplWise Arx", `:122` creator.
- Temperature report `BE/services/temperature_report.py:405` - `<div class="brand">SmplWise</div>` (text) in the page head, styles
  `:354`; footer site name `:48,64,391`; engine creator `BE/services/temperature_pdf_engine.py:43`.
- Readiness handover report (CR-READY96 §API `GET /readiness/report.pdf`) - planned, "the brand footer".
- Plan package HTML export `BE/services/plan_package.py:302-305` - "SmplWise Arx" + version (text).

### 2.5 E-mail, push, messages (text marks, no image)
- `BE/services/notify_email.py:403-408` header `<div>Arx</div>`, `:397-400` button "פתח ב־Arx", `:411` FOOTER "נשלח אוטומטית מ־Arx…",
  `:422,470` subjects "Arx · …", `:498` sender display name "Arx".
- `BE/services/tickets/channel_email.py:51-58` plain wrapper, no brand.
- Push / WhatsApp / SMS titles: `BE/services/push.py:369,618`, `notify_channels.py:227,409`, `mobile_push.py:354`,
  `notify_whatsapp.py:385-394`, `access_grants.py:188-207` (`CODE_MESSAGE_SENDER = "SmplWise Arx"`), `local_reset.py:97-114`.
- Identity names that must **stay** "SmplWise Arx" (not brand slots): passkey RP name `local_passkeys.py:63`, TOTP issuer
  `second_factor.py:47`, APK name `app_download.py:34,102`, user agents `mobile_push.py:169`, `presence.py:53`.

### 2.6 Display surfaces without any brand today
- Cast (`BE/routers/cast.py:94-190`, `cast_relay.py:363-371`) - media only, no page, no logo (CR-028).
- Wall display routes `BE/routers/wall.py:71-464` - the tablet page is the kiosk screen of 2.2 (mark present).
- Notice-board TV page (CR-NOTICE106, in design) - header reserves two logo slots fed by `logos.product` / `logos.company`.

### 2.7 Existing logo uploads (precedents, kept as they are)
| Feature | Where | Accepts | Limit | Storage |
|---|---|---|---|---|
| Tickets organisation logo | `BE/services/tickets/brand.py:26-87`, `routers/tickets_admin.py:408-455`, `frontend/src/api/tickets-brand.ts` | JPEG, PNG by magic bytes; SVG 415 | 512 KB, 4 MP, 512 px | file `<data>/tickets/_brand/logo.jpg` + setting `brand.logo` (stamp) |
| Electricity business logo | `BE/routers/energy_billing.py:774-797`, `services/energy_billing.py:184-235`, `bill_pdf_logo.py:13-52` | PNG, JPEG | 1 MB, 25 MP, re-encoded 800 px PNG | table `energy_assets` (blob) |
| Floor plan | `BE/routers/plans.py:188-208` | PDF, PNG, JPG; SVG 415 "until sanitization is built" | 40 MB | files |

Finding (not fixed here): `BE/services/backup.py` restores `tickets/` but the ticket tables are not project tables, so
`tickets/_brand/logo.jpg` travels in no archive while its stamp setting does - a restored installation shows the first-letter
fallback. The design below avoids the same gap for the company logo (section 5.3).

### 2.8 Brand colours (unchanged by this CR)
`BE/services/brand_colors.py`, `frontend/src/design/brand.ts`, `frontend/src/screens/system-brand-colors.ts` - `ui.accent`,
`ui.toggle_on`. The company logo settings card sits **next to** the colours card on the same tab; the colours stay as they are.

## 3. Target placements

The rule: every surface that has a brand slot shows **both** logos, in this order, with these sizes. "Company" is skipped (the
slot collapses, nothing shifts) when no company logo is set.

| # | Surface | Company logo | SmplWise | Notes |
|---|---|---|---|---|
| P1 | Shell, desktop (design A rail) | the **brand strip** at the top of the content column, inline-start, max 160 x 32 px | the mark replaces the "S" tile in the rail (36 px, `aria-hidden`); the strip shows the wordmark beside the company logo | strip height 44 px, sits in the same row as the float corner pill; it does not scroll; `--sw-rail-w` logic unchanged |
| P2 | Shell, phone (bottom bar) | the same strip, logo max 120 x 26 px | the mark 24 px at the strip's inline-end | one 40 px row above the screen, below the system banner; hidden while a full-screen editor is open (same rule as the tab row) |
| P3 | Sign-in card (`arx-login.ts`) | centred above the title, max 220 x 72 px | with a company logo: the card foot line "מופעל על ידי" + mark + "SmplWise Arx"; without: the present `.brand` row (mark + wordmark) | the sign-in page is served before any session: the company logo URL is public (section 6) |
| P4 | Public pages of the tickets listener (handler, RFQ, portal, consent, document) | the organisation mark **stays the tickets logo** (section 2.7); a button in Settings copies the company logo into it (`CR-READY96` §8 rule) | footer line "מופעל על ידי SmplWise Arx" with the mark, 16 px, on every public page | the public listener bundles the SmplWise mark; it never fetches from the main app |
| P5 | PDF / report headers (bill, temperature, readiness handover, future reports) | header, inline-start, box 34 x 17 mm (the bill's existing box) | footer `@bottom-right` "הופק ב-SmplWise Arx" becomes mark (4 mm) + text; the temperature head's text "SmplWise" becomes the wordmark (24 x 6 mm) | the bill keeps its **business** logo in the header box; when both exist the company logo goes to the footer-left; one helper `services/brand_assets.py: pdf_logos()` feeds all engines |
| P6 | E-mail (`notify_email.py`) | company **name** as text in the header line ("<company> · Arx"); image only on the owner's word (Q2) | footer line "נשלח אוטומטית מ־SmplWise Arx" | notification e-mails stay text-first: most clients block remote images, CID attachments add weight to every alert |
| P7 | Notice-board TV (`CR-NOTICE106` §8) | header slot `logos.company`, 2.2 vh… max height 9 % of the viewport height, landscape at the inline-start, portrait in the logos row | header slot `logos.product` at the inline-end; footer "מופעל על ידי SmplWise Arx" | the feed carries `theme`; the page asks `?variant=dark|light`; burn-in shift applies to both |
| P8 | Wall display tablet (`kiosk-wall.ts`) | header, after the title, max 120 x 24 px | the mark as today, via the variant files (no CSS invert) | |
| P9 | PWA icon, favicon, apple-touch, maskable, badge, Android launcher | **never** (the installed app is SmplWise Arx; Q5) | all derived from the source file (section 4) | |
| P10 | Offline page, install prompt, push icon | - | the derived PNGs | |

Accessibility: the company `<img>` carries `alt="<company name>"` (the name is a required field of the upload card); the SmplWise
mark carries `alt="SmplWise Arx"` where it is the only name on the surface (login foot, public footer, TV, PDF) and `alt=""` +
`aria-hidden` where the text "SmplWise Arx" is beside it (the shell strip, the sign-in head). Decorative placement never changes
the accessible name of the page. Both logos keep a minimum 8 px clear space and are never stretched (`object-fit: contain`).

## 4. The SmplWise asset pipeline (slice 1)

### 4.1 One source, one command
```
frontend/brand/                      <- the ONLY place a human edits
  smplwise-logo.svg                  the master: wordmark + mark, light-background colours (the owner's file)
  smplwise-logo.dark.svg             optional: the dark-background colours; absent -> derived (4.3)
  brand.json                         {"mark": "#mark", "wordmark": "#wordmark", "safe": 0.08, "theme": "#2f6bff",
                                      "background": "#f5f7fb"}  - the ids of the two groups inside the SVG and the theme colours
frontend/scripts/brand-assets.mjs    `npm run brand:assets` - reads the folder above, writes everything in 4.2, never edited per logo
```
Replacing the logo = replace `smplwise-logo.svg` (and the dark file if there is one), run `npm run brand:assets`, commit the
generated files, bump the add-on version. One commit, no code. The script fails loudly when the SVG has no `#mark` / `#wordmark`
group, has a `<script>`, external `href`, or `<image>`, or when the mark's bounding box is not square within 5 %; the error says
which rule failed.

If the owner's file is a PNG only: the script accepts `smplwise-logo.png` (>= 1024 px on the short side, transparent background)
as a fallback master; the SVG outputs are then skipped and the manifest's `sizes: any` entry is dropped. The CR recommends asking
for the SVG (Q7).

### 4.2 Derived files (all generated, all committed, none hand-edited)
| Output | From | Size / format | Consumer |
|---|---|---|---|
| `frontend/public/brand/smplwise-logo.svg`, `smplwise-logo.dark.svg` | master, sanitised copy | SVG | shell strip, login, TV `logos.product` |
| `frontend/public/brand/smplwise-mark.svg`, `smplwise-mark.dark.svg` | `#mark` group | SVG, square viewBox | rail tile, kiosk, public footer |
| `frontend/public/brand/smplwise-mark.png` | mark | 64 px PNG | favicon (keeps the existing path, so `index.html:8` is unchanged) |
| `frontend/public/brand/smplwise-logo.png`, `smplwise-logo.dark.png` | master | 800 px wide PNG | kiosk fallback, e-mail (if Q2 says images) |
| `frontend/public/icons/arx.svg` | mark on the theme square (`brand.json.theme`, 22 % radius) | SVG | manifest `any` |
| `frontend/public/icons/arx-180.png`, `arx-192.png`, `arx-512.png` | the same composition | PNG | apple-touch, manifest, push |
| `frontend/public/icons/arx-maskable-192.png`, `-512.png` | mark on a full-bleed theme square, mark inside the 80 % safe circle | PNG | manifest `maskable` |
| `frontend/public/icons/arx-badge-72.png` | mark, white on transparent, monochrome | PNG | push badge (Android renders it as a silhouette) |
| `smplwise_vms/backend/smplwise/assets/brand/smplwise-logo.png`, `smplwise-mark.png` | master / mark | 800 px / 256 px PNG | PDF engines (WeasyPrint `ASSET_SCHEME`, fpdf2 `image()`) |
| `frontend/public-ticket.html` favicon | mark | the `smplwise-mark.png` copied into the public bundle by the existing build (`build:addon`) | public pages |
| `mobile/android-shell/.../mipmap-*` | `arx-512.png` through the existing `tools/make_icons.py` | PNG | Android launcher - the script prints the reminder; it is not run automatically (the shell is built separately) |

`arx-manifest.webmanifest` is not generated (its names and shortcuts are product copy); the script only verifies that every icon
it lists exists with the declared size. A unit test (`frontend/tests/brand-assets.spec.ts`) runs the script on the committed
master into a temp folder and asserts byte-equality with the committed outputs, so a forgotten regeneration fails CI.

Tooling: `sharp` (already a transitive dependency of the Vite build on the runner; pinned as a devDependency) for the raster
outputs; the SVG outputs are the master filtered through the same sanitiser as section 5.5 (the pipeline and the upload share
one allowlist, one test).

### 4.3 Dark variant
When `smplwise-logo.dark.svg` is absent, the dark outputs are the master with `fill`/`stroke` colours remapped by `brand.json`
`"dark_map": {"#1e2e47": "#ffffff", ...}` (explicit pairs - never an automatic invert, which turns a blue mark grey-orange). With no
map either, the dark files are the light files on a light plate (4.4 rule 2), and the script says so.

### 4.4 Placement treatment (shared by both logos, in `frontend/src/components/sw-brand.ts`)
1. `<sw-brand kind="product|company" variant="auto|light|dark" size="…">` picks the file by the scheme in force (`design/apply.ts`
   publishes it) and swaps on a scheme change without a reload.
2. When a logo has no dark variant and the scheme is dark (or the surface is always dark - TV, kiosk), it is drawn on a **plate**:
   a `--sw-surface-solid`-coloured rounded rectangle (`--sw-r-sm`, 6 px padding) so the light-background artwork stays legible.
   Never CSS `filter: invert`; `kiosk-wall.ts:157` drops its filter in slice 1.
3. Sizing by a `max-inline-size` / `max-block-size` box and `object-fit: contain`; a wide logo fills the width, a square one the height.

## 5. The company logo (slice 2)

### 5.1 Settings
Settings › כללי › מראה המערכת, a new card **"מיתוג"** (the one page `CR-READY96` §2.3 planned, now owned here) with:
- `brand.company.name` - text, required to save a logo (it is the `alt`, the e-mail name, the PDF caption); <= 60 chars.
- `brand.company.kind` - `developer` / `management` / `other` - only changes the label on the card and the handover report.
- the **light logo** row: drop zone / "בחר קובץ", preview on a light surface, replace, remove.
- the **dark logo** row (optional): the same; empty = "יוצג על רקע בהיר" (the plate rule 4.4) - no technical wording.
- a live preview strip: the shell strip, the login head and the TV header, light and dark, drawn from the real component.
- "איפה מופיע" - informational list (shell, login, reports, TV boards, e-mails as text); no per-place switches in slice 2 (Q1).
- the "copy to the service pages" button (tickets logo, P4) when the tickets module is on.
- the fixed note "הלוגו של SmplWise נשאר בכל מקום" (section 8) - one line, not a paragraph.
Permission `system.configure` to see the card's controls; others see the card read-only (the preview only). Audit:
`brand.company.update`, `brand.company.logo.upload` (kind, variant, bytes, w x h), `brand.company.logo.remove`.

### 5.2 Storage - the database, not a folder
Table `brand_assets` (migration section 10): one row per `(kind, variant)` - `kind` = `company` (reserved: `product_override`, not
built), `variant` = `light` / `dark`; columns: `stamp` (16 hex, the content hash), `mime`, `width`, `height`, `bytes` (BLOB),
`uploaded_by`, `uploaded_at`. The settings keys hold only the name, the kind and `brand.company.logo` = `{"light": "<stamp>",
"dark": "<stamp>|null"}` so `/me` can tell the shell what to load without touching the blob.

Why the database and not `<data>/brand/` (what READY96 wrote): `backup.py` already serialises blob columns (`FILE_COLUMNS`, the
`energy_assets` precedent), so a backup carries the logo **with no new restorable folder** and a restore cannot land a stamp
without its file (the tickets gap of 2.7). Two files of <= 1 MB are not a size concern. Served through an in-process cache keyed
by stamp.

### 5.3 Backup
Included: `brand_assets` joins `PROJECT_TABLES` + `FILE_COLUMNS`; the `brand.*` settings already travel. `backup_sensitive.py`
unchanged (a logo is not a secret). The backup drill's checklist gains one line ("the company logo is shown after restore").

### 5.4 Upload rules
| Rule | Value | Error copy (short, no technical words) |
|---|---|---|
| Types (by content, not extension) | PNG, SVG, WebP; JPEG accepted and converted (Q4) | "אפשר להעלות PNG, SVG, WebP או JPEG" |
| Size | <= 2 MB on the wire | "הקובץ גדול מדי (עד 2MB)" |
| Raster dimensions | 64 <= short side; <= 4 MP; longest side re-encoded to <= 1 200 px PNG (alpha kept, `image_guard` ceiling applies) | "התמונה קטנה מדי - לפחות 64 פיקסלים" / "התמונה גדולה מדי" |
| Aspect | between 1:1 and 6:1 (either way); a taller-than-wide logo is allowed up to 1:2 | "יחס התמונה חריג - מומלץ לוגו רוחבי" (warning, saved) |
| SVG | <= 512 KB; sanitised (5.5); re-serialised; `width`/`height`/`viewBox` normalised | "קובץ ה-SVG מכיל תוכן שאינו נתמך" |
| Animation | APNG / animated WebP: first frame only | - |
| Transparency | kept; a raster logo without alpha gets the plate on dark (4.4) | - |
The server never trusts the browser's `Content-Type`; the body-limit rule (`body_limit.py`) gets a 2 MB entry for the route.

### 5.5 SVG sanitisation (one module, `BE/services/svg_sanitize.py`, shared with the pipeline of section 4)
- Parsed with `defusedxml` (no entities, no DTD, no external references); depth <= 32, elements <= 5 000.
- Allowlist of elements (`svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop
  clipPath mask use symbol title desc`) and of attributes (geometry, paint, `transform`, `viewBox`, `id`, `class`, `style` limited to
  paint properties, `xlink:href` / `href` only `#local`); everything else is dropped, not refused, except `script`,
  `foreignObject`, `image`, `animate*`, `set`, event attributes and any `url(` outside `#local` which **refuse** the file.
- Output: a fresh document, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">` with no `width`/`height` (the consumer sizes it).
- Served (section 6) with `Content-Type: image/svg+xml`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src
  'none'; style-src 'unsafe-inline'; sandbox`, `Content-Disposition: inline`. Consumers embed it only through `<img>` (never inline
  `<svg>` injection, never `<object>`), so even a sanitiser miss cannot run in the app's origin.
- Alternative kept in the drawer: rasterise SVG to PNG on upload (resvg) and never serve SVG - loses crispness on the TV; chosen
  only if the sanitiser review (section 11) finds a hole.

### 5.6 API (`/api/v1`, router `routers/brand.py`)
| Route | Permission | Notes |
|---|---|---|
| `GET /brand` | any session | `{company: {name, kind, logo: {light: stamp|null, dark: stamp|null}}, product: {version}}`; also folded into `/me.brand` |
| `PUT /brand` | `system.configure` | name, kind |
| `POST /brand/company-logo/{variant}` (multipart `file`) | `system.configure` | 413 / 415 / 422 per 5.4; answers the new stamp |
| `DELETE /brand/company-logo/{variant}` | `system.configure` | |
| `GET /brand/company-logo/{variant}/{stamp}.{png,svg}` | **none** (public) | the image; 404 for an unknown stamp; headers in section 6 |
| `GET /brand/company-logo/{variant}` | any session | the current image, `Cache-Control: no-store` (the Settings preview right after an upload) |
| `GET /t/brand/company-{stamp}.{png,svg}` | none (public listener) | the same bytes through the public app, same-origin for the public pages' CSP |
| `GET /api/v1/notices/display/{slug}/logo/{kind}?variant=` | board token | defined in CR-NOTICE106; implemented as a call into `brand_assets.read()` |
No `GET /brand/logo` (READY96) - superseded.

## 6. Serving and permissions
- Public stamped URLs: `Cache-Control: public, max-age=31536000, immutable`, `ETag: "<stamp>"`, `Vary: none`; a replaced logo is a new
  stamp, so a TV that polls the feed (`version` changes) and a browser that reloads `/me` pick it up; nothing is ever served stale
  from a cache the product cannot bust. The product files are bundle assets with Vite's hashed names (already immutable).
- The unstamped preview route is `no-store`.
- The public stamped route sends no cookies, no `Set-Cookie`, no session touch, permissive `Cross-Origin-Resource-Policy:
  cross-origin` (the TV page is a different origin only when the board link uses another host, CR-NOTICE106 §4.1). It is on the
  `BLOCKED_ON_REMOTE` exemption list **only** for the stamped image (a logo is public by definition; the stamp is unguessable but
  not secret).
- Only `system.configure` may change anything (name, kind, both logos); the public pages, the TV page and the sign-in page show it
  read-only. No new permission key (READY96 Q5 answered the same way).
- Rate limit on the upload route: the existing `tickets/settings/logo` budget (10 per hour per principal).

## 7. Shell integration details (slice 1 + 2)
- `/me.brand` already planned by READY96 - grows `{company: {...}, product: {logo: "brand/smplwise-logo.svg", mark: "…"}}`; the
  shell caches it in `localStorage` like `design/brand.ts` (`sw.ui.brand`) so the strip paints before the first API answer and does
  not flash the placeholder.
- The strip is one component `sw-brand-strip` rendered by `sw-app.ts` `renderA()` before `renderFloat()`; its height is a token
  (`--sw-brandstrip-h: 44px`, 40 px on the phone) subtracted from the content column exactly like `--sw-rail-w`.
- Design B / bubble / crystal skins: the same component, the skin only changes the surface colour; the owner's "one language" rule.
- Embedded mode (`embedded()`), the gated screens, the wizard and the full-screen editors: the strip shows (gated) or hides
  (editors) with the tab row, never half.
- The sign-in page reads `GET /brand` without a session; a network failure draws the SmplWise-only layout (no empty box).

## 8. White-label limits (the standing rule)
1. The company logo **adds** to the SmplWise logo; it never replaces the mark, the wordmark, the product name in titles, the PWA
   name/icons, the e-mail sender name, the "הופק ב-SmplWise Arx" PDF line, or the "מופעל על ידי SmplWise Arx" line of the sign-in
   card, the public pages and the TV boards. There is no setting that hides any of these.
2. One company per installation. The logo and name must be the installing/operating company's own (the Settings card says so in
   one line); no third-party, camera-maker or "looks like" artwork is shipped or offered.
3. The no-HA-branding rule (`docs/design/UI_COPY_RULES.md`) is untouched: a company logo adds the customer's identity, not the
   infrastructure's.
4. The tickets public pages keep their own organisation logo (filled from the company logo by a button, never merged), so a
   management company that runs the service desk under another name can.
5. Operator screens stay clean (owner 2026-09-30): the strip is the only visible addition outside Settings; no caption, no link.

## 9. Accessibility and quality
- `alt` rules of section 3; the strip is `role="presentation"` with the two `<img>`; the login foot line is real text.
- Contrast: the plate guarantees the artwork's own contrast; a company logo that is nearly invisible on light (mean luminance
  > 0.92 with alpha) gets a warning on upload ("הלוגו בהיר מאוד - מומלץ להעלות גרסה לרקע כהה"), saved anyway.
- Reduced motion: the strip never animates; the scheme swap is a `src` change.
- RTL: the strip order is logical (company at inline-start, SmplWise at inline-end); the logo artwork itself is never mirrored
  (an `<img>` is not mirrored by `dir`).
- Print: the shell strip is `display: none` in `@media print`; reports carry their own header logos (P5).

## 10. Migrations - PROVISIONAL numbering
Main (v2.12.4) is at `0145_wiskey_peer_intents_feature_registry.sql`; pilot branches in flight claim 0146-0164 (NOTICE106 holds
0160 provisionally). This CR takes **`0165_brand_assets.sql`**, one file, renumbered at integration by the integrator (the
weekend-push renumbering rule):
```sql
-- 0165_brand_assets.sql (provisional)
CREATE TABLE IF NOT EXISTS brand_assets (
  kind        TEXT    NOT NULL,                 -- 'company' (reserved: 'product_override')
  variant     TEXT    NOT NULL,                 -- 'light' | 'dark'
  stamp       TEXT    NOT NULL,                 -- 16 hex of sha256(bytes)
  mime        TEXT    NOT NULL,                 -- image/png | image/svg+xml
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  bytes       BLOB    NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT    NOT NULL,
  PRIMARY KEY (kind, variant),
  CHECK (kind IN ('company','product_override')),
  CHECK (variant IN ('light','dark'))
);
-- settings keys (no schema): brand.company.name, brand.company.kind, brand.company.logo (json {light, dark} stamps)
```
Down: `DROP TABLE brand_assets;` and delete the three settings keys. No data migration: today's tickets and bill logos stay where
they are.

## 11. Tests plan
Backend (pytest, fakes, no lab):
- pipeline sanitiser: script, foreignObject, external href, `url(` in style, event attributes -> refused; unknown element dropped;
  `#local` href kept; output has no width/height; a 10 MB entity bomb refused by defusedxml.
- upload: each type by magic bytes (PNG/SVG/WebP/JPEG ok, GIF/BMP/PDF 415), 2 MB + 1 byte 413, 4 MP + 1 px 422, 63 px 422, aspect 7:1
  warning flag, APNG first frame, JPEG -> PNG, stamp = sha256, replace = new stamp, delete clears the settings key.
- serving: stamped route public + immutable + ETag + 304; unknown stamp 404; preview `no-store` + session required; the public
  listener route byte-equal; the notices display route via the token (fakes of NOTICE106); remote channel allows only the stamped
  route; no cookie on the public route.
- permissions: PUT/POST/DELETE 403 without `system.configure`, audited; `GET /brand` for every role.
- backup: round trip through `backup.py` restores both variants with the same stamps; a backup made before the migration restores
  with no logo and no error.
- PDF: bill with business + company logo (footer-left), temperature head wordmark, fpdf2 fallback draws the mark; the EL8 size rule
  (34 x 17 mm) holds for a 6:1 logo.
- e-mail: header carries the company name, footer the SmplWise line; no `<img>` unless Q2 says so.
Frontend (Playwright evidence specs at 1366 / 1024 / 375, light + dark, RTL):
- `brand-assets.spec.ts` byte-equality of the generated files (section 4.2).
- shell strip with / without company logo, desktop + phone, scheme swap without reload, strip hidden in the plan editor,
  kiosk without the CSS invert.
- login head with / without company logo, network failure -> SmplWise-only.
- Settings card: empty, upload progress, preview light + dark, replace, remove, each 5.4 error, read-only for a non-configure role.
- public pages footer line present on handler, RFQ, portal, consent, document; favicon is the mark.
- TV board header both slots, 16:9 and portrait, dark and light (with NOTICE106 slice 3).

## 12. Relation to CR-READY96 (what this CR supersedes)
Superseded by this CR: READY96 §2.3 the keys `brand.logo`, `brand.short`, the file `<data>/brand/logo.{png,svg}`, the placement
switches `brand.show.*`, the public `GET /brand/logo`, the API rows `POST/DELETE/GET /brand/logo`, §8 bullets on the logo, the
rail tile "short name when there is no logo" (the rail always shows the SmplWise mark now), test items "logo size/type limits, SVG
sanitiser, `/brand/logo` public and ETagged", and owner questions 4 and 5 (answered here as Q5 / section 6).
Kept by READY96: the readiness score, demo mode, `brand.company_name` (renamed here to `brand.company.name` - one key, READY96
adopts the name), `brand.support_phone` / `brand.support_email`, the accent reuse, the handover report (its logos come from
section 5), the "copy to the tickets brand" button idea (built here, P4), `/me.brand` (shape defined here). The READY96 Settings tab
"מיתוג" and this CR's card are **one page**: logos (this CR) above, name / contact (READY96) below.

## 13. Slices and estimate
| Slice | Content | Estimate |
|---|---|---|
| 1 | `frontend/brand/` + `brand-assets.mjs` + generated files + `sw-brand` + rail mark + strip (SmplWise only) + login foot line + kiosk de-invert + public footer line + PDF asset folder; byte-equality test | 1 day |
| 2 | migration + `brand_assets` service + sanitiser + API + Settings card + strip company slot + login head + `/me.brand` + public listener route + backup + tests | 1.5 days |
| 3 | TV board slots (with NOTICE106 slice 3), PDF headers/footers (bill, temperature, readiness), e-mail header/footer, tickets copy button | 1 day |
Slice 1 ships with the placeholder if the owner's file is late; the swap is the one-commit procedure of 4.1.

## 14. Owner questions (recommendation first)
1. **Company logo on the phone.** (א) The same brand strip (40 px) above every screen - **recommended**, one rule everywhere.
   (ב) Only on the home screen head and the sign-in page; other phone screens show the SmplWise mark only.
2. **E-mails.** (א) Text only: the company name in the header line, "מופעל על ידי SmplWise Arx" in the footer - **recommended**
   (images are blocked by most clients and add weight to every alert). (ב) Both logos as embedded images in every e-mail.
3. **Dark-background treatment when no dark logo was uploaded.** (א) The light logo on a small light plate - **recommended**,
   the artwork is never altered. (ב) Require a dark file before the logo shows on dark surfaces / the TV. (ג) Automatic colour
   invert (not recommended: distorts brand colours).
4. **Accepted formats.** (א) PNG, SVG, WebP and JPEG (converted to PNG) - **recommended**, fewer refusals for a non-technical
   administrator. (ב) PNG, SVG, WebP only, as the requirement lists.
5. **Installed-app identity.** (א) The PWA / Android icon, the app name, the browser tab title and the sender names stay SmplWise
   Arx - **recommended** (one app identity per phone, no manifest per installation). (ב) Also the tab title "<company> · Arx".
6. **Who may change the company logo.** (א) `system.configure` - **recommended** (the installer during setup, the administrator
   later; audited). (ב) A new `brand.manage` key so the customer's administrator cannot change it.
7. **The SmplWise file.** (א) An SVG with the mark and the wordmark as two groups, plus a dark version if the brand has one -
   **recommended**. (ב) A PNG >= 1024 px (the SVG outputs are skipped; the TV and the favicon are slightly softer).
8. **Company name beside the logo.** (א) Logo only on screen; the name is the `alt`, the e-mail text and the PDF caption -
   **recommended** (clean operator screens). (ב) Name next to the logo in the strip as well.
9. **Where the card lives.** (א) Settings › כללי › מראה המערכת, next to the brand colours - **recommended** (one place for how the
   system looks). (ב) A separate "מיתוג" tab as READY96 drew.
