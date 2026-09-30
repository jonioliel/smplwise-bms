import { test, expect } from '@playwright/test';
import { resetMediaMock } from '../src/api/media-screens-mock';
import { DEFAULT_CARD, EMPTY_LAYOUT, resolveCards, type MediaDevice, type MediaLayout, type MediaPersonal } from '../src/api/media-screens';
import { hueRgb, nowView, positionNow, stateLine } from '../src/components/media-now';
import {
  NO_FILTER, NO_FLOOR, PINNED_MAX, complete, countsOf, editGroups, effective, filterDevices, filtersFromParams, filtersToParams, floorsOf, isDirty, matches,
  moveFloor, moveInGroup, moveOnto, personalFrom, roomsOf, setCard, setGroupBy, startDraft, stateOf, togglePin,
} from '../src/screens/multimedia-layout';

// CR-015 S2: the pure logic of the screens page and its layout editor - no browser page (docs/architecture/MEDIA_API.md §2.4).

const devices = async (): Promise<MediaDevice[]> => (await resetMediaMock().list()).devices;
const keys = (g: { items: { device: MediaDevice }[] }) => g.items.map((i) => i.device.key);

test.describe('multimedia layout (pure)', () => {
  test('filters: room, floor, state and search compose; the address round-trips', async () => {
    const all = await devices();
    expect(filterDevices(all, NO_FILTER)).toHaveLength(8);
    expect(filterDevices(all, { ...NO_FILTER, floor: 'g' }).map((d) => d.key)).toEqual(['md-living', 'md-kitchen', 'md-pergola']);
    expect(filterDevices(all, { ...NO_FILTER, floor: 'g', area: 'kitchen' })).toHaveLength(1);
    expect(filterDevices(all, { ...NO_FILTER, state: 'on' }).map((d) => d.key).sort()).toEqual(['md-cinema', 'md-kids', 'md-kitchen', 'md-living']);
    expect(filterDevices(all, { ...NO_FILTER, state: 'off' }).map((d) => d.key).sort()).toEqual(['md-office', 'md-parents', 'md-pergola']); // off, standby and the art mode
    expect(filterDevices(all, { ...NO_FILTER, state: 'un' }).map((d) => d.key)).toEqual(['md-gym']);
    expect(filterDevices(all, { ...NO_FILTER, q: 'ילדים' }).map((d) => d.key)).toEqual(['md-kids']); // name or room
    expect(filterDevices(all, { ...NO_FILTER, q: '  מרתף ' }).map((d) => d.key).sort()).toEqual(['md-cinema', 'md-gym']); // the floor's name counts too
    expect(stateOf(all.find((d) => d.key === 'md-pergola')!)).toBe('off');
    expect(countsOf(all)).toEqual({ total: 8, on: 4, off: 3, un: 1 });
    const f = { floor: 'u1', area: 'kids', q: 'מסך', state: 'on' as const };
    expect(filtersFromParams(filtersToParams(f, new URLSearchParams('remote=md-living')))).toEqual(f);
    expect(filtersToParams(NO_FILTER, new URLSearchParams('remote=x&floor=g&q=a')).toString()).toBe('remote=x');
    expect(matches(all[0], { ...NO_FILTER, state: 'un' })).toBe(false);
  });

  test('floors follow floor_order, then first seen; rooms follow the floor', async () => {
    const all = await devices();
    expect(floorsOf(all, { floor_order: [] }).map((f) => f.id)).toEqual(['g', 'u1', 'b']);
    expect(floorsOf(all, { floor_order: ['b', 'g'] }).map((f) => f.id)).toEqual(['b', 'g', 'u1']);
    expect(floorsOf(all, { floor_order: [] }).map((f) => f.count)).toEqual([3, 3, 2]);
    expect(roomsOf(all, 'b').map((r) => r.id)).toEqual(['basement', 'gym']);
    expect(roomsOf(all, '')).toHaveLength(8);
    const floorless = all.map((d, i) => (i === 0 ? { ...d, floor_id: null, floor_name: null } : d));
    expect(floorsOf(floorless, { floor_order: [] }).at(-1)).toMatchObject({ id: NO_FLOOR, name: 'ללא שיוך' });
  });

  test('complete(): a device the layout does not know joins the end with the default card; stored keys of absent devices are kept', async () => {
    const all = await devices();
    const layout: MediaLayout = { ...EMPTY_LAYOUT, order: ['md-kids', 'md-gone'], cards: { 'md-gone': { ...DEFAULT_CARD, on: false } } };
    const c = complete(layout, all);
    expect(c.order.slice(0, 2)).toEqual(['md-kids', 'md-gone']);
    expect(c.order).toHaveLength(2 + 7);
    expect(new Set(c.order).size).toBe(c.order.length);
    expect(c.cards['md-gone'].on).toBe(false); // kept
    expect(c.cards['md-living']).toEqual(DEFAULT_CARD);
    expect(complete(c, all)).toEqual(c); // idempotent
  });

  test('draft operations: show / size / phone, pin, group by', async () => {
    const all = await devices();
    let l = startDraft('all', EMPTY_LAYOUT, null, all);
    l = setCard(l, 'md-living', { size: 'l', on: true, phone_on: false, phone_size: 's' });
    expect(l.cards['md-living']).toEqual({ on: true, size: 'l', phone_on: false, phone_size: 's' });
    expect(resolveCards(all, l, true).flatMap((g) => g.items).some((i) => i.device.key === 'md-living')).toBe(false); // hidden on the phone
    expect(resolveCards(all, l, false).flatMap((g) => g.items).find((i) => i.device.key === 'md-living')?.size).toBe('l');
    l = togglePin(l, 'md-kids');
    expect(l.pinned).toEqual(['md-kids']);
    expect(resolveCards(all, l, false)[0]).toMatchObject({ id: 'pinned' });
    expect(togglePin(l, 'md-kids').pinned).toEqual([]);
    const full = { ...l, pinned: Array.from({ length: PINNED_MAX }, (_, i) => `k${i}`) };
    expect(togglePin(full, 'md-gym').pinned).toHaveLength(PINNED_MAX); // capped
    expect(setGroupBy(l, 'area').group_by).toBe('area');
    expect(resolveCards(all, setGroupBy(l, 'none'), false).map((g) => g.id)).toEqual(['pinned', 'all']);
  });

  test('moving inside a group: earlier / later swap with the neighbour of the SAME group; ends are no-ops', async () => {
    const all = await devices();
    const l = startDraft('all', EMPTY_LAYOUT, null, all);
    const ground = (x: MediaLayout) => keys(editGroups(all, x).find((g) => g.id === 'g')!);
    const before = ground(l);
    expect(before).toHaveLength(3);
    const moved = moveInGroup(l, all, before[2], -1);
    expect(ground(moved)).toEqual([before[0], before[2], before[1]]);
    expect(ground(moveInGroup(moved, all, before[2], 1))).toEqual(before);
    expect(moveInGroup(l, all, before[0], -1)).toBe(l); // already first
    expect(moveInGroup(l, all, before[2], 1)).toBe(l); // already last
    // the other groups are untouched
    expect(keys(editGroups(all, moved).find((g) => g.id === 'u1')!)).toEqual(keys(editGroups(all, l).find((g) => g.id === 'u1')!));
    // a drop takes the place of the target
    expect(ground(moveOnto(l, all, before[2], before[0]))).toEqual([before[2], before[0], before[1]]);
    expect(moveOnto(l, all, before[0], 'md-gym')).toBe(l); // another group: no
    // pinned devices are ordered by `pinned`
    let p = togglePin(togglePin(l, before[0]), before[1]);
    p = moveInGroup(p, all, before[1], -1);
    expect(p.pinned).toEqual([before[1], before[0]]);
    expect(keys(editGroups(all, p)[0])).toEqual([before[1], before[0]]);
  });

  test('the editor lists hidden screens too (the page does not)', async () => {
    const all = await devices();
    const l = setCard(startDraft('all', EMPTY_LAYOUT, null, all), 'md-gym', { on: false });
    expect(editGroups(all, l).flatMap(keys)).toHaveLength(8);
    expect(resolveCards(all, l, false).flatMap(keys)).toHaveLength(7);
  });

  test('floor order moves one floor', async () => {
    const l = moveFloor(EMPTY_LAYOUT, ['g', 'u1', 'b'], 'b', 0);
    expect(l.floor_order).toEqual(['b', 'g', 'u1']);
  });

  test('personal override: only what differs is sent; nothing different = null; the effective layout applies it, phone included', async () => {
    const all = await devices();
    const inst: MediaLayout = { ...EMPTY_LAYOUT, floor_order: ['g', 'u1', 'b'], cards: { 'md-gym': { on: true, size: 'm', phone_on: false, phone_size: null } } };
    const same = startDraft('me', inst, null, all);
    expect(personalFrom(inst, same, all)).toBeNull();
    let d = setCard(setCard(same, 'md-living', { size: 'l' }), 'md-gym', { on: true });
    d = setGroupBy(d, 'none');
    const p = personalFrom(inst, d, all) as MediaPersonal;
    expect(p.group_by).toBe('none');
    expect(p.order).toBeNull(); // the order did not change
    expect(p.cards).toEqual({ 'md-living': { size: 'l' } }); // gym's `on` equals the installation's
    d = moveInGroup(d, all, 'md-kitchen', -1);
    expect(personalFrom(inst, d, all)?.order).not.toBeNull();
    // the installation hides the gym on the phone; a personal "on" for it shows on the phone too
    const personal: MediaPersonal = { group_by: null, order: null, cards: { 'md-gym': { on: true } } };
    expect(resolveCards(all, effective(inst, null), true).flatMap(keys)).not.toContain('md-gym');
    expect(resolveCards(all, effective(inst, personal), true).flatMap(keys)).toContain('md-gym');
    // the start of "רק אני" is the effective layout, of "לכולם" the installation's
    expect(startDraft('me', inst, personal, all).cards['md-gym'].phone_on).toBeNull();
    expect(startDraft('all', inst, personal, all).cards['md-gym'].phone_on).toBe(false);
    expect(isDirty(same, d)).toBe(true);
    expect(isDirty(same, same)).toBe(false);
  });

  test('the card reading of a screen: poster colours are our own hue, art mode and unavailable have their own lines', async () => {
    const all = await devices();
    const by = (k: string) => all.find((d) => d.key === k)!;
    const app = nowView(by('md-living'), Date.parse('2026-09-30T18:00:00Z'));
    expect(app).toMatchObject({ kind: 'app', label: 'Netflix', glyph: 'film' });
    expect(app.a2).toBe('hsl(265 60% 52%)');
    expect(app.rgb).toBe(hueRgb(265));
    expect(nowView(by('md-kitchen'))).toMatchObject({ kind: 'tv', channel: '12', sub: 'ערוץ 12' });
    expect(nowView(by('md-pergola'))).toMatchObject({ kind: 'art', label: 'מצב אמנות' });
    expect(nowView(by('md-parents'))).toMatchObject({ kind: 'off', label: 'כבוי' });
    expect(nowView(by('md-gym'))).toMatchObject({ kind: 'un', label: 'לא זמין' });
    expect(nowView(by('md-gym')).sub).toMatch(/^מאז \d\d:\d\d$/);
    expect(nowView(by('md-cinema'))).toMatchObject({ kind: 'saver', label: 'שומר מסך' });
    expect(stateLine(by('md-kids'), nowView(by('md-kids')))).toBe('חדר ילדים · HDMI 1 · מושהה');
    expect(stateLine(by('md-parents'), nowView(by('md-parents')))).toBe('חדר הורים · כבוי');
    // the progress bar moves only while playing
    const n = by('md-living').live.now;
    expect(positionNow({ ...n, position_at: '2026-09-30T18:00:00Z' }, true, Date.parse('2026-09-30T18:00:10Z'))).toBe(1530);
    expect(positionNow({ ...n, position_at: '2026-09-30T18:00:00Z' }, false, Date.parse('2026-09-30T18:00:10Z'))).toBe(1520);
    expect(positionNow({ ...n, position_s: null }, true)).toBeNull();
    expect(hueRgb(0)).toBe('208 57 57'); // hsl(0 62% 52%)
  });
});
