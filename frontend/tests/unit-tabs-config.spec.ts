import { test, expect } from '@playwright/test';
import {
  AREA_TABS,
  ENTITIES_SETTINGS_HREF,
  LOCKED_TABS,
  MAP_HREFS,
  SECTION_TABS,
  SECURITY_SECTIONS,
  TAB_SECTIONS,
  applyTabsConfig,
  areaRowSection,
  configureTabs,
  normalizeTabStyles,
  tabStyleOf,
  defaultNavOrder,
  legacyRedirect,
  normalizeTabsConfig,
  securityTarget,
  tabAllowed,
  visibleAreas,
  visibleSections,
  visibleTabs,
  type Can,
} from '../src/shell/nav';
import { entryFloor, type CatalogTree } from '../src/api/catalog';
import type { RouteState } from '../src/router';

// הגדרות › כללי › לשוניות (owner 2026-09-30, `ui.tabs`) and the map's default floor: the pure rules of the shell's
// navigation. Node only - the same module the shell uses. The settings editor and the shell on a page are the evidence specs.

const ALL: Can = () => true;
const only = (...perms: string[]): Can => (p) => perms.includes(p);
const ids = (items: { id: string }[]) => items.map((i) => i.id);

function route(path: string): RouteState {
  const [p, q] = path.replace(/^#/, '').split('?');
  const segments = p.split('/').filter(Boolean);
  return { path: p, segments, params: new URLSearchParams(q ?? ''), mode: segments[0] as RouteState['mode'] };
}

test.afterEach(() => {
  applyTabsConfig({}); // the config is module state: every test starts from the built-in tabs
});

test('normalizeTabsConfig keeps only well-formed sections and ids and never throws', () => {
  expect(normalizeTabsConfig(undefined)).toEqual({});
  expect(normalizeTabsConfig(null)).toEqual({});
  expect(normalizeTabsConfig([])).toEqual({});
  expect(normalizeTabsConfig('not json')).toEqual({});
  expect(normalizeTabsConfig('{"explore":{"order":["floors","sites"],"hidden":[]}}')).toEqual({ explore: { order: ['floors', 'sites'], hidden: [] } });
  expect(
    normalizeTabsConfig({
      security: { order: ['investigate', 'live', 'live', 7, 'Bad Id'], hidden: ['x'] },
      'security.live': { order: [], hidden: [] }, // nothing to say: left out
      'Bad Section': { order: ['a'] },
      wiskey: 'nope',
    }),
  ).toEqual({ security: { order: ['investigate', 'live'], hidden: ['x'] } });
});

test('configureTabs: the named order first, the rest in default order, hidden dropped, unknown ids ignored', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  expect(configureTabs('explore', items)).toBe(items); // nothing configured: the very same list
  applyTabsConfig({ 'ui.tabs': { explore: { order: ['c', 'zzz', 'a'], hidden: ['b', 'nope'] } } });
  expect(ids(configureTabs('explore', items))).toEqual(['c', 'a', 'd']); // c, a named; d (not named) after; b hidden; ids the list lacks ignored
  expect(ids(configureTabs('explore', items, false))).toEqual(['a', 'c', 'd']); // the rail: the caller's own order stays
  expect(ids(configureTabs('wiskey', items))).toEqual(['a', 'b', 'c', 'd']); // another section is untouched
});

test('a section never ends up empty, and the way back to the editor cannot be hidden', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  applyTabsConfig({ 'ui.tabs': { explore: { order: [], hidden: ['a', 'b'] } } });
  expect(ids(configureTabs('explore', items))).toEqual(['a', 'b']); // everything hidden: shown after all, not a lock-out
  expect(LOCKED_TABS.system).toContain('general');
  applyTabsConfig({ 'ui.tabs': { system: { order: [], hidden: ['general', 'audit'] } } });
  const sys = [{ id: 'general' }, { id: 'audit' }, { id: 'storage' }];
  expect(ids(configureTabs('system', sys))).toEqual(['general', 'storage']);
});

test('every registry section comes from the arrays of nav.ts (nothing duplicated) and the map lost its device tab', () => {
  expect(TAB_SECTIONS.map((s) => s.id)).toEqual(['areas', 'devices', 'security', 'security.live', 'security.investigate', 'explore', 'wiskey', 'system', 'system.security']);
  const byId = Object.fromEntries(TAB_SECTIONS.map((s) => [s.id, ids(s.tabs())]));
  expect(byId['areas']).toEqual(['devices', 'security', 'explore', 'multimedia', 'wiskey']); // CR-015: multimedia sits between the map and WisKey
  expect(byId['devices']).toEqual(['building', 'schedules', 'automations']); // CR-014: the home area's tabs; CR-017: the third
  expect(byId['security']).toEqual(ids(SECURITY_SECTIONS));
  expect(byId['security.live']).toEqual(ids(SECTION_TABS.live));
  expect(byId['security.investigate']).toEqual(ids(SECTION_TABS.investigate));
  expect(byId['explore']).toEqual(['sites', 'floors']);
  expect(MAP_HREFS).not.toContain('#/explore/entities');
  expect(AREA_TABS.system.some((t) => t.href === ENTITIES_SETTINGS_HREF)).toBe(true);
  for (const s of TAB_SECTIONS) expect(s.tabs().length, s.id).toBeGreaterThan(1 - (s.id === 'wiskey' ? 1 : 0));
});

test('tab rows follow the order and the hidden list; permissions still apply first', () => {
  applyTabsConfig({ 'ui.tabs': { 'security.investigate': { order: ['search', 'events'], hidden: ['cases', 'rules'] } } });
  const inv = visibleTabs(SECTION_TABS.investigate, true, ALL);
  expect(ids(inv).slice(0, 3)).toEqual(['search', 'events', 'playback']);
  expect(ids(inv)).not.toContain('cases');
  expect(ids(inv)).not.toContain('rules');
  // a user without events.read never sees search / events, whatever the order says: their first tab is the next permitted one
  const limited = visibleTabs(SECTION_TABS.investigate, true, only('video.playback', 'video.live'));
  expect(ids(limited)).toEqual(['playback', 'sync', 'history', 'health']);
  // the demo (no backend) shows the built-in tabs
  expect(visibleTabs(SECTION_TABS.investigate, false)).toBe(SECTION_TABS.investigate);
});

test('the security sections: first visible tab of the configured order is where each section lands; the order of לייב / חקירה is configurable', () => {
  expect(visibleSections(true, ALL).map((s) => [s.id, s.href])).toEqual([['live', '#/live'], ['investigate', '#/investigate/events'], ['alarm', '#/security/alarm']]); // the alarm is a section of the security area again (0.1.147)
  applyTabsConfig({
    'ui.tabs': {
      security: { order: ['investigate', 'live'], hidden: [] },
      'security.live': { order: ['wall', 'views'], hidden: ['overview'] },
      'security.investigate': { order: ['playback'], hidden: [] },
    },
  });
  const sections = visibleSections(true, ALL);
  expect(sections.map((s) => [s.id, s.href])).toEqual([['investigate', '#/investigate/playback'], ['live', '#/live/wall'], ['alarm', '#/security/alarm']]); // the alarm keeps its default place (last) when not configured
  expect(securityTarget(true, ALL)).toBe('#/investigate/playback'); // no last-used section in node: the first visible one
  // hiding a whole section removes it from the control; the other stays
  applyTabsConfig({ 'ui.tabs': { security: { order: [], hidden: ['investigate'] } } });
  expect(visibleSections(true, ALL).map((s) => s.id)).toEqual(['live', 'alarm']);
});

test('the rail: the admin order is the default, the user own order wins, hidden areas leave, an area lands on its first visible tab', () => {
  expect(ids(visibleAreas(true, ALL))).toEqual(['devices', 'security', 'explore', 'multimedia', 'wiskey']);
  applyTabsConfig({ 'ui.tabs': { areas: { order: ['explore', 'security'], hidden: ['wiskey'] }, explore: { order: ['floors', 'sites'], hidden: [] } } });
  expect(defaultNavOrder()).toEqual(['explore', 'security', 'devices', 'multimedia', 'wiskey']);
  const rail = visibleAreas(true, ALL); // default order = the admin's
  expect(ids(rail)).toEqual(['explore', 'security', 'devices', 'multimedia']);
  expect(rail[0].href).toBe('#/explore/floors/f0'); // the map lands on the floor map: the order decides
  // a user's own order (passed by the shell) wins over the admin's for that user; the admin's hidden list still applies
  expect(ids(visibleAreas(true, ALL, ['wiskey', 'devices', 'security', 'explore']))).toEqual(['devices', 'security', 'explore', 'multimedia']); // an id the order does not name keeps its default place after the named ones
});

test('the device catalogue is a settings page for system.configure at the installation, not a map tab', () => {
  expect(tabAllowed(ENTITIES_SETTINGS_HREF, only('system.configure'))).toBe(true);
  expect(tabAllowed(ENTITIES_SETTINGS_HREF, (p, installationOnly) => p === 'system.configure' && !installationOnly)).toBe(false); // a floor-scoped holder does not count
  expect(tabAllowed(ENTITIES_SETTINGS_HREF, only('entity.state.read', 'map.read', 'placement.edit', 'map.edit'))).toBe(false);
  expect(ids(visibleTabs(AREA_TABS.explore, true, ALL))).toEqual(['sites', 'floors']);
  expect(ids(visibleTabs(AREA_TABS.system, true, ALL))).toContain('entities');
  expect(ids(visibleTabs(AREA_TABS.system, true, only('audit.read')))).not.toContain('entities');
});

test('#/explore/entities redirects: settings for holders of system.configure (query kept), the map for the rest, nothing decided while loading', () => {
  const r = route('/explore/entities?q=light.hall');
  expect(legacyRedirect(r)).toBe('/system/entities?q=light.hall'); // no session information: the settings page checks itself
  const ready = { api: true, ready: true };
  expect(legacyRedirect(r, { ...ready, can: only('system.configure') })).toBe('/system/entities?q=light.hall');
  expect(legacyRedirect(r, { ...ready, can: only('entity.state.read', 'map.read') })).toBe('/explore/floors/f0');
  expect(legacyRedirect(r, { api: true, ready: false, can: ALL })).toBeNull();
  expect(legacyRedirect(r, { api: false, ready: true, can: () => false })).toBe('/system/entities?q=light.hall'); // the demo shows everything
  expect(legacyRedirect(route('/explore/entities'), { ...ready, can: only('system.configure') })).toBe('/system/entities');
  // the older moves still work, and other routes stay
  expect(legacyRedirect(route('/security/alarm?panel=p1'))).toBeNull(); // canonical again: no redirect (0.1.147)
  expect(legacyRedirect(route('/explore/floors/f0'))).toBeNull();
});

test('tabStyleOf: the section override, else the level default, else the built-in (level 1 pill, level 2 compact underline)', () => {
  expect(tabStyleOf('explore')).toBe('pill');
  expect(tabStyleOf('devices')).toBe('pill');
  expect(tabStyleOf('security')).toBe('pill');
  expect(tabStyleOf('security.live')).toBe('underline-compact');
  expect(tabStyleOf('system.security')).toBe('underline-compact');
  expect(tabStyleOf(null, 2)).toBe('underline-compact');
  applyTabsConfig({ 'ui.tabs': { styles: { level1: 'underline', level2: 'pill' }, explore: { order: [], hidden: [], style: 'underline-compact' } } });
  expect(tabStyleOf('wiskey')).toBe('underline');
  expect(tabStyleOf('security.investigate')).toBe('pill');
  expect(tabStyleOf('explore')).toBe('underline-compact'); // the override wins over the level default
  expect(tabStyleOf('unknown-section', 2)).toBe('pill'); // an unknown section takes the level it is asked for
  // unknown values and the reserved key never break the sections
  expect(normalizeTabsConfig({ styles: { level1: 'pill' }, explore: { style: 'glass' } })).toEqual({});
  expect(normalizeTabsConfig({ explore: { style: 'underline' } })).toEqual({ explore: { order: [], hidden: [], style: 'underline' } });
  expect(normalizeTabStyles({ styles: { level1: 'rounded', level2: 'underline' } })).toEqual({ level2: 'underline' });
  expect(normalizeTabStyles('not json')).toEqual({});
  expect(normalizeTabStyles({ styles: [] })).toEqual({});
  applyTabsConfig({ 'ui.tabs': { explore: { order: ['floors'], hidden: [] } } }); // an old config: the defaults again
  expect(tabStyleOf('explore')).toBe('pill');
  expect(tabStyleOf('security.live')).toBe('underline-compact');
  expect(areaRowSection('security', 'live')).toBe('security.live');
  expect(areaRowSection('explore', null)).toBe('explore');
});

test('the map default floor: the setting when it is in the user tree, else the first readable floor', () => {
  const floor = (id: string) => ({ id, building_id: 'b', name: id, level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
  const tree = {
    source: 'api',
    canCreateSite: false,
    sites: [{ id: 's', name: 'S', address: '', timezone: 'UTC', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's', name: 'B1', sort_order: 0, updated_at: '', floors: [floor('f-a'), floor('f-b')] }, { id: 'b2', site_id: 's', name: 'B2', sort_order: 1, updated_at: '', floors: [floor('f-c')] }] }],
  } as unknown as CatalogTree;
  expect(entryFloor(tree, 'f-c')?.id).toBe('f-c');
  expect(entryFloor(tree, '')?.id).toBe('f-a'); // automatic
  expect(entryFloor(tree, undefined)?.id).toBe('f-a');
  expect(entryFloor(tree, 'deleted-floor')?.id).toBe('f-a'); // gone, or a floor this user's tree does not hold
  expect(entryFloor({ ...tree, sites: [] } as CatalogTree, 'f-c')).toBeNull();
});
