# CR-018 — Notifications (התראות): one center for every source, channel and recipient

**Numbering:** registered as CR-018 on 2026-10-01. Task card: T101 (requirements R211-R213, acceptance tests
AT211-AT213). T100 / R208-R210 are left for CR-017 (automations), which is being written in parallel.

**Status:** Proposed - architecture and research only, no product code. Decisions for the owner:
`docs/design/mockups/notifications/decisions-HE.md`. Contract and parallel plan: `docs/architecture/NOTIFICATIONS_API.md`.

**Related:** MASTER_SPEC_HE.md §28 (rules, responses: in-product alert, HA event/deep link, push via an approved HA
target), T052 rules (`services/rules.py`), CR-008 P3 Web Push (`services/push.py`, built), CR-012 Android app push
(proposed, open), CR-010 alarm, CR-011 step-up, CR-013 shell (user menu), CR-014 scheduler, CR-017 automations.

## 1. The request

The owner listed "התראות" among the items that close overall development (with automations/scenes/scripts and a few
integrations), without a definition. This CR therefore (a) inventories what exists, (b) proposes one model that the
other sources and CR-017 can feed, and (c) asks the owner the few questions that decide scope.

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
2. Built-in sources with sensible defaults (§5) that work without writing rules; rules and CR-017 automations add more.
3. Delivery to the in-app center always, and to Web Push and HA phones by preference, with a delivery log and
   visible failures.
4. Per-user control: channels per category, minimum push severity, quiet hours with days, mutes and snooze; shared
   acknowledge; escalation for critical safety events.
5. The existing guarantees stay: never notify about something the user cannot see; minimal payloads; no sends under
   the SQLite write lock; retries re-check reach.

**Non-goals (v1)**
- WhatsApp and SMS (third party sees content, Meta business verification, template approval, per-message pricing,
  phone numbers as personal data) - revisit on request (§6.5).
- Actions that change the physical world from a notification (open door, disarm, run scene) - §9.
- Android-app push (CR-012 decides the transport; the model here accepts it as channel `app` later) and iOS native.
- HA `persistent_notification` (lands in the HA UI, which operators do not use; owner rule: no HA branding).
- Face/person names, AI descriptions or images inside any push payload.
- Webhooks and outbound integrations (MASTER_SPEC §28 limits stay).

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
  (condition must hold), dedupe window, resolve notice, escalation, audience. Rules (`rules`) and automations keep their
  own definitions and emit with source `rule.alert` / `automation.notify`.
- **Notification:** one row per open condition. A new signal with the same dedupe key inside the window folds into it
  (`count`, `last_at`) instead of creating a row or a new push; a higher severity re-notifies. A resolve signal closes
  it (`resolved`). Shared state: `open → acknowledged → resolved` (ack optional; resolve automatic where the source can
  tell, else on ack).
- **Recipients:** decided when the row is created and re-checked at every delivery and every inbox read.
- **Delivery:** one row per (notification, user, channel, target) with status and reason, retried per channel rules.

## 5. Sources in v1

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
cooldown. WisKey: ringing is live state in `intercom_sync` today; the source is gated behind a setting until checked
against the fake and one live ring, and never carries a visitor name or image (visit requests wait for WisKey).

## 6. Channels

### 6.1 In-app center (always on)
The inbox opens from the user menu's "התראות" (the chip becomes the unread count, the avatar dot the open-critical
state), replacing today's link to the rule-alert tab. Rows: severity colour, title, place, relative time, `×N` when
folded, state. Filters: all / unread / critical / category. Per row: read, snooze (1 h / 8 h / until morning),
dismiss, acknowledge (when allowed), open (deep link). Critical safety rows stay pinned until acknowledged or resolved.
Live via `/me/ws`; the 60 s poll stays as fallback.

### 6.2 Web Push (built; generalised)
`push.py` keeps VAPID, encryption, allow-list, retries, `still_allowed`, token buckets. Changes: `plan()` takes a
notification instead of a fired rule alert; categories gain `safety`, `automations`, `security`; payload v2 (§11);
`tag` = notification id so a fold replaces the shown notification (`renotify` only on severity rise); `Urgency: high`
and `requireInteraction` for critical; action buttons "אישור" / "השתק לשעה" where the browser supports notification
actions. Research, dated 2026-10-01:
- iOS/iPadOS 16.4+: Web Push only for Home-Screen web apps; the permission request must follow a user gesture; every
  push must show a notification or the subscription may be revoked (no silent push). [WK-IOS], [PWA-IOS-2026]
- Declarative Web Push (Safari/iOS 18.4, macOS 15.5): a JSON payload with `"web_push": 8030` shown without running the
  service worker; on iOS still for Home-Screen apps only. A later option to make iOS delivery less fragile. [WK-DWP]
- Notification action buttons on iOS/Safari web push: UNVERIFIED - assume none; the tap opens Arx on the row.
- Android Chrome delivers through FCM, encrypted end to end (CR-012 §2); the Android app WebView has no Web Push.

### 6.3 HA phones (`notify.mobile_app_*`)
Today a rule may call any `notify.<service>` (sensitive `rules.ha_notify`). v1 adds a per-user mapping (user → one or
more `mobile_app_*` services, set by `notify.manage`) so built-in sources and preferences can use the Companion app.
The bridge allow-list accepts only `notify.mobile_app_*` with `message`, `title` and `data` limited to `tag`, `group`,
`channel` (Android: one channel per category), `importance`/`priority`+`ttl: 0` for critical, `push.interruption-level`
(`time-sensitive`; `critical` only if the owner approves Q7), `url`/`clickAction` to the Arx deep link, and `actions`.
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

### 6.4 Email (optional, owner Q10)
SMTP with STARTTLS/TLS to a server the owner provides; a plain Hebrew template (title, place, time, "פתח ב־Arx" link);
no snapshot; for `system`, `security` and daily digests only by default. Password write-only in `/data/secrets`,
never in `settings` or a backup.

### 6.5 WhatsApp (not in v1)
The WhatsApp Business Platform requires a Meta business account, pre-approved templates for business-initiated
messages, per-message pricing by category and country (since 2025-07-01), and sees message content. A blog report says
service-window messages become chargeable from 2026-10-01 - UNVERIFIED against Meta's own page. [WA-PRICE] Better
served later through WisKey if WisKey adds it, or not at all.

### 6.6 Android app (CR-012)
When the owner decides CR-012, the chosen transport registers as channel `app`; the fetch-after-wake endpoint returns
pending notifications from this model (the same visibility re-check).

## 7. Recipients and permissions

- **New permission `notify.manage`** (installation scope; not implied by roles other than the system administrator;
  label "ניהול התראות"): edit source policies, map HA phones to users, view everyone's delivery log, configure email.
  `rules.manage` / `rules.ha_notify` stay for rules; CR-017 decides its own permission for the `notify` action.
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

- **Audience** narrows further: `scope` (everyone who can see it), `managers` (`notify.manage` holders), `initiator`.
- **Users subscribe within their scope:** per-category channels, minimum push severity, an optional area filter, mutes.
  A user can never add a subscription that widens what they see.
- **Sensitive content:** safety and security rows name the place and the device type only. Snapshots exist only
  inside Arx after sign-in (§11).

## 8. Quiet hours, snooze, mute, acknowledge, escalation

- **Quiet hours** (existing, extended with days): the inbox still receives; push/HA phones are held back except
  `critical` when `allow_critical` (default on). Held-back rows are not sent later (TTL semantics); the inbox has them.
- **Snooze** (per user, per row): no re-push on folds; hidden from the unread count until the time.
- **Mute** (per user, source or subject, up to 7 days, max 50): "השתק את המצלמה הזאת ל־8 שעות".
- **Acknowledge** (shared): allowed to a recipient holding the subject's ack permission - `events.ack` for camera/rule
  rows, `alarm.view` for alarm/safety, the recipient itself for personal rows. Stops escalation; audited `notify.ack`;
  a rule-alert ack and a notification ack mirror each other.
- **Escalation** (critical only, policy-driven, default for `safety`): if not acknowledged or resolved in `after_s`
  (default 5 min), re-send with high urgency to the escalation list (managers or named users) and to their HA phones;
  at most two steps; stops on ack/resolve. Never escalates into channels a user turned off, except `safety` when the
  owner approves (Q6).

## 9. Actionable notifications and safety

- Allowed actions from any notification surface: **open** (deep link), **acknowledge**, **snooze**. That is all.
- Push action buttons (Web Push, HA phone) carry a one-time token bound to (notification, user, action), 128-bit,
  stored hashed, single use, expiring with the push TTL (1 h), re-checked against visibility and ack rights. The SW
  calls `POST /notifications/action` with it; HA action events are matched the same way. A token cannot authorise
  anything else.
- **No door open, disarm, arm, scene or device command from a notification**, even with `authenticationRequired`
  (device unlock is not user identity in Arx). The doorbell notification's tap opens the WisKey/door screen, where
  `door.unlock` and CR-011 step-up apply as usual. This follows AGENTS.md (no unlock/disarm without task-specific
  authorisation) and CR-012 §3.

## 10. Delivery log, retry and failure visibility

- One `notification_deliveries` row per attempt target with status `queued | sent | retry | failed | gone | skipped`
  and a reason (`quiet_hours`, `category_off`, `muted`, `rate_limited`, `no_reach`, `http_<n>`, `ha_<code>`).
- Retries per channel: Web Push as today (5/30/120 s, Retry-After, 404/410 removes); HA phones 2 retries (10/60 s) on
  connection errors only, never on 4xx; email 3 retries over 30 min. Every retry re-checks reach (`still_allowed`).
- Visible: the user sees per row "נשלח לטלפון / לא נשלח - שעות שקט"; managers get a failures panel (last 24 h by
  channel and target) and a `system` notification when a channel fails for everyone for 15 minutes (e.g. HA down).
- Retention: notifications 30 days (owner Q10: 30 or 90), deliveries 14 days, action tokens deleted on use/expiry;
  audit rows follow the audit retention.

## 11. Privacy

- Push payload v2: `{v:2, id, title, body, url, category, severity, tag, ts, actions?}` - no event/camera ids beyond
  the notification id, no person names, no visitor data, no image, no token except the action token.
- Lock screen: the title names the category and place ("דליפת מים · מטבח"); the owner may choose "category only"
  (Q8), in which case the body is replaced by "פתח את Arx".
- Snapshots: `GET /notifications/{id}/snapshot` inside Arx only, for camera subjects the caller may view. An attached
  image in push (Web Push `image`, HA `image`) is off by default and possible later only through a short-lived signed
  URL (60 s, single use) if the owner asks (Q7).
- Email carries no snapshot and no link token; the link opens the sign-in.

## 12. Data model and migrations (planned 0050-0052)

Numbers: 0040-0043 are used on integ/0.1.149, 0044 by CR-016, 0045+ reserved for CR-017; CR-018 takes 0050-0052
(renumber at merge if needed; `test_migrations.py` enforces uniqueness).

- **0050_notifications.sql** - `notifications(id, source, category, severity, subject_kind, subject_id, area_id,
  title, body, link, params_json, dedupe_key, count, first_at, last_at, state, acked_at, acked_by, resolved_at,
  origin_json, escalation_step, escalate_at, expires_at)` with a partial unique index on `(dedupe_key)` where
  `state != 'resolved'`; `notification_recipients(notification_id, user_id, read_at, snoozed_until, dismissed_at,
  decision)`; `notification_deliveries(id, notification_id, user_id, channel, target_ref, status, reason, attempt,
  created_at, sent_at)`; `notify_action_tokens(token_hash, notification_id, user_id, actions, expires_at, used_at)`;
  `rule_alerts.notification_id` column.
- **0051_notify_prefs.sql** - `notify_prefs(user_id, channels_json, min_push_severity, quiet_json, area_filter_json,
  updated_at, revision)` filled from `push_prefs` (which stays readable for one release, then dropped);
  `notify_mutes(id, user_id, source, subject_kind, subject_id, until)`.
- **0052_notify_targets.sql** - `notify_policies(source PK, enabled, severity, category, after_s, dedupe_window_s,
  resolve_notice, escalate_json, audience, revision, updated_by, updated_at)` seeded from §5;
  `notify_ha_phones(id, user_id, service, label, created_by, created_at, last_ok_at, failures)`;
  `push_subscriptions.kind` (default `webpush`, room for CR-012's `fcm | unifiedpush`).

Rollback: the migrations only add tables/columns; the old push path keeps working from `push_prefs` until 0051's
copy is verified. `notifications` is not part of a project backup (like `events`); policies are.

## 13. API contract delta (summary)

User: `GET /notifications`, `/notifications/summary`, read / read-all / snooze / dismiss / ack, `GET
/notifications/{id}/snapshot`, `GET|PUT /me/notify-prefs`, mutes, `GET /me/ha-phones`, `POST /notifications/test`,
own deliveries. No session: `POST /notifications/action` (token). Managers: `/notify/policies`, `/notify/ha-services`,
`/notify/ha-phones/{user}`, `/notify/deliveries`, `/notify/email`, `/notify/stats`. Server: `notify.emit(Signal)`.
Full types and errors: NOTIFICATIONS_API.md §1-§4.

## 14. Events and audit

`/me/ws`: `notification`, `notification_state`, `notify_summary`. Audit: `notify.ack`, `notify.policy.update`,
`notify.ha_phone.map`, `notify.email.update`, `notify.action` (token use, with the channel), `notify.mute`; never the
push endpoint, the email address in full or the token.

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

- **AT211 core:** emit/fold/resolve; recipients per subject kind (allowed/denied/scope revoked between create and
  retry); quiet hours across midnight and days; critical bypass; mutes, snooze; min severity; escalation steps and
  stop on ack; action tokens (single use, expiry, other user, lost reach); retention janitor; migration from
  `push_prefs`; test_push.py unchanged green.
- **AT212 sources and channels:** each §5 source fires, folds and resolves with the fake HA/NVR/WisKey; bridge refuses
  non-`mobile_app_*` targets and non-token action ids; payload v2 contains no name/image; HA phone and Web Push
  retries; delivery log reasons; email only when configured.
- **AT213 UI and evidence:** inbox states (loading/empty/error/ready), filters, row actions, pinned critical, chip/dot
  from `/me/ws`, settings (channels per category, quiet days, mutes), manager sources page and failures panel, SW
  action buttons; 1440/820/390, RTL; live spec on a throwaway backend; the guide updated.

## 17. Phases

1. **v1a (core + center):** S1 + S3 inbox/settings, rule alerts and health/backup/security sources; Web Push v2.
2. **v1b (home sources):** S2 sensors (leak/smoke/opening/battery/unavailable), alarm, schedules, bulk; escalation.
3. **v1c (channels):** HA phones with actions; email if approved; WisKey ring after the live check.
4. **Later:** CR-012 app channel, Declarative Web Push for iOS, snapshot links, daily digest, WhatsApp if ever.

## 18. Risks

- Noise: built-in sources could flood; mitigated by conservative defaults (§5), folds, mutes and the per-user bucket.
- iOS PWA push is fragile (Home Screen only, revocation); the inbox is the source of truth, push is a hint.
- HA phone mapping by hand can go stale when a phone is replaced; the failures panel shows it.
- Visibility bugs are the main security risk: one function, tested per subject kind, reviewed by Opus.
- Migration number collisions with CR-017; checked at merge.

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
