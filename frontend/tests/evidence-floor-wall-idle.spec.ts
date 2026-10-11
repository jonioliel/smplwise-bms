import { test, expect, type Locator, type Page } from '@playwright/test';
import { install, newMock, type Mock } from './wall-plan-mocks';

// Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 3.4, docs/changes/CR-029-ST7-S5B-NOTES.md): the FLOOR MAP opened as a wall display
// (`?display=wall`, S3) against a mocked backend - its host wiring. A wall browser's live / stills, quality and idle seconds are this
// browser's pins from the route (`plan=`, `quality=`, `idle=`; remembered like display=wall, cleared by display=desk) over the installation's
// dials; the 3D element gets the idle seconds, the plan-change signature and the forced quality, and the floor's baked still in its
// `idle-still` slot; after the idle time the still takes the view and the frame loop stops; a desk (no display=wall) gets none of it.
// Needs no dev server: the mocks answer the API; one project is enough (the wall is a desktop-class page here).
const FLOOR = '/?design=a#/explore/floors/f1';

type El = HTMLElement & { idleS: number; changeKey: string; qualityForce: string | null; view: { isPaused: boolean } | null };

const three = (page: Page): Locator => page.locator('explore-floor-map sw-plan-3d[data-floor-3d]');

async function openFloor(page: Page, st: Mock, query = '') {
  await install(page, { ...st, floorMap: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${FLOOR}${query}`);
  // the floor opens in 3D by itself once the setting has arrived after the scene; a quiet mocked page may give the host no update to do
  // it in, so the person's own toggle does it (the view toggle is the host's, not this slice's)
  const toggle = page.locator('explore-floor-map [data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 30_000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30_000 }); // sw-button is no native control: its host attribute says
  await page.waitForTimeout(1500);
  if ((await page.locator('explore-floor-map sw-plan-3d, explore-floor-map [data-floor-stills]').count()) === 0) await toggle.click();
}

test.describe('the floor map as a wall display (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough');
  });

  test('display=wall with the route\'s pins: the 3D element gets the idle seconds, the forced quality and the floor\'s still in its slot; it idles into the still and a touch wakes it', async ({ page }) => {
    test.setTimeout(150_000);
    await openFloor(page, newMock({ admin: true, scheme: 'light' }), '?display=wall&plan=live&quality=schematic&idle=10');
    const el = three(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    const props = await el.evaluate((n) => { const k = n as unknown as El; return { idleS: k.idleS, quality: k.qualityForce, key: k.changeKey }; });
    expect(props.idleS).toBe(10);
    expect(props.quality).toBe('schematic');
    expect(props.key).toContain('cir:c1=on'); // what the plan shows of its devices: the lamp circuit
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el.locator('sw-plan-stills[slot="idle-still"]')).toHaveCount(1);
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 40_000 });
    await expect(el.locator('.idle-still[data-on]')).toBeVisible();
    await expect(el.locator('sw-plan-stills[slot="idle-still"] svg[data-stills]')).toBeVisible();
    expect(await el.evaluate((n) => (n as unknown as El).view!.isPaused)).toBe(true);
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.up();
    await expect(el).not.toHaveAttribute('data-idle', '');
    expect(await el.evaluate((n) => (n as unknown as El).view!.isPaused)).toBe(false);
  });

  test('a desk (no display=wall) gets no idle, no forced quality and no slotted still', async ({ page }) => {
    test.setTimeout(90_000);
    await openFloor(page, newMock({ admin: true, scheme: 'light' }), '?plan=stills&quality=schematic&idle=10'); // the parameters mean nothing without display=wall
    const el = three(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    const props = await el.evaluate((n) => { const k = n as unknown as El; return { idleS: k.idleS, quality: k.qualityForce, key: k.changeKey }; });
    expect(props).toEqual({ idleS: 0, quality: null, key: '' });
    await expect(el.locator('sw-plan-stills')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(el).not.toHaveAttribute('data-idle', '');
  });

  test('the pins are remembered by this browser; display=desk clears them', async ({ page }) => {
    test.setTimeout(120_000);
    const st = newMock({ admin: true, scheme: 'light' });
    await openFloor(page, st, '?display=wall&plan=stills');
    await expect(page.locator('explore-floor-map [data-floor-stills]')).toHaveCount(1, { timeout: 40_000 }); // stills only: no WebGL view at all
    await expect(page.locator('explore-floor-map sw-plan-3d')).toHaveCount(0);
    expect(await page.evaluate(() => [localStorage.getItem('sw.plan3d.wall'), localStorage.getItem('sw.plan3d.wall_display')])).toEqual(['1', 'stills']);
    await page.goto('about:blank');
    await page.goto(FLOOR); // the next load carries no parameters: the browser still knows
    await expect(page.locator('explore-floor-map [data-floor-stills]')).toHaveCount(1, { timeout: 40_000 });
    await page.goto('about:blank');
    await page.goto(`${FLOOR}?display=desk`);
    const el = three(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    expect(await page.evaluate(() => [localStorage.getItem('sw.plan3d.wall'), localStorage.getItem('sw.plan3d.wall_display')])).toEqual([null, null]);
    expect(await el.evaluate((n) => (n as unknown as El).idleS)).toBe(0);
  });

  test('the installation\'s idle dial reaches a wall display with no pin; 0 means never', async ({ page }) => {
    test.setTimeout(90_000);
    await openFloor(page, newMock({ admin: true, scheme: 'light', dials: { kiosk_idle_s: 120 } }), '?display=wall&plan=live');
    const el = three(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    expect(await el.evaluate((n) => (n as unknown as El).idleS)).toBe(120);
    const b = await page.context().newPage();
    await openFloor(b, newMock({ admin: true, scheme: 'light', dials: { kiosk_idle_s: 120 } }), '?display=wall&plan=live&idle=0'); // the browser's own pin: never
    await expect(three(b)).toHaveAttribute('data-ready', '', { timeout: 40_000 });
    expect(await three(b).evaluate((n) => (n as unknown as El).idleS)).toBe(0);
  });
});
