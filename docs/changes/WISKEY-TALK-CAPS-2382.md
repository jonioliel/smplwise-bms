# WISKEY-TALK-CAPS-2382 - station video and talk from WisKey rc.10 through its signed capabilities

Branch `pilot/WISKEY-TALK-CAPS-2382`, cut from `origin/release/2382-train` @ `b308cf54c` (which already holds WISKEY-TALK-DIAL-2382 and
WISKEY-RC10-PIN-2382). Target release: 2.38.2 (activation). Not merged, no tag, no version bump. Fakes and mocks only: no lab, WisKey,
station, Home Assistant or go2rtc contact.

## 1. The problem (lab 03.11, WisKey 2.0.1-rc.10)

- `intercom_media.provider_for` selected WisKey's signed W10 provider only when `w10.listed(overview.api.commands)` saw the W10 video
  commands. On rc.10 that list (258 commands for the paired service user) never contains any of the six W10 commands.
- rc.10 does offer them: in the signed `direct/capabilities` of the direct WebSocket (`/api/hikvision_intercom/arx_bridge/v1/ws`) and for
  the paired bridge identity (WISKEY-RC10-PIN-2382 section 5 item 1, `rc10-extract/surface.static.json` `overview_api_projection`).
- So with "WisKey (וידאו ודיבור)" chosen, Arx stayed on its own video-only source, and talk was never available.

## 2. The design

### 2.1 Two discovery sources, one listing (`intercom_media.listing`)

- **The overview first** (the feed's `overview.api.commands`, no I/O), exactly as before. When it lists both video and talk, nothing else
  is read and nothing changes against 2.38.0.
- **When the overview lacks video or talk** (and its contract is compatible), WisKey's **signed `direct/capabilities`** is the second
  source. "Listed" is the overview OR the signed document. The overview may list video only and the signed document talk.
- An incompatible overview contract (`api_incompatible`) is still a hard stop: the signed document is not read.
- The one listing feeds every decision: `provider_for`, `WiskeyBridgeProvider.listed` (its `_describe` keeps or strips talk; `talk_open`
  re-checks), `readiness` and `talk_gap`.

### 2.2 The signed source (`services/wiskey_media_caps.py`, new)

The document comes from exactly one of three places, in this order:

1. **The cache.** `TTL_S` = 300 s after a read; `FAIL_TTL_S` = 60 s after a failed one. An entry belongs to a marker: an in-memory HMAC
   fingerprint of the pairing key (per-process random salt; the key itself is never stored, logged or served) and the
   `access.station_media_provider` value. A re-pair, restore or rotation, or a provider change, makes the entry stale at once.
   `invalidate()` also drops it (called by `set_provider`).
2. **The direct join, when it is up.** If `wiskey_direct_join.installed()` is configured and its session's
   `transport_refusal(None)` is None (connected, not stopping, discovery read on THIS connection, `direct/time` admitting Arx's window),
   the listing is taken from `session.discovery.capabilities`. No I/O, no signed frame, no nonce.
3. **A one-off signed read.** A new direct socket (`DirectApiTransport.connect`: hello, signed `direct/connect`, verified service
   identity), then `direct/capabilities` and `direct/time` with `parameters = {}` through WKR5-295's closed reader (`DirectDiscovery`),
   then the socket closes. The whole read is bounded by 8 s.

Rules:

- **Signed only.** Without a pairing key that signs (absent, unreadable, rotated) nothing is read and nothing is cached. There is no
  unsigned path: the overview stays the only unsigned source, as before.
- **Each nonce is spent once, with no replay.** The three signed frames of a read are each built afresh by the existing signer (own `ts`,
  random nonce). Nothing is retried or re-sent. A failed read is cached as `unread` with its reason for `FAIL_TTL_S`. The next read builds
  new frames on a new socket.
- **Never on an event loop thread.** There the caller gets the cache, or nothing. One read at a time per process; a caller waiting for it
  takes its result.
- **The clock.** A time observation that does not admit Arx's signing window is `unread` (`clock_skew` / `ttl_exceeds_server_max`). A W10
  command could not be admitted then, so the listing is not used.
- **Grants nothing.** The document decides only whether W10 is listed for Arx. Every W10 command still leaves signed through
  `WiskeyBridgeProvider` (AutoTransport), and a failed per-station answer still falls back to Arx's own source (REL2140 M-3), unchanged.

### 2.3 Where the signed read can happen

| Caller | Reads? |
|---|---|
| `provider_for` (choice `auto`) | yes (cache, then join, then one read) |
| `provider_for` (choice `local`) | no |
| `talk_gap` with Arx's own source chosen | no (the choice is checked before readiness now) |
| `GET .../station-media/readiness` (system administrator) | yes, also for `local`, so the row can tell whether switching would help |
| `WiskeyBridgeProvider.talk_open` (no connection) | cache only |

## 3. The readiness endpoint and the talk reasons

`GET /api/v1/access-control/station-media/readiness`. The top-level keys are unchanged.

- `missing` gets a new closed code: **`capabilities_unread`**. The overview lacks W10 and the signed read failed. What is missing is then
  unknown, so it is not reported as "not listed".
- **`video_not_listed` / `talk_not_listed` are now precise:** listed in neither the overview nor the signed capabilities. They are said only
  on evidence: the signed document was read, or the overview lists both.
- Without a key that signs, the signed document is not consulted. `pairing_missing` / `pairing_key_rotated` is then the reason, with no
  claim about what is listed. Before, "not listed" was also reported in that case.
- `wiskey` gains:
  - `listed_in`: `overview`, `capabilities` or null.
  - `capabilities`: `{state, video_listed, talk_listed, reason, reason_kind, source, read_at}`.
    - `state` is one of `not_needed` (the overview lists both), `not_read` (no key that signs), `read`, or `unread`.
    - `reason` is the rule code of a failed read, for example `direct_connect_refused`, `discovery_refused:Unauthorized`,
      `direct_unreachable`, `clock_skew` or `read_timeout`. It is never a value.
    - `reason_kind` groups the reason: `unreachable`, `refused`, `clock`, `incompatible` or `failed`.
    - `source` is `join` or `read`.

`talk.reason` of `GET .../stations/{id}/media`:

| reason | when | drawer text |
|---|---|---|
| `not_listed` | **narrowed**: listed in neither source (or an incompatible contract) | מערכת האינטרקום לא מפרסמת פקודות דיבור ל-Arx |
| `capabilities_unread` | **new**: the overview lacks talk and the signed read failed | לא ניתן היה לבדוק מול מערכת האינטרקום אם דיבור זמין; מוצג וידאו בלבד |
| `pairing` | now also when the overview lacks W10 and no key signs (was `not_listed`) | unchanged |

The order of `talk_gap` for Arx's own descriptor with `auto` is: `wiskey_unavailable` (feed unreachable), `pairing`, `capabilities_unread`,
`not_listed`, then `wiskey_unavailable`. For WisKey's descriptor it is: `not_listed`, `capabilities_unread`, then `unsupported`.

The Settings row ("מקור הווידאו והדיבור") names the failed check with its reason in plain Hebrew, for example:
"חסר למצב WisKey: בדיקת היכולות החתומה מול WisKey נכשלה (WisKey דחה את החיבור החתום)". The rule code stays in the API answer. The drawer
never names the integration.

## 4. Files

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_media_caps.py` (new) | the signed source: cache, join shortcut, one-off signed read, reason kinds |
| `smplwise_vms/backend/smplwise/services/intercom_media.py` | `Listing` + `listing()`; `provider_for`, `WiskeyBridgeProvider.listed/_describe`, `readiness`, `talk_gap`, `READINESS_CODES`, `set_provider` |
| `smplwise_vms/backend/smplwise/routers/intercom_media.py` | docstrings only (first lines unchanged, so the API inventory is unchanged) |
| `smplwise_vms/backend/tests/test_wiskey_talk_caps_2382.py` (new) | 27 tests on the fake direct server + fake station |
| `smplwise_vms/backend/tests/test_station_media_readiness_2382.py` | the signed listing scripted in its fixture; new cases; two expectations follow the precise meaning |
| `frontend/src/api/station-media.ts` | `capabilities_unread` in `READINESS_CODES` and `TALK_REASONS`; `StationMediaCapabilities`, `CAPS_REASON_KINDS`, `capsReasonKind` |
| `frontend/src/i18n/wiskey-station-media.ts` | Hebrew and English: the drawer reason, the row code, the five reason kinds |
| `frontend/src/screens/system-access-display.ts` | the row fills `{kind}` of the new code |
| `frontend/tests/unit-wiskey-talk-caps-2382.spec.ts` (new) | node-only unit spec |
| `frontend/tests/evidence-wiskey-talk-caps-2382.spec.ts` (new) | runner browser spec: the drawer and the Settings row in the three states |

**`wiskey_direct_join.py` is NOT edited.** The join is read only, through `installed()`, `configured()`,
`session.transport_refusal(None)`, `session._link` and `session.discovery`. All of these exist in the train, and
WISKEY-JOIN-LIVE-2382 keeps them: its stop makes `transport_refusal` return `join_stopped`, so a stopping join is never used.

No `management/tasks.json` edit (other agents edit it concurrently; the lead records the task).

## 5. Tests

RECEIPTS_PLACEHOLDER

## 6. Known limits

- **Not run against a real WisKey.** The rc.10 shape of `direct/capabilities` is taken from WisKey's source (RC10-PIN extract). The fake
  direct server answers in WKR5-295's shape.
- **The time of a one-off read.** A one-off read blocks the calling request thread for at most 8 s. That happens once per TTL, or once per
  60 s while WisKey's socket is unreachable. While the join is up, its document is used instead and there is no wait.
- **A key change while the join is up.** The join's document is used only while the join is configured. A re-pair while the join is still
  on the old key's socket is cleaned up by WISKEY-JOIN-LIVE-2382's restart, within its debounce. Until then, that document can answer for
  the new key's marker.
- **The talk-open re-check has no database connection.** It reads the latest cached entry whatever its marker. The selection just before it
  (`provider_for` with a connection) checked the marker.
- **Not listed until WisKey answers it.** Q-WK-2 (list W10 in the overview for the paired service user, or confirm `direct/capabilities` is
  the discovery to use) stays on the WisKey prompt. This branch works either way.

## 7. Rollback

Revert the branch's commits. The overview path is untouched, so a revert restores 2.38.0's behaviour: rc.10 stays video-only from Arx's own
source. There is no data, setting or migration to undo.
