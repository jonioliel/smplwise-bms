import { test, expect } from '@playwright/test';
import { agendaOf, agendaWhen, configBody, configOf, defaultConfig, previewData, resolveWidgets, WIDGET_IDS, type HomeCandidates, type HomeData } from '../src/api/home-config';
import { LAUNCH_ROUTE_IDS, LAUNCH_ROUTES, launchAllowed, launchIcon, launchRoute } from '../src/api/launcher';
import { LOOK_DEFAULT, LOOK_DIALS, LOOK_DIAL_IDS, lookAttributes, normalizeDial, normalizeLook } from '../src/design/look';

// BV1 (2026-10-05): the agenda / launcher widgets, the tile style, the two look dials - the pure modules the screen uses. Node only.

const NOW = new Date('2026-10-05T13:00:00Z'); // 16:00 Jerusalem
const at = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

test.describe('BV1: config', () => {
  test('the new widgets are appended with their defaults, the clock / weather carry a style, an old config reads whole', () => {
    const c = defaultConfig();
    expect(c.order.slice(-2)).toEqual(['agenda', 'launcher']);
    expect(c.agenda).toEqual({ on: true, sizes: { a: 'm', b: 'm', c: 'm' }, label: '', phone_on: null, phone_size: null, calendars: [], days: 7 });
    expect(c.launcher).toEqual({ on: true, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null, items: [] });
    expect(c.clock.style).toBe('card');
    expect(c.weather.style).toBe('card');
    const old = configOf({ order: ['quick', 'clock'], clock: { on: true, mode: 'time' } });
    expect(old.order).toEqual(['quick', 'clock', 'weather', 'shabbat', 'alarm', 'media', 'agenda', 'launcher']);
    expect(old.clock.style).toBe('card');
    expect(WIDGET_IDS).toContain('agenda');
  });

  test('configOf is tolerant: bad calendars, bad items and foreign styles are dropped, duplicates collapse, and it round-trips', () => {
    const c = configOf({
      clock: { style: 'tile' }, weather: { style: 'huge' },
      agenda: { calendars: ['calendar.a', 'sensor.x', 'calendar.a', 'calendar.b'], days: 3 },
      launcher: { items: [{ kind: 'route', id: 'live' }, { kind: 'route', id: 'live' }, { kind: 'url', id: 'x' }, { kind: 'scene', id: 'scene.y', label: 'ערב' }, { kind: 'quick' }, 5] },
    });
    expect(c.clock.style).toBe('tile');
    expect(c.weather.style).toBe('card');
    expect(c.agenda.calendars).toEqual(['calendar.a', 'calendar.b']);
    expect(c.agenda.days).toBe(3);
    expect(c.launcher.items).toEqual([{ kind: 'route', id: 'live', label: '' }, { kind: 'scene', id: 'scene.y', label: 'ערב' }]);
    expect(configOf(configBody(c))).toEqual(c);
    expect(configOf({ agenda: { days: 5 } }).agenda.days).toBe(7);
  });
});

const DATA: HomeData = {
  weather: null, sensors: {}, alarm: null,
  agenda: {
    calendars: [{ entity_id: 'calendar.a', name: 'א', available: true, found: true }, { entity_id: 'calendar.b', name: 'ב', available: false, found: true }],
    events: [{ calendar: 'calendar.a', calendar_name: 'א', message: 'x', start: at(2), end: at(3), all_day: false, location: null }],
  },
  names: { 'scene.y': 'ערב' },
};

test.describe('BV1: availability', () => {
  test('agenda: none without calendars, unavail when none reports, ok with a reporting calendar even without events', () => {
    const c = defaultConfig();
    const avail = (data: HomeData) => resolveWidgets(c, 'a', data, { editing: true }).find((i) => i.id === 'agenda')!.avail;
    expect(avail(DATA)).toBe('none');
    c.agenda.calendars = ['calendar.a', 'calendar.b'];
    expect(avail(DATA)).toBe('ok');
    expect(avail({ ...DATA, agenda: { calendars: [{ entity_id: 'calendar.b', name: 'ב', available: false, found: true }], events: [] } })).toBe('unavail');
    expect(avail({ ...DATA, agenda: null })).toBe('unavail');
    expect(avail({ ...DATA, agenda: { calendars: DATA.agenda!.calendars, events: [] } })).toBe('ok'); // the empty state is drawn inside the tile
    expect(resolveWidgets(c, 'a', DATA, {}).some((i) => i.id === 'agenda')).toBe(true);
  });

  test('launcher: none without items, nolaunch when this user may press none, ok otherwise', () => {
    const c = defaultConfig();
    const avail = (allowed?: (it: { kind: string; id: string }) => boolean) => resolveWidgets(c, 'a', DATA, { editing: true, launchAllowed: allowed }).find((i) => i.id === 'launcher')!.avail;
    expect(avail()).toBe('none');
    c.launcher.items = [{ kind: 'route', id: 'live', label: '' }, { kind: 'scene', id: 'scene.y', label: '' }];
    expect(avail()).toBe('ok');
    expect(avail(() => false)).toBe('nolaunch');
    expect(avail((it) => it.kind === 'scene')).toBe('ok');
    expect(resolveWidgets(c, 'a', DATA, { launchAllowed: () => false }).some((i) => i.id === 'launcher')).toBe(false);
  });

  test('launchAllowed follows the route permissions, the scene / script gates and the quick bulk right', () => {
    const can = (perms: string[]) => (p: string) => perms.includes(p);
    expect(launchAllowed({ kind: 'route', id: 'live', label: '' }, {}, can(['video.live']))).toBe(true);
    expect(launchAllowed({ kind: 'route', id: 'live', label: '' }, {}, can(['events.read']))).toBe(false);
    expect(launchAllowed({ kind: 'route', id: 'nope', label: '' }, {}, can(['video.live']))).toBe(false);
    expect(launchAllowed({ kind: 'route', id: 'automations', label: '' }, {}, can(['script.run']))).toBe(true);
    expect(launchAllowed({ kind: 'scene', id: 'scene.y', label: '' }, {}, can(['devices.control']))).toBe(true);
    expect(launchAllowed({ kind: 'scene', id: 'scene.y', label: '' }, {}, can(['script.run']))).toBe(false);
    expect(launchAllowed({ kind: 'script', id: 'script.z', label: '' }, {}, can(['script.run']))).toBe(true);
    expect(launchAllowed({ kind: 'script', id: 'script.z', label: '' }, {}, can(['scene.manage']))).toBe(false);
    expect(launchAllowed({ kind: 'quick', id: 'all_off', label: '' }, { all_off: true }, can([]))).toBe(true);
    expect(launchAllowed({ kind: 'quick', id: 'all_off', label: '' }, { lights_off: true }, can([]))).toBe(false);
    // every route of the table has a permission (no screen opens for everyone) and the backend's id list is the same set
    for (const r of LAUNCH_ROUTES) expect(r.perms.length, r.id).toBeGreaterThan(0);
    expect(LAUNCH_ROUTE_IDS.sort()).toEqual(['alarm', 'automations', 'energy', 'events', 'home', 'live', 'map', 'players', 'schedules', 'screens', 'settings', 'wiskey'].sort());
    expect(launchRoute('live')!.hash).toBe('/live/wall');
    expect(launchIcon({ kind: 'quick', id: 'all_off', label: '' })).toBe('power');
    expect(launchIcon({ kind: 'scene', id: 'scene.y', label: '' })).toBe('sparkle');
  });
});

test.describe('BV1: agenda text and preview', () => {
  test('agendaWhen says today / tomorrow / the weekday / the date, all-day by the named day, times in the site zone', () => {
    expect(agendaWhen({ start: at(2), all_day: false }, NOW, 'Asia/Jerusalem')).toBe('היום · 18:00');
    expect(agendaWhen({ start: at(20), all_day: false }, NOW, 'Asia/Jerusalem')).toBe('מחר · 12:00');
    expect(agendaWhen({ start: '2026-10-07T00:00:00+00:00', all_day: true }, NOW, 'Asia/Jerusalem')).toMatch(/^יום (רביעי|ד׳) · כל היום$/);
    expect(agendaWhen({ start: '2026-10-05T00:00:00+00:00', all_day: true }, NOW, 'Asia/Jerusalem')).toBe('היום · כל היום');
    expect(agendaWhen({ start: at(24 * 12), all_day: false }, NOW, 'Asia/Jerusalem')).toMatch(/^17\.10 · 16:00$/);
    expect(agendaWhen({ start: 'nope', all_day: false }, NOW, 'Asia/Jerusalem')).toBe('');
    // a late-evening Jerusalem event is still "today" there although it is tomorrow in UTC
    expect(agendaWhen({ start: '2026-10-05T21:30:00Z', all_day: false }, NOW, 'Asia/Jerusalem')).toBe('היום · 00:30');
  });

  test('agendaOf tolerates a missing or odd block; previewData builds the agenda from the candidates for a draft', () => {
    expect(agendaOf(undefined)).toBeNull();
    expect(agendaOf({ calendars: [{ entity_id: 'calendar.a' }], events: [{ message: 'x', start: at(1) }, { message: 5 }] })).toEqual({ calendars: [{ entity_id: 'calendar.a', name: 'calendar.a', available: false, found: true }], events: [{ calendar: '', calendar_name: '', message: 'x', start: at(1), end: null, all_day: false, location: null }] });
    const cands: HomeCandidates = {
      weather: [], alarms: [], sensors: [],
      calendars: [{ entity_id: 'calendar.c', name: 'ג', state: 'off', event: { calendar: 'calendar.c', calendar_name: 'ג', message: 'y', start: at(1), end: null, all_day: false, location: null } }],
      scenes: [{ entity_id: 'scene.q', name: 'ש', state: null }], scripts: [],
    };
    const c = defaultConfig();
    c.agenda.calendars = ['calendar.a', 'calendar.c'];
    c.launcher.items = [{ kind: 'scene', id: 'scene.q', label: '' }, { kind: 'scene', id: 'scene.y', label: '' }];
    const p = previewData(c, DATA, cands);
    expect(p.agenda!.calendars.map((x) => x.entity_id)).toEqual(['calendar.a', 'calendar.c']);
    expect(p.agenda!.events.map((e) => e.message)).toEqual(['y', 'x']); // sorted by start: the candidate's event (1 h) before the server's (2 h)
    expect(p.names).toEqual({ 'scene.y': 'ערב', 'scene.q': 'ש' });
    c.agenda.calendars = [];
    expect(previewData(c, DATA, cands).agenda).toBeNull();
  });
});

test.describe('BV1: the look dials', () => {
  test('surface none and the slider dial exist, default to today, normalise and land on <html>', () => {
    expect(LOOK_DIALS.surface.values).toContain('none');
    expect(LOOK_DIALS.slider.values).toEqual(['horizontal', 'vertical']);
    expect(LOOK_DEFAULT.slider).toBe('horizontal');
    expect(LOOK_DEFAULT.surface).toBe('fill');
    expect(LOOK_DIAL_IDS.indexOf('slider')).toBe(LOOK_DIAL_IDS.indexOf('radius') + 1);
    expect(normalizeDial('slider', 'vertical')).toBe('vertical');
    expect(normalizeDial('slider', 'diagonal')).toBeNull();
    expect(normalizeDial('surface', 'none')).toBe('none');
    expect(normalizeLook({ surface: 'none', slider: 'vertical', x: 1 })).toEqual({ surface: 'none', slider: 'vertical' });
    expect(lookAttributes({ ...LOOK_DEFAULT, slider: 'vertical', surface: 'none' }).attrs['data-bubble-slider']).toBe('vertical');
    expect(lookAttributes({ ...LOOK_DEFAULT, slider: 'vertical', surface: 'none' }).attrs['data-bubble-surface']).toBe('none');
  });
});
