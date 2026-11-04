import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FOLD_COVER, FOLD_INNER, FOLD_INNER_TURNED, TABLET_L, TABLET_P, asDevice, expectApp, expectWall, foldTo, install, newMock, wall, type Dev } from './wall-followups-mocks';

// WALL-ANSWERS-2400 (docs/changes/WALL-ANSWERS-2400.md): the owner's answers of 04.11 (round 18) on the wall display, against a
// mocked backend. The physical device is emulated by the spec (wall-followups-mocks.ts asDevice), so each group runs in ONE project:
//   question 18     an open foldable: tablet (default) or phone (setting) -> mobile project; the settings row -> desktop + mobile
//   question 19 (1) "המערכת תקינה" twice on a portrait wall          -> desktop project
//   question 19 (2) the kiosk header on a phone spills over the tiles -> mobile project (Pixel 7 emulation, touch)
//   question 20     "מסך קיר גם במחשב" is a field of the profile      -> evidence-wall-followups-2390.spec.ts (the drawer save) + backend
//   run_smart.py preview <branch> tests/evidence-wall-answers-2400.spec.ts --project=desktop --project=mobile
// Screenshots for the hand review go to the test's own output folder (test-results/, fetched from the runner).

async function shot(page: Page, name: string) {
  const file = test.info().outputPath(`wa2400-${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
}

test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

test.describe('question 19 (1): the status chips have one home on the wall', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  for (const [name, dev, preset, home] of [
    ['portrait tablet 800x1280', TABLET_P, 'tablet-portrait', 'band'],
    ['unfolded foldable, portrait 690x829', FOLD_INNER, 'tablet-portrait', 'band'],
    ['landscape tablet 1280x800', TABLET_L, 'tablet-landscape', 'strip'],
  ] as const) {
    test(`${name}: "המערכת תקינה" once, in the ${home}`, async ({ page }) => {
      await install(page, newMock({ cams: 4 }));
      await asDevice(page, dev);
      await page.goto('/?design=a#/');
      await expectWall(page, preset);
      const health = wall(page).locator('[data-wall-health]');
      await expect(health.first()).toHaveText('המערכת תקינה'); // the health read landed
      await expect(health, 'exactly one health chip on the screen').toHaveCount(1);
      const inStrip = wall(page).locator('[data-wall-strip] [data-wall-health]');
      const inBand = wall(page).locator('[data-wall-band] [data-wall-health]');
      await expect(inStrip).toHaveCount(home === 'strip' ? 1 : 0);
      await expect(inBand).toHaveCount(home === 'band' ? 1 : 0);
      await expect(wall(page).locator('[data-wall-band]')).toHaveCount(home === 'band' ? 1 : 0);
      // the strip still carries the title and the clock in portrait
      await expect(wall(page).locator('[data-wall-strip] [data-wall-title]')).toBeVisible();
      await expect(wall(page).locator('[data-wall-strip] [data-wall-clock]')).toBeVisible();
      const over = await wall(page).evaluate((w) => {
        const r = w.shadowRoot?.querySelector('.wall') as HTMLElement | null;
        return r ? { x: r.scrollWidth - r.clientWidth, y: r.scrollHeight - r.clientHeight } : { x: 0, y: 0 };
      });
      expect(over, 'no overflow either way').toEqual({ x: 0, y: 0 });
      await shot(page, `health-${preset}-${dev.w}x${dev.h}`);
    });
  }
});

test.describe('question 19 (2): the kiosk header on a phone stays above the cameras', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone project (Pixel 7 emulation, touch)');
  });

  const PHONES: [string, Dev][] = [
    ['a folded cover screen 344x882', FOLD_COVER],
    ['a small phone 360x780', { w: 360, h: 780, touch: true, mobile: true }],
    ['iPhone-size 393x852', { w: 393, h: 852, touch: true, mobile: true }],
    ['Pixel-size 412x915', { w: 412, h: 915, touch: true, mobile: true }],
  ];
  for (const [name, dev] of PHONES) {
    test(`${name}: nothing of the header spills out of it, the first camera starts under it`, async ({ page }) => {
      await install(page, newMock({ cams: 6 })); // a kiosk-only wall user: the shell keeps a phone on #/kiosk/all
      await asDevice(page, dev);
      await page.goto('/?design=a#/');
      const kiosk = page.locator('kiosk-wall');
      await expect(kiosk).toHaveCount(1);
      await expect(kiosk.locator('sw-camera-tile[data-kiosk-tile]').first()).toBeVisible();
      await expect(kiosk.locator('[data-kiosk-health]')).toBeVisible(); // the header is complete (the health read landed)
      await page.waitForTimeout(400);
      const m = await kiosk.evaluate((el) => {
        const root = el.shadowRoot!;
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        const header = root.querySelector('header')!;
        return {
          header: box(header),
          headerScroll: header.scrollHeight - header.clientHeight,
          children: Array.from(header.children).filter((c) => (c as HTMLElement).offsetParent !== null || c.getBoundingClientRect().height > 0).map((c) => ({ tag: c.tagName.toLowerCase(), cls: (c as HTMLElement).className, ...box(c) })),
          clock: box(root.querySelector('[data-kiosk-clock]')!),
          tiles: Array.from(root.querySelectorAll('sw-camera-tile[data-kiosk-tile]')).map(box),
          grid: box(root.querySelector('.grid')!),
          vw: innerWidth,
          sideways: document.documentElement.scrollWidth - innerWidth,
        };
      });
      test.info().annotations.push({ type: 'measure', description: JSON.stringify(m) });
      for (const c of m.children) {
        expect(c.bottom, `${c.tag}.${c.cls} stays inside the header (bottom)`).toBeLessThanOrEqual(m.header.bottom + 1);
        expect(c.top, `${c.tag}.${c.cls} stays inside the header (top)`).toBeGreaterThanOrEqual(m.header.top - 1);
        expect(c.left, `${c.tag}.${c.cls} is not cut off at the left`).toBeGreaterThanOrEqual(-1);
        expect(c.right, `${c.tag}.${c.cls} is not cut off at the right`).toBeLessThanOrEqual(m.vw + 1);
      }
      // (the header's own scrollHeight is not asserted: the clock numeral's glyph box overhangs its line box by a few px, which
      //  is no visible spill; every child box above stays inside the header, which is what the bug broke)
      expect(m.grid.top, 'the cameras start under the header').toBeGreaterThanOrEqual(m.header.bottom - 1);
      for (const [i, t] of m.tiles.entries()) {
        const overlaps = m.clock.bottom > t.top + 1 && m.clock.top < t.bottom - 1 && m.clock.right > t.left + 1 && m.clock.left < t.right - 1;
        expect(overlaps, `the clock is not drawn over camera ${i + 1}`).toBe(false);
      }
      expect(m.sideways, 'no sideways scroll').toBeLessThanOrEqual(0);
      await shot(page, `kiosk-phone-${dev.w}x${dev.h}`);
    });
  }
});

test.describe('question 18: an unfolded foldable follows the installation setting', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone-class device that unfolds into a small tablet');
  });

  test('default (tablet): unfolded -> the wall, folded -> the application', async ({ page }) => {
    await install(page, newMock({ cams: 4 }));
    await asDevice(page, FOLD_INNER);
    await page.goto('/?design=a#/');
    await expectWall(page, 'tablet-portrait');
    await foldTo(page, FOLD_COVER);
    await expectApp(page);
  });

  test('setting "phone": unfolded, turned and folded -> always the application (the kiosk for a kiosk-only user); a real tablet keeps the wall', async ({ page }) => {
    const st = newMock({ cams: 4, foldable: 'phone' });
    await install(page, st);
    await asDevice(page, FOLD_INNER);
    await page.goto('/?design=a#/');
    await expectApp(page);
    await expect(page.locator('kiosk-wall')).toHaveCount(1); // a kiosk-only wall user on a phone-class device: the kiosk route
    await shot(page, 'foldable-phone-inner');
    for (const dev of [FOLD_INNER_TURNED, FOLD_COVER, FOLD_INNER]) {
      await foldTo(page, dev);
      await page.waitForTimeout(400); // past the 250 ms settle of the class watcher
      await expectApp(page);
    }
    await foldTo(page, TABLET_P); // the same setting never moves a real tablet
    await expectWall(page, 'tablet-portrait');
  });
});

test.describe('question 18: the settings row (Settings > wall displays), administrators only', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone are enough for a settings row');
  });

  test('one select under the list; a change is saved at once and the list answer carries it', async ({ page }, info) => {
    const st = newMock({ admin: true, scheme: 'light' });
    await install(page, st);
    await page.goto('/?design=a&look=performance:full#/system/wall');
    const row = page.locator('system-wall [data-wall-general]');
    await expect(row).toBeVisible();
    const sel = row.locator('select[data-wall-foldable]');
    await expect(sel).toHaveValue('tablet');
    await expect(sel.locator('option')).toHaveText(['כמו טאבלט (מסך קיר)', 'כמו טלפון (המערכת הרגילה)']);
    await expect(row).toContainText('טלפון מתקפל פתוח');
    const b = (await sel.boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(b.x, 'the select is inside the screen').toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vw);
    test.info().annotations.push({ type: 'select-height', description: String(b.height) });
    if (info.project.name === 'mobile') expect(b.height, 'a 44 px touch target on the phone').toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
    await shot(page, `settings-foldable-${info.project.name}`);
    await sel.selectOption('phone');
    await expect.poll(() => st.settingsPatched).toEqual([{ foldable_open: 'phone' }]);
    await expect(sel).toHaveValue('phone');
    await page.reload();
    await expect(page.locator('system-wall [data-wall-general] select[data-wall-foldable]')).toHaveValue('phone');
    expect(st.patched, 'no profile was touched').toEqual([]);
  });
});
