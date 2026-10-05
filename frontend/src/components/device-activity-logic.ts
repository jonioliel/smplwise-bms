/**
 * CR-032 device activity: the pure logic of the popup - the Hebrew wording of the twelve kinds, before / after formatting, who did it,
 * grouping by day, the period filter. No Lit and no DOM, so the unit specs import it under Playwright's own transpiler.
 *
 * The wording is gender neutral on purpose (nouns: הדלקה, כיבוי, פתיחה ...) - the server does not know how a person is addressed.
 * Unknown stays unknown: nothing here guesses an actor (AGENTS.md: historical unknown is not current state).
 */
import type { ActivityItem, ActivityKind, ActivityValue, ActorType, EventType } from '../api/device-activity';

/** The icon (sw-icon name) of each kind. */
export const KIND_ICON: Record<ActivityKind, string> = {
  light: 'light',
  switch: 'power',
  outlet: 'power',
  cover: 'layers',
  garage: 'door',
  climate: 'snow',
  heater: 'flame',
  fan: 'fan',
  water_heater: 'thermometer',
  valve: 'activity',
  vacuum: 'target',
  other: 'bolt',
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

const VALUE_VERB: Record<string, string> = {
  brightness: 'שינוי בהירות',
  color_temp: 'שינוי גוון',
  rgb_color: 'שינוי צבע',
  position: 'שינוי מיקום',
  tilt: 'שינוי הטיה',
  target_temperature: 'שינוי יעד',
  hvac_mode: 'שינוי מצב',
  fan_mode: 'שינוי מאוורר',
  percentage: 'שינוי מהירות',
  direction: 'שינוי כיוון',
  preset_mode: 'שינוי מצב מוגדר',
  operation_mode: 'שינוי מצב',
  duration: 'שינוי משך',
};

/** The Hebrew of a state string (unknown strings are shown as they are - the server's own word - never invented). */
export function stateLabel(state: string | null | undefined): string {
  if (!state) return '';
  return STATE_HE[state] ?? state;
}

function valueText(attribute: string | null | undefined, v: ActivityValue, unit: string | null | undefined): string {
  const raw = v.value;
  if (raw === null || raw === undefined || raw === '') return v.state ? stateLabel(v.state) : '';
  if (typeof raw === 'number') {
    const n = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
    const u = unit ?? (attribute === 'brightness' || attribute === 'position' || attribute === 'tilt' || attribute === 'percentage' ? '%' : attribute === 'target_temperature' ? '°' : attribute === 'color_temp' ? 'K' : '');
    return `${n}${u}`;
  }
  return VALUE_HE[raw] ?? raw;
}

export interface Described {
  /** The short action ("הדלקה", "שינוי יעד"). */
  verb: string;
  from: string;
  to: string;
}

/** The action, before and after of one event of a device of `kind`. */
export function describeEvent(item: Pick<ActivityItem, 'kind' | 'attribute' | 'from' | 'to' | 'unit'>, kind: ActivityKind): Described {
  const toState = item.to.state ?? '';
  const fromState = item.from.state ?? '';
  if (item.kind === 'availability') {
    const lost = toState === 'unavailable';
    return { verb: lost ? 'איבד זמינות' : 'חזר לזמינות', from: stateLabel(fromState), to: stateLabel(toState) };
  }
  if (item.kind === 'value') {
    return { verb: VALUE_VERB[item.attribute ?? ''] ?? 'שינוי ערך', from: valueText(item.attribute, item.from, item.unit), to: valueText(item.attribute, item.to, item.unit) };
  }
  // power / state change
  let verb = 'שינוי מצב';
  if (kind === 'cover' || kind === 'garage' || kind === 'valve') {
    verb = toState === 'open' || toState === 'opening' ? 'פתיחה' : toState === 'closed' || toState === 'closing' ? 'סגירה' : toState === 'stopped' ? 'עצירה' : 'שינוי מצב';
  } else if (kind === 'vacuum') {
    verb = toState === 'cleaning' ? 'התחלת ניקיון' : toState === 'docked' || toState === 'returning' ? 'חזרה לעגינה' : toState === 'paused' || toState === 'idle' ? 'עצירה' : 'שינוי מצב';
  } else if (kind !== 'other') {
    verb = toState === 'off' ? 'כיבוי' : toState && toState !== 'unavailable' && toState !== 'unknown' ? 'הדלקה' : 'שינוי מצב';
  }
  return { verb, from: stateLabel(fromState), to: stateLabel(toState) };
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

const ACTOR_GLYPH: Record<ActorType, string> = { person: 'user', automation: 'bolt', schedule: 'calendar', scene: 'image', device: 'hand', system: 'cpu', unknown: 'info' };

export function actorView(item: Pick<ActivityItem, 'actor' | 'source' | 'confidence'>): ActorView {
  const t = item.actor.type;
  const rawName = (item.actor.name ?? item.source?.name ?? '').trim();
  let prefix = '';
  let name = rawName;
  let qualifier = '';
  if (t === 'person') name = rawName || 'משתמש';
  else if (t === 'automation') { prefix = 'אוטומציה'; name = rawName; }
  else if (t === 'schedule') { prefix = 'תזמון'; name = rawName; }
  else if (t === 'scene') { prefix = 'סצנה'; name = rawName; }
  else if (t === 'device') { name = 'ידני בהתקן'; qualifier = 'משוער'; }
  else if (t === 'system') name = 'המערכת';
  else name = 'מקור לא ידוע';
  if (!name && prefix) { name = prefix; prefix = ''; }
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
