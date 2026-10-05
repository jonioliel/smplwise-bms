import type { Page, Route } from '@playwright/test';
import { installBubbleMock, tree, type BubbleMockState } from './bubble-mocks';

// BV1 (2026-10-05): the mocked backend of the home screen WITH the new widgets - the clock and weather as tiles, the agenda (four
// calendars: one today, one tomorrow, one all-day, one unavailable) and the launcher (screens, a scene, a script, a quick action).
// Layered over tests/bubble-mocks.ts: the routes here answer first and fall back to it for everything else (Playwright runs the
// last-registered handler first). Every name is synthetic; no device, no platform. Used by layout-bv1-tiles.spec.ts and
// evidence-bv1-tiles.spec.ts.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** The fixed clock of the specs: 2026-10-05 13:00 UTC (16:00 in Jerusalem). */
export const BV1_NOW = '2026-10-05T13:00:00Z';
const at = (h: number) => new Date(Date.parse(BV1_NOW) + h * 3600_000).toISOString();

export const BV1_PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read', 'video.live', 'events.read', 'alarm.view', 'media.read', 'scene.manage', 'script.run', 'schedule.view', 'system.configure', 'screen.personalize'];

export function bv1Config(over: { clockStyle?: 'card' | 'tile'; weatherStyle?: 'card' | 'tile'; agenda?: boolean; launcher?: boolean } = {}) {
  const common = (sizes: { a: string; b: string; c: string }) => ({ on: true, sizes, label: '', phone_on: null, phone_size: null });
  return {
    order: ['clock', 'weather', 'agenda', 'launcher', 'shabbat', 'alarm', 'quick', 'media'],
    phone_layout: 'stack',
    clock: { ...common({ a: 'l', b: 'm', c: 'm' }), mode: 'datetime', seconds: false, hebrew: true, style: over.clockStyle ?? 'tile' },
    weather: { ...common({ a: 'l', b: 'm', c: 'm' }), entity: 'weather.home_wx', fields: ['temperature', 'condition', 'humidity', 'wind', 'forecast'], forecast: '5', sources: {}, style: over.weatherStyle ?? 'tile' },
    shabbat: common({ a: 'm', b: 'm', c: 'm' }),
    alarm: { ...common({ a: 'm', b: 's', c: 'm' }), entity: '' },
    quick: { ...common({ a: 'm', b: 's', c: 'm' }), actions: ['lights_off', 'all_off'] },
    media: { ...common({ a: 'm', b: 's', c: 'm' }), on: false },
    agenda: { ...common({ a: 'm', b: 'm', c: 'm' }), on: over.agenda ?? true, calendars: ['calendar.family', 'calendar.work', 'calendar.holidays', 'calendar.gone'], days: 7 },
    launcher: {
      ...common({ a: 'm', b: 's', c: 'm' }), on: over.launcher ?? true,
      items: [
        { kind: 'route', id: 'live', label: '' }, { kind: 'route', id: 'alarm', label: '' }, { kind: 'route', id: 'map', label: '' }, { kind: 'route', id: 'screens', label: '' },
        { kind: 'scene', id: 'scene.evening', label: '' }, { kind: 'scene', id: 'scene.movie', label: 'קולנוע' }, { kind: 'script', id: 'script.goodnight', label: '' },
        { kind: 'quick', id: 'lights_off', label: '' }, { kind: 'quick', id: 'all_off', label: '' },
      ],
    },
    calendar: { date: 'sensor.jewish_calendar_date', parsha: 'sensor.jewish_calendar_weekly_portion', candles: 'sensor.jewish_calendar_upcoming_candle_lighting', havdalah: 'sensor.jewish_calendar_upcoming_havdalah', holiday: '', extras: [] },
  };
}

export function bv1Data() {
  const day = 86_400_000;
  const forecast = ['sunny', 'sunny', 'partlycloudy', 'rainy', 'cloudy'].map((condition, i) => ({ datetime: new Date(Date.parse(BV1_NOW) + (i + 1) * day).toISOString(), condition, temperature: [29, 30, 27, 24, 25][i], templow: [19, 20, 18, 17, 17][i] }));
  const sensor = (state: string, name: string, deviceClass: string | null = null) => ({ state, name, unit: null, device_class: deviceClass, available: true });
  return {
    weather: { entity_id: 'weather.home_wx', name: 'תחזית הבית', available: true, condition: 'partlycloudy', values: { temperature: { v: 28, unit: '°C' }, humidity: { v: 61, unit: '%' }, wind: { v: 14, unit: 'km/h' } }, forecast, forecast_len: 5, offers: ['condition', 'temperature', 'humidity', 'wind', 'forecast'] },
    sensors: {
      'sensor.jewish_calendar_date': sensor('י״ד בתשרי התשפ״ז', 'תאריך עברי'),
      'sensor.jewish_calendar_weekly_portion': sensor('בראשית', 'פרשת השבוע'),
      'sensor.jewish_calendar_upcoming_candle_lighting': sensor(at(5 * 24 + 1), 'הדלקת נרות', 'timestamp'),
      'sensor.jewish_calendar_upcoming_havdalah': sensor(at(6 * 24 + 2), 'צאת שבת', 'timestamp'),
    },
    alarm: { entity_id: 'alarm_control_panel.home', name: 'אזעקה', state: 'armed_home', since: at(-3), available: true },
    agenda: {
      calendars: [
        { entity_id: 'calendar.family', name: 'משפחה', available: true, found: true },
        { entity_id: 'calendar.work', name: 'עבודה', available: true, found: true },
        { entity_id: 'calendar.holidays', name: 'חגים', available: true, found: true },
        { entity_id: 'calendar.gone', name: 'נעלם', available: false, found: true },
      ],
      events: [
        { calendar: 'calendar.family', calendar_name: 'משפחה', message: 'רופא שיניים לנועה', start: at(2.5), end: at(3.5), all_day: false, location: 'רחוב הדקל 12, תל אביב' },
        { calendar: 'calendar.work', calendar_name: 'עבודה', message: 'פגישת צוות שבועית עם שם ארוך במיוחד כדי לבדוק חיתוך', start: at(20), end: at(21), all_day: false, location: null },
        { calendar: 'calendar.holidays', calendar_name: 'חגים', message: 'שמחת תורה', start: '2026-10-07T00:00:00+00:00', end: '2026-10-08T00:00:00+00:00', all_day: true, location: null },
        { calendar: 'calendar.family', calendar_name: 'משפחה', message: 'יום הולדת סבתא', start: at(3 * 24 + 4), end: at(3 * 24 + 6), all_day: false, location: 'אצל סבתא' },
      ],
    },
    names: { 'scene.evening': 'ערב רגוע', 'scene.movie': 'סרט', 'script.goodnight': 'לילה טוב' },
  };
}

export interface Bv1MockState extends BubbleMockState {
  /** The scene applies / script runs the page sent (item ids). */
  launches: { kind: 'scene' | 'script'; id: string }[];
}

/** Installs the BV1 home over the bubble mock; returns the recorded state. */
export async function installBv1Mock(page: Page, opts: { perms?: string[]; look?: Record<string, unknown>; config?: ReturnType<typeof bv1Config>; data?: ReturnType<typeof bv1Data>; agendaEmpty?: boolean } = {}): Promise<Bv1MockState> {
  const base = await installBubbleMock(page, { perms: opts.perms ?? BV1_PERMS, look: opts.look });
  const st: Bv1MockState = { ...base, launches: [] };
  const config = opts.config ?? bv1Config();
  const data = opts.data ?? bv1Data();
  if (opts.agendaEmpty) data.agenda.events = [];
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: true, config, data };
  const items = [
    { kind: 'scene', id: 's-evening', entity_id: 'scene.evening', name: 'ערב רגוע' }, { kind: 'scene', id: 's-movie', entity_id: 'scene.movie', name: 'סרט' },
    { kind: 'script', id: 'sc-night', entity_id: 'script.goodnight', name: 'לילה טוב' },
  ];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'devices/tree') return json(route, { ...tree(), home });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'bubble', 'ui.scheme': 'light', 'ui.look': st.look, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.direction': 'a', 'home.side': 'end', 'home.title': '', 'home.floor_order': '[]', 'home.widgets': config }, can_edit: true });
    if (p === 'devices/home-candidates') {
      return json(route, {
        weather: [{ entity_id: 'weather.home_wx', name: 'תחזית הבית', state: 'partlycloudy', values: data.weather.values, forecast: data.weather.forecast, forecast_len: 5, offers: data.weather.offers }],
        alarms: [{ entity_id: 'alarm_control_panel.home', name: 'אזעקה', state: 'armed_home' }], sensors: [], suggested_calendar: {},
        calendars: data.agenda.calendars.map((c) => ({ entity_id: c.entity_id, name: c.name, state: c.available ? 'off' : 'unavailable', event: data.agenda.events.find((e) => e.calendar === c.entity_id) ?? null })),
        scenes: [{ entity_id: 'scene.evening', name: 'ערב רגוע', state: 'unknown' }, { entity_id: 'scene.movie', name: 'סרט', state: 'unknown' }, { entity_id: 'scene.party', name: 'מסיבה', state: 'unknown' }],
        scripts: [{ entity_id: 'script.goodnight', name: 'לילה טוב', state: 'off' }],
      });
    }
    if (p === 'automations' && req.method() === 'GET') {
      const kind = new URL(req.url()).searchParams.get('kind');
      const list = items.filter((x) => !kind || x.kind === kind);
      return json(route, { items: list, total: list.length });
    }
    const run = /^automations\/(scene|script)\/([^/]+)\/(apply|run)$/.exec(p);
    if (run && req.method() === 'POST') {
      st.launches.push({ kind: run[1] as 'scene' | 'script', id: decodeURIComponent(run[2]) });
      return json(route, { run_id: `r${st.launches.length}` });
    }
    if (p === 'multimedia/status') return json(route, { enabled: false });
    return route.fallback();
  });
  return st;
}
