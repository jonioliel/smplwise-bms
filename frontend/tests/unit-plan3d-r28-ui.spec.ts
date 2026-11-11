import { test, expect } from '@playwright/test';
import { DEFAULT_PILL_PREFS, groupDescription, isQuiet, nearRoom, pillAria, pillLod, pillPrefsOf, popoverRows, soleDevice, FAR_PX_PER_M, type RoomPill, type RoomSummary } from '../src/map/room-pills';
import { DEFAULT_STACK_PREFS, levelTags, spreadDescription, stackOffsets, stackPrefsOf, stackTap } from '../src/map/stack-layout';
import { focusPose } from '../src/map/room-focus';
import { r28Desc, r28Rooms } from './plan3d-r28-fixtures';

// PLAN3D-R28-UI-2433 (round 28, the 3D map): the pure side of the room pills (room-pills.ts), the spread levels (stack-layout.ts) and the
// room card's camera centring (room-focus.ts). The DOM side is tests/pixel-plan3d-r28-ui.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-plan3d-r28-ui.spec.ts

test.describe('round 28 settings', () => {
  test('the defaults are the recommended answers of questions.html, an unknown value reads as the default', () => {
    expect(DEFAULT_PILL_PREFS).toEqual({ mode: 'room', tap: 'popover', quiet: 'name' });
    expect(DEFAULT_STACK_PREFS).toEqual({ backdrop: 'theme', pick: 'two_tap' });
    expect(pillPrefsOf(null)).toEqual(DEFAULT_PILL_PREFS);
    expect(pillPrefsOf({ 'map.room_pills': 'device', 'map.room_pill_tap': 'card', 'map.room_pill_quiet': 'bubble' })).toEqual({ mode: 'device', tap: 'card', quiet: 'bubble' });
    expect(pillPrefsOf({ 'map.room_pills': 'x' }).mode).toBe('room');
    expect(stackPrefsOf({ 'map.stack_backdrop': 'dark', 'map.stack_pick': 'one_tap' })).toEqual({ backdrop: 'dark', pick: 'one_tap' });
    expect(stackPrefsOf({ 'map.stack_backdrop': 'x' })).toEqual(DEFAULT_STACK_PREFS);
  });
});

test.describe('room summaries', () => {
  test('a room counts what is open, presence, the lights on and its reading; devices by weight', () => {
    const rooms = r28Rooms();
    const west = rooms.find((r) => r.id === 'z-west')!;
    expect(west).toMatchObject({ name: 'מערב', open: 1, presence: true, lit: 1, temp: 24.2 });
    expect(west.devices.map((d) => d.kind)).toEqual(['open', 'pres', 'lit', 'temp']);
    expect(pillAria(west)).toBe('מערב, פתוח 1, נוכחות, אור אחד דולק, 24.2°');
    const east = rooms.find((r) => r.id === 'z-east')!;
    // the east room has no device of its own, but the open door on its boundary is its opening too (the state layer)
    expect(east).toMatchObject({ open: 1, presence: false, lit: 0, temp: null, devices: [] });
    expect(isQuiet({ ...east, open: 0 })).toBe(true);
  });

  test('a single-device room names that device; a thermometer alone is not "the" device', () => {
    const one: RoomSummary = { id: 'wc', name: 'שירותים', level_id: 'L0', open: 0, presence: false, lit: 0, temp: null, devices: [{ anchorId: 'a', label: 'דלת שירותים', words: 'סגורה', kind: 'other', icon: 'door' }] };
    expect(soleDevice(one)?.label).toBe('דלת שירותים');
    expect(soleDevice({ ...one, devices: [{ ...one.devices[0], kind: 'temp' }] })).toBeNull();
  });

  test('the popover lists open, then lit, then the rest, at most six rows with the count of the others', () => {
    const base = r28Rooms().find((r) => r.id === 'z-west')!;
    const many = { ...base, devices: [...base.devices, ...Array.from({ length: 6 }, (_, i) => ({ anchorId: `x${i}`, label: `חיישן ${i}`, words: '', kind: 'other' as const, icon: 'sensor' }))] };
    const r = popoverRows(many, 6);
    expect(r.open.length + r.lit.length + r.rest.length).toBe(6);
    expect(r.more).toBe(4);
    expect(r.open[0].kind).toBe('open');
  });
});

test.describe('grouping the description', () => {
  test('each room gets a pill at its name; its name and temperature parts leave the description', () => {
    const desc = r28Desc('L0');
    const { desc: out, pills } = groupDescription(desc, r28Rooms(), DEFAULT_PILL_PREFS);
    expect(pills.map((p) => p.id).sort()).toEqual(['z-east', 'z-west']);
    const label = desc.parts.find((p) => p.id === 'room:z-west#label')!;
    expect(pills.find((p) => p.id === 'z-west')!.pos).toEqual(label.position);
    expect(out.parts.some((p) => p.id === 'room:z-west#label' || p.id === 'room:z-west#temp')).toBe(false);
    expect(out.parts.some((p) => p.id === 'room:z-west')).toBe(true); // the room plate stays
    expect(pills.find((p) => p.id === 'z-west')!.extent).toBeGreaterThan(1);
  });

  test('the per-device mode leaves the description as it is; quiet "hide" gives a quiet room no pill', () => {
    const desc = r28Desc('L0');
    expect(groupDescription(desc, r28Rooms(), { ...DEFAULT_PILL_PREFS, mode: 'device' })).toEqual({ desc, pills: [] });
    const rooms = r28Rooms().map((r) => (r.id === 'z-east' ? { ...r, open: 0 } : r));
    const g = groupDescription(desc, rooms, { ...DEFAULT_PILL_PREFS, quiet: 'hide' });
    expect(g.pills.map((p) => p.id)).toEqual(['z-west']);
    expect(g.desc.parts.some((p) => p.id === 'room:z-east#label')).toBe(false);
  });
});

test.describe('distance and the near room', () => {
  test('far under the scale threshold and always on a phone-wide stage', () => {
    expect(pillLod(FAR_PX_PER_M - 1, 1280, 640)).toBe('far');
    expect(pillLod(FAR_PX_PER_M + 10, 1280, 640)).toBe('mid');
    expect(pillLod(FAR_PX_PER_M + 10, 390, 640)).toBe('far');
  });

  test('the near room fills half the stage with its point in the middle; the largest wins', () => {
    const p = (id: string, extent: number, x = 0): RoomPill => ({ id, name: id, level_id: 'L0', open: 0, presence: false, lit: 0, temp: null, devices: [], pos: [x, 0, 0], extent });
    const pills = [p('a', 6), p('b', 4, 30)];
    const at = new Map([['a', { x: 640, y: 400, pxPerM: 80 }], ['b', { x: 600, y: 380, pxPerM: 80 }]]);
    expect(nearRoom(pills, at, 1280, 800)).toBe('a');
    expect(nearRoom(pills, new Map([['a', { x: 640, y: 400, pxPerM: 20 }]]), 1280, 800)).toBeNull();
    expect(nearRoom(pills, new Map([['a', { x: 40, y: 400, pxPerM: 80 }]]), 1280, 800)).toBeNull(); // at the edge
    // the overview of a small floor: a big room fills half the stage, but the whole floor fits - nothing is near
    expect(nearRoom([p('a', 6), p('b', 4, 5)], new Map([['a', { x: 640, y: 400, pxPerM: 80 }]]), 1280, 800)).toBeNull();
  });
});

test.describe('spread levels', () => {
  test('every level rises by one gap more than the one under it; the connectors leave; one level stays as it is', () => {
    const desc = r28Desc(null);
    const off = stackOffsets(desc);
    expect(off.get('L0')).toBe(0);
    expect(off.get('L1')).toBeGreaterThanOrEqual(4);
    const out = spreadDescription(desc);
    const l1 = out.levels.find((l) => l.id === 'L1')!;
    expect(l1.elevation_m).toBeCloseTo(3 + off.get('L1')!, 6);
    const before = desc.parts.find((p) => p.level_id === 'L1' && p.kind === 'wall')!;
    const after = out.parts.find((p) => p.id === before.id)!;
    expect(after.position[1]).toBeCloseTo(before.position[1] + off.get('L1')!, 6);
    expect(out.parts.some((p) => p.kind === 'connector')).toBe(false);
    const single = r28Desc('L0');
    expect(spreadDescription({ ...single, levels: single.levels.slice(0, 1) })).toEqual({ ...single, levels: single.levels.slice(0, 1) });
  });

  test('focus keeps the one level (and the parts of no level)', () => {
    const out = spreadDescription(r28Desc(null), 'L1');
    expect(out.levels.map((l) => l.id)).toEqual(['L1']);
    expect(out.parts.every((p) => !p.level_id || p.level_id === 'L1')).toBe(true);
  });

  test('a tag per level with its summary; the focus marks one selected and the others away', () => {
    const names = new Map([['L0', 'קרקע'], ['L1', 'עליון']]);
    const tags = levelTags(spreadDescription(r28Desc(null)), names, r28Rooms(), null);
    expect(tags.map((t) => [t.id, t.short, t.name])).toEqual([['L0', '0', 'קרקע'], ['L1', '1', 'עליון']]);
    expect(tags[0]).toMatchObject({ open: 2, presence: true, lit: 1, temp: 24.2, state: 'normal' });
    expect(levelTags(spreadDescription(r28Desc(null)), names, r28Rooms(), 'L1').map((t) => t.state)).toEqual(['away', 'sel']);
  });

  test('two taps: focus, then enter; one tap enters', () => {
    expect(stackTap('two_tap', null, 'L1')).toEqual({ focus: 'L1', enter: null });
    expect(stackTap('two_tap', 'L1', 'L1')).toEqual({ focus: null, enter: 'L1' });
    expect(stackTap('two_tap', 'L0', 'L1')).toEqual({ focus: 'L1', enter: null });
    expect(stackTap('one_tap', null, 'L1')).toEqual({ focus: null, enter: 'L1' });
  });
});

test.describe('the room card centres its room', () => {
  test('orthographic: the point lands in the middle of the free space, closer', () => {
    const right: [number, number, number] = [1, 0, 0];
    const up: [number, number, number] = [0, 1, 0];
    const from = { position: [0, 0, 20] as [number, number, number], target: [0, 0, 0] as [number, number, number], zoom: 1 };
    const inset = { left: 384, right: 0, top: 0, bottom: 0 };
    const to = focusPose(from, [5, 0, 0], 4, inset, { right, up, orthoHalfH: 10, fov: 50, stageW: 1280, stageH: 800 });
    expect(to.zoom).toBeGreaterThan(1);
    // the free space's centre is 192 px right of the stage centre: the target sits left of the point by 192 px in world units
    const wpp = (2 * 10) / to.zoom / 800;
    expect(to.target[0]).toBeCloseTo(5 - 192 * wpp, 6);
    expect(to.position[2] - to.target[2]).toBeCloseTo(20, 6); // the same viewing direction and distance
  });

  test('perspective: closer along the same direction, never further', () => {
    const from = { position: [0, 10, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number], zoom: 1 };
    const to = focusPose(from, [0, 0, 0], 3, { left: 0, right: 0, top: 0, bottom: 0 }, { right: [1, 0, 0], up: [0, 1, 0], orthoHalfH: null, fov: 50, stageW: 1280, stageH: 800 });
    const d0 = Math.hypot(10, 10);
    const d1 = Math.hypot(to.position[0] - to.target[0], to.position[1] - to.target[1], to.position[2] - to.target[2]);
    expect(d1).toBeLessThanOrEqual(d0);
    for (const v of to.target) expect(Math.abs(v)).toBeLessThan(1e-9);
  });
});
