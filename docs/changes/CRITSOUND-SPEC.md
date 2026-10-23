# CRITSOUND - critical safety sound that bypasses Do Not Disturb (wire spec for the mobile teams)

Status: **PARTLY BUILT**: server slice and relay (FCM data keys, iOS flag ignored) are built; app behaviour and the iOS critical variant
stay PROPOSED/OPEN. Owner decisions 24.10 are recorded in section 8. Branch `pilot/CRITSOUND124B-295`
(server slice `a92112175`, merged onto release/2160). Board items r124. Origin: CR-018 owner decision 7 ("critical sound that overrides
do-not-disturb only for safety events"; `docs/changes/CR-018-NOTIFICATIONS.md` sections 6.3 and 12).

How to read this document. Every statement is tagged:

- **[BUILT]** exists in the server code of this branch and is covered by `smplwise_vms/backend/tests/test_critical_sound.py`.
- **[PROPOSED]** what the apps (and later phases) would have to do. Nothing of it exists in `mobile/` or the iOS project at the
  time of writing; the relay part is built (sections 3, 4). Platform behaviour named here is the mobile teams' to confirm against Apple and Google documentation
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

## 3. Relay to iOS (APNs) [BUILT as "ignore the flag"; Critical Alerts PROPOSED for a later phase]

Owner decision 24.10: **iOS gets no Critical Alerts in phase 1.** [BUILT, branch `pilot/CRITRELAY217-295`] `services/push-relay/src/apns.ts`
accepts the request but ignores `critical_alert` and `resolved_tone`: a flagged push is the same normal time-sensitive push as before
(`sound: "default"`, `interruption-level: time-sensitive` for `priority: high`), byte-identical to an unflagged one (unit-tested). No
entitlement is needed or requested; `Release.entitlements` stays as is (IOS-9 unchanged).

[PROPOSED, later phase, not built] When the owner reopens it: `aps["interruption-level"] = "critical"` and
`aps.sound = { "critical": 1, "name": "default", "volume": 1.0 }` for a flagged push, which needs Apple's
`com.apple.developer.usernotifications.critical-alerts` entitlement (granted per developer account on request) and an authorization
request with the critical-alert option in the app. A calming tone for a resolved update on iOS would need a bundled sound file
[OPEN, later phase].

## 4. Relay to Android (FCM) [relay BUILT; app side PROPOSED, mobile team]

[BUILT] `services/push-relay/src/fcm.ts` (data-only message, `priority: HIGH` as before):

- Request `critical_alert: true` adds `critical_alert: "1"` to the FCM `data` map (FCM data values are strings). Absent or `false`
  leaves the map exactly as before (the key is never sent as `"0"`).
- Request `resolved_tone: true` adds `resolved_tone: "1"`: the calming-tone flag for a resolved update (owner decision 24.10: a
  resolved update plays a short calming tone). It is never combined with `critical_alert` (if both arrive, only `critical_alert` is sent).
- Validation in `index.ts` (`POST /v1/push`): both members are optional and strictly boolean; anything else (a string `"true"`, `1`,
  `null`, an object) is `400 bad_request` before any upstream call. Default when absent: `false`.

[PROPOSED, the mobile team's work, documented only; nothing of it exists in `mobile/`]:

- A flagged push is posted by the app on a dedicated notification channel, working name `safety_critical`, importance high,
  alarm-style sound; all other pushes keep their channel. A push with `resolved_tone` plays the short calming tone (own channel or
  sound; the app replaces/stops the alert using `mode: "resolved"` from `GET notifications/app/{message_id}`).
- Bypassing Do Not Disturb on Android is a per-channel setting the **user** controls. Owner decision 24.10: (a) a **one-time guidance
  screen** when the owner enables the capability, leading to the channel's "override Do Not Disturb" setting, and (b) a **switch in
  the app's own settings** that shows whether it is enabled. The Android team confirms the exact API and permission names.

## 4a. Server gap [OPEN, not built in this slice]

The server currently sends `critical_alert` (section 1.4) but does **not** yet send `resolved_tone`: today the relay request carries
no resolved marker (a `resolved` push is an ordinary quiet notification, section 2). To get the calming tone the server's
`send_relay` must add `"resolved_tone": true` for `mode == "resolved"` (and a Settings switch, default OFF, if the owner wants it
configurable). That is a server slice; until then the relay support is dormant and harmless.

## 5. Contract changes this implies [PROPOSED]

- `docs/api/mobile-presence-contract.md` section 8 (`POST /v1/push`): add optional booleans `critical_alert` and `resolved_tone` to the
  request body (relay behaviour as in sections 3 and 4). Not edited by this slice.
- Section 7.3: describe the Android data members `critical_alert` / `resolved_tone` (and, later, the iOS critical variant).
- Mobile apps: no new server route is needed. [OPEN] whether the app wants to read the owner's choice (for a settings screen) from a
  device-token route; today only a user with notification settings access reads `GET /notify/settings`.

## 6. What the owner sees [BUILT, partly]

The server setting and its validation exist. The Settings screen still shows the old disabled row "critical sound that overrides do not
disturb" marked "coming soon" (`frontend/src/screens/system-notifications.ts`); the per-type toggles are **not** built. Settings UI is
a separate slice.

## 7. Safety limits (by design) [BUILT]

OFF by default (master and each type); only five safety types; never for resolved notices; never for any other category; the rule is a
single pure function with unit tests; the flag adds no text and no personal data to the relay request.

## 8. Owner decisions (24.10) and what is still open

1. Apple critical alerts: **decided, not in phase 1.** iPhones get the normal time-sensitive push; the relay ignores the flag for iOS.
   Applying for the entitlement is a later phase [OPEN, later].
2. Water leak on the list: unchanged, the code lists all five types, each off until chosen [OPEN: owner picks in Settings].
3. Resolved update: **decided, a short calming tone.** Relay: `resolved_tone` -> FCM data key [BUILT]; server sending it [OPEN, 4a];
   the tone itself in the app [PROPOSED, mobile team]; iOS tone [OPEN, later].
4. Android guidance: **decided, a one-time guidance screen when the owner enables the capability plus a switch in the app's own
   settings** [PROPOSED, mobile team, documented only].

## 9. Test evidence for this branch

See the final report of the branch. Server tests are in `smplwise_vms/backend/tests/test_critical_sound.py` (5 tests) and
`smplwise_vms/backend/tests/test_notify_core.py` (settings round trip). Relay (`services/push-relay/test/relay.test.ts`, vitest, 4 new tests: FCM flag, resolved tone, strict boolean validation, iOS payload
unchanged): built and run on this branch. Android app and iOS app behaviour: **NOT_BUILT / NOT_RUN**; real FCM/APNs: **NOT_RUN** (fakes only).
