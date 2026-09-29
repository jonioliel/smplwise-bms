import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the setup wizard (T071, AT141): הגדרות › אשף התקנה (#/system/wizard) driven by GET /setup/state and
// POST /setup/check/{step}.
//
// Live part (SW_LIVE=1 SW_SETUP_FIXTURE=1): against the throwaway fixture backend tests/fixtures/setup_fake_devices.py
// (fake NVR and go2rtc on `.test` hosts, the add-on's real device code; how to start it is at the top of that file).
// The NVR fake goes down → opening the wizard checks the NVR step live, it fails with the explanation, the next action
// and the link to הגדרות › חיבורים; "בדוק שוב" right away is refused by the per-step rate limit (the message is shown);
// the NVR comes back up → "בדוק שוב" passes with the device's evidence. Then the shell's "השלם את ההתקנה" hint: shown
// to the system administrator elsewhere while steps remain, and dismissed for the browser session. desktop + mobile.
//
// Demo part (no backend behind the preview): the fixture state - the camera step waits for a placement with its
// explanation; "בדוק שוב" on it completes the six steps and the "מוכן לעבודה" summary appears.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'T071');
const WIZARD = '#/system/wizard';
const CONTROL = process.env.SW_SETUP_CONTROL || 'http://127.0.0.1:8359';

const step = (page: Page, id: string) => page.locator(`system-wizard [data-step="${id}"]`);

async function openWizard(page: Page) {
  await page.goto(`/?design=a${WIZARD}`);
  await page.waitForSelector('sw-app');
  await expect(page.locator('system-wizard [data-wizard]')).toBeVisible({ timeout: 30000 });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('setup wizard against the fixture backend (fake NVR / go2rtc)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_SETUP_FIXTURE !== '1', 'set SW_LIVE=1 SW_SETUP_FIXTURE=1 against tests/fixtures/setup_fake_devices.py');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;

  test.beforeAll(async () => {
    control = await pwRequest.newContext({ baseURL: CONTROL });
  });

  test.beforeEach(async () => {
    expect((await control.post('/reset')).status()).toBe(200);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
  });

  test('NVR down: the step fails with the explanation; up again: "בדוק שוב" passes', async ({ page, request }, testInfo) => {
    expect((await control.post('/nvr', { data: { up: false } })).status()).toBe(200);
    await openWizard(page);
    // the six steps in the acceptance order, with the rail
    await expect(page.locator('system-wizard [data-step]')).toHaveCount(6);
    expect(await page.locator('system-wizard [data-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))).toEqual(['install', 'nvr', 'ha', 'go2rtc', 'floor', 'camera']);
    await expect(page.locator('system-wizard [data-rail-step]')).toHaveCount(6);

    // opening the wizard checks the NVR live (it was known only from the start-up discovery): down → failed
    const nvr = step(page, 'nvr');
    await expect(nvr).toHaveAttribute('data-status', 'failed', { timeout: 30000 });
    await expect(nvr).toHaveAttribute('data-source', 'live');
    const problem = nvr.locator('[data-step-problem]');
    await expect(problem).toHaveAttribute('data-step-problem', 'source_unavailable');
    await expect(problem).toContainText('ה־NVR לא ענה');
    await expect(problem.locator('[data-step-action]')).toContainText('ודאו שה־NVR דולק ומחובר לרשת');
    await expect(problem.locator('[data-step-link]')).toHaveAttribute('href', '#/system/setup');
    await expect(page.locator('system-wizard [data-rail-step="nvr"]')).toHaveAttribute('data-status', 'failed');
    await expect(page.locator('system-wizard [data-wizard-progress]')).toContainText('נכשלו');
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(OUT, `wizard-nvr-down-${testInfo.project.name}.png`), fullPage: true });

    // the other steps explain themselves too: HA is not configured in this fixture, the floor has no building yet
    await expect(step(page, 'ha')).toHaveAttribute('data-status', 'failed');
    await expect(step(page, 'ha').locator('[data-step-problem]')).toHaveAttribute('data-step-problem', 'ha_not_configured');
    await expect(step(page, 'floor')).toHaveAttribute('data-status', 'todo');
    await expect(step(page, 'floor').locator('[data-step-link]')).toHaveAttribute('href', '#/explore/sites');
    await expect(step(page, 'go2rtc')).toHaveAttribute('data-status', 'done', { timeout: 30000 });

    // the NVR is back (and the per-step limit of the automatic check has run out): "בדוק שוב" passes
    expect((await control.post('/nvr', { data: { up: true } })).status()).toBe(200);
    await page.waitForTimeout(5200);
    await nvr.locator('[data-check="nvr"]').click();
    await expect(nvr).toHaveAttribute('data-status', 'done', { timeout: 30000 });
    await expect(nvr.locator('[data-step-problem]')).toHaveCount(0);
    await expect(nvr.locator('[data-step-note]')).toHaveCount(0);
    // an immediate second check is refused by the per-step limit, the screen says so and keeps the result
    await nvr.locator('[data-check="nvr"]').click();
    await expect(nvr.locator('[data-step-note]')).toContainText('אפשר לבדוק שוב בעוד');
    await expect(nvr).toHaveAttribute('data-status', 'done');
    await expect(nvr.locator('[data-step-facts]')).toContainText('DS-7616NI-FAKE');
    await expect(nvr.locator('[data-step-facts]')).toContainText('4 · 4 מקוונים');
    await expect(nvr.locator('[data-step-facts]')).toContainText('H.265 2560x1440 25fps');
    await expect(page.locator('system-wizard [data-rail-step="nvr"]')).toHaveAttribute('data-status', 'done');
    await expect(page.locator('system-wizard [data-wizard-ready]')).toHaveCount(0);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(OUT, `wizard-nvr-up-${testInfo.project.name}.png`), fullPage: true });

    // the API agrees, and the checks never wrote to a device (only the start-up stream sync's own PUTs are listed)
    const state = await (await request.get('/api/v1/setup/state')).json();
    expect(state.steps.find((s: { id: string }) => s.id === 'nvr').status).toBe('done');
    const writes = (await (await control.get('/writes')).json()) as string[];
    expect(writes.every((w) => w.startsWith('go2rtc PUT smplwise_'))).toBe(true);
  });

  test('the shell hint "השלם את ההתקנה" shows while steps remain and is dismissed for the session', async ({ page }, testInfo) => {
    await page.goto('/?design=a#/live');
    await page.waitForSelector('sw-app');
    const hint = page.locator('sw-app [data-setup-hint]');
    await expect(hint).toBeVisible({ timeout: 30000 });
    await expect(hint).toContainText('השלם את ההתקנה');
    await expect(hint).toContainText('מתוך 6 שלבים הושלמו');
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(OUT, `shell-hint-${testInfo.project.name}.png`) });
    await hint.locator('a').click();
    await expect(page.locator('system-wizard [data-wizard]')).toBeVisible({ timeout: 30000 });
    await expect(hint).toHaveCount(0); // not on the wizard itself
    await page.goto('/?design=a#/live');
    await expect(hint).toBeVisible({ timeout: 30000 });
    await hint.locator('[data-setup-hint-dismiss]').click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
    await expect(hint).toHaveCount(0);
  });
});

test.describe('setup wizard in demo mode (fixture data, no backend)', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo mode runs without a backend behind the preview');

  test('the camera step explains itself; "בדוק שוב" completes the six steps and shows "מוכן לעבודה"', async ({ page }, testInfo) => {
    await openWizard(page);
    const cam = step(page, 'camera');
    await expect(cam).toHaveAttribute('data-status', 'todo');
    await expect(cam.locator('[data-step-problem]')).toContainText('אף מצלמה עוד לא מוצבת על מפה');
    await expect(cam.locator('[data-step-link]')).toHaveAttribute('href', '#/explore/floors/f0/edit');
    await expect(page.locator('system-wizard [data-wizard-progress]')).toContainText('5 מתוך 6');
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(OUT, `wizard-demo-${testInfo.project.name}.png`), fullPage: true });
    await cam.locator('[data-check="camera"]').click();
    await expect(cam).toHaveAttribute('data-status', 'done');
    const ready = page.locator('system-wizard [data-wizard-ready]');
    await expect(ready).toBeVisible();
    await expect(ready).toContainText('מוכן לעבודה');
    await expect(page.locator('system-wizard [data-rail-step][data-status="done"]')).toHaveCount(6);
    await expect(page.locator('sw-app [data-setup-hint]')).toHaveCount(0); // the hint is for a real installation only
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(OUT, `wizard-demo-ready-${testInfo.project.name}.png`), fullPage: true });
  });
});
