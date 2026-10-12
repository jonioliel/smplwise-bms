import { test, expect } from '@playwright/test';
import type { AcPerson } from '../src/api/access-people';
import {
  clearedFilters,
  countLine,
  credentialKinds,
  effectiveView,
  enabledStations,
  filterCount,
  formatDay,
  initials,
  isFiltered,
  maskPhone,
  mergeRows,
  nextOffset,
  offeredColumns,
  parseColumnPrefs,
  parseView,
  peopleParams,
  peopleQueryString,
  personSections,
  personSyncStatus,
  pruneSelection,
  sanitizeFilters,
  selectionState,
  setProfileFilter,
  stateOf,
  toggleAll,
  toggleColumn,
  toggleSelected,
  validityState,
  visibleColumns,
  withFilter,
  PEOPLE_PAGE,
  type PeopleFilters,
  type PeopleRequest,
} from '../src/access-control/people-logic';

// CR-036 S7: the pure logic of the native people screen. Node only - no browser, no network.

const person = (id: string, over: Partial<AcPerson> = {}): AcPerson => ({
  id, display_name: `Person ${id}`, active: true, archived: false, valid_from: null, valid_until: null, revision: 1, access_category: 'staff', user_type: 'normal',
  identity_locked: false, employee_no: `E${id}`, group_ids: [], stations: [], timing: null, level: 'names', editable: false, phone: null, phone_set: null,
  credentials: null, photo_configured: null, profile: null, responsible_person: null, access_purpose: null, ...over,
});
const req = (over: Partial<PeopleRequest> = {}): PeopleRequest => ({ query: '', filters: {}, offset: 0, limit: PEOPLE_PAGE, snapshot: '', ...over });

test.describe('filters to query params', () => {
  test('an empty request is just the paging', () => {
    expect(peopleQueryString(req())).toBe('offset=0&limit=50');
  });

  test('every filter, in a fixed order, empties left out', () => {
    const filters: PeopleFilters = { sort: 'name_desc', state: 'expired', station: 'entry-a', group: 'staff', rights: 'assigned', credential: 'no_pin', profile: { team: 'Night', department: 'Engineering' } };
    expect(peopleParams(req({ query: '  dana  ', filters, offset: 100, limit: 25, snapshot: 'snap-1' }))).toEqual([
      ['query', 'dana'], ['station', 'entry-a'], ['group', 'staff'], ['rights', 'assigned'], ['state', 'expired'], ['credential', 'no_pin'],
      ['profile', 'department=Engineering'], ['profile', 'team=Night'], ['sort', 'name_desc'], ['offset', '100'], ['limit', '25'], ['snapshot', 'snap-1'],
    ]);
    expect(peopleQueryString(req({ filters: { station: '', group: '', profile: { a: '' } } }))).toBe('offset=0&limit=50');
  });

  test('the same filter set always makes the same URL (profile order does not matter)', () => {
    const a = peopleQueryString(req({ filters: { profile: { b: '2', a: '1' } } }));
    const b = peopleQueryString(req({ filters: { profile: { a: '1', b: '2' } } }));
    expect(a).toBe(b);
  });

  test('text and values are encoded; a value may hold = & and Hebrew', () => {
    const qs = peopleQueryString(req({ query: 'דנה כהן & co', filters: { profile: { team: 'a=b&c' } } }));
    const parsed = new URLSearchParams(qs);
    expect(parsed.get('query')).toBe('דנה כהן & co');
    expect(parsed.get('profile')).toBe('team=a=b&c');
    expect(qs).not.toContain('a=b&c'); // the raw value never splits the query string
  });

  test('the paging is clamped to what the server accepts', () => {
    expect(new URLSearchParams(peopleQueryString(req({ offset: -5, limit: 0 }))).get('offset')).toBe('0');
    expect(new URLSearchParams(peopleQueryString(req({ offset: -5, limit: 0 }))).get('limit')).toBe('1');
    expect(new URLSearchParams(peopleQueryString(req({ limit: 5000 }))).get('limit')).toBe('200');
    expect(new URLSearchParams(peopleQueryString(req({ offset: Number.NaN }))).get('offset')).toBe('0');
    expect(new URLSearchParams(peopleQueryString(req({ query: 'x'.repeat(500) }))).get('query')).toHaveLength(160);
    expect(new URLSearchParams(peopleQueryString(req({ snapshot: 's'.repeat(100) }))).get('snapshot')).toHaveLength(64);
  });

  test('at most eight profile filters are sent', () => {
    const profile = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${String(i).padStart(2, '0')}`, 'v']));
    expect(peopleParams(req({ filters: { profile } })).filter(([k]) => k === 'profile')).toHaveLength(8);
  });
});

test.describe('what a caller may filter by', () => {
  const all: PeopleFilters = { sort: 'employee', station: 's', group: 'g', rights: 'disabled', state: 'archived', credential: 'card', profile: { x: 'y' } };

  test('names level keeps the ordinary filters and loses the field filters', () => {
    expect(sanitizeFilters(all, { people: true, sensitive: false })).toEqual({ sort: 'employee', station: 's', group: 'g', rights: 'disabled', state: 'archived' });
  });

  test('the sensitive level keeps all of them', () => {
    expect(sanitizeFilters(all, { people: true, sensitive: true })).toEqual(all);
  });

  test('without the people permission nothing but the sort survives (a viewer sends no filter at all)', () => {
    expect(sanitizeFilters(all, { people: false, sensitive: true })).toEqual({ sort: 'employee' });
  });

  test('a value the server does not know is dropped, not sent', () => {
    const odd = { rights: 'everything', state: 'frozen', credential: 'face' } as unknown as PeopleFilters;
    expect(sanitizeFilters(odd, { people: true, sensitive: true })).toEqual({});
  });

  test('counting, clearing and setting filters', () => {
    expect(filterCount('', {})).toBe(0);
    expect(filterCount(' x ', { station: 's', profile: { a: '1', b: '2' }, sort: 'name' })).toBe(4);
    expect(isFiltered('', { sort: 'name' })).toBe(false);
    expect(clearedFilters({ station: 's', sort: 'name_desc', profile: { a: '1' } })).toEqual({ sort: 'name_desc' });
    expect(clearedFilters({ station: 's' })).toEqual({});
    expect(withFilter({ station: 's' }, 'group', 'g')).toEqual({ station: 's', group: 'g' });
    expect(withFilter({ station: 's', sort: 'name' }, 'station', '')).toEqual({ sort: 'name' });
    expect(setProfileFilter({}, 'department', 'Engineering')).toEqual({ profile: { department: 'Engineering' } });
    expect(setProfileFilter({ profile: { department: 'Engineering' } }, 'department', '')).toEqual({});
    expect(setProfileFilter({ profile: { a: '1' } }, 'b', '2').profile).toEqual({ a: '1', b: '2' });
  });
});

test.describe('paging and the snapshot', () => {
  test('a restart replaces, "load more" appends, a person is never repeated and a fresher copy replaces in place', () => {
    const first = [person('1'), person('2')];
    const second = [person('2', { display_name: 'Newer 2' }), person('3')];
    expect(mergeRows(first, second, 'replace').map((p) => p.id)).toEqual(['2', '3']);
    const merged = mergeRows(first, second, 'append');
    expect(merged.map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(merged[1].display_name).toBe('Newer 2');
    expect(mergeRows([], [person('1'), person('1')], 'replace')).toHaveLength(1);
    expect(mergeRows([person('1'), person('1')], [], 'append')).toHaveLength(1);
  });

  test('the next offset is the servers; a page that does not advance ends the paging (no loop)', () => {
    expect(nextOffset({ next_offset: 50, offset: 0 })).toBe(50);
    expect(nextOffset({ next_offset: null, offset: 50 })).toBeNull();
    expect(nextOffset({ next_offset: 50, offset: 50 })).toBeNull();
    expect(nextOffset({ next_offset: 40, offset: 50 })).toBeNull();
  });

  test('the count line: exact, a lower bound, and the directory size only while filtering and only when known', () => {
    expect(countLine(50, { total: 312, total_all: 312, complete: true }, false)).toEqual({ shown: 50, total: 312, minimum: false, of: null });
    expect(countLine(50, { total: 312, total_all: 900, complete: true }, true)).toEqual({ shown: 50, total: 312, minimum: false, of: 900 });
    expect(countLine(50, { total: 312, total_all: null, complete: true }, true).of).toBeNull();
    expect(countLine(50, { total: 312, total_all: 900, complete: false }, false).minimum).toBe(true);
    expect(countLine(0, null, false)).toEqual({ shown: 0, total: null, minimum: false, of: null });
  });
});

test.describe('sensitivity per level', () => {
  const names = person('n', { level: 'names', employee_no: '1001' });
  const sens = person('s', {
    level: 'sensitive', phone: '+972500000000', phone_set: true, credentials: { pin: true, cards: 2 }, photo_configured: true, profile: { department: 'Engineering' },
    responsible_person: 'Sam', access_purpose: 'Maintenance',
  });

  test('a names-level person has no sensitive section at all', () => {
    expect(personSections(names)).toEqual({ sensitive: false, employeeNo: true, credentials: false, phone: false, photo: false, profile: false, responsible: false, purpose: false });
  });

  test('a names-level person stays names-level even if a value were present (the screen never second-guesses upwards)', () => {
    const leaked = person('l', { level: 'names', phone: '+972500000000', credentials: { pin: true, cards: 1 }, photo_configured: true, profile: { a: 'b' } });
    const s = personSections(leaked);
    expect(s.sensitive || s.phone || s.credentials || s.photo || s.profile).toBe(false);
    expect(credentialKinds(leaked)).toBeNull();
  });

  test('a sensitive-level person shows every section; empty ones stay out', () => {
    expect(personSections(sens)).toEqual({ sensitive: true, employeeNo: true, credentials: true, phone: true, photo: true, profile: true, responsible: true, purpose: true });
    const bare = person('b', { level: 'sensitive', employee_no: null, profile: {}, responsible_person: '', access_purpose: '' });
    expect(personSections(bare)).toMatchObject({ sensitive: true, employeeNo: false, photo: false, profile: false, responsible: false, purpose: false });
  });

  test('the employee number follows what the server sent (the administrator may make it sensitive)', () => {
    expect(personSections(person('x', { employee_no: null })).employeeNo).toBe(false);
    expect(personSections(person('x', { employee_no: '7' })).employeeNo).toBe(true);
  });

  test('credential kinds: cards, a PIN, none, unknown', () => {
    expect(credentialKinds(sens)).toEqual({ kinds: ['card', 'pin'], cards: 2, none: false });
    expect(credentialKinds(person('c', { level: 'sensitive', credentials: { pin: false, cards: 0 } }))).toEqual({ kinds: [], cards: 0, none: true });
    expect(credentialKinds(person('c', { level: 'sensitive', credentials: { pin: null, cards: null } }))).toEqual({ kinds: [], cards: 0, none: false });
    expect(credentialKinds(person('c', { level: 'sensitive', credentials: null }))).toBeNull();
  });

  test('a phone is masked to its last two digits', () => {
    expect(maskPhone('050-123-4501')).toBe('••••••••01');
    expect(maskPhone('+972500000001')).toBe('••••••••••01');
    expect(maskPhone('12')).toBe('•••');
    expect(maskPhone('')).toBe('•••');
  });

  test('columns: the credentials column is sensitive-level, the employee number column follows the setting, the name is first and always', () => {
    expect(offeredColumns({ sensitive: false }, true)).toEqual(['name', 'employee', 'groups', 'stations', 'validity', 'state', 'sync']);
    expect(offeredColumns({ sensitive: false }, false)).toEqual(['name', 'groups', 'stations', 'validity', 'state', 'sync']);
    expect(offeredColumns({ sensitive: true }, true)).toContain('credentials');
    expect(visibleColumns(null, { sensitive: false }, true)).toEqual(['name', 'employee', 'groups', 'stations', 'validity', 'state']);
    expect(visibleColumns(null, { sensitive: true }, true)).toEqual(['name', 'employee', 'groups', 'stations', 'credentials', 'validity', 'state']);
    expect(visibleColumns(['groups', 'credentials'], { sensitive: false }, true)).toEqual(['name', 'groups']);
    expect(visibleColumns(['state'], { sensitive: true }, true)).toEqual(['name', 'state']);
    expect(toggleColumn(null, 'sync', { sensitive: true }, true)).toContain('sync');
    expect(toggleColumn(null, 'validity', { sensitive: true }, true)).not.toContain('validity');
    expect(toggleColumn(['name', 'state'], 'name', { sensitive: true }, true)).toEqual(['name', 'state']);
    expect(toggleColumn(['name'], 'credentials', { sensitive: false }, true)).toEqual(['name']); // a column that is not offered cannot be added
    expect(toggleColumn(['name'], 'employee', { sensitive: false }, false)).toEqual(['name']);
  });

  test('a stored column choice that is not valid is no choice', () => {
    expect(parseColumnPrefs(null)).toBeNull();
    expect(parseColumnPrefs('not json')).toBeNull();
    expect(parseColumnPrefs('{"a":1}')).toBeNull();
    expect(parseColumnPrefs('["bogus"]')).toBeNull();
    expect(parseColumnPrefs('["name","bogus","state"]')).toEqual(['name', 'state']);
  });
});

test.describe('views', () => {
  test('the phone has no table', () => {
    expect(effectiveView('table', true)).toBe('list');
    expect(effectiveView('table', false)).toBe('table');
    expect(effectiveView('cards', true)).toBe('cards');
    expect(effectiveView(null, true)).toBe('list');
    expect(effectiveView(null, false)).toBe('table');
    expect(parseView('cards')).toBe('cards');
    expect(parseView('grid')).toBeNull();
    expect(parseView(null)).toBeNull();
  });
});

test.describe('state, validity and sync words', () => {
  const NOW = Date.parse('2026-10-12T10:00:00Z');

  test('validity: permanent, current, future, expired, and a half or inverted window is unknown (WisKey panel.ts)', () => {
    expect(validityState({ valid_from: null, valid_until: null }, NOW)).toBe('permanent');
    expect(validityState({ valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z' }, NOW)).toBe('validity_current');
    expect(validityState({ valid_from: '2027-01-01T00:00:00Z', valid_until: '2028-01-01T00:00:00Z' }, NOW)).toBe('validity_future');
    expect(validityState({ valid_from: '2025-01-01T00:00:00Z', valid_until: '2026-01-01T00:00:00Z' }, NOW)).toBe('validity_expired');
    expect(validityState({ valid_from: '2026-01-01T00:00:00Z', valid_until: null }, NOW)).toBe('validity_unknown');
    expect(validityState({ valid_from: '2027-01-01T00:00:00Z', valid_until: '2026-01-01T00:00:00Z' }, NOW)).toBe('validity_unknown');
    expect(validityState({ valid_from: 'garbage', valid_until: '2027-01-01T00:00:00Z' }, NOW)).toBe('validity_unknown');
  });

  test('the person state: archived, then inactive, then the window', () => {
    const base = { archived: false, active: true, valid_from: null, valid_until: null };
    expect(stateOf(base, NOW)).toBe('active');
    expect(stateOf({ ...base, archived: true, active: false }, NOW)).toBe('archived');
    expect(stateOf({ ...base, active: false }, NOW)).toBe('inactive');
    expect(stateOf({ ...base, valid_from: '2025-01-01T00:00:00Z', valid_until: '2026-01-01T00:00:00Z' }, NOW)).toBe('expired');
    expect(stateOf({ ...base, valid_from: '2027-01-01T00:00:00Z', valid_until: '2028-01-01T00:00:00Z' }, NOW)).toBe('upcoming');
  });

  test('a day is formatted in the display zone, never a fixed offset', () => {
    expect(formatDay('2026-12-31T22:30:00Z', { kind: 'iana', name: 'Asia/Jerusalem' })).toBe('01.01.2027');
    expect(formatDay('2026-12-31T22:30:00Z', { kind: 'iana', name: 'UTC' })).toBe('31.12.2026');
    expect(formatDay('2026-07-01T21:30:00Z', { kind: 'iana', name: 'Asia/Jerusalem' })).toBe('02.07.2026'); // summer time: +03:00
    expect(formatDay('2026-12-31T22:30:00', { kind: 'iana', name: 'UTC' })).toBe(''); // no offset: not an instant
    expect(formatDay(null)).toBe('');
  });

  test('the overall sync status is the worst of the visible stations; unknown stays unknown, no assignment is unassigned', () => {
    const st = (...states: (string | null)[]) => ({ stations: states.map((s, i) => ({ station_id: `s${i}`, enabled: true, doors: [1], sync_state: s, last_sync_at: null, last_error: null })) });
    expect(personSyncStatus({ stations: null })).toBe('unassigned');
    expect(personSyncStatus({ stations: [] })).toBe('unassigned');
    expect(personSyncStatus(st('synced', 'synced'))).toBe('synced');
    expect(personSyncStatus(st('synced', 'pending'))).toBe('pending');
    expect(personSyncStatus(st('pending', 'error', 'synced'))).toBe('error');
    expect(personSyncStatus(st('syncing', 'conflict'))).toBe('conflict');
    expect(personSyncStatus(st('offline', 'synced'))).toBe('offline');
    expect(personSyncStatus(st('synced', null))).toBe('unknown');
    expect(personSyncStatus(st('quantum'))).toBe('unknown');
    expect(enabledStations({ stations: [{ station_id: 'a', enabled: true, doors: [], sync_state: null, last_sync_at: null, last_error: null }, { station_id: 'b', enabled: false, doors: [], sync_state: null, last_sync_at: null, last_error: null }] })).toBe(1);
    expect(enabledStations({ stations: null })).toBe(0);
  });

  test('initials', () => {
    expect(initials('דנה כהן')).toBe('דכ');
    expect(initials('Dan')).toBe('Da');
    expect(initials('  ')).toBe('');
  });
});

test.describe('selection (the bulk bar)', () => {
  const rows = [person('1'), person('2'), person('3')];

  test('toggle, header state, select all, prune after a reload', () => {
    let sel: Set<string> = new Set();
    expect(selectionState(sel, rows)).toBe('none');
    sel = toggleSelected(sel, '2');
    expect(selectionState(sel, rows)).toBe('some');
    sel = toggleAll(sel, rows);
    expect(selectionState(sel, rows)).toBe('all');
    expect([...sel].sort()).toEqual(['1', '2', '3']);
    sel = toggleAll(sel, rows);
    expect(selectionState(sel, rows)).toBe('none');
    sel = toggleSelected(toggleSelected(new Set(), '1'), '1');
    expect(sel.size).toBe(0);
    expect([...pruneSelection(new Set(['1', '9']), rows)]).toEqual(['1']);
    expect(selectionState(new Set(['1']), [])).toBe('none');
  });
});
