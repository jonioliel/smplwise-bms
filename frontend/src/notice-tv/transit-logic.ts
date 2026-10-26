/**
 * BUSTIMES-295 - the TV board's bus-times logic (no DOM): the digest the server sends, the time wording of a row, the rows still ahead of
 * the clock, the strings. The server made the digest from ITS cache (state fresh / cached / expired / off, the age, local clock text `hm`);
 * the screen never talks to the third party and never converts a UTC time to a local one - it only counts minutes between instants.
 */

export type TransitState = 'fresh' | 'cached' | 'expired' | 'off';
export type TransitLayout = 'side' | 'strip' | 'slide';
export type TransitGroup = 'auto' | 'always' | 'never';

/** The per-screen block of the board's display settings (`display.transit`). */
export interface TransitScreen {
  enabled: boolean;
  stops: number[];
  layout: TransitLayout;
  window_min: number;
  rows: number;
  group: TransitGroup;
  dwell_s: number;
  /** seconds between two fetches of the digest; null / absent = the installation's value */
  refresh_s?: number | null;
  /** show the bus's distance from the stop on estimate rows; null / absent = the installation's value */
  show_distance?: boolean | null;
}

/** `realtime` = a fresh estimate (the minutes count to it); `scheduled` = the timetable; `stale` = an estimate too old to trust (the timetable is shown). */
export type TransitQuality = 'realtime' | 'scheduled' | 'stale';

export interface TransitMore {
  at: string;
  hm: string;
  mins: number;
  quality?: TransitQuality;
}

export interface TransitItem {
  line: string;
  dest: string;
  stop: number;
  at: string;
  hm: string;
  mins: number;
  more?: TransitMore[];
  /** `at` is the instant the minutes count to (the estimate when real-time, else the schedule); both are also given as they are */
  scheduled_time?: string;
  estimated_time?: string | null;
  quality?: TransitQuality;
  /** age of the estimate (real-time) or of the cache (scheduled), in seconds, when the digest was made */
  age_seconds?: number;
  /** road distance from the stop, already rounded by the server (50 m under 1 km, 0.1 km above); present only on an estimate with a fresh position */
  distance_m?: number;
  /** age of the vehicle position when the digest was made, seconds */
  position_age_s?: number;
}

export interface TransitColumn {
  stop: number;
  name: string;
  items: TransitItem[];
  overflow: number;
  grouped: boolean;
  next: TransitItem | null;
}

export interface TransitDigest {
  state: TransitState;
  now?: string;
  fetched_at?: string | null;
  age_s?: number | null;
  /** local HH:MM of the last successful fetch (made by the server) */
  updated_hm?: string | null;
  layout?: TransitLayout;
  window_min?: number;
  rows?: number;
  dwell_s?: number;
  clock_after_min?: number;
  stale_grace_min?: number;
  /** seconds: how often this screen fetches the digest */
  refresh_s?: number;
  /** the age (seconds) under which the digest counts as fresh: max(180, 3 x the poll interval) */
  fresh_s?: number;
  /** a vehicle position older than this (seconds) is no estimate and shows no distance */
  position_fresh_s?: number;
  show_distance?: boolean;
  stops?: { code: number; name: string }[];
  multi?: boolean;
  realtime?: boolean;
  items?: TransitItem[];
  overflow?: number;
  grouped?: boolean;
  next?: TransitItem | null;
  columns?: TransitColumn[];
}

export const TRANSIT_SCREEN_DEFAULTS: TransitScreen = { enabled: false, stops: [], layout: 'side', window_min: 60, rows: 5, group: 'auto', dwell_s: 15, refresh_s: null, show_distance: null };

/** The screen's block with every key present (a board saved before BUSTIMES-295 has none). */
export function transitOf(d: { transit?: Partial<TransitScreen> } | null | undefined): TransitScreen {
  return { ...TRANSIT_SCREEN_DEFAULTS, ...(d?.transit ?? {}) };
}

/** Whole minutes from `nowMs` to the instant `at` (UTC ISO); never negative. */
export function minsUntil(at: string, nowMs: number): number {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((t - nowMs) / 60_000));
}

export type EtaKind = 'now' | 'min' | 'clock';
export interface Eta {
  kind: EtaKind;
  /** the number to draw (minutes, or the clock text) */
  text: string;
}

/**
 * The time of a row. `cached` data has no countdown (the minutes of a stale snapshot would lie): always the scheduled clock time.
 * `fresh`: under 2 minutes the word "now", up to `clock_after_min` minutes the count, from there the clock time (0 = always the clock).
 */
export function etaOf(at: string, hm: string, digest: Pick<TransitDigest, 'state' | 'clock_after_min'>, nowMs: number): Eta {
  if (digest.state !== 'fresh') return { kind: 'clock', text: hm };
  const m = minsUntil(at, nowMs);
  const after = digest.clock_after_min ?? 60;
  if (after > 0 && m < 2) return { kind: 'now', text: '' };
  if (after > 0 && m < after) return { kind: 'min', text: String(m) };
  return { kind: 'clock', text: hm };
}

/** Rows whose instant is still ahead of the clock (the digest is up to 30 s old; a bus that left meanwhile goes at once). */
export function ahead<T extends { at: string }>(rows: T[], nowMs: number): T[] {
  return rows.filter((r) => Date.parse(r.at) > nowMs - 15_000);
}

/**
 * The digest as the screen should treat it NOW. The digest is `fresh` / `cached` as of the moment the server made it; when the building is offline
 * (the screen cannot reach the server) it ages on the screen's own stopwatch (`elapsedMs` since it arrived, no wall clock involved): past 3 minutes
 * the countdown stops (scheduled clock times only), past the installation's grace the panel says unavailable - the same rule as a source that is down.
 */
export function effective(d: TransitDigest | null, elapsedMs: number): TransitDigest | null {
  if (!d || d.state === 'off' || d.state === 'expired') return d;
  const elapsed = Math.max(0, elapsedMs) / 1000;
  const age = (d.age_s ?? 0) + elapsed;
  const fresh = d.fresh_s ?? 180;
  const grace = (d.stale_grace_min ?? 30) * 60;
  if (age > Math.max(fresh, grace)) return { ...d, state: 'expired', items: [], columns: [], overflow: 0, next: null };
  if (age > fresh && d.state === 'fresh') return { ...d, state: 'cached' };
  return d;
}

/** Seconds between two fetches of the digest (the server tells; 10-120, 20 before the first answer). */
export function refreshMs(d: TransitDigest | null): number {
  const s = d?.refresh_s;
  return Math.min(120, Math.max(10, typeof s === 'number' && Number.isFinite(s) ? s : 20)) * 1000;
}

/**
 * The distance of an estimate row, or '' when it must not be printed: only a derived estimate (quality realtime) of a fresh digest, only while the
 * position (aged on the screen's own stopwatch since the digest arrived) is within the freshness limit, and only when the screen shows distances.
 */
export function distanceText(lang: 'he' | 'en', it: Pick<TransitItem, 'quality' | 'distance_m' | 'position_age_s'>, d: Pick<TransitDigest, 'state' | 'show_distance' | 'position_fresh_s'>, elapsedMs: number): string {
  if (d.state !== 'fresh' || d.show_distance === false || it.quality !== 'realtime' || typeof it.distance_m !== 'number' || it.distance_m <= 0) return '';
  if ((it.position_age_s ?? 0) + Math.max(0, elapsedMs) / 1000 > (d.position_fresh_s ?? 300)) return '';
  const m = it.distance_m;
  if (m < 1000) return ts(lang, 'distM', { n: m });
  const km = (Math.round(m / 100) / 10).toFixed(1);
  return ts(lang, 'distKm', { n: lang === 'he' ? km : km });
}

/** A key that changes whenever any row's wording could change (the minute of the clock, the digest's state): the panel is redrawn on it only. */
export function transitTick(digest: TransitDigest | null, nowMs: number): string {
  return digest && digest.state !== 'off' ? digest.state + ':' + Math.floor(nowMs / 60_000) : 'off';
}

/** Is there something to draw: a layout shows a panel for fresh / cached / expired (expired says "unavailable"); only the slide skips an expired board. */
export function hasPanel(digest: TransitDigest | null): boolean {
  return !!digest && digest.state !== 'off';
}

/** The rotating slide joins the rotation unless the data is unusable (expired) or the module is off. */
export function slideWanted(digest: TransitDigest | null): boolean {
  return !!digest && (digest.state === 'fresh' || digest.state === 'cached');
}

const STRINGS = {
  he: {
    title: 'תחבורה ציבורית', titleStop: 'תחנה: {n}', window: 'ב-{n} הדקות הקרובות', windowH: 'בשעה הקרובה', windowH2: 'ב-{n} השעות הקרובות', now: 'עכשיו',
    chipMin: "{n} דק'", chipH: 'שעה', chipH2: '{n} שעות', min: "דק'", more: 'ועוד {n}', none: 'אין אוטובוסים {w}', next: 'הבא לפי לוח זמנים:', nextAt: 'קו {l} ל{d} ב-{t}', sched: 'לפי לוח זמנים', rt: 'הערכה', distM: '{n} מ׳ מהתחנה', distKm: '{n} ק״מ מהתחנה', estIn: 'הערכה בעוד {n} דק׳', estAt: 'הערכה ב-{t}', estNow: 'הערכה: עכשיו', stale: 'לא מעודכן מ-{t}',
    expiredTitle: 'נתוני התחבורה אינם זמינים כרגע', expiredHint: 'הנתונים יחזרו כשהמקור יתעדכן', line: 'קו', toward: 'לכיוון', moreOf: '+{n}',
  },
  en: {
    title: 'Public transport', titleStop: 'Stop: {n}', window: 'the next {n} minutes', windowH: 'the next hour', windowH2: 'the next {n} hours', now: 'Now',
    chipMin: '{n} min', chipH: '1 hour', chipH2: '{n} hours', min: 'min', more: '{n} more', none: 'No buses in {w}', next: 'Next on schedule:', nextAt: 'Line {l} to {d} at {t}', sched: 'Scheduled', rt: 'Estimate', distM: '{n} m away', distKm: '{n} km away', estIn: 'est. in {n} min', estAt: 'est. at {t}', estNow: 'est. now', stale: 'Not updated since {t}',
    expiredTitle: 'Transit times are not available right now', expiredHint: 'They return when the source updates', line: 'Line', toward: 'Towards', moreOf: '+{n}',
  },
};
export type TransitStrKey = keyof typeof STRINGS.he;

export function ts(lang: 'he' | 'en', key: TransitStrKey, vars?: Record<string, string | number>): string {
  const raw = (STRINGS[lang] ?? STRINGS.he)[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

/** "in the next 30 minutes" / "in the next hour" / "in the next 2 hours" for the window of a screen (Hebrew carries the preposition). */
export function windowWords(lang: 'he' | 'en', minutes: number): string {
  if (minutes === 60) return ts(lang, 'windowH');
  if (minutes > 60 && minutes % 60 === 0) return ts(lang, 'windowH2', { n: minutes / 60 });
  return ts(lang, 'window', { n: minutes });
}

/** The sentence of an empty window: "no buses in the next 30 minutes". */
export function noneText(lang: 'he' | 'en', minutes: number): string {
  return ts(lang, 'none', { w: windowWords(lang, minutes) });
}

/** The short chip in the panel header: "30 min" / "1 hour" / "2 hours". */
export function windowChip(lang: 'he' | 'en', minutes: number): string {
  if (minutes === 60) return ts(lang, 'chipH');
  if (minutes > 60 && minutes % 60 === 0) return ts(lang, 'chipH2', { n: minutes / 60 });
  return ts(lang, 'chipMin', { n: minutes });
}

/** A line badge wider than three characters uses the smaller type (the mock-up's `w4`). */
export function badgeWide(line: string): boolean {
  return line.length > 3;
}
