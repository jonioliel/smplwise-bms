# SmplWise Arx for iOS — handoff to Codex

Written 2026-10-04 for the Codex session on the owner's second computer. Read `AGENTS.md` at the repository root first
(operating contract, precedence of documents, secrets rules); this file adds what is specific to the iOS app.

**Goal.** An iPhone app that **looks and behaves like the existing Android app** (`mobile/android-shell/`), plus **one new
native capability that Android does not have yet**: on first sign-in the device is **registered in Arx under a name the
user chooses** (for example "הנייד של יוסי") and the user **grants location access**, so a later Arx screen can show
which employees are in the building.

**In scope now:** the iOS app, including device registration and location reporting.
**Not in scope now:** improving the Android app (the owner does not want to invest there now; the same feature is added
to Android later, so every contract below is platform-neutral); **the Arx map that shows people** (only the app-side
ability is built); push notifications; the server-side implementation (see §6, it does not exist yet).

---

## 1. Identity: name, logo, colours

| | |
|---|---|
| Product name (app name under the icon, `CFBundleDisplayName`) | **SmplWise Arx** (Latin, never translated; the PWA's `short_name` is "Arx", the app uses the full name) |
| Company brand | SmplWise |
| Android package (for reference) | `com.smplwise.arx.app` |
| Proposed iOS bundle id | `com.smplwise.arx.app` (same string; confirm with the owner before the App Store record is created) |
| Product language | **Hebrew, right-to-left, on any phone language.** No `values-iw` equivalent needed: Hebrew is the base/default localisation. Force RTL layout for all native screens. |
| User-facing copy rule | `docs/design/UI_COPY_RULES.md`: never write "Home Assistant", "HA", "Supervisor", "Ingress", "add-on", "Companion app" in any user-visible text of the app. Say "המערכת", "תשתית המערכת", "האפליקציה". |

### Assets (all under `mobile/ios-shell/brand/`)

| File | What it is | Use |
|---|---|---|
| `arx-ios-1024.png` | **App Store / AppIcon master**: 1024×1024, square, opaque, no rounded corners, brand blue `#2F6BFF` with the white arch-and-bar mark. Generated from `arx.svg` geometry for this handoff. | Single-size `AppIcon` in the asset catalog (Xcode 15+ "Single Size"). iOS applies the corner mask itself; do not pre-round. |
| `arx.svg` | The mark as vector (512 viewBox, `rx=112` tile). Source of truth for the mark. | Re-render if a different size/variant is needed. |
| `arx-512.png`, `arx-180.png` | The PWA icons (rounded tile, transparent corners). | Reference only; do not use as the iOS AppIcon (transparent corners are rejected). |
| `arx-maskable-512.png` | Full-bleed variant with safe zone. | Optional: launch screen centre mark. |
| `smplwise-logo.png`, `smplwise-logo.svg` | SmplWise wordmark + SW monogram, blue `#0062FF` symbol and navy `#0E3054` wordmark on transparent (PNG 1024×162; SVG is the source). | Company logo; use only on About/Settings if wanted, **not** as the app icon. |
| `smplwise-mark.svg` | The SW monogram alone, `#0062FF` (vector only; no PNG). | Same. |

The Arx mark: a white arch (an upside-down U, 72-unit stroke on a 240-unit outer width) standing on a thin white rounded
bar, centred on a blue rounded square. Dark-mode and tinted icon variants (iOS 18) may be derived from `arx.svg` (white
mark on transparent for tinted; keep blue tile for dark) but the default light icon must match Android exactly.

### Colours and look (from `mobile/android-shell/app/src/main/res/values/colors.xml` and `themes.xml`)

| Token | Value | Where |
|---|---|---|
| `themeColor` / primary | `#2F6BFF` | Navigation bar, primary buttons, the "שימוש אחרון" badge text, launch screen background |
| `backgroundColor` | `#F5F7FB` | Screen background of native screens |
| `textPrimary` | `#1B2233` | Titles, names |
| `textSecondary` | `#5B6477` | Helper text, URLs |
| `border` | `#DFE4EE` | 1 pt card outline |
| `warning` | `#9A5B00` | Warning text |
| primary container | `#DCE6FF` / on-container `#0B2A7A` | Tonal surfaces |
| surface | white | Cards |

Native screens are light, flat cards (corner radius 14, 1 pt `border` outline, 16 pt padding, 10 pt gap), a blue top bar
with white title, white-on-blue primary actions. Use SF Pro for Latin and the system Hebrew font; never a custom font.
The site itself (inside the WebView) is rendered by the web app and brings its own theme: the status-bar style and
the bottom area must follow the page (see §3.4).

Launch: the Arx icon centred on `#2F6BFF` (Android 12 splash equivalent); the first frame of the WebView screen shows the
same picture until the page paints.

---

## 2. What the Android app is (the reference to match)

Read these, in this order. They are the specification of "looks and behaves like Android":

1. `mobile/android-shell/README.md` — the complete behaviour list (this section only summarises it).
2. `mobile/android-shell/app/src/main/res/values/strings.xml` — **every Hebrew string**. Port them verbatim into a String
   Catalog with the **same key names**; add new strings in §4 under the same convention.
3. `mobile/android-shell/app/src/main/res/layout/*.xml` — the screens (server list, add/edit dialog, offer dialog, exit
   sheet, lock cover, error view).
4. Kotlin sources under `app/src/main/java/com/smplwise/arx/app/` — `ServerUrls.kt` (address normaliser, **port it
   exactly, with its tests in `app/src/test/`**), `ServerStore.kt`, `ServerCheck.kt`, `DeepLinks.kt`, `WebPolicy.kt`
   (navigation scope), `ShellPolicies.kt` (lock timing, error mapping, injected script), `BridgeScript.kt`, `AppLock.kt`,
   `ServersActivity.kt`, `WebActivity.kt`.
5. `docs/operations/ARX_ANDROID_SHELL_HE.md` — the operator/customer guide in Hebrew (the iOS guide is a deliverable).

The Android app is **a thin native shell around the Arx web app**. It is not a re-implementation of any Arx screen.
Everything the user does after signing in (map, cameras, events, devices, electricity, settings) is the website inside a
full-screen web view. The native parts are only: server list, navigation policy, the page bridge, app lock, error
screens, downloads/uploads, deep links — and now, on iOS, device registration + location.

### 2.1 Android feature → iOS equivalent

| Android | iOS implementation (guidance) |
|---|---|
| `ServersActivity`: server list, add/edit/delete/reorder, "פתח אוטומטית", app-lock settings, two-finger gesture setting, version line | SwiftUI (or UIKit) list, same fields, same copy, same validation. Stored in `UserDefaults` (names, addresses, flags only; **no credentials**). Excluded from iCloud backup (`isExcludedFromBackup` / no iCloud key-value). |
| `ServerUrls.normalize` | Port 1:1: no scheme / `http://` (silently upgraded to https) / `https://`, with or without path, IDN to punycode; refuse other schemes, credentials in the address (incl. `good.com:443@evil.com`), backslashes, whitespace, dot segments (also `%2e%2e`), invalid ports. Address without a path is tried at `/arx/` then at the site root; the site's own `remote_path` from `remote-config` corrects the stored path. |
| `ServerCheck`: `GET <url>api/v1/auth/remote-config`, 6 s overall deadline | Same endpoint and deadline (`URLSession` + `Task` timeout). Failure warns and offers "הוסף בכל זאת"; never blocks. |
| `WebActivity` full-screen `WebView` | `WKWebView`, persistent default `WKWebsiteDataStore` (cookies + localStorage per origin on disk). One site at a time, only a *stored* server can be opened. |
| `NavPolicy` (navigation scope) | `WKNavigationDelegate.decidePolicyFor` + `WKUIDelegate.createWebViewWith` (target=_blank / `window.open`). Stay in the app only on the selected server's **origin and under its path**; everything else → system (`UIApplication.open`); `mailto:`/`tel:` to their apps; `javascript:`, `intent:`, `file:`, `data:`, unknown schemes dropped; at most one link handed to the system per 10 s without a user gesture. Second check on every main-frame document (iOS has no `shouldInterceptRequest`; use `decidePolicyFor` for every navigation action incl. POST/back-forward, and `WKContentRuleList` as a belt-and-braces block of main-frame loads outside the Arx path). Port `WebPolicyTest` cases. |
| `window.ArxApp` bridge (`platform`, `shell`, `version`, `switchServer()`), injected at document start, only to the server's origin | `WKUserScript` (`.atDocumentStart`, all frames) + `WKScriptMessageHandler`. WKWebView cannot restrict injection per origin, so the script must check `location.origin` itself **and** the native handler must verify `message.frameInfo.securityOrigin`, `isMainFrame` and the message type again. Object is frozen. **Values: `platform: 'ios'`, `shell: 'wkwebview'`, `version: <CFBundleShortVersionString>`.** Do not use `addScriptMessageHandler` names that the page can enumerate beyond the single `ArxAppNative`. See §5 for the new bridge methods. |
| User agent suffix `SmplWiseArx/<version> (Android app)` | `applicationNameForUserAgent` = `SmplWiseArx/<version> (iOS app)` so the server's sessions list can tell the app apart. |
| Sessions: Arx keeps sign-in in `localStorage` key `arx.auth.v1` and exchanges it for the `__Secure-arx_session` cookie (SameSite=Strict, Path `/arx/`, ≤ 30 min). With server setting `remote.session = browser_session` tokens live in `sessionStorage`. | No code needed beyond a persistent data store; verify that after a cold start the app resumes signed in. Flush behaviour: WKWebView persists cookies on its own; test it. |
| WebRTC video playback; microphone only for two-way audio, only to the server's origin; camera/MIDI/protected media refused | `WKUIDelegate.requestMediaCapturePermissionFor` (iOS 15+): grant **only** `.microphone` and only for the server's origin; deny `.camera`/`.cameraAndMicrophone`. `NSMicrophoneUsageDescription` (Hebrew, see §4.5). `allowsInlineMediaPlayback = true`, `mediaTypesRequiringUserActionForPlayback = []`. Full-screen video via the web view's native element fullscreen. |
| Hardening list in README ("Hardening") | Equivalents: no `evaluateJavaScript` with page-controlled strings, `allowFileAccessFromFileURLs` off, `javaScriptCanOpenWindowsAutomatically = false`, ATS default (no `NSAllowsArbitraryLoads`), certificate errors never bypassed (`didReceive challenge` → default handling only), `isInspectable` only in debug builds, third-party cookies per WebKit default. |
| Downloads (server files fetched by the app itself with the server's cookie, then "save as"; page-built `blob:` files via injected script; `.apk` refused) | `WKDownload` (iOS 14.5+) or `URLSession` with cookies copied from `WKHTTPCookieStore` for that URL only; save through `UIDocumentPickerViewController` (export) / share sheet; follow redirects only to the server's own Arx pages (≤ 5); 25 MB cap; refuse installers (`.ipa`, `.apk`). Blob downloads: same injected-script mechanism (10 MB, keep 16 newest for 2 min). |
| Uploads (plan PDFs, restore ZIPs) | `<input type=file>` works natively in WKWebView; make sure `accept` types are honoured and the picker is not blocked. |
| App lock ("נעילת האפליקציה"): off by default; biometric or device credential on cold start and after 0/1/5/15/60 minutes away; cover hides the window; media paused and capture stopped while locked; recents thumbnail blank | `LocalAuthentication`, policy `.deviceOwnerAuthentication`. Lock cover view over the key window on `sceneWillResignActive` (also blanks the app-switcher snapshot). Port `LockPolicy` timing and its tests (`ShellPoliciesTest`): time away always counted; leaving through the app's own file picker/"save as"/mic prompt waives only the first 30 s; cancelling the prompt keeps the cover; switch the lock off automatically only if the phone has no passcode at all. While locked: pause and block audio/video/getUserMedia in **every frame of the server origin** (the same injected guard as Android, token held in a closure), refuse permission requests/downloads/bridge messages. `NSFaceIDUsageDescription`. |
| Deep links `arx://servers`, `arx://open?url=…` (stored servers only; asks first if a site is open; unknown server shows the full address + warning) | Register URL scheme `arx`. Port `DeepLinks.kt` + tests exactly. Do **not** claim Universal Links (servers are unknown at build time). Plain `https://` links open in Safari. |
| Shortcut "שרתים" on the icon long-press | `UIApplicationShortcutItem` (static, Home Screen Quick Action) with the same Hebrew titles. |
| Two-finger swipe up → server list; setting off / anywhere (default) / bottom quarter | Gesture recogniser attached to the web view with `cancelsTouchesInView = false` and `delaysTouchesBegan = false` (never consume the touch). Same thresholds: ≥ 120 pt vertical travel within 0.7 s, finger distance change ≤ 25 %, no third finger; ignored while locked. |
| Back at the site's first screen → sheet "יציאה / שרתים" | iOS has no Back key; use the edge-swipe/back navigation of the web view history, and at history start show the same sheet from the same gesture only if the owner wants it. **Default: do not replicate; provide "שרתים" in the page's user menu (it already exists) and the quick action.** Raise with the owner only if testers miss it. |
| One-time hint after the first server opens ("להחלפת שרת: התפריט של המשתמש › החלף שרת") | Same string, same one-time behaviour. |
| Error screens (offline / not found / timeout / TLS / server 5xx incl. Cloudflare 52x/530 / redirect off server / other) with "נסה שוב" and "שרתים" | Same screens, same copy, same mapping from `NSURLError*` + HTTP status (`ShellPolicies` error mapping). |
| Edge-to-edge, theme-color → status bar, page background → bottom, `env(safe-area-inset-*)` | WKWebView extends under the notch with `contentInsetAdjustmentBehavior = .never` and `viewport-fit=cover` already handled by the page; read `<meta name="theme-color">` and the body background after each load/route change, set the status-bar style by luminance. Keyboard shrinks the page. Progress bar while loading. |

---

## 3. Technical baseline for iOS

- Language/UI: **Swift**, SwiftUI for native screens, UIKit where WKWebView hosting requires it. No third-party
  dependencies unless unavoidable (Android has none beyond AndroidX/Material; keep the iOS binary equally small).
- Minimum OS: **iOS 16.0** (recommended; `WKUIDelegate` media-capture API needs 15; confirm 16 with the owner).
- Targets: iPhone first, portrait + landscape (rotation must not reload the web view). iPad: allowed to run (universal
  layout) but not a design target now.
- Project location: `mobile/ios-shell/` (this folder), Xcode project `SmplWiseArx.xcodeproj` or Swift Package + app
  target. Tests: XCTest for all policy code (the Android unit tests are the specification — port every case).
- Build settings analogue of Android's `arxHost` / `arxPath` / `arxServerName` / `arxVersionName`: `.xcconfig` keys so a
  build can ship with one pre-added server for a customer.
- **Hardware and tools.** An iPhone app can only be built on a **Mac** (macOS). The owner states the second computer is a
  Mac and that he does not know Xcode, so **the Mac needs these installed; Codex asks the owner to do each step and
  checks the result** (the owner clicks, Codex gives the exact next step in Hebrew):
  1. **Xcode** — Apple's free development app, installed from the Mac App Store (search "Xcode"; large download, about
     10 GB plus 15–30 GB free space; first launch asks to install extra components, accept). It contains the compiler,
     the iPhone simulator and the signing tools. Without it nothing can be built.
  2. **Command Line Tools** — in Terminal: `xcode-select --install` (then `sudo xcodebuild -license accept` once).
  3. Optional but convenient: **Homebrew** (package manager) only if a tool is really needed. No other package is
     required by this plan; do not add Cocoapods/Carthage (use Swift Package Manager only if a dependency is unavoidable).
  4. An **Apple ID** signed in to Xcode (Settings › Accounts). With a free Apple ID the app can run on the owner's own
     iPhone for 7 days at a time (connect by cable, enable Developer Mode on the phone). For TestFlight or the App
     Store the owner needs the paid **Apple Developer Program** (about 99 USD a year) — location in the background and
     distribution to employees realistically need it.
  Verify with `xcodebuild -version` and `xcrun simctl list devices`. Codex must report each missing piece to the owner
  in plain Hebrew rather than assuming it is installed.
- Codex has no Apple account: signing identities, provisioning profiles and App Store Connect API keys are the owner's;
  never commit them (extend `.gitignore` for `*.p12`, `*.mobileprovision`, `*.p8`, `ExportOptions*.plist` with team ids).

---

## 4. NEW: first launch, device registration, location

This is the only functionality that is new compared with Android. It must be designed so it can be reused on Android
later (same server contract, same Hebrew copy, same screen order).

### 4.1 Flow (owner decision 2026-10-04)

1. First start: server list is empty → "הוסף שרת" open (as on Android).
2. Server added; the site opens and **the user signs in inside the web view** (username and password on the Arx sign-in
   page; the native app never sees them) and confirms.
3. **Immediately after the sign-in is confirmed** (the page calls `ArxApp.signedIn`, see §5) the app checks whether this
   device is registered for this server. If not → **Screen A: "רישום המכשיר"**.
4. **Screen A**: a native screen over the site: title, one text field "שם המכשיר" with placeholder "הנייד של יוסי", helper
   text, button "המשך" (enabled for 2–40 trimmed characters). The field starts empty. The name is shown later in Arx
   next to the employee and can be changed there and in the app (server list › the server › "המכשיר הזה").
5. On "המשך" the app registers the device (§6.1) and stores the device token in the **Keychain**.
6. Then the app reads `GET presence/config`. **If `enabled` is false** (the default): the flow ends here, the device is
   registered, no location permission is requested, and the app does not touch location at all. **If `enabled` is
   true**: show **Screen B**.
7. **Screen B** shows the server-provided employee notice (`notice_text`, `notice_version`, see 4.6) and a button "קראתי
   והבנתי"; only after that does it show the explanation and "אישור גישה למיקום" → iOS "While Using" prompt, then the
   "Always" step (4.3). "לא עכשיו" leaves the device registered without location (`not_determined`); the app asks again
   the next time presence is enabled or the notice version changes, at most once per week.
8. Back to the site. A registered device with no location is shown in Arx as "ללא מיקום".

### 4.6 Presence is a switch, and the employees are notified first

Owner decision: the capability is **published to employees but not necessarily switched on**. When it is switched on,
an orderly notice goes to the employees first.

- Server setting `presence.enabled` (default **false**), plus `presence.notice_text` and an integer
  `presence.notice_version`; changing the text increments the version. (Built on our side, §6.)
- When disabled the app collects **nothing**, requests **no** location permission, and sends no events.
- When enabled, each device must show the notice and record the acknowledgement locally and on the server
  (`POST presence/devices/{id}/ack` with `notice_version`) before location is requested; a new version asks again.
- The notice text is written by the owner, not by Codex. Codex ships a clearly marked placeholder
  ("טקסט ההודעה לעובדים יוזן בהגדרות המערכת") and never invents legal wording.


### 4.2 Multiple servers

Registration is **per server** (a phone can be signed in to several Arx sites). Device name and token are stored per
server id. The location is reported only to servers where the device is registered *and* the user has not switched
reporting off. Location is acquired once and fanned out to each registered server.

### 4.3 Location: continuous reporting (owner decision 2026-10-04) — Codex verifies against the current Apple docs

The owner chose **continuous location** (not just enter/exit). It is **off by default, switched on server-side**, and
only after the employees have been given a formal notice (see 4.6). Technical shape:

- Authorisation: **"Always"** is needed for reporting while the app is closed. iOS asks in two steps (When In Use first,
  then the "Change to Always" prompt later). Screen B does step one and then explains and triggers step two. With only
  "While Using" the app reports while it is open (report `location_auth: when_in_use`).
- Mechanism: `CLLocationManager` with `allowsBackgroundLocationUpdates = true`, `pausesLocationUpdatesAutomatically =
  true`, `showsBackgroundLocationIndicator = true` (iOS shows the blue indicator; this is required honesty, do not
  hide it), `desiredAccuracy` of `kCLLocationAccuracyHundredMeters` and a `distanceFilter` (start at 50 m) to save
  battery. `UIBackgroundModes` → `location`. Add **significant-location-change** as the relaunch safety net so the
  app resumes after the OS terminates it.
- Reporting cadence and accuracy come from the server config (`GET presence/config`, 6.2): `interval_s` (default 60,
  minimum 30), `distance_filter_m`, and an optional **building geofence list**. Inside the building the app may slow
  down to the idle interval; the geofence enter/exit events are still sent as `enter`/`exit` events (they also wake
  the app). Batch events and send them together (cap 50 per request); queue offline.
- Send only: event type, optional site id, one coordinate, accuracy, speed not needed, UTC timestamp. No address
  lookup, no on-device storage of a history beyond the unsent queue, nothing sent when no registration exists or the
  server says presence is disabled.
- If precise location is off (`accuracyAuthorization == .reducedAccuracy`) report it and show the "location_reduced"
  hint. React to permission changes in `locationManagerDidChangeAuthorization` and report the new state.
- A visible in-app control "שיתוף מיקום" (on/off, per server) must exist so the employee can stop sharing; when off, the
  app sends `status` only (`location_auth` and `sharing: false`). The owner decides later whether an employer may
  override it.
- App Store: continuous background location for employee presence needs a clear review note (workplace attendance
  feature, user-visible indicator, server-controlled). Codex prepares the review notes text; the owner submits.


### 4.4 Local persistence

| Item | Where |
|---|---|
| Server list, device name (per server), registration state, app-lock settings | `UserDefaults` (no secrets) |
| **Device token** (per server) | Keychain, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (must be readable while the phone is locked, for background location events), not synced to iCloud |
| `install_id` (random UUID generated once per install, per server) | Keychain, same class |
| Queue of unsent events (offline) | App sandbox file, max 200 events / 24 h, oldest dropped, cleared on unregister |

### 4.5 New Hebrew strings (draft; keys to add to the String Catalog; final wording needs the owner's approval)

| Key | Hebrew |
|---|---|
| `device_title` | רישום המכשיר |
| `device_intro` | תנו שם למכשיר הזה, כדי שנדע לזהות אותו במערכת. |
| `device_name_label` | שם המכשיר |
| `device_name_placeholder` | הנייד של יוסי |
| `device_name_error` | השם צריך להכיל בין 2 ל־40 תווים. |
| `device_continue` | המשך |
| `device_register_failed` | לא הצלחנו לרשום את המכשיר. בדקו את החיבור ונסו שוב. |
| `device_this_device` | המכשיר הזה |
| `device_rename` | שינוי שם המכשיר |
| `device_unregister` | הסרת המכשיר מהמערכת |
| `device_unregister_message` | המכשיר יוסר מהמערכת והמיקום שלו יפסיק להישלח. |
| `location_title` | מיקום המכשיר |
| `location_explain` | כדי לדעת אילו עובדים נמצאים עכשיו במבנה, המערכת צריכה לדעת מתי המכשיר נכנס לאזור המבנה ומתי הוא יוצא ממנו. המיקום נשלח רק לשרת שלכם ורק בכניסה ויציאה מהמבנה. |
| `location_allow` | אישור גישה למיקום |
| `location_not_now` | לא עכשיו |
| `location_always_title` | לאפשר זיהוי גם כשהאפליקציה סגורה? |
| `location_always_message` | כדי שהמערכת תזהה כניסה ויציאה מהמבנה גם כשהאפליקציה לא פתוחה, בחרו "תמיד" במסך הבא. |
| `location_denied` | הגישה למיקום כבויה. אפשר להפעיל אותה בהגדרות הטלפון › SmplWise Arx › מיקום. |
| `location_reduced` | המיקום המדויק כבוי. הפעילו אותו בהגדרות כדי שהזיהוי יעבוד. |
| `location_open_settings` | פתח הגדרות |
| `notice_title` | הודעה לעובדים |
| `notice_placeholder` | טקסט ההודעה לעובדים יוזן בהגדרות המערכת. |
| `notice_ack` | קראתי והבנתי |
| `sharing_title` | שיתוף מיקום |
| `sharing_hint` | כשהשיתוף כבוי, המערכת לא מקבלת את מיקום המכשיר. |

Info.plist usage strings (Hebrew, shown by iOS in the prompt):

| Key | Text |
|---|---|
| `NSLocationWhenInUseUsageDescription` | המערכת משתמשת במיקום כדי לדעת אם אתם נמצאים במבנה. |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | כדי לזהות כניסה ויציאה מהמבנה גם כשהאפליקציה סגורה. המיקום נשלח רק לשרת שלכם. |
| `NSMicrophoneUsageDescription` | המיקרופון משמש לשיחה דו־כיוונית עם האינטרקום והמצלמות. |
| `NSFaceIDUsageDescription` | לנעילת האפליקציה בזיהוי פנים. |

**Privacy wording is a legal matter** (employee location, Israeli Privacy Protection Law, employer notice and
consent). The strings above are product drafts; the owner (or counsel) must approve the final text and the
employee-notice process. Do not publish to the App Store before that sign-off.

---

## 5. Page ↔ app bridge (existing + new)

Existing on Android, same on iOS: `window.ArxApp = { platform, shell, version, switchServer() }`.

**New (proposed; the web side adds the callers, the native side must implement the receiver). Android will implement the
same shape later:**

| Member | Direction | Meaning |
|---|---|---|
| `ArxApp.capabilities` | static | array, iOS v1: `["device-registration", "location"]` — lets the page show the "מכשירים" UI only inside an app that supports it |
| `ArxApp.signedIn({ user_id, display_name })` | page → app | called by the web app after a successful session exchange (also on resume). The app uses it to decide whether Screen A must be shown, and to bind the registration to that Arx user id |
| `ArxApp.signedOut()` | page → app | the app keeps the device registered (the device belongs to the user, not to a session) but stops sending location until the next `signedIn` with the same user. If a **different** user signs in on a registered device, the app prompts to re-register (the old registration is not transferred silently) |
| `ArxApp.deviceStatus()` | page → app, returns Promise | `{ registered, name, location_auth, precise, last_event_at }` so the page's "המכשיר הזה" card can render |
| `ArxApp.openLocationSettings()` | page → app | deep-link to iOS Settings for the app |

Rules: every message is checked in Swift again (origin, main frame, known type, size ≤ 64 KB); the page never receives
the device token or raw coordinates; nothing here can be called by a page outside the selected server's Arx path.

---

## 6. Server contract — DRAFT, **not implemented yet**

Check with `contracts/API_INVENTORY.md`: there is **no** device, presence or location endpoint today (verified
2026-10-04). The existing identity pieces to build on: `POST /api/v1/auth/session` (HA access token → Arx session
cookie), `GET /api/v1/me`, `push_subscriptions` (a per-user device-like table, `0034_push_subscriptions.sql`), roles in
`smplwise_vms/backend/smplwise/roles.json`, audit via `smplwise.audit`. The server will be built **on our side** under a
new change request (next free CR number; a task card to be created in `management/tasks.json`). Codex builds the app
against this draft and a local mock; the contract may change in small ways and any change will be sent as a revision
of this section.

Base path `/arx/api/v1` (remote channel) — same paths without `/arx` on the Ingress channel. All bodies JSON, UTC ISO-8601
timestamps, Hebrew error messages in `message`, stable English `code`s (the existing `ApiError` shape: `{code, message,
retryable?}`).

### 6.1 Register the device — `POST presence/devices`

Auth: the Arx session cookie (the user just signed in). Permission: any signed-in user (new permission
`presence.report`, granted to every role by default).

```json
{
  "name": "הנייד של יוסי",
  "platform": "ios",
  "install_id": "3f1c…uuid",
  "app_version": "1.0.0",
  "os_version": "18.1",
  "model": "iPhone15,3"
}
```

→ `201` (or `200` if `install_id` is already registered for this user; the token is rotated)

```json
{
  "device_id": "dev_…",
  "device_token": "opaque, 256-bit, shown once",
  "name": "הנייד של יוסי",
  "registered_at": "2026-10-04T10:00:00Z"
}
```

Server stores only a hash of the token. Name 2–40 characters, trimmed, unique per user (409 `device_name_taken` suggests
"הנייד של יוסי 2"). Errors: `400 invalid_name`, `401`, `403`, `429` (rate limit), `409`.

### 6.2 Config — `GET presence/config`

Auth: device token (`Authorization: Bearer <device_token>`) or session.

```json
{
  "enabled": false,
  "mode": "continuous",
  "interval_s": 60,
  "distance_filter_m": 50,
  "notice_version": 1,
  "notice_text": "…",
  "sites": [ { "id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150 } ]
}
```

`enabled` is the master switch (default false, §4.6). `sites` is optional (building geofence, up to 20; the iOS
region limit is shared across servers, pick the nearest). The mock returns `enabled: true` and one site, plus a
switch to return `false`.

Also: `POST presence/devices/{device_id}/ack` `{ "notice_version": 1 }` records that the employee read the notice.

### 6.3 Events — `POST presence/devices/{device_id}/events`

Auth: device token only. Batch ≤ 50, body ≤ 64 KiB, idempotent per `client_event_id`.

```json
{
  "events": [
    {
      "client_event_id": "uuid",
      "type": "fix | enter | exit",
      "site_id": "site_main",
      "lat": 32.0, "lon": 34.8, "accuracy_m": 18,
      "at": "2026-10-04T10:00:04Z",
      "source": "continuous | region | significant | foreground"
    }
  ],
  "status": { "location_auth": "always | when_in_use | denied | restricted | not_determined", "precise": true, "sharing": true }
}
```

→ `200 { "accepted": n, "duplicates": m, "inside": true }`. Server keeps the **current presence state per device** and an
audited, retention-limited event log (retention to be decided by the owner; app is agnostic). `401 device_token_invalid`
→ the app forgets the registration and shows Screen A again.

### 6.4 Manage

- `PATCH presence/devices/{id}` `{ "name": "…" }` — rename (device token or the owner's session).
- `DELETE presence/devices/{id}` — unregister (device token, the user's own session, or an administrator); the app also
  calls it from "הסרת המכשיר מהמערכת".
- `GET presence/devices/me` — the caller's own devices (session).
- Later (not now): `GET presence/people` for the Arx screen that shows who is in the building (`presence.view`).

Mock server for Codex: a ~100-line FastAPI or Node script under `mobile/ios-shell/tools/mock_arx_server.*` that serves
`auth/remote-config`, a trivial HTML page that sets a fake `window.__signedIn`, and these four endpoints. Put it in the
repo with its own short README; never point it at the lab.

---

## 7. Security rules carried over from Android (non-negotiable)

- The app stores **no passwords and no Arx tokens**. Sign-in state lives in WebKit's own storage. The only secret the
  app holds is the per-server device token, in the Keychain.
- Server addresses come from the user or a parsed `arx://open` link for a *stored* server; unknown servers are never
  opened or added automatically (full address + warning).
- The page gets one frozen object and nothing else; no `evaluateJavaScript` with data from the page.
- Navigation is limited to the selected server's Arx path; geolocation requests *from the page* (`navigator.geolocation`)
  are refused — location is collected only by the native code (`WKUIDelegate` geolocation handling denies, and the
  site's Permissions-Policy already forbids it).
- Certificate errors are never bypassed; ATS stays on; cleartext only in a Debug configuration for `127.0.0.1`.
- Logs, crash reports and analytics: **none** third-party; no coordinates in any log; device token never logged.
- Repo secrets rules (`CLAUDE.md` / `AGENTS.md`): no lab hosts, IPs, serials or MACs in fixtures, screenshots or
  docs; the lab is read-only and is not used by Codex for this task.

## 8. Acceptance

Everything below needs evidence (screenshots from the simulator and a **real iPhone** for location and microphone) and
honest NOT_RUN/BLOCKED reporting; never claim a pass that was not executed.

1. Unit tests ported 1:1 from Android: `ServerUrlsTest`, `WebPolicyTest`, `DeepLinksTest`, `ShellPoliciesTest` (lock
   timing, error mapping, bar colours, file types, injected script).
2. Server list: add (all address forms of the README), edit, reorder, delete, last-used badge, auto-open with one server,
   offline add with "הוסף בכל זאת". Screens match the Android layouts (side-by-side screenshots in
   `docs/design/evidence/ios-shell/`).
3. Site: signs in, resumes signed in after force-quit; navigation policy cases; `ArxApp` present, frozen, `platform:
   'ios'`; user-agent suffix present.
4. App lock: on/off, each interval, cover, recents blank, media paused in all same-origin frames while locked.
5. Deep links `arx://servers`, `arx://open`.
6. **Registration flow (§4.1)** against the mock: Screen A validation, token in Keychain, `enabled:false` (no permission asked, nothing sent), `enabled:true` (notice, acknowledgement, Screen B), "לא עכשיו" path, "שיתוף מיקום" off,
   rename, unregister, 401 → Screen A again, different user signs in → re-register prompt, two servers.
7. **Location (§4.3) on a real phone:** continuous fixes delivered in background and after the OS killed the app (significant-change relaunch), enter/exit events delivered; "While Using" only (degraded);
   precise off; permission changed in Settings; offline queue flushed; no event leaves the phone when no registration
   exists.
8. Microphone only on the server origin; camera denied.
9. Accessibility: Dynamic Type, VoiceOver labels in Hebrew, RTL everywhere, contrast per `docs/design/DESIGN_CONTRACT.md`.
10. A short Hebrew guide `docs/operations/ARX_IOS_APP_HE.md` (mirror of the Android guide).

## 9. Owner decisions (2026-10-04) and what is still open

Decided: (1) the Mac is the second computer; the owner does not know Xcode, so Codex guides him step by step (§3).
(2) Order: sign in (username, password, confirm) → name the device → permissions (§4.1). (3) **Continuous location**
(§4.3). (4) Employees are informed; the feature is published but **off until the owner switches it on**, and an
orderly notice goes out when it is switched on (§4.6).

Still open (ask in Hebrew, numbered, when the matching part is reached):
1. Apple Developer Program account: whose, and distribution to employees (TestFlight / Ad Hoc / App Store). Bundle id.
2. Retention of location events and who may see them (relevant to the later Arx map, not to this app).
3. Interval default (60 s proposed) and distance filter (50 m) — battery vs freshness; tune on a real phone.
4. Whether the employee may switch sharing off (assumed yes, §4.3) or the employer may forbid it.
5. Minimum iOS (recommended 16).

## 10. Working agreement

- Branch `pilot/ios-shell` from `g0/intake` (name suggestion; `main` receives reviewed merges only). Small commits,
  English messages, trailer per the repository's `CLAUDE.md`/`AGENTS.md`.
- Do not edit `mobile/android-shell/` (owner's instruction: no Android work now), the legacy tree, or `docs/design/`
  tokens. If an Android file must change for the shared contract, write it in your report instead.
- Web-side changes the iOS app needs (`frontend/src/arx/android-app.ts` currently recognises only `platform ===
  'android'`; the "אפליקציית Android" card in `system-diagnostics.ts`; hiding the PWA install banner/iOS home-screen hint
  inside the app in `pwa/register.ts`; the callers of `ArxApp.signedIn/signedOut`; the "מכשירים" card) are **ours**: send
  the exact list you need and we change the frontend. Until then, test with the mock page.
- Ask questions in a short, numbered list with lettered options. Report in the format `AGENTS.md` requires.
