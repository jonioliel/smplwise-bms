/**
 * CR-038 slice 2: the pure helpers of the SLA grid and the policy editors (no DOM; tests/unit-tickets-durations.spec.ts).
 *
 * The server keeps every SLA threshold in MINUTES (services/tickets/sla.py: 1 minute - 1 year, null = off). The grid shows a value
 * and a unit; a stored value is shown in the LARGEST unit that divides it evenly (1440 -> 1 day, 90 -> 90 minutes, 120 -> 2 hours),
 * so a round trip never changes a number.
 */
export type DurationUnit = 'min' | 'h' | 'd';
export const UNIT_MINUTES: Record<DurationUnit, number> = { min: 1, h: 60, d: 1440 };
export const MINUTES_MAX = 365 * 24 * 60;

/** The SLA fields of a department x priority row, in the order of the grid (13.1). */
export const SLA_THRESHOLDS = [
  'unassigned_after_min', 'link_unopened_min', 'ack_within_min', 'stuck_after_min', 'stuck_waiting_min', 'resolve_within_min', 'remind_every_min',
] as const;
export type SlaThreshold = (typeof SLA_THRESHOLDS)[number];
export const SLA_COUNTERS = ['max_reminders', 'manager_alert_after_steps'] as const;
export type SlaCounter = (typeof SLA_COUNTERS)[number];

export interface Duration { value: number; unit: DurationUnit }

/** A stored minute count as value + unit (null = off). */
export function splitMinutes(minutes: number | null | undefined): Duration | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'd' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'h' };
  return { value: minutes, unit: 'min' };
}

/** A typed value + unit as minutes: null for an empty input (off), NaN for a value the server would refuse. */
export function toMinutes(raw: string, unit: DurationUnit): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d{1,6}$/.test(s)) return Number.NaN;
  const m = Number(s) * UNIT_MINUTES[unit];
  return m >= 1 && m <= MINUTES_MAX ? m : Number.NaN;
}

/** A counter (0-10) from an input; NaN when out of range or not a whole number. */
export function toCounter(raw: string): number {
  const s = raw.trim();
  if (!/^\d{1,2}$/.test(s)) return Number.NaN;
  const n = Number(s);
  return n <= 10 ? n : Number.NaN;
}

/** A whole number within [lo, hi] from an input, else NaN (an empty input is NaN too: use `null` handling at the caller). */
export function intIn(raw: string, lo: number, hi: number): number {
  const s = raw.trim();
  if (!/^-?\d{1,4}$/.test(s)) return Number.NaN;
  const n = Number(s);
  return n >= lo && n <= hi ? n : Number.NaN;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** D4: a send-hours window is valid when both ends are HH:MM and `from` is earlier than `to` (no window across midnight). */
export function windowProblem(from: string, to: string): 'time' | 'order' | null {
  if (!HHMM.test(from) || !HHMM.test(to)) return 'time';
  return from < to ? null : 'order';
}

/** D5: the effective link values of a department: its overrides over the installation values; the cap is never under the window. */
export function effectiveLinks(
  inst: { sliding_days: number; cap_days: number; grace_hours: number },
  own: { link_sliding_days: number | null; link_cap_days: number | null; link_grace_hours: number | null },
): { sliding_days: number; cap_days: number; grace_hours: number } {
  const sliding = own.link_sliding_days ?? inst.sliding_days;
  const cap = Math.max(own.link_cap_days ?? inst.cap_days, sliding);
  return { sliding_days: sliding, cap_days: cap, grace_hours: own.link_grace_hours ?? inst.grace_hours };
}

/** One row of the SLA grid as the inputs hold it (strings) -> the body fields that CHANGED, or the names of the invalid fields. */
export function slaRowChanges(
  stored: Record<SlaThreshold | SlaCounter, number | null>,
  draft: Partial<Record<SlaThreshold, { raw: string; unit: DurationUnit }> & Record<SlaCounter, string>>,
): { changes: Partial<Record<SlaThreshold | SlaCounter, number | null>>; invalid: (SlaThreshold | SlaCounter)[] } {
  const changes: Partial<Record<SlaThreshold | SlaCounter, number | null>> = {};
  const invalid: (SlaThreshold | SlaCounter)[] = [];
  for (const k of SLA_THRESHOLDS) {
    const d = draft[k];
    if (!d) continue;
    const m = toMinutes(d.raw, d.unit);
    if (Number.isNaN(m)) invalid.push(k);
    else if (m !== stored[k]) changes[k] = m;
  }
  for (const k of SLA_COUNTERS) {
    const d = draft[k];
    if (d === undefined) continue;
    const n = toCounter(d);
    if (Number.isNaN(n)) invalid.push(k);
    else if (n !== stored[k]) changes[k] = n;
  }
  return { changes, invalid };
}
