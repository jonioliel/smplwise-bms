import { test, expect } from '@playwright/test';
import {
  CLOSE_MS, DETENTS, OPEN_MS, QUICK_CLOSED, SPRING_FLICK, SPRING_OPEN, closeQuick, controllableRows, detentHeight, dragOffset, flipFrom, flipTransform, openQuick,
  peekSections, pressTarget, project, releaseDetent, rubberband, sectionsFor, sensorRows, setDetent, sideSectionsAllowed, springLinear, springSamples, toggleExpand,
} from '../src/screens/area-quick-logic';
import type { DeviceRow } from '../src/api/devices';

// AREAPOPUP-297: the pure parts of the area quick-control pop-up - what a press opens, the state machine, the sheet's detents and
// momentum rule, the spring easing, the FLIP origin and the permission filter. No DOM.

const row = (p: Partial<DeviceRow>): DeviceRow =>
  ({ entity_id: 'light.a', name: 'a', domain: 'light', device_class: null, state: 'on', available: true, fresh: true, active: true, icon: null, last_changed: null, can_control: true, ...p }) as DeviceRow;

test.describe('area quick-control logic', () => {
  test('a press opens the desktop choice (drawer by default, pop-up, or the screen) and the phone choice (sheet / full screen)', () => {
    expect(pressTarget(false, 'sheet', 'drawer')).toBe('drawer');
    expect(pressTarget(false, 'sheet', 'popup')).toBe('popup');
    expect(pressTarget(false, 'sheet', 'screen')).toBe('screen');
    expect(pressTarget(true, 'sheet', 'drawer')).toBe('sheet');
    expect(pressTarget(true, 'full', 'drawer')).toBe('screen');
  });

  test('open / close / expand: a second press on the same area keeps the panel, another area keeps the size, expand is desktop only', () => {
    const a = openQuick(QUICK_CLOSED, 'kitchen', 'drawer');
    expect(a).toMatchObject({ open: true, areaId: 'kitchen', mode: 'drawer', expanded: false, detent: 'half' });
    expect(openQuick(a, 'kitchen', 'drawer')).toBe(a);
    const big = toggleExpand(a);
    expect(big.expanded).toBe(true);
    expect(openQuick(big, 'lobby', 'drawer')).toMatchObject({ areaId: 'lobby', expanded: true });
    expect(openQuick(big, 'lobby', 'popup')).toMatchObject({ areaId: 'lobby', expanded: false, mode: 'popup' });
    const closed = closeQuick(big);
    expect(closed.open).toBe(false);
    expect(closeQuick(closed)).toBe(closed);
    expect(toggleExpand(closed)).toBe(closed);
    const sheet = openQuick(QUICK_CLOSED, 'kitchen', 'sheet');
    expect(toggleExpand(sheet)).toBe(sheet);
    expect(setDetent(sheet, 'full').detent).toBe('full');
    expect(setDetent(sheet, 'half')).toBe(sheet);
    expect(setDetent(a, 'full')).toBe(a);
  });

  test('detents: three resting heights, each reachable with one gesture; a flick projects momentum; below the peek it closes', () => {
    const H = 844;
    expect(DETENTS).toEqual(['peek', 'half', 'full']);
    expect(detentHeight('peek', H)).toBeLessThan(detentHeight('half', H));
    expect(detentHeight('half', H)).toBeLessThan(detentHeight('full', H));
    expect(detentHeight('full', H)).toBeLessThanOrEqual(H);
    // a small drag with no speed stays where it was
    expect(releaseDetent('half', 12, 0, H)).toBe('half');
    // dragging up a long way lands on full; a fast upward flick from half lands on full even after a short drag
    expect(releaseDetent('half', -(H * 0.3), 0, H)).toBe('full');
    expect(releaseDetent('half', -30, -1.2, H)).toBe('full');
    // dragging down from full lands on half, then peek
    expect(releaseDetent('full', H * 0.3, 0, H)).toBe('half');
    expect(releaseDetent('full', H * 0.58, 0, H)).toBe('peek');
    // past the peek (or a fast downward flick from it) the sheet closes
    expect(releaseDetent('peek', H * 0.25, 0, H)).toBe('closed');
    expect(releaseDetent('peek', 40, 1.5, H)).toBe('closed');
    // a slow downward flick from half never closes - it rests on the peek
    expect(releaseDetent('half', 60, 0.35, H)).toBe('peek');
    // momentum projection: a 1 px/ms flick travels ~500 px at the default deceleration, in the flick's direction
    expect(project(1)).toBeCloseTo(499, 0);
    expect(project(-0.5)).toBeLessThan(0);
  });

  test('the drag offset follows the finger 1:1 inside the range and rubber-bands above the full height', () => {
    const H = 844;
    const rest = H - detentHeight('half', H);
    expect(dragOffset('half', 0, H)).toBe(rest);
    expect(dragOffset('half', 50, H)).toBe(rest + 50);
    const fullRest = H - detentHeight('full', H);
    const past = dragOffset('full', -200, H);
    expect(past).toBeLessThan(fullRest); // it does move up a little
    expect(fullRest - past).toBeLessThan(200 * 0.55); // but less than the finger, and less the further it goes
    expect(fullRest - dragOffset('full', -400, H)).toBeLessThan(2 * (fullRest - past));
    expect(rubberband(0, H)).toBe(0);
    expect(rubberband(100, H)).toBeGreaterThan(0);
    expect(rubberband(100, H)).toBeLessThan(100);
  });

  test('the spring easing: starts at 0, ends at 1, critically damped never overshoots, a bounce does once and settles', () => {
    const open = springSamples(SPRING_OPEN.response, SPRING_OPEN.bounce);
    expect(open[0]).toBe(0);
    expect(open[open.length - 1]).toBe(1);
    for (let i = 1; i < open.length; i++) expect(open[i]).toBeGreaterThanOrEqual(open[i - 1] - 1e-9);
    expect(Math.max(...open)).toBeLessThanOrEqual(1);
    const flick = springSamples(SPRING_FLICK.response, SPRING_FLICK.bounce);
    expect(Math.max(...flick)).toBeGreaterThan(1);
    expect(Math.max(...flick)).toBeLessThan(1.12);
    expect(flick[flick.length - 1]).toBe(1);
    expect(springLinear(0.3, 0)).toMatch(/^linear\(0, [\d., ]+1\)$/);
    expect(OPEN_MS).toBeGreaterThan(400);
    expect(OPEN_MS).toBeLessThan(700);
    expect(CLOSE_MS).toBeLessThan(OPEN_MS); // the exit is faster than the entrance
  });

  test('FLIP: the pop-up starts on the pressed tile - moved to its centre and scaled to its size - never from nothing', () => {
    const f = flipFrom({ x: 100, y: 200, w: 200, h: 80 }, { x: 420, y: 150, w: 560, h: 600 });
    // the tile is 80 px tall against a 600 px panel: the vertical scale floors at 0.2 (a visible sliver, never a line)
    expect(f).toEqual({ x: 100 + 100 - (420 + 280), y: 200 + 40 - (150 + 300), sx: 0.357, sy: 0.2 });
    expect(flipTransform(f)).toBe('translate(-500px, -210px) scale(0.357, 0.2)');
    expect(flipFrom({ x: 0, y: 0, w: 300, h: 300 }, { x: 0, y: 0, w: 600, h: 600 })).toEqual({ x: -150, y: -150, sx: 0.5, sy: 0.5 });
    expect(flipFrom({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1000, h: 1000 }).sx).toBe(0.2); // floor: a sliver, not a point
  });

  test('a person sees only the devices he may control; sensors are read-only values; equipment and passages stay out', () => {
    const rows = [
      row({ entity_id: 'light.a', can_control: true }),
      row({ entity_id: 'light.b', can_control: false }),
      row({ entity_id: 'switch.boiler', domain: 'switch', can_control: true }),
      row({ entity_id: 'vacuum.r', domain: 'vacuum', can_control: true }),
      row({ entity_id: 'cover.gate', domain: 'cover', can_control: true, door_class: true }),
      row({ entity_id: 'switch.zone', domain: 'switch', can_control: true, alarm_managed: true }),
    ];
    const equip = new Set(['vacuum', 'valve', 'water_heater']);
    expect(controllableRows({ entities: rows }, equip).map((r) => r.entity_id)).toEqual(['light.a', 'switch.boiler']);
    expect(controllableRows(null)).toEqual([]);
    const sens = [row({ entity_id: 's1', domain: 'sensor', can_control: false }), row({ entity_id: 's2', domain: 'sensor', can_control: false, available: false })];
    expect(sensorRows({ entities: sens }).map((r) => r.entity_id)).toEqual(['s1']);
    expect(sensorRows({ entities: Array.from({ length: 9 }, (_, i) => row({ entity_id: `s${i}`, domain: 'sensor' })) })).toHaveLength(6);
  });

  test('sections appear only with something to show or do: the quick strip needs the bulk right, the side lists need their permission', () => {
    const cards = { lighting: { entities: [row({ can_control: true })] }, covers: { entities: [row({ domain: 'cover', can_control: false })] }, sensors: { entities: [row({ domain: 'sensor' })] } };
    expect(sectionsFor({ cards, cameras: 0, scenes: 2, schedules: 0, events: 3, canBulk: true })).toEqual(['quick', 'lighting', 'sensors', 'scenes', 'events']);
    expect(sectionsFor({ cards, cameras: 1, scenes: 0, schedules: 1, events: 0, canBulk: false })).toEqual(['lighting', 'sensors', 'cameras', 'schedules']);
    expect(sectionsFor({ cards: null, cameras: 0, scenes: 0, schedules: 0, events: 0, canBulk: false })).toEqual([]);
    expect(peekSections(['quick', 'lighting', 'covers', 'scenes'])).toEqual(['quick', 'lighting']);
    expect(peekSections(['covers', 'scenes'])).toEqual(['covers']);
    const held = (p: string) => ['schedule.view', 'devices.control'].includes(p);
    expect(sideSectionsAllowed(held)).toEqual({ scenes: true, schedules: true, events: false, cameras: false });
    expect(sideSectionsAllowed(() => false)).toEqual({ scenes: false, schedules: false, events: false, cameras: false });
  });
});
