# WKDIRECT-295 - Arx on WisKey's direct API (round 4, items 1-3, 5-7)

Branch `pilot/WKDIRECT-295`, built on `pilot/W10CLIENT-295` (093a50fc9). Source of the contract: WisKey round-4 intake
`docs/owner-development-2026-10-24/windows-round4-arx-intake/reference/DIRECT_API_V1.md` at WisKey commit 3707f97fb (read only).
No migration. Nothing is switched on: `access.station_media` stays `off`, `access.station_media_provider` stays `local`.

**Real code against fakes only.** Nothing here ran against a real WisKey, Home Assistant, station, go2rtc or audio device. Installed: no.
Live: no.

## What changed

| Unit | Files / symbols | Implemented | Wired | Tested (fakes) |
|---|---|---|---|---|
| Direct transport | `services/wiskey_media_bridge.py`: `DirectApiTransport`, `DirectLink`, `connect_body`, `sign_connect`, `reply_mac`, `open_reply`, `read_identity`, `canonical_json`, `websocket_opener`, `direct_ws_url` | yes | through `AutoTransport` in `intercom_media.bridge_provider` | yes (`tests/test_wkdirect_295.py`, `tests/w10_fake_direct.py`) |
| Runtime selection | `wiskey_media_bridge.AutoTransport`; `intercom_media.bridge_provider`, `provider_for` | yes | `access.station_media_provider = auto` only | yes |
| S6 (no unsigned path) | removed: `intercom_sync.IntercomSync.media_post`, `intercom_sync._media_hook` (+3 call sites), `wiskey_channels.MEDIA` and the `media` channel, `intercom_media.WiskeyProvider` / `SyncTransport` / `WiskeyTalkChannel` / `_TalkRegistry` / `WISKEY_TALKS` / `on_wiskey_event`, the six unsigned senders in `wiskey_media_contract.py` | yes | n/a | yes |
| Talk limit | `intercom_media.parse_descriptor` (v1.1 `audio.max_talk_seconds` exact int 1..86400), `TALK_MAX_LOW_S=1`, `TALK_MAX_HIGH_S=86400`, `talk_limit_s`; `routers/settings.py` `ge=1, le=86400` | yes | yes | yes |
| Settings field | `frontend/src/screens/system-access-display.ts` (`talkMax`), `api/station-media.ts` (`TALK_MAX_*`, `parseTalkMax`, `talkMaxInput`), `i18n/access-parity.ts` | yes | shown only while the media choice is video + talk | unit spec `frontend/tests/unit-wkdirect-talk-max.spec.ts`; no screenshot run |

`tests/test_wiskey_media_provider.py` (the suite of the removed unsigned provider) is deleted; its selection, M-3 fallback and S18 endpoint
cases are ported onto the signed provider over the direct API at the end of `tests/test_wkdirect_295.py`.

## The direct transport (DIRECT_API_V1.md)

1. `GET /api/hikvision_intercom/arx_bridge/v1/ws` on Home Assistant core (`ha_user_auth.core_ws_url` with WisKey's path; the Supervisor
   proxy carries no anonymous upgrade). No token, no Authorization header, no query string, no Home Assistant user, admin or panel.
   Internal TLS is accepted without a name check, as Arx's other core sockets do.
2. Hello `{type:"hello", protocol:"wiskey-direct-ws.v1", challenge:<32 hex>}` (exact keys) within 10 s, then
   `{id:1, type:"hikvision_intercom/direct/connect", bridge}`: body exactly `kind="wiskey-direct-connect.v1"`, `command="direct/connect"`,
   `query_owner_id="pairing"`, `issued_at`, `expires_at` (window 10 s, <= 15), `parameters={challenge}`, plus `ts`, `nonce`, `sig` by the
   existing recipe (`ha_bridge.sign`). The published vector `DIRECT_SIGNING_TEST_VECTOR.json` is reproduced byte for byte (canonical bytes,
   SHA-256, preimage, HMAC, whole object); its timestamps are historical and prove the computation only.
3. Every server frame is opened by `open_reply` BEFORE anything reads it: exact wrapper keys, kind, the connection_ref equal to the
   challenge, sig = HMAC-SHA256(pairing, "wiskey-direct-reply.v1." + canonical({connection_ref, frame})). The parsed JSON keeps int and
   float apart, so finite floats in business replies verify. One frame that fails closes the connection; requests in flight end
   `reply_unauthenticated`, outcome `unknown`, never retried.
4. The connect result must be exactly protocol / `query_owner_id` (`arx-service:<entry>`) / `principal_kind:"pairing_service"` /
   connection_ref (= challenge) / repository_id (string or null). That service subject is the `query_owner_id` of every later command; it is
   never treated as a Home Assistant user. `last_identity` keeps the public facts (no key, no challenge).
5. Later requests keep `{id, type, bridge}`, the existing `wiskey-bridge-command.v1` envelope and command names. Ids strictly increase from 2
   per connection. A result reaches only the request whose id it names; a late answer to an abandoned request or an unsolicited id is
   dropped (counted). Events are delivered only on the id of a `talk_open` this connection opened (registered by the reader when the result
   arrives, before the next frame is read). At most 64 requests in flight per connection.
6. Reconnect: each `connect` is a new socket, challenge, connection_ref and resource owner. No session, talk, job or carrier of an earlier
   connection is adopted; the shared video channel pays one fresh descriptor after a reopened connection, a talk never moves.
7. No key that signs (absent, unreadable, rotated `kid`) opens no socket.

## Selection rule (`access.station_media_provider = auto`)

`provider_for` returns the signed W10 provider only when `auto` is chosen, the feed's discovery lists the video commands, and the pairing
key can sign now (S6: otherwise Arx's own source, never an unsigned WisKey path). Per connection `AutoTransport` then uses:

- the direct API when the key signs and the direct socket opens and authenticates (hello, signed connect, verified reply, service identity);
- otherwise the existing signed bridge over the Home Assistant WebSocket (service channel);
- after a direct failure, the direct API is tried again for a NEW connection only after 60 s; an open connection never changes transport;
- `bridge_not_paired` / `bridge_key_rotated` try neither path (both sign with the same key).

## Q06: W10 on either transport

Shared video connection as actor `Arx` (descriptor + lease on one connection); a dedicated connection per talk as the operator (fresh
descriptor, `talk_open`, floor, batches, heartbeat, close). Six signed commands, floor first, sequence from 0, batches of 5 (10 supported),
ACK checked against `next_seq`, heartbeat `talk_floor(held=<current>)` at most every 5 s, the leased source registered in Arx's go2rtc in
memory only. Unchanged from W10CLIENT except the transport underneath.

Finding (fakes): a batch of 10 costs both credits of WisKey's bucket (capacity 2, 10 per second); paced at exactly real time it has no slack
against timer jitter (the fake refused the second batch `rate_limited` once). Arx keeps 5 as its default.

## Item 6: talk limit

WisKey publishes `station_media_max_talk_seconds` per station (exact int 1..86400, default 300, no 180 s clamp) as the v1.1 descriptor's
`audio.max_talk_seconds`. Arx reads it exactly (a bool, float, string, null or out-of-range value means the descriptor offers no talk; video
is unaffected). `access.station_media_max_talk_s` now takes the same range 1..86400 (default 300; was 10..900). Effective limit =
min(setting, station value); `talk_open.expires_at` is also capped by the fresh descriptor's expiry. Settings screen: "משך דיבור מרבי"
(seconds), shown under "וידאו ודיבור במסך התחנות" only while that is "וידאו ודיבור"; a value outside 1..86400 is not saved.

## Item 7: WisKey's no-traffic measurements against the client (simulation)

The fake direct server applies WisKey's measured rules (CURRENT_STATUS.json `W10_no_traffic`): a talk's principal expires with the window
of the last signed request (closed `access_lost`, no event), a talk idle for 12 s ends `idle_timeout` with a signed event; time scaled x0.1.
Output of `test_wiskeys_ttl10_and_ttl15_no_traffic_measurements_are_what_the_client_meets` (simulated seconds; WisKey measured 10.10 s and
12.14 s on its host, the fake's own timers give the values below):

| Case | Server closure | Event to client | Lock / journal | Client |
|---|---|---|---|---|
| window 10 s, no heartbeat | `access_lost` at 10.0 s | none | released | not told; its next request is refused `session_expired`, sent once, not retried |
| window 15 s, no heartbeat | `idle_timeout` at 12.04 s | signed `talk_closed` on the talk_open id | released | ends `upstream_closed` / `idle_timeout`, no close sent |
| window 10 s, heartbeat 5 s, 30 s | none | none | held | alive, 5 heartbeats |
| window 15 s, heartbeat 5 s, 30 s | none | none | held | alive, 5 heartbeats |

A batch queued before the release goes out whole (padded), then `floor(false)`; a later frame is dropped by the client and refused
`floor_not_held` by the station. No new gate was added.

## Not done / dependencies

- Not run against WisKey's real direct server or its simulation; the fake is written from the published contract.
- The discovery that `auto` requires is still the feed's (`overview.api.commands` on the service channel); the direct `peer_identity/get`
  and direct discovery are not used yet.
- Items 4, 8-14, 16 (operator RBAC, all 42 families, W1/intents, capture, features, emergency, WhatsApp, name_ref) are other agents' scope.
- Screenshot / pixel specs of the settings card were not run (the new row appears only in the video + talk mode).
