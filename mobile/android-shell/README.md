# SmplWise Arx for Android - own-WebView shell

An Android app for SmplWise Arx remote access (CR-008 §9) that renders the site in **its own WebView**: no browser, no
address bar or browser toolbar ever, no Digital Asset Links, no Google Play services, no Firebase. It replaces the
Trusted Web Activity trial app (branch `pilot/CR008-android-twa`, directory `android/`, package `com.smplwise.arx`),
which opens the site in Chrome and shows Chrome's toolbar whenever a site's asset links do not verify.

Operator and customer guide in Hebrew: `docs/operations/ARX_ANDROID_SHELL_HE.md`.

| | |
|---|---|
| Package id | `com.smplwise.arx.app` (not the TWA's, so both install side by side during the trial) |
| App name / version | SmplWise Arx, versionName `2.0.2`, versionCode `arxVersionCode` (3) |
| Screens | `ServersActivity` (launcher: the server list and the app's settings), `WebActivity` (one server, full screen) |
| Toolchain | AGP 8.9.1, Kotlin 2.2.0, Gradle 8.11.1 (wrapper, checksum-pinned), compileSdk 36, targetSdk 35, minSdk 26, JDK 17 |
| Libraries | `androidx.webkit` 1.14.0, `androidx.biometric` 1.1.0, `androidx.core:core-splashscreen` 1.0.1, `androidx.activity` 1.10.1, `androidx.appcompat` 1.7.0, Material Components 1.12.0 - nothing else |

## Why a plain Kotlin app and not Capacitor

Both were considered (CR-008 §3d named Capacitor for "later"). For **this** product the plain native app is the more
robust choice:

1. **The content is a remote site chosen at run time, several per phone.** Capacitor is built around web assets bundled
   in the APK and served from its local origin; a remote site is loaded through `server.url`, which its configuration
   documentation describes as intended for live-reload development, and which is fixed per build - switching between
   customers' servers at run time would mean fighting the framework. Here the URL is simply an argument of the activity.
2. **The page must get almost nothing from the app.** Capacitor's bridge injects its plugin interface into the page it
   loads; with a remote page that means every installed plugin is reachable by whatever that server serves. This app
   exposes exactly one frozen object (`window.ArxApp`: `platform`, `shell`, `version`, `switchServer()`), only to the
   selected server's origin, through `WebViewCompat.addWebMessageListener` + `addDocumentStartJavaScript` - the
   WebView itself refuses to inject them into any other origin, and every message is checked again in Kotlin.
3. **Every WebView hook this product needs is a few lines of Kotlin** (navigation scope, WebRTC microphone permission,
   full-screen video, downloads with the session cookie, file uploads, error screen, insets), with no JavaScript
   toolchain, no npm dependency tree in the APK and no plugin versions to track.
4. **Reuse.** The TWA branch's server list (`ServersActivity`, `ServerUrls`, `ServerStore`, `ServerCheck`) is Kotlin and
   carried over almost unchanged, with its security review applied.
5. **Size:** the signed release APK is about 2 MB.

What Capacitor would have given - one code base with iOS - does not apply yet: iOS is postponed (owner, 2026-09-29), and a
future iOS app is again a thin `WKWebView` shell around the same site.

## What the app does

### Servers (ported from the TWA branch)
- First start: the list with "הוסף שרת" open. Name ("שם לתצוגה") and address ("כתובת השרת", helper "הכתובת שקיבלת ממנהל
  המערכת, לדוגמה: site.example.com").
- Addresses are normalised by `ServerUrls.normalize`: no scheme, `http://` (upgraded to https silently), `https://`, with
  or without a path or a trailing slash, a full link copied from the browser, internationalised host names (stored as
  punycode). Refused: any other scheme (`javascript:`, `intent:`, `ftp:`...), credentials in the address (including
  `good.com:443@evil.com`), backslashes, whitespace, dot segments (also `%2e%2e`), invalid ports.
- Saving checks `GET <url>api/v1/auth/remote-config` (6 s overall deadline, DNS included). An address without a path
  is tried at `/arx/` first, then at the site's root; the site's own `remote_path` corrects the stored path. A failed
  check warns and offers "הוסף בכל זאת" - never blocks (the phone may be offline).
- Stored in SharedPreferences: names, addresses, "פתח אוטומטית", the app-lock settings, the last server used (marked
  "שימוש אחרון" in the list). No credentials. Backups and device transfer exclude everything
  (`allowBackup=false`, `data_extraction_rules.xml`).
- "פתח אוטומטית" (default on) with exactly one server: the icon opens it directly. Tapping the icon while the app runs
  returns to the open site instead of reloading it.

### Moving between servers
- Inside the site: "החלף שרת" in the user menu (avatar), on the sign-in page, and in הגדרות › גישה מרחוק (shown only
  inside the app).
- Back at the site's first screen opens a small sheet "יציאה / שרתים".
- Long press on the app icon: shortcut "שרתים".
- Two fingers swipe up inside the site opens the server list (like the Home Assistant app). Setting "מחווה לרשימת השרתים"
  on the server list: off / anywhere (default) / from the bottom quarter only. Never consumes the touch (page scroll and
  zoom are unaffected); needs >= 120 dp of vertical travel within 0.7 s, no pinch, no third finger; ignored while locked.
- After the first server opens, a one-time hint: "להחלפת שרת: התפריט של המשתמש › החלף שרת".

### The site (`WebActivity`)
- **Navigation scope** (`NavPolicy`, unit-tested): top-level navigation stays in the app only on the selected server's
  origin and under its path (no `/auth/` exception: the Arx sign-in talks to those endpoints with fetch). Paths are
  parsed and dot segments (plain or percent-encoded) are never in scope. Anything else on the
  web - other hosts, the same host outside the Arx path (e.g. the WisKey "full window" link), `http:` - opens in the
  system browser; `mailto:` / `tel:` go to their apps; `javascript:`, `intent:`, `file:`, `content:`, `data:` and unknown
  schemes are dropped. `target=_blank` and `window.open` go through the same decision (a throwaway WebView learns the
  URL, never fetches anything and is destroyed within 2 s; nothing opens a second window). Without a user gesture the
  page can hand at most one link to the system every 10 s. Subframes (the same-origin WisKey panel) follow the page's
  own CSP.
- **Second check on every main document:** `shouldOverrideUrlLoading` never sees POST navigations (a form with
  `target=_top`), back / forward or a restored state. So a main-frame request outside the server's Arx pages gets an
  empty 403 from `shouldInterceptRequest` (it never reaches the network), and `onPageStarted` / `doUpdateVisitedHistory`
  stop any such document and go back, or show the "outside the server" screen (`NavPolicy.mayShow`). The bridge answers
  only while the page shown is an Arx page, and the injected script does nothing off the server's path (the same origin
  also serves the platform's own UI at `/`).
- **Hardening:** no `addJavascriptInterface`; file and content access off; universal/file-URL access off; mixed content
  never allowed; Safe Browsing on; cleartext off and only system CAs (`network_security_config.xml`); third-party cookies
  off; geolocation refused; certificate errors are never bypassed (the error screen says so); WebView debugging only in
  debug builds; WebView usage metrics opted out; no task affinity (`taskAffinity=""`, no other app can slip an activity
  into the app's task); taps through another app's overlay are ignored on the add-server, link and lock buttons; the site
  screen opens only a stored server; bridge messages are parsed off the main thread (10 MB cap); a renderer crash
  restarts the screen at most once per 30 s.
- **Sessions:** cookies and localStorage are the WebView's, per origin, on disk. `CookieManager.flush()` on every page
  load and on pause. Arx keeps its sign-in (the refresh token) in localStorage (`arx.auth.v1`) and exchanges it for the
  `__Secure-arx_session` cookie (SameSite=Strict, Path=/arx/, at most 30 min); after an app restart the page resumes
  from localStorage exactly as a browser tab does. With the server setting `remote.session = browser_session` the tokens
  are in sessionStorage and a new app process asks for the password again. Sign-out inside works unchanged.
- **Video:** WebRTC playback needs no permission. `onPermissionRequest` grants only the microphone
  (`AUDIO_CAPTURE`, two-way audio) and only to the server's origin, after Android's own RECORD_AUDIO prompt; camera, MIDI
  and protected media are refused. `mediaPlaybackRequiresUserGesture = false` (muted live tiles start by themselves),
  hardware acceleration on, full-screen video through `onShowCustomView` (system bars hidden, screen kept on, Back
  leaves full screen). Rotation does not recreate the WebView (`configChanges`).
- **Downloads:** every file goes through the system's "save as" first. Files on the server (evidence exports, backups)
  are then fetched by the app itself (`HttpURLConnection`, never Android's DownloadManager, which would keep the session
  cookie in the system's download database and send it again on every redirect hop): the server's cookie for that URL,
  redirects followed only to the server's own Arx pages (at most 5), the file streamed to the chosen place, a failed
  download removed. Files the page builds itself (`blob:` URLs - the audit CSV, plan JSON, 3D export) are handed over by
  the injected script (up to 10 MB; it keeps only the 16 most recent Blobs, 2 minutes each). Android packages (`.apk`)
  are never saved. **Uploads** (plan PDFs, restore ZIPs, bundles) open the system file picker with the MIME
  types of the page's `accept` list.
- **Look:** Android 12 splash (the icon on the brand blue), the same picture as the web screen's window background until
  the page paints; edge-to-edge - the status-bar strip takes the page's `<meta name="theme-color">` and the navigation
  bar the page's background (read after each load and route change; icon contrast chosen by luminance, as Chrome does);
  on WebView 140+ the bottom and side insets reach the page as the standard `env(safe-area-inset-*)` (the Arx bottom
  navigation already pads with it), on older WebViews the app pads the WebView itself because those versions report
  wrong values (InsetPolicy); the keyboard shrinks the page. A progress bar while loading.
- **Errors:** a Hebrew screen for no connection, server not found / remote access off (404), no answer, TLS failure,
  server or tunnel errors (5xx, Cloudflare 52x/530) and a redirect off the server, with "נסה שוב" and "שרתים".
- **User agent:** the WebView's own plus `SmplWiseArx/<version> (Android app)`, so the server's sessions list can tell
  the app from a browser.

### App lock ("נעילת האפליקציה")
Off by default; switched on in the server list (the phone confirms the user first; switching it off does too). When on,
the phone's fingerprint / face / screen lock (`androidx.biometric`, `BIOMETRIC_WEAK | DEVICE_CREDENTIAL`) is required on
every cold start and after 0 ("מיד"), 1, 5, 15 or 60 minutes away (`LockPolicy`, unit-tested). The time away is always
counted; leaving through the app's own file picker, "save as" or microphone prompt waives only the first 30 s. Once
shown, the lock stays until the phone confirms the user (cancelling the prompt keeps it). While locked: a cover hides
the whole window; in every frame of the server's origin - the WisKey intercom panel the Arx page frames included -
audio and video pause, microphone / camera tracks stop, audio contexts are suspended, and play() and getUserMedia are
refused until the unlock (nothing resumes by itself afterwards: the page decides); open dialogs and the server's ⋮
menu close, new ones (a link's "add this server?", add / edit / delete) wait for the unlock, and the page's own
alert / confirm / prompt are cancelled; Back only moves the app to the background; permission requests, file pickers,
downloads and bridge messages are refused. The recent-apps thumbnail is blank while the lock is on
(Android 13+ `setRecentsScreenshotEnabled`, older `FLAG_SECURE`). The app switches its lock off only when the phone has
no screen lock or biometrics at all any more (it says so); any other "cannot authenticate now" keeps it locked with
"נסו שוב".

### Deep links
- `arx://servers` - the server list.
- `arx://open?url=https://<server>/arx/#/...` - opens the link only when it lies on a stored server and is the app's
  entry page with its query and `#` route (parsed, rebuilt from its parts on that server's origin; an API path or a file
  is refused). When a site is already open the list asks first ("לפתוח את הקישור?" - it may be an intercom call). A
  link to any other address is never opened or added by itself: the list shows the **full address** with the warning
  "הוסף רק אם אתה מכיר את מי שמפעיל את השרת" and "הוסף שרת".
- Plain `https://` links (for example from WhatsApp or e-mail) open in the browser, not in the app: the app declares no
  verified https links, because the servers are known only at run time.

## Notifications - not in this version

Android's WebView has **no Web Push** (no `PushManager`); the notifications screen inside the app says so and points to
Chrome. The PWA in Chrome and the TWA keep Web Push, which also travels through an external service - the browser
vendor's push service (FCM for Chrome). Two ways to give this app notifications later (owner decision pending):

| | (i) Firebase Cloud Messaging | (ii) Foreground service with a WebSocket |
|---|---|---|
| How | The Arx server asks a SmplWise push relay to send a content-less "wake" message; FCM wakes the app; the app fetches the alert from the Arx server itself | The app keeps a WebSocket to each Arx server open in a foreground service; the server sends alerts over it |
| External service | Yes: Google's FCM (a free Firebase project) and a small SmplWise relay holding its credentials (they cannot ship in every customer's add-on). Google sees that a device is woken, not what happened | None |
| Works when the app is closed / phone asleep | Yes - FCM is the only mechanism Android gives a sleeping app without a constant connection of its own | Only while the service runs |
| Cost on the phone | None beyond Google Play services, which the phone already runs | A permanent notification icon, battery use, and some vendors' battery savers (Xiaomi, Huawei, Samsung and others) kill it anyway |
| Store / review | Normal | Google Play restricts foreground-service types; a sideloaded app is unaffected |

## Seen running (emulator, 2026-09-29)

Headless Android 13 emulator (AOSP `default` x86_64 image, Android System WebView 101, no Chrome installed), the debug
APK, local fixtures reached through `adb reverse`: the real backend with the remote channel on, and
`frontend/tests/fixtures/arx_fake_ha.py` (fake Home Assistant core) behind a small proxy that plays the tunnel (`/auth/*`
to the fake HA, the rest to the backend). Seen, with screenshots or DevTools checks:

- first start with "הוסף שרת" and the owner's wording; the reachability check passing, the unreachable warning with
  "הוסף בכל זאת", `http://127.0.0.1:8111` probed to `/arx/`; two servers with "שימוש אחרון"; auto-open with one server;
- the site full screen with **no browser UI of any kind** (there is no browser on that image at all), the status bar in
  the site's theme colour; `?app=android` removed from the address; `window.ArxApp` present, frozen, with exactly
  `platform`, `shell`, `version`, `switchServer`; the user agent suffix; no install banner;
- "החלף שרת" on the sign-in page opening the native list; Back at the first screen → the "יציאה / שרתים" sheet; the
  one-time hint;
- navigation: `https://example.com/...` and `http://<server>/lovelace/0` handed to the system browser app while the
  page stayed on `/arx/`; `intent:` dropped; `window.open` to another site → browser, to `/arx/#/kiosk/all` → the same
  WebView; no leftover popup WebView (a leak found and fixed here);
- a real sign-in (fixture user) → the map; `api/v1/me` answering `source: remote`; after Home + force-stop + relaunch
  the app resumed **signed in** without the sign-in page (localStorage + cookie kept);
- `arx://open` to an unknown server → the full address and the warning; to the stored server → `#/live` opened;
- the error screen ("השרת לא עונה") on a first load with the server down, "נסה שוב" recovering; with the service worker
  installed, the P3 worker's cached shell answers offline instead (by design);
- app lock with the emulator's screen-lock PIN: switching on needs the PIN; "מיד" → leaving and returning shows the
  cover and the phone's prompt ("פתיחת SmplWise Arx"); the PIN unlocks.

Found on WebView 101 and not the app's fault: the site's CSS needs `color-mix()`, `dvh` and `:has()`, so the page
rendered with wrong colours and a short layout - the app now shows a notice on WebView < 111. Not explained: after the
soft keyboard had been used, a grey dim covered this app's window (not other apps) and survived a force-stop, with no
overlay in the app's view tree or window list; treated as an emulator window-manager artifact until a phone shows it.

### Security review round (2.0.1), seen on the emulator

Same emulator and fixtures; the tunnel stand-in also served test routes (a file, an in-scope redirect, an `.apk`, a
landing page outside `/arx/`) and logged every request with its Cookie and User-Agent.

- **M1:** a POST form with `target=_top` to `/__test/landing` (same origin, outside Arx) submitted from the page: the
  request never reached the network (nothing in the proxy log), the page stayed on `/arx/`. A POST to another origin was
  already refused by the site's own CSP (`form-action 'self'`).
- **M2:** a download link → "save as" (DocumentsUI) → the file (2000 bytes) fetched by the app itself (the app's user
  agent, the page's cookie); the system download database has no request headers. An in-scope redirect: the WebView
  resolved it before handing the URL over, then the same in-app fetch. The `.apk` link opened no picker (refused). The
  redirect-hop rule itself is covered by unit tests only.
- **M3:** lock on ("מיד"), app sent home, `arx://open` for an unknown server: the phone's prompt and the cover, no offer
  dialog; cancelling the prompt kept the cover (this first **failed** - the lock's own credential screen counted as an
  excursion and unlocked the app; fixed, unit-tested); a tap on the add button under the cover did nothing; Back moved
  the app to the background; after the PIN the held-back offer dialog appeared.
- **M5, incidentally:** returning from the "save as" picker after more than 30 s with "מיד" asked for the PIN.
- The emulator's software GPU hung the app's render thread once while switching windows (an ANR in
  `HardwareRenderer.pause`, no app code on the stack) - an emulator artifact like the grey dim above.

### Re-review round (2.0.2), seen on the emulator

- **Media behind the lock:** a same-origin iframe outside `/arx/` (standing in for the WisKey panel) had the media
  guard and no `ArxApp`; with the app locked, play() and getUserMedia were refused there and in the main page, and a
  guessed token could not lift the guard; after the PIN both frames were unlocked.
- **Server-list stacking:** `ArxApp.switchServer()` twice and `location.href = 'arx://servers'` without a gesture did
  nothing (the server list opens only after a tap).
- **JS dialogs:** the page's `alert()` appeared as the app's dialog titled "Fake HA" with "אישור".
- Not seen on the emulator: a real microphone call (the emulator has no audio here) and the two-task restart case
  (item 4; covered by code review only).

## Known limits
- No push notifications (above).
- **Not seen yet** (needs a phone and the lab): WebRTC video and two-way audio, full-screen video, downloads and
  uploads, the splash on Android 12+, insets on a real WebView 140+, the `__Secure-arx_session` cookie over https
  through the real tunnel.
- The WisKey "full window" link and any other page of the same host outside the Arx path open in the browser (which has
  its own sign-in).
- Cloudflare Access (D3) in front of `/arx` redirects to another host, which the app does not open inside; the error
  screen explains it. A future build could add an allow-list.
- The site itself needs a current Android System WebView (111+); older ones get a notice to update it.
- The page's `alert()` / `confirm()` / `prompt()` show as the app's dialogs, and "החלף שרת" from the page reacts only
  to a tap.
- The page-facing interface and blob downloads (files the page builds) need a WebView that supports the
  `WEB_MESSAGE_LISTENER` and `DOCUMENT_START_SCRIPT` features (current Android System WebView releases do; an outdated
  WebView gets a Hebrew message asking to update it, and "החלף שרת" still works through `arx://servers`).
- Downloads show a toast when they start and end; there is no progress notification.

## Build settings (all optional)

`gradle.properties` or `-P...` on the command line:

| Property | Meaning | Default |
|---|---|---|
| `arxHost` | a server added once on the first start (bare hostname) | empty |
| `arxPath` | that server's path, with both slashes | `/arx/` |
| `arxServerName` | that server's display name | its hostname |
| `arxVersionCode` | integer; raise it for every APK you hand out | `3` |
| `arxVersionName` | shown in app info and as `ArxApp.version` | `2.0.2` |

## Build

Workstation prerequisites are the TWA branch's (JDK 17 Temurin, Android command-line tools, `platform-tools`,
`platforms;android-36`, `build-tools;35.0.0`, per user under `%LOCALAPPDATA%`; see that branch's `android/README.md`,
"Workstation setup"). From `mobile/android-shell/`, PowerShell:

```
$env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\Temurin\jdk-17.0.20.1+1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat --no-daemon testDebugUnitTest   # JVM unit tests
.\gradlew.bat --no-daemon assembleDebug       # app\build\outputs\apk\debug\app-debug.apk (SDK debug key)
.\gradlew.bat --no-daemon assembleRelease     # app\build\outputs\apk\release\app-release.apk (signed when configured)
```

`gradle.properties` keeps Gradle modest (no daemon, 2 workers, 1.5 GB heap): the workstation also runs the backend,
browsers and Playwright. First build ~5 minutes (downloads), later ones 2-9 minutes depending on load.

Emulator used for the smoke test (installed per user on the workstation, 2026-09-29): the `emulator` package (WHPX
acceleration, `emulator -accel-check` passes) and `system-images;android-33;default;x86_64`, AVD `arx_shell_smoke`
(1.5 GB RAM, started with `-no-window -gpu swiftshader_indirect`). The ATD images render nothing to `screencap`; use the
`default` image. On disk: about 1.1 GB for the emulator and 4.2 GB for the unpacked image
(`%LOCALAPPDATA%\Android\Sdk\emulator`, `...\system-images\android-33`); remove both with `sdkmanager --uninstall
emulator "system-images;android-33;default;x86_64"` and `avdmanager delete avd -n arx_shell_smoke` when not needed.

Debug builds also accept plain `http://127.0.0.1` (debug-only network security config and `BuildConfig.ALLOW_DEV_HTTP`),
for a smoke test against the local development backend: `adb reverse tcp:8099 tcp:8099`, then add
`http://127.0.0.1:8099/arx/` as a server. Release builds upgrade every `http://` address to https.

## Signing (release)

Point the build at a keystore with `mobile/android-shell/keystore.properties` (gitignored; `storeFile`, `storePassword`,
`keyAlias`, `keyPassword`) or the environment variables `ARX_KEYSTORE_FILE`, `ARX_KEYSTORE_PASSWORD`, `ARX_KEY_ALIAS`,
`ARX_KEY_PASSWORD`. Without either, `assembleRelease` builds an unsigned APK that Android will not install. Keystores,
their passwords, APKs and build directories are never committed (`.gitignore`). The product key is created once and kept
offline (the TWA README, "Signing", applies unchanged); this app needs **no fingerprint on the server** - there are no
Digital Asset Links.

Check a built APK:

```
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs app\build\outputs\apk\release\app-release.apk
```

## Tests

`app/src/test/` (plain JVM, `testDebugUnitTest`): `ServerUrlsTest` (the normaliser, http upgrade, candidates, link
matching, the TWA review's M1/M2/L4 cases), `WebPolicyTest` (navigation scope, schemes, subframes, the bridge's origin
check, the permission policy), `DeepLinksTest` (`arx://` parsing and routing), `ShellPoliciesTest` (app-lock timing,
insets, bar colours, error mapping, file types and names, the injected script). The web side's detection has its own
spec: `frontend/tests/unit-android-app.spec.ts`.

## Icons

`tools/make_icons.py` regenerates the launcher PNGs from the PWA icons (`frontend/public/icons/`):

```
./.venv/Scripts/python.exe mobile/android-shell/tools/make_icons.py
```

## Web side (frontend) touched for the app

`frontend/src/arx/android-app.ts` (detection: `inAndroidApp()`, `inAndroidShell()`, `switchServer()` - the TWA
branch's names), `frontend/src/arx/boot.ts`, `frontend/src/arx/arx-login.ts` ("החלף שרת" under the sign-in form),
`frontend/src/shell/sw-profile-menu.ts` ("החלף שרת" in the user menu), `frontend/src/screens/system-diagnostics.ts`
(הגדרות › גישה מרחוק: an "אפליקציית Android" card with "החלף שרת"), `frontend/src/pwa/register.ts` (no install banner or
iOS hint inside the app), `frontend/src/pwa/push.ts` and `frontend/src/pwa/notifications-settings.ts` (the app's "no
push here" explanation), `frontend/tests/unit-android-app.spec.ts`.
