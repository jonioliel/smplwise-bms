import { test, expect } from '@playwright/test';
import {
  activeFilterCount,
  addDays,
  appendPage,
  dateLabel,
  dateOf,
  EMPTY_FILTERS,
  exportFailure,
  exportFileName,
  failureOf,
  filtersFromHash,
  filterZone,
  groupByDay,
  hasPortrait,
  incompleteHistory,
  localDate,
  localMidnight,
  localTime,
  pillKey,
  rangeBounds,
  rezoneCustom,
  rowTitle,
  rowTone,
  showsMethod,
  wireFilters,
  type EventFilterState,
} from '../src/access-control/events-logic';
import { printDocument, escapeHtml, PRINT_CSS } from '../src/access-control/events-print';
import { eventsQueryString, featureOffered, type AccessEvent, type AccessEventsPage } from '../src/api/access-events';
import type { DisplayZone } from '../src/api/intercom';

// CR-036 S8: the pure logic of the entry-log screen - filters <-> the server's filters, local days in a clock zone (DST included),
// grouping by day, the words of a row, paging, the export's refusals, the printable document. Node only: the modules the screen uses.

const JLM: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const UTC: DisplayZone = { kind: 'iana', name: 'UTC' };

const row = (id: string, over: Partial<AccessEvent> = {}): AccessEvent => ({
  id, station_id: 'entry-a', timestamp: '2026-09-27T08:40:00+00:00', received_at: '2026-09-27T08:40:00+00:00', time_source: 'device', person_name: 'Dana', employee_no: '1001',
  authentication: 'card', result: 'granted', event_type: 'access_granted', recovered: false, door: 1, portrait: false, ...over,
});
const page = (records: AccessEvent[], next: string | null = null, over: Partial<AccessEventsPage> = {}): AccessEventsPage => ({
  records, next, retention_days: 30, capacity: 5000, membership_basis: null, storage_failed: false, stations: {}, complete: true, incomplete_reason: null, ...over,
});
const f = (over: Partial<EventFilterState> = {}): EventFilterState => ({ ...EMPTY_FILTERS, ...over });
const zones = { zoneOf: (id: string): DisplayZone | null => (id === 'dock' ? UTC : id === 'gate' ? JLM : null), fallback: JLM };

test.describe('local days in a clock zone', () => {
  test('a date is the date of THAT zone', () => {
    // 2026-09-26 22:30 UTC is already 01:30 on the 27th in Jerusalem (UTC+3 in September)
    const ms = Date.parse('2026-09-26T22:30:00Z');
    expect(localDate(ms, UTC)).toBe('2026-09-26');
    expect(localDate(ms, JLM)).toBe('2026-09-27');
    expect(dateOf('2026-09-26T22:30:00+00:00', JLM)).toBe('2026-09-27');
    expect(dateOf(null, JLM)).toBe('');
    expect(dateOf('not a time', JLM)).toBe('');
    expect(dateOf('2026-09-26T22:30:00', JLM)).toBe('');
  });

  test('addDays is calendar arithmetic across months and years', () => {
    expect(addDays('2026-09-27', -1)).toBe('2026-09-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-09-27', -6)).toBe('2026-09-21');
  });

  test('the first instant of a day follows the zone offset of that day, across both DST changes of Jerusalem', () => {
    expect(localMidnight('2026-09-27', JLM)).toBe('2026-09-26T21:00:00.000Z'); // +03:00
    expect(localMidnight('2026-01-15', JLM)).toBe('2026-01-14T22:00:00.000Z'); // +02:00
    expect(localMidnight('2026-03-27', JLM)).toBe('2026-03-26T22:00:00.000Z'); // the day DST starts (at 02:00): midnight is still +02:00
    expect(localMidnight('2026-03-28', JLM)).toBe('2026-03-27T21:00:00.000Z'); // the next day is +03:00
    expect(localMidnight('2026-10-25', JLM)).toBe('2026-10-24T21:00:00.000Z'); // the day DST ends (at 02:00): midnight is +03:00
    expect(localMidnight('2026-10-26', JLM)).toBe('2026-10-25T22:00:00.000Z'); // the next day is +02:00
    expect(localMidnight('2026-09-27', UTC)).toBe('2026-09-27T00:00:00.000Z');
  });

  test('a midnight that DST skips starts the day at the transition; a midnight it repeats starts it at the first one', () => {
    // Sao Paulo 2018-11-04: clocks jumped from 00:00 to 01:00 (-03:00 -> -02:00): there was no local midnight
    const sp: DisplayZone = { kind: 'iana', name: 'America/Sao_Paulo' };
    expect(localMidnight('2018-11-04', sp)).toBe('2018-11-04T03:00:00.000Z');
    // Havana 2025-11-02: clocks went back from 01:00 to 00:00 (-04:00 -> -05:00): local midnight happened twice, the first at 04:00Z
    const hav: DisplayZone = { kind: 'iana', name: 'America/Havana' };
    expect(localMidnight('2025-11-02', hav)).toBe('2025-11-02T04:00:00.000Z');
  });

  test('a device zone (its own DST rule) is read like any other', () => {
    const device: DisplayZone = { kind: 'device', name: 'Device', standard: 7200, delta: 3600, start: [3, 4, 5, 7200], end: [10, 5, 0, 10800] };
    expect(localMidnight('2026-01-15', device)).toBe('2026-01-14T22:00:00.000Z');
    expect(localMidnight('2026-07-15', device)).toBe('2026-07-14T21:00:00.000Z');
  });

  test('localTime shows HH:MM (or with seconds) in the zone, a dash for anything that is not an aware instant', () => {
    expect(localTime('2026-09-27T08:14:07+00:00', JLM)).toBe('11:14');
    expect(localTime('2026-09-27T08:14:07+00:00', JLM, true)).toBe('11:14:07');
    expect(localTime('2026-09-27T08:14:07Z', UTC)).toBe('08:14');
    expect(localTime('2026-09-27T08:14:07', UTC)).toBe('—');
    expect(localTime(null, UTC)).toBe('—');
    expect(localTime('garbage', UTC)).toBe('—');
  });

  test('dateLabel is day.month.year without padding', () => {
    expect(dateLabel('2026-09-07')).toBe('7.9.2026');
    expect(dateLabel('')).toBe('');
  });
});

test.describe('the period chip', () => {
  const now = new Date('2026-09-27T10:30:00Z'); // 13:30 on the 27th in Jerusalem

  test('all has no bounds; today / yesterday / week are whole local days of the filter zone', () => {
    expect(rangeBounds(f({ range: 'all' }), now, JLM)).toEqual({});
    expect(rangeBounds(f({ range: 'today' }), now, JLM)).toEqual({ start: '2026-09-26T21:00:00.000Z' });
    expect(rangeBounds(f({ range: 'yesterday' }), now, JLM)).toEqual({ start: '2026-09-25T21:00:00.000Z', end: '2026-09-26T21:00:00.000Z' });
    expect(rangeBounds(f({ range: 'week' }), now, JLM)).toEqual({ start: '2026-09-20T21:00:00.000Z' });
  });

  test('"today" is read in the zone, not in the browser: the same instant is another day in another zone', () => {
    const late = new Date('2026-09-26T22:30:00Z'); // 01:30 on the 27th in Jerusalem, still the 26th in UTC
    expect(rangeBounds(f({ range: 'today' }), late, JLM)).toEqual({ start: '2026-09-26T21:00:00.000Z' });
    expect(rangeBounds(f({ range: 'today' }), late, UTC)).toEqual({ start: '2026-09-26T00:00:00.000Z' });
  });

  test('a custom period is typed in the filter zone and sent as instants', () => {
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-09-27T00:00', customEnd: '2026-09-27T07:00' }), now, JLM)).toEqual({ start: '2026-09-26T21:00:00.000Z', end: '2026-09-27T04:00:00.000Z' });
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-09-27T00:00' }), now, JLM)).toEqual({ start: '2026-09-26T21:00:00.000Z' });
    expect(rangeBounds(f({ range: 'custom' }), now, JLM)).toEqual({});
  });

  test('a wall time that DST repeats or skips, or one that is not a time, is refused - never coerced', () => {
    // Jerusalem 2026: 02:30 on 2026-03-27 never happens; 01:30 on 2026-10-25 happens twice
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-10-25T01:30' }), now, JLM)).toEqual({ error: 'clock_ambiguous' });
    expect(rangeBounds(f({ range: 'custom', customEnd: '2026-03-27T02:30' }), now, JLM)).toEqual({ error: 'clock_nonexistent' });
    expect(rangeBounds(f({ range: 'custom', customStart: 'tomorrow' }), now, JLM)).toEqual({ error: 'clock_invalid_local' });
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-02-30T10:00' }), now, JLM)).toEqual({ error: 'clock_invalid_local' });
    // control: an unambiguous time right after each transition converts exactly
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-03-27T03:30', customEnd: '2026-10-25T03:30' }), now, JLM)).toEqual({ start: '2026-03-27T00:30:00.000Z', end: '2026-10-25T01:30:00.000Z' });
  });

  test('from must be before until', () => {
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-09-27T08:00', customEnd: '2026-09-27T08:00' }), now, JLM)).toEqual({ error: 'filter_start_before_end' });
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-09-27T09:00', customEnd: '2026-09-27T08:00' }), now, JLM)).toEqual({ error: 'filter_start_before_end' });
  });

  test('an instant already known for an input keeps its DST fold (resolveLocalInput)', () => {
    // 01:30 on 2026-10-25 happens twice in Jerusalem (the clocks go back at 02:00 +03:00): 22:30Z at +03:00, then 23:30Z at +02:00
    const first = '2026-10-24T22:30:00.000Z';
    const typed = f({ range: 'custom', customStart: '2026-10-25T01:30' });
    expect(rangeBounds(typed, now, JLM)).toEqual({ error: 'clock_ambiguous' });
    expect(rangeBounds(typed, now, JLM, { start: first })).toEqual({ start: first });
    // a known instant whose displayed input has since changed is not trusted
    expect(rangeBounds(f({ range: 'custom', customStart: '2026-10-25T03:30' }), now, JLM, { start: first })).toEqual({ start: '2026-10-25T01:30:00.000Z' });
  });
});

test.describe('chips -> the server filters', () => {
  const now = new Date('2026-09-27T10:30:00Z');

  test('only what is set is sent, with the server\'s own keys', () => {
    const w = wireFilters(f({ station_id: 'gate', person: '  yossi ', result: 'granted', authentication: 'pin', door: '1', range: 'today' }), now, zones);
    expect(w).toEqual({
      filters: { station_id: 'gate', person: 'yossi', result: 'granted', authentication: 'pin', door: 1, start: '2026-09-26T21:00:00.000Z' },
      start: '2026-09-26T21:00:00.000Z',
      end: null,
    });
    expect(wireFilters(f(), now, zones)).toEqual({ filters: {}, start: null, end: null });
    expect(wireFilters(f({ person: '   ' }), now, zones)).toEqual({ filters: {}, start: null, end: null });
  });

  test('the period is read in the filtered station\'s zone, else the default zone', () => {
    expect(filterZone(f({ station_id: 'dock' }), zones)).toEqual(UTC);
    expect(filterZone(f({ station_id: 'gate' }), zones)).toEqual(JLM);
    expect(filterZone(f({ station_id: 'nowhere' }), zones)).toEqual(JLM);
    expect(filterZone(f(), zones)).toEqual(JLM);
    const w = wireFilters(f({ station_id: 'dock', range: 'today' }), now, zones);
    expect('filters' in w && w.filters.start).toBe('2026-09-27T00:00:00.000Z');
  });

  test('a refused period is reported, nothing is sent', () => {
    expect(wireFilters(f({ range: 'custom', customStart: '2026-10-25T01:30' }), now, zones)).toEqual({ error: 'clock_ambiguous' });
  });

  test('the query string is the filters plus a limit, and a cursor passed back unchanged', () => {
    expect(eventsQueryString({ station_id: 'a', result: 'denied' }, null, 100)).toBe('station_id=a&result=denied&limit=100');
    expect(eventsQueryString({}, 'c.AbC-123_x', 50)).toBe('limit=50&before=c.AbC-123_x');
    expect(eventsQueryString({ person: 'דנה' }, null)).toContain('person=%D7%93%D7%A0%D7%94');
    expect(eventsQueryString({ station_id: '' }, null)).toBe('limit=100');
  });

  test('re-projecting a typed period into another zone keeps the instants; one that cannot be carried is cleared', () => {
    const typed = f({ range: 'custom', customStart: '2026-09-27T00:00', customEnd: '2026-09-27T07:00' });
    const moved = rezoneCustom(typed, JLM, UTC, {});
    expect(moved.cleared).toBe(false);
    expect(moved.state.customStart).toBe('2026-09-26T21:00');
    expect(moved.state.customEnd).toBe('2026-09-27T04:00');
    expect(rezoneCustom(typed, JLM, JLM, {}).state).toBe(typed);
    expect(rezoneCustom(f({ range: 'today' }), JLM, UTC, {}).state.range).toBe('today');
    const bad = rezoneCustom(f({ range: 'custom', customStart: '2026-10-25T01:30', customEnd: '' }), JLM, UTC, {});
    expect(bad.cleared).toBe(true);
    expect(bad.state.customStart).toBe('');
  });

  test('activeFilterCount counts what differs from "everything"', () => {
    expect(activeFilterCount(f())).toBe(0);
    expect(activeFilterCount(f({ range: 'week', station_id: 'x', person: ' ', result: 'denied', door: '2' }))).toBe(4);
  });

  test('an address can carry filters (the station screen\'s deep link); anything unknown is ignored', () => {
    expect(filtersFromHash('#/wiskey/events?station=entry-a&result=denied&range=today&door=2&authentication=pin&person=dana')).toEqual(
      f({ station_id: 'entry-a', result: 'denied', range: 'today', door: '2', authentication: 'pin', person: 'dana' }),
    );
    expect(filtersFromHash('#/wiskey/events')).toEqual(EMPTY_FILTERS);
    expect(filtersFromHash('#/wiskey/events?result=exploded&range=forever&door=9&authentication=retina&station=')).toEqual(EMPTY_FILTERS);
    expect(filtersFromHash('#/wiskey/events?station=' + 'x'.repeat(200))).toEqual(EMPTY_FILTERS);
  });
});

test.describe('the day groups', () => {
  const now = new Date('2026-09-27T10:30:00Z');
  const at = (id: string, ts: string) => row(id, { timestamp: ts });

  test('consecutive rows of one local day share a heading: today, yesterday, then dates', () => {
    const rows = [at('a', '2026-09-27T09:00:00+00:00'), at('b', '2026-09-27T05:00:00+00:00'), at('c', '2026-09-26T20:00:00+00:00'), at('d', '2026-09-20T10:00:00+00:00')];
    const g = groupByDay(rows, () => JLM, now);
    expect(g.map((x) => [x.kind, x.date, x.rows.map((r) => r.id)])).toEqual([
      ['today', '2026-09-27', ['a', 'b']], // 12:00 and 08:00 on the 27th
      ['yesterday', '2026-09-26', ['c']], // 20:00Z is 23:00 on the 26th
      ['date', '2026-09-20', ['d']],
    ]);
  });

  test('a row without a usable time has its own group, not a made-up date', () => {
    const g = groupByDay([row('x', { timestamp: null }), at('y', '2026-09-27T09:00:00+00:00')], () => JLM, now);
    expect(g.map((x) => x.kind)).toEqual(['unknown', 'today']);
  });

  test('the zone of each row decides its day: the same instant is two different days in two zones', () => {
    const late = '2026-09-26T22:30:00+00:00';
    const rows = [row('j', { station_id: 'gate', timestamp: late }), row('u', { station_id: 'dock', timestamp: late })];
    const g = groupByDay(rows, (e) => zones.zoneOf(e.station_id ?? '') ?? JLM, now);
    expect(g.map((x) => [x.date, x.rows[0].id])).toEqual([['2026-09-27', 'j'], ['2026-09-26', 'u']]);
  });
});

test.describe('the words of a row', () => {
  test('a row is called by the person, else the employee number, else by what kind of record it is', () => {
    expect(rowTitle(row('1'))).toEqual({ kind: 'person', text: 'Dana' });
    expect(rowTitle(row('2', { person_name: null }))).toEqual({ kind: 'employee', text: '1001' });
    expect(rowTitle(row('3', { person_name: null, employee_no: null, result: 'denied', event_type: 'access_denied' }))).toEqual({ kind: 'unidentified', text: '' });
    expect(rowTitle(row('4', { person_name: null, employee_no: null, event_type: 'ring', result: 'unknown' }))).toEqual({ kind: 'ring', text: '' });
    expect(rowTitle(row('5', { person_name: null, employee_no: null, event_type: 'door_unlocked', result: 'unknown' }))).toEqual({ kind: 'event', text: 'door_unlocked' });
  });

  test('granted is green, denied red, a ring information, a door record neutral, the rest unknown', () => {
    expect(rowTone(row('1'))).toEqual({ pill: 'ok', dot: 'ok' });
    expect(rowTone(row('2', { result: 'denied', event_type: 'access_denied' }))).toEqual({ pill: 'err', dot: 'err' });
    expect(rowTone(row('3', { result: 'unknown', event_type: 'ring' }))).toEqual({ pill: 'acc', dot: 'warn' });
    expect(rowTone(row('4', { result: 'unknown', event_type: 'contact_open' }))).toEqual({ pill: 'neutral', dot: 'unk' });
    expect(rowTone(row('5', { result: 'unknown', event_type: 'unknown' }))).toEqual({ pill: 'unk', dot: 'unk' });
  });

  test('the pill says the result for an access attempt and the kind of record otherwise', () => {
    expect(pillKey(row('1'))).toBe('granted');
    expect(pillKey(row('2', { result: 'denied' }))).toBe('denied');
    expect(pillKey(row('3', { result: 'unknown', event_type: 'ring' }))).toBe('ring');
    expect(pillKey(row('4', { result: 'unknown', event_type: 'door_locked' }))).toBe('door_locked');
  });

  test('the method is worth a word for an access attempt, not for a ring or a door record', () => {
    expect(showsMethod(row('1'))).toBe(true);
    expect(showsMethod(row('2', { authentication: 'unknown', result: 'denied' }))).toBe(true);
    expect(showsMethod(row('3', { authentication: 'unknown', result: 'unknown', event_type: 'ring' }))).toBe(false);
    expect(showsMethod(row('4', { authentication: 'pin', result: 'unknown', event_type: 'door_unlocked' }))).toBe(true);
  });

  test('a picture is asked for only when the server said there is one the caller may open', () => {
    expect(hasPortrait(row('1', { portrait: true }))).toBe(true);
    expect(hasPortrait(row('2', { portrait: false }))).toBe(false);
    expect(hasPortrait(row('3', { portrait: null }))).toBe(false);
    expect(hasPortrait(null)).toBe(false);
  });
});

test.describe('pages', () => {
  test('appending keeps the order, never repeats a row, and takes the new cursor and bookkeeping', () => {
    const a = page([row('3'), row('2')], 'ev-2');
    const b = page([row('2'), row('1')], null, { storage_failed: true });
    const m = appendPage(a, b);
    expect(m.records.map((r) => r.id)).toEqual(['3', '2', '1']);
    expect(m.next).toBeNull();
    expect(m.storage_failed).toBe(true);
    expect(a.records.map((r) => r.id)).toEqual(['3', '2']); // the input is untouched
  });

  test('stations whose history WisKey could not recover are listed; the normal states are not', () => {
    const p = page([], null, { stations: { a: { stream: 'connected', history: 'recovered' }, b: { stream: 'connected', history: 'incomplete' }, c: { stream: 'connected', history: 'pending' }, d: { stream: 'connected', history: null } } });
    expect(incompleteHistory(p)).toEqual(['b']);
  });
});

test.describe('refusals', () => {
  test('a reply that is not ready is one of four things', () => {
    expect(failureOf('unsupported', 'not_listed')).toBe('unsupported');
    expect(failureOf('error', 'rate_limited')).toBe('rate');
    expect(failureOf('error', 'busy')).toBe('rate');
    expect(failureOf('error', 'timeout')).toBe('rate');
    expect(failureOf('ha_unavailable', null)).toBe('unavailable');
    expect(failureOf('error', 'invalid_response')).toBe('unavailable');
    expect(failureOf('ready', null)).toBe('other');
  });

  test('the export\'s answers by the server\'s own code', () => {
    expect(exportFailure(422, 'intercom_export_station_required')).toBe('station_required');
    expect(exportFailure(409, 'intercom_unsupported')).toBe('unsupported');
    expect(exportFailure(503, 'intercom_unavailable')).toBe('unavailable');
    expect(exportFailure(429, 'intercom_rate_limited')).toBe('unavailable');
    expect(exportFailure(403, 'forbidden')).toBe('forbidden');
    expect(exportFailure(404, 'intercom_station_not_found')).toBe('forbidden');
    expect(exportFailure(422, 'validation')).toBe('invalid');
    expect(exportFailure(500, 'internal')).toBe('other');
  });

  test('the saved file carries the local date of the export', () => {
    expect(exportFileName(new Date('2026-09-26T22:30:00Z'), JLM)).toBe('access-events-2026-09-27.csv');
    expect(exportFileName(new Date('2026-09-26T22:30:00Z'))).toBe('access-events-2026-09-26.csv');
  });

  test('a feature is hidden only when the integration says it is not available', () => {
    const feats = { state: 'ready' as const, configured: true, last_error: null, client_api: 1, api: null, features: { events_export: { available: false, reason: 'not_listed' }, event_portrait: { available: true, reason: null }, event_detail: { available: null, reason: null } } };
    expect(featureOffered(feats, 'events_export')).toBe(false);
    expect(featureOffered(feats, 'event_portrait')).toBe(true);
    expect(featureOffered(feats, 'event_detail')).toBe(true); // no served copy yet: ask and see
    expect(featureOffered(feats, 'unknown_feature')).toBe(true);
    expect(featureOffered(null, 'events_export')).toBe(true);
  });
});

test.describe('the printable document', () => {
  const input = { title: 'פעילות', subtitle: 'היום · Main gate', columns: ['זמן', 'אדם'], rows: [['11:14', 'Dana <b>&"x"']], footer: 'הודפס 11:20 · 1 שורות', lang: 'he' as const };

  test('is a right-to-left document with one table and every value escaped', () => {
    const doc = printDocument(input);
    expect(doc).toContain('dir="rtl"');
    expect(doc).toContain('<th>זמן</th><th>אדם</th>');
    expect(doc).toContain('<td>Dana &lt;b&gt;&amp;&quot;x&quot;</td>');
    expect(doc).not.toContain('<b>');
    expect(doc).toContain('<h1>פעילות</h1>');
    // the strict remote CSP (style-src-elem 'self') refuses inline style elements, and a srcdoc frame inherits it: the look is adopted
    // as a constructed stylesheet by printHtml (integ-248), never written into the document
    expect(doc).not.toMatch(/<style[\s>]/);
    expect(PRINT_CSS).toContain('@page');
    expect(PRINT_CSS).toContain('border-collapse');
  });

  test('an English document is left to right', () => {
    expect(printDocument({ ...input, lang: 'en' })).toContain('dir="ltr"');
  });

  test('escapeHtml leaves nothing that could open a tag or an attribute', () => {
    expect(escapeHtml(`<img src=x onerror='a()'>"&`)).toBe('&lt;img src=x onerror=&#39;a()&#39;&gt;&quot;&amp;');
  });
});
