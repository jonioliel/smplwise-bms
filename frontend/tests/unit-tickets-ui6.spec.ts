import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadsFromBoard, managedDepartments, seesLoad } from '../src/tickets/handler-load';
import { SETTINGS_TABS, isSettingsTab, rovingIndex, visibleTabs } from '../src/tickets/settings-tabs';
import { UI6_EN, UI6_HE } from '../src/tickets/text-ui6';
import { tt } from '../src/tickets/text';

// TKUI6 (2.6.0): the pure parts of the redesigned "מטפלים וספקים" page and settings. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-ui6.spec.ts

test('the load of a handler: open / waiting for them / stuck, by assignee key; unassigned requests are nobody\'s', () => {
  const m = loadsFromBoard([
    { assignee_key: 'user:a', waiting_on: 'assignee' }, { assignee_key: 'user:a', waiting_on: 'none', stuck: { kind: 'stuck' } }, { assignee_key: 'user:a', waiting_on: 'manager' },
    { assignee_key: 'contact:c1' }, { assignee_key: 'none', waiting_on: 'manager' },
  ]);
  expect(m.get('user:a')).toEqual({ open: 3, waiting: 1, stuck: 1 });
  expect(m.get('contact:c1')).toEqual({ open: 1, waiting: 0, stuck: 0 });
  expect(m.has('none')).toBe(false);
});

test('only a manager of the person\'s department sees the load (owner decision)', () => {
  const managed = managedDepartments([{ id: 'd1', can_manage: true }, { id: 'd2', can_manage: false }]);
  expect(managed).toEqual(['d1']);
  expect(seesLoad(managed, ['d1', 'd2'])).toBe(true);
  expect(seesLoad(managed, ['d2'])).toBe(false);
  expect(seesLoad([], ['d1'])).toBe(false);
  expect(seesLoad(managed, [])).toBe(true); // an employee of every department
  expect(seesLoad([], [])).toBe(false);
});

test('the eight tabs of the settings, in the mock-up\'s order; what a viewer is offered', () => {
  expect(SETTINGS_TABS).toEqual(['general', 'departments', 'locations', 'display', 'channel', 'messages', 'costs', 'permissions']);
  expect(visibleTabs({ api: false, can: () => false })).toEqual([...SETTINGS_TABS]);
  expect(visibleTabs({ api: true, can: () => false })).toEqual(['general', 'departments', 'permissions']);
  expect(visibleTabs({ api: true, can: (p) => p === 'tickets.configure' })).toEqual(['general', 'departments', 'locations', 'messages', 'permissions']);
  expect(visibleTabs({ api: true, can: (p) => p === 'system.configure' })).toEqual(['general', 'departments', 'display', 'channel', 'costs', 'permissions']);
  expect(isSettingsTab('display')).toBe(true);
  expect(isSettingsTab('contacts')).toBe(false);
});

test('arrow keys in a tab list: the visual order follows the direction', () => {
  expect(rovingIndex('ArrowLeft', 0, 7, true)).toBe(1);
  expect(rovingIndex('ArrowRight', 0, 7, true)).toBe(6);
  expect(rovingIndex('ArrowRight', 0, 7, false)).toBe(1);
  expect(rovingIndex('End', 2, 7, true)).toBe(6);
  expect(rovingIndex('Home', 4, 7, false)).toBe(0);
  expect(rovingIndex('a', 4, 7, false)).toBeNull();
});

test('the texts: English for every Hebrew key, and never the words of a "call" in Hebrew', () => {
  for (const k of Object.keys(UI6_HE)) expect(UI6_EN[k as keyof typeof UI6_HE], k).toBeTruthy();
  expect(Object.values(UI6_HE).join('\n')).not.toMatch(/קריא(ה|ות|ת)/);
  expect(tt('u6TabDisplay')).toBe('תצוגה');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  for (const f of ['screens/tickets-handlers.ts', 'screens/system-tickets.ts', 'tickets/handlers-members.ts', 'tickets/contacts-directory.ts', 'tickets/handlers-glass.ts', 'tickets/handler-load.ts', 'tickets/settings-tabs.ts']) {
    expect(readFileSync(path.join(root, f), 'utf8'), f).not.toMatch(/קריא(ה|ות|ת)/);
  }
});

// HANDLERLOAD (owner 2026-10-17): the "handled" number and its period
import { asHandledDays, HANDLED_DEFAULT, HANDLED_STORAGE_KEY, installationHandledDays, readStoredPeriod, storePeriod, withHandled } from '../src/tickets/handler-load';

test('handled period: only 1 / 7 / 30 are accepted, in every spelling the browser or server may give', () => {
  expect(asHandledDays(1)).toBe(1);
  expect(asHandledDays('30')).toBe(30);
  for (const bad of [0, 2, 8, 31, '07', '7 ', '7.0', '', null, undefined, true, NaN, '1;7', {}]) expect(asHandledDays(bad), String(bad)).toBeNull();
  expect(installationHandledDays({ handled_days: 30 })).toBe(30);
  expect(installationHandledDays({ handled_days: 14 })).toBe(HANDLED_DEFAULT);
  expect(installationHandledDays(undefined)).toBe(7);
});

test('handled period: the viewer\'s choice is remembered; any storage failure or stale value falls back', () => {
  const mem = new Map<string, string>();
  const ok = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  expect(readStoredPeriod(ok)).toBeNull();
  storePeriod(30, ok);
  expect(mem.get(HANDLED_STORAGE_KEY)).toBe('30');
  expect(readStoredPeriod(ok)).toBe(30);
  mem.set(HANDLED_STORAGE_KEY, '14'); // an old / tampered value
  expect(readStoredPeriod(ok)).toBeNull();
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  expect(readStoredPeriod(broken)).toBeNull();
  expect(() => storePeriod(7, broken)).not.toThrow();
});

test('handled counts merge into the loads without touching open / waiting / stuck', () => {
  const loads = loadsFromBoard([{ assignee_key: 'user:a', waiting_on: 'assignee' }]);
  const merged = withHandled(loads, { 'user:a': 4, 'user:b': 2 })!;
  expect(merged.get('user:a')).toEqual({ open: 1, waiting: 1, stuck: 0, handled: 4 });
  expect(merged.get('user:b')).toEqual({ open: 0, waiting: 0, stuck: 0, handled: 2 }); // handled something, nothing open now
  expect(loads.get('user:a')).toEqual({ open: 1, waiting: 1, stuck: 0 }); // the input is not mutated
  expect(withHandled(loads, null)).toBe(loads); // not available -> no fourth number
  expect(withHandled(null, { 'user:a': 1 })).toBeNull(); // a viewer who manages nothing gets no numbers at all
});

test('handled texts exist in both languages and avoid the word "call"', () => {
  for (const k of ['u6Handled', 'u6HandledPeriodLabel', 'u6HandledP1', 'u6HandledP7', 'u6HandledP30'] as const) {
    expect(UI6_HE[k], k).toBeTruthy();
    expect(UI6_EN[k], k).toBeTruthy();
  }
  expect(UI6_HE.u6Handled).toBe('טופלו');
});
