# Android addendum: selectable sensors and push notifications (for Codex)

Read after `mobile/android-shell/README.md` (the existing Android shell) and the iOS handoff files in `mobile/ios-shell/`
(`HANDOFF_IOS_CODEX.md`, `HANDOFF_IOS_ADDENDUM_SENSORS_PUSH.md`, `HANDOFF_IOS_ADDENDUM_2_DECISIONS.md`). The product behaviour, strings, sensor catalogue,
the required-sensors gate and the server contract are the **same as iOS**; only the platform APIs differ. Where an iOS file says "iOS", read "Android".
The server contract is `docs/api/mobile-presence-contract.md` (it wins over every draft). Root `AGENTS.md` governs everything.

## 1. Scope (owner decisions of 2026-10-05, identical to iOS)

- All sensors in the catalogue, each selectable by the user, with "בחר הכל" / "בטל הכל"; the server decides which are allowed (`sensors.allowed`) and which are required (`required_sensors`).
- **Required-sensors gate:** a native full-screen gate over the web view until every required sensor is on and permitted (see addendum 2, section 2). Re-check on start, on resume, on permission changes and when the server config changes.
- **Push:** notifications from the servers the app is registered with, through the SmplWise relay (it holds the FCM credentials; the app never has them). Generic payload only; the app fetches the real text from the originating server with its device token (`GET notifications/app/{message_id}`).
- Strings, notice text (`notice_text` from the server, never invented legal wording) and keys: reuse the iOS keys (platform-neutral naming).

## 2. Platform mapping (suggested APIs; verify behaviour on the target Android versions and report differences)

| Sensor | Android API | Permissions / notes |
|---|---|---|
| location (geofence presence + optional periodic fix) | Fused Location Provider, Geofencing client; a foreground service of type `location` for periodic fixes | `ACCESS_FINE/COARSE_LOCATION`, then `ACCESS_BACKGROUND_LOCATION` (a separate step on Android 10+); Google Play requires a background-location declaration and prominent disclosure |
| activity (still/walking/vehicle) | Activity Recognition Transition API | `ACTIVITY_RECOGNITION` (Android 10+) |
| steps | `Sensor.TYPE_STEP_COUNTER` (or Health Connect if you prefer, report the trade-off) | same permission as activity |
| altitude | barometer (`TYPE_PRESSURE`) when present, else GPS altitude | report devices without a barometer |
| battery | `BatteryManager` sticky broadcast | no permission |
| network / Wi-Fi (hashed SSID only) | `ConnectivityManager`, `WifiManager` | SSID needs location permission; Android 13+ may need `NEARBY_WIFI_DEVICES`; hash on device, never send the SSID in clear |
| beacon (BLE proximity) | BLE scan with filters | `BLUETOOTH_SCAN` (Android 12+), foreground only unless a foreground service is justified |
| app_state | `ProcessLifecycleOwner` | no permission |

Battery/OEM background limits (Doze, app standby, vendor task killers) are the main risk: describe what you did (WorkManager, foreground service, exact alarms avoided) and what you measured; do not claim background behaviour you did not observe on a real device.

## 3. Push on Android

- FCM data messages through the relay. The app registers its FCM token with the relay through the server (`POST notifications/devices`, field `relay_token` as in the contract), never with the SmplWise relay directly.
- On a data message: show a notification with a generic title, then fetch the real text from the server (`GET notifications/app/{message_id}`) and update it; honour mutes, quiet hours and the 24 h expiry as the server returns them. Notification channels per category as in `GET notifications/categories`.
- Android 13+: runtime `POST_NOTIFICATIONS` permission with a plain Hebrew explanation.
- UnifiedPush as a fallback is optional (see `docs/changes/CR-012-ANDROID-PUSH.md`); do it only after FCM works and report the effort.
- Never commit `google-services.json`, keystores, service-account JSON or tokens. Put placeholders in the repo and ask the owner for each item when you reach it (a Firebase project, the application id, a signing keystore), in plain Hebrew with numbered questions and short lettered options.

## 4. Order of work

1. Contract client + the mock server (reuse `mobile/ios-shell/tools/mock_arx_server` if present, extended per addendum 2 section 3), settings screen "נתונים שהמכשיר משתף", the required-sensors gate.
2. Location (foreground first, then background), battery, activity.
3. FCM push + the app notification channel + the fetch-the-text flow.
4. Steps, altitude, Wi-Fi hashed SSID, beacon, app state.
5. Unit tests with the mock; instrumentation tests where feasible; a debug build.

## 5. Where it can run

The Android shell builds on Windows (Temurin JDK 17, Android SDK `build-tools;35.0.0`, Gradle wrapper; see `docs/operations/ARX_ANDROID_SHELL_HE.md`) and on a Mac with Android Studio or the command-line SDK. The emulator cannot prove background location, FCM delivery under Doze or Wi-Fi SSID: say explicitly which items need a physical Android phone and were not run.

## 6. Reporting

Per item BUILT / NOT_RUN / BLOCKED with the reason; list every API or policy that behaves differently from this file, and any contract field you need that is missing.
