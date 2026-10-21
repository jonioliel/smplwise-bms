# Upstream watch refresh - 2026-10-21

Branch `pilot/UPSTREAM-295` (from `release/2111`). Registry: `management/upstream_watch.json`. Checked with `scripts/upstream_check.py` (90 items, 74 HTTP requests, all read from the workstation, nothing run on the runner) plus manual fetches of the Home Assistant, Supervisor, Starlette, Node, Python and SQLite pages. No dependency was upgraded and no lock file or `requirements.txt` was touched. This is a registry and report change only.

## Urgent items

None. Nothing found that breaks the add-on today. The two things most worth a deliberate check are in the watch list below (Supervisor ingress `panel_admin` enforcement, HA 2026.10 username normalization).

## What changed in the registry

- Review state (`last_checked`, `last_seen_version`) advanced for items that were only "new release" with no flag: ha-frontend 20260930.4, cloudflared add-on 7.0.18, cloudflared binary, ha-os-base-image 2026.10.0, OpenAI SDK 3.36.0, androidx.webkit 1.18.0, FastAPI 0.158.0, pydantic 2.14.1, websockets 17.3, ezdxf 1.4.5, Rollup 4.64.12, Starlette 1.9.0, Wrangler 4.151.3, Vitest 5.0.5, Visonic pre-release.
- Items flagged "attention" were deliberately NOT acknowledged, so they keep showing in the next run (ha-core, ha-supervisor, ha-os, Vite, TypeScript, Playwright, Pillow, Gradle, AGP, Music Assistant, Frigate and others).
- New entries: `node-lts` (Node 24 LTS, tag feed) and `sqlite` (changelog regex feed).
- Fixed a broken feed: the HA developer blog atom URL returns 404. `ha-dev-blog` and `ha-addon-spec` now read `https://developers.home-assistant.io/blog/rss.xml` (works; the blog has also moved to contributors.home-assistant.io behind a 301).
- Review notes were appended to the `note` field of ha-core, ha-supervisor, py-starlette and py-httpx. The Hebrew `impact_he` fields were not edited.

## Watch list (details)

1. **Home Assistant Core 2026.10.2** (2026.10.0 released 2026-10-07; the recorded lab version is still 2026.9.4 and was not re-verified live). Breaking changes that touch us: *Authentication* - the legacy auth provider mode is removed and usernames are always normalized (lowercase, trimmed). Verify that our matching of HA usernames (`ha_user_auth.py`, bindings) is case-insensitive or id-based. *MQTT* publish/dump now require an admin (relevant only to the planned Paradox PAI path). 2026.10.2 also revokes refresh tokens when a user is removed. I could read only the first ~100k characters of the release-notes page, so the developer-facing section was not seen; the script's parsed list of 22 backward-incompatible headings matches our registry only for MQTT.
2. **HA Core 2026.11 (developer blog, upcoming):** auth providers opt in to MFA through `MfaLoginFlow` (custom auth providers are unsupported by HA; look again when 2026.11 betas appear if our login path depends on a second-factor step); climate and water_heater entities get `temperature_unit` and `native_` prefixed properties (watch our device-control climate handling).
3. **Supervisor 2026.10.2 / .3:** PR 7308 enforces `panel_admin` for ingress sessions (a non-admin gets 403 on panels that set it). Our add-on declares `panel_admin: false`, so non-admin ingress should still work, but this is exactly the path the product depends on: run the real non-admin ingress check on a 2026.10 Supervisor before the lab is updated. 2026.10.1 rejects WebSocket batches containing denied commands in the HA proxy and adds a sliding expiry for ingress sessions. 2026.10.3 filters ingress identity headers case-insensitively (we read the user from ingress headers; no change expected).
4. **WisKey compatibility (task wiskey-ha-compat-w12):** the task id is not present in `management/tasks.json` on this branch, so I could not read its acceptance criteria. The registry still records `2.0.0-rc.37`. The GitHub releases feed for the WisKey repository returns 404 (private or renamed), so its own releases could not be checked. From the HA side I found nothing in 2026.10 that changes custom-panel, WebSocket-command or embed behaviour; the exposure is the username normalization and the Supervisor ingress change above, since the WisKey panel is embedded inside our ingress session. Uncertain: frontend and custom-panel internals were not visible in the notes I could read.
5. **Starlette / httpx TestClient warning:** Starlette now prefers `httpx2` in `starlette.testclient` and warns that using `httpx` there is deprecated (httpx2 support since Starlette 1.2.0; PyPI shows an httpx2 2.x line). Not removed yet, no removal date found. httpx itself is at 0.28.1 and we pin 0.27.2. Only tests are affected. Suggested separate task: try `httpx2` as a test-only dependency. Starlette 1.8.0 dropped Python 3.10 and 1.7.0 requires anyio 4 (we run Python 3.12, fine). The starlette.io host did not resolve, so I used the repository's release-notes file and search results; the exact warning text comes from third-party issue reports.
6. **Python / Node / SQLite:** Python 3.12.15 (2026-09-30) is current for 3.12, security-only until October 2028. Node 24 LTS is v24.22.1 (2026-10-20) versus 24.21.0 on the workstation; v22 LTS is 22.23.4; 26.x is Current, not LTS. SQLite 3.54.1 (2026-10-16) fixes a 32-bit heap overflow only; 3.54.0 makes ALTER TABLE error on columns named ROWID/OID and calls the authorizer for functions in DEFAULT clauses. The engine version arrives with the base image, so check the image's SQLite after the next image rebuild.
7. **Cloudflare Workers runtime / platform:** the Cloudflare changelog had WAF, bot and free-plan limit entries on 2026-10-14, 16 and 21. I did not read them in detail; marked watch. The Workers runtime entry is manual and was not re-checked.
8. **Hikvision NVR and door station firmware:** manual items; no vendor page was fetched (firmware notices are not published as a feed). Recorded V4.84.101 (NVR) and V3.9.0 (door station) are unchanged and unverified.
9. **Version gaps on pinned packages (none urgent):** FastAPI 0.141.1 pinned vs 0.158.0; Vite 6.4.3 vs 8.3.5; TypeScript 5.9.3 vs 7.0.2; Pillow 12.3.0 vs 13.0.0; Playwright 1.63.0 vs 1.64.1; Vitest 3.2.7 vs 5.0.5; uvicorn 0.53.0 vs 0.54.0; pydantic 2.13.5 vs 2.14.1; Gradle 8.11.1 vs 9.8.2 and AGP 8.9.1 vs 9.4.1 (major; 9.5 RC is out); websockets 17.3 is outside the `<16` constraint noted in the registry. I identified no advisories in what I read, but I did not query a vulnerability database.
10. **Integrations and add-ons:** Music Assistant 2.10.7 (2.11.0b5 pre-release out), Frigate 0.18.2 (planned only), go2rtc v1.9.14 (unchanged, current), HAOS 18.3 (18.4.rc1 out), HA frontend 20260930.4, Companion Android 2026.10.1, cloudflared add-on 7.0.18 (registry had 7.0.17), cloudflared binary 2026.10.3, ha-whatsapp 2.1.6. Design-reference repositories (Bubble Card, NeonPlan3D, DomusUI, Advanced Camera Card, Universal Remote Card, Magic Frame) have new releases and are reference-only.

## Not verified / limits

- Lab HA, Supervisor and add-on versions were not queried (desk research only).
- WisKey, Hikvision firmware, Provision-ISR, web push, FCM and APNs entries are manual items with no feed.
- The registry offline tests (`smplwise_vms/backend/tests/test_upstream_watch.py`) were NOT_RUN: pytest is not installed in the workstation Python 3.12. `scripts/upstream_check.py --validate` passed (90 items).

## Summary table

Recorded = version last recorded in the registry before this refresh (review state, else the pinned version). Pinned/lab = what we run or build against, where known. Action: none / watch / plan upgrade / urgent.

| Entry | Recorded | Pinned / lab | Latest | Action |
|---|---|---|---|---|
| advanced-camera-card | - | - | v8.1.0 | watch |
| aegis-ajax | - | - | v1.27.2 | watch |
| alpine-linux | 3.22 | 3.22 | - | watch |
| android-agp | 8.9.1 | 8.9.1 | 9.4.1 | watch |
| android-sdk-policy | targetSdk 35 / compileSdk 36 | targetSdk 35 / compileSdk 36 | - | watch |
| android-toolchain-gradle | 8.11.1 | 8.11.1 | 9.8.2 | watch |
| androidx-biometric | 1.1.0 | 1.1.0 | 1.1.0 | none |
| androidx-webkit | 1.17.1 | 1.14.0 | 1.18.0 | none |
| apns-ios-push | - | - | - | watch |
| bubble-card | - | - | v3.4.2 | watch |
| chrome-webview-webrtc | 2026-09-30 | - | 2026-10-20 | watch |
| cloudflare-platform | - | - | 2026-10-21 | watch |
| cloudflare-workers-runtime | - | - | - | watch |
| cloudflared-addon | v7.0.17 | 7.0.17 | v7.0.18 | plan upgrade |
| cloudflared-binary | 2026.10.0 | - | 2026.10.3 | none |
| domusui | - | - | v1.5.0 | watch |
| fcm-android-push | - | - | - | watch |
| ffmpeg | n9.0.2 | - | n9.0.2 | none |
| frigate-nvr | - | - | v0.18.2 | watch |
| glasshome | - | - | - | watch |
| go2rtc | v1.9.14 | 1.9.14 | v1.9.14 | none |
| go2rtc-addon | 1.9.14 | 1.9.14 | 1.9.14 | none |
| ha-addon-spec | - | - | - | watch |
| ha-companion-android | - | - | 2026.10.1 | watch |
| ha-core | 2026.9.4 | 2026.9.4 | 2026.10.2 | plan upgrade |
| ha-dev-blog | - | - | - | watch |
| ha-frontend | 20260930.3 | - | 20260930.4 | none |
| ha-int-androidtv-remote | - | - | (via ha-core) | none |
| ha-int-cast | - | - | (via ha-core) | none |
| ha-int-dlna-dmr | - | - | (via ha-core) | none |
| ha-int-envisalink | - | - | (via ha-core) | none |
| ha-int-onkyo | - | - | (via ha-core) | none |
| ha-int-risco | - | - | (via ha-core) | none |
| ha-int-samsungtv | - | - | (via ha-core) | none |
| ha-int-smartthings | - | - | (via ha-core) | none |
| ha-int-sonos | - | - | (via ha-core) | none |
| ha-int-wiim | - | - | (via ha-core) | none |
| ha-os | 18.2 | 18.2 | 18.3 | watch |
| ha-os-base-image | - | - | 2026.10.0 | watch |
| ha-samsungtv-smart | v0.14.5 | - | v0.14.5 | none |
| ha-supervisor | 2026.09.2 | 2026.09.2 | 2026.10.3 | watch |
| ha-whatsapp | - | - | v2.1.6 | watch |
| hacs | 2.0.5 | - | 2.0.5 | none |
| hikvision-door-station-firmware | V3.9.0 build 260115 | V3.9.0 build 260115 | - | watch |
| hikvision-isapi-nvr | V4.84.101 build 251212 | V4.84.101 build 251212 | - | watch |
| legacy-hikvision-nvr-addon | 1.5.27 | 1.5.27 | - | watch |
| magic-frame | - | - | v1.5.7 | watch |
| material-components-android | 1.14.0 | 1.12.0 | 1.14.0 | none |
| music-assistant | - | - | 2.10.7 | watch |
| neonplan3d | - | - | v1.24.0 | watch |
| node-lts | - (new entry) | 24.21.0 (workstation) | v24.22.1 (2026-10-20, LTS) | plan upgrade |
| npm-gltf-validator | 2.0.0-dev.3.10 | 2.0.0-dev.3.10 | 2.0.0-dev.3.10 | none |
| npm-lit | 3.3.3 | 3.3.3 | 3.3.3 | none |
| npm-playwright-test | 1.63.0 | 1.63.0 | 1.64.1 | plan upgrade |
| npm-qrcode-generator | 2.0.4 | 1.4.4 | 2.0.4 | none |
| npm-rollup-wasm-node | 4.64.5 | - | 4.64.12 | none |
| npm-three | 0.186.1 | 0.186.1 | 0.186.1 | none |
| npm-types-node | 26.6.5 | 26.5.1 | 26.6.5 | none |
| npm-typescript | 5.9.3 | 5.9.3 | 7.0.2 | watch |
| npm-vite | 6.4.3 | 6.4.3 | 8.3.5 | watch |
| npm-vitest | 5.0.3 | 3.2.7 | 5.0.5 | plan upgrade |
| npm-wrangler | 4.149.0 | - | 4.151.3 | plan upgrade |
| ntfy | v2.28.0 | - | v2.32.0 | watch |
| openai-image-api | v3.29.0 | - | v3.36.0 | none |
| paradox-pai | 3.7.0 | - | 3.8.1 | watch |
| poppler-utils | 2026-10-03 | - | 2026-10-03 | none |
| provision-isr-nvr | - | - | - | watch |
| py-cryptography | 50.0.2 | - | 50.0.2 | none |
| py-ezdxf | 1.4.4 | - | 1.4.5 | none |
| py-fastapi | 0.143.0 | 0.141.1 | 0.158.0 | plan upgrade |
| py-fpdf2 | 2.8.9 | 2.8.9 | 2.8.9 | none |
| py-httpx | 0.28.1 | 0.27.2 | 0.28.1 | watch |
| py-numpy | 2.5.4 | - | 2.5.4 | none |
| py-pillow | 12.3.0 | 12.3.0 | 13.0.0 | watch |
| py-pydantic | 2.14.0 | 2.13.5 | 2.14.1 | none |
| py-python-multipart | 0.0.32 | 0.0.32 | 0.0.32 | none |
| py-starlette | 1.7.0 | - | 1.9.0 | watch |
| py-tzdata | - | - | 2026.5 | watch |
| py-uharfbuzz | 0.56.3 | - | 0.56.3 | none |
| py-uvicorn | 0.54.0 | 0.53.0 | 0.54.0 | none |
| py-weasyprint | 70.0 | 70.0 | 70.0 | none |
| py-websockets | 17.2 | - | 17.3 | watch |
| python-runtime | v3.12.15 | - | - | none |
| scheduler-component | - | - | v3.3.8 | watch |
| sqlite | - (new entry) | from base image | 3.54.1 (2026-10-16) | watch |
| unifiedpush | 3.0.10 | - | 3.0.10 | none |
| universal-remote-card | - | - | 4.12.2 | watch |
| visonic-powermax | - | - | Pre-Release-0.13.0.44 | none |
| web-push-vapid | - | - | - | watch |
| wiskey-hikvision-intercom | 2.0.0-rc.37 | 2.0.0-rc.37 | - | watch |
