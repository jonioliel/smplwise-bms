import { test, expect } from '@playwright/test';
import type { Task, TaskDetail, VendorRow } from '../src/api/maintenance';
import { MT_KEYS, MT_TABLES, mt } from '../src/i18n/maintenance';
import {
  answerBody, answered, applyFilter, badgeText, bodyOf, draftOf, fmtDate, intervalText, issueKeys, kpiCounts, lookOf, missingRequired, newDraft, nodeOf, outOfRange, pageOf, pagesFor,
  placeOptions, rangeText, resumeIndex, segsOf, stickerUrl, treeRows, validate, vendorMark,
} from '../src/maintenance/model';
import { CATEGORY_LABEL, CATEGORY_ORDER, MAINTENANCE_SOURCES } from '../src/api/notifications';
import { TAB_PERMISSIONS, TICKETS_MAINTENANCE_HREF, TICKETS_TABS, applyMaintenanceOn, legacyRedirect, maintenanceModuleOn, visibleTabs } from '../src/shell/nav';
import { parseRoute } from '../src/router';

// CR-MAINT215 slice 2: the pure part of the maintenance section (src/maintenance/model.ts), the run's answer shape, the notification
// category and the navigation entry. No browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-maintenance.spec.ts

const B = { kind: 'building' as const, id: 'b1', name: 'מבנה א' };
const S = { kind: 'site' as const, id: 's1', name: 'אתר' };
const floor = (id: string, name: string) => ({ kind: 'floor' as const, id, name });

const task = (extra: Partial<Task> = {}): Task => ({
  id: 't1', kind: 'certificate', title: 'בדיקת מעלית שנתית', category: 'elevator', place: B, place_path: [S, B], checklist_count: 0, entity_id: null, elevator_id: null, generator_id: null,
  vendor_id: null, doc_type: null, owner_user_id: null, interval: { unit: 'year', count: 1 }, anchor_date: '2027-02-14', due_date: '2027-02-14', lead_days: 30, state: 'due_soon', days_left: 30,
  active: true, auto_ticket: false, department_id: null, ticket_id: null, last_done_at: null, revision: 1, ...extra,
});
const detail = (extra: Partial<TaskDetail> = {}): TaskDetail => ({ ...task(), notes: '', checklist: [], ticket_error: null, open_run_id: null, can: { edit: true, complete: true, start_round: false, open_request: true }, ...extra });

test('pages: the route names the page, the ledger by default; the tags page is for managers only', () => {
  expect(pageOf(['tickets', 'maintenance'])).toBe('ledger');
  expect(pageOf(['tickets', 'maintenance', 'rounds'])).toBe('rounds');
  expect(pageOf(['tickets', 'maintenance', 'nope'])).toBe('ledger');
  expect(pagesFor({ manage: false })).toEqual(['ledger', 'plans', 'rounds']);
  expect(pagesFor({ manage: true })).toEqual(['ledger', 'plans', 'rounds', 'tags']);
});

test('looks and badges follow the due state; a supplier document is "expired", a plan is "late by N days"', () => {
  expect(lookOf(task({ state: 'overdue' }))).toBe('alarm');
  expect(lookOf(task({ state: 'due_soon' }))).toBe('warn');
  expect(lookOf(task({ state: 'ok' }))).toBe('ok');
  expect(lookOf(task({ active: false }))).toBe('unk');
  expect(lookOf(task({ kind: 'round', open_run: { id: 'r', started_by_name: 'דני', started_at: '2027-01-15T05:42:00Z', answered: 2, total: 5 } }))).toBe('acc');
  expect(badgeText(task({ state: 'due_soon', days_left: 30 }))).toBe('עוד 30 ימים');
  expect(badgeText(task({ state: 'due_soon', days_left: 0 }))).toBe('היום');
  expect(badgeText(task({ state: 'ok', days_left: 300 }))).toBe('בתוקף');
  expect(badgeText(task({ kind: 'vendor_document', state: 'overdue', days_left: -5 }))).toBe('פג');
  expect(badgeText(task({ kind: 'preventive', state: 'overdue', days_left: -3 }))).toBe('עבר ב־3 ימים');
  expect(badgeText(task({ kind: 'preventive', state: 'overdue', days_left: -2 }))).toBe('עבר ביומיים');
  expect(badgeText(task({ kind: 'preventive', state: 'ok' }))).toBe('במועד');
  expect(badgeText(task({ kind: 'preventive', active: false }))).toBe('מושהית');
  expect(badgeText(task({ active: false }))).toBe('מושהה');
  expect(badgeText(task({ kind: 'round', open_run: { id: 'r', started_by_name: '', started_at: '', answered: 2, total: 5 } }))).toBe('בביצוע · 2/5');
});

test('interval and date texts: local calendar dates are never shifted through a Date', () => {
  expect(intervalText({ unit: 'year', count: 1 })).toBe('שנתי');
  expect(intervalText({ unit: 'month', count: 3 })).toBe('כל 3 חודשים');
  expect(intervalText({ unit: 'month', count: 6 })).toBe('כל חצי שנה');
  expect(intervalText({ unit: 'week', count: 2 })).toBe('כל 2 שבועות');
  expect(intervalText(null)).toBe('');
  expect(fmtDate('2027-02-14')).toBe('14.02.2027');
  expect(fmtDate(null)).toBe('');
});

test('the KPI numbers follow the place, the segment and the search - not the KPI itself', () => {
  const list = [task({ id: 'a', state: 'overdue' }), task({ id: 'b', state: 'due_soon', title: 'מטפים' }), task({ id: 'c', state: 'ok' }), task({ id: 'd', active: false }),
    task({ id: 'v', kind: 'vendor_document', place: null, place_path: [], state: 'overdue', vendor_name: 'חשמל השרון' })];
  expect(kpiCounts(list)).toEqual({ all: 5, alarm: 2, warn: 1, ok: 1, unk: 1, acc: 0 });
  const f = applyFilter(list, { kpi: 'alarm', place: 'all', seg: 'cert', q: '' });
  expect(f.shown.map((t) => t.id)).toEqual(['a']);
  expect(kpiCounts(f.base).all).toBe(4);
  expect(applyFilter(list, { kpi: 'all', place: 'all', seg: 'all', q: 'השרון' }).shown.map((t) => t.id)).toEqual(['v']);
  expect(applyFilter(list, { kpi: 'all', place: 'vendors', seg: 'all', q: '' }).shown.map((t) => t.id)).toEqual(['v']);
});

test('the places tree: buildings fold their floors, counts are the rows, supplier documents under "ספקים", the worst state colours the dot', () => {
  const list = [task({ id: 'a', place: floor('f1', 'קומה 1'), place_path: [S, B, floor('f1', 'קומה 1')], state: 'overdue' }),
    task({ id: 'b', place: floor('f2', 'גג'), place_path: [S, B, floor('f2', 'גג')], state: 'ok' }), task({ id: 'c', state: 'due_soon' }),
    task({ id: 'v', kind: 'vendor_document', place: null, place_path: [] }), task({ id: 'n', kind: 'preventive', place: null, place_path: [] })];
  expect(nodeOf(list[0])).toBe('f:f1');
  expect(nodeOf(list[2])).toBe('b:b1');
  const rows = treeRows(list);
  expect(rows.map((r) => [r.id, r.count])).toEqual([['all', 5], ['b:b1', 3], ['f:f2', 1], ['f:f1', 1], ['vendors', 1], ['none', 1]]);
  expect(rows.find((r) => r.id === 'b:b1')!.dot).toBe('alarm');
  expect(rows.find((r) => r.id === 'b:b1')!.kind).toBe('floor');
  expect(treeRows(list, new Set(['b:b1'])).map((r) => r.id)).toEqual(['all', 'b:b1', 'vendors', 'none']);
  expect(applyFilter(list, { kpi: 'all', place: 'b:b1', seg: 'all', q: '' }).shown.map((t) => t.id)).toEqual(['a', 'b', 'c']);
});

test('segments: no request segment while the tickets module is off (owner rule 2026-10-20)', () => {
  expect(segsOf('plans', true).map((s) => s.key)).toEqual(['all', 'auto', 'manual']);
  expect(segsOf('plans', false)).toEqual([]);
  expect(segsOf('ledger', false).map((s) => s.key)).toEqual(['all', 'cert', 'vendor']);
  expect(segsOf('rounds', false).map((s) => s.key)).toEqual(['all', 'daily', 'weekly']);
});

test('the supplier mark: red with the expired insurance, amber while expiring, none without documents (owner answer q17)', () => {
  const v = (extra: Partial<VendorRow>): VendorRow => ({ id: 'v', name: 'x', state: 'ok', expired: [], expiring: [], ...extra });
  expect(vendorMark(v({ state: 'expired', expired: [{ doc_type: 'insurance', valid_until: '2027-01-10' }] }))).toEqual({ look: 'alarm', text: 'ביטוח פג 10.01' });
  expect(vendorMark(v({ state: 'expiring', expiring: [{ doc_type: 'electrician_license', valid_until: '2027-02-01' }] }))).toEqual({ look: 'warn', text: 'רישיון חשמלאי עד 01.02' });
  expect(vendorMark(v({ state: 'ok' }))!.look).toBe('ok');
  expect(vendorMark(v({ state: 'none' }))).toBeNull();
  expect(vendorMark(null)).toBeNull();
});

test('the run: range judgement, required marks, the first unmarked checkpoint, and the answer shape (ok / value / note only)', () => {
  const items = [{ key: 'pump', label: 'משאבה', kind: 'check' as const }, { key: 'p', label: 'לחץ', kind: 'number' as const, min: 2, max: 6 }, { key: 'r', label: 'הערה', kind: 'text' as const, required: false }];
  expect(outOfRange(items[1], 7.5)).toBe(true);
  expect(outOfRange(items[1], 4)).toBe(false);
  expect(outOfRange(items[0], 99)).toBe(false);
  expect(rangeText(items[1])).toBe('2–6');
  expect(missingRequired(items, {})).toEqual(['pump', 'p']);
  expect(missingRequired(items, { pump: { ok: false }, p: { value: 3 } })).toEqual([]);
  expect(answered(items[2], { value: ' ' })).toBe(false);
  expect(resumeIndex(items, { pump: { ok: true } })).toBe(1);
  expect(issueKeys(items, { pump: { ok: false }, p: { value: 7, ok: false } })).toEqual(['pump', 'p']);
  expect(answerBody(items[0], { ok: false, note: ' רעש ' })).toEqual({ ok: false, note: 'רעש' });
  expect(answerBody(items[0], {})).toBeNull();
  expect(answerBody(items[1], { value: 4, ok: null })).toEqual({ value: 4 });
  expect(answerBody(items[1], { value: 4, ok: false })).toEqual({ value: 4, ok: false });
  expect(answerBody(items[2], { value: 'שקט' })).toEqual({ value: 'שקט' });
  expect(Object.keys(answerBody(items[0], { ok: true })!)).not.toContain('at');
});

test('the sticker address: the Settings base (default the remote address) or this page, always the in-app #/m/ path', () => {
  expect(stickerUrl('https://arx.example.test/', 'TOKEN123')).toBe('https://arx.example.test/#/m/TOKEN123');
  expect(stickerUrl('', 'TOKEN123', { origin: 'https://h.local:8123', pathname: '/api/hassio_ingress/x/' })).toBe('https://h.local:8123/api/hassio_ingress/x/#/m/TOKEN123');
  const r = parseRoute('#/m/AbCdEfGhIjKlMnOpQrSt');
  expect(legacyRedirect(r)).toBe('/tickets/maintenance/scan/AbCdEfGhIjKlMnOpQrSt');
  expect(legacyRedirect(parseRoute('#/m/short'))).toBeNull();
});

test('the form: validation per kind, a new task leaves the lead to Settings, an edit sends only what changed with its revision', () => {
  const d = newDraft('round');
  expect(Object.keys(validate(d)).sort()).toEqual(['anchor_date', 'checklist', 'title']);
  const ok = { ...d, title: 'סבב בוקר', anchor_date: '2027-01-15', checklist: [{ ...d.checklist[0], label: 'Pump runs', kind: 'check' as const }] };
  expect(validate(ok)).toEqual({});
  const body = bodyOf(ok);
  expect(body.kind).toBe('round');
  expect(body.lead_days).toBeUndefined();
  expect(body.checklist).toEqual([{ key: 'pump_runs', label: 'Pump runs', kind: 'check' }]);
  expect(body.interval).toEqual({ unit: 'day', count: 1 });
  const doc = { ...newDraft('vendor_document'), title: 'ביטוח' };
  expect(Object.keys(validate(doc)).sort()).toEqual(['due_date', 'vendor_id']);
  expect(bodyOf({ ...doc, vendor_id: 'v1', due_date: '2027-05-01' }).place).toBeUndefined();
  expect(validate({ ...newDraft('preventive'), title: 'x', anchor_date: '2027-01-01', auto_ticket: true }).department_id).toBe('fRequired');
  expect(validate({ ...newDraft('certificate'), title: 'x', lead: '400' }).lead).toBe('fBadNumber');
  const prev = detail();
  const edit = { ...draftOf(prev), title: 'בדיקה חדשה' };
  expect(bodyOf(edit, prev)).toEqual({ revision: 1, title: 'בדיקה חדשה' });
  expect(bodyOf(draftOf(prev), prev)).toEqual({ revision: 1 });
});

test('the form offers only the places the manager manages, nested', () => {
  const opts = placeOptions({ places: [{ kind: 'building', id: 'b1', name: 'מבנה א', parent_id: 's1' }, { kind: 'floor', id: 'f1', name: 'קומה 1', parent_id: 'b1' }, { kind: 'floor', id: 'f9', name: 'קומה 9', parent_id: 'bX' }] });
  expect(opts).toEqual([{ value: 'building:b1', label: 'מבנה א' }, { value: 'floor:f1', label: '– קומה 1' }, { value: 'floor:f9', label: 'קומה 9' }]);
});

test('i18n: Hebrew first, every English entry names a Hebrew key, the section label is written once', () => {
  expect(mt('section', undefined, 'he')).toBe('תחזוקה ובקרה');
  for (const k of Object.keys(MT_TABLES.en)) expect(MT_KEYS).toContain(k);
  expect(mt('stInDays', { n: 5 }, 'en')).toBe('In 5 days');
  expect(mt('pageTags', undefined, 'ar')).toBe(mt('pageTags', undefined, 'he')); // falls back to the Hebrew
});

test('notifications: a category of its own (owner answer q20), placed last, with its two sources', () => {
  expect(CATEGORY_ORDER[CATEGORY_ORDER.length - 1]).toBe('maintenance');
  expect(CATEGORY_LABEL.maintenance).toBe('תחזוקה ובקרה');
  expect(MAINTENANCE_SOURCES.map((s) => [s.key, s.category, s.severity])).toEqual([['maintenance.due_soon', 'maintenance', 'info'], ['maintenance.overdue', 'maintenance', 'alert']]);
});

test('navigation: the section is a tab of the service-management area, maintenance.view, only while its module is on (with a backend)', () => {
  expect(TICKETS_TABS.some((t) => t.id === 'maintenance' && t.href === TICKETS_MAINTENANCE_HREF)).toBe(true);
  expect(TAB_PERMISSIONS[TICKETS_MAINTENANCE_HREF]).toEqual(['maintenance.view']);
  expect(maintenanceModuleOn()).toBe(false);
  expect(visibleTabs(TICKETS_TABS, false).some((t) => t.id === 'maintenance')).toBe(false); // the static demo has no maintenance data
  applyMaintenanceOn(true);
  try {
    expect(maintenanceModuleOn()).toBe(true);
    const can = (p: string) => p === 'maintenance.view';
    expect(visibleTabs(TICKETS_TABS, true, can).map((t) => t.id)).toEqual(['maintenance']); // the tickets module off: the section alone keeps the area
    expect(visibleTabs(TICKETS_TABS, true, () => false).some((t) => t.id === 'maintenance')).toBe(false);
  } finally {
    applyMaintenanceOn(false);
  }
});
