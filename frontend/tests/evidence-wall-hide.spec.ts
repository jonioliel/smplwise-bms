import { test, expect, type Page } from '@playwright/test';

// Owner request 2026-09-30: "סידור הקיר" can leave a camera out of the wall ("מוצגת" off). Against a mocked backend
// (page.route on api/v1, cameras kept in the test and PATCHed): the dialog's per-row switch, hidden rows listed last and
// dimmed, what is PATCHed on save, the wall grid / footer / kiosk after it, and the menu item being the wall's own.
// Real backend: backend tests/test_cameras.py (wall_hidden) and the live step in evidence-owner-round11.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:4315/ npx playwright test tests/evidence-wall-hide.spec.ts --project=desktop

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

type Cam = { id: string; channel: number; name: string; sort_order: number; grid_col_span: number; wall_hidden: boolean; enabled: boolean };

async function setup(page: Page, patches: { id: string; body: Record<string, unknown> }[], hiddenAtStart: string[] = []) {
  const cams: Cam[] = Array.from({ length: 5 }, (_, i) => ({ id: `c${i + 1}`, channel: i + 1, name: `מצלמה ${i + 1}`, sort_order: i, grid_col_span: 1, wall_hidden: hiddenAtStart.includes(`c${i + 1}`), enabled: true }));
  await page.addInitScript(() => {
    localStorage.setItem('sw.wall.count', '32');
    localStorage.removeItem('sw.wall.cols');
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live', 'sources.configure', 'map.read'];
      return json({ user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'cameras') {
      const sorted = [...cams].sort((a, b) => a.sort_order - b.sort_order || a.channel - b.channel);
      return json({ cameras: sorted.map((c) => ({ ...c, recorder_id: 'r', name_source: 'nvr', alias: null, main_track: 1, sub_track: 2, status: 'offline', last_seen_at: null, can_view_live: false })), recorder: null, can_sync: true, media: {} });
    }
    const m = /^cameras\/([^/]+)$/.exec(p);
    if (m && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      patches.push({ id: m[1], body });
      Object.assign(cams.find((c) => c.id === m[1])!, body);
      return json(cams.find((c) => c.id === m[1]));
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: false });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return cams;
}

const tileIds = (page: Page) => page.locator('live-wall sw-camera-tile[data-cam]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cam')));
const rowIds = (page: Page) => page.locator('live-wall [data-wall-settings-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-wall-settings-row')));

async function openDialog(page: Page) {
  await page.locator('sw-app [data-profile-menu]').click();
  await page.locator('sw-app sw-user-menu [data-menu-screen-edit="wall-arrange"]').click();
  await expect(page.locator('live-wall [data-wall-settings-dialog]')).toHaveCount(1);
  await expect(page.locator('live-wall [data-wall-settings-row]').first()).toBeVisible();
}

test.describe('wall arrangement: "מוצגת" per camera', () => {
  test.beforeEach(async ({}, info) => {
    info.skip(info.project.name !== 'desktop', 'the arrangement dialog is a desktop flow here');
  });

  test('hide one camera: the dialog lists it last, dimmed; save sends only that change; the wall, its footer and the kiosk leave it out', async ({ page }) => {
    const patches: { id: string; body: Record<string, unknown> }[] = [];
    await setup(page, patches);
    await page.goto('/?design=a#/live/wall');
    await page.waitForSelector('live-wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(5);
    await expect(page.locator('live-wall')).toContainText('5 מצלמות');

    await openDialog(page);
    expect(await rowIds(page)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    await expect(page.locator('live-wall [data-wall-show]')).toHaveCount(5);
    await expect(page.locator('live-wall [data-wall-show]:checked')).toHaveCount(5);

    await page.locator('live-wall [data-wall-show="c2"]').uncheck();
    expect(await rowIds(page)).toEqual(['c1', 'c3', 'c4', 'c5', 'c2']); // the hidden camera moves to the end
    const row = page.locator('live-wall [data-wall-settings-row="c2"]');
    await expect(row).toHaveAttribute('data-wall-row-hidden', '');
    expect(Number(await row.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1); // dimmed
    await expect(page.locator('live-wall [data-wall-show="c2"]')).not.toBeChecked();
    await expect(page.locator('live-wall [data-wall-show]:checked')).toHaveCount(4); // the moved rows keep their own switch
    // still reorderable / unhideable: the width select and "show" work, but it cannot move up past a shown camera
    await expect(page.locator('live-wall [data-wall-span="c2"]')).toBeEnabled();
    await expect(page.locator('live-wall [data-wall-move-up="c2"]')).toBeDisabled();
    await page.screenshot({ path: test.info().outputPath('wall-hide-dialog.png') });

    await page.locator('live-wall [data-wall-settings-save]').click();
    await expect(page.locator('live-wall [data-wall-settings-dialog]')).toHaveCount(0);
    // c1 stays (position 0, shown); c3 2->1, c4 3->2, c5 4->3, c2 1->4 and hidden
    expect(patches).toEqual([
      { id: 'c3', body: { sort_order: 1 } },
      { id: 'c4', body: { sort_order: 2 } },
      { id: 'c5', body: { sort_order: 3 } },
      { id: 'c2', body: { sort_order: 4, wall_hidden: true } },
    ]);
    await expect.poll(() => tileIds(page)).toEqual(['c1', 'c3', 'c4', 'c5']);
    await expect(page.locator('live-wall')).toContainText('4 מצלמות'); // all 4 visible cameras on screen: the plain form, the hidden one is in neither number
    await expect(page.locator('live-wall')).not.toContainText('מתוך');
    await page.screenshot({ path: test.info().outputPath('wall-hide-wall.png') });
    // a smaller layout than the visible cameras: the hidden one is out of both numbers
    await page.locator('live-wall .layouts button', { hasText: /^2$/ }).click();
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(2);
    await expect(page.locator('live-wall')).toContainText('מוצגות 2 מתוך 4 מצלמות');
    await page.locator('live-wall .layouts button[data-count="all"]').click();

    // the kiosk "all" follows the wall arrangement; an address with its own camera list still reaches the hidden camera
    await page.goto('about:blank');
    await page.goto('/?design=a#/kiosk/all?cols=3&rows=3');
    await page.waitForSelector('kiosk-wall');
    await expect(page.locator('kiosk-wall sw-camera-tile[data-kiosk-tile]')).toHaveCount(4, { timeout: 15000 });
    await page.goto('about:blank');
    await page.goto('/?design=a#/kiosk/all?cameras=c2,c1&cols=3&rows=3');
    await page.waitForSelector('kiosk-wall');
    await expect(page.locator('kiosk-wall sw-camera-tile[data-kiosk-tile]')).toHaveCount(2, { timeout: 15000 });
  });

  test('show a hidden camera again; everything hidden leaves a clear message and the dialog still opens', async ({ page }) => {
    const patches: { id: string; body: Record<string, unknown> }[] = [];
    await setup(page, patches, ['c4']);
    await page.goto('/?design=a#/live/wall');
    await page.waitForSelector('live-wall');
    await expect.poll(() => tileIds(page)).toEqual(['c1', 'c2', 'c3', 'c5']);
    await openDialog(page);
    expect(await rowIds(page)).toEqual(['c1', 'c2', 'c3', 'c5', 'c4']);
    await page.locator('live-wall [data-wall-show="c4"]').check();
    expect(await rowIds(page)).toEqual(['c1', 'c2', 'c3', 'c5', 'c4']); // it returns to the end of the shown group: same place here
    await page.locator('live-wall [data-wall-settings-save]').click();
    await expect(page.locator('live-wall [data-wall-settings-dialog]')).toHaveCount(0);
    expect(patches).toEqual([{ id: 'c5', body: { sort_order: 3 } }, { id: 'c4', body: { sort_order: 4, wall_hidden: false } }]);
    await expect.poll(() => tileIds(page)).toEqual(['c1', 'c2', 'c3', 'c5', 'c4']);
    await expect(page.locator('live-wall')).toContainText('5 מצלמות');
  });

  test('every camera hidden: the wall says so and "סידור הקיר" is still in the menu', async ({ page }) => {
    const patches: { id: string; body: Record<string, unknown> }[] = [];
    await setup(page, patches, ['c1', 'c2', 'c3', 'c4', 'c5']);
    await page.goto('/?design=a#/live/wall');
    await page.waitForSelector('live-wall');
    await expect(page.locator('live-wall [data-wall-all-hidden]')).toBeVisible();
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(0);
    await openDialog(page);
    await expect(page.locator('live-wall [data-wall-show]:checked')).toHaveCount(0);
  });
});
