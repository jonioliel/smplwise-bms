import { test, expect } from '@playwright/test';
import {
  ALL_PLACES, BOUNDS, canGoNext, chosen, customRange, defaultMonth, doorCounts, doorLines, fmtChange, fmtHM, fmtMS, fromForm, inPlace, monthLabel, numErrors, pickable,
  placeTree, reportEmpty, reportFigures, shiftMonth, storedPicks, timelineSpan, toForm, wasteCounts, wasteLines,
} from '../src/insights/model';
import { IX_KEYS, IX_TABLES, ix } from '../src/i18n/insights';
import { SECTION_IDS, fieldErrors, isOff, type DoorsAnswer, type InsightSettings, type ReportModel, type WasteAnswer } from '../src/api/insights';
import { ApiError } from '../src/api/client';
import { TICKETS_REPORTS_HREF, TICKETS_TABS, applyInfraInsights, applyTicketsHidden, visibleTabs } from '../src/shell/nav';

// CR-INSIGHT215: the pure logic of the insight screens, the strings and the navigation gate. No browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-insights.spec.ts

const err = (status: number, details: Record<string, unknown> = {}) => new ApiError(status, { code: 'x', user_message: '', retryable: false, correlation_id: '', details });

test('months: previous by default, shifting over a year, never past the current month', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  expect(defaultMonth(now, 'Asia/Jerusalem')).toBe('2026-09');
  expect(defaultMonth(new Date('2027-01-02T10:00:00Z'), 'Asia/Jerusalem')).toBe('2026-12');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(canGoNext('2026-09', now, 'Asia/Jerusalem')).toBe(true);
  expect(canGoNext('2026-10', now, 'Asia/Jerusalem')).toBe(false);
  expect(monthLabel('2026-09', 'he')).toContain('2026');
  expect(monthLabel('2026-09', 'en')).toContain('September');
});

test('durations and the change sign', () => {
  expect(fmtHM(165)).toBe('2:45');
  expect(fmtHM(0)).toBe('-');
  expect(fmtMS(48)).toBe('0:48');
  expect(fmtMS(3725)).toBe('62:05');
  expect(fmtChange(-6, 'he')).toBe('6%-');
  expect(fmtChange(6.5, 'en')).toBe('+6.5%');
  expect(fmtChange(null, 'he')).toBe('-');
});

const model = (data: ReportModel['data'], omitted: ReportModel['omitted'] = [], sections: ReportModel['sections'] = ['summary', 'tickets']): ReportModel => ({
  v: 1, lang: 'he', month: '2026-09', zone: 'Asia/Jerusalem', from: 0, to: 1, generated: 1, sections, omitted, data, digest: 'd', filename: 'f.pdf',
});

test('report: figures, picks, omitted sections and the empty month', () => {
  const m = model({
    tickets: { opened: 42, closed: 38, open_end: 4, overdue: 1, median_close_h: 3, by_department: [], oldest_open: [], truncated: false },
    energy: { available: true, meters: [], total_kwh: 18420, prev_total_kwh: 19600, change_pct: -6 },
    doors: { configured: true, total: { openings: 10, explained: 8, unexplained: 2, unverifiable: 0 }, ranking: [], doors: [] },
    temperature: { units: [], alarms: 5, out_min: 0 },
  });
  const f = reportFigures(m);
  expect(f.map((x) => x.id)).toEqual(['energy', 'tickets', 'doors', 'temp']);
  expect(f[0].tone).toBe('down');
  expect(reportFigures(model({ doors: { configured: false, total: { openings: 0, explained: 0, unexplained: 0, unverifiable: 0 }, ranking: [], doors: [] } })).length).toBe(0);
  const om: ReportModel['omitted'] = [{ section: 'cameras', reason: 'not_permitted' }, { section: 'elevators', reason: 'module_off' }];
  expect(pickable(SECTION_IDS, om)).not.toContain('cameras');
  expect(chosen(SECTION_IDS, new Set(['summary', 'cameras', 'tickets']), om)).toEqual(['summary', 'tickets']);
  expect(reportEmpty(model({}, [], []))).toBe(true);
  expect(reportEmpty(m)).toBe(false);
  expect(reportEmpty(model({ tickets: { opened: 0, closed: 0, open_end: 0, overdue: 0, median_close_h: null, by_department: [], oldest_open: [], truncated: false } }))).toBe(true);
});

test('stored section picks survive junk', () => {
  expect([...storedPicks('["tickets","nope"]', SECTION_IDS)]).toEqual(['tickets']);
  expect(storedPicks('garbage', SECTION_IDS).size).toBe(SECTION_IDS.length);
  expect(storedPicks(null, SECTION_IDS).size).toBe(SECTION_IDS.length);
});

const door = (name: string, floor: string | null, area: string | null, over: Partial<DoorsAnswer['doors'][number]> = {}): DoorsAnswer['doors'][number] => ({
  key: name, name, floor, area, openings: 10, explained: 7, unexplained: 2, unverifiable: 1, by_reason: { lock: 5, unlocked: 0, command: 2, rex: 0, window: 0 }, judgeable: true, items_more: 0,
  items: [{ at: '2026-10-22T20:41:00Z', duration_s: 48, open_at_end: false, verdict: 'unexplained', why: null }, { at: '2026-10-22T21:00:00Z', duration_s: 5, open_at_end: false, verdict: 'unverifiable', why: 'lock_unknown' }], ...over,
});
const answer = (doors: DoorsAnswer['doors']): DoorsAnswer => ({ from: 'a', to: 'b', window: { before_s: 30, after_s: 10 }, doors, total: { openings: 0, explained: 0, unexplained: 0, unverifiable: 0 }, ranking: [], configured: true });

test('doors: lines newest first, counts and the places filter', () => {
  const a = answer([door('אחורית', 'קומה 1', 'מבואה'), door('גג', 'גג', null, { items: [], unexplained: 0, unverifiable: 0 })]);
  expect(doorLines(a, ALL_PLACES).map((l) => l.verdict)).toEqual(['unverifiable', 'unexplained']);
  expect(doorCounts(a, ALL_PLACES)).toEqual({ unexplained: 2, unverifiable: 1, explained: 14, all: 3 });
  expect(doorCounts(a, 'floor:גג').all).toBe(0);
  expect(doorLines(a, 'floor:קומה 1').length).toBe(2);
  expect(timelineSpan(30, 10, 50).start).toBeCloseTo(33.33, 1);
});

test('places tree: floors with areas, rows without a place, collapse, weights', () => {
  const rows = [{ floor: 'קומה 1', area: 'מבואה', w: 4 }, { floor: 'קומה 1', area: 'משרד', w: 1 }, { floor: null, area: 'חצר', w: 2 }, { floor: null, area: null, w: 3 }];
  const t = placeTree(rows);
  expect(t.map((n) => [n.kind, n.count])).toEqual([['all', 10], ['floor', 5], ['area', 4], ['area', 1], ['area', 2], ['none', 3]]);
  expect(placeTree(rows, new Set(['floor:קומה 1'])).filter((n) => n.kind === 'area').length).toBe(1);
  expect(placeTree([])).toEqual([]);
  expect(inPlace({ floor: null, area: null }, 'none')).toBe(true);
  expect(inPlace({ floor: 'קומה 1', area: 'מבואה' }, 'area:קומה 1|מבואה')).toBe(true);
});

test('waste: kinds, night anomalies and the filter', () => {
  const w = {
    from: 'a', to: 'b', zone: 'Asia/Jerusalem', night: { from: '22:00', to: '06:00' },
    devices: { items: [
      { key: 'a', kind: 'empty_room', name: 'מזגן', area: 'ישיבות', floor: 'קומה 2', domain: 'climate', minutes: 30, segments: 1, longest_min: 30, first_at: '', last_at: '' },
      { key: 'b', kind: 'after_hours', name: 'תאורה', area: 'משרד', floor: 'קומה 1', domain: 'light', minutes: 90, segments: 1, longest_min: 90, first_at: '', last_at: '' },
    ], items_more: 0, judged: 2, truncated: false, minutes: { empty_room: 30, after_hours: 90 } },
    energy: { available: true, meters: 1, items: [{ key: 'n', kind: 'energy', name: 'מונה', night: '2026-10-20', from: '', to: '', kwh: 10, baseline_kwh: 5, ratio: 2, baseline_nights: 4 }] },
  } as WasteAnswer;
  expect(wasteCounts(w, ALL_PLACES)).toEqual({ all: 2, empty_room: 1, after_hours: 1, night: 1 });
  expect(wasteLines(w, ALL_PLACES, 'all').map((i) => i.key)).toEqual(['b', 'a']);
  expect(wasteLines(w, ALL_PLACES, 'empty_room').length).toBe(1);
  expect(wasteLines(w, 'floor:קומה 1', 'all').length).toBe(1);
  expect(customRange('', '')).toEqual({ range: '7d' });
  expect(customRange('2026-10-01', '2026-10-05').range).toBe('custom');
});

const settings = (): InsightSettings => ({
  doors: { before_s: 30, after_s: 10, min_open_s: 2, pairs: [{ sensor_entity_id: 'binary_sensor.d', lock_entity_id: null, rex_entity_ids: [], invert: false }] },
  waste: { empty_after_min: 20, min_waste_min: 30, night_min_min: 60, energy_factor: 1.5, energy_min_kwh: 1, baseline_weeks: 4, baseline_min_coverage: 0.8, domains: ['light'], night_from: '22:00', night_to: '06:00' },
  report: { sections: ['summary'] },
});

test('settings form: round trip, comma decimals, bad input left for the server, 422 field names', () => {
  const s = settings();
  const f = toForm(s);
  expect(f.nums.min_open_s).toBe('2');
  expect(fromForm(f, s)).toEqual(s);
  f.nums.energy_factor = '2,5';
  f.nums.min_waste_min = 'abc';
  const doc = fromForm(f, s);
  expect(doc.waste.energy_factor).toBe(2.5);
  expect(Number.isNaN(doc.waste.min_waste_min)).toBe(true);
  expect(JSON.stringify(doc)).toContain('"min_waste_min":null');
  expect([...numErrors(['waste.min_waste_min', 'doors.pairs[0].lock_entity_id', 'doors.before_s'])].sort()).toEqual(['before_s', 'min_waste_min']);
  expect(BOUNDS.min_waste_min).toEqual({ group: 'waste', lo: 5, hi: 720 });
  expect(fieldErrors(err(422, { fields: ['waste.min_waste_min'] }))).toEqual(['waste.min_waste_min']);
  expect(fieldErrors(err(500))).toEqual([]);
  expect(isOff(err(404))).toBe(true);
  expect(isOff(err(403))).toBe(false);
});

test('strings: every English key exists in Hebrew, placeholders match, nothing names the platform', () => {
  const he = IX_TABLES.he;
  for (const k of Object.keys(IX_TABLES.en) as (keyof typeof he)[]) {
    expect(IX_KEYS, k).toContain(k);
    const a = (he[k] ?? '').match(/\{\w+\}/g)?.sort().join() ?? '';
    const b = (IX_TABLES.en[k] ?? '').match(/\{\w+\}/g)?.sort().join() ?? '';
    expect(b, k).toBe(a);
  }
  for (const v of Object.values(he)) expect(v).not.toMatch(/Home Assistant|\bHA\b|Ingress/i);
  expect(ix('emptyMonthTitle', { month: 'ספטמבר' }, 'he')).toBe('אין נתונים לספטמבר');
  expect(ix('download', undefined, 'en')).toBe('Download PDF');
});

test('navigation: the reports tab is hidden until a part is on, then offered to the permission holder', () => {
  const tab = TICKETS_TABS.find((t) => t.id === 'reports');
  expect(tab?.href).toBe(TICKETS_REPORTS_HREF);
  const can = (p: string) => p === 'insights.read';
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  applyInfraInsights({ report: false, doors: false, waste: false });
  expect(visibleTabs(TICKETS_TABS, true, can).some((t) => t.id === 'reports')).toBe(false);
  applyInfraInsights({ report: false, doors: true, waste: false });
  expect(visibleTabs(TICKETS_TABS, true, can).some((t) => t.id === 'reports')).toBe(true);
  expect(visibleTabs(TICKETS_TABS, true, () => false).some((t) => t.id === 'reports')).toBe(false);
  applyInfraInsights({ report: false, doors: false, waste: false });
});
