import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend (T019/T020/T021/T013): real catalogue, real plan
// rasters and the read-only camera registry. Runs only when SW_LIVE=1 (needs `python -m smplwise` on
// 8099 behind the preview proxy) so the fixture-based suites stay deterministic.
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Real plans and camera names are customer data: this evidence stays in the gitignored private-evidence/.
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T019-live');

test.describe('live backend evidence', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('identity, catalogue, plan raster, editor, cameras', async ({ page, request }, testInfo) => {
    const me = await request.get('/api/v1/me');
    expect(me.ok()).toBeTruthy();
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    expect(tree.sites.length).toBeGreaterThan(0);
    const building = tree.sites[0].buildings[0];
    const floor = building.floors.find((f: { has_plan: boolean }) => f.has_plan) ?? building.floors[0];

    await open(page, '/explore/sites');
    await expect(page.getByText(tree.sites[0].name).first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sites-${testInfo.project.name}.png`) });

    await open(page, `/explore/buildings/${building.id}/floors`);
    await page.screenshot({ path: path.join(OUT, `floors-${testInfo.project.name}.png`) });

    await open(page, `/explore/floors/${floor.id}`);
    await page.waitForTimeout(1500);
    const img = page.locator('sw-plan-canvas image');
    if (floor.has_plan) await expect(img).toHaveAttribute('href', /image\.png/);
    await page.screenshot({ path: path.join(OUT, `map-${testInfo.project.name}.png`) });

    await open(page, `/explore/floors/${floor.id}/edit`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `editor-${testInfo.project.name}.png`) });

    await open(page, '/system/devices');
    await page.screenshot({ path: path.join(OUT, `cameras-${testInfo.project.name}.png`) });
  });
});
