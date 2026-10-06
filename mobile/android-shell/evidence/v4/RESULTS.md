# Android v4 verification — 2026-10-05

All data and origins used here are synthetic. No real Arx server was accessed.

## Environment

Intel macOS host; JDK 17.0.20.1; Gradle 8.11.1; AGP 8.9.1; Kotlin 2.2.0; compile SDK 36, target SDK 35, minimum SDK 26. Android 15 / API 35 Google APIs x86_64 emulator (`arx_v4_mock`), 320 × 640 screen. No physical Android device was used.

## Reproduction

Start `python3 tools/mock_arx_server.py --port 8099 --enabled --allowed location activity steps altitude battery network beacon app_state`, then `adb reverse tcp:8099 tcp:8099`.

```sh
python3 -m unittest discover -s tools -p test_mock_arx_server.py
sh gradlew --no-daemon testDebugUnitTest assembleDebug lintDebug connectedDebugAndroidTest -ParxPushRelayUrl=http://127.0.0.1:8099
```

The local relay URL is a debug-only fixture. It is not a deployable relay configuration. Real FCM was not exercised. Manual local notification test, API 26–30 execution and landscape layout are NOT_RUN; the source has API guards but this is not device evidence.

## Results

- JVM: 69 tests, zero failures (59 shell regression tests and 10 presence/API tests).
- Python contract mock: 11 tests, zero failures.
- Android instrumentation: 4 tests, zero failures on API 35. Tests cover required battery gate, enabling and clearing choices, changed server notice, disabled master sharing, encrypted tokens and revoked registration/queue handling. Each run uses its own synthetic user to avoid another registered device satisfying the gate.
- Lint: zero errors, 42 warnings. These include newer dependency/target suggestions, existing WebView accessibility/inflation/overdraw, KTX/style suggestions and static-context warnings. The three new singleton contexts explicitly use applicationContext; no Activity is retained. Target SDK 35 is inherited and is not proof of current Play publishing eligibility.
- `git diff --check`: passed. Changes confined to Android; no Google configuration, signing key or service-account file staged.

Visual inspection used the native registration, server notice, required gate and sensor settings. Captures 03–05 show the verified flow: registration, exact server notice and locked required gate. Capture 07 shows the recoverable duplicate-name registration error. Captures 06, 08 and 09 show sensor cards, scrolling/footer and push settings. These flow captures precede the final cosmetic header-size and dark status-bar icon adjustment; controls are inset below the status bar. The fixture notice is explicitly synthetic, not an invented production notice.

## Limits

NOT_RUN on a physical phone: background location/geofences, activity transitions, FCM under Doze, real SSID hashing/permission redaction, beacon ranging, step counter and barometer. No release signing, Play submission, production Firebase project or production relay deployment was performed. Missing relay server-ID binding remains BLOCKED in the final contract. See `../../ANDROID_V4_STATUS.md` for each stage and differences.

## Package

`artifacts/SmplWiseArx-2.1.0-debug-mock.apk` (gitignored).

SHA-256: `d83f0cbe3882c6872a7cfac5528d059050ff492830015f68930a213f6bcbd338`

The final combined build, JVM, lint and instrumented task finished successfully. `build-tests.log` and `mock-tests.log` record the final runs.

Capture `10-final-registration.png` is from the exact delivered APK after the final contrast/header adjustment.
