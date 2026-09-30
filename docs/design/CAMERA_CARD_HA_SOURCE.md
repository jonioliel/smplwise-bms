# Camera card - Home Assistant camera sources (decision needed)

Status: implemented for NVR channels; a standalone Home Assistant camera shows a still picture by default. **Owner decision
2026-09-30: option (b)** - read the entity's `stream_source` through the bridge and write one go2rtc stream in the namespace
`smplwise_ha_<slug>`, only for cameras the owner explicitly chooses to show, never automatically for all cameras. Built on
branch `pilot/ha-camera-stream` (bridge 0.3.1); see "What was built" and the "Threat note" at the end. The sections between
record the options that were weighed.

## What ships

| Source | Result |
| --- | --- |
| NVR channel (`{kind: nvr, recorder_id, channel}`) | Live through the existing relay (`WS /media/live/{camera_id}/ws`, go2rtc `smplwise_<recorder>_ch<n>_<profile>`), WebRTC or MSE by הגדרות, sub profile by the wall profile, main when enlarged. |
| HA camera that is an NVR channel (`{kind: ha, entity_id}`) | Mapped to the catalogue camera and streamed exactly as the NVR source (`services/camera_cards.link_ha_cameras`). |
| HA camera that is not an NVR channel | "תמונה בלבד": `GET /devices/camera-card/still` through HA's `camera_proxy`, cached `max(10 s, snapshots.max_age_s)`, stale copy on failure, needs `devices.read` on the entity plus `video.live` installation-wide. |

### The entity -> NVR channel rule (conservative)
All must hold: platform `hikvision`; entity id ends `_<channel>01` (main) / `_<channel>02` (sub); the object id starts with
the recorder model as the integration slugs it (`DS-7616NXI-K2/D` -> `ds_7616nxi_k2_d_`); every entity passing that for the
recorder is on ONE registry device (two recorders of one model are not told apart, so none is linked); exactly one recorder
has that model; the catalogue has that channel, enabled. The recorder serial is not stored by discovery, so it is not part of
the rule. Limit: an entity the owner renamed (its id no longer starts with the model) is not linked and shows as a picture.
Option if that matters: store the deviceInfo serial at discovery and compare it with the HA device's `serial_number`.

## Options considered for a standalone camera stream (not built)

1. **HA `camera_proxy_stream` (MJPEG) -> ffmpeg -> go2rtc.** go2rtc source `ffmpeg:http://<ha>/api/camera_proxy_stream/<entity>?token=...`.
   The URL needs the entity's short-lived `access_token` (rotates roughly every 5 minutes) or a long-lived token; either lands in
   go2rtc's config / process list / logs (go2rtc up to 1.9.11 logs whole sources). A stream that must be re-written every few
   minutes is also a config-persistence hazard on a go2rtc shared with another project. **Rejected: secret handling.**
2. **HA `stream` component (HLS) via the `camera/stream` WebSocket command.** Returns a signed, expiring URL; go2rtc would
   need `hls:` sources rewritten on every expiry, and HLS latency is 5-10 s, which defeats a "live" card. Same rewrite hazard.
3. **The entity's `stream_source` (RTSP).** Best technically (a stable `rtsp://` go2rtc can pull), but HA does not expose it
   through the state, and the mirror's attribute allow-list (`ha_sync.ATTR_ALLOW`) drops everything it does not know.
   Reading it needs the WebSocket `camera/stream_source`-style call or the integration's own config (credentials again).
4. **Ask HA for a snapshot repeatedly (built).** No go2rtc write, no secret persisted, token stays in memory of one request.

## Risks of what ships
- The still is a single frame every >= 10 s; it says so ("תמונה בלבד"). It is not a substitute for live video.
- `video.live` has no camera scope for a non-NVR camera, so the still requires installation-wide `video.live`; a user with only
  floor/camera-scoped grants sees no such camera in the picker.
- Copy-to-all-areas copies camera cards too (a layout is a layout); a card whose camera the viewer may not watch shows a
  "no permission" state, naming nothing.

## Decision (2026-09-30)
Owner approved (b): add option 3 with a bridge read of `stream_source` (an allow-listed read-only bridge command and an
owner-approved go2rtc write in the `smplwise_ha_<slug>` namespace), per camera, opt-in. (a) stays the default for every camera that
is not opted in or has no `stream_source`; (c) (renamed NVR entities) was not part of the approval and is not built.

## What was built (option b)

### The bridge, 0.3.1 - `smplwise_bridge.stream_source`
`custom_components/smplwise_bridge/stream_source_service.py` (mirrored byte-identical into `smplwise_vms/integration/`).
A signed, READ-ONLY service; request keys exactly `user_id, entity_id, request_id, ts, nonce, sig` (closed schema, no defaults, no
extras). Checks, in order, each failing closed with a fixed code: HMAC + replay window (the pairing secret, like the other services)
-> request shape (`entity_id` must be a lower-case `camera.<a-z0-9_>` id) -> a rate limit (4 per camera and 60 in all, per minute) -> the user is an active Home
Assistant ADMINISTRATOR (`admin_required`; a raw camera source is a credential Home Assistant shows to nobody else) -> the entity
exists -> the read (`camera.async_get_stream_source`, in-process; a 10 s timeout) -> the shape of the answer: a plain `rtsp` / `rtsps` /
`http` / `https` URL, at most 2048 characters, no whitespace, control character or `#` (go2rtc reads `exec:`, `ffmpeg:` and `#options`
as instructions; such a value is `source_not_supported`, and a camera without a source is `no_stream_source`). Errors are fixed codes
or an exception CLASS NAME - an exception text is never forwarded or logged. The answer is `{ok, request_id, stream_source}`.
The service performs no write, opens no connection and calls no other service (a structural test pins that).

### The add-on
| Piece | Where |
| --- | --- |
| Opt-in list (entity ids only; empty by default) | settings key `camera_card.ha_live`; `services/ha_camera_streams.py` |
| Enable / disable | `PUT` / `DELETE /devices/camera-card/ha-live/{entity_id}`, permission `sources.configure` |
| Resolve | a camera that is enabled resolves to `state: "ha_live"` with `live_path` (`media/live-ha/<entity>/ws`); otherwise `still_only` as before |
| Picker | `GET /devices/camera-card/sources` adds `live_enabled` per standalone camera and `ha_live: {ready, can_configure}`; the picker shows "הצג בזרם חי" / "בטל שידור חי" only when both are true |
| Viewing | `WS /media/live-ha/{entity_id}/ws` (routers/media.py) - the tail of the NVR socket is now the shared `_live_relay` |
| Go2rtc | `go2rtc.ha_stream_name`, `redact_ha_source`; the existing `Go2rtc.ensure_stream` / `delete_stream` |
| Housekeeping | `reconcile` (janitor, every 5 min): drops the opt-in of a camera gone from Home Assistant, deletes go2rtc streams nobody wants |

**Least privilege for the toggle: `sources.configure`** - the permission that already governs writing go2rtc streams
(`POST /media/streams/sync`). The layout permission (`system.configure`) is deliberately not enough: someone who arranges screens
must not be able to turn a camera's credentials into a stream. Both are held by `system_admin` only today.

**Viewing rule (unchanged from the picture):** a standalone camera has no camera scope, so watching it needs `video.live`
installation-wide plus `devices.read` on the entity (`camera_cards.can_still` / `entity_visible`), and the camera must be opted in
and not an NVR channel. A user whose `video.live` is limited to floors or cameras cannot see it in the picker or open it; a deny on
some NVR camera does not affect it. The socket uses the same `REGISTRY` (`media.max_live_sessions`), the remote cap, the lease
(`HaLiveLease`, re-checked every 20 s and on any access change, so disabling ends open viewers) and the same player, transport
(WebRTC / MSE per settings) and card budget as an NVR camera.

**Life of the stream.** Enable writes the stream BEFORE the opt-in is stored (an opt-in never exists without its stream). Every open
calls `ensure_ready`: a missing stream (go2rtc restarted) or one a viewer saw fail is re-created from a fresh read of the source, as
the administrator who enabled the camera, at most once per 30 s per camera (the attempt counts even if it fails). A failure is noticed
from an `error` frame or from a session that go2rtc ends within 15 s. The card shows the picture while the stream is down and tries
again after a minute.

**Audit rows** (never a source): `camera_card.ha_live.enable` (attempt + outcome, under the real actor),
`camera_card.ha_live.disable`, `camera_card.ha_live.refresh` (system actor: the stream was re-created), `..stream_removed`
(reconcile), and the usual `video.live.start` / `.stop` with `resource_type: ha_entity`.

## Threat note (for review)

**Assets.** The camera's credentials, address and path (the `stream_source`); the ability to make go2rtc pull from an address.

**Path of the secret.** HA camera config -> bridge (in-process call, no network) -> the service RESPONSE over Home Assistant's REST API
(Supervisor proxy, inside the host) -> the add-on's memory -> go2rtc's `PUT /api/streams?name=&src=` -> go2rtc. Nowhere else:
- not in HA: a service response is not a state and is not put on the event bus (the `call_service` event carries the request, which
  has no source); the bridge logs class names and codes only.
- not in our logs / audit / API answers / database / errors: `redact_source` shows only the scheme for `smplwise_ha_*` streams
  (go2rtc's log line via ensure_stream, and `GET /media/streams`); errors carry a status or a class name (`call_bridge_stream_source`
  reads no body); go2rtc's `error` frames to a viewer are replaced by `upstream_unavailable` (their text can contain the address);
  httpx / httpcore log lines are already at WARNING (main.py) - the go2rtc request URL carries `src=`. The test suite greps the
  captured DEBUG logs, every API answer, the whole database and the audit rows for the credentials, the host and the token.
- **Residual: go2rtc itself.** `PUT /api/streams` persists the source in go2rtc's own configuration, and go2rtc <= 1.9.11 logs
  a whole source when a stream is created (the S1 finding for the NVR streams). This is the same exposure class as the NVR streams that
  already live there with the recorder's password, and anyone who can reach go2rtc's API can read every source. Mitigations that are not
  ours to apply: go2rtc >= 1.9.14, and go2rtc's API not reachable by others. Verified in the repo (docs/operations/G0_INTAKE.md, ADR-013,
  the lab persistence probe on 1.9.14): `PUT /api/streams` persists to `/config/go2rtc.yaml` and `DELETE` removes it. NOT verifiable
  offline: whether `PATCH /api/streams?name=&src=` registers a stream without persisting it (the repo only documents the
  `frame.jpeg` / `/api/ws` `GetOrPatch` path, and WISKEY_SOURCE_EXTRACTION says an in-memory stream's visibility on a shared host "must be
  verified on the host"), so the in-memory registration was NOT implemented (review L1: left as a documented limit). If the lab
  confirms it, `_write_stream` is the one place to change; the re-creation after a go2rtc restart already exists in `ensure_ready`.

**Injection.** go2rtc treats `exec:`, `ffmpeg:` and `#option` sources as instructions. Both sides allow four schemes only and refuse
whitespace, control characters and `#`; the add-on re-checks what the bridge returned (tested with a bridge that answers `exec:`).
The stream NAME is built only from a lower-case `camera.<a-z0-9_>{1,100}` id; anything else is a `ValueError` before any request.
**SSRF back into go2rtc (review M1).** The "it is the owner's own configuration" argument does not hold: an integration-supplied
`stream_source` is device-controlled data (an ONVIF `GetStreamUri` answer, a cloud API reply). go2rtc pulls whatever it is given, so a
source such as `http://127.0.0.1:1984/api/frame.jpeg?src=rtsp://evil&name=<a stream we do not own>` would make go2rtc repoint a
stream outside our namespace, and `rtsp://<go2rtc host>:8554/<another project's door station>` would restream it to every viewer.
Both sides now parse the URL (`urlsplit`) and refuse (`source_not_allowed`): `localhost`; loopback / unspecified / link-local /
multicast hosts in ANY spelling (`127.1`, `0x7f.1`, `2130706433`, `017700000001`, `[::1]`, `[::ffff:127.0.0.1]`, `[::127.0.0.1]`); a host
that looks numeric but is not a valid address; a query with a `src` or `name` key (any case, percent-encoding, `&` or `;`); an
http(s) source on port 1984 whose path is `/api...` (after decoding and normalizing `//`, `/./`, `/../`); non-ASCII or
percent-encoded hosts and backslashes (go2rtc's Go parser reads them differently). The add-on additionally refuses go2rtc's OWN
host - as written in `go2rtc_url`, and every address it resolves to - on go2rtc's ports (1984 / 8554 / 8555 and the port of the
configured URL); the bridge cannot know where go2rtc runs. Private LAN addresses stay allowed: cameras live there. Limits: a
camera name that resolves to loopback at go2rtc's resolver (`evil.example` -> 127.0.0.1) is not caught, because neither side does DNS
for camera hosts; and the check reads the source once - a camera answering differently later is caught by the re-read, not before.
The two policies are one corpus in `tests/test_source_policy.py`, which fails when they disagree.

**Namespace.** Two guards: go2rtc's (`smplwise_`) and this feature's (`smplwise_ha_`, so it can never overwrite an NVR or WisKey
stream). `reconcile` deletes only streams of the exact shape `smplwise_ha_[a-z0-9_]{1,100}` that no opt-in wants (tests: foreign, NVR
and WisKey streams and look-alike names untouched, and a name outside the namespace is refused by both guards). A recorder id
cannot produce a `smplwise_ha_` name either: `go2rtc.stream_name` refuses an id that starts with `ha_` or is `ha` (review L5; the id is
the constant `nvr-1` today, so this is a latent guard). A foreign stream that happens to be named `smplwise_ha_<x>` would be replaced -
the prefix is ours by contract.

**Races (review L3).** Every write and delete of one of our streams (enable, disable, a viewer's re-read, reconcile) holds one lock, never
together with the database write lock. Reconcile leaves a stream alone for 120 s after we wrote it (an enable writes the stream first;
its opt-in commits when the request ends) and asks the opt-in list again, in a fresh read, right before each delete.

**Authorization.** Enable / disable: `sources.configure`, audited, refused for others with an audited 403. Reading the source: the
bridge accepts only an active HA administrator (the add-on names the enabling person; the bridge checks). AGENTS.md says the HA admin
flag is never assumed to grant a VMS role - it is used here only as an ADDITIONAL HA-side condition for handing out raw credentials, the VMS
permission is `sources.configure`. Consequence to accept or relax: a VMS system administrator who is not an HA administrator gets
`403 ha_admin_required` on enable. Viewing: see "Viewing rule". Known limitation (inherited from the picture): a viewer with installation-wide
`video.live` sees every opted-in camera whatever their floor scope.

**Forgery / replay.** The request is HMAC-signed with the pairing secret, 60 s window, nonce replay cache (like every bridge service).
Whoever holds the pairing secret (the add-on's database; a compromise of the add-on) can ask for any camera's source by naming an
administrator's HA user id: the same trust the `execute` service already places in the secret. Bounded by camera-only ids, the bridge's
limits (4 per camera and 60 in all per minute - a failing camera cannot use up the others' budget, review L2), and on our side the
30 s per-camera re-read limit and a budget of 10 viewer-triggered re-reads a minute over all cameras (the owner's own enable is not part
of it).

**Who a re-read acts as (review L4).** A viewer-triggered re-read runs as the administrator who enabled the camera. It is refused - the stream
keeps playing, nothing is asked of the bridge, the `refresh` audit row says `sources_configure_lost`, and the picker shows "לא יתעדכן" with a
"רענן" button - when that person no longer holds `sources.configure` or is inactive. It is stateless: enabling the camera again (by
someone who may) or the permission coming back resumes it.

**Availability / abuse.** Session budget, remote cap and lease are shared with the NVR cameras; the bridge read has a 10 s timeout and
the answer is capped at 8 KB (bridge 2048 characters); a failing source is asked for at most every 30 s per camera; go2rtc or the bridge
being down leaves the existing stream (if any) alone and the card on its picture.

**Failure modes worth knowing.** After the add-on update the bridge must be updated and Home Assistant restarted once (until then:
`bridge_too_old`, no attempt is made when the bridge announced a version below 0.3.1). If the administrator who enabled a camera later
stops being an HA administrator, re-reads fail (`refresh` rows say `ha_admin_required`) and the old stream keeps working until its
source changes. A camera with no `stream_source` (`no_stream_source`) or one Home Assistant serves only as a snapshot stays a picture.
A disabled entity keeps its opt-in but loses its stream until it is enabled again.

## Needs a real instance (not exercised here)
Nothing in this work touched a real Home Assistant, bridge or go2rtc. Still to verify on the lab, read-only until the owner approves
the write: (1) update the bridge to 0.3.1 and restart Home Assistant; (2) a standalone camera with a real `stream_source` (RTSP, and
one with an `http` source) - does `camera.async_get_stream_source` return what the test assumes on this Home Assistant version;
(3) enable it from the picker and confirm the stream appears as `smplwise_ha_<slug>` and plays in WebRTC and MSE; (4) the go2rtc
version in use (persistence of the PUT, whether its log prints the source); (5) change the camera's source and see the re-read after
a failure; (6) disable and confirm the stream is gone and no other stream moved.
