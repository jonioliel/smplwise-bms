/**
 * CR-INFRA-ELEVATORS: the pure presentation model of the elevators - the state chip (label, icon, tone) and the home tiles - so the node-only unit
 * specs can drive it without a DOM. The state itself is derived by the server (services/elevators.py, documented priority
 * fault > out_of_service > moving > door_open > waiting > unknown); this module never upgrades it: a stale list shows every elevator as unknown.
 */
import type { Elevator, ElevatorState } from '../api/elevators';
import type { IconName } from '../components/sw-icon';
import type { StateKind } from '../components/sw-badge';
import { elt, type EltKey } from '../i18n/elevators';

export const ELEVATORS_HREF = '#/infra/elevators';
/** More elevators than this fold into ONE summary tile on the home screen. */
export const HOME_CHIP_MAX = 4;

export interface Chip {
  state: ElevatorState;
  label: string;
  icon: IconName;
  tone: StateKind;
}

const CHIPS: Record<ElevatorState, { key: EltKey; icon: IconName; tone: StateKind }> = {
  fault: { key: 'stateFault', icon: 'warning', tone: 'error' },
  out_of_service: { key: 'stateOutOfService', icon: 'pause', tone: 'stale' },
  moving_up: { key: 'stateMovingUp', icon: 'arrowUp', tone: 'live' },
  moving_down: { key: 'stateMovingDown', icon: 'arrowDown', tone: 'live' },
  door_open: { key: 'stateDoorOpen', icon: 'door', tone: 'neutral' },
  waiting: { key: 'stateWaiting', icon: 'elevator', tone: 'neutral' },
  unknown: { key: 'stateUnknown', icon: 'elevator', tone: 'unknown' },
};

/** The state an elevator is SHOWN in: the server's, except that a stale list (the mirror is not connected) is unknown, never an old state. */
export function shownState(e: Pick<Elevator, 'state' | 'stale'>): ElevatorState {
  if (e.stale) return 'unknown';
  return e.state in CHIPS ? e.state : 'unknown';
}

export function chipOf(e: Pick<Elevator, 'state' | 'stale'>): Chip {
  const state = shownState(e);
  const c = CHIPS[state];
  return { state, label: elt(c.key), icon: c.icon, tone: c.tone };
}

/** Loudest first for the summary: fault, then out of service. */
const RANK: Record<ElevatorState, number> = { fault: 0, out_of_service: 1, unknown: 2, moving_up: 3, moving_down: 3, door_open: 4, waiting: 5 };

export type HomeTile =
  | { kind: 'elevator'; id: string; name: string; chip: Chip; href: string }
  | { kind: 'summary'; label: string; value: string; detail: string; icon: IconName; tone: StateKind; href: string };

/**
 * The home tiles: nothing without elevators (or without permission - the caller passes an empty list); one tile per elevator up to
 * HOME_CHIP_MAX, in the configured order; above that ONE summary tile "N מעליות · F בתקלה" whose tone is the loudest state present.
 */
export function homeTiles(list: readonly Elevator[], stale = false): HomeTile[] {
  if (!list.length) return [];
  const items = list.map((e) => ({ e, chip: chipOf({ state: e.state, stale: stale || e.stale }) }));
  if (items.length <= HOME_CHIP_MAX) return items.map(({ e, chip }) => ({ kind: 'elevator', id: e.id, name: e.name, chip, href: ELEVATORS_HREF }));
  const faults = items.filter((i) => i.chip.state === 'fault').length;
  const loudest = [...items].sort((a, b) => RANK[a.chip.state] - RANK[b.chip.state])[0].chip;
  const tone: StateKind = faults ? 'error' : loudest.state === 'out_of_service' ? 'stale' : 'neutral';
  return [{
    kind: 'summary', label: elt('title'), value: String(items.length), detail: faults ? elt('summaryFaults', { n: items.length, f: faults }) : elt('summary', { n: items.length }),
    icon: faults ? 'warning' : 'elevator', tone, href: ELEVATORS_HREF,
  }];
}

/** "מאז 14:05" for a last change today, else the short date and time; empty without a time. */
export function sinceText(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  const t = sameDay ? d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return elt('since', { t });
}
