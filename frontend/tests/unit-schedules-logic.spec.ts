import { test, expect } from '@playwright/test';
import { ScheduleDemoStore } from '../src/api/schedules-mock';
import type { Schedule, ScheduleStatus } from '../src/api/schedules';
import {
  NO_FILTERS,
  STATE_SEGMENTS,
  extraFilterCount,
  stateCounts,
  actionTone,
  activeFilterCount,
  conditionHolds,
  conditionOptions,
  dayChips,
  daysWord,
  deletedText,
  devicesLine,
  filterSchedules,
  filtersToParams,
  groupSchedules,
  keptText,
  loweringSummary,
  markersOf,
  nextRunText,
  parseFilters,
  parseView,
  periodLabel,
  placeOptions,
  runIsLowering,
  runNeedsConfirm,
  screenState,
  slotChips,
  slotSegments,
  slotTone,
  sortSchedules,
  summarize,
  tagOptions,
  togglable,
  upcomingToday,
  windowText,
} from '../src/screens/schedules-logic';

// CR-014 S3: the pure logic of the list, the drawer and the settings page, over the demo store's read model (the shapes of a
// live installation). Node only.

let items: Schedule[] = [];
let admin: ScheduleStatus;
const byId = (id: string) => items.find((s) => s.id === id)!;

test.beforeAll(async () => {
  const store = new ScheduleDemoStore();
  items = (await store.list({ limit: 500 })).items;
  admin = await store.status();
});

test('filters round-trip through the address query; unknown values are ignored', () => {
  const f = { ...NO_FILTERS, q: ' תריס ', area: 'gym', day: 'sat' as const, state: 'enabled' as const, tag: 'חוץ', preset: 'only_holy_days' as const, hasConditions: true, sort: 'name' as const, group: 'tag' as const };
  const p = filtersToParams(f, 'table');
  expect(p.toString()).toBe(new URLSearchParams({ view: 'table', q: 'תריס', area: 'gym', day: 'sat', state: 'enabled', tag: 'חוץ', preset: 'only_holy_days', has_conditions: '1', sort: 'name', group: 'tag' }).toString());
  expect(parseFilters(p)).toEqual({ ...f, q: 'תריס' });
  expect(filtersToParams(NO_FILTERS).toString()).toBe('');
  expect(filtersToParams(NO_FILTERS, 'cards').toString()).toBe(''); // cards is the default view
  expect(parseFilters(new URLSearchParams('day=xyz&state=nope&sort=bad&group=bad&preset=bad'))).toEqual(NO_FILTERS);
  expect(parseView('week')).toBe('week');
  expect(parseView('grid')).toBeNull();
  expect(activeFilterCount({ ...NO_FILTERS, q: 'a', tag: 't', sort: 'name', group: 'area' })).toBe(2); // sort and group do not narrow
});

test('the header\'s state segments (the automations screen\'s control): counts that match the filter; "סינון" counts only what it hides', () => {
  expect(STATE_SEGMENTS.map((s) => s.id)).toEqual(['', 'enabled', 'disabled', 'triggered', 'completed']);
  const c = stateCounts(items);
  expect(c['']).toBe(items.length);
  expect(c.enabled + c.disabled).toBe(items.length);
  for (const s of STATE_SEGMENTS) expect(c[s.id], s.id).toBe(filterSchedules(items, { ...NO_FILTERS, state: s.id }).length);
  // the search, the floor chips and the state segments sit in the header: they are not "סינון"'s count
  expect(extraFilterCount({ ...NO_FILTERS, q: 'x', floor: 'f0', state: 'enabled', sort: 'name', group: 'tag' })).toBe(0);
  expect(extraFilterCount({ ...NO_FILTERS, area: 'a', day: 'sat', tag: 't', condition: 'c', preset: 'only_holy_days', hasConditions: true })).toBe(6);
});

test('filtering: text (name, device, area, condition, tag), place, day, state, tag, condition presets', () => {
  const ids = (f: Partial<typeof NO_FILTERS>) => filterSchedules(items, { ...NO_FILTERS, ...f }).map((s) => s.id).sort();
  expect(items.length).toBe(13);
  expect(ids({ q: 'תריס' })).toEqual(['5a13f2']);
  expect(ids({ q: 'אולם מאוורר' })).toEqual(['2c9f61']); // every word must match, anywhere
  expect(ids({ q: 'איסור מלאכה' }).length).toBeGreaterThan(3); // a condition's name is searchable
  expect(ids({ q: 'zzz' })).toEqual([]);
  expect(ids({ area: 'yard' })).toEqual(['0e7d3b', '71c2b8']);
  expect(ids({ floor: 'f1' })).toEqual(['4d6e0a', '8b21d4', 'b6a41e']);
  expect(ids({ state: 'disabled' })).toEqual(['0e7d3b', '8b21d4', 'd8e3a7']);
  expect(ids({ state: 'completed' })).toEqual(['0e7d3b']);
  expect(ids({ tag: 'שבת-חג' })).toEqual(['3f9a1c', '8b21d4', 'b6a41e', 'c07e55']);
  expect(ids({ preset: 'not_holy_days' })).toEqual(['4d6e0a', 'b6a41e', 'd8e3a7']);
  expect(ids({ preset: 'only_holy_days' })).toEqual(['3f9a1c', '8b21d4', 'c07e55']);
  expect(ids({ hasConditions: true }).length).toBe(7);
  expect(ids({ condition: 'sensor.outdoor_temperature' })).toEqual(['2c9f61']);
  expect(ids({ day: 'sat' }).length).toBe(10); // Sunday to Thursday schedules drop out (4d6e0a, 2c9f61, d8e3a7)
  expect(ids({ day: 'sat' })).toContain('b6a41e');
  // stored day tokens the server cannot resolve are kept (workday / weekend)
  const wd = { ...items[0], id: 'aaaaaa', days: { tokens: ['workday' as const], kind: 'workday' as const, days: null } };
  expect(filterSchedules([wd], { ...NO_FILTERS, day: 'sat' }).length).toBe(1);
});

test('sorting: next run (disabled last), name, manual order, last change', () => {
  const next = sortSchedules(items, 'next_run');
  const disabled = next.filter((s) => !s.enabled).map((s) => s.id);
  expect(next.slice(-disabled.length).map((s) => s.id).sort()).toEqual([...disabled].sort()); // the disabled ones come last
  const times = next.filter((s) => s.enabled && s.next_run).map((s) => s.next_run!.at);
  expect([...times].sort()).toEqual(times);
  expect(sortSchedules(items, 'name')[0].display_name.localeCompare(sortSchedules(items, 'name')[1].display_name, 'he')).toBeLessThanOrEqual(0);
  expect(sortSchedules(items, 'order').map((s) => s.order)).toEqual([...items.map((s) => s.order)].sort((a, b) => (a ?? 1e9) - (b ?? 1e9)));
  expect(items.length).toBe(13); // sorting copies
});

test('grouping: by tag, area, state; the catch-all groups go last', () => {
  const tag = groupSchedules(sortSchedules(items, 'name'), 'tag');
  expect(tag.map((g) => g.label).at(-1)).toBe('ללא תג');
  expect(tag.reduce((n, g) => n + g.items.length, 0)).toBe(13);
  const area = groupSchedules(items, 'area');
  const labels = area.map((g) => g.label);
  expect(labels).toContain('סלון');
  expect(labels.indexOf('כמה אזורים')).toBeGreaterThan(labels.indexOf('סלון')); // a schedule over several areas: one heading, last
  const st = groupSchedules(items, 'state');
  expect(st.map((g) => g.label)).toEqual(['פעילים', 'מושבתים']);
  expect(groupSchedules(items, '').length).toBe(1);
});

test('the toolbar\'s options come from the visible schedules', () => {
  expect(placeOptions(items, 'area').map((o) => o.value)).toContain('gym');
  expect(placeOptions(items, 'floor').map((o) => o.label).sort()).toEqual(['קומה 1', 'קומת קרקע']);
  expect(tagOptions(items)[0].value).toBe('שבת-חג'); // the most used first
  expect(conditionOptions(items).map((o) => o.value)).toContain('binary_sensor.shabbat_mode');
});

test('tones and the 24 h bar: off is grey, blinds teal; contiguous slots span the day; a point action is a mark; the day\'s end is 24:00', () => {
  const s = byId('3f9a1c');
  expect(s.slots.map(slotTone)).toEqual(['climate', 'off', 'climate', 'off', 'climate']);
  const seg = slotSegments(s.slots);
  expect(seg[0]).toMatchObject({ from: 0, to: 25, point: false });
  expect(seg.at(-1)).toMatchObject({ to: 100 });
  expect(seg.every((x, i) => i === 0 || x.from === seg[i - 1].to)).toBe(true);
  const point = slotSegments(byId('e19b70').slots)[0];
  expect(point.point).toBe(true);
  expect(point.to - point.from).toBeLessThan(0.2);
  expect(point.tone).toBe('alarm');
  expect(slotSegments(byId('5a13f2').slots).map((x) => x.tone)).toEqual(['cover', 'cover']);
  expect(slotTone(byId('a0f4c9').slots[0])).toBe('other'); // the script without a device
  expect(actionTone({ service: 'climate.set_hvac_mode', class: 'climate', supported: true, data: { hvac_mode: 'off' } })).toBe('off');
  // sun-based slots use today's sun values
  const sun = slotSegments(byId('71c2b8').slots, { sunrise: 390, sunset: 1092 });
  expect(sun[0].from).toBeCloseTo(((1092 + 30) / 1440) * 100, 5);
  expect(windowText(s.slots[4])).toBe('20:00–24:00');
  expect(windowText(byId('e19b70').slots[0])).toBe('23:30');
  expect(windowText(byId('71c2b8').slots[0])).toBe('שקיעה +00:30–23:30');
});

test('a slot\'s actions group by wording; devices and days lines', () => {
  const s = byId('b6a41e');
  const chips = slotChips(s.slots[0], s);
  expect(chips).toHaveLength(1);
  expect(chips[0]).toMatchObject({ label: 'כיבוי מיזוג', tone: 'off' });
  expect(chips[0].devices).toHaveLength(4);
  expect(devicesLine(s)).toBe('מזגן סלון ועוד 3');
  expect(devicesLine(byId('3f9a1c'))).toBe('מזגן סלון · סלון');
  expect(dayChips(byId('4d6e0a').days).filter((d) => d.on).map((d) => d.id)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu']);
  expect(dayChips(byId('3f9a1c').days).every((d) => d.on)).toBe(true);
  expect(daysWord(byId('3f9a1c').days)).toBeNull();
  expect(daysWord({ tokens: ['workday'], kind: 'workday', days: null })).toBe('ימי עבודה');
  expect(daysWord({ tokens: ['weekend'], kind: 'weekend', days: null })).toBe('סוף שבוע');
  expect(periodLabel(byId('5a13f2'))).toBe('15/04–15/10');
  expect(periodLabel(byId('3f9a1c'))).toBeNull();
});

test('conditions: how a condition stands now (never for a locked or unavailable one)', () => {
  const c = { attribute: 'state', match_type: 'is' as const, value: 'on', state: 'off', readable: true, available: true };
  expect(conditionHolds(c)).toBe(false);
  expect(conditionHolds({ ...c, state: 'on' })).toBe(true);
  expect(conditionHolds({ ...c, match_type: 'not' })).toBe(true);
  expect(conditionHolds({ ...c, readable: false, state: null })).toBeNull();
  expect(conditionHolds({ ...c, available: false })).toBeNull();
  expect(conditionHolds({ ...c, attribute: 'temperature' })).toBeNull(); // the read model carries the state only
  expect(conditionHolds({ ...c, match_type: 'above', value: 26, state: '27.4' })).toBe(true);
  expect(conditionHolds({ ...c, match_type: 'below', value: 26, state: '27.4' })).toBe(false);
  expect(conditionHolds({ ...c, match_type: 'above', value: 26, state: 'unknown' })).toBeNull();
});

test('the next run of a schedule with conditions says "בתנאי" - never a promise; disabled and completed say so', () => {
  const now = new Date();
  expect(nextRunText(byId('3f9a1c'), now)).toMatch(/ · בתנאי$/);
  expect(nextRunText(byId('5a13f2'), now)).not.toContain('בתנאי');
  expect(nextRunText(byId('8b21d4'), now)).toBe('מושבת');
  expect(nextRunText(byId('0e7d3b'), now)).toBe('הסתיים');
  expect(nextRunText({ enabled: true, state: 'unavailable', next_run: null }, now)).toBe('אין הרצה קרובה');
});

test('the summary strip: counts, and today\'s remaining runs soonest first (conditional ones marked)', () => {
  expect(summarize(items)).toEqual({ total: 13, active: 10, disabled: 3 });
  const noon = new Date();
  noon.setHours(0, 5, 0, 0);
  const up = upcomingToday(items, noon, 50);
  expect(up.every((u, i) => i === 0 || up[i - 1].at <= u.at)).toBe(true);
  expect(up.every((u) => new Date(u.at).getDate() === noon.getDate())).toBe(true);
  expect(up.some((u) => u.conditional)).toBe(true);
  expect(upcomingToday(items, noon, 3)).toHaveLength(3);
  const late = new Date();
  late.setHours(23, 59, 59, 0);
  expect(upcomingToday(items, late)).toEqual([]);
  expect(up.every((u) => byId(u.scheduleId).enabled)).toBe(true); // disabled schedules never run
});

test('the screen state from the status: loading, no view, off, missing, stale, read only, ready', () => {
  const st = (over: Partial<ScheduleStatus>) => ({ ...admin, ...over }) as ScheduleStatus;
  expect(screenState(null).kind).toBe('loading');
  expect(screenState(null, true).kind).toBe('error');
  expect(screenState(st({ can: { ...admin.can, view: false, manage: false } })).kind).toBe('no_view');
  expect(screenState(st({ feature_enabled: false })).kind).toBe('feature_disabled');
  expect(screenState(st({ available: 'feature_disabled' })).kind).toBe('feature_disabled');
  expect(screenState(st({ available: 'component_missing' })).kind).toBe('missing');
  expect(screenState(st({ available: 'component_missing' })).admin).toBe(true);
  expect(screenState(st({ available: 'component_missing', can: { ...admin.can, configure: false } })).admin).toBe(false);
  const stale = screenState(st({ available: 'ha_unavailable', stale: true }));
  expect(stale).toMatchObject({ kind: 'ready', stale: true });
  const view = screenState(st({ can: { ...admin.can, manage: false, configure: false } }));
  expect(view).toMatchObject({ kind: 'ready', readOnly: true });
  expect(view.readOnlyText).toContain('מצב צפייה');
  expect(screenState(st({ writable: false, write_block: 'bridge_too_old' })).readOnlyText).toBe('נדרש עדכון של רכיב החיבור כדי לשמור תזמונים.');
  expect(screenState(admin)).toMatchObject({ kind: 'ready', stale: false, readOnly: false });
  expect(screenState(st({ available: 'ok' }), true).kind).toBe('error'); // the list request failed
  // operator wording never names the platform
  for (const s of [stale, view, screenState(st({ writable: false, write_block: 'ha_unavailable' }))]) expect(s.readOnlyText).not.toMatch(/Home Assistant|\bHA\b/);
});

test('markers, the lowering confirmation sentence, what a run confirms', () => {
  expect(markersOf(byId('e19b70'))).toEqual([{ kind: 'sensitive', label: 'רגיש' }]);
  expect(markersOf(byId('d8e3a7')).map((m) => m.kind)).toEqual(['sensitive', 'lowering']);
  expect(markersOf(byId('3f9a1c'))).toEqual([]);
  const l = loweringSummary(byId('d8e3a7'));
  expect(l.entities).toEqual(['שער חניה']);
  expect(l.times).toEqual(['07:00']);
  expect(l.text).toBe('התזמון יפתח שער חניה ב־07:00 גם כשאיש אינו נמצא במקום.');
  expect(runNeedsConfirm(byId('5a13f2').slots[0])).toBe(true); // blinds move
  expect(runNeedsConfirm(byId('e19b70').slots[0])).toBe(true); // sensitive
  expect(runNeedsConfirm(byId('4d6e0a').slots[0])).toBe(false); // a light
  expect(runIsLowering(byId('d8e3a7').slots[0])).toBe(true);
  expect(runIsLowering(byId('d8e3a7').slots[1])).toBe(false); // closing the gate lowers nothing
  expect(runNeedsConfirm(undefined)).toBe(false);
});

test('bulk: only what the caller may toggle is offered; trash wording', () => {
  expect(togglable(items).length).toBe(13);
  const readOnly = { ...byId('3f9a1c'), can: { ...byId('3f9a1c').can, toggle: false } };
  expect(togglable([readOnly, byId('4d6e0a')]).map((s) => s.id)).toEqual(['4d6e0a']);
  const now = new Date('2026-09-30T12:00:00Z');
  expect(keptText('2026-10-27T12:00:00Z', now)).toBe('נשמר עוד 27 ימים');
  expect(keptText('2026-10-01T12:00:00Z', now)).toBe('נשמר עוד יום');
  expect(keptText('2026-09-29T12:00:00Z', now)).toBe('יימחק היום');
  expect(deletedText('2026-09-27T12:00:00Z', now)).toBe('נמחק לפני 3 ימים');
  expect(deletedText('2026-09-29T12:00:00Z', now)).toBe('נמחק אתמול');
  expect(deletedText('2026-09-30T08:00:00Z', now)).toBe('נמחק היום');
});
