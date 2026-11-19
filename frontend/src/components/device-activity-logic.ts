/**
 * CR-032 device activity: the pure logic of the popup - the Hebrew wording of the twelve kinds, before / after formatting, who did it,
 * grouping by day, the period filter. No Lit and no DOM, so the unit specs import it under Playwright's own transpiler.
 *
 * The wording is gender neutral on purpose (nouns: הדלקה, כיבוי, פתיחה ...) - the server does not know how a person is addressed.
 * Unknown stays unknown: nothing here guesses an actor (AGENTS.md: historical unknown is not current state).
 */
import { uiLocale } from '../i18n/locale';
import type { ActivityItem, ActivityKind, ActorType, EventType } from '../api/device-activity';
import { timeText } from '../api/day-format';
import { tr } from '../i18n/msg/components';

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
  on: tr('דלוק'), off: tr('כבוי'), open: tr('פתוח'), closed: tr('סגור'), opening: tr('נפתח'), closing: tr('נסגר'), stopped: tr('עצר'),
  unavailable: tr('לא זמין'), unknown: tr('לא ידוע'),
  heat: tr('חימום'), cool: tr('קירור'), heat_cool: tr('חימום/קירור'), auto: tr('אוטו'), dry: tr('ייבוש'), fan_only: tr('מאוורר'),
  docked: tr('בעגינה'), cleaning: tr('מנקה'), paused: tr('מושהה'), returning: tr('חוזר לעגינה'), idle: tr('ממתין'),
  locked: tr('נעול'), unlocked: tr('לא נעול'), armed_home: tr('דרוך בבית'), armed_away: tr('דרוך'), armed_night: tr('דרוך לילה'), disarmed: tr('לא דרוך'), triggered: tr('הופעלה אזעקה'),
  eco: tr('חסכוני'), performance: tr('רגיל'), electric: tr('חשמלי'), heat_pump: tr('משאבת חום'),
};
const VALUE_HE: Record<string, string> = {
  ...STATE_HE, low: tr('נמוך'), medium: tr('בינוני'), high: tr('גבוה'), forward: tr('קדימה'), reverse: tr('אחורה'), reversed: tr('אחורה'), quiet: tr('שקט'), turbo: tr('טורבו'),
};

/** What each stored attribute is called in Hebrew, and how its number is written. */
const ATTR: Record<string, { verb: string; unit?: string }> = {
  brightness_pct: { verb: tr('שינוי בהירות'), unit: '%' },
  color_temp_kelvin: { verb: tr('שינוי גוון'), unit: 'K' },
  rgb_color: { verb: tr('שינוי צבע') },
  effect: { verb: tr('שינוי אפקט') },
  temperature: { verb: tr('שינוי יעד'), unit: '°' },
  target_temp_low: { verb: tr('שינוי יעד תחתון'), unit: '°' },
  target_temp_high: { verb: tr('שינוי יעד עליון'), unit: '°' },
  fan_mode: { verb: tr('שינוי מאוורר') },
  preset_mode: { verb: tr('שינוי מצב מוגדר') },
  swing_mode: { verb: tr('שינוי נדנוד') },
  humidity: { verb: tr('שינוי לחות יעד'), unit: '%' },
  mode: { verb: tr('שינוי מצב') },
  percentage: { verb: tr('שינוי מהירות'), unit: '%' },
  oscillating: { verb: tr('שינוי נדנוד') },
  direction: { verb: tr('שינוי כיוון') },
  current_position: { verb: tr('שינוי מיקום'), unit: '%' },
  current_tilt_position: { verb: tr('שינוי הטיה'), unit: '%' },
  fan_speed: { verb: tr('שינוי עוצמת שאיבה') },
  away_mode: { verb: tr('שינוי מצב היעדרות') },
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
  if (typeof v === 'boolean') return v ? tr('פעיל') : tr('כבוי');
  if (Array.isArray(v)) return v.join(',');
  return VALUE_HE[String(v)] ?? String(v);
}

interface Described {
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
    return { verb: lost ? tr('איבד זמינות') : tr('חזר לזמינות'), from: stateLabel(fromState), to: stateLabel(toState) };
  }
  if (item.kind === 'value') {
    const key = changedKey(item);
    if (!key) return { verb: tr('שינוי ערך'), from: stateLabel(fromState), to: stateLabel(toState) };
    // climate: the mode of a device that stays on is the state itself (heat -> cool)
    return { verb: ATTR[key]?.verb ?? tr('שינוי ערך'), from: attrText(key, item.from[key]), to: attrText(key, item.to[key]) };
  }
  // power / state change
  let verb = tr('שינוי מצב');
  if (kind === 'cover' || kind === 'garage_door' || kind === 'valve') {
    verb = toState === 'open' || toState === 'opening' ? tr('פתיחה') : toState === 'closed' || toState === 'closing' ? tr('סגירה') : toState === 'stopped' ? tr('עצירה') : tr('שינוי מצב');
  } else if (kind === 'vacuum') {
    verb = toState === 'cleaning' ? tr('התחלת ניקיון') : toState === 'docked' || toState === 'returning' ? tr('חזרה לעגינה') : toState === 'paused' || toState === 'idle' ? tr('עצירה') : tr('שינוי מצב');
  } else if (kind !== 'generic') {
    verb = toState === 'off' ? tr('כיבוי') : toState && toState !== 'unavailable' && toState !== 'unknown' ? tr('הדלקה') : tr('שינוי מצב');
  }
  // a light switched on carries its brightness: "כבוי ← דלוק 60%"
  const extra = kind === 'light' && toState === 'on' && typeof item.to.brightness_pct === 'number' ? ` ${item.to.brightness_pct}%` : '';
  return { verb, from: stateLabel(fromState), to: stateLabel(toState) + extra };
}

interface ActorView {
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
  if (t === 'person') name = rawName || tr('משתמש');
  else if (t === 'automation') { prefix = tr('אוטומציה'); name = rawName; }
  else if (t === 'script') { prefix = tr('סקריפט'); name = rawName; }
  else if (t === 'schedule') { prefix = tr('תזמון'); name = rawName; }
  else if (t === 'scene') { prefix = tr('סצנה'); name = rawName; }
  else if (t === 'device') { name = tr('ידני בהתקן'); qualifier = tr('משוער'); }
  else if (t === 'system') name = tr('המערכת');
  else name = tr('מקור לא ידוע');
  if (!name && prefix) { name = tr('{prefix} (ללא שם)', { prefix }); prefix = ''; }
  const initials = t === 'person' ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('') : '';
  return { type: t, prefix, name, initials, glyph: ACTOR_GLYPH[t], qualifier };
}

// ------------------------------------------------------------------------------------------------ filters

export type Period = 'hour' | 'day' | 'week' | 'month';
export const PERIODS: Period[] = ['hour', 'day', 'week', 'month'];
export const PERIOD_LABEL: Record<Period, string> = { hour: tr('שעה'), day: tr('24 שעות'), week: tr('7 ימים'), month: tr('30 יום') };
const PERIOD_MS: Record<Period, number> = { hour: 3600_000, day: 24 * 3600_000, week: 7 * 24 * 3600_000, month: 30 * 24 * 3600_000 };
const DEFAULT_PERIOD: Period = 'week';

export const ACTOR_FILTERS: { id: '' | ActorType; label: string }[] = [
  { id: '', label: tr('כל הגורמים') },
  { id: 'person', label: tr('אנשים') },
  { id: 'automation', label: tr('אוטומציות') },
  { id: 'script', label: tr('סקריפטים') },
  { id: 'schedule', label: tr('תזמונים') },
  { id: 'scene', label: tr('סצנות') },
  { id: 'device', label: tr('ידני בהתקן') },
  { id: 'system', label: tr('מערכת') },
];
export const EVENT_FILTERS: { id: '' | EventType; label: string }[] = [
  { id: '', label: tr('כל האירועים') },
  { id: 'power', label: tr('הפעלה וכיבוי') },
  { id: 'value', label: tr('שינוי ערך') },
  { id: 'availability', label: tr('זמינות') },
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

/** How many of the three filters are narrowed (the "clear" chip shows it). */
export const activeFilterCount = (f: Filters): number => (f.actor ? 1 : 0) + (f.kind ? 1 : 0) + (f.period !== DEFAULT_PERIOD ? 1 : 0);

/** ACT-polish: the two ways the feed is drawn - `cards` (avatar, two lines, a day card) or `list` (one dense line per event). */
export type ActivityView = 'cards' | 'list';
export const VIEW_KEY = 'sw.activity.view';
export const DEFAULT_VIEW: ActivityView = 'cards';
export const parseView = (v: string | null | undefined): ActivityView => (v === 'list' || v === 'cards' ? v : DEFAULT_VIEW);

/** ACT-polish: the tone of one event - what the marker next to it says at a glance. */
type EventTone = 'on' | 'off' | 'value' | 'lost' | 'back' | 'neutral';

export function eventTone(item: Pick<ActivityItem, 'kind' | 'from' | 'to'>, kind: ActivityKind): EventTone {
  const to = item.to.state ?? '';
  if (item.kind === 'availability') return to === 'unavailable' || to === 'unknown' ? 'lost' : 'back';
  if (item.kind === 'value') return 'value';
  if (!to || to === 'unavailable' || to === 'unknown') return 'neutral';
  if (kind === 'cover' || kind === 'garage_door' || kind === 'valve') return to === 'open' || to === 'opening' ? 'on' : to === 'closed' || to === 'closing' ? 'off' : 'neutral';
  if (kind === 'vacuum') return to === 'cleaning' ? 'on' : to === 'docked' || to === 'returning' || to === 'paused' || to === 'idle' ? 'off' : 'neutral';
  if (kind === 'generic') return 'neutral';
  return to === 'off' ? 'off' : 'on';
}

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
      const dm = new Intl.DateTimeFormat(uiLocale(), { timeZone: tz, day: 'numeric', month: 'numeric' }).format(d).replace('/', '.');
      const wd = new Intl.DateTimeFormat(uiLocale(), { timeZone: tz, weekday: 'short' }).format(d);
      const label = key === today ? `${tr('היום')} · ${dm}` : key === yesterday ? `${tr('אתמול')} · ${dm}` : `${wd} · ${dm}`;
      g = { key, label, items: [] };
      out.push(g);
    }
    g.items.push(it);
  }
  return out;
}

export function clockOf(iso: string, tz?: string): string {
  return timeText(new Date(iso), { timeZone: tz });
}

/** The full instant for a tooltip: "יום ג׳ 3.10.2026, 15:45". */
export function fullDate(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat(uiLocale(), { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(/\//g, '.');
}

/** The one-line footnote: retention and the honest "manual" caveat. */
export function footnote(retentionDays: number, hasDevice: boolean): string {
  return `${hasDevice ? `${tr('ידני בהתקן הוא משוער')} · ` : ''}${tr('נשמר {n} יום', { n: retentionDays })}`;
}

/** "מתועד מ־4.10": since when the history exists (starts from zero, owner decision). */
export function trackedSince(fromIso: string | null | undefined, tz?: string): string {
  if (!fromIso) return '';
  const dm = new Intl.DateTimeFormat(uiLocale(), { timeZone: tz, day: 'numeric', month: 'numeric' }).format(new Date(fromIso)).replace('/', '.');
  return tr('מתועד מ־{date}', { date: dm });
}

/** The gap banner's text for the first gap. */
export function gapText(gap: { from: string; to: string }, tz?: string): string {
  return tr('המערכת הייתה מנותקת {from} עד {to}; ייתכן שחסרים אירועים', { from: clockOf(gap.from, tz), to: clockOf(gap.to, tz) });
}
