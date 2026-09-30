# Notifications — API contract delta and parallel work plan (CR-018)

**Status:** Proposed, 2026-10-01. Nothing here is implemented. Change record: `docs/changes/CR-018-NOTIFICATIONS.md`
(the "CR" below). Owner questions: `docs/design/mockups/notifications/decisions-HE.md`. Task: T101 (R211-R213,
AT211-AT213).

Base path `api/v1`, the same auth (HA identity → Principal), error envelope and ETag/revision conventions as the rest of
the API. All instants are UTC ISO strings; quiet hours are evaluated in the installation's IANA zone (`time.zone`).

## 1. Types

```ts
type Severity = 'info' | 'alert' | 'critical';                  // services/rules.SEVERITY_RANK, unchanged
type Category = 'safety' | 'alerts' | 'doors' | 'device_faults' | 'automations' | 'system' | 'security';
                                                                 // alerts/doors/device_faults/system exist in push.py
type Channel = 'inbox' | 'webpush' | 'ha_mobile' | 'email' | 'app';   // 'app' = CR-012, registered when decided
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
  me: { read_at: string | null; snoozed_until: string | null; dismissed_at: string | null };
  can_ack: boolean;                      // computed for the caller (§4)
  has_snapshot: boolean;                 // a snapshot is fetched separately, after sign-in (§3.6)
}

interface NotifyPrefs {                  // per user; supersedes push_prefs (kept readable as an alias)
  channels: Record<Category, { push: boolean; ha_mobile: boolean; email: boolean }>;  // inbox is always on
  min_push_severity: Severity;           // default 'alert'; 'info' only reaches the inbox unless lowered
  quiet: { enabled: boolean; from: string; to: string; days: ('mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun')[];
           allow_critical: boolean };    // existing shape + days
  mutes: { source?: string; subject_kind?: SubjectKind; subject_id?: string; until: string }[];   // <= 50
  area_filter: string[] | null;          // null = everything in my scope; else only these areas (and children)
  updated_at: string | null;
}

interface NotifyPolicy {                 // per source, installation-wide (notify.manage)
  source: string; enabled: boolean; severity: Severity; category: Category;
  after_s: number;                       // condition must hold this long (e.g. door open 600, offline 600)
  dedupe_window_s: number;               // occurrences inside fold into the open row
  resolve_notice: boolean;               // send a quiet "resolved" update (default false; true for critical)
  escalate: { after_s: number; to: 'managers' | string[] } | null;   // critical only; user ids or role shortcut
  audience: 'scope' | 'managers' | 'initiator';   // who may receive, on top of visibility (§4)
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
| POST | `/notifications/{id}/snooze` `{minutes: 15..1440}` | Per user; hides from the unread count and suppresses re-pushes of this row until then. |
| POST | `/notifications/{id}/dismiss` | Per user; the row leaves the inbox; shared state unchanged. |
| POST | `/notifications/{id}/ack` | Shared acknowledge; 403 unless `can_ack` (§4). Stops escalation; audited `notify.ack`. |
| GET | `/notifications/{id}/snapshot` | JPEG from the event's stored snapshot, only for `camera` subjects the caller may `video.live` or `events.read` there; 404 otherwise. Never in a push. |
| GET / PUT | `/me/notify-prefs` | `NotifyPrefs` with `If-Match` revision. `/push/prefs` stays and maps onto it. |
| POST / DELETE | `/me/notify-mutes` | Add/remove a mute (source or subject, `until` <= 7 days). |
| GET | `/me/ha-phones` | The caller's mapped HA mobile phones (label, last delivery), never the service name to non-managers. |
| POST | `/notifications/test` `{channel}` | Existing `/push/test` rate limit (3/min) for every channel. |
| GET | `/notifications/deliveries?notification_id=` | Own delivery rows. |

Existing, unchanged: `/push/vapid-key`, `/push/subscriptions` (GET/POST/DELETE), `/push/rotate-key`
(system.configure), `/rules`, `/rules/alerts`, `/rules/alerts/{id}/ack` (an ack there also acks the linked notification).

### 2.2 Push action endpoint (no session)

| POST | `/notifications/action` `{t: <action token>, a: 'ack' \| 'snooze'}` |
|---|---|

The token is minted per (notification, user, allowed actions) when the push is built: 128-bit random, stored hashed,
single use, expires with the push TTL (1 h). It authorises exactly that action on that row for that user, re-checked
against current visibility and `can_ack`. Anything else (open a door, disarm, run a scene) is **not** an action: the
notification opens Arx on the relevant screen, where the normal permission and step-up flow applies (CR-011).

### 2.3 Managers (`notify.manage`, installation scope)

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/notify/policies` · `/notify/policies/{source}` | `NotifyPolicy`; PUT with revision; audited `notify.policy`. |
| GET | `/notify/ha-services` | `notify.mobile_app_*` services seen on HA (read through the bridge), for mapping. |
| PUT / DELETE | `/notify/ha-phones/{user_id}` | Map a user to one or more mobile_app services; audited. The user sees a label only. |
| GET | `/notify/deliveries?status=failed&since=` | Everyone's delivery log (masked targets) for the failures panel. |
| GET / PUT | `/notify/email` | Only if the owner approves email (Q10): SMTP host/port/from; the password is write-only and kept in `/data/secrets`, never in `settings` or a backup. |
| GET | `/notify/stats` | The push worker STATS plus per-channel counters (already partly in `/health`). |

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
`action_token_invalid` 401 (expired, used, wrong user), `mute_limit` 409, `prefs_conflict` 412, `quiet_invalid` 422
(from == to), `channel_unavailable` 409 (e.g. email not configured, no HA phone mapped), `rate_limited` 429 with
`Retry-After`.

## 5. Parallel work plan

Same conventions as CR-014/015/016: one owner of the shared contract and DB (S1), frontend agents work on the mock,
Sonnet for well-specified slices, an Opus review of the permission and delivery path before merge. Branches
`pilot/CR018-s<N>-...` from g0/intake after the owner's answers.

### P0 — decisions + mockup (lead, 3-4 h)

Owner answers (decisions-HE.md) → a mockup of the notification center (inbox panel from the user menu, row states,
filters, snooze/ack), the settings tab (per-category channels, quiet hours with days, mutes, my phones) and the manager
page (sources, the failures panel). UniFi Protect's notification center and alert settings are the visual reference
(design mandate). Then S0: `frontend/src/api/notifications.ts` types + mock (1 h).

### S1 — backend core (`pilot/CR018-s1-core`, Sonnet, reviewed by Opus)

```
Goal: CR §5, §7-§12: migrations 0050-0052, services/notify.py (emit, dedupe/fold, resolve, recipients with the
  visibility matrix, quiet/mute/snooze/min severity, escalation timer, action tokens, retention janitor), generalise
  services/push.py from "fired rule alert" to "notification" (plan() takes a notification; categories + safety/
  automations/security; payload v2 with no names; actions ack/snooze where the browser supports them), delivery log
  writes, routers/notifications.py (§2.1-§2.3), /me/ws events, notify.manage in roles.json + access.py labels,
  audit kinds; rule_alerts rows get a notification_id link (ack on either side acks both).
Owns: migrations/0050_notifications.sql, 0051_notify_prefs.sql, 0052_notify_targets.sql, services/notify.py,
  services/notify_policy.py, routers/notifications.py, tests/test_notify_*.py.
Touches (sole editor): services/push.py, services/rules.py (deliver_pending → emit), routers/push.py (prefs alias),
  routers/rules.py (ack mirror), roles.json, routers/access.py (labels), the /me/ws publisher, main.py (router +
  janitor), contracts/API_INVENTORY.md.
Done: pytest for recipients (every subject kind × allowed/denied), dedupe/fold, quiet hours across midnight and days,
  critical bypass, mutes, escalation, action tokens (single use, expiry, wrong user, lost scope), retention, migration
  up on a 0.1.149 DB copy with push_prefs carried over; the existing test_push.py green.
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
  transitions (ringing → a `doors` row with the station's place only, never a visitor name or image), behind a
  setting until verified against the WisKey fake and one live ring (CR §5 note).
Owns: services/notify_sources.py, services/notify_sensors.py, tests/test_notify_sources.py; fake HA state fixtures.
Touches: one emit() line each in services/health_report (a monitor over summary() transitions), the alarm mirror,
  schedule run settlement, device_bulk, backup, remote sign-in, intercom_sync.
Done: each source has a unit test for fire, fold, resolve and the not-visible case; no source sends on its own.
Estimate: 16-22 agent-hours.
```

### S3 — frontend: notification center + settings (`pilot/CR018-s3-ui`, Sonnet)

```
Goal: CR §7, §9: the inbox (a panel from the user menu's התראות; phone: full sheet), rows with severity colour,
  count, time, place, state; filters (all / unread / critical / category); swipe or menu: read, snooze 1h/8h/until
  morning, dismiss, acknowledge (when can_ack); a snapshot thumbnail only inside the app after sign-in; the avatar dot
  and the chip from /notifications/summary + /me/ws (replacing the 60 s rule-alert poll); the settings tab system/notifications extended: per-category
  channels, minimum push severity, quiet hours with days, mutes list, my HA phones (read-only labels); manager page
  "מקורות התראה" (policies) + failures panel; the service worker: action buttons (ack/snooze) where supported, the
  action endpoint call, badge = unread.
Owns: components/notify-inbox.ts, components/notify-row.ts, screens/system-notifications.ts (extend),
  screens/system-notify-sources.ts, pwa/sw.ts (push handler v2), specs unit-notify-*.spec.ts,
  evidence-notify-center.spec.ts (demo; 1440/820/390; loading/empty/error/ready; RTL).
Touches (sole editor): shell/sw-user-menu.ts (count source), shell/sw-app.ts (dot), shell/nav.ts, api/ha.ts (events).
Done: clean operator screens (no HA/Companion names outside settings), tsc clean, specs run and reported.
Estimate: 20-26 agent-hours.
```

### S4 — HA phones channel + email (optional) (`pilot/CR018-s4-channels`, Sonnet)

```
Goal: CR §6.3-§6.4: ha_mobile delivery through the bridge allow-list (notify.mobile_app_* only, message/title/data
  with tag, group, channel per category, push.interruption-level for critical only if the owner approves Q7,
  actions with authenticationRequired and an Arx action token in the action id; no image by default), listening to
  mobile_app_notification_action on the bridge and mapping the token back to ack/snooze; email via SMTP (only if
  Q10 = yes) with a plain template and no snapshot.
Owns: services/notify_ha.py, services/notify_email.py, bridge allow-list entries, tests/test_notify_ha.py,
  tests/test_notify_email.py; the fake HA notify service in the live fixture.
Done: the bridge refuses every notify target that is not mobile_app_*; action ids are tokens, never commands.
Estimate: 10-14 agent-hours (+4-6 with email).
```

### S5 — evidence, guide, fixtures (`pilot/CR018-s5-evidence`, Sonnet)

```
Goal: live spec (SW_LIVE=1) against a throwaway backend with the fake HA and a fake push service: a leak sensor
  → critical row + push + escalation; a door left open → alert then resolved; a camera offline folded 5 times; quiet
  hours; a user without scope gets nothing; the user guide docs/user-guide/he/85-notifications_HE.md rewritten
  (center, preferences, managers), screens.json, screenshots to docs/design/evidence/CR-018/.
Estimate: 8-12 agent-hours.
```

### 5.1 Merge order and review

S1 → S2 and S4 (both depend only on `emit`) → S3 (works on the mock from S0 and rebases on S1's routes) → S5. Opus
review of `notify.py` recipients/visibility, the action tokens, `push.py` payload v2 and the bridge allow-list, with
fixes by S1 (4-6 h). Integration + full suite in the owner's release round (2-3 h).

### 5.2 Totals and calendar

| Item | Agent-hours |
|---|---|
| P0 decisions + mockup + S0 | 4-5 |
| S1 core | 22-28 |
| S2 sources | 16-22 |
| S3 center + settings + SW | 20-26 |
| S4 HA phones (email +4-6) | 10-14 |
| S5 evidence + guide | 8-12 |
| Opus review + fixes, integration | 6-9 |
| **Total** | **86-116** (+4-6 with email) |

Calibration: as recorded for CR-015/CR-016, nominal agent-hours ran about 30-40x faster in wall-clock with four
parallel agents (CR-015: 92-116 h estimated, about 2.5 h wall-clock from contract to review fixes). Wall-clock is
dominated by the owner's answers, the mockup review and the release rounds (one or two a day, on his word).

| Case | Calendar | Assumes |
|---|---|---|
| **Best** | **1 day** (decisions + mockup in the morning, S1-S5 in the afternoon, the evening release round) | recommendations adopted; the mockup accepted first time; no email |
| **Likely** | **2-3 days** | one mockup revision; a live round on the owner's system shows 1-3 sensor/device-class or HA-phone mapping differences fixed next round; S2 waits for the CR-017 merge order |
| **Worst** | **5-7 days** | email and HA phone actions both in scope with a second review; iOS PWA behaviour needs a real-device round; the owner wants WisKey doorbell now (needs the WisKey contract change first) or WhatsApp (a Meta business account and template approval - weeks, outside our control) |

### 5.3 Definition of done (every agent)

Targeted tests actually run and reported (NOT_RUN is not PASS); screenshots at 1440/820/390 with loading/empty/error/
ready and RTL; no HA/Companion names on operator screens; no secrets, lab addresses or real names in fixtures or push
payloads; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
