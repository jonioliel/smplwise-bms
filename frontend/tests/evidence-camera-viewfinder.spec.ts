import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// CR-CAMVF-295 evidence (docs/changes/CR-CAMVF-295-SECURITY.md): the opt-in live camera viewfinder of a request's photos, from the REAL
// build against the tickets mock layer, in Chromium with a FAKE camera (`--use-fake-device-for-media-stream`, the permission granted by
// `--use-fake-ui-for-media-stream` or refused by a stub). What it proves: off by default (no tile, no getUserMedia); on - no camera before
// the click, a live preview, the shot, zero uploads before "use photo" and exactly one after (the existing attachments route), every
// track ended on every exit; a refusal ends in one line and the unchanged file input. Screenshots: docs/design/evidence/camera-viewfinder/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-camera-viewfinder.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/camera-viewfinder');
const D = 'sw-app tickets-list ticket-detail';
const TICKET = '/tickets/all?t=0000000000000a01';

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

/** Wraps getUserMedia BEFORE the app loads: counts the calls and keeps every stream, so a test can check each track ended. */
async function recordCamera(page: Page, deny = false): Promise<void> {
  await page.addInitScript((refuse: boolean) => {
    const w = window as unknown as { __cam: { calls: number; streams: MediaStream[] } };
    w.__cam = { calls: 0, streams: [] };
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) return;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (c?: MediaStreamConstraints) => {
      w.__cam.calls += 1;
      if (refuse) throw new DOMException('Permission denied', 'NotAllowedError');
      const s = await real(c);
      w.__cam.streams.push(s);
      return s;
    };
  }, deny);
}

const cam = (page: Page) => page.evaluate(() => {
  const c = (window as unknown as { __cam: { calls: number; streams: MediaStream[] } }).__cam;
  return { calls: c.calls, live: c.streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState !== 'ended').length, streams: c.streams.length };
});

async function go(page: Page, hash: string, o: TicketsMockOptions = {}, deny = false): Promise<{ mock: TicketsMock; uploads: string[] }> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await recordCamera(page, deny);
  const mock = await installTicketsMock(page, o);
  const uploads: string[] = [];
  // registered after the mock: Playwright tries the latest route first. The upload answers with the ticket (as the real route does).
  await page.route('**/api/v1/tickets/*/attachments', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    uploads.push(req.postDataBuffer()?.toString('latin1') ?? '');
    return route.fallback(); // the mock answers with the ticket
  });
  await page.goto('about:blank');
  await page.goto(url(hash));
  return { mock, uploads };
}

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

const d = (page: Page) => page.locator(D);
const photos = (page: Page) => d(page).locator('[data-sect="photos"]');
const vf = (page: Page) => d(page).locator('ticket-camera-viewfinder');

async function openLive(page: Page): Promise<void> {
  await photos(page).locator('[data-camvf-open]').click();
  await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'live');
  await expect.poll(() => vf(page).locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
}

test.describe('CR-CAMVF-295 live camera viewfinder', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page, browserName }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    test.skip(browserName !== 'chromium', 'the fake media device flags are Chromium flags');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('off by default: no tile, the file input unchanged, the camera never asked for', async ({ page }) => {
    await go(page, TICKET);
    await photos(page).waitFor();
    await photos(page).scrollIntoViewIfNeeded();
    const input = photos(page).locator('[data-photo-add] input[type="file"]');
    await expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    await expect(input).toHaveAttribute('multiple', '');
    await expect(photos(page).locator('[data-camvf-open]')).toHaveCount(0);
    await expect(d(page).locator('ticket-camera-viewfinder')).toHaveCount(0);
    await shot(page, 'off');
    expect((await cam(page)).calls).toBe(0);
  });

  test('on: nothing before the click, live preview, shot, zero uploads before "use", one after, every track ended', async ({ page }) => {
    const { uploads } = await go(page, TICKET, { ui: { camera_viewfinder: true } });
    await photos(page).locator('[data-camvf-open]').waitFor();
    await photos(page).scrollIntoViewIfNeeded();
    await expect(photos(page).locator('[data-photo-add] input[type="file"]'), 'the fallback tile stays').toHaveAttribute('accept', 'image/jpeg,image/png');
    await shot(page, 'on-tiles');
    expect((await cam(page)).calls, 'no camera before the click').toBe(0);

    await openLive(page);
    expect(await cam(page)).toMatchObject({ calls: 1, live: 1 });
    await shot(page, 'live');
    expect(uploads, 'nothing leaves the browser while the preview is live').toHaveLength(0);

    await vf(page).locator('[data-camvf-primary]').click(); // צילום
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'review');
    await expect(vf(page).locator('[data-camvf-still]')).toBeVisible();
    expect((await cam(page)).live, 'the camera is off as soon as the shot is taken').toBe(0);
    await shot(page, 'review');
    expect(uploads, 'nothing leaves the browser before "use photo"').toHaveLength(0);

    await vf(page).locator('[data-camvf-primary]').click(); // שימוש בתמונה
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'closed');
    await expect.poll(() => uploads.length).toBe(1);
    expect(uploads[0]).toMatch(/filename="camera-\d{8}-\d{6}\.jpg"/);
    expect(uploads[0]).toContain('Content-Type: image/jpeg');
    expect(uploads[0]).toMatch(/name="external"\r\n\r\nfalse/);
    expect(await cam(page)).toMatchObject({ calls: 1, live: 0 });
  });

  test('every exit stops the camera: cancel, Escape, retake then close, navigation', async ({ page }) => {
    const { uploads } = await go(page, TICKET, { ui: { camera_viewfinder: true } });
    await photos(page).locator('[data-camvf-open]').waitFor();

    await openLive(page);
    await vf(page).locator('[data-camvf-secondary]').click(); // ביטול
    expect((await cam(page)).live, 'cancel').toBe(0);

    await openLive(page);
    await page.keyboard.press('Escape');
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'closed');
    expect((await cam(page)).live, 'Escape').toBe(0);
    await expect(d(page).locator('[data-photo-add]'), 'Escape closed the camera, not the request').toBeVisible();

    await openLive(page);
    await vf(page).locator('[data-camvf-primary]').click();
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'review');
    await vf(page).locator('[data-camvf-secondary]').click(); // צילום מחדש - a new stream, from a click
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'live');
    expect((await cam(page)).live, 'retake: exactly one live stream').toBe(1);
    await vf(page).locator('sw-dialog').evaluate((el) => (el.shadowRoot?.querySelector('sw-button') as HTMLElement | null)?.click()); // the ✕
    expect((await cam(page)).live, 'the close button').toBe(0);

    await openLive(page);
    await page.evaluate(() => { window.location.hash = '#/tickets/all'; });
    await expect.poll(async () => (await cam(page)).live, { message: 'navigation' }).toBe(0);
    expect(uploads).toHaveLength(0);
    expect((await cam(page)).calls).toBe(5);
  });

  test('refused permission: one line, the camera off, the file input unchanged and usable', async ({ page }) => {
    await go(page, TICKET, { ui: { camera_viewfinder: true } }, true);
    await photos(page).locator('[data-camvf-open]').click();
    const flash = d(page).locator('[data-flash="bad"]');
    await expect(flash).toContainText('אין הרשאה למצלמה');
    await expect(vf(page).locator('sw-dialog')).toHaveAttribute('data-camvf', 'closed');
    const input = photos(page).locator('[data-photo-add] input[type="file"]');
    await expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    await expect(input).toBeEnabled();
    await photos(page).scrollIntoViewIfNeeded();
    await shot(page, 'denied');
    expect(await cam(page)).toMatchObject({ calls: 1, live: 0 });
  });

  test('settings › display: the kill switch row saves ui.camera_viewfinder', async ({ page }) => {
    const { mock } = await go(page, '/system/tickets?tab=display', { persona: 'admin' });
    const s = page.locator('sw-app system-tickets');
    const row = s.locator('[data-setting="camera_viewfinder"]');
    await row.waitFor();
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator('[data-ui-drawer="camera_viewfinder:off"]')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'settings-off');
    await row.locator('[data-ui-drawer="camera_viewfinder:on"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'tickets/settings').at(-1)?.body).toMatchObject({ ui: { camera_viewfinder: true } });
    await expect(row.locator('[data-ui-drawer="camera_viewfinder:on"]')).toHaveAttribute('aria-pressed', 'true');
    await row.locator('[data-ui-drawer="camera_viewfinder:off"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'tickets/settings').at(-1)?.body).toMatchObject({ ui: { camera_viewfinder: false } });
  });
});
