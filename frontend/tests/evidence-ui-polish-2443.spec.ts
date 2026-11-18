import { test, expect, type Page } from '@playwright/test';
import { PERMS, freshMock, mockSt7Backend, openSt7 } from './st7-ui-mocks';

// CR-UI-POLISH-2443: the two screens of the row in a browser, over the mocked backend of tests/st7-ui-mocks.ts (no live server,
// no screenshot written).
//   - "החשבון שלי › המסך שלי": a first read that fails shows the section's red note with the reason; a read that arrives shows
//     the choices and no note;
//   - the "3D map" settings card: Hebrew as before, and in the English interface no Hebrew letter is left in the card.
//   npx vite build && SW_BASE_URL=http://127.0.0.1:43xx/ npx playwright test tests/evidence-ui-polish-2443.spec.ts --project=desktop --workers=1

const HEBREW = /[֐-׿]/;

/** The mocked user also holds screen.personalize, so the user menu offers "המסך שלי" (the st7 mock's user does not). */
async function mayPersonalize(page: Page) {
  const perms = [...PERMS, 'screen.personalize'];
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      }),
    }));
}

async function openMyScreen(page: Page) {
  await page.locator('sw-app [data-profile-menu]').click();
  await page.locator('sw-app sw-user-menu [data-menu-account]').click();
  await page.locator('sw-app sw-user-menu [data-my-home] summary').click();
  return page.locator('sw-app sw-user-menu sw-home-personal');
}

test.describe('CR-UI-POLISH-2443', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop evidence');
  });

  test('my screen: the choices show when the first read arrives, with no error note', async ({ page }) => {
    await mockSt7Backend(page, freshMock());
    await mayPersonalize(page);
    await openSt7(page, '/system/diagnostics?tab=map');
    const mine = await openMyScreen(page);
    await expect(mine.locator('[data-home-personal-direction]')).toBeVisible({ timeout: 15_000 });
    await expect(mine.locator('[data-home-personal-error]')).toHaveCount(0);
  });

  test('my screen: a first read the server fails shows the red note with the reason, and no choices to change', async ({ page }) => {
    await mockSt7Backend(page, freshMock());
    await mayPersonalize(page);
    await page.route('**/api/v1/me/prefs', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'unavailable', user_message: 'השרת אינו זמין כרגע', retryable: true, correlation_id: 'c-2443', details: {} }) }));
    await openSt7(page, '/system/diagnostics?tab=map');
    const mine = await openMyScreen(page);
    const note = mine.locator('[data-home-personal-error]');
    await expect(note).toBeVisible({ timeout: 15_000 });
    await expect(note).toHaveText('השרת אינו זמין כרגע');
    await expect(note).toHaveAttribute('role', 'alert');
    await expect(mine.locator('[data-home-personal-direction]')).toHaveCount(0);
    await expect(mine.locator('[data-home-personal-reset]')).toHaveCount(0);
    const colour = await note.evaluate((el) => getComputedStyle(el).color);
    const danger = await note.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--sw-danger)';
      el.parentNode!.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(colour).toBe(danger);
  });

  test('the 3D map card in Hebrew reads as before', async ({ page }) => {
    await mockSt7Backend(page, freshMock());
    await openSt7(page, '/system/diagnostics?tab=map');
    const card = page.locator('system-diagnostics system-plan-view [data-plan-view-card]');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await expect(card).toHaveAttribute('heading', 'מפה תלת־ממדית');
    await expect(card.locator('[data-view-row="wall_cut"] .lbl')).toContainText('גובה הקירות');
    await expect(card.locator('[data-view-row="eye_m"] .muted')).toHaveText('לפי ההתקנה: 1.65 מ׳ · גובה העין בסיור בגובה עין');
    await expect(card.locator('[data-view-row="style"] .muted')).toHaveText('לפי ההתקנה: אוטומטי · אוטומטי: בהיר עם ערכת נושא בהירה, כהה עם כהה');
    await card.locator('[data-view-target="installation"]').click();
    await expect(card.locator('[data-map-row="map.room_pills"] [data-view-option="map.room_pills:room"]')).toHaveText('תווית לכל חדר, התקנים בהתקרבות');
    await expect(card.locator('[data-view-row="site"] sw-field').first()).toHaveAttribute('label', 'קו רוחב');
  });

  test('the 3D map card in the English interface has no Hebrew left, in both targets', async ({ page }) => {
    await mockSt7Backend(page, freshMock());
    await page.route('**/api/v1/me/prefs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
    await page.addInitScript(() => localStorage.setItem('sw.ui.lang', 'en'));
    await openSt7(page, '/system/diagnostics?tab=map');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const card = page.locator('system-diagnostics system-plan-view [data-plan-view-card]');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await expect(card).toHaveAttribute('heading', '3D map');
    const texts = async (): Promise<string> =>
      card.evaluate((el) => {
        const attrs = [el.getAttribute('heading'), el.getAttribute('subheading'), ...[...el.querySelectorAll('[aria-label], [label]')].map((n) => `${n.getAttribute('aria-label') ?? ''} ${n.getAttribute('label') ?? ''}`)];
        return `${(el as HTMLElement).innerText}\n${attrs.join('\n')}`;
      });
    await expect(card.locator('[data-view-row="eye_m"] .muted')).toHaveText('As the installation: 1.65 m · The eye height in the eye-level walk');
    expect((await texts()).split('\n').filter((l) => HEBREW.test(l))).toEqual([]);
    await card.locator('[data-view-target="installation"]').click();
    await expect(card.locator('[data-map-row="map.room_pills"] .lbl')).toContainText('Labels on the map');
    expect((await texts()).split('\n').filter((l) => HEBREW.test(l))).toEqual([]);
  });
});
