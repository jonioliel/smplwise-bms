# CR-012 — Notifications in the Android app

**Numbering:** registered as CR-012 on 2026-09-30. Task card: T096 (requirements R196-R198, acceptance tests
AT196-AT198). See CR-011 for why T094 is skipped.

**Status:** Proposed - design record, no product code. Decisions for the owner in §9.

**Related:** CR-008 §3d / §9 (Web Push in the PWA, `services/push.py`; the Android shell `mobile/android-shell`, no
Google services, "notifications - design note"), CR-011 (the device key shared with this CR), CR-010 (alarm events).

## 1. The question

The owner asked why an external service is needed for notifications in the Android app, and must choose. Short answer:
Android lets a sleeping app be woken by exactly two means - a push message delivered by a system-level push channel
(FCM on phones with Google services), or a connection the app itself keeps open inside a foreground service with a
permanent notification. The app's WebView cannot use Web Push at all. Every option below is one of these two, or a
variation.

## 2. Facts verified (2026-09-30)

- **WebView has no Web Push / Notifications API** (Chromium issue 40443309, open feature request). The PWA in Chrome
  and the TWA keep Web Push; on Android, Chrome's Web Push itself travels through FCM (endpoint `fcm.googleapis.com`,
  already on `push.py`'s allow-list) with the payload encrypted end-to-end (RFC 8291). [CR-WV-NOTIF]
- **Doze and App Standby:** in Doze "network access suspended, wake locks ignored", alarms, jobs and syncs deferred to
  maintenance windows. The recommended way to reach a sleeping app is an FCM high-priority message. Exemption from
  battery optimisation is acceptable under Play policy for "chat/messaging that can't use FCM due to a technical
  dependency" and for safety apps, not for apps that could use FCM. [AND-DOZE] (updated 2026-08-18)
- **FCM priority:** "FCM attempts to deliver high priority messages immediately, allowing FCM to wake a sleeping device
  … and to run some limited processing"; the handler gets "several seconds". Over 7 days, if high-priority messages
  "consistently fail to generate user-visible notifications", they "may be deprioritized to normal priority". A
  high-priority FCM message is also an exemption that lets the app start a foreground service from the background.
  [FCM-PRIO] (updated 2026-09-24), [AND-FGS-BG]
- **FCM is not end-to-end encrypted:** TLS per hop only; Google recommends own encryption or "empty data messages …
  as a signal for the app to fetch the content directly from your servers". [FCM-E2E] (updated 2026-09-24)
- **FCM sending:** the HTTP v1 API with OAuth2 tokens from a service account of the Firebase project; the legacy server
  keys were shut down in mid-2024 (July 2024 final dates reported). FCM itself is "No-cost". The app needs the Firebase
  SDK and `google-services.json`; the phone needs Google Play services. [FCM-LEGACY], [FB-PRICING]
- **Precedent:** HA's Companion app uses FCM through HA's own relay (500 pushes per device per day; "no notification
  content is stored", but contents are not encrypted on Firebase and "could be processed by Google"). Its
  "minimal" build without Google services must keep a persistent WebSocket instead. [HA-COMP-NOTIF], [HA-MINIMAL]
- **Foreground services:** apps targeting Android 14 must declare a type and its permission; the candidates for a
  kept-open alert connection are `specialUse` (justification in the manifest, Play review), `remoteMessaging` (meant
  for text messages), `dataSync` (6 h per 24 h on Android 15, not startable from `BOOT_COMPLETED`). Play requires a
  declaration of FGS types. [AND-FGS-TYPES] (updated 2026-09-21), [AND-FGS-BG]. The HA Companion minimal build hit the
  Android 15 `dataSync` limit ("Time limit already exhausted for foreground service type dataSync"). [HA-5987]
- **Vendor battery killers:** dontkillmyapp ranks Xiaomi, Samsung, OnePlus, Huawei worst (5/5), Pixel / Android One /
  Nokia best; vendors kill background work regardless of Android's rules. (No date on the page.) [DKMA]
- **UnifiedPush:** a distributor app on the phone (ntfy, Sunup, NextPush, Conversations, or gCompat-UP which uses FCM)
  receives from its push server (ntfy and Sunup self-hostable) and hands messages to apps; the app server sends to a
  Web Push (RFC 8030) endpoint, encrypted per RFC 8291 with VAPID (RFC 8292) - the protocol `push.py` already speaks.
  [UP-DIST], [UP-SPEC]
- **Notifications:** Android 13 `POST_NOTIFICATIONS` runtime permission, off by default for new installs targeting 33+
  (foreground-service notifications are exempt from the drawer). Lock-screen visibility `PUBLIC` / `PRIVATE` (with a
  `setPublicVersion`) / `SECRET`, and the user can override per channel. Up to three actions. `IMPORTANCE_HIGH` =
  heads-up. Full-screen intents are limited to calling and alarm-clock apps from Android 14. [AND-NOTIF-PERM],
  [AND-NOTIF-BUILD] (updated 2026-09-23), [AND-14]

Assumptions: Cloudflare keeps long-lived WebSockets through the tunnel but closes them on edge restarts (option B must
reconnect with back-off); the Android 12+ `Notification.Action` "authentication required" flag is available for an
action that must not run from a locked screen.

## 3. What every option shares

- **Device registration** (shared with CR-011): at "enable notifications on this phone" the app creates a Keystore
  signing key **without** a user-authentication requirement (a background fetch cannot show a prompt) and registers
  `{device_id, public key, platform, push kind, push address}` with the Arx server under the signed-in user
  (`push_subscriptions.kind = fcm | unifiedpush | socket`). Background calls are signed with that key - the app never
  needs the HA refresh token outside the WebView.
- **Fetch:** `GET api/v1/push/device/pending` (signed) returns the device's pending notices, **re-checked against the
  user's current permissions** (`push.still_allowed`), categories and quiet hours of `push_prefs` (server-side, as today).
- **Multi-server:** each stored server in the app has its own registration and a random `server_ref`; a push says only
  `server_ref` (+ an opaque notice id), and the app maps it back to the server and fetches there. Notifications are
  grouped per server and titled with the server's name.
- **Sign-out / server removal / revocation:** sign-out deletes this device's registration on that server (best effort,
  and the server also drops registrations when the user's remote access, sessions ("sign out everywhere") or device are
  revoked); removing a server forgets its `server_ref`, so a late push for it is dropped.
- **Channels:** אזעקה (high, heads-up, sound), התראות (high), דלתות (default), תקלות (low), מערכת (low), matching
  `push.py`'s categories plus an `alarm` category for CR-010 events.
- **Lock screen:** `VISIBILITY_PRIVATE` with a public version that shows the category only (decision Q5).
- **Actions:** "פתח מצלמה" (opens the app on that server's camera) and "אישור" (acknowledge, signed call; requires
  unlocking the phone). **Never** disarm or unlock from a notification - those are CR-011 step-up actions.
- **Permission:** asked in context when the user turns on notifications for a server; if refused, a link to the system
  settings.

## 4. Options

### A. FCM with a content-less wake, then fetch from the customer's own server

Flow: rule fires → Arx server → **relay** → FCM (high priority, data only: `{s: server_ref, n: opaque id}`, TTL 1 h,
collapse per server) → app wakes → signed fetch from the Arx server through the tunnel → local notification.

- **What Google sees:** the app's FCM token, the Firebase project, timing, size and count of messages. Not the text,
  camera, site or user. (Push-to-sync as FCM's own documentation recommends.)
- **Deprioritisation:** every wake must end in a visible notification; when the fetch fails the app shows "התראה חדשה
  ב-<server> - פתח לצפייה" (Q4 offers an encrypted short text instead).
- **Needs:** one Firebase project owned by SmplWise, the Firebase Messaging SDK and `google-services.json` in the build
  (the app then depends on Google Play services on the phone; today it has no Google dependency, CR-008 §9 recorded
  "no Firebase until decided"), and a holder of the service-account credential:

| | Central SmplWise relay (recommended) | Credential in every customer's add-on |
|---|---|---|
| Where the credential lives | one place (e.g. a Cloudflare Worker secret) | every customer's `/data` |
| Leak impact | rotate once | one leaked add-on can send to **every** SmplWise app install; rotation breaks every site until updated |
| Cross-customer isolation | the relay stores FCM tokens and gives each installation opaque handles; an installation can wake only its own handles | none - the credential is project-wide |
| Privacy | relay sees installation id, handle, time, count; no content | no third party besides Google |
| Operations | a small service to run and monitor; if it is down, no app push (PWA Web Push unaffected) | nothing central, but secrets distribution and updates per site |
| Authentication of the add-on | installation key (Ed25519) registered at provisioning (CR-008 D14 registry) | n/a |

- **Reliability:** the best Android offers on Google phones; vendor killers affect FCM far less than own services.
  Not available on phones without Google Play services.
- **Effort:** app 3-4 d (SDK, service, device key, fetch, channels, actions, per-server switch, permission); relay
  2-3 d (Worker, handles, installation keys, rate limits, tests); server 2 d (registration kind, relay client,
  pending endpoint, revocation hooks). **≈ 7-9 d**, plus the owner's Firebase project set-up (≈ 1 h).

### B. Foreground service holding a WebSocket to each Arx server

- **No external service.** A permanent status-bar notification ("Arx מחובר") while it runs; one socket per server,
  pings, back-off reconnect, network-change handling; the socket carries the same notices (signed with the device key).
- **Costs:** battery (radio kept awake by pings; not measured by us); vendor killers still stop it on the worst-ranked
  brands unless the user exempts the app per phone; Android 14+ needs an FGS type - `specialUse` fits best, which on
  Google Play means a declaration and review (sideloading avoids Play policy, not the OS rules); `dataSync` is capped at
  6 h/day on Android 15. The HA Companion minimal build shows these problems in practice.
- **Effort:** app 4-5 d, server 1-2 d; **≈ 5-7 d**, plus per-brand battery guides.

### C. UnifiedPush

- The user installs a distributor (ntfy recommended); the site runs its own push server (e.g. ntfy) or uses a public
  one. The app registers through the UnifiedPush connector and gives Arx a Web Push endpoint + keys; **Arx sends with
  the existing `push.py`** (RFC 8291 encryption, VAPID) - only the endpoint allow-list needs a per-site entry for the
  configured push server.
- **Privacy:** content encrypted end-to-end; with a self-hosted push server no third party at all.
- **Costs:** a second app on the phone and a push server to run; the distributor itself faces the same Doze / vendor
  limits as B (it holds the connection instead of Arx). Suited to privacy-minded sites and phones without Google
  services.
- **Effort:** app 2-3 d, server 1 d, installer ≈ 0.5 d per site for ntfy; **≈ 3-4 d**.

### D. Web Push in the PWA only, none in the app

- **Zero effort;** it exists (CR-008 P3). Users who need notifications install the PWA from Chrome next to (or instead
  of) the app. It still travels through Google's FCM on Android, encrypted. The app keeps its notice that it has no
  notifications. Two icons for one product is the cost.

### Summary

| | External party | Works without Google services | Battery / killers | Status-bar icon | Effort |
|---|---|---|---|---|---|
| A FCM + relay | Google (metadata), SmplWise relay (metadata) | no | best | no | 7-9 d |
| B socket service | none | yes | worst | yes, permanent | 5-7 d |
| C UnifiedPush | the push server's operator (can be the site) | yes | as B, in the distributor | in the distributor | 3-4 d |
| D PWA only | Google (encrypted) | Chrome needs it too | best | no | 0 |

## 5. Recommendation

- **Primary: A** with the central SmplWise relay and content-less wakes. It is how Android is built to deliver
  urgent notices, it needs no battery exemptions, and Google and the relay see metadata only.
- **Fallback: C** for sites or phones without Google services or with a no-third-party requirement - cheap because the
  server already speaks Web Push. B only if a site can neither use FCM nor run a distributor.
- **Order:** device registration (shared with CR-011, 2 d) → relay + app + server (A) → C.
- D remains available at all times.

## 6. Security notes

- The relay never receives content, user names or site names; its log keeps counts. Installation keys can be revoked
  per customer. Per-device rate limit (e.g. 500 / day, the Companion figure) and per-installation limits.
- A forged wake can only make the app fetch from its own stored server, which answers "nothing pending"; the app then
  shows nothing new beyond the generic notice (rate-limited).
- The device key is per phone and per server; removing the device on the server stops fetches immediately.

## 7. Out of scope

iOS (APNs), Google Play publication itself, WisKey door calls as a category (CR-008 §7.1 item 2).

## 8. Owner steps (if A)

Create a Firebase project under the SmplWise Google account, add the Android app `com.smplwise.arx.app`, download
`google-services.json` (kept out of Git), create a service account key for the relay (kept in the relay's secret store
only).

## 9. Decisions for the owner

1. Main path for app notifications: (a) FCM with a content-less wake through a SmplWise relay [recommended]; (b) a
   permanent connection (foreground service); (c) UnifiedPush; (d) Web Push in the PWA only.
2. Where the FCM credential lives (if 1a): (a) one central SmplWise relay [recommended]; (b) in every customer's add-on.
3. Fallback for sites without Google services: (a) UnifiedPush [recommended]; (b) the permanent-connection mode;
   (c) none.
4. When the phone cannot reach the Arx server at wake time: (a) a generic "new alert - open" notification
   [recommended]; (b) the wake carries a short text encrypted end-to-end for the device, so the full text shows.
5. Lock screen: (a) nothing beyond "Arx"; (b) the category only ("אזעקה", "דלת") [recommended]; (c) full text with
   camera / zone.
6. Actions on a notification: (a) open camera + acknowledge (acknowledge needs the phone unlocked) [recommended];
   (b) open only.
7. Alarm channel: (a) high importance with sound (heads-up) [recommended]; (b) also ask the user to let it through
   Do Not Disturb.
8. Firebase project owner: (a) the SmplWise Google account [recommended]; (b) a separate account.

## Sources (read 2026-09-30)

- [CR-WV-NOTIF] https://issues.chromium.org/issues/40443309
- [AND-DOZE] https://developer.android.com/training/monitoring-device-state/doze-standby (updated 2026-08-18)
- [FCM-PRIO] https://firebase.google.com/docs/cloud-messaging/android/message-priority (updated 2026-09-24)
- [FCM-E2E] https://firebase.google.com/docs/cloud-messaging/encryption (updated 2026-09-24)
- [FCM-LEGACY] https://expo.dev/blog/fcm-v1-migration-deadline-changed-to-july-20th (legacy API end dates, 2024)
- [FB-PRICING] https://firebase.google.com/pricing
- [HA-COMP-NOTIF] https://companion.home-assistant.io/docs/notifications/notification-details/
- [HA-MINIMAL] https://companion.home-assistant.io/docs/notifications/notification-local/
- [HA-5987] https://github.com/home-assistant/android/issues/5987 (2025-11-01)
- [AND-FGS-TYPES] https://developer.android.com/develop/background-work/services/fgs/service-types (updated 2026-09-21)
- [AND-FGS-BG] https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- [DKMA] https://dontkillmyapp.com/
- [UP-DIST] https://unifiedpush.org/users/distributors/
- [UP-SPEC] https://unifiedpush.org/developers/spec/definitions/ and https://unifiedpush.org/developers/spec/android/
- [AND-NOTIF-PERM] https://developer.android.com/develop/ui/views/notifications/notification-permission
- [AND-NOTIF-BUILD] https://developer.android.com/develop/ui/views/notifications/build-notification (updated 2026-09-23)
- [AND-14] https://developer.android.com/about/versions/14/behavior-changes-14
