# WKLIVE-295 - the leased station stream does not outlive its viewers

Scope (owner priority: live streams and talk first; fakes only, nothing default-on):

- **What already existed on main (2.17.0, W10CLIENT/WKDIRECT):** the six W10 commands, `WiskeyBridgeProvider` (descriptor + `stream_lease` on one
  shared connection as the actor `Arx`, the leased source registered in Arx's own go2rtc IN MEMORY as `smplwise_wiskey_<station>`), the dedicated
  talk connection per talk (`WiskeyBridgeTalkChannel`, the operator as actor), `TalkPump` (floor, batches, heartbeat, close), `media/talk_closed`
  handling, and ~50 tests on fakes in `tests/test_wiskey_media_v11.py`. Close / disconnect / busy / cleanup_failed paths are already covered there.
- **The gap this change closes:** the lease lasts seconds, but the go2rtc stream registered with its private source stayed in go2rtc's memory
  until a restart. Now `intercom_media._LEASED` remembers each leased stream (station, lease expiry); `release_leased_streams` removes a
  station's streams when its LAST viewer leaves (router `station_live_ws`, after `drop_viewer`), and every new lease sweeps leased streams older
  than `LEASE_GRACE_S` (60 s) whose station has no viewer. `Go2rtc.discard_leased_stream` refuses any name that is not `smplwise_wiskey_<station>`
  (never a probe, never another namespace). Registering and releasing share one lock, so a new viewer's stream is never deleted under it. A
  failed delete is logged by rule only and swallowed.
- **Not built (by instruction):** incoming audio (WisKey has not published its downlink contract); no parallel audio engine.
- **Unchanged and default-off:** `access.station_media` stays `off`, `access.station_media_provider` stays `local`; nothing here runs until the
  owner sets `auto`.

States (never a claim beyond what ran): implementation - done for the cleanup; registration - none new; connection - on fakes only; test -
`tests/test_wiskey_media_v11.py` (4 new tests); installation - not done; live - not measured (needs a shared session with the owner).
