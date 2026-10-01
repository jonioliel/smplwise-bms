import { test, expect } from '@playwright/test';
// the client first, then the mock: the order that forces the client -> mock -> client cycle (see unit-media-players.spec.ts)
import { PLAYER_KINDS, GROUPABLE_KINDS, type PlayerDevice } from '../src/api/media-players';
import { resetPlayersMock, type PlayersMockStore } from '../src/api/media-players-mock';
import { moveInGroup, setCard, setGroupBy, togglePin, isDirty } from '../src/screens/multimedia-layout';
import {
  EMPTY_TAB, NEW_PRESET, NOFLOOR_ID, PLAYER_NO_FILTER, UNPLACED_ID, asLayoutDevices, capPercent, editPlayerGroups, filterPlayers, groupTypeOf, installationHasFloors, isFloorSection,
  matchesPlayerFilters, parseCeiling, parseNight, playerCounts, playerFiltersFromParams, playerFiltersToParams, playerFloors, presetCandidates, presetDraftError, presetFloors,
  presetIsLive, presetRooms, presetVolumes, resolvePlayerGroups, splitGroups, summarizeRecord, tabIsDefault, tabOf, tabView, withTabView, type TabbedLayout,
} from '../src/screens/multimedia-players-layout';
import { leaderName, playerView } from '../src/components/media-player-now';
import { MULTIMEDIA_TABS, applyMultimediaKinds, isMultimediaEditRoute, visibleTabs } from '../src/shell/nav';
import { EMPTY_LAYOUT } from '../src/api/media-screens';

// CR-016 S2: the pure logic of the players page, the groups page and the settings sections - no browser page
// (docs/architecture/MEDIA_PLAYERS_API.md §5 "S2"). The data is the S0 mock's two houses (with and without a music library).

const key = (id: string) => `mp-${id}`;
const players = async (m: PlayersMockStore): Promise<PlayerDevice[]> => (await m.list({ kind: GROUPABLE_KINDS })).devices;
const doc = (tabs?: TabbedLayout['tabs']): TabbedLayout => ({ ...EMPTY_LAYOUT, floor_order: ['g', 'u1', 'b'], ...(tabs ? { tabs } : {}) });
const ids = (g: { devices: PlayerDevice[] }) => g.devices.map((d) => d.key.slice(3));

test.describe('players page: filters', () => {
  test('floor, room, state and search compose; "ללא חדר" and "לא משויכים" are the unplaced; the address round-trips', async () => {
    const ds = await players(resetPlayersMock('ma'));
    expect(ds).toHaveLength(16);
    expect(filterPlayers(ds, PLAYER_NO_FILTER)).toHaveLength(16);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, floor: 'b' }).map((d) => d.key.slice(3)).sort()).toEqual(['bamp', 'gym']);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, area: UNPLACED_ID }).map((d) => d.key.slice(3)).sort()).toEqual(['balc', 'bath', 'ter']);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, floor: UNPLACED_ID }).map((d) => d.key.slice(3)).sort()).toEqual(['balc', 'bath', 'ter']);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, state: 'playing' }).map((d) => d.key.slice(3)).sort()).toEqual(['hal', 'kit', 'liv', 'pat', 'per', 'stu', 'ter']);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, state: 'unavailable' }).map((d) => d.key.slice(3)).sort()).toEqual(['bath', 'gym']);
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, q: ' פרגולה ' }).map((d) => d.key)).toEqual([key('per')]); // name or room
    expect(filterPlayers(ds, { ...PLAYER_NO_FILTER, q: 'מרתף' }).map((d) => d.key.slice(3)).sort()).toEqual(['bamp', 'gym']); // the floor's name counts too
    expect(matchesPlayerFilters(ds.find((d) => d.key === key('liv'))!, { ...PLAYER_NO_FILTER, floor: 'g', area: 'living', state: 'playing', q: 'סלון' })).toBe(true);
    const f = { floor: 'u1', area: 'kids', q: 'נגן', state: 'off' as const };
    expect(playerFiltersFromParams(playerFiltersToParams(f, new URLSearchParams('player=mp-liv')))).toEqual(f);
    expect(playerFiltersToParams(PLAYER_NO_FILTER, new URLSearchParams('player=x&floor=g&state=off')).toString()).toBe('player=x');
    expect(playerFiltersFromParams(new URLSearchParams('state=bogus')).state).toBe('');
  });

  test('counts and the floor menu: floors in the layout order, the unplaced counted apart, rooms without a floor in an "ללא קומה" row', async () => {
    const ds = await players(resetPlayersMock('ma'));
    expect(playerCounts(ds)).toEqual({ total: 16, playing: 7, unavailable: 2 });
    const { floors, unplaced } = playerFloors(ds, ['b', 'g', 'u1']);
    expect(floors.map((f) => [f.id, f.count])).toEqual([['b', 2], ['g', 7], ['u1', 4]]);
    expect(unplaced).toBe(3);
    const mixed = [...ds, { ...ds[0], key: 'mp-x', floor_id: null, floor_name: null, area_id: 'x', area_name: 'חדר X' }];
    expect(playerFloors(mixed, ['g']).floors.at(-1)).toMatchObject({ id: NOFLOOR_ID, name: 'ללא קומה', count: 1 });
    expect(filterPlayers(mixed, { ...PLAYER_NO_FILTER, floor: NOFLOOR_ID }).map((d) => d.key)).toEqual(['mp-x']);
    expect(installationHasFloors({ floors: false }, ds)).toBe(false); // the server's word wins
    expect(installationHasFloors(null, ds)).toBe(true);
  });
});

test.describe('players page: sections', () => {
  test('the house with floors: floors in order, "לא משויכים" always last, hidden cards dropped, the order and "מועדפים" honoured', async () => {
    const ds = await players(resetPlayersMock('ma'));
    const g = resolvePlayerGroups(ds, tabView(doc(), 'players', ['g', 'u1', 'b']), { floors: true });
    expect(g.map((x) => [x.id, x.label])).toEqual([['g', 'קומת קרקע'], ['u1', 'קומה 1'], ['b', 'מרתף'], [UNPLACED_ID, 'לא משויכים']]);
    expect(ids(g[3]).sort()).toEqual(['balc', 'bath', 'ter']);
    expect(g.flatMap((x) => x.devices)).toHaveLength(16);
    // an order, a pinned row and a hidden card
    const t: TabbedLayout['tabs'] = { players: { group_by: 'floor', order: [key('pat'), key('hal')], pinned: [key('per')], cards: { [key('off')]: { on: false } } } };
    const g2 = resolvePlayerGroups(ds, tabView(doc(t), 'players', ['g', 'u1', 'b']), { floors: true });
    expect(g2[0]).toMatchObject({ id: 'pinned', label: 'מועדפים' });
    expect(ids(g2[0])).toEqual(['per']);
    expect(ids(g2.find((x) => x.id === 'g')!).slice(0, 2)).toEqual(['pat', 'hal']);
    expect(g2.flatMap((x) => x.devices).some((d) => d.key === key('off'))).toBe(false); // hidden
    expect(g2.filter((x) => x.id !== 'pinned').flatMap((x) => x.devices).some((d) => d.key === key('per'))).toBe(false); // pinned leaves its floor
    expect(g2.at(-1)!.id).toBe(UNPLACED_ID);
  });

  test('an installation without floors: ONE list "כל החדרים" and the unplaced section; group by room; one flat list', async () => {
    const ds = await players(resetPlayersMock('sonos'));
    expect(ds.every((d) => d.floor_id === null)).toBe(true);
    const g = resolvePlayerGroups(ds, tabView(doc(), 'players'), { floors: false });
    expect(g.map((x) => [x.id, x.label, x.devices.length])).toEqual([['all', 'כל החדרים', 5], [UNPLACED_ID, 'לא משויכים', 1]]);
    expect(isFloorSection(g[0], 'floor', false)).toBe(false); // no floor pause without floors
    const byArea = resolvePlayerGroups(ds, { ...tabView(doc(), 'players'), group_by: 'area' }, { floors: false });
    expect(byArea.map((x) => x.label)).toEqual(['סלון', 'מטבח', 'חדר שינה', 'חדר עבודה', 'מרפסת', 'לא משויכים']); // the server's order, the unplaced last
    expect(byArea.at(-1)!.label).toBe('לא משויכים');
    const flat = resolvePlayerGroups(ds, { ...tabView(doc(), 'players'), group_by: 'none' }, { floors: false });
    expect(flat.map((x) => [x.id, x.devices.length])).toEqual([['all', 6]]);
  });

  test('a floor section may offer "עצור מוזיקה"; a room, the unplaced bucket and a free list never do', async () => {
    expect(isFloorSection({ id: 'g' }, 'floor', true)).toBe(true);
    for (const id of ['pinned', 'all', UNPLACED_ID, NOFLOOR_ID]) expect(isFloorSection({ id }, 'floor', true)).toBe(false);
    expect(isFloorSection({ id: 'g' }, 'area', true)).toBe(false);
  });

  test('the editor: the CR-015 operations work on the tab view, the document keeps the rest of the layout', async () => {
    const ds = await players(resetPlayersMock('ma'));
    const base = doc();
    const view = tabView(base, 'players', ['g', 'u1', 'b']);
    let next = moveInGroup(view, asLayoutDevices(ds), key('hal'), -1);
    expect(isDirty(view, next)).toBe(true);
    next = togglePin(setCard(next, key('off'), { on: false }), key('per'));
    next = setGroupBy(next, 'area');
    const out = withTabView({ ...base, pinned: ['md-living'], order: ['md-living'] }, 'players', next);
    expect(out.pinned).toEqual(['md-living']); // the screens' own part is untouched
    expect(out.order).toEqual(['md-living']);
    const t = tabOf(out, 'players');
    expect(t.group_by).toBe('area');
    expect(t.pinned).toEqual([key('per')]);
    expect(t.cards).toEqual({ [key('off')]: { on: false } }); // only hidden cards are stored
    expect(t.order).toContain(key('hal'));
    // the round trip through the view is stable
    expect(tabOf(withTabView(out, 'players', tabView(out, 'players')), 'players')).toEqual(t);
    expect(tabOf(out, 'groups')).toEqual(EMPTY_TAB);
    expect(tabIsDefault(EMPTY_TAB)).toBe(true);
    // the edit list shows hidden cards too
    const all = editPlayerGroups(ds, tabView(out, 'players'), { floors: true });
    expect(all.flatMap((g) => g.devices).some((d) => d.key === key('off'))).toBe(true);
  });
});

test.describe('groups page', () => {
  test('groups split into live, static and helper shortcuts; a saved group is "פועל" only when its rooms are exactly the live group', async () => {
    const m = resetPlayersMock('ma');
    const ds = (await m.list()).devices;
    const { live, static: stat, helpers } = splitGroups(await m.groups(), ds);
    expect(live.map((g) => g.leader_key).sort()).toEqual([key('liv'), key('stu')]);
    expect(stat.map((g) => g.leader_key)).toEqual([key('sgrp')]);
    expect(helpers).toEqual([]);
    const by = new Map(ds.map((d) => [d.key, d]));
    expect(groupTypeOf({ static: true, leader_key: 'mp-vg5' }, by)).toBe('helper');
    const presets = await m.presets();
    const lk = presets.find((p) => p.name === 'סלון + מטבח')!;
    expect(presetIsLive(lk, ds)).toBe(true);
    expect(presetIsLive(presets.find((p) => p.name === 'קומת קרקע')!, ds)).toBe(false); // one room more than the live group
    expect(presetRooms(lk, ds).map((r) => r.room)).toEqual(['סלון', 'מטבח']);
    expect(presetFloors(presets.find((p) => p.name === 'מסיבה')!, ds)).toBe(2);
    const s = splitGroups(await resetPlayersMock('sonos').groups(), (await resetPlayersMock('sonos').list()).devices);
    expect(s.helpers.map((g) => g.name)).toEqual(['קבוצת עזר · 5 רמקולים']);
  });

  test('a run is read by room: who joined, who did not, by name', async () => {
    const m = resetPlayersMock('ma');
    m.refuseJoin.add(key('per'));
    const preview = await m.applyPreset((await m.presets()).find((p) => p.name === 'קומת קרקע')!.id, { confirmed: true, client_request_id: 'rq-1-aaaaaaaa', expires_at: '' }).catch(() => null);
    expect(preview).not.toBeNull();
    const rec = await m.groupRecord(preview!.bulk_id);
    const sum = summarizeRecord(rec);
    expect(sum.done).toBe(true);
    expect(sum.failed.map((f) => f.room)).toEqual(['פרגולה']);
    expect(sum.ok.map((f) => f.room).sort()).toEqual(['מטבח', 'סלון']);
    expect(summarizeRecord(null)).toEqual({ done: false, failed: [], ok: [] });
  });

  test('the editor of a saved group: what stops a save, the layer rule, the volumes of removed rooms go away', async () => {
    expect(presetDraftError(NEW_PRESET)).toBe('חסר שם');
    expect(presetDraftError({ name: 'x'.repeat(41), leader_key: 'a', member_keys: ['a', 'b'] })).toContain('40');
    expect(presetDraftError({ name: 'ערב', leader_key: 'a', member_keys: ['a'] })).toBe('בחרו לפחות שני חדרים');
    expect(presetDraftError({ name: 'ערב', leader_key: '', member_keys: ['a', 'b'] })).toBe('בחרו מוביל');
    expect(presetDraftError({ name: 'ערב', leader_key: 'a', member_keys: Array.from({ length: 17 }, (_, i) => `k${i}`) })).toContain('16');
    expect(presetDraftError({ name: 'ערב', leader_key: 'a', member_keys: ['a', 'b'] })).toBeNull();
    const ds = await players(resetPlayersMock('ma'));
    const none = presetCandidates(ds, []);
    expect(none.every((c) => !c.disabled)).toBe(true);
    expect(none.map((c) => c.device.kind).every((k) => GROUPABLE_KINDS.includes(k))).toBe(true);
    expect(none.some((c) => c.device.key === key('ampl'))).toBe(false); // the receivers have no live grouping in this house
    const pick = presetCandidates(ds, [key('liv')]);
    expect(pick.filter((c) => c.disabled)).toHaveLength(0); // every grouping speaker of the house answers through the same layer
    const sonos = presetCandidates(await players(resetPlayersMock('sonos')), [key('liv')]);
    expect(sonos).toHaveLength(6);
    expect(presetVolumes({ leader_key: 'a', member_keys: ['a', 'b'], volumes: { a: 10, c: 40 } })).toEqual({ a: 10 });
    expect(presetVolumes({ leader_key: 'a', member_keys: ['a'], volumes: { z: 5 } })).toBeNull();
    expect(PLAYER_KINDS).toContain('group');
  });
});

test.describe('settings: parsers', () => {
  test('the volume ceiling is empty (none) by default and never defaults; invalid input is refused', () => {
    expect(parseCeiling('')).toBeNull();
    expect(parseCeiling('  ')).toBeNull();
    expect(parseCeiling('55')).toBe(55);
    expect(parseCeiling('55.4')).toBe(55);
    expect(parseCeiling('101')).toBe('invalid');
    expect(parseCeiling('-1')).toBe('invalid');
    expect(parseCeiling('abc')).toBe('invalid');
    expect(capPercent(null)).toBeNull();
    expect(capPercent(70)).toBe(70);
  });

  test('the night window: from, to and its ceiling', () => {
    expect(parseNight('22:00', '07:00', '25')).toEqual({ from: '22:00', to: '07:00', max: 25 });
    expect(parseNight('22:00', '22:00', '25')).toBeNull(); // from == to is no window
    expect(parseNight('22:00', '07:00', '')).toBeNull(); // a window needs its ceiling
    expect(parseNight('25:00', '07:00', '20')).toBeNull();
    expect(parseNight('', '07:00', '20')).toBeNull();
  });
});

test.describe('the player card reads its state', () => {
  test('playing, paused, a station, a member, idle, off, unavailable and a receiver', async () => {
    const ds = await players(resetPlayersMock('ma'));
    const d = (id: string) => ds.find((x) => x.key === key(id))!;
    const liv = playerView(d('liv'));
    expect(liv).toMatchObject({ kind: 'music', title: 'Blue in Green', sub: 'Miles Davis', playing: true, line: 'מנגן' });
    expect(liv.prog).toBeGreaterThan(0.5);
    expect(playerView(d('par'))).toMatchObject({ kind: 'music', paused: true, playing: false, line: 'מושהה' });
    expect(playerView(d('per'))).toMatchObject({ kind: 'station', title: 'גלגלצ', sub: '', prog: null, line: 'תחנה' });
    const kit = playerView(d('kit'), d('liv'));
    expect(kit).toMatchObject({ kind: 'music', title: '', playing: true, line: 'מנגן עם סלון' }); // a member: no title of its own
    expect(leaderName(d('kit'), d('liv'))).toBe('סלון');
    expect(leaderName(d('liv'), null)).toBeNull();
    expect(playerView(d('gst'))).toMatchObject({ kind: 'idle', line: 'לא מנגן' });
    expect(playerView(d('off'))).toMatchObject({ kind: 'off', line: 'כבוי', glyph: 'power' });
    expect(playerView(d('gym'))).toMatchObject({ kind: 'un' });
    expect(playerView(d('gym')).line).toMatch(/^לא זמין מאז \d\d:\d\d$/);
    expect(playerView(d('ampl'))).toMatchObject({ kind: 'rcv', tile: 'טלוויזיה', line: 'טלוויזיה · HDMI 2 · סטריאו' });
    // a degraded entity keeps its last mask but is never "without capabilities": caps_known false, the card says unavailable
    expect(d('gym').live.caps_known).toBe(false);
    expect(d('gym').caps.volume_set).toBe(true);
    expect(d('bath').caps.volume_set).toBe(false); // a restored entity that never reported a mask: nothing is known
  });
});

test.describe('navigation: the tab row follows what the installation has', () => {
  test('players appear with a player, groups with a group or two players; the counts follow; nothing flashes before the status is known', () => {
    applyMultimediaKinds(null);
    const labels = () => visibleTabs(MULTIMEDIA_TABS, true).map((t) => t.id);
    expect(labels()).toEqual(['screens']);
    expect(applyMultimediaKinds({ screens: 4, players: 12, groups: 3 })).toEqual({ players: true, groups: true });
    expect(labels()).toEqual(['screens', 'players', 'groups']);
    expect(MULTIMEDIA_TABS.map((t) => t.count)).toEqual([4, 12, undefined]);
    expect(applyMultimediaKinds({ screens: 4, players: 1, groups: 0 })).toEqual({ players: true, groups: false });
    expect(labels()).toEqual(['screens', 'players']);
    expect(applyMultimediaKinds({ screens: 0, players: 0, groups: 0 })).toEqual({ players: false, groups: false });
    expect(labels()).toEqual(['screens']);
    expect(applyMultimediaKinds({ screens: 2, players: 2, groups: 0 }).groups).toBe(true); // two players could form a group
    applyMultimediaKinds(null);
  });

  test('the editors of the three pages hide the tab row', () => {
    const r = (path: string) => ({ path, segments: path.split('?')[0].split('/').filter(Boolean), params: new URLSearchParams(path.split('?')[1] ?? ''), mode: 'multimedia' as const });
    expect(isMultimediaEditRoute(r('/multimedia/players?edit=1'))).toBe(true);
    expect(isMultimediaEditRoute(r('/multimedia/groups?edit=1'))).toBe(true);
    expect(isMultimediaEditRoute(r('/multimedia/screens?edit=1'))).toBe(true);
    expect(isMultimediaEditRoute(r('/multimedia/players'))).toBe(false);
  });
});
