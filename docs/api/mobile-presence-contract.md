# SmplWise Arx — mobile presence and push contract (v2, CR-027)

The server contract the SmplWise Arx phone apps (iOS first, Android later; same shape) are built against. It is the
implemented truth of `smplwise_vms/backend/smplwise/routers/presence.py` and `routers/mobile_notifications.py`; where
it differs from the drafts in `mobile/ios-shell/HANDOFF_IOS_CODEX.md` section 6 and
`HANDOFF_IOS_ADDENDUM_SENSORS_PUSH.md` sections A.4 / B.4, **this file wins** (the differences are listed in
`docs/changes/CR-027-MOBILE-PRESENCE-PUSH.md` section 9). Codex extends the local mock (`mobile/ios-shell/tools/`) to
this shape; the mock never points at the lab.

Changelog: **v2 (2026-10-06, owner-approved)** - one app serves many Arx servers: the registration also returns `relay_url`
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
    registration screen again. Twenty unknown tokens a minute from the same client → `429 rate_limited`.
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
  "beacons": [ { "uuid": "…", "site_id": "site_main" } ],
  "wifi_sites": [ { "site_id": "site_main", "ssid_hash_salt": "…", "ssid_hashes": ["…"] } ],
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
- Sensor keys (v1, all platforms): `location, activity, steps, altitude, battery, network, beacon, app_state`.

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
  | `network` | `wifi \| cellular \| none`, Wi-Fi SSID hash (matched against `wifi_sites`) |
  | `beacon` | `site_id`, proximity bucket (`immediate \| near \| far`) |
  | `app_state` | `foreground \| background`, last-seen |

  The addendum names the data but not the JSON key spellings for every row; until the owner fixes them, the spellings
  are the app's choice and the server accepts any.
- `status` is optional and may be sent **alone** (`events: []`): it is how "sharing off", permission changes and the
  per-sensor switches reach the server (and what the required-sensors policy reads). Sensors not allowed are stored
  `off`. The status is accepted even while the installation is switched off.
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
  `/health` - the routes the app needs to get out of that state.
- A sensor counts as shared when some live device of the user reported it `on` in `status` within the policy's
  `max_stale_hours` (default 48) **and** acknowledged the current notice version; for `location` also `sharing: true` and
  `location_auth` in `always | when_in_use`. So: after the user switches a sensor on, send `status` (alone is enough),
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
  "notification_id": "…", "priority": "high" | "normal", "server": "<server id, <= 64 chars>", "collapse": "<optional>" }`
  → `200 { "ok": true }`; `404 relay_token_unknown` (the server drops the device's push registration);
  `410 push_token_gone` (same); `429 rate_limited` (500 pushes per device per day, 60 per minute); `401` for a bad
  server key; `403 server_id_claimed` (the `server` id belongs to another server key: a configuration error of the
  installation, not retryable); `5xx` → retry with backoff.
- The relay stores only `sha256(relay_token) → {platform, push_token, bundle_id, created_at, counters}` (Workers KV,
  expires after 180 days without use). No notification text, no server addresses beyond the opaque server id. A server id is owned by the first server key that
  names it (`sid:<server id>` → key id), so one installation cannot make the phone attribute its pushes to another's id.

## 9. Strings the app may reuse

Error `user_message`s are Hebrew and short (e.g. "רישום המכשיר אינו תקף. יש לרשום את המכשיר מחדש.", "יש לאשר את ההודעה
לעובדים לפני שליחת נתונים.", "החיישן הזה אינו מאושר בשרת."); the sensor names of `sensors.catalog` are the server's
Hebrew names - the app's own String Catalog wins on the phone.
