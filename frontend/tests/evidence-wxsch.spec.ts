import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installStationsMock, newMock, openStations, type Persona as StationPersona } from './wiskey-stations-mocks';
import { settlePage } from './pixel-settle';

// WXSCH (owner 2026-10-13) against the mocked stations backend (tests/wiskey-stations-mocks.ts). Nothing here reaches a WisKey, Home
// Assistant or a station. The stations drawer: a quiet "לוחות זמנים" link to the schedules screen on the station's first door, only to
// holders of the schedules view permission, only while that screen is the native one, only for a station with doors.
// Evidence screenshots: docs/design/evidence/WX-small/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-wxsch.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WX-small');
const DRAWER = 'wiskey-stations sw-drawer[data-wk-drawer]';

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) }); // a drawer is a fixed layer: its content is in the viewport
}

async function openDrawer(page: Page, id: string, persona: StationPersona, settings: Record<string, string>) {
  await installStationsMock(page, newMock({ persona, settings }));
  await openStations(page);
  await page.locator(`wiskey-stations [data-wk-grid] [data-wk-station="${id}"] button.open`).click();
  await expect(page.locator(DRAWER)).toBeVisible();
}

test.describe('WXSCH: the schedules link in the stations drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the widths are the layout guard\'s');
  });

  test('a quiet link on the station\'s first door while the schedules screen is the native one', async ({ page }, info) => {
    await openDrawer(page, 'lobby', 'admin', { 'access.ui.schedules': 'smplwise' });
    const link = page.locator(`${DRAWER} [data-wk-station-schedules="lobby"]`);
    await expect(link).toHaveAttribute('href', '#/wiskey/schedules?door=lobby%3A1');
    await expect(link).toHaveAttribute('tone', 'quiet');
    await expect(link).toContainText('לוחות זמנים');
    // a link and nothing else: no badge, no paragraph in its row
    const row = page.locator(`${DRAWER} .evlink`);
    await expect(row.locator('sw-badge, p, .muted')).toHaveCount(0);
    expect(await row.locator('wk-action-button').count()).toBe(1);
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, info, 'drawer-schedules-link');
  });

  test('the drawer with the links on a phone (390 px): both are full 44 px targets', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDrawer(page, 'lobby', 'admin', { 'access.ui.schedules': 'smplwise', 'access.ui.events': 'smplwise' });
    const links = page.locator(`${DRAWER} .evlink wk-action-button`);
    await expect(links).toHaveCount(2);
    for (const b of await links.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, info, 'drawer-schedules-link-phone');
  });

  test('beside the entry-log link when that is offered too, and clicking it opens the schedules address', async ({ page }) => {
    await openDrawer(page, 'lobby', 'admin', { 'access.ui.schedules': 'smplwise', 'access.ui.events': 'smplwise' });
    await expect(page.locator(`${DRAWER} .evlink wk-action-button`)).toHaveCount(2);
    await expect(page.locator(`${DRAWER} [data-wk-station-events="lobby"]`)).toHaveAttribute('href', '#/wiskey/events?station=lobby');
    await page.locator(`${DRAWER} [data-wk-station-schedules="lobby"]`).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/wiskey/schedules?door=lobby%3A1');
  });

  test('not while the schedules screen is the embedded panel (the default)', async ({ page }) => {
    await openDrawer(page, 'lobby', 'admin', {});
    await expect(page.locator(`${DRAWER} [data-wk-station-schedules]`)).toHaveCount(0);
    await expect(page.locator(`${DRAWER} .evlink`)).toHaveCount(0);
  });

  test('not for a station without doors, nor an offline one that has none; the doors of the first station are not another one\'s', async ({ page }) => {
    await openDrawer(page, 'park', 'admin', { 'access.ui.schedules': 'smplwise' });
    await expect(page.locator(`${DRAWER} [data-wk-station-schedules]`)).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await openDrawer(page, 'gate', 'admin', { 'access.ui.schedules': 'smplwise' });
    await expect(page.locator(`${DRAWER} [data-wk-station-schedules="gate"]`)).toHaveAttribute('href', '#/wiskey/schedules?door=gate%3A1');
  });

  test('only for who may view schedules: the reader role sees it, the door opener (no technical part, no schedules permission) does not', async ({ page }) => {
    await openDrawer(page, 'lobby', 'operator', { 'access.ui.schedules': 'smplwise' });
    await expect(page.locator(`${DRAWER} [data-wk-station-schedules="lobby"]`)).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await openDrawer(page, 'lobby', 'door', { 'access.ui.schedules': 'smplwise' });
    await expect(page.locator(`${DRAWER} [data-wk-station-schedules]`)).toHaveCount(0);
  });
});
