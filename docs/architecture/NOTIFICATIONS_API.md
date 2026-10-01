# Notifications — API contract delta and parallel work plan (CR-018)

**Status:** Decisions adopted, 2026-10-01 (owner answers in CR §1.1); nothing here is implemented. Change record:
`docs/changes/CR-018-NOTIFICATIONS.md` (the "CR" below). Decisions record: `docs/design/mockups/notifications/
decisions-HE.md`. Mockup: `docs/design/mockups/notifications/index.html`. Task: T101 (R211-R213, AT211-AT213).

Changes from the first proposal (same day): per-user preferences, mutes and HA-phone mapping are gone (owner 4ב, 3ג);
one installation `NotifySettings` row and per-source recipients/channels replace them; email is in v1 (10ב); the
Companion channel and WhatsApp are reserved enum values only.

Base path `api/v1`, the same auth (HA identity → Principal), error envelope and ETag/revision conventions as the rest of
the API. All instants are UTC ISO strings; quiet hours are evaluated in the installation's IANA zone (`time.zone`).

## 1. Types

```ts
type Severity = 'info' | 'alert' | 'critical';                  // services/rules.SEVERITY_RANK, unchanged
type Category = 'safety' | 'alerts' | 'doors' | 'device_faults' | 'automations' | 'system' | 'security';
                                                                 // alerts/doors/device_faults/system exist in push.py
type Channel = 'inbox' | 'webpush' | 'email'                        // v1
             | 'ha_mobile' | 'whatsapp' | 'app';                     // reserved: Companion step, WhatsApp step, CR-012
type SubjectKind = 'camera' | 'entity' | 'area' | 'alarm_panel' | 'door' | 'schedule' | 'automation'
                 | 'bulk_job' | 'system' | 'session';

interface Notification {                 // what the inbox returns; never contains a person's name or an image URL
  id: string;
  source: string;                        // e.g. 'camera.offline', 'rule.alert', 'sensor.leak', 'automation.failed'
  category: Category;
  severity: Severity;
  title: string;                         // Hebrew, built server-side from a template; <= 80 chars
  body: string;                          // <= 180 chars
  subject: { kind: SubjectKind; id: string | null; area_id: string | null };
  link: string;                          // hash route inside Arx, e.g. '#/investigate/events/<id>'
  count: number;                         // occurrences folded into this row by dedupe
  first_at: string; last_at: string;
  state: 'open' | 'acknowledged' | 'resolved';
  acked_at: string | null; acked_by_display: string | null;   // shared across recipients
  resolved_at: string | null;
  me: { read_at: string | null; snoozed_until: string | null };      // the only per-user state (owner 4ב)
  can_ack: boolean;                      // computed for the caller (§4)
  has_snapshot: boolean;                 // a snapshot is fetched separately, after sign-in (§3.6)
  door: { id: string; name: string; can_open: boolean } | null;      // doorbell rows only: the deep-link target of
                                         // "פתח דלת"; can_open = caller holds door.unlock there (CR §9). Never a token.
  timeline: { at: string; kind: 'created' | 'folded' | 'escalated' | 'acknowledged' | 'resolved' | 'delivery_failed';
              step?: number; count?: number; by_display?: string; channel?: Channel }[];
  my_deliveries: { channel: Channel; status: Delivery['status']; reason: string | null; at: string }[];
}

interface NotifySettings {               // ONE row for the installation; notify.manage only (owner 4ב, 5, 6א, 7, 8א, 10ב)
  quiet: { enabled: boolean; from: string; to: string;             // "22:00" / "07:00", in time.zone
           days: ('sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat')[] };
  pass_through: Record<Severity, { webpush: boolean; email: boolean; ha_mobile: boolean }>;
                                         // what is still sent during quiet hours; default: critical true, others false
  escalation: { enabled: boolean; after_min: number; steps: number;  // defaults 5 (1-60), 2 (1-3)
                to: 'managers' | string[] };                        // notify.manage holders, or named user ids
  lockscreen: 'generic' | 'type_place' | 'full';                     // default 'type_place'
  image_in_push: false;                  // fixed false in v1 (later step); shown disabled as "בקרוב"
  companion: { critical_sound_safety: boolean };                     // later step; shown disabled as "בקרוב"
  retention_days: 7 | 14 | 30 | 60 | 90; // default 30
  deliveries_retention_days: 14;         // fixed
  email: { configured: boolean; host: string; port: number; security: 'starttls' | 'tls' | 'none';
           user: string; password_set: boolean; from: string; recipients: string[];   // the password is never returned
           last_test: { at: string; ok: boolean; detail: string } | null };
  revision: number; updated_at: string | null;
}

interface NotifyPolicy {                 // per source, installation-wide (notify.manage)
  source: string; enabled: boolean; severity: Severity; category: Category;
  after_s: number;                       // condition must hold this long (e.g. door open 600, offline 120)
  dedupe_window_s: number;               // occurrences inside fold into the open row
  resolve_notice: boolean;               // send a quiet "resolved" update (default false; true for critical)
  recipients: { rule: 'scope' | 'managers' | 'initiator' | 'users'; user_ids?: string[] };
                                         // who receives, on top of visibility (§4); 'initiator' = bulk starter / account owner
  channels: { inbox: true; webpush: boolean; email: boolean; ha_mobile: false; whatsapp: false };
                                         // inbox fixed on; ha_mobile/whatsapp fixed false in v1 (reserved)
  revision: number;
}

interface Delivery {                     // the delivery log (own rows; all with notify.manage)
  id: string; notification_id: string; user_display: string; channel: Channel;
  target: string;                        // push host / "טלפון: <label>" / masked email - never an endpoint or address
  status: 'queued' | 'sent' | 'retry' | 'failed' | 'gone' | 'skipped';
  reason: string | null;                 // 'quiet_hours' | 'category_off' | 'rate_limited' | 'no_reach' | 'muted' | http_<n> ...
  attempt: number; at: string;
}
```

## 2. Routes

### 2.1 Every signed-in user (no permission; the caller's own data only)

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?state=open\|all&category=&severity_min=&before=&limit=50` | Own inbox, newest first. Rows are re-checked against the caller's **current** visibility at read time (a revoked scope hides old rows). |
| GET | `/notifications/summary` | `{unread, open_critical, by_category}` - the user-menu chip and the avatar dot. |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | Per-user state. |
| POST | `/notifications/{id}/snooze` `{minutes: 60 \| until_morning}` | Per user; hides from the unread count and suppresses re-pushes of this row until then. |
| POST | `/notifications/{id}/ack` | Shared acknowledge; 403 unless `can_ack` (§4). Stops escalation; audited `notify.ack`. |
| GET | `/notifications/{id}/snapshot` | JPEG from the event's stored snapshot, only for `camera` subjects the caller may `video.live` or `events.read` there; 404 otherwise. Never in a push. |
| POST | `/notifications/test` | Sends a test to the caller's own registered devices (existing `/push/test` rate limit, 3/min). |
| GET | `/notifications/deliveries?notification_id=` | Own delivery rows. |

Removed from the first proposal (owner 4ב, 3ג): `/me/notify-prefs`, `/me/notify-mutes`, `/me/ha-phones`,
`/notifications/{id}/dismiss` (a read row simply ages out; the inbox has read/unread and snooze only). `/push/prefs`
answers 410 after one release.

Existing, unchanged: `/push/vapid-key`, `/push/subscriptions` (GET/POST/DELETE - device registration, every user),
`/push/rotate-key` (system.configure), `/rules`, `/rules/alerts`, `/rules/alerts/{id}/ack` (an ack there also acks the
linked notification).

### 2.2 Push action endpoint (no session)

| POST | `/notifications/action` `{t: <action token>, a: 'ack' \| 'snooze'}` |
|---|---|

The token is minted per (notification, user, allowed actions) when the push is built: 128-bit random, stored hashed,
single use, expires with the push TTL (1 h). It authorises exactly that action on that row for that user, re-checked
against current visibility and `can_ack`. Anything else is **not** an action. In particular the doorbell button
"פתח דלת" is a deep link `#/doors/<id>?confirm=<notification id>`: Arx opens, requires a signed-in session, shows the
confirmation dialog only to a holder of `door.unlock` for that door, and on confirm calls the **existing**
`POST /doors/{id}/unlock` with its CR-011 step-up, rate limit and audit (`origin: notification:<id>`). The service
worker never calls an unlock route, and no token for it exists (CR §9).

### 2.3 Administrators (`notify.manage`, installation scope)

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/notify/settings` | `NotifySettings` without the mail password; PUT with `If-Match` revision; audited `notify.settings.update` (field names only). |
| GET / PUT | `/notify/policies` · `/notify/policies/{source}` | `NotifyPolicy`; PUT with revision; audited `notify.policy.update`. `ha_mobile`/`whatsapp` true → 422 `channel_reserved` in v1. |
| PUT | `/notify/email` `{host, port, security, user, password?, from, recipients}` | Password write-only to `/data/secrets/notify_email` (mode 600); omitted = unchanged; audited `notify.email.update` without values. |
| POST | `/notify/email/test` | Sends one test mail to the recipients; 3/min; returns `{ok, detail}` (`detail` is the SMTP class: dns, connect, tls, auth, refused, timeout) and stores `email.last_test`. Audited `notify.email.test`. |
| GET | `/notify/deliveries?status=failed&channel=&since=&limit=` | Everyone's delivery log (masked targets) for "יומן מסירה וכשלים" and its failures panel. |
| GET | `/notify/stats` | Per-channel counters for the last 24 h (sent, failed, skipped by reason) plus the push worker STATS. |

Reserved for the Companion step (not in v1): `GET /notify/ha-services`, `PUT|DELETE /notify/ha-phones/{user_id}`,
`GET /me/ha-phones`.

### 2.4 Server-side API (Python, not HTTP) - the single entry point

```python
# services/notify.py
def emit(conn, signal: Signal) -> str | None:        # returns the notification id or None (disabled / folded)
@dataclass
class Signal:
    source: str                    # policy key, e.g. 'sensor.leak'
    subject_kind: str; subject_id: str | None
    severity: str | None = None    # None = the policy's
    dedupe_key: str | None = None  # None = f"{source}:{subject_kind}:{subject_id}"
    params: dict = field(default_factory=dict)   # template parameters - ids and names of places, never people
    origin: dict = field(default_factory=dict)   # {'alert_id'|'event_id'|'run_id'|'automation_id'|'bulk_id': ...}
    initiator_user_id: str | None = None         # for audience 'initiator'
    resolve: bool = False          # the condition ended: resolve the open row with this dedupe key
```

`emit` writes inside the caller's transaction and only **enqueues** channel work after commit (the rule that `push.py`
already follows: nothing is sent under the SQLite write lock). Rule alerts (`rules.deliver_pending`), system monitors,
CR-014 run settlement, CR-017's `notify` action and bulk completions all call `emit`; nothing else sends.

## 3. Events (on the existing per-user WebSocket `/me/ws`)

There is no SSE in Arx; realtime is in-process WebSocket fan-out (`/events/ws`, `/ha/ws`, `/intercom/ws`, `/me/ws`).
The notification events ride on `/me/ws` (today it carries `permissions_changed`), which is already per user, so no
scope filter per event is needed beyond "is this user a recipient". The 60 s `pollAlerts()` in `sw-app.ts` becomes a
fallback when the socket is down.

| Event | Payload | Who receives |
|---|---|---|
| `notification` | `{id, category, severity, unread}` | each recipient's open sessions only |
| `notification_state` | `{id, state, acked_by_display?}` | every recipient of that row |
| `notify_summary` | `{unread, open_critical}` | the user (after read/snooze/dismiss on another device) |

## 4. Errors

`notification_not_found` 404 (also for a row the caller may no longer see), `ack_not_allowed` 403,
`action_token_invalid` 401 (expired, used, wrong user), `settings_conflict` 412 (stale revision), `quiet_invalid` 422
(from == to), `escalation_invalid` 422 (after_min or steps out of range), `channel_reserved` 422 (ha_mobile /
whatsapp in v1), `channel_unavailable` 409 (email not configured), `email_invalid` 422 (host/port/address),
`rate_limited` 429 with `Retry-After`, `forbidden` 403 for every `/notify/*` route without `notify.manage`.

## 5. Parallel work plan

Same conventions as CR-014/015/016: one owner of the shared contract and DB (S1), frontend agents work on the mock,
Sonnet for well-specified slices, an Opus review of the permission and delivery path before merge. Branches
`pilot/CR018-s<N>-...` from g0/intake after the owner's answers.

### P0 — decisions + mockup (lead) - DONE 2026-10-01

Owner answers adopted (CR §1.1). Mockup `docs/design/mockups/notifications/index.html` (Domus glass style of the
approved multimedia mockups; Heebo embedded; 1440 and 390; light/dark): the center from the user menu's bell, rows with
severity/fold/read/snooze/ack and a source filter, the detail view with the doorbell "פתח דלת" → in-app confirmation,
the lock-screen push at the three detail levels, the Settings tab with the eight sections of CR §19, the escalation
timeline, and the states (loading/empty/error, quiet hours, push unavailable, delivery failed). Screenshots in
`docs/evidence/notifications-mockup/`. Next: S0 `frontend/src/api/notifications.ts` types + mock (1 h), after the
owner's review of the mockup.

### S1 — backend core (`pilot/CR018-s1-core`, Sonnet, reviewed by Opus)

```
Goal: CR §5, §7-§12: migrations 0050-0052, services/notify.py (emit, dedupe/fold, resolve, recipients = policy rule
  ∩ visibility matrix, installation quiet hours with the pass-through matrix, snooze, escalation timer with
  configurable minutes/steps, action tokens, retention janitor with the configured days), services/notify_settings.py
  (the single NotifySettings row, revision, validation), generalise services/push.py from "fired rule alert" to
  "notification" (plan() reads the policy's channels and the settings; categories + safety/automations/security;
  payload v2 with no names at the three lock-screen levels; actions ack/snooze where the browser supports them; the
  doorbell button as a deep link only), delivery log writes, routers/notifications.py (§2.1-§2.3), /me/ws events,
  notify.manage in roles.json + access.py labels, audit kinds; rule_alerts rows get a notification_id link (ack on
  either side acks both); /push/prefs → 410 after one release.
Owns: migrations/0050_notifications.sql, 0051_notify_settings.sql, 0052_notify_policies.sql, services/notify.py,
  services/notify_settings.py, services/notify_policy.py, routers/notifications.py, tests/test_notify_*.py.
Touches (sole editor): services/push.py, services/rules.py (deliver_pending → emit), routers/push.py,
  routers/rules.py (ack mirror), roles.json, routers/access.py (labels), the /me/ws publisher, main.py (router +
  janitor), contracts/API_INVENTORY.md.
Done: pytest for recipients (every subject kind × policy rule × allowed/denied), dedupe/fold, quiet hours across
  midnight and days with the matrix, snooze, escalation (steps, stop on ack, configurable), action tokens (single use,
  expiry, wrong user, lost scope, never a door action), retention, 403 on /notify/* without notify.manage, migration
  up on a 0.1.149 DB copy with push_prefs left readable; the existing test_push.py green.
Estimate: 22-28 agent-hours.
```

### S2 — sources and monitors (`pilot/CR018-s2-sources`, Sonnet)

```
Goal: CR §5 table: emit() calls for camera/NVR health (from the health service and fault events), alarm state (CR-010
  panel mirror), HA sensors by device_class (moisture, smoke, gas, carbon_monoxide, door/window/opening with after_s,
  battery < threshold, catalogued entity unavailable > after_s) with resolve signals, CR-014 run settlement
  (not_confirmed/skipped on sensitive schedules, review items), bulk job completion (partial/failed → initiator),
  system monitors (backup failed, HA link down, NVR unreachable, storage, update available, tunnel down), remote access
  (new device sign-in, lockout → the user + managers). WisKey doorbell from services/intercom_sync.py's call-state
  transitions (ringing → a `doors` row with the station's place only, never a visitor name or image, plus the
  `door` deep-link target) - in v1 (owner 2ב), verified against the WisKey fake and one live ring before release.
  All sources are on by default except the §5 exceptions.
Owns: services/notify_sources.py, services/notify_sensors.py, tests/test_notify_sources.py; fake HA state fixtures.
Touches: one emit() line each in services/health_report (a monitor over summary() transitions), the alarm mirror,
  schedule run settlement, device_bulk, backup, remote sign-in, intercom_sync, the update check.
Done: each source has a unit test for fire, fold, resolve and the not-visible case; no source sends on its own.
Estimate: 18-26 agent-hours (all sources + the live WisKey check).
```

### S3 — frontend: notification center + Settings tab (`pilot/CR018-s3-ui`, Sonnet)

```
Goal: CR §6.1, §9, §19, following the mockup: the center (desktop glass sheet at the content's start edge; phone:
  full bottom sheet) from the user menu's התראות; rows grouped by day with severity, icon, place · time, ×N, state,
  unread dot, snoozed mark; pinned critical; filters all / unread / critical + source filter; row menu: read, snooze
  1 h, acknowledge (when can_ack), open the device; detail view: what/where/when, state, my delivery line, timeline,
  snapshot inside the app, actions פתח / אישור / השתק לשעה, and on doorbell rows פתח דלת → the in-app confirmation
  dialog (shown only when door.can_open; confirm calls the existing unlock route); banners: quiet hours, push
  unavailable on this device, delivery failed; the avatar dot and chip from /notifications/summary + /me/ws
  (replacing the 60 s rule-alert poll). The Settings tab מערכת ← התראות for notify.manage holders with the eight
  sections of CR §19 (sources matrix with recipients and channels incl. disabled Companion/WhatsApp slots; quiet
  hours + pass-through matrix; escalation with preview; lock-screen level with preview + the two "בקרוב" toggles;
  retention; outgoing mail with the test button and result; channels; delivery log with the failures panel); users
  without notify.manage keep the device-registration view only. The service worker: action buttons (ack/snooze) where
  supported, the doorbell button as a deep link, the action endpoint call, badge = unread.
Owns: components/notify-center.ts, components/notify-row.ts, components/notify-detail.ts,
  screens/system-notifications.ts (rewrite), pwa/sw.ts (push handler v2), specs unit-notify-*.spec.ts,
  evidence-notify-center.spec.ts (demo; 1440/820/390; loading/empty/error/ready; RTL).
Touches (sole editor): shell/sw-user-menu.ts (count source), shell/sw-app.ts (dot), shell/nav.ts, api/ha.ts (events).
Done: clean operator screens (no HA/Companion names outside settings; no hint paragraphs), 44 px targets, tsc clean,
  specs run and reported.
Estimate: 24-32 agent-hours (the Settings tab grew from one page to eight sections).
```

### S4 — email channel (`pilot/CR018-s4-email`, Sonnet)

```
Goal: CR §6.4: SMTP delivery (STARTTLS / TLS / none) with the plain Hebrew template and no snapshot; the write-only
  password in /data/secrets/notify_email (mode 600); /notify/email PUT and /notify/email/test with the SMTP failure
  classes; 3 retries over 30 min with reach re-check; delivery rows and the 15-minute "channel down" system
  notification; a fake SMTP server in tests. Reserved, NOT built: ha_mobile (Companion step) and whatsapp - only the
  enum values, the disabled channel flags and the 422 channel_reserved guard from S1.
Owns: services/notify_email.py, tests/test_notify_email.py (fake SMTP).
Done: no mail without configuration; the password never appears in settings, backups, logs or the API; every failure
  class lands in the delivery log; test button rate-limited and audited.
Estimate: 8-11 agent-hours.
```

### S5 — evidence, guide, fixtures (`pilot/CR018-s5-evidence`, Sonnet)

```
Goal: live spec (SW_LIVE=1) against a throwaway backend with the fake HA, the WisKey fake, a fake push service and the
  fake SMTP: a leak sensor → critical row + push + escalation to the administrators; a doorbell ring → row with the
  door deep link and the confirmation (unlock through the existing route, audit row present); a door left open →
  alert then resolved; a camera offline folded 5 times; quiet hours with the matrix; a backup failure → email; a user
  without scope gets nothing; a user without notify.manage sees only device registration; the user guide
  docs/user-guide/he/85-notifications_HE.md rewritten (center, the administrator's tab, no personal preferences),
  screens.json, screenshots to docs/design/evidence/CR-018/.
Estimate: 9-13 agent-hours.
```

### 5.1 Merge order and review

S1 → S2 and S4 (both depend only on `emit` and the settings row) → S3 (works on the mock from S0 and rebases on S1's
routes) → S5. Opus review of `notify.py` recipients/visibility, the action tokens and the doorbell deep link (no
unlock from any notification surface), `push.py` payload v2 at the three lock-screen levels, and the mail password
handling, with fixes by S1/S4 (4-6 h). Integration + full suite in the owner's release round (2-3 h).

### 5.2 Totals and calendar (revised 2026-10-01 after the owner's answers)

| Item | Agent-hours | Change vs. first proposal |
|---|---|---|
| P0 decisions + mockup (done) + S0 | 5-6 | +1 (eight settings sections, lock-screen levels, door confirmation) |
| S1 core | 22-28 | settings row instead of per-user prefs; configurable escalation (same size) |
| S2 sources | 18-26 | +2-4: every source in v1 incl. the WisKey live check (2ב) |
| S3 center + Settings tab + SW | 24-32 | +4-6: the Settings tab with eight sections, detail view, door dialog |
| S4 email (Companion and WhatsApp reserved only) | 8-11 | email in v1 (10ב) replaces HA phones (3ג later) |
| S5 evidence + guide | 9-13 | +1: doorbell and email live scenarios |
| Opus review + fixes, integration | 6-9 | - |
| **Total** | **92-125** | first proposal 86-116 (+4-6 with email); net +6-9 for all sources + email, minus HA phones |

Calibration: as recorded for CR-015/CR-016, nominal agent-hours ran about 30-40x faster in wall-clock with four
parallel agents (CR-015: 92-116 h estimated, about 2.5 h wall-clock from contract to review fixes). Wall-clock is
dominated by the owner's mockup review, the SMTP server he supplies, and the release rounds (one or two a day, on his
word).

| Case | Calendar | Assumes |
|---|---|---|
| **Best** | **1.5 days** (mockup accepted in the morning; S1-S5 the same afternoon and the next morning; the next release round) | mockup accepted first time; SMTP details arrive with the acceptance; the WisKey live ring works on the first try |
| **Likely** | **2-3 days** | one mockup revision; a live round on the owner's system shows 1-3 device-class differences fixed next round; the WisKey ring needs one more live check; S2 waits for the CR-017 merge order |
| **Worst** | **5-6 days** | SMTP server not available (email ships behind "לא מוגדר" and is verified later), iOS PWA behaviour needs a real-device round, a second Opus review round on the door deep link, or the owner asks to pull the Companion step forward (+10-14 agent-hours, +1 day) |

### 5.3 Definition of done (every agent)

Targeted tests actually run and reported (NOT_RUN is not PASS); screenshots at 1440/820/390 with loading/empty/error/
ready and RTL; no HA/Companion names on operator screens (the Settings tab may say "Companion - בקרוב"); no secrets,
lab addresses, mail passwords or real names in fixtures, push payloads or emails; the door-open rule of CR §9 holds
on every surface; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
