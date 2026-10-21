import { test, expect } from '@playwright/test';
import {
  OCC_TONE, alarms, bodyOf, byDoor, canEndNow, dayRuns, draftOf, draftProblem, emptyDraft, hm, holdProgress, incidentLines, incidentLive, localDay, nextStep,
  periodLines, weekdayOf, type SheetStep,
} from '../src/door-windows/logic';
import { DWT_KEYS, DWT_TABLES, dwt } from '../src/i18n/door-windows';
import type { DoorRow, Incident, Occurrence, Rule } from '../src/api/door-windows';

// CR-039 / DOORWIN-295: the pure logic of the door-windows screen and the emergency sheet, and their words. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-door-windows.spec.ts

const TZ = 'Asia/Jerusalem';
const door = (key: string, over: Partial<DoorRow> = {}): DoorRow => ({ key, station_id: key.split(':')[0], relay: 1, label: key, station_name: 's', name: 'n', zone: TZ,
                                                                         manage: true, cancel: true, exterior: false, ...over });
const occ = (over: Partial<Occurrence>): Occurrence => ({ id: 'o', door: 'st-a:1', label: 'לובי · כניסה', rule_id: 'r', rule_name: 'בוקר', start_at: '2026-11-02T06:00:00Z',
                                                          end_at: '2026-11-02T09:00:00Z', zone: TZ, state: 'armed', tier: 'program', retries: 0, unconfirmed_at: null,
                                                          last_reason: null, resolution: null, resolved_at: null, ...over });

test('times are shown in the door\'s own zone, across the DST change (no fixed offset)', () => {
  expect(hm('2026-10-19T05:00:00Z', TZ)).toBe('08:00'); // summer: UTC+3
  expect(hm('2026-10-26T06:00:00Z', TZ)).toBe('08:00'); // winter: UTC+2
  expect(hm('2026-11-02T08:00:00Z', 'Europe/London')).toBe('08:00');
  expect(localDay('2026-11-01T22:30:00Z', TZ)).toBe('2026-11-02');
  expect(weekdayOf('2026-11-02')).toBe(1); // a Monday (0 = Sunday)
});

test('rule summaries: same hours on many days collapse into day runs', () => {
  const rule = { kind: 'weekly' as const, periods: [0, 1, 2, 3, 4].map((d) => ({ weekday: d, on_date: null, start: '08:00', end: '11:00' }))
    .concat([{ weekday: 5, on_date: null, start: '08:00', end: '10:00' }]) };
  expect(periodLines(rule)).toEqual([{ days: [5], date: null, hours: '08:00–10:00' }, { days: [0, 1, 2, 3, 4], date: null, hours: '08:00–11:00' }]);
  expect(dayRuns([0, 1, 2, 4, 6, 5])).toEqual([[0, 2], [4, 6]]);
  expect(periodLines({ kind: 'once', periods: [{ weekday: null, on_date: '2026-11-09', start: '12:00', end: '14:00' }] })).toEqual([{ days: [], date: '2026-11-09', hours: '12:00–14:00' }]);
});

test('the editor draft: client checks mirror the server, and the body is what the server expects', () => {
  const d = emptyDraft('2026-11-02');
  expect(draftProblem(d, 4)?.key).toBe('errName');
  d.name = 'בוקר';
  expect(draftProblem(d, 4)?.key).toBe('errDoors');
  d.doors.add('st:with:colons:2'); // a station id may contain ":" - the relay is after the last one
  expect(draftProblem(d, 4)).toBeNull();
  d.ranges = [{ start: '11:00', end: '08:00' }];
  expect(draftProblem(d, 4)?.key).toBe('errOrder');
  d.ranges = [{ start: '06:00', end: '11:00' }];
  expect(draftProblem(d, 4)).toEqual({ key: 'errLong', vars: { h: 4 } });
  d.ranges = [{ start: '08:00', end: '11:00' }];
  d.days = new Set();
  expect(draftProblem(d, 4)?.key).toBe('errDays');
  d.days = new Set([1, 3]);
  const body = bodyOf(d, true);
  expect(body.doors).toEqual([{ station_id: 'st:with:colons', relay: 2 }]);
  expect(body.periods).toEqual([{ weekday: 1, start: '08:00', end: '11:00' }, { weekday: 3, start: '08:00', end: '11:00' }]);
  expect(body.enable).toBe(true);
  expect(body).not.toHaveProperty('revision');
});

test('a saved rule round-trips through the editor (per-day hours kept when they differ)', () => {
  const rule: Rule = { id: 'r1', name: 'x', kind: 'weekly', state: 'enabled', calendar_policy: 'holidays_like_friday', notes: '', revision: 3, updated_at: null, approved: true,
                       doors: [{ station_id: 'a', relay: 1, key: 'a:1', label: 'a', visible: true }],
                       periods: [{ weekday: 1, on_date: null, start: '08:00', end: '10:00' }, { weekday: 2, on_date: null, start: '09:00', end: '12:00' }] };
  const d = draftOf(rule, '2026-11-02');
  expect(d.perDay?.get(1)).toEqual([{ start: '08:00', end: '10:00' }]);
  expect(bodyOf(d, false)).toMatchObject({ revision: 3, calendar_policy: 'holidays_like_friday', periods: rule.periods.map((p) => ({ weekday: p.weekday, start: p.start, end: p.end })) });
  const same = draftOf({ ...rule, periods: [1, 2].map((w) => ({ weekday: w, on_date: null, start: '08:00', end: '10:00' })) }, '2026-11-02');
  expect(same.perDay).toBeNull();
  expect([...same.days].sort()).toEqual([1, 2]);
});

test('occurrences: the alarms first, grouping per door, and who may end a window now', () => {
  const list = [occ({ id: 'a', state: 'active' }), occ({ id: 'b', state: 'relock_unconfirmed', door: 'st-b:1', end_at: '2026-11-02T07:00:00Z' }),
                occ({ id: 'c', state: 'cancelled' }), occ({ id: 'd', state: 'closed_confirmed', start_at: '2026-11-01T06:00:00Z', end_at: '2026-11-01T09:00:00Z' })];
  expect(alarms(list).map((o) => o.id)).toEqual(['b']);
  const groups = byDoor(list, [door('st-a:1'), door('st-b:1')], '2026-11-02T07:10:00Z');
  expect(groups.map((g) => [g.door.key, g.items.map((o) => o.id)])).toEqual([['st-a:1', ['a']], ['st-b:1', ['b']]]);
  expect(canEndNow(occ({ state: 'active' }), door('st-a:1'))).toBe(true);
  expect(canEndNow(occ({ state: 'active' }), door('st-a:1', { cancel: false }))).toBe(false);
  expect(canEndNow(occ({ state: 'armed' }), door('st-a:1'))).toBe(false);
  expect(canEndNow(occ({ state: 'relock_unconfirmed' }), door('st-a:1'))).toBe(false);
  expect(OCC_TONE.relock_unconfirmed).toBe('err');
});

test('the emergency sheet: there is no path from choosing straight to sending', () => {
  const all: SheetStep[] = ['choose', 'confirm', 'sending', 'result', 'error'];
  expect(nextStep('choose', 'confirm')).toBe('choose');
  expect(nextStep('choose', 'sent')).toBe('choose');
  expect(nextStep('choose', 'held')).toBe('confirm');
  expect(nextStep('confirm', 'confirm')).toBe('sending');
  expect(nextStep('sending', 'sent')).toBe('result');
  expect(nextStep('sending', 'timeout')).toBe('sending'); // never closed while sending
  for (const s of all) if (s !== 'sending') expect(nextStep(s, 'timeout')).toBe('choose');
  expect(holdProgress(null, 5000, 1500)).toBe(0);
  expect(holdProgress(1000, 1750, 1500)).toBe(0.5);
  expect(holdProgress(1000, 9000, 1500)).toBe(1);
});

test('per-door results: failures first, the headline counts, live states', () => {
  const inc = { id: 'i', kind: 'lock_secure', state: 'in_effect_partial', counts: { total: 3, ok: 1, failed: 1, unknown: 1 },
    doors: [{ door: 'a', label: 'א', phase: 'apply', state: 'acknowledged', attempts: 1, code: null }, { door: 'b', label: 'ב', phase: 'apply', state: 'unknown', attempts: 3, code: null },
            { door: 'c', label: 'ג', phase: 'apply', state: 'refused', attempts: 1, code: 'x' }, { door: 'a', label: 'א', phase: 'release', state: 'pending', attempts: 0, code: null }] } as unknown as Incident;
  expect(incidentLines(inc).map((l) => l.door)).toEqual(['c', 'b', 'a']);
  expect(incidentLines(inc, 'release').map((l) => l.door)).toEqual(['a']);
  expect(incidentLive(inc)).toBe(true);
  expect(incidentLive({ ...inc, state: 'released' })).toBe(false);
  expect(dwt('emResult', { ok: 1, total: 3 }, 'he')).toBe('1 מתוך 3 אושרו');
});

test('the words: every key in all four languages, placeholders kept, no platform or vendor name, no physical claim', () => {
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['en', 'ar', 'ru'] as const) {
    const t = DWT_TABLES[lang];
    expect(Object.keys(t).sort()).toEqual([...DWT_KEYS].sort());
    for (const k of DWT_KEYS) {
      expect(t[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(holes(t[k]), `${lang}.${k}`).toBe(holes(DWT_TABLES.he[k]));
    }
  }
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of DWT_KEYS) {
      const v = DWT_TABLES[lang][k].toLowerCase();
      expect(v, `${lang}.${k}`).not.toMatch(/wiskey|home assistant|\bha\b|ingress|hikvision|supervisor|add-on|תוסף|אינטרקום|intercom|домофон/);
    }
  }
  // CR-039 18.2: nobody measured the door - the confirmation is the system's, never "the door is closed"
  expect(dwt('occ_closed_confirmed', undefined, 'he')).toContain('אושרה על ידי המערכת');
  expect(DWT_TABLES.en.occ_closed_confirmed.toLowerCase()).not.toContain('is closed');
});

test('navigation: the tab exists only while a door feature is on, and any-scope holders may open it', async () => {
  const nav = await import('../src/shell/nav');
  nav.applyDoorWindowsTab({ 'doors.ui.tab': 'off' });
  expect(nav.WISKEY_TABS.some((t) => t.href === nav.DOOR_WINDOWS_HREF)).toBe(false);
  nav.applyDoorWindowsTab({ 'doors.ui.tab': 'on' });
  expect(nav.WISKEY_TABS.some((t) => t.href === nav.DOOR_WINDOWS_HREF)).toBe(true);
  const scoped = (p: string, installationOnly?: boolean) => !installationOnly && p === 'access.windows.cancel';
  expect(nav.tabAllowed(nav.DOOR_WINDOWS_HREF, scoped)).toBe(true);
  expect(nav.tabAllowed(nav.DOOR_WINDOWS_HREF, () => false)).toBe(false);
  nav.applyDoorWindowsTab({});
  expect(nav.WISKEY_TABS.some((t) => t.href === nav.DOOR_WINDOWS_HREF)).toBe(false);
});
