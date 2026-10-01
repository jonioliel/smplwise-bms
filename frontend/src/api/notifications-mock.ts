/**
 * CR-018: the MOCK adapter of the notifications API (docs/architecture/NOTIFICATIONS_API.md; the client is ./notifications.ts). The fixture is the
 * approved mockup's content in miniature, with every v1 source of CR §5 represented:
 *  - 24 notifications at each severity (a leak with a pending escalation, an acknowledged critical alarm, a doorbell with the door action, a camera
 *    folded five times, a failed push delivery, held-by-quiet-hours deliveries, a snoozed row, resolved rows, personal and manager-only rows);
 *  - three users: `admin` (notify.manage, every permission), `operator` (scoped; no manager rows, cannot acknowledge safety rows, cannot open a door)
 *    and `door` (the operator plus the door-open permission at the entrance);
 *  - the installation settings with their defaults (30 days retention, escalation 5 min x 2, lock screen "type + place", mail server configured with an
 *    example host: a host containing "bad" fails the test with `connect`, "slow" with `timeout`), the 28 source policies, the delivery log;
 *  - scenario switches: quiet hours active now, push unsupported on this device, mail not configured, door step-up required.
 * Same shapes and error codes as the backend; mutations apply at once (specs stay deterministic) and are kept for the session. No network, no timers;
 * the clock is `store.clock` (fixed at 2026-10-01 14:10 Asia/Jerusalem, the mockup's "now"). Names and values are invented.
 *
 * Load order: this file imports the pure helpers of ./notifications.ts; that file loads this one only through a dynamic import (no import cycle).
 *
 * Owned by the coordinator with notifications.ts.
 */
import { ApiError } from './client';
import {
  CENTER_LAYOUTS, FAILURES_AUDIENCES, FAILURE_SOURCES, SEVERITY_RANK, applyAck, canAckFor, canSeeNotification, defaultPolicies, DEFAULT_EMAIL, DEFAULT_SETTINGS, notifyError, passThrough, recipientsRuleFor,
  snoozeUntil, sourceInfo, summarize, validateEmailBody, validatePolicy, validateSettings, maskAddress,
  type Category, type Channel, type Delivery, type DeliveryQuery, type EmailBody, type EmailSettings, type EmailTestResult, type InboxPage, type InboxQuery,
  type Notification, type NotifyAdapter, type NotifyPolicy, type NotifySettings, type NotifyStats, type NotifySummary, type PolicyBody, type Severity,
  type SettingsBody, type SnoozeChoice, type SubjectKind, type Viewer,
} from './notifications';
import type { PushSupport } from '../pwa/push';

export const MOCK_TZ = 'Asia/Jerusalem';
/** Local midnight of 2026-10-01 in Asia/Jerusalem (UTC+3 until the end of October). */
const DAY0 = Date.UTC(2026, 8, 30, 21, 0);
/** `day` days before the fixture's today, at local h:m. */
export const mockAt = (day: number, h: number, m: number): number => DAY0 - day * 86_400_000 + (h * 60 + m) * 60_000;
/** The mockup's "now": 14:10. */
export const MOCK_NOW = mockAt(0, 14, 10);
/** Area ids used by the fixture rows. */
export const MOCK_AREAS: Record<string, string> = {
  kitchen: 'מטבח', living: 'סלון', ground: 'קומת קרקע', parking: 'חניה', backyard: 'חצר אחורית', balcony: 'מרפסת', entrance: 'כניסה ראשית', bedroom: 'חדר שינה', floor1: 'קומה 1',
};

export type MockUserId = 'admin' | 'operator' | 'door' | 'planner';
interface MockUser { id: MockUserId; user_id: string; display: string; grants: Record<string, '*' | string[]> }
const OPERATOR_GRANTS: MockUser['grants'] = {
  'events.read': ['parking', 'backyard', 'entrance', 'ground'], 'events.ack': ['parking', 'backyard', 'entrance', 'ground'],
  'devices.read': ['kitchen', 'living', 'balcony', 'ground', 'parking', 'backyard', 'entrance'], 'access.read': ['entrance'],
};
const USERS: Record<MockUserId, MockUser> = {
  admin: {
    id: 'admin', user_id: 'u-yoni', display: 'יוני',
    grants: { 'events.read': '*', 'events.ack': '*', 'devices.read': '*', 'alarm.view': '*', 'access.read': '*', 'schedule.view': '*', 'system.configure': '*', 'notify.manage': '*', 'door.unlock': '*' },
  },
  operator: { id: 'operator', user_id: 'u-dana', display: 'דנה', grants: OPERATOR_GRANTS },
  door: { id: 'door', user_id: 'u-uri', display: 'אורי', grants: { ...OPERATOR_GRANTS, 'door.unlock': ['entrance'] } },
  // the operator who may also see schedules and automations (what `failures_audience: 'visible'` reaches)
  planner: { id: 'planner', user_id: 'u-roni', display: 'רוני', grants: { ...OPERATOR_GRANTS, 'schedule.view': '*' } },
};
const viewerOf = (u: MockUser): Viewer => ({
  user_id: u.user_id,
  can: (permission, areaId) => {
    const g = u.grants[permission];
    return g === '*' || (Array.isArray(g) && areaId !== null && g.includes(areaId));
  },
});

// ------------------------------------------------------------------------------------------------ the fixture

type Audience = 'scope' | 'managers' | 'initiator';
type Core = Omit<Notification, 'me' | 'can_ack' | 'my_deliveries' | 'door'>;
interface MockRow {
  core: Core;
  door: { id: string; name: string } | null;
  audience: Audience;
  initiator: MockUserId | null;
  dedupe: string;
  me: Partial<Record<MockUserId, { read_at: string | null; snoozed_until: string | null }>>;
  deliveries: Notification['my_deliveries'];
}
interface Seed {
  source: string; kind: SubjectKind; subject: string | null; area: string | null; title: string; body: string;
  day: number; h: number; m: number;
  first?: [number, number]; count?: number; sev?: Severity;
  ack?: { by: string; h: number; m: number }; res?: { h: number; m: number };
  esc?: number; door?: { id: string; name: string }; snap?: boolean; audience?: Audience; initiator?: MockUserId; unread?: boolean; snoozeAt?: number;
  deliv?: [Channel, Delivery['status'], string | null, number, number][];
  link?: string;
}
const LINK: Record<SubjectKind, (id: string | null) => string> = {
  camera: (id) => `#/live/cameras/${id}`, entity: (id) => `#/devices/entities/${id}`, area: (id) => `#/devices/areas/${id}`, alarm_panel: () => '#/security/alarm', door: (id) => `#/doors/${id}`,
  schedule: (id) => `#/devices/schedules/${id}`, automation: (id) => `#/devices/automations/${id}`, bulk_job: (id) => `#/devices/actions/${id}`, system: () => '#/system/diagnostics', session: () => '#/system/remote',
};
/** The mockup's notifications plus one row for each remaining v1 source (the sources that are off by default - alarm.state and the rule-only camera events - have none). */
const SEEDS: Seed[] = [
  { source: 'sensor.leak', kind: 'entity', subject: 'ent-leak-kitchen', area: 'kitchen', title: 'דליפת מים', body: 'חיישן ההצפה מתחת לכיור דיווח על מים.', day: 0, h: 14, m: 2, unread: true, esc: 1, deliv: [['webpush', 'sent', null, 14, 2]] },
  { source: 'door.ring', kind: 'door', subject: 'st-main', area: 'entrance', title: 'צלצול בדלת', body: 'מישהו מצלצל בעמדת הכניסה הראשית.', day: 0, h: 13, m: 58, unread: true, door: { id: 'st-main', name: 'דלת הכניסה' }, deliv: [['webpush', 'sent', null, 13, 58]] },
  { source: 'alarm.triggered', kind: 'alarm_panel', subject: 'panel-ground', area: 'ground', title: 'אזעקה הופעלה', body: 'לוח האזעקה עבר למצב "הופעלה" בעקבות חיישן תנועה בסלון.', day: 0, h: 13, m: 41, ack: { by: 'דנה', h: 13, m: 49 }, esc: 1, deliv: [['webpush', 'sent', null, 13, 41]] },
  { source: 'camera.offline', kind: 'camera', subject: 'cam-parking', area: 'parking', title: 'מצלמה לא זמינה', body: 'המצלמה לא עונה למקליט.', day: 0, h: 13, m: 30, first: [11, 20], count: 5, deliv: [['webpush', 'skipped', 'quiet_hours', 13, 30]] },
  { source: 'rule.alert', kind: 'camera', subject: 'cam-backyard', area: 'backyard', title: 'אדם זוהה', body: 'החוק "חצר אחורית בשעות היום" זיהה אדם.', day: 0, h: 9, m: 14, first: [9, 2], count: 3, snap: true, deliv: [['webpush', 'sent', null, 9, 14]] },
  { source: 'opening.left_open', kind: 'entity', subject: 'ent-door-balcony', area: 'balcony', title: 'דלת נשארה פתוחה', body: 'דלת המרפסת פתוחה יותר מ־10 דקות.', day: 0, h: 12, m: 40, res: { h: 12, m: 55 }, deliv: [['webpush', 'sent', null, 12, 40]] },
  { source: 'backup.failed', kind: 'system', subject: 'sys-backup', area: null, title: 'גיבוי נכשל', body: 'הגיבוי הלילי לא הסתיים: אין מקום פנוי ביעד.', day: 0, h: 3, m: 0, audience: 'managers', deliv: [['email', 'sent', null, 3, 1]] },
  { source: 'device.battery_low', kind: 'entity', subject: 'ent-door-bedroom', area: 'bedroom', title: 'סוללה חלשה', body: 'חיישן הדלת בחדר השינה ב־12%.', day: 1, h: 21, m: 15, snoozeAt: mockAt(0, 15, 10) },
  { source: 'schedule.not_confirmed', kind: 'schedule', subject: 'sch-blinds', area: null, title: 'תזמון לא בוצע', body: 'הריצה של 19:30 לא אושרה: 2 תריסים לא ענו.', day: 1, h: 19, m: 30, audience: 'managers', deliv: [['webpush', 'sent', null, 19, 31]] },
  { source: 'security.new_signin', kind: 'session', subject: 'sess-new', area: null, title: 'כניסה חדשה לחשבון', body: 'כניסה ממכשיר חדש (Android · Chrome). אם זה לא אתה – נתק את הכניסה.', day: 1, h: 8, m: 12, audience: 'initiator', initiator: 'admin', deliv: [['webpush', 'failed', 'http_410', 8, 12]] },
  { source: 'bulk.partial', kind: 'bulk_job', subject: 'bulk-floor1', area: 'floor1', title: 'כיבוי קומה 1', body: '2 מתוך 6 לא אישרו: מסך חדר עבודה ומזגן חדר הורים.', day: 1, h: 23, m: 5, audience: 'initiator', initiator: 'admin' },
  { source: 'sensor.smoke', kind: 'entity', subject: 'ent-smoke-kitchen', area: 'kitchen', title: 'עשן', body: 'גלאי העשן במטבח הופעל ל־3 דקות.', day: 2, h: 19, m: 2, ack: { by: 'יוני', h: 19, m: 4 }, res: { h: 19, m: 5 }, deliv: [['webpush', 'sent', null, 19, 2]] },
  { source: 'automation.failed', kind: 'automation', subject: 'auto-night', area: null, title: 'אוטומציה נכשלה', body: 'הפעולה "כבה אורות חוץ" נכשלה: ההתקן לא זמין.', day: 2, h: 23, m: 30, audience: 'managers', deliv: [['webpush', 'sent', null, 23, 30]] },
  { source: 'update.available', kind: 'system', subject: 'sys-update', area: null, title: 'עדכון זמין', body: 'גרסה 0.1.151 מוכנה להתקנה.', day: 3, h: 7, m: 0, audience: 'managers' },
  { source: 'nvr.storage', kind: 'system', subject: 'nvr-1', area: null, title: 'דיסק המקליט מלא', body: 'האחסון במקליט הגיע ל־100%. ההקלטה נעצרה עד שפונה מקום.', day: 4, h: 2, m: 15, audience: 'managers', ack: { by: 'יוני', h: 7, m: 40 }, res: { h: 8, m: 5 }, deliv: [['webpush', 'sent', null, 2, 15], ['email', 'sent', null, 2, 16]] },
  // one row for each remaining v1 source
  { source: 'sensor.gas', kind: 'entity', subject: 'ent-gas-kitchen', area: 'kitchen', title: 'גז', body: 'חיישן הגז במטבח זיהה ריכוז חריג.', day: 5, h: 18, m: 20, ack: { by: 'יוני', h: 18, m: 22 }, res: { h: 18, m: 30 } },
  { source: 'sensor.co', kind: 'entity', subject: 'ent-co-ground', area: 'ground', title: 'פחמן חד־חמצני', body: 'גלאי הפחמן החד־חמצני בקומת הקרקע הופעל.', day: 6, h: 6, m: 45, res: { h: 6, m: 52 } },
  { source: 'nvr.offline', kind: 'system', subject: 'nvr-1', area: null, title: 'המקליט לא זמין', body: 'המקליט לא עונה כבר 2 דקות.', day: 7, h: 4, m: 0, audience: 'managers', ack: { by: 'יוני', h: 4, m: 5 }, res: { h: 4, m: 20 } },
  { source: 'alarm.arm_failed', kind: 'alarm_panel', subject: 'panel-ground', area: 'ground', title: 'הפעלת האזעקה נכשלה', body: 'חיישן דלת המרפסת פתוח ולכן האזעקה לא הופעלה.', day: 1, h: 22, m: 40 },
  { source: 'device.unavailable', kind: 'entity', subject: 'ent-plug-living', area: 'living', title: 'התקן לא זמין', body: 'תקע חכם בסלון לא זמין כבר 15 דקות.', day: 1, h: 10, m: 30 },
  { source: 'system.health', kind: 'system', subject: 'sys-go2rtc', area: null, title: 'תקלת מערכת', body: 'שירות הווידאו לא ענה במשך 5 דקות.', day: 2, h: 6, m: 10, audience: 'managers', res: { h: 6, m: 25 }, deliv: [['webpush', 'sent', null, 6, 10], ['email', 'sent', null, 6, 11]] },
  { source: 'automation.notify', kind: 'automation', subject: 'auto-night', area: null, title: 'הודעה מאוטומציה', body: 'אורות הלילה הופעלו בקומה 1.', day: 3, h: 18, m: 0 },
  { source: 'backup.stale', kind: 'system', subject: 'sys-backup', area: null, title: 'גיבוי ישן', body: 'הגיבוי האחרון בן יותר מיומיים.', day: 3, h: 4, m: 0, audience: 'managers', deliv: [['email', 'sent', null, 4, 1]] },
  { source: 'security.lockout', kind: 'session', subject: 'sess-lock', area: null, title: 'נעילת כניסה', body: 'חשבון נעל את הכניסה אחרי נסיונות כושלים.', day: 4, h: 22, m: 0, audience: 'managers' },
];

/** The ids of the fixture rows: 'ntf-001' ... in the seed order. */
export const mockId = (n: number): string => `ntf-${String(n).padStart(3, '0')}`;

function buildRows(): MockRow[] {
  return SEEDS.map((s, i): MockRow => {
    const info = sourceInfo(s.source);
    if (!info) throw new Error(`unknown source ${s.source}`);
    const id = mockId(i + 1);
    const last = mockAt(s.day, s.h, s.m);
    const first = s.first ? mockAt(s.day, s.first[0], s.first[1]) : last;
    const count = s.count ?? 1;
    const timeline: Notification['timeline'] = [{ at: new Date(first).toISOString(), kind: 'created' }];
    if (count > 1) timeline.push({ at: new Date(last).toISOString(), kind: 'folded', count });
    for (let k = 1; k <= (s.esc ?? 0); k++) timeline.push({ at: new Date(first + k * 5 * 60_000).toISOString(), kind: 'escalated', step: k, count: 2 });
    for (const d of s.deliv ?? []) if (d[1] === 'failed') timeline.push({ at: new Date(mockAt(s.day, d[3], d[4])).toISOString(), kind: 'delivery_failed', channel: d[0] });
    let state: Notification['state'] = 'open';
    let ackedAt: string | null = null;
    let ackedBy: string | null = null;
    let resolvedAt: string | null = null;
    if (s.ack) {
      state = 'acknowledged'; ackedAt = new Date(mockAt(s.day, s.ack.h, s.ack.m)).toISOString(); ackedBy = s.ack.by;
      timeline.push({ at: ackedAt, kind: 'acknowledged', by_display: s.ack.by });
    }
    if (s.res) {
      state = 'resolved'; resolvedAt = new Date(mockAt(s.day, s.res.h, s.res.m)).toISOString();
      timeline.push({ at: resolvedAt, kind: 'resolved' });
    }
    const core: Core = {
      id, source: s.source, category: info.category, severity: s.sev ?? info.severity, title: s.title, body: s.body,
      subject: { kind: s.kind, id: s.subject, area_id: s.area }, place_name: s.area ? MOCK_AREAS[s.area] ?? null : null, link: s.link ?? LINK[s.kind](s.subject), count,
      first_at: new Date(first).toISOString(), last_at: new Date(last).toISOString(), state, acked_at: ackedAt, acked_by_display: ackedBy, resolved_at: resolvedAt,
      has_snapshot: !!s.snap, timeline: timeline.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    };
    const readAt = new Date(last).toISOString();
    const me: MockRow['me'] = {};
    for (const u of Object.keys(USERS) as MockUserId[]) me[u] = { read_at: s.unread ? null : readAt, snoozed_until: s.snoozeAt ? new Date(s.snoozeAt).toISOString() : null };
    return {
      core, door: s.door ?? null, audience: s.audience ?? 'scope', initiator: s.initiator ?? null, dedupe: `${s.source}:${s.kind}:${s.subject ?? ''}`, me,
      deliveries: (s.deliv ?? []).map(([channel, status, reason, h, m]) => ({ channel, status, reason, at: new Date(mockAt(s.day, h, m)).toISOString() })),
    };
  });
}

/** The delivery log of the mockup's settings section, masked targets, newest first (ids refer to the fixture rows). */
function buildLog(): Delivery[] {
  const P = 'fcm.googleapis.com';
  const A = 'web.push.apple.com';
  const E = maskAddress('owner@example.net');
  const rows: [number, number, number, number, string, string, Channel, Delivery['status'], string | null, string][] = [
    // [row, day, h, m, user, target, channel, status, reason, _]
    [1, 0, 14, 2, 'יוני', P, 'webpush', 'sent', null, ''], [1, 0, 14, 2, 'דנה', P, 'webpush', 'sent', null, ''], [1, 0, 14, 2, 'אורי', A, 'webpush', 'failed', 'http_410', ''],
    [2, 0, 13, 58, 'יוני', P, 'webpush', 'sent', null, ''], [2, 0, 13, 58, 'דנה', P, 'webpush', 'sent', null, ''],
    [3, 0, 13, 46, 'יוני', P, 'webpush', 'sent', null, 'escalation'], [3, 0, 13, 46, 'דנה', P, 'webpush', 'sent', null, 'escalation'], [3, 0, 13, 41, 'אורי', A, 'webpush', 'failed', 'http_410', ''],
    [4, 0, 13, 30, 'יוני', P, 'webpush', 'skipped', 'quiet_hours', ''], [4, 0, 13, 30, 'דנה', P, 'webpush', 'skipped', 'quiet_hours', ''],
    [7, 0, 3, 1, 'מנהלים (2)', E, 'email', 'sent', null, ''], [7, 0, 3, 0, 'יוני', P, 'webpush', 'skipped', 'category_off', ''],
    [9, 1, 19, 31, 'יוני', P, 'webpush', 'sent', null, ''], [10, 1, 8, 12, 'יוני', P, 'webpush', 'failed', 'timeout', ''],
  ];
  return rows.map(([row, day, h, m, user, target, channel, status, reason], i) => ({
    id: `dlv-${String(i + 1).padStart(3, '0')}`, notification_id: mockId(row), user_display: user, channel, target, status, reason, attempt: status === 'failed' ? 3 : 1, at: new Date(mockAt(day, h, m)).toISOString(),
  }));
}

// ------------------------------------------------------------------------------------------------ the store

export interface NotifyMockOptions {
  viewer?: MockUserId;
  /** The clock (epoch ms); default `MOCK_NOW`. */
  clock?: number;
  /** Quiet hours cover the fixture's now (13:00-16:00), so held deliveries and the banner are live. */
  quietNow?: boolean;
  /** What `pushSupport()` would answer on this device (the center's "push unavailable" banner). */
  push?: PushSupport;
  /** Devices registered by this user here. */
  registered?: number;
  /** false = the mail server is not configured. */
  emailConfigured?: boolean;
  /** The configured mail host: one containing "bad" fails the test with `connect`, "slow" with `timeout`. */
  emailHost?: string;
  /** The door release asks for a step-up first (`step_up_required`) until `completeStepUp()`. */
  stepUp?: boolean;
}
export interface MockSignal {
  source: string;
  subject_kind: SubjectKind;
  subject_id: string | null;
  area_id?: string | null;
  title?: string;
  body?: string;
  severity?: Severity;
  dedupe_key?: string;
  initiator?: MockUserId;
}
const RATE_PER_MIN = 3;

export class NotifyMockStore implements NotifyAdapter {
  clock: number;
  readonly tz = MOCK_TZ;
  viewerId: MockUserId;
  pushSupport: PushSupport;
  registered: number;
  rows: MockRow[] = buildRows();
  log: Delivery[] = buildLog();
  settingsRow: NotifySettings;
  policyRows: NotifyPolicy[] = defaultPolicies();
  /** The door releases that went through (after the in-app confirmation): the audit rows' origin is `notification:<id>`. */
  doorOpens: { notification_id: string; door_id: string; origin: string; by: string }[] = [];
  private stepUpPending: boolean;
  private tokens = new Map<string, { notification_id: string; user: MockUserId; actions: ('ack' | 'snooze')[]; expires: number; used: boolean }>();
  private hits: Record<string, number[]> = {};
  private seq = 0;

  constructor(o: NotifyMockOptions = {}) {
    this.clock = o.clock ?? MOCK_NOW;
    this.viewerId = o.viewer ?? 'admin';
    this.pushSupport = o.push ?? 'ok';
    this.registered = o.registered ?? 1;
    this.stepUpPending = !!o.stepUp;
    const s = DEFAULT_SETTINGS();
    if (o.quietNow) s.quiet = { ...s.quiet, from: '13:00', to: '16:00' };
    const email: EmailSettings = o.emailConfigured === false
      ? DEFAULT_EMAIL()
      : { configured: true, host: o.emailHost ?? 'mail.example.net', port: 587, security: 'starttls', user: 'arx@example.net', password_set: true, from: 'Arx <arx@example.net>', recipients: ['owner@example.net', 'it@example.net'], last_test: { at: new Date(mockAt(0, 9, 12)).toISOString(), ok: true, detail: 'ok' } };
    this.settingsRow = { ...s, email };
  }

  // ---- mock controls (not part of the API)
  get user(): MockUser { return USERS[this.viewerId]; }
  setViewer(id: MockUserId): void { this.viewerId = id; }
  advance(ms: number): void { this.clock += ms; }
  completeStepUp(): void { this.stepUpPending = false; }
  private iso(ms = this.clock): string { return new Date(ms).toISOString(); }
  private viewer(): Viewer { return viewerOf(this.user); }
  private manage(): void { if (!this.viewer().can('notify.manage', null)) throw notifyError('forbidden'); }
  private limit(key: string): void {
    const now = this.clock;
    const recent = (this.hits[key] ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= RATE_PER_MIN) throw notifyError('rate_limited', { retry_after_s: Math.ceil((60_000 - (now - recent[0])) / 1000) });
    this.hits[key] = [...recent, now];
  }
  /** Whether the row is visible to the user NOW: the subject's permission (scope included) and the policy's audience. */
  private seen(r: MockRow, u: MockUser = this.user): boolean {
    const v = viewerOf(u);
    if (!canSeeNotification(r.core, v)) return false;
    // schedule / automation failures follow the administrator's `failures_audience`; every other row follows its seeded audience
    const audience: Audience = FAILURE_SOURCES.includes(r.core.source) && r.audience !== 'initiator'
      ? (recipientsRuleFor({ source: r.core.source, recipients: { rule: 'scope' } }, this.settingsRow) === 'scope' ? 'scope' : 'managers')
      : r.audience;
    if (audience === 'managers') return v.can('notify.manage', null);
    if (r.audience === 'initiator') return r.initiator === u.id;
    return true;
  }
  private project(r: MockRow, u: MockUser = this.user): Notification {
    const v = viewerOf(u);
    const me = r.me[u.id] ?? { read_at: null, snoozed_until: null };
    return {
      ...r.core, timeline: r.core.timeline.map((e) => ({ ...e })), subject: { ...r.core.subject },
      me: { ...me }, can_ack: canAckFor(r.core, v), door: r.door ? { ...r.door, can_open: v.can('door.unlock', r.core.subject.area_id) } : null,
      my_deliveries: r.deliveries.map((d) => ({ ...d })),
    };
  }
  private find(id: string): MockRow {
    const r = this.rows.find((x) => x.core.id === id);
    if (!r || !this.seen(r)) throw notifyError('notification_not_found');
    return r;
  }
  /** The caller's own rows, as `Notification`s (a helper for specs and the demo shell). */
  visibleRows(): Notification[] { return this.rows.filter((r) => this.seen(r)).map((r) => this.project(r)); }

  // ---- every signed-in user
  async list(q: InboxQuery = {}): Promise<InboxPage> {
    let list = this.visibleRows();
    if (q.state === 'open') list = list.filter((n) => n.state === 'open');
    if (q.category) list = list.filter((n) => n.category === (q.category as Category));
    if (q.severity_min) list = list.filter((n) => SEVERITY_RANK[n.severity] >= SEVERITY_RANK[q.severity_min as Severity]);
    if (q.before) list = list.filter((n) => Date.parse(n.last_at) < Date.parse(q.before as string));
    list.sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at));
    const limit = q.limit ?? 50;
    const page = list.slice(0, limit);
    return { notifications: page, next_before: list.length > limit ? page[page.length - 1].last_at : null };
  }
  async summary(): Promise<NotifySummary> { return summarize(this.visibleRows(), this.clock); }
  async read(id: string): Promise<Notification | null> {
    const r = this.find(id);
    const me = (r.me[this.viewerId] ??= { read_at: null, snoozed_until: null });
    me.read_at ??= this.iso();
    return this.project(r);
  }
  async readAll(): Promise<void> {
    for (const r of this.rows) if (this.seen(r)) { const me = (r.me[this.viewerId] ??= { read_at: null, snoozed_until: null }); me.read_at ??= this.iso(); }
  }
  async snooze(id: string, choice: SnoozeChoice): Promise<Notification | null> {
    const r = this.find(id);
    if (choice !== 60 && choice !== 'until_morning') throw new ApiError(422, { code: 'validation_error', user_message: 'minutes', retryable: false, correlation_id: '', details: {} });
    if (r.core.state !== 'resolved') (r.me[this.viewerId] ??= { read_at: null, snoozed_until: null }).snoozed_until = snoozeUntil(choice, this.clock, this.settingsRow.quiet, this.tz);
    return this.project(r);
  }
  async ack(id: string): Promise<Notification | null> {
    const r = this.find(id);
    const before = this.project(r);
    if (before.state !== 'open') return before; // idempotent: an acknowledge of an acknowledged / resolved row changes nothing
    if (!before.can_ack) throw notifyError('ack_not_allowed');
    const after = applyAck(before, this.user.display, this.clock);
    Object.assign(r.core, { state: after.state, acked_at: after.acked_at, acked_by_display: after.acked_by_display, timeline: after.timeline });
    (r.me[this.viewerId] ??= { read_at: null, snoozed_until: null }).read_at = after.me.read_at;
    return this.project(r);
  }
  snapshotUrl(id: string): string | null {
    const r = this.rows.find((x) => x.core.id === id);
    if (!r || !this.seen(r) || !r.core.has_snapshot) return null;
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#cfd8e3"/><text x="160" y="95" text-anchor="middle" font-size="14" fill="#5a6b7d">${id}</text></svg>`)}`;
  }
  async test(): Promise<{ sent: number }> {
    this.limit(`test:${this.viewerId}`);
    return { sent: this.pushSupport === 'ok' ? this.registered : 0 };
  }
  async deliveries(notificationId?: string): Promise<Delivery[]> {
    const out: Delivery[] = [];
    for (const r of this.rows) {
      if (!this.seen(r) || (notificationId && r.core.id !== notificationId)) continue;
      r.deliveries.forEach((d, i) => out.push({ id: `${r.core.id}-d${i + 1}`, notification_id: r.core.id, user_display: this.user.display, channel: d.channel, target: d.channel === 'email' ? maskAddress('owner@example.net') : 'fcm.googleapis.com', status: d.status, reason: d.reason, attempt: d.status === 'failed' ? 3 : 1, at: d.at }));
    }
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  /** Mints the one-time token of a push button (what the server does when it builds the push). */
  issueActionToken(notificationId: string, actions: ('ack' | 'snooze')[] = ['ack', 'snooze']): string {
    const r = this.find(notificationId);
    const t = `tok-${++this.seq}-${r.core.id}`;
    this.tokens.set(t, { notification_id: r.core.id, user: this.viewerId, actions, expires: this.clock + 3_600_000, used: false });
    return t;
  }
  async action(token: string, action: 'ack' | 'snooze'): Promise<void> {
    const t = this.tokens.get(token);
    if (!t || t.used || t.expires <= this.clock || !t.actions.includes(action)) throw notifyError('action_token_invalid');
    t.used = true;
    const was = this.viewerId;
    this.viewerId = t.user; // the token's user, not the session's
    try {
      if (action === 'ack') await this.ack(t.notification_id);
      else await this.snooze(t.notification_id, 60);
    } finally { this.viewerId = was; }
  }
  async openDoor(notificationId: string, doorId: string): Promise<void> {
    const r = this.find(notificationId);
    if (!r.door || r.door.id !== doorId) throw notifyError('notification_not_found');
    if (!this.viewer().can('door.unlock', r.core.subject.area_id)) throw notifyError('forbidden');
    if (this.stepUpPending) throw notifyError('step_up_required', {}, 403);
    this.doorOpens.push({ notification_id: notificationId, door_id: doorId, origin: `notification:${notificationId}`, by: this.user.user_id });
  }

  // ---- notify.manage
  async settings(): Promise<NotifySettings> { this.manage(); return JSON.parse(JSON.stringify(this.settingsRow)) as NotifySettings; }
  async saveSettings(body: SettingsBody, baseRevision: number): Promise<NotifySettings> {
    this.manage();
    if (baseRevision !== this.settingsRow.revision) throw notifyError('settings_conflict');
    const bad = validateSettings(body);
    if (bad) throw notifyError(bad);
    if (!CENTER_LAYOUTS.includes(body.center_layout) || !FAILURES_AUDIENCES.includes(body.failures_audience)) {
      throw new ApiError(422, { code: 'validation_error', user_message: 'center_layout / failures_audience', retryable: false, correlation_id: '', details: {} });
    }
    this.settingsRow = { ...this.settingsRow, ...JSON.parse(JSON.stringify(body)) as SettingsBody, revision: this.settingsRow.revision + 1, updated_at: this.iso() };
    return this.settings();
  }
  async policies(): Promise<NotifyPolicy[]> { this.manage(); return JSON.parse(JSON.stringify(this.policyRows)) as NotifyPolicy[]; }
  async savePolicy(source: string, body: PolicyBody, baseRevision: number): Promise<NotifyPolicy> {
    this.manage();
    const i = this.policyRows.findIndex((p) => p.source === source);
    if (i < 0) throw new ApiError(404, { code: 'not_found', user_message: 'המקור לא קיים', retryable: false, correlation_id: '', details: {} });
    if (validatePolicy(body)) throw notifyError('channel_reserved');
    if (baseRevision !== this.policyRows[i].revision) throw notifyError('settings_conflict');
    this.policyRows[i] = { ...this.policyRows[i], ...JSON.parse(JSON.stringify(body)) as PolicyBody, channels: { ...body.channels, inbox: true, ha_mobile: false, whatsapp: false }, revision: this.policyRows[i].revision + 1 };
    return JSON.parse(JSON.stringify(this.policyRows[i])) as NotifyPolicy;
  }
  async saveEmail(body: EmailBody): Promise<EmailSettings> {
    this.manage();
    if (validateEmailBody(body)) throw notifyError('email_invalid');
    const { password, ...rest } = body;
    const old = this.settingsRow.email;
    this.settingsRow.email = { ...old, ...rest, configured: true, password_set: password ? true : old.password_set, last_test: old.last_test };
    return JSON.parse(JSON.stringify(this.settingsRow.email)) as EmailSettings;
  }
  async testEmail(): Promise<EmailTestResult> {
    this.manage();
    if (!this.settingsRow.email.configured) throw notifyError('channel_unavailable');
    this.limit('email-test');
    const host = this.settingsRow.email.host;
    const result: EmailTestResult = host.includes('bad') ? { ok: false, detail: 'connect' } : host.includes('slow') ? { ok: false, detail: 'timeout' } : { ok: true, detail: 'ok' };
    this.settingsRow.email.last_test = { at: this.iso(), ...result };
    return result;
  }
  async adminDeliveries(q: DeliveryQuery = {}): Promise<Delivery[]> {
    this.manage();
    let list = [...this.log];
    if (q.status) list = list.filter((d) => d.status === q.status);
    if (q.channel) list = list.filter((d) => d.channel === q.channel);
    if (q.since) list = list.filter((d) => Date.parse(d.at) >= Date.parse(q.since as string));
    list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return list.slice(0, q.limit ?? 100);
  }
  async stats(): Promise<NotifyStats> {
    this.manage();
    const since = this.clock - 86_400_000;
    const channels: NotifyStats['channels'] = {};
    for (const d of this.log) {
      if (Date.parse(d.at) < since) continue;
      const c = (channels[d.channel] ??= { sent: 0, failed: 0, skipped: {} });
      if (d.status === 'sent') c.sent++;
      else if (d.status === 'failed' || d.status === 'gone') c.failed++;
      else if (d.status === 'skipped') c.skipped[d.reason ?? 'unknown'] = (c.skipped[d.reason ?? 'unknown'] ?? 0) + 1;
    }
    return { since: this.iso(since), channels, worker: { queued: 0, in_flight: 0, retries: 0 } };
  }

  // ---- the server side of `notify.emit` (mock only): fold by dedupe key, rise re-notifies, resolve
  /** A signal: folds into the open row with the same dedupe key inside the policy's window (0 = until resolved), a higher severity re-notifies (every user's
   * read state resets), otherwise creates a row for the policy's audience. Returns the row id, or null when the source is off. */
  emit(s: MockSignal): string | null {
    const policy = this.policyRows.find((p) => p.source === s.source);
    const info = sourceInfo(s.source);
    if (!policy || !info || !policy.enabled) return null;
    const dedupe = s.dedupe_key ?? `${s.source}:${s.subject_kind}:${s.subject_id ?? ''}`;
    const sev = s.severity ?? policy.severity;
    const open = this.rows.find((r) => r.dedupe === dedupe && r.core.state !== 'resolved');
    if (open && (policy.dedupe_window_s === 0 || this.clock - Date.parse(open.core.last_at) <= policy.dedupe_window_s * 1000)) {
      open.core.count += 1;
      open.core.last_at = this.iso();
      open.core.timeline.push({ at: this.iso(), kind: 'folded', count: open.core.count });
      if (SEVERITY_RANK[sev] > SEVERITY_RANK[open.core.severity]) {
        open.core.severity = sev;
        for (const u of Object.keys(USERS) as MockUserId[]) open.me[u] = { read_at: null, snoozed_until: null };
      }
      return open.core.id;
    }
    const id = mockId(this.rows.length + 1 + this.seq++);
    const now = this.iso();
    const me: MockRow['me'] = {};
    for (const u of Object.keys(USERS) as MockUserId[]) me[u] = { read_at: null, snoozed_until: null };
    this.rows.push({
      core: {
        id, source: s.source, category: info.category, severity: sev, title: s.title ?? info.label, body: s.body ?? info.label, subject: { kind: s.subject_kind, id: s.subject_id, area_id: s.area_id ?? null },
        link: LINK[s.subject_kind](s.subject_id), count: 1, first_at: now, last_at: now, state: 'open', acked_at: null, acked_by_display: null, resolved_at: null, has_snapshot: false,
        timeline: [{ at: now, kind: 'created' }],
      },
      door: null, audience: policy.recipients.rule === 'managers' ? 'managers' : policy.recipients.rule === 'initiator' ? 'initiator' : 'scope', initiator: s.initiator ?? null, dedupe, me, deliveries: [],
    });
    return id;
  }
  /** The condition ended: resolves the open row with this dedupe key. Returns whether one was open. */
  resolveSignal(dedupeKey: string): boolean {
    const r = this.rows.find((x) => x.dedupe === dedupeKey && x.core.state !== 'resolved');
    if (!r) return false;
    r.core.state = 'resolved';
    r.core.resolved_at = this.iso();
    r.core.timeline.push({ at: this.iso(), kind: 'resolved' });
    return true;
  }
  /** What the installation would send for `severity` on `channel` at the clock (the pass-through matrix, escalation optional). */
  wouldSend(severity: Severity, channel: Channel, escalation = false): boolean {
    return passThrough(this.settingsRow, severity, channel, this.clock, this.tz, { escalation }).send;
  }
}

let store: NotifyMockStore | null = null;
/** The session's mock store (one per page load; the administrator's view of the default house until a spec or the mock bar resets it). */
export function notifyMock(): NotifyMockStore { return (store ??= new NotifyMockStore()); }
/** A fresh store (specs, scenarios). */
export function resetNotifyMock(o: NotifyMockOptions = {}): NotifyMockStore {
  store = new NotifyMockStore(o);
  return store;
}
