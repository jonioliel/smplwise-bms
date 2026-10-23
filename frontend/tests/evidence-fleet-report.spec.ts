import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFleetMock, fleetUrl, type FleetMock, type FleetMockOptions } from './fleet-mocks';

// CR-FLEET215 evidence: Settings › דיווח בריאות from the REAL build against the mock layer (fake data), desktop 1440 and phone 390,
// light and dark. Also asserts behaviour: the four pages (off / on / no address / failed) plus loading / error / forbidden, the switch,
// the "reporting stopped" message on switch-off, send now, the 52-field card, the exact body, the copy button, the silence threshold,
// the readiness score linking to the one readiness screen (READYFLEET-295), no horizontal overflow, and the first screen holding the answer, the switch and the send button without scrolling.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-fleet-report.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/fleet-215');
const S = 'sw-app system-fleet-report';

async function go(page: Page, o: FleetMockOptions = {}, scheme: 'light' | 'dark' = 'light', wait = true): Promise<FleetMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installFleetMock(page, o);
  await page.goto('about:blank');
  await page.goto(fleetUrl('classic', scheme));
  if (wait) await page.waitForSelector(`${S} [data-fleet-report][data-state="ready"]`);
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('fleet report evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the four pages, light and dark, with the answer, the switch and the send button on the first screen', async ({ page }) => {
    const scenes = [
      ['on', 'on', 'הדיווח פועל ותקין'], ['off', 'off', 'הדיווח כבוי'], ['nourl', 'nourl', 'הדיווח דולק, אבל עדיין לא נשלח'],
      ['failed', 'failed', 'השליחה האחרונה נכשלה'], ['first', 'on', 'הדיווח פועל, מחכה לדוח הראשון'],
    ] as const;
    for (const scheme of ['light', 'dark'] as const)
      for (const [scene, view, title] of scenes) {
        await go(page, { scene }, scheme);
        const s = page.locator(S);
        await expect(s.locator('[data-answer]')).toHaveAttribute('data-view', view);
        await expect(s.locator('[data-answer-title]')).toHaveText(title);
        // the first screen holds the answer, the switch and the send button
        const vh = page.viewportSize()!.height;
        for (const sel of ['[data-answer]', '[data-switch]', '[data-send]']) {
          const box = await s.locator(sel).boundingBox();
          expect(box && box.y + box.height, `${scene}: ${sel} above the fold`).toBeLessThanOrEqual(vh);
        }
        await shot(page, `fleet-${scene}`, scheme);
      }
    await go(page, { scene: 'nourl' });
    await expect(page.locator(S).locator('[data-send]')).toHaveAttribute('disabled', '');
    await go(page, { scene: 'badurl' });
    await expect(page.locator(S).locator('[data-answer-do]')).toContainText('אינה תקינה');
    await go(page, { scene: 'off' });
    await expect(page.locator(S).locator('[data-send]')).toHaveAttribute('disabled', '');
  });

  test('loading, error, forbidden and a plain operator', async ({ page }) => {
    await go(page, { statusDelay: 1500 }, 'light', false);
    await expect(page.locator(S).locator('[data-fleet-report]')).toHaveAttribute('data-state', 'loading');
    await shot(page, 'fleet-loading');
    await go(page, { statusError: true }, 'light', false);
    await page.waitForSelector(`${S} [data-fleet-report][data-state="error"]`);
    await expect(page.locator(S)).toContainText('הגדרות הדיווח לא נטענו');
    await shot(page, 'fleet-error');
    await go(page, { forbidden: true }, 'light', false);
    await page.waitForSelector(`${S} [data-fleet-report][data-state="forbidden"]`);
    await expect(page.locator(S)).toContainText('רק מנהל מערכת');
    await shot(page, 'fleet-forbidden');
    // retry after an error loads the page
    await go(page, { statusError: true }, 'light', false);
    await page.waitForSelector(`${S} [data-fleet-report][data-state="error"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installFleetMock(page, { scene: 'on' });
    await page.locator(S).locator('sw-state-panel').evaluate((el) => el.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true })));
    await page.waitForSelector(`${S} [data-fleet-report][data-state="ready"]`);
  });

  test('the switch: on and off, and the stop message result is reported', async ({ page }) => {
    const mock = await go(page, { scene: 'on' });
    const s = page.locator(S);
    await s.locator('[data-switch] button').click();
    await expect(s.locator('[data-answer]')).toHaveAttribute('data-view', 'off');
    await expect(s.locator('[data-flash]')).toContainText('הדיווח הופסק');
    expect(mock.calls.filter((c) => c.method === 'PUT' && c.path === 'fleet/report').map((c) => c.body)).toEqual([{ enabled: false }]);
    await s.locator('[data-switch] button').click();
    await expect(s.locator('[data-answer]')).toHaveAttribute('data-view', 'on');
    // a stop message that did not arrive is said plainly
    const m2 = await go(page, { scene: 'on', stopFails: true });
    await page.locator(S).locator('[data-switch] button').click();
    await expect(page.locator(S).locator('[data-flash]')).toContainText('לא הגיעה');
    expect(m2.calls.some((c) => c.method === 'PUT')).toBe(true);
  });

  test('send now: success and failure', async ({ page }) => {
    const mock = await go(page, { scene: 'on' });
    const s = page.locator(S);
    await s.locator('[data-send] button').click();
    await expect(s.locator('[data-flash]')).toContainText('הדוח נשלח והתקבל');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'fleet/report/send')).toBe(true);
    await go(page, { scene: 'on', sendFails: true });
    await page.locator(S).locator('[data-send] button').click();
    await expect(page.locator(S).locator('[data-flash]')).toContainText('השליחה נכשלה');
    await expect(page.locator(S).locator('[data-answer]')).toHaveAttribute('data-view', 'failed');
    await expect(page.locator(S).locator('[data-send]')).toContainText('ניסיון שליחה עכשיו');
  });

  test('readiness: the score and the way to the one readiness screen (CR-READY96), a complete list, a failed read', async ({ page }) => {
    await go(page, { scene: 'on' });
    const s = page.locator(S);
    await expect(s.locator('[data-ready-score]')).toHaveText('78%');
    await expect(s.locator('[data-ready-title]')).toHaveText('מוכנות ההתקנה: 4 דברים עוד חסרים');
    await expect(s.locator('[data-ready-item]')).toHaveCount(0); // READYFLEET-295: the checklist lives only on the readiness screen
    await expect(s.locator('[data-ready-link]')).toHaveAttribute('href', '#/system/readiness');
    await go(page, { scene: 'on', allReady: true });
    await expect(page.locator(S).locator('[data-ready-title]')).toHaveText('מוכנות ההתקנה: הכול מוכן');
    await go(page, { scene: 'on', readinessError: true });
    await expect(page.locator(S).locator('[data-ready-failed]')).toBeVisible();
    await expect(page.locator(S).locator('[data-answer]')).toBeVisible(); // the rest of the page still works
  });

  test('what is sent: 52 fields in groups, technical names behind one toggle, the never-sent list', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, { scene: 'on' }, scheme);
      const s = page.locator(S);
      const card = s.locator('[data-card="sent"]');
      await expect(card).toContainText('52 פריטים');
      await expect(s.locator('[data-field]')).toHaveCount(52); // present in the DOM (folded) - the count is the contract
      await card.locator('button.fold').click();
      await expect(s.locator('[data-group]')).toHaveCount(9);
      await expect(s.locator('[data-never] li')).toHaveCount(15);
      await expect(s.locator('[data-field="components.frigate"] code')).toBeHidden();
      await s.locator('[data-tech-names]').click();
      await expect(s.locator('[data-field="components.frigate"] code')).toBeVisible();
      await expect(s.locator('[data-header-note]')).toContainText('בכותרת השליחה');
      await shot(page, 'fleet-sent-open', scheme);
    }
  });

  test('last reports: the table, the exact body (last and the one that would be sent)', async ({ page }) => {
    const mock = await go(page, { scene: 'on' });
    const s = page.locator(S);
    await s.locator('[data-card="last"] button.fold').click();
    await expect(s.locator('[data-log-row]')).toHaveCount(3);
    await expect(s.locator('[data-log-row]').first()).toContainText('התקבל');
    await s.locator('[data-exact] summary').click();
    await expect(s.locator('[data-json]')).toContainText('"seq": 412');
    expect(mock.calls.some((c) => c.path === 'fleet/report/preview')).toBe(false); // the last sent body is on hand: no extra request
    await s.locator('[data-exact-next]').click();
    await expect(s.locator('[data-json]')).toContainText('"seq": 413');
    await shot(page, 'fleet-last-open');
    // failed: the failure row is red and says why
    await go(page, { scene: 'failed' });
    await page.locator(S).locator('[data-card="last"] button.fold').click();
    await expect(page.locator(S).locator('[data-log-row]').first()).toContainText('לא נשלח, אין חיבור');
    // nothing sent yet: an empty table and the preview is loaded on demand
    const m3 = await go(page, { scene: 'first' });
    await page.locator(S).locator('[data-card="last"] button.fold').click();
    await expect(page.locator(S).locator('[data-log-empty]')).toBeVisible();
    await page.locator(S).locator('[data-exact] summary').click();
    await expect(page.locator(S).locator('[data-json]')).toContainText('"seq": 413');
    expect(m3.calls.some((c) => c.path === 'fleet/report/preview')).toBe(true);
  });

  test('the details card: enrollment code with a copy button, silence threshold', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    const mock = await go(page, { scene: 'on' });
    const s = page.locator(S);
    expect(mock.calls.some((c) => c.path === 'fleet/report/enrollment')).toBe(false); // not before the card is opened
    await s.locator('[data-card="tech"] button.fold').click();
    await expect(s.locator('[data-enroll-code]')).toBeVisible();
    expect(mock.calls.filter((c) => c.path === 'fleet/report/enrollment')).toHaveLength(1);
    await expect(s.locator('[data-url-state="set"]')).toHaveText('הוגדר');
    await expect(s.locator('[data-kid]')).toContainText('Ed25519');
    await expect(s.locator('[data-install-id]')).toHaveText('8c41…e07b');
    // copy
    await s.locator('[data-copy]').click();
    await expect(s.locator('[data-copy]')).toContainText(/הועתק|העתקה/);
    // silence threshold: validated, saved, audited by the server
    await expect(s.locator('[data-silent]')).toHaveValue('36');
    await expect(s.locator('[data-silent-save]')).toHaveAttribute('disabled', '');
    await s.locator('[data-silent]').fill('10');
    await s.locator('[data-silent-save] button').click();
    await expect(s.locator('[data-silent-error]')).toContainText('בין 26 ל-168 שעות');
    expect(mock.calls.some((c) => c.method === 'PUT' && (c.body as { silent_after_h?: number }).silent_after_h !== undefined)).toBe(false);
    await s.locator('[data-silent]').fill('48');
    await s.locator('[data-silent-save] button').click();
    await expect(s.locator('[data-flash]')).toContainText('נשמר');
    await expect(s.locator('[data-silent]')).toHaveValue('48');
    expect(mock.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ silent_after_h: 48 }]);
    await expect(s.locator('[data-demo]')).toHaveCount(0); // READYFLEET-295: demo mode is CR-READY96's, on the readiness screen
    await shot(page, 'fleet-tech-open');
    // the address option missing: said plainly, the code still shows
    await go(page, { scene: 'nourl' });
    await page.locator(S).locator('[data-card="tech"] button.fold').click();
    await expect(page.locator(S).locator('[data-url-state="unset"]')).toHaveText('עדיין לא הוגדר');
  });

  test('no Home Assistant branding, no internal codes, the plain words', async ({ page }) => {
    await go(page, { scene: 'on' });
    const text = await page.locator(S).evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(/Home Assistant|Ingress|CR-|FLEET215/);
    expect(text).not.toMatch(/hash|epoch|enroll/i);
  });

  test('a plain operator does not get the tab', async ({ page }) => {
    await go(page, { scene: 'on', configure: false }, 'light', false);
    await page.waitForTimeout(800);
    const tabs = await page.locator('sw-app').evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(tabs).not.toContain('דיווח בריאות');
  });
});
