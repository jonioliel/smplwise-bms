/**
 * TKUI4 (owner requirement 2026-10-16): the running clock of a request - how long it has been open, frozen as the total handling time once
 * it is closed. Pure (no DOM): tests/unit-tickets-elapsed.spec.ts. The input is what every list item already carries (`created_at`,
 * `closed_at`, `status`, `last_activity_at`); elapsed time is NOT SLA data - the colour of the clock only repeats `slaState` (near / crossed).
 */
import { lt } from './list-text';
import { slaState, type SentenceTicket } from './status-sentence';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface ElapsedInput {
  status: SentenceTicket['status'];
  created_at: string;
  closed_at?: string | null;
  last_activity_at?: string;
  sla?: SentenceTicket['sla'];
}

const FINAL = ['closed', 'cancelled'];

/** Milliseconds open: `now - opened` while open; `closed - opened` once final (a missing close time falls back to the last activity). Never negative. */
export function elapsedMs(t: ElapsedInput, now: Date = new Date()): number | null {
  const from = Date.parse(t.created_at);
  if (Number.isNaN(from)) return null;
  let to = now.getTime();
  if (FINAL.includes(t.status)) {
    const c = Date.parse(t.closed_at ?? t.last_activity_at ?? '');
    to = Number.isNaN(c) ? now.getTime() : c;
  }
  return Math.max(0, to - from);
}

/** Whole minutes for the export (never negative; null without a valid opened time). */
export function elapsedMinutes(t: ElapsedInput, now: Date = new Date()): number | null {
  const ms = elapsedMs(t, now);
  return ms === null ? null : Math.floor(ms / MIN);
}

/** "פחות מדקה" / "12 ד׳" / "3 ש׳ 12 ד׳" / "1 יום" / "2 ימים 3 ש׳": zero parts are left out. */
export function formatElapsed(ms: number): string {
  const v = Math.max(0, ms);
  if (v < MIN) return lt('elLessMinute');
  if (v < HOUR) return lt('elMin', { m: Math.floor(v / MIN) });
  if (v < DAY) {
    const h = Math.floor(v / HOUR);
    const m = Math.floor((v % HOUR) / MIN);
    return m ? lt('elHourMin', { h, m }) : lt('elHour', { h });
  }
  const d = Math.floor(v / DAY);
  const h = Math.floor((v % DAY) / HOUR);
  const days = lt(d === 1 ? 'elDayOne' : 'elDays', { d });
  return h ? `${days} ${lt('elHour', { h })}` : days;
}

export interface ElapsedView {
  /** the full text: "פתוחה 3 ש׳ 12 ד׳" / "טופלה תוך 5 ש׳ 40 ד׳" */
  text: string;
  /** the compact duration alone */
  dur: string;
  frozen: boolean;
  /** a quiet colour only when the existing SLA state says near / crossed */
  tone: '' | 'warn' | 'bad';
}

export function elapsedView(t: ElapsedInput, now: Date = new Date()): ElapsedView | null {
  const ms = elapsedMs(t, now);
  if (ms === null) return null;
  const dur = formatElapsed(ms);
  const frozen = FINAL.includes(t.status);
  const text = frozen ? lt(t.status === 'cancelled' ? 'elCancelled' : 'elHandled', { dur }) : lt('elOpen', { dur });
  const badge = frozen ? null : slaState({ status: t.status, sla: t.sla }, now).badge;
  return { text, dur, frozen, tone: badge?.tone ?? '' };
}

/** The oldest open request of a set: "הוותיקה פתוחה 2 ימים" for a tooltip; '' for an empty set. */
export function oldestOpenText(items: readonly ElapsedInput[], now: Date = new Date()): string {
  let max = -1;
  for (const t of items) {
    if (FINAL.includes(t.status)) continue;
    const ms = elapsedMs(t, now);
    if (ms !== null && ms > max) max = ms;
  }
  return max < 0 ? '' : lt('elOldest', { dur: formatElapsed(max) });
}
