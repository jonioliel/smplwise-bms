import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FOLDS, installCardsMock, openAccess } from './settings-cards-mocks';
import { settlePage } from './pixel-settle';

// SKIN-QA-2403 pixel baselines, only where a skin other than classic light changed and nothing else guards it:
//   - Settings › "מתגי מסכי כניסה", layout a at 1440x900 in the glass skins - domus light (the bloom canvas), domus dark and crystal dark:
//     the headers' column is now drawn in the skin's card material and the open header's tint lies over the surface;
//   - the camera wall's phone icon row in crystal dark and domus light (the picker keys, the badge, the kiosk key), as an element image.
// Classic light is guarded by pixel-settings-intercom-cards-2401 / pixel-settings-cards-accordion-2402 / visual-matrix (unchanged).
// The foundation skins (infra, soft) get no baseline (SKINFOUND-297: kept out of the pixel matrix until the owner's round 2); the layout
// spec tests/layout-skin-qa-2403.spec.ts measures them. Titles carry "pixel-stable" (the gate's pixel lane selects with -g pixel-stable).
// Baselines are per OS: the Linux ones are generated on the runner with --update-snapshots, looked at, then committed; on an OS without a
// baseline the check is skipped instead of failing on a missing file.
//   ~/run_remote.sh preview <branch> tests/pixel-skin-qa-2403.spec.ts --project=desktop --project=mobile [--update-snapshots]

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

function skipWithoutBaseline(file: string): boolean {
  const info = test.info();
  if (!noBaseline(info, file)) return false;
  info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  return true;
}

async function ready(page: Page) {
  await page.locator(`${FOLDS} [data-fold-toggle="screens"]`).waitFor({ timeout: 30_000 });
  await expect(page.locator(`${FOLDS} [data-fold-summary="calls"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
  await expect(page.locator(`${FOLDS} [data-fold-summary="pairing"]`)).not.toHaveText('טוען…', { timeout: 20_000 });
  await page.mouse.move(0, 0);
  await settlePage(page);
}

/** The phone wall against snapshot-only cameras (no live video: a still, deterministic image). */
async function phoneWall(page: Page, skin: string, scheme: 'light' | 'dark') {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.wall.count', '4');
      localStorage.removeItem('sw.wall.cols');
      localStorage.removeItem('sw.wall.quality');
    } catch {
      /* storage unavailable */
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live', 'sources.configure'];
      return json({ user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'cameras') {
      const cameras = Array.from({ length: 8 }, (_, i) => ({
        id: `c${i + 1}`, recorder_id: 'r', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: false, encoding: { main: { codec: 'H.264', webrtc: 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } },
      }));
      return json({ cameras, recorder: null, can_sync: true, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60, 'ui.wall_phone_bar': 'icons' }, can_edit: false });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#/live/wall`);
  await page.waitForSelector('live-wall');
  await expect(page.locator('live-wall [data-wall-phone-bar]')).toHaveAttribute('data-mode', 'icons');
  await settlePage(page);
}

test.describe('pixel: SKIN-QA-2403', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const [skin, scheme] of [['domus', 'light'], ['domus', 'dark'], ['crystal', 'dark']] as const) {
    test(`${skin} ${scheme} is pixel-stable: layout a, the headers' column and the switches card at 1440x900`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'a desktop size');
      const file = `cards-screens-${skin}-${scheme}-1440.png`;
      test.skip(skipWithoutBaseline(file), `${file}: no baseline on ${process.platform}`);
      await page.setViewportSize({ width: 1440, height: 900 });
      await installCardsMock(page);
      await openAccess(page, undefined, { skin, scheme });
      await ready(page);
      await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
    });
  }

  for (const [skin, scheme] of [['crystal', 'dark'], ['domus', 'light']] as const) {
    test(`${skin} ${scheme} is pixel-stable: the phone wall's icon row`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the phone');
      const file = `wall-icons-${skin}-${scheme}-390.png`;
      test.skip(skipWithoutBaseline(file), `${file}: no baseline on ${process.platform}`);
      await phoneWall(page, skin, scheme);
      await expect(page.locator('live-wall [data-wall-phone-bar]')).toHaveScreenshot(file, { maxDiffPixels: 20, animations: 'disabled' });
    });
  }
});
