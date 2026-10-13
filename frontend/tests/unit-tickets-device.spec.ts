import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deviceTicketsOn, directTab, menuItems, pressPlan, sheetTabs, type LongPressMode } from '../src/tickets/device-entry';
import { activityTag, opensOnTap, parseTag } from '../src/components/device-activity-press';
import { DEVICE_TEXT_EN_KEYS, DEVICE_TEXT_KEYS, deviceTemplate, dt } from '../src/tickets/device-text';
import { historyNote, historyText } from '../src/tickets/ticket-device-context';
import { DEFAULT_TICKET_NAMES, setTicketNames } from '../src/tickets/naming';

// CR-038 slice 3 (section 12.1, owner decision D17): the long-press / right-click / Alt+Enter matrix row by row, the device window's tabs,
// the tag every catalogued row gets while the module is on, the device catalogue's completeness and the D33 rule, the history wording.

const HE_DEFAULT = /קריא(ה|ות)/;
const all = (...p: string[]) => (perm: string) => p.includes(perm);

test.describe('section 12.1 matrix: the long press', () => {
  const modes: LongPressMode[] = ['sheet', 'menu'];
  test('module off (or no tickets.view / devices.read): as today - the setting is ignored', () => {
    for (const mode of modes) {
      expect(pressPlan({ tracked: true, on: false, mode })).toEqual({ kind: 'sheet', tab: 'activity' });
      expect(pressPlan({ tracked: false, on: false, mode })).toBeNull();
    }
  });
  test('mode sheet (default): tracked -> the window on activity; other -> the window on the tickets tab', () => {
    expect(pressPlan({ tracked: true, on: true, mode: 'sheet' })).toEqual({ kind: 'sheet', tab: 'activity' });
    expect(pressPlan({ tracked: false, on: true, mode: 'sheet' })).toEqual({ kind: 'sheet', tab: 'tickets' });
  });
  test('mode menu: the opaque menu for every device', () => {
    expect(pressPlan({ tracked: true, on: true, mode: 'menu' })).toEqual({ kind: 'menu' });
    expect(pressPlan({ tracked: false, on: true, mode: 'menu' })).toEqual({ kind: 'menu' });
  });
  test('the entry exists only with the module on AND tickets.view AND devices.read', () => {
    expect(deviceTicketsOn(all('tickets.view', 'devices.read'), true)).toBe(true);
    expect(deviceTicketsOn(all('tickets.view', 'devices.read'), false)).toBe(false);
    expect(deviceTicketsOn(all('tickets.view'), true)).toBe(false);
    expect(deviceTicketsOn(all('devices.read', 'tickets.create'), true)).toBe(false);
  });
});

test.describe('section 12.1 matrix: the window tabs, Alt+Enter and the menu', () => {
  test('tabs: today\'s two for a tracked device, the tickets tab LAST; an other device gets that tab only', () => {
    expect(sheetTabs({ tracked: true, on: false })).toEqual(['activity', 'schedules']);
    expect(sheetTabs({ tracked: true, on: true })).toEqual(['activity', 'schedules', 'tickets']);
    expect(sheetTabs({ tracked: false, on: true })).toEqual(['tickets']);
    expect(sheetTabs({ tracked: false, on: false })).toEqual([]);
  });
  test('Alt+Enter opens the window on its first tab', () => {
    expect(directTab({ tracked: true, on: true })).toBe('activity');
    expect(directTab({ tracked: false, on: true })).toBe('tickets');
    expect(directTab({ tracked: false, on: false })).toBeNull();
  });
  test('module off: the right-click menu is exactly today\'s', () => {
    for (const mode of ['sheet', 'menu'] as const) {
      expect(menuItems({ tracked: true, on: false, mode, source: 'context', canOpenDevice: true, held: all('tickets.create') })).toEqual(['activity', 'schedules']);
    }
  });
  test('mode sheet: the right click gains "open a ticket" (with tickets.create); an other device also lists its tickets', () => {
    const base = { on: true, mode: 'sheet' as const, source: 'context' as const, canOpenDevice: true };
    expect(menuItems({ ...base, tracked: true, held: all('tickets.create') })).toEqual(['activity', 'schedules', 'ticket_new']);
    expect(menuItems({ ...base, tracked: true, held: all() })).toEqual(['activity', 'schedules']);
    expect(menuItems({ ...base, tracked: false, held: all('tickets.create') })).toEqual(['ticket_new', 'tickets']);
  });
  test('mode menu: long press and right click show the same menu; history only for a tracked device; items without permission absent', () => {
    for (const source of ['press', 'context'] as const) {
      const base = { on: true, mode: 'menu' as const, source, canOpenDevice: true, held: all('tickets.create') };
      expect(menuItems({ ...base, tracked: true })).toEqual(['device', 'activity', 'schedules', 'ticket_new', 'tickets']);
      expect(menuItems({ ...base, tracked: false })).toEqual(['device', 'ticket_new', 'tickets']);
      expect(menuItems({ ...base, tracked: false, held: all() })).toEqual(['device', 'tickets']);
      expect(menuItems({ ...base, tracked: false, canOpenDevice: false })).toEqual(['ticket_new', 'tickets']);
    }
  });
  test('"open the device" replays only an OPEN tap action (a plain row pill), never a toggle', () => {
    const el = (tag: string, variant: string | null) => ({ tagName: tag, getAttribute: (n: string) => (n === 'variant' ? variant : null) });
    expect(opensOnTap(el('SW-PILL', 'plain'))).toBe(true);
    expect(opensOnTap(el('SW-PILL', null))).toBe(true);
    expect(opensOnTap(el('SW-PILL', 'toggle'))).toBe(false);
    expect(opensOnTap(el('SW-PILL', 'slider'))).toBe(false);
    expect(opensOnTap(el('DIV', null))).toBe(false);
    expect(opensOnTap(null)).toBe(false);
  });
});

test.describe('the tag of a row', () => {
  const tracked = { entity_id: 'light.a', name: 'אור', activity: true, activity_kind: 'light' as const };
  const other = { entity_id: 'sensor.t', name: 'חיישן' };
  const lock = { entity_id: 'lock.f', name: 'דלת', activity: true, activity_kind: 'generic' as const, activity_permissions: ['door.unlock'] };
  test('module off: only server-flagged rows (as today)', () => {
    expect(parseTag(activityTag(tracked, 'דלוק', all(), false))).toEqual({ id: 'light.a', kind: 'light', name: 'אור', state: 'דלוק' });
    expect(activityTag(other, '21', all(), false)).toBeUndefined();
  });
  test('module on: every catalogued row, the untracked ones marked tracked:false', () => {
    expect(parseTag(activityTag(other, '21', all(), true))).toEqual({ id: 'sensor.t', kind: 'generic', name: 'חיישן', state: '21', tracked: false });
    expect(parseTag(activityTag(tracked, 'דלוק', all(), true))?.tracked).toBeUndefined();
  });
  test('a lock the user does not operate: no entry at all (the routes would refuse it)', () => {
    expect(activityTag(lock, '', all(), true)).toBeUndefined();
    expect(activityTag(lock, '', all('door.unlock'), true)).toBeDefined();
  });
});

test.describe('texts (D33) and the history wording', () => {
  test('every Hebrew text has an English one; none writes the default name', () => {
    expect([...DEVICE_TEXT_KEYS].sort()).toEqual([...DEVICE_TEXT_EN_KEYS].sort());
    for (const k of DEVICE_TEXT_KEYS) {
      expect(HE_DEFAULT.test(deviceTemplate(k, 'he')), k).toBe(false);
      expect(/\bTickets?\b/.test(deviceTemplate(k, 'en')), k).toBe(false);
    }
    const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/tickets/device-entry.ts'), 'utf8');
    expect(src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l) && HE_DEFAULT.test(l))).toEqual([]);
  });
  test('a rename reaches the tab, the menu and the settings row, with gender agreement', () => {
    setTicketNames({ he: { one: 'פנייה', many: 'פניות', gender: 'f' } });
    expect(dt('tab')).toBe('פניות');
    expect(dt('menuNew')).toBe('פתיחת פנייה');
    setTicketNames({ he: { one: 'אירוע', many: 'אירועים', gender: 'm' } });
    expect(dt('newBtn')).toBe('אירוע חדש');
    expect(dt('countChip', { n: 2 })).toBe('2 אירועים פתוחים');
    setTicketNames(null);
    expect(dt('menuList')).toContain(DEFAULT_TICKET_NAMES.he.many);
  });
  test('history lines never carry a person name; automations keep theirs', () => {
    const person = historyText({ at: '2026-10-13T10:05:00Z', kind: 'power', from: { state: 'off' }, to: { state: 'on' }, changed: ['state'], actor: { type: 'person' } });
    expect(person.who).toBe(dt('actor_person'));
    const auto = historyText({ at: '2026-10-13T10:05:00Z', kind: 'power', from: { state: 'on' }, to: { state: 'off' }, changed: ['state'], actor: { type: 'automation', name: 'כיבוי לילה' } });
    expect(auto.who).toBe(`${dt('actor_automation')}: כיבוי לילה`);
    expect(auto.what).toContain('←');
    const odd = historyText({ at: '2026-10-13T10:05:00Z', kind: 'state', from: {}, to: { state: '21.5' }, changed: ['state'], actor: { type: 'robot' } });
    expect(odd.who).toBe(dt('actor_unknown'));
  });
  test('the create sheet\'s history line', () => {
    const h = { source: 'device_activity' as const, window_hours: 24, window_from: null, window_to: null, count: 3, truncated: false, withheld: null, lines: [] };
    expect(historyNote(h)).toBe(dt('historyAttach', { h: 24, n: 3 }));
    expect(historyNote({ ...h, count: 0 })).toBe(dt('historyNone', { h: 24 }));
    expect(historyNote({ ...h, withheld: 'permission', source: 'none' })).toBe(dt('historyWithheld'));
    expect(historyNote(null)).toBe('');
  });
});
