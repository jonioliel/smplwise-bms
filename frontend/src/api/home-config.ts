/**
 * The home screen's widget configuration and what it resolves to - pure functions, no imports with side effects (the
 * unit specs load this module in node). Backend: services/home_config.py (the same shape, validated there in full) and
 * services/home_screen.py (the data behind the widgets).
 *
 * Three directions (a: control centre - a wide band above everything; b: side panel; c: compact single row) share ONE
 * widget system: clock, weather, Shabbat, the alarm status card (read-only) and the quick actions. Each widget has a size
 * (s / m / l) per direction, an on / off switch, a heading and the entities that feed it. The order is one list for all
 * directions. `resolveWidgets` turns config + data into the cards the screen draws (and, in edit mode, the ghosts that
 * explain why a widget is not shown).
 */

export type Direction = 'a' | 'b' | 'c';
export const DIRECTIONS: Direction[] = ['a', 'b', 'c'];
export const DIRECTION_DEFAULT: Direction = 'a';
export const DIRECTION_LABEL: Record<Direction, string> = { a: 'מרכז בקרה', b: 'לוח צד', c: 'מצומצם' };
export const DIRECTION_LETTER: Record<Direction, string> = { a: 'א', b: 'ב', c: 'ג' };
export type Side = 'start' | 'end';
export const SIDES: Side[] = ['start', 'end'];
/** The side of b's widget column, as the person sees it: "end" is the left edge of the screen in Hebrew. */
export const SIDE_LABEL: Record<Side, string> = { end: 'שמאל', start: 'ימין' };

export type WidgetId = 'clock' | 'weather' | 'shabbat' | 'alarm' | 'quick' | 'media' | 'agenda' | 'launcher';
/** `media` (CR-015 §7.5) is appended, so a saved order without it keeps its look: it lands last, like every widget a release adds.
 * BV1 (2026-10-05): `agenda` (the next event of the chosen calendars) and `launcher` (the quick-launcher grid) are appended the same way. */
export const WIDGET_IDS: WidgetId[] = ['clock', 'weather', 'shabbat', 'alarm', 'quick', 'media', 'agenda', 'launcher'];
export const WIDGET_NAME: Record<WidgetId, string> = { clock: 'שעון', weather: 'מזג אוויר', shabbat: 'שבת', alarm: 'אזעקה', quick: 'פעולות מהירות', media: 'מולטימדיה', agenda: 'יומן', launcher: 'משגר מהיר' };

/** BV1: the clock and the weather have a second presentation in the Bubble skin - a tile (the other skins keep the card). */
export type TileStyle = 'card' | 'tile';
export const TILE_STYLES: TileStyle[] = ['card', 'tile'];
export const TILE_STYLE_LABEL: Record<TileStyle, string> = { card: 'כרטיס', tile: 'אריח' };
export type AgendaDays = 1 | 3 | 7 | 14;
export const AGENDA_DAYS: AgendaDays[] = [1, 3, 7, 14];
export const AGENDA_DAYS_LABEL: Record<AgendaDays, string> = { 1: 'היום', 3: '3 ימים', 7: 'שבוע', 14: 'שבועיים' };
export const AGENDA_CALENDARS_MAX = 6;
/** How many events the agenda tile lists per size. */
export const AGENDA_SHOWN: Record<Size, number> = { s: 1, m: 3, l: 6 };

export type Size = 's' | 'm' | 'l';
export const SIZES: Size[] = ['s', 'm', 'l'];
export const SIZE_LABEL: Record<Size, string> = { s: 'קטן', m: 'בינוני', l: 'גדול' };
export type Sizes = Record<Direction, Size>;

/** How the widgets are presented on a PHONE (under 600 px), edited apart from the desktop: a horizontal snap row, one card under the
 * other (the default) or two per row. */
export type PhoneLayout = 'snap' | 'stack' | 'two';
export const PHONE_LAYOUTS: PhoneLayout[] = ['stack', 'two', 'snap'];
export const PHONE_LAYOUT_LABEL: Record<PhoneLayout, string> = { snap: 'בשורה גוללת', stack: 'אחד מתחת לשני', two: 'שתיים בשורה' };
export const PHONE_LAYOUT_DEFAULT: PhoneLayout = 'stack';
/** The widest viewport that is a phone (the tiles' breakpoint: under 600 px). */
export const PHONE_MAX_WIDTH = 599;

export type ClockMode = 'time' | 'datetime';
export const CLOCK_MODES: ClockMode[] = ['time', 'datetime'];
export const CLOCK_MODE_LABEL: Record<ClockMode, string> = { time: 'שעה', datetime: 'שעה ותאריך' };

export type WeatherField = 'condition' | 'temperature' | 'apparent' | 'humidity' | 'wind' | 'pressure' | 'visibility' | 'uv' | 'precipitation' | 'forecast';
export const WEATHER_FIELDS: WeatherField[] = ['condition', 'temperature', 'apparent', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation', 'forecast'];
export const WEATHER_FIELD_LABEL: Record<WeatherField, string> = {
  condition: 'מצב נוכחי',
  temperature: 'טמפרטורה',
  apparent: 'טמפרטורה מורגשת',
  humidity: 'לחות',
  wind: 'רוח',
  pressure: 'לחץ אוויר',
  visibility: 'ראות',
  uv: 'מדד UV',
  precipitation: 'משקעים',
  forecast: 'תחזית',
};
/** The numeric fields a sensor may feed instead of the weather entity's own value. */
export const WEATHER_SOURCE_FIELDS: WeatherField[] = ['temperature', 'apparent', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation'];
export const WEATHER_FIELDS_DEFAULT: WeatherField[] = ['temperature', 'condition', 'humidity', 'wind', 'forecast'];
export type ForecastLen = '3' | '5' | 'max';
export const FORECAST_LENS: ForecastLen[] = ['3', '5', 'max'];
/** "max" shows every entry the entity carries, up to this many (a card cannot hold 14 columns). */
export const FORECAST_MAX_SHOWN = 8;

export type QuickAction = 'lights_off' | 'all_off';
export const QUICK_ACTIONS: QuickAction[] = ['lights_off', 'all_off'];
export const QUICK_ACTION_LABEL: Record<QuickAction, string> = { lights_off: 'כבה תאורה בלבד', all_off: 'כבה הכל בבניין' };

export type CalendarField = 'date' | 'parsha' | 'candles' | 'havdalah' | 'holiday';
export const CALENDAR_FIELDS: CalendarField[] = ['date', 'parsha', 'candles', 'havdalah', 'holiday'];
export const CALENDAR_FIELD_LABEL: Record<CalendarField, string> = { date: 'תאריך עברי', parsha: 'פרשת השבוע', candles: 'הדלקת נרות', havdalah: 'צאת שבת', holiday: 'חג' };
export const EXTRAS_MAX = 4;
export const LABEL_MAX = 30;

export interface CommonCfg {
  on: boolean;
  sizes: Sizes;
  /** The widget's own heading ('' = its name). */
  label: string;
  /** On a phone: shown (null = the same as on) ... */
  phone_on: boolean | null;
  /** ... and at this size (null = the desktop size of the direction, at most medium). */
  phone_size: Size | null;
}
export interface ClockCfg extends CommonCfg {
  mode: ClockMode;
  seconds: boolean;
  hebrew: boolean;
  style: TileStyle;
}
export interface WeatherCfg extends CommonCfg {
  entity: string;
  fields: WeatherField[];
  forecast: ForecastLen;
  sources: Partial<Record<WeatherField, string>>;
  style: TileStyle;
}
/** BV1: the agenda tile - the chosen `calendar.*` entities and how far ahead it looks. */
export interface AgendaCfg extends CommonCfg {
  calendars: string[];
  days: AgendaDays;
}
/** BV1: the quick-launcher grid (api/launcher.ts knows what each item means and who may press it). */
export interface LaunchItemCfg {
  kind: 'route' | 'scene' | 'script' | 'quick';
  id: string;
  label: string;
}
export interface LauncherCfg extends CommonCfg {
  items: LaunchItemCfg[];
}
export type ShabbatCfg = CommonCfg;
export interface AlarmCfg extends CommonCfg {
  entity: string;
}
export interface QuickCfg extends CommonCfg {
  actions: QuickAction[];
}
/** The media widget (CR-015): the screens that are on, as chips that open the remote - no entity to choose, so only the common settings. */
export type MediaCfg = CommonCfg;
export interface CalendarCfg {
  date: string;
  parsha: string;
  candles: string;
  havdalah: string;
  holiday: string;
  extras: { entity_id: string; label: string }[];
}
export interface HomeConfig {
  order: WidgetId[];
  phone_layout: PhoneLayout;
  clock: ClockCfg;
  weather: WeatherCfg;
  shabbat: ShabbatCfg;
  alarm: AlarmCfg;
  quick: QuickCfg;
  media: MediaCfg;
  agenda: AgendaCfg;
  launcher: LauncherCfg;
  calendar: CalendarCfg;
}

export const DEFAULT_SIZES: Record<WidgetId, Sizes> = {
  clock: { a: 'l', b: 'm', c: 'm' },
  weather: { a: 'l', b: 'm', c: 'm' },
  shabbat: { a: 'm', b: 'm', c: 'm' },
  alarm: { a: 'm', b: 's', c: 'm' },
  quick: { a: 'm', b: 's', c: 'm' },
  media: { a: 'm', b: 's', c: 'm' },
  agenda: { a: 'm', b: 'm', c: 'm' },
  launcher: { a: 'm', b: 's', c: 'm' },
};

export function defaultConfig(): HomeConfig {
  const base = (id: WidgetId): CommonCfg => ({ on: true, sizes: { ...DEFAULT_SIZES[id] }, label: '', phone_on: null, phone_size: null });
  return {
    order: [...WIDGET_IDS],
    phone_layout: PHONE_LAYOUT_DEFAULT,
    clock: { ...base('clock'), mode: 'datetime', seconds: false, hebrew: true, style: 'card' },
    weather: { ...base('weather'), entity: '', fields: [...WEATHER_FIELDS_DEFAULT], forecast: '5', sources: {}, style: 'card' },
    shabbat: base('shabbat'),
    alarm: { ...base('alarm'), entity: '' },
    quick: { ...base('quick'), actions: [...QUICK_ACTIONS] },
    media: base('media'),
    agenda: { ...base('agenda'), calendars: [], days: 7 },
    launcher: { ...base('launcher'), items: [] },
    calendar: { date: '', parsha: '', candles: '', havdalah: '', holiday: '', extras: [] },
  };
}

// ------------------------------------------------------------------------------------------------ reading what the server sent

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function sizesOf(v: unknown, id: WidgetId): Sizes {
  const o = isObj(v) ? v : {};
  return { a: pick(o.a, SIZES, DEFAULT_SIZES[id].a), b: pick(o.b, SIZES, DEFAULT_SIZES[id].b), c: pick(o.c, SIZES, DEFAULT_SIZES[id].c) };
}

function commonOf(v: unknown, id: WidgetId): CommonCfg {
  const o = isObj(v) ? v : {};
  return { on: bool(o.on, true), sizes: sizesOf(o.sizes, id), label: str(o.label), phone_on: typeof o.phone_on === 'boolean' ? o.phone_on : null, phone_size: SIZES.includes(o.phone_size as Size) ? (o.phone_size as Size) : null };
}

function listOf<T extends string>(v: unknown, allowed: readonly T[], fallback: readonly T[]): T[] {
  if (!Array.isArray(v)) return [...fallback];
  const out: T[] = [];
  for (const x of v) if (allowed.includes(x as T) && !out.includes(x as T)) out.push(x as T);
  return out;
}

/** The configuration as the server sent it (`home.widgets` of GET /settings, `home.config` of GET /devices/tree), tolerant:
 * anything missing or foreign takes the default, so an older or newer server never breaks the screen. */
export function configOf(raw: unknown): HomeConfig {
  const o = isObj(raw) ? raw : {};
  const d = defaultConfig();
  const order = listOf<WidgetId>(o.order, WIDGET_IDS, []);
  const clock = isObj(o.clock) ? o.clock : {};
  const weather = isObj(o.weather) ? o.weather : {};
  const alarm = isObj(o.alarm) ? o.alarm : {};
  const quick = isObj(o.quick) ? o.quick : {};
  const agenda = isObj(o.agenda) ? o.agenda : {};
  const launcher = isObj(o.launcher) ? o.launcher : {};
  const cal = isObj(o.calendar) ? o.calendar : {};
  const sources: Partial<Record<WeatherField, string>> = {};
  if (isObj(weather.sources)) for (const f of WEATHER_SOURCE_FIELDS) if (typeof weather.sources[f] === 'string' && weather.sources[f]) sources[f] = weather.sources[f] as string;
  const calendars: string[] = [];
  if (Array.isArray(agenda.calendars)) for (const x of agenda.calendars) if (typeof x === 'string' && /^calendar\.[a-z0-9_]+$/.test(x) && !calendars.includes(x) && calendars.length < AGENDA_CALENDARS_MAX) calendars.push(x);
  const items: LaunchItemCfg[] = [];
  if (Array.isArray(launcher.items)) {
    for (const x of launcher.items) {
      if (!isObj(x) || !['route', 'scene', 'script', 'quick'].includes(x.kind as string) || typeof x.id !== 'string' || !x.id) continue;
      if (items.some((i) => i.kind === x.kind && i.id === x.id) || items.length >= 12) continue;
      items.push({ kind: x.kind as LaunchItemCfg['kind'], id: x.id, label: str(x.label) });
    }
  }
  return {
    order: [...order, ...WIDGET_IDS.filter((w) => !order.includes(w))],
    phone_layout: pick(o.phone_layout, PHONE_LAYOUTS, PHONE_LAYOUT_DEFAULT),
    clock: { ...commonOf(o.clock, 'clock'), mode: pick(clock.mode, CLOCK_MODES, d.clock.mode), seconds: bool(clock.seconds, false), hebrew: bool(clock.hebrew, true), style: pick(clock.style, TILE_STYLES, 'card') },
    weather: { ...commonOf(o.weather, 'weather'), entity: str(weather.entity), fields: listOf(weather.fields, WEATHER_FIELDS, WEATHER_FIELDS_DEFAULT), forecast: pick(weather.forecast, FORECAST_LENS, '5'), sources, style: pick(weather.style, TILE_STYLES, 'card') },
    shabbat: commonOf(o.shabbat, 'shabbat'),
    alarm: { ...commonOf(o.alarm, 'alarm'), entity: str(alarm.entity) },
    quick: { ...commonOf(o.quick, 'quick'), actions: listOf(quick.actions, QUICK_ACTIONS, QUICK_ACTIONS) },
    media: commonOf(o.media, 'media'),
    agenda: { ...commonOf(o.agenda, 'agenda'), calendars, days: AGENDA_DAYS.includes(agenda.days as AgendaDays) ? (agenda.days as AgendaDays) : 7 },
    launcher: { ...commonOf(o.launcher, 'launcher'), items },
    calendar: {
      date: str(cal.date),
      parsha: str(cal.parsha),
      candles: str(cal.candles),
      havdalah: str(cal.havdalah),
      holiday: str(cal.holiday),
      extras: Array.isArray(cal.extras) ? cal.extras.filter(isObj).map((e) => ({ entity_id: str(e.entity_id), label: str(e.label) })).filter((e) => e.entity_id).slice(0, EXTRAS_MAX) : [],
    },
  };
}

export function sameConfig(a: HomeConfig, b: HomeConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The body of PATCH /settings `home.widgets`: the whole configuration (the server validates and stores it whole). */
export function configBody(c: HomeConfig): Record<string, unknown> {
  return JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
}

// ------------------------------------------------------------------------------------------------ the data behind the widgets

export interface WeatherValue {
  v: number;
  unit: string | null;
  bearing?: number;
  bearing_text?: string;
}
export interface ForecastEntry {
  datetime: string;
  condition: string;
  temperature: number | null;
  templow?: number;
  precipitation_probability?: number;
}
export interface WeatherData {
  entity_id: string;
  name: string;
  available: boolean;
  condition: string | null;
  values: Partial<Record<WeatherField, WeatherValue>>;
  forecast: ForecastEntry[];
  forecast_len: number;
  offers: WeatherField[];
}
export interface SensorData {
  state: string;
  name: string;
  unit: string | null;
  device_class: string | null;
  available: boolean;
}
export interface AlarmData {
  entity_id: string;
  name: string;
  state: string | null;
  since: string | null;
  available: boolean;
}
/** BV1: one coming event of a mirrored calendar (its next event, as the platform reported it). */
export interface AgendaEvent {
  calendar: string;
  calendar_name: string;
  message: string;
  /** ISO instants (UTC); an all-day event's start is the day it names at 00:00. */
  start: string;
  end: string | null;
  all_day: boolean;
  location: string | null;
}
export interface AgendaData {
  calendars: { entity_id: string; name: string; available: boolean; found: boolean }[];
  events: AgendaEvent[];
}
export interface HomeData {
  weather: WeatherData | null;
  sensors: Record<string, SensorData>;
  alarm: AlarmData | null;
  /** BV1: null when the agenda widget is off or has no calendar. */
  agenda?: AgendaData | null;
  /** BV1: the known names of the launcher's scene / script entities (entity id -> name). */
  names?: Record<string, string>;
}
export const NO_DATA: HomeData = { weather: null, sensors: {}, alarm: null, agenda: null, names: {} };

/** GET /devices/tree `home`. */
export interface HomeView {
  direction: Direction;
  side: Side;
  time_zone: string;
  /** The caller holds screen.personalize (the server decided; the personal controls exist only then). */
  personalize: boolean;
  config: HomeConfig;
  data: HomeData;
}

export function homeViewOf(raw: unknown): HomeView | null {
  if (!isObj(raw)) return null;
  const data = isObj(raw.data) ? raw.data : {};
  return {
    direction: pick(raw.direction, DIRECTIONS, DIRECTION_DEFAULT),
    side: pick(raw.side, SIDES, 'end'),
    time_zone: str(raw.time_zone, 'Asia/Jerusalem'),
    personalize: raw.personalize === true,
    config: configOf(raw.config),
    data: {
      weather: isObj(data.weather) ? (data.weather as unknown as WeatherData) : null,
      sensors: isObj(data.sensors) ? (data.sensors as Record<string, SensorData>) : {},
      alarm: isObj(data.alarm) ? (data.alarm as unknown as AlarmData) : null,
      agenda: agendaOf(data.agenda),
      names: isObj(data.names) ? Object.fromEntries(Object.entries(data.names).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {},
    },
  };
}

/** The agenda block as the server sent it, tolerant (an older server sends none = null). */
export function agendaOf(raw: unknown): AgendaData | null {
  if (!isObj(raw)) return null;
  const calendars = Array.isArray(raw.calendars) ? raw.calendars.filter(isObj).map((c) => ({ entity_id: str(c.entity_id), name: str(c.name) || str(c.entity_id), available: c.available === true, found: c.found !== false })) : [];
  const events = Array.isArray(raw.events)
    ? raw.events.filter(isObj).filter((e) => typeof e.start === 'string' && typeof e.message === 'string').map((e) => ({
        calendar: str(e.calendar), calendar_name: str(e.calendar_name), message: str(e.message), start: str(e.start), end: typeof e.end === 'string' ? e.end : null, all_day: e.all_day === true, location: typeof e.location === 'string' && e.location ? e.location : null,
      }))
    : [];
  return { calendars, events };
}

/** GET /devices/home-candidates. */
export interface HomeCandidates {
  weather: { entity_id: string; name: string; state: string | null; values?: WeatherData['values']; forecast?: ForecastEntry[]; forecast_len?: number; offers?: WeatherField[] }[];
  alarms: { entity_id: string; name: string; state: string | null }[];
  sensors: { entity_id: string; name: string; state: string | null; unit?: string | null; device_class: string | null; suggested: boolean; binary?: boolean }[];
  suggested_calendar?: Partial<Record<CalendarField, string>>;
  /** BV1: the mirrored calendars (with their next event), scenes and scripts the agenda / launcher may be pointed at. */
  calendars?: { entity_id: string; name: string; state: string | null; event: AgendaEvent | null }[];
  scenes?: { entity_id: string; name: string; state: string | null }[];
  scripts?: { entity_id: string; name: string; state: string | null }[];
}

const UNAVAILABLE = new Set(['', 'unavailable', 'unknown']);

/** The built-in default with the catalogue's suggestions (a weather entity, one Jewish-calendar sensor per field) - what the
 * server shows for an installation that never saved, and what edit mode's "אפס ווידג׳טים לברירת מחדל" restores. */
export function suggestConfig(cands: HomeCandidates | null): HomeConfig {
  const cfg = defaultConfig();
  const weather = [...(cands?.weather ?? [])].sort((a, b) => a.entity_id.localeCompare(b.entity_id)).find((w) => !UNAVAILABLE.has(w.state ?? ''));
  if (weather) cfg.weather.entity = weather.entity_id;
  for (const f of CALENDAR_FIELDS) cfg.calendar[f] = cands?.suggested_calendar?.[f] ?? '';
  return cfg;
}

/** The data a draft configuration would show: what the server sent for the SAVED entities, and - for an entity the draft
 * chose that the server did not resolve - what the candidate list knows about it (its state now). Edit mode's live preview. */
export function previewData(cfg: HomeConfig, base: HomeData, cands: HomeCandidates | null): HomeData {
  const sensors: Record<string, SensorData> = {};
  const ids = [...CALENDAR_FIELDS.map((f) => cfg.calendar[f]), ...cfg.calendar.extras.map((e) => e.entity_id), ...Object.values(cfg.weather.sources)].filter(Boolean) as string[];
  for (const id of ids) {
    const known = base.sensors[id];
    if (known) {
      sensors[id] = known;
      continue;
    }
    const c = cands?.sensors.find((s) => s.entity_id === id);
    if (c) sensors[id] = { state: UNAVAILABLE.has(c.state ?? '') ? '' : String(c.state), name: c.name, unit: c.unit ?? null, device_class: c.device_class, available: !UNAVAILABLE.has(c.state ?? '') };
  }
  let weather: WeatherData | null = null;
  if (cfg.weather.entity) {
    if (base.weather && base.weather.entity_id === cfg.weather.entity) weather = base.weather;
    else {
      const c = cands?.weather.find((w) => w.entity_id === cfg.weather.entity);
      if (c) {
        const available = !UNAVAILABLE.has(c.state ?? '');
        weather = { entity_id: c.entity_id, name: c.name, available, condition: available ? c.state : null, values: c.values ?? {}, forecast: c.forecast ?? [], forecast_len: c.forecast_len ?? 0, offers: c.offers ?? ['condition'] };
      }
    }
  }
  let alarm = base.alarm;
  if (cfg.alarm.entity && base.alarm?.entity_id !== cfg.alarm.entity) {
    const c = cands?.alarms.find((a) => a.entity_id === cfg.alarm.entity);
    alarm = c ? { entity_id: c.entity_id, name: c.name, state: c.state, since: null, available: !UNAVAILABLE.has(c.state ?? '') } : null;
  } else if (!alarm && !cfg.alarm.entity && cands?.alarms.length) {
    // no panel chosen ("automatic") and the server sent none (the card was off when the tree was read): the most urgent candidate
    const c = cands.alarms.find((a) => a.state === 'triggered') ?? cands.alarms[0];
    alarm = { entity_id: c.entity_id, name: c.name, state: c.state, since: null, available: !UNAVAILABLE.has(c.state ?? '') };
  }
  // BV1: the agenda from the candidates' next events when the draft chose calendars the server did not resolve
  let agenda: AgendaData | null = base.agenda ?? null;
  const chosen = cfg.agenda.calendars;
  if (!chosen.length) agenda = null;
  else if (!agenda || agenda.calendars.map((c) => c.entity_id).join(',') !== chosen.join(',')) {
    const known = new Map((agenda?.calendars ?? []).map((c) => [c.entity_id, c]));
    const events = new Map((agenda?.events ?? []).map((e) => [e.calendar, e]));
    const out: AgendaData = { calendars: [], events: [] };
    for (const id of chosen) {
      const k = known.get(id);
      const c = cands?.calendars?.find((x) => x.entity_id === id);
      out.calendars.push(k ?? { entity_id: id, name: c?.name ?? id, available: !!c && !UNAVAILABLE.has(c.state ?? ''), found: !!c });
      const ev = events.get(id) ?? c?.event ?? null;
      if (ev) out.events.push(ev);
    }
    out.events.sort((a, b) => a.start.localeCompare(b.start) || a.calendar.localeCompare(b.calendar));
    agenda = out;
  }
  // the launcher's entity names: the server's, then the candidates' for an entity the draft just chose
  const names: Record<string, string> = { ...(base.names ?? {}) };
  for (const it of cfg.launcher.items) {
    if (names[it.id] || (it.kind !== 'scene' && it.kind !== 'script')) continue;
    const c = (it.kind === 'scene' ? cands?.scenes : cands?.scripts)?.find((x) => x.entity_id === it.id);
    if (c) names[it.id] = c.name;
  }
  return { weather, sensors, alarm, agenda, names };
}

// ------------------------------------------------------------------------------------------------ what the screen draws

/** Why a widget is not drawn: off (the switch), none (nothing chosen to feed it), unavail (the entity is not reporting),
 * noalarm (no alarm panel this user may see), noaction (no quick action this user may run), nomedia (no screen this user may see - the media widget). 'ok' = drawn. */
export type Avail = 'ok' | 'off' | 'none' | 'unavail' | 'noalarm' | 'noaction' | 'nomedia' | 'nolaunch';

export interface WidgetItem {
  id: WidgetId;
  avail: Avail;
  size: Size;
  /** Heading: the widget's own, or its name. */
  title: string;
}

export interface ResolveOpts {
  /** Edit mode: widgets that are not shown come back too (as ghosts that say why). */
  editing?: boolean;
  /** A phone: each widget's phone_on / phone_size apply instead of the desktop's on / size. */
  phone?: boolean;
  /** Which quick actions this user may run (devices.control_bulk on the building); none = the quick card is absent. */
  quickAllowed?: Partial<Record<QuickAction, boolean>>;
  /** Whether the media widget has anything to show for this user (media.read and at least one screen); unset = the widget decides itself. */
  mediaAvailable?: boolean;
  /** BV1: whether this user may press a launcher item (api/launcher.ts launchAllowed); unset = every configured item counts. */
  launchAllowed?: (item: LaunchItemCfg) => boolean;
}

/** Whether a widget is shown on this kind of screen: the phone has its own switch, defaulting to the desktop's. */
export const widgetOn = (w: CommonCfg, phone: boolean): boolean => (phone ? w.phone_on ?? w.on : w.on);

/** A widget's size on this kind of screen: on a phone its own, else the desktop size of the direction capped at medium. */
export function widgetSize(w: CommonCfg, direction: Direction, phone: boolean): Size {
  if (!phone) return w.sizes[direction];
  if (w.phone_size) return w.phone_size;
  const d = w.sizes[direction];
  return d === 'l' ? 'm' : d;
}

export const hasValue = (s: SensorData | undefined): s is SensorData => !!s && s.available && !UNAVAILABLE.has(s.state);

/** Which widgets are drawn (in `cfg.order`) for a direction, with the size each has there. */
export function resolveWidgets(cfg: HomeConfig, direction: Direction, data: HomeData, opts: ResolveOpts = {}): WidgetItem[] {
  const out: WidgetItem[] = [];
  for (const id of cfg.order) {
    const w = cfg[id];
    let avail: Avail = 'ok';
    if (!widgetOn(w, !!opts.phone)) avail = 'off';
    else if (id === 'weather') {
      avail = !cfg.weather.entity || !data.weather ? 'none' : !data.weather.available ? 'unavail' : 'ok';
    } else if (id === 'shabbat') {
      const ids = [cfg.calendar.parsha, cfg.calendar.candles, cfg.calendar.havdalah, cfg.calendar.holiday, ...cfg.calendar.extras.map((e) => e.entity_id)].filter(Boolean);
      avail = !ids.length ? 'none' : ids.some((i) => hasValue(data.sensors[i])) ? 'ok' : 'unavail';
    } else if (id === 'alarm') {
      avail = data.alarm ? 'ok' : 'noalarm';
    } else if (id === 'quick') {
      const allowed = cfg.quick.actions.filter((a) => opts.quickAllowed?.[a]);
      avail = allowed.length ? 'ok' : 'noaction';
    } else if (id === 'media') {
      avail = opts.mediaAvailable === false ? 'nomedia' : 'ok';
    } else if (id === 'agenda') {
      // BV1: no calendar = none; calendars that are all missing / not reporting = unavail; a calendar with no coming event still draws (the empty state)
      const cals = cfg.agenda.calendars;
      avail = !cals.length ? 'none' : !data.agenda || !data.agenda.calendars.some((c) => c.available) ? 'unavail' : 'ok';
    } else if (id === 'launcher') {
      const items = cfg.launcher.items.filter((it) => (opts.launchAllowed ? opts.launchAllowed(it) : true));
      avail = !cfg.launcher.items.length ? 'none' : items.length ? 'ok' : 'nolaunch';
    }
    if (avail === 'ok' || opts.editing) out.push({ id, avail, size: widgetSize(w, direction, !!opts.phone), title: w.label.trim() || WIDGET_NAME[id] });
  }
  return out;
}

/** Moves one widget to a place in the order (edit mode's drag and its up / down buttons). */
export function moveWidget(order: WidgetId[], id: WidgetId, to: number): WidgetId[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const dest = Math.max(0, Math.min(order.length - 1, to));
  if (dest === from) return order;
  const out = [...order];
  out.splice(from, 1);
  out.splice(dest, 0, id);
  return out;
}

/** The forecast the card draws: `len` entries ("max" = all the entity carries, up to FORECAST_MAX_SHOWN), only those with a time. */
export function forecastShown(entries: ForecastEntry[], len: ForecastLen): ForecastEntry[] {
  const usable = entries.filter((e) => !Number.isNaN(new Date(e.datetime).getTime()));
  return usable.slice(0, len === 'max' ? FORECAST_MAX_SHOWN : Number(len));
}

/** Daily entries are labelled with the weekday, hourly ones with the hour (the spacing decides). */
export function forecastIsDaily(entries: ForecastEntry[]): boolean {
  if (entries.length < 2) return true;
  const gap = new Date(entries[1].datetime).getTime() - new Date(entries[0].datetime).getTime();
  return Math.abs(gap) >= 20 * 3600_000;
}

/** How many forecast entries a chosen length yields for an entity that carries `n` (the editor's "3 / 5 / max" hint). */
export function forecastCount(n: number, len: ForecastLen): number {
  return Math.min(n, len === 'max' ? FORECAST_MAX_SHOWN : Number(len));
}

// ------------------------------------------------------------------------------------------------ calendar and text helpers

export function safeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('he-IL', { timeZone: zone });
    return zone;
  } catch {
    return 'Asia/Jerusalem';
  }
}

/** A whole number 1-999 in Hebrew letters: 19 = "י״ט", 15 = "ט״ו", 3 = "ג׳", 787 = "תשפ״ז". */
export function gematria(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const rest = n % 100;
  let letters = hundreds[Math.floor(n / 100)];
  if (rest === 15 || rest === 16) letters += rest === 15 ? 'טו' : 'טז'; // never the divine name
  else letters += tens[Math.floor(rest / 10)] + ones[rest % 10];
  const chars = [...letters];
  return chars.length === 1 ? `${letters}׳` : `${chars.slice(0, -1).join('')}״${chars[chars.length - 1]}`;
}

/** The Hebrew date computed in the browser (the fallback when no sensor is chosen): "י״ט בתשרי התשפ״ז". The day and the year
 * are written in letters like the Jewish Calendar sensors do; anything Intl cannot format is ''. */
export function hebrewDate(now: Date, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: safeZone(zone), day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = Number(get('day'));
    const year = Number(get('year'));
    const month = get('month');
    if (!day || !year || !month) return '';
    const between = parts.find((p) => p.type === 'literal')?.value ?? ' ב';
    return `${gematria(day)}${between}${month} ה${gematria(year % 1000)}`;
  } catch {
    return '';
  }
}

/** A Jewish-calendar time sensor's value as "HH:mm" in the site's zone: an ISO timestamp is converted; anything else (a
 * sensor that already reports "17:32") is shown as reported. '' for no value. */
export function timeOfState(state: string | null | undefined, zone: string): string {
  const s = (state ?? '').trim();
  if (!s || s === 'unknown' || s === 'unavailable') return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('he-IL', { timeZone: safeZone(zone), hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  return s;
}

/** "פרשת נח" for "נח" (an integration that already says "פרשת" is left alone). */
export function parshaText(state: string | null | undefined): string {
  const p = (state ?? '').trim();
  if (!p || p === 'unknown' || p === 'unavailable') return '';
  return /^פרשת|^פרשה/.test(p) ? p : `פרשת ${p}`;
}

/** The clock's parts in the site's zone: "14:32", ":07" (only with seconds), the weekday and the date in three lengths. */
export function clockParts(now: Date, zone: string): { h: string; m: string; s: string; weekdayShort: string; weekdayLong: string; dateShort: string; dateLong: string; dateYear: string } {
  const tz = safeZone(zone);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, ...o }).format(now);
  const two = (v: string) => v.padStart(2, '0');
  return {
    h: two(f({ hour: 'numeric', hourCycle: 'h23' }).replace(/\D/g, '') || '0'),
    m: two(f({ minute: 'numeric' })),
    s: two(f({ second: 'numeric' })),
    weekdayShort: f({ weekday: 'short' }),
    weekdayLong: f({ weekday: 'long' }),
    dateShort: f({ day: 'numeric', month: 'numeric' }),
    dateLong: f({ day: 'numeric', month: 'long' }),
    dateYear: f({ day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

/** A forecast entry's label: the weekday (daily) or the hour (hourly) in the site's zone; '' for a bad time. */
export function forecastLabel(iso: string, zone: string, daily: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = safeZone(zone);
  if (daily) return new Intl.DateTimeFormat('he-IL', { timeZone: tz, weekday: 'short' }).format(d).replace(/^יום\s*/, '');
  return new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** Home Assistant's weather conditions, in Hebrew (an unknown condition shows as reported). */
export const WEATHER_HE: Record<string, string> = {
  'clear-night': 'לילה בהיר',
  cloudy: 'מעונן',
  exceptional: 'חריג',
  fog: 'ערפל',
  hail: 'ברד',
  lightning: 'ברקים',
  'lightning-rainy': 'סופת רעמים',
  partlycloudy: 'מעונן חלקית',
  pouring: 'גשם שוטף',
  rainy: 'גשם',
  snowy: 'שלג',
  'snowy-rainy': 'שלג וגשם',
  sunny: 'שמשי',
  windy: 'סוער',
  'windy-variant': 'סוער ומעונן',
};

export type WeatherGlyph = 'sun' | 'moon' | 'cloud' | 'partly' | 'rain' | 'snow' | 'storm' | 'fog' | 'wind';

export function weatherGlyph(condition: string): WeatherGlyph {
  switch (condition) {
    case 'sunny':
      return 'sun';
    case 'clear-night':
      return 'moon';
    case 'partlycloudy':
      return 'partly';
    case 'rainy':
    case 'pouring':
    case 'hail':
      return 'rain';
    case 'snowy':
    case 'snowy-rainy':
      return 'snow';
    case 'lightning':
    case 'lightning-rainy':
      return 'storm';
    case 'fog':
      return 'fog';
    case 'windy':
    case 'windy-variant':
      return 'wind';
    default:
      return 'cloud';
  }
}

const UNIT_HE: Record<string, string> = { 'km/h': 'קמ״ש', 'm/s': 'מ׳/שנ׳', kph: 'קמ״ש', km: 'ק״מ', m: 'מ׳', mm: 'מ״מ', hPa: 'הקטופסקל', mbar: 'מ״ב' };

/** A weather value as text: "61%", "14 קמ״ש", "1012 hPa". Temperatures keep their degree sign, without repeating the unit letter twice. */
export function valueText(field: WeatherField, v: WeatherValue): string {
  const n = Number.isInteger(v.v) ? String(v.v) : String(Math.round(v.v * 10) / 10);
  const unit = v.unit ?? '';
  if (field === 'temperature' || field === 'apparent') return `${Math.round(v.v)}${unit.startsWith('°') ? unit : `°${unit}`}`;
  if (field === 'humidity') return `${Math.round(v.v)}%`;
  if (field === 'uv') return n;
  return unit ? `${n} ${UNIT_HE[unit] ?? unit}` : n;
}

/** A calendar sensor's state as the card shows it (a time sensor as HH:mm, the parsha with its word). */
export function calendarText(field: CalendarField | 'extra', s: SensorData | undefined, zone: string): string {
  if (!hasValue(s)) return '';
  if (field === 'candles' || field === 'havdalah') return timeOfState(s.state, zone);
  if (field === 'parsha') return parshaText(s.state);
  if (field === 'extra') return s.state === 'on' ? 'כן' : s.state === 'off' ? 'לא' : (timeOfState(s.state, zone) || s.state);
  return s.state;
}

/** "עוד יומיים ו־12 שעות": how long until a future ISO timestamp; '' for anything else. */
export function untilText(iso: string | null | undefined, now: Date): string {
  const t = new Date(iso ?? '').getTime();
  if (!iso || !/^\d{4}-\d{2}-\d{2}T/.test(iso) || Number.isNaN(t) || t <= now.getTime()) return '';
  const mins = Math.round((t - now.getTime()) / 60_000);
  if (mins < 60) return `עוד ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `עוד ${hours === 1 ? 'שעה' : `${hours} שעות`}`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const d = days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`;
  return rest ? `עוד ${d} ו־${rest === 1 ? 'שעה' : `${rest} שעות`}` : `עוד ${d}`;
}

/** BV1: when an agenda event happens, in the site's zone and relative to today: "היום · 14:30", "מחר · כל היום", "יום ג׳ · 10:00",
 * "12.10 · 09:00" past the week. '' for a bad time. */
export function agendaWhen(ev: Pick<AgendaEvent, 'start' | 'all_day'>, now: Date, zone: string): string {
  const d = new Date(ev.start);
  if (Number.isNaN(d.getTime())) return '';
  const tz = safeZone(zone);
  const dayKey = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  // an all-day event's start is the day it names at 00:00 (the mirror keeps it as UTC midnight): compare the named day, never the instant
  const key = ev.all_day ? ev.start.slice(0, 10) : dayKey(d);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const days = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  let day: string;
  if (key === today) day = 'היום';
  else if (key === tomorrow) day = 'מחר';
  else if (days > 0 && days < 7) day = new Intl.DateTimeFormat('he-IL', { timeZone: tz, weekday: 'long' }).format(ev.all_day ? new Date(`${key}T12:00:00Z`) : d);
  else day = new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: 'numeric', month: 'numeric' }).format(ev.all_day ? new Date(`${key}T12:00:00Z`) : d);
  const time = ev.all_day ? 'כל היום' : new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${day} · ${time}`;
}

/** "שונה לפני 3 שעות" from an ISO time; '' for none. */
export function sinceText(iso: string | null | undefined, now: Date): string {
  const t = new Date(iso ?? '').getTime();
  if (!iso || Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  if (mins < 2) return 'שונה עכשיו';
  if (mins < 60) return `שונה לפני ${mins} דקות`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? 'שונה לפני שעה' : `שונה לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'שונה אתמול' : `שונה לפני ${d} ימים`;
}
