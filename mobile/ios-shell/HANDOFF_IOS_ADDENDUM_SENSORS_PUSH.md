# iOS addendum 1 — selectable sensors and push notifications

Written 2026-10-05 for the Codex session on the owner's Mac. It extends `HANDOFF_IOS_CODEX.md` (read that and the root
`AGENTS.md` first); where this file and §4–§6 of the handoff disagree, **this file wins** and the handoff will be revised.
Every contract here is platform-neutral: Android implements the same shape a few days later.

Two additions:

- **A. Sensor sharing with per-sensor choice.** The user decides which data the phone shares with Arx: none, some, or all.
  Location (already in the handoff) becomes one sensor among several. Purpose: presence, position and later automations.
- **B. Push notifications** from every Arx server the app is registered with.

Server side is built by us (new change request, next free CR number); Codex builds the app against the drafts in §A.4 and
§B.4 and a local mock (extend `tools/mock_arx_server.*`). Never point the mock or the app at the lab.

---

## A. Sensors

### A.1 Principles (non-negotiable)

1. **Opt-in, per sensor, per server.** Nothing is shared until the user turns that specific sensor on. Screen "נתונים
   שהמכשיר משתף" lists each sensor with a switch, plus **"בחר הכל"** and **"בטל הכל"**. Defaults: all off.
2. **Two gates.** A sensor reports only if (a) the server config lists it as `allowed` (server master switch
   `presence.enabled` from handoff §4.6 and a per-sensor allow-list set by the administrator) **and** (b) the user switched it on
   **and** (c) iOS permission, where one is needed, is granted. Any gate closed → nothing collected for that sensor.
3. **Notice first.** The employee-notice flow of handoff §4.6 applies to every sensor, not just location. A new sensor added
   server-side raises `notice_version` and asks again.
4. **Minimal data, no history on the phone** beyond the unsent queue (handoff §4.4). No raw sensor streams; derived values only.
5. **Per-server fan-out.** Acquire once, send to each registered server whose gates are open (handoff §4.2).
6. The page never receives device token or raw values (handoff §5).
7. Privacy wording is the owner's/counsel's. Codex ships placeholders and never invents legal text.

### A.2 Sensor catalogue (iOS v1)

Codex verifies each API and entitlement against current Apple documentation before building and reports any sensor that
cannot be done as written; do not silently drop one.

| Key | Data sent (derived only) | iOS API | Permission / entitlement | Notes |
|---|---|---|---|---|
| `location` | lat, lon, accuracy_m, event type fix/enter/exit | CoreLocation (handoff §4.3) | Location When In Use → Always; `UIBackgroundModes: location` | already specified; precise vs approximate reported |
| `activity` | `stationary / walking / running / cycling / automotive / unknown` + confidence | CMMotionActivityManager | Motion & Fitness (`NSMotionUsageDescription`) | send on change only |
| `steps` | step count delta per interval, floors up/down | CMPedometer | Motion & Fitness | at most one sample per 5 min |
| `altitude` | relative altitude change (floor hint) | CMAltimeter | Motion & Fitness | only useful with `location`; optional |
| `battery` | level %, charging state, Low Power Mode | UIDevice / ProcessInfo | none | send on change, throttled to 15 min |
| `network` | `wifi / cellular / none`, Wi-Fi SSID hash (see note) | NWPathMonitor; `NEHotspotNetwork.current()` | **Access Wi-Fi Information** entitlement + location permission for the SSID | SSID is sent as a salted hash per server, matched against site SSIDs configured on the server. If the entitlement is not granted by Apple, report `network_ssid: unavailable` |
| `beacon` | site id + proximity bucket (immediate/near/far) when a configured iBeacon is ranged | CLLocationManager beacon monitoring | Location Always | UUID list from server config; optional |
| `app_state` | foreground/background, last-seen | UIApplication | none | heartbeat, ≥ 5 min |

Explicitly **not** included: contacts, photos, microphone/camera (only the existing two-way audio), health data, Bluetooth
device scanning, advertising ID, clipboard, running-app list. Adding any of them needs a new owner decision.

### A.3 UI (native, Hebrew, same card style as the server list)

- Entry points: server list › the server › "נתונים שהמכשיר משתף" and a post-registration step after Screen B of the handoff.
- One row per sensor: Hebrew name, one-line purpose, switch, state chip ("פעיל", "כבוי", "דורש הרשאה", "לא מאושר בשרת").
  Rows whose sensor the server did not `allow` are shown disabled with "לא מאושר בשרת", never hidden.
- Footer buttons: "בחר הכל" (turns on every allowed sensor; triggers the iOS permission prompts one after another with a short
  explanation before each, never all at once) and "בטל הכל".
- A switch that needs an iOS permission the user denied shows "פתח הגדרות".
- Strings: add to the String Catalog under the key prefix `sensor_*` (draft wording below; final wording needs the owner):
  `sensor_title` נתונים שהמכשיר משתף · `sensor_select_all` בחר הכל · `sensor_clear_all` בטל הכל · `sensor_location` מיקום ·
  `sensor_activity` פעילות (הליכה, נסיעה) · `sensor_steps` צעדים · `sensor_altitude` שינוי גובה (קומה) · `sensor_battery` סוללה ·
  `sensor_network` רשת ו-Wi-Fi · `sensor_beacon` קרבה לנקודות בבניין · `sensor_app_state` פעילות האפליקציה ·
  `sensor_not_allowed` לא מאושר בשרת · `sensor_needs_permission` דורש הרשאה. Info.plist: `NSMotionUsageDescription`
  "תנועה משמשת לזיהוי אם אתם הולכים או נוסעים, לצורך נוכחות במבנה."
- The user's choices are stored per server (UserDefaults, no secrets) and reported to the server in `status.sensors` so the
  administrator sees what each device shares.

### A.4 Server contract — DRAFT (extends handoff §6)

`GET presence/config` gains:

```json
{ "sensors": { "allowed": ["location","activity","battery"], "intervals_s": { "battery": 900, "steps": 300 } },
  "beacons": [ { "uuid": "…", "site_id": "site_main" } ],
  "wifi_sites": [ { "site_id": "site_main", "ssid_hash_salt": "…", "ssid_hashes": ["…"] } ] }
```

`POST presence/devices/{id}/events` accepts, besides `fix|enter|exit`, an event of `type: "sensor"`:

```json
{ "client_event_id": "uuid", "type": "sensor", "sensor": "activity", "at": "2026-10-05T07:00:00Z",
  "value": { "state": "walking", "confidence": "high" } }
```

and `status` becomes `{ location_auth, precise, sharing, sensors: { "location": "on", "activity": "off", "battery": "on" } }`.
Unknown or non-allowed sensor events are rejected with `400 sensor_not_allowed` and the app switches that sensor off locally.
Batch limits, idempotency and `401 device_token_invalid` behaviour are unchanged. New permission `presence.sensors.view`
(administrators) is for the later Arx screen; not in this phase.

### A.5 Android parity (so Codex does not paint us into a corner)

Same keys, same strings, same server contract. Android APIs: FusedLocation + geofencing, ActivityRecognition transition API,
step counter, BatteryManager, ConnectivityManager. Do not put iOS-only concepts into the contract.

---

## B. Push notifications

### B.1 What the user gets

Notifications from **every Arx server the device is registered with** (alarms, automations, device events; sources are CR-018
and CR-010). The user can mute per server and per category in the app. Tapping a notification opens that server on the
relevant page (deep link `arx://open?url=…`, stored servers only, handoff §2.1).

### B.2 The architecture problem and the proposed answer (owner decision needed, see questions)

Arx servers are **self-hosted per customer**, but APNs (iOS) and FCM (Android) only accept messages signed with a key that
belongs to the *app publisher*. A customer server therefore cannot push to the SmplWise app directly, and we must not hand
every customer our Apple key. Proposed design (the pattern Home Assistant's companion app uses):

1. A small **SmplWise push relay** (we run it; Cloudflare Worker or a tiny service) holds the APNs key and the FCM service
   account. It stores nothing but a hashed mapping `relay_token → platform push token`.
2. The app obtains its APNs token, registers it with the relay and gets an opaque **relay token**, then registers that relay
   token with each Arx server together with the device token (§B.4).
3. When Arx has an alert, it calls the relay with `relay_token` and a **minimal payload**: category, a short generic title,
   and a `notification_id`. No sensitive text travels through Apple, Google or the relay.
4. iOS **Notification Service Extension** (`mutable-content: 1`) fetches the real title/body from the originating Arx server
   with the device token, then shows it. If the fetch fails, show the generic text. (Android does the same in its
   `FirebaseMessagingService`.)

Until the owner approves a relay, Codex builds everything except the relay call: the registration, the extension, the
settings and a local-notification test path that the mock server can trigger.

### B.3 iOS implementation requirements

- Capabilities: **Push Notifications** (`aps-environment`), Background Modes → *Remote notifications*. Needs the paid Apple
  Developer Program; an APNs auth key (`.p8`) created by the owner, **never committed** (the root `.gitignore` blocks
  `*.p8`, `*.p12`, `*.mobileprovision`, `ExportOptions*.plist` as of 2026-10-05).
- Request notification permission **after** device registration, with an explanation screen first (`push_title`,
  `push_explain`, "אישור התראות", "לא עכשיו"). Use provisional authorization first only if the owner asks.
- `UNNotificationCategory` per Arx category with a maximum of three actions; actions that change state require
  authentication (`.authenticationRequired`). Time-sensitive interruption level only for categories the server flags
  `critical` (Codex verifies the entitlement rules; do **not** request Critical Alerts entitlement without the owner).
- Notification Service Extension target with its own Keychain access group so it can read the device token
  (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`), a 25-second budget, and no UI.
- Badge, sound and grouping: `threadIdentifier` = server id, summary per server. Hebrew RTL for all native text.
- Token lifecycle: re-register on every launch if the APNs token changed; unregister on "הסרת המכשיר" and on
  `401 device_token_invalid`; handle `didFailToRegisterForRemoteNotifications` with a visible "התראות לא זמינות" state.
- Foreground behaviour: show a banner for the *current* server only when the notification is not already visible on screen.
- Settings screen "התראות" per server: master switch, category switches (list comes from the server), "שלח התראת בדיקה".

### B.4 Server contract — DRAFT

- `POST notifications/devices` (device token): `{ "platform": "ios", "relay_token": "…", "app_version": "…" }` → `200`.
  Re-sent when the relay token changes. `DELETE notifications/devices/{device_id}` unregisters.
- `GET notifications/categories` → `[ { "id": "alarm", "name": "אזעקות", "critical": true }, … ]`; the app stores the user's
  per-category mute locally and sends it with `PATCH notifications/devices/{id} { "muted": ["automation"] }`.
- `GET notifications/{notification_id}` (device token) → `{ "title", "body", "category", "deep_link", "at" }` (used by the
  extension; the `notification_id` is single-use-ish, expires after 24 h).
- Relay call (server → relay, designed by us): `POST /v1/push { "relay_token", "category", "notification_id", "priority" }`.

### B.5 Android parity

Same endpoints. Android uses FCM through the same relay (CR-012 describes the alternatives for phones without Google
services); the app registers the FCM token with the relay exactly as iOS registers the APNs token.

---

## C. What the Mac needs (exact, in the order Codex should request them)

1. macOS current release with **Xcode** latest stable from the App Store (≈ 10 GB download, 40 GB free disk), first launch
   accepts the extra components; then `xcode-select --install`, `sudo xcodebuild -license accept`.
   Verify: `xcodebuild -version`, `xcrun simctl list devices`.
2. **Apple Developer Program** membership (paid, ≈ 99 USD/year, owner's Apple ID). Needed for: Push Notifications, background
   location distribution, TestFlight, App Store. A free Apple ID cannot use push and expires builds every 7 days.
3. In the Apple Developer portal (owner clicks, Codex gives the steps in Hebrew): App ID `com.smplwise.arx.app` (confirm the
   bundle id) with capabilities Push Notifications, Background Modes, Access Wi-Fi Information (request; may need Apple approval);
   a second App ID for the Notification Service Extension (`com.smplwise.arx.app.nse`); an App Group
   (`group.com.smplwise.arx`) shared by app and extension; one **APNs Auth Key (.p8)** — the owner stores it in the password
   manager and in the relay's secret store, never in git or chat.
4. A **physical iPhone** (iOS 16+) connected by cable, Developer Mode on. The simulator cannot test remote push, background
   location, motion sensors, battery state or Wi-Fi SSID; Codex states plainly which tests were NOT_RUN for that reason.
5. Network: the Mac reaches the mock server on the LAN; for a real server only through the owner's remote address.
6. Repository access: the Mac clones the repo, works on branch `pilot/ios-shell-*`, pushes; the owner approves merges.
   No Homebrew packages, CocoaPods or Carthage unless justified in writing.

## D. Order of work for Codex

1. Handoff §4 (registration, location) against the mock — already queued.
2. Sensor screen and per-sensor gating (A.3, A.4) with `battery` and `activity` first (no Apple approvals needed).
3. Push registration + Notification Service Extension against the mock (B.3), local-notification test path.
4. `network` (SSID) and `beacon` last, because they depend on Apple's entitlement approval.
5. Report per item: BUILT / NOT_RUN / BLOCKED with the reason, and any API that does not behave as written here.

## E. Open items blocking Codex (owner)

Relay approval (B.2), legal text of the employee notice, bundle id confirmation, Apple Developer Program enrolment, and
whether sensors other than `location` are wanted in v1 of the app (they are specified here; trimming is cheap).
