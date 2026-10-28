# SmplWise Arx — mobile presence and push contract (v2.1, CR-027 + PRESENCE307)

The server contract the SmplWise Arx phone apps (iOS first, Android later; same shape) are built against. It is the
implemented truth of `smplwise_vms/backend/smplwise/routers/presence.py` and `routers/mobile_notifications.py`; where
it differs from the drafts in `mobile/ios-shell/HANDOFF_IOS_CODEX.md` section 6 and
`HANDOFF_IOS_ADDENDUM_SENSORS_PUSH.md` sections A.4 / B.4, **this file wins** (the differences are listed in
`docs/changes/CR-027-MOBILE-PRESENCE-PUSH.md` section 9). Codex extends the local mock (`mobile/ios-shell/tools/`) to
this shape; the mock never points at the lab.

Changelog: **v2.1 (PRESENCE307, owner decision; additive, backward compatible)** - `GET presence/config` adds `wifi_match_mode`
(`phone` default | `server`); the `network` sensor event gains `wifi_match` / `wifi_site_id`; apps that still send `ssid_hash` keep
working (section 2.1). **v2 (2026-10-06, owner-approved)** - one app serves many Arx servers: the registration also returns `relay_url`
(section 1); every state-changing request that carries the session cookie must send `Origin`, and the refusal is
machine-readable (section 0); `GET presence/gate` answers `{gate, sensors}` (section 5); relay registration is idempotent
per push token and one relay token is one phone per server (sections 7.2, 8); a server id is owned by the first relay key
that names it, and the app never re-binds a stored `server_id` to another origin (sections 0.1, 8); critical categories
cannot be muted (section 7.3). v1 was the first implemented text.

## 0. Conventions

- Base path: `/arx/api/v1` on the remote channel (the app's normal path); `/api/v1` on the Ingress channel.
- JSON bodies, UTC ISO-8601 instants with `Z`. Error envelope: `{code, user_message (Hebrew), retryable, correlation_id,
  details}`; the `code`s below are stable.
- Two credentials:
  - **session** - the Arx session cookie the web view holds after sign-in (or an HA bearer token, as any remote client);
  - **device token** - `Authorization: Bearer arxd_…` (43 base64url characters after the prefix), shown once by the
    registration, kept in the Keychain, stored by the server as a SHA-256 hash. Sent on its own, never together with a
    session cookie. `401 device_token_invalid` on any route means the registration is gone: forget it and show the
    registration screen again. Twenty unknown tokens a minute from the same client address → `429 rate_limited` for
    that address's further unknown tokens; a valid token is looked up first and is never refused by this limit, whatever
    other clients send (XSECFIX-297).
  - The device token and the push registration end with a sign-out (XSECFIX-297): "sign out everywhere" (own or by an
    administrator), an administrator ending the app's sign-in from the sessions list, the sign-out inside the app (its
    user agent, or its app web session), and the removal of the user's remote access. The next call answers
    `401 device_token_invalid`; the device row stays, so `POST presence/devices` with a session of the same install
    issues a new token, and the app registers push again. A sign-out in a desktop browser leaves the phones alone.
  - The same happens on a password change or reset of the user (own change, an administrator's reset link, the
    self-service code) and when a second factor becomes required for a user who has none (an administrator's `required`
    override for the user or one of their roles) - XSECFOLLOW-297. The phone the password was changed from re-registers
    through its kept session like any other.
  - On the remote channel a device token obeys the user's remote-access policy like a session does: a user the policy
    no longer admits (no flag / administrator default, a wall user) gets `403 remote_not_allowed`.
- **`Origin` is required** on every state-changing request (POST / PATCH / DELETE) that carries the session cookie (a
  device-token call carries none, so it is exempt): `Origin: <scheme>://<host[:port]>` of the server the request goes to,
  no path, exactly as the app has it stored (the app's own HTTP calls send it too; a web view sends it by itself). The
  server's rule is unchanged (`Sec-Fetch-Site: same-origin`, or an `Origin` equal to the request's scheme + host; neither
  → refused). The refusal is `403 csrf_refused` (on the system update routes `403 cross_site_refused`) with a stable code and
  `details = { "reason": "missing_origin" | "origin_mismatch" | "cross_site", "required": { "header": "Origin", "value": "…",
  "alternative": "Sec-Fetch-Site: same-origin" } }`; `retryable: false`. The app shows the message for the `reason` and
  does not retry the same request unchanged.
- Request bodies of a device-token call are capped at **64 KiB** (the remote channel's anonymous tier); a batch holds at
  most 50 events.
- The user agent of the web view **and** of the app's own HTTP calls carries `SmplWiseArx/<version> (iOS app)` /
  `(Android app)`: the server identifies app sessions by it (required-sensors policy, section 5).

### 0.1 Identity: user and server

- **User**: `GET /me` (session) returns `user.id`, a stable string, the user's identity for the app (a device belongs to
  exactly that user; `username` / `display_name` are display data and may change, `user.id` does not).
- **Server**: every Arx installation has an opaque **`server_id`** (`srv_` + 16 hex characters, at most 64 characters,
  created once, never derived from an address). It is returned by `POST presence/devices` (section 1),
  `GET presence/config` (section 2) and the push routes (section 7.2), and it is the `server` field of every relay push
  (section 7.3). **The app stores `server_id` together with the origin and device token it registered with** (one record
  per Arx server). A push whose `server` matches no stored record is dropped: never guess an origin, never fall back to
  "the only server". If the same origin later answers with a different `server_id` (a restored or replaced
  installation), the stored registration is stale: re-register. A `server_id` that is already stored for one origin is **never
re-bound to another origin**: a second origin answering with an id the app already holds is refused (the app tells the
user and does not store it), so a push is always attributable to exactly one stored server.

### 0.2 PROPOSED AMENDMENT - pending owner approval (security review 2.2.0, H1); not normative until approved

> **Status: proposed, not approved.** The normative text of this contract is unchanged. This paragraph describes the
> server behaviour of branch `pilot/sec-220` so the app teams can prepare; it becomes part of the contract only after
> the owner approves it.
>
> - **What changes on the server:** a request or WebSocket handshake that authenticates with an HA access token
>   (`Authorization: Bearer <HA access token>`, no Arx cookie) and starts a **new** sign-in - an HA refresh token this
>   server has not yet accepted for that user since it started - now owes the same checks as the web sign-in:
>   - user enrolled in the TOTP second factor → the request must carry `X-Arx-Second-Factor: <6-digit code>`;
>     missing → `401 second_factor_required`; wrong → `401 second_factor_invalid`; five wrong in five minutes →
>     `429 second_factor_locked` (`retryable: true`); a code already used (same 30 s step) is refused as invalid;
>   - `security.second_factor_policy = admins` and an administrator without a factor → `403 second_factor_enrollment_required`.
> - **What the app sends:** the header only on the FIRST call of a new HA sign-in (after the user logged in to HA, or after
>   `401 second_factor_required`). Later access tokens of the same HA refresh token, and later calls, need no code; a
>   header sent anyway is ignored on a continued sign-in. Send that first call alone (not several in parallel with the
>   same code - the second would be a replay). After a server restart the next call may answer
>   `401 second_factor_required` again: ask the user for a fresh code and retry once.
> - The web view's own sign-in (`POST auth/session`, the cookie) is unchanged; device-token routes (`arxd_…`) are
>   unchanged. Users without a factor see no change.
> - Turning the factor on, or an administrator's reset of it, ends the user's other remote sign-ins
>   (`401 remote_session_revoked`; sign in to HA again).
> - **Device tokens (TFA2):** when the factor is enabled for the user, or an administrator resets it, the user's device tokens
>   (`arxd_...`) stop working at once: the next device-token call answers `401 device_token_invalid`. Only the credential ends - the
>   device row (name, notice acknowledgement, event log, push registration) stays. The app handles it like any `401
>   device_token_invalid`: show the registration screen and `POST presence/devices` with a session (which owes the code); the same
>   `install_id` rotates the token of the SAME device (`200`, `created: false`).
> - **Per-user / per-role policy (TFA2):** an administrator may mark a user or a role `required`. A user owing the factor with none
>   gets `403 second_factor_enrollment_required` on a new sign-in (cookie or bearer); enrol on the local channel, then sign in with the code.
> - Compatibility switch: `security.second_factor_bearer` = `enforce` (default) | `off` (the previous behaviour; every
>   sign-in that skipped an owed check is audited with `second_factor_skipped`).

## 1. Register the device — `POST presence/devices` (session)

Permission `presence.report` at any scope (every default role but kiosk). Rate: 10 per hour per user. Ten live devices
per user.

Request:

```json
{ "name": "הנייד של יוסי", "platform": "ios", "install_id": "3f1c…uuid", "app_version": "1.0.0", "os_version": "18.1", "model": "iPhone15,3" }
```

`name` 2–40 characters after trimming, unique among the user's devices (case-insensitive). `install_id` 8–64 characters,
generated once per install per server. `platform`: `ios | android`.

Response `201` (new) or `200` (the same `install_id` again: the token is **rotated**, the old one stops working):

```json
{ "device_id": "dev_…", "device_token": "arxd_…", "name": "הנייד של יוסי", "registered_at": "2026-10-05T10:00:00Z", "created": true, "server_id": "srv_0a1b2c3d4e5f6071", "relay_url": "https://relay.example" }
```

`server_id` and `relay_url` are the same values as in `GET presence/config` (section 2; `relay_url` is `null` when no relay is
configured), so the app can store them with the origin and device token it just registered with.

Errors: `400 invalid_name | invalid_platform | invalid_install_id`, `403 forbidden` (no role at all),
`409 device_name_taken` (`details.suggestion` = "הנייד של יוסי 2"), `409 too_many_devices`, `429 rate_limited`.

## 2. Config — `GET presence/config` (device token or session)

```json
{
  "server_id": "srv_0a1b2c3d4e5f6071",
  "relay_url": "https://relay.example",
  "enabled": false,
  "mode": "continuous",
  "interval_s": 60,
  "distance_filter_m": 50,
  "notice_version": 1,
  "notice_text": "…",
  "sites": [ { "id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150 } ],
  "sensors": {
    "allowed": ["location", "activity", "battery"],
    "intervals_s": { "battery": 900, "steps": 300, "app_state": 300 },
    "catalog": [ { "key": "location", "name_he": "מיקום", "purpose_he": "נוכחות במבנה: כניסה ויציאה" }, … ]
  },
  "beacons": [ { "id": "bcn_lobby", "name": "לובי", "uuid": "…", "major": 1, "minor": 2, "site_id": "site_main", "floor_id": "…", "zone_id": "…" } ],
  "wifi_sites": [ { "id": "wifi_f3", "name": "קומה 3", "site_id": "site_main", "floor_id": "…", "ssid_hash_salt": "…", "ssid_hashes": ["…"] } ],
  "wifi_match_mode": "phone",
  "required_sensors": { "enabled": false, "sensors": [] },
  "device": { "device_id": "dev_…", "name": "הנייד של יוסי", "notice_ack_version": 0 }
}
```

- `enabled` is the master switch (default **false**). While it is false the app collects nothing, asks for no
  permission, sends no events, and `sites`, `sensors.allowed`, `beacons`, `wifi_sites` come back **empty** whatever the
  administrator configured (the second gate).
- `server_id` is always present (device token or session) and equals the `server_id` of section 1 and the relay payload's
  `server` (section 7.3); it carries no address.
- `relay_url` is the installation's configured push relay base URL (add-on option `push_relay_url`), `null` when unset;
  it is also returned by `POST` / `PATCH notifications/devices` next to `server_id`. The relay key is never returned.
- `device` is present only with a device token. `notice_ack_version < notice_version` means the notice must be shown
  again before anything is reported.
- `required_sensors` tells the app which sensors the administrator requires for using the system from the app
  (section 5); it is `enabled: false` while the master switch is off.
- `wifi_match_mode` (v2.1; absent from older servers = treat as `server`, the pre-2.1 behaviour) tells the app who decides that
  the phone is on a site's Wi-Fi network; see section 2.1. It is returned whatever the master switch says.
- Sensor keys (v1, all platforms): `location, activity, steps, altitude, battery, network, beacon, app_state`.
- WHOIN034-295 (2.16.0, additive): a beacon carries its server `id`, a `name`, optional `major` / `minor` (`null` = any) and an
  optional placement (`floor_id`, `zone_id`); a Wi-Fi site carries `id`, `name` and an optional `floor_id`. The app ignores what
  it does not use. `ssid_hashes` are `sha256_hex(ssid_hash_salt + ssid)` over UTF-8 (lowercase hex): the app hashes the SSID
  it sees the same way with each site's salt and reports the result as `ssid_hash` (section 4). The server never stores or
  returns a network name.

### 2.1 Wi-Fi site match: phone-side or server-side (v2.1, PRESENCE307)

The administrator chooses in הגדרות › אפליקציה לנייד (`wifi_match_mode`, `PUT presence/settings`). The app reads it from every
`GET presence/config` and follows it; it may change at any time. `wifi_sites` (salt + hashes per site) is delivered in both modes.

Hash: `ssid_hash = lowercase hex( SHA-256( UTF-8( ssid_hash_salt + ssid ) ) )`, compared case-insensitively. The salt is the entry's
`ssid_hash_salt`; try each `wifi_sites` entry with its own salt.

| | `phone` (default) | `server` |
|---|---|---|
| Who matches | the app, locally, against `wifi_sites` | the server, against `wifi_sites` |
| App sends in the `network` sensor `value` | `{ "network": "wifi", "wifi_match": true, "wifi_site_id": "site_main" }` or `{ "network": "wifi", "wifi_match": false }`. **No SSID, no hash.** | `{ "network": "wifi", "ssid_hash": "<hash>" }` (hash computed with the matching entry's salt; if the app holds several salts it sends the first entry's hash, as today) |
| Server stores | the boolean and the site id (a `wifi_site_id` not configured on the server is dropped) | the hash plus the server's own `wifi_match` / `wifi_site_id`; a `wifi_match` sent by the phone is ignored |

Backward compatibility: in `phone` mode a server still accepts a `network` event that carries only `ssid_hash` (an app that has not
been updated): it derives `wifi_match` / `wifi_site_id` itself and **does not store the hash**. A `network` event with neither field is
stored as before. Nothing is rejected because of these fields. The newest verdict appears in `GET presence/devices/{id}/state` as
`presence.wifi = { match, site_id, at }`; it never changes `inside` (location events decide that).

The `network` sensor must be in `sensors.allowed`; the employee notice covers "location and presence", which includes the Wi-Fi match.
App work: read `wifi_match_mode`; in `phone` mode do the comparison on the device and stop sending the hash; keep sending the hash when
the mode is `server` or the field is absent. Minimum app change for the next release: honour the mode; the hash path stays valid.

## 3. The notice — `POST presence/devices/{device_id}/ack` (device token)

`{ "notice_version": 2 }` → `200 { "ok": true, "notice_version": 2 }`. `409 notice_version_stale`
(`details.notice_version` = the current one) when the server moved on; `400 invalid_notice_version`.
The version rises when the administrator changes the text **or allows a new sensor**: the app asks again.

## 4. Events — `POST presence/devices/{device_id}/events` (device token)

```json
{
  "events": [
    { "client_event_id": "uuid", "type": "fix", "site_id": null, "lat": 32.0, "lon": 34.8, "accuracy_m": 18, "at": "2026-10-05T10:00:04Z", "source": "continuous" },
    { "client_event_id": "uuid", "type": "enter", "site_id": "site_main", "at": "2026-10-05T10:05:00Z", "source": "region" },
    { "client_event_id": "uuid", "type": "sensor", "sensor": "activity", "at": "2026-10-05T10:00:00Z", "value": { "state": "walking", "confidence": "high" } }
  ],
  "status": { "location_auth": "always", "precise": true, "sharing": true, "sensors": { "location": "on", "activity": "on", "battery": "off" } }
}
```

Rules:

- <= 50 events, body <= 64 KiB, at most 60 batches a minute per device (`429 rate_limited`, `details.retry_after_s`).
- Idempotent per `client_event_id` (1–64 characters) per device: a repeat counts as `duplicates`.
- `type`: `fix | enter | exit | sensor`. `fix` needs `lat`, `lon` (`accuracy_m` optional); `enter` / `exit` may carry a
  coordinate and should carry `site_id`. `source`: `continuous | region | significant | foreground` (optional).
- `sensor` events: `sensor` must be in the catalogue **and** in `sensors.allowed`; `value` is a flat object (<= 20 keys,
  strings <= 128 characters, numbers, booleans, null; <= 1 KiB). Location events need `location` allowed.
  **The server validates only that envelope, not per-sensor keys**: whatever flat object passes is stored as sent
  (`services/presence.py` `_validate_event`; nothing reads individual keys). The keys below are therefore the
  **agreed shape from the iOS addendum A.2 (not enforced)**; a client sends exactly these so the data stays comparable
  across platforms, and an unknown key is stored, not rejected:

  | sensor | `value` keys (agreed, not validated) |
  |---|---|
  | `location` | no `sensor` event: sent as `fix` / `enter` / `exit` events (`lat`, `lon`, `accuracy_m`, `site_id`) |
  | `activity` | `state` (`stationary \| walking \| running \| cycling \| automotive \| unknown`), `confidence` |
  | `steps` | steps delta per interval, floors up / down |
  | `altitude` | relative altitude change |
  | `battery` | level %, charging state, low-power mode |
  | `network` | `type`: `wifi \| cellular \| none`; Wi-Fi: `wifi_match` + `wifi_site_id` (phone mode) or `ssid_hash` (server mode, matched against `wifi_sites[].ssid_hashes`), see section 2.1 |
  | `beacon` | `beacon_id` (the server's id from `beacons[]`; or `uuid` with `major` / `minor`), `site_id`, `proximity` (`immediate \| near \| far`) |
  | `app_state` | `foreground \| background`, last-seen |

  The addendum names the data but not the JSON key spellings for every row; until the owner fixes them, the spellings
  are the app's choice and the server accepts any. **Exception (WHOIN034-295):** the server's "who is in the building"
  screen READS the `beacon` keys `beacon_id` / `uuid` / `major` / `minor` / `proximity` and the `network` key `ssid_hash`
  with exactly these spellings; a report with other spellings is stored but places nobody on a floor.
- `status` is optional and may be sent **alone** (`events: []`): it is how "sharing off", permission changes and the
  per-sensor switches reach the server (and what the required-sensors policy reads). `status.sensors.<key>` is one of
  `on`, `off` (permission denied or the user switched the sensor off) or `unavailable` (the phone has no such hardware).
  The server stores and returns all three as sent (`GET presence/devices/{id}/state`, the device list and `GET presence/devices/me`
  carry `status.sensors`); any other value, a missing key, and every sensor the administrator does not allow, is stored `off`. The status is accepted even while the installation is switched off.
- The whole batch is refused on the first problem: `400 invalid_event` (`details.field`, `details.client_event_id`),
  `400 sensor_not_allowed` (`details.sensor` → the app switches that sensor off locally), `400 batch_too_large`,
  `409 presence_disabled` (the switch is off: stop collecting), `409 notice_ack_required` (`details.notice_version`).

Response:

```json
{ "accepted": 2, "duplicates": 1, "inside": true, "site_id": "site_main", "notice_version": 2 }
```

`inside` / `site_id` are the device's **current** presence state after this batch: from the newest `enter` / `exit`, or
from the newest `fix` matched against the geofences (`inside: null` when no geofence is configured and no enter / exit
was ever reported). Events are stored in time order; an older event never moves the state backwards.

## 5. The required-sensors policy (owner decision 2026-10-05)

An administrator may require sensors (for example `location`) as a condition for using the system **from the app**. A
covered user whose phone does not report the required sensors is refused:

- `GET /me` (session) carries `presence_gate` once a policy was ever written:
  `{ "required": ["location"], "missing": ["location"], "blocked": true, "applies": true, "channel": "app" | "web",
  "break_glass_until": null, "reason": "missing_sensors" | "presence_disabled" | "exempt" | "not_in_scope" | "web_not_covered" | "break_glass" | null }`
  (`null` when the policy applies to nobody). The web app shows one state naming the missing sensors.
- Every other request of a blocked session answers `403 presence_required` with `details.missing`, **except**
  `/me`, `/presence/*`, `/notifications/devices*`, `/notifications/app/*`, `/notifications/categories`, `/auth/*`,
  `/health` - the routes the app needs to get out of that state. The match is on the path below `<remote_path>` and
  `/api/v1`, exact or by whole leading segments (XSECFIX-297): `/media/...`, `/alarm/me/pin`, `/energy/meters`,
  `/recorders/{id}/health` are NOT exempt.
- The same block applies to every WebSocket (XSECFOLLOW-297): `/me/ws`, `/events/ws`, live video, playback, the intercom
  sockets and the others - none is exempt. A refused socket is accepted, receives one
  `{"type": "error", "value": "presence_required", "message": "…"}` frame and closes with code **4403** (never 4401, which
  means "signed out"). A client should reconnect only after `/me` reports `presence_gate.blocked: false`.
- A sensor counts as shared when some live device of the user reported it `on` in `status` within the policy's
  `max_stale_hours` (default 48) **and** acknowledged the current notice version; for `location` also `sharing: true` and
  `location_auth` in `always | when_in_use`. A required sensor reported `unavailable` (no such hardware; owner decision
  2026-10-24, PRESUNAVAIL-295) **also counts as met**, under the same freshness / acknowledgement / allowed-sensor rules, so a
  user is never locked out for hardware the phone lacks. Exceptions: sensors listed in the policy field `hardware_required` (sensor keys chosen per server by its administrator, default `[]`) never count when `unavailable`; `off` never counts, and `location` reported `unavailable` does
  **not** count (a phone always has it; the requirement needs sharing and authorisation). The app still never bypasses the gate
  locally: it sends the truthful state and reloads `/me`. So: after the user switches a sensor on, send `status` (alone is enough),
  then reload `/me`.
- The policy is inert while the master switch is off; administrators are never blocked; the administrator may suspend it
  (break-glass) or exempt users; a browser session is covered only when the administrator says so (`apply_to_web`).
- `GET presence/gate` (session) answers `{ "gate": <the object above, or null when the policy applies to nobody>,
  "sensors": { "<key>": "<Hebrew name>", … } }` for the current channel, for the app's own screen (the object is not
  returned bare).

## 6. Manage

- `GET presence/devices/me` (session) → `{ "devices": [Device] }` - the caller's own devices, never a token.
- `PATCH presence/devices/{device_id}` `{ "name": "…" }` (device token for its own device, or the owner's session) →
  `Device`; `409 device_name_taken` with a suggestion.
- `DELETE presence/devices/{device_id}` → `204` (device token for its own device, the owner's session, or an
  administrator). The token dies at once and the device's event log is deleted. The app calls it from
  "הסרת המכשיר מהמערכת".
- `GET presence/devices/{device_id}/state` → `{ device_id, presence, status, last_event_at }` (own token, owner, or
  `presence.sensors.view`).
- Another user's device, on any route, answers `404 not_found` (and is audited).

`Device`:

```json
{ "device_id": "dev_…", "name": "…", "platform": "ios", "app_version": "1.0.0", "os_version": "18.1", "model": "iPhone15,3",
  "registered_at": "…", "last_seen_at": "…", "last_event_at": "…", "notice_ack_version": 2, "notice_ack_at": "…",
  "status": { "location_auth": "always", "precise": true, "sharing": true, "sensors": { "location": "on", "activity": "off", … } },
  "presence": { "inside": true, "site_id": "site_main", "at": "…", "lat": 32.0, "lon": 34.8, "accuracy_m": 18, "source": "continuous", "updated_at": "…" },
  "push": { "registered": true, "platform": "ios", "muted": ["automations"], "last_ok_at": "…", "failures": 0, "last_error": null },
  "revoked_at": null }
```

Administrator routes (not for the app): `GET presence/devices[?user_id=]` (`presence.sensors.view`),
`GET/PUT presence/settings`, `POST presence/settings/break-glass` (`system.configure`).

## 7. Push notifications (phase 2)

### 7.1 Architecture

The SmplWise **push relay** (`services/push-relay/`, run by SmplWise) holds the APNs key and the FCM service account. The
app registers its platform push token with the relay (`POST <relay>/v1/register`, section 8) and receives an opaque
**relay token**; it registers that relay token with **each** Arx server. The server never sees the APNs / FCM token and
the relay never sees any text: a push is `{relay_token, category, notification_id, priority}` and the app's notification
extension fetches the real title and body from the originating server with its device token.

### 7.2 Server routes (device token)

- `POST notifications/devices` `{ "platform": "ios", "relay_token": "…", "app_version": "1.0.0" }` → `200 { "device_id", "server_id",
  "relay_url", "push": {…} }`. Re-sent whenever the relay token changed and whenever `GET presence/devices/me` shows
  `push.registered: false`. `400 invalid_relay_token`. **Idempotent**: the same device with the same relay token again changes
  nothing (the mutes stay), so the app may repeat it freely (a lost answer, a retry, every launch); a different relay token
  replaces the stored one (a rotated push token). One relay token is one phone: when it is registered for another device of
  this server (another user signed in on the same phone), the older device loses its push registration
  (`push.registered: false`; re-register it with a token of its own).
- `PATCH notifications/devices/{device_id}` `{ "muted": ["automations", "system"] }` → `200 { "device_id", "server_id", "push": {…} }`
  (category ids of 7.3; unknown ids `422 validation`; a critical category is accepted but never muted, see 7.3).
- `DELETE notifications/devices/{device_id}` → `204`: push unregistered (the device registration itself stays; use
  `DELETE presence/devices/{id}` to remove the device).
- `GET notifications/categories` (device token or session) →
  `{ "categories": [ { "id": "safety", "name": "בטיחות", "critical": true }, { "id": "alerts", "name": "התראות", "critical": false }, … ] }`.
  CRITSOUND (2.17.0, additive): the answer also carries `"critical_sound": { "enabled": bool, "types": ["sensor.smoke", …], "resolved_tone": bool }`,
  read-only: whether the owner enabled the Do-Not-Disturb-bypassing safety sound (master switch on and at least one event type chosen),
  which event types, and whether resolved updates carry the calming tone. Absent on older servers = disabled. Android behaviour:
  `docs/changes/CRITSOUND-SPEC.md` section 5 (binding); iOS ignores it in phase 1.
- `GET notifications/app/{message_id}` (device token) → `{ "message_id", "notification_id", "title", "body", "category",
  "severity", "deep_link", "at", "mode" }` - the text of one push for **this** device; `404 not_found` for another
  device's message, an unknown id or one older than 24 h. `mode: "resolved"` means the condition ended.
- `POST notifications/app/test` (device token; 3 per minute) → sends one test push to this device through the relay and
  answers `{ "message_id", "sent": true|false, "reason" }`.

### 7.3 Categories and the payload the relay delivers

Categories are CR-018's: `safety` (critical; `GET notifications/categories` marks it `critical: true`), `alerts`, `doors`, `device_faults`, `automations`, `system`, `security`.
The administrator decides per source whether the `app` channel is on (הגדרות › התראות); the user mutes categories per
device in the app (`muted`). **A `critical` category and an escalation step are never muted**: the server sends them
whatever `muted` holds, and the app never drops a push of a `critical` category (it shows no mute switch for it). The generic payload (APNs: `alert {title: "SmplWise Arx", body: "התראה חדשה"}`,
`mutable-content: 1`, `thread-id` = the server id the app registered, `interruption-level: time-sensitive` only for
`priority: "high"`; FCM: a data message with the same fields and `priority: high`) carries
`{ "notification_id": "<message_id>", "category": "safety", "server": "<server_id>" }` and nothing else. `server` is the
installation's `server_id` of section 0.1 (the app finds the origin and device token to fetch the text with from it;
no match → drop the push).
CRITSOUND (2.17.0, additive, Android only): the FCM data map may also carry `critical_alert: "1"` (a safety event the owner chose for the
Do-Not-Disturb-bypassing channel) or `resolved_tone: "1"` (the resolved update of such an event: short calming tone); never both, never
`"0"`, absent otherwise. APNs payloads are unchanged (no iOS Critical Alerts in phase 1). App behaviour: `docs/changes/CRITSOUND-SPEC.md` section 5.

## 8. The relay API (app ↔ relay; server ↔ relay)

Base `https://<relay>/v1`. The app **prefers the `relay_url` its Arx server returns** (section 2, section 7.2) and falls
back to the default baked into the build when it is `null` / absent, so moving the relay to another domain needs a server
option change, not an app update. The app uses the relay of the server it is registering with, per server. All bodies JSON, <= 2 KiB.

- `POST /v1/register` (app) `{ "platform": "ios" | "android", "push_token": "<APNs hex | FCM token>", "app_version": "…",
  "bundle_id": "com.smplwise.arx.app" }` → `200 { "relay_token": "rt_…" }`. **Idempotent per push token**: the same
  push token always gets the same relay token back, however often the app repeats the call (the relay derives it from a
  secret and stores only its hash, so a lost answer or a restarted app never retires a token the Arx servers already
  hold); a rotated push token gets a new relay token. A repeat of a known push token does not count against the limit
  of 60 *new* registrations per hour per client address. `503 relay_unconfigured` when the relay is not set up for stable
  tokens (retry later; nothing was stored).
- `DELETE /v1/register` (app) `{ "relay_token": "rt_…" }` → `204`.
- `POST /v1/push` (server; `Authorization: Bearer <server key>`) `{ "relay_token": "rt_…", "category": "safety",
  "notification_id": "…", "priority": "high" | "normal", "server": "<server id, <= 64 chars>", "collapse": "<optional>", "critical_alert": <optional bool>, "resolved_tone": <optional bool> }`
  → `200 { "ok": true }`; `404 relay_token_unknown` (the server drops the device's push registration);
  `410 push_token_gone` (same); `429 rate_limited` (500 pushes per device per day, 60 per minute); `401` for a bad
  server key; `403 server_id_claimed` (the `server` id belongs to another server key: a configuration error of the
  installation, not retryable); `5xx` → retry with backoff.
  `critical_alert` / `resolved_tone` (CRITSOUND, relay + server 2.17.0): strictly boolean when present (anything else `400 bad_request`),
  default `false`; mapped to the FCM data keys of section 7.3 and ignored for APNs.
- The relay stores only `sha256(relay_token) → {platform, push_token, bundle_id, created_at, counters}` (Workers KV,
  expires after 180 days without use). No notification text, no server addresses beyond the opaque server id. A server id is owned by the first server key that
  names it (`sid:<server id>` → key id), so one installation cannot make the phone attribute its pushes to another's id.

## 9. Strings the app may reuse

Error `user_message`s are Hebrew and short (e.g. "רישום המכשיר אינו תקף. יש לרשום את המכשיר מחדש.", "יש לאשר את ההודעה
לעובדים לפני שליחת נתונים.", "החיישן הזה אינו מאושר בשרת."); the sensor names of `sensors.catalog` are the server's
Hebrew names - the app's own String Catalog wins on the phone.

## 10. Session exchange - Arx-side additions for contract v2.2 (SXFIX-295, additive)

The session exchange itself (`POST auth/app/session`, the WebView's `GET auth/app/session/redeem`, the one-time code, the 303) is
specified in `docs/changes/APPREFRESH-SESSION-EXCHANGE-SPEC.md` revision 3 and the client contract delta handed to the app teams on
2026-10-24. Nothing there changes: the switch `security.app_session_exchange` stays **off** by default, and the client's boundary
is origin / port / prefix, an exact landing on `<remote_path>/` and one HTTP redirect (the 303 itself is proven only in the
supervised run, owner decision 2026-10-25). This section adds four things the app teams were promised.

### 10.1 `signedOut({reason})` from the web app (SX-09 / SX-10)

The page calls `ArxApp.signedOut({ reason })` (previously `signedOut()` without an argument), from the top-level page only, once
per change of the signed-in state. `reason` is one of a **closed** list:

| `reason` | When the page sends it | What the shell does |
|---|---|---|
| `user` | the user's own sign-out, only after `DELETE /auth/session` answered 2xx or 401 | cancel pending work, suppress the silent re-exchange; if the saved sign-in is still live, end it with `POST /auth/app/sign-out` |
| `expired` | the server answered `401 remote_login_required` and no sign-out was in progress | the single silent recovery of the budget (refresh if needed, exchange, redeem) |
| `unknown` | every other cause: `401 remote_session_revoked`, the remote-access policy, the page's idle lock, a sign-out request that failed or got no answer | no silent recovery |

Rules: the list is fixed by the shells - the page never sends another value, and it always sends a `reason`. A shell treats a
missing argument (an older web app) as `unknown`. While a sign-out is in flight the page sends nothing, so a background 401 can never
arrive as `expired` before the user's `user`. A shell whose bridge function takes no argument keeps working: the page retries the
call without the argument if the call with one throws. Source: `frontend/src/arx/native-app.ts` (`NativeSignOutReason`).

### 10.2 `X-Correlation-Id` (SX-17)

The server accepts a client's `X-Correlation-Id` only when it is **one** header value of **8-64 characters from
`[A-Za-z0-9_-]`** (the apps send 12-32 hex characters on every exchange POST and on the redeem navigation). Any other value - too
short or too long, another character, or the header sent twice - is ignored and the server uses its own id (12 lowercase hex).
The server's id is what comes back in the `X-Correlation-Id` response header and in `correlation_id` of an error body, and what the
audit rows carry as `request_id`; a refused client value is never echoed, logged or stored. An app that wants to find its request
in the server audit compares the id it **received**, not the one it sent. Exception: an answer the remote channel gives before the
application runs (`403 csrf_refused`, the `404` of a path the channel blocks) carries `correlation_id: ""` and no header.

### 10.3 Official JSON fixtures (SX-25)

`contracts/fixtures/app_session/` holds one file per case (`index.json` lists them with status, error code and landing URL, plus the
placeholder legend): the exchange's `200`, `404 not_found`, `401 app_access_invalid`, `401 app_refresh_proof_retry` (`nonce` and
`clock`), `401 app_refresh_invalid`, `401 app_refresh_expired`, `403 app_session_key_required`, `403 remote_mfa_required`,
`422 validation`, `429 rate_limited`, `403 csrf_refused`; the redeem's `303` to `<remote_path>/` (with the `Set-Cookie` shape), `303`
to `?app_session=failed` (refused, cross-site, and without the app marker), and `404`. Not covered by a file: `403 second_factor_enrollment_required` (same
envelope as `remote_mfa_required`). The files are produced from the real routes by
`smplwise_vms/backend/tests/test_app_session_fixtures_sx25.py`, which fails whenever the code and the files drift; credentials
and per-run values are placeholders. They are **FIXTURES**: a passing client test against them proves the client's parsing, not
the server, a device or an activation. `user_message` and `details.errors` are for people, never for program logic.

### 10.4 Cross-site redeem refusal in the audit (SX-27)

A redeem navigation with `Sec-Fetch-Site: cross-site` or `same-site` is still answered `303 <remote_path>/?app_session=failed`
without a cookie, and the code is still **not** spent (the app's own navigation can redeem it). New: the refusal is audited as
`auth.app_session.redeem`, decision `denied`, reason `cross_site`, `request_id` = the correlation id, details
`{family, sec_fetch_site, code_known: true}` for a code the server issued (attributed to its user and device), or
`{sec_fetch_site, code_known: false}` against the installation otherwise. The row never carries the code or its hash. In the
supervised run this is how a WebView that sends the wrong `Sec-Fetch-Site` is told apart from every other refusal.

### 10.5 Security review X4 (2026-10-25) - what the server now requires and records

- **The redeem navigation MUST carry `X-Correlation-Id`: exactly one value of 12-32 hex characters** (Android
  `loadUrl(redeemUrl, mapOf("X-Correlation-Id" to id))`, iOS a `URLRequest` with the header). A link opened from SMS, mail or another
  app cannot carry a header, so a redeem without it is refused (`303 ?app_session=failed`, audited `marker_missing`) and the code is
  spent (fixture `redeem_without_marker.json`). This was already the contract's instruction (SX-25); it is now enforced.
- A redeem from a browser that already holds **another user's** live Arx session is refused (`303 ?app_session=failed`, audited
  `session_present`, the code spent); that session is left untouched. The same user's live web session is replaced as before.
- A WebView session made by the exchange cannot register a device: `POST presence/devices` answers `403 sign_in_not_anchorable`
  (audited). The app registers after a full sign-in, as SX-07 says.
- Unknown and lapsed codes are audited (`code_unknown`, `code_expired`); every `auth.app_session.*` row of the exchange and the
  redeem carries the masked client address (`ip`), never a code, a token or a hash of either.
