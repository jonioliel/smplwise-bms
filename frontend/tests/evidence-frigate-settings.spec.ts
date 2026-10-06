import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFrigate, newFrigateMock, openApp, type FrigateMock } from './frigate-mocks';

// NN5-F1B: the Frigate provider's non-review screens - the connection test and the saved recorder's capability summary (Settings), the
// Frigate rows of the recorder health card (Health) and the refreshing still tiles (Live). Against a MOCKED backend (page.route on
// api/v1; the routes of routers/frigate.py); the three projects. SW_SHOTS=1 writes evidence screenshots to docs/design/evidence/nn5-f1b.
// The "password" is a canary the page must never echo.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn5-f1b');
const CANARY = 'canary-pass-5521';
const FORM = 'system-setup nvr-connection-form';
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function start(page: Page, hash: string, over: Partial<FrigateMock> = {}): Promise<FrigateMock> {
  const m = newFrigateMock(over);
  await installFrigate(page, m);
  await openApp(page, hash);
  return m;
}

test.describe('settings: Frigate in the connection form', () => {
  test('the vendor is chosen, the test shows what the server learned (version, cameras) and the hints; the rest comes after the save', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, '/system/setup', { recorders: 'none' });
    const form = page.locator(FORM);
    await expect(form.locator('[data-conn-vendor] option')).toContainText(['Frigate']);
    await form.locator('[data-conn-vendor]').selectOption('frigate');
    // the fields follow the vendor: address, port, user, password
    await expect(form.locator('[data-conn-field="http_port"]')).toHaveValue('8971');
    await expect(form.locator('[data-conn-frigate-hint]')).toContainText('חשבון צפייה');
    await expect(form.locator('[data-conn-frigate-hint]')).toContainText('עורך המצלמות'); // the "same place on two systems" hint, nothing more
    await expect(form.locator('[data-conn-test]')).toHaveAttribute('disabled', '');
    await form.locator('[data-conn-field="host"]').fill('frigate.fake.test');
    await form.locator('[data-conn-field="username"]').fill('viewer');
    await form.locator('[data-conn-field="password"]').fill(CANARY);
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveAttribute('data-ok', 'true');
    await expect(form.locator('[data-conn-test-result]')).toContainText('Frigate');
    const sum = form.locator('frigate-summary [data-frigate-summary]');
    await expect(sum).toBeVisible();
    await expect(sum.locator('[data-frigate-row="version"]')).toHaveText('0.18.0-fake');
    await expect(sum.locator('[data-frigate-row="cameras"]')).toHaveText('4 פעילות מתוך 4');
    await expect(sum.locator('[data-frigate-row="detectors"]')).toHaveCount(0); // the test cannot know these: said, not guessed
    await expect(sum.locator('[data-frigate-more-after-save]')).toBeVisible();
    await expect(sum.locator('[data-frigate-readonly]')).toContainText('לקריאה בלבד');
    await expect(sum.locator('[data-frigate-readonly]')).toContainText('תמונה מתעדכנת');
    // no Home Assistant branding and no secret anywhere in the summary
    const text = await sum.innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|HA\b/);
    expect(text).not.toContain(CANARY);
    await noOverflow(page);
    await shot(page, 'settings-frigate-test');
    expect(errors).toEqual([]);
  });

  test('a saved Frigate recorder shows the full summary: version, cameras (enabled of all), detectors, retention, the features on and off, read-only', async ({ page }) => {
    await start(page, '/system/setup');
    await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
    const sum = page.locator('nvr-recorders-card [data-recorder-frigate-summary] [data-frigate-summary]');
    await expect(sum).toBeVisible();
    await expect(sum.locator('[data-frigate-row="version"]')).toHaveText('0.18.0-fake');
    await expect(sum.locator('[data-frigate-row="cameras"]')).toHaveText('3 פעילות מתוך 4 · 1 כבויות');
    await expect(sum.locator('[data-frigate-row="detectors"]')).toHaveText('cpu1 (cpu)');
    await expect(sum.locator('[data-frigate-row="retention"]')).toHaveText('הקלטה על תנועה בלבד · 10 ימים');
    await expect(sum.locator('[data-feature="review_items"]')).toHaveAttribute('data-on', 'true');
    await expect(sum.locator('[data-feature="hls_playback"]')).toHaveAttribute('data-on', 'true');
    await expect(sum.locator('[data-feature="restream"]')).toHaveAttribute('data-on', 'false');
    await expect(sum.locator('[data-feature="search_semantic"]')).toHaveAttribute('data-on', 'false');
    await expect(sum.locator('[data-feature="faces"]')).toHaveAttribute('data-on', 'false'); // reported, so listed; off
    await expect(sum.locator('[data-frigate-more-after-save]')).toHaveCount(0);
    await expect(sum.locator('[data-frigate-readonly]')).toContainText('תמונה מתעדכנת'); // no restream: stills
    await noOverflow(page);
    await shot(page, 'settings-frigate-saved');
    // the Hikvision recorder has no such card
    await page.locator('nvr-recorders-card [data-recorder="nvr-1"] [data-recorder-connection]').click();
    await expect(page.locator('nvr-recorders-card [data-recorder-frigate-summary]')).toHaveCount(0);
  });

  test('a refused login is a one-line answer with no summary; the other vendors show no Frigate hint', async ({ page }) => {
    await start(page, '/system/setup', { recorders: 'none', test: { status: 200, body: { ok: false, code: 'source_forbidden' } } });
    const form = page.locator(FORM);
    await form.locator('[data-conn-vendor]').selectOption('frigate');
    await form.locator('[data-conn-field="host"]').fill('frigate.fake.test');
    await form.locator('[data-conn-field="username"]').fill('viewer');
    await form.locator('[data-conn-field="password"]').fill(CANARY);
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveText('שם משתמש או סיסמה שגויים');
    await expect(form.locator('frigate-summary')).toHaveCount(0);
    await form.locator('[data-conn-vendor]').selectOption('hikvision');
    await expect(form.locator('[data-conn-frigate-hint]')).toHaveCount(0);
  });

  test('a Frigate older than the supported minimum is told plainly (the server\'s answer code)', async ({ page }) => {
    await start(page, '/system/setup', { recorders: 'none', test: { status: 200, body: { ok: false, code: 'nvr_not_supported', firmware: '0.12.1', min_version: '0.18' } } });
    const form = page.locator(FORM);
    await form.locator('[data-conn-vendor]').selectOption('frigate');
    await form.locator('[data-conn-field="host"]').fill('frigate.fake.test');
    await form.locator('[data-conn-field="username"]').fill('viewer');
    await form.locator('[data-conn-field="password"]').fill(CANARY);
    await form.locator('[data-conn-test]').click();
    await expect(form.locator('[data-conn-test-result]')).toHaveAttribute('data-ok', 'false');
    await expect(form.locator('[data-conn-test-result]')).toContainText('גרסת Frigate');
    await expect(form.locator('frigate-summary')).toHaveCount(0);
  });
});

test.describe('health: the Frigate recorder in the recorder cards', () => {
  test('detectors, hours of recording left, partial coverage and per-camera status; partial coverage is a notice, not "no recording"', async ({ page }) => {
    await start(page, '/system/diagnostics?tab=health');
    const card = page.locator('recorder-health-panel [data-rh-card="nvr-2"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-rh-row="frigate-detectors"]')).toContainText('cpu1 · 62 מ״ש להסקה');
    await expect(card.locator('[data-rh-row="frigate-hours-left"]')).toContainText('3 ימים');
    await expect(card.locator('[data-rh-row="frigate-partial"]')).toContainText('הקלטה על תנועה בלבד: כיסוי חלקי');
    await expect(card.locator('[data-rh-row="recording"]')).toContainText('3/3'); // the recording row still says what is recording
    const cams = card.locator('[data-rh-frigate-camera]');
    await expect(cams).toHaveCount(4);
    await expect(card.locator('[data-rh-frigate-camera="fg-front"]')).toContainText('5 פריימים בשנייה');
    await expect(card.locator('[data-rh-frigate-camera="fg-yard"]')).toContainText('1 חיבורים מחדש בשעה האחרונה');
    await expect(card.locator('[data-rh-frigate-camera="fg-garage"]')).toHaveAttribute('data-camera-state', 'down');
    await expect(card.locator('[data-rh-frigate-camera="fg-garage"]')).toContainText('אין תמונה');
    await expect(card.locator('[data-rh-frigate-camera="fg-gate"]')).toContainText('המצלמה כבויה');
    // the Hikvision card has none of these rows
    await expect(page.locator('recorder-health-panel [data-rh-card="nvr-1"] [data-rh-row^="frigate"]')).toHaveCount(0);
    await noOverflow(page);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'health-frigate');
  });
});

test.describe('live: a camera without a stream is a refreshing still', () => {
  const still = (m: FrigateMock, id: string) => m.stills.filter((s) => s.id === id).length;

  test('the tile says "תמונה מתעדכנת", refreshes no faster than every 5 s, pauses while the tab is hidden, and is outside the stream budget', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-06T08:00:00Z') });
    const m = await start(page, '/live/wall', { stillRefreshS: 1 }); // the server asks for 1 s: the tile holds the 5 s floor
    const tile = page.locator('live-wall sw-camera-tile[data-cam="fg-front"]');
    await expect(tile).toBeVisible();
    await expect(tile.locator('[data-snapshot-label]')).toHaveText('תמונה מתעדכנת כל 5 שנ׳');
    await expect(tile.locator('[data-snapshot-label]')).toHaveAttribute('data-still', 'refreshing');
    await expect.poll(() => still(m, 'fg-front')).toBeGreaterThanOrEqual(1);
    const base = still(m, 'fg-front');
    await page.clock.runFor(3000);
    expect(still(m, 'fg-front')).toBe(base); // 3 s: too soon
    await page.clock.runFor(3000);
    await expect.poll(() => still(m, 'fg-front')).toBe(base + 1); // past 5 s: one refresh
    // hidden tab: no request, however long
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenAt = still(m, 'fg-front');
    await page.clock.runFor(60_000);
    expect(still(m, 'fg-front')).toBe(hiddenAt);
    // visible again: it catches up with one refresh, not a burst
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1500);
    await expect.poll(() => still(m, 'fg-front')).toBe(hiddenAt + 1);
    await shot(page, 'live-wall-still');
  });

  test('the cameras of the Frigate recorder are stills with the default interval, the Hikvision camera stays a stream tile, an offline one shows no picture, a still camera has its own page view', async ({ page }) => {
    const m = await start(page, '/live/wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam="fg-front"] [data-still="refreshing"]')).toHaveText('תמונה מתעדכנת כל 10 שנ׳');
    await expect(page.locator('live-wall sw-camera-tile[data-cam="hk-1"] [data-still]')).toHaveCount(0);
    await expect(page.locator('live-wall sw-camera-tile[data-cam="fg-off"]')).toHaveAttribute('state', 'offline');
    expect(m.stills.some((s) => s.id === 'fg-off')).toBe(false);
    await page.goto('about:blank');
    await openApp(page, '/live/cameras/fg-front');
    await expect(page.locator('live-camera [data-live-still]')).toBeVisible();
    await expect(page.locator('live-camera [data-live-still] [data-still="refreshing"]')).toContainText('תמונה מתעדכנת');
    await noOverflow(page);
  });

  test('with no Frigate recorder no camera is a still (the wall is unchanged)', async ({ page }) => {
    await start(page, '/live/wall', { reviews: 'none' });
    await expect(page.locator('live-wall sw-camera-tile[data-cam="fg-front"]')).toBeVisible();
    await expect(page.locator('live-wall sw-camera-tile [data-still]')).toHaveCount(0);
  });
});
