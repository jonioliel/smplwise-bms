import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNER, GATE_CALL, LOBBY_CALL, installCallsMock, openApp } from './incoming-call-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-INBOUND-CALLS-2382 - the incoming-call banner over the REAL shell, against a MOCKED backend (tests/incoming-call-mocks.ts over
// tests/wiskey-stations-mocks.ts: invented stations, drawn stills, recorded commands; no WisKey, no Home Assistant, no station).
// Desktop, tablet and phone. What it pins:
//   - the banner appears on any screen when the server offers a ringing call, with the station's name, its picture, the ring clock and
//     answer / decline / open-door; nothing at all while the setting is off; no platform name on it;
//   - "answer" with no talk here sends NOTHING and opens the station with the reason; with talk it answers once (and asks for the talk);
//   - decline is one command; the door asks once and sends ONE confirmed release ("sent", never "opened");
//   - hide is remembered on this device; the station's own open drawer takes over the call; quiet hours silence the ring;
//   - on a phone the banner is a bottom sheet with 44 px+ targets inside the viewport;
//   - the station drawer lists the recent calls; the setting card saves who gets the banner.
// Evidence screenshots: docs/design/evidence/WISKEY-INBOUND-CALLS-2382/.
//   run_smart.py spec <branch> tests/evidence-incoming-call.spec.ts --project=desktop --project=tablet --project=mobile

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WISKEY-INBOUND-CALLS-2382');
const BANNED = /wiskey|home\s*assistant|hikvision|isapi|ingress|supervisor|add-on|\bHA\b/i;
const phone = (info: TestInfo) => info.project.name === 'mobile';

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const banner = (page: Page) => page.locator(BANNER);
const inBanner = (page: Page, sel: string) => page.locator(`${BANNER} ${sel}`);

test.describe('incoming call banner', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('a ringing station shows the banner on any screen: name, picture, clock and the three actions', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await expect(banner(page)).toHaveAttribute('data-state', 'ringing');
    await expect(banner(page)).toHaveAttribute('data-station', 'gate');
    await expect(inBanner(page, '[data-call-station]')).toHaveText('שער ראשי');
    await expect(inBanner(page, '[data-call-picture="still"] img')).toBeVisible();
    await expect(inBanner(page, '[data-call-clock]')).toHaveText(/^00:1\d$/);
    await expect(inBanner(page, '[data-call-answer]')).toBeVisible();
    await expect(inBanner(page, '[data-call-reject]')).toBeVisible();
    await expect(inBanner(page, '[data-call-door="1"]')).toBeVisible();
    const text = await banner(page).innerText();
    expect(text).toContain('שיחה נכנסת');
    expect(BANNED.test(text), text).toBe(false);
    await shot(page, info, 'banner-ringing');
    expect(errors).toEqual([]);
  });

  test('nothing appears while the banner is off for this user', async ({ page }) => {
    const m = await installCallsMock(page, { active: { enabled: false, mode: 'off', sound: 'ring', sound_reason: null, calls: [] } });
    await openApp(page);
    await expect.poll(() => m.activeReads, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.locator('sw-app sw-incoming-call')).toHaveCount(1);
    await expect(banner(page)).toHaveCount(0);
  });

  test('answer without talk here sends nothing and opens the station, saying why', async ({ page }, info) => {
    const m = await installCallsMock(page, { media: { gate: 'off' } });
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-answer]').click();
    await expect(page).toHaveURL(/#\/wiskey\/devices\?station=gate/);
    await expect(inBanner(page, '[data-call-note="warn"]')).toContainText('דיבור כבוי בהגדרות');
    await expect(banner(page)).toBeVisible(); // kept in view over the station's drawer, with the reason
    expect(m.stations.signals).toEqual([]);
    expect(m.talkStarts).toEqual([]);
    await shot(page, info, 'banner-no-talk');
  });

  test('answer with talk here answers the call once and opens the talk', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'the fake microphone is a chromium switch');
    const m = await installCallsMock(page, { media: { gate: 'talk' } });
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-answer]').click();
    await expect.poll(() => m.stations.signals.length, { timeout: 10_000 }).toBe(1);
    expect(m.stations.signals[0]).toMatchObject({ station: 'gate', body: { command: 'answer' } });
    // the server now reports the call as answered by this user: the in-call controls replace the ringing ones
    m.active.calls = [{ ...GATE_CALL, state: 'in_call', answered_by_me: true, answered_at: '2026-10-12T08:14:07.000Z', elapsed_s: 0 }];
    m.stations.push();
    await expect(banner(page)).toHaveAttribute('data-state', 'in_call', { timeout: 10_000 });
    await expect(inBanner(page, '[data-call-hangup]')).toBeVisible();
    await expect(inBanner(page, '[data-call-answer]')).toHaveCount(0);
    // the talk was asked for (no microphone in the test browser, or the mocked refusal): the line says so; never a second answer
    await expect(inBanner(page, '[data-call-talk]')).toBeVisible();
    expect(m.stations.signals.length).toBe(1);
    await inBanner(page, '[data-call-hangup]').click();
    await expect.poll(() => m.stations.signals.length).toBe(2);
    expect(m.stations.signals[1]).toMatchObject({ station: 'gate', body: { command: 'hangUp' } });
  });

  test('decline is one command; the banner goes when the station stops ringing', async ({ page }) => {
    const m = await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-reject]').click();
    await expect.poll(() => m.stations.signals.length).toBe(1);
    expect(m.stations.signals[0]).toMatchObject({ station: 'gate', body: { command: 'reject' } });
    m.active.calls = [];
    m.stations.push();
    await expect(banner(page)).toHaveCount(0, { timeout: 10_000 });
  });

  test('open door asks once and sends one confirmed release', async ({ page }, info) => {
    const m = await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-door="1"]').click();
    await expect(inBanner(page, '[data-call-door-ask="1"]')).toContainText('לפתוח את שער?');
    expect(m.stations.released).toEqual([]);
    await shot(page, info, 'banner-door-ask');
    await inBanner(page, '[data-call-door-yes]').click();
    await expect(inBanner(page, '[data-call-note="ok"]')).toContainText('נשלחה פקודת פתיחה');
    expect(m.stations.released.length).toBe(1);
    expect(m.stations.released[0]).toMatchObject({ station: 'gate', body: { lock: 1, confirmed: true } });
    // cancel sends nothing
    await inBanner(page, '[data-call-door="1"]').click();
    await inBanner(page, '[data-call-door-no]').click();
    await expect(inBanner(page, '[data-call-door-ask]')).toHaveCount(0);
    expect(m.stations.released.length).toBe(1);
  });

  test('hide is remembered on this device; the next call still shows', async ({ page }) => {
    const m = await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-hide]').click();
    await expect(banner(page)).toHaveCount(0);
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect.poll(() => m.activeReads, { timeout: 30_000 }).toBeGreaterThan(1);
    await expect(banner(page)).toHaveCount(0);
    m.active.calls = [{ ...GATE_CALL }, { ...LOBBY_CALL }];
    m.stations.push();
    await expect(banner(page)).toHaveAttribute('data-station', 'lobby', { timeout: 10_000 });
    // two relays: each door is named
    await expect(inBanner(page, '[data-call-door="2"]')).toContainText('מחסום');
  });

  test('two calls: the newest in front, the other one step away', async ({ page }, info) => {
    await installCallsMock(page, { active: { enabled: true, mode: 'everyone', sound: 'ring', sound_reason: null, calls: [{ ...GATE_CALL }, { ...LOBBY_CALL }] } });
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toHaveAttribute('data-station', 'lobby', { timeout: 30_000 });
    await expect(inBanner(page, '[data-call-next]')).toHaveText('עוד 1');
    await inBanner(page, '[data-call-next]').click();
    await expect(banner(page)).toHaveAttribute('data-station', 'gate');
    await shot(page, info, 'banner-two-calls');
  });

  test("the station's open drawer takes over its ringing call", async ({ page }) => {
    await installCallsMock(page);
    await openApp(page, '#/wiskey/devices?station=gate');
    await expect.poll(async () => page.locator('sw-app sw-incoming-call').count(), { timeout: 30_000 }).toBe(1);
    await page.waitForTimeout(1500);
    await expect(banner(page)).toHaveCount(0);
    await page.evaluate(() => (window.location.hash = '#/explore/floors/f0'));
    await expect(banner(page)).toBeVisible({ timeout: 10_000 });
  });

  test('quiet hours: the banner shows without a ring and says so', async ({ page }, info) => {
    await installCallsMock(page, { active: { enabled: true, mode: 'everyone', sound: 'silent', sound_reason: 'quiet_hours', calls: [{ ...GATE_CALL }] } });
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    await expect(inBanner(page, '[data-call-sound="quiet"]')).toHaveText('שעות שקט · בלי צליל');
    await expect(inBanner(page, '[data-call-silence]')).toHaveCount(0);
    await shot(page, info, 'banner-quiet');
  });

  test('phone: a bottom sheet inside the viewport with large targets', async ({ page }, info) => {
    test.skip(!phone(info), 'phone layout');
    await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(banner(page)).toBeVisible({ timeout: 30_000 });
    const vp = page.viewportSize()!;
    const box = (await banner(page).boundingBox())!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.abs(box.y + box.height - vp.height)).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThan(vp.height * 0.85);
    for (const sel of ['[data-call-answer]', '[data-call-reject]', '[data-call-door="1"]']) {
      const b = (await inBanner(page, sel).boundingBox())!;
      expect(b.height, sel).toBeGreaterThanOrEqual(44);
      expect(b.x, sel).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, sel).toBeLessThanOrEqual(vp.width + 0.5);
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll).toBeLessThanOrEqual(0);
  });
});

test.describe('the call log in the station drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the drawer lists the recent calls: answered by whom, missed, elsewhere, declined, the door', async ({ page }, info) => {
    const m = await installCallsMock(page, { active: { enabled: false, mode: 'off', sound: 'ring', sound_reason: null, calls: [] } });
    await openApp(page, '#/wiskey/devices?station=gate');
    expect(m.log.length).toBe(4);
    const log = page.locator('sw-app wiskey-stations wk-call-history [data-call-log="ready"]');
    await expect(log).toBeVisible({ timeout: 30_000 });
    await expect(log.locator('[data-call-row]')).toHaveCount(4);
    await expect(log.locator('[data-call-row="l1"]')).toContainText('נענתה ע״י דנה');
    await expect(log.locator('[data-call-row="l1"] [data-call-row-door]')).toContainText('דלת נפתחה ע״י דנה');
    await expect(log.locator('[data-call-row="l1"]')).toContainText('01:35');
    await expect(log.locator('[data-call-row="l2"]')).toHaveAttribute('data-tone', 'warn');
    await expect(log.locator('[data-call-row="l2"]')).toContainText('לא נענתה');
    await expect(log.locator('[data-call-row="l3"]')).toContainText('נענתה במקום אחר');
    await expect(log.locator('[data-call-row="l4"]')).toContainText('נדחתה ע״י עומר');
    expect(BANNED.test(await log.innerText())).toBe(false);
    await log.scrollIntoViewIfNeeded();
    await shot(page, info, 'drawer-call-log');
  });
});

test.describe('the banner setting', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('off by default; choosing roles needs a role; saving sends exactly the choice', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
    const m = await installCallsMock(page, { active: { enabled: false, mode: 'off', sound: 'ring', sound_reason: null, calls: [] } });
    await openApp(page, '#/system/diagnostics?tab=access-control');
    const card = page.locator('sw-app system-call-banner sw-card[data-call-banner-setting="ready"]');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute('data-mode', 'off');
    const save = page.locator('sw-app system-call-banner [data-save-call-banner]');
    await page.locator('sw-app system-call-banner select[data-call-banner-mode]').selectOption('roles');
    await expect(card.locator('[data-call-banner-roles] [role="alert"]')).toBeVisible();
    await page.locator('sw-app system-call-banner input[data-call-banner-role="operator"]').check();
    await page.locator('sw-app system-call-banner input[data-call-banner-station="gate"]').check();
    await card.scrollIntoViewIfNeeded();
    await shot(page, info, 'setting-roles');
    await save.click();
    await expect.poll(() => m.saved.length).toBe(1);
    expect(m.saved[0]).toEqual({ mode: 'roles', roles: ['operator'], stations: ['gate'], sound: true });
    expect(BANNED.test(await card.innerText())).toBe(false);
  });
});
