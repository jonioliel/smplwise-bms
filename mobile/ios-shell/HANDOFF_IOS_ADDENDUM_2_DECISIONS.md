# iOS addendum 2 — owner decisions of 2026-10-05 and what changes for Codex

For the Codex session on the owner's Mac. Read after `HANDOFF_IOS_CODEX.md` and `HANDOFF_IOS_ADDENDUM_SENSORS_PUSH.md` (addendum 1).
Where this file disagrees with those, **this file wins**. The root `AGENTS.md` still governs everything.

## 1. Decisions (owner, 2026-10-05)

| # | Decision | Effect on the app |
|---|---|---|
| D1 | **Sensors in v1: all** sensors listed in addendum 1 §A.2 (location, activity, steps, altitude, battery, network/Wi-Fi, beacon, app state), each selectable by the user; "בחר הכל" / "בטל הכל" stay. | Build every row of the catalogue. Order of work in addendum 1 §D still applies (location, battery, activity first; Wi-Fi SSID and beacon last because they depend on Apple's entitlement approval). |
| D2 | **Administrator can require sensors.** The server can mark specific sensors (e.g. `location`) as **required** for a user/role. A user who has not enabled a required sensor is **not let into the system from the app** until they do. | New native gate screen, see §2. |
| D3 | **Push relay is approved.** SmplWise runs a small relay that holds the APNs/FCM keys; Arx servers call it; the app fetches the real notification text from the originating server. | Build the push registration and the Notification Service Extension exactly as in addendum 1 §B. No Apple key is ever put in the repo. |
| D4 | **Employee notice text** is drafted by us: `mobile/ios-shell/EMPLOYEE_NOTICE_DRAFT_HE.md` (placeholder-based, counsel review pending). | The app shows the server-provided `notice_text`; ship only the placeholder string until the owner supplies final text. Do not invent legal wording. |
| D5 | **Android later:** same keys, strings and server contract; a few days after iOS. | Keep platform-neutral naming. |
| D6 | Bundle id, Apple Developer Program enrolment and the APNs `.p8`: the owner will provide after he reviews your build. | Ask him for each item when you reach it, in plain Hebrew. Never commit signing material. |

## 2. New: "required sensors" gate (D2)

- `GET presence/config` will carry `required_sensors: ["location", ...]` (empty = nothing required) for the signed-in user.
- After sign-in (the page calls `ArxApp.signedIn`) the app compares required sensors with the user's switches and iOS permissions.
  If any required sensor is off or not permitted, show a **native full-screen gate** over the web view: title, a plain explanation
  ("הארגון דורש שיתוף {שם החיישן} כדי להשתמש במערכת"), a primary button that turns the sensor on and triggers the iOS permission flow,
  "פתח הגדרות" when iOS permission was denied, and "התנתק" (sign out). Nothing of the site stays interactive behind the gate.
- Re-check on every app start, on return from the background, after `locationManagerDidChangeAuthorization` changes, and when the server config changes.
  If the user turns the sensor off later, the gate comes back.
- Administrators are never gated (the server omits `required_sensors` for them); the web/PWA is unaffected. A break-glass path exists server-side; the app needs no special handling.
- Strings (drafts, keys under `required_*`): `required_title` נדרש שיתוף נתונים · `required_body` הארגון דורש שיתוף {sensor} כדי להשתמש במערכת. ·
  `required_enable` הפעלה · `required_open_settings` פתח הגדרות · `required_signout` התנתקות.
- This policy has employment-law implications; the notice (`notice_text`) must mention it. Not Codex's concern beyond showing the server text.

## 3. What the server side delivers, and when

An Arx agent is building the server now (branch `pilot/mobile-presence-push-server`): presence/devices/sensors endpoints, the required-sensors
policy, notifications endpoints and the relay service. Until it publishes the final contract, build against the drafts in addendum 1 §A.4 and §B.4
plus `required_sensors` above, using your local mock.

- The final contract will be published in the repo as **`docs/api/mobile-presence-contract.md`** (on that branch first). The owner will tell you when it is ready; re-check your mock against it then and report differences.
- Extend `mobile/ios-shell/tools/mock_arx_server.*` with: `sensors.allowed`, `required_sensors`, sensor events, notification registration (`relay_token`), `GET notifications/{id}`, a switch to return `presence.enabled=false`, and a way to trigger a local test notification.
- No server endpoint will be reachable from your Mac before the owner approves exposing a build; use the mock.

## 4. Reporting back

Per item: BUILT / NOT_RUN / BLOCKED with the reason. Say explicitly which tests need a physical iPhone (remote push, background location, motion, battery,
Wi-Fi SSID) and were not run. List any iOS API or entitlement that does not behave as written in the handoff files, and any contract field you need that is missing.
Ask the owner for decisions in numbered questions with short lettered options.

## 5. Update (server contract published, 2026-10-05 evening)

The server contract is now in this folder: `docs/api/mobile-presence-contract.md` (from the server branch; the server's backend test suite was still finishing when this package was cut, so treat field names as final but report any mismatch). It **wins over the drafts** in addendum 1 §A.4/§B.4.
Known difference from the drafts: the Notification Service Extension fetches the real notification text with `GET notifications/app/{message_id}` (not `notifications/{id}`). Update your mock to match, then report every other difference you find.
