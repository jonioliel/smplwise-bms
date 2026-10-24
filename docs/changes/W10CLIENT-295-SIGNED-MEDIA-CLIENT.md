# W10CLIENT-295 - Arx client for WisKey W10 (station video + two-way talk), contract v1.1

Branch `pilot/W10CLIENT-295`, built on `origin/main` (v2.15.0). Slices S0-S5 of the plan in
`private/planning/ARX_UNIFIED_REPLY_ROUND2_2026-10-24_HE.md` section 6.7 (Q06). Everything is OFF by default:
`access.station_media` stays `off`, `access.station_media_provider` stays `local`. No migration.

**Nothing in this change has run against a real WisKey, a real Home Assistant, a station, go2rtc or audio.**

## Status, by the six states (honest)

| Unit | Implemented | Registered | Wired | Tested (fakes only) | Installed | Live |
|---|---|---|---|---|---|---|
| Contract tables v1.1 + readers (`wiskey_media_contract.py`) | yes | n/a | used by the new provider | yes | no | no |
| Signed envelope + result reader (`wiskey_media_bridge.py`) | yes | WisKey registers the six commands (its fixture, not measured by us) | behind `access.station_media_provider = auto` only | yes, against an independent verifier written in the test helper | no | no |
| Transport interface, `SignedBridgeTransport`, `HaWsConnection` | yes | n/a | `provider_for(auto)` builds it | `HaWsConnection` only with a scripted `ws_session` | no | no |
| `DirectApiTransport` | placeholder, NO wire | n/a | not selected anywhere | refusal only | no | no |
| Talk pump (`wiskey_talk_pump.py`) + `WiskeyBridgeTalkChannel` | yes | n/a | via the provider | yes | no | no |
| Video: shared connection, descriptor + lease as actor `Arx` | yes | n/a | via the provider | yes | no | no |
| Talk limit setting `access.station_media_max_talk_s` | yes (backend + settings API) | n/a | yes | yes | no | no |
| Setting on the station-media settings screen | NOT done (frontend) | - | - | - | - | - |

## What changed

- `services/wiskey_media_contract.py`: section "contract v1.1" - closed parameter builders for the six commands (no `api_contract`), a
  strict `validate_parameters` run before anything is signed, readers `parse_frame_ack`, `parse_floor`, `parse_close`,
  `parse_talk_open_v11` (PCMU only), `parse_lease_v11` (`{source, expires_at}` only, <= 15 s + 15 s clock allowance, no `go2rtc_stream`),
  `talk_closed_v11`, the WisKey error table (`Unauthorized` capitalised, `session_expired`, `cleanup_failed`, ...). The old flat-frame helpers
  (with `api_contract`) stay for the retired feed path / legacy `WiskeyProvider` only.
- `services/wiskey_media_bridge.py` (new): `BridgeSigner` (the existing recipe through `ha_bridge.sign`; a rotated key with a non-legacy
  `kid` is REFUSED, not signed), `verify_result`, the `MediaLink` / `MediaTransport` interfaces, `SignedBridgeLink`, `SignedBridgeTransport`,
  `HaWsConnection` (over `ha_client.ws_session`; the Home Assistant user comes from `auth/current_user`), `DirectApiTransport`
  (placeholder), `LoopThread` + `VideoChannel` (the one shared video connection).
- `services/wiskey_talk_pump.py` (new): `TalkPump` - one signed request at a time per talk, batches of 5 (100 ms), sequence from 0 assigned at
  send, floor first, silence padding on release, at most one batch waiting (older audio dropped, never queued), never faster than real time,
  1.5 s answer limit -> end the talk (`media_outcome_unknown`), no retry, heartbeat `talk_floor(held=<current>)` at least every 5 s.
- `services/intercom_media.py`: `parse_descriptor` accepts `arx.station_media.v1.1` (one `main` profile; `private_rtsp_source` is served
  through Arx's go2rtc as mse/webrtc; null codec/size = unknown; `signed_ws_batch_v1` = talk to the browser as `pcmu_frames`; null viewer
  limit = Arx's cap; null talk limit = none); `WiskeyBridgeProvider` and `WiskeyBridgeTalkChannel`; `provider_for(auto)` now returns the
  signed provider; `talk_limit_s`, `new_talk(limit_s=)`, `MediaState.forget`, `_register_lease` (shared go2rtc registration).
- `routers/intercom_media.py`: the talk start and the media read use `talk_limit_s`.
- `routers/settings.py`: `access.station_media_max_talk_s` (default `300`, integer 10..900, same PATCH rules as the other integer settings).
- Tests: `tests/test_wiskey_media_v11.py`, `tests/w10_fake_station.py`, fixtures `tests/fixtures/wiskey_w10/*.v11.json`, `*.ack.json`,
  `w10_parameters_schemas.json` (schemas derived from WisKey's `W10_REGISTRATION_AND_SCHEMAS.json`).

## Connection and identity model (from WisKey's code as read, not run)

- A descriptor is owned by the connection (and actor) that read it; its lease and talk must come from the same connection and actor.
  -> ONE shared `video` connection (descriptor + lease, actor `Arx`), and ONE dedicated connection per talk: a fresh descriptor, `talk_open`,
  floor, frames and close, all as the operator (actor id and display name of the logged-in user). The shared connection's descriptor handle is
  not reused for talk.
- A video lease that fails `Unauthorized` / `session_expired` (the connection was reopened) costs exactly one fresh descriptor and one more
  lease; nothing else is retried. Reads only.
- The signed `query_owner_id` is the Home Assistant user of the connection (`auth/current_user`). Which identity the connection runs under
  (service channel token vs a dedicated account) is NOT decided here - `ha_connector(settings, url=, token=)` takes either; the default is the
  existing service channel. Per the owner no new Home Assistant user is created by this work.

## Talk limit (owner decision 3)

`min(access.station_media_max_talk_s, descriptor max_talk_seconds when it names one)`. WisKey's 180 s is honoured while it is in its
descriptor; once WisKey drops it (null) only the Arx setting applies. `talk_open.expires_at` is also capped by the fresh descriptor's expiry.
TODO (frontend, not done): show the setting in the station-media settings screen (an integer field 10..900).

## Deviations from the plan

1. `wiskey_bridge_adapter.py` (WKBRIDGE) is not on `origin/main`; the signer is a new small class on `ha_bridge.sign`, not that adapter.
2. `MediaBridgeSession` became `SignedBridgeLink` + `VideoChannel`; the pump is its own module.
3. `provider_for(auto)` returns the signed provider now (the old unsigned `WiskeyProvider` is no longer returned). The feed-side pieces
   (`intercom_sync.media_post`, `_media_hook`, `wiskey_channels.MEDIA`) are NOT removed - that is S6.
4. The video actor argument of `video_stream` is ignored on the signed provider (the video actor is always `Arx`).
5. Talk opens with one extra round trip (the descriptor on the talk's own connection).
6. A partial last batch is padded with mu-law silence (0xFF), the plan's default; batch N = 10 is supported by the contract helpers but never used.

## What S6-S8 still need

- From WisKey/Windows: signing vectors (to compare byte for byte with `ha_bridge.sign`); a synthetic run of this client against their real
  `station_media_api` with the synthetic sink, including the heartbeat claim (idle 12 s, principal <= 15 s); the direct API contract (then only
  `DirectApiTransport` grows a wire); a decision on `kid` for rotated keys; whether `auth/current_user` is the user their `query_owner_id` check
  expects; whether `bridge_schema` really appears on results; removal of the 180 s limit.
- S6: remove the feed path for W10 (`intercom_sync.media_post`, `_media_hook`, `wiskey_channels.MEDIA`), make `auto` require a signed preflight.
- S8: installation preflight (identity, `smplwise_bridge` loaded, key not rotated, discovery of the six commands) and the lab session (codec,
  channel 102, simultaneous Arx + panel, microphone, speaker). Browser behaviour with the `main` profile only (MSE) is not re-measured.

## Risks

- The whole path is unproven against WisKey; it was written against its published schemas and its source as read.
- The nonce budget: a talk at N=5 is about 10 signed requests per second (about 1200 per 120 s) against WisKey's 4096-per-120 s window; three
  concurrent talks sit near the ceiling.
- A rotated bridge key (adopted key set with a non-legacy `kid`) disables W10 signing until WisKey supports `kid`; Arx falls back to its own
  source for video and offers no talk.
- `HaWsConnection` has never touched a real Home Assistant.
