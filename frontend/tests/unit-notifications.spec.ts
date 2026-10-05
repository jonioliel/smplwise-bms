import { test, expect } from '@playwright/test';
import {
  CATEGORY_LABEL, CENTER_LAYOUTS, CENTER_LAYOUT_LABEL, DEDUPE_UNTIL_RESOLVED, FAILURES_AUDIENCES, FAILURE_SOURCES, NOTIFY_SETTING_KEYS, DEFAULT_SETTINGS, DOOR_OPEN_IDLE, NOTIFY_ERROR_LABEL, SEVERITY_RANK, SOURCE_CATALOG, VISIBILITY_PERMISSION,
  ackPermission, applyAck, applyFold, applyRead, applyResolve, applySnooze, canAckFor, canSeeNotification, categoryCounts, centerBanners, centerPresentation, channelCell, channelStatus, clockText,
  compareSeverity, dayLabel, defaultPolicies, deliveryChip, deliveryLine, deliveryReasonText, doorButtonVisible, doorConfirmLink, doorOpenQuestion, emailTestText, errorCode,
  escalationPreview, escalationTimeline, filterInbox, filterVisible, groupByCondition, hasDeliveryProblem, hhmmToMin, httpNotify, isOpenCritical, isPinned, isQuietNow, isSnoozed, isUnread,
  isValidAddress, layoutInbox, lockscreenInputOf, lockscreenText, mapNotifyError, maskAddress, maxSeverity, nextState, notify, notifyError, notifyErrorText, openCriticalCount,
  parseDoorConfirmLink, parseRecipients, passThrough, placeLabel, planChannels, policyBody, pushActions, pushBannerText, quietBannerText, quietWindow, recipientsRuleFor, recipientsText, reduceDoorOpen,
  relativeTime, retryAfterS, rowActions, runDoorOpen, settingsBody, severityAtLeast, snoozeOptions, snoozeUntil, sourceInfo, sourceLabel, sourcesByCategory, stateText, summarize, timelineTitle,
  unreadCount, validateEmailBody, validatePolicy, validateSettings, withChannel,
  type DoorOpenState, type EmailBody, type Notification, type NotifySettings, type Viewer,
} from '../src/api/notifications';
import { MOCK_AREAS, MOCK_NOW, MOCK_TZ, mockAt, mockId, notifyMock, resetNotifyMock } from '../src/api/notifications-mock';
import { ApiError } from '../src/api/client';

// CR-018 S0: the typed client's pure helpers, the MOCK adapter (the fixture in miniature: every v1 source, three users, scenario switches) and the error mapping
// (docs/architecture/NOTIFICATIONS_API.md). No browser page. The client loads the mock only through a dynamic import (no import cycle), so the import
// order below does not matter.

const TZ = MOCK_TZ;
const at = (day: number, h: number, m = 0) => mockAt(day, h, m);
const isoAt = (day: number, h: number, m = 0) => new Date(at(day, h, m)).toISOString();
const code = async (p: Promise<unknown>): Promise<string | null> => {
  try { await p; return null; } catch (e) { return e instanceof ApiError ? e.code : `other:${String(e)}`; }
};
const N = (n: number) => mockId(n);

/** A notification from a few fields (the default: an open alert on a camera, read, with no deliveries). */
function mk(over: Partial<Notification> = {}): Notification {
  return {
    id: 'ntf-x', source: 'camera.offline', category: 'device_faults', severity: 'alert', title: 'מצלמה לא זמינה', body: 'המצלמה לא עונה למקליט.',
    subject: { kind: 'camera', id: 'cam-1', area_id: 'parking' }, link: '#/live/cameras/cam-1', count: 1, first_at: isoAt(0, 13, 30), last_at: isoAt(0, 13, 30), state: 'open',
    acked_at: null, acked_by_display: null, resolved_at: null, me: { read_at: isoAt(0, 13, 31), snoozed_until: null }, can_ack: true, has_snapshot: false, door: null,
    timeline: [{ at: isoAt(0, 13, 30), kind: 'created' }], my_deliveries: [], ...over,
  };
}
const viewerWith = (grants: Record<string, string[] | '*'>): Viewer => ({
  user_id: 'u-test',
  can: (p, area) => { const g = grants[p]; return g === '*' || (Array.isArray(g) && area !== null && g.includes(area)); },
});
const rowOf = async (id: number) => (await notifyMock().list({ limit: 100 })).notifications.find((n) => n.id === N(id)) as Notification;

test.describe('notifications client: severity, catalog, defaults', () => {
  test('severity ordering and helpers', () => {
    expect(SEVERITY_RANK).toEqual({ info: 0, alert: 1, critical: 2 });
    expect(severityAtLeast('alert', 'info')).toBe(true);
    expect(severityAtLeast('info', 'alert')).toBe(false);
    expect(['info', 'critical', 'alert', 'critical'].map((s) => s as 'info').sort(compareSeverity)).toEqual(['critical', 'critical', 'alert', 'info']);
    expect(maxSeverity(['info', 'alert'])).toBe('alert');
    expect(maxSeverity([])).toBeNull();
  });

  test('the source catalog holds every v1 source of CR §5, grouped by category in the matrix order', () => {
    const keys = SOURCE_CATALOG.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['rule.alert', 'camera.offline', 'nvr.offline', 'nvr.storage', 'door.ring', 'alarm.triggered', 'alarm.arm_failed', 'alarm.state', 'sensor.leak', 'sensor.smoke', 'sensor.gas', 'sensor.co',
      'opening.left_open', 'device.unavailable', 'device.battery_low', 'schedule.not_confirmed', 'automation.failed', 'automation.notify', 'bulk.partial', 'system.health', 'backup.failed',
      'backup.stale', 'update.available', 'security.new_signin', 'security.lockout', 'camera.motion', 'camera.person', 'camera.vehicle']) expect(keys, k).toContain(k);
    expect(sourcesByCategory().map((g) => g.category)).toEqual(['safety', 'device_faults', 'system', 'doors', 'automations', 'security', 'alerts']);
    expect(sourcesByCategory()[0].label).toBe(CATEGORY_LABEL.safety);
    expect(sourceInfo('sensor.leak')).toMatchObject({ category: 'safety', severity: 'critical' });
    expect(sourceInfo('nope')).toBeUndefined();
    expect(sourceLabel('sensor.leak')).toBe('דליפת מים');
    expect(sourceLabel('custom.thing')).toBe('custom.thing');
    expect(SOURCE_CATALOG.filter((s) => s.rulesOnly).map((s) => s.key)).toEqual(['camera.motion', 'camera.person', 'camera.vehicle']);
  });

  test('the default policies seed CR §5: one per source, critical sends a resolve notice, rules-only sources are off, reserved channels are fixed false', () => {
    const ps = defaultPolicies();
    expect(ps.map((p) => p.source).sort()).toEqual(SOURCE_CATALOG.map((s) => s.key).sort());
    const p = (k: string) => ps.find((x) => x.source === k)!;
    for (const x of ps) {
      expect(x.channels).toMatchObject({ inbox: true, ha_mobile: false, whatsapp: false });
      expect(x.resolve_notice).toBe(x.severity === 'critical');
      expect(x.category).toBe(sourceInfo(x.source)!.category);
    }
    expect(['camera.motion', 'camera.person', 'camera.vehicle', 'alarm.state'].every((k) => !p(k).enabled)).toBe(true);
    expect(ps.filter((x) => !x.enabled)).toHaveLength(4);
    expect(p('opening.left_open')).toMatchObject({ after_s: 600, severity: 'alert', recipients: { rule: 'scope' } });
    expect(p('camera.offline').after_s).toBe(120);
    expect(p('device.unavailable').after_s).toBe(900);
    expect(p('camera.offline').dedupe_window_s).toBe(DEDUPE_UNTIL_RESOLVED);
    expect(p('bulk.partial').recipients.rule).toBe('initiator');
    expect(p('schedule.not_confirmed').recipients.rule).toBe('managers');
    for (const k of ['system.health', 'backup.failed', 'backup.stale', 'nvr.offline', 'nvr.storage', 'update.available']) expect(p(k).channels.email, k).toBe(true);
    expect(p('sensor.leak').channels).toMatchObject({ webpush: true, email: false });
    expect(p('device.battery_low').channels.webpush).toBe(false);
  });

  test('the settings defaults: quiet hours, matrix (critical passes), escalation 5 x 2, type + place, 30 days, mail not configured', () => {
    const s = DEFAULT_SETTINGS();
    expect(s.quiet).toEqual({ enabled: true, from: '22:00', to: '07:00', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
    expect(s.pass_through.critical).toEqual({ webpush: true, email: true, ha_mobile: true });
    expect(s.pass_through.alert).toEqual({ webpush: false, email: false, ha_mobile: false });
    expect(s.pass_through.info.webpush).toBe(false);
    expect(s.escalation).toEqual({ enabled: true, after_min: 5, steps: 2, to: 'managers' });
    expect(s).toMatchObject({ lockscreen: 'type_place', image_in_push: false, retention_days: 30, deliveries_retention_days: 14, companion: { critical_sound_safety: false } });
    expect(s).toMatchObject({ center_layout: 'sheet', failures_audience: 'admins' }); // the owner's two choices of 2026-10-01
    expect(s.email).toMatchObject({ configured: false, password_set: false, last_test: null });
    expect(DEFAULT_SETTINGS()).not.toBe(s);
    expect(Object.keys(settingsBody(s)).sort()).toEqual(['center_layout', 'escalation', 'failures_audience', 'lockscreen', 'pass_through', 'quiet', 'retention_days']);
    expect(Object.keys(policyBody(defaultPolicies()[0])).sort()).toEqual(['after_s', 'channels', 'dedupe_window_s', 'enabled', 'recipients', 'resolve_notice', 'severity']);
  });
});

test.describe('notifications client: time and the unread / state machine', () => {
  test('relative times and day labels in the installation zone', () => {
    const now = MOCK_NOW;
    expect(clockText(at(0, 14, 2), TZ)).toBe('14:02');
    expect(relativeTime(at(0, 14, 9), now, TZ)).toBe('לפני 1 דק׳');
    expect(relativeTime(now - 20_000, now, TZ)).toBe('עכשיו');
    expect(relativeTime(at(0, 13, 58), now, TZ)).toBe('לפני 12 דק׳');
    expect(relativeTime(at(0, 9, 14), now, TZ)).toBe('09:14');
    expect(relativeTime(at(1, 21, 15), now, TZ)).toBe('אתמול 21:15');
    expect(relativeTime(at(3, 7, 0), now, TZ)).toBe('לפני 3 ימים');
    expect(dayLabel(at(0, 3), now, TZ)).toBe('היום');
    expect(dayLabel(at(1, 23, 5), now, TZ)).toBe('אתמול');
    expect(dayLabel(at(2, 19), now, TZ)).toBe('יום שלישי 29.9');
    expect(hhmmToMin('07:30')).toBe(450);
    expect(hhmmToMin('7:3')).toBeNaN();
    expect(hhmmToMin('24:00')).toBeNaN();
  });

  test('unread count: not read and not snoozed; a snoozed row returns when the snooze ends; open critical ignores snooze', () => {
    const now = MOCK_NOW;
    const rows = [
      mk({ id: 'a', me: { read_at: null, snoozed_until: null } }),
      mk({ id: 'b', me: { read_at: null, snoozed_until: new Date(now + 60_000).toISOString() } }),
      mk({ id: 'c', me: { read_at: null, snoozed_until: new Date(now - 60_000).toISOString() } }),
      mk({ id: 'd', me: { read_at: isoAt(0, 9), snoozed_until: null } }),
      mk({ id: 'e', state: 'resolved', me: { read_at: null, snoozed_until: null } }),
      mk({ id: 'f', severity: 'critical', state: 'open', me: { read_at: null, snoozed_until: new Date(now + 60_000).toISOString() } }),
      mk({ id: 'g', severity: 'critical', state: 'acknowledged' }),
    ];
    expect(isSnoozed(rows[1], now)).toBe(true);
    expect(isSnoozed(rows[2], now)).toBe(false);
    expect(isUnread(rows[1], now)).toBe(false);
    expect(unreadCount(rows, now)).toBe(3); // a, c, e
    expect(openCriticalCount(rows)).toBe(1);
    expect(isOpenCritical(rows[5])).toBe(true);
    expect(isOpenCritical(rows[6])).toBe(false);
    expect(summarize(rows, now)).toEqual({ unread: 3, open_critical: 1, by_category: { device_faults: 3 } });
  });

  test('the shared state machine: open -> acknowledged -> resolved, idempotent, resolved is final', () => {
    expect(nextState('open', 'ack')).toBe('acknowledged');
    expect(nextState('acknowledged', 'ack')).toBe('acknowledged');
    expect(nextState('resolved', 'ack')).toBe('resolved');
    expect(nextState('open', 'resolve')).toBe('resolved');
    expect(nextState('acknowledged', 'resolve')).toBe('resolved');
    expect(nextState('resolved', 'resolve')).toBe('resolved');
    const now = MOCK_NOW;
    const n = mk({ severity: 'critical', me: { read_at: null, snoozed_until: null } });
    const acked = applyAck(n, 'יוני', now);
    expect(acked).toMatchObject({ state: 'acknowledged', acked_by_display: 'יוני', acked_at: new Date(now).toISOString() });
    expect(acked.me.read_at).toBe(new Date(now).toISOString());
    expect(acked.timeline.at(-1)).toMatchObject({ kind: 'acknowledged', by_display: 'יוני' });
    expect(n.state).toBe('open'); // pure
    expect(applyAck(acked, 'דנה', now + 1000)).toBe(acked); // second acknowledge changes nothing
    expect(applyAck(mk({ can_ack: false }), 'דנה', now).state).toBe('open'); // not allowed to
    expect(applyAck(mk({ state: 'resolved' }), 'דנה', now).state).toBe('resolved');
    const res = applyResolve(acked, now + 5000);
    expect(res).toMatchObject({ state: 'resolved', resolved_at: new Date(now + 5000).toISOString() });
    expect(applyResolve(res, now + 9000)).toBe(res);
    expect(applyRead(n, now).me.read_at).toBe(new Date(now).toISOString());
    expect(applyRead(acked, now + 1)).toBe(acked); // already read
    expect(applySnooze(n, isoAt(0, 15)).me.snoozed_until).toBe(isoAt(0, 15));
    expect(applySnooze(mk({ state: 'resolved' }), isoAt(0, 15)).me.snoozed_until).toBeNull();
    const folded = applyFold(mk({ count: 2 }), now);
    expect(folded).toMatchObject({ count: 3, last_at: new Date(now).toISOString() });
    expect(folded.timeline.at(-1)).toEqual({ at: new Date(now).toISOString(), kind: 'folded', count: 3 });
  });

  test('snooze: one hour, and "עד הבוקר" = the next end of the quiet window, strictly after now', () => {
    const q = { to: '07:00' };
    expect(snoozeUntil(60, MOCK_NOW, q, TZ)).toBe(new Date(MOCK_NOW + 3_600_000).toISOString());
    const morning = (now: number, quiet = q) => clockText(snoozeUntil('until_morning', now, quiet, TZ), TZ) + ' ' + dayLabel(snoozeUntil('until_morning', now, quiet, TZ), now, TZ);
    expect(morning(at(0, 14, 10))).toBe('07:00 יום שישי 2.10');
    expect(morning(at(0, 3, 0))).toBe('07:00 היום');
    expect(morning(at(0, 7, 0))).toBe('07:00 יום שישי 2.10'); // exactly the morning: the next one
    expect(morning(at(0, 6, 59))).toBe('07:00 היום');
    expect(clockText(snoozeUntil('until_morning', at(0, 14, 10), { to: '06:30' }, TZ), TZ)).toBe('06:30');
    expect(clockText(snoozeUntil('until_morning', at(0, 14, 10), { to: 'junk' }, TZ), TZ)).toBe('07:00'); // a malformed `to` falls back to 07:00
    // across a DST change (Israel, 2026-10-25 01:00 local the clocks go back): 07:00 stays 07:00 local
    const eve = Date.UTC(2026, 9, 24, 12, 0);
    expect(clockText(snoozeUntil('until_morning', eve, q, TZ), TZ)).toBe('07:00');
  });

  test('row actions: acknowledge only open + can_ack, snooze only open and not snoozed, the door button only with can_open', () => {
    const now = MOCK_NOW;
    expect(rowActions(mk(), now)).toMatchObject({ read: false, snooze: true, snoozeMorning: true, ack: true, open: true, door: false, snapshot: false });
    expect(rowActions(mk({ can_ack: false, me: { read_at: null, snoozed_until: new Date(now + 1000).toISOString() } }), now)).toMatchObject({ read: true, snooze: false, ack: false });
    expect(rowActions(mk({ state: 'acknowledged' }), now)).toMatchObject({ ack: false, snooze: false });
    expect(rowActions(mk({ has_snapshot: true }), now).snapshot).toBe(true);
    expect(rowActions(mk({ door: { id: 'st', name: 'דלת', can_open: true } }), now).door).toBe(true);
    expect(rowActions(mk({ door: { id: 'st', name: 'דלת', can_open: false } }), now).door).toBe(false);
    expect(rowActions(mk({ door: { id: 'st', name: 'דלת', can_open: true }, state: 'resolved' }), now).door).toBe(false);
    expect(stateText(mk())).toBe('פתוח');
    expect(stateText(mk({ state: 'acknowledged', acked_by_display: 'דנה' }))).toBe('אושר · דנה');
    expect(stateText(mk({ state: 'resolved' }))).toBe('נפתר');
  });
});

test.describe('notifications client: inbox layout, folds, filters', () => {
  test('the center layout: critical open rows pinned, the rest grouped by local day, newest first', async () => {
    const m = resetNotifyMock();
    const rows = (await m.list({ limit: 100 })).notifications;
    const l = layoutInbox(rows, MOCK_NOW, TZ);
    expect(l.pinned.map((n) => n.id)).toEqual([N(1)]);
    expect(isPinned(l.pinned[0])).toBe(true);
    expect(l.days.map((g) => g.label)).toEqual(['היום', 'אתמול', 'יום שלישי 29.9', 'יום שני 28.9', 'יום ראשון 27.9', 'יום שבת 26.9', 'יום שישי 25.9', 'יום חמישי 24.9']);
    expect(l.days.every((g, i) => i === 0 || g.key < l.days[i - 1].key)).toBe(true); // days descend
    for (const g of l.days) expect(g.rows.map((n) => Date.parse(n.last_at))).toEqual([...g.rows.map((n) => Date.parse(n.last_at))].sort((a, b) => b - a));
    expect(l.days[0].rows.map((n) => n.id)).toEqual([N(2), N(3), N(4), N(6), N(5), N(7)]); // 13:58 13:41 13:30 12:40 09:14 03:00
    expect(l.pinned.length + l.days.reduce((s, g) => s + g.rows.length, 0)).toBe(rows.length);
  });

  test('fold: ×N labels and grouping by condition with counts', () => {
    const a = mk({ id: 'a', count: 3, last_at: isoAt(0, 13), first_at: isoAt(0, 12) });
    const b = mk({ id: 'b', count: 2, last_at: isoAt(1, 10), state: 'resolved' });
    const c = mk({ id: 'c', source: 'sensor.leak', category: 'safety', severity: 'critical', subject: { kind: 'entity', id: 'e1', area_id: 'kitchen' }, last_at: isoAt(0, 14) });
    const d = mk({ id: 'd', subject: { kind: 'camera', id: 'cam-2', area_id: 'parking' }, last_at: isoAt(0, 8) });
    const g = groupByCondition([b, c, a, d]);
    expect(g.map((x) => x.key)).toEqual(['sensor.leak:entity:e1', 'camera.offline:camera:cam-1', 'camera.offline:camera:cam-2']);
    expect(g[1]).toMatchObject({ total: 5, open: true, severity: 'alert', source: 'camera.offline' });
    expect(g[1].rows.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g[1].latest.id).toBe('a');
    expect(g[0]).toMatchObject({ total: 1, severity: 'critical' });
    expect(groupByCondition([])).toEqual([]);
  });

  test('filters: all / unread / critical plus the source filter by category; counts per category', async () => {
    const m = resetNotifyMock();
    const rows = (await m.list({ limit: 100 })).notifications;
    const now = MOCK_NOW;
    expect(filterInbox(rows, { filter: 'all', now })).toHaveLength(rows.length);
    expect(filterInbox(rows, { filter: 'unread', now }).map((n) => n.id)).toEqual([N(1), N(2)]);
    expect(filterInbox(rows, { filter: 'critical', now }).every((n) => n.severity === 'critical')).toBe(true);
    expect(filterInbox(rows, { filter: 'critical', category: 'safety', now }).every((n) => n.category === 'safety' && n.severity === 'critical')).toBe(true);
    expect(filterInbox(rows, { filter: 'all', category: 'security', now }).map((n) => n.source).sort()).toEqual(['security.lockout', 'security.new_signin']);
    expect(categoryCounts(rows).doors).toBe(2);
    expect(placeLabel(rows[0], MOCK_AREAS)).toBeTruthy();
    expect(placeLabel(mk({ subject: { kind: 'system', id: 's', area_id: null } }), MOCK_AREAS)).toBeNull();
  });
});

test.describe('notifications client: escalation timeline', () => {
  test('a critical open row: what happened, then the pending step, "the last step", the waiting line', async () => {
    const m = resetNotifyMock();
    const leak = await rowOf(1);
    const esc = m.settingsRow.escalation;
    const tl = escalationTimeline(leak, esc, MOCK_NOW, TZ);
    expect(tl.map((l) => [l.kind, l.clock])).toEqual([['created', '14:02'], ['escalated', '14:07'], ['pending', '14:12']]);
    expect(tl[1]).toMatchObject({ title: 'הסלמה 1 · נשלח שוב ל־2 מנהלים', sub: '5 דק׳ בלי אישור · דחיפה דחופה', pending: false });
    expect(tl[2]).toMatchObject({ title: 'הסלמה 2 בעוד 2 דק׳', sub: 'השלב האחרון', pending: true });
    expect(timelineTitle(leak)).toBe('ציר ההסלמה');
    // a step overdue but not yet recorded
    expect(escalationTimeline(leak, esc, at(0, 14, 20), TZ).at(-1)?.title).toBe('הסלמה 2 ממתינה');
    // a fresh critical row: both steps pending, no waiting line
    const fresh = mk({ severity: 'critical', first_at: isoAt(0, 14, 5), last_at: isoAt(0, 14, 5), timeline: [{ at: isoAt(0, 14, 5), kind: 'created' }] });
    const f = escalationTimeline(fresh, esc, MOCK_NOW, TZ);
    expect(f.map((l) => l.title)).toEqual(['נוצרה', 'הסלמה 1 ממתינה', 'הסלמה 2 בעוד 5 דק׳']);
    // escalation off: nothing pending, "waiting for acknowledge"
    const off = escalationTimeline(fresh, { ...esc, enabled: false }, MOCK_NOW, TZ);
    expect(off.map((l) => l.kind)).toEqual(['created', 'now']);
    expect(off[1].title).toBe('ממתין לאישור');
    // configurable: 3 steps every 10 minutes
    const cfg = escalationTimeline(fresh, { ...esc, after_min: 10, steps: 3 }, MOCK_NOW, TZ);
    expect(cfg.filter((l) => l.pending).map((l) => l.clock)).toEqual(['14:15', '14:25', '14:35']);
  });

  test('an acknowledged critical stops the escalation; resolved rows end the line; non-critical rows never escalate; failures and folds are listed', async () => {
    const m = resetNotifyMock();
    const esc = m.settingsRow.escalation;
    const alarm = await rowOf(3);
    const tl = escalationTimeline(alarm, esc, MOCK_NOW, TZ);
    expect(tl.map((l) => l.kind)).toEqual(['created', 'escalated', 'acknowledged']);
    expect(tl[2]).toMatchObject({ title: 'אושר · דנה', sub: 'ההסלמה נעצרה', clock: '13:49' });
    expect(tl.some((l) => l.pending)).toBe(false);
    const smoke = await rowOf(12);
    expect(escalationTimeline(smoke, esc, MOCK_NOW, TZ).map((l) => l.title)).toEqual(['נוצרה', 'אושר · יוני', 'נפתר']);
    const camera = await rowOf(4);
    const ct = escalationTimeline(camera, esc, MOCK_NOW, TZ);
    expect(ct.map((l) => l.title)).toEqual(['נוצרה', 'חזרה ×5', 'ממתין לאישור']); // alert: no escalation line
    expect(ct.some((l) => l.pending)).toBe(false);
    const signin = await rowOf(10);
    const st = escalationTimeline(signin, esc, MOCK_NOW, TZ);
    expect(st.find((l) => l.kind === 'delivery_failed')).toMatchObject({ title: 'המסירה לטלפון נכשלה', sub: 'ההתראה במרכז' });
  });

  test('the settings preview and the target text', () => {
    expect(escalationPreview({ enabled: true, after_min: 5, steps: 2, to: 'managers' })).toEqual([
      { minute: 0, text: 'התראה קריטית נשלחת' }, { minute: 5, text: 'הסלמה 1 · נשלח שוב למנהלי התראות' }, { minute: 10, text: 'הסלמה 2 · נשלח שוב למנהלי התראות' }, { minute: -1, text: 'נעצרת באישור' },
    ]);
    expect(escalationPreview({ enabled: true, after_min: 2, steps: 1, to: ['u1', 'u2'] })[1].text).toBe('הסלמה 1 · נשלח שוב למשתמשים נבחרים (2)');
    expect(escalationPreview({ enabled: false, after_min: 5, steps: 2, to: 'managers' })).toHaveLength(1);
  });
});

test.describe('notifications client: lock screen, push actions, quiet hours', () => {
  test('lock-screen text at the three levels; never a person, a visitor or an image', async () => {
    const m = resetNotifyMock();
    const alarm = await rowOf(3); // acknowledged by a colleague: the display name must never reach a lock screen
    const leak = await rowOf(1);
    const input = lockscreenInputOf(leak, 'מטבח', 'חיישן הצפה · מטבח');
    expect(lockscreenText('generic', input, TZ)).toEqual({ title: 'Arx', body: 'התראה חדשה' });
    expect(lockscreenText('type_place', input, TZ)).toEqual({ title: 'דליפת מים · מטבח', body: 'קריטי · 14:02' });
    expect(lockscreenText('full', input, TZ)).toEqual({ title: 'דליפת מים · מטבח', body: 'חיישן ההצפה מתחת לכיור דיווח על מים. חיישן הצפה · מטבח' });
    expect(lockscreenText('full', { ...input, count: 5 }, TZ).body.endsWith(' · ×5')).toBe(true);
    expect(lockscreenText('type_place', { ...input, place: null }, TZ).title).toBe('דליפת מים');
    for (const n of [alarm, leak, await rowOf(2), await rowOf(5)]) for (const level of ['generic', 'type_place', 'full'] as const) {
      const t = lockscreenText(level, lockscreenInputOf(n, placeLabel(n, MOCK_AREAS)), TZ);
      const all = `${t.title} ${t.body}`;
      expect(all).not.toContain(alarm.acked_by_display as string);
      expect(all).not.toMatch(/https?:|data:|\.jpe?g|snapshot|תמונה/i);
    }
    expect(Object.keys(input).sort()).toEqual(['at', 'body', 'count', 'device', 'place', 'severity', 'title']); // the only inputs: no names, no image field
    expect(m.settingsRow.lockscreen).toBe('type_place');
  });

  test('push actions: open, acknowledge, snooze, and the doorbell button as a plain deep link; generic offers open only; nothing opens a door', async () => {
    const m = resetNotifyMock({ viewer: 'door' });
    const ring = await rowOf(2);
    expect(ring.door).toEqual({ id: 'st-main', name: 'דלת הכניסה', can_open: true });
    const a = pushActions('type_place', ring);
    expect(a.map((x) => x.id)).toEqual(['open', 'ack', 'snooze', 'open_door']);
    expect(a[3]).toEqual({ id: 'open_door', label: 'פתח דלת', kind: 'deeplink', url: `#/doors/st-main?confirm=${N(2)}` });
    expect(a.map((x) => x.label)).toEqual(['פתח', 'אישור', 'השתק לשעה', 'פתח דלת']);
    expect(a.filter((x) => x.kind === 'action').map((x) => x.action)).toEqual(['ack', 'snooze']); // only ack / snooze carry a token
    expect(a.find((x) => x.id === 'open_door')?.action).toBeUndefined();
    expect(pushActions('full', ring).map((x) => x.id)).toEqual(['open', 'ack', 'snooze', 'open_door']);
    expect(pushActions('generic', ring).map((x) => x.id)).toEqual(['open']);
    expect(pushActions('type_place', ring, false).map((x) => x.id)).toEqual(['open']);
    expect(pushActions('type_place', { ...ring, can_ack: false }).map((x) => x.id)).toEqual(['open', 'snooze', 'open_door']);
    m.setViewer('operator'); // no door permission: no button
    expect(pushActions('type_place', await rowOf(2)).map((x) => x.id)).toEqual(['open', 'ack', 'snooze']);
    expect(a.every((x) => x.kind === 'open' || x.kind === 'action' || x.kind === 'deeplink')).toBe(true);
  });

  test('quiet window: across midnight (belongs to the day it starts on), same-day, disabled, from == to, no days', () => {
    const q = { enabled: true, from: '22:00', to: '07:00', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as NotifySettings['quiet']['days'] };
    const w = (day: number, h: number, m: number, quiet = q) => quietWindow(quiet, at(day, h, m), TZ);
    expect(w(0, 23, 30).active).toBe(true);
    expect(clockText(w(0, 23, 30).until as string, TZ)).toBe('07:00');
    expect(dayLabel(w(0, 23, 30).until as string, at(0, 23, 30), TZ)).toBe('יום שישי 2.10');
    expect(w(0, 3, 0).active).toBe(true);
    expect(dayLabel(w(0, 3, 0).until as string, at(0, 3, 0), TZ)).toBe('היום');
    expect(w(0, 14, 10)).toEqual({ active: false, until: null });
    expect(w(0, 7, 0).active).toBe(false); // the end is exclusive
    expect(w(0, 22, 0).active).toBe(true); // the start is inclusive
    // 2026-10-01 is a Thursday: only Wednesday and Thursday are ticked
    const wt = { ...q, days: ['wed', 'thu'] as NotifySettings['quiet']['days'] };
    expect(w(0, 3, 0, wt).active).toBe(true); // Thursday 03:00 belongs to Wednesday's window
    expect(w(0, 23, 0, wt).active).toBe(true); // Thursday 23:00 starts Thursday's window
    expect(w(1, 23, 0, wt).active).toBe(true); // Wednesday 23:00
    expect(w(2, 23, 0, wt).active).toBe(false); // Tuesday 23:00
    expect(w(2, 3, 0, wt).active).toBe(false); // Tuesday 03:00 belongs to Monday
    expect(w(0, 23, 0, { ...q, days: ['fri'] }).active).toBe(false);
    expect(w(0, 14, 0, { ...q, from: '13:00', to: '16:00' }).active).toBe(true);
    expect(w(0, 16, 0, { ...q, from: '13:00', to: '16:00' }).active).toBe(false);
    expect(clockText(w(0, 14, 0, { ...q, from: '13:00', to: '16:00' }).until as string, TZ)).toBe('16:00');
    expect(w(0, 23, 30, { ...q, enabled: false }).active).toBe(false);
    expect(w(0, 23, 30, { ...q, from: '22:00', to: '22:00' }).active).toBe(false);
    expect(w(0, 23, 30, { ...q, days: [] }).active).toBe(false);
    expect(isQuietNow(q, at(0, 23, 30), TZ)).toBe(true);
  });

  test('the pass-through matrix: critical passes by default, the centre always receives, escalation bypasses, reserved channels are held', () => {
    const s = DEFAULT_SETTINGS();
    const quiet = at(0, 23, 30);
    const day = at(0, 14, 10);
    expect(passThrough(s, 'critical', 'webpush', quiet, TZ)).toEqual({ send: true, reason: null });
    expect(passThrough(s, 'critical', 'email', quiet, TZ).send).toBe(true);
    expect(passThrough(s, 'alert', 'webpush', quiet, TZ)).toEqual({ send: false, reason: 'quiet_hours' });
    expect(passThrough(s, 'info', 'email', quiet, TZ)).toEqual({ send: false, reason: 'quiet_hours' });
    expect(passThrough(s, 'info', 'inbox', quiet, TZ).send).toBe(true);
    expect(passThrough(s, 'alert', 'webpush', quiet, TZ, { escalation: true }).send).toBe(true);
    expect(passThrough(s, 'alert', 'webpush', day, TZ).send).toBe(true); // outside quiet hours everything is sent
    expect(passThrough(s, 'critical', 'whatsapp', quiet, TZ).send).toBe(false); // no matrix column
    expect(passThrough(s, 'critical', 'ha_mobile', quiet, TZ).send).toBe(true);
    // an administrator's matrix: alerts also pass on push, never on email
    const custom: NotifySettings = { ...s, pass_through: { ...s.pass_through, alert: { webpush: true, email: false, ha_mobile: false } } };
    expect(passThrough(custom, 'alert', 'webpush', quiet, TZ).send).toBe(true);
    expect(passThrough(custom, 'alert', 'email', quiet, TZ).send).toBe(false);
    // quiet hours disabled: nothing is held
    expect(passThrough({ ...s, quiet: { ...s.quiet, enabled: false } }, 'info', 'webpush', quiet, TZ).send).toBe(true);
  });

  test('planning a notification across a policy: category off, mail not configured, quiet hours', () => {
    const s = DEFAULT_SETTINGS();
    const policy = { channels: { inbox: true as const, webpush: true, email: true, ha_mobile: false as const, whatsapp: false as const } };
    const day = at(0, 14, 10);
    const quiet = at(0, 23, 30);
    expect(planChannels(s, policy, 'alert', day, TZ)).toEqual([
      { channel: 'inbox', send: true, reason: null }, { channel: 'webpush', send: true, reason: null }, { channel: 'email', send: false, reason: 'channel_unavailable' },
      { channel: 'app', send: false, reason: 'category_off' }, // CR-027: the app channel, off unless the policy switches it on
    ]);
    const mail = { ...s, email: { ...s.email, configured: true } };
    expect(planChannels(mail, policy, 'alert', quiet, TZ).map((d) => [d.channel, d.send, d.reason])).toEqual([['inbox', true, null], ['webpush', false, 'quiet_hours'], ['email', false, 'quiet_hours'], ['app', false, 'category_off']]);
    expect(planChannels(mail, policy, 'critical', quiet, TZ).filter((d) => d.channel !== 'app').every((d) => d.send)).toBe(true);
    expect(planChannels(mail, { channels: { ...policy.channels, webpush: false } }, 'critical', day, TZ)[1]).toEqual({ channel: 'webpush', send: false, reason: 'category_off' });
    expect(planChannels(mail, policy, 'alert', quiet, TZ, { escalation: true }).filter((d) => d.channel !== 'app').every((d) => d.send)).toBe(true);
    expect(planChannels(mail, { channels: { ...policy.channels, app: true } }, 'alert', quiet, TZ).find((d) => d.channel === 'app')).toEqual({ channel: 'app', send: false, reason: 'quiet_hours' });
  });

  test('the quiet banner and the center banners', () => {
    const s = DEFAULT_SETTINGS();
    expect(quietBannerText(s, at(0, 23, 30), TZ)).toBe('שעות שקט עד 07:00 · נשלח רק קריטי');
    expect(quietBannerText(s, at(0, 14, 10), TZ)).toBeNull();
    expect(quietBannerText({ ...s, pass_through: { ...s.pass_through, alert: { webpush: true, email: false, ha_mobile: false } } }, at(0, 23, 30), TZ)).toBe('שעות שקט עד 07:00 · נשלח רק קריטי, התראה');
    const none = { ...s, pass_through: { info: { webpush: false, email: false, ha_mobile: false }, alert: { webpush: false, email: false, ha_mobile: false }, critical: { webpush: false, email: false, ha_mobile: false } } };
    expect(quietBannerText(none, at(0, 23, 30), TZ)).toBe('שעות שקט עד 07:00 · לא נשלח דבר');
    const all = { ...s, pass_through: { info: s.pass_through.critical, alert: s.pass_through.critical, critical: s.pass_through.critical } };
    expect(quietBannerText(all, at(0, 23, 30), TZ)).toBe('שעות שקט עד 07:00 · נשלח הכול');
    expect(pushBannerText('ok', 1)).toBeNull();
    expect(pushBannerText('ok', 0)).toBe('ההתראות לא מופעלות במכשיר הזה');
    expect(pushBannerText('unsupported', 1)).toBe('התראות דחיפה לא נתמכות במכשיר הזה');
    expect(pushBannerText('ios_install', 0)).toContain('מסך הבית');
    const rows = [mk({ my_deliveries: [{ channel: 'webpush', status: 'failed', reason: 'http_410', at: isoAt(0, 8) }] }), mk({ my_deliveries: [{ channel: 'webpush', status: 'failed', reason: 'timeout', at: isoAt(0, 9) }] }), mk()];
    expect(centerBanners({ settings: s, now: at(0, 23, 30), tz: TZ, support: 'unsupported', registeredHere: 0, rows }).map((b) => [b.kind, b.text])).toEqual([
      ['quiet', 'שעות שקט עד 07:00 · נשלח רק קריטי'], ['push', 'התראות דחיפה לא נתמכות במכשיר הזה'], ['failed', 'המסירה לטלפון נכשלה · 2 התראות'],
    ]);
    expect(centerBanners({ settings: null, now: MOCK_NOW, tz: TZ, support: 'ok', registeredHere: 1, rows: [mk()] })).toEqual([]);
  });

  test('delivery lines and chips: sent, failed, held by quiet hours, other reasons, pending', () => {
    const d = (status: Notification['my_deliveries'][number]['status'], reason: string | null = null, channel: Notification['my_deliveries'][number]['channel'] = 'webpush', h = 14) => ({ channel, status, reason, at: isoAt(0, h, 2) });
    expect(deliveryLine(mk(), TZ)).toBeNull();
    expect(deliveryLine(mk({ my_deliveries: [d('sent')] }), TZ)).toEqual({ tone: 'ok', text: 'נשלח לטלפון · 14:02', at: isoAt(0, 14, 2) });
    expect(deliveryLine(mk({ my_deliveries: [d('sent', null, 'email', 3)] }), TZ)?.text).toBe('נשלח בדוא"ל · 03:02');
    expect(deliveryLine(mk({ my_deliveries: [d('failed', 'http_410')] }), TZ)).toMatchObject({ tone: 'bad', text: 'המסירה לטלפון נכשלה · 14:02' });
    expect(deliveryLine(mk({ my_deliveries: [d('gone')] }), TZ)?.tone).toBe('bad');
    expect(deliveryLine(mk({ my_deliveries: [d('skipped', 'quiet_hours')] }), TZ)).toMatchObject({ tone: 'held', text: 'לא נשלח · שעות שקט' });
    expect(deliveryLine(mk({ my_deliveries: [d('skipped', 'category_off')] }), TZ)?.text).toBe('לא נשלח · ערוץ כבוי למקור');
    expect(deliveryLine(mk({ my_deliveries: [d('failed', 'timeout'), d('sent', null, 'email')] }), TZ)?.tone).toBe('ok'); // sent wins over a failure elsewhere
    expect(deliveryLine(mk({ my_deliveries: [d('queued')] }), TZ)?.tone).toBe('pending');
    expect(deliveryLine(mk({ my_deliveries: [{ channel: 'inbox', status: 'sent', reason: null, at: isoAt(0, 14) }] }), TZ)).toBeNull(); // the centre is not a delivery line
    expect(deliveryChip(mk({ my_deliveries: [d('failed')] }))).toEqual({ tone: 'bad', text: 'המסירה נכשלה' });
    expect(deliveryChip(mk({ my_deliveries: [d('skipped', 'quiet_hours')] }))).toEqual({ tone: 'held', text: 'לא נשלח' });
    expect(deliveryChip(mk({ my_deliveries: [d('sent')] }))).toBeNull();
    expect(hasDeliveryProblem(mk({ my_deliveries: [d('failed')] }))).toBe(true);
    expect(hasDeliveryProblem(mk())).toBe(false);
    expect(deliveryReasonText('http_410')).toBe('ההרשמה פגה (410)');
    expect(deliveryReasonText('http_503')).toBe('שירות הדחיפה סירב (503)');
    expect(deliveryReasonText('connect')).toBe('החיבור נדחה (connect)');
    expect(deliveryReasonText(null)).toBe('');
    expect(deliveryReasonText('weird')).toBe('weird');
  });
});

test.describe('notifications client: the door-open flow (CR §9)', () => {
  const ring = (canOpen = true, state: Notification['state'] = 'open') => mk({ id: N(2), state, door: { id: 'st-main', name: 'דלת הכניסה', can_open: canOpen } });

  test('a press only opens the in-app confirmation; sending needs the confirm; the result closes it', () => {
    let s: DoorOpenState = DOOR_OPEN_IDLE;
    s = reduceDoorOpen(s, { type: 'confirm' });
    expect(s.phase).toBe('idle'); // a confirm without a press does nothing
    s = reduceDoorOpen(s, { type: 'press', notification: ring() });
    expect(s).toEqual({ phase: 'confirm', notification_id: N(2), door: { id: 'st-main', name: 'דלת הכניסה' }, error: null, text: null });
    expect(doorOpenQuestion(s.door!.name)).toBe('האם אתה בטוח שברצונך לפתוח את דלת הכניסה?');
    s = reduceDoorOpen(s, { type: 'press', notification: ring() });
    expect(s.phase).toBe('confirm'); // pressing again does not skip the dialog
    s = reduceDoorOpen(s, { type: 'accepted' });
    expect(s.phase).toBe('confirm'); // no result without a command
    s = reduceDoorOpen(s, { type: 'confirm' });
    expect(s.phase).toBe('sending');
    expect(reduceDoorOpen(s, { type: 'cancel' }).phase).toBe('sending'); // not while in flight
    expect(reduceDoorOpen(s, { type: 'press', notification: ring() })).toBe(s);
    s = reduceDoorOpen(s, { type: 'accepted' });
    expect(s).toMatchObject({ phase: 'done', text: 'הפקודה נשלחה אל דלת הכניסה' });
    expect(reduceDoorOpen(s, { type: 'dismiss' })).toEqual(DOOR_OPEN_IDLE);
    expect(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'dismiss' })).toEqual(DOOR_OPEN_IDLE);
  });

  test('no button, no flow: without can_open, on a resolved row or a non-doorbell row a press is ignored', () => {
    expect(doorButtonVisible(ring())).toBe(true);
    expect(doorButtonVisible(ring(false))).toBe(false);
    expect(doorButtonVisible(ring(true, 'resolved'))).toBe(false);
    expect(doorButtonVisible(mk())).toBe(false);
    expect(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: ring(false) })).toBe(DOOR_OPEN_IDLE);
    expect(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: ring(true, 'resolved') })).toBe(DOOR_OPEN_IDLE);
    expect(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: mk() })).toBe(DOOR_OPEN_IDLE);
    const confirm = reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: ring() });
    expect(reduceDoorOpen(confirm, { type: 'cancel' })).toEqual(DOOR_OPEN_IDLE);
  });

  test('failures: step-up asks again then resends, other errors end in a line, a failed flow can start over', () => {
    let s = reduceDoorOpen(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: ring() }), { type: 'confirm' });
    s = reduceDoorOpen(s, { type: 'error', code: 'step_up_required' });
    expect(s.phase).toBe('step_up');
    expect(reduceDoorOpen(s, { type: 'confirm' }).phase).toBe('step_up');
    s = reduceDoorOpen(s, { type: 'step_up_done' });
    expect(s.phase).toBe('sending');
    s = reduceDoorOpen(s, { type: 'error', code: 'forbidden' });
    expect(s).toMatchObject({ phase: 'failed', error: 'forbidden', text: 'אין הרשאה לפתוח את הדלת' });
    expect(reduceDoorOpen(s, { type: 'press', notification: ring() }).phase).toBe('confirm');
    const unknown = reduceDoorOpen(reduceDoorOpen(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: ring() }), { type: 'confirm' }), { type: 'error', code: 'zzz' });
    expect(unknown.text).toBe('הפתיחה נכשלה');
    expect(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'error', code: 'forbidden' })).toBe(DOOR_OPEN_IDLE);
  });

  test('the deep link round trip', () => {
    const link = doorConfirmLink('st main', 'ntf/1');
    expect(link).toBe('#/doors/st%20main?confirm=ntf%2F1');
    expect(parseDoorConfirmLink(link)).toEqual({ doorId: 'st main', notificationId: 'ntf/1' });
    expect(parseDoorConfirmLink('#/doors/st-main?x=1&confirm=ntf-001')).toEqual({ doorId: 'st-main', notificationId: 'ntf-001' });
    expect(parseDoorConfirmLink('#/doors/st-main')).toBeNull();
    expect(parseDoorConfirmLink('#/live/cameras/1?confirm=x')).toBeNull();
  });

  test('with the mock: nothing is released by a press or a push; the confirmed command goes through the release route with the notification as its origin', async () => {
    const m = resetNotifyMock({ viewer: 'door' });
    const row = await rowOf(2);
    let s = reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: row });
    expect(s.phase).toBe('confirm');
    expect(await runDoorOpen(m, s)).toBe(s); // a state that is not `sending` sends nothing
    pushActions('full', row); // building the push buttons sends nothing either
    expect(m.doorOpens).toEqual([]);
    s = reduceDoorOpen(s, { type: 'confirm' });
    const seen: string[] = [];
    const done = await runDoorOpen(m, s, (x) => seen.push(x.phase));
    expect(done).toMatchObject({ phase: 'done', text: 'הפקודה נשלחה אל דלת הכניסה' });
    expect(seen).toEqual(['done']);
    expect(m.doorOpens).toEqual([{ notification_id: N(2), door_id: 'st-main', origin: `notification:${N(2)}`, by: 'u-uri' }]);
  });

  test('with the mock: no permission -> 403 forbidden and no release; a step-up scenario asks first and releases only after it', async () => {
    const m = resetNotifyMock({ viewer: 'operator' });
    expect(await code(m.openDoor(N(2), 'st-main'))).toBe('forbidden');
    const forced = await runDoorOpen(m, { phase: 'sending', notification_id: N(2), door: { id: 'st-main', name: 'דלת הכניסה' }, error: null, text: null });
    expect(forced).toMatchObject({ phase: 'failed', error: 'forbidden' });
    expect(m.doorOpens).toEqual([]);
    expect(await code(m.openDoor(N(2), 'other-door'))).toBe('notification_not_found');
    const m2 = resetNotifyMock({ viewer: 'door', stepUp: true });
    const row = await rowOf(2);
    let s = reduceDoorOpen(reduceDoorOpen(DOOR_OPEN_IDLE, { type: 'press', notification: row }), { type: 'confirm' });
    s = await runDoorOpen(m2, s);
    expect(s.phase).toBe('step_up');
    expect(m2.doorOpens).toEqual([]);
    m2.completeStepUp();
    s = await runDoorOpen(m2, reduceDoorOpen(s, { type: 'step_up_done' }));
    expect(s.phase).toBe('done');
    expect(m2.doorOpens).toHaveLength(1);
  });
});

test.describe('notifications client: the source and channel matrix, validation', () => {
  test('channel cells: the centre is fixed on, Companion / WhatsApp are fixed off and "soon", mail says "unconfigured" until configured', () => {
    const p = defaultPolicies().find((x) => x.source === 'sensor.leak')!;
    const s = DEFAULT_SETTINGS();
    expect(channelCell(p, 'inbox')).toEqual({ on: true, editable: false, note: 'always' });
    expect(channelCell(p, 'webpush')).toEqual({ on: true, editable: true, note: null });
    expect(channelCell(p, 'email', s)).toEqual({ on: false, editable: true, note: 'unconfigured' });
    expect(channelCell(p, 'email', { email: { ...s.email, configured: true } }).note).toBeNull();
    expect(channelCell(p, 'ha_mobile')).toEqual({ on: false, editable: false, note: 'soon' });
    expect(channelCell(p, 'whatsapp')).toEqual({ on: false, editable: false, note: 'soon' });
    expect(withChannel(p, 'email', true).channels.email).toBe(true);
    expect(p.channels.email).toBe(false); // pure
    expect(withChannel(p, 'inbox', false)).toBe(p);
    expect(withChannel(p, 'whatsapp', false)).toBe(p);
    expect(() => withChannel(p, 'ha_mobile', true)).toThrow(ApiError);
    try { withChannel(p, 'whatsapp', true); } catch (e) { expect(errorCode(e)).toBe('channel_reserved'); expect((e as ApiError).status).toBe(422); }
    expect(validatePolicy({ channels: { ...p.channels } })).toBeNull();
    expect(validatePolicy({ channels: { ...p.channels, ha_mobile: true } as never })).toBe('channel_reserved');
    expect(validatePolicy({ channels: { ...p.channels, whatsapp: true } as never })).toBe('channel_reserved');
    expect(channelStatus('inbox', s, 0)).toEqual({ state: 'always', text: 'פעיל תמיד' });
    expect(channelStatus('webpush', s, 3)).toEqual({ state: 'on', text: '3 מכשירים רשומים' });
    expect(channelStatus('webpush', s, 0).state).toBe('off');
    expect(channelStatus('email', s, 0)).toEqual({ state: 'unconfigured', text: 'לא מוגדר' });
    expect(channelStatus('email', { email: { ...s.email, configured: true, recipients: ['a@b.co'] } }, 0).text).toBe('1 נמענים');
    expect(channelStatus('whatsapp', s, 0)).toEqual({ state: 'soon', text: 'בקרוב' });
    expect(recipientsText({ rule: 'scope' })).toBe('כל מי שרואה');
    expect(recipientsText({ rule: 'users', user_ids: ['a', 'b'] })).toBe('משתמשים נבחרים (2)');
  });

  test('settings validation: quiet_invalid and escalation_invalid', () => {
    const s = DEFAULT_SETTINGS();
    expect(validateSettings(s)).toBeNull();
    expect(validateSettings({ ...s, quiet: { ...s.quiet, from: '22:00', to: '22:00' } })).toBe('quiet_invalid');
    expect(validateSettings({ ...s, quiet: { ...s.quiet, enabled: false, from: '22:00', to: '22:00' } })).toBeNull();
    expect(validateSettings({ ...s, quiet: { ...s.quiet, to: '7am' } })).toBe('quiet_invalid');
    for (const bad of [{ after_min: 0 }, { after_min: 61 }, { after_min: 2.5 }, { steps: 0 }, { steps: 4 }, { to: [] as string[] }]) expect(validateSettings({ ...s, escalation: { ...s.escalation, ...bad } }), JSON.stringify(bad)).toBe('escalation_invalid');
    for (const ok of [{ after_min: 1 }, { after_min: 60 }, { steps: 1 }, { steps: 3 }, { to: ['u1'] }]) expect(validateSettings({ ...s, escalation: { ...s.escalation, ...ok } }), JSON.stringify(ok)).toBeNull();
  });

  test('mail validation: host, port, security, addresses; recipients parsing; masking; the test line', () => {
    const good: EmailBody = { host: 'mail.example.net', port: 587, security: 'starttls', user: 'arx', from: 'Arx <arx@example.net>', recipients: ['owner@example.net'] };
    expect(validateEmailBody(good)).toBeNull();
    expect(validateEmailBody({ ...good, host: '' })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, host: 'bad host' })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, host: '203.0.113.5' })).toBeNull();
    expect(validateEmailBody({ ...good, port: 0 })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, port: 65536 })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, port: 25.5 })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, security: 'ssl' as never })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, from: 'nobody' })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, recipients: [] })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, recipients: ['ok@example.net', 'broken@'] })).toBe('email_invalid');
    expect(validateEmailBody({ ...good, password: 'secret' })).toBeNull();
    expect(isValidAddress('a@b.co')).toBe(true);
    expect(isValidAddress('Arx <a@b.co>')).toBe(true);
    expect(isValidAddress('a b@c.co')).toBe(false);
    expect(parseRecipients('a@b.co, c@d.co;\n a@b.co  e@f.co')).toEqual(['a@b.co', 'c@d.co', 'e@f.co']);
    expect(parseRecipients('')).toEqual([]);
    expect(maskAddress('owner@example.net')).toBe('o***@example.net');
    expect(emailTestText({ ok: true, detail: 'ok' })).toBe('נשלח מייל בדיקה');
    expect(emailTestText({ ok: false, detail: 'connect' })).toBe('החיבור נדחה (connect)');
    for (const d of ['dns', 'connect', 'tls', 'auth', 'refused', 'timeout']) expect(emailTestText({ ok: false, detail: d }), d).toMatch(/[א-ת]/);
  });
});

test.describe('notifications client: scope-aware visibility', () => {
  test('the subject table of CR §7 and the acknowledge permissions of §8.2', () => {
    const subj = (kind: Notification['subject']['kind'], area: string | null = 'kitchen') => ({ subject: { kind, id: 'x', area_id: area }, source: 'x', category: 'alerts' as const });
    expect(VISIBILITY_PERMISSION).toEqual({
      camera: 'events.read', entity: 'devices.read', area: 'devices.read', alarm_panel: 'alarm.view', door: 'access.read', schedule: 'schedule.view', automation: 'schedule.view',
      bulk_job: null, system: 'system.configure', session: null,
    });
    const v = viewerWith({ 'events.read': ['parking'], 'devices.read': ['kitchen'], 'alarm.view': '*' });
    expect(canSeeNotification(subj('camera', 'parking'), v)).toBe(true);
    expect(canSeeNotification(subj('camera', 'kitchen'), v)).toBe(false); // outside the camera scope
    expect(canSeeNotification(subj('entity', 'kitchen'), v)).toBe(true);
    expect(canSeeNotification(subj('entity', 'bedroom'), v)).toBe(false);
    expect(canSeeNotification(subj('alarm_panel', 'ground'), v)).toBe(true);
    expect(canSeeNotification(subj('door', 'entrance'), v)).toBe(false);
    expect(canSeeNotification(subj('system', null), v)).toBe(false);
    expect(canSeeNotification(subj('system', null), viewerWith({ 'system.configure': '*' }))).toBe(true);
    expect(canSeeNotification(subj('bulk_job', null), viewerWith({}))).toBe(true); // owner kinds: the server only returns the caller's own
    expect(canSeeNotification(subj('session', null), viewerWith({}))).toBe(true);
    expect(filterVisible([mk({ id: 'p' }), mk({ id: 'k', subject: { kind: 'camera', id: 'c', area_id: 'kitchen' } })], v).map((n) => n.id)).toEqual(['p']);
    expect(ackPermission(subj('camera'))).toBe('events.ack');
    expect(ackPermission({ ...subj('entity'), category: 'safety' })).toBe('alarm.view');
    expect(ackPermission(subj('alarm_panel'))).toBe('alarm.view');
    expect(ackPermission({ ...subj('entity'), source: 'rule.alert' })).toBe('events.ack');
    expect(ackPermission(subj('bulk_job'))).toBeNull();
    expect(ackPermission(subj('session'))).toBeNull();
    expect(ackPermission(subj('system', null))).toBe('system.configure');
    expect(canAckFor({ ...subj('camera', 'parking'), state: 'open' }, viewerWith({ 'events.ack': ['parking'] }))).toBe(true);
    expect(canAckFor({ ...subj('camera', 'parking'), state: 'open' }, viewerWith({ 'events.read': ['parking'] }))).toBe(false);
    expect(canAckFor({ ...subj('bulk_job', null), state: 'open' }, viewerWith({}))).toBe(true);
    expect(canAckFor({ ...subj('camera', 'parking'), state: 'acknowledged' }, viewerWith({ 'events.ack': '*' }))).toBe(false);
  });

  test('the mock enforces it: an operator sees only their scope, a manager-only row never reaches them, can_ack follows the permission', async () => {
    const m = resetNotifyMock({ viewer: 'admin' });
    const all = (await m.list({ limit: 100 })).notifications;
    expect(all).toHaveLength(24);
    expect(all.every((n) => ['info', 'alert', 'critical'].includes(n.severity))).toBe(true);
    m.setViewer('operator');
    const own = (await m.list({ limit: 100 })).notifications;
    expect(own.map((n) => n.id).sort()).toEqual([1, 2, 4, 5, 6, 12, 16, 17, 20].map(N).sort());
    expect(own.find((n) => n.id === N(1))?.can_ack).toBe(false); // a safety row: needs alarm.view
    expect(own.find((n) => n.id === N(4))?.can_ack).toBe(true); // a camera row in scope: events.ack
    expect(await code(m.ack(N(1)))).toBe('ack_not_allowed');
    expect(await code(m.ack(N(3)))).toBe('notification_not_found'); // an alarm row the operator may not see at all
    expect(await code(m.read(N(7)))).toBe('notification_not_found');
    expect(await code(m.snooze(N(8), 60))).toBe('notification_not_found'); // a bedroom sensor outside the scope
    expect((await m.summary())).toEqual({ unread: 2, open_critical: 1, by_category: { safety: 1, doors: 1 } });
    m.setViewer('admin');
    expect((await m.summary())).toEqual({ unread: 2, open_critical: 1, by_category: { safety: 1, doors: 1 } });
    expect(await code(m.settings())).toBeNull();
    m.setViewer('operator');
    for (const f of [() => m.settings(), () => m.policies(), () => m.adminDeliveries(), () => m.stats(), () => m.testEmail(), () => m.saveEmail({ host: 'a.b', port: 25, security: 'none', user: '', from: 'a@b.co', recipients: ['a@b.co'] })]) expect(await code(f())).toBe('forbidden');
    expect(await code(m.saveSettings(settingsBody(DEFAULT_SETTINGS()), 1))).toBe('forbidden');
    expect(await code(m.savePolicy('sensor.leak', policyBody(defaultPolicies()[0]), 1))).toBe('forbidden');
  });
});

test.describe('notifications mock: the fixture', () => {
  test('every v1 source has a sample (but the rules-only / off-by-default ones), at each severity, in the states the screens need', async () => {
    const m = resetNotifyMock();
    const rows = (await m.list({ limit: 100 })).notifications;
    const sources = new Set(rows.map((n) => n.source));
    for (const s of SOURCE_CATALOG.filter((x) => !x.rulesOnly && x.key !== 'alarm.state')) expect(sources.has(s.key), s.key).toBe(true);
    expect(new Set(rows.map((n) => n.severity))).toEqual(new Set(['info', 'alert', 'critical']));
    expect(new Set(rows.map((n) => n.state))).toEqual(new Set(['open', 'acknowledged', 'resolved']));
    expect(new Set(rows.map((n) => n.category)).size).toBe(7);
    expect(rows.every((n) => n.title.length <= 80 && n.body.length <= 180 && n.link.startsWith('#/'))).toBe(true);
    for (const n of rows) expect(JSON.stringify(n)).not.toMatch(/https?:|\.jpe?g/i); // never an image URL
    const pending = await rowOf(1); // the leak: critical, open, one escalation done, one pending
    expect(pending).toMatchObject({ severity: 'critical', state: 'open', category: 'safety', has_snapshot: false });
    expect(pending.timeline.map((e) => e.kind)).toEqual(['created', 'escalated']);
    expect(await rowOf(3)).toMatchObject({ state: 'acknowledged', acked_by_display: 'דנה', severity: 'critical' });
    expect(await rowOf(2)).toMatchObject({ door: { id: 'st-main', name: 'דלת הכניסה', can_open: true }, source: 'door.ring', category: 'doors' });
    expect(await rowOf(4)).toMatchObject({ count: 5, first_at: isoAt(0, 11, 20), last_at: isoAt(0, 13, 30) });
    expect((await rowOf(4)).my_deliveries[0]).toMatchObject({ status: 'skipped', reason: 'quiet_hours' });
    expect((await rowOf(10)).my_deliveries[0]).toMatchObject({ status: 'failed', reason: 'http_410' });
    expect(deliveryLine(await rowOf(10), TZ)?.text).toBe('המסירה לטלפון נכשלה · 08:12');
    expect((await rowOf(5)).has_snapshot).toBe(true);
    expect((await rowOf(8)).me.snoozed_until).toBe(isoAt(0, 15, 10));
    expect((await rowOf(1)).me.read_at).toBeNull();
    expect(rows.filter((n) => n.door).map((n) => n.id)).toEqual([N(2)]);
    expect(rows.filter((n) => n.state === 'resolved').every((n) => n.resolved_at)).toBe(true);
  });

  test('the scenarios: quiet hours active, push unsupported, mail not configured, mail test ok / fail / slow, defaults', async () => {
    expect(isQuietNow(resetNotifyMock().settingsRow.quiet, MOCK_NOW, TZ)).toBe(false);
    const q = resetNotifyMock({ quietNow: true });
    expect(quietBannerText(q.settingsRow, q.clock, TZ)).toBe('שעות שקט עד 16:00 · נשלח רק קריטי');
    expect(q.wouldSend('alert', 'webpush')).toBe(false);
    expect(q.wouldSend('critical', 'webpush')).toBe(true);
    expect(q.wouldSend('alert', 'webpush', true)).toBe(true);
    const p = resetNotifyMock({ push: 'unsupported', registered: 0 });
    expect(pushBannerText(p.pushSupport, p.registered)).toBe('התראות דחיפה לא נתמכות במכשיר הזה');
    expect(await p.test()).toEqual({ sent: 0 });
    expect((await resetNotifyMock({ registered: 2 }).test())).toEqual({ sent: 2 });
    const u = resetNotifyMock({ emailConfigured: false });
    expect((await u.settings()).email).toMatchObject({ configured: false, password_set: false });
    expect(await code(u.testEmail())).toBe('channel_unavailable');
    const ok = resetNotifyMock();
    expect((await ok.settings()).email).toMatchObject({ configured: true, password_set: true, recipients: ['owner@example.net', 'it@example.net'], last_test: { ok: true } });
    expect(JSON.stringify(await ok.settings())).not.toMatch(/"password":/);
    expect(await ok.testEmail()).toEqual({ ok: true, detail: 'ok' });
    expect((await ok.settings()).email.last_test).toMatchObject({ ok: true, detail: 'ok', at: new Date(MOCK_NOW).toISOString() });
    const bad = resetNotifyMock({ emailHost: 'bad.example.net' });
    expect(await bad.testEmail()).toEqual({ ok: false, detail: 'connect' });
    expect(emailTestText(await bad.testEmail())).toBe('החיבור נדחה (connect)');
    expect((await bad.settings()).email.last_test?.ok).toBe(false);
    expect(await resetNotifyMock({ emailHost: 'slow.example.net' }).testEmail()).toEqual({ ok: false, detail: 'timeout' });
    const s = await resetNotifyMock().settings();
    expect(s).toMatchObject({ retention_days: 30, lockscreen: 'type_place', revision: 1, escalation: { after_min: 5, steps: 2 } });
    expect((await resetNotifyMock().policies())).toHaveLength(28);
  });
});

test.describe('notifications mock: the API behaviour', () => {
  test('list: state / category / severity filters, paging, newest first', async () => {
    const m = resetNotifyMock();
    const open = (await m.list({ state: 'open', limit: 100 })).notifications;
    expect(open.every((n) => n.state === 'open')).toBe(true);
    expect((await m.list({ category: 'security', limit: 100 })).notifications).toHaveLength(2);
    const crit = (await m.list({ severity_min: 'critical', limit: 100 })).notifications;
    expect(crit.every((n) => n.severity === 'critical')).toBe(true);
    expect(crit).toHaveLength(7);
    const p1 = await m.list({ limit: 10 });
    expect(p1.notifications).toHaveLength(10);
    expect(p1.next_before).toBe(p1.notifications[9].last_at);
    const p2 = await m.list({ limit: 10, before: p1.next_before as string });
    expect(p2.notifications.every((n) => Date.parse(n.last_at) < Date.parse(p1.next_before as string))).toBe(true);
    const p3 = await m.list({ limit: 10, before: p2.next_before as string });
    expect(p1.notifications.length + p2.notifications.length + p3.notifications.length).toBe(24);
    expect(p3.next_before).toBeNull();
    const times = p1.notifications.map((n) => Date.parse(n.last_at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  test('read, read-all, snooze (an hour, until morning), acknowledge (the shared state), per-user state is separate', async () => {
    const m = resetNotifyMock();
    expect((await m.summary()).unread).toBe(2);
    expect((await m.read(N(1)))?.me.read_at).toBe(new Date(MOCK_NOW).toISOString());
    expect((await m.summary()).unread).toBe(1);
    expect((await m.snooze(N(2), 60))?.me.snoozed_until).toBe(new Date(MOCK_NOW + 3_600_000).toISOString());
    expect(await m.summary()).toMatchObject({ unread: 0 }); // snoozed: hidden from the count
    expect((await m.snooze(N(2), 'until_morning'))?.me.snoozed_until).toBe(snoozeUntil('until_morning', MOCK_NOW, { to: '07:00' }, TZ));
    m.advance(2 * 3_600_000); // an hour and more later the first snooze would be over; the second one runs until the morning
    expect((await m.summary()).unread).toBe(0);
    expect((await m.snooze(N(6), 60))?.me.snoozed_until).toBeNull(); // a resolved row: nothing to snooze
    // acknowledge as the manager: shared state, audited by display name, also marks read, stops the escalation line
    const acked = await m.ack(N(1));
    expect(acked).toMatchObject({ state: 'acknowledged', acked_by_display: 'יוני', can_ack: false });
    expect(acked?.timeline.at(-1)).toMatchObject({ kind: 'acknowledged', by_display: 'יוני' });
    expect(escalationTimeline(acked as Notification, m.settingsRow.escalation, m.clock, TZ).some((l) => l.pending)).toBe(false);
    expect((await m.ack(N(1)))?.acked_at).toBe(acked?.acked_at); // idempotent
    expect((await m.ack(N(6)))?.state).toBe('resolved');
    m.setViewer('operator'); // the shared state reaches the other user; their own read state is theirs
    expect((await m.list({ limit: 100 })).notifications.find((n) => n.id === N(1))).toMatchObject({ state: 'acknowledged', acked_by_display: 'יוני', me: { read_at: null } });
    await m.readAll();
    expect((await m.summary()).unread).toBe(0);
    m.setViewer('admin');
    expect((await m.summary()).unread).toBe(0); // admin read both before
    const fresh = resetNotifyMock();
    await fresh.readAll();
    expect((await fresh.summary()).unread).toBe(0);
    expect(await code(fresh.read('nope'))).toBe('notification_not_found');
    expect(await code(fresh.ack('nope'))).toBe('notification_not_found');
  });

  test('the mock agrees with the pure helpers (one set of rules for the optimistic update and the server)', async () => {
    const m = resetNotifyMock();
    const before = await rowOf(1);
    const optimistic = applyAck(before, 'יוני', m.clock);
    const server = (await m.ack(N(1))) as Notification;
    expect(server).toMatchObject({ state: optimistic.state, acked_at: optimistic.acked_at, acked_by_display: optimistic.acked_by_display, me: optimistic.me });
    expect(server.timeline).toEqual(optimistic.timeline);
    const m2 = resetNotifyMock();
    const s = (await m2.snooze(N(4), 'until_morning')) as Notification;
    expect(s.me.snoozed_until).toBe(applySnooze(await rowOf(4), snoozeUntil('until_morning', m2.clock, m2.settingsRow.quiet, TZ)).me.snoozed_until);
    expect(await m2.summary()).toEqual(summarize(m2.visibleRows(), m2.clock));
  });

  test('snapshot: only for a row that has one and the caller may see; never part of a row', async () => {
    const m = resetNotifyMock();
    expect(m.snapshotUrl(N(5))).toMatch(/^data:image\/svg\+xml/);
    expect(m.snapshotUrl(N(1))).toBeNull();
    expect(m.snapshotUrl('nope')).toBeNull();
    m.setViewer('operator');
    expect(m.snapshotUrl(N(5))).toMatch(/^data:image/); // backyard camera in scope
    const cut = resetNotifyMock({ viewer: 'operator' });
    cut.rows[4].core.subject.area_id = 'bedroom'; // the scope is revoked: the row and its image are gone
    expect(cut.snapshotUrl(N(5))).toBeNull();
    expect(await code(cut.read(N(5)))).toBe('notification_not_found');
  });

  test('deliveries: own rows, with the failure reasons and masked targets; the administrator sees everyone, filtered', async () => {
    const m = resetNotifyMock();
    const own = await m.deliveries(N(1));
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ notification_id: N(1), channel: 'webpush', status: 'sent', user_display: 'יוני' });
    expect((await m.deliveries()).length).toBeGreaterThan(8);
    const all = await m.adminDeliveries();
    expect(all.map((d) => d.at)).toEqual([...all.map((d) => d.at)].sort().reverse());
    expect(JSON.stringify(all)).not.toMatch(/https?:|@example\.net(?<!\*\*\*@example\.net)/); // no endpoint, no full address
    expect(all.find((d) => d.channel === 'email')?.target).toBe('o***@example.net');
    const failed = await m.adminDeliveries({ status: 'failed' });
    expect(failed.every((d) => d.status === 'failed')).toBe(true);
    expect(failed.map((d) => d.reason).sort()).toEqual(['http_410', 'http_410', 'timeout']);
    expect((await m.adminDeliveries({ channel: 'email' })).every((d) => d.channel === 'email')).toBe(true);
    expect((await m.adminDeliveries({ since: isoAt(0, 13) })).every((d) => Date.parse(d.at) >= at(0, 13))).toBe(true);
    expect(await m.adminDeliveries({ limit: 2 })).toHaveLength(2);
    const st = await m.stats();
    expect(st.channels.webpush).toMatchObject({ failed: 2, skipped: { quiet_hours: 2, category_off: 1 } });
    expect(st.channels.email?.sent).toBe(1);
    expect(deliveryReasonText('category_off')).toBe('ערוץ כבוי למקור');
  });

  test('action tokens: single use, expiry, the right user, only ack and snooze', async () => {
    const m = resetNotifyMock({ viewer: 'operator' });
    const t = m.issueActionToken(N(4));
    await m.action(t, 'ack');
    expect((await rowOf(4)).state).toBe('acknowledged');
    expect(await code(m.action(t, 'ack'))).toBe('action_token_invalid'); // used
    expect(await code(m.action('garbage', 'ack'))).toBe('action_token_invalid');
    const t2 = m.issueActionToken(N(2), ['snooze']);
    expect(await code(m.action(t2, 'ack'))).toBe('action_token_invalid'); // not authorised for ack
    await m.action(t2, 'snooze');
    expect((await rowOf(2)).me.snoozed_until).not.toBeNull();
    const t3 = m.issueActionToken(N(5));
    m.advance(3_600_001);
    expect(await code(m.action(t3, 'snooze'))).toBe('action_token_invalid'); // expired with the push TTL
    // the token acts as its own user even when the session is someone else's
    const t4 = m.issueActionToken(N(6));
    m.setViewer('admin');
    await m.action(t4, 'snooze');
    expect(m.viewerId).toBe('admin');
  });

  test('settings: revision conflicts, validation errors, saved values; policies: reserved channels refused, revisions; mail: invalid refused, password write-only, rate limit', async () => {
    const m = resetNotifyMock();
    const s = await m.settings();
    const body = settingsBody(s);
    expect(await code(m.saveSettings({ ...body, quiet: { ...body.quiet, to: '22:00' } }, 1))).toBe('quiet_invalid');
    expect(await code(m.saveSettings({ ...body, escalation: { ...body.escalation, steps: 9 } }, 1))).toBe('escalation_invalid');
    const saved = await m.saveSettings({ ...body, retention_days: 60, lockscreen: 'generic', escalation: { enabled: true, after_min: 10, steps: 3, to: ['u-yoni'] } }, 1);
    expect(saved).toMatchObject({ revision: 2, retention_days: 60, lockscreen: 'generic', escalation: { after_min: 10, steps: 3, to: ['u-yoni'] }, updated_at: new Date(MOCK_NOW).toISOString() });
    expect(await code(m.saveSettings(body, 1))).toBe('settings_conflict'); // a stale revision
    expect((await m.settings()).email).toEqual(s.email); // the other sections are untouched
    const ps = await m.policies();
    const leak = ps.find((p) => p.source === 'sensor.leak')!;
    const pb = policyBody(leak);
    expect(await code(m.savePolicy('sensor.leak', { ...pb, channels: { ...pb.channels, ha_mobile: true } as never }, 1))).toBe('channel_reserved');
    expect(await code(m.savePolicy('sensor.leak', { ...pb, channels: { ...pb.channels, whatsapp: true } as never }, 1))).toBe('channel_reserved');
    expect(await code(m.savePolicy('sensor.leak', pb, 7))).toBe('settings_conflict');
    expect(await code(m.savePolicy('no.such', pb, 1))).toBe('not_found');
    const p2 = await m.savePolicy('sensor.leak', { ...pb, severity: 'alert', channels: { ...pb.channels, email: true }, recipients: { rule: 'managers' } }, 1);
    expect(p2).toMatchObject({ revision: 2, severity: 'alert', recipients: { rule: 'managers' }, channels: { inbox: true, email: true, ha_mobile: false, whatsapp: false } });
    // mail
    const mail: EmailBody = { host: 'smtp.example.net', port: 465, security: 'tls', user: 'arx', from: 'arx@example.net', recipients: ['a@example.net'] };
    expect(await code(m.saveEmail({ ...mail, port: 0 }))).toBe('email_invalid');
    expect(await code(m.saveEmail({ ...mail, recipients: [] }))).toBe('email_invalid');
    const e1 = await m.saveEmail({ ...mail, password: 'hunter2' });
    expect(e1).toMatchObject({ configured: true, host: 'smtp.example.net', port: 465, security: 'tls', password_set: true });
    expect(JSON.stringify(e1)).not.toContain('hunter2');
    expect(JSON.stringify(await m.settings())).not.toContain('hunter2');
    expect((await m.saveEmail(mail)).password_set).toBe(true); // omitted password = unchanged
    const un = resetNotifyMock({ emailConfigured: false });
    expect((await un.saveEmail(mail)).password_set).toBe(false);
    expect((await un.saveEmail({ ...mail, password: 'x' })).password_set).toBe(true);
    // 3 tests a minute, then rate_limited with the wait
    const r = resetNotifyMock();
    for (let i = 0; i < 3; i++) await r.testEmail();
    let err: unknown = null;
    try { await r.testEmail(); } catch (e) { err = e; }
    expect(errorCode(err)).toBe('rate_limited');
    expect((err as ApiError).status).toBe(429);
    expect(retryAfterS(err)).toBe(60);
    expect(notifyErrorText(err)).toBe('יותר מדי נסיונות; נסו שוב בעוד 60 שניות');
    r.advance(61_000);
    expect(await code(r.testEmail())).toBeNull();
    const t = resetNotifyMock();
    for (let i = 0; i < 3; i++) await t.test();
    expect(await code(t.test())).toBe('rate_limited');
  });

  test('emit (the mock server side): fold inside the window, a rise re-notifies, resolve, disabled sources, audience, policy dedupe window', async () => {
    const m = resetNotifyMock();
    const sig = { source: 'camera.offline', subject_kind: 'camera' as const, subject_id: 'cam-new', area_id: 'parking', title: 'מצלמה לא זמינה', body: 'המצלמה לא עונה.' };
    const id = m.emit(sig) as string;
    expect(id).toMatch(/^ntf-/);
    expect(m.emit(sig)).toBe(id); // folded: no new row
    m.advance(60_000);
    expect(m.emit(sig)).toBe(id);
    const row = (await m.list({ limit: 100 })).notifications.find((n) => n.id === id) as Notification;
    expect(row).toMatchObject({ count: 3, severity: 'alert', state: 'open', category: 'device_faults' });
    expect(row.timeline.map((e) => e.kind)).toEqual(['created', 'folded', 'folded']);
    await m.read(id);
    expect(m.emit({ ...sig, severity: 'critical' })).toBe(id); // a higher severity folds AND re-notifies
    const rose = (await m.list({ limit: 100 })).notifications.find((n) => n.id === id) as Notification;
    expect(rose).toMatchObject({ severity: 'critical', count: 4, me: { read_at: null } });
    expect(m.resolveSignal('camera.offline:camera:cam-new')).toBe(true);
    expect(m.resolveSignal('camera.offline:camera:cam-new')).toBe(false);
    const again = m.emit(sig) as string;
    expect(again).not.toBe(id); // a new condition after the resolve is a new row
    expect(m.emit({ source: 'camera.motion', subject_kind: 'camera', subject_id: 'c', area_id: 'parking' })).toBeNull(); // rules only: off by default
    expect(m.emit({ source: 'nope', subject_kind: 'system', subject_id: null })).toBeNull();
    // a bounded window: a repeat after the window is a new row
    const ring = { source: 'door.ring', subject_kind: 'door' as const, subject_id: 'st-2', area_id: 'entrance' };
    const r1 = m.emit(ring);
    m.advance(30_000);
    expect(m.emit(ring)).toBe(r1); // inside the 60 s window
    m.advance(61_000);
    expect(m.emit(ring)).not.toBe(r1); // 61 s after the last occurrence: a new row
    // audience: a manager-only source is invisible to an operator
    const sys = m.emit({ source: 'system.health', subject_kind: 'system', subject_id: 'x' }) as string;
    m.setViewer('operator');
    expect(await code(m.read(sys))).toBe('notification_not_found');
    m.setViewer('admin');
    expect((await m.list({ limit: 100 })).notifications.some((n) => n.id === sys)).toBe(true);
  });
});

test.describe('notifications client: the owner choices of 2026-10-01 (center layout, failures audience, both snooze choices)', () => {
  test('the setting names and values', () => {
    expect(NOTIFY_SETTING_KEYS).toEqual({ center_layout: 'notify.center_layout', failures_audience: 'notify.failures_audience' });
    expect(CENTER_LAYOUTS).toEqual(['sheet', 'page']);
    expect(FAILURES_AUDIENCES).toEqual(['admins', 'visible']);
    expect(CENTER_LAYOUT_LABEL).toEqual({ sheet: 'חלונית בצד', page: 'מסך מלא' });
    expect(FAILURE_SOURCES).toEqual(['schedule.not_confirmed', 'automation.failed']);
  });

  test('the center presentation: a phone always gets the bottom sheet, a larger screen follows the setting', () => {
    expect(centerPresentation({ center_layout: 'sheet' }, false)).toBe('sheet');
    expect(centerPresentation({ center_layout: 'page' }, false)).toBe('page');
    expect(centerPresentation({ center_layout: 'page' }, true)).toBe('bottom_sheet');
    expect(centerPresentation({ center_layout: 'sheet' }, true)).toBe('bottom_sheet');
  });

  test('the failures audience decides the recipients of schedule / automation failures only', () => {
    const ps = defaultPolicies();
    const p = (k: string) => ps.find((x) => x.source === k)!;
    expect(recipientsRuleFor(p('schedule.not_confirmed'), { failures_audience: 'admins' })).toBe('managers');
    expect(recipientsRuleFor(p('schedule.not_confirmed'), { failures_audience: 'visible' })).toBe('scope');
    expect(recipientsRuleFor(p('automation.failed'), { failures_audience: 'visible' })).toBe('scope');
    expect(recipientsRuleFor(p('automation.notify'), { failures_audience: 'admins' })).toBe('scope'); // not a failure source: its own rule
    expect(recipientsRuleFor(p('backup.failed'), { failures_audience: 'visible' })).toBe('managers');
    expect(recipientsRuleFor(p('bulk.partial'), { failures_audience: 'visible' })).toBe('initiator');
  });

  test('snooze offers both choices on an open, unsnoozed row', () => {
    const now = MOCK_NOW;
    expect(snoozeOptions(mk(), now)).toEqual([{ choice: 60, label: 'השתק לשעה' }, { choice: 'until_morning', label: 'עד הבוקר' }]);
    expect(snoozeOptions(mk({ state: 'acknowledged' }), now)).toEqual([]);
    expect(snoozeOptions(mk({ state: 'resolved' }), now)).toEqual([]);
    expect(snoozeOptions(mk({ me: { read_at: null, snoozed_until: new Date(now + 1000).toISOString() } }), now)).toEqual([]);
  });

  test('the mock: defaults, saving both settings, a bad value refused, and the audience of failures follows the setting for the users who may see the schedule', async () => {
    const m = resetNotifyMock({ viewer: 'planner' });
    const failures = [N(9), N(13)]; // a schedule that was not confirmed, an automation that failed
    const ids = async () => (await m.list({ limit: 100 })).notifications.map((n) => n.id);
    expect((await ids()).filter((i) => failures.includes(i))).toEqual([]); // default: administrators only
    m.setViewer('admin');
    expect(await m.settings()).toMatchObject({ center_layout: 'sheet', failures_audience: 'admins', revision: 1 });
    const saved = await m.saveSettings({ ...settingsBody(await m.settings()), center_layout: 'page', failures_audience: 'visible' }, 1);
    expect(saved).toMatchObject({ center_layout: 'page', failures_audience: 'visible', revision: 2 });
    expect(await code(m.saveSettings({ ...settingsBody(saved), center_layout: 'wide' as never }, 2))).toBe('validation_error');
    expect(await code(m.saveSettings({ ...settingsBody(saved), failures_audience: 'everyone' as never }, 2))).toBe('validation_error');
    m.setViewer('planner');
    expect((await ids()).filter((i) => failures.includes(i)).sort()).toEqual(failures);
    m.setViewer('operator'); // without schedule.view the subject itself stays invisible: visibility is the ceiling
    expect((await ids()).filter((i) => failures.includes(i))).toEqual([]);
    m.setViewer('admin');
    await m.saveSettings({ ...settingsBody(await m.settings()), failures_audience: 'admins' }, 2);
    m.setViewer('planner');
    expect((await ids()).filter((i) => failures.includes(i))).toEqual([]);
    expect((await ids()).length).toBe(10); // the operator's 9 rows plus the automation notice (audience: everyone who sees it); nothing manager-only
  });
});

test.describe('notifications client: selection, HTTP adapter and error mapping', () => {
  test('without a backend the adapter in force is the mock (through a dynamic import: the same state as the store)', async () => {
    const m = resetNotifyMock();
    expect(notify()).not.toBe(httpNotify);
    expect(await notify().summary()).toEqual(await m.summary());
    expect((await notify().ack(N(1)))?.state).toBe('acknowledged');
    expect((await rowOf(1)).state).toBe('acknowledged');
    expect(notify().snapshotUrl('abc')).toMatch(/^data:image/);
    expect(notifyMock()).toBe(m);
  });

  test('error labels: every code of §4 has a Hebrew line; mapNotifyError fills the code of a bare status by route kind and leaves coded errors alone', () => {
    const e = (c: string, status = 400, msg = 'server words') => new ApiError(status, { code: c, user_message: msg, retryable: false, correlation_id: 'x', details: {} });
    for (const c of ['notification_not_found', 'ack_not_allowed', 'action_token_invalid', 'settings_conflict', 'quiet_invalid', 'escalation_invalid', 'channel_reserved', 'channel_unavailable', 'email_invalid', 'rate_limited', 'forbidden']) {
      expect(notifyErrorText(e(c))).toBe(NOTIFY_ERROR_LABEL[c]);
      expect(NOTIFY_ERROR_LABEL[c]).toMatch(/[א-ת]/);
      expect(notifyError(c).status, c).toBe({ notification_not_found: 404, ack_not_allowed: 403, action_token_invalid: 401, settings_conflict: 412, quiet_invalid: 422, escalation_invalid: 422, channel_reserved: 422, channel_unavailable: 409, email_invalid: 422, rate_limited: 429, forbidden: 403 }[c]);
    }
    expect(Object.values(NOTIFY_ERROR_LABEL).join(' ')).not.toMatch(/Home Assistant|Companion|Ingress|\bHA\b/);
    expect(notifyErrorText(e('something_else', 500, 'שגיאה מהשרת'))).toBe('שגיאה מהשרת');
    expect(notifyErrorText(new Error('boom'))).toBeTruthy();
    expect(retryAfterS(e('rate_limited'))).toBeNull();
    const bare = (status: number) => e(`http_${status}`, status, 'Forbidden');
    const m = (status: number, ctx: Parameters<typeof mapNotifyError>[1]) => errorCode(mapNotifyError(bare(status), ctx));
    expect(m(412, 'settings')).toBe('settings_conflict');
    expect(m(412, 'policy')).toBe('settings_conflict');
    expect(m(412, 'item')).toBe('http_412');
    expect(m(429, 'email_test')).toBe('rate_limited');
    expect(m(429, 'user')).toBe('rate_limited');
    expect(m(403, 'settings')).toBe('forbidden');
    expect(m(403, 'ack')).toBe('ack_not_allowed');
    expect(m(403, 'item')).toBe('forbidden');
    expect(m(404, 'item')).toBe('notification_not_found');
    expect(m(404, 'ack')).toBe('notification_not_found');
    expect(m(404, 'settings')).toBe('http_404');
    expect(m(401, 'action')).toBe('action_token_invalid');
    expect(m(401, 'item')).toBe('http_401');
    expect(m(409, 'email_test')).toBe('channel_unavailable');
    expect(m(500, 'admin')).toBe('http_500');
    expect(errorCode(mapNotifyError(e('quiet_invalid', 422), 'settings'))).toBe('quiet_invalid'); // coded: untouched
    const same = e('email_invalid', 422);
    expect(mapNotifyError(same, 'email')).toBe(same);
    const t = new TypeError('fetch failed');
    expect(mapNotifyError(t, 'settings')).toBe(t);
    expect((mapNotifyError(bare(412), 'settings') as ApiError).status).toBe(412);
    expect((mapNotifyError(bare(412), 'settings') as ApiError).message).toBe(NOTIFY_ERROR_LABEL.settings_conflict);
  });

  test('the HTTP adapter: URLs, bodies, headers, tolerant envelopes, error mapping on the way out', async () => {
    const calls: { url: string; method: string; body: unknown; ifMatch: string | null }[] = [];
    let reply: () => Response = () => new Response('[]', { status: 200 });
    const g = globalThis as unknown as { fetch: unknown; document?: unknown };
    const saved = { fetch: g.fetch, document: g.document };
    g.document = { baseURI: 'http://127.0.0.1:4641/' };
    g.fetch = async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url).replace('http://127.0.0.1:4641/api/v1/', ''), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null, ifMatch: init.headers instanceof Headers ? init.headers.get('If-Match') : null });
      return reply();
    };
    const row = mk({ id: 'ntf-9' });
    const json = (v: unknown, status = 200) => () => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
    try {
      reply = json({ notifications: [row] });
      expect(await httpNotify.list({ state: 'open', category: 'safety', severity_min: 'alert', before: '2026-10-01T10:00:00Z', limit: 5 })).toEqual({ notifications: [row], next_before: null });
      reply = json([row, mk({ id: 'ntf-8', last_at: isoAt(0, 9) })]);
      expect((await httpNotify.list({ limit: 2 })).next_before).toBe(isoAt(0, 9)); // a full page: the cursor of its oldest row
      reply = json({ unread: 1, open_critical: 0, by_category: {} });
      expect(await httpNotify.summary()).toEqual({ unread: 1, open_critical: 0, by_category: {} });
      reply = json(row);
      expect(await httpNotify.read('ntf/9')).toEqual(row);
      reply = () => new Response(null, { status: 204 });
      expect(await httpNotify.snooze('ntf-9', 'until_morning')).toBeNull();
      await httpNotify.snooze('ntf-9', 60);
      await httpNotify.readAll();
      await httpNotify.ack('ntf-9');
      reply = json({ sent: 1 });
      await httpNotify.test();
      reply = json({ deliveries: [] });
      await httpNotify.deliveries('ntf-9');
      await httpNotify.adminDeliveries({ status: 'failed', channel: 'email', since: '2026-10-01T00:00:00Z', limit: 20 });
      reply = () => new Response(null, { status: 204 });
      await httpNotify.action('tok', 'ack');
      await httpNotify.openDoor('ntf-2', 'st-main');
      reply = json(DEFAULT_SETTINGS());
      await httpNotify.settings();
      await httpNotify.saveSettings(settingsBody(DEFAULT_SETTINGS()), 4);
      reply = json({ policies: defaultPolicies() });
      expect(await httpNotify.policies()).toHaveLength(28);
      reply = json(defaultPolicies()[0]);
      await httpNotify.savePolicy('sensor.leak', policyBody(defaultPolicies()[0]), 2);
      reply = json(DEFAULT_SETTINGS().email);
      await httpNotify.saveEmail({ host: 'h.example.net', port: 587, security: 'starttls', user: 'u', from: 'a@b.co', recipients: ['a@b.co'] });
      reply = json({ ok: true, detail: 'ok' });
      await httpNotify.testEmail();
      reply = json({ since: 'x', channels: {}, worker: {} });
      await httpNotify.stats();
      expect(httpNotify.snapshotUrl('ntf/9')).toBe('http://127.0.0.1:4641/api/v1/notifications/ntf%2F9/snapshot');
      expect(calls.map((c) => `${c.method} ${decodeURIComponent(c.url)}`)).toEqual([
        'GET notifications?state=open&category=safety&severity_min=alert&before=2026-10-01T10:00:00Z&limit=5',
        'GET notifications?limit=2',
        'GET notifications/summary',
        'POST notifications/ntf/9/read',
        'POST notifications/ntf-9/snooze',
        'POST notifications/ntf-9/snooze',
        'POST notifications/read-all',
        'POST notifications/ntf-9/ack',
        'POST notifications/test',
        'GET notifications/deliveries?notification_id=ntf-9',
        'GET notify/deliveries?status=failed&channel=email&since=2026-10-01T00:00:00Z&limit=20',
        'POST notifications/action',
        'POST intercom/stations/st-main/release',
        'GET notify/settings',
        'PUT notify/settings',
        'GET notify/policies',
        'PUT notify/policies/sensor.leak',
        'PUT notify/email',
        'POST notify/email/test',
        'GET notify/stats',
      ]);
      expect(calls[1].url).toBe('notifications?limit=2');
      expect(calls[4].body).toEqual({ minutes: 'until_morning' });
      expect(calls[5].body).toEqual({ minutes: 60 });
      expect(calls[11].body).toEqual({ t: 'tok', a: 'ack' });
      // the door release goes through the existing route, confirmed, with the notification as its origin
      expect(calls[12].body).toMatchObject({ confirmed: true, origin: 'notification:ntf-2' });
      expect((calls[12].body as { client_request_id: string }).client_request_id).toMatch(/^[0-9a-f-]{16,}$/);
      expect(calls[12].body).toHaveProperty('expires_at');
      // revisions travel twice: If-Match (the contract) and base_revision (the rest of the API)
      expect(calls[14]).toMatchObject({ ifMatch: '4', body: { ...settingsBody(DEFAULT_SETTINGS()), base_revision: 4 } });
      expect(calls[16]).toMatchObject({ ifMatch: '2', body: { base_revision: 2, enabled: true } });
      expect(calls[17].body).toMatchObject({ host: 'h.example.net', port: 587 });
      // error mapping on the way out: a bare 412 / 403 / 429 gets the contract's code, a coded error keeps its own
      const fail = (status: number, body?: unknown) => () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      reply = fail(412);
      expect(await code(httpNotify.saveSettings(settingsBody(DEFAULT_SETTINGS()), 1))).toBe('settings_conflict');
      reply = fail(403);
      expect(await code(httpNotify.settings())).toBe('forbidden');
      expect(await code(httpNotify.ack('ntf-1'))).toBe('ack_not_allowed');
      reply = fail(404);
      expect(await code(httpNotify.read('nope'))).toBe('notification_not_found');
      reply = fail(401);
      expect(await code(httpNotify.action('t', 'snooze'))).toBe('action_token_invalid');
      reply = fail(429, { code: 'rate_limited', user_message: 'x', retryable: true, correlation_id: '', details: { retry_after_s: 12 } });
      let err: unknown = null;
      try { await httpNotify.testEmail(); } catch (e2) { err = e2; }
      expect(retryAfterS(err)).toBe(12);
      reply = fail(422, { code: 'channel_reserved', user_message: 'x', retryable: false, correlation_id: '', details: {} });
      expect(await code(httpNotify.savePolicy('sensor.leak', policyBody(defaultPolicies()[0]), 1))).toBe('channel_reserved');
      reply = fail(409);
      expect(await code(httpNotify.testEmail())).toBe('channel_unavailable');
    } finally {
      g.fetch = saved.fetch;
      g.document = saved.document;
    }
  });
});
