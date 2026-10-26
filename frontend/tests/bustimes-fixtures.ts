/**
 * BUSTIMES-295: digests for the TV page's bus-times layouts. The TV runs with `clock=fixed` (09:12 on 23.10.2026, Israel summer time = 06:12Z),
 * so the digest's `now` is that instant and the rows are given as minutes ahead. The shapes are what the server sends (routers/notices.py
 * `GET /notices/display/{slug}/transit`; tests/test_bustimes_295.py pins the server side).
 */
import type { Page, Route } from '@playwright/test';
import type { TransitColumn, TransitDigest, TransitItem, TransitScreen } from '../src/notice-tv/transit-logic';

export const NOW = Date.parse('2026-10-23T06:12:00Z');

const hm = (t: number): string => new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date(t));

export interface Spec {
  line: string;
  dest: string;
  mins: number;
  stop?: number;
  more?: number[];
  /** an estimate row: its distance from the stop in metres (already rounded by the server); the position is `posAge` seconds old */
  dist?: number;
  posAge?: number;
}

export function item(s: Spec): TransitItem {
  const at = NOW + s.mins * 60_000 + 30_000;
  return {
    line: s.line, dest: s.dest, stop: s.stop ?? 33323, at: new Date(at).toISOString().replace('.000', ''), hm: hm(at), mins: s.mins,
    ...(s.dist !== undefined ? { quality: 'realtime' as const, scheduled_time: new Date(at + 90_000).toISOString().replace('.000', ''), estimated_time: new Date(at).toISOString().replace('.000', ''),
      age_seconds: s.posAge ?? 60, distance_m: s.dist, position_age_s: s.posAge ?? 60 } : {}),
    ...(s.more ? { more: s.more.map((m) => ({ at: new Date(NOW + m * 60_000 + 30_000).toISOString().replace('.000', ''), hm: hm(NOW + m * 60_000 + 30_000), mins: m })) } : {}),
  };
}

export const STOPS = [
  { code: 33323, name: 'שדרות חיים וייצמן/הרצל' },
  { code: 33324, name: 'הרצל/משה הס' },
  { code: 37410, name: 'דרך רזיאל/הרצל' },
];

export const ROWS: Spec[] = [
  { line: '28', dest: 'ת. מרכזית נתניה', mins: 3 },
  { line: '25', dest: 'בית גיל הזהב/השקד', mins: 8 },
  { line: '947', dest: 'ת. מרכזית תל אביב', mins: 14 },
  { line: '31', dest: 'בית חולים לניאדו', mins: 27 },
  { line: '605', dest: 'חדרה ת. מרכזית', mins: 44 },
  { line: '28', dest: 'ת. מרכזית נתניה', mins: 65 },
  { line: '25', dest: 'בית גיל הזהב/השקד', mins: 80 },
];

export function digest(p: Partial<TransitDigest> & { specs?: Spec[]; nstops?: number } = {}): TransitDigest {
  const { specs, nstops, ...rest } = p;
  const stops = STOPS.slice(0, nstops ?? 1);
  const list = (specs ?? ROWS).map((r) => item({ ...r, stop: r.stop ?? stops[0].code }));
  const want = rest.rows ?? 5;
  return {
    state: 'fresh', now: new Date(NOW).toISOString().replace('.000', ''), fetched_at: new Date(NOW - 20_000).toISOString().replace('.000', ''), age_s: 20, updated_hm: hm(NOW - 20_000),
    layout: 'side', window_min: 120, rows: want, dwell_s: 15, clock_after_min: 60, stale_grace_min: 30, refresh_s: 20, fresh_s: 180, position_fresh_s: 300, show_distance: true, stops, multi: stops.length > 1, realtime: false,
    items: list.slice(0, want), overflow: Math.max(0, list.length - want), grouped: false, next: null,
    ...rest,
  } as TransitDigest;
}

/** Columns for the slide layout: the rows spread over the stops. */
export function columns(nStops: number, rows = 5): TransitColumn[] {
  return STOPS.slice(0, nStops).map((s, k) => ({
    stop: s.code, name: s.name, grouped: false, overflow: 0, next: null,
    items: ROWS.filter((_r, i) => i % nStops === k).slice(0, rows).map((r) => item({ ...r, stop: s.code })),
  }));
}

export function screen(p: Partial<TransitScreen> = {}): TransitScreen {
  return { enabled: true, stops: [], layout: 'side', window_min: 120, rows: 5, group: 'auto', dwell_s: 15, ...p };
}

/** Serve one digest (or a status) at the board's transit route. */
export async function serveTransit(page: Page, d: TransitDigest | number, slug = 'lobby'): Promise<void> {
  await page.route(`**/api/v1/notices/display/${slug}/transit`, async (route: Route) => {
    if (typeof d === 'number') await route.fulfill({ status: d, contentType: 'application/json', body: '{"code":"not_found"}' });
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  });
}
