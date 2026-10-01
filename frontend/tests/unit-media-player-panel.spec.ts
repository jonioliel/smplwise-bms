import { test, expect } from '@playwright/test';
import { JoinDraft, type PlayerCommand, type PlayerDevice } from '../src/api/media-players';
import { resetPlayersMock, type PlayersMockStore } from '../src/api/media-players-mock';
import {
  CONFIRM_TIMEOUT_MS, NOT_CONFIRMED, PlayerGate, RateGap, confirmCopy, enqueueOffered, failedLines, floorsLine, fraction, greyed, groupKeysOf, groupSectionRows, groupSectionShown, groupSliderLevel,
  groupVolumeOffered, hasNow, isGroupedView, joinPlan, joinQuestion, leaderOf, nowStatusWord, openSends, panelMode, pendId, pickTab, playerExpectation, playerPowerOffer, playerUnavailableLine,
  positionOf, repeatLabel, roomRows, seekState, transferOffered, transferSources, transportButtons, upNextView, viewOnly, volumeDisplay, zoneView, zoneViews, expectedGroupSteps,
} from '../src/components/media-player-logic';

// CR-016 S3: the player panel's rules (components/media-player-logic.ts) on the S0 mock's two houses. No browser page: what the panel may
// offer, how often a control may fire, what counts as confirmed, what the party rule asks, what a ceiling does and does not do.

const key = (id: string) => `mp-${id}`;
const dev = async (m: PlayersMockStore, id: string): Promise<PlayerDevice> => (await m.get(key(id))) as PlayerDevice;
const all = async (m: PlayersMockStore): Promise<PlayerDevice[]> => (await m.list()).devices;
const withLive = (d: PlayerDevice, live: Partial<PlayerDevice['live']>): PlayerDevice => ({ ...d, live: { ...d.live, ...live } });
const at = (h: number, min = 0) => new Date(2026, 9, 1, h, min);

test.describe('what the panel is: modes and offers', () => {
  test('mode by power: on / off / unavailable; view-only needs neither control nor power; opening sends nothing', async () => {
    const m = resetPlayersMock('ma');
    expect(panelMode(await dev(m, 'liv'))).toBe('on');
    expect(panelMode(await dev(m, 'off'))).toBe('off');
    expect(panelMode(await dev(m, 'gym'))).toBe('unavailable');
    expect(panelMode(withLive(await dev(m, 'liv'), { power: 'unknown' }))).toBe('unavailable');
    const d = await dev(m, 'liv');
    expect(viewOnly(d)).toBe(false);
    expect(viewOnly({ can: { ...d.can, control: false, power: false } })).toBe(true);
    expect(viewOnly({ can: { ...d.can, control: false, power: true } })).toBe(false);
    expect(openSends()).toEqual([]);
  });

  test('the unavailable line names the kind and the time; the unknown state says so', async () => {
    const m = resetPlayersMock('ma');
    expect(playerUnavailableLine(await dev(m, 'gym')).title).toBe('הרמקול לא זמין');
    expect(playerUnavailableLine(await dev(m, 'gym')).since).toMatch(/^\d\d:\d\d$/);
    expect(playerUnavailableLine(withLive(await dev(m, 'ampl'), { power: 'unavailable', since: null }))).toEqual({ title: 'המגבר לא זמין', since: '' });
    expect(playerUnavailableLine(withLive(await dev(m, 'liv'), { power: 'unknown' })).title).toBe('מצב לא ידוע');
  });

  test('caps_known false greys the panel and offers nothing, whatever the last mask says', async () => {
    const m = resetPlayersMock('ma');
    const gym = await dev(m, 'gym'); // unavailable: the last good mask is kept, caps_known is false
    expect(gym.live.caps_known).toBe(false);
    expect(greyed(gym)).toBe(true);
    expect(transportButtons(gym).length).toBe(5); // drawn from the last mask ...
    const gate = new PlayerGate();
    for (const c of [{ command: 'transport', action: 'next' }, { command: 'shuffle', on: true }, { command: 'volume_set', level: 10 }, { command: 'power_on' }] as PlayerCommand[]) {
      expect(gate.check(gym, c)).toBe('not_offered'); // ... but nothing can be sent
    }
    const par = withLive(await dev(m, 'par'), { caps_known: false });
    expect(gate.check(par, { command: 'transport', action: 'play_pause' })).toBe('not_offered');
  });

  test('the transport pad draws only what caps allow: a plain player has play / pause only, the music layer all five', async () => {
    const m = resetPlayersMock('ma');
    expect(transportButtons(await dev(m, 'liv')).map((b) => b.id)).toEqual(['shuffle', 'previous', 'play_pause', 'next', 'repeat']);
    expect(transportButtons(await dev(m, 'kids')).map((b) => b.id)).toEqual(['play_pause']);
    expect(transportButtons(await dev(m, 'ampl')).map((b) => b.id)).toEqual([]); // a receiver has no transport
    expect(repeatLabel('one')).toBe('חזרה: שיר אחד');
    expect(repeatLabel('off')).toBe('חזרה: כבוי');
  });

  test('power: a speaker with the capability offers it, one without offers nothing (no greyed button); a second zone has its own', async () => {
    const m = resetPlayersMock('ma');
    expect(playerPowerOffer(await dev(m, 'liv'))).toEqual({ action: 'off', enabled: true, reason: null });
    expect(playerPowerOffer(await dev(m, 'off'))).toEqual({ action: 'on', enabled: true, reason: null });
    expect(playerPowerOffer(await dev(m, 'gym')).action).toBe('none');
    const ampl = await dev(m, 'ampl');
    expect(playerPowerOffer(ampl, 'main')).toMatchObject({ action: 'off', enabled: true });
    expect(playerPowerOffer(ampl, 'z2')).toMatchObject({ action: 'on', enabled: true }); // Zone2 is off
    const view = { ...ampl, can: { ...ampl.can, power: false } };
    expect(playerPowerOffer(view).action).toBe('none');
    const sonos = resetPlayersMock('sonos');
    expect(playerPowerOffer(await dev(sonos, 'liv')).enabled).toBe(false); // Sonos has no power cap: the panel draws no button for it
  });

  test('the seek bar: a control only with the cap, a duration and permission; a station is "live"; a plain bar otherwise', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    expect(seekState(liv)).toBe('seek');
    expect(seekState({ ...liv, can: { ...liv.can, control: false } })).toBe('bar');
    expect(seekState(withLive(liv, { now: { ...liv.live.now, duration_s: null } }))).toBe('none');
    expect(seekState(await dev(m, 'per'))).toBe('live');
    const par = await dev(m, 'par');
    expect(seekState({ ...par, caps: { ...par.caps, transport: { ...par.caps.transport, seek: false } } })).toBe('bar');
    expect(fraction(50, 200)).toBe(0.25);
    expect(fraction(null, 200)).toBe(0);
    expect(fraction(500, 200)).toBe(1);
  });

  test('the playback position is interpolated while playing and held while paused (clamped to the duration)', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const t0 = Date.parse(liv.live.now.position_at!);
    expect(positionOf(liv.live, t0 + 10_000)).toBe(192 + 10);
    expect(positionOf(liv.live, t0 + 10_000_000)).toBe(337); // never past the end
    const par = await dev(m, 'par'); // paused
    expect(positionOf(par.live, Date.parse(par.live.now.position_at!) + 30_000)).toBe(85);
    expect(positionOf((await dev(m, 'per')).live, Date.now())).toBeNull(); // a station
  });

  test('the status word: "מנגן עם סלון" on a member, "מושהה", "תחנה", "מנגן"', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const kit = await dev(m, 'kit');
    expect(nowStatusWord(kit, leaderOf(kit, devices))).toBe('מנגן עם סלון');
    expect(nowStatusWord(withLive(kit, { play: 'paused' }), leaderOf(kit, devices))).toBe('מנגן עם סלון · מושהה');
    expect(nowStatusWord(await dev(m, 'par'), null)).toBe('מושהה');
    expect(nowStatusWord(await dev(m, 'per'), null)).toBe('תחנה');
    expect(nowStatusWord(await dev(m, 'liv'), null)).toBe('מנגן');
    expect(hasNow((await dev(m, 'liv')).live)).toBe(true);
    expect(hasNow((await dev(m, 'balc')).live)).toBe(false);
  });
});

test.describe('"הבא בתור" and the library', () => {
  test('an unconfirmed read is "לא זמין", never an empty list; a failed read and an absent library too', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const bad = { confirmed: false, count: null, index: null, shuffle: null, repeat: null, current: null, next: null, read_at: null };
    expect(upNextView(liv, bad)).toEqual({ kind: 'unavailable' });
    expect(upNextView(liv, 'error')).toEqual({ kind: 'unavailable' });
    expect(upNextView(liv, await m.upNext(key('liv')), true)).toEqual({ kind: 'unavailable' });
    expect(upNextView(liv, null)).toEqual({ kind: 'loading' }); // the first read is on its way
    // a "partial" window: the count is known but the read is not confirmed: still never rendered as an (empty) list
    expect(upNextView(liv, { ...bad, count: 12, index: 3 })).toEqual({ kind: 'unavailable' });
  });

  test('confirmed: the current row, the next, and "עוד N"; the Sonos house has no next item, only the count', async () => {
    const m = resetPlayersMock('ma');
    const v = upNextView(await dev(m, 'liv'), await m.upNext(key('liv')));
    expect(v).toMatchObject({ kind: 'rows', count: 12, current: { name: 'Blue in Green', playing: true }, next: { name: 'All Blues', index: 4 }, more: 7 });
    const s = resetPlayersMock('sonos');
    const sv = upNextView(await dev(s, 'liv'), await s.upNext(key('liv')));
    expect(sv).toMatchObject({ kind: 'rows', next: null, more: 11, count: 14 });
  });

  test('no block when nothing plays, for a station, or on a device without a queue read', async () => {
    const m = resetPlayersMock('ma');
    expect(upNextView(await dev(m, 'balc'), null)).toEqual({ kind: 'none' }); // idle: nothing is read
    expect(upNextView(await dev(m, 'per'), await m.upNext(key('per')))).toEqual({ kind: 'none' }); // a station is not a queue
    expect(upNextView(await dev(m, 'kids'), null)).toEqual({ kind: 'none' }); // no music layer: no up-next cap
  });

  test('library tabs: absent without a music layer, no playlists with the Sonos provider, curated by the administrator; the long press needs the MA layer', async () => {
    const m = resetPlayersMock('ma');
    const { libraryTabs } = await import('../src/api/media-players');
    expect(libraryTabs(await dev(m, 'liv'))).toEqual(['favourites', 'stations', 'playlists']);
    expect(libraryTabs(await dev(m, 'kids'))).toEqual([]);
    expect(libraryTabs(await dev(m, 'liv'), ['stations'])).toEqual(['stations']);
    const s = resetPlayersMock('sonos');
    expect(libraryTabs(await dev(s, 'liv'))).toEqual(['favourites', 'stations']);
    expect(pickTab(['favourites', 'stations'], 'playlists')).toBe('favourites');
    expect(pickTab(['favourites', 'stations'], 'stations')).toBe('stations');
    expect(pickTab([], 'stations')).toBeNull();
    expect(enqueueOffered(await dev(m, 'liv'))).toBe(true);
    expect(enqueueOffered(await dev(s, 'liv'))).toBe(false);
  });
});

test.describe('volume: ceilings only where set, never by default', () => {
  test('no ceiling is a no-op: nothing is clamped and no marker is drawn', async () => {
    const m = resetPlayersMock('ma');
    const per = await dev(m, 'per');
    expect(per.volume_max).toBeNull();
    expect(volumeDisplay(per, 100, at(12))).toEqual({ level: 100, ceiling: null, clamped: false });
    expect(volumeDisplay(per, 0, at(12))).toEqual({ level: 0, ceiling: null, clamped: false });
    expect(volumeDisplay(per, 140, at(12)).level).toBe(100); // the scale's own end
  });

  test('a set ceiling clamps the display and marks it; the night window applies only inside the window, the lower of the two wins', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv'); // volume_max 70
    expect(volumeDisplay(liv, 90, at(12))).toEqual({ level: 70, ceiling: 70, clamped: true });
    expect(volumeDisplay(liv, 50, at(12))).toEqual({ level: 50, ceiling: 70, clamped: false });
    const par = await dev(m, 'par'); // night window 22:00-07:00 / 25, no volume_max
    expect(volumeDisplay(par, 90, at(23, 30))).toEqual({ level: 25, ceiling: 25, clamped: true });
    expect(volumeDisplay(par, 90, at(3))).toEqual({ level: 25, ceiling: 25, clamped: true }); // across midnight
    expect(volumeDisplay(par, 90, at(12))).toEqual({ level: 90, ceiling: null, clamped: false });
    expect(volumeDisplay({ volume_max: 20, volume_night: { from: '22:00', to: '07:00', max: 25 } }, 90, at(23))).toMatchObject({ level: 20, ceiling: 20 });
  });

  test('the group slider reads the loudest powered room; the expected plan clamps only the rooms with a ceiling', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const liv = devices.find((d) => d.key === key('liv'))!;
    const rooms = roomRows(liv, devices).map((r) => r.dev);
    expect(groupSliderLevel(rooms)).toBe(34);
    const steps = expectedGroupSteps(rooms, 100, 'relative', at(12));
    expect(steps.find((s) => s.key === key('liv'))).toMatchObject({ to: 70, outcome: 'clamped' }); // its own ceiling
    expect(steps.find((s) => s.key === key('kit'))).toMatchObject({ to: 65, outcome: 'set' }); // nothing set: nothing clamped
    expect(groupVolumeOffered(liv)).toBe(true);
    expect(groupVolumeOffered({ ...liv, can: { ...liv.can, group: false } })).toBe(false);
    expect(groupVolumeOffered(await dev(m, 'kit'))).toBe(false); // a member does not carry the group slider itself: the leader does
  });
});

test.describe('the gate: offered, rates, one power command in flight', () => {
  test('key-like presses go through one bucket (burst 8, 5/s); a press over it is dropped, never queued', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const g = new PlayerGate();
    const next: PlayerCommand = { command: 'transport', action: 'next' };
    const t = 1_000_000;
    const verdicts = Array.from({ length: 12 }, () => g.check(liv, next, t));
    expect(verdicts.filter((v) => v === 'send')).toHaveLength(8);
    expect(verdicts.slice(8)).toEqual(['dropped', 'dropped', 'dropped', 'dropped']);
    expect(g.check(liv, next, t + 400)).toBe('send'); // two tokens refilled
  });

  test('seek and shuffle / repeat: 2 per second; transfer: once per 5 s; play_item: 1/s and 6 per minute', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const g = new PlayerGate();
    const t = 5_000_000;
    expect(g.check(liv, { command: 'seek', position_s: 10 }, t)).toBe('send');
    expect(g.check(liv, { command: 'seek', position_s: 20 }, t + 200)).toBe('dropped');
    expect(g.check(liv, { command: 'seek', position_s: 30 }, t + 600)).toBe('send');
    expect(g.check(liv, { command: 'shuffle', on: true }, t)).toBe('send');
    expect(g.check(liv, { command: 'repeat', mode: 'all' }, t + 100)).toBe('send'); // another command: its own gap
    expect(g.check(liv, { command: 'shuffle', on: false }, t + 300)).toBe('dropped');
    const balc = await dev(m, 'balc');
    expect(g.check(balc, { command: 'transfer', from_key: key('per') }, t)).toBe('send');
    expect(g.check(balc, { command: 'transfer', from_key: key('per') }, t + 4000)).toBe('cooldown');
    expect(g.check(balc, { command: 'transfer', from_key: key('per') }, t + 5100)).toBe('send');
    const item = (n: number): PlayerCommand => ({ command: 'play_item', item_ref: `${n}`.padStart(24, 'a').slice(0, 24).replace(/[^a-f0-9]/g, 'a') });
    const gp = new PlayerGate();
    expect(gp.check(liv, item(1), t)).toBe('send');
    expect(gp.check(liv, item(2), t + 500)).toBe('dropped'); // 1/s
    const sent: string[] = [];
    for (let i = 1; i <= 8; i++) sent.push(gp.check(liv, item(i), t + i * 1100));
    expect(sent.filter((v) => v === 'send').length).toBe(5); // 6 per minute in total, the first one included
    expect(sent.slice(5)).toEqual(['dropped', 'dropped', 'dropped']);
    expect(gp.check(liv, item(9), t + 61_000)).toBe('send'); // a minute later
  });

  test('one power command in flight per device; a second waits for the first (and 2 s)', async () => {
    const m = resetPlayersMock('ma');
    const off = await dev(m, 'off');
    const g = new PlayerGate();
    expect(g.check(off, { command: 'power_on' }, 10_000)).toBe('send');
    expect(g.check(off, { command: 'power_on' }, 10_100)).toBe('busy');
    g.powerDone();
    expect(g.check(off, { command: 'power_on' }, 10_500)).toBe('busy'); // inside the 2 s minimum
    expect(g.check(off, { command: 'power_on' }, 12_200)).toBe('send');
  });

  test('a command the device does not offer is refused before anything is sent (view-only, wrong state, no capability)', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const g = new PlayerGate();
    expect(g.check({ ...liv, can: { ...liv.can, control: false } }, { command: 'transport', action: 'next' })).toBe('not_offered');
    expect(g.check(await dev(m, 'off'), { command: 'transport', action: 'next' })).toBe('not_offered'); // off: only power
    expect(g.check(await dev(m, 'kids'), { command: 'shuffle', on: true })).toBe('not_offered'); // no shuffle cap
    expect(g.check(liv, { command: 'seek', position_s: 9999 })).toBe('not_offered'); // past the duration
    expect(g.check(liv, { command: 'play_item', item_ref: 'not-a-ref' })).toBe('not_offered'); // only server-issued refs
    const gap = new RateGap(500);
    expect(gap.take(0)).toBe(true);
    expect(gap.take(200)).toBe(false);
    expect(gap.take(600)).toBe(true);
  });
});

test.describe('confirmation: what counts as done', () => {
  test('transport, shuffle, repeat, volume, seek, power, play_item, transfer each have an observable effect or none', async () => {
    const m = resetPlayersMock('ma');
    const liv = await dev(m, 'liv');
    const before = liv.live;
    const e = (c: PlayerCommand, ctx = {}) => playerExpectation(c, before, ctx);
    expect(e({ command: 'transport', action: 'play_pause' })!({ ...before, play: 'paused' })).toBe(true);
    expect(e({ command: 'transport', action: 'play_pause' })!(before)).toBe(false);
    expect(e({ command: 'transport', action: 'next' })).toBeNull();
    expect(e({ command: 'shuffle', on: true })!({ ...before, shuffle: true })).toBe(true);
    expect(e({ command: 'repeat', mode: 'one' })!({ ...before, repeat: 'all' })).toBe(false);
    expect(e({ command: 'volume_set', level: 50 })!({ ...before, volume: { ...before.volume, level: 51 } })).toBe(true);
    expect(e({ command: 'volume_set', level: 50 })!({ ...before, volume: { ...before.volume, level: 40 } })).toBe(false);
    expect(e({ command: 'volume_step', direction: 'up' })).toBeNull();
    const seek = e({ command: 'seek', position_s: 250 })!;
    expect(seek({ ...before, now: { ...before.now, position_s: 250, position_at: new Date().toISOString() } })).toBe(true);
    expect(seek(before)).toBe(false);
    expect(e({ command: 'power_off' })!({ ...before, power: 'off' })).toBe(true);
    expect(e({ command: 'power_on' })!({ ...before, power: 'off' })).toBe(false);
    expect(CONFIRM_TIMEOUT_MS).toBe(8000);
    expect(NOT_CONFIRMED).toBe('הנגן לא אישר את הפקודה');
  });

  test('play_item is confirmed by the item showing or by a different track; "next / add" is not observable here', async () => {
    const m = resetPlayersMock('ma');
    const before = (await dev(m, 'liv')).live;
    const play = playerExpectation({ command: 'play_item', item_ref: 'a'.repeat(24) }, before, { itemName: 'Holocene' })!;
    expect(play({ ...before, now: { ...before.now, title: 'Holocene' } })).toBe(true);
    expect(play({ ...before, now: { ...before.now, title: 'Other' } })).toBe(true); // a playlist: some track of it
    expect(play(before)).toBe(false); // nothing changed
    expect(playerExpectation({ command: 'play_item', item_ref: 'a'.repeat(24), enqueue: 'next' }, before)).toBeNull();
    const idle = (await dev(m, 'balc')).live;
    expect(playerExpectation({ command: 'transfer', from_key: key('per') }, idle)!({ ...idle, play: 'playing' })).toBe(true);
  });

  test('one spinner per control', () => {
    expect(pendId({ command: 'transport', action: 'play_pause' })).toBe('toggle');
    expect(pendId({ command: 'transport', action: 'next' })).toBe('next');
    expect(pendId({ command: 'power_on', zone: 'z2' })).toBe('power:z2');
    expect(pendId({ command: 'power_on' })).toBe('power');
    expect(pendId({ command: 'source', source_id: 'TV' })).toBe('src:TV');
    expect(pendId({ command: 'play_item', item_ref: 'x' })).toBe('item:x');
  });
});

test.describe('the group section: rooms of the same layer, batched ticks, the party rule', () => {
  test('the leader first, its members ticked, candidates of the same layer only (not unavailable, not in conflict, not a receiver, not a player)', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const liv = devices.find((d) => d.key === key('liv'))!;
    const rows = groupSectionRows(liv, devices);
    expect(rows[0]).toMatchObject({ key: key('liv'), leader: true, member: true });
    expect(rows.find((r) => r.key === key('kit'))).toMatchObject({ member: true, leader: false });
    const keys = rows.map((r) => r.key);
    for (const k of ['gym', 'gst', 'kids', 'ampl', 'bamp', 'bath', 'sgrp', 'hal', 'ter', 'pat', 'stu']) expect(keys).not.toContain(key(k)); // other group, group device, unavailable, conflict, no GROUPING
    for (const k of ['per', 'par', 'off', 'balc']) expect(keys).toContain(key(k));
    expect(groupSectionShown(liv, rows)).toBe(true);
    expect(groupSectionShown(devices.find((d) => d.key === key('sgrp'))!, groupSectionRows(devices.find((d) => d.key === key('sgrp'))!, devices))).toBe(false); // a static group has fixed members
    expect(groupSectionShown({ ...liv, can: { ...liv.can, group: false } }, rows)).toBe(false);
    expect(groupKeysOf(liv)).toEqual([key('liv'), key('kit')]);
    expect(groupKeysOf(devices.find((d) => d.key === key('sgrp'))!)).toEqual([key('balc'), key('off')]);
  });

  test('a member sees its leader\'s group; rooms of the group are the leader and its members', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const kit = devices.find((d) => d.key === key('kit'))!;
    const lead = leaderOf(kit, devices);
    expect(lead.key).toBe(key('liv'));
    const rows = roomRows(lead, devices);
    expect(rows.map((r) => [r.key, r.leader])).toEqual([[key('liv'), true], [key('kit'), false]]);
    expect(isGroupedView(lead, rows)).toBe(true);
    const solo = devices.find((d) => d.key === key('par'))!;
    expect(isGroupedView(solo, roomRows(solo, devices))).toBe(false);
    const sgrp = devices.find((d) => d.key === key('sgrp'))!;
    expect(isGroupedView(sgrp, roomRows(sgrp, devices))).toBe(true);
    expect(roomRows(sgrp, devices).map((r) => r.leader)).toEqual([false, false]);
  });

  test('ticks are one diff; ticking a room twice cancels; 4 rooms or more than one floor ask first; leaving never asks', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const liv = devices.find((d) => d.key === key('liv'))!;
    const current = [key('kit')];
    const d = new JoinDraft();
    d.toggle(key('per'), false);
    d.toggle(key('balc'), false);
    const two = joinPlan(liv, current, d.desired(current), devices);
    expect(two.diff).toEqual({ join: [key('per'), key('balc')], leave: [], stay: [key('kit')] });
    expect(two.after.map((x) => x.key)).toEqual([key('liv'), key('kit'), key('per'), key('balc')]);
    expect(two.needsConfirmation).toBe(true); // four rooms
    const one = new JoinDraft();
    one.toggle(key('per'), false);
    expect(joinPlan(liv, current, one.desired(current), devices)).toMatchObject({ needsConfirmation: false, floors: 1 }); // three rooms on one floor
    const floors = new JoinDraft();
    floors.toggle(key('par'), false); // the parents' room is on another floor
    expect(joinPlan(liv, [], floors.desired([]), devices)).toMatchObject({ needsConfirmation: true, floors: 2 });
    const twice = new JoinDraft();
    twice.toggle(key('per'), false);
    twice.toggle(key('per'), false);
    expect(twice.size).toBe(0);
    expect(joinPlan(liv, current, twice.desired(current), devices).diff.join).toEqual([]);
    const leave = new JoinDraft();
    leave.toggle(key('kit'), true);
    const l = joinPlan(liv, current, leave.desired(current), devices);
    expect(l.diff).toEqual({ join: [], leave: [key('kit')], stay: [] });
    expect(l.needsConfirmation).toBe(false);
  });

  test('the confirmation copy: the question names the rooms, a second floor gets its own line; the server\'s preview wins', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const liv = devices.find((d) => d.key === key('liv'))!;
    const d = new JoinDraft();
    d.toggle(key('per'), false);
    d.toggle(key('par'), false);
    const plan = joinPlan(liv, [key('kit')], d.desired([key('kit')]), devices);
    expect(confirmCopy(null, plan)).toEqual({ question: 'לצרף 4 חדרים לקבוצה אחת?', line: 'הקבוצה תשמיע ב־2 קומות.' });
    expect(confirmCopy({ devices: 5, floors: 1, needs_confirmation: true, needs_bulk: false, members: [] }, plan)).toEqual({ question: 'לצרף 5 חדרים לקבוצה אחת?', line: null });
    expect(joinQuestion(6)).toBe('לצרף 6 חדרים לקבוצה אחת?');
    expect(floorsLine(1)).toBeNull();
    expect(floorsLine(3)).toBe('הקבוצה תשמיע ב־3 קומות.');
  });

  test('the outcome by room: only the failures are named ("פרגולה לא הצטרף")', () => {
    const names = new Map([[key('per'), 'פרגולה']]);
    expect(failedLines([
      { device_key: key('kit'), area_name: 'מטבח', outcome: 'joined' },
      { device_key: key('per'), area_name: null, outcome: 'not_joined' },
      { device_key: key('off'), area_name: 'חדר עבודה', outcome: 'not_allowed' },
      { device_key: key('liv'), area_name: 'סלון', outcome: 'clamped' },
    ], names)).toEqual(['פרגולה לא הצטרף', 'חדר עבודה אין הרשאה']);
  });

  test('the house without floors: rooms are listed by name, no floor suffix; a helper is never a candidate', async () => {
    const m = resetPlayersMock('sonos');
    const devices = await all(m);
    const liv = devices.find((d) => d.key === key('liv'))!;
    const rows = groupSectionRows(liv, devices);
    expect(rows.every((r) => !r.sub.includes('קומה'))).toBe(true);
    expect(rows.length).toBe(6);
    expect(rows[0].key).toBe(key('liv'));
  });
});

test.describe('transfer and receivers', () => {
  test('"העבר את המוזיקה לכאן": only on the MA layer, only to a device that is not playing, only while another room plays; members hold no queue', async () => {
    const m = resetPlayersMock('ma');
    const devices = await all(m);
    const balc = devices.find((d) => d.key === key('balc'))!;
    const from = transferSources(balc, devices);
    expect(from.map((x) => x.key).sort()).toEqual([key('liv'), key('per'), key('stu')].sort()); // leaders and singles that play; never a member
    expect(transferOffered(balc, from)).toBe(true);
    expect(transferOffered(devices.find((d) => d.key === key('liv'))!, transferSources(devices.find((d) => d.key === key('liv'))!, devices))).toBe(false); // it plays itself
    expect(transferOffered(balc, [])).toBe(false);
    expect(transferOffered({ ...balc, can: { ...balc.can, control: false } }, from)).toBe(false);
    const s = resetPlayersMock('sonos');
    const sd = await all(s);
    const sb = sd.find((d) => d.key === key('balc'))!;
    expect(transferOffered(sb, transferSources(sb, sd))).toBe(false); // no MA: no transfer
  });

  test('a receiver: Main first, a Zone2 with its own state; a receiver without zones has none', async () => {
    const m = resetPlayersMock('ma');
    const ampl = await dev(m, 'ampl');
    expect(zoneViews(ampl).map((z) => [z.id, z.main])).toEqual([['main', true], ['z2', false]]);
    expect(zoneView(ampl, 'z2')).toMatchObject({ id: 'z2', power: 'off', source_id: 'Tuner' });
    expect(zoneView(ampl, 'nope')!.id).toBe('main');
    expect(zoneViews(await dev(m, 'bamp'))).toEqual([]);
    expect(zoneView(await dev(m, 'bamp'), null)).toBeNull();
  });
});
