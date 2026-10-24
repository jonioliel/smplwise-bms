/**
 * CR-INFRA-ELEVATORS: the pure presentation model of the elevators - the state chip, the KPI counts, the sensor lights, the 24-hour bar, the
 * relative times and the home widget's choice of elevators - so the node-only unit specs can drive it without a DOM. The state itself is derived
 * by the server (services/elevators.py, documented priority fire_service > fault > out_of_service > moving > door_open > waiting / active >
 * unknown); this module never upgrades it: a stale list shows every elevator as unknown.
 *
 * 2.8.0 (owner 2026-10-18): the installation has NO up / down sensors, so a direction is never shown anywhere - a server state moving_up /
 * moving_down (possible only with sensors mapped before this release) is shown as "פעילה" without an arrow. Every state has its own look
 * (`look`): the out-of-service state has its own strong colour, clearly apart from fault and fire service (decision 9a).
 */
import type { AlertChannel, AlertRecipients, AlertSettings, AlertState, AlertStateSettings, Elevator, ElevatorRole, ElevatorState, HistorySegment } from '../api/elevators';
import type { IconName } from '../components/sw-icon';
import type { StateKind } from '../components/sw-badge';
import { elt, type EltKey } from '../i18n/elevators';
import { ELEVATOR_FILTERS, ELEVATOR_MODES, type ElevatorFilter, type ElevatorMode } from '../api/home-config';
import { dayMonthTimeText, timeText } from '../api/day-format';

export const ELEVATORS_HREF = '#/infra/elevators';
export const ELEVATORS_SETTINGS_HREF = '#/system/infra/elevators';
/** The home screen in its edit mode (where the elevators widget is placed and sized like the others). */
export const HOME_EDIT_HREF = '#/devices/building?edit=1';
/** More elevators than this fold into ONE summary tile (kept for callers of homeTiles). */
export const HOME_CHIP_MAX = 4;

/** The colour family of a state (styles.ts maps each to a token): wait green, act blue, fault red, off strong orange, fire crimson, unk grey. */
export type Look = 'wait' | 'act' | 'fault' | 'off' | 'fire' | 'unk' | 'trav';

export interface Chip {
  state: ElevatorState;
  label: string;
  icon: IconName;
  tone: StateKind;
  look: Look;
  /** The door picture (ELEVDOORS-293): waiting = open, in operation = closed, unless a linked door sensor reports. */
  doors: 'open' | 'closed';
}

const ACTIVE = { key: 'stateActive', icon: 'play', tone: 'live', look: 'act' } as const;
const CHIPS: Record<ElevatorState, { key: EltKey; icon: IconName; tone: StateKind; look: Look }> = {
  fire_service: { key: 'stateFireService', icon: 'flame', tone: 'error', look: 'fire' },
  fault: { key: 'stateFault', icon: 'warning', tone: 'error', look: 'fault' },
  out_of_service: { key: 'stateOutOfService', icon: 'stopSquare', tone: 'stale', look: 'off' },
  // no direction anywhere (owner 2026-10-18): a movement state reads as "in operation"
  moving_up: ACTIVE,
  moving_down: ACTIVE,
  door_open: { key: 'stateDoorOpen', icon: 'door', tone: 'neutral', look: 'wait' },
  waiting: { key: 'stateWaiting', icon: 'pause', tone: 'neutral', look: 'wait' },
  // ELEVTRAVEL-291: only ever sent by the server for an elevator whose "show travelling" option is on
  travelling: { key: 'stateTravelling', icon: 'move', tone: 'live', look: 'trav' },
  active: ACTIVE,
  unknown: { key: 'stateUnknown', icon: 'help', tone: 'unknown', look: 'unk' },
};

/** The state an elevator is SHOWN in: the server's, except that a stale list (the mirror is not connected) is unknown, never an old state;
 * a movement state is shown as `active` (no direction). */
export function shownState(e: Pick<Elevator, 'state' | 'stale'>): ElevatorState {
  if (e.stale || !(e.state in CHIPS)) return 'unknown';
  return e.state === 'moving_up' || e.state === 'moving_down' ? 'active' : e.state;
}

export function chipOf(e: Pick<Elevator, 'state' | 'stale'> & Partial<Pick<Elevator, 'roles' | 'flags'>>): Chip {
  const state = shownState(e);
  const c = CHIPS[state];
  // a linked door sensor with a live value wins (not while stale); else waiting / door open = open doors, everything else shut
  const door = !e.stale && e.roles?.includes('door_open') ? e.flags?.door_open : null;
  const doors = typeof door === 'boolean' ? (door ? 'open' : 'closed') : state === 'waiting' || state === 'door_open' ? 'open' : 'closed';
  return { state, label: elt(c.key), icon: c.icon, tone: c.tone, look: c.look, doors };
}

export const lookOf = (state: ElevatorState): Look => (CHIPS[state] ?? CHIPS.unknown).look;

/** Loudest first: fire service, fault, out of service, unknown, then the calm states. */
export const RANK: Record<ElevatorState, number> = { fire_service: 0, fault: 1, out_of_service: 2, unknown: 3, moving_up: 4, moving_down: 4, active: 4, travelling: 4, door_open: 5, waiting: 6 };
export const ALERT_STATES: readonly ElevatorState[] = ['fire_service', 'fault', 'out_of_service'];

// ------------------------------------------------------------------------------------------------ the Infrastructure screen

export interface Kpis {
  total: number;
  ok: number;
  fault: number;
  off: number;
  fire: number;
  /** ELEVTRAVEL-291: elevators shown as travelling, and whether any elevator uses the option (the KPI card exists only then). */
  travel: number;
  usesTravel: boolean;
}

/** The KPI row: all, waiting or in operation, in fault, out of service, fire service (as shown: a stale list counts nothing but the total). */
export function kpisOf(list: readonly Elevator[], stale = false): Kpis {
  const k: Kpis = { total: list.length, ok: 0, fault: 0, off: 0, fire: 0, travel: 0, usesTravel: list.some((e) => !!e.uses_travel) };
  for (const e of list) {
    const s = shownState({ state: e.state, stale: stale || e.stale });
    if (s === 'fire_service') k.fire++;
    else if (s === 'fault') k.fault++;
    else if (s === 'out_of_service') k.off++;
    else if (s === 'travelling') k.travel++;
    else if (s === 'waiting' || s === 'active' || s === 'door_open') k.ok++;
  }
  return k;
}

export interface Led {
  role: ElevatorRole;
  label: string;
  /** true = lit, false = off, null = no live value; `na` = the role is not linked (drawn faded). */
  on: boolean | null;
  na: boolean;
  look: Look;
}

/** The sensor lights of a card, in the mockup's order: fire service, fault, shutdown, waiting, door. Direction sensors are never shown. */
export function ledsOf(e: Pick<Elevator, 'flags' | 'roles'>, stale = false): Led[] {
  const rows: [ElevatorRole, EltKey, Look][] = [['fire_service', 'stateFireService', 'fire'], ['fault', 'stateFault', 'fault'], ['out_of_service', 'roleOutOfService', 'off'], ['waiting', 'stateWaiting', 'wait'], ['door_open', 'ledDoor', 'wait']];
  return rows.map(([role, key, look]) => {
    const linked = e.roles.includes(role);
    const v = linked && !stale ? e.flags?.[role] ?? null : null;
    return { role, label: elt(key), on: v, na: !linked, look };
  });
}

export interface Bar {
  state: ElevatorState;
  look: Look;
  /** share of the window in percent (0-100, at least 0.5 so a short stretch stays visible) */
  pct: number;
  from: string;
  to: string;
}

/** The 24-hour bar: each segment's share of lo..hi (segments outside are clipped). An unknown start (before the first record) is left empty -
 * the bar begins where the history begins (`lead` = the empty share at the start). Never invented. */
export function barOf(history: readonly HistorySegment[] | null | undefined, lo: number, hi: number): { lead: number; parts: Bar[] } {
  const span = hi - lo;
  if (!history?.length || span <= 0) return { lead: 100, parts: [] };
  const parts: Bar[] = [];
  let first = hi;
  for (const s of history) {
    const a = Math.max(lo, Date.parse(s.from));
    const b = Math.min(hi, Date.parse(s.to));
    if (!(b > a)) continue;
    first = Math.min(first, a);
    parts.push({ state: s.state, look: lookOf(s.state === 'moving_up' || s.state === 'moving_down' ? 'active' : s.state), pct: Math.max(0.5, ((b - a) / span) * 100), from: s.from, to: s.to });
  }
  return { lead: parts.length ? ((first - lo) / span) * 100 : 100, parts };
}

/** Review L8 (state never by colour alone): a light's spoken / tooltip text, e.g. "תקלה: פעיל", "דלת: לא מקושר". */
export function ledText(l: Pick<Led, 'label' | 'on' | 'na'>): string {
  return `${l.label}: ${elt(l.na ? 'ledNa' : l.on === true ? 'ledOn' : l.on === false ? 'ledOff' : 'ledNoValue')}`;
}

/** Review L8: the 24-hour bar as text - each state with its total hours, loudest first: "24 שעות אחרונות: תקלה 6 שע׳, ממתינה 18 שע׳". */
export function barSummary(bar: { parts: readonly Bar[] }): string {
  const hours = new Map<ElevatorState, number>();
  for (const p of bar.parts) {
    const s = p.state === 'moving_up' || p.state === 'moving_down' ? 'active' : p.state;
    hours.set(s, (hours.get(s) ?? 0) + (p.pct * 24) / 100);
  }
  if (!hours.size) return `${elt('last24')}: ${elt('noHistory')}`;
  const parts = [...hours.entries()].sort((a, b) => RANK[a[0]] - RANK[b[0]]).map(([s, h]) => `${chipOf({ state: s, stale: false }).label} ${h < 1 ? elt('lessHour') : elt('hours', { n: Math.round(h) })}`);
  return `${elt('last24')}: ${parts.join(', ')}`;
}

/** "מלפני 2 דק׳" /"מלפני 3 שע׳" / "מאתמול" / "מלפני 4 ימים"; "עכשיו" under a minute; '' without a time. */
export function agoText(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (mins < 1) return elt('agoNow');
  if (mins < 60) return elt('agoMin', { n: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return elt('agoHour', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? elt('agoYesterday') : elt('agoDays', { n: d });
}

/** "מאז 14:05" for a last change today, else the short date and time; empty without a time. */
export function sinceText(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  const t = sameDay ? timeText(d) : dayMonthTimeText(d);
  return elt('since', { t });
}

// ------------------------------------------------------------------------------------------------ the home widget (decision 10b + owner feedback)

export { ELEVATOR_MODES, ELEVATOR_FILTERS, type ElevatorMode, type ElevatorFilter };
export const MODE_KEY: Record<ElevatorMode, EltKey> = { combined: 'modeCombined', cards: 'modeCards', both: 'modeBoth' };
export const FILTER_KEY: Record<ElevatorFilter, EltKey> = { all: 'filterAll', alerts: 'filterAlerts' };

export interface ShownElevator {
  e: Elevator;
  chip: Chip;
}

export interface WidgetView {
  /** the elevators the widget lists (configured order; hidden ones out; with `alerts` only the alerting states) */
  items: ShownElevator[];
  /** the elevators left after hiding, before the state filter (the counts of the combined card) */
  included: ShownElevator[];
  /** the loudest included elevator (null when none is included) */
  loudest: ShownElevator | null;
  kpis: Kpis;
}

/** What the home widget shows: the list without the hidden elevators, filtered by state when the setting says so. */
export function widgetView(list: readonly Elevator[], cfg: { hidden: readonly string[]; filter: ElevatorFilter }, stale = false): WidgetView {
  const hidden = new Set(cfg.hidden);
  const included = list.filter((e) => !hidden.has(e.id)).map((e) => ({ e, chip: chipOf({ state: e.state, stale: stale || e.stale, roles: e.roles, flags: e.flags }) }));
  const items = cfg.filter === 'alerts' ? included.filter((x) => ALERT_STATES.includes(x.chip.state)) : included;
  const loudest = included.length ? [...included].sort((a, b) => RANK[a.chip.state] - RANK[b.chip.state])[0] : null;
  return { items, included, loudest, kpis: kpisOf(included.map((x) => x.e), stale) };
}

/** The combined card's one-line summary: "5 מעליות · 1 בתקלה · 1 בהשבתה · 1 פיקוד כבאים" (only the parts that are not zero). */
export function summaryLine(k: Kpis): string {
  return [k.total === 1 ? elt('countOne') : elt('summary', { n: k.total }), k.fault ? elt('summaryFault', { f: k.fault }) : '', k.off ? `${k.off} ${elt('kpiOff')}` : '',
    k.fire ? elt('summaryFire', { k: k.fire }) : '', k.travel ? elt('summaryTravel', { n: k.travel }) : ''].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------------------------------------ the alert settings (owner decision 2026-10-18)

/** A state notifies only while the master switch AND its own switch are on (the server's elevator_alerts.is_on). */
export function alertActive(s: Pick<AlertSettings, 'enabled' | 'states'>, state: AlertState): boolean {
  return !!(s.enabled && s.states[state]?.enabled);
}

/** How many recipient choices a state has (roles + users + groups); 0 = nobody is notified. */
export const recipientChoices = (r: AlertRecipients): number => r.roles.length + r.users.length + r.groups.length;

/** GENELEV-295: WhatsApp is read-only for a viewer without notify.manage (the server refuses adding it or changing its reach); removing it stays possible. */
export const whatsappLocked = (s: Pick<AlertSettings, 'can_whatsapp'>, cfg: Pick<AlertStateSettings, 'channels'>, channel: AlertChannel): boolean =>
  channel === 'whatsapp' && s.can_whatsapp === false && !cfg.channels.includes('whatsapp');

/** A list with `id` added (on) or removed (off), order kept, no duplicates. */
export function toggled<T extends string>(list: readonly T[], id: T, on: boolean): T[] {
  return on ? (list.includes(id) ? [...list] : [...list, id]) : list.filter((x) => x !== id);
}

/** Review L5: the user's own hidden list after ticking (shown = true) or unticking one elevator; it is ADDED to the installation's list on the
 * server, so it only ever holds the user's own choices. */
export const personalHidden = (mine: readonly string[], id: string, shown: boolean): string[] => toggled(mine, id, !shown);

/** The effective hidden list of a user: the installation's plus his own (the server's home_config.apply_personal). */
export const effectiveHidden = (installation: readonly string[], mine: readonly string[] | undefined): string[] => [...new Set([...installation, ...(mine ?? [])])];

// ------------------------------------------------------------------------------------------------ the KPI-row tiles (CR-INFRA-ELEVATORS 2.7.x)

export type HomeTile =
  | { kind: 'elevator'; id: string; name: string; chip: Chip; href: string }
  | { kind: 'summary'; label: string; value: string; detail: string; icon: IconName; tone: StateKind; href: string };

/**
 * The 2.7.x home tiles (one per elevator up to HOME_CHIP_MAX, else one summary). 2.8.0: the home screen draws the elevators widget instead (owner
 * feedback: the separate small cards looked bad and could not be controlled); kept as a pure helper for other surfaces.
 */
export function homeTiles(list: readonly Elevator[], stale = false): HomeTile[] {
  if (!list.length) return [];
  const items = list.map((e) => ({ e, chip: chipOf({ state: e.state, stale: stale || e.stale, roles: e.roles, flags: e.flags }) }));
  if (items.length <= HOME_CHIP_MAX) return items.map(({ e, chip }) => ({ kind: 'elevator', id: e.id, name: e.name, chip, href: ELEVATORS_HREF }));
  const faults = items.filter((i) => i.chip.state === 'fault').length;
  const fire = items.filter((i) => i.chip.state === 'fire_service').length;
  const loudest = [...items].sort((a, b) => RANK[a.chip.state] - RANK[b.chip.state])[0].chip;
  const tone: StateKind = faults || fire ? 'error' : loudest.state === 'out_of_service' ? 'stale' : 'neutral';
  return [{
    kind: 'summary', label: elt('title'), value: String(items.length),
    detail: [elt('summary', { n: items.length }), faults ? elt('summaryFault', { f: faults }) : '', fire ? elt('summaryFire', { k: fire }) : ''].filter(Boolean).join(' · '),
    icon: fire ? 'flame' : faults ? 'warning' : 'elevator', tone, href: ELEVATORS_HREF,
  }];
}

// ------------------------------------------------------------------------------------------------ 2.9.0 the history popup

export interface HistoryRow {
  state: ElevatorState;
  look: Look;
  label: string;
  from: string;
  to: string;
  /** whole minutes of the stretch (at least 1) */
  minutes: number;
}

/** The state history as rows, newest first, clipped to the last 24 hours; a stretch of zero length is dropped. Pure. */
export function historyRows(history: readonly HistorySegment[] | null | undefined, now: number, windowMs = 24 * 3600_000): HistoryRow[] {
  const lo = now - windowMs;
  const rows: HistoryRow[] = [];
  for (const s of history ?? []) {
    const a = Math.max(lo, Date.parse(s.from));
    const b = Math.min(now, Date.parse(s.to));
    if (!(b > a)) continue;
    const c = chipOf({ state: s.state, stale: false });
    rows.push({ state: s.state, look: c.look, label: c.label, from: new Date(a).toISOString(), to: new Date(b).toISOString(), minutes: Math.max(1, Math.round((b - a) / 60_000)) });
  }
  return rows.sort((x, y) => Date.parse(y.from) - Date.parse(x.from));
}

/** "45 דק׳" / "3 שע׳" / "2 שע׳ 10 דק׳". */
export function durationText(minutes: number): string {
  if (minutes < 60) return elt('durMin', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${elt('hours', { n: h })} ${elt('durMin', { n: m })}` : elt('hours', { n: h });
}

/** Owner 2026-10-19: the add-an-elevator affordances (top button, dashed card) exist ONLY in page edit mode, for a manager; never as a hint outside it. */
export function addAffordances(manage: boolean, editing: boolean): { newButton: boolean; addCard: boolean; doneButton: boolean } {
  const on = manage && editing;
  return { newButton: on, addCard: on, doneButton: on };
}
