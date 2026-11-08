# NVRLESS-CAMERAS-2411 - camera screens in an installation without an NVR

Branch `pilot/NVRLESS-CAMERAS-2411` (from `release/2410-train` @ 99f500a71, the 2.41.0 candidate). Target: the next train; the lead
bumps the version, writes the changelog and runs the gate. No push, no merge, no tag. Code and tests only: no device, go2rtc, camera
or Home Assistant was contacted, the lab and the test runner were not touched.

## What

2.41.0 added cameras without a recorder (`docs/changes/CAMERA-STREAM-SOURCES-2410.md`): catalogue cameras of the pseudo-recorder
`standalone`, live video and snapshots through go2rtc streams `smplwise_cam_*`. The backend already served them without an NVR, but the
shell hid every camera screen when the installation had no NVR (`nvr` capability). This change makes the camera screens depend on "has
cameras" instead of "has an NVR".

1. **Backend capability `cameras_available`** (`smplwise/capabilities.py`), added to the capability block of `/me`, `/health`,
   `/health/report` and `/setup/state` - nothing renamed or removed:
   - `cameras_available` = `nvr` OR at least one catalogue camera of the pseudo-recorder `standalone`
     (`camera_sources.standalone_count`). A configuration fact like the connection settings (an administrator adds / removes such a
     camera), never a reachability fact.
   - A camera without a recorder is also a live source: `live_video` = `go2rtc` AND (recorder live OR WisKey OR Home Assistant OR a camera
     without a recorder). Without go2rtc it stays false (such a camera cannot stream without go2rtc).
   - `resolve(settings, conn=None)`: the four routes that build the block pass their database connection. Without a connection the
     answer is the pre-2411 one (no such camera). `ensure_capability(settings, name, conn=None)` likewise.
   - Leftover camera rows of a removed NVR (NN1 D5) do not count.
2. **Shell gating** (`frontend/src/shell/nav-capabilities.ts`): live overview, wall, saved views and kiosk need
   `cameras_available` + `supported` (was `nvr` + `supported`); the camera screen `#/live/cameras/<id>` needs `cameras_available` (was
   `nvr`). The navigation (rail, tab rows, phone bar, start screen) uses the same table, so the live entry appears without an NVR exactly
   when a camera without a recorder exists. A direct URL without cameras keeps the existing "no NVR" panel.
3. **Unchanged recorder-only areas**: playback, synchronised playback, historical map (`playback`), reviews, rules, search, cases, exports,
   event detail (`events_recorder`), camera health and camera settings (`nvr`). The NVRLESS-295 sensor events list stays as it is
   (`events_any`). The camera screen of a camera without a recorder already hides its recorder sections with the short Hebrew note
   (2.41.0).
4. **Which cameras show without an NVR** (`frontend/src/api/camera-visibility.ts`, pure functions): only the cameras without a recorder.
   `listCameras()` (api/maps.ts) drops the leftover NVR rows, their recorder entries and the `recorder` card when the installation has no
   NVR, so the overview, wall, saved views, kiosk, camera screen, cast pickers and every other list follow D5 in one place. The area
   screens' camera picker, camera card and the "camera" item count of the layout library keep the `standalone` group / source and drop the
   NVR ones (before: everything of kind `nvr` was dropped).
5. **Live overview without an NVR**: the recorder's storage card ("measured against the NVR") is not shown; the cameras tile opens the wall
   instead of the camera health page (hidden there); an offline camera without a recorder says "מצלמה ללא מקליט" and "the camera does not
   answer at its video address" instead of a channel number and "the NVR reports".
6. **Session refresh**: the "מצלמות ללא מקליט" card (הגדרות › אבטחה › NVR) re-reads `/me` after an add or a remove when the installation
   has no NVR, so the first camera added (or the last removed) shows / hides the live entry at once.
7. **Older backend**: a capability block without `cameras_available` is read as `cameras_available = nvr` (`resolveCapabilities`), the
   `ha_only` mode fallback and `applyNvrLess(true)` as `false`. So with zero cameras without a recorder and no NVR nothing changes.

8. **WebRTC (video) server required** (owner answer Q1):
   - Backend: `camera_sources.ensure_webrtc_server` - `POST /cameras/standalone` and `POST /cameras/source/test` answer 409
     `webrtc_server_required` ("כדי להוסיף מצלמה או לבדוק זרם נדרש שרת WebRTC. אפשר להגדיר אותו בהגדרות ← חיבורים.",
     `details.settings_href: "#/system/setup"`) when `go2rtc_url` is empty - after the permission (403 first), before the raw body is
     parsed, so no URL is looked at and nothing is written. The no-go2rtc stream test of `test_camera_sources_2410.py` now expects this
     code (was `media_not_configured`; the service-level check stays as a second line).
   - Capability block: `webrtc_server_configured` (= `go2rtc`), not a new capability name; nothing renamed.
   - Frontend (`api/camera-visibility.ts`: the texts, `webrtcServerReady`, `sourceControls`; `session.webrtcServer()`): the wall shows a
     panel with the notice and a "להגדרות ← חיבורים" action instead of the grid; the camera screen shows the notice and the link in
     place of the player; the overview's cameras tile reads "נדרש שרת WebRTC" and opens the settings page; the "מצלמות ללא מקליט" card's
     add button, the dialog's add (save) button and its "test stream" button are disabled with the same explanation (the edit dialog can
     still save an existing camera's addresses - the owner named add and test only).
9. **Floor map** (owner answer Q2 "א"): without an NVR the floor map keeps the camera anchors of cameras without a recorder
   (`mapCameraAnchors`, ids from `listCameras()`, which returns only them there) and offers its camera layer when `cameras_available`
   (`mapCameraLayerShown`); the selected camera's "recordings" button is not shown for such a camera. The plan editor's camera tool and
   layer follow `cameras_available`, its anchors keep the cameras without a recorder, and its camera list offers only them without an NVR
   (leftover NVR rows stay out, D5). The multi-camera selection (wall / playback) stays hidden without an NVR, as before. With an NVR
   nothing changes.

## Owner decisions (08.11, final)

| # | Decision | Where |
|---|---|---|
| 2א | No NVR: show the camera screens when at least one camera without a recorder exists - live, the camera list / wall, the camera screen, the area camera cards and picker. Recorder-only areas stay hidden (or show their existing short "no recorder" note). Zero such cameras and no NVR: nothing changes. | sections 1-7 |
| 1א | Adding a camera without a recorder with an area does NOT add a camera card to that area automatically. Left as is: the area is stored and shown, the camera is offered in the area's camera-card picker, placing the card stays a layout edit. | no code change (recorded here and in the 2410 doc) |
| Q1 (08.11, second round) | No NVR and no go2rtc: "show, but a WebRTC server is required". With a camera without a recorder the camera screens STILL appear (`cameras_available` unchanged). Without go2rtc the wall, the camera screen and the overview's cameras tile show "כדי להציג וידאו נדרש שרת WebRTC. אפשר להגדיר אותו בהגדרות ← חיבורים." with a link to `#/system/setup` (הגדרות › חיבורים, the go2rtc card). Adding a camera without a recorder and "test stream" are disabled with the same explanation, and the server refuses them: 409 `webrtc_server_required`, after the permission and before the body is parsed. The UI reads `webrtc_server_configured` next to `cameras_available`. | section 8 |
| Q2 (08.11, second round), answer א | The floor map draws cameras without a recorder on its camera layer in an installation without an NVR, like NVR cameras; recorder-only actions (recordings / playback) stay hidden for them; NVR installations unchanged. | section 9 |

## Decisions taken here (recorded, not asked)

- **A backend flag, not client guessing**: the shell could have inferred "has standalone cameras" from `GET /cameras`, but the navigation
  is drawn from `/me` before any screen loads; a flag on the capability block keeps the one-table model of NN1.
- **The flag does not require go2rtc** (confirmed by the owner, Q1): the screens appear and say that a WebRTC server is required
  (section 8).
- **`webrtc_server_configured` is an extra key, not a capability name**: it has the value of `go2rtc`, so the route table and
  `ensure_capability` keep using `go2rtc`; the existing flag-matrix tests are untouched by it.
- **`nvrLess()` kept** for the NVR-specific places (NVR settings tabs, storage, diagnostics, setup); only the camera surfaces moved.

## Files

Backend: `smplwise/capabilities.py`, `smplwise/services/camera_sources.py` (`standalone_count`), `smplwise/routers/me.py`,
`smplwise/routers/health.py`, `smplwise/services/health_report.py`, `smplwise/services/setup_wizard.py`,
`smplwise/routers/camera_sources.py` (the 409 gate); `tests/test_nvrless_cameras_2411.py` (new), `tests/test_installation_capabilities.py`
(expected flags gain `cameras_available`), `tests/test_camera_sources_2410.py` (the no-go2rtc stream test expects `webrtc_server_required`).

Frontend: `src/api/camera-visibility.ts` (new), `src/api/capabilities.ts`, `src/api/maps.ts`, `src/shell/nav-capabilities.ts`,
`src/shell/nav.ts` (`applyNvrLess`), `src/screens/devices-camera-card.ts`, `src/screens/devices-camera-picker.ts`,
`src/screens/devices-layout.ts`, `src/screens/live-overview.ts`, `src/components/standalone-cameras-card.ts`, `src/api/session.ts`
(`webrtcServer`), `src/screens/live-wall.ts`, `src/screens/live-camera.ts`, `src/components/camera-source-dialog.ts`,
`src/screens/explore-floor-map.ts`, `src/screens/explore-plan-editor.ts`;
`tests/unit-nvrless-cameras-2411.spec.ts` (new), `tests/unit-capabilities.spec.ts` (installations A / B say `cameras_available: false`;
the live needs read `cameras_available`), `tests/nn1-p2-mocks.ts` (`cameras_available: nvr`).

Docs: `docs/architecture/CAPABILITIES.md` (the flag, the route table), `docs/changes/CAMERA-STREAM-SOURCES-2410.md` (open questions
answered).

## Tests

Run on the workstation, 2026-11-08, Python 3.12 venv of the main checkout, Node 24.21.0 (`frontend/node_modules` is a junction to the
main checkout's, not committed). Backend commands from `smplwise_vms/backend`, frontend from `frontend`.

| Command | Result |
|---|---|
| `python -m pytest tests/test_nvrless_cameras_2411.py tests/test_installation_capabilities.py` | **69 passed** (17 new + 52 existing) |
| guards: `python -m pytest tests/test_capmap_295.py tests/test_pwclean_295.py tests/test_plan_routes_unique.py tests/test_no_ip_literals.py tests/test_gate_always_run.py tests/test_capabilities.py tests/test_remote_access.py tests/test_raw_body_order.py tests/test_body_limit.py tests/test_route.py tests/test_db_gate.py tests/test_db_template.py` (after the code commit, so `git ls-files` sees the new files) | **240 passed** |
| related, serial: `python -m pytest tests/test_nvr_less.py tests/test_setup_wizard.py tests/test_health_report.py tests/test_camera_sources_2410.py tests/test_cameras.py tests/test_camera_card.py tests/test_media.py tests/test_media_api.py tests/test_notify_sources.py tests/test_multi_nvr.py tests/test_recorder_health.py` | **301 passed**. The 5 wall-clock tests of `test_nvr_less.py` (`test_nvr_routes_answer_409_nvr_not_configured[...]`) and `test_setup_wizard.py::test_a_slow_device_is_cut_off_at_the_check_deadline`, which failed on main in the 2410 run, **passed in this run** - they are load-dependent timing assertions; nothing was loosened. |
| `npx tsc --noEmit` | exit 0 |
| `npx playwright test -c playwright.unit.config.ts tests/unit-nvrless-cameras-2411.spec.ts tests/unit-capabilities.spec.ts tests/unit-nvr-cameras-logic.spec.ts tests/unit-tabs-config.spec.ts tests/unit-security-public.spec.ts tests/unit-wiskey-switches.spec.ts tests/unit-camera-sources-2410.spec.ts` | **59 passed** |
| lint / screen specs: `unit-a11y-polished-lint, unit-dark-polish-beds, unit-date-format-module, unit-empty-state-icons, unit-menu-lint, unit-page-background, unit-token-lint, unit-uxfix-rtl, unit-video-2403, unit-tickets-gate-295, unit-camera-reboot-2407, unit-cast-logic` | **87 passed** |

Second round (after the owner answers, sections 8-9), same workstation and tools, after the code commits:

| Command | Result |
|---|---|
| `python -m pytest tests/test_nvrless_cameras_2411.py tests/test_installation_capabilities.py tests/test_camera_sources_2410.py` | **127 passed** (27 + 52 + 48; 10 new tests for the 409 and the flag) |
| the same 12 guard files as above | **240 passed** |
| `npx tsc --noEmit` | exit 0 |
| the same 7 unit specs as above | **63 passed** (4 new: the flag, the notice and link, the disabled add / test, the map layer gating) |
| the same 12 lint / screen specs as above | **87 passed** |

The related backend suites (301 above) were not re-run in the second round: NOT_RUN for this round (the second round touched only the
two camera-source routes, the capability block's extra key and the frontend).

## NOT_RUN

- The full frontend unit run (every spec; over an hour on the workstation), the pixel suite, the evidence (screenshot) suites, the full
  backend suite and the gate: not run (the runner is offline; the lead runs the gate).
- No browser walk of the shell in an installation without an NVR with a camera without a recorder: the gating is covered by the unit
  specs only. Recommended evidence on the runner: installation B (go2rtc, no NVR) + one camera without a recorder - the rail with the live
  entry, the overview, the wall, the camera screen, an area camera card / picker; and installation A without such a camera (unchanged).
- Lab: no real go2rtc or camera.

## Expected pixel / evidence changes

- **Pixel baselines: none expected.** Every existing pixel / evidence mock either has an NVR (`cameras_available` true, all gates as
  before), or has no NVR and no camera without a recorder (`mode: ha_only`, or a block without the flag, or `nn1-p2-mocks.ts` with
  `cameras_available: nvr`) - the same screens and panels as before. The live overview's storage card and cameras tile change only
  without an NVR, where the overview was blocked before.
- **New evidence to add** (not built here): the installation-B-plus-camera walk listed under NOT_RUN; installation A (no go2rtc) with a
  camera without a recorder: the wall panel, the camera screen notice, the overview tile "נדרש שרת WebRTC", the disabled add / test on
  הגדרות › אבטחה › NVR; the floor map camera layer without an NVR.
- **Possibly affected evidence**: any evidence mock whose capability block has `go2rtc: false` and renders the "מצלמות ללא מקליט" card
  or the source dialog (`evidence-nvr-cameras`, `evidence-security-*`, `evidence-nn1-p2` in installations A / C): the add button and the
  test button are now disabled there with the notice. Pixel baselines: none of them renders these screens (as in the 2410 doc).

## Open questions

None. Both questions of the first round were answered by the owner on 08.11 (Q1: show + WebRTC server required; Q2: א).

## Rollback

Revert the branch commits. No migration, no stored flag; an older shell ignores the extra field, and this shell reads an older block as
before.
