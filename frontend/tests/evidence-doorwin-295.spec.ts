import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installDoorwinMock, type DoorwinOptions } from './door-windows-mocks';
import { settlePage } from './pixel-settle';

// CR-039 / DOORWIN-295 against the mocked backend (tests/door-windows-mocks.ts: invented doors, rules and times). Nothing reaches access
// control, a station or a door. What it pins: the list (alarms, week, rules), the off / preparation banners, the editor with its preview,
// the manual relock check (the person says how they checked), the emergency sheet (hold -> the server's prepare -> one confirm -> the
// per-door result, failures first; a drill is forced while the real buttons are off), the red strip with its release, the settings drawer
// (real activation not approved), English LTR, no platform or vendor name, no horizontal overflow. Evidence: docs/design/evidence/DOORWIN-295/.
// The page clock is NOT faked: the screen takes "now" from the server's answer (DWNOW in the mock), and the hold ring needs real time.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'DOORWIN-295');
const SCREEN = 'sw-app door-windows-screen';

async function boot(page: Page, o: DoorwinOptions & { scheme?: 'light' | 'dark' } = {}) {
  const mock = await installDoorwinMock(page, o);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/wiskey/door-windows', 'classic', o.scheme ?? 'light'));
  await expect(page.locator(`${SCREEN} [data-dw-week]`)).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

async function hold(page: Page, selector: string, ms = 1700) {
  const b = page.locator(selector);
  await b.scrollIntoViewIfNeeded();
  const box = (await b.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('the list: an unconfirmed relock first, the week per door, the rules', async ({ page }, info) => {
  const { errors } = await boot(page, { alarm: true });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-dw-alarm="st-yard:1"]')).toBeVisible();
  await expect(s.locator('[data-dw-alarm] .chip')).toHaveText('חזרה למצב רגיל לא אושרה');
  await expect(s.locator('[data-dw-door="st-lobby:1"] [data-dw-occ="active"] .chip')).toHaveText('פתוח עד 11:00');
  await expect(s.locator('[data-dw-rule]')).toHaveCount(3);
  await expect(s.locator('[data-dw-rule="r-delivery"]')).toHaveAttribute('data-dw-rule-state', 'draft');
  const text = await s.innerText();
  expect(text).not.toMatch(/wiskey|home assistant|ingress|אינטרקום/i);
  expect(text).not.toMatch(/הדלת סגורה/); // CR-039 18.2: never a physical claim
  await noOverflow(page);
  await shot(page, info, '01-list');
  expect(errors).toEqual([]);
});

test('the off and preparation banners', async ({ page }, info) => {
  await boot(page, { enabled: false, tier: 'prepared' });
  await expect(page.locator(`${SCREEN} [data-dw-banner="off"]`)).toBeVisible();
  await shot(page, info, '02-off');
  await boot(page, { enabled: true, tier: 'prepared' });
  await expect(page.locator(`${SCREEN} [data-dw-banner="prepared"]`)).toBeVisible();
  await expect(page.locator(`${SCREEN} [data-dw-occ="prepared"]`).first()).toBeVisible();
  await shot(page, info, '03-prepared');
});

test('the editor: doors the person may manage, days and hours, preview, save asks for confirmation', async ({ page }, info) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-new]').click();
  const ed = s.locator('[data-dw-editor]');
  await expect(ed).toBeVisible();
  await expect(ed.locator('[data-dw-door="st-dock:2"]')).toHaveCount(0); // exterior, not allowed
  await s.locator('#dw-name').fill('פתיחת בוקר');
  await ed.locator('[data-dw-door="st-lobby:1"]').check();
  await s.locator('[data-dw-preview-btn]').click();
  await expect(s.locator('[data-dw-preview] li')).toHaveCount(4);
  await shot(page, info, '04-editor-preview');
  await s.locator('[data-dw-save-enable]').click();
  await expect(s.locator('[data-dw-confirm-btn]')).toBeVisible(); // sw-dialog's host has no box (its <dialog> is in the top layer)
  await s.locator('[data-dw-confirm-btn]').click();
  await expect.poll(() => mock.posts.find((p) => p.path === 'doors/windows/rules')?.body).toMatchObject({
    name: 'פתיחת בוקר', kind: 'weekly', enable: true, confirmed: true, doors: [{ station_id: 'st-lobby', relay: 1 }] });
});

test('the editor refuses a range that ends before it starts, before any request', async ({ page }) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-new]').click();
  await s.locator('#dw-name').fill('x');
  await s.locator('[data-dw-editor] [data-dw-door="st-lobby:1"]').check();
  await s.locator('[data-dw-range="0"] input[type="time"]').nth(1).fill('07:00');
  await s.locator('[data-dw-range="0"] input[type="time"]').nth(1).dispatchEvent('change');
  await s.locator('[data-dw-save-draft]').click();
  await expect(s.locator('[data-dw-error]')).toContainText('שעת הסיום');
  expect(mock.posts.filter((p) => p.path === 'doors/windows/rules')).toHaveLength(0);
});

test('the manual relock check records how the person checked', async ({ page }, info) => {
  const { mock } = await boot(page, { alarm: true });
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-manual]').click();
  await expect(s.locator('[data-dw-manual-confirm]')).toHaveAttribute('disabled', '');
  await s.locator('[data-dw-checked="camera"]').check();
  await shot(page, info, '05-manual-check');
  await s.locator('[data-dw-manual-confirm]').click();
  await expect.poll(() => mock.posts.find((p) => p.path.endsWith('/confirm-closed'))?.body).toEqual({ checked: 'camera', confirmed: true });
});

test('the guard override asks first and sends the confirmation', async ({ page }) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-endnow]').first().click();
  await expect(s.locator('[data-dw-confirm]')).toContainText('יסתיים עכשיו');
  await s.locator('[data-dw-confirm-btn]').click();
  await expect.poll(() => mock.posts.find((p) => p.path.endsWith('/end-now'))?.body).toEqual({ confirmed: true });
});

test('emergency: off -> drill forced; hold, the server\'s prepare, one confirm, the result failures first', async ({ page }, info) => {
  const { mock, errors } = await boot(page, { emergency: { enabled: false } });
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-emergency]').click();
  const sheet = s.locator('door-emergency-sheet');
  await expect(sheet.locator('[data-em-step="choose"]')).toBeVisible();
  await expect(sheet.locator('[data-em-drill]')).toBeChecked();
  await expect(sheet.locator('[data-em-drill]')).toBeDisabled();
  await shot(page, info, '06-emergency-choose');
  // a short tap does nothing
  await sheet.locator('door-hold-button[data-em-kind="lock_secure"] button').click();
  expect(mock.posts.filter((p) => p.path === 'doors/emergency/prepare')).toHaveLength(0);
  await hold(page, `${SCREEN} door-emergency-sheet door-hold-button[data-em-kind="lock_secure"] button`);
  await expect(sheet.locator('[data-em-step="confirm"]')).toBeVisible();
  await expect(sheet.locator('[data-em-confirm-text]')).toContainText('4');
  expect(mock.posts.find((p) => p.path === 'doors/emergency/prepare')?.body).toMatchObject({ action: 'start', kind: 'lock_secure', drill: true });
  expect(mock.posts.filter((p) => p.path === 'doors/emergency/incidents')).toHaveLength(0); // nothing started before the confirm
  await shot(page, info, '07-emergency-confirm');
  await sheet.locator('[data-em-confirm]').click();
  await expect(sheet.locator('[data-em-step="result"]')).toBeVisible();
  const start = mock.posts.find((p) => p.path === 'doors/emergency/incidents')!.body;
  expect(start).toMatchObject({ confirm_token: 'tok_SAMPLE_not_a_secret_0123456789', confirmed: true });
  expect(String(start.client_request_id)).toMatch(/^[0-9a-f-]{36}$/);
  await expect(sheet.locator('[data-em-headline]')).toContainText('2 מתוך 4');
  await expect(sheet.locator('[data-em-door]').first()).toContainText('נדחה'); // failures first
  await shot(page, info, '08-emergency-result');
  expect(errors).toEqual([]);
});

test('emergency: the red strip while in effect, released by hold then confirm', async ({ page }, info) => {
  const { mock } = await boot(page, { emergency: { enabled: true, active: 'lock' } });
  const s = page.locator(SCREEN);
  const strip = s.locator('door-emergency-strip');
  await expect(strip.locator('[data-em-strip="lock_secure"]')).toContainText('נעילת כל הדלתות');
  await expect(strip).toContainText('2 מתוך 4 אושרו');
  await noOverflow(page);
  await shot(page, info, '09-strip');
  await hold(page, `${SCREEN} door-emergency-strip door-hold-button[data-em-release] button`);
  await expect(strip.locator('[data-em-release-confirm]')).toBeVisible();
  await strip.locator('[data-em-release-confirm]').click();
  await expect.poll(() => mock.posts.find((p) => /incidents\/inc-1\/release$/.test(p.path))?.body).toMatchObject({ confirmed: true });
});

test('a person without the emergency permissions sees no emergency entry; an operator sees no editor', async ({ page }) => {
  await boot(page, { emergency: { lock: false, open: false }, can: { manage: false, cancel: true, configure: false } });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-dw-emergency]')).toHaveCount(0);
  await expect(s.locator('[data-dw-new]')).toHaveCount(0);
  await expect(s.locator('[data-dw-edit]')).toHaveCount(0);
  await expect(s.locator('[data-dw-settings-btn]')).toHaveCount(0);
  await expect(s.locator('[data-dw-endnow]').first()).toBeVisible();
});

test('settings: a system administrator sees the switches; real emergency activation is not approved in this build', async ({ page }, info) => {
  await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-settings-btn]').click();
  await expect(s.locator('[data-dw-settings]')).toBeVisible();
  await expect(s.locator('[data-dw-golive]')).toBeVisible();
  await expect(s.locator('[data-dw-switch="doors.emergency.enabled"] input')).toBeDisabled();
  await expect(s.locator('[data-dw-switch="doors.emergency.open_enabled"] input')).toBeDisabled();
  await expect(s.locator('[data-dw-programs-golive]')).toBeVisible();
  await shot(page, info, '10-settings');
});

test('settings: door-window programs and emergency buttons are independent (SPLITSWITCH-297)', async ({ page }) => {
  await boot(page, { programsLive: true });
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-settings-btn]').click();
  await expect(s.locator('[data-dw-settings]')).toBeVisible();
  await expect(s.locator('[data-dw-programs-golive]')).toHaveCount(0);
  await expect(s.locator('[data-dw-switch="doors.windows.enabled"] input')).toBeEnabled();
  await expect(s.locator('[data-dw-golive]')).toBeVisible();
  await expect(s.locator('[data-dw-switch="doors.emergency.enabled"] input')).toBeDisabled();
});

test('English, left to right, dark', async ({ page }, info) => {
  await boot(page, { alarm: true, scheme: 'dark' });
  await page.evaluate(() => { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; });
  await page.locator(SCREEN).evaluate((el: HTMLElement & { requestUpdate?: () => void }) => el.requestUpdate?.());
  await expect(page.locator(`${SCREEN} [data-dw-week] h2`)).toHaveText('Today and this week');
  await noOverflow(page);
  await shot(page, info, '11-english-dark');
});

test('settings: the emergency-buttons switch is on by default; turning it off asks first and sends the confirmation (SPLITSWITCH2-297)', async ({ page }) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-dw-settings-btn]').click();
  const sw = s.locator('[data-dw-switch="doors.emergency.engine_switch"] input');
  await expect(sw).toBeChecked();
  await expect(sw).toBeEnabled();
  await expect(s.locator('[data-dw-engine-off]')).toHaveCount(0);
  await sw.uncheck();
  await expect(s.locator('[data-dw-engine-off]')).toBeVisible();
  await s.locator('[data-dw-settings-save]').click();
  // asked first: nothing sent yet. The sw-dialog host has no box of its own (a fixed backdrop inside), so check its button.
  await expect(s.locator('sw-dialog[open][data-dw-engine-off-confirm] [data-dw-engine-off-btn]')).toBeVisible();
  expect(mock.posts.find((p) => p.path === 'doors/emergency/settings')).toBeUndefined();
  await s.locator('[data-dw-engine-off-btn]').click();
  await expect.poll(() => mock.posts.find((p) => p.path === 'doors/emergency/settings')?.body)
    .toMatchObject({ changes: { 'doors.emergency.engine_switch': 'off' }, confirmed: true, confirm_engine_off: true });
});