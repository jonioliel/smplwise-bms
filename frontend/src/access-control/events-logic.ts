/**
 * CR-036 S8: the pure logic of the native entry-log screen ("פעילות") - no DOM, no network, node-testable.
 * Filters (the chips) <-> the server's filters, local-day arithmetic in a station's clock zone (a day is a day of THAT
 * zone, DST included), grouping by day, the words of a row, appending pages, and the export / error mapping.
 * The element (screens/wiskey-events.ts) only renders what this module decides.
 */
import type { DisplayZone } from '../api/intercom';
import type { AccessAuth, AccessEvent, AccessEventFilters, AccessEventsPage, AccessResult } from '../api/access-events';
import { fromLocalInput, localInput, offsetAt, resolveLocalInput, UTC_ZONE } from '../screens/wiskey-format';

// ---------------------------------------------------------------- the filter state of the chips

/** The period chip: `all` = the whole retained log (the default), `custom` = from / until typed in the filter zone. */
export type RangeKey = 'all' | 'today' | 'yesterday' | 'week' | 'custom';
export const RANGE_KEYS: RangeKey[] = ['all', 'today', 'yesterday', 'week', 'custom'];

export interface EventFilterState {
  range: RangeKey;
  /** `datetime-local` values (YYYY-MM-DDTHH:MM) typed in the filter zone; only read while `range` is `custom`. */
  customStart: string;
  customEnd: string;
  station_id: string;
  person: string;
  result: '' | AccessResult;
  authentication: '' | AccessAuth;
  door: '' | '1' | '2';
}

export const EMPTY_FILTERS: EventFilterState = { range: 'all', customStart: '', customEnd: '', station_id: '', person: '', result: '', authentication: '', door: '' };

export const RESULT_CHOICES: AccessResult[] = ['granted', 'denied', 'unknown'];
export const AUTH_CHOICES: AccessAuth[] = ['card', 'pin', 'unknown'];
export const DOOR_CHOICES: Array<'1' | '2'> = ['1', '2'];

/** How many filters differ from "everything" (the "clear" control and the empty state read it). */
export function activeFilterCount(f: EventFilterState): number {
  return (f.range !== 'all' ? 1 : 0) + (f.station_id ? 1 : 0) + (f.person.trim() ? 1 : 0) + (f.result ? 1 : 0) + (f.authentication ? 1 : 0) + (f.door ? 1 : 0);
}

/** The filters carried by an address (`#/wiskey/events?station=<id>&result=denied&range=today&person=...`) - the deep link
 * the station screen's "activity of this station" uses. Unknown keys and values are ignored, never trusted. */
export function filtersFromHash(hash: string): EventFilterState {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const p = new URLSearchParams(q);
  const out: EventFilterState = { ...EMPTY_FILTERS };
  const station = p.get('station');
  if (station && station.length <= 128 && !/[\u0000-\u001f]/.test(station)) out.station_id = station;
  const person = p.get('person');
  if (person && person.length <= 128) out.person = person;
  const result = p.get('result');
  if (result && (RESULT_CHOICES as string[]).includes(result)) out.result = result as AccessResult;
  const auth = p.get('authentication');
  if (auth && (AUTH_CHOICES as string[]).includes(auth)) out.authentication = auth as AccessAuth;
  const door = p.get('door');
  if (door === '1' || door === '2') out.door = door;
  const range = p.get('range');
  if (range && (['today', 'yesterday', 'week'] as string[]).includes(range)) out.range = range as RangeKey;
  return out;
}

// ---------------------------------------------------------------- local days in a clock zone

/** The calendar date (YYYY-MM-DD) the instant `ms` falls on in `zone`. */
export function localDate(ms: number, zone: DisplayZone): string {
  return new Date(ms + offsetAt(ms, zone) * 1000).toISOString().slice(0, 10);
}

/** `date` (YYYY-MM-DD) moved by `days` calendar days (pure date arithmetic - no zone, no DST). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The first instant of the local day `date` in `zone`, as an aware ISO string (UTC). A midnight that a DST change skips
 * starts the day at the transition; a midnight it repeats starts the day at the first of the two. */
export function localMidnight(date: string, zone: DisplayZone): string {
  const naive = Date.parse(`${date}T00:00:00Z`);
  const offsets = new Set([-172_800, -86_400, 0, 86_400, 172_800].map((d) => offsetAt(naive + d * 1000, zone)));
  const hits = [...offsets].map((off) => naive - off * 1000).filter((ms) => localDate(ms, zone) === date);
  return new Date(hits.length ? Math.min(...hits) : naive).toISOString();
}

/** The `HH:MM` (or `HH:MM:SS`) of an aware ISO instant in `zone`; an em dash for anything else. */
export function localTime(value: string | null | undefined, zone: DisplayZone, seconds = false): string {
  if (!value || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms + offsetAt(ms, zone) * 1000).toISOString().slice(11, seconds ? 19 : 16);
}

/** The local date of an aware ISO instant in `zone`, or '' when it is not one. */
export function dateOf(value: string | null | undefined, zone: DisplayZone): string {
  if (!value || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)) return '';
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? localDate(ms, zone) : '';
}

/** A date for display (`27.9.2026`), from YYYY-MM-DD. */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return y ? `${d}.${m}.${y}` : date;
}

// ---------------------------------------------------------------- chips -> the server's filters

export interface ZoneContext {
  /** The clock zone of a station; null when it has none (the default zone applies). */
  zoneOf: (stationId: string) => DisplayZone | null;
  fallback: DisplayZone;
}

/** The zone the period is read in: the filtered station's own clock zone, else the installation's default (WisKey `refreshFilterZone`). */
export function filterZone(f: EventFilterState, z: ZoneContext): DisplayZone {
  return (f.station_id ? z.zoneOf(f.station_id) : null) ?? z.fallback;
}

export type FilterError = 'clock_invalid_local' | 'clock_ambiguous' | 'clock_nonexistent' | 'filter_start_before_end';

/** The period as aware instants, or the reason it cannot be sent (nothing is ever guessed: a wall time a DST change repeats
 * or skips is refused). `known` keeps an instant whose displayed input has not changed (resolveLocalInput). */
export function rangeBounds(f: EventFilterState, now: Date, zone: DisplayZone, known: { start?: string | null; end?: string | null } = {}): { start?: string; end?: string } | { error: FilterError } {
  const today = localDate(now.getTime(), zone);
  if (f.range === 'today') return { start: localMidnight(today, zone) };
  if (f.range === 'yesterday') return { start: localMidnight(addDays(today, -1), zone), end: localMidnight(today, zone) };
  if (f.range === 'week') return { start: localMidnight(addDays(today, -6), zone) };
  if (f.range !== 'custom') return {};
  try {
    const start = resolveLocalInput(f.customStart, zone, known.start);
    const end = resolveLocalInput(f.customEnd, zone, known.end);
    if (start && end && Date.parse(start) >= Date.parse(end)) return { error: 'filter_start_before_end' };
    return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
  } catch (err) {
    const code = (err as Error).message;
    return { error: code === 'clock_ambiguous' || code === 'clock_nonexistent' ? code : 'clock_invalid_local' };
  }
}

/** The server's filters for the chips as they are now. */
export function wireFilters(f: EventFilterState, now: Date, z: ZoneContext, known: { start?: string | null; end?: string | null } = {}): { filters: AccessEventFilters; start?: string | null; end?: string | null } | { error: FilterError } {
  const zone = filterZone(f, z);
  const bounds = rangeBounds(f, now, zone, known);
  if ('error' in bounds) return bounds;
  const filters: AccessEventFilters = {};
  if (f.station_id) filters.station_id = f.station_id;
  if (f.person.trim()) filters.person = f.person.trim();
  if (f.result) filters.result = f.result;
  if (f.authentication) filters.authentication = f.authentication;
  if (f.door) filters.door = Number(f.door) as 1 | 2;
  if (bounds.start) filters.start = bounds.start;
  if (bounds.end) filters.end = bounds.end;
  return { filters, start: bounds.start ?? null, end: bounds.end ?? null };
}

/** Re-project a typed custom period into another zone, keeping the instants it stood for (the station filter changed the
 * zone); a period that cannot be carried over unambiguously is cleared (`cleared`: the reader is told). */
export function rezoneCustom(f: EventFilterState, from: DisplayZone, to: DisplayZone, known: { start?: string | null; end?: string | null }): { state: EventFilterState; known: { start?: string | null; end?: string | null }; cleared: boolean } {
  if (JSON.stringify(from) === JSON.stringify(to) || f.range !== 'custom') return { state: f, known, cleared: false };
  try {
    const start = resolveLocalInput(f.customStart, from, known.start);
    const end = resolveLocalInput(f.customEnd, from, known.end);
    return { state: { ...f, customStart: localInput(start, to), customEnd: localInput(end, to) }, known: { start, end }, cleared: false };
  } catch {
    return { state: { ...f, customStart: '', customEnd: '' }, known: {}, cleared: true };
  }
}

// ---------------------------------------------------------------- grouping by day

export interface DayGroup {
  /** The local date (YYYY-MM-DD) of the group; '' for rows without a usable time. */
  date: string;
  kind: 'today' | 'yesterday' | 'date' | 'unknown';
  rows: AccessEvent[];
}

/** Consecutive rows of the same local day (in each row's own station zone) under one heading; "today" and "yesterday" are
 * relative to `now` in that zone. The newest-first order of the log is kept. */
export function groupByDay(rows: AccessEvent[], zoneOf: (e: AccessEvent) => DisplayZone, now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of rows) {
    const zone = zoneOf(e);
    const date = dateOf(e.timestamp, zone);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.rows.push(e);
      continue;
    }
    const today = localDate(now.getTime(), zone);
    const kind: DayGroup['kind'] = !date ? 'unknown' : date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : 'date';
    groups.push({ date, kind, rows: [e] });
  }
  return groups;
}

// ---------------------------------------------------------------- the words of a row

/** WisKey's event kinds that are an access attempt (they carry an authentication and a result). */
const ACCESS_TYPES = new Set(['access_granted', 'access_denied', 'attempt_limit', 'unknown']);

export type TitleKind = 'person' | 'employee' | 'ring' | 'unidentified' | 'event';

/** What a row is called: the person, else the employee number, else what kind of record it is. */
export function rowTitle(e: AccessEvent): { kind: TitleKind; text: string } {
  if (e.person_name) return { kind: 'person', text: e.person_name };
  if (e.employee_no) return { kind: 'employee', text: e.employee_no };
  if (e.event_type === 'ring') return { kind: 'ring', text: '' };
  if (ACCESS_TYPES.has(e.event_type)) return { kind: 'unidentified', text: '' };
  return { kind: 'event', text: e.event_type };
}

export type Tone = 'ok' | 'err' | 'warn' | 'acc' | 'unk' | 'neutral';

/** The tone of the result pill and of the row's dot. A ring is information (accent / amber dot), a door or contact record is
 * neutral, a granted / denied access attempt is green / red, anything else unknown. */
export function rowTone(e: AccessEvent): { pill: Tone; dot: Tone } {
  if (e.result === 'granted') return { pill: 'ok', dot: 'ok' };
  if (e.result === 'denied') return { pill: 'err', dot: 'err' };
  if (e.event_type === 'ring') return { pill: 'acc', dot: 'warn' };
  if (!ACCESS_TYPES.has(e.event_type)) return { pill: 'neutral', dot: 'unk' };
  return { pill: 'unk', dot: 'unk' };
}

/** The key of the pill's words: the result for an access attempt, the event kind otherwise. */
export function pillKey(e: AccessEvent): string {
  if (e.result === 'granted') return 'granted';
  if (e.result === 'denied') return 'denied';
  return e.event_type;
}

/** Whether the authentication method is worth a word in the row (not for a ring or a door record). */
export function showsMethod(e: AccessEvent): boolean {
  return e.authentication !== 'unknown' || e.result === 'granted' || e.result === 'denied';
}

/** The portrait of an event may be asked for: the server said it has one the caller may open. */
export const hasPortrait = (e: Pick<AccessEvent, 'portrait'> | null | undefined): boolean => e?.portrait === true;

// ---------------------------------------------------------------- pages

/** The page appended to the one shown: rows the page already holds (an id) are not repeated; the cursor and the bookkeeping are the new page's. */
export function appendPage(prev: AccessEventsPage, next: AccessEventsPage): AccessEventsPage {
  const seen = new Set(prev.records.map((r) => r.id));
  return { ...next, records: [...prev.records, ...next.records.filter((r) => !seen.has(r.id))] };
}

/** Stations whose history WisKey could not recover completely (a gap in the log), by id. */
export function incompleteHistory(page: AccessEventsPage): string[] {
  return Object.entries(page.stations)
    .filter(([, s]) => s.history && !['recovered', 'pending'].includes(s.history))
    .map(([id]) => id);
}

// ---------------------------------------------------------------- errors

export type ReadFailure = 'rate' | 'unavailable' | 'unsupported' | 'other';

/** A reply that is not `ready`, reduced to the one way the screen speaks about it. */
export function failureOf(state: string, lastError: string | null): ReadFailure {
  if (state === 'unsupported') return 'unsupported';
  if (lastError === 'rate_limited' || lastError === 'busy' || lastError === 'timeout') return 'rate';
  return state === 'ready' ? 'other' : 'unavailable';
}

export type ExportFailure = 'station_required' | 'unsupported' | 'unavailable' | 'forbidden' | 'invalid' | 'other';

/** The export's refusals by the server's own error code and status. */
export function exportFailure(status: number, code: string): ExportFailure {
  if (code === 'intercom_export_station_required') return 'station_required';
  if (code === 'intercom_unsupported') return 'unsupported';
  if (code === 'intercom_unavailable' || status === 503 || status === 429) return 'unavailable';
  if (status === 403 || code === 'forbidden' || code === 'intercom_station_not_found') return 'forbidden';
  if (status === 422) return 'invalid';
  return 'other';
}

/** The file name the browser saves: the server's name with the local date of the export. */
export function exportFileName(now: Date, zone: DisplayZone = UTC_ZONE): string {
  return `access-events-${localDate(now.getTime(), zone)}.csv`;
}

// re-exported so the unit tests (and the element) read one module
export { fromLocalInput, localInput };
