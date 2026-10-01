# CR-018 — Notifications (התראות): one center for every source, channel and recipient

**Numbering:** registered as CR-018 on 2026-10-01. Task card: T101 (requirements R211-R213, acceptance tests
AT211-AT213). T100 / R208-R210 are left for CR-017 (automations), which is being written in parallel.

**Status:** Decisions adopted (owner answers of 2026-10-01, §1.1) - architecture, contract and an interactive mockup;
no product code yet. Decisions record: `docs/design/mockups/notifications/decisions-HE.md`. Mockup:
`docs/design/mockups/notifications/index.html` (screenshots `docs/evidence/notifications-mockup/`). Contract and
parallel plan: `docs/architecture/NOTIFICATIONS_API.md`.

**Related:** MASTER_SPEC_HE.md §28 (rules, responses: in-product alert, HA event/deep link, push via an approved HA
target), T052 rules (`services/rules.py`), CR-008 P3 Web Push (`services/push.py`, built), CR-012 Android app push
(proposed, open), CR-010 alarm, CR-011 step-up, CR-013 shell (user menu), CR-014 scheduler, CR-017 automations.

## 1. The request

The owner listed "התראות" among the items that close overall development (with automations/scenes/scripts and a few
integrations), without a definition. This CR therefore (a) inventories what exists, (b) proposes one model that the
other sources and CR-017 can feed, and (c) asked the owner the ten questions that decide scope. The answers arrived on
2026-10-01 and are adopted below; where they differ from the first proposal, the section says so.

### 1.1 Owner decisions (2026-10-01) - adopted

| # | Decision | Consequence in this CR |
|---|---|---|
| 1א | A notification center in the app + push, fed by many sources (not only rules). | §4, §6.1 |
| 2ב | **All** sources in v1: safety (leak, smoke, gas, alarm triggered), faults (camera, NVR, backup, system, update), doors/windows left open, WisKey ringing / doorbell, schedule and automation failures, low battery, new sign-in / remote sessions, bulk and scene results. | §5 (no phase split by source), effort §17 |
| 3ג | In-app center + Arx Web Push now; **Companion phones in a later step** - the data model is designed now, nothing is built. | §6.3 (deferred), §12 |
| 4ב | **Only an administrator** (new permission `notify.manage`) configures what is sent. Users have **no** personal channel, quiet-hour or mute choices. Per user remain only: read/unread, snooze and acknowledge on items. | §7, §8 (personal prefs and mutes removed), §12 |
| 5 | What passes quiet hours is an **administrator setting**: a per-severity matrix in Settings, default "critical only". | §8.1 |
| 6א | Escalation: an unacknowledged critical item escalates after 5 minutes to the administrators, at most 2 steps, stops on acknowledge; minutes and steps are settings. | §8.3 |
| 7 | Critical sound that overrides do-not-disturb **only for safety events on Companion phones** (later step; the setting is designed now, shown as "בקרוב"). **No camera image inside notifications in v1** - the image opens only inside Arx after sign-in; kept as a setting, default off, marked "later". | §11 |
| 8א | Lock-screen text shows type + place ("דליפת מים · מטבח"); the level of detail is an administrator setting: generic / type + place / full. | §11 |
| 9א + door | Buttons "פתח", "אישור", "השתק לשעה", **and** a "פתח דלת" button on a doorbell notification - which **never executes by itself**: it opens an in-app confirmation that requires the signed-in Arx session of a user holding the door-open permission, then runs through the existing `door.unlock` path with its normal audit. | §9 (safety rule stated plainly) |
| 10ב | Retention 30 days (a setting) + **email** for system faults and backups through an SMTP server the owner supplies (Settings section "דואר יוצא" with a test button). **WhatsApp is a later step**: the owner will teach the connection method; only a channel slot "WhatsApp - בקרוב" is shown, no internals designed. | §6.4, §6.5, §10 |
| rule | Every option lives in one dedicated Settings tab "התראות" with the sections of §19. | §19 |

## 2. What exists today (inventory, g0/intake 3e8601e0)

Arx already has a solid **Web Push** path and a **rule-alert** list, but only one producer (the rules engine) and no
notification store of its own. Everything else is surfaced as live screen state, a status dot or an audit row.

| Source | Channel today | Rule / filter today | Gap |
|---|---|---|---|
| NVR events (motion, person, line, field, video loss, tamper, storage) → `events` | `rule_alerts` list (#/investigate/rules?tab=alerts) + Web Push + optional HA `notify.<service>` | Local rule: trigger × scope × window × `cooldown_s`; `row_scope(events.read)` per camera; push prefs (4 categories, quiet hours, critical bypass); 10/min per user | Works. No inbox of its own, no fold/count, no snooze or mute per camera, no snapshot after sign-in in the list |
| HA transitions (door, lock, motion, availability lost) → `events` source `ha` | Same as above, only when a rule matches | As above; camera-less alerts need installation-wide `events.read` | No built-in "door left open N min", no battery, no offline duration, no resolve |
| Leak / smoke / gas / CO sensors | None unless a rule matches a generic state event | - | No safety category, no escalation, no bypass defaults |
| Alarm (CR-010) | Alarm screen only (live state) | - | Triggered / arming failed never notify |
| WisKey calls / doorbell / visit requests | WisKey overview banner (live, `/intercom/ws`) | - | Not stored as events → no notification (CR-008 §7.1); visit requests not implemented |
| Camera / system health (`health_report.summary()`: nvr, discovery, go2rtc, ha, thumbnails, backups) | Status dot + red banner on `error`; diagnostics page (`system.configure`) | - | No push, no history of when it broke/recovered |
| Backup / update | `warn` items in summary; PWA "new version" banner | - | Backup failed does not reach anyone off-screen |
| Scheduler runs (CR-014) | Runs list, `status.counts.attention`, audit `schedule.executed` | - | `not_confirmed` / review items never notify ("phase 4" in SCHEDULER_API §5.10) |
| Bulk actions (device_bulk) | Result in the dialog that started it, audit rows | - | Leaving the page loses the partial-failure outcome |
| Remote access (CR-008) | Audit views `remote_sign_ins`, `remote_refusals` | - | No "new sign-in on your account" notice |
| Automations (CR-017) | Not specified yet | - | Needs a `notify` action with the same safety rules |
| **Channels** | In-app: rule-alert list + avatar dot + user-menu chip (60 s poll of `/rules/alerts`); **Web Push** (VAPID, RFC 8291, allow-listed push hosts, SW with deep link, badge, `requireInteraction` for critical); **HA notify** (rule action `ha_notify`, sensitive `rules.ha_notify`, free service name) | - | No email, no WhatsApp, no `persistent_notification`, no HA `mobile_app` data (channels, tags, actions), no Android-app push (CR-012 open), no delivery log beyond per-subscription counters |
| **Rules / prefs** | `push_prefs` per user: categories alerts/doors/device_faults/system, quiet {from,to,allow_critical}; severity info/alert/critical | - | No per-area/device subscription, no days in quiet hours, no mute/snooze, no minimum severity, no escalation, no acknowledge outside rule alerts |

Realtime is WebSocket fan-out (`/events/ws`, `/ha/ws`, `/intercom/ws`, `/me/ws`), not SSE. Audit: `audit_log`,
365 days. Permissions relevant today: `events.read`, `events.ack`, `rules.manage`, `rules.ha_notify` (sensitive),
`system.configure`, `audit.read`; no `notify.*`.

## 3. Goals and non-goals

**Goals (v1)**
1. One notification store and inbox ("מרכז התראות") fed by every source through one function, `notify.emit()`.
2. **All** built-in sources of §5 with sensible defaults that work without writing rules; rules and CR-017
   automations add more (owner 2ב).
3. Delivery to the in-app center always, to Arx Web Push as the administrator configures, and email for system
   faults and backups (owner 10ב); a delivery log with visible failures.
4. **Administration only** (owner 4ב): a holder of `notify.manage` decides per source whether it is on, its
   severity, who receives it and on which channels; installation-wide quiet hours with a per-severity "what passes"
   matrix; escalation parameters; lock-screen detail; retention; outgoing mail. A user keeps only per-item
   read/unread, snooze and (when permitted) acknowledge.
5. Escalation of unacknowledged critical items to the administrators (owner 6א).
6. The existing guarantees stay: never notify about something the user cannot see; minimal payloads; no sends under
   the SQLite write lock; retries re-check reach.

**Non-goals (v1) and later steps**
- **Companion phones** (`notify.mobile_app_*`): a later step (owner 3ג). The data model (channel `ha_mobile`, phone
  mapping, critical sound for safety) is designed in §6.3 and §12 and nothing of it is built in v1.
- **WhatsApp**: a later step (owner 10ב). The owner will teach the connection method; v1 shows a channel slot
  "WhatsApp - בקרוב" and designs no internals. SMS is not planned.
- **Physical actions from a notification surface**: nothing opens, disarms, arms or runs from a push or an inbox
  row by itself. The doorbell "פתח דלת" button is a deep link into an in-app confirmation (§9).
- Camera images inside push payloads (owner 7): a setting, off, marked "later"; the image opens inside Arx only.
- Android-app push (CR-012 decides the transport; the model here accepts it as channel `app` later) and iOS native.
- HA `persistent_notification` (lands in the HA UI, which operators do not use; owner rule: no HA branding).
- Face/person names, AI descriptions or visitor data inside any push payload or email.
- Webhooks and outbound integrations (MASTER_SPEC §28 limits stay).
- Per-user preferences, mutes, minimum severities and per-user quiet hours (owner 4ב) - the `push_prefs` table
  stays readable for one release and is then dropped (§12).

## 4. The model

```
signal ──► policy/rule ──► notification (fold by dedupe key) ──► recipients (visibility × audience × prefs)
                                                               ──► deliveries per channel ──► delivery log
                                            ▲ resolve / ack / escalate timers
```

- **Signal:** a fact from a source (`source`, subject, severity, dedupe key, place parameters, origin ids). Built-in
  monitors, the rules engine, CR-014 run settlement, bulk completion and CR-017 all produce signals; none of them
  sends anything.
- **Policy:** per built-in source, installation-wide (`notify.manage`): enabled, severity, category, `after_s`
  (condition must hold), dedupe window, resolve notice, **recipients** (everyone who may see it / administrators /
  the initiator or account owner / named users) and **channels** (center always; push; email). Rules (`rules`) and
  automations keep their own definitions and emit with source `rule.alert` / `automation.notify`; their rows then
  follow the policy of that source for channels and quiet hours.
- **Notification:** one row per open condition. A new signal with the same dedupe key inside the window folds into it
  (`count`, `last_at`) instead of creating a row or a new push; a higher severity re-notifies. A resolve signal closes
  it (`resolved`). Shared state: `open → acknowledged → resolved` (ack optional; resolve automatic where the source can
  tell, else on ack).
- **Recipients:** the policy's recipient rule, intersected with visibility (§7), decided when the row is created and
  re-checked at every delivery and every inbox read.
- **Delivery:** one row per (notification, user, channel, target) with status and reason, retried per channel rules.

## 5. Sources in v1 (all of them - owner 2ב)

| Source key | Signal | Category | Default severity | Dedupe key / fold window | after_s / throttle | Resolve |
|---|---|---|---|---|---|---|
| `rule.alert` | Rule fires (existing) | alerts (or doors/device_faults per event type) | rule's | rule_id + camera/entity, 5 min | rule `cooldown_s` | ack |
| `camera.offline` | Video loss / camera unreachable | device_faults | alert | camera_id, until resolved | 120 s | back online |
| `nvr.offline`, `nvr.storage` | NVR unreachable, disk error/full | device_faults | critical | nvr id | 120 s | recovered |
| `camera.motion` / `person` / `vehicle` | NVR smart events | alerts | info | **only through rules** (no default push; too noisy) | - | - |
| `door.ring` | WisKey call-state ringing (intercom_sync) | doors | alert | station, 60 s | - | answered/ended |
| `door.ring` (HA) | HA `event` entity, device_class `doorbell` (state = last event time, `event_type` attribute; HA 2023.8+) [HA-EVENT] | doors | alert | entity, 60 s | - | - |
| `alarm.triggered` | Panel `triggered` | safety | critical | panel, until disarmed | 0 | disarmed |
| `alarm.arm_failed`, `alarm.state` | Arm refused / armed-disarmed | safety / doors | alert / info (off by default) | panel, 60 s | - | - |
| `sensor.leak` / `smoke` / `gas` / `co` | binary_sensor device_class moisture/smoke/gas/carbon_monoxide `on` | safety | critical | entity, until off | 0 | off |
| `opening.left_open` | door/window/garage/opening `on` for `after_s` | doors | alert | entity, until closed | 600 s | closed |
| `device.unavailable` | Catalogued entity unavailable | device_faults | info | entity, until back | 900 s | back |
| `device.battery_low` | battery sensor < 15 % (or `battery` binary low) | device_faults | info | entity, 24 h | once a day | > 25 % |
| `schedule.not_confirmed` | CR-014 run not confirmed / skipped (sensitive schedules) and new review items | automations | alert | schedule_id, 1 h | - | next confirmed run |
| `automation.failed` / `automation.notify` | CR-017 run error / explicit notify action | automations / chosen | alert / chosen | automation_id(+key), 10 min | CR-017 throttle | - |
| `bulk.partial` | device_bulk finished with failures | automations | info | bulk id | - | - |
| `system.health` | summary() item enters `error` (ha, go2rtc, discovery, thumbnails) | system | alert | item, until ok | 300 s | ok |
| `backup.failed` / `backup.stale` | Backup error / older than 2 days | system | alert / info | 24 h | - | next ok backup |
| `update.available` | New add-on version | system | info | version | once | installed |
| `security.new_signin` / `lockout` | Remote sign-in from a new device / code lockout | security | alert | user + device, 1 h | - | - |

Motion/person events stay rule-driven on purpose: they are the noisiest source and already have scope, windows and
cooldown. WisKey: ringing is live state in `intercom_sync` today; the source ships in v1 (owner 2ב), is verified
against the WisKey fake and one live ring before the release round, and never carries a visitor name or image (visit
requests wait for WisKey). Every source in the table is on by default except `alarm.state`, `camera.motion/person/
vehicle` (rules only) and `update.available` on push (center only); the administrator changes any of it in §19.1.

## 6. Channels

### 6.1 In-app center (always on)
The inbox opens from the user menu's "התראות" (the chip becomes the unread count, the avatar dot the open-critical
state), replacing today's link to the rule-alert tab. Desktop: a glass sheet at the content's start edge (like the
remote sheet of CR-016); phone: a full-height bottom sheet. Rows: severity colour, icon, title, place · relative time,
`×N` when folded, state (open / acknowledged by / resolved), unread dot, snoozed mark; grouped by day. Filters: all /
unread / critical, plus a source filter (by category). Per row: read, snooze (1 h), acknowledge (when allowed), open
the device or camera (deep link). Critical safety rows stay pinned at the top until acknowledged or resolved. A row
opens a detail view inside the sheet: what happened, where, when (first / last / count), state, my delivery line
("נשלח לטלפון 14:02" / "לא נשלח · שעות שקט" / "המסירה נכשלה"), the escalation timeline for critical rows, a snapshot
for camera rows (fetched inside Arx), and the action buttons of §9. Banners in the sheet header: quiet hours active,
push not available on this device, a delivery failure. Live via `/me/ws`; the 60 s poll stays as fallback. Mockup:
`docs/design/mockups/notifications/index.html`.

### 6.2 Web Push (built; generalised)
`push.py` keeps VAPID, encryption, allow-list, retries, `still_allowed`, token buckets. Changes: `plan()` takes a
notification instead of a fired rule alert and reads the **policy's** channels and the installation quiet-hours
matrix (no per-user prefs); categories gain `safety`, `automations`, `security`; payload v2 (§11); `tag` =
notification id so a fold replaces the shown notification (`renotify` only on severity rise); `Urgency: high` and
`requireInteraction` for critical; action buttons "אישור" / "השתק לשעה" where the browser supports notification
actions, and "פתח דלת" on a doorbell push as a plain deep link (§9). Device registration (`/push/subscriptions`) stays
per device: enabling push on a phone is a device fact, not a preference; what is sent to it is the administrator's
decision. Research, dated 2026-10-01:
- iOS/iPadOS 16.4+: Web Push only for Home-Screen web apps; the permission request must follow a user gesture; every
  push must show a notification or the subscription may be revoked (no silent push). [WK-IOS], [PWA-IOS-2026]
- Declarative Web Push (Safari/iOS 18.4, macOS 15.5): a JSON payload with `"web_push": 8030` shown without running the
  service worker; on iOS still for Home-Screen apps only. A later option to make iOS delivery less fragile. [WK-DWP]
- Notification action buttons on iOS/Safari web push: UNVERIFIED - assume none; the tap opens Arx on the row.
- Android Chrome delivers through FCM, encrypted end to end (CR-012 §2); the Android app WebView has no Web Push.

### 6.3 Companion phones (`notify.mobile_app_*`) - LATER STEP (owner 3ג), designed, not built
Today a rule may call any `notify.<service>` (sensitive `rules.ha_notify`); that stays. The later step adds a per-user
mapping (user → one or more `mobile_app_*` services, set by `notify.manage`) so policies can add the channel
`ha_mobile`. Designed now so v1 does not block it: the `Channel` type includes `ha_mobile`; policies carry a
`channels.ha_mobile` flag that the Settings tab shows disabled as "Companion - בקרוב"; the setting "critical sound that
overrides do-not-disturb, safety only" (owner 7) exists in `NotifySettings.companion` and is shown the same way; the
table `notify_ha_phones` is specified in §12 and created only when the step is built. The bridge allow-list will accept
only `notify.mobile_app_*` with `message`, `title` and `data` limited to `tag`, `group`, `channel` (Android: one channel
per category), `importance`/`priority`+`ttl: 0` for critical, `push.interruption-level` (`time-sensitive`; `critical`
only for the `safety` category, per the owner's decision), `url`/`clickAction` to the Arx deep link, and `actions`.
Research, dated 2026-10-01 (companion.home-assistant.io):
- Actionable notifications: `actions[] {action, title, uri, authenticationRequired, destructive, behavior: textInput}`;
  Android up to 3 actions, iOS about 10; `authenticationRequired` needs Android 12+ (all iOS). A tap fires the HA event
  `mobile_app_notification_action` with `action`, `reply_text`, and (iOS) `action_data`. [HA-ACT]
- Critical: iOS `push.sound.critical: 1` / `interruption-level: critical` passes Do Not Disturb and rate limits;
  Android `priority: high`, `ttl: 0`, `channel: alarm_stream`. [HA-CRIT]
- Attachments: Android `image: /api/camera_proxy/<camera>`; the phone downloads it itself, so it needs HA reachability
  and works only for HA camera entities, not for NVR cameras served by Arx. [HA-ATT]
- Newer HA offers `notify.send_message` to notify **entities**; mobile_app still uses the per-phone `notify.mobile_app_*`
  action (UNVERIFIED whether mobile_app registers notify entities; we target the action). [HA-NOTIFY]
- Mapping HA phones to users automatically (mobile_app config entries carry the HA user id) is UNVERIFIED through the
  WebSocket API; v1 maps by hand.
Arx listens to `mobile_app_notification_action` through the bridge; only action ids of the form
`ARX:<one-time token>:<ack|snooze>` are honoured (§9).

### 6.4 Email (v1, owner 10ב) - system faults and backups
SMTP (STARTTLS or implicit TLS, or none on a LAN relay) to a server the owner supplies, configured in the Settings
section "דואר יוצא" (§19.6): host, port, security, user, write-only password, from address, recipient addresses, and a
"שליחת בדיקה" button (`POST /notify/email/test`, 3/min) that reports the SMTP result in place. Default channel for the
sources `system.health`, `backup.*`, `nvr.*` and `update.available`; the administrator may add it to any source in the
matrix of §19.1. One plain Hebrew template (title, place, time, "פתח ב־Arx" link to the sign-in); no snapshot, no
token, no person's name. Up to 3 retries over 30 minutes; every failure lands in the delivery log and in the failures
panel. Password kept in `/data/secrets/notify_email` with mode 600, never in `settings`, never in a backup; the API
returns only `password_set: true`.

### 6.5 WhatsApp - LATER STEP (owner 10ב), channel slot only
The owner will teach the connection method when the step comes. v1 shows a disabled channel slot "WhatsApp - בקרוב" in
the channels section and reserves the enum value `whatsapp`; nothing else is designed. For the record, the public
WhatsApp Business Platform requires a Meta business account, pre-approved templates for business-initiated messages,
per-message pricing by category and country (since 2025-07-01), and sees message content; a blog report says
service-window messages become chargeable from 2026-10-01 - UNVERIFIED against Meta's own page. [WA-PRICE]

### 6.6 Android app (CR-012)
When the owner decides CR-012, the chosen transport registers as channel `app`; the fetch-after-wake endpoint returns
pending notifications from this model (the same visibility re-check).

## 7. Recipients and permissions

- **New permission `notify.manage`** (installation scope; not implied by roles other than the system administrator;
  label "ניהול התראות"): the whole Settings tab "התראות" (§19) - source policies with recipients and channels, quiet
  hours and the pass-through matrix, escalation, lock-screen detail, retention, outgoing mail, channel slots, and
  everyone's delivery log. `rules.manage` / `rules.ha_notify` stay for rules; CR-017 decides its own permission for
  the `notify` action. Escalation targets are the holders of `notify.manage` ("administrators") unless the setting
  names users.
- **Users have no notification preferences (owner 4ב).** There is no per-user channel, quiet-hour, mute, minimum
  severity or area filter. The existing user tab "מערכת ← התראות" becomes the device registration only (enable push on
  this device, test, remove a device) for users without `notify.manage`, and the full administrator tab for holders.
  Per user and per item remain: read/unread, snooze, acknowledge when permitted.
- **Receiving needs no permission.** A user receives only what they may see, evaluated per subject kind at creation,
  at every delivery attempt and at every inbox read:

| Subject | Visible when |
|---|---|
| camera | `row_scope(events.read)` allows the camera (today's rule) |
| entity / area (sensors, openings, devices) | `devices.read` on the entity's area (catalogued entities only) |
| alarm_panel | `alarm.view` |
| door (WisKey station) | `access.read` in the station's scope |
| schedule / automation | the owner of record, or `schedule.view` / CR-017's view permission in scope |
| bulk_job | the initiator only |
| system (health, backup, update) | `system.configure` |
| session / security | the account's user, plus `system.configure` holders for lockouts |

- **Recipient rule per source** (administrator, §19.1) narrows further: `scope` (everyone who can see it),
  `managers` (`notify.manage` holders), `initiator` (bulk jobs: who started it; security rows: the account's user),
  or named users. Visibility is a ceiling the rule cannot raise.
- **Sensitive content:** safety and security rows name the place and the device type only. Snapshots exist only
  inside Arx after sign-in (§11).

## 8. Quiet hours, snooze, acknowledge, escalation

### 8.1 Quiet hours (installation-wide, administrator - owner 5)
One schedule for the installation: enabled, from, to, days, in `time.zone`. The inbox always receives. For push and
email the **pass-through matrix** decides per severity × channel what is still sent during quiet hours; default:
`critical` passes on every channel, `alert` and `info` are held. Held-back rows are not sent later (TTL semantics); the
inbox has them and the delivery log says `skipped / quiet_hours`. The center shows "שעות שקט עד 07:00" while active.
There are no per-user quiet hours.

### 8.2 Snooze and acknowledge (per item)
- **Snooze** (per user, per row, 1 hour from the button; the detail view also offers "עד הבוקר"): no re-push on
  folds; hidden from the unread count until the time. There is no mute of a source or a device for a user; an
  administrator turns a source off in §19.1 instead.
- **Acknowledge** (shared): allowed to a recipient holding the subject's ack permission - `events.ack` for camera/rule
  rows, `alarm.view` for alarm/safety, the recipient itself for personal rows. Stops escalation; audited `notify.ack`;
  a rule-alert ack and a notification ack mirror each other.

### 8.3 Escalation (owner 6א; settings §19.3)
If a `critical` row is not acknowledged or resolved within `escalation.after_min` (default 5, 1-60), it is re-sent with
high urgency to the administrators (`notify.manage` holders, or the named users of the setting) on every channel the
row's policy allows, bypassing quiet hours; repeated up to `escalation.steps` (default 2, 1-3, each after another
`after_min`); stops at once on acknowledge or resolve. Every step is a delivery row and a timeline entry in the
detail view ("הסלמה 1 · נשלח ל־2 מנהלים · 14:07"). Rows below `critical` never escalate.

## 9. Actionable notifications and safety

- Allowed actions from any notification surface: **open** (deep link), **acknowledge**, **snooze** - and on a
  doorbell row **"פתח דלת"**, which is a deep link, not an action (below). Nothing else.
- Push action buttons carry a one-time token bound to (notification, user, action), 128-bit, stored hashed, single
  use, expiring with the push TTL (1 h), re-checked against visibility and ack rights. The SW calls
  `POST /notifications/action` with it. A token can authorise only `ack` or `snooze` on that row for that user.
- **The door-open safety rule (owner 9א, stated plainly).** The "פתח דלת" button on a doorbell notification - in the
  push, in the inbox row and in the detail view - **never opens the door by itself**. It opens Arx on an in-app
  confirmation dialog, "האם אתה בטוח שברצונך לפתוח את <דלת>?", which is shown only inside a signed-in Arx session of a
  user who holds `door.unlock` for that door (a phone being unlocked is **not** identity, so the push carries no
  token for it and the service worker performs no call). Confirming runs the **existing** `door.unlock` path with its
  normal CR-011 step-up, rate limits and audit row; the notification id is recorded as the origin. A user without the
  permission sees no button. The same applies to disarm, arm, scenes and device commands: none exists on any
  notification surface. This follows AGENTS.md (no unlock/disarm without task-specific authorisation) and CR-012 §3.

## 10. Delivery log, retry and failure visibility

- One `notification_deliveries` row per attempt target with status `queued | sent | retry | failed | gone | skipped`
  and a reason (`quiet_hours`, `category_off`, `muted`, `rate_limited`, `no_reach`, `http_<n>`, `ha_<code>`).
- Retries per channel: Web Push as today (5/30/120 s, Retry-After, 404/410 removes); email 3 retries over 30 min;
  Companion phones (later) 2 retries (10/60 s) on connection errors only, never on 4xx. Every retry re-checks reach
  (`still_allowed`).
- Visible: the user sees per row "נשלח לטלפון 14:02 / לא נשלח · שעות שקט / המסירה נכשלה"; the Settings section
  "יומן מסירה וכשלים" (§19.8) shows everyone's deliveries with a failures panel (last 24 h by channel), and a `system`
  notification is raised when a channel fails for everyone for 15 minutes (e.g. the mail server down).
- Retention (owner 10ב): notifications **30 days by default, a setting** (7-90, §19.5); deliveries 14 days; action
  tokens deleted on use/expiry; audit rows follow the audit retention.

## 11. Privacy

- Push payload v2: `{v:2, id, title, body, url, category, severity, tag, ts, actions?}` - no event/camera ids beyond
  the notification id, no person names, no visitor data, no image, no token except the action token.
- **Lock-screen detail (owner 8א; setting §19.4)**, one level for the installation:
  `generic` - title "Arx", body "התראה חדשה"; `type_place` (default) - title "דליפת מים · מטבח", body the severity and
  the time; `full` - title as above, body the server template with the device or camera name and the event. No level
  ever includes a person's name, a visitor or an image.
- **Image in the notification (owner 7)**: a setting `image_in_push`, **off**, shown as "בקרוב" - later it would use a
  short-lived signed URL (60 s, single use). In v1 the snapshot exists only through `GET /notifications/{id}/snapshot`
  inside Arx, for camera subjects the caller may view.
- **Critical sound on Companion phones (owner 7)**: a setting `companion.critical_sound_safety`, shown as "בקרוב";
  when the Companion step is built it applies only to the `safety` category.
- Email carries no snapshot and no link token; the link opens the sign-in.

## 12. Data model and migrations (as built: 0045-0047)

Numbers: 0040-0043 are used on integ/0.1.149, 0044 by CR-016; CR-018 ships first as 0045-0047 (release_check needs contiguous numbers; automations follow as 0048)
(renumber at merge if needed; `test_migrations.py` enforces uniqueness).

- **0045_notifications.sql** - `notifications(id, source, category, severity, subject_kind, subject_id, area_id,
  title, body, link, params_json, dedupe_key, count, first_at, last_at, state, acked_at, acked_by, resolved_at,
  origin_json, escalation_step, escalate_at, expires_at)` with a partial unique index on `(dedupe_key)` where
  `state != 'resolved'`; `notification_recipients(notification_id, user_id, read_at, snoozed_until, dismissed_at,
  decision)`; `notification_deliveries(id, notification_id, user_id, channel, target_ref, status, reason, attempt,
  created_at, sent_at)`; `notify_action_tokens(token_hash, notification_id, user_id, actions, expires_at, used_at)`;
  `rule_alerts.notification_id` column.
- **0046_notify_settings.sql** - `notify_settings(id PK = 1, quiet_json, pass_json, escalation_json, lockscreen,
  image_in_push, companion_json, retention_days, deliveries_retention_days, email_json, revision, updated_by,
  updated_at)` - one installation row (owner 4ב, 5, 6א, 7, 8א, 10ב); `email_json` holds host/port/security/user/
  from/recipients, never the password (`/data/secrets/notify_email`). No per-user preferences table: `push_prefs` stays
  readable for one release (its quiet hours seed `notify_settings.quiet_json` from the administrator's row if any) and
  is then dropped; `notify_mutes` is not created.
- **0047_notify_policies.sql** - `notify_policies(source PK, enabled, severity, category, after_s, dedupe_window_s,
  resolve_notice, recipients_json, channels_json, revision, updated_by, updated_at)` seeded from §5 with
  `channels_json = {"inbox": true, "webpush": <default>, "email": <default>, "ha_mobile": false, "whatsapp": false}`;
  `push_subscriptions.kind` (default `webpush`, room for CR-012's `fcm | unifiedpush`).
- **Designed for the Companion step, not created in v1:** `notify_ha_phones(id, user_id, service, label, created_by,
  created_at, last_ok_at, failures)`; channel `ha_mobile` and `companion_json.critical_sound_safety` already exist in
  the model so that step adds a table and a sender only.

Rollback: the migrations only add tables/columns; the old push path keeps working from `push_prefs` until 0046 is
verified. `notifications` is not part of a project backup (like `events`); `notify_settings` and `notify_policies` are
(without the mail password).

## 13. API contract delta (summary)

User: `GET /notifications`, `/notifications/summary`, read / read-all / snooze / ack, `GET /notifications/{id}/snapshot`,
own deliveries, `POST /notifications/test` (own devices). No session: `POST /notifications/action` (token).
Administrators (`notify.manage`): `GET|PUT /notify/settings`, `GET|PUT /notify/policies[/{source}]`, `GET|PUT
/notify/email` + `POST /notify/email/test`, `GET /notify/deliveries`, `GET /notify/stats`. Removed from the first
proposal: `/me/notify-prefs`, `/me/notify-mutes`, `/me/ha-phones`, `/notify/ha-services`, `/notify/ha-phones/{user}`
(the last three return with the Companion step). Device registration `/push/subscriptions` is unchanged. Server:
`notify.emit(Signal)`. Full types and errors: NOTIFICATIONS_API.md §1-§4.

## 14. Events and audit

`/me/ws`: `notification`, `notification_state`, `notify_summary`. Audit: `notify.ack`, `notify.settings.update`,
`notify.policy.update`, `notify.email.update`, `notify.email.test`, `notify.action` (token use, with the channel),
`notify.escalate` (step, recipients count); the door opened from a doorbell confirmation is the existing
`door.unlock` audit row with `origin: notification:<id>`. Never the push endpoint, the email address in full, the mail
password or the token.

## 15. Composition with CR-017 (automations)

- CR-017's action `notify` calls `notify.emit(Signal(source='automation.notify', subject=<the automation>,
  severity, category, params))` with a **template id + place parameters**, not free text sent as-is, so the privacy
  rules hold; recipients are chosen as `audience` (`scope` / `managers` / named users) and are still filtered by
  visibility of the automation's subject.
- Throttle: CR-017's own per-automation throttle plus the fold window here; an automation cannot bypass quiet hours
  unless it sets `critical`, which requires `notify.manage`.
- `automation.failed` is emitted by CR-017's runner, like `schedule.not_confirmed` by CR-014.
- Notifications are **not** triggers for automations (no loops), matching the rules engine's "alerts are not events".
- HA-side automations that call `notify.mobile_app_*` directly are outside Arx and unaffected.

## 16. Tests (T101: AT211-AT213)

- **AT211 core:** emit/fold/resolve; recipients per subject kind and per policy recipient rule (allowed/denied/scope
  revoked between create and retry); installation quiet hours across midnight and days with the pass-through matrix
  per severity × channel; snooze; escalation steps, configurable minutes/steps, stop on ack; action tokens (single
  use, expiry, other user, lost reach, never a door action); retention janitor with the configured days; migration
  with `push_prefs` left readable; a user without `notify.manage` gets 403 on every `/notify/*` route; test_push.py
  unchanged green.
- **AT212 sources and channels:** each §5 source fires, folds and resolves with the fake HA/NVR/WisKey (doorbell
  included); payload v2 contains no name/image at every lock-screen level; Web Push and email retries; the email
  test endpoint reports success and each SMTP failure class; delivery log reasons; nothing is sent on a channel the
  policy has off; the doorbell row's "פתח דלת" is a deep link only (no token, no SW call).
- **AT213 UI and evidence:** center states (loading/empty/error/ready, quiet hours, push unavailable, delivery
  failed), filters and source filter, row actions, pinned critical, detail view with the timeline and the door
  confirmation (shown only with `door.unlock`; confirm runs `door.unlock` with its audit), chip/dot from `/me/ws`;
  the Settings tab with all §19 sections at 1440/820/390, RTL; the user's device tab without `notify.manage`; SW
  action buttons; live spec on a throwaway backend; the guide updated.

## 17. Phases

1. **v1a (core + center + settings):** S1 core with `notify_settings` and policies, S3 center and the Settings tab,
   rule alerts and health/backup/security sources; Web Push v2.
2. **v1b (all remaining sources):** S2 sensors (leak/smoke/gas/CO/opening/battery/unavailable), alarm, schedules,
   automations, bulk, update, WisKey ring with the live check; escalation.
3. **v1c (email + log):** SMTP channel with the test button, delivery log and failures panel.
4. **Later steps (owner):** Companion phones with actions and the safety critical sound (§6.3), WhatsApp when the
   owner teaches the method (§6.5), image links in push (§11), CR-012 app channel, Declarative Web Push for iOS, daily
   digest.

## 18. Risks

- Noise: all sources are on in v1 (owner 2ב); mitigated by the §5 defaults, folds, the administrator's matrix and
  the per-user bucket. Users cannot mute, so a noisy source is the administrator's to turn down - the failures/volume
  counters in §19.8 make that visible.
- iOS PWA push is fragile (Home Screen only, revocation); the inbox is the source of truth, push is a hint.
- Email depends on a server the owner supplies; until configured the channel is `channel_unavailable` and the
  sources that default to it fall back to the center and push.
- Visibility bugs are the main security risk: one function, tested per subject kind, reviewed by Opus.
- The doorbell "פתח דלת" button must stay a deep link; a test asserts the push payload and the SW never carry a door
  action.
- Migration number collisions with CR-017; checked at merge.

## 19. The Settings tab "התראות" (owner's general rule)

One tab under מערכת, visible in full to `notify.manage` holders (other users see only their device registration).
Sections, in this order; every option of this CR lives here and nowhere else:

1. **מקורות והרשאות - מה נשלח** - the matrix of §5 sources (grouped by category) × פעיל × חומרה (מידע / התראה /
   קריטי) × מי מקבל (כל מי שרואה / מנהלים / היוזם או בעל החשבון / משתמשים נבחרים) × ערוצים (מרכז - always on; דחיפה;
   דוא"ל; Companion - בקרוב; WhatsApp - בקרוב). Phone: one card per source.
2. **שעות שקט ומה עובר** - enabled, from, to, days; the pass-through matrix severity × channel (default: only
   קריטי passes).
3. **הסלמה** - enabled; after N minutes (default 5); steps (default 2, max 3); to whom (מנהלי התראות / משתמשים
   נבחרים); "נעצרת באישור" is fixed; a preview timeline.
4. **פרטיות מסך נעול** - detail level (גנרי / סוג ומקום / מלא) with a live preview of the push card; "תמונה בהתראה"
   off + בקרוב; "צליל קריטי שעוקף 'נא לא להפריע' - בטיחות בלבד (Companion)" + בקרוב.
5. **שמירה** - notifications retention (7 / 14 / 30 / 60 / 90 days; default 30); delivery log 14 days (fixed).
6. **דואר יוצא** - SMTP host, port, security, user, password (write-only), from, recipients; "שליחת בדיקה" with the
   result in place; last test time and result.
7. **ערוצים** - מרכז ההתראות (פעיל תמיד); דחיפה (Arx) with the count of registered devices; Companion - בקרוב;
   WhatsApp - בקרוב.
8. **יומן מסירה וכשלים** - deliveries table (time, notification, user, channel, status, reason) with a "רק כשלים"
   filter and a failures panel for the last 24 h by channel.

## Sources (read 2026-10-01)

- [WK-IOS] https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- [WK-DWP] https://webkit.org/blog/16535/meet-declarative-web-push/ (2025-03-27)
- [PWA-IOS-2026] https://www.mobiloud.com/blog/progressive-web-apps-ios/ (secondary source)
- [HA-ACT] https://companion.home-assistant.io/docs/notifications/actionable-notifications/
- [HA-CRIT] https://companion.home-assistant.io/docs/notifications/critical-notifications/
- [HA-ATT] https://companion.home-assistant.io/docs/notifications/notification-attachments/
- [HA-NOTIFY] https://www.home-assistant.io/integrations/notify/
- [HA-EVENT] https://www.home-assistant.io/integrations/event/ (event entities, 2023.8; `event.received` trigger)
- [WA-PRICE] https://www.cm.com/blog/whatsapp-business-platform-pricing/ (secondary source)
- RFC 8030 (Web Push), RFC 8291 (message encryption), RFC 8292 (VAPID) - as implemented in `services/push.py`.
- CR-012 §2 for Android/FCM facts (read 2026-09-30).
