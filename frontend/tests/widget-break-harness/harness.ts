// WIDGETBREAK-297 test harness: mounts ONE <home-widgets> card at a time, in a cell of a chosen width, from invented normal / worst-case / empty data.
// Served by the Vite DEV server at /tests/widget-break-harness/. Skin / scheme come from the usual URL parameters. Nothing here reaches a backend.
import '../../src/design/boot';
import '../../src/styles/focus-policy';
import '../../src/screens/home-widgets';
import { defaultConfig, resolveWidgets, type HomeConfig, type HomeData, type Size, type WidgetId } from '../../src/api/home-config';

const LONG_HE = 'פתיחת בוקר לכניסה הראשית של הלובי בקומת הקרקע של המבנה הצפוני כולל חניון תת קרקעי';
const UNB = 'A'.repeat(60);
const MIX = 'חדר שרתים Rack-12 (קומה 3) — Gate B7 🚪 2026';
export type Dataset = 'normal' | 'worst' | 'empty';

const NOW = new Date('2026-11-02T08:30:00Z');
const iso = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

function unit(i: number, name: string) {
  return {
    id: `u${i}`, name, kind: 'fridge', area_id: 'a1', area_name: i % 2 ? LONG_HE.slice(0, 50) : 'מטבח', low: 2, high: 8, hard_max: 12, band_mode: 'fixed', source: 'sensor', hvac: null,
    status: ['alarm', 'warning', 'ok', 'offline', 'off', 'unknown'][i % 6], value: i === 0 ? -1234.56 : 4.5 + i, value_last: 5, updated_at: iso(-1), trend: 'up', temp_sensor_name: name,
    door: null, events: [], defrost: { mode: 'none', in_window: false, next_at: null, state: 'none', days: 0, windows: [] }, muted_until: null, rules: {}, stats_24h: {}, stale: false,
  };
}

function build(ds: Dataset) {
  const cfg: HomeConfig = defaultConfig();
  cfg.weather.entity = 'weather.x';
  cfg.alarm.entity = 'alarm_control_panel.x';
  cfg.calendar = { date: 'sensor.d', parsha: 'sensor.p', candles: 'sensor.c', havdalah: 'sensor.h', holiday: 'sensor.hol', extras: [] };
  cfg.weather.fields = ['condition', 'temperature', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation', 'apparent', 'forecast'] as never;
  cfg.weather.forecast = '5' as never;
  cfg.agenda.calendars = ['calendar.a'];
  if (new URLSearchParams(location.search).get('skin') === 'bubble') { cfg.clock.style = 'tile'; cfg.weather.style = 'tile'; }
  cfg.launcher.items = [{ kind: 'route', id: '/devices', label: ds === 'worst' ? LONG_HE : 'מכשירים' }, { kind: 'scene', id: 'scene.x', label: ds === 'worst' ? UNB : 'ערב' }, { kind: 'script', id: 'script.x', label: '' }];
  const empty = ds === 'empty';
  const worst = ds === 'worst';
  const sensor = (state: string, name: string, dc: string | null = null) => ({ state, name, unit: null, device_class: dc, available: true });
  const fc = (n: number) => Array.from({ length: n }, (_, i) => ({ datetime: iso(24 * (i + 1)), condition: ['sunny', 'rainy', 'partlycloudy', 'snowy-rainy', 'lightning', 'unknown-cond', 'fog'][i % 7], temperature: worst ? [-40, 118, 7, 0, 99][i % 5] : 25 + i, templow: worst ? -45 : 18 }));
  const data: HomeData = {
    weather: empty ? null : {
      entity_id: 'weather.x', name: worst ? LONG_HE : 'תחזית הבית', available: true, condition: worst ? 'snowy-rainy' : 'sunny',
      values: worst ? { temperature: { v: -40.55, unit: '°C' }, humidity: { v: 100, unit: '%' }, wind: { v: 187.3, unit: 'km/h', bearing: 270, bearing_text: 'מערב-צפון-מערב' }, pressure: { v: 1086.25, unit: 'hPa' }, visibility: { v: 1000000, unit: 'km' }, uv: { v: 14, unit: null }, precipitation: { v: 1234.5, unit: 'mm' }, apparent: { v: -52, unit: '°C' } }
        : { temperature: { v: 28, unit: '°C' }, humidity: { v: 61, unit: '%' }, wind: { v: 14, unit: 'km/h' }, pressure: { v: 1013, unit: 'hPa' } },
      forecast: fc(worst ? 7 : 5), forecast_len: worst ? 7 : 5, offers: ['condition', 'temperature', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation', 'apparent', 'forecast'] as never,
    },
    sensors: empty ? {} : {
      'sensor.d': sensor(worst ? 'ט״ו בחשוון התשפ״ז ' + LONG_HE : 'ג׳ בחשוון התשפ״ז', 'תאריך עברי'),
      'sensor.p': sensor(worst ? 'מקץ-חנוכה-ויגש-ויחי-שמות-וארא-בא-בשלח-יתרו-משפטים' : 'נח', 'פרשה'),
      'sensor.c': sensor(iso(80), 'הדלקת נרות', 'timestamp'), 'sensor.h': sensor(iso(104), 'צאת שבת', 'timestamp'),
      'sensor.hol': sensor(worst ? 'שבת חול המועד סוכות ' + UNB : 'ראש חודש', 'חג'),
    },
    alarm: empty ? null : { entity_id: 'alarm_control_panel.x', name: worst ? LONG_HE : 'אזעקה', state: worst ? 'armed_custom_bypass' : 'armed_away', since: iso(-100000), available: true },
    agenda: empty ? { calendars: [], events: [] } : {
      calendars: [{ entity_id: 'calendar.a', name: 'יומן', available: true, found: true }],
      events: (worst ? [LONG_HE, UNB, MIX, 'א', ''] : ['ישיבת צוות']).map((m, i) => ({ calendar: 'calendar.a', calendar_name: worst ? LONG_HE.slice(0, 40) : 'יומן', message: m, start: iso(2 + i), end: iso(3 + i), all_day: i === 2, location: worst ? LONG_HE : null })),
    },
    names: { 'scene.x': worst ? LONG_HE : 'ערב', 'script.x': worst ? UNB : 'סקריפט' },
  };

  const names = worst ? [LONG_HE, UNB, MIX, 'א', 'מקרר 1', 'מקפיא ' + 'ב'.repeat(40), '🧊 חדר קירור'] : ['מקרר'];
  const temp = empty ? [] : Array.from({ length: worst ? 25 : 1 }, (_, i) => unit(i, names[i % names.length] + (i >= names.length ? ` ${i}` : '')));
  const gens = empty ? [] : (worst ? [LONG_HE, UNB, 'גנרטור 2', 'ג'] : ['גנרטור ראשי']).map((n, i) => ({
    id: `g${i}`, name: n, area_id: null, status: 'detected', availability: 'online', stale: false, open_alerts: worst ? 123456 : 0, open_critical: worst ? 3 : 0, roles: ['engine_state'],
    summary: { engine_state: { value: ['running', 'stopped', 'fault', 'starting'][i % 4], unit: '' }, mains_available: { value: i % 2 === 0, unit: '' }, ats_position: { value: 'generator', unit: '' }, fuel_pct: { value: worst ? 100 : 71, unit: '%' }, load_pct: { value: worst ? 1234 : 48, unit: '%' }, gen_kw: { value: worst ? 123456.789 : 62, unit: 'kW' } },
  }));
  const noticeTitles = worst ? [LONG_HE, UNB, MIX, 'א'] : ['עבודות בחניון'];
  const notices = empty ? [] : noticeTitles.map((t, i) => ({
    id: `n${i}`, title: t, body: worst ? LONG_HE + ' ' + LONG_HE + ' ' + UNB : 'קצר', severity: (['critical', 'alert', 'info', 'info'] as const)[i % 4], starts_at: iso(-5), ends_at: iso(50), pinned: i === 0, state: 'active' as const,
    dwell_s: null, when_text: worst ? 'מ-01.11.2026 08:00 עד 31.12.2026 23:59 ' + LONG_HE.slice(0, 30) : null, published_at: iso(-5), updated_at: iso(-5), boards: [], read: false,
  }));
  const doorsN = empty ? 0 : worst ? 14 : 1;
  const doorRows = Array.from({ length: doorsN }, (_, i) => ({ key: `s1:${i}`, station_id: 's1', relay: i, label: `${LONG_HE} ${i}`, station_name: 'לובי', name: worst ? [LONG_HE, UNB, MIX, 'א'][i % 4] : 'כניסה ראשית', zone: 'Asia/Jerusalem', manage: true, cancel: true, exterior: false }));
  const occ = doorRows.map((d, i) => ({
    id: `o${i}`, door: d.key, label: d.name, rule_id: 'r1', rule_name: 'בוקר', start_at: iso(-1 + (i % 3)), end_at: iso(2 + (i % 3)), zone: 'Asia/Jerusalem',
    state: ['relock_unconfirmed', 'not_started', 'active', 'armed'][i % 4], tier: 'program', retries: 0, unconfirmed_at: null, last_reason: null, resolution: null, resolved_at: null,
  }));
  const doors = {
    windows: empty ? null : { enabled: true, tier: 'program', go_live_permitted: false, settings: {}, can: { manage: true, cancel: true, configure: false }, doors: doorRows, rules: [], occurrences: occ, now: NOW.toISOString(), foreign_paused: worst ? [{ door: 's1:0', station_id: 's1', relay: 0, label: LONG_HE, incident_id: 'i1', paused_at: iso(-1) }] : [] },
    emergency: empty ? null : { enabled: true, open_enabled: true, hold_ms: 1500, can: { lock: true, open: true }, active: null, home_widget: true },
  };
  // PRESENCE-2280: the building presence answer (worst: long and unbreakable room names, a dozen rooms; empty: nothing configured)
  const roomNames = worst ? [LONG_HE, UNB, MIX, 'א', 'לובי', 'חדר ישיבות ' + 'ב'.repeat(30), 'מסדרון', 'מטבחון', 'כניסה', 'חניון', 'גג', 'מחסן'] : ['לובי', 'כניסה', 'חניון'];
  const presence = empty ? null : {
    configured: true, enabled: true, fresh: true, status: 'occupied' as const, occupied_rooms: 2, at: iso(0),
    settings: { enabled: true, retention_days: 30, home_display: 'card' as const, map_tint: true, hold_seconds: 60, empty_minutes: 30 },
    rooms: roomNames.map((n, i) => ({ area_id: `a${i}`, name: n, status: (['occupied', 'clear', 'unknown'] as const)[i % 3], sensors: 1, empty_since: i % 3 === 1 ? iso(-40) : null })),
  };
  return { cfg, data, temp, gens, doors, notices, presence };
}

const root = document.getElementById('root') as HTMLElement;
root.style.cssText = 'display:block;min-height:100vh;background:var(--sw-bg);color:var(--sw-text);font-family:var(--sw-font);padding:8px';
const TITLES: Record<string, string> = { clock: 'שעון', weather: 'מזג אוויר', shabbat: 'שבת', alarm: 'אזעקה', quick: 'פעולות מהירות', agenda: 'יומן', launcher: 'משגר מהיר', temperature: 'טמפרטורות', generators: 'גנרטור', doors: 'דלתות', presence: 'נוכחות במבנה', notices: 'לוח הודעות', media: 'מולטימדיה' };

/** Mount one widget. Resolves when rendered. */
(window as unknown as Record<string, unknown>).wbMount = async (id: WidgetId, size: Size, ds: Dataset, width: number, opts: { editing?: boolean; layout?: string } = {}) => {
  const b = build(ds);
  const cell = document.createElement('div');
  cell.id = 'cell';
  cell.style.cssText = `width:${width}px;max-width:${width}px;box-sizing:border-box`;
  const el = document.createElement('home-widgets') as unknown as HTMLElement & Record<string, unknown>;
  el.config = b.cfg;
  el.data = b.data;
  const qa = { lights_off: true, all_off: true };
  const found = resolveWidgets(b.cfg, 'a', b.data, { editing: ds === 'empty', quickAllowed: qa, elevatorsAvailable: false, temperatureAvailable: true, generatorsAvailable: true, doorsAvailable: true, noticesAvailable: true, presenceAvailable: true, mediaAvailable: false }).find((x) => x.id === id);
  el.items = found ? [{ ...found, size, title: ds === 'worst' ? LONG_HE : found.title || TITLES[id] || id }] : [];
  el.editing = ds === 'empty';
  el.layout = opts.layout ?? 'stack';
  el.quick = { allowed: { lights_off: true, all_off: true }, lightsOn: ds === 'worst' ? 1234 : ds === 'empty' ? 0 : 3, switchesOn: ds === 'worst' ? 99999 : 1 };
  el.temperatureUnits = b.temp;
  el.generators = b.gens;
  el.doors = b.doors;
  el.notices = { notices: b.notices, emptyMode: 'line' };
  el.presence = b.presence;
  el.alarmLink = true;
  cell.append(el);
  root.replaceChildren(cell);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 150));
};
/** WIDGETFIX-298: the home screen's real top row - several widgets side by side in ONE <home-widgets> (layout `row` on a desktop, the
 * product's own band), in a cell `width` px wide (null = the full page width). Normal data; two elevators (one out of service, one in
 * operation) and a generator on the grid. */
(window as unknown as Record<string, unknown>).wbMountRow = async (ids: WidgetId[], width: number | null, opts: { layout?: string; fit?: string; size?: Size; editing?: boolean } = {}) => {
  const b = build('normal');
  b.cfg.order = [...ids, ...b.cfg.order.filter((x) => !ids.includes(x))];
  b.gens[0].summary.engine_state.value = 'stopped';
  b.gens[0].summary.mains_available.value = true;
  b.gens[0].summary.ats_position.value = 'mains';
  const cell = document.createElement('div');
  cell.id = 'cell';
  cell.style.cssText = width ? `width:${width}px;max-width:${width}px;box-sizing:border-box` : 'width:100%;box-sizing:border-box';
  const el = document.createElement('home-widgets') as unknown as HTMLElement & Record<string, unknown>;
  el.config = b.cfg;
  el.data = b.data;
  const found = resolveWidgets(b.cfg, 'a', b.data, { quickAllowed: { lights_off: true, all_off: true }, elevatorsAvailable: true, temperatureAvailable: true, generatorsAvailable: true, doorsAvailable: true, noticesAvailable: true, presenceAvailable: true, mediaAvailable: false });
  el.items = ids.map((id) => found.find((x) => x.id === id)).filter((x) => !!x).map((x) => (opts.size ? { ...x!, size: opts.size } : x!));
  el.editing = !!opts.editing;
  el.layout = opts.layout ?? 'row';
  if (opts.fit) el.setAttribute('data-fit', opts.fit);
  el.quick = { allowed: { lights_off: true, all_off: true }, lightsOn: 3, switchesOn: 1 };
  el.temperatureUnits = b.temp;
  el.generators = b.gens;
  el.doors = b.doors;
  el.notices = { notices: b.notices, emptyMode: 'line' };
  el.presence = b.presence;
  el.elevators = [
    { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: null, state: 'out_of_service', reason: 'out_of_service', partial: false, stale: false, since: new Date(Date.now() - 72 * 60_000).toISOString(), roles: ['out_of_service'], flags: { out_of_service: true }, extras: [] },
    { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: null, state: 'active', reason: 'active', partial: false, stale: false, since: new Date(Date.now() - 3 * 3600_000).toISOString(), roles: ['out_of_service'], flags: { out_of_service: false }, extras: [] },
  ];
  el.alarmLink = true;
  cell.append(el);
  root.replaceChildren(cell);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 200));
};
(window as unknown as Record<string, unknown>).wbReady = true;
