# EVIDENCE-CAMERAS-2412 - the screenshots 2.41.0 / 2.41.1 left NOT_RUN, and what they found

Branch `docs/EVIDENCE-CAMERAS-2412` (from `origin/main` @ 9e6a8d62c, v2.41.1). Evidence plus small fixes in the 2.41.x camera screens;
no version bump, no merge, no tag. No device, camera, NVR, go2rtc or Home Assistant was contacted: every backend is the real SMPLWISE
backend with fake devices only, every camera address is a placeholder under the reserved `camera.example` name. The lab and the test
runner were not touched. `db.py`, migrations and the backend tests `test_nvr_less*` / `test_setup_wizard*` were not touched.

Closes the evidence gaps of `docs/changes/NVRLESS-CAMERAS-2411.md` (NOT_RUN: "no browser walk of the shell in an installation without an
NVR with a camera without a recorder"; "new evidence to add") and `docs/changes/CAMERA-STREAM-SOURCES-2410.md` (NOT_RUN: the NVR page's
"מצלמות ללא מקליט" card and the camera screen's video source accordion).

## How it was captured

- Spec: `frontend/tests/evidence-nvrless-cameras-2412.spec.ts` (new). It runs against a fixture backend and skips without one.
- Fixture backend: `frontend/tests/fixtures/nvrless_cameras_backend.py` (new) - the real backend with no NVR (`SW_MODE=ha_only`), the fake
  Home Assistant of `devices_fake_ha.py`, and its in-process fake go2rtc only with `SW_WEBRTC=1`; `SW_WEBRTC=0` removes the go2rtc address
  before the settings are read. The recorder installation uses the existing `frontend/tests/fixtures/multi_nvr_backend.py`.
- Data: the spec seeds everything through the real API (idempotent): two HA areas, two cameras without a recorder through
  `POST /cameras/standalone` (`כניסה ראשית` with main + sub address, `חניון` with a main address only; credentials `viewer:fixture-pass`,
  a made-up value), a site / building / floor with a generated plan picture, published, and the first camera placed on it.
- Three installations, one per `SW_EVID2412` value:
  - **b** no recorder, WebRTC server configured (fake go2rtc), the two cameras. Seeds the data.
  - **a** the same data dir restarted with `SW_WEBRTC=0`: no recorder and no WebRTC server.
  - **d** a recorder installation (`multi_nvr_backend.py`): the per-camera video source dialog of an NVR camera.
- Widths: the Playwright projects `desktop` 1440, `tablet` 1024, `mobile` 390 (Pixel 7 profile), light; `SW_DARK=1 --project=desktop` for
  1440 dark (`emulateMedia` + `scheme=dark` + `data-theme`, as `evidence-dark-seg-all-2380.spec.ts`).
- Commands (workstation, Node 24.21.0, `npx vite build` first, `vite preview` on 4412 → 8411 and 4413 → 8421):

      SW_PORT=8411 SW_DATA_DIR=<dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni SW_WEBRTC=1 python frontend/tests/fixtures/nvrless_cameras_backend.py
      SW_LIVE=1 SW_EVID2412=b SW_API_PORT=8411 SW_BASE_URL=http://127.0.0.1:4412/ \
        npx playwright test tests/evidence-nvrless-cameras-2412.spec.ts --project=desktop --project=tablet --project=mobile --workers=1
      (the same with SW_DARK=1 --project=desktop; then restart the backend on the same data dir with SW_WEBRTC=0 and run SW_EVID2412=a;
       multi_nvr_backend.py on 8421 for SW_EVID2412=d)

- The spec also records layout facts per shot (page horizontal overflow, every element that scrolls inside the page, visible Latin words)
  into `SW_FACTS_DIR` (outside the repository); the findings below come from those facts and from looking at every shot.
- What is fake and says so: live video (the fake go2rtc has a stream table, no media), so tiles and players show "no video" states; the
  cameras turn "לא מחובר" after the first health pass (the placeholder name never resolves). The successful stream test in
  `d-source-dialog-test-ok-*` is a browser-side answer (`page.route`) with a drawn preview - no camera exists; `d-source-dialog-test-real-*`
  is the real backend's answer for the placeholder address.

## What was captured

Folder `docs/changes/evidence/EVIDENCE-CAMERAS-2412/`, `<installation>-<screen>-<width>[-dark].png`; every screen at 390 / 1024 / 1440
light and 1440 dark unless noted.

| Request | Shots | What they show |
|---|---|---|
| a. no recorder, no WebRTC server | `a-overview-*` | the cameras tile reads "נדרש שרת WebRTC" and links to `#/system/setup` (asserted) |
| | `a-wall-*` | the wall's panel "נדרש שרת WebRTC" with "להגדרות ← חיבורים" instead of the grid |
| | `a-camera-*` | the camera screen's notice and link in place of the player (asserted `a[href="#/system/setup"]`) |
| | `a-security-nvr-*` | הגדרות › אבטחה › NVR: the two cameras, "הוסף מצלמה ללא מקליט" disabled (asserted on the inner button) with the explanation |
| | `a-source-dialog-*` | the source dialog of an existing camera: masked addresses, "בדיקת זרם" disabled with the explanation |
| | (API, asserted) | `POST /cameras/standalone` and `POST /cameras/source/test` answer 409 `webrtc_server_required`, `details.settings_href = #/system/setup` |
| b. no recorder, WebRTC server, 2 cameras | `b-overview-*`, `b-wall-*`, `b-camera-*` | the camera screens are offered; the wall has exactly the 2 cameras; the camera screen says "ללא מקליט" |
| | `b-playback-blocked-*` | a direct URL to playback gets the "האזור הזה דורש NVR" panel; no playback / camera health / camera settings link anywhere in the shell (asserted on every `a[href]`) |
| | `b-security-nvr-*`, `b-add-dialog-*` | the card with add enabled, no notice; the add dialog with name, area (HA areas), main address, test enabled |
| c. floor map + plan editor | `b-floor-map-*`, `b-floor-map-selected-*` | the camera layer draws the camera without a recorder; its card has no "recordings" button (asserted) |
| | `b-editor-camera-tool-*`, `b-editor-placed-*` (1440, 1024) | the camera tool lists only the camera not yet placed; a click on the plan places it (asserted through `GET /floors/{id}/anchors`) |
| | `b-editor-phone-390` | at phone width the editor says "עריכת מבנה וקומות זמינה במחשב בלבד" (by design): no placement at 390 |
| d. video source dialog (recorder installation) | `d-camera-source-row-*` | camera screen › הגדרות מצלמה › מקור וידאו: "המקור כעת: מהמקליט" |
| | `d-source-dialog-recorder-*` | the two-way choice "מהמקליט" / "כתובת ידנית" |
| | `d-source-dialog-manual-*` | manual RTSP main + sub addresses |
| | `d-source-dialog-test-real-*` | the real backend's stream test answer for the placeholder ("המצלמה ענתה, אבל הנתיב בכתובת לא נמצא.") |
| | `d-source-dialog-test-ok-*` | a successful test: preview, resolution and codec (browser-side answer, see above) |
| | `d-camera-source-saved-*`, `d-source-dialog-masked-*` | after saving: "כתובת ידנית", and the reopened dialog shows `viewer:***@` (asserted; `GET /cameras/{id}/source` carries no password, asserted) |

`before-*.png` are the same screens before the fixes below (1440 / 390 as noted), kept as receipts.

The PNGs are palette-quantized (256 colours) and the phone shots scaled to 780 px wide (2x of 390) to keep the folder small (~5.4 MB
for 97 files).

## Findings

Fixed here (small, clearly bugs in the 2.41.x screens; a test for each):

1. **The video source dialog cut its fields off** (2.41.0). Its body asks for `min(560px, 86vw)`, the default `sw-dialog` box is 440 px:
   the area select and the addresses ran past the dialog's left edge and the body scrolled sideways (facts: `div.body 592x293/440x293`).
   Receipt `before-b-add-dialog-1440.png`. Fix: the dialog uses the `wide` box (720 px) and the body asks for `min(560px, 100%)`.
2. **Resolution drawn backwards** (2.41.0): the stream test line "הזרם תקין · 1920×1080 · H.264" rendered `1080×1920` in the right-to-left
   line. Receipt `before-d-source-dialog-test-ok-1440.png`. Fix: the resolution is one left-to-right isolate (`ltrIsolate`).
3. **The "this area needs an NVR" panel contradicted 2.41.1**: with cameras without a recorder it still said "לייב, מצלמות ... אינם
   זמינים" while live and the cameras were in the navigation. Receipt `before-b-playback-blocked-1440.png`. Fix: with `cameras_available`
   it says "הקלטות, ניגון, תיקים וייצוא אינם זמינים. מצלמות ללא מקליט מוצגות בלייב; ..." (`nvrLessHint`); without, the text is unchanged.
4. **NVR words for a camera without a recorder on the floor map card** (2.41.1, Q2): "שם ב־NVR: ch 1", "ערוץ 1", "תמונה: צילום מה־NVR",
   offline "המצלמה אינה מחוברת ל־NVR". Receipt `before-b-floor-map-selected-1440.png`. Fix: "מקור: מצלמה ללא מקליט", no channel, "תמונה:
   צילום מהמצלמה (מתרענן).", offline "המצלמה אינה עונה בכתובת הווידאו שלה". NVR cameras unchanged.
5. **English and NVR words in the plan editor for such a camera** (2.41.1): the camera list said `ch 2 · offline`, the inspector "מקור:
   NVR · ch 2". Receipts `before-b-editor-camera-tool-1440.png`, `before-b-editor-placed-1440.png`. Fix: "מצלמה ללא מקליט · מנותקת" /
   "מקור: מצלמה ללא מקליט". NVR cameras keep `ch N · status` (see finding 10).
6. **No WebRTC server, but the camera screen said "the camera does not answer"** (2.41.1, Q1): a camera whose stored status was
   `offline` (from before the server was removed - nothing can check it without the server) got the offline reason instead of the owner's
   "כדי להציג וידאו נדרש שרת WebRTC" notice. Receipt `before-a-camera-1440.png`. Fix: `cameraPane` - without the server the notice wins
   over the stored status (a still-only camera and a camera without live permission are unchanged; with the server nothing changes).
7. **The notice's link was the browser's default blue** on the dark video area (2.41.1). Receipt `before-a-camera-link-1440.png`. Fix:
   the link inherits the notice colour, bold and underlined.
8. **The "מצלמות ללא מקליט" rows ran off a phone screen** (2.41.0): at 390 px "הסר" was past the left edge (facts: `main` scrolled
   436/390). Receipts `before-a-security-nvr-390.png`, `before-b-security-nvr-390.png`. Fix: the three actions sit in one group that wraps
   under the name (the name keeps at least 7em). The spec now asserts every remove button is inside the viewport.

Recorded, not fixed (outside these screens, or not small):

9. **The live player says "go2rtc לא זמין"** (`sw-live-player.ts`, codes 4503 / `upstream_unavailable`) - an internal product name on
   the face, on every camera screen (`b-camera-1440.png`, `d-camera-source-row-*`). Generic player text, older than 2.41; the laddered
   path already says `VIDEO_SERVER_DOWN`.
10. **The plan editor's camera list shows the raw `ch N · online|offline`** for NVR cameras too (English status). Left as it was for NVR
    cameras (would change NVR-installation screens; worth one Hebrew status map for both).
11. **The live overview's "דורש תשומת לב" card scrolls inside itself at 1024 x 768** (`b-overview-1024.png`, facts `div.body
    332x272/332x157`) - an inner scroll in a control screen, which the owner forbids. A layout matter of the overview, not of 2.41.x.
12. **Without the WebRTC server the attention list still says "מצלמה מנותקת" for both cameras** (`a-overview-1440.png`): the stored
    status is stale (see 6); the backend keeps it. Worth deciding whether the health pass should mark such cameras "unknown" when go2rtc is
    not configured (backend; not touched here).
13. **The camera screen keeps its player controls** (main / sub, MSE / WebRTC, "מתחבר…") under the "no WebRTC server" notice
    (`a-camera-*`): "מתחבר…" never ends there. Hiding them is a design call.
14. **A broken-image glyph** at the top corner of the player when the poster snapshot fails (`b-camera-1440.png`, `d-*`). Generic player.
15. **The camera screen at 1440 x 900 and the plan editor scroll the page** (facts `main 959/900`; editor body up to 1710 px with the
    inspector open) - page scroll, not an inner scroll; older than 2.41.
16. The setup banner reads "2 מתוך 4 שלבים" in b and "2 מתוך 3" in a - expected (the go2rtc step is optional without it), noted only.

No raw entity id and no other English leak was found in the 2.41.x screens beyond 5 (fixed) and 9-10. The dark scheme showed no contrast
break besides 7.

## Files

- `frontend/src/api/camera-visibility.ts` - `nvrLessHint` (+ texts), `STANDALONE_LABEL`, `cameraStatusText`, `editorCameraMeta`,
  `editorCameraSource`, `standaloneMapNote`, `STANDALONE_OFFLINE_TILE`, `cameraPane` (pure).
- `frontend/src/shell/sw-app.ts` (panel hint), `frontend/src/components/camera-source-dialog.ts` (wide box), `frontend/src/screens/camera-source-logic.ts`
  (resolution isolate), `frontend/src/screens/explore-floor-map.ts` (card words), `frontend/src/screens/explore-plan-editor.ts` (list and
  inspector words), `frontend/src/screens/live-camera.ts` (pane precedence, link style), `frontend/src/components/standalone-cameras-card.ts`
  (rows wrap).
- Tests: `frontend/tests/unit-evidence-cameras-2412.spec.ts` (new, 8 tests), `frontend/tests/unit-camera-sources-2410.spec.ts` (the two
  `testLine` expectations now expect the isolated resolution), `frontend/tests/evidence-nvrless-cameras-2412.spec.ts` (new),
  `frontend/tests/fixtures/nvrless_cameras_backend.py` (new).
- Evidence: `docs/changes/evidence/EVIDENCE-CAMERAS-2412/*.png`.

## Tests

Run on the workstation, 2026-11-09, Node 24.21.0, the main checkout's Python 3.12 venv for the fixture backends (`frontend/node_modules`
is a junction to the main checkout's, not committed). Frontend commands from `frontend`.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (after the last source change) |
| `npx vite build` | built (the evidence runs used the final build) |
| `npx playwright test -c playwright.unit.config.ts tests/unit-evidence-cameras-2412.spec.ts tests/unit-nvrless-cameras-2411.spec.ts tests/unit-capabilities.spec.ts tests/unit-nvr-cameras-logic.spec.ts tests/unit-tabs-config.spec.ts tests/unit-security-public.spec.ts tests/unit-wiskey-switches.spec.ts tests/unit-camera-sources-2410.spec.ts` | **71 passed** (8 new + the 63 of the 2411 doc's seven specs) |
| the 12 lint / screen specs of the 2411 doc (`unit-a11y-polished-lint` ... `unit-cast-logic`) | **87 passed** |
| evidence b: `SW_EVID2412=b ... --project=desktop --project=tablet --project=mobile` | **14 passed**, 13 skipped (the other installations' tests, and the phone placement: no camera tool at 390, by design) |
| evidence b dark: `SW_DARK=1 ... --project=desktop` | **5 passed** |
| evidence a (3 widths) / a dark | **9 passed** / **3 passed** |
| evidence d (3 widths) / d dark | **3 passed** / **1 passed** |

## NOT_RUN

- Pixel suite, the full frontend unit run, the full backend suite and the gate: not run (runner not used). No pixel spec renders the
  changed screens (grep of `frontend/tests/pixel-*.spec.ts` for the panel, the source dialog, the standalone card, the plan editor's
  camera tool and the camera route: no match), so no baseline is expected to change.
- Backend tests: not run - no backend file changed.
- Real video: no go2rtc, camera or NVR - the live tiles and players show their "no video" states throughout; a real playing stream on a
  camera without a recorder is still unverified (lab).
- The new spec is not listed in `frontend/tests/fixtures/fixture_specs.json` (the runner's fixture job): it needs two backend restarts
  on one data dir (b then a), which that job does not do. Left for the lead to decide.
- The kiosk and saved views without an NVR, the area camera card / picker with a camera without a recorder: not captured.
