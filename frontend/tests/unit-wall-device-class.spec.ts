import { test, expect } from '@playwright/test';
import { classifyDevice, wallModeFor, type DeviceEnv } from '../src/wall/device-class';

// CR-030 section 3.2.1: the worked table of the detection rule, one assertion per row. Node only (the pure function).
const touch = (w: number, h: number, mobileUA = false, over: Partial<DeviceEnv> = {}): DeviceEnv => ({ maxTouchPoints: 5, coarsePointer: true, hoverNone: true, screenWidth: w, screenHeight: h, mobileUA, ...over });
const mouse = (w: number, h: number, over: Partial<DeviceEnv> = {}): DeviceEnv => ({ maxTouchPoints: 0, coarsePointer: false, hoverNone: false, screenWidth: w, screenHeight: h, mobileUA: false, ...over });

const TABLE: [string, DeviceEnv, 'tablet' | 'phone' | 'desktop'][] = [
  ['iPad Air Safari 820x1180 (Mac UA, 5 touch points)', touch(820, 1180), 'tablet'],
  ['iPad mini 744x1133', touch(744, 1133), 'tablet'],
  ['Galaxy Tab A9 800x1340 (no Mobile token)', touch(800, 1340), 'tablet'],
  ['Fire HD 8 800x1280 (Silk)', touch(800, 1280), 'tablet'],
  ['a 7 inch Android 600x1024', touch(600, 1024), 'tablet'],
  ['iPhone 15 393x852', touch(393, 852, true), 'phone'],
  ['Pixel 8 412x915 (Mobile)', touch(412, 915, true), 'phone'],
  ['foldable unfolded 673x841 with Mobile: a phone (under 700)', touch(673, 841, true), 'phone'],
  ['foldable unfolded 904x1136', touch(904, 1136, true), 'tablet'],
  ['large tablet landscape 1920x1200', touch(1920, 1200), 'tablet'],
  ['Windows touch laptop (fine primary pointer)', mouse(1920, 1080, { maxTouchPoints: 10 }), 'desktop'],
  ['desktop 1440x900', mouse(1440, 900), 'desktop'],
  ['the same tablet with the keyboard open (the screen is unchanged)', touch(1280, 800), 'tablet'],
  ['rotation never flips the class (800x1280 and 1280x800)', touch(1280, 800), 'tablet'],
  ['hover:none alone with touch points is touch (Chromebook tablet mode reports coarse)', touch(1200, 800, false, { coarsePointer: false }), 'tablet'],
  ['touch points but a fine pointer with hover (laptop)', touch(1366, 768, false, { coarsePointer: false, hoverNone: false }), 'desktop'],
  ['exactly 599 short side', touch(599, 1000), 'phone'],
  ['exactly 600 short side', touch(600, 1000), 'tablet'],
  ['699 with a Mobile token', touch(699, 1200, true), 'phone'],
  ['700 with a Mobile token', touch(700, 1200, true), 'tablet'],
];

for (const [name, env, expected] of TABLE) {
  test(`device class: ${name} -> ${expected}`, () => {
    expect(classifyDevice(env)).toBe(expected);
  });
}

test('the viewport is never an input: a keyboard-shrunk window changes nothing', () => {
  const env = touch(1280, 800);
  expect(classifyDevice(env)).toBe('tablet');
  expect(classifyDevice({ ...env })).toBe(classifyDevice(env));
});

test('wall mode needs an enabled profile AND a tablet', () => {
  const me = { wall: { enabled: true } };
  expect(wallModeFor(me, 'tablet')).toBe(true);
  expect(wallModeFor(me, 'phone')).toBe(false);
  expect(wallModeFor(me, 'desktop')).toBe(false);
  expect(wallModeFor({ wall: null }, 'tablet')).toBe(false);
  expect(wallModeFor({}, 'tablet')).toBe(false);
  expect(wallModeFor(null, 'tablet')).toBe(false);
});
