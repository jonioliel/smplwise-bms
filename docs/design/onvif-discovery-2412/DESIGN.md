# ONVIF-DISCOVERY-2412 - Find cameras on the network and add them without a recorder

Row `FEATURE-DESIGNS-SEC-2490`, branch `pilot/FEATURE-DESIGNS-SEC-2490` (from `origin/main` @ `51da93753`). Target: 2.49.0
design round. **Design only - no product code, no migration, no dependency, no device contacted.** The mock-up is
`docs/design/onvif-discovery-2412/mockup.html`.

Inputs read: `AGENTS.md`, `CLAUDE.md`, `docs/changes/CAMERA-STREAM-SOURCES-2410.md` (owner decisions 08.11; decision 6 put ONVIF out
of 2.41.0), `management/tasks.json` (ONVIF-DISCOVERY-2412: "read-only until an administrator saves; scope and timing set by the
owner"), `smplwise_vms/config.yaml`, `services/camera_sources.py`, `services/source_policy.py`, `services/go2rtc.py`,
`services/connection_probe.py`, `services/nvr_settings.py`, `routers/nvr_write.py`, the wire/response-model pattern
(`docs/changes/CR-RESPONSE-MODELS-B-2450.md` on the 2.45.0 train).

Owner constraints carried into every section:

- **Device access is read-only by default.** Discovery and identification send only ONVIF *Get* requests (a closed allow-list in
  code). Nothing is written to a camera, an NVR or go2rtc until an administrator presses "הוסף"; adding writes only Arx's own
  catalogue and Arx's own `smplwise_cam_*` go2rtc streams - exactly what "add a camera without a recorder" already does today.
- **go2rtc is shared** with a separate intercom project: only `smplwise_` streams are ever created or deleted; discovery through
  go2rtc (if used) is a read-only GET.
- **No external provider:** vendor/model identification is local (the device's own answer); no cloud lookup of MAC vendors or
  models, no AI.
- **No HA branding** outside the settings screens - this feature lives in הגדרות › אבטחה › NVR (a settings screen), so technical
  terms (ONVIF, RTSP, go2rtc) may appear there; the camera list elsewhere just shows a camera.
- **Nearly everything is a setting.**
- No PTZ, no talk-back (microphone), no event subscription in this feature (AGENTS.md physical-systems rule).

---

## 1. Problem

A site without a recorder - or with a few cameras that are not on the recorder - can already get live video and snapshots through
"מצלמות ללא מקליט" (2.41.0), but only by typing two RTSP addresses per camera. Installers do not know the vendor-specific RTSP path
(`/Streaming/Channels/101`, `/cam/realmonitor?channel=1&subtype=0`, `/h264Preview_01_main`...), typos are common, and with ten
cameras the job takes an hour. ONVIF (Profile S/T) answers both questions in a standard way: *which cameras are on this network*
(WS-Discovery) and *what are their stream addresses* (Media `GetProfiles` + `GetStreamUri`).

## 2. Current state in the code (origin/main @ 51da93753)

| Piece | Where | Relevance |
|---|---|---|
| Cameras without a recorder | `services/camera_sources.py` (`create_standalone`, `save`, `STANDALONE_MAX = 64`, pseudo-recorder `standalone`), `routers/camera_sources.py` (`POST /cameras/standalone`, `PUT /cameras/{id}/source`, `POST /cameras/source/test`), migration 0209 `camera_stream_sources` | **the target of this feature**: discovery only fills what this flow already stores |
| URL sealing | `connection_store.seal_camera_source` (AES-256-GCM, `v1:`, AAD `camera_source|<id>|<profile>`), `camera_sources.mask` / `merge` | discovered credentials go into the same sealed column |
| Source policy | `services/source_policy.py` (`source_refusal`, `go2rtc_targets`, `address_refused`, resolver) | rtsp/rtsps only, no loopback / link-local / multicast / go2rtc host; **every device-supplied address goes through it** |
| Test stream | `POST /cameras/source/test` → `go2rtc.probe_frame` (throwaway `smplwise_cam_probe_*`), 6 / min / person | reused for the preview of each found camera |
| go2rtc adapter | `services/go2rtc.py` (`PUT/DELETE /api/streams`, `/api/frame.jpeg`), namespace `smplwise_` | no ONVIF call today |
| Health of manual sources | `camera_sources.HEALTH` poller, notification `camera.source` | applies unchanged to discovered cameras |
| NVR channel add (S3) | `services/nvr_settings.py`, front end `src/api/nvr-settings.ts` (`NewChannel {protocol: 'HIKVISION' \| 'ONVIF', address, port, username, password}`), writes switch `camera_reboot.writes_on`, audit `nvr.write` | possible later target "add to the recorder as a channel" - an NVR **write**, out of the first phase |
| ONVIF anywhere | only comments (backchannel `#backchannel=0`, source policy notes, Frigate config, a switch-protection domain list) | **no ONVIF client, no WS-Discovery, no zeep/lxml dependency** |
| Add-on networking | `config.yaml`: no `host_network`, ingress on 8099, optional ports 18091-18094 | the add-on sits on the Supervisor's bridge network: **multicast WS-Discovery from the container does not reach the LAN** |
| Patterns | settings `services/settings_store.DEFAULTS`; audit `smplwise/audit.py`; jobs with polling (exports, `bulk_people.create_job`); wire models `smplwise/wire/*` + `scripts/gen_wire_types.py` | followed below |
| UI | `src/components/standalone-cameras-card.ts`, `camera-source-dialog.ts`, `src/screens/system-security.ts` (NVR page), `live-camera.ts` | the entry point is the existing card |

## 3. User stories per role

**Installer** - "I press 'חפש מצלמות', see every camera on the site's network with its maker and model, type the password once, see
a picture from each, tick the ones I want, choose their area, and press add." / "A camera that is already in the system or behind
the recorder is marked so I do not add it twice."

**System administrator** - "Nothing is added, changed or saved until I press add." / "The scan only reads; it never changes a
camera." / "I can turn the feature off, or limit it to one network range." / "I see in the audit who scanned and who added."

**Operator** - unaffected: a discovered and added camera is a normal camera without a recorder (live + snapshots).

**Owner** - "A wrong password must not lock every camera on the site." / "The camera passwords stay sealed like the recorder's."

## 4. Design overview

```
 Settings › אבטחה › NVR › מצלמות ללא מקליט › [חפש מצלמות ברשת]
   step 1 Scan        step 2 Identify                     step 3 Choose & add
 ┌──────────────┐   ┌──────────────────────────────┐   ┌─────────────────────────────────┐
 │ engines:     │   │ per found device:            │   │ tick, name, area, main/sub      │
 │ • unicast    │──►│ GetSystemDateAndTime (no auth)│──►│ preview via /cameras/source/test│
 │   probe of a │   │ GetDeviceInformation   (auth) │   │ [הוסף 4 מצלמות] → create_standalone │
 │   range      │   │ GetServices/GetCapabilities  │   │ (sealed URLs, smplwise_cam_*)   │
 │ • go2rtc     │   │ GetProfiles + GetStreamUri   │   │                                 │
 │   (optional) │   │ (Media2 first, Media1 after) │   │ nothing written before this     │
 └──────────────┘   └──────────────────────────────┘   └─────────────────────────────────┘
       read-only            read-only (Get* only)               Arx catalogue + Arx streams
```

### 4.1 Discovery engines (setting `cameras.discovery_engines`)

The add-on cannot send multicast to the LAN (bridge network). Three engines, chosen by capability, all read-only:

1. **Unicast WS-Discovery sweep** (default, no new infrastructure). Arx sends a WS-Discovery `Probe` (SOAP-over-UDP, types
   `dn:NetworkVideoTransmitter tds:Device`) **unicast** to UDP 3702 of each address in an administrator-entered range (default: the
   /24 of the HA host's LAN address, max /22 = 1024 addresses), paced (default 50 packets/s), two rounds, 4 s listen window. Most
   ONVIF cameras answer a unicast Probe; the container's NAT carries the reply back. Optional second pass
   (`cameras.discovery_http_fallback`, off): an unauthenticated `GetSystemDateAndTime` POST to `http://<addr>:80/onvif/device_service`
   for addresses that answered nothing - catches cameras that ignore unicast probes.
2. **go2rtc discovery** (optional, `go2rtc` in the engines list): `GET /api/onvif` on the configured go2rtc returns the devices it
   finds by multicast from its own network (go2rtc usually runs with host networking). Read-only; **no credentials are ever passed
   to go2rtc** (we do not use its `?src=onvif://user:pass@...` mode - that would put passwords in a query string on a shared
   service). To verify on the lab go2rtc version before it is offered (NOT_RUN).
3. **Bridge multicast** (later, optional): the HA-side bridge integration runs on the host network and could send the multicast
   Probe and return the matches. Needs a bridge bump (HA restart) - phase 3 only if the first two miss cameras in practice.

Results from all engines are merged by **ONVIF endpoint reference** (`urn:uuid:...`), falling back to the device-service host.

### 4.2 Identification (per device, read-only)

All requests go to the device's own `XAddrs` **only if** the XAddr host equals the address that answered the probe (or the address
the admin typed) and passes `source_policy.address_refused` - a device cannot point Arx at another host (SSRF guard).

1. `GetSystemDateAndTime` (no auth) - the device clock; the offset is kept for WS-Security and shown as evidence when large (clock
   drift is preserved as a separate fact, never "fixed").
2. With credentials (§4.3): `GetDeviceInformation` (manufacturer, model, firmware; serial number read but **not stored** - only an
   installation-salted HMAC for de-duplication, like `autosync` ADP 3.3), `GetServices` (fallback `GetCapabilities`) → Media2 /
   Media URLs, `GetProfiles` → per profile: encoder (H.264/H.265/MJPEG), resolution, fps; `GetStreamUri` (RTP-Unicast, RTSP) per
   profile; optional `GetSnapshotUri` (not used for preview - preview goes through go2rtc like today).
3. Main = highest-resolution H.264/H.265 profile; sub = the lowest-resolution one ≥ 320 px wide; the admin can change both. An H.265
   main gets the existing H.265 hint (`live_codec`).
4. Each stream URI goes through `camera_sources.refusal` + `source_policy` (rtsp/rtsps only, no foreign go2rtc name, same host as the
   device unless `cameras.discovery_allow_other_host` is on - some encoders publish a different streaming address).
5. The credentials are inserted into the RTSP URL only at the save step (sealed); the identification step keeps them in the scan
   job's memory.

Allowed SOAP actions (closed list, anything else is a code error): `GetSystemDateAndTime`, `GetDeviceInformation`, `GetServices`,
`GetCapabilities`, `GetScopes`, `GetNetworkInterfaces` (read MAC only to recognise a device behind the recorder; not stored),
`GetProfiles` (Media and Media2), `GetStreamUri` (both), `GetSnapshotUri` (both), `GetVideoSources`.

### 4.3 Credentials and the lockout trap

Many cameras (Hikvision, Dahua, Uniview...) lock the account or ban the client address after a few wrong passwords. Rules:

- **One attempt per device per press** of "נסה סיסמה" - never an automatic retry, never a list of default passwords (no credential
  guessing, ever).
- "Use the same user and password for all" applies the typed pair to every selected device in one pass; a device that answers
  `NotAuthorized` is marked "סיסמה שגויה" and **not tried again** in that pass.
- Pacing per device: max 1 authenticated request in flight, max 3 failed authentications per device per 15 minutes (counter in the
  job), then the device is marked "נעצר כדי לא לנעול את המצלמה".
- WS-UsernameToken **PasswordDigest** (nonce + created + SHA-1 per the ONVIF Core spec) using the device clock offset; HTTP Digest
  as a fallback for devices that require it. Never `PasswordText` over plain HTTP unless the admin ticks "המצלמה דורשת סיסמה
  גלויה" (setting-gated, off).
- Credentials live only in the scan job (memory, TTL `cameras.discovery_job_ttl_min`, default 15) until saved; then sealed per
  camera like any manual source. Never logged, audited, returned or put in an error.

### 4.4 Already-known devices

A found device is marked, not hidden:
- **"כבר במערכת"** - its device-service host or HMAC serial matches an existing camera without a recorder.
- **"מאחורי המקליט"** - its address/MAC matches a recorder channel's `sourceInputPortDescriptor` (ADP data already read from the NVR).
  Recommended action: none (the camera already comes through the recorder).
- **"נראה כמו מקליט"** - ONVIF scopes/device type say NVR/NVS (or the model matches a known recorder family): offer "להוסיף כמקליט"
  (opens the existing recorder wizard pre-filled) instead of adding it as a camera.
- **Recorder PoE networks:** cameras on a recorder's internal PoE subnet are not reachable from HA - the empty-state text says so.

### 4.5 Adding

"הוסף N מצלמות" calls the existing standalone path per camera (in one request, one transaction per camera, partial success
reported): name (default `<manufacturer> <model> - <last octet>`; editable), area (optional), main/sub URLs with the credentials
sealed. Then the existing post-change work runs (go2rtc streams `smplwise_cam_<id>_main|sub`, health poller). Limit:
`STANDALONE_MAX` (64) - the wizard shows how many slots remain.

Phase 2 option (not in phase 1, needs the NVR writes switch and the owner's approval per site): "add as a channel of the recorder"
using the existing S3 `NewChannel {protocol: 'ONVIF', address, port, username, password}` pre-filled.

## 5. Flows

**F1 - happy path.** Card "מצלמות ללא מקליט" → "חפש מצלמות ברשת" → range pre-filled (`192.0.2.0/24` style, the HA host's /24) → "התחל
חיפוש" → progress (addresses checked, devices found, live list) → 7 found, 2 already known → select 5 → "אותו משתמש וסיסמה לכולן" →
identify (per-row spinner → model, resolution, codec) → previews load → set areas → "הוסף 5 מצלמות" → summary "5 נוספו" with links.

**F2 - one wrong password.** Row shows "סיסמה שגויה" with its own password field and "נסה שוב" (one attempt).

**F3 - nothing found.** Empty state: three likely reasons (another network range; cameras on the recorder's internal network; ONVIF
off on the cameras) + "הוסף ידנית" (the existing dialog) + "חפש בטווח אחר".

**F4 - engine unavailable.** go2rtc engine selected but go2rtc older / no `/api/onvif` → the engine is greyed with the reason; the
unicast sweep still runs.

**F5 - camera without ONVIF profile S (e.g. only a vendor protocol).** Row "נמצא, אבל לא מוסר כתובת וידאו" → "הוסף ידנית" with the
host pre-filled.

**F6 - phone.** Same three steps as full-screen sheets; results are a card list; one primary button at the bottom.

## 6. Data model and migrations

The scan itself is **ephemeral** (memory, TTL 15 min; a restart drops it). Persisted only:

| Migration | Content | Why | Rollback |
|---|---|---|---|
| `02xx_camera_discovery_origin` (provisional) | `camera_stream_sources` + `origin TEXT NULL CHECK IN ('manual','onvif')`, `onvif_json TEXT NULL` (manufacturer, model, firmware, profile tokens chosen, endpoint-ref HMAC, device-service host - no credentials, no serial, no MAC) | show "נוסף מגילוי ONVIF", re-identify later, de-duplicate | columns ignored by the previous version |

No new table. Discovery results are not a backup item. Audit rows are the history.

Settings (`services/settings_store.DEFAULTS`; changed by `system.configure`):

| Key | Values | Default |
|---|---|---|
| `cameras.discovery` | `off` \| `manual` | `manual` (only when an admin presses the button; never periodic) |
| `cameras.discovery_engines` | csv `unicast,http,go2rtc` | `unicast` |
| `cameras.discovery_range_max` | /20 - /28 | `/22` |
| `cameras.discovery_allowed_ranges` | csv CIDRs or empty (= private ranges of the host's interfaces) | empty |
| `cameras.discovery_rate_pps` | 10-200 | 50 |
| `cameras.discovery_http_fallback` | on\|off | off |
| `cameras.discovery_allow_other_host` | on\|off | off |
| `cameras.discovery_plaintext_password` | on\|off | off |
| `cameras.discovery_job_ttl_min` | 5-60 | 15 |
| `cameras.discovery_notify_new` | off\|on (later: a weekly passive check that reports new devices) | off |

## 7. API sketch

Router `routers/camera_discovery.py`, wire module `smplwise/wire/camera_discovery.py` (`WireModel`, `**wire(Model)`), generated
`frontend/src/api/generated/wire-camera-discovery.ts`; all routes `system.configure` (the permission of the recorder connection and
of cameras without a recorder), read-gate before the body (review L7), 409 `discovery_off` when the setting is off.

| Route | Body | Answer |
|---|---|---|
| `GET /cameras/discovery/capabilities` | - | `DiscoveryCaps {enabled, engines: [{id, available, reason?}], suggested_range, range_max, slots_left}` |
| `POST /cameras/discovery/scans` | `{range, engines?}` | 202 `ScanJob {id, state: 'running', range, started_at}`; 409 `scan_running` (one at a time per installation); 422 `range_refused` / `range_too_large`; 429 |
| `GET /cameras/discovery/scans/{id}` | - | `ScanJob {id, state: running\|done\|failed\|expired, progress: {checked, total}, devices: [FoundDevice], finished_at?}` |
| `DELETE /cameras/discovery/scans/{id}` | - | `{cancelled: true}` |
| `POST /cameras/discovery/scans/{id}/identify` | `{device_ids: [..], username, password, same_for_all: bool}` | `IdentifyResult {devices: [FoundDevice]}` (each with `auth: ok\|wrong_password\|locked_guard\|no_answer\|not_onvif`) |
| `POST /cameras/discovery/scans/{id}/add` | `{cameras: [{device_id, name, area_id?, main_profile, sub_profile?}]}` | `AddResult {added: [{device_id, camera_id}], failed: [{device_id, code, message}]}` |

`FoundDevice {id (job-local), address, port, engines: [..], manufacturer?, model?, firmware?, kind: camera\|recorder\|unknown,
known: none\|standalone\|behind_recorder, known_ref?, clock_offset_s?, auth, profiles: [{token, name, codec, width, height, fps,
uri_masked}], suggested: {main, sub}}`. Never a password, never a full URL with credentials (masked like `camera_sources.mask`).

Preview reuses `POST /cameras/source/test` with a new optional `{scan_id, device_id, profile}` form so the URL with credentials is
assembled on the server and never round-trips through the browser.

## 8. Security analysis

| # | Threat | Mitigation |
|---|---|---|
| D1 | SSRF through device-supplied XAddrs / stream URIs (point Arx or go2rtc at HA's API, go2rtc itself, loopback, metadata IPs) | XAddr host must equal the responder; every URI through `source_policy` + `camera_sources.refusal`; foreign go2rtc names refused; DNS names resolved and judged by address (existing resolver) |
| D2 | Hostile XML (entity expansion, huge payloads) | reject any `<!DOCTYPE`; 64 KiB cap per response; stdlib `xml.etree` (expat with its entity-amplification guard); namespace-tolerant parsing with a closed set of read paths; timeouts 3 s per request |
| D3 | Account lockout of cameras by a wrong password | §4.3 one attempt per press, per-device failure cap, never automatic retries, never default-password lists |
| D4 | Credential exposure | sealed AES-GCM at rest (existing key), memory-only during the job, PasswordDigest, never logged/audited/returned, preview assembled server-side |
| D5 | Scan as a network-reconnaissance tool by a lower-privileged user | `system.configure` only; ranges limited to private ranges of the host (or the admin's allow-list) and to `range_max`; one scan at a time; 6 scans / hour / installation; audit with the range |
| D6 | Flooding the LAN / IDS alarms | paced UDP (50 pps default), two rounds, no port scanning beyond 3702 (and port 80 only if the HTTP fallback is on) |
| D7 | Rogue device pretending to be a camera to harvest the shared password | PasswordDigest does not reveal the password; the "same for all" option warns that it is sent (as a digest) to each selected device; HTTP Digest likewise; plaintext only on explicit opt-in |
| D8 | Shared go2rtc (intercom project) | only `GET /api/onvif`; no stream created during discovery except the existing throwaway `smplwise_cam_probe_*` preview streams, deleted right after |
| D9 | Writes to devices | the SOAP allow-list contains only Get* actions; a test asserts no other action string can be built |

Audit (no credentials, no full URLs): `camera.discovery.scan` (range, engines, found count), `camera.discovery.identify` (device
count, results by class), `camera.discovery.add` (camera ids, origin onvif), refusals with reason. Rate limits via
`ScopedRateLimiter` (`discovery:install`, `discovery:user:<id>`).

## 9. Failure modes

| Failure | Behaviour |
|---|---|
| no answer from the range | empty state with reasons (§F3); suggests another range |
| device answers probe but HTTP blocked | "נמצא, אין גישה לשירות ONVIF" + manual add |
| device clock far off | digest uses the measured offset; shown as "שעון המצלמה שונה ב-X דקות" (evidence, not corrected) |
| `NotAuthorized` with the right password (clock or digest variant) | try HTTP Digest once (same press), then "לא הצלחנו להתחבר - נסה להוסיף ידנית" |
| stream URI points to another host | refused unless `discovery_allow_other_host`; message explains |
| profile list empty / only MJPEG | shown; add allowed (go2rtc handles MJPEG) with a note |
| add-on restart mid-scan | the job is gone; UI shows "החיפוש הסתיים - התחל שוב" |
| 64-camera limit reached | add button disabled with "נותרו 0 מקומות" |
| go2rtc not configured | discovery still lists devices; preview and add refused with the existing `media_not_configured` |
| identical cameras behind one NAT / same host different ports | keyed by endpoint reference, then host:port |

## 10. Test plan

Backend (pytest, no network): SOAP builder golden files for every allowed action (Media1 and Media2) - built from the ONVIF
specifications' example messages, **not** captured from the lab; WS-Discovery Probe/ProbeMatch parsing incl. multiple matches,
scopes, missing XAddrs, IPv6 XAddrs, hostile XML (DOCTYPE, oversize, deep nesting); a fake ONVIF device (`tests/fixtures/
fake_onvif.py` on `httpx.MockTransport`) with vendor variants (Hikvision-like, Dahua-like, Media2-only, Media1-only, digest-only,
clock off by 10 min, account lockout after 3 failures, XAddr pointing elsewhere, stream URI on another host); the fake UDP responder
for the unicast sweep (loopback socket pair in the test, the policy's loopback refusal bypassed only for the fixture);
de-duplication; the add path calls `create_standalone` and seals; no credential in logs/audit/answers (grep test); the SOAP
allow-list test (no `Set`/`Create`/`Delete` action string reachable); wire `--check` and route-table family test; rate limits.

Front end (Playwright, mocked API): the three steps desktop + phone, light + dark, RTL (addresses and URLs LTR-isolated);
loading / empty / error / partial states; one-attempt rule (button disabled after a failure until the password changes); pixel
baselines on the runner; axe-core.

Lab (owner approval per step; read-only): a unicast sweep of the lab LAN range and identification of one or two cameras with a
viewer account; compare stream URIs with the ones the installer typed; go2rtc `GET /api/onvif` once. No add on the lab without a
separate approval. Evidence redacted (no addresses, serials, MACs).

## 11. Rollout

1. Ship with `cameras.discovery = manual`, engine `unicast` only. The button appears only to `system.configure` holders on the NVR
   page's existing card.
2. Lab read-only verification (above), then the owner's site.
3. go2rtc engine after its lab check; bridge multicast only if needed.
4. Phase 2 ("add to the recorder as a channel") only with the NVR writes switch and owner approval.

## 12. Effort (rows that fit one agent each)

| Row | Content | Estimate |
|---|---|---|
| ONVIF-CLIENT | `services/onvif/` - SOAP envelope builder (allow-list), WS-Security digest + HTTP Digest, defensive XML reader, Media1/Media2 profile + stream URI, clock offset; fake device fixture + golden files | 2 d |
| ONVIF-DISCOVER | unicast WS-Discovery sweep (paced UDP, two rounds), HTTP fallback, go2rtc `/api/onvif` reader, merge/de-dup, known-device marking, scan job store (memory, TTL), rate limits | 2 d |
| ONVIF-API | router + wire module + generated types + settings + audit + preview form of `/cameras/source/test` + batch add on `create_standalone` + migration (origin columns) | 1.5 d |
| ONVIF-UI | three-step wizard in the standalone card (desktop dialog / phone sheets), per-row credential states, previews, areas, summary; baselines | 2.5 d |
| ONVIF-LAB-DOCS | lab read-only run (with approval), DOCS.md / DOCS_HE.md, bilingual notes, security review (balanced) | 1 d |
| later: ONVIF-BRIDGE | multicast from the bridge (bridge bump) | 1.5 d |
| later: ONVIF-NVR-CHANNEL | "add to recorder" through S3 behind the writes switch | 1 d |
| **Phase 1 total** | | **≈ 9 agent-days** (≈ 5 calendar days with 2 agents) |

## 13. Open questions (with recommendations)

1. **Scope and timing** (the backlog card leaves both to the owner): (a) phase 1 as above in the 2.5x line [recommended]; (b) later.
2. **How to find cameras:** (a) Arx asks each address in a range directly (works without changing anything) [recommended];
   (b) also ask the video server (go2rtc) to search after a lab check; (c) through the bridge on the platform (needs a platform
   restart).
3. **Range limit:** (a) the site's own network only, up to 1024 addresses [recommended]; (b) any private range the admin types.
4. **Same password for all:** (a) allowed, one attempt per camera, never repeated automatically [recommended]; (b) one camera at a
   time only.
5. **Found cameras that are already behind the recorder:** (a) shown as "already through the recorder", cannot be added [recommended];
   (b) can be added as a separate camera too.
6. **A device that looks like a recorder:** (a) offer "add as a recorder" in the existing recorder wizard [recommended]; (b) ignore.
7. **Periodic "new camera on the network" notice:** (a) not now [recommended]; (b) weekly passive check, off by default.
8. **Phase 2 "add as a channel of the recorder"** (a write to the NVR): (a) later, behind the writes switch [recommended]; (b) never.
