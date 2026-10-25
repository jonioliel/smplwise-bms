import { test, expect } from '@playwright/test';
import type { ModuleState, Task, TaskDetail, VendorRow } from '../src/api/maintenance';
import { accessOf } from '../src/maintenance/access';
import { MT_KEYS, MT_TABLES, mt } from '../src/i18n/maintenance';
import {
  answerBody, answered, applyFilter, badgeText, bodyOf, certRowOf, draftOf, fileSizeText, fmtDate, insuranceMark, roundViewOf, ROUND_VIEW_KEY, intervalText, issueKeys, kpiCounts, lookOf, missingRequired, newDraft, nodeOf, outOfRange, pageOf, pagesFor,
  placeOptions, rangeText, resumeIndex, segsOf, stickerUrl, treeRows, validate, vendorMark,
} from '../src/maintenance/model';
import { CATEGORY_LABEL, CATEGORY_ORDER, MAINTENANCE_SOURCES } from '../src/api/notifications';
import { TAB_PERMISSIONS, TICKETS_MAINTENANCE_HREF, TICKETS_MAINTENANCE_PAGE_HREF, TICKETS_MAINTENANCE_PAGES, TICKETS_TABS, applyMaintenanceOn, legacyRedirect, maintenanceModuleOn, ticketsPageOf, ticketsSectionOf, visibleTabs } from '../src/shell/nav';
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
  expect(pagesFor({ manage: false })).toEqual(['ledger', 'plans', 'rounds', 'log']);
  expect(pagesFor({ manage: true })).toEqual(['ledger', 'plans', 'rounds', 'log', 'tags']);
  expect(pageOf(['tickets', 'maintenance', 'log'])).toBe('log');
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

test('notifications: a category of its own (owner answer q20), after tickets, with its two sources', () => {
  // NOTICEPUSH-295 (2.18.0) appended the notice board's category 'building' after it
  expect(CATEGORY_ORDER.slice(-3)).toEqual(['tickets', 'maintenance', 'building']);
  expect(CATEGORY_LABEL.maintenance).toBe('תחזוקה ובקרה');
  expect(MAINTENANCE_SOURCES.map((s) => [s.key, s.category, s.severity])).toEqual([['maintenance.due_soon', 'maintenance', 'info'], ['maintenance.overdue', 'maintenance', 'alert']]);
});

test('navigation: the section is a tab of the service-management area, maintenance.view, only while its module is on (with a backend)', () => {
  expect(TICKETS_TABS.some((t) => t.id === 'maintenance' && t.href === TICKETS_MAINTENANCE_HREF)).toBe(true);
  expect(TAB_PERMISSIONS[TICKETS_MAINTENANCE_HREF]).toBeUndefined(); // release/2150: the section address is redirect-only (SERVICEIA1); its page carries maintenance.view
  expect(maintenanceModuleOn()).toBe(false);
  expect(visibleTabs(TICKETS_TABS, false).some((t) => t.id === 'maintenance')).toBe(false); // the static demo has no maintenance data
  applyMaintenanceOn(true);
  try {
    expect(maintenanceModuleOn()).toBe(true);
    const can = (p: string) => p === 'maintenance.view';
    expect(visibleTabs(TICKETS_TABS, true, can).map((t) => t.id)).toEqual(['maintenance']); // the tickets module off: the section alone keeps the area
    expect(visibleTabs(TICKETS_TABS, true, () => false).some((t) => t.id === 'maintenance')).toBe(false);
    // release/2150 (SERVICEIA1-295): one page in the shell's rows, the ledger; the section entry address is redirect-only and keeps the query
    expect(TICKETS_MAINTENANCE_PAGES.map((t) => [t.id, t.href])).toEqual([['maintenance', TICKETS_MAINTENANCE_PAGE_HREF]]);
    expect(TAB_PERMISSIONS[TICKETS_MAINTENANCE_PAGE_HREF]).toEqual(['maintenance.view']);
    expect(visibleTabs(TICKETS_TABS, true, can)[0]?.href).toBe(TICKETS_MAINTENANCE_PAGE_HREF);
    const access = { api: true, ready: true, can };
    expect(legacyRedirect(parseRoute('#/tickets/maintenance?task=t1'), access)).toBe('/tickets/maintenance/ledger?task=t1');
    expect(legacyRedirect(parseRoute('#/tickets/maintenance/ledger'), access)).toBeNull();
    for (const path of ['#/tickets/maintenance/ledger', '#/tickets/maintenance/rounds', '#/tickets/maintenance/scan/AbCdEfGhIjKlMnOpQrSt']) {
      expect([ticketsSectionOf(parseRoute(path)), ticketsPageOf(parseRoute(path))], path).toEqual(['maintenance', 'maintenance']);
    }
  } finally {
    applyMaintenanceOn(false);
  }
});

// ---------------------------------------------------------------- MAINT215B (owner review 24.10)

test('insurance mark of the assignee picker: red for expired or missing, amber while ending, nothing otherwise - a mark only', () => {
  expect(insuranceMark({ state: 'expired', valid_until: '2027-01-10' })).toEqual({ look: 'alarm', text: 'ביטוח פג תוקף ב־10.01.2027' });
  expect(insuranceMark({ state: 'missing', valid_until: null })).toEqual({ look: 'alarm', text: 'אין ביטוח במערכת' });
  expect(insuranceMark({ state: 'expiring', valid_until: '2027-02-01' })?.look).toBe('warn');
  expect(insuranceMark({ state: 'ok', valid_until: '2028-02-01' })).toBeNull();
  expect(insuranceMark(undefined)).toBeNull();
  expect(insuranceMark(null)).toBeNull();
});

test('file sizes read in KB / MB', () => {
  expect(fileSizeText(100)).toBe('1 KB');
  expect(fileSizeText(182_000)).toBe('178 KB');
  expect(fileSizeText(3 * 1024 * 1024)).toBe('3.0 MB');
});

test('the phone round: the installation default until the person chooses, then his own choice', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  try {
    expect(roundViewOf(undefined)).toBe('step');
    expect(roundViewOf('list')).toBe('list');
    store.set(ROUND_VIEW_KEY, 'step');
    expect(roundViewOf('list')).toBe('step');
    store.set(ROUND_VIEW_KEY, 'garbage');
    expect(roundViewOf('list')).toBe('list');
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  expect(roundViewOf('step')).toBe('step'); // storage unavailable: no throw
});

test('the row of an elevator / generator card: the nearest certificate, its date and state', () => {
  expect(certRowOf([])).toBeNull();
  const row = certRowOf([task({ state: 'due_soon', days_left: 30, due_date: '2027-02-14' })]);
  expect(row?.look).toBe('warn');
  expect(row?.text).toBe('עוד 30 ימים · 14.02.2027');
  expect(certRowOf([task({ state: 'overdue', days_left: -3, due_date: '2027-01-12' })])?.text).toBe('פג ב־12.01.2027');
  expect(certRowOf([task({ state: 'ok', days_left: 200, due_date: '2027-08-01' })])?.text).toBe('בתוקף עד 01.08.2027');
  expect(certRowOf([task({ kind: 'preventive', state: 'ok', due_date: '2027-08-01' }), task({ id: 't2', state: 'overdue', due_date: '2027-01-01', days_left: -9 })])?.task.id).toBe('t2');
});

test('the form links a task to an elevator or a generator and sends only what changed', () => {
  const d = { ...newDraft('certificate'), title: 'תסקיר', due_date: '2027-06-30', asset: 'elevator:e1' };
  expect(bodyOf(d).elevator_id).toBe('e1');
  expect(bodyOf(d).generator_id).toBeUndefined(); // a new task leaves out the link it does not have
  expect(bodyOf({ ...d, asset: 'generator:g1' }).generator_id).toBe('g1');
  const none = bodyOf({ ...d, asset: '' });
  expect(none.elevator_id).toBeUndefined();
  expect(none.generator_id).toBeUndefined();
  const prev = detail({ elevator_id: 'e1', title: 'תסקיר', due_date: '2027-06-30', notes: '', revision: 4 });
  expect(draftOf(prev).asset).toBe('elevator:e1');
  expect(bodyOf(draftOf(prev), prev)).toEqual({ revision: 4 });
  expect(bodyOf({ ...draftOf(prev), asset: '' }, prev)).toMatchObject({ elevator_id: null });
});

test('every new text exists in Hebrew and English', () => {
  for (const k of MT_KEYS.filter((x) => /^(evt_|file|ins|certRow|closeAsk|view|list|setReminders|setRoundView|setCloseMode|setCheckMinutes|setLogKeep|setMissingIns|setInsWarn|setFileMax|log|colWhen|colEvent|fAsset)/.test(x))) {
    expect(MT_TABLES.he[k], k).toBeTruthy();
    expect(MT_TABLES.en[k] ?? mt(k, undefined, 'he'), k).toBeTruthy();
  }
});

test('the module answer: one without `can` reads as off (never a TypeError), a full one maps the switches (GATEFIX2150B)', () => {
  expect(accessOf(null)).toMatchObject({ enabled: false, view: false, request: false, ticketsOn: false });
  // the shape a catch-all test double or a proxy page returns: it used to throw "reading 'open_request'" on every page load
  expect(() => accessOf({} as unknown as ModuleState)).not.toThrow();
  expect(accessOf({} as unknown as ModuleState)).toMatchObject({ enabled: false, view: false, perform: false, manage: false, request: false, ticketsOn: false });
  expect(accessOf({ enabled: true } as unknown as ModuleState)).toMatchObject({ enabled: false, view: false });
  const on: ModuleState = { enabled: true, can: { view: true, perform: false, manage: false, open_request: true }, tickets_on: false, round_view: 'list' };
  expect(accessOf(on)).toEqual({ enabled: true, view: true, perform: false, manage: false, request: true, ticketsOn: false, roundView: 'list' });
});
