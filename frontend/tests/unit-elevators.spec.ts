import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { historyRows, addAffordances, agoText, alertActive, barOf, barSummary, effectiveHidden, ledText, personalHidden, chipOf, recipientChoices, toggled, homeTiles, kpisOf, ledsOf, shownState, summaryLine, widgetView, HOME_CHIP_MAX, ELEVATORS_HREF } from '../src/elevators/model';
import { configOf, defaultConfig, moveAmong, resolveWidgets, type HomeData } from '../src/api/home-config';
import { personalOf } from '../src/api/home';
import { bodyOf, draftOf, moved, newDraft, problemOf } from '../src/elevators/draft';
import { ELT_DEV_MARKED, ELT_KEYS, ELT_TABLES, elt } from '../src/i18n/elevators';
import { INFRA_TABS, applyInfraElevators, visibleTabs, activeAreaTab } from '../src/shell/nav';
import type { Elevator, ElevatorState, ManagedElevator } from '../src/api/elevators';

// CR-INFRA-ELEVATORS: the presentation of the server-derived state (chip), the home tiles, the dialog draft, the strings and the tab gate.
// Pure functions, no browser.

const el = (id: string, state: ElevatorState, extra: Partial<Elevator> = {}): Elevator => ({
  id, name: `מעלית ${id}`, area_id: null, area_name: null, state, reason: state, partial: false, stale: false, since: null, roles: [], extras: [], ...extra,
});

test('every state has its chip and look; out of service has its own look, apart from fault and fire service (9a)', () => {
  const expected: Record<ElevatorState, [string, string, string, string]> = {
    fire_service: ['error', 'flame', 'פיקוד כבאים', 'fire'],
    fault: ['error', 'warning', 'תקלה', 'fault'],
    out_of_service: ['stale', 'stopSquare', 'בהשבתה', 'off'],
    // no direction anywhere (owner 2026-10-18): a movement state is shown as "in operation", never an arrow
    moving_up: ['live', 'play', 'פעילה', 'act'],
    moving_down: ['live', 'play', 'פעילה', 'act'],
    door_open: ['neutral', 'door', 'דלת פתוחה', 'wait'],
    waiting: ['neutral', 'pause', 'ממתינה', 'wait'],
    active: ['live', 'play', 'פעילה', 'act'],
    travelling: ['live', 'move', 'בנסיעה', 'trav'],
    unknown: ['unknown', 'help', 'לא ידוע', 'unk'],
  };
  for (const [state, [tone, icon, label, look]] of Object.entries(expected)) {
    const c = chipOf({ state: state as ElevatorState, stale: false });
    expect([c.tone, c.icon, c.label, c.look], state).toEqual([tone, icon, label, look]);
    expect(c.icon).not.toMatch(/arrow/);
  }
  const looks = new Set(['fire_service', 'fault', 'out_of_service'].map((s) => chipOf({ state: s as ElevatorState, stale: false }).look));
  expect(looks.size).toBe(3);
  expect(shownState({ state: 'moving_down', stale: false })).toBe('active');
});

test('a stale list is unknown, never an old state (not even an old fault)', () => {
  expect(shownState({ state: 'fault', stale: true })).toBe('unknown');
  expect(shownState({ state: 'moving_up', stale: true })).toBe('unknown');
  expect(chipOf({ state: 'waiting', stale: true }).tone).toBe('unknown');
  // an unexpected value from a newer server falls back to unknown
  expect(shownState({ state: 'teleporting' as ElevatorState, stale: false })).toBe('unknown');
});

test('home: no elevators = no tiles at all', () => {
  expect(homeTiles([])).toEqual([]);
});

test('home: a fire-service tile is loud and distinct from a fault', () => {
  const [f, g] = homeTiles([el('a', 'fire_service'), el('b', 'fault')]);
  expect(f.kind === 'elevator' && [f.chip.tone, f.chip.icon, f.chip.label]).toEqual(['error', 'flame', 'פיקוד כבאים']);
  expect(g.kind === 'elevator' && [g.chip.tone, g.chip.icon]).toEqual(['error', 'warning']);
});

test('home: one tile per elevator up to four, in the given order, each linking to the infrastructure screen', () => {
  const list = [el('a', 'waiting'), el('b', 'fault'), el('c', 'moving_up'), el('d', 'unknown')];
  const tiles = homeTiles(list);
  expect(tiles.map((t) => (t.kind === 'elevator' ? [t.id, t.chip.state] : null))).toEqual([['a', 'waiting'], ['b', 'fault'], ['c', 'active'], ['d', 'unknown']]);
  expect(tiles.every((t) => t.href === ELEVATORS_HREF)).toBe(true);
  expect(HOME_CHIP_MAX).toBe(4);
});

test('home: more than four fold into one summary; a fault makes it the loudest tile', () => {
  const calm = homeTiles([el('a', 'waiting'), el('b', 'moving_up'), el('c', 'waiting'), el('d', 'door_open'), el('e', 'moving_down')]);
  expect(calm).toHaveLength(1);
  expect(calm[0]).toMatchObject({ kind: 'summary', value: '5', tone: 'neutral', detail: '5 מעליות', icon: 'elevator' });
  const faulty = homeTiles([el('a', 'fault'), el('b', 'fault'), el('c', 'waiting'), el('d', 'out_of_service'), el('e', 'waiting')]);
  expect(faulty[0]).toMatchObject({ kind: 'summary', value: '5', tone: 'error', detail: '5 מעליות · 2 בתקלה', icon: 'warning' });
  // owner 2026-10-18: fire service is as loud as a fault, with its own icon and its own part of the summary
  const fire = homeTiles([el('a', 'fire_service'), el('b', 'fault'), el('c', 'active'), el('d', 'waiting'), el('e', 'active')]);
  expect(fire[0]).toMatchObject({ tone: 'error', icon: 'flame', detail: '5 מעליות · 1 בתקלה · 1 פיקוד כבאים' });
  const fireOnly = homeTiles([el('a', 'fire_service'), el('b', 'active'), el('c', 'active'), el('d', 'active'), el('e', 'active')]);
  expect(fireOnly[0]).toMatchObject({ tone: 'error', detail: '5 מעליות · 1 פיקוד כבאים' });
  const maint = homeTiles([el('a', 'out_of_service'), el('b', 'waiting'), el('c', 'waiting'), el('d', 'waiting'), el('e', 'waiting')]);
  expect(maint[0]).toMatchObject({ tone: 'stale' });
});

test('home: a stale response turns every tile unknown and a summary never counts stale faults', () => {
  const tiles = homeTiles([el('a', 'fault'), el('b', 'moving_up')], true);
  expect(tiles.map((t) => (t.kind === 'elevator' ? t.chip.state : ''))).toEqual(['unknown', 'unknown']);
  const many = homeTiles([el('a', 'fault'), el('b', 'fault'), el('c', 'fault'), el('d', 'fault'), el('e', 'fault')], true);
  expect(many[0]).toMatchObject({ tone: 'neutral', detail: '5 מעליות' });
});

test('draft: the client refuses what the server would refuse first', () => {
  const d = newDraft();
  expect(problemOf(d)).toBe('name');
  d.name = '  ';
  expect(problemOf(d)).toBe('name');
  d.name = 'A';
  expect(problemOf(d)).toBe('no_sensor');
  d.sensors.fault = 'binary_sensor.f';
  expect(problemOf(d)).toBeNull();
  d.sensors.moving_up = 'binary_sensor.f';
  expect(problemOf(d)).toBe('duplicate_sensor');
  d.sensors.moving_up = '';
  d.extras = [{ entity_id: 'binary_sensor.x', label: ' ' }];
  expect(problemOf(d)).toBe('extra_label');
  d.extras = Array.from({ length: 5 }, (_v, i) => ({ entity_id: `binary_sensor.x${i}`, label: 'x' }));
  expect(problemOf(d)).toBe('too_many_extras');
});

test('draft: round trip from a managed elevator to the request body (empty roles and empty extras left out)', () => {
  const m: ManagedElevator = {
    id: 'e1', name: 'A', area_id: null, area_name: null, state: 'waiting', reason: 'waiting', partial: false, stale: false, since: null, roles: ['fault', 'moving_up'],
    enabled: true, sort_order: 0, revision: 3,
    sensors: { fault: { entity_id: 'binary_sensor.f', entity_name: 'f', missing: false }, moving_up: { entity_id: 'binary_sensor.u', entity_name: 'u', missing: false } },
    extras: [{ entity_id: 'binary_sensor.x', label: 'אור', entity_name: 'x', missing: false }],
  };
  const d = draftOf(m);
  expect(d.sensors.moving_down).toBe('');
  d.extras.push({ entity_id: '', label: 'ריק' });
  expect(bodyOf(d)).toEqual({ name: 'A', enabled: true, sensors: { fault: 'binary_sensor.f', moving_up: 'binary_sensor.u' }, extras: [{ entity_id: 'binary_sensor.x', label: 'אור' }], revision: 3 });
});

test('reorder: one step up or down, unchanged at the edges', () => {
  expect(moved(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  expect(moved(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  expect(moved(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  expect(moved(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  expect(moved(['a'], 'z', 1)).toEqual(['a']);
});

test('strings: English is complete, Arabic / Russian are dev-marked, placeholders survive, no platform branding', () => {
  expect(ELT_KEYS.filter((k) => !ELT_TABLES.en[k])).toEqual([]);
  expect(ELT_DEV_MARKED).toEqual(['ar', 'ru']);
  expect(elt('summaryFault', { f: 1 }, 'en')).toBe('1 in fault');
  expect(elt('summaryFire', { k: 2 }, 'en')).toBe('2 fire service');
  expect(elt('stateFault', undefined, 'ru')).toBe('Неисправность');
  expect(elt('roleWaiting', undefined, 'ar')).toBe('ממתינה / עומדת'); // missing in ar -> Hebrew
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const v of Object.values(ELT_TABLES[lang])) expect(v ?? '').not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  }
});

test('tab gate: the elevators tab is hidden until an elevator exists, needs devices.read, and is never in the static demo', () => {
  const can = () => true;
  expect(visibleTabs(INFRA_TABS, true, can).some((t) => t.id === 'elevators')).toBe(false);
  applyInfraElevators(true);
  expect(visibleTabs(INFRA_TABS, true, can).some((t) => t.id === 'elevators')).toBe(true);
  expect(visibleTabs(INFRA_TABS, true, (p) => p !== 'devices.read').some((t) => t.id === 'elevators')).toBe(false);
  expect(visibleTabs(INFRA_TABS, false).some((t) => t.id === 'elevators')).toBe(false);
  applyInfraElevators(false);
  expect(visibleTabs(INFRA_TABS, true, can).some((t) => t.id === 'elevators')).toBe(false);
  expect(activeAreaTab({ path: '/infra/elevators', mode: 'infra', segments: ['infra', 'elevators'], params: new URLSearchParams() })).toBe('elevators');
});


// ---------------------------------------------------------------- 2.8.0: the designed screen, the home widget, the display settings

test('KPI counts as shown: a stale list counts only the total', () => {
  const list = [el('a', 'waiting'), el('b', 'active'), el('c', 'fault'), el('d', 'out_of_service'), el('e', 'fire_service'), el('f', 'unknown'), el('g', 'moving_up')];
  expect(kpisOf(list)).toEqual({ total: 7, ok: 3, fault: 1, off: 1, fire: 1, travel: 0, usesTravel: false });
  expect(kpisOf(list, true)).toEqual({ total: 7, ok: 0, fault: 0, off: 0, fire: 0, travel: 0, usesTravel: false });
});

test('sensor lights: the five roles in order, never a direction; unlinked roles are faded, dead ones are no value', () => {
  const leds = ledsOf({ roles: ['fault', 'waiting', 'moving_up'], flags: { fault: true, waiting: null, moving_up: true } });
  expect(leds.map((l) => l.role)).toEqual(['fire_service', 'fault', 'out_of_service', 'waiting', 'door_open']);
  expect(leds.map((l) => [l.on, l.na])).toEqual([[null, true], [true, false], [null, true], [null, false], [null, true]]);
  expect(ledsOf({ roles: ['fault'], flags: { fault: true } }, true)[1].on).toBeNull(); // stale: nothing is lit
});

test('the 24-hour bar: shares of the window, the unknown start left empty, segments outside clipped', () => {
  const lo = Date.parse('2027-01-15T00:00:00Z');
  const hi = lo + 24 * 3600_000;
  const b = barOf([
    { state: 'waiting', from: '2027-01-14T20:00:00Z', to: '2027-01-15T06:00:00Z' },
    { state: 'fault', from: '2027-01-15T06:00:00Z', to: '2027-01-15T12:00:00Z' },
    { state: 'moving_up', from: '2027-01-15T12:00:00Z', to: '2027-01-16T00:00:00Z' },
  ], lo, hi);
  expect(b.lead).toBe(0);
  expect(b.parts.map((p) => [p.look, Math.round(p.pct)])).toEqual([['wait', 25], ['fault', 25], ['act', 50]]);
  const late = barOf([{ state: 'out_of_service', from: '2027-01-15T18:00:00Z', to: '2027-01-16T00:00:00Z' }], lo, hi);
  expect([Math.round(late.lead), late.parts[0].look]).toEqual([75, 'off']);
  expect(barOf(null, lo, hi)).toEqual({ lead: 100, parts: [] });
  expect(barOf([], lo, hi).parts).toEqual([]);
});

test('relative times like the mockup ("מלפני 2 דק׳", "מאתמול")', () => {
  const now = new Date('2027-01-15T12:00:00Z');
  expect(agoText(null, now)).toBe('');
  expect(agoText('2027-01-15T11:59:40Z', now)).toBe('עכשיו');
  expect(agoText('2027-01-15T11:58:00Z', now)).toBe('מלפני 2 דק׳');
  expect(agoText('2027-01-15T09:00:00Z', now)).toBe('מלפני 3 שע׳');
  expect(agoText('2027-01-14T10:00:00Z', now)).toBe('מאתמול');
  expect(agoText('2027-01-11T10:00:00Z', now)).toBe('מלפני 4 ימים');
});

test('home widget: hidden elevators are out, the alerts filter lists only fire / fault / shutdown, the loudest leads', () => {
  const list = [el('a', 'waiting'), el('b', 'out_of_service'), el('c', 'fault'), el('d', 'fire_service')];
  const all = widgetView(list, { hidden: [], filter: 'all' });
  expect(all.items.map((x) => x.e.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(all.loudest?.e.id).toBe('d');
  const hid = widgetView(list, { hidden: ['d', 'c'], filter: 'all' });
  expect(hid.items.map((x) => x.e.id)).toEqual(['a', 'b']);
  expect(hid.loudest?.chip.look).toBe('off');
  expect(summaryLine(hid.kpis)).toBe('2 מעליות · 1 בהשבתה');
  const alerts = widgetView(list, { hidden: ['b'], filter: 'alerts' });
  expect(alerts.items.map((x) => x.e.id)).toEqual(['c', 'd']);
  expect(alerts.included.map((x) => x.e.id)).toEqual(['a', 'c', 'd']);
  expect(widgetView(list, { hidden: ['a', 'b', 'c', 'd'], filter: 'all' }).loudest).toBeNull();
  expect(summaryLine(kpisOf([el('a', 'waiting')]))).toBe('מעלית אחת');
});

test('home config: the elevators widget is appended last, tolerant parsing, absent unless the viewer sees an elevator', () => {
  const d = defaultConfig();
  expect(d.order.slice(-6)).toEqual(['elevators', 'temperature', 'generators', 'doors', 'notices', 'presence']); // phase 3 temperatures, then GENWIDGET 2.9.3 generators
  expect(d.elevators).toEqual({ on: true, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null, mode: 'combined', hidden: [], filter: 'all' });
  const c = configOf({ elevators: { mode: 'both', hidden: ['e1', 'e1', 'bad id', 7], filter: 'nope' } });
  expect([c.elevators.mode, c.elevators.hidden, c.elevators.filter]).toEqual(['both', ['e1'], 'all']);
  expect(configOf({ elevators: { mode: 'tiles' } }).elevators.mode).toBe('combined');
  const NO: HomeData = { weather: null, sensors: {}, alarm: null, agenda: null, names: {} };
  const ids = (opts: Parameters<typeof resolveWidgets>[3]) => resolveWidgets(d, 'a', NO, opts).map((i) => i.id);
  expect(ids({ editing: true })).not.toContain('elevators'); // not read yet / none: absent, no ghost even in edit mode
  expect(ids({ editing: true, elevatorsAvailable: false })).not.toContain('elevators');
  expect(ids({ elevatorsAvailable: true })).toContain('elevators');
  const off = { ...d, elevators: { ...d.elevators, on: false } };
  expect(resolveWidgets(off, 'a', NO, { elevatorsAvailable: true }).some((i) => i.id === 'elevators')).toBe(false);
  expect(resolveWidgets(off, 'a', NO, { elevatorsAvailable: true, editing: true }).find((i) => i.id === 'elevators')?.avail).toBe('off');
});

test('personal override: mode and hidden only for the elevators widget', () => {
  const p = personalOf({ widgets: { elevators: { mode: 'cards', hidden: ['e2', 'e2'], size: 'l' }, clock: { mode: 'cards', on: false } } });
  expect(p.widgets.elevators).toEqual({ mode: 'cards', hidden: ['e2'], size: 'l' });
  expect(p.widgets.clock).toEqual({ on: false });
  expect(personalOf({ widgets: { elevators: { mode: 'x' } } }).widgets.elevators).toBeUndefined();
});

test('the new strings exist in English and never name the home platform', () => {
  for (const k of ['kpiOk', 'modeCombined', 'modeCards', 'modeBoth', 'filterAlerts', 'noAlerts', 'futureNone', 'displayTitle'] as const) expect(ELT_TABLES.en[k], k).toBeTruthy();
});

test('alert settings helpers: master AND state, recipient count, toggling', () => {
  const st = (enabled: boolean) => ({ enabled, recipients: { roles: [], users: [], groups: [] }, channels: [] as ('push' | 'app')[] });
  const s = { enabled: false, states: { fire_service: st(true), fault: st(false), out_of_service: st(true) } };
  expect(alertActive(s, 'fire_service')).toBe(false); // the master switch is off (the owner's default)
  expect(alertActive({ ...s, enabled: true }, 'fire_service')).toBe(true);
  expect(alertActive({ ...s, enabled: true }, 'fault')).toBe(false);
  expect(recipientChoices({ roles: [], users: [], groups: [] })).toBe(0); // nothing selected = nobody
  expect(recipientChoices({ roles: ['operator'], users: ['u1', 'u2'], groups: ['g'] })).toBe(4);
  expect(toggled(['a'], 'b', true)).toEqual(['a', 'b']);
  expect(toggled(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
  expect(toggled(['a', 'b'], 'a', false)).toEqual(['b']);
  for (const k of ['alertsMaster', 'alertsOff', 'alertsRule', 'noRecipients', 'chNote'] as const) expect(ELT_TABLES.en[k], k).toBeTruthy();
});

// ---------------------------------------------------------------- independent review 2026-10-19 (frontend regression tests)

test('review L5: a user hides elevators in ADDITION to the installation list', () => {
  expect(personalHidden([], 'e2', false)).toEqual(['e2']);
  expect(personalHidden(['e2'], 'e2', true)).toEqual([]);
  expect(effectiveHidden(['e1'], ['e2', 'e1'])).toEqual(['e1', 'e2']);
  expect(effectiveHidden(['e1'], undefined)).toEqual(['e1']);
});

test('review L6: moves count only the listed widgets (the elevators widget left out without elevators)', () => {
  const order = defaultConfig().order; // ... 'agenda', 'launcher', 'elevators', 'temperature', 'generators'
  const listed = order.filter((id) => id !== 'elevators' && id !== 'temperature' && id !== 'generators' && id !== 'doors' && id !== 'notices'); // phase 3: the temperatures widget is appended after it
  // "move down" of the last LISTED widget: nothing to move past (the hidden elevators widget is not a neighbour)
  expect(moveAmong(order, listed, 'launcher', listed.length)).toEqual(order);
  expect(moveAmong(order, listed, 'agenda', listed.indexOf('launcher')).slice(-8)).toEqual(['launcher', 'agenda', 'elevators', 'temperature', 'generators', 'doors', 'notices', 'presence']);
  const mid: typeof order = ['clock', 'elevators', 'weather', 'shabbat', 'alarm', 'quick', 'media', 'agenda', 'launcher'];
  const listedMid = mid.filter((id) => id !== 'elevators');
  expect(moveAmong(mid, listedMid, 'weather', 0).slice(0, 3)).toEqual(['weather', 'clock', 'elevators']);
});

test('review L8: the lights and the 24-hour bar say their state in words', () => {
  const [fire, fault, off, wait, door] = ledsOf({ roles: ['fault', 'waiting', 'fire_service'], flags: { fault: true, waiting: null, fire_service: false } });
  expect([ledText(fire), ledText(fault), ledText(off), ledText(wait), ledText(door)]).toEqual(['פיקוד כבאים: כבוי', 'תקלה: פעיל', 'השבתה: לא מקושר', 'ממתינה: אין נתון', 'דלת: לא מקושר']);
  const lo = Date.parse('2027-01-15T00:00:00Z');
  const bar = barOf([{ state: 'waiting', from: '2027-01-15T00:00:00Z', to: '2027-01-15T18:00:00Z' }, { state: 'fault', from: '2027-01-15T18:00:00Z', to: '2027-01-16T00:00:00Z' }], lo, lo + 24 * 3600_000);
  expect(barSummary(bar)).toBe('24 שעות אחרונות: תקלה 6 שע׳, ממתינה 18 שע׳');
  expect(barSummary({ parts: [] })).toBe('24 שעות אחרונות: אין עדיין היסטוריה');
});
test('owner 2026-10-19: add-elevator affordances exist only in page edit mode for a manager (also with zero elevators)', () => {
  expect(addAffordances(true, false)).toEqual({ newButton: false, addCard: false, doneButton: false });
  expect(addAffordances(false, true)).toEqual({ newButton: false, addCard: false, doneButton: false });
  expect(addAffordances(true, true)).toEqual({ newButton: true, addCard: true, doneButton: true });
  expect(elt('editPage')).toBe('עריכת העמוד');
  expect(elt('editPage', undefined, 'en')).toBeTruthy();
  expect(elt('editDone', undefined, 'en')).toBeTruthy();
});

test('the elevators screen registers its page edit mode with the user menu and gates the affordances on it', () => {
  const src = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'screens', 'infra-elevators.ts'), 'utf8');
  expect(src).toMatch(/registerScreenEdit\(\{ id: 'elevators-edit'/);
  expect(src).toMatch(/can: \(\) => this\.access\.manage && !this\.editing/);
  expect(src).not.toMatch(/\$\{manage \?/);
});


// ELEVTRAVEL-291: the "travelling" state (per-elevator option, server-derived). The client never invents it.
test('travelling: its own chip and colour, apart from every other look; an old client/stale list never shows it', () => {
  const c = chipOf({ state: 'travelling', stale: false });
  expect([c.label, c.look, c.icon]).toEqual(['בנסיעה', 'trav', 'move']);
  const looks = (['waiting', 'active', 'fault', 'out_of_service', 'fire_service', 'unknown', 'travelling'] as ElevatorState[]).map((s) => chipOf({ state: s, stale: false }).look);
  expect(new Set(looks).size).toBe(7); // seven states, seven distinct colour families
  expect(chipOf({ state: 'travelling', stale: true }).state).toBe('unknown'); // stale list: unknown, never travelling
  expect(chipOf({ state: 'bogus' as ElevatorState, stale: false }).state).toBe('unknown');
});

test('travelling: priority matrix as shown - fire / fault / shutdown / waiting / unknown keep their chips, rank and counts', () => {
  const shown = (s: ElevatorState) => chipOf({ state: s, stale: false }).state;
  for (const s of ['fire_service', 'fault', 'out_of_service', 'waiting', 'door_open', 'unknown'] as ElevatorState[]) expect(shown(s)).toBe(s);
  const list = [el('a', 'travelling', { uses_travel: true }), el('b', 'fault', { uses_travel: true }), el('c', 'fire_service'), el('d', 'waiting', { uses_travel: true }), el('e', 'unknown')];
  const k = kpisOf(list);
  expect(k).toEqual({ total: 5, ok: 1, fault: 1, off: 0, fire: 1, travel: 1, usesTravel: true });
  expect(kpisOf(list, true)).toMatchObject({ ok: 0, travel: 0, fault: 0, fire: 0 }); // stale: nothing counted but the total
  const v = widgetView(list, { hidden: [], filter: 'all' });
  expect(v.loudest?.e.id).toBe('c'); // fire still the loudest
  expect(widgetView(list, { hidden: [], filter: 'alerts' }).items.map((x) => x.e.id)).toEqual(['b', 'c']); // travelling is not an alert state
  expect(summaryLine(k)).toBe('5 מעליות · 1 בתקלה · 1 פיקוד כבאים · 1 בנסיעה');
});

test('travelling: the KPI card exists only when an elevator uses the option (even with none travelling right now)', () => {
  expect(kpisOf([el('a', 'waiting'), el('b', 'active')]).usesTravel).toBe(false);
  const k = kpisOf([el('a', 'waiting', { uses_travel: true }), el('b', 'active')]);
  expect(k.usesTravel).toBe(true);
  expect(k.travel).toBe(0);
  expect(summaryLine(k)).toBe('2 מעליות'); // zero travelling adds no part
});

test('travelling: the 24-hour bar and its text carry the state; the popup rows label it', () => {
  const lo = Date.parse('2026-10-19T00:00:00Z');
  const hi = lo + 24 * 3600_000;
  const hist = [
    { state: 'waiting' as ElevatorState, from: new Date(lo).toISOString(), to: new Date(lo + 12 * 3600_000).toISOString() },
    { state: 'travelling' as ElevatorState, from: new Date(lo + 12 * 3600_000).toISOString(), to: new Date(hi).toISOString() },
  ];
  const bar = barOf(hist, lo, hi);
  expect(bar.parts.map((p) => [p.state, p.look])).toEqual([['waiting', 'wait'], ['travelling', 'trav']]);
  expect(barSummary(bar)).toContain('בנסיעה 12 שע׳');
  expect(historyRows(hist, hi).map((r) => [r.label, r.look])).toEqual([['בנסיעה', 'trav'], ['ממתינה', 'wait']]);
});

test('travelling: the option round-trips through the dialog draft (default off) and the strings exist in English', () => {
  const m = { id: 'x', name: 'A', area_id: null, area_name: null, enabled: true, sort_order: 0, revision: 3, sensors: { waiting: { entity_id: 'binary_sensor.w', entity_name: 'w', missing: false } }, extras: [],
    state: 'waiting', reason: 'waiting', partial: false, stale: false, since: null, roles: ['waiting'] } as unknown as ManagedElevator;
  expect(newDraft().showTravel).toBe(false);
  expect(draftOf(m).showTravel).toBe(false);
  expect(bodyOf(draftOf(m)).show_travel).toBeUndefined(); // off is the server default (a PUT replaces): the body stays as before
  expect(bodyOf({ ...draftOf(m), showTravel: true }).show_travel).toBe(true);
  expect(draftOf({ ...m, show_travel: true }).showTravel).toBe(true);
  for (const k of ['stateTravelling', 'kpiTravel', 'summaryTravel', 'travelOption', 'travelOptionHint'] as const) expect(ELT_TABLES.en[k], k).toBeTruthy();
  expect(elt('travelOption')).toBe('הצג נסיעה כשאינה ממתינה וללא תקלה');
});

// ELEVDOORS-293 (owner 2026-10-20): in operation the doors are drawn CLOSED, waiting they are drawn OPEN - the default when no sensor reports;
// a real door sensor that reports wins; fault / fire / out of service / unknown / travelling keep the doors shut.
test('door picture: active closed, waiting open by default; a reporting door sensor overrides', () => {
  const d = (state: ElevatorState, extra: Partial<Elevator> = {}) => chipOf({ state, stale: false, roles: [], ...extra }).doors;
  expect(d('active')).toBe('closed');
  expect(d('moving_up')).toBe('closed');
  expect(d('travelling')).toBe('closed');
  expect(d('waiting')).toBe('open');
  expect(d('door_open')).toBe('open');
  for (const s of ['fault', 'fire_service', 'out_of_service', 'unknown'] as ElevatorState[]) expect(d(s), s).toBe('closed');
  expect(chipOf({ state: 'waiting', stale: true }).doors).toBe('closed');
  // a linked door sensor that reports wins over the state's default
  expect(d('waiting', { roles: ['door_open'], flags: { door_open: false } })).toBe('closed');
  expect(d('active', { roles: ['door_open'], flags: { door_open: true } })).toBe('open');
  // linked but no value, or not linked: the default
  expect(d('waiting', { roles: ['door_open'], flags: { door_open: null } })).toBe('open');
  expect(d('active', { roles: [], flags: { door_open: true } })).toBe('closed');
});
