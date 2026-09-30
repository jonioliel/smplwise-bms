import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-010 (אבטחה › לייב | חקירה | אזעקה; the alarm is #/security/alarm again and also a page of הגדרות › אבטחה › אזעקה). Two parts:
//
// 1. Navigation and the alarm screen on the demo data (no backend - the static preview, like screens.spec.ts):
//      npx playwright test tests/evidence-alarm.spec.ts
// 2. The alarm against the REAL backend with a fake Home Assistant side (tests/fixtures/devices_fake_ha.py, which seeds
//    the Risco and PAI shapes of smplwise_vms/backend/tests/fake_alarm.py on POST /seed-alarm and answers the bridge):
//      SW_PORT=8356 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv>/python frontend/tests/fixtures/devices_fake_ha.py
//      SW_LIVE=1 SW_ALARM_FIXTURE=1 SW_API_PORT=8356 SW_BASE_URL=http://127.0.0.1:4196/ npx playwright test tests/evidence-alarm.spec.ts --workers=1
//    The fake panel's code (1234) and the test PIN are fixture values; nothing is armed or disarmed anywhere real.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/CR010');
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';
// UI round 1: the sections are a segmented control at the head of the page (wide) or the phone's sticky row
const SECTIONS = 'sw-app nav[data-security-sections], sw-app nav[data-security-row]';
const LIVE = process.env.SW_LIVE === '1' && process.env.SW_ALARM_FIXTURE === '1';

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto('about:blank');
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(LIVE ? 900 : 400);
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test.describe('CR-010 navigation: אבטחה › לייב | חקירה | אזעקה, and the alarm in הגדרות › אבטחה (demo data)', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-data part: runs against the static preview');

  test('the rail / bottom bar: ראשי · אבטחה · מפה · WisKey (CR-013; מערכת moved into the user menu) - live and investigate are sections, not areas', async ({ page }, info) => {
    await open(page, '/live');
    const phone = info.project.name === 'mobile';
    const nav = phone ? BOTTOM : RAIL;
    const hrefs = await page.locator(`${nav} a[data-nav]`).evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    expect(hrefs).toEqual(['#/devices/building', '#/security', '#/explore/sites', '#/wiskey/overview']);
    await expect(page.locator(`${nav} a[href="#/security"]`)).toHaveClass(/active/);
    // the sections: a segmented control at the head of the page; on the phone a sticky row above the tabs
    const sections = page.locator(phone ? 'sw-app nav[data-security-row]' : SECTIONS);
    await expect(sections).toBeVisible();
    await expect(sections.locator('a')).toHaveText(['לייב', 'חקירה', 'אזעקה']); // the alarm section is last by default
    await expect(sections.locator('a[data-section="live"]')).toHaveAttribute('aria-current', 'page');
    // the section's own pages stay the tab row under it
    await expect(page.locator('sw-app .subnav sw-tabs')).toBeVisible();
    if (phone) await noOverflow(page);
    await shot(page, 'nav-live', info.project.name);
  });

  test('old deep links still land on their screens, inside the right section', async ({ page }) => {
    for (const [hash, tag, section] of [
      ['/live/wall', 'live-wall', 'live'],
      ['/live/views', 'live-views', 'live'],
      ['/investigate/health', 'system-devices', 'investigate'],
      ['/investigate/events', 'investigate-events', 'investigate'],
      ['/investigate/playback', 'investigate-playback', 'investigate'],
      ['/investigate/floors/f0/history', 'investigate-history-map', 'investigate'],
      ['/security/alarm', 'security-alarm', 'alarm'],
    ] as const) {
      await open(page, hash);
      await expect(page.locator(`sw-app ${tag}`), hash).toHaveCount(1);
      await expect(page.locator(`sw-app nav[data-security-sections] a[data-section="${section}"], sw-app nav[data-security-row] a[data-section="${section}"]`).first(), hash).toHaveAttribute('aria-current', 'page');
    }
  });

  test('moved routes redirect and keep their query: camera health, the alarm management; #/security/alarm stays canonical (panel kept)', async ({ page }) => {
    for (const [from, to, tag] of [
      ['/system/devices', '#/investigate/health', 'system-devices'],
      ['/system/devices?sort=offline', '#/investigate/health?sort=offline', 'system-devices'],
      ['/security/alarm', '#/security/alarm', 'security-alarm'],
      ['/security/alarm?panel=alarm_control_panel.demo_house', '#/security/alarm?panel=alarm_control_panel.demo_house', 'security-alarm'],
      ['/system/security/alarm?panel=alarm_control_panel.demo_house', '#/system/security/alarm?panel=alarm_control_panel.demo_house', 'security-alarm'],
      ['/system/diagnostics?tab=alarm', '#/system/security/manage', 'system-alarm-settings'],
      ['/system/security', '#/system/security/alarm', 'security-alarm'],
    ] as const) {
      await open(page, from);
      await expect.poll(() => page.evaluate(() => location.hash), from).toBe(to);
      await expect(page.locator(`sw-app ${tag}`), from).toHaveCount(1);
    }
  });

  test('camera health is a tab of חקירה, no longer of לייב', async ({ page }) => {
    await open(page, '/live');
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['תמונת מצב', 'כל המצלמות', 'תצוגות שמורות']);
    await open(page, '/investigate/events');
    const tabs = page.locator('sw-app .subnav sw-tabs a');
    await expect(tabs.last()).toHaveText('בריאות מצלמות');
    await expect(tabs.last()).toHaveAttribute('href', '#/investigate/health');
  });

  test('הגדרות › אבטחה: the alarm screen, its management and the NVR are pages of one Settings section', async ({ page }, info) => {
    await open(page, '/system/security');
    await expect(page.locator('sw-app .subnav sw-tabs a[href="#/system/security"]')).toHaveClass(/on/);
    const sub = page.locator('sw-app system-security [data-security-settings-tabs] sw-tabs a');
    await expect(sub).toHaveText(['אזעקה', 'ניהול אזעקה', 'NVR']);
    await expect(sub.first()).toHaveClass(/on/);
    await expect(page.locator('sw-app system-security security-alarm')).toHaveCount(1);
    await sub.nth(1).click();
    await expect(page.locator('sw-app system-security system-alarm-settings')).toHaveCount(1);
    await sub.nth(2).click();
    await expect(page.locator('sw-app system-security system-security-nvr')).toHaveCount(1);
    if (info.project.name === 'mobile') await noOverflow(page);
  });

  test('the general settings keep no alarm tab (it is under אבטחה)', async ({ page }) => {
    await open(page, '/system/diagnostics');
    await expect(page.locator('sw-app system-diagnostics sw-tabs').first()).not.toContainText('אזעקה');
  });

  test('#/security opens the section used last (לייב the first time)', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('/#/security');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/live');
    await open(page, '/investigate/events');
    await page.goto('/#/security');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/investigate/events');
    await open(page, '/security/alarm');
    await page.goto('/#/security');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/security/alarm');
  });

  test('no breadcrumb bar (UI round 1): the pages keep their own titles', async ({ page }) => {
    await open(page, '/live/wall');
    await expect(page.locator('sw-app .crumbs-a')).toHaveCount(0);
    await open(page, '/security/alarm');
    await expect(page.locator('sw-app .crumbs-a')).toHaveCount(0);
  });

  test('the Lovelace card view and the kiosk carry no chrome', async ({ page }) => {
    await open(page, '/live/wall?embed=1');
    await expect(page.locator(RAIL)).toHaveCount(0);
    await expect(page.locator(SECTIONS)).toHaveCount(0);
    await page.evaluate(() => sessionStorage.clear());
    await open(page, '/kiosk/all');
    await expect(page.locator('sw-app kiosk-wall')).toHaveCount(1);
    await expect(page.locator(SECTIONS)).toHaveCount(0);
  });

  test('Ctrl+K offers the alarm section', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'a keyboard shortcut (the phone opens the same search from its corner button)');
    await open(page, '/explore/sites');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('אזעקה');
    const row = page.locator('sw-app .results .row').first();
    await expect(row).toContainText('אבטחה › אזעקה');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/security/alarm');
  });

  test('design B: no flat אזעקה entry; the alarm address still opens the screen', async ({ page }) => {
    await open(page, '/security/alarm', 'b');
    await expect(page.locator('sw-app security-alarm')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/security/alarm');
    await expect(page.locator(`${RAIL} a[href="#/security/alarm"]`)).toHaveCount(0);
  });

  test('the alarm screen on demo data: state card, ready-to-arm, zones by area, filters, keypad', async ({ page }, info) => {
    await open(page, '/security/alarm');
    const hero = page.locator('security-alarm section.hero');
    await expect(hero).toHaveAttribute('data-alarm-state', 'disarmed');
    await expect(hero.locator('.state-label')).toHaveText('מנוטרלת');
    await expect(page.locator('security-alarm [data-arm]')).toHaveCount(3);
    await expect(page.locator('security-alarm [data-alarm-ready="no"]')).toContainText('דלת אחורית');
    await expect(page.locator('security-alarm article.zone')).toHaveCount(6);
    await shot(page, 'alarm-demo', info.project.name);
    await page.locator('security-alarm [data-filter="bypassed"]').click();
    await expect(page.locator('security-alarm article.zone')).toHaveCount(1);
    await page.locator('security-alarm [data-filter="all"]').click();
    // the demo panel is disarmed (disarm is off) and asks for a PIN to bypass: the keypad is masked, numeric, never
    // autocompleted, and empty when reopened
    await expect(page.locator('security-alarm [data-disarm]')).toHaveAttribute('disabled', '');
    const toggle = page.locator('security-alarm [data-bypass="binary_sensor.demo_zone_2"]');
    await toggle.click();
    const input = page.locator('security-alarm input[data-code]');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('inputmode', 'numeric');
    await expect(input).toHaveAttribute('autocomplete', 'one-time-code'); // review L6: never a saved password
    for (const k of ['1', '2', '3', '4']) await page.locator(`security-alarm [data-key="${k}"]`).click();
    await expect(input).toHaveValue('1234');
    await shot(page, 'alarm-keypad', info.project.name);
    await page.locator('security-alarm sw-dialog sw-button', { hasText: 'ביטול' }).click();
    await toggle.click();
    await expect(page.locator('security-alarm input[data-code]')).toHaveValue('');
    if (info.project.name === 'mobile') await noOverflow(page);
  });
});

test.describe('CR-010 alarm against the real backend (fake Home Assistant side)', () => {
  test.skip(!LIVE, 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_ALARM_FIXTURE=1)');
  const PIN = '582046'; // 6 digits: alarm.pin_min_length defaults to 6 (review L8)
  const HOUSE = 'alarm_control_panel.risco_house';

  test.beforeAll(async ({ request }) => {
    const control = `http://127.0.0.1:${Number(process.env.SW_API_PORT || '8099') + 1}`;
    const seed = await request.post(`${control}/seed-alarm`, { data: {} });
    expect(seed.status()).toBe(200);
    // the stored panel code (the fake panel's 1234) and the admin's own PIN, set as an administrator would
    for (const p of [HOUSE, 'alarm_control_panel.risco_garden']) expect((await request.put(`/api/v1/alarm/panels/${p}/code`, { data: { code: '1234' } })).status()).toBe(200);
    // an administrator's own PIN and policy are set by ANOTHER administrator (security review M3): a second admin, 'boss'
    const boss = { 'X-SW-Dev-User': 'boss' };
    await request.get('/api/v1/me', { headers: boss });
    const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: 'dev-boss', role_id: 'system_admin', scope_type: 'installation', scope_id: '*' } });
    expect([201, 409]).toContain(b.status());
    expect((await request.put('/api/v1/alarm/users/dev-joni/pin', { data: { pin: PIN }, headers: boss })).status()).toBe(200);
    expect((await request.put('/api/v1/alarm/users/dev-joni/policy', { data: { arm_policy: 'no_code', disarm_policy: 'code_required' }, headers: boss })).status()).toBe(200);
  });

  test('the panels, the switcher and the Risco zones with their bypass switches', async ({ page }, info) => {
    await open(page, `/security/alarm?panel=${HOUSE}`);
    // The three panels this fixture seeds (two Risco partitions + one PAI area). Not an exact count: live specs share one
    // backend, and evidence-devices*.spec.ts seed their own alarm_control_panel.cr007_house through the same developer
    // endpoints, which discovery rightly lists too (a run after them shows 4).
    for (const p of [HOUSE, 'alarm_control_panel.risco_garden', 'alarm_control_panel.paradox_partition_area_1']) {
      await expect(page.locator(`security-alarm [data-alarm-switcher] button[data-panel="${p}"]`), p).toHaveCount(1, { timeout: 30000 });
    }
    expect(await page.locator('security-alarm [data-alarm-switcher] button').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator(`security-alarm section.hero[data-alarm-panel="${HOUSE}"]`)).toBeVisible();
    await expect(page.locator('security-alarm article.zone')).toHaveCount(8);
    await expect(page.locator('security-alarm article.zone [data-bypass]')).toHaveCount(8);
    await expect(page.locator('security-alarm article.zone[data-zone="binary_sensor.kitchen_window"]')).toHaveAttribute('data-tone', 'bypassed');
    await shot(page, 'alarm-live', info.project.name);
    if (info.project.name === 'mobile') await noOverflow(page);
  });

  test('arm without a code (no_code), disarm with the PIN: a wrong PIN is refused, the right one disarms', async ({ page }, info) => {
    await open(page, `/security/alarm?panel=${HOUSE}`);
    const hero = page.locator('security-alarm section.hero');
    await expect(hero).toHaveAttribute('data-alarm-state', /disarmed|armed_away/, { timeout: 30000 });
    if ((await hero.getAttribute('data-alarm-state')) !== 'disarmed') test.skip(true, 'the fixture panel is not disarmed (a rerun on the same backend)');
    await page.locator('security-alarm [data-arm="arm_away"]').click();
    await expect(hero).toHaveAttribute('data-alarm-state', 'armed_away', { timeout: 15000 });
    await page.locator('security-alarm [data-disarm]').click();
    // one wrong PIN per run (desktop only): five in five minutes lock the user and the panel out for ten
    if (info.project.name === 'desktop') {
      for (const k of ['9', '9', '9', '9', '9', '9']) await page.locator(`security-alarm [data-key="${k}"]`).click();
      await page.locator('security-alarm [data-alarm-confirm]').click();
      await expect(page.locator('security-alarm [data-code-error]')).toHaveText('קוד שגוי');
      await expect(page.locator('security-alarm input[data-code]')).toHaveValue('');
    }
    await page.locator('security-alarm input[data-code]').fill(PIN);
    await page.locator('security-alarm [data-alarm-confirm]').click();
    await expect(hero).toHaveAttribute('data-alarm-state', 'disarmed', { timeout: 15000 });
  });

  test('bypass a zone: confirmation with the PIN, then the zone shows עקוף', async ({ page }) => {
    await open(page, `/security/alarm?panel=${HOUSE}`);
    const zone = page.locator('security-alarm article.zone[data-zone="binary_sensor.back_door"]');
    await expect(zone).toBeVisible({ timeout: 30000 });
    const wasBypassed = (await zone.getAttribute('data-tone')) === 'bypassed';
    await zone.locator('[data-bypass]').click();
    await expect(page.locator('security-alarm input[data-code]')).toBeVisible(); // the dialog host itself has no box (fixed backdrop)
    await page.locator('security-alarm input[data-code]').fill(PIN);
    await page.locator('security-alarm [data-alarm-confirm]').click();
    if (wasBypassed) await expect(zone).not.toHaveAttribute('data-tone', 'bypassed', { timeout: 15000 });
    else await expect(zone).toHaveAttribute('data-tone', 'bypassed', { timeout: 15000 });
  });

  test('settings › אבטחה › ניהול אזעקה lists the panels with their pairing; the panel code is write-only', async ({ page, request }, info) => {
    await open(page, '/system/security/manage');
    const card = page.locator(`system-alarm-settings [data-alarm-settings-panel="${HOUSE}"]`);
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.locator('tr[data-pair-row]')).toHaveCount(8);
    await expect(card).toContainText('מוגדר');
    const cfg = await (await request.get('/api/v1/alarm/config')).text();
    expect(cfg).not.toContain('"1234"');
    await shot(page, 'alarm-settings', info.project.name);
  });
});
