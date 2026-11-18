/**
 * CR-018 S3: the pure logic of the notification center and the Settings tab (no DOM, no network): what a row says, which tag it carries,
 * the filter counts, the badge of the avatar, how a live event changes the list, and the draft operations of the settings sections.
 * The binding helpers (layout, filters, state machine, lock-screen text, door flow, validation) live in api/notifications.ts; this file only
 * adds what the screens need on top, so it can be unit-tested without a browser (tests/unit-notify-center.spec.ts).
 */
import { rnt } from '../i18n/rfq-notify'; // TKRFQ5
import {
  CATEGORY_LABEL, CATEGORY_ORDER, ESCALATION_AFTER_MIN, SEVERITY_LABEL, WEEKDAYS, clockText, validateEmailBody, deliveryChip, deliveryLine, escalationPreview, filterInbox, isSnoozed, isUnread,
  lockscreenInputOf, lockscreenText, pushActions, sourceInfo, withChannel,
  type Category, type Channel, type Delivery, type EmailBody, type EmailSecurity, type EscalationSettings, type InboxFilter, type Notification, type NotifyPolicy, type NotifySettings, type NotifyStats, type PassThrough,
  type PushAction, type Severity, type SourceInfo, type SubjectKind, type Weekday,
} from '../api/notifications';
import { tr } from '../i18n/msg/components';
import { bt as boardText } from '../tickets/board-text'; // CR-038: the `ticket` subject kind's labels carry the module's configured name (D33)

// ------------------------------------------------------------------------------------------------ keyboard

/**
 * MEDIA-polish: arrow keys inside an open menu (`role="menu"`): ArrowDown / ArrowUp move the focus between the items and wrap, Home / End
 * jump. Returns true when the key was handled (the caller prevents the default scroll). Items are the `role^="menuitem"` buttons of `menu`.
 */
export function menuArrow(e: Pick<KeyboardEvent, 'key'>, menu: ParentNode | null, active: Element | null = (menu as unknown as { ownerDocument?: Document })?.ownerDocument?.activeElement ?? null): boolean {
  if (!menu) return false;
  const items = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
  if (!items.length) return false;
  const root = (menu as Node).getRootNode?.() as (ShadowRoot | Document | undefined);
  const focused = (root && 'activeElement' in root ? root.activeElement : active) ?? active;
  const i = items.findIndex((el) => el === focused);
  let next = -1;
  if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % items.length;
  else if (e.key === 'ArrowUp') next = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  if (next < 0) return false;
  items[next].focus({ preventScroll: true }); // the filter row scrolls sideways: a focus must not drag it along
  return true;
}

// ------------------------------------------------------------------------------------------------ rows

/** The place a row names: the area, else what the subject is ("מערכת", "חשבון", "תזמונים") - every row has one short place word. */
export function placeText(n: Pick<Notification, 'subject' | 'category'> & { place_name?: string | null }, areas: Record<string, string>): string {
  if (n.place_name) return n.place_name; // the server's name first: the station, the camera, the area
  const a = n.subject.area_id ? areas[n.subject.area_id] : undefined;
  if (a) return a;
  switch (n.subject.kind) {
    case 'system': return tr('מערכת');
    case 'session': return tr('חשבון');
    case 'schedule': return tr('תזמונים');
    case 'automation': return tr('אוטומציות');
    case 'bulk_job': return tr('פעולה קבוצתית');
    default: return CATEGORY_LABEL[n.category];
  }
}

const KIND_LABEL: Record<SubjectKind, string> = {
  camera: tr('מצלמה'), entity: tr('התקן'), area: tr('אזור'), alarm_panel: tr('לוח אזעקה'), door: tr('עמדת כניסה'), schedule: tr('תזמון'), automation: tr('אוטומציה'), bulk_job: tr('פעולה קבוצתית'), system: tr('מערכת'), session: tr('כניסות'), generator: tr('גנרטור'), elevator: tr('מעלית'), temperature: tr('יחידת טמפרטורה'), maintenance: tr('משימת תחזוקה'), notice: tr('הודעה בלוח ההודעות'),
  get ticket() { return boardText('kindTicket'); }, // CR-038 D33: the configured name
  get rfq() { return rnt('kind'); }, // TKRFQ5
};
const OPEN_LABEL: Record<SubjectKind, string> = {
  camera: tr('פתח את המצלמה'), entity: tr('פתח את ההתקן'), area: tr('פתח את האזור'), alarm_panel: tr('פתח את האזעקה'), door: tr('פתח את העמדה'), schedule: tr('פתח את התזמון'), automation: tr('פתח את האוטומציה'),
  bulk_job: tr('פתח את התוצאה'), system: tr('פתח את הבריאות'), session: tr('פתח את הכניסות'), generator: tr('פתח את הגנרטור'), elevator: tr('פתח את המעליות'), temperature: tr('פתח את הטמפרטורות'), maintenance: tr('פתח את המשימה'), notice: tr('פתח את לוח ההודעות'),
  get ticket() { return boardText('openTicket'); }, // CR-038 D33
  get rfq() { return rnt('open'); }, // TKRFQ5
};
/** The label of the "open the device" menu item: "פתח את המצלמה". */
export const openLabel = (n: Pick<Notification, 'subject'>): string => OPEN_LABEL[n.subject.kind];
/** The "where" of the detail view: what the subject is and its place, "מצלמה · חניה" ("עמדת כניסה" is the door's own name when the row has one). */
export function whereText(n: Pick<Notification, 'subject' | 'category' | 'door'> & { place_name?: string | null }, areas: Record<string, string>): string {
  const place = placeText(n, areas);
  const what = n.door?.name ? tr('עמדת כניסה') : KIND_LABEL[n.subject.kind];
  return what === place ? place : `${what} · ${place}`;
}

/** The pictogram of a row (the source catalog's). */
export const iconOf = (n: Pick<Notification, 'source'>): string => sourceInfo(n.source)?.icon ?? 'bell';

type RowTagKind = 'ack' | 'res' | 'snz' | 'fail' | 'held';
interface RowTag { kind: RowTagKind; text: string; icon: string }
/** The one state tag under a row's title (the mockup): resolved, acknowledged by, snoozed until, delivery failed, held by quiet hours. Null: an open row
 * nothing happened to. A resolved row says only "נפתר"; an acknowledged one names who. */
export function rowTag(n: Notification, now: number, tz?: string): RowTag | null {
  if (n.state === 'resolved') return { kind: 'res', text: tr('נפתר'), icon: 'check' };
  if (n.state === 'acknowledged') return { kind: 'ack', text: n.acked_by_display ? `${tr('אושר')} · ${n.acked_by_display}` : tr('אושר'), icon: 'check' };
  if (isSnoozed(n, now) && n.me.snoozed_until) return { kind: 'snz', text: tr('הושתק עד {time}', { time: clockText(n.me.snoozed_until, tz) }), icon: 'snooze' };
  const chip = deliveryChip(n);
  if (chip?.tone === 'bad') return { kind: 'fail', text: chip.text, icon: 'warning' };
  if (chip?.tone === 'held') return { kind: 'held', text: chip.text, icon: 'moon' };
  return null;
}

/** The rows' counts on the filter buttons (all / unread / critical). */
export function filterCounts(rows: readonly Notification[], now: number): Record<InboxFilter, number> {
  return { all: rows.length, unread: rows.filter((n) => isUnread(n, now)).length, critical: rows.filter((n) => n.severity === 'critical').length };
}
interface SourceOption { category: Category; label: string; count: number; icon: string }
const CATEGORY_ICON: Record<Category, string> = { safety: 'siren', device_faults: 'warning', system: 'settings', doors: 'door', automations: 'bolt', security: 'key', alerts: 'cam', tickets: 'ticket', maintenance: 'clock', building: 'building' };
/** The source filter's options: the categories that have rows, in the matrix order, with their counts. */
export function sourceOptions(rows: readonly Pick<Notification, 'category'>[]): SourceOption[] {
  const count: Partial<Record<Category, number>> = {};
  for (const n of rows) count[n.category] = (count[n.category] ?? 0) + 1;
  return CATEGORY_ORDER.filter((c) => (count[c] ?? 0) > 0).map((c) => ({ category: c, label: CATEGORY_LABEL[c], count: count[c] as number, icon: CATEGORY_ICON[c] }));
}
export const categoryIcon = (c: Category): string => CATEGORY_ICON[c];

/** The center's subtitle: "15 ב־30 הימים האחרונים" (the retention is known to the administrator only), else "15 התראות". */
export function subtitleText(count: number, retentionDays: number | null): string {
  if (count === 0) return retentionDays ? tr('{n} הימים האחרונים', { n: retentionDays }) : tr('אין התראות');
  return retentionDays ? tr('{count} ב־{days} הימים האחרונים', { count, days: retentionDays }) : tr('{n} התראות', { n: count });
}

/** The rows a filter shows (filter + source), the list the center lays out. */
export const visibleRows = (rows: readonly Notification[], filter: InboxFilter, category: Category | null, now: number): Notification[] => filterInbox(rows, { filter, category, now });

// ------------------------------------------------------------------------------------------------ the avatar badge

interface Badge {
  /** The count of the user menu's chip (0 = no chip). */
  count: number;
  /** The avatar's red dot: an open critical row (the server's summary), else the legacy "open rule alerts". */
  dot: boolean;
  /** The user menu shows the התראות item at all. */
  item: boolean;
}
/** CR §6.1: the chip is the unread count and the avatar dot the open-critical state, from `/notifications/summary`; when the summary is not available
 * (an older backend, a failed request) the rule-alert count of today's poll stands in for both, and `null` there means "this user may not read alerts" (no item). */
export function badgeOf(summary: { unread: number; open_critical: number } | null, legacyAlerts: number | null): Badge {
  if (summary) return { count: summary.unread, dot: summary.open_critical > 0, item: true };
  if (legacyAlerts === null) return { count: 0, dot: false, item: false };
  return { count: legacyAlerts, dot: legacyAlerts > 0, item: true };
}
/** The avatar's accessible name part: "3 התראות" / "התראה אחת" / "התראה קריטית פתוחה" (empty when there is nothing). */
export function badgeLabel(b: Badge, openCritical = 0): string {
  const parts: string[] = [];
  if (openCritical > 0) parts.push(openCritical === 1 ? tr('התראה קריטית פתוחה') : tr('{n} התראות קריטיות פתוחות', { n: openCritical }));
  if (b.count > 0) parts.push(b.count === 1 ? tr('התראה אחת שלא נקראה') : tr('{n} התראות שלא נקראו', { n: b.count > 99 ? '99+' : b.count }));
  return parts.join(' · ');
}

// ------------------------------------------------------------------------------------------------ live events (/me/ws)

interface LiveEffect { rows: Notification[]; summary: { unread: number; open_critical: number } | null; refetch: boolean }
/** What a socket event does to the loaded list: a new notification asks for a refetch (the row itself is built by the server, and a fold changes an existing one);
 * a state change patches the row in place (ack / resolve by a colleague); a summary replaces the chip numbers. Unknown events change nothing. */
export function applyLiveEvent(rows: readonly Notification[], ev: { type: string; payload?: unknown }): LiveEffect {
  const same = [...rows];
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  if (ev.type === 'notification') return { rows: same, summary: null, refetch: true };
  if (ev.type === 'notification_state' && typeof p.id === 'string') {
    const state = p.state as Notification['state'];
    const next = same.map((n) => (n.id !== p.id ? n : { ...n, state, acked_by_display: typeof p.acked_by_display === 'string' ? p.acked_by_display : n.acked_by_display }));
    return { rows: next, summary: null, refetch: false };
  }
  if (ev.type === 'notify_summary' && typeof p.unread === 'number' && typeof p.open_critical === 'number') return { rows: same, summary: { unread: p.unread, open_critical: p.open_critical }, refetch: false };
  return { rows: same, summary: null, refetch: false };
}
/** Replaces the row with the same id (the server's answer to read / snooze / ack), keeping the order. */
export const replaceRow = (rows: readonly Notification[], row: Notification): Notification[] => rows.map((n) => (n.id === row.id ? row : n));

// ------------------------------------------------------------------------------------------------ the settings sections: draft operations

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const stepAfterMin = (e: EscalationSettings, delta: number): EscalationSettings => ({ ...e, after_min: clamp(e.after_min + delta, ESCALATION_AFTER_MIN.min, ESCALATION_AFTER_MIN.max) });
/** A weekday on / off, kept in week order. */
export function toggleDay(days: readonly Weekday[], day: Weekday): Weekday[] {
  const set = new Set(days);
  if (set.has(day)) set.delete(day); else set.add(day);
  return WEEKDAYS.filter((d) => set.has(d));
}
/** One cell of the quiet-hours matrix (push / email); Companion is a reserved column that cannot be switched. */
export function togglePass(pt: PassThrough, severity: Severity, channel: 'webpush' | 'email' | 'whatsapp'): PassThrough {
  return { ...pt, [severity]: { ...pt[severity], [channel]: !pt[severity][channel] } };
}
/** The policy with a channel switched (the same rule the server enforces: reserved channels refuse). */
export const policyWithChannel = (p: NotifyPolicy, channel: Channel, on: boolean): NotifyPolicy => withChannel(p, channel, on);
export const policyWithRule = (p: NotifyPolicy, rule: NotifyPolicy['recipients']['rule']): NotifyPolicy => ({ ...p, recipients: rule === 'users' ? { rule, user_ids: p.recipients.user_ids ?? [] } : { rule } });
export const policyWithSeverity = (p: NotifyPolicy, severity: Severity): NotifyPolicy => ({ ...p, severity });

export interface MatrixGroup { category: Category; label: string; icon: string; rows: { info: SourceInfo; policy: NotifyPolicy }[] }
/** The sources matrix: the policies joined to the catalog, grouped by category in the matrix order; a policy of an unknown source is left out. */
export function matrixGroups(policies: readonly NotifyPolicy[], catalog: readonly SourceInfo[]): MatrixGroup[] {
  const by = new Map(policies.map((p) => [p.source, p]));
  return CATEGORY_ORDER.map((category) => ({
    category, label: CATEGORY_LABEL[category], icon: CATEGORY_ICON[category],
    rows: catalog.filter((s) => s.category === category && by.has(s.key)).map((s) => ({ info: s, policy: by.get(s.key) as NotifyPolicy })),
  })).filter((g) => g.rows.length > 0);
}
export const enabledCount = (policies: readonly Pick<NotifyPolicy, 'enabled'>[]): number => policies.filter((p) => p.enabled).length;

interface LockCard { title: string; body: string; actions: PushAction[]; ago: string }
const SAMPLE_LEAK = (): Pick<Notification, 'id' | 'link' | 'can_ack' | 'door' | 'title' | 'severity' | 'last_at' | 'body' | 'count'> => ({
  id: 'sample', link: '#/devices/areas/kitchen', can_ack: true, door: null, title: tr('דליפת מים'), severity: 'critical', last_at: '2026-10-01T11:02:00.000Z', body: tr('חיישן ההצפה מתחת לכיור דיווח על מים.'), count: 1,
});
const SAMPLE_RING = (): ReturnType<typeof SAMPLE_LEAK> => ({
  id: 'sample-ring', link: '#/doors/st-main', can_ack: true, door: { id: 'st-main', name: tr('דלת הכניסה'), can_open: true }, title: tr('צלצול בדלת'), severity: 'alert', last_at: '2026-10-01T10:58:00.000Z', body: tr('מישהו מצלצל בעמדת הכניסה הראשית.'), count: 1,
});
/** The lock-screen preview cards at one level for the two sample notifications (a leak, a doorbell): the same functions the push uses (lockscreenText, pushActions), so
 * the preview can never differ from what is sent. `tz` shows the times in the installation zone. */
export function lockPreview(level: NotifySettings['lockscreen'], tz?: string): LockCard[] {
  const cards: { n: ReturnType<typeof SAMPLE_LEAK>; place: string; device: string; ago: string }[] = [
    { n: SAMPLE_LEAK(), place: tr('מטבח'), device: tr('חיישן הצפה · מטבח'), ago: tr('לפני 8 דק׳') },
    { n: SAMPLE_RING(), place: tr('כניסה ראשית'), device: tr('עמדת כניסה ראשית'), ago: tr('לפני 12 דק׳') },
  ];
  return cards.map(({ n, place, device, ago }) => {
    const text = lockscreenText(level, lockscreenInputOf(n, place, device), tz);
    return { title: text.title, body: text.body, actions: pushActions(level, n), ago: level === 'generic' ? tr('עכשיו') : ago };
  });
}

interface FailureCard { channel: Channel; label: string; sent: number; failed: number; skipped: number; tone: 'ok' | 'bad' }
/** The failures panel of the delivery log: per channel, the last 24 h (`/notify/stats`). */
export function failurePanel(stats: NotifyStats | null): FailureCard[] {
  if (!stats) return [];
  const label: Record<string, string> = { webpush: tr('דחיפה'), email: tr('דוא"ל'), inbox: tr('מרכז'), ha_mobile: 'Companion', whatsapp: 'WhatsApp', app: tr('אפליקציה') };
  return (Object.entries(stats.channels) as [Channel, { sent: number; failed: number; skipped: Record<string, number> }][]).filter(([c]) => c !== 'inbox').map(([channel, v]) => ({
    channel, label: label[channel] ?? channel, sent: v.sent, failed: v.failed, skipped: Object.values(v.skipped).reduce((a, b) => a + b, 0), tone: v.failed > 0 ? 'bad' as const : 'ok' as const,
  }));
}
/** The delivery log rows to show: all, or only failures. */
export const logRows = (list: readonly Delivery[], onlyFailed: boolean): Delivery[] => (onlyFailed ? list.filter((d) => d.status === 'failed' || d.status === 'gone') : [...list]);
export const failedCount = (list: readonly Delivery[]): number => logRows(list, true).length;

/** The escalation preview lines of the settings section (the first send, each step, the stop) with their clock time counted from `startMinutes` (minutes since midnight). */
export function escalationLines(esc: EscalationSettings, startMinutes: number, nameOf: (to: EscalationSettings['to']) => string): { clock: string; title: string; sub: string; kind: 'created' | 'escalated' | 'acknowledged' }[] {
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const out: { clock: string; title: string; sub: string; kind: 'created' | 'escalated' | 'acknowledged' }[] = [{ clock: hhmm(startMinutes), title: tr('דליפת מים · מטבח'), sub: tr('נשלח לכל מי שרואה'), kind: 'created' }];
  for (const l of escalationPreview(esc)) {
    if (l.minute > 0) out.push({ clock: hhmm(startMinutes + l.minute), title: tr('הסלמה {n}', { n: out.length }), sub: `${nameOf(esc.to)} · ${tr('דחיפה דחופה')}`, kind: 'escalated' });
  }
  if (esc.enabled) out.push({ clock: '—', title: tr('אישור'), sub: tr('עוצר את ההסלמה'), kind: 'acknowledged' });
  return out;
}

/** The text of the severity tag: "קריטי" / "התראה" / "מידע". */
export const severityText = (s: Severity): string => SEVERITY_LABEL[s];
/** "נשלח לטלפון · 14:02"-style delivery line of the detail view with its tone class. */
export const detailDelivery = (n: Pick<Notification, 'my_deliveries'>, tz?: string) => deliveryLine(n, tz);

// ------------------------------------------------------------------------------------------------ outgoing mail (CR §6.4; the S4 backend's wire)

/** The body of `PUT /notify/email` as the email backend (S4) takes it: the contract's fields plus `link_base`, the Arx address the mail's link uses (empty = the mail says
 * "enter Arx" without a link). The S0 types do not carry it yet; the field rides along in the JSON. */
export type MailBody = EmailBody & { link_base?: string };
/** The answer of `POST /notify/email/test` as the email backend gives it: the contract's `{ok, detail}` plus how many recipients got it. */
export interface MailTestResult { ok: boolean; detail: string; message?: string; delivered?: number; total?: number }
export const MAX_MAIL_RECIPIENTS = 10;
/** The failure classes of the test in plain Hebrew (the contract's six and the backend's invalid / too_large / unavailable). */
export const MAIL_TEST_DETAIL: Record<string, string> = {
  dns: tr('שם השרת לא נמצא'), connect: tr('החיבור לשרת נדחה'), tls: tr('כשל בהצפנה'), auth: tr('שם משתמש או סיסמה שגויים'), refused: tr('השרת דחה את ההודעה'), timeout: tr('השרת לא ענה בזמן'),
  invalid: tr('כתובת לא תקינה'), too_large: tr('ההודעה גדולה מדי'), unavailable: tr('הדוא"ל לא זמין כרגע'),
};
/** "נשלח מייל בדיקה" / "נשלח ל־2 מתוך 3 נמענים" / "החיבור לשרת נדחה (connect)". */
export function mailResultText(r: MailTestResult): string {
  if (r.ok) return typeof r.delivered === 'number' && typeof r.total === 'number' && r.total > 0 && r.delivered < r.total ? tr('נשלח ל־{n} מתוך {total} נמענים', { n: r.delivered, total: r.total }) : tr('נשלח מייל בדיקה');
  return `${MAIL_TEST_DETAIL[r.detail] ?? tr('הבדיקה נכשלה')} (${r.detail})`;
}
/** An empty link base, or an http(s) address without spaces. */
export const isValidLinkBase = (v: string): boolean => v.trim() === '' || /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v.trim());
/** `email_invalid` for the contract's checks, more than ten recipients, or a link base that is not an address; else null. */
export function mailFormError(b: MailBody): 'email_invalid' | null {
  if (validateEmailBody(b) || b.recipients.length > MAX_MAIL_RECIPIENTS || !isValidLinkBase(b.link_base ?? '')) return 'email_invalid';
  return null;
}

/** The outgoing-mail form as typed (strings as in the inputs; `pwEdit` = the password field is open for a new password). */
export interface MailDraft { linkBase: string; host: string; port: string; security: EmailSecurity; user: string; password: string; pwEdit: boolean; from: string; recipients: string }
/** The form as the saved settings fill it (the password is never sent back: an empty field, open only when none is set). */
export const mailDraftOf = (s: NotifySettings): MailDraft => ({
  linkBase: (s.email as { link_base?: string }).link_base ?? '', host: s.email.host, port: String(s.email.port), security: s.email.security, user: s.email.user, password: '', pwEdit: !s.email.password_set, from: s.email.from, recipients: s.email.recipients.join(', '),
});
const MAIL_DRAFT_KEYS: (keyof MailDraft)[] = ['linkBase', 'host', 'port', 'security', 'user', 'password', 'pwEdit', 'from', 'recipients'];
/** True when the form differs from what `saved` would fill it with: the user typed something not saved yet. */
export const mailDraftDirty = (draft: MailDraft, saved: NotifySettings | null): boolean => {
  if (!saved) return false;
  const clean = mailDraftOf(saved);
  return MAIL_DRAFT_KEYS.some((k) => draft[k] !== clean[k]);
};
/**
 * CR-WISKEY-NOTIF-2443 (review 06:NOTIF-1): the form after the screen read the settings again (a revision conflict on another section
 * reloads them). An unsaved form is kept as typed - the reload used to refill it from the server and the typing was lost; a clean
 * form follows the new settings.
 */
export const mailDraftAfterReload = (draft: MailDraft, before: NotifySettings | null, after: NotifySettings): MailDraft => (mailDraftDirty(draft, before) ? draft : mailDraftOf(after));

/** The sections of הגדרות › התראות (one shown at a time, AUDIT30-I6), in tab order. */
export const NOTIFY_SECTION_IDS = ['sources', 'quiet', 'esc', 'lock', 'keep', 'mail', 'wa', 'chan', 'log'] as const;
export type NotifySectionId = (typeof NOTIFY_SECTION_IDS)[number];
/**
 * CR-WISKEY-NOTIF-2443 (review 06:NOTIF-1): a section id from outside (the route's `section`, a tab's change event) -> the id, or null
 * when it is not one of the sections. The screen used to cast any string (e.g. `quiet-windows`, a block INSIDE the quiet section) and
 * `sections[id]()` threw on it.
 */
export const notifySection = (id: unknown): NotifySectionId | null => (typeof id === 'string' && (NOTIFY_SECTION_IDS as readonly string[]).includes(id) ? (id as NotifySectionId) : null);

/** '#/notifications/<id>' (the url of every push v2 message) -> the notification id, or null. */
export function parseNotificationLink(hash: string): string | null {
  const m = /^#?\/notifications\/([^/?#]+)\/?$/.exec(hash);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}
