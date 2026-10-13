import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import type { AccessStation } from '../src/api/access-stations';
import { announceToStations } from '../src/api/access-stations';
import type { IntercomCallResult, IntercomTtsStatus } from '../src/api/intercom';
import { enStationsText, fill, heStationsText } from '../src/i18n/wiskey-stations';
import { RESULT_TTL_MS, RESULT_UNKNOWN_TTL_MS, StationActions, callText, failure, holdMs, type ActionDeps } from '../src/screens/wiskey-stations-actions';
import {
  ARM_MIN_MS,
  ARM_MS,
  CallClock,
  POLICY_DEFAULTS,
  TABLE_COMPACT_MAX,
  TABLE_MEDIUM_MAX,
  TABLE_MIN,
  UNKNOWN_HOLD_FALLBACK_MS,
  ageText,
  announceChoices,
  classicPanelHref,
  clockText,
  codesSummary,
  derivePlaces,
  feedPanel,
  inPlace,
  inPlaceFilter,
  matchesFilter,
  matchesQuery,
  needsAttention,
  parsePolicy,
  phrasesOf,
  placeLabelOf,
  placeRows,
  plural,
  programViews,
  rightsOf,
  seenText,
  showCallHint,
  speechSeconds,
  statusOf,
  subtitleOf,
  syncKind,
  tableTierOf,
  tally,
  ttsLength,
  visibleStations,
  weeklyLines,
  ltrRange,
  type PlaceMap,
} from '../src/screens/wiskey-stations-logic';

// CR-036 slice S6: the pure logic of the native stations and doors screen and the state machine of its physical actions. Node only:
// a manual clock and fake endpoints - no browser, no network, no WisKey.
const he = heStationsText;
const NOW = Date.parse('2026-10-12T08:14:07Z');
const ZONE = { kind: 'iana', name: 'Asia/Jerusalem' } as const;

const station = (id: string, over: Partial<AccessStation> = {}): AccessStation => ({
  id,
  name: id,
  online: true,
  call_state: 'idle',
  sync_state: 'synced',
  lock_enabled: true,
  locks: [{ physical_index: 1, name: null }],
  has_camera: true,
  camera_entity: `camera.${id}`,
  last_seen: '2026-10-12T08:14:00+00:00',
  zone: null,
  technical: null,
  errors: null,
  ...over,
});

const LIST: AccessStation[] = [
  station('gate', { name: 'שער ראשי', call_state: 'ringing' }),
  station('lobby', { name: 'לובי', locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }] }),
  station('park', { name: 'חניון', sync_state: 'pending', lock_enabled: false, locks: [] }),
  station('lab', { name: 'מעבדה', call_state: 'in_call' }),
  station('store', { name: 'מחסן', online: false, call_state: 'unavailable', sync_state: 'offline', camera_entity: null, has_camera: false }),
  station('mgmt', { name: 'הנהלה', sync_state: 'error', errors: { last_error: 'sync_rejected', scan_error: null } }),
];

test.describe('words, filters, counts', () => {
  test('a station has one status word: offline wins, then the call', () => {
    expect(statusOf(LIST[0])).toBe('ringing');
    expect(statusOf(LIST[3])).toBe('in_call');
    expect(statusOf(LIST[4])).toBe('offline');
    expect(statusOf(LIST[1])).toBe('online');
    expect(statusOf({ online: false, call_state: 'ringing' })).toBe('offline');
    expect(statusOf({ online: true, call_state: 'ending' })).toBe('ending');
  });

  test('the filters: online, needs attention (offline, a waiting or failed sync, an error text the viewer may see), in a call', () => {
    expect(LIST.filter((s) => matchesFilter(s, 'online')).map((s) => s.id)).toEqual(['gate', 'lobby', 'park', 'lab', 'mgmt']);
    expect(LIST.filter((s) => matchesFilter(s, 'attention')).map((s) => s.id)).toEqual(['park', 'store', 'mgmt']);
    expect(LIST.filter((s) => matchesFilter(s, 'in_call')).map((s) => s.id)).toEqual(['gate', 'lab']);
    expect(LIST.filter((s) => matchesFilter(s, 'all'))).toHaveLength(6);
    // an operator who may not see error texts: the sync STATE alone still flags the station
    expect(needsAttention(station('x', { sync_state: 'error', errors: null }))).toBe(true);
    expect(needsAttention(station('x', { sync_state: 'syncing' }))).toBe(false);
    expect(needsAttention(station('x', { sync_state: 'unknown' }))).toBe(true);
    expect(needsAttention(station('x', { errors: { last_error: null, scan_error: 'device_busy' } }))).toBe(true);
  });

  test('the table gives up columns by width: a wide desktop shows all, a laptop and a tablet keep what is read and done, a narrow window has none', () => {
    // the full table needs about 1040 px of host, the compact one about 420; the host is the viewport less the side rail and the
    // place tree (about 370 px)
    expect([2560, 1920, 1536, 1440].map(tableTierOf)).toEqual(['full', 'full', 'full', 'full']);
    expect([1439, 1366, 1280, 1101].map(tableTierOf)).toEqual(['medium', 'medium', 'medium', 'medium']);
    expect([1100, 1024, 900, 820].map(tableTierOf)).toEqual(['compact', 'compact', 'compact', 'compact']);
    expect([819, 768, 600, 390, 320].map(tableTierOf)).toEqual(['none', 'none', 'none', 'none', 'none']);
    expect(TABLE_MIN).toBeLessThan(TABLE_COMPACT_MAX);
    expect(TABLE_COMPACT_MAX).toBeLessThan(TABLE_MEDIUM_MAX);
  });

  test('the search matches the name, the place and (with the technical part) the model', () => {
    const withModel = station('m', { name: 'Rear', technical: { model: 'DS-KD8003' } as AccessStation['technical'] });
    expect(matchesQuery(LIST[0], 'שער')).toBe(true);
    expect(matchesQuery(LIST[0], 'לובי')).toBe(false);
    expect(matchesQuery(LIST[0], 'קומת קרקע', 'קומת קרקע · שער')).toBe(true);
    expect(matchesQuery(withModel, 'ds-kd')).toBe(true);
    expect(matchesQuery(withModel, '   ')).toBe(true);
  });

  test('counts and the one-line subtitle, with Hebrew plural forms', () => {
    const t = tally(LIST);
    expect(t).toEqual({ total: 6, online: 5, active: 2, ringing: 1, doors: 6 }); // gate 1 + lobby 2 + park 0 (no integrated lock) + lab 1 + store 1 + mgmt 1
    expect(subtitleOf(t, he)).toBe('6 תחנות · 6 דלתות');
    expect(subtitleOf(tally([LIST[2]]), he)).toBe('תחנה אחת · 0 דלתות');
    expect(subtitleOf(tally([LIST[1]]), he)).toBe('תחנה אחת · 2 דלתות');
    expect(subtitleOf(tally([station('a', { locks: [{ physical_index: 1, name: null }] })]), he)).toBe('תחנה אחת · דלת אחת');
    expect(subtitleOf(tally([]), he)).toBe('אין תחנות');
    expect(plural('one', '{n} many', 1)).toBe('one');
    expect(plural('one', '{n} many', 3)).toBe('3 many');
  });

  test('a preposition that keeps its maqaf before a name that is not Hebrew', () => {
    expect(inPlace('לובי')).toBe('בלובי');
    expect(inPlace('Main gate')).toBe('ב־Main gate');
  });

  test('sync kinds map to the badge kinds', () => {
    expect(syncKind('synced')).toBe('live');
    expect(syncKind('pending')).toBe('stale');
    expect(syncKind('error')).toBe('error');
    expect(syncKind('offline')).toBe('offline');
    expect(syncKind('something-new')).toBe('unknown');
  });
});

test.describe('seen texts and the call clock', () => {
  test('relative words up to a day, then the station clock', () => {
    const at = (s: number) => new Date(NOW - s * 1000).toISOString();
    expect(seenText(at(10), NOW, null, he)).toBe('עכשיו');
    expect(seenText(at(60), NOW, null, he)).toBe('לפני דקה');
    expect(seenText(at(10 * 60), NOW, null, he)).toBe('לפני 10 דק׳');
    expect(seenText(at(3700), NOW, null, he)).toBe('לפני שעה');
    expect(seenText(at(5 * 3600), NOW, null, he)).toBe('לפני 5 שעות');
    expect(seenText('2026-10-11T16:02:00+00:00', NOW, ZONE, he)).toBe('לפני 16 שעות'); // inside a day it stays relative
    // 08:14 UTC is 11:14 in Jerusalem (UTC+3 on 12 Oct 2026): a stamp of more than a day ago from the previous local day reads "yesterday HH:MM" in the station's zone
    expect(seenText('2026-10-11T07:50:00+00:00', NOW, ZONE, he)).toBe('אתמול 10:50');
    expect(seenText('2026-10-05T16:02:00+00:00', NOW, ZONE, he)).toBe('05.10 19:02');
    expect(seenText(null, NOW, null, he)).toBe('טרם נראה');
    expect(seenText('not a date', NOW, null, he)).toBe('טרם נראה');
    expect(seenText('2026-10-11T16:02:00', NOW, null, he)).toBe('טרם נראה'); // no offset: not an instant
  });

  test('the feed age for the stale pill and the call clock reading', () => {
    expect(ageText(new Date(NOW - 20_000).toISOString(), NOW, he)).toBe('20 שנ׳');
    expect(ageText(new Date(NOW - 4 * 60_000).toISOString(), NOW, he)).toBe('4 דק׳');
    expect(ageText(new Date(NOW - 3 * 3600_000).toISOString(), NOW, he)).toBe('3 שעות');
    expect(ageText(null, NOW, he)).toBe('');
    expect(clockText(8)).toBe('00:08');
    expect(clockText(102)).toBe('01:42');
    expect(clockText(-5)).toBe('00:00');
  });

  test('the call clock counts from the first sight of a state and forgets a call that ended', () => {
    const c = new CallClock();
    c.observe([{ id: 'gate', online: true, call_state: 'ringing' }], 1_000);
    expect(c.active).toBe(true);
    expect(c.seconds('gate', 9_500)).toBe(8);
    // the same state again keeps its start
    c.observe([{ id: 'gate', online: true, call_state: 'ringing' }], 5_000);
    expect(c.seconds('gate', 9_500)).toBe(8);
    // answered: a new state restarts it
    c.observe([{ id: 'gate', online: true, call_state: 'in_call' }], 10_000);
    expect(c.seconds('gate', 12_000)).toBe(2);
    // an offline station has no call
    c.observe([{ id: 'gate', online: false, call_state: 'in_call' }], 13_000);
    expect(c.seconds('gate', 13_000)).toBeNull();
    expect(c.active).toBe(false);
  });
});

test.describe('places derived from Arx floors and areas', () => {
  const tree = {
    floors: [
      { floor_id: 'f0', name: 'קומת קרקע', areas: [{ area_id: 'a-lobby', name: 'לובי' }, { area_id: 'a-gate', name: 'שער ראשי' }, { area_id: 'a-park', name: 'חניון' }] },
      { floor_id: 'f1', name: 'קומה 1', areas: [{ area_id: 'a-lab', name: 'מעבדה' }] },
      { floor_id: 'none', name: 'ללא קומה', areas: [{ area_id: 'a-yard', name: 'חצר' }] },
    ],
  } as unknown as Parameters<typeof derivePlaces>[1];
  const rows = [
    { entity_id: 'camera.gate', area_id: 'a-gate' },
    { entity_id: 'camera.lobby', area_id: 'a-lobby' },
    { entity_id: 'camera.park', area_id: 'a-park' },
    { entity_id: 'camera.lab', area_id: 'a-lab' },
    { entity_id: 'camera.mgmt', area_id: 'a-yard' },
  ];
  const map = derivePlaces(LIST, tree, rows) as PlaceMap;

  test('a station is placed by the area of its camera entity; none placed means no map at all', () => {
    expect(map.byStation).toEqual({ gate: 'a-gate', lobby: 'a-lobby', park: 'a-park', lab: 'a-lab', mgmt: 'a-yard' });
    expect(derivePlaces(LIST, tree, [])).toBeNull();
    expect(derivePlaces(LIST, null, rows)).toBeNull();
    expect(derivePlaces(LIST, tree, null)).toBeNull();
    // an area the tree does not know (a camera in an area the caller may not see) places nothing
    expect(derivePlaces(LIST, tree, [{ entity_id: 'camera.gate', area_id: 'a-secret' }])).toBeNull();
  });

  test('the place label is "floor · area", just the area for an area without a floor, empty without a place', () => {
    expect(placeLabelOf('gate', map)).toBe('קומת קרקע · שער ראשי');
    expect(placeLabelOf('mgmt', map)).toBe('חצר');
    expect(placeLabelOf('store', map)).toBe('');
    expect(placeLabelOf('gate', null)).toBe('');
  });

  test('the tree rows: all, floors with their areas, the floor-less areas, and "no place"; a place with no station is omitted', () => {
    const r = placeRows(LIST, map, new Set(), he);
    expect(r.map((x) => `${x.kind}:${x.id}:${x.count}`)).toEqual([
      'all:all:6',
      'floor:floor:f0:3',
      'area:area:a-lobby:1',
      'area:area:a-gate:1',
      'area:area:a-park:1',
      'floor:floor:f1:1',
      'area:area:a-lab:1',
      'area:area:a-yard:1',
      'none:none:1',
    ]);
    expect(r[1].open).toBe(true);
    expect(r.find((x) => x.id === 'none')?.dot).toBe('off'); // the store is offline
    expect(r.find((x) => x.id === 'area:a-gate')?.dot).toBe('live');
    // a collapsed floor hides its areas but keeps its count
    const c = placeRows(LIST, map, new Set(['floor:f0']), he);
    expect(c.map((x) => x.id)).toEqual(['all', 'floor:f0', 'floor:f1', 'area:a-lab', 'area:a-yard', 'none']);
    expect(c[1].open).toBe(false);
    expect(c[1].count).toBe(3);
    // a scoped operator sees one station: only its place is listed
    const one = placeRows([LIST[0]], map, new Set(), he);
    expect(one.map((x) => x.id)).toEqual(['all', 'floor:f0', 'area:a-gate']);
    expect(placeRows(LIST, null, new Set(), he)).toEqual([]);
    expect(placeRows([], map, new Set(), he)).toEqual([]);
  });

  test('the place filter: all, a floor, an area, and "no place"', () => {
    const ids = (place: string) => LIST.filter((s) => inPlaceFilter(s.id, place, map)).map((s) => s.id);
    expect(ids('all')).toHaveLength(6);
    expect(ids('floor:f0')).toEqual(['gate', 'lobby', 'park']);
    expect(ids('area:a-lab')).toEqual(['lab']);
    expect(ids('none')).toEqual(['store']);
    expect(visibleStations(LIST, 'online', '', 'floor:f0', map).map((s) => s.id)).toEqual(['gate', 'lobby', 'park']);
    expect(visibleStations(LIST, 'in_call', 'שער', 'floor:f0', map).map((s) => s.id)).toEqual(['gate']);
    expect(visibleStations(LIST, 'all', '', 'floor:f0', null)).toHaveLength(6); // no map: the filter has nothing to filter by
  });
});

test.describe('the announcement choices and the speech estimate', () => {
  const online = LIST.filter((s) => s.online);
  const tree = { floors: [{ floor_id: 'f0', name: 'קומת קרקע', areas: [{ area_id: 'a1', name: 'כניסה' }] }] } as unknown as Parameters<typeof derivePlaces>[1];
  const map = derivePlaces(LIST, tree, [{ entity_id: 'camera.gate', area_id: 'a1' }, { entity_id: 'camera.lobby', area_id: 'a1' }, { entity_id: 'camera.park', area_id: 'a1' }]) as PlaceMap;

  test('inside the scope: each station, a place with more than one, and all of them; the preselected station first', () => {
    const c = announceChoices(online, map, 'scope', 'lobby', he);
    expect(c[0]).toMatchObject({ key: 'station:lobby', kind: 'station', label: 'לובי' });
    expect(c.filter((x) => x.kind === 'station')).toHaveLength(5);
    const place = c.filter((x) => x.kind === 'place').map((x) => x.label);
    expect(place).toEqual(['קומת קרקע (3)', 'כניסה (3)']);
    expect(c[c.length - 1]).toMatchObject({ key: 'all', label: 'כל התחנות (5)' });
    expect(c[c.length - 1].stationIds).toEqual(online.map((s) => s.id));
  });

  test('the administrator may narrow it to one station: no place, no "all"', () => {
    const c = announceChoices(online, map, 'station', 'gate', he);
    expect(c.map((x) => x.kind)).toEqual(['station', 'station', 'station', 'station', 'station']);
    expect(announceChoices([online[0]], map, 'scope', undefined, he).map((x) => x.kind)).toEqual(['station']); // one station: nothing wider to pick
    expect(announceChoices([], map, 'scope', undefined, he)).toEqual([]);
  });

  test('text length is counted as WisKey counts it, and the spoken time is a guess of at least a second', () => {
    expect(ttsLength('  שלום   עולם \n ')).toBe(9);
    expect(speechSeconds('')).toBe(1);
    expect(speechSeconds('נא להמתין, מישהו בדרך אליך')).toBe(2);
    expect(speechSeconds(Array(23).fill('מילה').join(' '))).toBe(10);
  });
});

test.describe('door settings are read only and never carry a code value', () => {
  /** A time range as the drawer prints it: a left-to-right isolate, so RTL never shows it reversed (CR-036 S12). */
  const L = (a: string, b: string) => `\u2066${a}–${b}\u2069`;

  test('a time range keeps its order inside a Hebrew line (left-to-right isolate)', () => {
    expect(ltrRange('07:00', '09:00')).toBe('\u206607:00–09:00\u2069');
    const line = weeklyLines({ Sunday: [{ start: '07:00', end: '09:00' }] }, he)[0];
    expect(line.indexOf('\u2066')).toBeLessThan(line.indexOf('07:00'));
    expect(line.indexOf('09:00')).toBeLessThan(line.indexOf('\u2069'));
  });

  test('weekly windows: consecutive days with the same hours are one range', () => {
    const w = { Sunday: [{ start: '08:00', end: '17:00' }], Monday: [{ start: '08:00', end: '17:00' }], Tuesday: [{ start: '08:00', end: '17:00' }], Wednesday: [{ start: '08:00', end: '17:00' }], Thursday: [{ start: '08:00', end: '17:00' }], Friday: [{ start: '08:00', end: '13:00' }], Saturday: [] };
    expect(weeklyLines(w, he)).toEqual([`א׳–ה׳ ${L('08:00', '17:00')}`, `ו׳ ${L('08:00', '13:00')}`]);
    expect(weeklyLines({ Sunday: [{ start: '00:00', end: '24:00' }], Monday: [{ start: '00:00', end: '24:00' }], Tuesday: [{ start: '00:00', end: '24:00' }], Wednesday: [{ start: '00:00', end: '24:00' }], Thursday: [{ start: '00:00', end: '24:00' }], Friday: [{ start: '00:00', end: '24:00' }], Saturday: [{ start: '00:00', end: '24:00' }] }, he)).toEqual([`כל הימים ${L('00:00', '24:00')}`]);
    expect(weeklyLines({ Saturday: [{ start: '09:00', end: '10:00' }, { start: '12:00', end: '13:00' }] }, he)).toEqual([`ש׳ ${L('09:00', '10:00')}, ${L('12:00', '13:00')}`]);
    expect(weeklyLines({}, he)).toEqual([]);
    expect(weeklyLines(null, he)).toEqual([]);
  });

  test('one row per relay; an unmapped policy is "unknown", a missing program is "no program"', () => {
    const programs = {
      programs: [
        { door: 1, revision: 3, enabled: true, removing: false, policy: { timezone: 'Asia/Jerusalem', name: 'x', weekly: { Sunday: [{ start: '08:00', end: '17:00' }] }, holidays: [{ name: 'h', start: null, end: null, periods: [] }] }, execution: { owned: true, attempted: null, status: 'held_acknowledged' }, error: null, checked_at: null },
        { door: 2, revision: 1, enabled: false, removing: true, policy: null, execution: { owned: false, attempted: null, status: 'brand_new' }, error: 'device_busy', checked_at: null },
      ],
      saved: [],
      timezone: null,
      native_supported: true,
    } as unknown as Parameters<typeof programViews>[0];
    const v = programViews(programs, LIST[1], he);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ door: 1, name: 'כניסה', none: false, enabled: true, status: 'פתוחה בהחזקה', hours: [`א׳ ${L('08:00', '17:00')}`], holidays: 1, error: false, unreadable: false });
    expect(v[1]).toMatchObject({ door: 2, name: 'מחסום', enabled: false, removing: true, status: 'לא ידוע', error: true, unreadable: true });
    const none = programViews(null, LIST[1], he);
    expect(none.every((r) => r.none)).toBe(true);
    expect(programViews(programs, LIST[2], he)).toEqual([]); // a station without an integrated lock has no relay rows
  });

  test('code presence: set / not set / unknown per slot - the summary has no field that could hold a value', () => {
    const s = codesSummary({ public_pin_state: 'configured', slots: [{ slot: 1, configured: true }, { slot: 2, configured: false }, { slot: 3, configured: null }], capabilities: { advertised: true, min: 4, max: 8 }, checked_at: null }, he);
    expect(s.state).toBe('set');
    expect(s.label).toBe('מוגדר');
    expect(s.slots.map((x) => x.state)).toEqual(['set', 'unset', 'unknown']);
    expect(Object.keys(s).sort()).toEqual(['label', 'slots', 'state']);
    expect(JSON.stringify(s)).not.toMatch(/\d{4}/);
    expect(codesSummary({ public_pin_state: 'absent', slots: [], capabilities: { advertised: null, min: null, max: null }, checked_at: null }, he).label).toBe('לא מוגדר');
    expect(codesSummary({ public_pin_state: 'unknown', slots: [], capabilities: { advertised: null, min: null, max: null }, checked_at: null }, he).label).toBe('לא ידוע');
    expect(codesSummary(null, he).state).toBe('unknown');
  });
});

test.describe('rights and the administrator\'s display policy', () => {
  const has = (...p: string[]) => (x: string) => p.includes(x);

  test('the door follows access.release; call, announcement and talk follow access.call (2.4.9); the talk button also the policy', () => {
    expect(rightsOf(has('access.read'), POLICY_DEFAULTS)).toEqual({ door: false, call: false, announce: false, talk: false });
    // owner decision 2026-10-13: the door grant alone no longer answers calls or announces (the server refuses it too)
    expect(rightsOf(has('access.read', 'access.release'), POLICY_DEFAULTS)).toEqual({ door: true, call: false, announce: false, talk: false });
    expect(rightsOf(has('access.read', 'access.call'), POLICY_DEFAULTS)).toEqual({ door: false, call: true, announce: true, talk: true });
    expect(rightsOf(has('access.release', 'access.call'), POLICY_DEFAULTS)).toEqual({ door: true, call: true, announce: true, talk: true });
    expect(rightsOf(has('access.call'), { ...POLICY_DEFAULTS, talk: 'hidden' }).talk).toBe(false);
    // the call rights are asked "anywhere a station can be" when the screen passes that check; the door at installation
    expect(rightsOf(has('access.read'), POLICY_DEFAULTS, has('access.call'))).toEqual({ door: false, call: true, announce: true, talk: true });
  });

  test('the defaults are the owner answers (everyone sees the call hint, talk in the classic panel, all stations inside the scope)', () => {
    expect(POLICY_DEFAULTS).toEqual({ callHint: 'everyone', talk: 'classic', announceScope: 'scope', phrases: [] });
    expect(parsePolicy(null)).toEqual(POLICY_DEFAULTS);
    expect(parsePolicy({})).toEqual(POLICY_DEFAULTS);
    expect(parsePolicy({ 'access.call_hint': 'garbage', 'access.talk_button': 7, 'access.announce_scope': null })).toEqual(POLICY_DEFAULTS);
  });

  test('each decision is changeable: the call hint, the talk button, the announcement scope and the quick phrases', () => {
    const p = parsePolicy({ 'access.call_hint': 'call', 'access.talk_button': 'hidden', 'access.announce_scope': 'station', 'access.announce_phrases': 'שלום\n\n  נא   להמתין  \n' + 'x'.repeat(161) });
    expect(p).toEqual({ callHint: 'call', talk: 'hidden', announceScope: 'station', phrases: ['שלום', 'נא להמתין'] });
    expect(parsePolicy({ 'access.announce_phrases': Array.from({ length: 12 }, (_, i) => `p${i}`).join('\n') }).phrases).toHaveLength(8);
    expect(showCallHint(POLICY_DEFAULTS, { door: false, call: false, announce: false, talk: false })).toBe(true);
    expect(showCallHint(p, { door: false, call: false, announce: false, talk: false })).toBe(false);
    expect(showCallHint(p, { door: true, call: true, announce: true, talk: false })).toBe(true);
    expect(phrasesOf(POLICY_DEFAULTS, he)).toEqual(he.announceDlg.phraseList);
    expect(phrasesOf(p, he)).toEqual(['שלום', 'נא להמתין']);
  });

  test('the classic panel link is a per-visit override of the entry center, not a setting', () => {
    expect(classicPanelHref()).toBe('#/wiskey/overview?classic=1');
  });

  test('each feed state has its own words, none names the platform', () => {
    for (const state of ['ha_not_configured', 'connecting', 'ha_unavailable', 'not_installed', 'forbidden', 'error', 'unsupported'] as const) {
      const p = feedPanel(state, he);
      expect(p.heading.length).toBeGreaterThan(3);
      expect(p.heading).not.toMatch(/wiskey|home assistant|hikvision|\bHA\b|add-on/i);
    }
    expect(feedPanel('not_installed', he).settings).toBe(true);
    expect(feedPanel('error', he).panel).toBe('error');
    expect(feedPanel('ha_unavailable', he).panel).toBe('stale');
  });
});

test.describe('the catalogues', () => {
  const walk = (o: unknown, path: string[] = [], out: [string, string][] = []): [string, string][] => {
    if (typeof o === 'string') out.push([path.join('.'), o]);
    else if (Array.isArray(o)) o.forEach((v, i) => walk(v, [...path, String(i)], out));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, [...path, k], out);
    return out;
  };
  const heStrings = walk(he);
  const enStrings = walk(enStationsText);

  test('Hebrew and English have the same keys and the same placeholders', () => {
    expect(enStrings.map(([k]) => k)).toEqual(heStrings.map(([k]) => k));
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (let i = 0; i < heStrings.length; i++) expect(vars(enStrings[i][1]), heStrings[i][0]).toEqual(vars(heStrings[i][1]));
  });

  test('operator copy never names the platform and never shows an internal code (UI_COPY_RULES)', () => {
    for (const [key, value] of [...heStrings, ...enStrings]) {
      expect(value, key).not.toMatch(/wiskey|home assistant|hikvision|ingress|supervisor|add-on|תוסף|\bHA\b|CR-\d|\bS\d{1,2}\b/i);
      expect(value, key).not.toMatch(/access\.[a-z]+/); // no permission id
    }
  });

  test('a sent door command is "sent", never "opened"', () => {
    for (const s of [he.door.sent, he.door.sentAt, enStationsText.door.sent, enStationsText.door.sentAt]) {
      expect(s).not.toMatch(/נפתח|נפתחה|opened/i);
    }
    expect(he.door.sentAt).toContain('פתיחה נשלחה');
    // and an announcement is "sent", never "played"
    expect(he.announceDlg.sentOne).not.toMatch(/הושמעה/);
    expect(fill(he.announceDlg.sentMany, { n: 3 })).toBe('ההכרזה נשלחה ל־3 תחנות · ההשמעה בעמדה לא מאומתת');
  });
});

// ---------------------------------------------------------------------------------------------------- the actions

class Harness {
  wall = 1_000_000;
  mono = 0;
  live = true;
  changes = 0;
  refetches = 0;
  releases: [string, number][] = [];
  signals: [string, string][] = [];
  next: { release?: () => Promise<unknown>; signal?: () => Promise<{ call: IntercomCallResult | null }> } = {};
  stations = new Map<string, AccessStation>(LIST.map((s) => [s.id, { ...s }]));
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();

  deps: ActionDeps = {
    release: (id, lock) => {
      this.releases.push([id, lock]);
      return (this.next.release ?? (() => Promise.resolve({ release: { accepted: true } })))();
    },
    signal: (id, command) => {
      this.signals.push([id, command]);
      return (this.next.signal ?? (() => Promise.resolve({ call: ack(command) })))();
    },
    station: (id) => this.stations.get(id),
    live: () => this.live,
    now: () => this.wall,
    tick: () => this.mono,
    after: (fn, ms) => {
      this.seq += 1;
      this.timers.set(this.seq, { at: this.wall + ms, fn });
      return this.seq;
    },
    cancel: (id) => {
      this.timers.delete(id);
    },
    changed: () => {
      this.changes += 1;
    },
    refetch: () => {
      this.refetches += 1;
    },
    stamp: () => '08:21',
  };
  actions = new StationActions(this.deps);

  advance(ms: number) {
    const end = this.wall + ms;
    for (;;) {
      const due = [...this.timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.wall = due[1].at;
      due[1].fn();
    }
    this.mono += ms;
    this.wall = end;
  }
}

const ack = (command: string, over: Partial<IntercomCallResult> = {}): IntercomCallResult => ({ command, acknowledged: true, physical_result: 'unverified', before_state: 'ringing', observed_state: 'in_call', observation: 'state_changed', checked_at: null, ...over });
const apiError = (status: number, code: string, details: Record<string, unknown> = {}) => new ApiError(status, { code, user_message: `msg ${code}`, retryable: false, correlation_id: '', details });

test.describe('door release', () => {
  test('ask, confirm, ONE request, and a result that says "sent" with the clock time', async () => {
    const h = new Harness();
    expect(h.actions.askRelease('lobby', 1)).toBe(true);
    expect(h.actions.confirm).toEqual({ stationId: 'lobby', lock: 1 });
    await h.actions.confirmRelease();
    expect(h.releases).toEqual([['lobby', 1]]);
    expect(h.actions.results.lobby).toMatchObject({ tone: 'ok', text: 'פתיחה נשלחה · הפקודה התקבלה · 08:21' });
    expect(h.actions.confirm).toBeNull();
    expect(h.actions.releasing.size).toBe(0);
  });

  test('confirming twice while the first is on its way sends once; with no confirmation step nothing is sent', async () => {
    const h = new Harness();
    let finish!: () => void;
    h.next.release = () => new Promise((r) => (finish = () => r({})));
    h.actions.askRelease('lobby', 1);
    const first = h.actions.confirmRelease();
    const second = h.actions.confirmRelease();
    expect(h.actions.releasing.has('lobby/1')).toBe(true);
    finish();
    await Promise.all([first, second]);
    expect(h.releases).toHaveLength(1);
    await h.actions.confirmRelease(); // the step is gone: nothing
    expect(h.releases).toHaveLength(1);
  });

  test('a structured "not sent" is a plain failure with the server\'s words, no hold, and never retried', async () => {
    const h = new Harness();
    h.next.release = () => Promise.reject(apiError(409, 'intercom_station_offline', { outcome: 'not_sent' }));
    h.actions.askRelease('gate', 1);
    await h.actions.confirmRelease();
    expect(h.releases).toHaveLength(1);
    expect(h.actions.results.gate).toMatchObject({ tone: 'err', text: 'msg intercom_station_offline' });
    expect(h.actions.isHeld('gate/1')).toBe(false);
    h.advance(120_000);
    expect(h.releases).toHaveLength(1); // nothing ever retries
  });

  test('an unknown outcome (a dropped connection, a bare 502) is amber, holds the relay as long as the backend says, and is never retried', async () => {
    const h = new Harness();
    h.next.release = () => Promise.reject(apiError(504, 'door_outcome_unknown', { outcome: 'unknown', retry_after_s: 12.3 }));
    h.actions.askRelease('gate', 1);
    await h.actions.confirmRelease();
    expect(h.actions.results.gate.tone).toBe('warn');
    expect(h.actions.results.gate.text).toBe(he.door.unknown);
    expect(h.actions.isHeld('gate/1')).toBe(true);
    expect(h.actions.askRelease('gate', 1)).toBe(false); // the button waits
    expect(h.actions.askRelease('gate', 2)).toBe(true); // another relay is not held
    h.actions.cancelRelease();
    h.advance(13_000);
    expect(h.actions.isHeld('gate/1')).toBe(false);
    expect(h.actions.askRelease('gate', 1)).toBe(true);
    expect(h.releases).toHaveLength(1);
    // a plain TypeError (no answer at all) is unknown too, and holds for the longest the backend can
    const g = new Harness();
    g.next.release = () => Promise.reject(new TypeError('network'));
    g.actions.askRelease('lobby', 2);
    await g.actions.confirmRelease();
    expect(g.actions.results.lobby.tone).toBe('warn');
    expect(g.actions.askRelease('lobby', 2)).toBe(false);
    g.advance(UNKNOWN_HOLD_FALLBACK_MS - 1_000);
    expect(g.actions.isHeld('lobby/2')).toBe(true);
    g.advance(2_000);
    expect(g.actions.isHeld('lobby/2')).toBe(false);
  });

  test('"a release of this relay is still unresolved" holds the button for the time the backend names', async () => {
    const h = new Harness();
    h.next.release = () => Promise.reject(apiError(409, 'intercom_release_in_progress', { outcome: 'not_sent', retry_after_s: 8 }));
    h.actions.askRelease('lobby', 1);
    await h.actions.confirmRelease();
    expect(h.actions.results.lobby.tone).toBe('err');
    expect(h.actions.isHeld('lobby/1')).toBe(true);
    h.advance(8_100);
    expect(h.actions.isHeld('lobby/1')).toBe(false);
    expect(holdMs(apiError(409, 'x', { retry_after_s: 2.2 }))).toBe(2_200);
    expect(holdMs(new Error('x'))).toBe(UNKNOWN_HOLD_FALLBACK_MS);
  });

  test('a last-known copy is for reading: nothing physical is asked or sent', async () => {
    const h = new Harness();
    h.live = false;
    expect(h.actions.askRelease('lobby', 1)).toBe(false);
    h.live = true;
    h.actions.askRelease('lobby', 1);
    h.live = false;
    await h.actions.confirmRelease();
    expect(h.releases).toHaveLength(0);
    h.actions.tapCall('gate', 'answer');
    expect(h.actions.armed).toBeNull();
  });

  test('failure(): only a structured not_sent / refused is a plain failure', () => {
    expect(failure(apiError(409, 'x', { outcome: 'refused' })).unknown).toBe(false);
    expect(failure(apiError(403, 'forbidden')).unknown).toBe(false); // the permission check's own refusal means nothing happened
    expect(failure(apiError(502, 'http_502')).unknown).toBe(true);
    expect(failure(new TypeError('x')).tone).toBe('warn');
  });
});

test.describe('call controls: two taps', () => {
  test('the first tap arms, a second tap after the gap sends once, and the stations are read again', async () => {
    const h = new Harness();
    h.actions.tapCall('gate', 'answer');
    expect(h.actions.armed).toMatchObject({ id: 'gate', command: 'answer', callState: 'ringing' });
    expect(h.signals).toHaveLength(0);
    h.advance(ARM_MIN_MS + 10);
    h.actions.tapCall('gate', 'answer');
    await Promise.resolve();
    await Promise.resolve();
    expect(h.signals).toEqual([['gate', 'answer']]);
    expect(h.actions.armed).toBeNull();
    expect(h.refetches).toBe(1);
    expect(h.actions.results.gate.tone).toBe('ok');
    expect(h.actions.results.gate.text).toContain('מענה נשלח');
    expect(h.actions.results.gate.text).toContain('העמדה אישרה קבלה');
  });

  test('a double-click, a tap sooner than the gap, and another command never send', () => {
    const h = new Harness();
    h.actions.tapCall('gate', 'answer', 2); // the second click of one double-click
    expect(h.actions.armed).toBeNull();
    h.actions.tapCall('gate', 'answer');
    h.advance(ARM_MIN_MS - 100);
    h.actions.tapCall('gate', 'answer'); // too quick to be a deliberate second tap
    expect(h.signals).toHaveLength(0);
    expect(h.actions.armed).not.toBeNull();
    h.actions.tapCall('gate', 'reject'); // another command re-arms instead of sending
    expect(h.signals).toHaveLength(0);
    expect(h.actions.armed?.command).toBe('reject');
  });

  test('an arm runs out after ARM_MS and is dropped when the call changed', () => {
    const h = new Harness();
    h.actions.tapCall('gate', 'answer');
    h.advance(ARM_MS + 10);
    expect(h.actions.armed).toBeNull();
    h.actions.tapCall('gate', 'answer');
    h.stations.set('gate', { ...LIST[0], call_state: 'idle' }); // answered elsewhere
    h.actions.dropStaleArm();
    expect(h.actions.armed).toBeNull();
    h.actions.tapCall('lab', 'hangUp');
    h.stations.set('lab', { ...LIST[3], online: false });
    h.actions.dropStaleArm();
    expect(h.actions.armed).toBeNull();
    expect(h.signals).toHaveLength(0);
  });

  test('a failed signal says what is known; an unacknowledged one is amber; nothing is retried', async () => {
    const h = new Harness();
    h.next.signal = () => Promise.reject(new TypeError('network'));
    h.actions.tapCall('gate', 'reject');
    h.advance(ARM_MIN_MS + 10);
    h.actions.tapCall('gate', 'reject');
    await Promise.resolve();
    await Promise.resolve();
    expect(h.signals).toHaveLength(1);
    expect(h.actions.results.gate.tone).toBe('warn');
    h.advance(60_000);
    expect(h.signals).toHaveLength(1);
    expect(callText(ack('hangUp', { acknowledged: null, observation: 'unchanged', observed_state: 'in_call' }), he)).toBe('סיום נשלח · לא התקבל אישור קבלה מהעמדה · מצב אחרי הפקודה: בשיחה (לא השתנה)');
    expect(callText(ack('answer', { observation: 'unavailable', observed_state: null }), he)).toBe('מענה נשלח · העמדה אישרה קבלה · מצב השיחה אחרי הפקודה לא נקרא');
  });

  test('an outcome line does not stay on its station for good: a plain one goes after a short while, an unknown one later', () => {
    const h = new Harness();
    h.actions.setResult('gate', 'ok', 'a');
    h.actions.setResult('lobby', 'warn', 'b');
    h.actions.setResult('lab', 'err', 'c');
    h.advance(RESULT_TTL_MS - 1_000);
    h.actions.prune();
    expect(Object.keys(h.actions.results).sort()).toEqual(['gate', 'lab', 'lobby']);
    h.advance(2_000);
    h.actions.prune();
    expect(Object.keys(h.actions.results)).toEqual(['lobby']); // the amber one still says something may have happened
    h.advance(RESULT_UNKNOWN_TTL_MS);
    h.actions.prune();
    expect(h.actions.results).toEqual({});
  });

  test('announcement progress never steps back from a later state', () => {
    const h = new Harness();
    const st = (state: IntercomTtsStatus['state'], at: string): IntercomTtsStatus => ({ station_id: 'gate', state, reason: null, physical_result: null, at });
    h.actions.noteTts(st('speaking', '2026-10-12T08:00:05Z'));
    h.actions.noteTts(st('started', '2026-10-12T08:00:05Z')); // a reply arriving after the notice
    expect(h.actions.tts.gate.state).toBe('speaking');
    h.actions.noteTts(st('completed', '2026-10-12T08:00:09Z'));
    expect(h.actions.tts.gate.state).toBe('completed');
    h.actions.noteTts(st('started', '2026-10-12T08:01:00Z')); // a newer announcement starts over
    expect(h.actions.tts.gate.state).toBe('started');
  });
});

test.describe('the announcement write (the function S11 binds)', () => {
  const reply = (state: IntercomTtsStatus['state']) => ({ tts: { station_id: 'x', state, reason: null, physical_result: null, at: '2026-10-12T08:00:00Z' } }) as never;

  test('one request per station, in order, once each; a failure at one never stops or repeats the rest', async () => {
    const calls: string[] = [];
    const speak = ((id: string) => {
      calls.push(id);
      if (id === 'b') return Promise.reject(apiError(409, 'intercom_station_offline', { outcome: 'not_sent' }));
      if (id === 'c') return Promise.reject(apiError(409, 'tts_refused', { outcome: 'refused', wiskey_code: 'audio_busy', retry_after_s: 12 }));
      if (id === 'd') return Promise.reject(new TypeError('network'));
      return Promise.resolve(reply('started'));
    }) as never;
    const out = await announceToStations({ stationIds: ['a', 'b', 'c', 'd', 'e'], engine_id: 'tts.local', language: 'he', message: 'שלום' }, speak);
    expect(calls).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(out.map((o) => `${o.station_id}:${o.outcome}`)).toEqual(['a:sent', 'b:not_sent', 'c:refused', 'd:unknown', 'e:sent']);
    expect(out[0].status?.state).toBe('started');
    expect(out[1]).toMatchObject({ error: 'msg intercom_station_offline', code: 'intercom_station_offline', retry_after_s: null });
    expect(out[2]).toMatchObject({ code: 'audio_busy', retry_after_s: 12 });
    expect(out[3]).toMatchObject({ error: null, code: null });
  });

  test('stations are asked one after the other, never in parallel', async () => {
    let open = 0;
    let peak = 0;
    const speak = (() => {
      open += 1;
      peak = Math.max(peak, open);
      return new Promise((r) => setTimeout(() => ((open -= 1), r(reply('started'))), 5));
    }) as never;
    await announceToStations({ stationIds: ['a', 'b', 'c'], engine_id: 'e', language: null, message: 'm' }, speak);
    expect(peak).toBe(1);
  });
});
