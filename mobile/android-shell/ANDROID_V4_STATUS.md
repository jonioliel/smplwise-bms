# Android v4 — implementation and verification

Task: Android parity with the v4 mobile handoff, 2026-10-05.
Branch: `pilot/android-sensors-push`. The ZIP contained no Git history; `main` is a local import baseline, not the upstream repository. All implementation changes are confined to `mobile/android-shell/`. No iOS or Arx source was changed and no real Arx server was contacted.

## Stage status

| Stage / item | Status | Evidence and limit |
|---|---|---|
| 1. Contract client, registration, encrypted tokens, notice, per-server choices and required gate | BUILT | Session and device credentials are separated; redirects rejected; server `/presence/gate` controls access. All eight rows, Select All and Clear All; server notice only. |
| 1. Contract mock | BUILT | Copied the existing iOS fixture into Android tools, then added Android platform support, precise invalid-token errors, device isolation, message expiry, atomic validation and chronological location state. The iOS fixture itself is untouched. |
| 2. Location fixes and geofences | BUILT | Google Fused Location and Geofencing. A location foreground service starts only from the visible app after opt-in; a persistent notification identifies sharing. Background permission is a separate settings step. |
| 2. Battery and activity | BUILT | Sticky battery status, derived/throttled values, Activity Recognition transitions and per-server fan-out. |
| 2. Real background location/activity and OEM power management | NOT_RUN | Requires a physical Android phone. Emulator UI tests do not establish delivery or battery behaviour. |
| 3. FCM token lifecycle, relay registration, category preferences and full-text fetch | BUILT | FCM data service, generic notification followed by WorkManager fetch of `notifications/app/{message_id}`, same stored server/device token only; expedited fetch on API 31+, ordinary scheduled work on API 26–30; private lock-screen content; validated stored-server deep links. |
| 3. Real FCM delivery, token rotation and Doze | BLOCKED / NOT_RUN | Owner says a Firebase project must be created. No Firebase configuration or approved production relay URL was supplied. Physical phone validation under Doze remains NOT_RUN. |
| 3. Production push-to-origin mapping | BLOCKED | Final contract omits the binding between relay payload `server` and the saved origin. Unknown/ambiguous IDs are dropped. Only the loopback fixture has a clearly documented extra `server_id` field. |
| 4. Steps | BUILT | Step counter, per-server deltas, minimum 5-minute interval. Foreground only; Android counter does not provide iOS pedometer floors. |
| 4. Altitude | BUILT | Barometer pressure converted to relative change, minimum 5-minute interval. Foreground only. No barometer => unavailable, not a fabricated GPS reading. |
| 4. Network / hashed Wi-Fi | BUILT | Network interface and salted UTF-8 SHA-256 per site/server; raw SSID is never sent or persisted. SSID may be unavailable/redacted. Foreground only. |
| 4. Beacons | BUILT | Filtered iBeacon manufacturer/UUID scan, configured sites only, 10-second foreground scan windows, derived proximity only. No unrestricted BLE discovery or MAC reporting. |
| 4. App state | BUILT | Process lifecycle and bounded heartbeat; foreground/background state. |
| 4. Physical SSID, barometer, step counter and beacons | NOT_RUN | Emulator checks cannot prove actual sensors, permission/OEM variations or ranging accuracy. |
| 5. Debug APK | BUILT | 2.1.0 / versionCode 4, `com.smplwise.arx.app`, SDK debug signing. This is a mock build, not a release-signed distribution. |
| 5. Release / Play distribution | BLOCKED | Release signing material and Firebase/relay setup not supplied; background-location and foreground-service declarations/review not submitted. |

## Contract and platform differences

1. The final contract overrides the Android addendum's sentence saying the app never registers with the relay. Implemented: `POST <relay>/v1/register` with FCM token, then `POST notifications/devices` with **relay token only** per server.
2. `required_sensors` is an object `{enabled,sensors}`, not a draft array. `/presence/gate` is authoritative: exemptions, administrators, web coverage and break-glass are not guessed from local roles. Status is sent before the session is checked again; the page reloads when a blocked gate clears.
3. Production config has no `server_id` mapping. The fixture extension is used only to demonstrate routing; this is not silently treated as an implemented production contract. Quiet-hour fields are also absent: server-side authorization/muting/expiry remains authoritative, with local category mutes applied before display. There is no invented local quiet-hours schema.
4. The published mobile document specifies the presence gate in `/me` but not the existing identity field shape. The bridge does not trust a page-supplied identity: the client reads `/me` and accepts `user_id`, `id`, or `user.id`. The mock explicitly supplies synthetic `user_id`; actual integration must confirm the existing `/me` profile shape. Missing identity fails closed.
5. On API 26–28 Activity Recognition uses the Google Play services manifest permission; API 29+ uses the Android runtime permission. Activity transitions expose enter/exit, not the iOS motion confidence score. Android sends `confidence: unknown`; no score is invented. They also require working Google Play services, as do Fused Location/geofencing; unsupported phones are labelled unavailable. UnifiedPush is not implemented.
6. Barometric height is a relative change and not proof of a floor. A pressure sensor is required in this version. Step counter reports deltas, not floors; no Health Connect or health-record permissions were added.
7. Bluetooth scan derives presence, so the app does **not** assert `neverForLocation`. Android 12+ Bluetooth permissions and location are requested only when beacon sharing is chosen. Wi-Fi uses the connectivity/Wi-Fi information APIs; `NEARBY_WIFI_DEVICES` is not requested for unrelated Wi-Fi connection-management operations. SSID still requires fine location and may be redacted.
8. Sensor `value` is only defined as a flat object by the final contract; battery/network/altitude names are aligned with the local iOS implementation (`level_percent`, `charging_state`, `low_power_mode`, `network`, `ssid_hash`, `relative_change_m`). Extra `floors_available: false` explicitly describes the Android step-counter limitation. These value semantics need server confirmation for downstream automations.
9. Optional step/altitude/network/beacon collectors run while the app is foreground. Activity transitions, battery callbacks and the opted-in location service use their supported mechanisms. No exact alarms, boot-started service or blanket battery exemption was added. WorkManager maintenance runs at a minimum 15-minute interval and may be delayed by Doze/OEM restrictions.
10. Config is refreshed on resume and every minute while foreground or a location service is running. Collection stops when its cached config is older than five minutes. This conservative offline behaviour prevents prolonged collection against stale allow/notice settings, but reduces offline collection while the server is unreachable. An encrypted unsent queue is bounded to 200 events / 24 h, 50 per request, filtered against current choices before retry.
11. The schema has no availability field for a required sensor absent from the phone. The native gate stays blocked and tells the user to contact the system administrator; it never claims that absent hardware is enabled.
12. App sign-out keeps the device registration, disables local sharing and drops queued events, as specified by the later mobile handoff. Pushes are not shown while signed out. Removing the server forgets local credentials; explicit “remove device” calls server deletion first. Choosing a different user requires explicit re-registration and never transfers the old token.

## Verification and evidence

See `evidence/v4/RESULTS.md` for final commands, counts, screenshots and limitations. Logs and test result summaries contain fixture data only. No production credentials or Google configuration are committed.

The package lacks the broader master spec, identity/RBAC document and management task catalogue referenced by its root AGENTS.md. The explicitly requested mobile contract/handoffs define this work; no HA roles, authentication backend, Arx implementation or upstream task records were invented.

## Rollback

The imported Android sources are on local branch `main`. Review the Android diff against that branch. Keep the new branch until reviewed; merge has not been performed. A production Android update must have a monotonically increasing versionCode and the same publisher signing key. Downgrading this debug build is a development-device procedure and may lose local data; no uninstall/downgrade was performed on a physical phone.

## Primary platform references

- [Android background location permission](https://developer.android.com/develop/sensors-and-location/location/permissions/background)
- [Foreground service types and restrictions](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [FCM Android setup](https://firebase.google.com/docs/cloud-messaging/android/client)
- [FCM priority and short handler lifetime](https://firebase.google.com/docs/cloud-messaging/android/message-priority)
- [Wi-Fi permissions](https://developer.android.com/develop/connectivity/wifi/wifi-permissions)
- [Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)
- [Android motion sensors](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion)
