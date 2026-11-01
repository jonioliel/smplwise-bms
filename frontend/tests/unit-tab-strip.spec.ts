import { test, expect } from '@playwright/test';
import { EDGE_SLOP, fadeOf, moreSides, nextIndex, pageDelta, revealDelta, sideSign, wheelDelta, wheelPixels, type Extent } from '../src/components/tab-strip';

// SETTINGS-TABS-SCROLL-2331: the arithmetic of the scrolling tab strip (sw-tabs bar forms), no browser needed.
//   npx playwright test tests/unit-tab-strip.spec.ts --project=desktop

// a 400 px box at x = 100..500 with 1000 px of tabs
const atStartRtl: Extent = { boxLeft: 100, boxRight: 500, minLeft: -500, maxRight: 500 }; // RTL, scrolled to the start (right edge)
const middle: Extent = { boxLeft: 100, boxRight: 500, minLeft: -200, maxRight: 800 };
const atStartLtr: Extent = { boxLeft: 100, boxRight: 500, minLeft: 100, maxRight: 1100 };
const fits: Extent = { boxLeft: 100, boxRight: 500, minLeft: 120, maxRight: 480 };

test.describe('edges', () => {
  test('the physical fade and the reading-side arrows', () => {
    expect(fadeOf(atStartRtl)).toBe('left');
    expect(moreSides(atStartRtl, true)).toEqual({ start: false, end: true });
    expect(fadeOf(atStartLtr)).toBe('right');
    expect(moreSides(atStartLtr, false)).toEqual({ start: false, end: true });
    expect(fadeOf(middle)).toBe('both');
    expect(moreSides(middle, true)).toEqual({ start: true, end: true });
    expect(fadeOf(fits)).toBe('');
    expect(moreSides(fits, true)).toEqual({ start: false, end: false });
  });
  test('a sub-pixel sliver does not count as hidden', () => {
    expect(fadeOf({ boxLeft: 100, boxRight: 500, minLeft: 100 - EDGE_SLOP / 2, maxRight: 500 + EDGE_SLOP / 2 })).toBe('');
  });
});

test.describe('arrows', () => {
  test('the end is to the left in RTL and to the right in LTR', () => {
    expect(sideSign('end', true)).toBe(-1);
    expect(sideSign('start', true)).toBe(1);
    expect(sideSign('end', false)).toBe(1);
    expect(sideSign('start', false)).toBe(-1);
  });
  test('one click scrolls 80% of the box toward that side, never past the last tab', () => {
    expect(pageDelta('end', true, atStartRtl)).toBe(-320);
    expect(pageDelta('start', true, atStartRtl)).toBe(0); // nothing hidden at the start
    expect(pageDelta('end', false, atStartLtr)).toBe(320);
    expect(pageDelta('end', true, { boxLeft: 100, boxRight: 500, minLeft: 40, maxRight: 900 })).toBe(-60); // only 60 px left to show
    expect(pageDelta('start', true, middle)).toBe(300); // 300 px hidden on the right
  });
});

test.describe('wheel', () => {
  test('a vertical wheel scrolls sideways toward the end (down) or the start (up)', () => {
    expect(wheelDelta(0, 100, true, atStartRtl, 1)).toBe(-100);
    expect(wheelDelta(0, 100, false, atStartLtr, 1)).toBe(100);
    expect(wheelDelta(0, -100, true, middle, 1)).toBe(100);
  });
  test('at the edge, on a horizontal gesture or when nothing overflows the page keeps the wheel', () => {
    expect(wheelDelta(0, -100, true, atStartRtl, 1)).toBe(0); // already at the start
    expect(wheelDelta(120, 40, true, middle, 1)).toBe(0); // the trackpad's own sideways scroll
    expect(wheelDelta(0, 100, true, fits, 1)).toBe(0);
    expect(wheelDelta(0, 0, true, middle, 1)).toBe(0);
  });
  test('lines and pages become pixels', () => {
    expect(wheelPixels(3, 0, 400)).toBe(3);
    expect(wheelPixels(3, 1, 400)).toBe(48);
    expect(wheelPixels(1, 2, 400)).toBe(400);
  });
});

test.describe('keyboard', () => {
  test('in RTL ArrowLeft is the next tab and ArrowRight the previous, wrapping around', () => {
    expect(nextIndex('ArrowLeft', 0, 5, true)).toBe(1);
    expect(nextIndex('ArrowRight', 0, 5, true)).toBe(4);
    expect(nextIndex('ArrowLeft', 4, 5, true)).toBe(0);
  });
  test('in LTR ArrowRight is the next tab', () => {
    expect(nextIndex('ArrowRight', 1, 5, false)).toBe(2);
    expect(nextIndex('ArrowLeft', 1, 5, false)).toBe(0);
  });
  test('Home / End jump to the ends; other keys are not navigation', () => {
    expect(nextIndex('Home', 3, 5, true)).toBe(0);
    expect(nextIndex('End', 0, 5, true)).toBe(4);
    expect(nextIndex('Enter', 0, 5, true)).toBeNull();
    expect(nextIndex('ArrowDown', 0, 5, true)).toBeNull();
    expect(nextIndex('End', 0, 0, true)).toBeNull();
  });
});

test.describe('reveal', () => {
  test('a tab past an edge comes into view clear of the arrow and the fade', () => {
    expect(revealDelta(100, 500, 520, 600, 52)).toBe(600 - (500 - 52)); // past the right edge
    expect(revealDelta(100, 500, 20, 90, 52)).toBe(20 - (100 + 52)); // past the left edge
    expect(revealDelta(100, 500, 200, 300, 52)).toBe(0); // already clear
  });
  test('a tab wider than the box minus the room is centred rather than pushed past the other edge', () => {
    // a 380 px tab in a 400 px box: 10 px of room each side
    expect(revealDelta(100, 500, 300, 680, 52)).toBe(680 - 490);
  });
});
