import { test, expect } from '@playwright/test';
import { classifyDevice, envKey, FOLDABLE_MAX_ASPECT, SETTLE_MS, wallModeFor, watchDeviceClass, type DeviceEnv } from '../src/wall/device-class';

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
  // WALL-FOLLOWUPS-2390: an unfolded foldable (near-square inner screen) is a tablet even with the Mobile token (was: phone)
  ['foldable unfolded 673x841 with Mobile (Galaxy Z Fold 3/4): a tablet', touch(673, 841, true), 'tablet'],
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
  // WALL-FOLLOWUPS-2390: the foldable edge, folded and unfolded, in both orientations
  ['Galaxy Z Fold 5 folded (cover screen 344x882, Mobile)', touch(344, 882, true), 'phone'],
  ['Galaxy Z Fold 5 unfolded 690x829 (Mobile)', touch(690, 829, true), 'tablet'],
  ['Galaxy Z Fold 5 unfolded, turned 829x690 (Mobile)', touch(829, 690, true), 'tablet'],
  ['Pixel Fold unfolded 841x701 (Mobile)', touch(841, 701, true), 'tablet'],
  ['a folded cover screen 412x892 (Mobile)', touch(412, 892, true), 'phone'],
  ['a 7 inch tablet that sends a phone UA, 600x960 (tall): still a phone', touch(600, 960, true), 'phone'],
  ['a tall 650x1150 with a phone UA (1.77): a phone', touch(650, 1150, true), 'phone'],
  ['exactly at the aspect bound with a phone UA (600x840 = 1.4): a phone', touch(600, 840, true), 'phone'],
  ['just under the aspect bound with a phone UA (600x839): a tablet', touch(600, 839, true), 'tablet'],
  ['a window spread over the hinge (two viewport segments), tall shape, Mobile', touch(620, 1000, true, { segments: 2 }), 'tablet'],
  ['two segments never make a phone-sized screen a tablet (Surface Duo single 540x720)', touch(540, 720, true, { segments: 2 }), 'phone'],
  ['a near-square screen with a fine pointer is still a desktop', mouse(1000, 900), 'desktop'],
];

for (const [name, env, expected] of TABLE) {
  test(`device class: ${name} -> ${expected}`, () => {
    expect(classifyDevice(env)).toBe(expected);
  });
}

test('the foldable bound is the documented 1.4', () => {
  expect(FOLDABLE_MAX_ASPECT).toBe(1.4);
});

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
  expect(wallModeFor({ wall: { enabled: true, desktop: false } }, 'desktop')).toBe(false);
  expect(wallModeFor({ wall: null }, 'tablet')).toBe(false);
  expect(wallModeFor({}, 'tablet')).toBe(false);
  expect(wallModeFor(null, 'tablet')).toBe(false);
});

// ---- WALL-FOLLOWUPS-2390: "wall mode on desktop" and the live re-read on fold / unfold
test('desktop wall mode: the profile flag adds desktops, never phones, and never without an enabled profile', () => {
  const me = { wall: { enabled: true, desktop: true } };
  expect(wallModeFor(me, 'desktop')).toBe(true);
  expect(wallModeFor(me, 'tablet')).toBe(true);
  expect(wallModeFor(me, 'phone')).toBe(false);
  expect(wallModeFor({ wall: { enabled: false, desktop: true } }, 'desktop')).toBe(false);
  expect(wallModeFor({ wall: { enabled: true, desktop: 'yes' as unknown as boolean } }, 'desktop')).toBe(false); // only a real true
});

test('the change key moves with the class and the physical screen, not with anything else', () => {
  const a = touch(690, 829, true);
  expect(envKey(a)).toBe(envKey({ ...a }));
  expect(envKey(touch(344, 882, true))).not.toBe(envKey(a)); // fold
  expect(envKey(touch(829, 690, true))).not.toBe(envKey(a)); // the screen turned: the size moved, the class did not
  expect(envKey({ ...a, segments: 2 })).not.toBe(envKey(a));
  expect(envKey({ ...a, coarsePointer: false })).toBe(envKey(a)); // hover:none still says touch: same class, same screen
});

/** A minimal browser for the watcher in Node: window events, timers and a screen that the test folds. */
function fakeWindow() {
  const w = new EventTarget() as EventTarget & { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout; screen?: unknown };
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;
  return w;
}

test('fold / unfold: one call per settled change, transient sizes and keyboard resizes ignored', async () => {
  const g = globalThis as unknown as { window?: unknown };
  const saved = g.window;
  const win = fakeWindow();
  g.window = win;
  try {
    let env = touch(344, 882, true); // folded
    const seen: string[] = [];
    const stop = watchDeviceClass((e) => seen.push(classifyDevice(e)), () => env);
    // a keyboard opens: the viewport resizes, the screen does not
    win.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, SETTLE_MS + 60));
    expect(seen).toEqual([]);
    // unfold: the animation passes through odd sizes before it settles
    for (const [w, h] of [[400, 860], [520, 850], [690, 829]] as const) {
      env = touch(w, h, true);
      win.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 40));
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS + 60));
    expect(seen).toEqual(['tablet']);
    // fold again
    env = touch(344, 882, true);
    win.dispatchEvent(new Event('orientationchange'));
    await new Promise((r) => setTimeout(r, SETTLE_MS + 60));
    expect(seen).toEqual(['tablet', 'phone']);
    stop();
    env = touch(690, 829, true);
    win.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, SETTLE_MS + 60));
    expect(seen).toEqual(['tablet', 'phone']); // unsubscribed
  } finally {
    g.window = saved;
  }
});
