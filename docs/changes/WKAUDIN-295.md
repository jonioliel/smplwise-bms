# WKAUDIN-295 - listening to a station (its audio TO Arx)

Owner priority (24.10.2026): live streams and talk to the stations first. This change is the Arx side of **station audio to the operator**
("listen"). It is built against a **synthetic downlink** because WisKey has not published the contract of its downlink yet.

## Status of the contract (what is pending)

WisKey's delivery (`09_arx_decisions_mac_continuation/LIVE_STREAMS_AND_TALK_HE.md`, 24.10) says: `client.audio.AudioSession.receive` exists in
the engine, but `BridgeTalkSession.run` neither reads it nor publishes a downlink, and the MSE path with a native permit filters video only.
No command, batching, codec negotiation or end event is published for incoming audio.

The ONE place that changes when it is published: `smplwise_vms/backend/smplwise/services/wiskey_listen_adapter.py`
(`CONTRACT_STATE = "pending WisKey downlink contract"`). Everything else talks to its `ListenChannel` protocol.

Assumptions kept in that file, each one PENDING:
- packets are G.711 mu-law, 8 kHz mono, as `AudioSession.receive()` returns them (`bytes`; `b""` after its 2 s timeout = silence, not an end;
  `AudioError("audio_connection_lost")` = an end);
- a packet is whole 20 ms frames of 160 bytes; other sizes are split into whole frames, a partial tail and anything over 1600 bytes is dropped;
- Arx never queues audio: when the browser is slower than the station the oldest of the 25 queued frames goes first (bounded latency).

No parallel audio engine, no route around the direct interface: the real channel (`WiskeyDownlinkChannel`) refuses to open with
`downlink_pending`, so a real station can never be listened to through a guess.

## What was built

Backend
- `services/wiskey_listen_adapter.py` - the adapter, `SyntheticDownlink` (tests), `ReceiveDownlink` (the shape of the real one), the pending
  `WiskeyDownlinkChannel`.
- `services/intercom_listen.py` - the setting, the in-memory session registry (one session per user, 4 per station), the provider hook.
- `routers/intercom_listen.py` - `GET/POST /access-control/stations/{id}/listen`, `POST /access-control/listen/{session}/stop`,
  `WS /access-control/listen/{session}/ws`.
- `services/intercom_media.py` - `listen_open` on `WiskeyBridgeProvider` (returns the pending channel) and on `FakeProvider` (synthetic).
- `routers/settings.py`, `main.py` - the setting `access.station_listen` and the router registration.

Frontend
- `api/station-listen.ts`, `wiskey/g711-decode.ts`, `wiskey/listen-session.ts` (state machine, injected effects), `wiskey/listen-player.ts`
  (Web Audio, bounded schedule), `components/wk-listen-button.ts` (start/stop, mute, level meter), `i18n/wiskey-station-listen.ts`;
  mounted in `components/wk-station-live.ts`; one row in the stations display card (`screens/system-access-display.ts`).

## Rules kept

- **Off by default.** `access.station_listen` = `off` | `on` | `probe`. `on` needs the descriptor's `audio.listen` (WisKey leaves it unknown
  until measured, so a real station stays unavailable); `probe` (administrator only, for a shared session) accepts the unknown and tries.
- **Permission and scope as talk:** `access.call` on the station chain (CR-033), re-checked every second like a camera lease; the setting turned
  off or the permission lost ends an open session (`access_lost`).
- **The operator can always stop:** the button, closing the drawer, `listen/stop` on the socket, `POST .../stop`; a stop before the socket
  opened releases the reservation.
- **Read-only toward the station:** nothing is ever sent to it (binary and oversize text from the browser are ignored).
- **Audit:** `intercom.listen.start` (allowed, or denied with a reason) and `intercom.listen.end` (outcome, duration, frames, dropped, mode):
  who, which station, when - never audio content, never the session handle (a digest prefix only).
- **Nothing recorded or stored:** a frame goes from a 25-frame queue to the socket and is gone; no file, no database row, no log line with a frame.
- **Meter and mute are in the browser:** mute silences the speaker and keeps the meter, so the operator still sees the station making sound.
- The listen control appears only inside the station media drawer (`access.station_media` not `off`), and only when the server says it is available.

## The six states (never a claim of a run that did not happen)

| | state |
|---|---|
| implementation | Arx side built: receiver, session, speaker, meter, mute, audit, setting. The WisKey downlink itself: **not available** (their side) |
| registration | routes and setting registered in Arx; the WisKey command: **none published** |
| connection | synthetic downlink only; a real station answers `downlink_pending` |
| test | fakes only - see "What ran" in the report of this branch |
| installation | NOT installed anywhere |
| live | NOT_RUN. No station, microphone or speaker was touched |

## Runbook for the shared live session (owner present, prior notice, nothing before)

Preconditions (all must be true; none is satisfied by this change alone):
1. WisKey has published the downlink contract and `wiskey_listen_adapter.WiskeyDownlinkChannel` joins it (a follow-up change of this file only).
2. A candidate build with that change is identified (branch, full SHA, build) and installed by the owner's instruction - this change does not install.
3. The owner names the station and is present. No address, name, PIN or card value is written anywhere.

Steps (the owner's own screen, after prior notice):
1. Settings > General > station screens display card: set "listening to the station" to **trial** (`probe`). Open the stations screen, the drawer of the
   named station.
2. Press **Listen**. Expected: "listening" with the time left, the level meter moving when the station makes sound, mute works and keeps the meter.
3. Observe, per the owner: is the sound heard, is it intelligible, delay (rough), what happens when the station is silent for several seconds
   (the meter reads empty, the session stays open), what happens when the owner's talk session is open at the same time (echo - record it, do not fix it live).
4. Stop: press **Stop listening** (or close the drawer). Expected: the meter and the speaker stop at once; one end row in the audit.
5. Set the setting back to **off** at the end of the session.

What to record (counts and facts only): session start/stop times, outcome, frames and dropped counts from the `intercom.listen.end` audit row,
the owner's observations in words. Never audio, addresses, names or PINs.

Stop conditions: any unexpected sound or behaviour -> stop listening and set the setting to off; nothing in this feature can send audio or a command
to the station, so stopping is always safe.

## Not done / open

- The WisKey downlink (their side). The adapter is the only file that changes.
- Incoming audio together with the operator's own talk (echo handling) - to be observed in the shared session, not designed blind.
- No recording by design; if the owner ever wants it, that is a separate decision.
