# ONVIF-UI-2500 - camera discovery phase 1: the "חיפוש מצלמות ברשת" wizard

Branch `pilot/ONVIF-UI-2500` (from `pilot/ONVIF-CLIENT-2500` @ d58353161). Target: the 2.5x series. Design
`docs/design/onvif-discovery-2412/DESIGN.md` and `mockup.html` on `pilot/FEATURE-DESIGNS-SEC-2490` (sections 4, 5, 7, 13 owner
decisions 2026-11-22 Q54-Q61, 14 build rows); the routes of `docs/changes/ONVIF-API-2500.md` and `docs/changes/ONVIF-CLIENT-2500.md`.
This is the **ONVIF-UI** row. Front end only: no backend, migration, dependency or setting changed. No device, camera, recorder,
go2rtc, Supervisor or lab network was contacted - every browser test runs on a mocked backend (`frontend/tests/camera-discovery-mocks.ts`,
addresses from the documentation range 192.0.2.0/24, invented makers and passwords).

## Where it lives

הגדרות › אבטחה › NVR › the existing "מצלמות ללא מקליט" card (`standalone-cameras-card.ts`, the cameras area's own card): a new primary
button **"חיפוש מצלמות ברשת"** next to "הוסף מצלמה ללא מקליט" (which becomes the secondary button beside it). The card reads
`GET /cameras/discovery/capabilities` only for a `system.configure` holder in API mode; the button is shown while `enabled`, a one-line
note ("כבוי בהגדרות. הוספה ידנית עדיין זמינה.") while the setting is off, nothing for an older server (the read fails). The card itself
was already `system.configure` only (`system-security.ts`), and the server checks every call. The wizard (`camera-discovery-dialog.ts`)
is a separate chunk, imported on the first press.

## The wizard (one `sw-dialog`, xl on a desktop, the bottom sheet on a phone; `sw-steps` 1-2-3)

1. **חיפוש** - the range field pre-filled with the server's `suggested_range` (the site's own network), the cap explained ("עד 1,024
   כתובות בכל חיפוש, כדי שהחיפוש יהיה קצר ולא יעמיס על הרשת" - `max_addresses`, Q56), the number of addresses of the typed range, and a
   too-large or malformed range refused before anything is sent (the server's clamp decides; its refusal is shown in words). The "what
   the search does / never does" panel of the mock-up (reads only, never changes a device, never guesses passwords, stores a password only
   on add). "התחלת חיפוש" -> `POST /scans` -> polling `GET /scans/{id}` every second: a progress bar (`role=progressbar`, checked of total),
   the count found and the last devices found (`aria-live`), **"עצירה"** (`DELETE`, back to the range with "החיפוש נעצר"). Opening the
   wizard while this person's scan still runs (a reload, another tab) follows that scan (`GET /scans`, "חיפוש שהתחלתם קודם עדיין פועל");
   a `409 scan_running` on start does the same. Nothing found: the three likely reasons of the design (another range, the recorder's PoE
   network, ONVIF off), "חיפוש בטווח אחר" and "הוספה ידנית".
2. **זיהוי** - every device found, paged: camera / recorder / unknown (icon + words), address (LTR-isolated), firmware, the camera clock
   when more than two minutes off ("שעון המצלמה שונה ב־11 דק׳", evidence, never corrected). Q58: **behind the recorder** ("כבר דרך
   המקליט") and **already added** ("כבר במערכת") are marked and their checkbox is disabled; this installation's own recorder is marked.
   Q59: a device that looks like a recorder (with `recorder_prefill`) offers **"הוספה כמקליט"**, which opens the existing recorder add form
   (`nvr-connection-form context="add"`, a new `prefill` property) with its name, vendor, address and HTTP port - never a credential.
   One user / password for the ticked cameras, **"אותו משתמש וסיסמה לכל המסומנות"** (required for more than one - the server's
   `same_for_all_required`, mirrored), **one attempt per camera (Q57)**: the wizard remembers in memory the pair it last sent to each
   device; a camera that answered "סיסמה שגויה" is left out of the next bulk press while the typed pair is the same, and its own row
   offers a password field with "ניסיון", enabled only when that password differs from the one it refused. "נעצר כדי לא לנעול את
   המצלמה" (the server's lockout guard, `locked_guard`) has no retry at all ("אפשר לנסות שוב בעוד 15 דקות"). Each row shows its outcome
   (identified with N streams and the suggested main / sub, wrong password, no answer, busy, unsupported sign-in, found without a video
   address -> "הוספה ידנית" with `rtsp://<address>:554/` started in the manual dialog). "המשך עם N מצלמות" counts the identified cameras
   with a usable stream.
3. **בחירה והוספה** - per camera: a preview on demand through the preview form of `POST /cameras/source/test` (`{scan_id, device_id,
   profile, profile_token}` - the address with the password is assembled on the server and never reaches the browser; the shared
   6 / minute budget is spent only on a press), the name (`<maker> <model> - <last octet>`, editable, required), the area (the devices
   tree, optional), the main stream and the sub stream ("כמו הראשי" = one address for both) from the usable profiles, with the H.265 hint
   when the main is H.265. "הוספת N מצלמות" -> `POST /scans/{id}/add` with explicit `main_profile` / `sub_profile`; the answer card
   (all added / N of M / none) and one line per camera, the refused ones first with their reason in words (the catalogue's text for a
   known code - `behind_recorder`, `standalone_limit`, `source_not_allowed`, ... - else the server's own Hebrew text). The card's list
   and the session (`cameras_available`) follow at once. Without the video server the preview and add are disabled with the existing note.

Closing the wizard after the sweep sends `DELETE /scans/{id}`: the scan job forgets the typed credentials at once instead of at its TTL
(a running sweep is left to finish so that reopening finds it). The password fields are `autocomplete="new-password"`; the typed values
live in the component only and are cleared on close.

**No scrolling** (owner rule for control screens): every list is paged with `sw-pager`; the rows per page follow the step and the
viewport (`pageSize`: identify 5 on a 1440×900 desktop / 3 on a 390×844 phone, add 4 / 1 - the phone steps through one camera at a
time, result 8 / 5). The browser spec asserts at every step that the dialog body does not scroll and the page does not scroll sideways.
On a phone the long per-row notes and the summary line are left to the chips and the button labels.

**Look**: the cameras module's own components and tokens (`sw-dialog`, `sw-steps`, `sw-field`, `sw-button`, `sw-pager`, `sw-icon`,
soft chips on `--sw-*-soft`), the layout of the design mock-up; no new colour literal.

**Words**: `src/i18n/camera-discovery.ts` (Hebrew, 146 keys) with the English pack `src/i18n/lang/en/i18n/camera-discovery.ts`
(moved there by `scripts/i18n-split-langs.mjs`, which regenerated `src/i18n/lang/en.ts`). No error code, permission name, user name or
password on the face (a unit test checks both languages).

## Files

| File | What |
|---|---|
| `frontend/src/api/camera-discovery.ts` | the seven calls on the generated wire types (`generated/wire-camera-discovery.ts`) + the preview form |
| `frontend/src/screens/camera-discovery-logic.ts` | the pure rules: range check, kinds / marks / selectable, the one-attempt targets and retry, state lines, streams, default name, pages, refusal words, add summary |
| `frontend/src/components/camera-discovery-dialog.ts` | the wizard |
| `frontend/src/components/standalone-cameras-card.ts` | the entry button, the off note, the lazy wizard, manual add with a started address |
| `frontend/src/components/nvr-connection-form.ts` | `prefill` (add mode only): host, HTTP port, vendor, name |
| `frontend/src/components/camera-source-dialog.ts` | `prefill-url` (add mode only) |
| `frontend/src/i18n/camera-discovery.ts`, `frontend/src/i18n/lang/en/i18n/camera-discovery.ts`, `frontend/src/i18n/lang/en.ts` | the words |
| `frontend/tests/unit-camera-discovery-2500.spec.ts` | unit (Node) |
| `frontend/tests/camera-discovery-2500.spec.ts`, `frontend/tests/camera-discovery-mocks.ts` | browser specs on the mocked backend, desktop + phone, no-scroll checks, axe-core |
| `frontend/tests/evidence-onvif-ui-2500.spec.ts` | the before / after capture of the entry card (skipped without `SW_ONVIF_SHOTS`; `SW_SCHEME=dark`) |

## Tests

`tests/unit-camera-discovery-2500.spec.ts` (12 tests, Node): he / en parity and placeholders, nothing internal on the face; the range
check (1,024 cap, /21 refused, malformed, empty = suggestion, a narrower server cap); progress; kinds and marks (Q58 behind the recorder
/ already added never selectable, Q59 recorder offer only with a pre-fill and not for the own recorder, no service, `addable` decides);
**Q57** - the bulk targets leave out a camera that refused the same pair, take it again only with a new pair, never the lockout stop,
never an unticked or non-selectable one; the block reasons; the row retry; the state lines; streams (suggestion, unusable fallback,
LTR resolution, H.265); default name; clock evidence; pages and page sizes; refusal words (codes, 429 with `retry_after_s`, 403,
unknown); add failure words and the summary; merging an answer; finding a running scan again.

`tests/camera-discovery-2500.spec.ts` (4 tests x desktop 1440×900 + phone 390×844, mocked backend): an operator without
`system.configure` gets no button and the discovery routes are not even called; the setting off -> the note, manual add stays; the
whole flow (suggested range and cap, a /21 refused before sending, running with progress, step 2 by itself, recorder row disabled and
"הוספה כמקליט" opening the recorder form with name / vendor / host / port and an empty password, behind-the-recorder and already-added
rows disabled with their mark, "same for all" required, one press: the request carries exactly the 8 selectable cameras and
`same_for_all: true`, wrong password / lockout stop / no stream / clock shown, the bulk press disabled for the refused pair, the row
retry disabled for the same password and sent alone with `same_for_all: false` for a new one - the fake camera saw ONE wrong attempt,
preview request `{scan_id, device_id, profile, profile_token}` without an address, names / areas / explicit main and sub in the add
body, 5 added + 1 refused with its reason, no `rtsp://user@` in any request, closing sends `DELETE`, the card lists the new camera);
stop (DELETE) / resume of a scan already running (409 -> follow it) / nothing found (3 reasons, manual add opens the manual dialog);
a refused range in words with `role=alert`. At every step: the dialog body does not scroll, the page does not scroll sideways, and
axe-core (critical / serious) finds nothing inside the wizard.

| Run | Where | Command | Result |
|---|---|---|---|
| unit, new | PC, Node 24.21.0 | `npx playwright test -c playwright.unit.config.ts tests/unit-camera-discovery-2500.spec.ts tests/unit-camera-sources-2410.spec.ts` | 19 passed |
| unit, whole node-only suite | PC | `npx playwright test -c playwright.unit.config.ts --workers=4` | 5095 passed, 9 skipped, 0 failed (8.5 min) |
| browser, on the build | PC, `npm run build` (tsc + vite, exit 0) served by `vite preview`, Chromium | `SW_AXE_PATH=<axe-core 4.14.0 axe.min.js> npx playwright test tests/camera-discovery-2500.spec.ts tests/evidence-onvif-ui-2500.spec.ts --project=desktop --project=mobile` | 10 passed (8 + 2 captures). axe: 0 critical / serious inside the wizard at 7 checkpoints x 2 widths; the rest of the page has 1 pre-existing finding (`label-content-name-mismatch` on the shell's profile / nav-me button - outside this row, A11Y-AUDIT-2490 addresses it) |
| type check | PC | `npx tsc --noEmit -p tsconfig.json`; `-p tsconfig.tests.json` | both exit 0 (0 errors) |
| lint | PC, eslint 10.13.0 | `npx eslint` on the 7 changed / new `src` files | exit 0, no finding |
| gates | PC | `node scripts/unused-exports.mjs --enforce`; `node scripts/bundle-budget.mjs --dir dist --enforce` | no export outside the baseline; entry budget OK (the wizard is its own 40,216-byte chunk, not in the entry) |
| browser, second pass (this follow-up) | PC, rebuilt `dist` (tsc + vite, exit 0) on `vite preview`, Chromium, axe-core 4.x from a sibling worktree's node_modules | `npx playwright test tests/camera-discovery-2500.spec.ts tests/evidence-onvif-ui-2500.spec.ts --project=desktop --project=tablet --project=mobile`, light and `SW_SCHEME=dark` (the app's `?scheme=dark`) | light 15 passed; dark 18 passed (15 + 3 captures); axe 0 critical / serious inside the wizard at every checkpoint on 3 viewports x 2 schemes (contrast included). First tablet run: 1 failure - see "Tablet" below |
| backend, discovery chain | PC, main `.venv` Python 3.12 | `pytest tests/test_camera_discovery_2500.py tests/test_camera_discovery_api_2500.py tests/test_onvif_client_2500.py tests/test_camera_sources_2410.py` (198 tests, before the last test was added) and the 3 new / changed tests of `test_onvif_client_2500.py` | 198 passed; 3 passed; `scripts/gen_wire_types.py --check` exit 0 |
| runner | slot B | - | NOT_RUN (PC-targeted row; slot A is the release gate's) |
| real devices / lab | - | - | NOT_RUN (ONVIF-LAB-DOCS, owner approval per step) |

## Evidence

`private/planning/onvif_ui_2500_compare_2026-11-23.html` (+ the folder of the same name, not committed): the entry card before / after
(desktop 1440, phone 390) and every step after (scan setup, running, nothing found, identify, the recorder form pre-filled, identify
results, add, result), desktop and phone. Before = a build of `pilot/ONVIF-CLIENT-2500` @ d58353161; after = this branch; the same mocked
backend for both.

## Dark scheme and tablet (follow-up, 2026-11-23)

Every step captured and checked in the dark scheme (desktop 1440, tablet 1024x768, phone 390) and on the tablet in light: the same
no-scroll rule and axe at every step. The dark captures use the app's own `?scheme=dark` (Playwright's `colorScheme` alone does not switch
this app; `SW_SCHEME=dark` sets both). The wizard uses only `--sw-*` tokens, so the dark scheme needed no change: contrast findings 0.
**Tablet finding (fixed)**: at 1024x768 the identify step's 4 rows overflowed the dialog body by 36 px (`sh 635 > ch 599`). `pageSize`
now gives 4 rows from a 820 px viewport height and 3 below (unit test `pageSize('identify', false, 768) == 3`); 1440x900 still shows 5.
The captures are in section 10 of `private/planning/onvif_ui_2500_compare_2026-11-23.html`.

**Shell axe finding (not part of this row, only reported)**: `label-content-name-mismatch` (serious) on the shell's profile button
`button[data-profile-menu]` (desktop / tablet) and the navigation's `button[data-nav-me]` (phone): the accessible name does not contain the
visible text. It is on every page of the app (seen here with the wizard open or closed), not in the wizard; it needs its own row (the
A11Y-AUDIT-2490 family).

## Known limits / not done here

- Pixel baselines (`npm run visual`) are not refreshed in this row: the wizard is a new dialog behind a button, no existing baseline
  screen changed except the NVR page card (one more button). The runner baseline refresh belongs to the train.
- axe-core is not a dependency of this branch (A11Y-AUDIT-2490 adds it); the spec loads it from `SW_AXE_PATH` and records NOT_RUN
  without it.
- `contracts/API_INVENTORY.md` does not list the discovery routes yet (regenerated at release); `report:api-client` therefore lists
  `GET/POST cameras/discovery/scans` as "no inventory route" (report only).
- Real devices: NOT_RUN. The lab read-only run is the ONVIF-LAB-DOCS row and needs the owner's per-step approval.
- No `management/tasks.json` change (the lead registers the 2.5x ONVIF rows).

## Security review of the whole discovery chain (2026-11-23)

Scope: `origin/pilot/ONVIF-DISCOVER-2500 .. origin/pilot/ONVIF-UI-2500` (routers/camera_discovery.py, camera_sources.py preview form,
services/camera_discovery/{service,sweep,ranges,onvif_http,onvif_client,wsd,known}.py, settings registration, wire models, and the
front end: api, logic, dialog, card). Read-only review plus the two fixes below; no device, runner or lab was used.

| Area | Result |
|---|---|
| Credentials in a response | none: the answer models are exact (no user / password field, test `test_the_models_are_exact_and_have_no_secret_field`); a refusal names `details.fields` only, never a value; the preview form assembles the address with the pair on the server (`preview_source`) and returns the frame outcome only. **Finding 1 (fixed)**: see below |
| Serial / MAC | the serial is read once, used for the keyed fingerprint (HMAC with the installation salt) and dropped; `Device.view()` has no serial, `hardware_id` only feeds the classifier; no MAC is read anywhere |
| URLs in a response / log / audit | the audit rows carry range, counts, camera ids and refusal codes; logs carry job id and exception class only (two `log.warning` calls in the package); `onvif_json` stores manufacturer / model / firmware / profile tokens / device host and port - no stream address - and is not in any answer (`camera_sources.view` returns `origin` only). **Finding 1**: `profiles[].uri_masked` |
| Browser storage / URL | the wizard uses no `localStorage` / `sessionStorage` / IndexedDB / cookie / history / query string / console output; user and password live in component state, `autocomplete="new-password"`, cleared on close, on a new search and (**Finding 2, fixed**) on removal |
| SSRF: sweep | targets come only from `ranges.plan`: IPv4, at most 1,024, inside an RFC 1918 interface network of the HA host (never the Supervisor bridge, never public / CGNAT / link-local / loopback / multicast, never the host's own address, `source_policy.address_refused`), optionally narrowed by the allowed-ranges setting (which can never widen). Fail-closed when the site network is unknown. An answer is accepted only from a probed address and only for the probe sent to it |
| SSRF: outbound HTTP | every request goes to `Target(address, port, path)` where the address is the one that answered the probe; XAddrs of the device are kept only when their host is that same IP literal (names are never resolved, no user info, no query, `same_host_xaddrs`); no redirects, `trust_env=False` (no proxy), 3 s, 64 KiB, no DOCTYPE / ENTITY, closed allow-list of Get* actions, profile token regex-checked and escaped. Accepted residual: a device may announce another TCP port **on itself**, so Arx sends it a signed SOAP read there; it cannot reach another host |
| SSRF: stream addresses | `shape_stream` keeps rtsp / rtsps to the camera's own IP only, no user info, no fragment, no go2rtc `src` / `name` keys, bounded; the add and the preview go through `camera_sources.refusal` (source policy) and sealing as for a typed address |
| RBAC | all 7 routes and the preview form call `require(system.configure, INSTALLATION)` in the service (the two body routes also on a read connection before the body is read); every route is in the parametrised 403 + audit test; a scan of another person is `404` (no existence leak) unless the caller is a system administrator; the front end shows the button to `system.configure` only and a non-holder's session does not even call the routes (browser spec) |
| Rate limits | 6 scans an hour per installation, 3 per 10 minutes per person, one running scan, 20 identification presses per 10 minutes per person, the lockout guard (3 refusals per camera address per 15 minutes, across scans), one attempt per camera per press, one authenticated request in flight per camera, 16 requests / 20 s per camera per press, the preview shares the 6 / minute stream-test budget; the sweep is paced (10-200 datagrams a second) with a 10-minute deadline. Not limited, by design: the read routes (`GET` scan polling, in-memory) and `DELETE` |
| Body handling | 16 KiB cap, JSON content type, `extra=forbid`, strict types, per-field maxima (user 64, password 128, 64 devices) |

**Finding 1 (low-medium, fixed)** - `profiles[].uri_masked` returned the camera's stream address with only a secret-looking *query*
value masked. Some cameras put a user name, password or token in the *path* (`rtsp://ip/user=admin&password=...&channel=1`), so a
device-supplied secret could reach an answer. The front end never reads the field. Fix: `onvif_client.shown()` - the answer now carries
scheme, host and port only, the path and query become `/***`. Test: `test_a_stream_address_never_reaches_an_answer_with_its_path_or_query`
(`tests/test_onvif_client_2500.py`); the wire comment and `docs/changes/ONVIF-CLIENT-2500.md` follow.

**Finding 2 (low, fixed)** - closing the wizard cleared the typed pair and forgot the scan, but removing the element while it was open (a
route change) did not. `disconnectedCallback` now clears user, password, row passwords and the one-attempt memory, and sends `DELETE` for
a finished scan. Browser test: "security review: the wizard removed while open forgets the typed pair".

Noted, not changed: the one-attempt memory (`tried`) keeps `userpassword` of the pair last sent per device in component memory (never
stored or sent), until close / new search / removal; the identify and add routes are write routes behind the existing session and CSRF
rules (nothing new); the shell profile-button axe finding is a separate row (below).

## Rollback

Revert the branch (front end only). The server routes stay; without this UI they are simply not called.
