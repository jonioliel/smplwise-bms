/**
 * BUSTIMES-295: pure helpers of the public-transport screens (no DOM): the stop list rules, the window choice (list + free value), number
 * clamping, the age wording. The server re-validates everything; these keep the form from sending what it will refuse.
 */
import type { TransitStop } from '../api/transit';
import type { TransitScreen } from '../notice-tv/transit-logic';

export const WINDOWS = [15, 30, 60, 120, 180] as const;
export const WINDOW_RANGE: [number, number] = [5, 240];
export const ROWS_RANGE: [number, number] = [3, 10];
export const DWELL_RANGE: [number, number] = [6, 60];
export const REFRESH_RANGE: [number, number] = [10, 120];

export function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
}

/** Can another stop be added: not already listed, and under the limit. */
export function canAdd(stops: { code: number }[], code: number, max: number): 'ok' | 'dup' | 'full' {
  if (stops.some((s) => s.code === code)) return 'dup';
  return stops.length >= max ? 'full' : 'ok';
}

/** The list after moving the stop at `i` by `dir` (-1 up, +1 down); the same list when it cannot move. */
export function moveStop<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** The body of the stops save: code + the typed display name (an empty name lets the server use the catalogue's). */
export function stopsBody(stops: TransitStop[]): { code: number; name: string }[] {
  return stops.map((s) => ({ code: s.code, name: (s.name ?? '').trim() }));
}

/** Is a window one of the list (the select shows it) or a free value (the number box shows it). */
export function windowMode(minutes: number): 'list' | 'free' {
  return (WINDOWS as readonly number[]).includes(minutes) ? 'list' : 'free';
}

/** The window select's label: "15 min", "1 hour", "2 hours". */
export function windowLabel(minutes: number, lang: 'he' | 'en'): string {
  if (minutes === 60) return lang === 'he' ? 'שעה' : '1 hour';
  if (minutes > 60 && minutes % 60 === 0) return lang === 'he' ? (minutes === 120 ? 'שעתיים' : `${minutes / 60} שעות`) : `${minutes / 60} hours`;
  return lang === 'he' ? `${minutes} דקות` : `${minutes} min`;
}

/** Whole minutes of data age, or null when unknown. */
export function ageMinutes(ageS: number | null | undefined): number | null {
  return typeof ageS === 'number' && ageS >= 0 ? Math.floor(ageS / 60) : null;
}

/** The screen block after a change, validated: the window 5-240, rows 3-10, the slide dwell 6-60; stops only from the installation's list. */
export function screenAfter(cur: TransitScreen, patch: Partial<TransitScreen>, configured: number[]): TransitScreen {
  const next = { ...cur, ...patch };
  return {
    ...next,
    window_min: clampInt(next.window_min, WINDOW_RANGE[0], WINDOW_RANGE[1], 60),
    rows: clampInt(next.rows, ROWS_RANGE[0], ROWS_RANGE[1], 5),
    dwell_s: clampInt(next.dwell_s, DWELL_RANGE[0], DWELL_RANGE[1], 15),
    refresh_s: next.refresh_s == null ? null : clampInt(next.refresh_s, REFRESH_RANGE[0], REFRESH_RANGE[1], 20),
    show_distance: next.show_distance ?? null,
    stops: next.stops.filter((c) => configured.includes(c)),
  };
}

/** Toggle one stop of a screen's pick; an empty pick means "all configured stops". */
export function toggleStop(pick: number[], code: number, configured: number[]): number[] {
  const base = pick.length ? pick : configured.slice();
  const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code];
  if (!next.length) return pick; // a screen keeps at least one stop
  const ordered = configured.filter((c) => next.includes(c));
  return ordered.length === configured.length ? [] : ordered;
}
