/**
 * CR-014 schedules: the pure logic of the list screen, its drawer and the settings page (no DOM, no components, so the
 * unit specs run it in Node). Everything here works on the typed read model of api/schedules.ts; the server is the
 * authority for every permission and rule, this module only filters, sorts, groups, summarises and words what the
 * server already decided (§3.2, §4, §12.5 of docs/architecture/SCHEDULER_API.md).
 */
import { ApiError, describeError } from '../api/client';
import {
  DAY_ORDER,
  DAY_SHORT,
  actionLabel,
  formatTime,
  slotSpan,
  whenLabel,
  type ConditionPreset,
  type ConditionView,
  type DayId,
  type Schedule,
  type ScheduleAction,
  type ScheduleClass,
  type ScheduleSlot,
  type ScheduleStatus,
  type SunTimes,
} from '../api/schedules';

// ------------------------------------------------------------------------------------------------ filters (§3.2, §10.2)

export type ListView = 'cards' | 'table' | 'week';
export type ListGroup = '' | 'area' | 'floor' | 'tag' | 'state';
export type ListSort = 'next_run' | 'name' | 'order' | 'updated';
export type StateFilter = '' | 'enabled' | 'disabled' | 'triggered' | 'completed' | 'unavailable';

export interface ListFilters {
  q: string;
  floor: string;
  area: string;
  day: DayId | '';
  state: StateFilter;
  tag: string;
  /** A condition entity id (the server's `condition` parameter). */
  condition: string;
  preset: ConditionPreset | '';
  /** Any schedule with conditions ("עם תנאי"). */
  hasConditions: boolean;
  sort: ListSort;
  group: ListGroup;
}

export const NO_FILTERS: ListFilters = { q: '', floor: '', area: '', day: '', state: '', tag: '', condition: '', preset: '', hasConditions: false, sort: 'next_run', group: '' };

const VIEWS: ListView[] = ['cards', 'table', 'week'];
const GROUPS: ListGroup[] = ['', 'area', 'floor', 'tag', 'state'];
const SORTS: ListSort[] = ['next_run', 'name', 'order', 'updated'];
const STATES: StateFilter[] = ['', 'enabled', 'disabled', 'triggered', 'completed', 'unavailable'];
const PRESETS: (ConditionPreset | '')[] = ['', 'only_holy_days', 'not_holy_days'];

export function parseView(v: string | null | undefined): ListView | null {
  return VIEWS.includes(v as ListView) ? (v as ListView) : null;
}

/** The filters carried by an address query (`view` is read separately). Unknown values are ignored, never thrown. */
export function parseFilters(params: URLSearchParams): ListFilters {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const day = params.get('day');
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    floor: params.get('floor') ?? '',
    area: params.get('area') ?? '',
    day: DAY_ORDER.includes(day as DayId) ? (day as DayId) : '',
    state: pick(params.get('state'), STATES, ''),
    tag: params.get('tag') ?? '',
    condition: params.get('condition') ?? '',
    preset: pick(params.get('preset'), PRESETS, ''),
    hasConditions: params.get('has_conditions') === '1',
    sort: pick(params.get('sort'), SORTS, 'next_run'),
    group: pick(params.get('group'), GROUPS, ''),
  };
}

/** The address query of a filter set (defaults left out), in a stable order. */
export function filtersToParams(f: ListFilters, view: ListView | null = null): URLSearchParams {
  const p = new URLSearchParams();
  if (view && view !== 'cards') p.set('view', view);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.floor) p.set('floor', f.floor);
  if (f.area) p.set('area', f.area);
  if (f.day) p.set('day', f.day);
  if (f.state) p.set('state', f.state);
  if (f.tag) p.set('tag', f.tag);
  if (f.condition) p.set('condition', f.condition);
  if (f.preset) p.set('preset', f.preset);
  if (f.hasConditions) p.set('has_conditions', '1');
  if (f.sort !== 'next_run') p.set('sort', f.sort);
  if (f.group) p.set('group', f.group);
  return p;
}

/** How many filters narrow the list (sort and group do not). */
/** The state filter of the header, a segmented control with counts (the automations screen's "הכל · פעילות · כבויות ...", same
 * place, same control): '' = all. `unavailable` stays a valid address value (old links) but is not offered as a segment. */
export const STATE_SEGMENTS: ReadonlyArray<{ id: StateFilter; label: string }> = [
  { id: '', label: 'הכל' },
  { id: 'enabled', label: 'פעילים' },
  { id: 'disabled', label: 'מושבתים' },
  { id: 'triggered', label: 'מתבצעים' },
  { id: 'completed', label: 'הסתיימו' },
];

/** How many of `items` each state segment holds (the counts beside the labels). */
export function stateCounts(items: Schedule[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seg of STATE_SEGMENTS) out[seg.id] = items.filter((s) => matchesFilters(s, { ...NO_FILTERS, state: seg.id })).length;
  return out;
}

/** The filters behind "סינון" (everything but the search, the floor chips and the state segments): its count badge. */
export function extraFilterCount(f: ListFilters): number {
  return [f.area, f.day, f.tag, f.condition, f.preset, f.hasConditions ? '1' : ''].filter(Boolean).length;
}

export function activeFilterCount(f: ListFilters): number {
  return [f.q.trim(), f.floor, f.area, f.day, f.state, f.tag, f.condition, f.preset, f.hasConditions ? '1' : ''].filter(Boolean).length;
}

/** What a free-text search looks through: the name, the devices, their areas and floors, the conditions and the tags. */
export function searchText(s: Schedule): string {
  return [s.display_name, ...s.entities.flatMap((e) => [e.name, e.entity_id, e.area_name ?? '', e.floor_name ?? '']), ...s.conditions.items.map((c) => c.name), s.conditions.summary ?? '', ...s.tags]
    .join(' \n ')
    .toLowerCase();
}

export function matchesFilters(s: Schedule, f: ListFilters): boolean {
  const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = searchText(s);
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (f.floor && !s.entities.some((e) => e.floor_id === f.floor)) return false;
  if (f.area && !s.entities.some((e) => e.area_id === f.area)) return false;
  // "workday" / "weekend" have no resolved days: they are kept (the filter cannot rule them out)
  if (f.day && s.days.days && !s.days.days.includes(f.day)) return false;
  if (f.state === 'enabled' && !s.enabled) return false;
  if (f.state === 'disabled' && s.enabled) return false;
  if (f.state && f.state !== 'enabled' && f.state !== 'disabled' && s.state !== f.state) return false;
  if (f.tag && !s.tags.includes(f.tag)) return false;
  if (f.condition && !s.conditions.items.some((c) => c.entity_id === f.condition)) return false;
  if (f.preset && s.conditions.preset !== f.preset) return false;
  if (f.hasConditions && !s.conditions.items.length) return false;
  return true;
}

export function filterSchedules(items: Schedule[], f: ListFilters): Schedule[] {
  return items.filter((s) => matchesFilters(s, f));
}

const byName = (a: Schedule, b: Schedule) => a.display_name.localeCompare(b.display_name, 'he');

/** Sorting (§3.2): the next run soonest first - disabled schedules and those with nothing coming last - by name, by the
 * order kept in Arx, or by the last change. Ties fall back to the name, so the order is stable. */
export function sortSchedules(items: Schedule[], sort: ListSort): Schedule[] {
  const out = [...items];
  out.sort((a, b) => {
    if (sort === 'name') return byName(a, b);
    if (sort === 'order') return (a.order ?? 1e9) - (b.order ?? 1e9) || byName(a, b);
    if (sort === 'updated') return (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || byName(a, b);
    const rank = (s: Schedule) => (s.enabled && s.next_run ? 0 : s.enabled ? 1 : 2);
    return rank(a) - rank(b) || (a.next_run?.at ?? '').localeCompare(b.next_run?.at ?? '') || byName(a, b);
  });
  return out;
}

export interface ScheduleGroup {
  key: string;
  label: string;
  items: Schedule[];
}

const MANY = 'כמה אזורים';
const NONE = 'ללא אזור';

function groupLabel(s: Schedule, group: ListGroup): string {
  if (group === 'area' || group === 'floor') {
    const names = [...new Set(s.entities.map((e) => (group === 'area' ? e.area_name : e.floor_name)).filter((x): x is string => !!x))];
    if (names.length === 1) return names[0];
    if (names.length > 1) return group === 'area' ? MANY : 'כמה קומות';
    return group === 'area' ? NONE : 'ללא קומה';
  }
  if (group === 'tag') return s.tags[0] ?? 'ללא תג';
  return s.enabled ? 'פעילים' : 'מושבתים';
}

/** Group headings keep the order the items came in (a sorted list stays sorted inside a group); the catch-all groups
 * ("כמה אזורים", "ללא ...") go last, and with the state grouping "פעילים" comes first. */
export function groupSchedules(items: Schedule[], group: ListGroup): ScheduleGroup[] {
  if (!group) return [{ key: '', label: '', items }];
  const map = new Map<string, Schedule[]>();
  for (const s of items) {
    const label = groupLabel(s, group);
    map.set(label, [...(map.get(label) ?? []), s]);
  }
  const catchAll = new Set([MANY, NONE, 'כמה קומות', 'ללא קומה', 'ללא תג']);
  const labels = [...map.keys()];
  const named = labels.filter((l) => !catchAll.has(l)).sort((a, b) => (group === 'state' ? (a === 'פעילים' ? -1 : 1) : a.localeCompare(b, 'he')));
  return [...named, ...labels.filter((l) => catchAll.has(l))].map((label) => ({ key: label, label, items: map.get(label) ?? [] }));
}

export interface FilterOption {
  value: string;
  label: string;
}

/** The areas / floors the visible schedules touch (their devices' own), for the toolbar's selects. */
export function placeOptions(items: Schedule[], kind: 'area' | 'floor'): FilterOption[] {
  const seen = new Map<string, string>();
  for (const s of items)
    for (const e of s.entities) {
      const id = kind === 'area' ? e.area_id : e.floor_id;
      const name = kind === 'area' ? e.area_name : e.floor_name;
      if (id && name) seen.set(id, name);
    }
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'he'));
}

export function tagOptions(items: Schedule[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const s of items) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'he')).map((t) => ({ value: t, label: t }));
}

/** Condition entities of the visible schedules other than the Shabbat presets' sensor (the "תנאי" filter's own options). */
export function conditionOptions(items: Schedule[]): FilterOption[] {
  const seen = new Map<string, string>();
  for (const s of items) for (const c of s.conditions.items) seen.set(c.entity_id, c.name);
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'he'));
}

// ------------------------------------------------------------------------------------------------ actions, tones, the 24 h bar

export type Tone = 'light' | 'switch' | 'climate' | 'cover' | 'fan' | 'alarm' | 'lock' | 'door' | 'script' | 'scene' | 'helper' | 'humidifier' | 'vacuum' | 'off' | 'other';

const OFF_SERVICES = new Set(['light.turn_off', 'switch.turn_off', 'fan.turn_off', 'climate.turn_off', 'input_boolean.turn_off', 'vacuum.return_to_base']);

/** One action's colour class: the "turn off" services are grey whatever the device; the rest follow the device class
 * (blinds, locks, alarm and doors keep their own colour, closing or locking included: they are not "off"). */
export function actionTone(a: Pick<ScheduleAction, 'service' | 'class' | 'supported'> & { data?: Record<string, unknown> }): Tone {
  if (!a.supported || !a.class) return 'other';
  if (OFF_SERVICES.has(a.service) || (a.service === 'climate.set_hvac_mode' && a.data?.hvac_mode === 'off')) return 'off';
  return a.class as ScheduleClass;
}

/** A slot's colour: its first action's; grey when every action switches something off. */
export function slotTone(slot: Pick<ScheduleSlot, 'actions'>): Tone {
  const tones = slot.actions.map(actionTone);
  if (!tones.length) return 'other';
  if (tones.every((t) => t === 'off')) return 'off';
  return tones.find((t) => t !== 'off' && t !== 'other') ?? tones[0];
}

export interface BarSegment {
  index: number;
  /** Percent of the day, 00:00 at the start of the (left-to-right) axis. */
  from: number;
  to: number;
  tone: Tone;
  /** A point action (no window): drawn as a mark, not a span. */
  point: boolean;
  title: string;
}

/** The slots of a schedule on a 24 h axis. Sun times come from today's values (a marker, "משוער"); a slot crossing the day's
 * end is cut at 24:00, like the component's own `00:00` stop. */
export function slotSegments(slots: ScheduleSlot[], sun: SunTimes | null = null): BarSegment[] {
  return slots.map((s) => {
    const span = slotSpan(s, sun);
    const window = s.stop ? `${formatTime(s.start)}–${formatTime(s.stop.kind === 'fixed' && s.stop.time === '00:00' ? { ...s.stop, time: '24:00' } : s.stop)}` : formatTime(s.start);
    return {
      index: s.index,
      from: (span.start / 1440) * 100,
      to: (span.end / 1440) * 100,
      tone: slotTone(s),
      point: !s.stop,
      title: `${window} · ${slotActionText(s, (id) => id ?? '')}`,
    };
  });
}

/** The name a schedule's action shows: the entity's name from the schedule's own list, the id as a last resort. */
export function entityNameOf(s: Pick<Schedule, 'entities'>, id: string | null): string {
  if (!id) return 'ללא התקן';
  return s.entities.find((e) => e.entity_id === id)?.name ?? id;
}

export interface ActionChip {
  label: string;
  tone: Tone;
  /** The devices this label applies to in the slot (names). */
  devices: string[];
  lowering: boolean;
}

/** A slot's actions grouped by wording ("כיבוי מיזוג" on four devices is one chip, not four). */
export function slotChips(slot: ScheduleSlot, s: Pick<Schedule, 'entities'>): ActionChip[] {
  const map = new Map<string, ActionChip>();
  for (const a of slot.actions) {
    const label = actionLabel(a);
    const key = `${label}|${actionTone(a)}`;
    const chip = map.get(key) ?? { label, tone: actionTone(a), devices: [], lowering: false };
    chip.devices.push(entityNameOf(s, a.entity_id));
    chip.lowering = chip.lowering || a.lowering;
    map.set(key, chip);
  }
  return [...map.values()];
}

/** "כיבוי מיזוג · מזגן סלון", "קירור 25° · מזגן משרדים ועוד 2" - one slot in one line. */
export function slotActionText(slot: ScheduleSlot, nameOf: (id: string | null) => string): string {
  if (!slot.actions.length) return '';
  const first = slot.actions[0];
  const more = slot.actions.length - 1;
  return `${actionLabel(first)} · ${nameOf(first.entity_id)}${more > 0 ? ` ועוד ${more}` : ''}`;
}

// ------------------------------------------------------------------------------------------------ days

export interface DayChipState {
  id: DayId;
  short: string;
  on: boolean;
}

/** The seven day chips (Sunday first). `workday` / `weekend` resolve to no days (the server cannot say which): the caller
 * shows the word instead (`daysWord`). */
export function dayChips(days: Schedule['days']): DayChipState[] {
  return DAY_ORDER.map((id) => ({ id, short: DAY_SHORT[id], on: !!days.days?.includes(id) }));
}

export function daysWord(days: Schedule['days']): string | null {
  if (days.days) return null;
  if (days.kind === 'workday') return 'ימי עבודה';
  if (days.kind === 'weekend') return 'סוף שבוע';
  return 'ימים מותאמים';
}

/** "30/09–01/06" for a period; null when the schedule has none. */
export function periodLabel(s: Pick<Schedule, 'start_date' | 'end_date'>): string | null {
  const f = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
  if (s.start_date && s.end_date) return `${f(s.start_date)}–${f(s.end_date)}`;
  if (s.start_date) return `מ־${f(s.start_date)}`;
  if (s.end_date) return `עד ${f(s.end_date)}`;
  return null;
}

// ------------------------------------------------------------------------------------------------ the summary strip (mockup 01)

export interface UpcomingToday {
  scheduleId: string;
  name: string;
  at: string;
  time: string;
  what: string;
  tone: Tone;
  conditional: boolean;
}

const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** The runs still to come today across the enabled schedules, soonest first (a schedule can appear more than once: each of
 * its slots has its own next occurrence). A run of a schedule with conditions is marked - it is "בתנאי", not a promise. */
export function upcomingToday(items: Schedule[], now: Date = new Date(), limit = 5): UpcomingToday[] {
  const out: UpcomingToday[] = [];
  for (const s of items) {
    if (!s.enabled) continue;
    for (const u of s.upcoming) {
      const at = new Date(u.at);
      if (Number.isNaN(at.getTime()) || at.getTime() < now.getTime() || !sameLocalDay(at, now)) continue;
      const slot = s.slots[u.slot_index];
      out.push({ scheduleId: s.id, name: s.display_name, at: u.at, time: hhmm(at), what: slot ? slotActionText(slot, (id) => entityNameOf(s, id)) : '', tone: slot ? slotTone(slot) : 'other', conditional: s.conditions.items.length > 0 });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit);
}

export interface Summary {
  total: number;
  active: number;
  disabled: number;
}

export function summarize(items: Schedule[]): Summary {
  const active = items.filter((s) => s.enabled).length;
  return { total: items.length, active, disabled: items.length - active };
}

// ------------------------------------------------------------------------------------------------ screen state (mockup 13-16)

export type ScreenKind = 'loading' | 'no_view' | 'feature_disabled' | 'missing' | 'error' | 'ready';

export interface ScreenState {
  kind: ScreenKind;
  /** The list is shown from the last known data (the connection is down or the component did not answer). */
  stale: boolean;
  /** Reading is allowed but nothing can be changed: no manage permission, or the writes are blocked. */
  readOnly: boolean;
  /** Why (one short sentence); '' when writable. */
  readOnlyText: string;
  /** The person may open הגדרות › תזמונים (system.configure): the empty states then say where. */
  admin: boolean;
}

const WRITE_BLOCK_TEXT: Record<string, string> = {
  feature_disabled: 'התזמונים כבויים בהגדרות המערכת.',
  component_missing: 'שמירת שינויים אינה זמינה כרגע.',
  ha_unavailable: 'שמירת שינויים אינה זמינה: אין חיבור לתשתית המערכת.',
  bridge_missing: 'שמירת שינויים אינה זמינה כרגע.',
  bridge_unpaired: 'שמירת שינויים אינה זמינה כרגע.',
  bridge_too_old: 'נדרש עדכון של רכיב החיבור כדי לשמור תזמונים.',
};

/** What the screen shows for the server's status (§3.1). `listFailed` = the list request itself failed and nothing is cached. */
export function screenState(status: ScheduleStatus | null, listFailed = false): ScreenState {
  const base: ScreenState = { kind: 'ready', stale: false, readOnly: false, readOnlyText: '', admin: !!status?.can.configure };
  if (!status) return { ...base, kind: listFailed ? 'error' : 'loading' };
  if (!status.can.view && !status.can.manage) return { ...base, kind: 'no_view' };
  if (!status.feature_enabled || status.available === 'feature_disabled') return { ...base, kind: 'feature_disabled' };
  if (status.available === 'component_missing' || status.available === 'not_configured') return { ...base, kind: 'missing' };
  if (listFailed) return { ...base, kind: 'error' };
  const stale = status.stale || status.available === 'ha_unavailable' || status.available === 'error';
  let readOnlyText = '';
  if (!status.can.manage) readOnlyText = 'מצב צפייה. אפשר לראות תזמונים ומועדי הרצה; יצירה, עריכה והרצה דורשות הרשאה מתאימה.';
  else if (!status.writable) readOnlyText = WRITE_BLOCK_TEXT[status.write_block ?? ''] ?? 'שמירת שינויים אינה זמינה כרגע.';
  return { ...base, stale, readOnly: !!readOnlyText, readOnlyText };
}

export const STALE_TEXT = 'המידע אינו מעודכן — אין כרגע חיבור לתשתית המערכת.';

// ------------------------------------------------------------------------------------------------ markers, words

export interface Marker {
  kind: 'sensitive' | 'lowering' | 'attention';
  label: string;
}

/** The markers of a schedule (§5.3): a sensitive one for alarm / lock / door schedules, and the lowering one when it opens
 * or disarms something. */
export function markersOf(s: Pick<Schedule, 'sensitive' | 'lowering'>): Marker[] {
  const out: Marker[] = [];
  if (s.sensitive) out.push({ kind: 'sensitive', label: 'רגיש' });
  if (s.lowering) out.push({ kind: 'lowering', label: 'פותח / מנטרל' });
  return out;
}

export interface LoweringSummary {
  /** The devices the schedule opens or disarms. */
  entities: string[];
  /** The times it does so. */
  times: string[];
  /** The sentence the confirmation shows. */
  text: string;
}

/** What the confirmation of a lowering schedule says (§5.3): which devices, at what times, "גם כשאיש אינו נמצא במקום". */
export function loweringSummary(s: Schedule): LoweringSummary {
  const disarm = new Set<string>();
  const open = new Set<string>();
  const times = new Set<string>();
  for (const slot of s.slots)
    for (const a of slot.actions) {
      if (!a.lowering) continue;
      const name = entityNameOf(s, a.entity_id);
      (a.service === 'alarm_control_panel.alarm_disarm' ? disarm : open).add(name);
      times.add(formatTime(slot.start));
    }
  const parts: string[] = [];
  if (open.size) parts.push(`יפתח ${[...open].join(', ')}`);
  if (disarm.size) parts.push(`ינטרל ${[...disarm].join(', ')}`);
  const entities = [...open, ...disarm];
  const when = [...times].join(', ');
  return { entities, times: [...times], text: `התזמון ${parts.join(' ו')}${when ? ` ב־${when}` : ''} גם כשאיש אינו נמצא במקום.` };
}

/** Does running this slot move something physical? Then the server wants an explicit confirmation (`confirm`, §3.9). */
export function runNeedsConfirm(slot: ScheduleSlot | undefined): boolean {
  return !!slot?.actions.some((a) => a.sensitive || a.lowering || a.service.startsWith('cover.') || a.service.startsWith('lock.'));
}

/** Does running this slot need the lowering confirmation (opens / disarms)? */
export function runIsLowering(slot: ScheduleSlot | undefined): boolean {
  return !!slot?.actions.some((a) => a.lowering);
}

/** The next-run line of a card: "היום 18:00", "היום 18:00 · בתנאי", "מושבת", "הסתיים". */
export function nextRunText(s: Pick<Schedule, 'enabled' | 'state' | 'next_run'>, now: Date = new Date()): string {
  if (!s.enabled) return s.state === 'completed' ? 'הסתיים' : 'מושבת';
  if (!s.next_run) return 'אין הרצה קרובה';
  return s.next_run.conditional ? `${whenLabel(s.next_run.at, now)} · בתנאי` : whenLabel(s.next_run.at, now);
}

/** "מזגן סלון · סלון", "3 התקנים · כמה אזורים": the devices line under a card's title. */
export function devicesLine(s: Pick<Schedule, 'entities'>): string {
  const names = s.entities.map((e) => e.name);
  const areas = [...new Set(s.entities.map((e) => e.area_name).filter((x): x is string => !!x))];
  const head = names.length <= 2 ? names.join(' · ') : `${names[0]} ועוד ${names.length - 1}`;
  const tail = areas.length === 1 ? areas[0] : '';
  return [head, tail].filter(Boolean).join(' · ');
}

/** "נמחק לפני 3 ימים · נשמר עוד 27 ימים" pieces for the trash view. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000));
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Only these can be switched in bulk: the server decides per item, but a schedule the person cannot toggle is not offered. */
export function togglable(items: Schedule[]): Schedule[] {
  return items.filter((s) => s.can.toggle);
}

/** The window a slot occupies as text: "07:30–19:00", "23:30" (a point), "20:00–24:00" (until the day's end). */
export function windowText(slot: ScheduleSlot): string {
  if (!slot.stop) return formatTime(slot.start);
  const stop = slot.stop.kind === 'fixed' && slot.stop.time === '00:00' ? '24:00' : formatTime(slot.stop);
  return `${formatTime(slot.start)}–${stop}`;
}

// ------------------------------------------------------------------------------------------------ errors

/** Codes whose wording the screens fix themselves (the server's text may be an internal phrase, or absent). */
const ERROR_TEXT: Record<string, string> = {
  entity_unknown: 'אחד ההתקנים בתזמון אינו מוכר או מחוץ להרשאתך.',
  idempotency_conflict: 'הבקשה כבר נשלחה בתוכן אחר. רעננו את המסך ונסו שוב.',
};

/** The Hebrew message of a failed schedules call: the fixed wording for the codes above, else the server's own user_message. */
export function scheduleErrorText(err: unknown): string {
  if (err instanceof ApiError && ERROR_TEXT[err.code]) return ERROR_TEXT[err.code];
  return describeError(err);
}

// ------------------------------------------------------------------------------------------------ conditions, trash

/** Does the condition hold right now? null = unknown (not readable, unavailable, or an attribute the read model does not carry). */
export function conditionHolds(c: Pick<ConditionView, 'attribute' | 'match_type' | 'value' | 'state' | 'readable' | 'available'>): boolean | null {
  if (!c.readable || c.state === null || c.available === false || c.attribute !== 'state') return null;
  if (c.match_type === 'is') return String(c.state) === String(c.value);
  if (c.match_type === 'not') return String(c.state) !== String(c.value);
  const cur = Number(c.state);
  const want = Number(c.value);
  if (Number.isNaN(cur) || Number.isNaN(want)) return null;
  return c.match_type === 'above' ? cur > want : cur < want;
}

/** How long a trashed schedule is still kept: "נשמר עוד 27 ימים". */
export function keptText(iso: string, now: Date = new Date()): string {
  const n = daysUntil(iso, now);
  return n <= 0 ? 'יימחק היום' : n === 1 ? 'נשמר עוד יום' : `נשמר עוד ${n} ימים`;
}

/** "נמחק היום", "נמחק אתמול", "נמחק לפני 3 ימים". */
export function deletedText(iso: string, now: Date = new Date()): string {
  const n = daysSince(iso, now);
  return n <= 0 ? 'נמחק היום' : n === 1 ? 'נמחק אתמול' : `נמחק לפני ${n} ימים`;
}
