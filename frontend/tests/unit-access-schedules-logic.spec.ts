import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AccessStation, StationPrograms } from '../src/api/access-stations';
import {
  codeState,
  dateLines,
  doorGroups,
  doorKey,
  doorSchedule,
  doorsOf,
  feedPanel,
  isBusy,
  latestJob,
  libraryRows,
  parseDoorKey,
  pickDoor,
  planRows,
  programState,
  programTone,
  schedulesAccess,
  stamp,
  stationNamer,
  subtitle,
  tableRows,
  weekGrid,
  weeklyLines,
} from '../src/access-control/schedules-logic';

// CR-036 slice S9: the pure logic of the read-only schedules screen, against the wire fixture the backend test checks against the real
// endpoints (tests/fixtures/access_control_wire.json) plus hand-made edge cases. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-access-schedules-logic.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIRE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'access_control_wire.json'), 'utf8')) as Record<string, any>;
const STATIONS = WIRE.stations.stations as AccessStation[];
const PROGRAMS = WIRE.programs.programs as StationPrograms;
const JLM = { kind: 'iana', name: 'Asia/Jerusalem' } as const;
/** The value without the left-to-right isolates the logic puts around times and dates (they are there for the right-to-left page). */
const P = <T,>(v: T): T => JSON.parse(JSON.stringify(v).replace(/[⁦-⁩]/g, '')) as T;

test.describe('doors', () => {
  test('every relay of a station sent WITH its technical part and an integrated lock - nothing inferred', () => {
    const doors = doorsOf(STATIONS);
    expect(doors.map((d) => d.key)).toEqual(['entry-a:1', 'entry-b:1', 'entry-b:2', 'entry-c:1']);
    expect(doors[0]).toMatchObject({ stationName: 'שער ראשי', doorName: 'שער', door: 1, online: true });
    expect(doors[3].online).toBe(false);
    // the server withholds `technical` from a caller without access.stations.read on the station: no door of it is listed
    const withheld = STATIONS.map((s) => (s.id === 'entry-b' ? { ...s, technical: null } : s));
    expect(doorsOf(withheld).map((d) => d.key)).toEqual(['entry-a:1', 'entry-c:1']);
    // no integrated lock: no door; a relay without a name is "דלת <n>"; relays in their physical order
    const odd = [{ ...STATIONS[1], lock_enabled: false }, { ...STATIONS[0], id: 'x', locks: [{ physical_index: 2, name: null }, { physical_index: 1, name: '  ' }] }];
    expect(doorsOf(odd as AccessStation[]).map((d) => [d.key, d.doorName])).toEqual([['x:1', 'דלת 1'], ['x:2', 'דלת 2']]);
  });

  test('door keys survive a station id with a colon; a bad key is nothing', () => {
    expect(doorKey('a:b', 2)).toBe('a:b:2');
    expect(parseDoorKey('a:b:2')).toEqual({ stationId: 'a:b', door: 2 });
    for (const bad of ['', null, 'entry-a', ':1', 'entry-a:0', 'entry-a:x', 'entry-a:1.5']) expect(parseDoorKey(bad as string)).toBeNull();
  });

  test('the door shown: the one asked for when the caller has it, else the first', () => {
    const doors = doorsOf(STATIONS);
    expect(pickDoor(doors, 'entry-b:2')?.key).toBe('entry-b:2');
    expect(pickDoor(doors, 'entry-z:1')?.key).toBe('entry-a:1'); // a door of a station the caller does not see is never shown
    expect(pickDoor(doors, null)?.key).toBe('entry-a:1');
    expect(pickDoor([], 'entry-a:1')).toBeNull();
    expect(doorGroups(doors).map((g) => [g.stationId, g.doors.length])).toEqual([['entry-a', 1], ['entry-b', 2], ['entry-c', 1]]);
  });
});

test.describe('weekly windows', () => {
  test('the grid is Monday first (the integration\'s and the week grid\'s order); periods map to ranges of the "hold" kind', () => {
    const g = weekGrid(PROGRAMS.programs[0].policy!.weekly);
    expect(g.unreadable).toBe(false);
    expect(g.days).toHaveLength(7);
    expect(g.days[0]).toEqual([{ begin: '07:00', end: '09:00', mode: 'hold' }, { begin: '12:00', end: '13:00', mode: 'hold' }]); // Monday
    expect(g.days[5]).toEqual([]); // Saturday
    expect(g.days[6]).toHaveLength(2); // Sunday
  });

  test('a window the screen cannot read is never drawn - and the screen says the hours are unknown', () => {
    const g = weekGrid({ Monday: [{ start: '07:00', end: '09:00' }, { start: '9:00', end: '10:00' }, { start: '12:00', end: '11:00' }], Tuesday: 'x' as never });
    expect(g.days[0]).toEqual([{ begin: '07:00', end: '09:00', mode: 'hold' }]);
    expect(g.unreadable).toBe(true);
    expect(weekGrid(null).unreadable).toBe(true);
    expect(weekGrid({}).empty).toBe(true);
    expect(weekGrid({ Sunday: [{ start: '00:00', end: '24:00' }] }).days[6]).toEqual([{ begin: '00:00', end: '24:00', mode: 'hold' }]);
  });

  test('lines are Sunday first, equal neighbouring days fold into a range', () => {
    expect(P(weeklyLines(PROGRAMS.programs[0].policy!.weekly))).toEqual(['א׳–ה׳ 07:00–09:00, 12:00–13:00', 'ו׳ 08:00–12:00']);
    const every = Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => [d, [{ start: '06:00', end: '22:00' }]]));
    expect(P(weeklyLines(every))).toEqual(['כל יום 06:00–22:00']);
    expect(P(weeklyLines({}))).toEqual([]);
    // the hours are a left-to-right isolate inside the Hebrew line (a right-to-left page would otherwise show "09:00–07:00")
    expect(weeklyLines(PROGRAMS.programs[0].policy!.weekly)[1]).toBe('ו׳ ⁦08:00–12:00⁩');
    expect(P(weeklyLines(null))).toEqual([]);
  });

  test('specific dates: closed, a range, hours, and an unreadable date said as unknown', () => {
    expect(P(dateLines(PROGRAMS.programs[0].policy!.holidays))).toEqual(['ערב חג · 06.10 · 08:00–11:00']);
    expect(P(dateLines([{ name: null, start: '2026-10-02', end: '2026-10-03', periods: [] }]))).toEqual(['02.10–03.10 · סגור']);
    expect(P(dateLines([{ name: 'x', start: null, end: '2026-10-03', periods: [] }]))).toEqual(['x · לא ידוע · סגור']);
    expect(P(dateLines(null))).toEqual([]);
  });
});

test.describe('a door\'s program', () => {
  const door = (key: string) => doorsOf(STATIONS).find((d) => d.key === key)!;

  test('the state word: an error wins, then a removal, then enabled / paused', () => {
    expect(programState({ enabled: true, removing: false, error: null })).toBe('active');
    expect(programState({ enabled: false, removing: false, error: null })).toBe('paused');
    expect(programState({ enabled: false, removing: true, error: null })).toBe('removing');
    expect(programState({ enabled: true, removing: true, error: 'x' })).toBe('error');
    expect(programState(null)).toBe('unknown');
    expect(['active', 'removing', 'error', 'paused', 'draft', 'unknown'].map((s) => programTone(s as never))).toEqual(['live', 'stale', 'error', 'neutral', 'neutral', 'unknown']);
  });

  test('the program of the relay: state, name, execution, grid, lines, dates; another relay of the station is not it', () => {
    const s = doorSchedule(door('entry-a:1'), PROGRAMS)!;
    expect(s).toMatchObject({ none: false, state: 'active', name: 'בוקר ובצהריים', execution: 'מוחזק פתוח · התחנה אישרה קבלה', unreadable: false, timezone: 'Asia/Jerusalem' });
    expect(s.lines).toHaveLength(2);
    expect(s.dates).toHaveLength(1);
    const other = { ...PROGRAMS, programs: PROGRAMS.programs.map((p) => ({ ...p, door: 2 })) };
    expect(doorSchedule(door('entry-a:1'), other)!.none).toBe(true);
  });

  test('an older saved draft (never activated) is shown as a draft, never as active', () => {
    const p: StationPrograms = { programs: [], saved: [{ door: 2, revision: 1, policy: PROGRAMS.programs[0].policy }], timezone: 'Asia/Jerusalem', native_supported: false };
    const s = doorSchedule(door('entry-b:2'), p)!;
    expect(s).toMatchObject({ none: false, state: 'draft', execution: '' });
    expect(doorSchedule(door('entry-b:1'), p)!.none).toBe(true);
  });

  test('not read yet is not "none"; a program whose policy could not be read is "unknown hours"', () => {
    expect(doorSchedule(door('entry-a:1'), null)).toBeNull();
    const noPolicy = { ...PROGRAMS, programs: [{ ...PROGRAMS.programs[0], policy: null, execution: { owned: false, attempted: null, status: null } }] };
    const s = doorSchedule(door('entry-a:1'), noPolicy as StationPrograms)!;
    expect(s.unreadable).toBe(true);
    expect(s.execution).toBe('לא ידוע אם בוצע');
    expect(s.name).toBe('ללא שם');
  });
});

test.describe('public code presence (never a value)', () => {
  test('the integration\'s own state first, then the slots, else unknown', () => {
    expect(codeState(WIRE.codes.codes)).toBe('set');
    expect(codeState({ ...WIRE.codes.codes, public_pin_state: 'absent' })).toBe('unset');
    expect(codeState({ ...WIRE.codes.codes, public_pin_state: 'unknown', slots: [{ slot: 1, configured: false }, { slot: 2, configured: true }] })).toBe('set');
    expect(codeState({ ...WIRE.codes.codes, public_pin_state: null, slots: [{ slot: 1, configured: false }] })).toBe('unset');
    expect(codeState({ ...WIRE.codes.codes, public_pin_state: 'unknown', slots: [{ slot: 1, configured: false }, { slot: 2, configured: null }] })).toBe('unknown');
    expect(codeState(null)).toBe('unknown');
  });
});

test.describe('the library and the proposals', () => {
  const names = stationNamer(STATIONS);
  const library = WIRE.schedules_library.schedules;
  const plans = WIRE.schedules_plans.schedules;
  const ops = WIRE.schedules_operations.schedules;

  test('a proposal\'s state is its LATEST check when it has one, else how it relates to its library schedule; never "applied"', () => {
    expect(latestJob(ops, 'plan-a')?.id).toBe('job-a2'); // by update time, not by list order
    expect(latestJob(ops, 'plan-b')).toBeNull();
    const rows = planRows(plans, ops, library, names);
    expect(rows.map((r) => [r.id, r.station, r.state, r.tone])).toEqual([
      ['plan-a', 'שער ראשי', 'חסום', 'stale'],
      ['plan-b', 'לובי', 'הספרייה השתנתה', 'stale'],
      ['plan-c', 'חניון', 'בבדיקה', 'stale'],
    ]);
    expect(rows.every((r) => r.notApplied)).toBe(true);
    expect(rows.map((r) => r.outdated)).toEqual([false, true, false]); // plan-b was prepared from revision 2 of a schedule now at 3
    expect(planRows([{ ...plans[0], station_id: 'gone' }], null, null, names)[0]).toMatchObject({ station: 'תחנה לא ידועה', state: 'תואם לספרייה', tone: 'live' });
    expect(planRows([{ ...plans[0], source_state: 'unknown' }], null, null, names)[0].tone).toBe('unknown');
  });

  test('a library row: name, version, hours, holidays, and the stations it was proposed for', () => {
    const rows = libraryRows(library, plans, names);
    expect(rows[0]).toMatchObject({ id: 'sch-office', name: 'שעות משרד', version: 'גרסה 3', holidays: 'חג אחד', proposals: 'הוצע ל־שער ראשי, לובי' });
    expect(P(rows[0].lines)).toEqual(['א׳–ה׳ 07:00–19:00', 'ו׳ 07:00–13:00']);
    expect(rows[1].proposals).toBe('הוצע ל־חניון');
    expect(libraryRows(library, [], names)[0].proposals).toBe('לא הוצע לאף תחנה');
    expect(libraryRows([{ ...library[0], name: null, revision: null, holidays: [{}, {}] }], null, names)[0]).toMatchObject({ name: 'ללא שם', version: '', holidays: '2 חגים' });
  });
});

test.describe('the table across doors', () => {
  test('one row per door; a station not read yet says unknown on its doors, never "none"', () => {
    const doors = doorsOf(STATIONS);
    const rows = tableRows(doors, { 'entry-a': PROGRAMS, 'entry-b': { programs: [], saved: [], timezone: null, native_supported: false } }, { 'entry-a': WIRE.codes.codes });
    expect(rows.map((r) => [r.key, r.program, r.state, r.code])).toEqual([
      ['entry-a:1', 'בוקר ובצהריים', 'פעיל', 'מוגדר'],
      ['entry-b:1', 'לדלת הזאת אין לוחות זמנים', '', 'לא ידוע'],
      ['entry-b:2', 'לדלת הזאת אין לוחות זמנים', '', 'לא ידוע'],
      ['entry-c:1', 'לא ידוע', 'לא ידוע', 'לא ידוע'],
    ]);
    expect(P(rows[0])).toMatchObject({ kind: 'פתוח קבוע', when: 'א׳–ה׳ 07:00–09:00, 12:00–13:00 · ו׳ 08:00–12:00', tone: 'live', codeState: 'set' });
  });
});

test.describe('words, panels, time, access', () => {
  test('subtitle counts; the library part only when the caller sees it', () => {
    expect(subtitle(4, 2)).toBe('4 דלתות · 2 לוחות זמנים בספרייה');
    expect(subtitle(1, 1)).toBe('דלת אחת · לוח זמנים אחד בספרייה');
    expect(subtitle(0, null)).toBe('0 דלתות');
  });

  test('feed states never name the platform; busy is calm', () => {
    for (const s of ['ha_not_configured', 'connecting', 'ha_unavailable', 'not_installed', 'forbidden', 'unsupported', 'error']) {
      const p = feedPanel(s);
      expect(p.heading).not.toMatch(/WisKey|Home Assistant|HA\b|Ingress/);
    }
    expect(feedPanel('forbidden')).toEqual({ panel: 'forbidden', heading: 'המסך הזה אינו זמין לך' });
    expect(feedPanel('connecting').panel).toBe('loading');
    expect(['busy', 'rate_limited', 'timeout'].every(isBusy)).toBe(true);
    expect(isBusy('not_listed')).toBe(false);
  });

  test('stamps are in the station\'s zone, not the browser\'s', () => {
    expect(P(stamp('2026-09-27T04:00:05+00:00', JLM))).toBe('27.09.2026 07:00');
    expect(P(stamp('2026-09-27T04:00:05+00:00', null))).toBe('27.09.2026 04:00');
    expect(P(stamp('2026-09-27T04:00:05', JLM))).toBe(''); // no offset: not an instant
    expect(P(stamp(null))).toBe('');
  });

  test('who sees what: the screen at any scope, the library only at installation scope, editing in the classic panel for administrators', () => {
    const can = (perms: string[]) => (p: string) => perms.includes(p);
    expect(schedulesAccess(can(['access.stations.read']), can(['access.stations.read', 'system.configure']))).toEqual({ screen: true, library: true, edit: true });
    expect(schedulesAccess(can(['access.stations.read']), can(['access.stations.read']))).toEqual({ screen: true, library: true, edit: false });
    expect(schedulesAccess(can(['access.stations.read']), can([]))).toEqual({ screen: true, library: false, edit: false }); // scoped to stations
    expect(schedulesAccess(can(['access.read']), can(['access.read'])).screen).toBe(false);
  });
});
