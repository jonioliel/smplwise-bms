/**
 * CR-AUTODOORS-295: the pure part of the "open a door" block in the automation editor (no DOM): the state chip, the form checks,
 * the day order per language and the edits of a draft policy. The server re-checks everything; these only shape the screen.
 */
import { STEP_BOUNDS, type DoorAutomationStatus, type DoorBlock, type DoorChoice, type DoorPolicy, type DoorRef, type LimitKey, type TimeWindow } from '../api/door-automations';
import { dat, datCode, type DatKey, type DatLang } from '../i18n/door-automation';

export type ChipTone = 'neutral' | 'live' | 'off' | 'warn';

export interface Chip {
  tone: ChipTone;
  text: string;
}

/** The block's chip. The kill switch and "off in this version" win over the stored state: they are what really happens now. */
export function stateChip(block: DoorBlock | null, status: DoorAutomationStatus, lang?: DatLang): Chip {
  if (status.killed) return { tone: 'warn', text: dat('killed', undefined, lang) };
  if (!block || block.state === 'draft') return { tone: 'neutral', text: dat('stateDraft', undefined, lang) };
  if (block.state === 'disarmed') return { tone: 'off', text: dat('stateDisarmed', undefined, lang) };
  if (!status.available) return { tone: 'off', text: dat('off', undefined, lang) };
  return { tone: 'live', text: dat('stateArmed', undefined, lang) };
}

/** The second line under the chip: who armed it and until when, or why it is off. */
export function stateLine(block: DoorBlock | null, lang?: DatLang, fmt: (iso: string) => string = (s) => s.slice(0, 10)): string | null {
  if (!block) return null;
  if (block.state === 'armed' && block.armed_until) return dat('armedBy', { who: block.armed_by_name || block.armed_by || '', until: fmt(block.armed_until) }, lang);
  if (block.state === 'disarmed' && block.disarm_reason) return dat('disarmedWhy', { why: datCode('r', block.disarm_reason, lang) }, lang);
  return null;
}

function minutes(hhmm: string): number {
  if (hhmm === '24:00') return 1440;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const HHMM = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

/** What stops a save, as string keys (empty: the form may be sent). */
export function formProblems(name: string, policy: DoorPolicy): DatKey[] {
  const out: DatKey[] = [];
  if (!policy.doors.length) out.push('needDoor');
  if (policy.windows.some((w) => !w.days.length || !HHMM.test(w.start) || !(w.end === '24:00' || HHMM.test(w.end)) || minutes(w.start) >= minutes(w.end))) out.push('badWindow');
  if (!name.trim()) out.push('name');
  return out;
}

/** The week as the reader expects it: Sunday first in Hebrew and Arabic, Monday first otherwise (server numbering: 0 = Monday). */
export function dayOrder(lang: DatLang): number[] {
  return lang === 'he' || lang === 'ar' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
}

export function toggleDay(w: TimeWindow, day: number): TimeWindow {
  const days = w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day].sort((a, b) => a - b);
  return { ...w, days };
}

export const sameDoor = (a: DoorRef, b: DoorRef) => a.station_id === b.station_id && a.relay === b.relay;

export function toggleDoor(policy: DoorPolicy, door: DoorRef): DoorPolicy {
  const has = policy.doors.some((d) => sameDoor(d, door));
  const doors = has ? policy.doors.filter((d) => !sameDoor(d, door)) : [...policy.doors, { station_id: door.station_id, relay: door.relay }];
  return { ...policy, doors };
}

/** Arming is offered only for a saved, unchanged block that is not armed, while nothing is stopped and every door may be opened by the caller. */
export function canArm(block: DoorBlock | null, status: DoorAutomationStatus, choices: DoorChoice[], dirty: boolean): boolean {
  if (!block || dirty || block.state === 'armed' || status.killed) return false;
  return block.policy.doors.length > 0 && block.policy.doors.every((d) => choices.some((c) => sameDoor(c, d) && c.can_arm));
}

/** The policy the form sends: a limit only where the step sets its own (else the installation's applies), clamped to the server's bounds. */
export function payload(policy: DoorPolicy): DoorPolicy {
  const out: DoorPolicy = {
    doors: policy.doors.map((d) => ({ station_id: d.station_id, relay: d.relay })),
    windows: policy.windows.map((w) => ({ days: [...w.days].sort((a, b) => a - b), start: w.start, end: w.end })),
  };
  for (const k of Object.keys(STEP_BOUNDS) as LimitKey[]) {
    const v = policy[k];
    if (v === undefined || v === null || !Number.isFinite(v)) continue;
    const [lo, hi] = STEP_BOUNDS[k];
    out[k] = Math.min(hi, Math.max(lo, Math.round(v)));
  }
  return out;
}
