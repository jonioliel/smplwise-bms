import { test, expect } from '@playwright/test';
import {
  AREA_TABS, AUTOMATIONS_HREF, AUTOMATIONS_SETTINGS_HREF, DEVICES_TABS, HIDDEN_HREFS, INSTALLATION_ONLY_HREFS, activeAreaTab, applyAutomationsHidden, crumbsOf, onTabsConfig, tabAllowed, visibleTabs, type Can,
} from '../src/shell/nav';
import type { RouteState } from '../src/router';
import { resetAutomationsMock, type AutomationsMockStore } from '../src/api/automations-mock';
import { visibleKinds, type AutomationsStatus, type Item, type ScriptDraft } from '../src/api/automations';
import {
  BASE, CODE_VIEW_ROLES, NO_FILTERS, ROLE_ROWS, STATE_FILTERS, ATTR_DEFS, applyFilters, areaLine, banners, cardChips, confirmLine, countsOf, delegationLabel, deletedText, editPath,
  fieldDefaults, filtersActive, filtersFromParams, filtersToParams, floorLine, floorOptions, groupScenes, hiddenScenes, itemPath, keepText, missingFields, moveTemplate, needsAttention, newButton,
  newPath, parseAutomationsRoute, runLine, runRows, sceneLine, screenKind, segmentOf, segmentOfKind, stateCounts, templateRows, toggleCodeRole, toggleHidden, trashPath, visibleAttrs, whenText, withValue,
} from '../src/screens/automations-logic';

// CR-017 S3: the pure logic of the automations screens (route, filters, the card's lines and chips, scene groups, banners, settings tables, the capture table's
// value rules) over the S0 mock's fixture house. No browser page: tests/evidence-automations-list.spec.ts covers the elements.

const TZ = 'Asia/Jerusalem';
const NOW = new Date('2026-10-01T15:46:00Z'); // the mock's fixed clock

async function house(user: 'installer' | 'household' | 'viewer' = 'installer', extra: Parameters<typeof resetAutomationsMock>[0] = {}): Promise<{ m: AutomationsMockStore; items: Item[]; status: AutomationsStatus }> {
  const m = resetAutomationsMock({ user, ...extra });
  const [list, status] = await Promise.all([m.list({ limit: 500 }), m.status()]);
  return { m, items: list.items, status };
}
const byEntity = (m: AutomationsMockStore, items: Item[], entity: string): Item => items.find((i) => i.id === m.idOf(entity))!;

// ---------------------------------------------------------------------------------------------------------------- the route

test.describe('automations route', () => {
  const parse = (path: string, q = '') => parseAutomationsRoute(path.split('/').filter(Boolean), new URLSearchParams(q));

  test('the list, the segments, an item, the trash and the builder routes', () => {
    expect(parse('/devices/automations')).toMatchObject({ segment: 'automations', id: '', trash: false, view: 'detail', edit: false });
    expect(parse('/devices/automations/scenes')).toMatchObject({ segment: 'scenes', id: '' });
    expect(parse('/devices/automations/scripts/1727700000100')).toMatchObject({ segment: 'scripts', id: '1727700000100' });
    expect(parse('/devices/automations/scenes/new')).toMatchObject({ segment: 'scenes', id: 'new' });
    expect(parse('/devices/automations/1727700000002')).toMatchObject({ segment: 'automations', id: '1727700000002' }); // CR-018's deep link
    expect(parse('/devices/automations/trash')).toMatchObject({ trash: true, id: '' });
    expect(parse('/devices/automations/1727700000002/edit')).toMatchObject({ edit: true, id: '1727700000002' });
    expect(parse('/devices/automations/new/edit', 'kind=script')).toMatchObject({ edit: true, id: '' });
    expect(parse('/devices/automations/scripts/arx_1727/edit')).toMatchObject({ segment: 'scripts', id: 'arx_1727', edit: true });
  });

  test('an id with a colon (an item without a config id) survives the address', () => {
    const id = 'entity:automation.irrigation_shabbat';
    const path = itemPath('automations', id);
    expect(path).toBe(`${BASE}/entity%3Aautomation.irrigation_shabbat`);
    expect(parse(path).id).toBe(id);
    expect(editPath('script', 'arx_9')).toBe(`${BASE}/scripts/arx_9/edit`);
    expect(editPath('automation', '5')).toBe(`${BASE}/5/edit`);
    expect(newPath('scene')).toEqual({ path: `${BASE}/new/edit`, params: { kind: 'scene' } });
    expect(trashPath()).toBe(`${BASE}/trash`);
  });

  test('the drawer views and the run come from the query', () => {
    expect(parse('/devices/automations/5', 'view=trace&run=r4')).toMatchObject({ view: 'trace', run: 'r4' });
    expect(parse('/devices/automations/5', 'view=versions').view).toBe('versions');
    expect(parse('/devices/automations/5', 'view=dryrun').view).toBe('dryrun');
    expect(parse('/devices/automations/5', 'view=unknown').view).toBe('detail');
  });

  test('segments map to kinds and labels', () => {
    expect(segmentOf('scenes').kind).toBe('scene');
    expect(segmentOfKind('script').id).toBe('scripts');
    expect(segmentOf('automations').newLabel).toBe('חדש');
  });
});

// ---------------------------------------------------------------------------------------------------------------- filters

test.describe('list filters', () => {
  test('the address round-trips the filters; defaults write nothing', () => {
    expect(filtersToParams(NO_FILTERS).toString()).toBe('');
    const p = filtersToParams({ q: 'מזגן', floor: 'f1', state: 'sensitive' }, { view: 'trace', run: '' });
    expect(filtersFromParams(p)).toEqual({ q: 'מזגן', floor: 'f1', state: 'sensitive' });
    expect(p.get('view')).toBe('trace');
    expect(p.has('run')).toBe(false);
    expect(filtersFromParams(new URLSearchParams('state=bogus')).state).toBe('all');
    expect(filtersActive({ q: 'x', floor: '', state: 'on' })).toBe(2);
    expect(STATE_FILTERS.map((f) => f.id)).toEqual(['all', 'on', 'off', 'sensitive', 'attention']);
  });

  test('the state counts and the filters over the installer\'s house', async () => {
    const { m, items } = await house();
    const autos = items.filter((i) => i.kind === 'automation');
    const c = stateCounts(autos);
    expect(c.all).toBe(autos.length);
    expect(c.on + c.off).toBeLessThanOrEqual(c.all);
    expect(c.sensitive).toBe(autos.filter((i) => i.sensitive).length);
    // what needs a look: the boiler (missing device and a failed last run)
    const boiler = byEntity(m, items, 'automation.boiler_morning');
    expect(needsAttention(boiler)).toBe(true);
    expect(needsAttention(byEntity(m, items, 'automation.hall_motion'))).toBe(false);
    const attention = applyFilters(items, { ...NO_FILTERS, state: 'attention' }, 'automation');
    expect(attention.map((i) => i.id)).toContain(boiler.id);
    expect(attention.length).toBe(c.attention);
    // search over name, sentence and device names; a floor; sensitive
    expect(applyFilters(items, { ...NO_FILTERS, q: 'פרוזדור' }, 'automation').map((i) => i.id)).toContain(byEntity(m, items, 'automation.hall_motion').id);
    const f1 = applyFilters(items, { ...NO_FILTERS, floor: 'f1' }, 'automation');
    expect(f1.length).toBeGreaterThan(0);
    expect(f1.every((i) => i.floors.some((f) => f.id === 'f1'))).toBe(true);
    expect(applyFilters(items, { ...NO_FILTERS, state: 'sensitive' }, 'automation').every((i) => i.sensitive)).toBe(true);
    expect(applyFilters(items, { ...NO_FILTERS, state: 'off' }, 'automation').every((i) => i.state === 'off')).toBe(true);
    // the state filter belongs to automations only
    expect(applyFilters(items, { ...NO_FILTERS, state: 'off' }, 'script').length).toBe(items.filter((i) => i.kind === 'script').length);
    // most recently run first
    const sorted = applyFilters(items, NO_FILTERS, 'automation');
    expect(sorted[0].id).toBe(byEntity(m, items, 'automation.hall_motion').id);
  });

  test('floor chips and the segment counts follow what the caller sees (the viewer has floor 1 only)', async () => {
    const wide = await house();
    const narrow = await house('viewer');
    expect(floorOptions(wide.items.filter((i) => i.kind === 'automation')).map((f) => f.id).sort()).toEqual(expect.arrayContaining(['f1', 'g']));
    const f = floorOptions(narrow.items);
    expect(f.map((x) => x.id)).toEqual(['f1']);
    expect(f[0].count).toBeGreaterThan(0);
    const counts = countsOf(wide.items);
    expect(counts.automation).toBe(wide.items.filter((i) => i.kind === 'automation').length);
    expect(counts.scene).toBe(wide.items.filter((i) => i.kind === 'scene' && !i.hidden).length);
    expect(countsOf(narrow.items).automation).toBeLessThan(counts.automation);
  });
});

// ---------------------------------------------------------------------------------------------------------------- the card

test.describe('the card', () => {
  test('floor and area lines: one floor, two, three and none', () => {
    expect(floorLine({ floors: [] })).toBe('כל הבית');
    expect(floorLine({ floors: [{ id: 'f1', name: 'קומה 1' }] })).toBe('קומה 1');
    expect(floorLine({ floors: [{ id: 'g', name: 'קומת קרקע' }, { id: 'f1', name: 'קומה 1' }] })).toBe('קומת קרקע · קומה 1');
    expect(floorLine({ floors: [{ id: 'a', name: 'א' }, { id: 'b', name: 'ב' }, { id: 'c', name: 'ג' }] })).toBe('א · ב +1');
    expect(areaLine({ areas: [] })).toBe('');
    expect(areaLine({ areas: [{ id: '1', name: 'סלון' }, { id: '2', name: 'מטבח' }, { id: '3', name: 'כניסה' }, { id: '4', name: 'חדר' }] })).toBe('סלון · מטבח · כניסה +1');
  });

  test('the run line: minutes ago with a count, a failure with its time, never run, running', async () => {
    const { m, items } = await house();
    const hall = runLine(byEntity(m, items, 'automation.hall_motion'), NOW, TZ);
    expect(hall.text).toBe('רצה לפני 4 דק׳ · 38 ריצות');
    expect(hall.tone).toBe('ok');
    expect(hall.title).toBe('ב־7 הימים האחרונים');
    const boiler = runLine(byEntity(m, items, 'automation.boiler_morning'), NOW, TZ);
    expect(boiler.tone).toBe('bad');
    expect(boiler.text).toMatch(/^נכשלה .* · 6 ריצות$/);
    expect(runLine(byEntity(m, items, 'automation.vacation_freeze'), NOW, TZ)).toMatchObject({ text: 'עוד לא רצה', tone: 'none' });
    expect(runLine({ kind: 'script', last_run: { at: NOW.toISOString(), result: 'running' }, runs_7d: null }, NOW, TZ)).toMatchObject({ text: 'הורץ עכשיו', tone: 'run' });
    expect(runLine({ kind: 'script', last_run: null, runs_7d: null }, NOW, TZ).text).toBe('עוד לא הורץ');
  });

  test('when text: today, yesterday and an older day', () => {
    expect(whenText('2026-10-01T15:42:00Z', NOW, TZ)).toBe('היום 18:42');
    expect(whenText('2026-09-30T20:50:00Z', NOW, TZ)).toBe('אתמול 23:50');
    expect(whenText('2026-09-28T18:02:00Z', NOW, TZ)).toMatch(/^28\/09 21:02$/);
  });

  test('chips: the sensitive chip follows its setting; the padlock chip carries its count; the off state is the toggle, not a chip', async () => {
    const { m, items } = await house();
    const allLeft = byEntity(m, items, 'automation.all_left');
    expect(cardChips(allLeft).map((c) => c.id)).toContain('sensitive');
    expect(cardChips(allLeft, { sensitiveWarning: false }).map((c) => c.id)).not.toContain('sensitive');
    const buttons = byEntity(m, items, 'automation.salon_buttons');
    const lock = cardChips(buttons).find((c) => c.id === 'locked')!;
    expect(lock.count).toBe(buttons.locked_count);
    expect(lock.label).toBe(`${buttons.locked_count} חלקים נעולים`);
    expect(cardChips(byEntity(m, items, 'automation.boiler_morning')).map((c) => c.id)).toContain('missing');
    expect(cardChips(byEntity(m, items, 'automation.vacation_freeze')).map((c) => c.id)).not.toContain('off');
    // the outside change of the legacy item, the view-only item
    expect(cardChips(byEntity(m, items, 'automation.alarm_morning')).map((c) => c.id)).toContain('changed_outside');
    expect(cardChips(byEntity(m, items, 'automation.irrigation_shabbat')).map((c) => c.id)).toContain('read_only');
  });

  test('the confirmation line names the sensitive targets, or says the effect is unknown', async () => {
    const { m, items } = await house();
    expect(confirmLine(byEntity(m, items, 'automation.all_left'))).toBe('כולל אזעקה – כמו בשליטה ידנית.');
    expect(confirmLine({ sensitive: false, unknown_effects: true, targets: [] })).toBe('כולל פעולה מתקדמת שהשפעתה אינה ידועה.');
    expect(confirmLine({ sensitive: false, unknown_effects: false, targets: [] })).toBe('');
    expect(confirmLine({ sensitive: true, unknown_effects: false, targets: [] })).toBe('כולל פעולה רגישה – כמו בשליטה ידנית.');
  });

  test('run rows: a label, a tone and the sentence', () => {
    const rows = runRows([
      { run_id: 'r1', at: '2026-10-01T15:42:00Z', finished_at: null, result: 'ok', sentence: 'א' },
      { run_id: 'r2', at: '2026-09-30T20:50:00Z', finished_at: null, result: 'error', sentence: 'ב' },
      { run_id: 'r3', at: '2026-09-30T10:00:00Z', finished_at: null, result: 'not_triggered', sentence: 'ג' },
    ], NOW, TZ);
    expect(rows.map((r) => [r.label, r.tone])).toEqual([['היום 18:42', 'ok'], ['אתמול 23:50', 'bad'], ['אתמול 13:00', 'none']]);
  });
});

// ---------------------------------------------------------------------------------------------------------------- scenes

test.describe('scenes', () => {
  test('favourites first, then one section per area; a hidden scene is in none of them', async () => {
    const { m, items } = await house();
    const groups = groupScenes(items);
    expect(groups[0].id).toBe('favourites');
    expect(groups[0].items.map((i) => i.name).sort()).toEqual(['ברוכים הבאים', 'סלון · ערב'].sort());
    expect(groups.slice(1).every((g) => g.id.startsWith('area:'))).toBe(true);
    const names = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(names).not.toContain(m.idOf('scene.bed_night'));
    expect(hiddenScenes(items).map((i) => i.id)).toEqual([m.idOf('scene.bed_night')]);
    const salon = groups.find((g) => g.title === 'סלון')!;
    expect(salon.sub).toBe(`${salon.items.length} סצנות`);
  });

  test('the card line: when it was activated, how many devices', async () => {
    const { m, items } = await house();
    const evening = byEntity(m, items, 'scene.salon_evening');
    expect(sceneLine(evening, NOW, TZ)).toMatch(/^הופעלה (אתמול|היום) \d\d:\d\d$/);
    expect(sceneLine(byEntity(m, items, 'scene.kitchen_cook'), NOW, TZ)).toBe('עוד לא הופעלה');
    expect(sceneLine(evening, NOW, TZ, 5)).toMatch(/ · 5 מכשירים$/);
  });

  test('the capture table: states per domain, the numbers in UI units, a value removed when blank', async () => {
    const { m } = await house();
    const cap = await m.capture({ entity_ids: ['light.salon', 'cover.salon_shutter', 'climate.salon', 'switch.irrigation'] });
    const light = cap.members.find((x) => x.entity_id === 'light.salon')!;
    expect(visibleAttrs(light).map((d) => d.key)).toEqual(expect.arrayContaining(['brightness', 'color_temp_kelvin']));
    const dimmer = withValue(light, { attr: { key: 'brightness', ui: 50 } });
    expect(dimmer.attributes.brightness).toBe(128); // 50 % of 255
    expect(withValue(dimmer, { attr: { key: 'brightness', ui: null } }).attributes.brightness).toBeUndefined();
    const off = withValue(light, { state: 'off' });
    expect(off.state).toBe('off');
    expect(Object.keys(off.attributes)).toEqual([]); // a light that is off keeps no brightness
    const cover = cap.members.find((x) => x.entity_id === 'cover.salon_shutter')!;
    expect(visibleAttrs(cover).map((d) => d.key)).toEqual(['current_position']);
    expect(withValue(cover, { state: 'closed' }).attributes.current_position).toBe(100); // a closed cover keeps its position field
    expect(visibleAttrs(cap.members.find((x) => x.entity_id === 'switch.irrigation')!)).toEqual([]);
    expect(ATTR_DEFS.light[0].toUi!(204)).toBe(80);
  });
});

// ---------------------------------------------------------------------------------------------------------------- banners, state, the new button

test.describe('banners and the screen state', () => {
  test('the installer sees no banner; a household member with delegation off sees the one that says what still works', async () => {
    const a = await house('installer');
    expect(banners(a.status, 'automation')).toEqual([]);
    const off = await house('household', { delegation: false });
    const b = banners(off.status, 'automation');
    expect(b.map((x) => x.id)).toEqual(['delegation_off']);
    expect(b[0].title).toBe('שמירה דורשת מנהל');
    expect(b[0].text).toContain('להפעיל ולכבות');
    expect(banners((await house('household', { delegation: true })).status, 'automation')).toEqual([]);
  });

  test('offline and stale are one strip with a retry; a missing configuration API says editing is unavailable', async () => {
    const off = await house('installer', { available: 'ha_unavailable' }).catch(() => null);
    expect(off).toBeNull(); // the mock refuses the list while the platform is down: the screen shows its error state
    const m = resetAutomationsMock({ available: 'ha_unavailable' });
    const status = await m.status();
    expect(banners(status, 'automation')[0]).toMatchObject({ id: 'offline', tone: 'bad', retry: true });
    expect(banners({ ...status, available: 'ok', stale: true }, 'automation')[0]).toMatchObject({ id: 'stale', retry: true });
    const api = resetAutomationsMock({ available: 'config_api_unavailable' });
    expect(banners(await api.status(), 'automation').some((x) => x.text.includes('עריכה אינה זמינה'))).toBe(true);
  });

  test('screenKind: loading, error, no permission, switched off, not configured, ready', async () => {
    const { status } = await house();
    const o = { failed: false, noPermission: false, loading: false };
    expect(screenKind(null, { ...o, loading: true })).toBe('loading');
    expect(screenKind(null, { ...o, failed: true })).toBe('error');
    expect(screenKind(status, { ...o, failed: true })).toBe('error');
    expect(screenKind(status, { ...o, noPermission: true })).toBe('no_permission');
    expect(screenKind({ ...status, available: 'feature_disabled' }, o)).toBe('feature_disabled');
    expect(screenKind({ ...status, available: 'not_configured' }, o)).toBe('not_configured');
    expect(screenKind({ ...status, can: { ...status.can, view: false, script_run: false } }, o)).toBe('no_permission');
    expect(screenKind(status, { ...o, loading: true })).toBe('loading');
    expect(screenKind(status, o)).toBe('ready');
  });

  test('the new button: shown to who may manage the kind, disabled with the reason while saving is blocked', async () => {
    const inst = await house('installer');
    expect(newButton(inst.status, 'automation')).toEqual({ shown: true, disabled: false, reason: '' });
    expect(newButton(inst.status, 'scene').shown).toBe(true);
    const view = await house('viewer');
    expect(newButton(view.status, 'automation').shown).toBe(false);
    expect(newButton(view.status, 'script').shown).toBe(false);
    const hh = await house('household', { delegation: false });
    expect(newButton(hh.status, 'automation')).toMatchObject({ shown: true, disabled: true, reason: 'שמירה דורשת מנהל' });
    expect(newButton(null, 'automation').shown).toBe(false);
  });

  test('which kinds a caller sees: all with view, scripts only with the run right alone', async () => {
    const { status } = await house('viewer');
    expect(visibleKinds(status)).toEqual(['automation', 'script', 'scene']);
    expect(visibleKinds({ ...status, can: { ...status.can, view: false } })).toEqual(['script']);
  });
});

// ---------------------------------------------------------------------------------------------------------------- scripts and the settings tab

test.describe('script fields and settings tables', () => {
  test('the form starts at the defaults; a required field without a value is missing', async () => {
    const { m } = await house();
    const d = await m.get('script', m.idOf('script.shutters'));
    const fields = (d.draft as ScriptDraft).fields;
    expect(fieldDefaults(fields)).toEqual({ percent: 50, shutters: ['cover.salon_shutter'], slow: false, side: 'שניהם' });
    expect(missingFields(fields, { percent: 50 })).toEqual([]);
    expect(missingFields(fields, {})).toEqual(['percent']);
    expect(missingFields(fields, { percent: '' })).toEqual(['percent']);
  });

  test('who may: the six roles; the system administrator always has the code view; the role chips toggle', () => {
    expect(ROLE_ROWS.map((r) => r.id)).toEqual(['viewer', 'operator', 'household', 'aut_editor', 'site_admin', 'system_admin']);
    expect(ROLE_ROWS.filter((r) => r.edit).map((r) => r.id)).toEqual(['aut_editor', 'site_admin', 'system_admin']);
    expect(CODE_VIEW_ROLES.find((r) => r.id === 'system_admin')!.locked).toBe(true);
    expect(toggleCodeRole(['site_admin', 'system_admin'], 'aut_editor')).toEqual(['site_admin', 'system_admin', 'aut_editor']);
    expect(toggleCodeRole(['site_admin', 'system_admin'], 'site_admin')).toEqual(['system_admin']);
    expect(toggleCodeRole(['site_admin', 'system_admin'], 'system_admin')).toEqual(['site_admin', 'system_admin']); // locked
    expect(toggleCodeRole(['x'], 'nobody')).toEqual(['x']);
  });

  test('templates: order moves one place, never off the ends; hide toggles without duplicates', () => {
    expect(moveTemplate(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveTemplate(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveTemplate(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveTemplate(['a', 'b', 'c'], 'zzz', 1)).toEqual(['a', 'b', 'c']);
    expect(toggleHidden([], 't1')).toEqual(['t1']);
    expect(toggleHidden(['t1', 't2'], 't1')).toEqual(['t2']);
  });

  test('the settings list keeps a row for a template the server hides: from what was seen before, else by its id', () => {
    const seen = [{ id: 't1', name: 'א', suggest_schedule: false }, { id: 't3', name: 'ג', suggest_schedule: true }];
    const known = [...seen, { id: 't2', name: 'ב', suggest_schedule: false }];
    expect(templateRows(seen, known, ['t2']).map((r) => r.name)).toEqual(['א', 'ג', 'ב']);
    expect(templateRows(seen, [], ['t9'])).toEqual([...seen, { id: 't9', name: 'תבנית t9', suggest_schedule: false }]);
    expect(templateRows(seen, known, ['t1']).map((r) => r.id)).toEqual(['t1', 't3']); // visible and hidden at once: listed once
  });

  test('the delegation state is read-only text: on, off, and off for an administrator who does not need it', async () => {
    const on = await house('household', { delegation: true });
    expect(delegationLabel(on.status)).toEqual({ state: 'on', label: 'מופעל' });
    const off = await house('household', { delegation: false });
    expect(delegationLabel(off.status)).toEqual({ state: 'off', label: 'כבוי' });
  });

  test('trash rows: days left with the urgent flag, and when it was deleted', () => {
    expect(keepText(new Date(NOW.getTime() + 26 * 86400000).toISOString(), NOW)).toEqual({ text: 'נותרו 26 ימים לשחזור', urgent: false });
    expect(keepText(new Date(NOW.getTime() + 3 * 86400000).toISOString(), NOW)).toEqual({ text: 'נותרו 3 ימים לשחזור', urgent: true });
    expect(keepText(new Date(NOW.getTime() + 1 * 86400000).toISOString(), NOW).text).toBe('נותר יום אחד לשחזור');
    expect(keepText(new Date(NOW.getTime() - 1000).toISOString(), NOW)).toEqual({ text: 'פג תוקפו', urgent: true });
    expect(deletedText(new Date(NOW.getTime() - 4 * 86400000).toISOString(), NOW)).toBe('נמחק לפני 4 ימים');
    expect(deletedText(new Date(NOW.getTime() - 3600000).toISOString(), NOW)).toBe('נמחק היום');
  });
});

// ---------------------------------------------------------------------------------------------------------------- the shell: tabs and routes

test.describe('navigation (the shell module, node only)', () => {
  const only = (...perms: string[]): Can => (p) => perms.includes(p);
  const ids = (items: { id: string }[]) => items.map((i) => i.id);
  const route = (path: string): RouteState => {
    const [p, q] = path.replace(/^#/, '').split('?');
    const segments = p.split('/').filter(Boolean);
    return { path: p, segments, params: new URLSearchParams(q ?? ''), mode: segments[0] as RouteState['mode'] };
  };
  test.afterEach(() => applyAutomationsHidden({}));

  test('the tab is for automation.view or script.run at any scope; the settings tab for system.configure at the installation', () => {
    expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read')))).toEqual(['building']);
    expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read', 'automation.view')))).toEqual(['building', 'automations']);
    expect(ids(visibleTabs(DEVICES_TABS, true, only('devices.read', 'script.run')))).toEqual(['building', 'automations']);
    expect(ids(visibleTabs(DEVICES_TABS, true, only('automation.view', 'schedule.view')))).toEqual(['schedules', 'automations']);
    expect(ids(visibleTabs(DEVICES_TABS, true, only('automation.manage')))).toEqual([]); // managing alone reads nothing
    expect(tabAllowed(AUTOMATIONS_SETTINGS_HREF, only('system.configure'))).toBe(true);
    expect(tabAllowed(AUTOMATIONS_SETTINGS_HREF, only('automation.manage'))).toBe(false);
    expect(INSTALLATION_ONLY_HREFS.has(AUTOMATIONS_SETTINGS_HREF)).toBe(true);
    const scoped: Can = (p, inst) => p === 'system.configure' && !inst;
    expect(tabAllowed(AUTOMATIONS_SETTINGS_HREF, scoped)).toBe(false);
    expect(visibleTabs(AREA_TABS.system, true, only('system.configure')).some((t) => t.id === 'automations')).toBe(true);
    expect(visibleTabs(AREA_TABS.system, true, only('automation.view')).some((t) => t.id === 'automations')).toBe(false);
  });

  test('automations.enabled = false takes the tab out for everyone and back; the navigation hears each change once', () => {
    let heard = 0;
    const stop = onTabsConfig(() => (heard += 1));
    const can = only('devices.read', 'automation.view');
    expect(applyAutomationsHidden({ 'automations.enabled': 'false' })).toBe(true);
    expect(HIDDEN_HREFS.has(AUTOMATIONS_HREF)).toBe(true);
    expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['building']);
    applyAutomationsHidden({ 'automations.enabled': 'false' });
    expect(heard).toBe(1);
    expect(applyAutomationsHidden({ 'automations.enabled': 'true' })).toBe(false);
    expect(ids(visibleTabs(DEVICES_TABS, true, can))).toEqual(['building', 'automations']);
    expect(heard).toBe(2);
    expect(applyAutomationsHidden(undefined)).toBe(false);
    stop();
  });

  test('the active tab and the breadcrumbs of the automations routes', () => {
    expect(activeAreaTab(route('/devices/automations'))).toBe('automations');
    expect(activeAreaTab(route('/devices/automations/scenes/new'))).toBe('automations');
    expect(activeAreaTab(route('/devices/automations/1727700000002?view=trace'))).toBe('automations');
    expect(activeAreaTab(route('/devices/schedules'))).toBe('schedules');
    expect(activeAreaTab(route('/devices/building'))).toBe('building');
    expect(activeAreaTab(route('/system/automations'))).toBe('automations');
    expect(crumbsOf(route('/system/automations'))).toEqual(['מערכת', 'אוטומציות']);
    expect(crumbsOf(route('/devices/automations'))).toContain('אוטומציות');
  });
});
