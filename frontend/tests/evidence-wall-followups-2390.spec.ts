import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { OFFLINE_HTML } from '../src/pwa/offline-page';
import {
  DESKTOP, FOLD4_INNER, FOLD_COVER, FOLD_INNER, FOLD_INNER_TURNED, PHONE, TABLET_L, TABLET_P,
  asDevice, expectApp, expectWall, foldTo, install, newMock, noOverflow, wall, type Dev,
} from './wall-followups-mocks';

// WALL-FOLLOWUPS-2390 (display D5; docs/changes/WALL-FOLLOWUPS-2390.md) against a mocked backend, on the desktop, tablet and
// mobile projects. Each project first plays ITS OWN device (the project's viewport, with the matching physical signals):
//   desktop  -> a desktop-class browser: the application, or the wall when the profile has "wall mode on desktop";
//   tablet   -> a tablet: the wall;
//   mobile   -> a phone: the application, whatever the profile says; and the book-style foldable, folded and unfolded, live.
// Then the acceptance walks of AT221 (CR-030 wall display: recognised by the device, presets, settings, remote refusal) and AT301
// (KIOPOL: distance legibility, burn-in, touch), split over the three projects so each runs where its device lives.
//   run_smart.py preview <branch> tests/evidence-wall-followups-2390.spec.ts --project=desktop --project=tablet --project=mobile
// Screenshots for the hand review go to SW_SHOTS=<dir> when set, else to the test's own output folder (test-results/, fetched from
// the runner); the pixel baselines are pixel-wall-followups-2390.spec.ts.
const SHOTS = process.env.SW_SHOTS ?? '';

async function shot(page: Page, name: string, project: string) {
  const file = SHOTS ? path.join(SHOTS, `wf2390-${name}-${project}.png`) : test.info().outputPath(`wf2390-${name}-${project}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
}

/** The project's own device, at the project's own viewport. */
function ownDevice(project: string, vw: number, vh: number): Dev {
  if (project === 'tablet') return { w: vw, h: vh, touch: true, mobile: false };
  if (project === 'mobile') return { w: vw, h: vh, touch: true, mobile: true };
  return { w: vw, h: vh, touch: false, mobile: false };
}

test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

test.describe('the project\'s own device', () => {
  test('without "wall mode on desktop": the wall on the tablet only', async ({ page }, info) => {
    const vp = page.viewportSize()!;
    const dev = ownDevice(info.project.name, vp.width, vp.height);
    await install(page, newMock({ desktop: false }));
    await asDevice(page, dev, false);
    await page.goto('/?design=a#/');
    if (info.project.name === 'tablet') {
      await expectWall(page, 'tablet-landscape');
      await expect(wall(page).locator('[data-wall-state="base"]')).toHaveAttribute('data-wall-class', 'tablet');
      await noOverflow(page);
    } else {
      await expectApp(page);
    }
    await shot(page, 'own-device-flag-off', info.project.name);
  });

  test('with "wall mode on desktop": the wall on the desktop and the tablet, never on the phone', async ({ page }, info) => {
    const vp = page.viewportSize()!;
    const dev = ownDevice(info.project.name, vp.width, vp.height);
    await install(page, newMock({ desktop: true }));
    await asDevice(page, dev, false);
    await page.goto('/?design=a#/');
    if (info.project.name === 'mobile') {
      await expectApp(page);
    } else {
      await expectWall(page, 'tablet-landscape');
      await expect(wall(page).locator('[data-wall-state="base"]')).toHaveAttribute('data-wall-class', info.project.name === 'desktop' ? 'desktop' : 'tablet');
      await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(4);
      await noOverflow(page);
      await expect(page.locator('sw-app >> [data-rail]')).toHaveCount(0); // no rail, no router chrome: the wall INSTEAD of the shell
    }
    await shot(page, 'own-device-flag-on', info.project.name);
  });
});

test.describe('desktop wall mode', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'a desktop-class browser: mouse, no touch');
  });

  test('the mouse pointer hides after 3 s at rest and comes back at once on movement', async ({ page }) => {
    await install(page, newMock({ desktop: true }));
    await asDevice(page, DESKTOP);
    await page.goto('/?design=a#/');
    await expectWall(page, 'tablet-landscape');
    await page.mouse.move(700, 450);
    await expect(wall(page)).not.toHaveAttribute('data-cursor-idle', '');
    await expect(wall(page)).toHaveAttribute('data-cursor-idle', '', { timeout: 6000 });
    expect(await wall(page).locator('[data-wall-clock]').evaluate((el) => getComputedStyle(el).cursor)).toBe('none');
    await page.mouse.move(720, 460);
    await expect(wall(page)).not.toHaveAttribute('data-cursor-idle', '');
  });

  test('the installer panel opens with a long mouse press and names the desktop class', async ({ page }) => {
    await install(page, newMock({ desktop: true }));
    await asDevice(page, DESKTOP);
    await page.goto('/?design=a#/');
    const clock = wall(page).locator('[data-wall-clock]');
    await expect(clock).toBeVisible();
    const box = (await clock.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await expect(wall(page).locator('[data-wall-panel]')).toContainText('desktop · 1440x900');
  });

  test('a small window on a large monitor keeps a readable scale; six cameras fill a 3 x 2 grid', async ({ page }) => {
    await install(page, newMock({ desktop: true, cams: 6 }));
    await asDevice(page, { w: 2560, h: 1440, touch: false, mobile: false }, false);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?design=a#/');
    await expectWall(page, 'tablet-landscape');
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(6);
    const s = await wall(page).locator('[data-wall-state="base"]').evaluate((el) => getComputedStyle(el).getPropertyValue('--s').trim());
    expect(Number(s)).toBe(1); // the window's short side (720) decides, not the monitor's (1440 -> 1.4)
    await noOverflow(page);
  });

  test('switching the flag off returns the desktop to the application on the next sign-in read', async ({ page }) => {
    const st = newMock({ desktop: true });
    await install(page, st);
    await asDevice(page, DESKTOP);
    await page.goto('/?design=a#/');
    await expectWall(page);
    st.desktop = false;
    await page.reload();
    await expectApp(page);
  });

  test('settings: the drawer\'s "מסך קיר גם במחשב" switch saves config.desktop', async ({ page }, info) => {
    const st = newMock({ admin: true });
    await install(page, st);
    await page.goto('/?design=a&look=performance:full#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-reception"]:visible').first().click();
    const drawer = page.locator('sw-drawer[data-wall-drawer]');
    const sw = drawer.locator('sw-toggle[data-wall-field="desktop"]');
    await expect(sw).toBeVisible();
    await expect(drawer.locator('[data-wall-desktop-note]')).toHaveCount(0);
    await sw.click();
    await expect(drawer.locator('[data-wall-desktop-note]')).toHaveText('מחשב בלי מגע יציג את מסך הקיר במקום המערכת');
    await shot(page, 'settings-drawer-desktop-on', info.project.name);
    await drawer.locator('[data-wall-save]').click();
    await expect.poll(() => st.patched.length).toBe(1);
    expect(st.patched[0].desktop, 'a field of the profile (WALL-ANSWERS-2400), not of config').toBe(true);
    expect((st.patched[0].config as Record<string, unknown>).desktop).toBeUndefined();
  });
});

test.describe('foldables: one page, folded and unfolded', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone-class device that unfolds into a small tablet');
  });

  test('folded -> the application; unfolded -> the wall in portrait; turned -> landscape; folded again -> the application; no reload', async ({ page }, info) => {
    await install(page, newMock());
    await asDevice(page, FOLD_COVER);
    await page.goto('/?design=a#/');
    await expectApp(page);
    await page.evaluate(() => ((window as unknown as { __sameDoc: number }).__sameDoc = 1));
    await shot(page, 'fold-cover', info.project.name);

    await foldTo(page, FOLD_INNER);
    await expectWall(page, 'tablet-portrait');
    await expect(wall(page).locator('[data-wall-state="base"]')).toHaveAttribute('data-wall-class', 'tablet');
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(2); // portrait: one column of two, the rest paged
    await noOverflow(page);
    await shot(page, 'fold-inner-portrait', info.project.name);

    await foldTo(page, FOLD_INNER_TURNED);
    await expectWall(page, 'tablet-landscape');
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(4);
    await noOverflow(page);
    await shot(page, 'fold-inner-landscape', info.project.name);

    await foldTo(page, FOLD_COVER);
    await expectApp(page);
    expect(await page.evaluate(() => (window as unknown as { __sameDoc?: number }).__sameDoc)).toBe(1); // swapped in place
  });

  test('the Fold 3/4 inner screen (673x841, "Mobile") is a tablet now', async ({ page }) => {
    await install(page, newMock());
    await asDevice(page, FOLD4_INNER);
    await page.goto('/?design=a#/');
    await expectWall(page, 'tablet-portrait');
    await noOverflow(page);
  });

  test('a tall 7 inch screen with a phone user agent (600x960) stays a phone', async ({ page }) => {
    await install(page, newMock());
    await asDevice(page, { w: 600, h: 960, touch: true, mobile: true });
    await page.goto('/?design=a#/');
    await expectApp(page);
  });

  test('the on-screen keyboard shrinks the window, never the class: the wall stays', async ({ page }) => {
    await install(page, newMock());
    await asDevice(page, FOLD_INNER);
    await page.goto('/?design=a#/');
    await expectWall(page, 'tablet-portrait');
    await page.setViewportSize({ width: 690, height: 420 }); // the screen is unchanged
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(600);
    await expect(wall(page)).toHaveCount(1);
  });
});

// ---- AT221: CR-030 wall display - a wall user recognised by the tablet it signs in on, the wall shell with tablet presets,
// Settings > מסכי קיר, refused on the remote channel. Each project runs the part that lives on its device.
test.describe('AT221 acceptance', () => {
  test('recognised by the device: wall shell on a tablet, the application on a phone and a desktop', async ({ page }, info) => {
    const dev = info.project.name === 'tablet' ? TABLET_L : info.project.name === 'mobile' ? PHONE : DESKTOP;
    await install(page, newMock());
    await asDevice(page, dev);
    await page.goto('/?design=a#/');
    if (info.project.name === 'tablet') {
      await expectWall(page, 'tablet-landscape');
      await expect(wall(page).locator('[data-wall-title]')).toHaveText('קבלה');
    } else {
      await expectApp(page);
    }
  });

  test('a tablet and a user without a wall profile: the application', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'the tablet case');
    await install(page, newMock({ wall: false }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expectApp(page);
  });

  test('the two tablet presets: landscape grid and portrait column, video never mirrored', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'the tablet case');
    for (const [dev, preset, tiles] of [[TABLET_L, 'tablet-landscape', 4], [TABLET_P, 'tablet-portrait', 2]] as const) {
      await install(page, newMock());
      await asDevice(page, dev);
      await page.goto('/?design=a#/');
      await expectWall(page, preset);
      await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(tiles);
      expect(await wall(page).locator('[data-wall-tile]').first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
      await noOverflow(page);
      await shot(page, `at221-${preset}`, info.project.name);
    }
  });

  test('remote channel refused: the wall says so and shows no video', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'the tablet case');
    await install(page, newMock({ channel: 'remote', configStatus: 403, configBody: { code: 'wall_user_remote_not_allowed', user_message: 'x' } }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(wall(page).locator('[data-wall-state="remote-refused"]')).toContainText('אינו מורשה להתחבר מרחוק');
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(0);
  });

  test('Settings > מסכי קיר: the list as a table on wide screens, as cards on a phone', async ({ page }, info) => {
    await install(page, newMock({ admin: true }));
    await page.goto('/?design=a&look=performance:full#/system/wall');
    const narrow = page.viewportSize()!.width <= 720;
    await expect(page.locator(narrow ? 'system-wall [data-wall-card]' : 'system-wall [data-wall-row]')).toHaveCount(2);
    await expect(page.locator('system-wall [data-wall-count]')).toHaveText('2 / 20 מסכים');
    expect(await page.locator('body').innerText()).not.toMatch(/Home Assistant/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'at221-settings', info.project.name);
  });
});

// ---- AT301: KIOPOL - distance legibility, burn-in protection, touch.
test.describe('AT301 acceptance', () => {
  test('distance legibility: the clock is the largest text, chips are 44 px touch targets', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the wall is not offered on a phone');
    const dev = info.project.name === 'tablet' ? TABLET_L : DESKTOP;
    await install(page, newMock({ desktop: true }));
    await asDevice(page, dev);
    await page.goto('/?design=a#/');
    await expectWall(page);
    const m = await wall(page).evaluate((w) => {
      const r = w.shadowRoot!;
      const px = (sel: string) => parseFloat(getComputedStyle(r.querySelector(sel) as HTMLElement).fontSize);
      const chip = r.querySelector('.strip .chip') as HTMLElement | null;
      return { clock: px('[data-wall-clock]'), title: px('[data-wall-title]'), chip: chip ? chip.getBoundingClientRect().height : 0 };
    });
    expect(m.clock, 'the clock is read from across the room').toBeGreaterThan(m.title);
    expect(m.chip, 'a strip chip is a 44 px target').toBeGreaterThanOrEqual(43.5);
  });

  test('burn-in: the picture glides within +-2 px a minute, and dims after the idle time', async ({ page }, info) => {
    test.skip(info.project.name !== 'tablet', 'the tablet case');
    await page.clock.install({ time: new Date('2026-11-04T08:00:00Z') });
    await install(page, newMock());
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expectWall(page);
    const base = wall(page).locator('[data-wall-state="base"]');
    const read = () => base.evaluate((el) => {
      const st = (el as HTMLElement).style;
      const t = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(st.transform) ?? ['', '0', '0'];
      return { x: Number(t[1]), y: Number(t[2]), opacity: Number(st.opacity) };
    });
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const v = await read();
      expect(Math.abs(v.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(2);
      expect(v.opacity).toBe(1);
      seen.add(`${v.x},${v.y}`);
      await page.clock.fastForward('01:00');
      await page.waitForTimeout(200);
    }
    expect(seen.size, 'the position moves with the minutes').toBeGreaterThan(1);
    await page.clock.fastForward('30:00');
    await expect.poll(async () => (await read()).opacity).toBe(0.6);
  });

  test('touch: a phone gets the 48 px retry of the offline page in both schemes, RTL', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone PWA case');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setContent(OFFLINE_HTML);
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      await expect(page.locator('h1')).toHaveText('אין חיבור לשרת');
      const box = (await page.locator('a').first().boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});
