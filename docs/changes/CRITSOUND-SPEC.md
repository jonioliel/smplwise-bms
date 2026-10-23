# CRITSOUND - critical safety sound that bypasses Do Not Disturb (wire spec + binding Android client contract)

Status: **BUILT on the server and the relay; Android client contract BINDING (section 5); iOS: no Critical Alerts in phase 1.**
Server slices: `pilot/CRITSOUND124B-295` (the `critical_alert` flag and its settings) and `pilot/CRITSERVER217-295` (the `resolved_tone`
marker, its Settings switch, and the app-readable `critical_sound` view). Relay: `pilot/CRITRELAY217-295`. **First server version that
sends `critical_alert`, `resolved_tone` and returns `critical_sound`: 2.17.0** (none of it is in 2.16.x or older; an earlier revision of this
document said the first slice was merged onto release/2160, which was wrong: it was not). Origin: CR-018 owner decision 7 ("critical
sound that overrides do-not-disturb only for safety events"; `docs/changes/CR-018-NOTIFICATIONS.md` sections 6.3 and 12). Owner
decisions 24.10 are recorded in section 8.

How to read this document. Every statement is tagged:

- **[BUILT]** exists in the server / relay code and is covered by `smplwise_vms/backend/tests/test_critical_sound.py` or
  `services/push-relay/test/relay.test.ts`.
- **[BINDING]** the Android app's contract (section 5). The app team builds exactly this; a deviation is a contract change request,
  not a judgement call. Android API names are given to make the intent unambiguous; the Android team verifies them against Google's
  documentation for each supported Android version and reports a mismatch instead of silently substituting behaviour.
- **[LATER]** explicitly out of phase 1 (iOS Critical Alerts, an iOS resolved tone).

## 1. What the server does [BUILT]

1. Settings (Settings > Notifications, stored in `notify_settings.companion_json`, **no migration**):
   - `companion.critical_sound_safety` - master switch, boolean, default **OFF**.
   - `companion.critical_sound_types` - an object with exactly the five keys below, each boolean, default **OFF**; a missing or garbled
     value reads as `false`.
   - `companion.resolved_tone` - boolean, the calming tone of a resolved update. Owner decision 24.10: switchable, **ON by default once
     the capability is enabled**. Stored default `true` (a missing or garbled value reads `true`), but it has no effect unless the master
     switch and the event type are on, which are OFF by default; so out of the box nothing is ever sent.
2. Event types that may ever carry the flag (notification `source`), all of category `safety` and severity `critical`:
   `sensor.smoke`, `sensor.gas`, `sensor.co`, `alarm.triggered`, `sensor.leak` (leak is listed, OFF until the owner picks it). Any other
   key in a PUT is refused `422`. `PUT /notify/settings` with `{"companion": {...}}`: a partial update keeps whatever is not named;
   unknown fields, a non-boolean value or a non-object `422 validation`.
3. The rule (`notify_settings.critical_sound_for`): the flag is set **only if** the master switch is on **and** this event type is on
   **and** `category == "safety"` **and** `severity == "critical"` **and** the push is not a `resolved` notice.
4. The resolved rule (`notify_settings.resolved_tone_for`): a `resolved` push carries the calming-tone marker **only if** the rule of 1.3
   holds for that notification (ignoring the "not resolved" clause) **and** `companion.resolved_tone` is on. So the tone only ever
   follows an event whose first notice could have carried `critical_alert`.
5. Server to relay: `POST <relay>/v1/push` gets at most one extra JSON member: `"critical_alert": true` (first notice / escalation) or
   `"resolved_tone": true` (resolved update). Never both, never `false`: when the rule says no the member is **absent**, so a relay that
   has not been updated sees the request it always saw. Full body when set:
   `{relay_token, category, notification_id, priority, server, collapse, critical_alert | resolved_tone}`. `priority` is unchanged
   (`"high"` for critical or escalation).
6. The decision travels with the delivery job, so a retry after a `5xx` or `429` repeats the same decision (it is not re-evaluated against
   later settings changes; the job is dropped on re-check if the notification is resolved or no longer open for an escalation).

## 2. Which pushes carry what [BUILT]

| Push | `mode` | `critical_alert` | `resolved_tone` |
|---|---|---|---|
| First notice of a matching safety event | `new` | yes, when rule 1.3 holds | never |
| Escalation step while still open and unacknowledged | `escalate` | yes, same rule | never |
| "Resolved" update (the condition ended; only to those who were told) | `resolved` | never | yes, when rule 1.4 holds |
| Non-matching types, non-safety categories, severity below critical, capability off | any | never | never |

A resolved update is otherwise an ordinary push. An acknowledged or resolved notice is not escalated again. Quiet hours: unchanged; a
critical notice passes quiet hours by default (pass-through matrix, critical row on); if an administrator switches that off, the app push
is **held** and nothing is sent. The flags never override the server's own holding rules.

`GET notifications/app/{message_id}` is unchanged: it carries `mode` and `severity` (contract `docs/api/mobile-presence-contract.md`
section 7.2) but no flag. The app decides the alert style from the push data itself and uses `mode: "resolved"` from the fetch as a
confirmation.

## 3. Capability discovery for the app [BUILT]

`GET notifications/categories` (device token or session; already called by the app; allowed while the presence gate blocks a user) gains
one read-only member:

```json
{ "categories": [ … unchanged … ],
  "critical_sound": { "enabled": true, "types": ["sensor.smoke", "sensor.gas"], "resolved_tone": true } }
```

- `enabled` = the master switch is on **and** at least one event type is chosen (i.e. some push of this server may carry
  `critical_alert`). Master on with no type chosen is `false`.
- `types` = the chosen event types in the fixed order of section 1.2; `[]` whenever `enabled` is `false`.
- `resolved_tone` = `enabled` **and** the owner's resolved-tone switch.
- Only booleans and event-type names; no other setting, no user, no address. Absent on servers older than 2.17.0: the app treats an
  absent member exactly as `{ "enabled": false, "types": [], "resolved_tone": false }`.

## 4. Relay [BUILT]

`services/push-relay/src/index.ts` (`POST /v1/push`): `critical_alert` and `resolved_tone` are optional, strictly boolean (a string
`"true"`, `1`, `null`, an object is `400 bad_request` before any upstream call); default `false`.

- **Android (FCM)**, `src/fcm.ts`, data-only message, `priority: HIGH` as before: `critical_alert: true` adds data key
  `critical_alert: "1"`; `resolved_tone: true` adds `resolved_tone: "1"`. Absent / `false` leaves the map exactly as before (never `"0"`).
  If both arrive (the server never sends both) only `critical_alert` is sent.
- **iOS (APNs)**, `src/apns.ts`: both flags are **ignored** (owner decision 24.10, no Critical Alerts in phase 1): a flagged push is
  byte-identical to an unflagged one (`sound: "default"`, `interruption-level: time-sensitive` for `priority: high`). No entitlement is
  requested; `Release.entitlements` stays as is (IOS-9 unchanged).

## 5. Android client contract [BINDING]

### 5.1 Inputs

| Input | Where | Meaning |
|---|---|---|
| `critical_alert == "1"` | FCM data | this push may use the critical channel (5.2) |
| `resolved_tone == "1"` | FCM data | this push is the resolved update of a critical event: calming tone (5.4) |
| any other value, or key absent | FCM data | ordinary push, existing behaviour; never treated as critical |
| `critical_sound` | `GET notifications/categories`, per server | capability state (section 3) |

Pushes are attributed to a server by the existing `server` data key; capability state is kept **per server_id**.

### 5.2 Notification channels

Two new channels, created at app start (and in any case before the explanation screen opens system settings, since a channel must exist
to be shown there). Channel ids are fixed and are never renamed or reused: Android binds the user's choices (including the Do Not Disturb
override) to the id, and an app cannot change a channel's sound after creation. A future sound change ships under a new id with a version
suffix (`safety_critical_v2`) and deletes the old one.

| Channel id | Name (Hebrew, app String Catalog) | Importance | Sound | DND |
|---|---|---|---|---|
| `safety_critical` | "חירום בטיחות" | `IMPORTANCE_HIGH` | the app's bundled alarm-style tone, `AudioAttributes.USAGE_ALARM`; vibration on; plays once (no looping / `FLAG_INSISTENT` in phase 1; repeated escalation pushes repeat it) | the app calls `setBypassDnd(true)` when creating it; whether DND is actually bypassed is the **user's** setting (5.3) |
| `safety_resolved` | "סיום אירוע בטיחות" | `IMPORTANCE_DEFAULT` | the app's bundled short calming tone (at most about 2 seconds), `USAGE_NOTIFICATION`; no vibration | no bypass; respects Do Not Disturb |

All other pushes keep their existing channels. Lock-screen visibility: the existing rule (generic text until the text fetch; the server's
lock-screen level decides the fetched text). No full-screen intent in phase 1 (it needs a separately granted permission on recent Android
versions; not part of this contract).

### 5.3 The in-app switch and Do Not Disturb

The app's own settings screen shows one row, **"צליל חירום עוקף 'נא לא להפריע'"**, only while at least one registered server reports
`critical_sound.enabled: true` (hidden otherwise, and on iOS).

- **App preference** `critical_sound_on` (stored on the phone, default **ON** the first time the row appears).
- **System state**, re-evaluated on every `onResume` of the settings screen and before posting a flagged push (the user changes it outside
  the app): notifications allowed (`POST_NOTIFICATIONS` granted on Android 13+, `areNotificationsEnabled()`), channel `safety_critical`
  not blocked (importance not `NONE`), and the channel allowed to bypass Do Not Disturb (`NotificationChannel.canBypassDnd()`).
- **What the row shows**: ON only when the preference is ON **and** all system conditions hold. The app never shows ON when the system
  does not allow it.
- **Permission missing** (preference ON, a system condition fails): the row shows OFF with one short line, "נדרש אישור בהגדרות
  הטלפון", and tapping it leads to the fix, in this order: request `POST_NOTIFICATIONS` if not granted and still requestable; otherwise
  open the app's notification settings (`Settings.ACTION_APP_NOTIFICATION_SETTINGS`) if notifications are off; otherwise open the
  channel's settings (`Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS` with `EXTRA_CHANNEL_ID = safety_critical`) where the user allows the
  Do Not Disturb override. If a supported Android version has no per-channel override, the app opens the system Do Not Disturb settings
  instead (the Android team names the intent per version). The app does **not** request notification-policy access
  (`ACCESS_NOTIFICATION_POLICY`) and never changes the phone's Do Not Disturb mode.
- **User turns the row OFF**: the preference becomes OFF; flagged pushes are posted on the existing safety channel (still high
  importance, never dropped: `safety` is a critical category, contract section 7.3), without the alarm tone and without bypass. The app
  does not tell the server (no server route; phase 1).

### 5.4 Posting rules

1. `critical_alert == "1"` and the effective state of 5.3 is ON: post on `safety_critical` immediately with the generic text, then fetch
   `GET notifications/app/{notification_id}` (the data key `notification_id` is the per-device message id) and update the same posted
   notification with the text. Once fetched, the app tags the posted notification with the fetch's `notification_id` (the server's
   event id; it is the same for the first notice, every escalation and the resolved update of one event). If the effective state is
   OFF: post on the existing safety channel (5.3, last bullet).
2. `resolved_tone == "1"`: fetch the text as for every push; cancel the shown critical notification whose tag equals the fetch's
   `notification_id`, and post the update on `safety_resolved` (if the fetch fails: post the generic text on `safety_resolved` and cancel
   nothing). This tone is controlled by the server switch (`resolved_tone`) and by the
   user's own system settings for that channel; there is no separate in-app switch for it. If the user turned the critical row OFF (5.3),
   the resolved update is still posted on `safety_resolved` (a calm tone that respects Do Not Disturb).
3. No marker: existing behaviour, unchanged. A `mode: "resolved"` fetch without `resolved_tone` is an ordinary quiet update.
4. A push from a server whose `critical_sound.enabled` is `false` but that carries `critical_alert == "1"` (the state changed between the
   push and the last refresh) is still honoured: the push decides, the capability view only drives the UI.

### 5.5 One-time explanation screen

- Refresh `GET notifications/categories` per server at app start, after `POST notifications/devices`, and when the app comes to the
  foreground (at most once every 15 minutes per server).
- When a server reports `enabled: true` and the phone has not yet shown the screen **for that server_id**, show it once (stored per
  server_id per install). It names the chosen event types in Hebrew (`sensor.smoke` "עשן", `sensor.gas` "גז", `sensor.co` "פחמן
  חד-חמצני", `alarm.triggered` "אזעקה", `sensor.leak` "הצפה"), explains that these alerts can sound even in "נא לא להפריע" if allowed,
  and offers two buttons: "לאישור בהגדרות" (runs the fix path of 5.3) and "לא עכשיו". Either answer marks it shown; the settings row
  stays available. It is not shown again when the capability is switched off and on again.
- `enabled: false` (or absent) never shows the screen and hides the row once no server is enabled; the preference is kept.

### 5.6 iOS [BINDING for phase 1]

No Critical Alerts: no entitlement, no critical-alert authorization request, no switch, no explanation screen. The iOS app ignores
`critical_sound`. Pushes arrive as the normal time-sensitive push (section 4).

### 5.7 Server compatibility

| Server | `critical_alert` | `resolved_tone` | `critical_sound` member |
|---|---|---|---|
| 2.16.x and older | never sent | never sent | absent (treat as disabled) |
| 2.17.0 and newer | per rule 1.3 | per rule 1.4 | present |

## 6. What the owner sees [PARTLY BUILT]

The server settings and their validation exist (`companion.critical_sound_safety`, `companion.critical_sound_types`,
`companion.resolved_tone`). The Settings screen still shows the old disabled row "critical sound that overrides do not disturb" marked
"coming soon" (`frontend/src/screens/system-notifications.ts`); the per-type toggles and the resolved-tone switch are **not** built in the
UI yet. Settings UI is a separate slice.

## 7. Safety limits (by design) [BUILT]

OFF by default (master and each type); only five safety types; `critical_alert` never on resolved notices, `resolved_tone` only on resolved
notices of a qualifying event; never for any other category; the rules are pure functions with unit tests; the flags add no text and no
personal data to the relay request; the app-readable view carries booleans and event-type names only.

## 8. Owner decisions (24.10)

1. Apple critical alerts: **not in phase 1.** iPhones get the normal time-sensitive push; the relay ignores the flags for iOS. Applying for
   the entitlement is a later phase [LATER].
2. Water leak: listed, **OFF by default**, the owner picks it in Settings like the other four.
3. Do Not Disturb is bypassed only for the types configured in notification settings (`companion.critical_sound_types`) and only where the
   phone's user allowed it (section 5.3).
4. Resolved update: **a short calming tone, switchable** (`companion.resolved_tone`, ON by default once the capability is enabled). Server
   sends it from 2.17.0 [BUILT]; relay [BUILT]; Android app [BINDING, 5.4]; iOS tone [LATER].
5. Android guidance: **a one-time explanation screen when the owner enables the capability, plus a switch in the app's own settings**
   [BINDING, 5.3 / 5.5].

## 9. Test evidence

Server: `smplwise_vms/backend/tests/test_critical_sound.py` (9 tests: defaults, the flag rule, validation, resolved tone on the wire, the
resolved rule, the categories view) and `test_notify_core.py` (settings round trip). Relay: `services/push-relay/test/relay.test.ts`
(vitest: FCM flag, resolved tone, strict boolean validation, iOS payload unchanged). Android and iOS app behaviour: **NOT_BUILT /
NOT_RUN** in this repository; real FCM / APNs: **NOT_RUN** (fakes only). Exact counts are in the branch reports.
