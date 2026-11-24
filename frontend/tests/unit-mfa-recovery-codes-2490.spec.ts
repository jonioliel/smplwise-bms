import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-RECOVERY-CODES-2490 (owner Q49: 10 recovery codes per user, each usable once): the recovery-codes part of החשבון שלי › אימות
// דו־שלבי, against a mocked wire contract of smplwise/routers/second_factor.py (invented user and codes, no real secret).
// Covered: the first batch is shown once after the enrolment's first code (copy / download / "I saved the codes" hides it for good),
// the remaining count, the low and empty warnings, "new codes" asks the current authenticator code and shows the new batch once,
// removing the factor with a recovery code (the lost-phone path), and the sign-in page's "use a recovery code" switch.
//   SW_BASE_URL=<the vite dev server>/ npx playwright test tests/unit-mfa-recovery-codes-2490.spec.ts --workers=2
// SW_SHOTS=<dir>: also writes the compare-page screenshots there (light + dark).
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details }, status);

const KEY = 'JBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/SmplWise%20Arx%3Adana?secret=${KEY}&issuer=SmplWise%20Arx&algorithm=SHA1&digits=6&period=30`;
const FIRST = ['7KQ2-M9XD', 'H4TW-2PRB', 'C8ZN-5VJE', 'Q3FA-W7MK', '9RDY-6HTN', 'B2XG-K8PV', 'M5JC-3QWZ', 'T6NE-9AFR', 'W4HB-7DXK', 'P8VM-2CYJ'];
const SECOND = ['A1B2-C3D4', 'E5F6-G7H8', 'J9K0-M1N2', 'P3Q4-R5S6', 'T7V8-W9X0', 'Y1Z2-A3B4', 'C5D6-E7F8', 'G9H0-J1K2', 'M3N4-P5Q6', 'R7S8-T9V0'];

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  enabled: boolean;
  remaining: number;
}

async function setup(page: Page, init: Partial<Mock> = {}): Promise<Mock> {
  const st: Mock = { calls: [], enabled: false, remaining: 0, ...init };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const perms = ['video.live', 'devices.read'];
    if (p === 'me') return json(route, { user: { id: 'u-dana', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.scheme': 'auto' }, can_edit: false }); // auto: the shots follow the emulated light / dark
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'auth/sessions') return json(route, { scope: 'own', can_manage: false, channel: 'local', sessions: [] });
    const body = method === 'GET' ? null : (req.postDataJSON() as { code?: string } | null);
    const status = () => ({ enabled: st.enabled, enabled_at: st.enabled ? '2026-11-20T09:00:00Z' : null, last_used_at: null });
    const recovery = () => ({ remaining: st.remaining, total: st.enabled ? 10 : 0, created_at: st.enabled ? '2026-11-20T09:00:00Z' : null, last_used_at: null, low: st.enabled && st.remaining <= 3, low_at: 3 });
    if (p.startsWith('auth/second-factor') || p.startsWith('auth/recovery-codes')) st.calls.push({ method, path: p, body });
    if (p === 'auth/second-factor' && method === 'GET') return json(route, { ...status(), policy: 'optional' });
    if (p === 'auth/second-factor/enroll') return json(route, { secret: KEY, otpauth_uri: URI, issuer: 'SmplWise Arx' });
    if (p === 'auth/second-factor/confirm') {
      if (body?.code !== '123456') return err(route, 400, 'second_factor_invalid', 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.');
      st.enabled = true;
      st.remaining = 10;
      return json(route, { ...status(), recovery_codes: FIRST });
    }
    if (p === 'auth/second-factor/disable') {
      if (body?.code !== '654321' && body?.code !== 'h4tw-2prb') return err(route, 400, 'second_factor_invalid', 'הקוד אינו נכון או שכבר נעשה בו שימוש. כל קוד שחזור עובד פעם אחת בלבד.');
      st.enabled = false;
      st.remaining = 0;
      return json(route, status());
    }
    if (p === 'auth/recovery-codes' && method === 'GET') return json(route, { available: st.enabled, ...recovery() });
    if (p === 'auth/recovery-codes' && method === 'POST') {
      if (body?.code !== '222333') return err(route, 400, 'second_factor_invalid', 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.');
      st.remaining = 10;
      return json(route, { codes: SECOND, ...recovery() });
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

async function openSection(page: Page) {
  await page.goto('/?design=a#/live/cameras');
  await page.waitForSelector('sw-app');
  await page.locator(phone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-account]').click();
  await menu.locator('[data-my-second-factor] summary').click();
  return menu.locator('[data-my-second-factor] sw-second-factor');
}

/** SW_SHOTS: the account panel in light and dark for the compare page (`<name>-<width>-<scheme>.png`). */
async function shots(page: Page, name: string) {
  const dir = process.env.SW_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const panel = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await panel.screenshot({ path: path.join(dir, `${name}-${page.viewportSize()?.width ?? 0}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

test('the first batch is shown once after the enrolment, with copy and download, then only the count stays', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await setup(page);
  const section = await openSection(page);
  await expect(section.locator('[data-sf-state]')).toHaveText('כבוי');
  await expect(section.locator('[data-sf-recovery]')).toHaveCount(0); // no factor, no recovery row
  await shots(page, 'rc-off');
  await section.locator('[data-sf-enable]').click();
  await section.locator('[data-sf-code]').fill('123456');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-state]')).toContainText('פעיל');
  const fresh = section.locator('[data-sf-recovery-fresh]');
  await expect(fresh).toBeVisible();
  await expect(fresh.locator('[data-sf-recovery-once]')).toContainText('מוצגים עכשיו בלבד');
  await expect(fresh.locator('[data-sf-recovery-codes] li')).toHaveText(FIRST);
  await fresh.locator('[data-sf-recovery-codes]').scrollIntoViewIfNeeded();
  await shots(page, 'rc-fresh');
  // copy: all ten, one per line
  await fresh.locator('[data-sf-recovery-copy]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  if (copied !== null) expect(copied.split('\n')).toEqual(FIRST);
  // download: a text file with the ten codes
  const [download] = await Promise.all([page.waitForEvent('download'), fresh.locator('[data-sf-recovery-download]').click()]);
  expect(download.suggestedFilename()).toBe('arx-recovery-codes.txt');
  const text = fs.readFileSync((await download.path())!, 'utf8');
  for (const c of FIRST) expect(text).toContain(c);
  // "I saved the codes": the list is gone for good, the count stays
  await fresh.locator('[data-sf-recovery-saved]').click();
  await expect(section.locator('[data-sf-recovery-fresh]')).toHaveCount(0);
  await expect(section.locator('[data-sf-recovery-count]')).toHaveText('10 מתוך 10 זמינים');
  await expect(section.locator('[data-sf-recovery-low]')).toHaveCount(0);
  const shown = await section.evaluate((el) => (el.shadowRoot?.textContent ?? '') + document.body.innerText);
  expect(FIRST.some((c) => shown.includes(c))).toBe(false);
  const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
  expect(FIRST.some((c) => stored.includes(c))).toBe(false);
  await shots(page, 'rc-count');
  expect(errors).toEqual([]);
});

test('few codes left: the warning, then new codes after the current authenticator code', async ({ page }) => {
  const mock = await setup(page, { enabled: true, remaining: 2 });
  const section = await openSection(page);
  await expect(section.locator('[data-sf-recovery-count]')).toHaveText('2 מתוך 10 זמינים');
  await expect(section.locator('[data-sf-recovery-low]')).toContainText('נשארו מעט קודי שחזור');
  await shots(page, 'rc-low');
  await section.locator('[data-sf-recovery-new]').click();
  const step = section.locator('[data-sf-recovery-step]');
  await expect(step).toContainText('הקודים הקודמים יפסיקו לעבוד');
  await expect(section.locator('[data-sf-disable]')).toHaveCount(0); // one task at a time
  await expect(step.locator('[data-sf-confirm]')).toHaveAttribute('disabled', '');
  await step.locator('[data-sf-code]').fill('999999');
  await step.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-error]')).toContainText('קוד האימות אינו נכון');
  await expect(section.locator('[data-sf-recovery-fresh]')).toHaveCount(0);
  await step.locator('[data-sf-code]').fill('222 333');
  await step.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-recovery-codes] li')).toHaveText(SECOND);
  const posts = mock.calls.filter((c) => c.path === 'auth/recovery-codes' && c.method === 'POST').map((c) => (c.body as { code: string }).code);
  expect(posts).toEqual(['999999', '222333']);
  await section.locator('[data-sf-recovery-saved]').click();
  await expect(section.locator('[data-sf-recovery-count]')).toHaveText('10 מתוך 10 זמינים');
  await expect(section.locator('[data-sf-recovery-low]')).toHaveCount(0);
});

test('no codes left: the empty warning; the lost-phone path removes the factor with a recovery code', async ({ page }) => {
  const mock = await setup(page, { enabled: true, remaining: 0 });
  const section = await openSection(page);
  await expect(section.locator('[data-sf-recovery-count]')).toHaveText('אין קודים זמינים');
  await expect(section.locator('[data-sf-recovery-low]')).toContainText('לא נשארו קודי שחזור');
  mock.remaining = 4; // the user still has some codes in this story
  await section.locator('[data-sf-disable]').click();
  await expect(section.locator('[data-sf-recovery]')).toHaveCount(0);
  await section.locator('[data-sf-use-recovery]').click();
  const input = section.locator('[data-sf-code]');
  await expect(input).toHaveAttribute('inputmode', 'text');
  await expect(input).toHaveAttribute('placeholder', 'XXXX-XXXX');
  await input.fill('h4tw-2prx'); // U-free but not a code the server knows -> refused
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-error]')).toContainText('כל קוד שחזור עובד פעם אחת');
  await input.fill('123');
  await expect(section.locator('[data-sf-confirm]')).toHaveAttribute('disabled', '');
  await input.fill('h4tw-2prb');
  await shots(page, 'rc-disable-recovery');
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-state]')).toHaveText('כבוי');
  await expect(section.locator('[data-sf-recovery]')).toHaveCount(0);
  expect(mock.calls.filter((c) => c.path === 'auth/second-factor/disable').map((c) => (c.body as { code: string }).code)).toEqual(['h4tw-2prx', 'h4tw-2prb']);
});

test('the sign-in code step switches to a recovery code (letters, a placeholder) and back', async ({ page }) => {
  // the sign-in element is mounted directly (the dev server runs the demo shell, not the remote channel), as in
  // evidence-android-download.spec.ts; its Arx code step is the one after HA accepted the password
  await setup(page);
  await page.goto('./');
  await page.evaluate(async () => {
    const src = '/src/arx/arx-login.ts';
    await import(/* @vite-ignore */ src);
    const el = document.createElement('arx-login') as HTMLElement & { step: string };
    el.step = 'factor';
    document.body.appendChild(el);
  });
  const login = page.locator('arx-login');
  const code = login.locator('[data-arx-code]');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await login.locator('[data-arx-recovery-toggle]').click();
  await expect(code).toHaveAttribute('inputmode', 'text');
  await expect(code).toHaveAttribute('placeholder', 'XXXX-XXXX');
  await expect(login.locator('[data-arx-recovery-toggle]')).toHaveText('שימוש בקוד מהאפליקציה');
  await expect(login.locator('p.sub')).toHaveText('הזן אחד מקודי השחזור ששמרת. כל קוד עובד פעם אחת.');
  if (process.env.SW_SHOTS) {
    fs.mkdirSync(process.env.SW_SHOTS, { recursive: true });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(process.env.SW_SHOTS, `rc-login-${page.viewportSize()?.width ?? 0}-${scheme}.png`) });
    }
  }
  await login.locator('[data-arx-recovery-toggle]').click();
  await expect(code).toHaveAttribute('inputmode', 'numeric');
});

// The before / after pictures of the compare page: the same two views on the base branch and on this one (selectors that exist in
// both). Only with SW_SHOTS.
test('compare shots: the section with the factor on, and the sign-in code step', async ({ page }) => {
  test.skip(!process.env.SW_SHOTS, 'compare-page pictures only (SW_SHOTS=<dir>)');
  await setup(page, { enabled: true, remaining: 10 });
  const section = await openSection(page);
  await expect(section.locator('[data-sf-state]')).toContainText('פעיל');
  await page.waitForTimeout(300);
  await shots(page, 'cmp-on');
  await page.goto('./');
  await page.evaluate(async () => {
    const src = '/src/arx/arx-login.ts';
    await import(/* @vite-ignore */ src);
    const el = document.createElement('arx-login') as HTMLElement & { step: string };
    el.step = 'factor';
    document.body.innerHTML = '';
    document.body.appendChild(el);
  });
  await expect(page.locator('arx-login #code')).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(process.env.SW_SHOTS!, `cmp-login-${page.viewportSize()?.width ?? 0}-${scheme}.png`) });
  }
});
