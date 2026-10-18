import { test, expect } from '@playwright/test';
import { chipOf, homeTiles, shownState, HOME_CHIP_MAX, ELEVATORS_HREF } from '../src/elevators/model';
import { bodyOf, draftOf, moved, newDraft, problemOf } from '../src/elevators/draft';
import { ELT_DEV_MARKED, ELT_KEYS, ELT_TABLES, elt } from '../src/i18n/elevators';
import { INFRA_TABS, applyInfraElevators, visibleTabs, activeAreaTab } from '../src/shell/nav';
import type { Elevator, ElevatorState, ManagedElevator } from '../src/api/elevators';

// CR-INFRA-ELEVATORS: the presentation of the server-derived state (chip), the home tiles, the dialog draft, the strings and the tab gate.
// Pure functions, no browser.

const el = (id: string, state: ElevatorState, extra: Partial<Elevator> = {}): Elevator => ({
  id, name: `מעלית ${id}`, area_id: null, area_name: null, state, reason: state, partial: false, stale: false, since: null, roles: [], extras: [], ...extra,
});

test('every state has its chip: fault is the error tone, moving is live, unknown is grey', () => {
  const expected: Record<ElevatorState, [string, string, string]> = {
    fire_service: ['error', 'flame', 'פיקוד כבאים'],
    fault: ['error', 'warning', 'תקלה'],
    out_of_service: ['stale', 'pause', 'בהשבתה'],
    moving_up: ['live', 'arrowUp', 'עולה'],
    moving_down: ['live', 'arrowDown', 'יורדת'],
    door_open: ['neutral', 'door', 'דלת פתוחה'],
    waiting: ['neutral', 'elevator', 'ממתינה'],
    active: ['live', 'activity', 'פעילה'],
    unknown: ['unknown', 'elevator', 'לא ידוע'],
  };
  for (const [state, [tone, icon, label]] of Object.entries(expected)) {
    const c = chipOf({ state: state as ElevatorState, stale: false });
    expect([c.tone, c.icon, c.label], state).toEqual([tone, icon, label]);
  }
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
  expect(tiles.map((t) => (t.kind === 'elevator' ? [t.id, t.chip.state] : null))).toEqual([['a', 'waiting'], ['b', 'fault'], ['c', 'moving_up'], ['d', 'unknown']]);
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
