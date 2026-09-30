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

export type WidgetId = 'clock' | 'weather' | 'shabbat' | 'alarm' | 'quick';
export const WIDGET_IDS: WidgetId[] = ['clock', 'weather', 'shabbat', 'alarm', 'quick'];
export const WIDGET_NAME: Record<WidgetId, string> = { clock: 'שעון', weather: 'מזג אוויר', shabbat: 'שבת', alarm: 'אזעקה', quick: 'פעולות מהירות' };

export type Size = 's' | 'm' | 'l';
export const SIZES: Size[] = ['s', 'm', 'l'];
export const SIZE_LABEL: Record<Size, string> = { s: 'קטן', m: 'בינוני', l: 'גדול' };
export type Sizes = Record<Direction, Size>;

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
}
export interface ClockCfg extends CommonCfg {
  mode: ClockMode;
  seconds: boolean;
  hebrew: boolean;
}
export interface WeatherCfg extends CommonCfg {
  entity: string;
  fields: WeatherField[];
  forecast: ForecastLen;
  sources: Partial<Record<WeatherField, string>>;
}
export type ShabbatCfg = CommonCfg;
export interface AlarmCfg extends CommonCfg {
  entity: string;
}
export interface QuickCfg extends CommonCfg {
  actions: QuickAction[];
}
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
  clock: ClockCfg;
  weather: WeatherCfg;
  shabbat: ShabbatCfg;
  alarm: AlarmCfg;
  quick: QuickCfg;
  calendar: CalendarCfg;
}

export const DEFAULT_SIZES: Record<WidgetId, Sizes> = {
  clock: { a: 'l', b: 'm', c: 'm' },
  weather: { a: 'l', b: 'm', c: 'm' },
  shabbat: { a: 'm', b: 'm', c: 'm' },
  alarm: { a: 'm', b: 's', c: 'm' },
  quick: { a: 'm', b: 's', c: 'm' },
};

export function defaultConfig(): HomeConfig {
  const base = (id: WidgetId): CommonCfg => ({ on: true, sizes: { ...DEFAULT_SIZES[id] }, label: '' });
  return {
    order: [...WIDGET_IDS],
    clock: { ...base('clock'), mode: 'datetime', seconds: false, hebrew: true },
    weather: { ...base('weather'), entity: '', fields: [...WEATHER_FIELDS_DEFAULT], forecast: '5', sources: {} },
    shabbat: base('shabbat'),
    alarm: { ...base('alarm'), entity: '' },
    quick: { ...base('quick'), actions: [...QUICK_ACTIONS] },
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
  return { on: bool(o.on, true), sizes: sizesOf(o.sizes, id), label: str(o.label) };
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
  const cal = isObj(o.calendar) ? o.calendar : {};
  const sources: Partial<Record<WeatherField, string>> = {};
  if (isObj(weather.sources)) for (const f of WEATHER_SOURCE_FIELDS) if (typeof weather.sources[f] === 'string' && weather.sources[f]) sources[f] = weather.sources[f] as string;
  return {
    order: [...order, ...WIDGET_IDS.filter((w) => !order.includes(w))],
    clock: { ...commonOf(o.clock, 'clock'), mode: pick(clock.mode, CLOCK_MODES, d.clock.mode), seconds: bool(clock.seconds, false), hebrew: bool(clock.hebrew, true) },
    weather: { ...commonOf(o.weather, 'weather'), entity: str(weather.entity), fields: listOf(weather.fields, WEATHER_FIELDS, WEATHER_FIELDS_DEFAULT), forecast: pick(weather.forecast, FORECAST_LENS, '5'), sources },
    shabbat: commonOf(o.shabbat, 'shabbat'),
    alarm: { ...commonOf(o.alarm, 'alarm'), entity: str(alarm.entity) },
    quick: { ...commonOf(o.quick, 'quick'), actions: listOf(quick.actions, QUICK_ACTIONS, QUICK_ACTIONS) },
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
export interface HomeData {
  weather: WeatherData | null;
  sensors: Record<string, SensorData>;
  alarm: AlarmData | null;
}
export const NO_DATA: HomeData = { weather: null, sensors: {}, alarm: null };

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
    },
  };
}

/** GET /devices/home-candidates. */
export interface HomeCandidates {
  weather: { entity_id: string; name: string; state: string | null; values?: WeatherData['values']; forecast?: ForecastEntry[]; forecast_len?: number; offers?: WeatherField[] }[];
  alarms: { entity_id: string; name: string; state: string | null }[];
  sensors: { entity_id: string; name: string; state: string | null; unit?: string | null; device_class: string | null; suggested: boolean; binary?: boolean }[];
  suggested_calendar?: Partial<Record<CalendarField, string>>;
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
  }
  return { weather, sensors, alarm };
}

// ------------------------------------------------------------------------------------------------ what the screen draws

/** Why a widget is not drawn: off (the switch), none (nothing chosen to feed it), unavail (the entity is not reporting),
 * noalarm (no alarm panel this user may see), noaction (no quick action this user may run). 'ok' = drawn. */
export type Avail = 'ok' | 'off' | 'none' | 'unavail' | 'noalarm' | 'noaction';

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
  /** Which quick actions this user may run (devices.control_bulk on the building); none = the quick card is absent. */
  quickAllowed?: Partial<Record<QuickAction, boolean>>;
}

export const hasValue = (s: SensorData | undefined): s is SensorData => !!s && s.available && !UNAVAILABLE.has(s.state);

/** Which widgets are drawn (in `cfg.order`) for a direction, with the size each has there. */
export function resolveWidgets(cfg: HomeConfig, direction: Direction, data: HomeData, opts: ResolveOpts = {}): WidgetItem[] {
  const out: WidgetItem[] = [];
  for (const id of cfg.order) {
    const w = cfg[id];
    let avail: Avail = 'ok';
    if (!w.on) avail = 'off';
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
    }
    if (avail === 'ok' || opts.editing) out.push({ id, avail, size: w.sizes[direction], title: w.label.trim() || WIDGET_NAME[id] });
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

/** The Hebrew date computed in the browser (the fallback when no sensor is chosen): "כ״ט באלול תשפ״ו". */
export function hebrewDate(now: Date, zone: string): string {
  try {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: safeZone(zone), day: 'numeric', month: 'long', year: 'numeric' }).format(now);
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
