import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installMfaMock, openSecurity, openUserDrawer } from './mfa-screens-mocks';

// MFA-FACTOR-HARDEN-2520 (review MFA-REVIEW-2520 N-1 / N-5), against the MOCKED backend of tests/mfa-screens-mocks.ts (invented users):
//   1. the user drawer's reset: the preflight answers `reason: reauth` (the administrator's own sign-in is older than 5 minutes and the
//      request came from outside) - the dialog says "sign in again", offers no confirm button and sends nothing; Hebrew and English;
//   2. My account › Security: turning the authenticator on answers 403 `reauth_required` - the screen says "a fresh sign-in" in the
//      reader's language (the server's own words are Hebrew only).
//   SW_BASE_URL=http://localhost:4173/ npx playwright test tests/evidence-mfa-factor-harden-2520.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOT_DIR=<dir> (+ SW_SCHEME=light|dark) also writes the compare-page pictures of the two states.

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const REAUTH_HE = 'לאיפוס מבחוץ צריך כניסה טרייה';
const REAUTH_EN = 'Resetting from outside needs a fresh sign-in';

async function shot(loc: Locator, name: string) {
  const dir = process.env.SW_SHOT_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await loc.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}-${process.env.SW_SCHEME ?? 'light'}.png`), animations: 'disabled' });
}

async function scheme(page: Page) {
  const dark = process.env.SW_SCHEME === 'dark';
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  // the app's scheme is the browser's own choice, else the installation's `ui.scheme` (light) - not the OS (design/apply.ts)
  await page.addInitScript((value) => localStorage.setItem('sw.ui.scheme', value), dark ? 'dark' : 'light');
}

async function english(page: Page) {
  await page.route('**/api/v1/me/prefs', (route) => json(route, { prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }));
  await page.addInitScript(() => localStorage.setItem('sw.ui.lang', 'en'));
}

for (const lang of ['he', 'en'] as const) {
  test(`user drawer: a stale administrator session from outside - the reset preflight says sign in again, no confirm button (${lang})`, async ({ page }) => {
    skipTablet();
    const mock = await installMfaMock(page, { resetRefusal: 'reauth' });
    await scheme(page);
    if (lang === 'en') await english(page);
    const drawer = await openUserDrawer(page, 'רון לוי');
    const f = drawer.locator('sw-user-factors');
    await f.locator('[data-uf-reset]').click();
    await expect(f.locator('[data-reset-refused]')).toBeVisible();
    await shot(f, `reset-reauth-${lang}`);
    await expect(f.locator('[data-reset-refused="reauth"]')).toContainText(lang === 'en' ? REAUTH_EN : REAUTH_HE);
    await expect(f.locator('[data-uf-reset-confirm]')).toHaveCount(0);
    await expect(f.locator('[data-reset-confirm-text]')).toHaveCount(0);
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  });

  test(`my account › security: turning the authenticator on from a stale session says "a fresh sign-in" (${lang})`, async ({ page }) => {
    skipTablet();
    await installMfaMock(page);
    await scheme(page);
    if (lang === 'en') await english(page);
    // routes added later win: this account has no authenticator yet, and the enrolment start is refused for a stale sign-in
    await page.route('**/api/v1/auth/second-factor', (route) => (route.request().method() === 'GET' ? json(route, { enabled: false, enabled_at: null, last_used_at: null }) : route.fallback()));
    await page.route('**/api/v1/auth/second-factor/enroll', (route) =>
      json(route, { code: 'reauth_required', user_message: 'לפעולה הזו צריך כניסה טרייה: צא והיכנס שוב, ואז נסה שוב תוך 5 דקות.', retryable: false, correlation_id: 'mock',
        details: { action: 'auth.second_factor.enroll', within_s: 300 } }, 403));
    const { sec } = await openSecurity(page);
    const sf = sec.locator('sw-second-factor');
    await sf.locator('[data-sf-enable]').click();
    await expect(sf.locator('[data-sf-error]')).toBeVisible();
    await shot(sf, `enrol-reauth-${lang}`);
    await expect(sf.locator('[data-sf-error]')).toContainText(lang === 'en' ? 'This needs a fresh sign-in (less than 5 minutes ago)' : 'לפעולה הזו צריך כניסה טרייה (לפני פחות מ־5 דקות)');
    await expect(sf.locator('[data-sf-enrolment]')).toHaveCount(0);
  });
}
