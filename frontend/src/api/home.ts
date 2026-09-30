/**
 * The home screen's own settings (owner notes 2026-09-30; backend: services/home_screen.py, `home.*` product settings):
 * an editable page title, the installation's floor order and three optional, read-only header widgets - a clock, the
 * weather of one `weather.*` entity and the Jewish-calendar times of three `sensor.*` entities. All widgets are off
 * until switched on in the screen's edit mode. Values come from the platform's mirrored entity list; nothing here
 * reaches the network.
 */
import { get, patch } from './client';
import { invalidateSettings, productSettings } from './prefs';
import { isApi } from './session';

export const HOME_TITLE_DEFAULT = 'חשמל והתקנים';
export const HOME_TITLE_MAX = 60;

export type ClockMode = 'off' | 'time' | 'datetime';
export const CLOCK_MODES: ClockMode[] = ['off', 'time', 'datetime'];
export const CLOCK_LABEL: Record<ClockMode, string> = { off: 'כבוי', time: 'שעה', datetime: 'שעה ותאריך' };

/** How a widget is drawn (owner feedback 2026-09-30): a small chip in the header row, or a medium / large dashboard card
 * in the same family as the summary tiles. */
export type WidgetSize = 'chip' | 'medium' | 'large';
export const WIDGET_SIZES: WidgetSize[] = ['chip', 'medium', 'large'];
export const SIZE_LABEL: Record<WidgetSize, string> = { chip: 'תג קטן', medium: 'בינוני', large: 'גדול' };
export type WidgetKind = 'clock' | 'weather' | 'jewish';

export interface ForecastEntry {
  datetime: string;
  condition: string;
  temperature: number | null;
}

/** What the widgets show right now (GET /devices/tree `home`): null = off / not configured / no value. */
export interface HomeWidgets {
  clock: ClockMode;
  clock_seconds?: boolean;
  time_zone: string;
  sizes?: Record<WidgetKind, WidgetSize>;
  weather: { entity_id: string; condition: string; temperature: number | null; unit: string; humidity: number | null; wind_speed?: number | null; wind_unit?: string | null; forecast?: ForecastEntry[] } | null;
  jewish: Partial<Record<'parsha' | 'candles' | 'havdalah' | 'date', { entity_id: string; state: string; device_class: string | null }>> | null;
}

export const NO_WIDGETS: HomeWidgets = { clock: 'off', time_zone: 'Asia/Jerusalem', weather: null, jewish: null };

export function sizeOf(d: HomeWidgets | null | undefined, kind: WidgetKind): WidgetSize {
  return d?.sizes?.[kind] ?? 'medium';
}

/** The settings, as edit mode edits them (and as the screen reads them). */
export interface HomeSettings {
  title: string;
  floorOrder: string[];
  clock: ClockMode;
  weatherOn: boolean;
  weatherEntity: string;
  jewishOn: boolean;
  parsha: string;
  candles: string;
  havdalah: string;
  /** Owner feedback 2026-09-30: each widget's size, the clock's seconds, the Hebrew-date sensor. */
  clockSize: WidgetSize;
  clockSeconds: boolean;
  weatherSize: WidgetSize;
  jewishSize: WidgetSize;
  jewishDate: string;
}

export const HOME_DEFAULT: HomeSettings = { title: '', floorOrder: [], clock: 'off', weatherOn: false, weatherEntity: '', jewishOn: false, parsha: '', candles: '', havdalah: '', clockSize: 'medium', clockSeconds: false, weatherSize: 'medium', jewishSize: 'medium', jewishDate: '' };

function sizeSetting(v: unknown): WidgetSize {
  return WIDGET_SIZES.includes(v as WidgetSize) ? (v as WidgetSize) : 'medium';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function parseFloorOrder(v: unknown): string[] {
  let data: unknown = v;
  if (typeof v === 'string') {
    try {
      data = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const x of data) if (typeof x === 'string' && x && !out.includes(x)) out.push(x);
  return out;
}

export function homeSettingsOf(s: Record<string, unknown> | null | undefined): HomeSettings {
  const clock = s?.['home.clock'];
  return {
    title: str(s?.['home.title']).trim(),
    floorOrder: parseFloorOrder(s?.['home.floor_order']),
    clock: CLOCK_MODES.includes(clock as ClockMode) ? (clock as ClockMode) : 'off',
    weatherOn: s?.['home.weather'] === 'true',
    weatherEntity: str(s?.['home.weather_entity']),
    jewishOn: s?.['home.jewish'] === 'true',
    parsha: str(s?.['home.jewish_parsha']),
    candles: str(s?.['home.jewish_candles']),
    havdalah: str(s?.['home.jewish_havdalah']),
    clockSize: sizeSetting(s?.['home.clock_size']),
    clockSeconds: s?.['home.clock_seconds'] === 'true',
    weatherSize: sizeSetting(s?.['home.weather_size']),
    jewishSize: sizeSetting(s?.['home.jewish_size']),
    jewishDate: str(s?.['home.jewish_date']),
  };
}

/** The installation's home settings (the shared settings cache); never throws - the defaults on any failure. */
export async function loadHomeSettings(force = false): Promise<HomeSettings> {
  if (!isApi()) return HOME_DEFAULT;
  try {
    return homeSettingsOf((await productSettings(force)) as unknown as Record<string, unknown>);
  } catch {
    return HOME_DEFAULT;
  }
}

/** The PATCH /settings body for what differs between two states (only the changed keys). */
export function homePatch(from: HomeSettings, to: HomeSettings): Record<string, string> {
  const body: Record<string, string> = {};
  if (to.title.trim() !== from.title) body['home.title'] = to.title.trim();
  if (JSON.stringify(to.floorOrder) !== JSON.stringify(from.floorOrder)) body['home.floor_order'] = JSON.stringify(to.floorOrder);
  if (to.clock !== from.clock) body['home.clock'] = to.clock;
  if (to.weatherOn !== from.weatherOn) body['home.weather'] = String(to.weatherOn);
  if (to.weatherEntity !== from.weatherEntity) body['home.weather_entity'] = to.weatherEntity;
  if (to.jewishOn !== from.jewishOn) body['home.jewish'] = String(to.jewishOn);
  if (to.parsha !== from.parsha) body['home.jewish_parsha'] = to.parsha;
  if (to.candles !== from.candles) body['home.jewish_candles'] = to.candles;
  if (to.havdalah !== from.havdalah) body['home.jewish_havdalah'] = to.havdalah;
  if (to.clockSize !== from.clockSize) body['home.clock_size'] = to.clockSize;
  if (to.clockSeconds !== from.clockSeconds) body['home.clock_seconds'] = String(to.clockSeconds);
  if (to.weatherSize !== from.weatherSize) body['home.weather_size'] = to.weatherSize;
  if (to.jewishSize !== from.jewishSize) body['home.jewish_size'] = to.jewishSize;
  if (to.jewishDate !== from.jewishDate) body['home.jewish_date'] = to.jewishDate;
  return body;
}

/** Saves the changed keys (system.configure; audited by the server) and refreshes the shared settings cache. */
export async function saveHomeSettings(from: HomeSettings, to: HomeSettings): Promise<HomeSettings> {
  const body = homePatch(from, to);
  if (!Object.keys(body).length) return to;
  const r = await patch<{ settings: Record<string, unknown> }>('settings', body);
  invalidateSettings();
  return homeSettingsOf(r.settings);
}

export interface HomeCandidates {
  weather: { entity_id: string; name: string; state: string | null }[];
  sensors: { entity_id: string; name: string; state: string | null; device_class: string | null; suggested: boolean }[];
}

export const getHomeCandidates = () => get<HomeCandidates>('devices/home-candidates');

/** The floors in the installation's order: the listed ones first, in the listed order, then every other floor in its own
 * (level) order. Mirrors home_screen.order_floors on the server (the tree already arrives ordered; edit mode previews). */
export function orderFloors<T extends { floor_id: string }>(floors: T[], order: string[]): T[] {
  if (!order.length) return floors;
  const rank = new Map(order.map((id, i) => [id, i]));
  const tail = order.length;
  return floors
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (rank.get(a.f.floor_id) ?? tail) - (rank.get(b.f.floor_id) ?? tail) || a.i - b.i)
    .map((x) => x.f);
}

/** Moves one id by `by` places inside the full ordered list of ids (edit mode's up / down buttons and drop target). */
export function moveId(ids: string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const dest = Math.max(0, Math.min(ids.length - 1, to));
  if (dest === from) return ids;
  const out = [...ids];
  out.splice(from, 1);
  out.splice(dest, 0, id);
  return out;
}

// ------------------------------------------------------------------------------------------------ widget text

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

/** The clock's text in the site's zone: "14:05", or "יום ד׳ · 30.9 · 14:05" with the date. */
export function clockText(now: Date, mode: ClockMode, zone: string): { time: string; date: string } {
  const tz = safeZone(zone);
  const time = new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const date = mode === 'datetime' ? new Intl.DateTimeFormat('he-IL', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric' }).format(now) : '';
  return { time, date };
}

/** The clock card's parts in the site's zone: big "14:05" (+ ":07" when seconds are on), the weekday and the long date
 * ("יום רביעי" / "30 בספטמבר"; the date parts only with the date mode). */
export function clockCard(now: Date, mode: ClockMode, zone: string, seconds = false): { hm: string; sec: string; weekday: string; date: string } {
  const tz = safeZone(zone);
  const hm = new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const sec = seconds ? new Intl.DateTimeFormat('he-IL', { timeZone: tz, second: '2-digit' }).format(now).padStart(2, '0') : '';
  const weekday = mode === 'datetime' ? new Intl.DateTimeFormat('he-IL', { timeZone: tz, weekday: 'long' }).format(now) : '';
  const date = mode === 'datetime' ? new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: 'numeric', month: 'long' }).format(now) : '';
  return { hm, sec, weekday, date };
}

/** A forecast entry's hour ("14:00") in the site's zone; '' for a bad time. */
export function hourOf(iso: string, zone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', { timeZone: safeZone(zone), hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function safeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('he-IL', { timeZone: zone });
    return zone;
  } catch {
    return 'Asia/Jerusalem';
  }
}

/** A Jewish-calendar time sensor's value as "HH:mm" in the site's zone: an ISO timestamp is converted; anything else
 * (a sensor that already reports "17:32") is shown as reported. '' for no value. */
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
