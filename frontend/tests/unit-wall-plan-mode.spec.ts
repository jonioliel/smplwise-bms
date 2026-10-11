import { test, expect } from '@playwright/test';
import { FOLLOW_PLAN, NO_PINS, WALL_IDLE_KEY, WALL_QUALITY_KEY, applyWallParams, idleOf, planModeOf, qualityOf, readWallPins, resolveWallPlan, type WallPins } from '../src/map/wall-plan-mode';
import { WALL_DISPLAY_KEY } from '../src/map/quality-ladder';

// Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 7, CR-030 section 4, docs/changes/CR-029-ST7-S5B-NOTES.md) in node: how a wall
// display decides what its plan shows - the screen's own setting beats this browser's pin beats the installation's dials; `follow`
// hands a dial down; a quality is forced only when the screen or the browser says so; the route's wall parameters pin the browser.

const DIALS = { wall_display: 'live', quality: 'auto', kiosk_idle_s: 30 } as const;

function store(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

test.describe('the three layers', () => {
  test('nothing set: the installation decides, and no quality is forced', () => {
    const p = resolveWallPlan(FOLLOW_PLAN, NO_PINS, DIALS);
    expect(p).toEqual({ mode: 'live', quality: null, idleS: 30, from: { mode: 'installation', quality: null, idleS: 'installation' } });
    expect(resolveWallPlan(undefined, undefined, { ...DIALS, wall_display: 'stills', kiosk_idle_s: 0 })).toMatchObject({ mode: 'stills', idleS: 0 });
  });

  test("the screen's own setting beats the browser's pin and the installation, per dial", () => {
    const pins: WallPins = { mode: 'live', quality: 'full', idleS: 600 };
    const p = resolveWallPlan({ mode: 'stills', quality: 'schematic', idle_s: 10 }, pins, DIALS);
    expect(p).toEqual({ mode: 'stills', quality: 'schematic', idleS: 10, from: { mode: 'screen', quality: 'screen', idleS: 'screen' } });
  });

  test("follow hands a dial to the browser's pin, then to the installation - each dial on its own", () => {
    const pins: WallPins = { mode: 'stills', quality: null, idleS: 120 };
    const p = resolveWallPlan({ mode: 'follow', quality: 'realistic', idle_s: 'follow' }, pins, DIALS);
    expect(p).toEqual({ mode: 'stills', quality: 'realistic', idleS: 120, from: { mode: 'browser', quality: 'screen', idleS: 'browser' } });
    const q = resolveWallPlan({ mode: 'live', quality: 'follow', idle_s: 'follow' }, { mode: null, quality: 'lite', idleS: null }, DIALS);
    expect(q).toEqual({ mode: 'live', quality: 'lite', idleS: 30, from: { mode: 'screen', quality: 'browser', idleS: 'installation' } });
  });

  test('idle 0 is a real value ("never"), at every layer', () => {
    expect(resolveWallPlan({ idle_s: 0 }, NO_PINS, DIALS).idleS).toBe(0);
    expect(resolveWallPlan({ idle_s: 'follow' }, { mode: null, quality: null, idleS: 0 }, DIALS).idleS).toBe(0);
    expect(resolveWallPlan(null, NO_PINS, { ...DIALS, kiosk_idle_s: 0 }).idleS).toBe(0);
    expect(resolveWallPlan({ idle_s: 0 }, NO_PINS, DIALS).from.idleS).toBe('screen');
  });

  test('garbage in the setting counts as follow, never as a value', () => {
    const p = resolveWallPlan({ mode: 'main' as never, quality: 'ultra' as never, idle_s: 7 as never }, NO_PINS, DIALS);
    expect(p).toEqual({ mode: 'live', quality: null, idleS: 30, from: { mode: 'installation', quality: null, idleS: 'installation' } });
    expect(resolveWallPlan(null, NO_PINS, { wall_display: 'x' as never, quality: 'auto', kiosk_idle_s: 5 as never })).toMatchObject({ mode: 'live', idleS: 0 });
  });

  test('the value helpers', () => {
    expect(planModeOf('stills')).toBe('stills');
    expect(planModeOf('follow')).toBeNull();
    expect(idleOf('120')).toBe(120);
    expect(idleOf(0)).toBe(0);
    expect(idleOf(7)).toBeNull();
    expect(idleOf('')).toBeNull();
    expect(qualityOf('lite')).toBe('lite');
    expect(qualityOf('1')).toBe('schematic'); // the legacy level digits
    expect(qualityOf('ultra')).toBeNull();
  });
});

test.describe("this browser's pins (the route's wall parameters)", () => {
  test('?display=wall with plan, quality and idle pins the browser and answers the pins in force', () => {
    const s = store();
    const pins = applyWallParams('?display=wall&plan=stills&quality=schematic&idle=120', s);
    expect(pins).toEqual({ mode: 'stills', quality: 'schematic', idleS: 120 });
    expect(s.m.get(WALL_DISPLAY_KEY)).toBe('stills');
    expect(s.m.get(WALL_QUALITY_KEY)).toBe('schematic');
    expect(s.m.get(WALL_IDLE_KEY)).toBe('120');
    expect(readWallPins(s)).toEqual(pins); // remembered: the next load has no parameters
    expect(applyWallParams('', s)).toEqual(pins);
  });

  test('a parameter set to - or follow removes that pin; others stay; unknown values change nothing', () => {
    const s = store({ [WALL_DISPLAY_KEY]: 'stills', [WALL_QUALITY_KEY]: 'full', [WALL_IDLE_KEY]: '30' });
    expect(applyWallParams('?display=wall&plan=-&quality=ultra&idle=follow', s)).toEqual({ mode: null, quality: 'full', idleS: null });
    expect(applyWallParams('?display=wall&idle=7&plan=maybe', s)).toEqual({ mode: null, quality: 'full', idleS: null });
  });

  test('?display=desk clears every pin; the parameters do nothing without display=wall', () => {
    const s = store({ [WALL_DISPLAY_KEY]: 'stills', [WALL_QUALITY_KEY]: 'full', [WALL_IDLE_KEY]: '30' });
    expect(applyWallParams('?plan=live&idle=600', s)).toEqual({ mode: 'stills', quality: 'full', idleS: 30 });
    expect(applyWallParams('?display=desk', s)).toEqual(NO_PINS);
    expect(s.m.size).toBe(0);
  });

  test('blocked storage (private mode) never throws: the pins are simply absent', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readWallPins(broken)).toEqual(NO_PINS);
    expect(applyWallParams('?display=wall&plan=stills', broken)).toEqual(NO_PINS);
    expect(applyWallParams('?display=desk', broken)).toEqual(NO_PINS);
    expect(readWallPins(null)).toEqual(NO_PINS);
    expect(applyWallParams('?display=wall&plan=stills', null)).toEqual(NO_PINS);
  });
});
