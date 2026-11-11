import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { groupDescription, DEFAULT_PILL_PREFS } from '../src/map/room-pills';
import { levelTags, spreadDescription } from '../src/map/stack-layout';
import type { SceneDescription } from '../src/map/scene-builder';
import type { RoomCardModel } from '../src/components/sw-room-card';
import { settlePage } from './pixel-settle';
import { r28Desc, r28Rooms } from './plan3d-r28-fixtures';

// PLAN3D-R28-UI-2433 (round 28 mockup: app/pills.html, app/room.html, app/stack.html) pixel baselines of the NEW overlays only: the room
// pills (mid distance, the popover open), the spread levels' tags and the focused level's column, and the room card (side panel on a
// desktop, the low and the full sheet on a phone). The 3D canvas is cleared for the picture (as pixel-walk-touch.spec.ts): what is compared
// is the HTML over the host's own background, so the baseline does not depend on the renderer. Classic skin, light scheme.
// Baselines are per OS: the Linux ones are generated on the runner with `-u`; without a baseline the check is skipped, not failed.
//   run_smart.py preview <branch> tests/pixel-plan3d-r28-ui.spec.ts --project=desktop --project=mobile [-u] --workers=1 --machine runner

const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
async function check(info: TestInfo, target: Locator, name: string): Promise<void> {
  if (noBaseline(info, name)) {
    info.annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
    return;
  }
  await expect(target).toHaveScreenshot(name, { maxDiffPixels: 60, animations: 'disabled' });
}

/** The styleguide's 3D element with a description and the round 28 inputs, the canvas cleared. */
async function plan3d(page: Page, desc: SceneDescription, extra: Record<string, unknown>): Promise<Locator> {
  await page.goto('/?design=a&look=performance:full&skin=classic&scheme=light#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n, a) => {
    const w = n as unknown as Record<string, unknown>;
    w.minFps = 0;
    w.description = a.desc;
    for (const [k, v] of Object.entries(a.extra)) w[k] = v;
  }, { desc, extra });
  await el.scrollIntoViewIfNeeded();
  await el.evaluate((n) => { (n.shadowRoot!.querySelector('.stage canvas') as HTMLElement).style.opacity = '0'; });
  return el;
}

test.describe('pixel: the round 28 3D map overlays', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  test('classic is pixel-stable: one pill per room and its popover', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the desktop layout');
    test.setTimeout(120_000);
    const g = groupDescription(r28Desc('L0'), r28Rooms(), DEFAULT_PILL_PREFS);
    const el = await plan3d(page, g.desc, { roomPills: g.pills, pillPrefs: DEFAULT_PILL_PREFS, preset: 'top' });
    await expect(el.locator('[data-room-pill]')).toHaveCount(2);
    await expect(el.locator('[data-room-pill="z-west"]')).toBeVisible();
    // the summarised devices have no pill of their own
    await expect(el.locator('[data-3d-label="a-light"]')).toHaveCount(0);
    await settlePage(page);
    await check(info, el, 'r28-pills.png');
    await el.locator('[data-room-pill="z-west"]').click();
    await expect(el.locator('[data-room-pop="z-west"]')).toBeVisible();
    await expect(el.locator('[data-room-pop="z-west"] [data-rp-device]')).toHaveCount(4);
    await settlePage(page);
    await check(info, el, 'r28-pills-popover.png');
    // the room card opens from the popover
    const opened = el.evaluate((n) => new Promise<string>((res) => n.addEventListener('room-open', (e) => res((e as CustomEvent<{ id: string }>).detail.id), { once: true })));
    await el.locator('[data-room-pop-card]').click();
    expect(await opened).toBe('z-west');
  });

  test('classic is pixel-stable: the spread levels with their tags, then one level in focus', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the desktop layout');
    test.setTimeout(120_000);
    const names = new Map([['L0', 'קרקע'], ['L1', 'עליון']]);
    const spread = spreadDescription(r28Desc(null));
    const el = await plan3d(page, spread, { levelTags: levelTags(spread, names, r28Rooms(), null), roomPills: [], preset: 'iso' });
    await expect(el.locator('[data-level-tag]')).toHaveCount(2);
    await settlePage(page);
    await check(info, el, 'r28-stack-open.png');
    const focus = spreadDescription(r28Desc(null), 'L0');
    await el.evaluate((n, a) => { const w = n as unknown as Record<string, unknown>; w.description = a.d; w.levelTags = a.t; }, { d: focus, t: levelTags(spread, names, r28Rooms(), 'L0') });
    await expect(el.locator('[data-level-column] [data-stack-enter]')).toBeVisible();
    await settlePage(page);
    await check(info, el, 'r28-stack-focus.png');
  });

  for (const shape of ['side', 'peek', 'full'] as const) {
    test(`classic is pixel-stable: the room card (${shape})`, async ({ page }, info) => {
      test.skip(shape === 'side' ? info.project.name !== 'desktop' : info.project.name !== 'mobile', shape === 'side' ? 'the desktop panel' : 'the phone sheet');
      test.setTimeout(120_000);
      // the floor map's chunk defines sw-room-card; the card is mounted alone in a fixed box over the page
      await page.goto('/?design=a&skin=classic&scheme=light#/explore/floors/f0');
      await expect.poll(() => page.evaluate(() => !!customElements.get('sw-room-card')), { timeout: 30000 }).toBe(true);
      const spec = (id: string, label: string, sensitive = false) => ({ id, label, sensitive, arguments: [], granted: true });
      const model: RoomCardModel = {
        id: 'z-west', name: 'סלון', levelName: 'קרקע', presence: true, quietMin: null, open: 2,
        lights: [{ entityId: 'light.a', label: 'תאורת תקרה', on: true, spec: spec('light.turn_off', 'כבה'), forbidden: false }, { entityId: 'light.b', label: 'מנורת רצפה', on: true, spec: spec('light.turn_off', 'כבה'), forbidden: false }, { entityId: 'light.c', label: 'פס לד', on: false, spec: spec('light.turn_on', 'הדלק'), forbidden: false }],
        climate: { entityId: 'climate.a', now: 24.2, target: 23, step: 0.5, min: 16, max: 30, spec: spec('climate.set_temperature', 'קבע'), words: 'קירור' },
        openings: [{ entityId: 'binary_sensor.d', label: 'דלת סלון', words: 'פתוחה', open: true, icon: 'door', spec: null, forbidden: false }, { entityId: 'cover.s', label: 'תריס מרפסת', words: 'פתוח', open: false, icon: 'menu', spec: spec('cover.close_cover', 'סגור'), forbidden: false }, { entityId: 'lock.g', label: 'שער חניה', words: 'נעול', open: false, icon: 'lock', spec: null, forbidden: true }],
        cameras: [], areaHref: '#/devices/areas/living', busy: null, stale: false,
      };
      await page.evaluate(({ m, shape }) => {
        const box = document.createElement('div');
        box.id = 'r28-box';
        box.style.cssText = `position:fixed;inset:0;z-index:99999;background:var(--sw-map-bg, #eef1f5);direction:rtl`;
        const card = document.createElement('sw-room-card') as unknown as HTMLElement & Record<string, unknown>;
        card.model = m;
        card.place = shape === 'side' ? 'side' : 'sheet';
        card.camera = 'none';
        card.sheet = shape === 'full' ? 'full' : 'peek';
        box.appendChild(card);
        document.body.appendChild(box);
      }, { m: model, shape });
      const box = page.locator('#r28-box');
      await expect(box.locator('sw-room-card [data-room-close]')).toBeVisible();
      // the low sheet shows what is open, the full one its first tab (the lights)
      if (shape === 'peek') await expect(box.locator('sw-room-card [data-room-opening="cover.s"]')).toBeVisible();
      if (shape === 'full') await expect(box.locator('sw-room-card [data-room-light="light.a"]')).toBeVisible();
      await page.waitForTimeout(400); // the entry animation (the compare runs with animations disabled; the box is steady after it)
      await settlePage(page);
      await check(info, box, `r28-room-card-${shape}.png`);
    });
  }
});
