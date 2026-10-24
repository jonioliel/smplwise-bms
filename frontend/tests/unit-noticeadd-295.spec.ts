import { test, expect } from '@playwright/test';
import { NOTICES_AREA, NOTICES_HREF, areaOf, applyNoticesHidden, crumbsOf, visibleAreas, visibleTabs, AREA_TABS, withNoticesArea, type Can } from '../src/shell/nav';
import { boardDraft, newDraft, validate, inputOf } from '../src/notices/model';
import { nt } from '../src/i18n/notices';
import type { RouteState } from '../src/router';

// NOTICEADD-295: the notice board's rail entry (owner decision 2026-10-24: directly under מולטימדיה, its own item without it, hidden
// while the module is off; not a settings tab) and the draft a board's "הודעות" tab writes. Node only - the modules the shell uses.

const ALL: Can = () => true;
const ids = (items: { id: string }[]) => items.map((i) => i.id);

function route(path: string): RouteState {
  const [p, q] = path.replace(/^#/, '').split('?');
  const segments = p.split('/').filter(Boolean);
  return { path: p, segments, params: new URLSearchParams(q ?? ''), mode: segments[0] as RouteState['mode'] };
}

test.afterEach(() => {
  applyNoticesHidden(false);
});

test('module off: no notice board entry in the rail', () => {
  applyNoticesHidden(false);
  expect(ids(visibleAreas(true, ALL))).not.toContain('notices');
  expect(ids(visibleAreas(false))).not.toContain('notices');
});

test('module on: the entry sits directly under מולטימדיה and opens the notice board page', () => {
  applyNoticesHidden(true);
  const list = visibleAreas(true, ALL);
  const at = ids(list).indexOf('multimedia');
  expect(at).toBeGreaterThanOrEqual(0);
  expect(list[at + 1]).toEqual(NOTICES_AREA);
  expect(NOTICES_AREA.href).toBe(NOTICES_HREF);
  expect(NOTICES_AREA.label).toBe('לוח הודעות');
  // the user's own order moves מולטימדיה - the entry follows it
  const mine = visibleAreas(true, ALL, ['multimedia', 'devices', 'security', 'explore', 'wiskey', 'infra', 'tickets']);
  expect(ids(mine).slice(0, 2)).toEqual(['multimedia', 'notices']);
});

test('module on without מולטימדיה: its own item, where מולטימדיה would stand', () => {
  applyNoticesHidden(true);
  const noMedia: Can = (p) => p !== 'media.read';
  const list = ids(visibleAreas(true, noMedia));
  expect(list).not.toContain('multimedia');
  expect(list).toContain('notices');
  const rank = (id: string) => ['devices', 'security', 'explore', 'multimedia', 'wiskey', 'infra', 'tickets'].indexOf(id);
  const base = [{ id: 'devices' }, { id: 'security' }, { id: 'explore' }, { id: 'wiskey' }] as Parameters<typeof withNoticesArea>[0];
  expect(ids(withNoticesArea(base, rank))).toEqual(['devices', 'security', 'explore', 'notices', 'wiskey']);
  expect(ids(withNoticesArea([{ id: 'devices' }] as Parameters<typeof withNoticesArea>[0], rank))).toEqual(['devices', 'notices']);
});

test('the notice board route lights its own rail entry, has no tab row and names itself in the crumbs; not a settings tab', () => {
  expect(areaOf(route(NOTICES_HREF))).toBe('notices');
  expect(areaOf(route('#/devices/building'))).toBe('devices');
  expect(AREA_TABS.notices).toEqual([]);
  expect(ids(AREA_TABS.devices)).not.toContain('notices');
  expect(crumbsOf(route(NOTICES_HREF), true)[0]).toBe('לוח הודעות');
  // the settings page (module switch, defaults, TV boards) stays where 2.16.0 had it; the rail entry is the notice board itself
  expect(ids(visibleTabs(AREA_TABS.system, true, ALL))).toContain('notices');
  expect(AREA_TABS.system.find((t) => t.id === 'notices')?.href).toBe('#/system/notices');
});

test("a board's new notice is tagged to that board, for the TV boards only, and valid once titled", () => {
  const now = new Date('2026-10-24T08:00:00');
  const d = boardDraft(now, 7, 'info', 'b1');
  expect(d.boards).toEqual(['b1']);
  expect(d.aud).toBe('tv');
  expect(d.status).toBe('new');
  expect(validate(d)).toBe('fTitle');
  const body = inputOf({ ...d, title: 'הפסקת מים' });
  expect(body.boards).toEqual(['b1']);
  expect(body.audience).toEqual({});
  expect(validate({ ...d, title: 'הפסקת מים' })).toBeNull();
  expect(newDraft(now, 7, 'info').boards).toEqual([]);
  expect(nt('newForBoard')).toBe('הודעה חדשה ללוח');
});
