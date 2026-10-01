import { test, expect } from '@playwright/test';
import {
  GROUP_VOLUME_RATE_PER_S, JOIN_BATCH_MS, JoinDraft, PLAYER_ERROR_LABEL, applyCuration, clampVolume, confirmPreview, effectiveCeiling, groupCandidates, groupChip, groupLevel,
  groupSectionOffered, groupVolumePlan, httpPlayers, inNightWindow, interpolatePosition, isPlaying, joinDiff, leaderLabel, libraryTabs, liveGroupKeys, matchesState,
  memberOutcomeLine, needsConfirmation, nextRepeat, playerCommandOffered, playerErrorText, playerSections, playerStateText, players, powerControlled, resolveLeader, roomChips, unplacedBucket,
  upNextMore, upNextText, type PlanMember, type PlayerDevice, type UpNext,
} from '../src/api/media-players';
import { playersMock, resetPlayersMock, type PlayersMockStore } from '../src/api/media-players-mock';
import { ApiError } from '../src/api/client';

// CR-016 S0: the typed client's pure helpers, the MOCK adapter (two fixture houses) and the error mapping
// (docs/architecture/MEDIA_PLAYERS_API.md). No browser page. This spec imports the client first, then the mock: the order that
// forces the client -> mock -> client cycle (the mock must not read a client value while it loads).

const req = (n: number) => ({ client_request_id: `req-${n}-abcdefgh`, expires_at: new Date(Date.now() + 15000).toISOString() });
const key = (id: string) => `mp-${id}`;
const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);
const dev = async (m: PlayersMockStore, id: string) => m.get(key(id));
const refs = async (m: PlayersMockStore, id: string, kind: 'favourites' | 'stations' | 'playlists') => (await m.library(key(id), kind)).items;
const code = async (p: Promise<unknown>): Promise<string | null> => {
  try { await p; return null; } catch (e) { return e instanceof ApiError ? e.code : `other:${String(e)}`; }
};

/** A plan member from a few fields. */
const pm = (k: string, vol: number | null, over: Partial<PlanMember> & { power?: PlanMember['live']['power']; muted?: boolean } = {}): PlanMember => ({
  key: k, volume_max: null, volume_night: null, can: { control: true }, ...over,
  live: { power: over.power ?? 'on', volume: { level: vol, muted: over.muted ?? false } },
});

test.describe('media-players client: the house with a music library (mock)', () => {
  test('lists one card per physical device with floors, areas and the unplaced bucket; non-physical kinds stay out', async () => {
    const m = resetPlayersMock('ma');
    const { devices } = await m.list();
    expect(devices).toHaveLength(17);
    expect(new Set(devices.map((d) => d.key)).size).toBe(17);
    expect(devices.every((d) => ['speaker', 'player', 'receiver', 'group'].includes(d.kind))).toBe(true);
    expect(devices.filter((d) => d.kind === 'receiver').map((d) => d.key)).toEqual([key('ampl'), key('bamp')]);
    const { placed, unplaced } = unplacedBucket(devices);
    expect(unplaced.map((d) => d.key).sort()).toEqual([key('balc'), key('bath'), key('sgrp'), key('ter')]);
    expect(placed.every((d) => d.area_id && d.floor_id)).toBe(true);
    expect((await m.list({ area: 'none' })).devices).toHaveLength(4);
    expect((await m.list({ floor: 'b' })).devices.map((d) => d.key)).toEqual([key('bamp'), key('gym')]);
    expect((await m.list({ q: 'פרגולה' })).devices.map((d) => d.key)).toEqual([key('per')]);
    expect((await m.list({ kind: ['receiver'] })).devices).toHaveLength(2);
    expect((await m.nonPhysical()).devices).toEqual([]);
  });

  test('status carries the new counts, floors and the library provider', async () => {
    const s = await resetPlayersMock('ma').status();
    expect(s.counts).toMatchObject({ players: 16, playing: 7, groups: 3, unplaced: 3, suggestions: 3 });
    expect(s).toMatchObject({ floors: true, library: { provider: 'ma', state: 'ready' }, can: { group: true }, bridge: { players_ready: true, version: '0.5.0' } });
  });

  test('state filter: playing, off (off or idle), unavailable', async () => {
    const m = resetPlayersMock('ma');
    const k = async (state: 'playing' | 'off' | 'unavailable') => (await m.list({ state, kind: ['speaker', 'player', 'receiver'] })).devices.map((d) => d.key.slice(3)).sort();
    expect(await k('playing')).toEqual(['hal', 'kit', 'liv', 'pat', 'per', 'stu', 'ter']);
    expect(await k('unavailable')).toEqual(['bath', 'gym']);
    expect(await k('off')).toEqual(['ampl', 'balc', 'bamp', 'gst', 'kids', 'off', 'par']);
  });

  test('player state text: playing, station, paused, idle, off, unavailable, member of a leader, receiver', async () => {
    const m = resetPlayersMock('ma');
    const d = (id: string) => dev(m, id);
    expect(playerStateText(await d('liv'))).toBe('מנגן');
    expect(playerStateText(await d('liv'), { withTitle: true })).toBe('מנגן · Blue in Green');
    expect(playerStateText(await d('per'))).toBe('תחנה');
    expect(playerStateText(await d('par'))).toBe('מושהה');
    expect(playerStateText(await d('gst'))).toBe('לא מנגן');
    expect(playerStateText(await d('off'))).toBe('כבוי');
    expect(playerStateText(await d('gym'))).toBe('לא זמין');
    expect(playerStateText(await d('ampl'))).toBe('טלוויזיה · HDMI 2');
    const kit = await d('kit');
    expect(playerStateText(kit, { leaderLabel: leaderLabel(await d('liv')) })).toBe('מנגן עם סלון');
    expect(playerStateText({ ...kit, live: { ...kit.live, play: 'paused' } }, { leaderLabel: 'סלון' })).toBe('מנגן עם סלון · מושהה');
    expect(matchesState(await d('par'), 'off')).toBe(true);
    expect(matchesState(await d('par'), 'playing')).toBe(false);
    expect(isPlaying(kit)).toBe(true);
  });

  test('unavailable devices keep their last good mask but are not known; a restored one that never reported has none', async () => {
    const m = resetPlayersMock('ma');
    const gym = await dev(m, 'gym');
    expect(gym.live).toMatchObject({ power: 'unavailable', caps_known: false });
    expect(gym.caps.volume_set).toBe(true); // the last good mask, greyed
    expect(playerCommandOffered(gym, { command: 'volume_set', level: 10 })).toBe(false);
    expect(await code(m.command(gym.key, { command: 'volume_set', level: 10, ...req(1) }))).toBe('caps_unknown');
    const bath = await dev(m, 'bath');
    expect(bath.live.caps_known).toBe(false);
    expect(Object.values(bath.caps).filter((v) => v === true)).toEqual([]);
    expect(await code(m.command(bath.key, { command: 'power_on', ...req(2) }))).toBe('caps_unknown');
  });

  test('live groups: a leader and a member, the WiiM-style pair; ONE resolved cross-brand group of four; the conflict flag; a static group', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const kit = await dev(m, 'kit');
    expect(liv.live.group).toMatchObject({ role: 'leader', leader_key: key('liv'), layer: 'ma', static: false, conflict: false });
    expect(kit.live.group).toMatchObject({ role: 'member', leader_key: key('liv') });
    expect(liveGroupKeys(liv.live.group, liv.key)).toEqual([key('liv'), key('kit')]);
    expect(liveGroupKeys(kit.live.group)).toEqual([key('liv'), key('kit')]);
    expect(kit.live.now.title).toBe('Blue in Green'); // a member plays what its leader plays
    expect(resolveLeader(kit, (await m.list()).devices).key).toBe(key('liv'));
    // cross-brand sync group of four: every member resolves to the same leader and the same four keys
    const four = await Promise.all(['stu', 'hal', 'ter', 'pat'].map((i) => dev(m, i)));
    expect(four.map((d) => d.live.group.role)).toEqual(['leader', 'member', 'member', 'member']);
    expect(new Set(four.map((d) => d.live.group.leader_key))).toEqual(new Set([key('stu')]));
    expect(new Set(four.map((d) => liveGroupKeys(d.live.group).join()))).toEqual(new Set([[key('stu'), key('hal'), key('ter'), key('pat')].join()]));
    expect(needsConfirmation(four)).toBe(true);
    // the device in a vendor-only group
    const gst = await dev(m, 'gst');
    expect(gst.live.group).toMatchObject({ role: 'none', conflict: true });
    expect(groupChip(gst)).toEqual({ kind: 'conflict', text: 'קיבוץ לא תואם' });
    expect(groupSectionOffered(gst)).toBe(false);
    expect(groupChip(liv)).toEqual({ kind: 'leader', text: '2 חדרים' });
    expect(groupChip(kit, 'סלון')).toEqual({ kind: 'member', text: 'סלון' });
    expect(groupChip(await dev(m, 'off'))).toBeNull();
    // static group + the groups route
    const sg = await dev(m, 'sgrp');
    expect(sg.live.group).toMatchObject({ role: 'leader', static: true, name: 'קבוצת מרפסת ועבודה' });
    expect(liveGroupKeys(sg.live.group, sg.key)).toEqual([key('sgrp'), key('balc'), key('off')]);
    const groups = await m.groups();
    expect(groups.map((g) => [g.leader_key, g.static, g.members.length])).toEqual([[key('liv'), false, 2], [key('stu'), false, 4], [key('sgrp'), true, 2]]);
    expect(groups[0]).toMatchObject({ name: 'סלון + מטבח', volume: 34, floor_ids: ['g'], can: { group: true, volume: true } });
  });

  test('join candidates: the same layer, available, with GROUPING, not in another group, not in conflict', async () => {
    const m = resetPlayersMock('ma');
    const { devices } = await m.list();
    const liv = devices.find((d) => d.key === key('liv'))!;
    expect(groupCandidates(liv, devices).map((d) => d.key.slice(3))).toEqual(['kit', 'per', 'par', 'off', 'balc']);
    expect(groupCandidates({ ...liv, live: { ...liv.live, group: { ...liv.live.group, layer: null } } }, devices)).toEqual([]);
  });

  test('join: not_groupable refusals, the party confirmation with its preview, the honest outcome per room', async () => {
    const m = resetPlayersMock('ma');
    const j = (leader: string, members: string[], n: number, confirmed?: boolean) => m.join({ leader_key: key(leader), member_keys: members.map(key), ...(confirmed ? { confirmed } : {}), ...req(n) });
    expect(await code(j('liv', ['gst'], 1))).toBe('not_groupable'); // conflict
    expect(await code(j('liv', ['gym'], 2))).toBe('not_groupable'); // unavailable
    expect(await code(j('liv', ['ampl'], 3))).toBe('not_groupable'); // no live GROUPING
    expect(await code(j('liv', ['hal'], 4))).toBe('not_groupable'); // already in another live group
    expect(await code(j('kids', ['per'], 5))).toBe('not_groupable'); // a leader without GROUPING
    // 4 devices: the party rule asks first
    let err: unknown = null;
    try { await j('liv', ['per', 'par'], 6); } catch (e) { err = e; }
    const preview = confirmPreview(err);
    expect(preview).toMatchObject({ devices: 4, floors: 2, needs_confirmation: true, needs_bulk: false });
    expect(preview!.members.map((x) => [x.key.slice(3), x.will])).toEqual([['liv', 'stay'], ['kit', 'stay'], ['per', 'join'], ['par', 'join']]);
    expect(playerErrorText(err)).toBe('נדרש אישור');
    // one member is told not to come: not_joined, named by room
    m.refuseJoin.add(key('par'));
    const run = await j('liv', ['per', 'par'], 7, true);
    expect(run.status).toBe('accepted');
    const rec = await m.groupRecord(run.bulk_id);
    expect(rec.members).toEqual([
      { device_key: key('per'), area_name: 'פרגולה', outcome: 'joined' },
      { device_key: key('par'), area_name: 'חדר הורים', outcome: 'not_joined' },
    ]);
    expect(memberOutcomeLine('חדר הורים', 'not_joined')).toBe('חדר הורים לא הצטרף');
    expect((await dev(m, 'per')).live.group).toMatchObject({ role: 'member', leader_key: key('liv') });
    expect((await dev(m, 'par')).live.group.role).toBe('none');
    // idempotent per request id
    expect((await j('liv', ['per', 'par'], 7, true)).bulk_id).toBe(run.bulk_id);
    m.pendingLeaders.add(key('liv'));
    expect(await code(j('liv', ['balc'], 8))).toBe('group_pending');
  });

  test('leave: a member leaves, a leader dissolves its group; nothing left playing for the leavers', async () => {
    const m = resetPlayersMock('ma');
    const a = await m.leave({ device_keys: [key('kit')], ...req(1) });
    expect((await m.groupRecord(a.bulk_id)).members).toEqual([{ device_key: key('kit'), area_name: 'מטבח', outcome: 'left' }]);
    expect((await dev(m, 'liv')).live.group.role).toBe('none');
    expect(playerStateText(await dev(m, 'kit'))).toBe('לא מנגן');
    const b = await m.leave({ device_keys: [key('stu')], ...req(2) });
    expect((await m.groupRecord(b.bulk_id)).members.map((x) => x.outcome)).toEqual(['left', 'left', 'left', 'left']);
    expect((await m.groups()).map((g) => g.leader_key)).toEqual([key('sgrp')]);
  });

  test('group volume through the mock: relative keeps the balance, ceilings only where set', async () => {
    const m = resetPlayersMock('ma');
    const rel = await m.groupVolume(key('liv'), { level: 68, mode: 'relative', ...req(1) });
    expect((await m.groupRecord(rel.bulk_id)).members).toEqual([
      { device_key: key('liv'), area_name: 'סלון', outcome: 'set', level: 68 },
      { device_key: key('kit'), area_name: 'מטבח', outcome: 'set', level: 44 },
    ]);
    const abs = await m.groupVolume(key('liv'), { level: 100, mode: 'absolute', ...req(2) });
    expect((await m.groupRecord(abs.bulk_id)).members.map((x) => [x.device_key.slice(3), x.outcome, x.level])).toEqual([['liv', 'clamped', 70], ['kit', 'set', 100]]);
    expect((await m.groups())[0].volume).toBe(100);
    expect(await code(m.groupVolume(key('liv'), { level: 120, mode: 'absolute', ...req(3) }))).toBe('validation');
  });
});

test.describe('media-players client: group volume plan, ceilings, night window', () => {
  test('relative: every member scaled by the same factor, the loudest lands on the level', () => {
    const plan = groupVolumePlan([pm('a', 40), pm('b', 20), pm('c', 10)], 20, 'relative');
    expect(plan.steps.map((s) => s.to)).toEqual([20, 10, 5]);
    expect(plan.steps.every((s) => s.outcome === 'set')).toBe(true);
    expect(plan.level).toBe(20);
    expect(groupVolumePlan([pm('a', 30), pm('b', 15)], 100, 'relative').steps.map((s) => s.to)).toEqual([100, 50]);
  });

  test('absolute: one level on all; the level is rounded and kept in 0-100', () => {
    expect(groupVolumePlan([pm('a', 40), pm('b', 20)], 33.4, 'absolute').steps.map((s) => s.to)).toEqual([33, 33]);
    expect(groupVolumePlan([pm('a', 40)], 150, 'absolute').steps[0].to).toBe(100);
    expect(groupVolumePlan([pm('a', 40)], -5, 'absolute').steps[0].to).toBe(0);
  });

  test('a ceiling clamps ONLY where it is set; a member without one is never clamped', () => {
    const plan = groupVolumePlan([pm('capped', 30, { volume_max: 50 }), pm('free', 30)], 90, 'absolute');
    expect(plan.steps.map((s) => [s.to, s.outcome])).toEqual([[50, 'clamped'], [90, 'set']]);
    expect(plan.level).toBe(90);
    // the ceiling applies after the relative scaling too, and only when it is below the wanted level
    const rel = groupVolumePlan([pm('a', 40, { volume_max: 60 }), pm('b', 20)], 80, 'relative');
    expect(rel.steps.map((s) => [s.to, s.outcome])).toEqual([[60, 'clamped'], [40, 'set']]);
    expect(groupVolumePlan([pm('a', 40, { volume_max: 60 })], 55, 'absolute').steps[0].outcome).toBe('set');
  });

  test('night window: the lower of the ceiling and the night max, inside the window only (crosses midnight)', () => {
    const night = { from: '22:00', to: '07:00', max: 25 };
    const d = { volume_max: 40, volume_night: night };
    expect([inNightWindow(night, at(23)), inNightWindow(night, at(3)), inNightWindow(night, at(7)), inNightWindow(night, at(21, 59)), inNightWindow(night, at(12))]).toEqual([true, true, false, false, false]);
    expect(inNightWindow({ from: '09:00', to: '17:00', max: 10 }, at(12))).toBe(true);
    expect(inNightWindow({ from: '09:00', to: '09:00', max: 10 }, at(9))).toBe(false);
    expect(inNightWindow(null, at(23))).toBe(false);
    expect(effectiveCeiling(d, at(23))).toBe(25);
    expect(effectiveCeiling(d, at(12))).toBe(40);
    expect(effectiveCeiling({ volume_max: null, volume_night: night }, at(12))).toBeNull();
    expect(effectiveCeiling({ volume_max: null, volume_night: null }, at(23))).toBeNull();
    expect(effectiveCeiling({ volume_max: 20, volume_night: night }, at(23))).toBe(20);
    expect(clampVolume(d, 90, at(23))).toBe(25);
    expect(clampVolume({ volume_max: null, volume_night: null }, 90, at(23))).toBe(90);
    const plan = groupVolumePlan([pm('p', 10, d)], 60, 'absolute', at(23));
    expect(plan.steps[0]).toMatchObject({ to: 25, outcome: 'clamped' });
    expect(groupVolumePlan([pm('p', 10, d)], 60, 'absolute', at(12)).steps[0]).toMatchObject({ to: 40, outcome: 'clamped' });
  });

  test('skips: muted, off, unavailable, not in scope; unknown level in relative mode; a zero group has no balance to keep', () => {
    const plan = groupVolumePlan([
      pm('on', 30), pm('muted', 30, { muted: true }), pm('off', 30, { power: 'off' }), pm('gone', 30, { power: 'unavailable' }), pm('scope', 30, { can: { control: false } }), pm('blind', null),
    ], 60, 'relative');
    expect(plan.steps.map((s) => [s.key, s.outcome, s.to])).toEqual([
      ['on', 'set', 60], ['muted', 'skipped_muted', null], ['off', 'skipped_off', null], ['gone', 'skipped_unavailable', null], ['scope', 'not_allowed', null], ['blind', 'unknown', null],
    ]);
    expect(plan.level).toBe(60);
    expect(groupVolumePlan([pm('blind', null)], 40, 'absolute').steps[0]).toMatchObject({ to: 40, outcome: 'set' });
    expect(groupVolumePlan([pm('a', 0), pm('b', 0)], 30, 'relative').steps.map((s) => s.to)).toEqual([30, 30]);
    expect(groupVolumePlan([pm('off', 30, { power: 'off' })], 40).level).toBeNull();
  });

  test('the group level is the max of the powered members (like MA)', () => {
    expect(groupLevel([pm('a', 20), pm('b', 50, { power: 'off' }), pm('c', 35)])).toBe(35);
    expect(groupLevel([pm('a', 20, { power: 'unavailable' })])).toBeNull();
    expect(GROUP_VOLUME_RATE_PER_S).toBe(2);
  });
});

test.describe('media-players client: join diff, draft, party rule', () => {
  test('joinDiff: who joins, who leaves, who stays; the leader is never in it; duplicates dropped', () => {
    expect(joinDiff(['a', 'b'], ['b', 'c', 'c'])).toEqual({ join: ['c'], leave: ['a'], stay: ['b'] });
    expect(joinDiff(['L', 'a'], ['L', 'a', 'x'], 'L')).toEqual({ join: ['x'], leave: [], stay: ['a'] });
    expect(joinDiff([], [], 'L')).toEqual({ join: [], leave: [], stay: [] });
    expect(joinDiff(['a'], [])).toEqual({ join: [], leave: ['a'], stay: [] });
  });

  test('JoinDraft: ticks batch into one diff; a second tick of the same room cancels the first', () => {
    const d = new JoinDraft();
    expect(JOIN_BATCH_MS).toBe(500);
    d.toggle('x', false); // tick a room that is not in the group
    d.toggle('kit', true); // untick a member
    expect([d.has('x'), d.has('kit'), d.has('y'), d.size, d.additions]).toEqual([true, true, false, 2, 1]);
    expect(d.desired(['kit', 'z'])).toEqual(['z', 'x']);
    expect(d.diff(['kit', 'z'], 'L')).toEqual({ join: ['x'], leave: ['kit'], stay: ['z'] });
    d.toggle('x', false);
    d.toggle('kit', true);
    expect(d.size).toBe(0);
    expect(d.diff(['kit'])).toEqual({ join: [], leave: [], stay: ['kit'] });
    d.toggle('q', false);
    d.clear();
    expect(d.size).toBe(0);
  });

  test('party rule: 4 or more devices, or more than one floor; devices without a floor never count as one', () => {
    const f = (...fl: (string | null)[]) => fl.map((floor_id) => ({ floor_id }));
    expect(needsConfirmation(f('g', 'g', 'g'))).toBe(false);
    expect(needsConfirmation(f('g', 'g', 'g', 'g'))).toBe(true);
    expect(needsConfirmation(f('g', 'u1'))).toBe(true);
    expect(needsConfirmation(f('g', null))).toBe(false);
    expect(needsConfirmation(f(null, null, null))).toBe(false);
  });
});

test.describe('media-players client: up next, position, repeat', () => {
  const entry = (name: string, artist: string | null = null) => ({ name, artist, album: null, duration_s: 100 });
  const base: UpNext = { confirmed: true, count: 12, index: 3, shuffle: false, repeat: 'off', current: entry('a'), next: entry('b', 'x'), read_at: '2026-10-01T10:00:00Z' };

  test('upNextText: "לא זמין" when missing or unconfirmed (never empty), the next item, how many follow, or that nothing does', () => {
    expect(upNextText(null)).toBe('לא זמין');
    expect(upNextText({ ...base, confirmed: false })).toBe('לא זמין');
    expect(upNextText({ ...base, confirmed: false, count: null, index: null, current: null, next: null })).toBe('לא זמין');
    expect(upNextText(base)).toBe('b · x');
    expect(upNextText({ ...base, next: entry('b') })).toBe('b');
    expect(upNextText({ ...base, next: null })).toBe('עוד 8');
    expect(upNextText({ ...base, next: null, count: 4, index: 3 })).toBe('אין המשך');
    // an old read_at never turns a confirmed answer into "unavailable" on the client: the server decides
    expect(upNextText({ ...base, read_at: '2020-01-01T00:00:00Z' })).toBe('b · x');
  });

  test('upNextMore counts the rows after the current and the next', () => {
    expect(upNextMore(base)).toBe(7);
    expect(upNextMore({ ...base, next: null })).toBe(8);
    expect(upNextMore({ ...base, confirmed: false })).toBe(0);
    expect(upNextMore(null)).toBe(0);
    expect(upNextMore({ ...base, count: null })).toBe(0);
  });

  test('the mock reads up next per layer: the library names the next item, a house without one only count and index', async () => {
    const ma = resetPlayersMock('ma');
    const u = await ma.upNext(key('liv'));
    expect(u).toMatchObject({ confirmed: true, count: 12, index: 3, current: { name: 'Blue in Green', artist: 'Miles Davis' }, next: { name: 'All Blues' } });
    expect(upNextText(u)).toBe('All Blues · Miles Davis');
    expect((await ma.upNext(key('kit'))).current?.name).toBe('Blue in Green'); // a member reads its leader's queue
    expect((await ma.upNext(key('gst'))).count).toBe(0);
    expect(await code(ma.upNext(key('kids')))).toBe('no_library');
    ma.failUpNext = true;
    expect(upNextText(await ma.upNext(key('liv')))).toBe('לא זמין');
    const sn = resetPlayersMock('sonos');
    const s = await sn.upNext(key('liv'));
    expect(s).toMatchObject({ confirmed: true, count: 14, index: 2, next: null });
    expect(upNextText(s)).toBe('עוד 11');
  });

  test('progress interpolation: the reported position plus the time since, capped at the duration; none for stations', () => {
    const now = { kind: 'music' as const, position_s: 100, duration_s: 337, position_at: new Date(Date.UTC(2026, 9, 1, 10, 0, 0)).toISOString() };
    const t0 = Date.UTC(2026, 9, 1, 10, 0, 0);
    expect(interpolatePosition(now, true, t0 + 30_000)).toBe(130);
    expect(interpolatePosition(now, false, t0 + 30_000)).toBe(100);
    expect(interpolatePosition(now, true, t0 + 600_000)).toBe(337);
    expect(interpolatePosition(now, true, t0 - 5000)).toBe(100);
    expect(interpolatePosition({ ...now, kind: 'station', duration_s: null, position_s: null }, true, t0)).toBeNull();
    expect(interpolatePosition({ ...now, position_s: null }, true, t0)).toBeNull();
  });

  test('repeat cycles off -> all -> one -> off', () => {
    expect([nextRepeat('off'), nextRepeat('all'), nextRepeat('one'), nextRepeat(null)]).toEqual(['all', 'one', 'off', 'all']);
  });
});

test.describe('media-players client: sections, room chips, library tabs', () => {
  test('with floors: one section per floor, then "לא משויכים" last; a group card is not a player-tab device', async () => {
    const m = resetPlayersMock('ma');
    const tab = (await m.list({ kind: ['speaker', 'player', 'receiver'] })).devices;
    const s = playerSections(tab, { floors: true });
    expect(s.map((x) => [x.id, x.label])).toEqual([['g', 'קומת קרקע'], ['u1', 'קומה 1'], ['b', 'מרתף'], ['none', 'לא משויכים']]);
    expect(s[3].devices.map((d) => d.key.slice(3)).sort()).toEqual(['balc', 'bath', 'ter']);
    expect(playerSections(tab, { floors: true, floorOrder: ['b', 'u1', 'g'] }).map((x) => x.id)).toEqual(['b', 'u1', 'g', 'none']);
    expect(playerSections(tab, { floors: true, order: [key('pat'), key('liv')] })[0].devices.slice(0, 2).map((d) => d.key.slice(3))).toEqual(['pat', 'liv']);
  });

  test('without floors: one list "כל החדרים" with the room chips as the filter, plus the unplaced section', async () => {
    const m = resetPlayersMock('sonos');
    const { devices } = await m.list();
    expect(devices).toHaveLength(6);
    expect(devices.every((d) => d.floor_id === null && d.floor_name === null)).toBe(true);
    expect((await m.status()).floors).toBe(false);
    const s = playerSections(devices, { floors: false });
    expect(s.map((x) => [x.id, x.label, x.devices.length])).toEqual([['all', 'כל החדרים', 5], ['none', 'לא משויכים', 1]]);
    const chips = roomChips(devices);
    expect(chips).toHaveLength(6);
    expect(chips[chips.length - 1]).toEqual({ id: 'none', name: 'ללא חדר', count: 1 });
    expect(chips.slice(0, 5).every((c) => c.count === 1)).toBe(true);
    expect(playerSections([], { floors: false })).toEqual([]);
  });

  test('library tabs follow the caps, the provider (no playlists with Sonos) and the curation switches', async () => {
    const ma = resetPlayersMock('ma');
    expect(libraryTabs(await dev(ma, 'liv'))).toEqual(['favourites', 'stations', 'playlists']);
    expect(libraryTabs(await dev(ma, 'liv'), ['favourites'])).toEqual(['favourites']);
    expect(libraryTabs(await dev(ma, 'kids'))).toEqual([]); // no music layer
    const sn = resetPlayersMock('sonos');
    expect(libraryTabs(await dev(sn, 'liv'))).toEqual(['favourites', 'stations']);
    expect((await sn.favourites()).kinds_on).toEqual(['favourites', 'stations']);
  });
});

test.describe('media-players client: commands (mock)', () => {
  test('seek / shuffle / repeat; a member acts on its leader; a station cannot seek', async () => {
    const m = resetPlayersMock('ma');
    await m.command(key('liv'), { command: 'seek', position_s: 100, ...req(1) });
    expect((await dev(m, 'liv')).live.now.position_s).toBe(100);
    expect(await code(m.command(key('liv'), { command: 'seek', position_s: 400, ...req(2) }))).toBe('not_supported');
    expect(await code(m.command(key('per'), { command: 'seek', position_s: 10, ...req(3) }))).toBe('not_supported');
    await m.command(key('kit'), { command: 'shuffle', on: true, ...req(4) });
    await m.command(key('kit'), { command: 'repeat', mode: 'all', ...req(5) });
    expect((await dev(m, 'liv')).live).toMatchObject({ shuffle: true, repeat: 'all' });
    expect((await dev(m, 'kit')).live).toMatchObject({ shuffle: true, repeat: 'all' });
    expect(await code(m.command(key('kids'), { command: 'shuffle', on: true, ...req(6) }))).toBe('not_supported');
    expect(m.sent.map((s) => s.command.command)).toEqual(['seek', 'shuffle', 'repeat']);
  });

  test('transport on a member runs on the leader and the whole group follows', async () => {
    const m = resetPlayersMock('ma');
    await m.command(key('kit'), { command: 'transport', action: 'pause', ...req(1) });
    expect((await dev(m, 'liv')).live.play).toBe('paused');
    expect((await dev(m, 'kit')).live.play).toBe('paused');
    await m.command(key('kit'), { command: 'transport', action: 'play_pause', ...req(2) });
    expect(isPlaying(await dev(m, 'liv'))).toBe(true);
    await m.command(key('liv'), { command: 'transport', action: 'next', ...req(3) });
    expect((await dev(m, 'kit')).live.now.title).toBe('All Blues');
    expect((await dev(m, 'kit')).live.queue).toEqual({ count: 12, index: 4 });
    // play on an idle player with a library starts something
    await m.command(key('gst'), { command: 'power_on', ...req(4) }).catch(() => null);
    await m.command(key('balc'), { command: 'transport', action: 'play', ...req(5) });
    expect((await dev(m, 'balc')).live.now.title).toBe('Blue in Green');
  });

  test('play_item takes a server-issued ref only; the item starts without touching the volume', async () => {
    const m = resetPlayersMock('ma');
    const fav = await refs(m, 'par', 'favourites');
    expect(fav.map((i) => i.name)).toEqual(['Blue in Green', 'Holocene', 'גלגלצ', 'ג׳אז שקט', 'ערב טוב', 'פלייליסט בוקר']);
    expect(fav.every((i) => /^[a-f0-9]{24}$/.test(i.item_ref))).toBe(true);
    const station = fav[2];
    const before = (await dev(m, 'par')).live.volume.level;
    await m.command(key('par'), { command: 'play_item', item_ref: station.item_ref, ...req(1) });
    const par = await dev(m, 'par');
    expect(par.live).toMatchObject({ play: 'playing', now: { kind: 'station', title: 'גלגלצ', artist: null }, volume: { level: before } });
    expect(par.live.queue).toEqual({ count: 1, index: 0 });
    const pls = (await refs(m, 'par', 'playlists'))[0];
    await m.command(key('par'), { command: 'play_item', item_ref: pls.item_ref, enqueue: 'add', ...req(2) });
    expect((await dev(m, 'par')).live.now.title).toBe('גלגלצ'); // enqueue does not interrupt
    expect((await dev(m, 'par')).live.queue!.count).toBe(43);
    expect(await code(m.command(key('par'), { command: 'play_item', item_ref: 'f'.repeat(24), ...req(3) }))).toBe('unknown_item');
    expect(await code(m.command(key('par'), { command: 'play_item', item_ref: 'not-a-ref', ...req(4) }))).toBe('unknown_item');
    expect(await code(m.command(key('kids'), { command: 'play_item', item_ref: station.item_ref, ...req(5) }))).toBe('no_library');
    // a member's play_item runs on its leader
    await m.command(key('kit'), { command: 'play_item', item_ref: fav[1].item_ref, ...req(6) });
    expect((await dev(m, 'liv')).live.now.title).toBe('Holocene');
    expect(playerCommandOffered(await dev(m, 'par'), { command: 'play_item', item_ref: 'nope' })).toBe(false);
  });

  test('transfer needs a music library of the MA kind and a device that is playing', async () => {
    const m = resetPlayersMock('ma');
    expect(await code(m.command(key('par'), { command: 'transfer', from_key: key('off'), ...req(1) }))).toBe('not_playing');
    expect(await code(m.command(key('par'), { command: 'transfer', from_key: key('gst'), ...req(2) }))).toBe('not_playing');
    expect(await code(m.command(key('kids'), { command: 'transfer', from_key: key('liv'), ...req(3) }))).toBe('no_library');
    await m.command(key('par'), { command: 'transfer', from_key: key('per'), ...req(4) });
    expect(await dev(m, 'par')).toMatchObject({ live: { play: 'playing', now: { title: 'גלגלצ' } } });
    expect((await dev(m, 'per')).live.play).toBe('idle');
    const sn = resetPlayersMock('sonos');
    expect(await code(sn.command(key('bed'), { command: 'transfer', from_key: key('liv'), ...req(5) }))).toBe('not_supported'); // Sonos has no transfer
  });

  test('volume: clamped to a ceiling only where an administrator set one, and to the night window inside it', async () => {
    const m = resetPlayersMock('ma');
    m.clock = () => at(12);
    await m.command(key('liv'), { command: 'volume_set', level: 100, ...req(1) });
    await m.command(key('kit'), { command: 'volume_set', level: 100, ...req(2) });
    await m.command(key('par'), { command: 'volume_set', level: 90, ...req(3) });
    expect([(await dev(m, 'liv')).live.volume.level, (await dev(m, 'kit')).live.volume.level, (await dev(m, 'par')).live.volume.level]).toEqual([70, 100, 90]);
    m.clock = () => at(23);
    await m.command(key('par'), { command: 'volume_set', level: 90, ...req(4) });
    expect((await dev(m, 'par')).live.volume.level).toBe(25);
    await m.command(key('liv'), { command: 'volume_step', direction: 'up', ...req(5) });
    expect((await dev(m, 'liv')).live.volume.level).toBe(70);
    expect((await dev(m, 'par')).volume_night).toEqual({ from: '22:00', to: '07:00', max: 25 });
  });

  test('a receiver: Main and Zone2 in one device; Zone2 takes power, volume, mute, source and sound mode only', async () => {
    const m = resetPlayersMock('ma');
    const amp = await dev(m, 'ampl');
    expect(amp.zones!.map((z) => [z.id, z.power])).toEqual([['main', 'on'], ['z2', 'off']]);
    expect(amp.sources.map((s) => s.id)).toEqual(['TV', 'Game', 'Tuner', 'Bluetooth']);
    expect(playerCommandOffered(amp, { command: 'volume_set', level: 20, zone: 'z2' })).toBe(false); // Zone2 is off
    expect(playerCommandOffered(amp, { command: 'power_on', zone: 'z2' })).toBe(true);
    expect(playerCommandOffered(amp, { command: 'transport', action: 'play', zone: 'z2' })).toBe(false);
    expect(await code(m.command(amp.key, { command: 'volume_set', level: 20, zone: 'z2', ...req(1) }))).toBe('not_supported');
    await m.command(amp.key, { command: 'power_on', zone: 'z2', ...req(2) });
    await m.command(amp.key, { command: 'volume_set', level: 33, zone: 'z2', ...req(3) });
    await m.command(amp.key, { command: 'source', source_id: 'Bluetooth', zone: 'z2', ...req(4) });
    await m.command(amp.key, { command: 'volume_set', level: 41, ...req(5) });
    await m.command(amp.key, { command: 'sound_output', output: 'קולנוע', ...req(6) });
    const after = await dev(m, 'ampl');
    expect(after.zones).toMatchObject([{ id: 'main', power: 'on', volume: 41, sound_mode: 'קולנוע' }, { id: 'z2', power: 'on', volume: 33, source_id: 'Bluetooth' }]);
    expect(await code(m.command(amp.key, { command: 'transport', action: 'play', zone: 'z2', ...req(7) }))).toBe('not_supported');
    expect(await code(m.command(amp.key, { command: 'source', source_id: 'nope', ...req(8) }))).toBe('not_supported');
    const off = await dev(m, 'bamp');
    expect(playerCommandOffered(off, { command: 'volume_set', level: 10 })).toBe(false);
    await m.command(off.key, { command: 'power_on', ...req(9) });
    expect((await dev(m, 'bamp')).live.power).toBe('on');
  });

  test('an off speaker takes only power-on; a command repeated with the same request id is applied once', async () => {
    const m = resetPlayersMock('ma');
    expect(await code(m.command(key('off'), { command: 'volume_set', level: 10, ...req(1) }))).toBe('screen_off');
    await m.command(key('off'), { command: 'power_on', ...req(2) });
    expect((await dev(m, 'off')).live.power).toBe('on');
    await m.command(key('off'), { command: 'volume_step', direction: 'up', ...req(3) });
    await m.command(key('off'), { command: 'volume_step', direction: 'up', ...req(3) });
    expect((await dev(m, 'off')).live.volume.level).toBe(27);
    expect(playerCommandOffered({ ...(await dev(m, 'off')), can: { ...(await dev(m, 'off')).can, control: false } }, { command: 'volume_set', level: 1 })).toBe(false);
  });
});

test.describe('media-players client: saved groups, favourites, floor pause, merge suggestions', () => {
  test('presets: list, create, edit with a revision, delete; missing members are named', async () => {
    const m = resetPlayersMock('ma');
    const list = await m.presets();
    expect(list.map((p) => p.name)).toEqual(['סלון + מטבח', 'קומת קרקע', 'ערב שקט', 'מסיבה']);
    expect(list.every((p) => /^[a-f0-9]{32}$/.test(p.id) && p.revision === 1 && p.running === null && p.missing.length === 0)).toBe(true);
    const created = await m.createPreset({ name: 'ערב', leader_key: key('liv'), member_keys: [key('kit')], volumes: { [key('kit')]: 20 } });
    expect(created.revision).toBe(1);
    expect(await code(m.createPreset({ name: '', leader_key: key('liv'), member_keys: [key('kit')], volumes: null }))).toBe('validation');
    expect(await code(m.createPreset({ name: 'x', leader_key: key('liv'), member_keys: [key('nope')], volumes: null }))).toBe('not_found');
    const saved = await m.savePreset(created.id, { name: 'ערב ב', leader_key: key('liv'), member_keys: [key('kit'), key('per')], volumes: null }, 1);
    expect(saved).toMatchObject({ revision: 2, name: 'ערב ב' });
    expect(await code(m.savePreset(created.id, { name: 'z', leader_key: key('liv'), member_keys: [key('kit')], volumes: null }, 1))).toBe('revision_conflict');
    expect(await code(m.deletePreset(created.id, 1))).toBe('revision_conflict');
    await m.deletePreset(created.id, 2);
    expect((await m.presets()).map((p) => p.id)).not.toContain(created.id);
  });

  test('apply a preset: a diff, then the volumes limited per member; the honest outcome per room; the party confirmation first', async () => {
    const m = resetPlayersMock('ma');
    m.clock = () => at(23);
    const party = (await m.presets())[3];
    expect(await code(m.applyPreset(party.id, req(1)))).toBe('confirm_required');
    const run = await m.applyPreset(party.id, { confirmed: true, ...req(2) });
    expect((await m.groupRecord(run.bulk_id)).members.map((x) => [x.device_key.slice(3), x.outcome, x.level])).toEqual([
      ['liv', 'set', 45], ['kit', 'set', 45], ['per', 'set', 50], ['par', 'clamped', 25], ['off', 'skipped_off', undefined],
    ]);
    expect((await dev(m, 'per')).live.group).toMatchObject({ role: 'member', leader_key: key('liv') });
    expect((await dev(m, 'par')).live.group.role).toBe('member');
    const again = (await m.presets())[3];
    expect(again.running).toMatchObject({ bulk_id: run.bulk_id });
    m.clock = () => new Date(at(23).getTime() + 31_000);
    expect((await m.presets())[3].running).toBeNull();
    // a smaller one: unjoin the extras, join the missing
    const pair = (await m.presets())[0];
    const r2 = await m.applyPreset(pair.id, req(3));
    const rec = await m.groupRecord(r2.bulk_id);
    expect(rec.members.filter((x) => x.outcome === 'left').map((x) => x.device_key.slice(3)).sort()).toEqual(['off', 'par', 'per']);
    expect((await m.groups()).find((g) => g.leader_key === key('liv'))!.members.map((x) => x.key.slice(3))).toEqual(['liv', 'kit']);
  });

  test('apply a preset when a member refuses or is gone: not_joined, named, the rest still happens', async () => {
    const m = resetPlayersMock('ma');
    m.refuseJoin.add(key('per'));
    const p = (await m.presets())[1]; // liv + kit + per, one floor, three devices: no confirmation
    const run = await m.applyPreset(p.id, req(1));
    const rec = await m.groupRecord(run.bulk_id);
    expect(rec.members.map((x) => [x.device_key.slice(3), x.outcome])).toEqual([['liv', 'joined'], ['kit', 'joined'], ['per', 'not_joined']]);
    expect((await dev(m, 'per')).live.group.role).toBe('none');
    const created = await m.createPreset({ name: 'עם כושר', leader_key: key('liv'), member_keys: [key('gym')], volumes: null });
    const r2 = await m.applyPreset(created.id, { confirmed: true, ...req(2) });
    expect((await m.groupRecord(r2.bulk_id)).members.map((x) => [x.device_key.slice(3), x.outcome])).toEqual([['kit', 'left'], ['liv', 'joined'], ['gym', 'not_joined']]);
  });

  test('favourites curation: hide and order items, per kind switches, a revision', async () => {
    const m = resetPlayersMock('ma');
    const fav = await refs(m, 'liv', 'favourites');
    expect((await m.library(key('liv'), 'favourites')).curated).toBe(false);
    const c = await m.saveFavourites({ kinds_on: ['favourites', 'stations'], items: [{ item_ref: fav[0].item_ref, hidden: true, order: 0 }, { item_ref: fav[5].item_ref, hidden: false, order: 1 }] }, 1);
    expect(c.revision).toBe(2);
    const page = await m.library(key('liv'), 'favourites');
    expect(page.curated).toBe(true);
    expect(page.items[0].name).toBe('פלייליסט בוקר');
    expect(page.items.map((i) => i.name)).not.toContain('Blue in Green');
    expect(await code(m.saveFavourites({ kinds_on: [], items: [] }, 1))).toBe('revision_conflict');
    expect(applyCuration(fav, c).map((i) => i.name)).toEqual(page.items.map((i) => i.name));
    expect(applyCuration(fav, null)).toHaveLength(6);
  });

  test('floor "עצור מוזיקה": the preview counts who plays, the run pauses the leaders; unplaced devices are out of floor scope', async () => {
    const m = resetPlayersMock('ma');
    const p = await m.pausePreview('floor', 'g');
    expect(p.label).toBe('קומת קרקע');
    expect(p.counts).toMatchObject({ send: 5, not_playing: 2, unavailable: 0 });
    expect(p.devices.find((d) => d.key === key('liv'))).toMatchObject({ will: 'pause', reason: null });
    expect(p.devices.find((d) => d.key === key('gst'))).toMatchObject({ will: 'skip', reason: 'not_playing' });
    expect(p.devices.map((d) => d.key)).not.toContain(key('balc'));
    await m.pauseRun('floor', 'g', 'abcdefgh-1', new Date().toISOString());
    expect((await dev(m, 'liv')).live.play).toBe('paused');
    expect((await dev(m, 'kit')).live.play).toBe('paused');
    expect((await dev(m, 'per')).live.play).toBe('paused');
    expect((await dev(m, 'stu')).live.play).toBe('paused'); // a group with a member on this floor pauses as one
    expect((await dev(m, 'par')).live.play).toBe('paused');
  });

  test('merge suggestions carry the rule and the reason', async () => {
    const m = resetPlayersMock('ma');
    const s = await m.suggestions();
    expect(s.map((x) => [x.rule, x.reason])).toEqual([['3b', 'same_model'], ['3b', 'same_model'], ['5b', 'same_name_area_one_side']]);
    expect(new Set(s.map((x) => x.id)).size).toBe(3);
    expect(s.every((x) => x.device_key.startsWith('mp-') && x.endpoint_label && x.device_name)).toBe(true);
  });
});

test.describe('media-players client: the house without a music library (mock)', () => {
  test('six Sonos speakers, the native provider, no floors; favourites and stations but no playlists', async () => {
    const m = resetPlayersMock('sonos');
    const { devices } = await m.list();
    expect(devices.map((d) => d.key.slice(3))).toEqual(['liv', 'kit', 'bed', 'off', 'balc', 'bath']);
    expect(devices.every((d) => d.music_provider === 'sonos' && d.kind === 'speaker' && d.caps.group && !d.caps.power_on)).toBe(true);
    expect(devices.every((d) => d.caps.favourites && d.caps.stations && !d.caps.playlists && !d.caps.transfer)).toBe(true);
    expect(await m.status()).toMatchObject({ floors: false, library: { provider: 'sonos', state: 'ready' }, counts: { players: 6, groups: 2, unplaced: 1, suggestions: 1 } });
    const fav = await m.library(key('liv'), 'favourites');
    expect(fav.provider).toBe('sonos');
    expect(fav.items.length).toBeGreaterThan(0);
    expect((await m.library(key('liv'), 'stations')).items.every((i) => i.kind === 'radio')).toBe(true);
    expect(await code(m.library(key('liv'), 'playlists'))).toBe('not_supported');
    await m.command(key('bed'), { command: 'play_item', item_ref: fav.items[0].item_ref, ...req(1) });
    expect((await dev(m, 'bed')).live.now.title).toBe('Blue in Green');
    expect(playerStateText(await dev(m, 'bed'))).toBe('מנגן');
  });

  test('the night window and the ceiling of the bedroom speaker', async () => {
    const m = resetPlayersMock('sonos');
    m.clock = () => at(23);
    await m.command(key('bed'), { command: 'volume_set', level: 80, ...req(1) });
    expect((await dev(m, 'bed')).live.volume.level).toBe(20);
    m.clock = () => at(12);
    await m.command(key('bed'), { command: 'volume_set', level: 80, ...req(2) });
    expect((await dev(m, 'bed')).live.volume.level).toBe(40);
  });

  test('grouping on the native layer; the helper group is a shortcut that can never be joined or split', async () => {
    const m = resetPlayersMock('sonos');
    const { devices } = await m.list();
    const liv = devices.find((d) => d.key === key('liv'))!;
    expect(liv.live.group).toMatchObject({ role: 'leader', layer: 'vendor' });
    expect(groupCandidates(liv, devices).map((d) => d.key.slice(3))).toEqual(['kit', 'bed', 'off', 'balc', 'bath']);
    const run = await m.join({ leader_key: key('liv'), member_keys: [key('bed'), key('off')], confirmed: true, ...req(1) });
    expect(await m.groupRecord(run.bulk_id)).toMatchObject({ members: [{ outcome: 'joined' }, { outcome: 'joined' }] });
    expect(needsConfirmation(await Promise.all(['liv', 'kit', 'bed', 'off'].map((i) => dev(m, i))))).toBe(true); // 4 devices, no floors: the count alone asks
    const helper = (await m.groups()).find((g) => g.leader_key === key('vg5'))!;
    expect(helper).toMatchObject({ static: true, can: { group: false, volume: true } });
    expect(helper.members).toHaveLength(5);
    const fan = await m.groupVolume(key('vg5'), { level: 20, mode: 'absolute', ...req(2) });
    expect((await m.groupRecord(fan.bulk_id)).members.every((x) => x.outcome === 'set' || x.outcome === 'clamped')).toBe(true);
    expect(await code(m.join({ leader_key: key('vg5'), member_keys: [key('bath')], ...req(3) }))).toBe('not_found');
  });

  test('non-physical entries: eight sessions under ONE name, two helpers, a Spotify source - only in the settings list', async () => {
    const m = resetPlayersMock('sonos');
    const { devices } = await m.nonPhysical();
    const by = (k: string) => devices.filter((d) => d.kind === k);
    expect(by('session')).toHaveLength(8);
    expect(new Set(by('session').map((d) => d.name))).toEqual(new Set(['Jellyfin']));
    expect(new Set(by('session').map((d) => d.key)).size).toBe(8);
    expect(by('virtual_group').map((d) => d.virtual_members?.length)).toEqual([5, 0]);
    expect(by('service')).toHaveLength(1);
    expect(devices.every((d) => d.live.power === 'unavailable' && d.live.group.role === 'none' && !d.caps.group)).toBe(true);
    expect(devices.map((d) => d.key)).not.toEqual(expect.arrayContaining((await m.list()).devices.map((d) => d.key)));
  });
});

test.describe('media-players client: selection, HTTP adapter and error mapping', () => {
  test('without a backend the adapter in force is the mock (the same selector as CR-015)', () => {
    expect(players()).toBe(playersMock());
    expect(players()).not.toBe(httpPlayers);
  });

  test('error labels: the new codes have Hebrew lines, none names the infrastructure', () => {
    const e = (c: string, status = 409, msg = 'server words') => new ApiError(status, { code: c, user_message: msg, retryable: false, correlation_id: 'x', details: {} });
    for (const c of ['confirm_required', 'bulk_required', 'group_pending', 'not_groupable', 'unknown_item', 'not_playing', 'no_library', 'caps_unknown', 'bridge_outdated', 'rate_limited', 'revision_conflict', 'screen_off']) {
      expect(playerErrorText(e(c))).toBe(PLAYER_ERROR_LABEL[c]);
      expect(PLAYER_ERROR_LABEL[c]).toMatch(/[א-ת]/);
    }
    expect(Object.values(PLAYER_ERROR_LABEL).join(' ')).not.toMatch(/Home Assistant|Music Assistant|\bHA\b|\bMA\b|Ingress/);
    expect(playerErrorText(e('something_else', 500, 'שגיאה מהשרת'))).toBe('שגיאה מהשרת');
    expect(playerErrorText(new Error('boom'))).toBeTruthy();
    expect(confirmPreview(e('revision_conflict'))).toBeNull();
    expect(confirmPreview(new Error('x'))).toBeNull();
    const body = { devices: 4, floors: 2, needs_confirmation: true, needs_bulk: false, members: [] };
    expect(confirmPreview(new ApiError(409, { code: 'confirm_required', user_message: '', retryable: false, correlation_id: '', details: { preview: body } }))).toEqual(body);
    expect(confirmPreview(new ApiError(409, { code: 'confirm_required', user_message: '', retryable: false, correlation_id: '', details: {}, preview: body } as never))).toEqual(body);
  });

  test('the HTTP adapter: URLs, bodies, tolerant list envelopes, the 409 preview, the revision on delete', async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    let reply: () => Response = () => new Response('[]', { status: 200 });
    const g = globalThis as unknown as { fetch: unknown; document?: unknown };
    const saved = { fetch: g.fetch, document: g.document };
    g.document = { baseURI: 'http://127.0.0.1:4461/' };
    g.fetch = async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url).replace('http://127.0.0.1:4461/api/v1/', ''), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null });
      return reply();
    };
    try {
      await httpPlayers.list({ area: 'none', state: 'playing' });
      await httpPlayers.list({ kind: ['receiver'], q: 'סלון' });
      await httpPlayers.get('mp-liv');
      await httpPlayers.upNext('mp-liv');
      await httpPlayers.library('mp-liv', 'stations', 20);
      await httpPlayers.command('mp-liv', { command: 'seek', position_s: 5, client_request_id: 'r', expires_at: 'e' });
      await httpPlayers.leave({ device_keys: ['mp-kit'], client_request_id: 'r', expires_at: 'e' });
      await httpPlayers.groupVolume('mp-liv', { level: 40, mode: 'relative', client_request_id: 'r', expires_at: 'e' });
      await httpPlayers.savePreset('abc', { name: 'n', leader_key: 'mp-liv', member_keys: ['mp-liv'], volumes: null }, 3);
      await httpPlayers.deletePreset('abc', 4);
      await httpPlayers.applyPreset('abc', { confirmed: true, client_request_id: 'r', expires_at: 'e' });
      await httpPlayers.saveFavourites({ kinds_on: ['favourites'], items: [] }, 2);
      await httpPlayers.pausePreview('floor', 'g');
      await httpPlayers.pauseRun('floor', 'g', 'rid', 'exp');
      await httpPlayers.nonPhysical();
      expect(calls.map((c) => `${c.method} ${decodeURIComponent(c.url)}`)).toEqual([
        'GET multimedia/devices?kind=speaker,player,receiver,group&area=none&state=playing',
        'GET multimedia/devices?kind=receiver&q=סלון',
        'GET multimedia/devices/mp-liv',
        'GET multimedia/devices/mp-liv/up-next',
        'GET multimedia/devices/mp-liv/library?kind=stations&offset=20',
        'POST multimedia/devices/mp-liv/commands',
        'POST multimedia/groups/leave',
        'POST multimedia/groups/mp-liv/volume',
        'PUT multimedia/groups/presets/abc',
        'DELETE multimedia/groups/presets/abc?base_revision=4',
        'POST multimedia/groups/presets/abc/apply',
        'PUT multimedia/favourites',
        'GET multimedia/actions/preview?scope=floor&id=g&kind=players_pause',
        'POST multimedia/actions',
        'GET multimedia/admin/devices?kind=session,virtual_group,service',
      ]);
      expect(calls[8].body).toMatchObject({ name: 'n', base_revision: 3 });
      expect(calls[11].body).toMatchObject({ kinds_on: ['favourites'], base_revision: 2 });
      expect(calls[13].body).toMatchObject({ kind: 'players_pause', scope: 'floor', id: 'g', confirmed: true });
      // list envelopes: a bare array or an object holding it
      reply = () => new Response(JSON.stringify([{ leader_key: 'a' }]), { status: 200 });
      expect(await httpPlayers.groups()).toHaveLength(1);
      reply = () => new Response(JSON.stringify({ groups: [{ leader_key: 'a' }, { leader_key: 'b' }] }), { status: 200 });
      expect(await httpPlayers.groups()).toHaveLength(2);
      reply = () => new Response(JSON.stringify({ presets: [] }), { status: 200 });
      expect(await httpPlayers.presets()).toEqual([]);
      reply = () => new Response(JSON.stringify({ id: 'b1', status: 'done', done: true, items: [{ device_key: 'k', area_name: null, outcome: 'joined' }] }), { status: 200 });
      expect(await httpPlayers.groupRecord('b1')).toMatchObject({ bulk_id: 'b1', status: 'done', members: [{ outcome: 'joined' }] });
      // the 409 with the preview, and a plain refusal
      const preview = { devices: 5, floors: 1, needs_confirmation: true, needs_bulk: false, members: [] };
      reply = () => new Response(JSON.stringify({ code: 'confirm_required', user_message: 'x', retryable: false, correlation_id: 'c', details: { preview } }), { status: 409 });
      let caught: unknown = null;
      try { await httpPlayers.join({ leader_key: 'mp-liv', member_keys: ['mp-kit'], client_request_id: 'r', expires_at: 'e' }); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(ApiError);
      expect(confirmPreview(caught)).toEqual(preview);
      reply = () => new Response(JSON.stringify({ code: 'not_groupable', user_message: 'x', retryable: false, correlation_id: 'c', details: {} }), { status: 422 });
      caught = null;
      try { await httpPlayers.join({ leader_key: 'mp-liv', member_keys: ['mp-gst'], client_request_id: 'r', expires_at: 'e' }); } catch (e) { caught = e; }
      expect(playerErrorText(caught)).toBe('הנגן אינו יכול להצטרף לקבוצה הזו');
      reply = () => new Response('<html>', { status: 503 });
      caught = null;
      try { await httpPlayers.upNext('mp-liv'); } catch (e) { caught = e; }
      expect((caught as ApiError).status).toBe(503);
    } finally {
      g.fetch = saved.fetch;
      g.document = saved.document;
    }
  });

  test('device shapes: a player row never carries an identifier, an address or an infrastructure name', async () => {
    for (const house of ['ma', 'sonos'] as const) {
      const m = resetPlayersMock(house);
      const text = JSON.stringify([...(await m.list()).devices, ...(await m.nonPhysical()).devices, await m.groups(), await m.suggestions().then((s) => s.map((x) => ({ ...x, endpoint_id: '' })))]);
      expect(text).not.toMatch(/media_player\.|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|([0-9a-f]{2}:){5}[0-9a-f]{2}|http:\/\/|https:\/\//i);
    }
  });
});

test.describe('CR-016 integration: the mock follows the server it was reconciled with', () => {
  test('live.group.member_keys are the OTHER devices: the leader is leader_key, never listed; the same list on every device; a static group lists its children', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const kit = await dev(m, 'kit');
    expect(liv.live.group).toMatchObject({ role: 'leader', leader_key: key('liv'), member_keys: [key('kit')] });
    expect(kit.live.group).toMatchObject({ role: 'member', leader_key: key('liv'), member_keys: [key('kit')] });
    expect((await dev(m, 'stu')).live.group.member_keys).toEqual([key('hal'), key('ter'), key('pat')]);
    expect((await dev(m, 'sgrp')).live.group.member_keys).toEqual([key('balc'), key('off')]);
    expect(liveGroupKeys(liv.live.group)).toEqual([key('liv'), key('kit')]);
    expect(liveGroupKeys(kit.live.group)).toEqual([key('liv'), key('kit')]);
    expect((await dev(m, 'per')).live.group.member_keys).toEqual([]);
  });

  test('saved groups: member_keys never hold the leader (the server answers 422 validation), at most 15 rooms; volumes may name the leader', async () => {
    const m = resetPlayersMock('ma');
    expect((await m.presets())[0]).toMatchObject({ leader_key: key('liv'), member_keys: [key('kit')] });
    expect(await code(m.createPreset({ name: 'x', leader_key: key('liv'), member_keys: [key('liv'), key('kit')], volumes: null }))).toBe('validation');
    const p = await m.createPreset({ name: 'עוצמות', leader_key: key('liv'), member_keys: [key('kit')], volumes: { [key('liv')]: 30, [key('kit')]: 20 } });
    expect(p.volumes).toEqual({ [key('liv')]: 30, [key('kit')]: 20 });
    expect(await code(m.createPreset({ name: 'x', leader_key: key('liv'), member_keys: [key('kit')], volumes: { [key('per')]: 20 } }))).toBe('validation');
  });

  test('merge suggestions: a linked or dismissed row leaves the wizard list; a plain ignore drops the endpoint rows', async () => {
    const m = resetPlayersMock('ma');
    const first = await m.suggestions();
    expect(first).toHaveLength(3);
    m.answerSuggestion('ignore', first[0].endpoint_id, first[0].device_key);
    expect((await m.suggestions()).map((s) => s.id)).toEqual([first[1].id, first[2].id]);
    m.answerSuggestion('link', first[1].endpoint_id, first[1].device_key);
    m.answerSuggestion('ignore', first[2].endpoint_id);
    expect(await m.suggestions()).toEqual([]);
  });

  test('the editor reads hidden library items (all) and the curation names them; everyone else only the visible ones', async () => {
    const m = resetPlayersMock('ma');
    const items = await refs(m, 'liv', 'favourites');
    const hide = items[1];
    const cur = await m.favourites();
    await m.saveFavourites({ kinds_on: cur.kinds_on, items: [{ item_ref: items[0].item_ref, hidden: false, order: 0 }, { item_ref: hide.item_ref, hidden: true, order: 1 }] }, cur.revision);
    expect((await m.library(key('liv'), 'favourites')).items.map((i) => i.item_ref)).not.toContain(hide.item_ref);
    const all = await m.library(key('liv'), 'favourites', 0, true);
    expect(all.items.find((i) => i.item_ref === hide.item_ref)).toMatchObject({ hidden: true, name: hide.name });
    expect(all.items.find((i) => i.item_ref === items[0].item_ref)).toMatchObject({ hidden: false });
    expect((await m.favourites()).items).toEqual(expect.arrayContaining([expect.objectContaining({ item_ref: hide.item_ref, hidden: true, name: hide.name, artist: hide.artist })]));
  });

  test('play_item: Music Assistant queues next / add; a Sonos favourite is started only (not_supported otherwise)', async () => {
    const ma = resetPlayersMock('ma');
    const fav = (await refs(ma, 'liv', 'favourites'))[0];
    expect(await code(ma.command(key('liv'), { command: 'play_item', item_ref: fav.item_ref, enqueue: 'next', ...req(1) }))).toBeNull();
    expect(await code(ma.command(key('liv'), { command: 'play_item', item_ref: fav.item_ref, enqueue: 'add', ...req(2) }))).toBeNull();
    const so = resetPlayersMock('sonos');
    const sfav = (await refs(so, 'liv', 'favourites'))[0];
    expect(await code(so.command(key('liv'), { command: 'play_item', item_ref: sfav.item_ref, enqueue: 'next', ...req(3) }))).toBe('not_supported');
    expect(await code(so.command(key('liv'), { command: 'play_item', item_ref: sfav.item_ref, enqueue: 'add', ...req(4) }))).toBe('not_supported');
    expect(await code(so.command(key('liv'), { command: 'play_item', item_ref: sfav.item_ref, ...req(5) }))).toBeNull();
  });

  test('floor pause records one row per device of the scope, like the server: pause -> set, a skipped room says will skip', async () => {
    const m = resetPlayersMock('ma');
    const prev = await m.pausePreview('floor', 'g');
    const run = await m.pauseRun('floor', 'g', 'pause-1-abcdefgh', new Date(Date.now() + 15000).toISOString());
    const rec = await m.groupRecord(run.bulk_id);
    expect(rec.status).toBe('done');
    expect(rec.members.map((x) => x.device_key).sort()).toEqual(prev.devices.map((d) => d.key).sort());
    for (const r of rec.members) {
      const row = prev.devices.find((d) => d.key === r.device_key)!;
      expect([r.will, r.outcome]).toEqual(row.will === 'pause' ? ['pause', 'set'] : ['skip', row.reason === 'unavailable' ? 'skipped_unavailable' : 'not_allowed']);
      expect(r.name).toBe(row.name);
    }
    expect(rec.members.filter((x) => x.will === 'pause').length).toBe(prev.counts.send);
    expect((await dev(m, 'liv')).live.play).toBe('paused');
  });

  test('approval: by key or by kind; an unapproved device leaves every list, the settings still list it', async () => {
    const m = resetPlayersMock('ma');
    expect(m.adminList()).toHaveLength(17);
    expect(m.adminList().every((d) => d.approved)).toBe(true);
    const r = m.approve([key('balc')], false);
    expect(r).toMatchObject({ requested: 1, changed: 1, approved_players: 16, pending_players: 1 });
    expect((await m.list()).devices.map((d) => d.key)).not.toContain(key('balc'));
    expect((await m.groups()).find((g) => g.leader_key === key('sgrp'))!.members.map((x) => x.key)).toEqual([key('off')]);
    expect(m.adminList().find((d) => d.key === key('balc'))).toMatchObject({ approved: false });
    expect(m.approve(null, true, ['speaker', 'player', 'receiver', 'group'])).toMatchObject({ changed: 1, pending_players: 0 });
    expect((await m.list()).devices).toHaveLength(17);
  });

  test('the settings list shows the connections: the music layer twin is hidden with role music, rung names are the model names', async () => {
    const m = resetPlayersMock('ma');
    const liv = m.adminList().find((d) => d.key === key('liv'))!;
    const twin = liv.endpoints.find((e) => e.platform === 'music_assistant')!;
    expect([twin.role, twin.hidden, twin.rule]).toEqual(['music', true, '2c']);
    expect(liv.endpoints.find((e) => e.role === 'vendor')!.rule).toBe('device');
    expect(m.adminList().find((d) => d.key === key('ampl'))!.zones).toEqual([{ id: 'main', name: 'ראשי' }, { id: 'z2', name: 'אזור 2' }]);
  });

  test('powerControlled: a device without power caps (a Cast-only speaker) draws no power button; a receiver with zones does', async () => {
    const m = resetPlayersMock('ma');
    expect(powerControlled(await dev(m, 'off'))).toBe(true);
    expect(powerControlled(await dev(m, 'ampl'))).toBe(true);
    const par = await dev(m, 'par');
    expect(par.caps.power_on || par.caps.power_off).toBe(false);
    expect(powerControlled(par)).toBe(false);
  });

  test('library.state: after the bridge says no_library the status says unavailable and the music-layer reads are 503; a Sonos house is not affected', async () => {
    const m = resetPlayersMock('ma');
    m.libraryState = 'unavailable';
    expect((await m.status()).library).toEqual({ provider: 'ma', state: 'unavailable' });
    expect(await code(m.upNext(key('liv')))).toBe('no_library');
    expect(await code(m.library(key('liv'), 'favourites'))).toBe('no_library');
    const fav = { item_ref: 'a'.repeat(24) };
    expect(await code(m.command(key('liv'), { command: 'play_item', item_ref: fav.item_ref, ...req(9) }))).toBe('no_library');
    const so = resetPlayersMock('sonos');
    so.libraryState = 'unavailable';
    expect((await so.status()).library).toEqual({ provider: 'sonos', state: 'ready' });
    expect((await so.upNext(key('liv'))).confirmed).toBe(true);
  });

  test('the HTTP adapter reads a bulk record as the server writes it: `done` ends it, `waiting` is still running; the members are `items`', async () => {
    const g = globalThis as unknown as { fetch: unknown; document?: unknown };
    const saved = { fetch: g.fetch, document: g.document };
    g.document = { baseURI: 'http://127.0.0.1:4461/' };
    let body: unknown = null;
    g.fetch = async () => new Response(JSON.stringify(body), { status: 200 });
    try {
      body = { id: 'b1', status: 'waiting', done: false, items: [{ device_key: 'mp-kit', area_name: 'מטבח', will: 'join', outcome: 'unknown' }] };
      expect(await httpPlayers.groupRecord('b1')).toMatchObject({ bulk_id: 'b1', status: 'running', members: [{ device_key: 'mp-kit', outcome: 'unknown' }] });
      body = { id: 'b1', status: 'done', done: true, items: [{ device_key: 'mp-kit', area_name: 'מטבח', will: 'join', outcome: 'joined' }] };
      expect(await httpPlayers.groupRecord('b1')).toMatchObject({ status: 'done', members: [{ outcome: 'joined', will: 'join' }] });
    } finally {
      g.fetch = saved.fetch;
      g.document = saved.document;
    }
  });
});

// a type-level touch so a signature change in the contract mirror shows up here too
const _typed: PlayerDevice | null = null;
void _typed;
