/**
 * CR-032 device activity: the pure logic of the popup - the Hebrew wording of the twelve kinds, before / after formatting, who did it,
 * grouping by day, the period filter. No Lit and no DOM, so the unit specs import it under Playwright's own transpiler.
 *
 * The wording is gender neutral on purpose (nouns: הדלקה, כיבוי, פתיחה ...) - the server does not know how a person is addressed.
 * Unknown stays unknown: nothing here guesses an actor (AGENTS.md: historical unknown is not current state).
 */
import type { ActivityItem, ActivityKind, ActorType, EventType } from '../api/device-activity';

/** The icon (sw-icon name) of each kind. */
export const KIND_ICON: Record<ActivityKind, string> = {
  light: 'light',
  switch: 'power',
  outlet: 'power',
  cover: 'layers',
  garage_door: 'door',
  climate: 'snow',
  heater: 'flame',
  fan: 'fan',
  water_heater: 'thermometer',
  valve: 'activity',
  vacuum: 'target',
  generic: 'bolt',
};

export const STATE_HE: Record<string, string> = {
  on: 'דלוק', off: 'כבוי', open: 'פתוח', closed: 'סגור', opening: 'נפתח', closing: 'נסגר', stopped: 'עצר',
  unavailable: 'לא זמין', unknown: 'לא ידוע',
  heat: 'חימום', cool: 'קירור', heat_cool: 'חימום/קירור', auto: 'אוטו', dry: 'ייבוש', fan_only: 'מאוורר',
  docked: 'בעגינה', cleaning: 'מנקה', paused: 'מושהה', returning: 'חוזר לעגינה', idle: 'ממתין',
  locked: 'נעול', unlocked: 'לא נעול', armed_home: 'דרוך בבית', armed_away: 'דרוך', armed_night: 'דרוך לילה', disarmed: 'לא דרוך', triggered: 'הופעלה אזעקה',
  eco: 'חסכוני', performance: 'רגיל', electric: 'חשמלי', heat_pump: 'משאבת חום',
};
const VALUE_HE: Record<string, string> = {
  ...STATE_HE, low: 'נמוך', medium: 'בינוני', high: 'גבוה', forward: 'קדימה', reverse: 'אחורה', reversed: 'אחורה', quiet: 'שקט', turbo: 'טורבו',
};

/** What each stored attribute is called in Hebrew, and how its number is written. */
const ATTR: Record<string, { verb: string; unit?: string }> = {
  brightness_pct: { verb: 'שינוי בהירות', unit: '%' },
  color_temp_kelvin: { verb: 'שינוי גוון', unit: 'K' },
  rgb_color: { verb: 'שינוי צבע' },
  effect: { verb: 'שינוי אפקט' },
  temperature: { verb: 'שינוי יעד', unit: '°' },
  target_temp_low: { verb: 'שינוי יעד תחתון', unit: '°' },
  target_temp_high: { verb: 'שינוי יעד עליון', unit: '°' },
  fan_mode: { verb: 'שינוי מאוורר' },
  preset_mode: { verb: 'שינוי מצב מוגדר' },
  swing_mode: { verb: 'שינוי נדנוד' },
  humidity: { verb: 'שינוי לחות יעד', unit: '%' },
  mode: { verb: 'שינוי מצב' },
  percentage: { verb: 'שינוי מהירות', unit: '%' },
  oscillating: { verb: 'שינוי נדנוד' },
  direction: { verb: 'שינוי כיוון' },
  current_position: { verb: 'שינוי מיקום', unit: '%' },
  current_tilt_position: { verb: 'שינוי הטיה', unit: '%' },
  fan_speed: { verb: 'שינוי עוצמת שאיבה' },
  away_mode: { verb: 'שינוי מצב היעדרות' },
};
/** The order a changed set is reported in (the first one names the row). */
const ATTR_ORDER = Object.keys(ATTR);

/** The Hebrew of a state string (unknown strings are shown as they are - the server's own word - never invented). */
export function stateLabel(state: string | null | undefined): string {
  if (!state) return '';
  return STATE_HE[state] ?? state;
}

function attrText(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const unit = ATTR[key]?.unit ?? '';
  if (typeof v === 'number') return `${Number.isInteger(v) ? String(v) : v.toFixed(1)}${unit}`;
  if (typeof v === 'boolean') return v ? 'פעיל' : 'כבוי';
  if (Array.isArray(v)) return v.join(',');
  return VALUE_HE[String(v)] ?? String(v);
}

export interface Described {
  /** The short action ("הדלקה", "שינוי יעד"). */
  verb: string;
  from: string;
  to: string;
}

/** The attribute a value event is about: the first of `changed` we know, else the first key that differs. */
export function changedKey(item: Pick<ActivityItem, 'from' | 'to' | 'changed'>): string | null {
  const keys = (item.changed && item.changed.length ? item.changed : [...new Set([...Object.keys(item.from), ...Object.keys(item.to)])].filter((k) => item.from[k] !== item.to[k])).filter((k) => k !== 'state');
  return ATTR_ORDER.find((k) => keys.includes(k)) ?? keys[0] ?? null;
}

/** The action, before and after of one event of a device of `kind`. */
export function describeEvent(item: Pick<ActivityItem, 'kind' | 'from' | 'to' | 'changed'>, kind: ActivityKind): Described {
  const toState = item.to.state ?? '';
  const fromState = item.from.state ?? '';
  if (item.kind === 'availability') {
    const lost = toState === 'unavailable' || toState === 'unknown';
    return { verb: lost ? 'איבד זמינות' : 'חזר לזמינות', from: stateLabel(fromState), to: stateLabel(toState) };
  }
  if (item.kind === 'value') {
    const key = changedKey(item);
    if (!key) return { verb: 'שינוי ערך', from: stateLabel(fromState), to: stateLabel(toState) };
    // climate: the mode of a device that stays on is the state itself (heat -> cool)
    return { verb: ATTR[key]?.verb ?? 'שינוי ערך', from: attrText(key, item.from[key]), to: attrText(key, item.to[key]) };
  }
  // power / state change
  let verb = 'שינוי מצב';
  if (kind === 'cover' || kind === 'garage_door' || kind === 'valve') {
    verb = toState === 'open' || toState === 'opening' ? 'פתיחה' : toState === 'closed' || toState === 'closing' ? 'סגירה' : toState === 'stopped' ? 'עצירה' : 'שינוי מצב';
  } else if (kind === 'vacuum') {
    verb = toState === 'cleaning' ? 'התחלת ניקיון' : toState === 'docked' || toState === 'returning' ? 'חזרה לעגינה' : toState === 'paused' || toState === 'idle' ? 'עצירה' : 'שינוי מצב';
  } else if (kind !== 'generic') {
    verb = toState === 'off' ? 'כיבוי' : toState && toState !== 'unavailable' && toState !== 'unknown' ? 'הדלקה' : 'שינוי מצב';
  }
  // a light switched on carries its brightness: "כבוי ← דלוק 60%"
  const extra = kind === 'light' && toState === 'on' && typeof item.to.brightness_pct === 'number' ? ` ${item.to.brightness_pct}%` : '';
  return { verb, from: stateLabel(fromState), to: stateLabel(toState) + extra };
}

export interface ActorView {
  type: ActorType;
  /** "אוטומציה" / "תזמון" / "סצנה" - shown in front of the name. */
  prefix: string;
  name: string;
  /** Initials for a person, else a glyph name for the avatar. */
  initials: string;
  glyph: string;
  /** A short qualifier ("משוער"). */
  qualifier: string;
}

const ACTOR_GLYPH: Record<ActorType, string> = { person: 'user', automation: 'bolt', script: 'rule', schedule: 'calendar', scene: 'image', device: 'hand', system: 'cpu', unknown: 'info' };

export function actorView(item: Pick<ActivityItem, 'actor' | 'source' | 'confidence'>): ActorView {
  const t = item.actor.type;
  const rawName = (item.actor.name ?? item.source?.name ?? '').trim();
  let prefix = '';
  let name = rawName;
  let qualifier = '';
  if (t === 'person') name = rawName || 'משתמש';
  else if (t === 'automation') { prefix = 'אוטומציה'; name = rawName; }
  else if (t === 'script') { prefix = 'סקריפט'; name = rawName; }
  else if (t === 'schedule') { prefix = 'תזמון'; name = rawName; }
  else if (t === 'scene') { prefix = 'סצנה'; name = rawName; }
  else if (t === 'device') { name = 'ידני בהתקן'; qualifier = 'משוער'; }
  else if (t === 'system') name = 'המערכת';
  else name = 'מקור לא ידוע';
  if (!name && prefix) { name = `${prefix} (ללא שם)`; prefix = ''; }
  const initials = t === 'person' ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('') : '';
  return { type: t, prefix, name, initials, glyph: ACTOR_GLYPH[t], qualifier };
}

// ------------------------------------------------------------------------------------------------ filters

export type Period = 'hour' | 'day' | 'week' | 'month';
export const PERIODS: Period[] = ['hour', 'day', 'week', 'month'];
export const PERIOD_LABEL: Record<Period, string> = { hour: 'שעה', day: '24 שעות', week: '7 ימים', month: '30 יום' };
const PERIOD_MS: Record<Period, number> = { hour: 3600_000, day: 24 * 3600_000, week: 7 * 24 * 3600_000, month: 30 * 24 * 3600_000 };
export const DEFAULT_PERIOD: Period = 'week';

export const ACTOR_FILTERS: { id: '' | ActorType; label: string }[] = [
  { id: '', label: 'כל הגורמים' },
  { id: 'person', label: 'אנשים' },
  { id: 'automation', label: 'אוטומציות' },
  { id: 'script', label: 'סקריפטים' },
  { id: 'schedule', label: 'תזמונים' },
  { id: 'scene', label: 'סצנות' },
  { id: 'device', label: 'ידני בהתקן' },
  { id: 'system', label: 'מערכת' },
];
export const EVENT_FILTERS: { id: '' | EventType; label: string }[] = [
  { id: '', label: 'כל האירועים' },
  { id: 'power', label: 'הפעלה וכיבוי' },
  { id: 'value', label: 'שינוי ערך' },
  { id: 'availability', label: 'זמינות' },
];

export interface Filters {
  period: Period;
  actor: '' | ActorType;
  kind: '' | EventType;
}
export const DEFAULT_FILTERS: Filters = { period: DEFAULT_PERIOD, actor: '', kind: '' };

/** The query of the route for the filters (`since` from the period; empty filters are left out). */
export function queryOf(f: Filters, now = Date.now(), cursor: string | null = null) {
  return {
    since: new Date(now - PERIOD_MS[f.period]).toISOString(),
    actor: f.actor || undefined,
    kind: f.kind || undefined,
    cursor: cursor || undefined,
  };
}

/** True when the filters differ from the defaults (the empty state then offers to widen). */
export const isFiltered = (f: Filters): boolean => f.actor !== '' || f.kind !== '' || f.period !== DEFAULT_PERIOD;

// ------------------------------------------------------------------------------------------------ grouping and time

export interface DayGroup {
  key: string;
  label: string;
  items: ActivityItem[];
}

const dayKey = (d: Date, tz?: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Groups newest-first items by local day: "היום", "אתמול", else "יום ג׳ · 3.10". */
export function groupByDay(items: ActivityItem[], now = new Date(), tz?: string): DayGroup[] {
  const today = dayKey(now, tz);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 3600_000), tz);
  const out: DayGroup[] = [];
  for (const it of items) {
    const d = new Date(it.at);
    const key = dayKey(d, tz);
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      const dm = new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: 'numeric', month: 'numeric' }).format(d).replace('/', '.');
      const wd = new Intl.DateTimeFormat('he-IL', { timeZone: tz, weekday: 'short' }).format(d);
      const label = key === today ? `היום · ${dm}` : key === yesterday ? `אתמול · ${dm}` : `${wd} · ${dm}`;
      g = { key, label, items: [] };
      out.push(g);
    }
    g.items.push(it);
  }
  return out;
}

export function clockOf(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** The one-line footnote: retention and the honest "manual" caveat. */
export function footnote(retentionDays: number, hasDevice: boolean): string {
  return `${hasDevice ? 'ידני בהתקן הוא משוער · ' : ''}נשמר ${retentionDays} יום`;
}

/** "מתועד מ־4.10": since when the history exists (starts from zero, owner decision). */
export function trackedSince(fromIso: string | null | undefined, tz?: string): string {
  if (!fromIso) return '';
  const dm = new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: 'numeric', month: 'numeric' }).format(new Date(fromIso)).replace('/', '.');
  return `מתועד מ־${dm}`;
}

/** The gap banner's text for the first gap. */
export function gapText(gap: { from: string; to: string }, tz?: string): string {
  return `המערכת הייתה מנותקת ${clockOf(gap.from, tz)} עד ${clockOf(gap.to, tz)}; ייתכן שחסרים אירועים`;
}
