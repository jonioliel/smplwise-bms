# ONVIF-CLIENT-2500 - camera discovery phase 1: the ONVIF client, the add step, the preview form, the origin columns

Branch `pilot/ONVIF-CLIENT-2500` (from `pilot/ONVIF-API-2500` @ 004c0b695). Target: the 2.5x series. Design
`docs/design/onvif-discovery-2412/DESIGN.md` on `pilot/FEATURE-DESIGNS-SEC-2490` (sections 4.2-4.5, 6, 7, 8, 9, 13 owner decisions
2026-11-22, 14 build rows). This is the **ONVIF-CLIENT** row plus the ONVIF-API parts that waited for it (add route, preview form,
origin migration). No device, camera, recorder, go2rtc, Supervisor or lab network was contacted: every test runs on the fake ONVIF
devices of `tests/fixtures/fake_onvif.py` and the fake go2rtc of `tests/test_camera_sources_2410.py`.

## The client (`services/camera_discovery/onvif_client.py`, `OnvifClient` = `service.OnvifIdentifier`)

It plugs into `service.Identifier` and does not change the scan job's attempt rules (Q57). One identification press of one camera:

1. `GetDeviceInformation` with the WS-Security PasswordDigest on the camera's clock - THE credential attempt.
2. **HTTP Digest, once.** When the camera answers that request with `401` + `WWW-Authenticate: Digest ...`, the same press answers that
   challenge once (design section 9). RFC 7616: MD5, MD5-sess, SHA-256, SHA-256-sess, `qop=auth` or none; `auth-int`-only or an unknown
   algorithm is not answered (`digest_required`). A `stale=true` nonce later in the press is renewed once and is not a refusal.
   **Lockout guard:** every refused request is reported to the scan job's guard (`service._DeviceGuard`, 3 per 15 min per camera
   address, across scans) and the guard is asked BEFORE the Digest answer is sent - when it is full, nothing more is sent
   (`locked_guard`, and the pair is not marked refused). A Digest camera with a wrong password therefore costs two guard entries in
   one press (the WS-Security 401 and the refused Digest answer); the camera itself sees one failed login (the 401 challenge is not a
   login). No other retry exists.
3. After `ok`, with the same proven credentials (all Get*): `GetServices` (fallback `GetCapabilities`) for the Media2 / Media service
   addresses - kept only when they point at the address that answered (`wsd.same_host_xaddrs`, D1); **Media2 first**
   (`GetProfiles` type VideoEncoder, `GetStreamUri` RTSP), **Media1** when Media2 is missing or gives no usable stream
   (`GetProfiles`, `GetStreamUri` RTP-Unicast / RTSP); one `GetSnapshotUri` for the suggested main profile.
   A camera that answered `GetDeviceInformation` without checking the pair (some firmwares) and then refuses a media read is reported
   `wrong_password` (counted, the pair refused, nothing kept).
4. **Stream-address shaping** for the existing camera-source model (`shape_stream`): `rtsp` / `rtsps` only, the camera's own address
   (a name or another host: `other_host` - `cameras.discovery_allow_other_host` is not built), user info removed, no fragment (go2rtc
   reads `#...` as its own options; the source policy refuses `#` anyway), no `src` / `name` query key, ASCII, at most 512 characters.
   The typed pair is inserted percent-encoded only at the add / preview step (`with_credentials`), on the server, and the result still
   goes through `camera_sources.refusal` (source policy) there. go2rtc is never called by the discovery package: the add step stores
   the addresses through `create_standalone`, whose `smplwise_cam_<id>_main|sub` streams are created later by the existing code.
5. **Main / sub suggestion** (design 4.2 step 3): main = the highest-resolution H.264 / H.265 profile with a usable stream (any codec
   when none is); sub = the lowest-resolution other one at least 320 px wide (none: one address serves both).

Caps per camera per press: 16 requests, 20 s, 8 profiles read, 6 `GetStreamUri`; each answer is onvif_http's (64 KiB read in chunks,
no redirects, 3 s, no proxy env, no DOCTYPE / ENTITY, bounded depth / element count). Nothing logs, returns or raises a user name, a
password, a digest, a nonce, a serial or a device's own error text.

`onvif_http.py`: the closed allow-list is now per service (`SERVICE_ACTIONS`: device `GetSystemDateAndTime` `GetDeviceInformation`
`GetServices` `GetCapabilities`; media and media2 `GetProfiles` `GetStreamUri` `GetSnapshotUri`), each with a fixed body template;
the only value ever filled in is a profile token that matches `TOKEN_RE` (ONVIF ReferenceToken, <= 64) and is XML-escaped. Requests
may carry an `Authorization` header; the Digest challenge header is kept (<= 1 KiB) for the client.

`service.py`: `Identifier.information(target, user, password, offset_s, guard)`; the job's device keeps `media`, `auth_mode`,
`profiles`, `snapshot_uri` and the keyed standalone fingerprint (`known.camera_fingerprint(salt, "standalone", model, serial)` - no
serial kept) only after an `ok` press of an addable camera; `Device.forget()` drops them with the credentials (cancel, expiry, a
refused press, an added camera).

## The add step - `POST /cameras/discovery/scans/{scan_id}/add`

Body `{cameras: [{device_id, name?, area_id?, main_profile?, sub_profile?}]}` (1..64, strict, `extra="forbid"`); answer `AddResult
{added: [{device_id, camera_id}], failed: [{device_id, code, message}]}` (200, partial success). `system.configure` on a read
connection before the body (read gate), then 409 `webrtc_server_required` when go2rtc is not configured (like `POST
/cameras/standalone`, before the body), then the body. 404 `scan_not_found` (incl. another person's scan), 409 `scan_not_active`.

Per camera, one at a time, through the existing `camera_sources.create_standalone` (name / area / limit / source policy checked there
BEFORE anything is written; addresses sealed there): main / sub = the chosen tokens or the suggestion. Refused per row without
contacting any device: `behind_recorder` (Q58 - never added, not even as a separate camera), `is_recorder` (Q59 - the recorder wizard
pre-fill of ONVIF-API is the way), `already_added`, `not_identified` (no `ok` press / no kept pair), `no_stream`, `profile_unknown`,
`device_unknown`, `device_duplicate`, and every `create_standalone` refusal with its own code and Hebrew text (`standalone_limit`,
`source_not_allowed`, `area_invalid`...). The known marks are re-read from the database at the add (a camera added meanwhile is
`already_added`). Default name `<manufacturer> <model> - <last octet>` (design 4.5).

What the add stores besides what a typed camera gets: `origin = 'onvif'` and `onvif_json` (below); the codec / resolution the camera
declared per profile in `probe_json` (the same fields a stream test records: the live player's H.265 hint, design 4.2 step 3); the
keyed fingerprint in `cameras.device_fingerprint` (a later scan marks the camera `standalone` by identity even after an address
change). The added device is marked `standalone` in the job and its pair forgotten. Audit: `camera.discovery.add` once per request
(`requested`, the added camera ids, `origin: onvif`, refusal codes counted; `denied` + reason `nothing_added` when none was added) and
the existing `camera.standalone.create` per camera (now with `origin: onvif`). Never an address, a user name or a password.

## The preview form of `POST /cameras/source/test`

`{scan_id, device_id, profile: main|sub, profile_token?}` (the design's `{scan_id, device_id, profile}`; `profile` keeps its meaning,
`profile_token` picks any profile of the camera). `url` / `camera_id` cannot be mixed in (422 `validation`, fields named).
`Manager.preview_source` checks the scan (this person's, active) and the device (the add step's refusal codes, 422 with
`details.fields`), then assembles the address with the pair that worked; `camera_sources.test_assembled` runs exactly the typed form's
path: the same 6 / min / person budget (spent only after the discovery checks pass), the source policy, one frame through a throwaway
`smplwise_cam_probe_*` stream deleted right after. Audit `camera.source.test` with `{profile, origin: onvif, outcome}` only. The
assembled address never leaves the server.

## Migration `0217_camera_discovery_origin.sql`

`camera_stream_sources.origin TEXT CHECK (origin IS NULL OR origin IN ('manual','onvif'))`, `onvif_json TEXT`. NULL = a row from
before 0217, read as `manual` (`camera_sources.origin_of`); a camera added by hand now stores `manual`. `onvif_json`: manufacturer,
model, firmware, `media` (media2 / media), `auth_mode` (wsse / digest), the main / sub profile tokens, the device-service host and
port, `endpoint_hmac` (HMAC-SHA256 of the ONVIF endpoint reference with the installation's fingerprint salt, 16 hex; absent without a
salt). No credential, serial, MAC or stream address. `GET /cameras/{id}/source` (and the PUT answer) gain `origin`. Number 0217: the
next free number on main and on every remote branch at the time of writing (0216_review_indexes.sql; a scan of all 1,017 remote
branches found no 0217+); renumber at the train if another branch takes it. Additive; the previous version ignores the columns.

## Wire models (`smplwise/wire/camera_discovery.py`, generated `wire-camera-discovery.ts`)

`FoundDevice` + `media` (`media` | `media2` | `none`), `auth_mode?` (`digest` | `wsse`), `profiles: [MediaProfile {token, name, codec,
width, height, fps, stream, uri_masked}]`, `suggested {main, sub}`, `snapshot: bool`; new `AddResult` / `AddedCamera` / `AddFailure`.
`uri_masked` is the camera's own address with the path and query replaced by `/***` (security review of ONVIF-UI-2500: a path may carry a secret).
No field holds a user name, a password, a serial or a URL with credentials (the existing field-name test covers the new models).

**Merge note for RESPONSE-MODELS-E-2480** (it models the `camera_sources` routes): the trial merge conflicts in
`routers/camera_sources.py` (keep both: E's `**wire(W.CameraSourcesCreateStandalone)` decorator and this row's `_test_discovered`), and
E's `CameraSourcesSource` / `CameraSourcesPutSource` need `origin: str | None` after `mode` (then `gen_wire_types.py` rewrites
`wire-camera-sources.ts`). The preview answer has the typed form's shape (no model change). The trial merge's strict tests also found
two gaps in E's camera-source models that exist without this row (this row's tests only reach them): `CameraSourcesSourceProbe` has
no `sub` (any camera whose sub stream was tested has one) and `CameraSourcesCreateStandalone.area_id` is `str` although a camera added
without an area answers `null`. With `probe.sub: CameraSourcesSourceProbeMain = None` and `area_id: str | None` the trial is green
(below). These belong to whichever of the two rows merges second.

## Tests

`tests/test_onvif_client_2500.py` (34 test functions, 67 cases) with the extended `tests/fixtures/fake_onvif.py` (HTTP Digest MD5 /
SHA-256 with stale nonces, GetServices / GetCapabilities, Media1 / Media2 profiles, stream and snapshot URIs, other-host, `info_open`
and `media_refused` variants) and the fake go2rtc of `test_camera_sources_2410.py`: fixed request templates and 14 refused request
shapes; the RFC 7616 example (MD5 and SHA-256 responses); which challenges are answered; stream shaping (14 cases) and percent-encoded
credentials the source policy accepts; main / sub suggestion; bounded hostile profile lists; Media2 first; Media1 through
GetCapabilities with HTTP Digest answered once; a Digest wrong password = two guard entries and one camera-side failure; the guard
blocking the Digest answer; SHA-256 + stale nonce; an unanswerable challenge; a camera that skips the check on GetDeviceInformation;
an account without the media right; a media service and streams on another host (never contacted / refused); Media2 -> Media1
fallback; request caps; hostile media answers; identification through the routes; the guard across presses with Digest; the add step
(sealed addresses with the percent-encoded pair, origin and `onvif_json`, the H.265 hint, the fingerprint, audit rows, job marks, a new
scan knows the camera, no secret in answers / audit / log / database dump); per-row refusals without contacting a device; unidentified
cameras; the standalone limit (partial success); request refusals, cancel, `webrtc_server_required` before the body, RBAC; the preview
form (address assembled on the server, throwaway stream removed, audited without the address), its refusals, the shared budget;
migration 0217. Changed: `test_camera_discovery_2500.py::test_only_get_actions_can_be_built` (the widened per-service list) and
`test_camera_discovery_api_2500.py` (the add route in the route table, the RBAC and the 403-before-body lists).

| Run | Where | Command | Result |
|---|---|---|---|
| new tests | PC, main `.venv` Python 3.12.10 | `python -m pytest -q -p no:cacheprovider tests/test_onvif_client_2500.py` | 67 passed, exit 0 |
| discovery tests | PC, main `.venv` | `tests/test_camera_discovery_2500.py tests/test_camera_discovery_api_2500.py` | 80 passed, exit 0 |
| touched areas | PC, main `.venv` at 5d7ad5fb5 | the three files above + `test_camera_sources_2410` `test_raw_body_order` `test_plan_routes_unique` `test_wire_routers_b_2450` `test_wire_routers_c_2470` `test_wire_routers_d_2470` `test_wire_consumption_2450` `test_migrations` `test_db_template` `test_nvr_less` `test_singletons_registered` `test_cameras` | 492 passed, exit 0 |
| touched areas | runner slot B (`~/work/slotb.sh ~/run_remote.sh backend pilot/ONVIF-CLIENT-2500 <18 files>`: the set above + `test_migrations_263_upgrade` `test_query_plans` `test_settings_patch_audit_order`) at 5d7ad5fb5 | | 518 passed in 481 s, exit 0 |
| pyflakes lane | runner slot B, ruff 0.17.5 (rule set F), in the branch worktree at 5d7ad5fb5 | `ruff check` of the camera_discovery package, `camera_sources.py`, both routers, the wire module, the fixture and the three test files | All checks passed |
| generated types | PC | `python scripts/gen_wire_types.py --check` | exit 0 (`wire-camera-discovery.ts` regenerated in 75c5d6f57) |
| trial merge with `origin/pilot/RESPONSE-MODELS-E-2480` (6bf65de99) | PC, throw-away worktree of 5d7ad5fb5 (removed) | merge (one conflict, resolved as in the merge note) + `origin` / `probe.sub` / nullable `area_id` in E's camera-source models; `gen_wire_types.py --check`; `wire_ratchet.py`; `pytest tests/test_wire_ratchet_2480.py tests/test_wire_routers_e_2480.py tests/test_onvif_client_2500.py tests/test_camera_discovery_api_2500.py tests/test_camera_sources_2410.py` | ratchet "every count equals its baseline (901 unmodelled JSON routes in 119 router modules)" - the add route is modelled, nothing went up; gen check exit 0; 255 passed, exit 0. Before the two E-model widenings: 2 failures (`probe.sub`, `area_id` null), both E-model gaps |

## Known limits / not done here

- `cameras.discovery_allow_other_host` (encoders that publish streams on another address) and `cameras.discovery_plaintext_password`
  are not built: such streams are shown `other_host` and the camera can be added by hand.
- HTTP Digest is answered only when the camera sends the challenge to the WS-Security request; a camera that wants Basic only is
  `wrong_password` (plain text is never sent).
- The snapshot address is read and kept in the job (shown as `snapshot: true`) but not used: the preview goes through go2rtc, as the
  design says.
- UI: ONVIF-UI. Real devices: NOT_RUN (fixtures only); the lab read-only run is ONVIF-LAB-DOCS and needs the owner's per-step approval.
- `contracts/API_INVENTORY.md` is regenerated at release (`scripts/api_inventory.py`).

## Rollback

Revert the branch. Migration 0217 only adds two nullable columns; the previous version ignores them (cameras added from discovery stay
as ordinary cameras without a recorder).
