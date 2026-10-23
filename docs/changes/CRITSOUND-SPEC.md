# CRITSOUND - critical safety sound that bypasses Do Not Disturb (wire spec for the mobile teams)

Status: **PROPOSED** (not approved, not binding until the owner signs the open questions in section 8). Branch `pilot/CRITSOUND124B-295`
(server slice `a92112175`, merged onto release/2160). Board items r124. Origin: CR-018 owner decision 7 ("critical sound that overrides
do-not-disturb only for safety events"; `docs/changes/CR-018-NOTIFICATIONS.md` sections 6.3 and 12).

How to read this document. Every statement is tagged:

- **[BUILT]** exists in the server code of this branch and is covered by `smplwise_vms/backend/tests/test_critical_sound.py`.
- **[PROPOSED]** what the relay and the apps would have to do. Nothing of it exists in `services/push-relay/`, `mobile/` or the iOS
  project at the time of writing. Platform behaviour named here is the mobile teams' to confirm against Apple and Google documentation
  before they build; this document does not certify it.
- **[OPEN]** a decision nobody has taken.

## 1. What the server does today [BUILT]

1. Setting (Settings > Notifications, stored in `notify_settings.companion_json`, **no migration**, default **OFF**):
   `companion.critical_sound_safety` (master switch, boolean) and `companion.critical_sound_types` (an object with exactly the five
   keys below, each boolean; a missing or garbled value reads as `false`).
2. Event types that may ever carry the flag (notification `source`), all of category `safety` and severity `critical`:
   `sensor.smoke`, `sensor.gas`, `sensor.co`, `alarm.triggered`, `sensor.leak`. Any other key in a PUT is refused `422`.
   `PUT /notify/settings` with `{"companion": {...}}`: a partial update keeps whatever is not named; unknown fields, a non-boolean
   value or a non-object `422 validation`.
3. The rule (`notify_settings.critical_sound_for`): the flag is set **only if** the master switch is on **and** this event type is
   on **and** `category == "safety"` **and** `severity == "critical"` **and** the push is not a `resolved` notice.
4. Server to relay: `POST <relay>/v1/push` gets one extra JSON member, `"critical_alert": true`. When the rule says no, the member is
   **absent** (never `false`), so a relay that has not been updated sees the request it always saw. Full body when set:
   `{relay_token, category, notification_id, priority, server, collapse, critical_alert}`. `priority` stays `"high"` (critical or
   escalation), as before.
5. The flag travels with the delivery job, so a retry after a `5xx` or `429` repeats the same decision (it is not re-evaluated against
   later settings changes; the job is dropped on re-check if the notification is resolved or no longer open for an escalation).

## 2. Which pushes carry it (resolve and escalation) [BUILT]

| Push | `mode` | Flag |
|---|---|---|
| First notice of a matching safety event | `new` | yes, when the rule in 1.3 holds |
| Escalation step while the notice is still open and unacknowledged | `escalate` | yes, same rule (escalation is never muted and bypasses the app rate limit, as before) |
| "Resolved" quiet update (the condition ended) | `resolved` | **never** |
| Non-matching types, non-safety categories, a severity downgraded below critical | any | never |

Consequences the apps can rely on: a `resolved` push is an ordinary quiet notification; an acknowledged or resolved notice is not
escalated again (the existing escalation timer stops on acknowledge). Quiet hours: unchanged. A critical notice passes quiet hours by
default (pass-through matrix, critical row on); if an administrator switches that off, the app push is **held** and no flag is sent.
The flag never overrides the server's own holding rules.

What the phone fetches (`GET notifications/app/{message_id}`) is unchanged by this slice: it carries `mode` and `severity`
(contract `docs/api/mobile-presence-contract.md` section 7.2) but **no** critical-alert member. The apps decide the alert style from
the push itself (section 3 / 4) and use `mode: "resolved"` from the fetch to stop or replace an alert.

## 3. Relay to iOS (APNs) [PROPOSED]

Not implemented: `services/push-relay/src/apns.ts` today sends `sound: "default"` and `interruption-level: time-sensitive` for
`priority: high` and ignores `critical_alert`. Proposed relay change when the request carries `critical_alert: true` and the
registered platform is iOS:

- `aps["interruption-level"] = "critical"`, and `aps.sound = { "critical": 1, "name": "default", "volume": 1.0 }` instead of the
  plain `"default"` string. All other members (generic title/body, `mutable-content: 1`, `thread-id`, `notification_id`, `category`,
  `server`) stay exactly as in contract section 7.3. Still no notification text through Apple.
- Without the flag: unchanged behaviour.
- Entitlement: Apple's Critical Alerts need the `com.apple.developer.usernotifications.critical-alerts` entitlement, which Apple grants
  on request per developer account. The app must also request authorization with the critical-alert option. The current
  `Release.entitlements` has none, and `CODEX_FIX_LIST_MOBILE_2026-10-06_HE.md` (item IOS-9) explicitly says not to add it until it
  is in the contract. Until Apple grants it, a `critical` interruption level is expected to fall back to ordinary delivery (a
  platform behaviour the iOS team must confirm), so enabling the setting on the server before the entitlement exists is harmless but
  does nothing.
- The Notification Service Extension needs no change for the flag (it modifies text only); whether it needs the entitlement too is
  for the iOS team to confirm.

## 4. Relay to Android (FCM) [PROPOSED]

Not implemented: `services/push-relay/src/fcm.ts` sends a data-only message (`priority: HIGH`) and ignores `critical_alert`.
Proposed:

- With the flag: add `critical_alert: "1"` to the FCM `data` map (FCM data values are strings). Without the flag the member is absent.
- The Android app (data-only message, so the app builds the notification itself) posts a flagged push on a dedicated notification
  channel, working name `safety_critical`, importance high, alarm-style sound, and all other pushes keep their current channel.
- Bypassing Do Not Disturb on Android is a per-channel setting the **user** controls (channel option "override Do Not Disturb", and the
  app asking for notification-policy access if it wants to set it itself). The app must therefore guide the user to enable it, and
  show in its own settings whether it is enabled. The Android team confirms the exact API and permission names.

## 5. Contract changes this implies [PROPOSED]

- `docs/api/mobile-presence-contract.md` section 8 (`POST /v1/push`): add optional `critical_alert: true` to the request body.
- Section 7.3: describe the critical-alert variant of the payload (section 3 and 4 above).
- Mobile apps: no new server route is needed. [OPEN] whether the app wants to read the owner's choice (for a settings screen) from a
  device-token route; today only a user with notification settings access reads `GET /notify/settings`.

## 6. What the owner sees [BUILT, partly]

The server setting and its validation exist. The Settings screen still shows the old disabled row "critical sound that overrides do not
disturb" marked "coming soon" (`frontend/src/screens/system-notifications.ts`); the per-type toggles are **not** built. Settings UI is
a separate slice.

## 7. Safety limits (by design) [BUILT]

OFF by default (master and each type); only five safety types; never for resolved notices; never for any other category; the rule is a
single pure function with unit tests; the flag adds no text and no personal data to the relay request.

## 8. Open questions for the owner (plain wording)

1. Do you have, or want to apply for, Apple's permission for "critical alerts" for the phone app? Apple decides, and it can take time.
   Without it, iPhones get the normal urgent notification, not the one that breaks through Do Not Disturb.
2. Should a water leak be on the list of sounds that break through Do Not Disturb, or only fire, gas, carbon monoxide and the alarm panel?
   (The code lists all five; each is off until chosen.)
3. Should the "resolved" update be completely quiet on phones that were sounding the alarm, or should it also play a short calming tone?
4. On Android, who guides the user to allow the app to override Do Not Disturb: a one-time screen when the owner switches this on, or only
   the app's own settings?

## 9. Test evidence for this branch

See the final report of the branch. Server tests are in `smplwise_vms/backend/tests/test_critical_sound.py` (5 tests) and
`smplwise_vms/backend/tests/test_notify_core.py` (settings round trip). Relay, iOS and Android behaviour: **NOT_RUN / NOT_BUILT**.
