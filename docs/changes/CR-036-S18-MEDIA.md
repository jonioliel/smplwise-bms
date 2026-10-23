# CR-036 slice S18 - a station's live video and two-way audio ("talk") inside Arx

Status: BUILT ON FAKES (2026-10-12), branch `pilot/WISKEY-media-s18` from `origin/integ/248`. `WiskeyProvider` on the W10 contract
BUILT ON FAKES (2026-10-23, AVW10-295, branch `pilot/AVW10-295`; section 7) - waiting for WisKey's W10 delivery. Nothing here contacted a station,
WisKey, Home Assistant or a real go2rtc; every live behaviour is NOT_RUN until the owner's lab session (CR-036 slice S14).

Owner decision 2026-10-12 (binding, supersedes answer 5 of 2026-10-11 and the "later" of CR-036 rows 4, 6 and 7): live video and
talk are part of stage 1. WisKey's answer to **W10** (a station stream descriptor and an audio hook that is not tied to its
panel's WebSocket connection) is still open, so this slice builds everything that does not need W10 against a FAKE descriptor,
and section 3 is the contract text to send to WisKey.

Read with: `CR-036-WISKEY-NATIVE-SCREENS.md` (rows 4, 6, 7; section 4.2 W10), `CR-036-S6-NOTES.md` (the stations screen),
`CR-036-S3-S4-INTERFACE-NOTES.md` (permissions), `docs/integrations/wiskey/ARX_DECISIONS_REPLY_HE.md` section 2 and
`ARX_DECISIONS_REPLY_2_HE.md` section 4 (D-002: the interim "Arx's own station source" that WisKey accepted).

## 1. What exists after this slice

| Piece | Where | One line |
|---|---|---|
| Setting | `routers/settings.py` `access.station_media` | `off` (default) / `video` / `video_talk`; `system.configure`, audited like every product setting |
| Media adapter | `services/intercom_media.py` | the descriptor contract (`parse_descriptor`), providers, per-station viewer limit, talk sessions, expiry |
| Endpoints | `routers/intercom_media.py` | media read, live socket, talk start / socket / stop (section 2) |
| Live view | `frontend/src/components/wk-station-live.ts` | the product's one player (`sw-live-player`) on the station's relay path, quality choice, talk control |
| Push-to-talk | `frontend/src/components/wk-talk-button.ts`, `frontend/src/wiskey/talk-session.ts`, `talk-mic.ts`, `g711.ts` | press-and-hold, microphone states, G.711 frames |
| Screen hook | `frontend/src/screens/wiskey-stations.ts` (+ two optional hooks in `wiskey-stations-views.ts`) | the drawer shows the native area when the setting and the read allow it, the still and the classic panel otherwise |

### 1.1 Providers

| Provider | When | Video | Talk |
|---|---|---|---|
| `LocalProvider` | production today | Arx's own station source (D-002 interim): the in-memory go2rtc stream `smplwise_wiskey_<station>` the stills already use (main profile, channel 101). No go2rtc configuration write | none: the talk button keeps its "talk in the classic panel" mode |
| `FakeProvider` | tests; a developer backend with `SW_FAKE_STATION_MEDIA=1` (refused when `in_addon`) | sub + main | half-duplex G.711 over `pcmu_frames`, an in-memory upstream that counts frames |
| `WiskeyProvider` | while WisKey's discovery (`overview.api.commands`) lists the W10 video commands (AVW10-295, section 7) | from the descriptor; each profile's source from `media/stream_lease`, registered in memory as `smplwise_wiskey_<station>[.sub]` | from the talk hook, only while the four talk commands are listed too |

`WiskeyProvider` is written (AVW10-295, 2026-10-23) and runs ON FAKES only: it implements the same three calls (`describe`,
`video_stream`, `talk_open`) as the two above, so the screens and the endpoints do not change. Its commands are not in the pinned
catalog (`rc37-contract.4`); until WisKey's own contract package lists them they are held to Arx's proposal
(`docs/integrations/wiskey/catalog/w10-proposal`). See section 7.

The sub channel 102 of a station is not offered by `LocalProvider`: it is unverified on stations (D-002 item 4, "a future request,
first measure the 401 behaviour and the codec"). Until it is measured, Arx's own source offers the main profile only (MSE).

## 2. Endpoints (all under `/api/v1`, all behind `access.station_media`)

| Method | Path | Gate | Reply / effect |
|---|---|---|---|
| GET | `access-control/stations/{id}/media` | `access.read` on the station chain (off-chain = 404, like an absent station) | `{state: off \| unavailable \| ready, reason, mode, video: {profiles, default_profile, allowed, paths, max_viewers, viewers}, talk: {available, reason, transport, codec, duplex, max_seconds, sample_rate, frame_ms, busy}, listen, expires_at}` - field by field, never a source / address / credential / handle |
| WS | `access-control/stations/{id}/live/ws?profile=sub\|main` | `access.read` AND `video.live` on the station chain | the existing relay (`routers/media.py _live_relay`): `media.max_live_sessions`, `remote.max_live_streams`, lease, `video.live.start` / `.stop` audit (`resource_type` `intercom_station`); plus the descriptor's per-station viewer limit (close 4429); go2rtc's error frames are replaced by `upstream_error` |
| POST | `access-control/stations/{id}/talk` | `access.call` on the station chain | reserves the station's single talker slot and the caller's single session; body `{client_request_id?}`; reply `{session, ws_path, expires_at, max_seconds, attach_within_s, transport, codec, duplex, sample_rate, frame_ms, request_id}` |
| WS | `access-control/talk/{session}/ws` | the session's own user; `access.call` re-checked like a camera lease | browser -> Arx: binary G.711 frames (only forwarded while the floor is held), `{"type":"talk/ptt","value":"down"\|"up"}`, `{"type":"talk/stop"}`; Arx -> browser: `talk/state open`, `talk/floor held\|released`, `talk/closed <outcome>` |
| POST | `access-control/talk/{session}/stop` | the session's own user (anyone else: 404) | ends it (idempotent) |

Refusals of the start (each one audit row, nothing sent anywhere): 404 `intercom_station_not_found`, 403 `forbidden`, 409
`intercom_talk_off`, `intercom_station_offline`, `intercom_talk_unavailable` (+ `details.reason`), `intercom_talk_unsupported`,
`intercom_talk_busy` (who talks is never said), `intercom_talk_user_busy`, 503 `intercom_unavailable`, 422 `validation`.

Socket close codes: 4401 no identity, 4403 refused / permission lost, 4404 unknown session or not its owner, 4408 expired,
4409 a second socket for one session, 4429 a cap, 4503 the upstream is unavailable.

### 2.1 Permission

**Talk is gated by the call permission `access.call` ("בקרת כניסה: מענה לשיחה מעמדה והכרזה קולית")** on the station chain - the owner's rule ("the call
permission covers it"; answer 6 of 2026-10-12 put announcing under the same permission). No new permission. Video is
`access.read` + `video.live` on the station chain: an operator bound to one station watches that station only; a deny on the
station closes it for an installation-wide viewer.

Defaults: `access.call` is held by `site_admin` and `system_admin` (and by CR-033's `door_opener` once S11 / CR-033 add it, as
recorded in the S3/S4 interface notes). An ordinary operator therefore sees live video but not the talk button.

### 2.2 Limits, expiry, no retry

- One talker per station, one talk session per user (both in memory; a restart ends every session).
- A talk session lasts at most the descriptor's `max_talk_seconds`, clamped to 10..300 s by Arx; the socket must attach within
  15 s of the start (else the slot is released, outcome `never_connected`); a session nobody presses for 30 s is ended by the
  browser.
- Frames: at most 1024 bytes each, at most 100 per second; anything else is dropped. Nothing reaches the station unless the
  floor is held.
- The descriptor is cached per provider and station until 30 s before it expires and renewed transparently (the live lease
  re-reads it); `LocalProvider`'s is never cached (it is cheap and must follow a credentials change at once).
- No retry anywhere: a refused start is shown, the operator presses again; an upstream that closes ends the session.

### 2.3 Audit (never audio content)

| Action | When | Fields |
|---|---|---|
| `intercom.talk.start` allowed | a session was reserved | actor, `request_id` (the client's id or the correlation id), `resource_type` `intercom_station`, `resource_id` = the logical station, details `{session (digest prefix), transport, codec, duplex, max_seconds}` |
| `intercom.talk.start` denied | any refusal above | actor, request id, station, `reason` = the code |
| `intercom.talk.end` | exactly once per session | actor, the same request id, station, `reason` = outcome, details `{session, outcome, duration_s, frames, presses, transport}` |
| `video.live.start` / `.stop` | every live socket (existing rows) | `resource_type` `intercom_station` |

Outcomes: `stopped`, `ended`, `expired`, `access_lost`, `upstream_closed`, `upstream_unavailable`, `never_connected`.
The session handle itself is never stored (only a 12-character digest prefix). Frame bytes are never logged, audited or kept;
the fake upstream counts them.

## 3. The descriptor and audio-hook contract proposed to WisKey (W10) - text to send

> **To the WisKey team - Arx request W10 (proposal, version `arx.station_media.v1`).** Arx shows a station's live video and lets
> an Arx operator talk to a station from Arx's own screen. Arx's RBAC decides who may watch and talk (owner decision
> 2026-10-03); WisKey stays the owner of the station, its audio session and its busy lock. We ask for three server-side
> commands on the add-on's channel and one event. Nothing below ever reaches a browser; Arx serves its own projection.
>
> **Hard rules for every reply:** no RTSP / HTTP / ISAPI URL, no host name or IP address, no user name, password, token, cookie
> or serial number anywhere in a descriptor. Handles are opaque strings (`[A-Za-z0-9_-]{16,128}`) that mean something only to
> WisKey. Arx refuses a descriptor that carries anything that looks like an address or a secret (and logs only the rule code).
>
> **1. `hikvision_intercom/media/station_descriptor`** `{station_id, actor: {id, display_name}, request_id}` ->
> ```json
> {
>   "schema": "arx.station_media.v1",
>   "station_id": "<the station id of overview>",
>   "session": "<opaque handle, 16-128 url-safe characters>",
>   "revision": 7,
>   "issued_at": "2026-10-12T08:00:00Z",
>   "expires_at": "2026-10-12T08:05:00Z",
>   "video": {
>     "profiles": [
>       {"id": "sub",  "codec": "h264", "width": 640,  "height": 360,  "fps": 15, "transports": ["webrtc", "mse"]},
>       {"id": "main", "codec": "h264", "width": 1920, "height": 1080, "fps": 25, "transports": ["mse", "webrtc"]}
>     ]
>   },
>   "audio": {
>     "listen": true,
>     "talk": true,
>     "duplex": "half",
>     "codec": "pcmu",
>     "talk_transports": ["pcmu_frames"],
>     "max_talk_seconds": 120
>   },
>   "limits": {"max_viewers": 2, "max_talkers": 1}
> }
> ```
> - `profiles[].id` is `sub` or `main`; `codec` `h264` / `h265`; `transports` what the browser may use for that profile
>   (`webrtc`, `mse`). A profile the station does not have is simply absent.
> - `audio.codec` `pcmu` / `pcma` (G.711, 8 kHz mono); `talk_transports` in order of preference; `duplex` `half` / `full`;
>   `max_talk_seconds` the station's own limit (Arx also caps at 300 s).
> - `limits.max_viewers` the number of simultaneous Arx viewers the station tolerates through this descriptor; `max_talkers` is
>   always 1 for Arx.
> - Lifetime at most 24 h (5-15 min suggested). Arx renews before `expires_at`; a new `revision` may change anything.
> - Errors: `station_not_found`, `station_offline`, `media_not_supported`, `rate_limited`, plus your existing codes. Please map
>   them in W5.
>
> **2. `hikvision_intercom/media/stream_lease`** `{session, profile, actor, request_id}` -> `{source, expires_at}` where `source`
> is the RTSP source of that profile **for Arx's own go2rtc only**. Arx registers it in memory under its own namespace
> (`smplwise_wiskey_<station>[.sub]`), never writes it to a configuration, never logs, audits or serves it (the same rule Arx keeps
> for its own station credentials today). This replaces Arx's own station credentials (brief item 5.5, "one source of station
> credentials"). If you prefer to keep the source inside WisKey, the alternative is `{go2rtc_stream: "<name in a go2rtc you
> control>"}` plus a statement whether that go2rtc is the one at Arx's `go2rtc_url` - tell us which.
>
> **3. The talk hook** - the audio session of the current `audio/start` / `audio/send` tied to an Arx caller instead of a panel
> WebSocket connection:
> - `media/talk_open` `{session, actor: {id, display_name}, request_id, expires_at}` -> `{talk_ref, codec, frame_ms: 20}` or
>   `audio_busy` (someone - the panel or another Arx operator - holds the station). Takes WisKey's busy lock for that station.
> - `media/talk_frame` `{talk_ref, seq, data}` - `data` is base64 of one G.711 frame (160 bytes = 20 ms), sent only while the Arx
>   operator holds the push-to-talk button; `seq` increases by one per frame. No reply needed (or a cheap ack).
> - `media/talk_floor` `{talk_ref, held: true|false}` - press / release (lets WisKey switch a half-duplex station between talk and
>   listen).
> - `media/talk_close` `{talk_ref, reason}` - Arx's reasons: `stopped`, `ended`, `expired`, `access_lost`, `upstream_closed`.
> - Event `media/talk_closed` `{talk_ref, reason}` when WisKey ends it (the panel took the station, the station dropped,
>   your own limit).
> - Your audit gets `actor` and `request_id` from Arx (the same `request_id` Arx writes in its own `intercom.talk.start` /
>   `intercom.talk.end` rows), never audio content.
> - `webrtc` is an acceptable second talk transport (the browser's microphone straight to a go2rtc backchannel you control); Arx
>   implements `pcmu_frames` first because it works through Home Assistant Ingress and Cloudflare, where WebRTC's UDP often does
>   not.
>
> **4. Discovery.** Please list the new commands in `overview.api.commands` and in the static catalog of the next contract
> package, with full request / response schemas (W2 style). Arx shows the native live view and talk only when they are listed;
> otherwise the classic panel keeps them, exactly as today.
>
> **Questions:** (a) Can a station hold Arx's RTSP session and the panel's at the same time (D-002 item 5, measured on site)?
> (b) Does `audio/start` today refuse when the panel holds the station (`audio_busy`) - and would the panel see an Arx talk as busy
> too? (c) The station's channel 102: available on your models, which codec?

## 4. The screen (drawer of `תחנות ודלתות`)

- **Off (default):** nothing changes - the still, "שידור חי בלוח הקלאסי" and the classic-panel talk link, and no media request is
  made (the S6 evidence spec's request allow-list still holds).
- **`video` / `video_talk`, read `ready`, `video.allowed`:** the still is replaced by the live player (`sw-live-player`,
  `livePath` = the server's path): the sub profile plays `auto` (WebRTC first, MSE as the fallback - the owner's rule of
  2026-10-05 and the lab facts of 2026-09-14), the main profile plays MSE. The still stays the poster until the first frame.
  "איכות: רגילה / גבוהה" appears only when both profiles are offered. Video is never mirrored by RTL (`direction: ltr` on the frame).
- **Talk:** with `talk.available` the native push-to-talk replaces the classic-panel link; without it the classic-panel link
  stays (when `access.talk_button` = classic and the caller holds `access.release`, as before). In a card or a list row (a call in
  progress) "דיבור" opens the station's drawer, where the push-to-talk is.
- **Push-to-talk UX (desktop and phone):** press and hold the big button (mouse, touch, or Space / Enter on the focused button);
  release to listen. The first press asks for the microphone (the prompt belongs to the operator's gesture) and opens the session;
  later presses reuse it. A countdown ("נותרו 1:45") and "סיום דיבור" while open. On a phone: `touch-action: none`, no long-press
  callout, pointer capture so a finger sliding off still releases. A half-duplex station's sound is muted while the floor is held.
- **States (one short line, no paragraphs):** opening, ready, talking; the microphone blocked / missing / busy / unavailable on a
  plain-HTTP page (a microphone needs a secure context: the Ingress page over HTTPS or the `/arx` channel); another operator
  talking; and every outcome (ended, time over, permission removed, channel closed, connection dropped).

## 5. Tests (fakes only)

- Backend `tests/test_intercom_media.py`: the setting; the contract (valid, 14 refusal cases incl. RTSP URL / IP / secret keys,
  unknown fields dropped); the media read for off / ready / every unavailable reason / who sees what (station chain, deny);
  the live socket through the existing relay (budget, viewer limit, profile refusals, error-frame sanitising, lease on the
  setting and the descriptor); talk end to end (frames only while held, oversize dropped, audit rows without audio), busy /
  user busy, refusals, expiry, never-attached release, socket ownership, upstream failures, the setting turned off mid-talk.
- Frontend unit `tests/unit-wiskey-station-media.spec.ts`: G.711 against reference values, the downsampler and frame packer,
  the player mode per profile, the talk state machine (one start per press, frames only while held, idle end, refusal and close
  mapping, no retry).
- Browser evidence (mocked backend, fake media stack) `tests/evidence-wiskey-station-media.spec.ts`; layout guard
  `tests/layout-wiskey-station-media.spec.ts`; pixel spec `tests/pixel-wiskey-station-media.spec.ts` (baselines NOT generated
  here: the specs skip without them).

## 6. Not done here / hand-offs

1. ~~**Settings UI control** for `access.station_media`~~ - DONE by WXMEDSET (2026-10-13, commit 11dc88f4f):
   `screens/system-access-display.ts` (mounted by `system-diagnostics.ts`), labels through `i18n/access-parity.ts`
   ("וידאו ודיבור במסך התחנות": כבוי / וידאו / וידאו ודיבור), default off; specs `unit-wxmedset`, `evidence-wxmedset`.
2. **W10** - section 3. Arx side DONE ON FAKES by AVW10-295 (section 7): `WiskeyProvider`, the `media` channel allow-list,
   `ADAPTER_CALLS` + the proposal schemas in `tests/test_wiskey_contract.py`, a fake fixture per reply. Left: WisKey's delivery,
   then its contract package replaces the proposal (and the pin, if WisKey re-pins), then the lab session (item 4).
3. **S11** moves call / announcement onto `access.call` on the station chain; talk is already there.
4. **Lab (S14, owner):** WebRTC / MSE start times on a real station, a station's RTSP session limit with WisKey pulling at the
   same time, the microphone on a phone over the Ingress page (secure context), echo on a half-duplex station.
5. **Pixel baselines** for the new spec (runner `linux-pixel ... --update-snapshots`, then review every image).

## 7. AVW10-295 - `WiskeyProvider` on the W10 contract (2026-10-23, branch `pilot/AVW10-295`, ON FAKES)

Owner directive 2026-10-23: WisKey grants Arx full access through our bridge only, and WisKey may still adjust field names. So:

- **One adapter layer.** `services/wiskey_media_contract.py` holds every W10 wire name: the six commands, the request keys, the
  reply keys, the `media/talk_closed` event, the close reasons and the error mapping. A WisKey rename is a change there (and in the
  fixtures `tests/fixtures/wiskey_w10/`); the provider, the endpoints and the screens do not change.
- **Selection by discovery.** `provider_for`: a test override; else the developer fake (`SW_FAKE_STATION_MEDIA=1`, never in the
  add-on); else `WiskeyProvider` while `overview.api.commands` lists `media/station_descriptor` and `media/stream_lease`
  (`min_client` compatible); else `LocalProvider` exactly as before. Talk is offered only while `talk_open` / `talk_frame` /
  `talk_floor` / `talk_close` are listed as well (otherwise the descriptor's talk is forced off: the classic panel keeps it).
- **Channel.** `wiskey_channels.MEDIA` (unpinned, like `readback` / `pacing`): exactly the six commands, same socket and identity as
  `service`. Descriptor and lease: read lane (`SYNC.command`, rate buckets). `talk_open`: action lane (never queued or retried).
  `talk_close`: action lane without a rate token. Frames and the floor: `SYNC.media_post` (no lane, no token; limits are the talk
  socket's: only while held, at most 100/s, 1024 bytes; at most 8 frames in flight, a slower WisKey drops frames, never queues audio).
- **Descriptor.** Read as Arx itself (`actor {id: arx}`), because it is cached per station for every viewer; parsed by the same
  `parse_descriptor` (no address, no secret, strict expiry, renewed 30 s before it ends).
- **Stream lease.** Asked with the real viewer as `actor`. `{source, expires_at}`: `rtsp(s)://` only, lifetime <= 24 h, registered IN
  MEMORY in Arx's go2rtc as `smplwise_wiskey_<station>` (main) / `.sub` (sub) through the stills' GetOrPatch registration - never
  written to a configuration, never logged, audited or served (the lease's repr hides it). `{go2rtc_stream}`: accepted only inside
  `smplwise_wiskey_`; any other name (another project's stream) is refused (`lease_stream_foreign`). Both / neither: refused.
- **Talk hook.** `talk_open` with the session's own `expires_at`, the real actor and the same `request_id` Arx audits;
  `audio_busy` -> the session ends `upstream_unavailable` (who holds the station is never said); a reply with a wrong codec, frame
  length or handle is refused and - when its `talk_ref` is well formed - closed at once. `talk_frame` `seq` +1 per frame sent;
  a refused or undeliverable frame or floor ends the talk (no retry). `media/talk_closed` (subscription event, `kind` or `type`)
  and a feed session end close the talk without sending `talk_close`.
- **Tests (fakes):** `tests/test_wiskey_media_provider.py`, `tests/test_wiskey_contract.py` (frames vs the proposal),
  `tests/test_wiskey_channels.py`. Frontend: no screen change (the projection is the same); `unit-wxmedset`,
  `unit-wiskey-station-media` cover the setting and the drawer.

What WisKey must deliver (W10): the six commands with the request keys of `w10-proposal/commands.proposed.json`, listed in
`overview.api.commands` for the add-on's user and in the next contract package; `audio_busy` on `talk_open`; the
`media/talk_closed` event on Arx's `subscribe` (tell us the exact event key: `kind`); the answers to the three questions of
section 3. Open on the Arx side: a `talk_open` whose answer is lost (timeout) cannot be closed by Arx (no `talk_ref`): WisKey's own
limit must free the station; the lab session (section 6 item 4).
