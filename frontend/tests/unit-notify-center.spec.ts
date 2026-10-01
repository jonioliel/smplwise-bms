import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS, SOURCE_CATALOG, defaultPolicies, type Notification } from '../src/api/notifications';
import { MOCK_AREAS, MOCK_NOW, MOCK_TZ, mockAt, mockId, resetNotifyMock } from '../src/api/notifications-mock';
import {
  applyLiveEvent, MAIL_TEST_DETAIL, MAX_MAIL_RECIPIENTS, badgeLabel, badgeOf, categoryIcon, detailDelivery, enabledCount, escalationLines, failedCount, failurePanel, filterCounts, iconOf, isValidLinkBase, lockPreview, logRows, mailFormError, mailResultText, matrixGroups, openLabel, placeText, policyWithChannel,
  policyWithRule, policyWithSeverity, replaceRow, rowTag, sourceOptions, stepAfterMin, subtitleText, toggleDay, togglePass, visibleRows, whereText,
} from '../src/components/notify-logic';

// CR-018 S3: the pure logic of the notification center and the Settings tab (src/components/notify-logic.ts) and the service worker's notification rules, read as source
// (the worker is a classic script that cannot be imported). No browser page.

const here = path.dirname(fileURLToPath(import.meta.url));
const iso = (day: number, h: number, m = 0) => new Date(mockAt(day, h, m)).toISOString();
function mk(over: Partial<Notification> = {}): Notification {
  return {
    id: 'n-x', source: 'camera.offline', category: 'device_faults', severity: 'alert', title: 'מצלמה לא זמינה', body: 'x', subject: { kind: 'camera', id: 'cam-1', area_id: 'parking' }, link: '#/live/cameras/cam-1',
    count: 1, first_at: iso(0, 13, 30), last_at: iso(0, 13, 30), state: 'open', acked_at: null, acked_by_display: null, resolved_at: null, me: { read_at: iso(0, 13, 31), snoozed_until: null },
    can_ack: true, has_snapshot: false, door: null, timeline: [], my_deliveries: [], ...over,
  };
}
const NOW = MOCK_NOW;

test.describe('rows: place, icon, the one state tag', () => {
  test('place: the area, else what the subject is', () => {
    expect(placeText(mk(), MOCK_AREAS)).toBe('חניה');
    expect(placeText(mk({ subject: { kind: 'system', id: 's', area_id: null }, category: 'system' }), MOCK_AREAS)).toBe('מערכת');
    expect(placeText(mk({ subject: { kind: 'session', id: 's', area_id: null }, category: 'security' }), MOCK_AREAS)).toBe('חשבון');
    expect(placeText(mk({ subject: { kind: 'schedule', id: 's', area_id: null }, category: 'automations' }), MOCK_AREAS)).toBe('תזמונים');
    expect(placeText(mk({ subject: { kind: 'entity', id: 'e', area_id: 'unknown-area' }, category: 'safety' }), MOCK_AREAS)).toBe('בטיחות'); // an area the catalog does not know: the category, never an id
    expect(whereText(mk(), MOCK_AREAS)).toBe('מצלמה · חניה');
    expect(whereText(mk({ subject: { kind: 'door', id: 'st', area_id: 'entrance' }, door: { id: 'st', name: 'דלת הכניסה', can_open: true } }), MOCK_AREAS)).toBe('עמדת כניסה · כניסה ראשית');
    expect(whereText(mk({ subject: { kind: 'system', id: 's', area_id: null }, category: 'system' }), MOCK_AREAS)).toBe('מערכת');
    expect(openLabel(mk())).toBe('פתח את המצלמה');
    expect(iconOf(mk({ source: 'sensor.leak' }))).toBe('drop');
    expect(iconOf(mk({ source: 'something.else' }))).toBe('bell');
  });

  test('one tag: resolved > acknowledged > snoozed > failed > held; nothing for a quiet open row', () => {
    expect(rowTag(mk(), NOW, MOCK_TZ)).toBeNull();
    expect(rowTag(mk({ state: 'resolved' }), NOW, MOCK_TZ)).toMatchObject({ kind: 'res', text: 'נפתר' });
    expect(rowTag(mk({ state: 'acknowledged', acked_by_display: 'דנה' }), NOW, MOCK_TZ)).toMatchObject({ kind: 'ack', text: 'אושר · דנה' });
    expect(rowTag(mk({ state: 'acknowledged' }), NOW, MOCK_TZ)?.text).toBe('אושר');
    expect(rowTag(mk({ me: { read_at: null, snoozed_until: iso(0, 15, 10) } }), NOW, MOCK_TZ)).toMatchObject({ kind: 'snz', text: 'הושתק עד 15:10' });
    // a snooze that has ended no longer shows
    expect(rowTag(mk({ me: { read_at: null, snoozed_until: iso(0, 14, 0) } }), NOW, MOCK_TZ)).toBeNull();
    const failed = mk({ my_deliveries: [{ channel: 'webpush', status: 'failed', reason: 'http_410', at: iso(0, 13, 31) }] });
    expect(rowTag(failed, NOW, MOCK_TZ)).toMatchObject({ kind: 'fail', text: 'המסירה נכשלה' });
    const held = mk({ my_deliveries: [{ channel: 'webpush', status: 'skipped', reason: 'quiet_hours', at: iso(0, 13, 31) }] });
    expect(rowTag(held, NOW, MOCK_TZ)).toMatchObject({ kind: 'held', text: 'לא נשלח' });
    // a sent push is not a tag; the snooze wins over a failure
    expect(rowTag(mk({ my_deliveries: [{ channel: 'webpush', status: 'sent', reason: null, at: iso(0, 13, 31) }] }), NOW, MOCK_TZ)).toBeNull();
    expect(rowTag({ ...failed, me: { read_at: null, snoozed_until: iso(0, 15, 10) } }, NOW, MOCK_TZ)?.kind).toBe('snz');
    expect(detailDelivery(held, MOCK_TZ)?.text).toBe('לא נשלח · שעות שקט');
  });

  test('counts, source options, subtitle', () => {
    const rows = [mk({ id: 'a', severity: 'critical', me: { read_at: null, snoozed_until: null } }), mk({ id: 'b' }), mk({ id: 'c', category: 'safety', severity: 'critical' }), mk({ id: 'd', category: 'system', me: { read_at: null, snoozed_until: iso(0, 15, 0) } })];
    expect(filterCounts(rows, NOW)).toEqual({ all: 4, unread: 1, critical: 2 }); // the snoozed row is not unread
    expect(sourceOptions(rows).map((o) => [o.category, o.count])).toEqual([['safety', 1], ['device_faults', 2], ['system', 1]]); // the matrix order, only categories that have rows
    expect(sourceOptions([])).toEqual([]);
    expect(categoryIcon('safety')).toBe('siren');
    expect(subtitleText(15, 30)).toBe('15 ב־30 הימים האחרונים');
    expect(subtitleText(15, null)).toBe('15 התראות');
    expect(subtitleText(0, null)).toBe('אין התראות');
    expect(subtitleText(0, 30)).toBe('30 הימים האחרונים');
    expect(visibleRows(rows, 'critical', null, NOW).map((n) => n.id)).toEqual(['a', 'c']);
    expect(visibleRows(rows, 'all', 'system', NOW).map((n) => n.id)).toEqual(['d']);
    expect(visibleRows(rows, 'unread', 'safety', NOW)).toEqual([]);
  });
});

test.describe('the avatar badge and the live events', () => {
  test('the chip is the unread count and the dot the open-critical state; the legacy rule-alert count stands in without a summary', () => {
    expect(badgeOf({ unread: 3, open_critical: 1 }, 9)).toEqual({ count: 3, dot: true, item: true });
    expect(badgeOf({ unread: 3, open_critical: 0 }, 9)).toEqual({ count: 3, dot: false, item: true }); // unread alone is a chip, not a dot
    expect(badgeOf(null, 4)).toEqual({ count: 4, dot: true, item: true });
    expect(badgeOf(null, 0)).toEqual({ count: 0, dot: false, item: true });
    expect(badgeOf(null, null)).toEqual({ count: 0, dot: false, item: false }); // a user who may not read alerts and has no summary: no item
    expect(badgeLabel({ count: 2, dot: true, item: true }, 1)).toBe('התראה קריטית פתוחה · 2 התראות שלא נקראו');
    expect(badgeLabel({ count: 1, dot: false, item: true })).toBe('התראה אחת שלא נקראה');
    expect(badgeLabel({ count: 150, dot: false, item: true })).toBe('99+ התראות שלא נקראו');
    expect(badgeLabel({ count: 0, dot: false, item: true })).toBe('');
  });

  test('events: a new notification asks for a refetch, a state change patches in place, a summary replaces the numbers, unknown things do nothing', () => {
    const rows = [mk({ id: 'a' }), mk({ id: 'b' })];
    expect(applyLiveEvent(rows, { type: 'notification', payload: { id: 'c', severity: 'alert' } })).toMatchObject({ refetch: true, summary: null });
    const st = applyLiveEvent(rows, { type: 'notification_state', payload: { id: 'b', state: 'acknowledged', acked_by_display: 'דנה' } });
    expect(st.refetch).toBe(false);
    expect(st.rows.map((n) => [n.id, n.state, n.acked_by_display])).toEqual([['a', 'open', null], ['b', 'acknowledged', 'דנה']]);
    expect(rows[1].state).toBe('open'); // the input is not mutated
    expect(applyLiveEvent(rows, { type: 'notify_summary', payload: { unread: 4, open_critical: 2 } }).summary).toEqual({ unread: 4, open_critical: 2 });
    expect(applyLiveEvent(rows, { type: 'notify_summary', payload: { unread: 'x' } })).toMatchObject({ summary: null, refetch: false });
    expect(applyLiveEvent(rows, { type: 'permissions_changed' })).toMatchObject({ summary: null, refetch: false });
    expect(applyLiveEvent(rows, { type: 'notification_state', payload: { id: 'zzz', state: 'resolved' } }).rows.map((n) => n.state)).toEqual(['open', 'open']);
    expect(replaceRow(rows, mk({ id: 'b', state: 'resolved' })).map((n) => n.state)).toEqual(['open', 'resolved']);
  });
});

test.describe('settings drafts', () => {
  test('escalation minutes stay in 1..60; weekdays keep the week order; the pass-through matrix flips one cell', () => {
    const e = DEFAULT_SETTINGS().escalation;
    expect(stepAfterMin(e, 1).after_min).toBe(6);
    expect(stepAfterMin({ ...e, after_min: 1 }, -1).after_min).toBe(1);
    expect(stepAfterMin({ ...e, after_min: 60 }, 1).after_min).toBe(60);
    expect(toggleDay(['sun', 'mon', 'sat'], 'tue')).toEqual(['sun', 'mon', 'tue', 'sat']);
    expect(toggleDay(['sun', 'mon'], 'sun')).toEqual(['mon']);
    expect(toggleDay([], 'fri')).toEqual(['fri']);
    const pt = DEFAULT_SETTINGS().pass_through;
    const next = togglePass(pt, 'alert', 'webpush');
    expect(next.alert.webpush).toBe(true);
    expect(pt.alert.webpush).toBe(false);
    expect(next.critical).toEqual(pt.critical);
    expect(togglePass(next, 'alert', 'webpush').alert.webpush).toBe(false);
  });

  test('policies: severity, recipients, a channel; a reserved channel refuses like the server', () => {
    const p = defaultPolicies().find((x) => x.source === 'door.ring')!;
    expect(policyWithSeverity(p, 'critical').severity).toBe('critical');
    expect(policyWithRule(p, 'managers').recipients).toEqual({ rule: 'managers' });
    expect(policyWithRule(p, 'users').recipients).toEqual({ rule: 'users', user_ids: [] });
    expect(policyWithChannel(p, 'email', true).channels.email).toBe(true);
    expect(() => policyWithChannel(p, 'whatsapp', true)).toThrow();
    expect(() => policyWithChannel(p, 'ha_mobile', true)).toThrow();
    expect(policyWithChannel(p, 'inbox', false).channels.inbox).toBe(true); // the center stays on
  });

  test('the matrix: every source of the catalog once, grouped in the matrix order; the count of enabled sources', () => {
    const pols = defaultPolicies();
    const groups = matrixGroups(pols, SOURCE_CATALOG);
    expect(groups.map((g) => g.category)).toEqual(['safety', 'device_faults', 'system', 'doors', 'automations', 'security', 'alerts']);
    expect(groups.flatMap((g) => g.rows).length).toBe(SOURCE_CATALOG.length);
    expect(new Set(groups.flatMap((g) => g.rows.map((r) => r.info.key))).size).toBe(28);
    expect(enabledCount(pols)).toBe(24); // the rule-only camera events and alarm.state are off by default
    expect(matrixGroups(pols.slice(0, 3), SOURCE_CATALOG).flatMap((g) => g.rows.map((r) => r.info.key))).toHaveLength(3);
    expect(matrixGroups([{ ...pols[0], source: 'unknown.source' }], SOURCE_CATALOG)).toEqual([]);
  });
});

test.describe('the lock-screen preview is the push text', () => {
  test('three levels, two sample notifications; the doorbell button only above "generic"; never a name', () => {
    const g = lockPreview('generic', MOCK_TZ);
    expect(g[0]).toMatchObject({ title: 'Arx', body: 'התראה חדשה', ago: 'עכשיו' });
    expect(g[0].actions.map((a) => a.id)).toEqual(['open']);
    const tp = lockPreview('type_place', MOCK_TZ);
    expect(tp[0].title).toBe('דליפת מים · מטבח');
    expect(tp[0].body).toBe('קריטי · 14:02');
    expect(tp[0].actions.map((a) => a.id)).toEqual(['open', 'ack', 'snooze']);
    expect(tp[1].title).toBe('צלצול בדלת · כניסה ראשית');
    expect(tp[1].actions.map((a) => a.id)).toEqual(['open', 'ack', 'snooze', 'open_door']);
    expect(tp[1].actions.find((a) => a.id === 'open_door')).toMatchObject({ kind: 'deeplink' });
    const full = lockPreview('full', MOCK_TZ);
    expect(full[0].body).toContain('חיישן ההצפה מתחת לכיור');
    for (const c of [...g, ...tp, ...full]) {
      expect(JSON.stringify(c)).not.toMatch(/https?:|owner@|token|image/i);
      expect(c.actions.every((a) => a.kind !== 'action' || a.action === 'ack' || a.action === 'snooze')).toBe(true); // nothing but ack / snooze is an action
    }
  });

  test('escalation preview lines: first send, each step at its minute, the stop', () => {
    const e = { ...DEFAULT_SETTINGS().escalation, after_min: 7, steps: 3 };
    const lines = escalationLines(e, 14 * 60 + 2, (to) => (to === 'managers' ? 'מנהלי התראות' : 'יוני'));
    expect(lines.map((l) => [l.clock, l.kind])).toEqual([['14:02', 'created'], ['14:09', 'escalated'], ['14:16', 'escalated'], ['14:23', 'escalated'], ['—', 'acknowledged']]);
    expect(lines[1].title).toBe('הסלמה 1');
    expect(lines[3].sub).toBe('מנהלי התראות · דחיפה דחופה');
    expect(escalationLines({ ...e, enabled: false }, 14 * 60 + 2, () => '').length).toBe(1);
    // across midnight
    expect(escalationLines({ ...e, after_min: 30, steps: 2 }, 23 * 60 + 50, () => 'x').map((l) => l.clock)).toEqual(['23:50', '00:20', '00:50', '—']);
  });
});

test.describe('the delivery log', () => {
  test('failures panel per channel (24 h), failed rows, no inbox card', async () => {
    const m = resetNotifyMock({ viewer: 'admin' });
    const stats = await m.stats();
    const cards = failurePanel(stats);
    expect(cards.map((c) => c.channel).sort()).toEqual(['email', 'webpush']);
    const push = cards.find((c) => c.channel === 'webpush')!;
    expect(push.failed).toBe(2);
    expect(push.tone).toBe('bad');
    expect(push.skipped).toBeGreaterThan(0);
    expect(cards.find((c) => c.channel === 'email')!.tone).toBe('ok');
    expect(failurePanel(null)).toEqual([]);
    const log = await m.adminDeliveries({ limit: 200 });
    expect(failedCount(log)).toBe(3); // the table reaches back 14 days, the panel 24 h
    expect(logRows(log, true).every((d) => d.status === 'failed' || d.status === 'gone')).toBe(true);
    expect(logRows(log, false)).toHaveLength(log.length);
    expect(JSON.stringify(log)).not.toMatch(/https?:\/\/|owner@example/); // masked targets only
    expect(mockId(1)).toBe('ntf-001');
  });
});

test.describe('outgoing mail (the S4 backend wire)', () => {
  const base = { host: 'smtp.example.net', port: 587, security: 'starttls' as const, user: 'arx@example.net', from: 'Arx <arx@example.net>', recipients: ['a@example.net'] };
  test('the test result in plain Hebrew for every class, with how many got it; the password is never part of any text', () => {
    for (const k of ['dns', 'connect', 'tls', 'auth', 'refused', 'timeout', 'invalid', 'too_large', 'unavailable']) {
      expect(MAIL_TEST_DETAIL[k], k).toBeTruthy();
      expect(mailResultText({ ok: false, detail: k })).toBe(`${MAIL_TEST_DETAIL[k]} (${k})`);
    }
    expect(mailResultText({ ok: true, detail: 'ok' })).toBe('נשלח מייל בדיקה');
    expect(mailResultText({ ok: true, detail: 'ok', delivered: 3, total: 3 })).toBe('נשלח מייל בדיקה');
    expect(mailResultText({ ok: true, detail: 'ok', delivered: 2, total: 3 })).toBe('נשלח ל־2 מתוך 3 נמענים');
    expect(mailResultText({ ok: false, detail: 'weird' })).toBe('הבדיקה נכשלה (weird)');
  });
  test('the form check: the contract fields, at most ten recipients, an empty or http(s) link base', () => {
    expect(mailFormError({ ...base })).toBeNull();
    expect(mailFormError({ ...base, link_base: '' })).toBeNull();
    expect(mailFormError({ ...base, link_base: 'https://arx.example.net/' })).toBeNull();
    expect(mailFormError({ ...base, link_base: 'ftp://x' })).toBe('email_invalid');
    expect(mailFormError({ ...base, link_base: 'arx example' })).toBe('email_invalid');
    expect(isValidLinkBase('')).toBe(true);
    expect(isValidLinkBase('http://arx.local:8123/')).toBe(true);
    expect(mailFormError({ ...base, host: 'bad host!' })).toBe('email_invalid');
    expect(mailFormError({ ...base, recipients: [] })).toBe('email_invalid');
    const ten = Array.from({ length: MAX_MAIL_RECIPIENTS }, (_, i) => `u${i}@example.net`);
    expect(mailFormError({ ...base, recipients: ten })).toBeNull();
    expect(mailFormError({ ...base, recipients: [...ten, 'u10@example.net'] })).toBe('email_invalid');
  });
});

test.describe('the service worker: what a notification may carry and do (CR §9)', () => {
  const sw = fs.readFileSync(path.resolve(here, '../src/pwa/sw.ts'), 'utf8');

  test('the buttons are acknowledge, snooze and the doorbell deep link - nothing that opens, releases or runs anything', () => {
    expect(sw).toMatch(/ack: 'אישור', snooze: 'השתק לשעה', open_door: 'פתח דלת'/);
    // no unlock / release / intercom / door / disarm route is reachable from the worker, and the only request it makes for an action is the token endpoint
    const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/\s.*$/gm, ''); // the code, not its comments
    expect(code).not.toMatch(/unlock|release|intercom|disarm|\/doors\/\$\{|api\/v1\/doors/i);
    const fetches = [...sw.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
    for (const f of fetches.filter((x) => /api\/v1\//.test(x))) expect(f).toMatch(/notifications\/action|push\/vapid-key|push\/subscriptions/);
    expect(fetches.some((f) => /api\/v1\/notifications\/action/.test(f))).toBe(true);
    // the door button only opens the in-app confirmation route
    expect(sw).toMatch(/\^#\\\/doors\\\/\[A-Za-z0-9_\\-\.~%\]\+\\\?confirm=/);
    expect(sw).toMatch(/action === 'open_door' && doorLink\(data\?\.door_url\)/);
  });

  test('the action token is posted only for ack / snooze, with the one-time token; the tag is the notification id; the badge follows the unread count', () => {
    expect(sw).toMatch(/\(action === 'ack' \|\| action === 'snooze'\) && typeof data\?\.t === 'string'/);
    expect(sw).toMatch(/body: JSON\.stringify\(\{ t: token, a: action \}\)/);
    expect(sw).toMatch(/tag: d\.tag \|\| d\.id/);
    expect(sw).toMatch(/lastUnread/);
    expect(sw).toMatch(/Notification\?\.maxActions/);
  });
});
