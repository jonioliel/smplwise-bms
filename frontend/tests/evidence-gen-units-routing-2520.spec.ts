import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { installGeneratorMock, url } from './generator-mocks';

// GEN-UNITS-FIELD-2520: the two minute fields of the generator alert routing (the critical default's escalation delay and a type's
// "escalate after") carry their unit inside the field frame (sw-field unit), as the other generator settings and electricity do; the
// label names the value, not its unit. Hebrew and English sessions, light and dark.
//   SW_BASE_URL=http://127.0.0.1:<port>/ [SW_SHOT_DIR=<dir>] npx playwright test tests/evidence-gen-units-routing-2520.spec.ts
const R = 'sw-app gen-routing';
const ROUTING = '/system/infra/generator/routing';
const HEB = /[֐-׿]/;

async function open(page: Page, lang: 'he' | 'en', scheme: 'light' | 'dark') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installGeneratorMock(page, { level: 'typical' });
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    // registered after the mock layer so it wins
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.goto('about:blank');
  await page.goto(url(ROUTING, 'classic', scheme));
  await page.waitForSelector(`${R} [data-gen-routing]`, { timeout: 20_000 });
}
async function shoot(page: Page, name: string) {
  const dir = process.env.SW_SHOT_DIR;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}
const fieldOf = (page: Page, hook: string) => page.locator(`${R} sw-field:has([${hook}])`);

for (const lang of ['he', 'en'] as const) {
  test(`routing minute fields: the unit is in the frame (${lang})`, async ({ page }) => {
    const phone = (page.viewportSize()?.width ?? 1440) < 900;
    const unit = lang === 'he' ? 'דקות' : 'min';
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, lang, scheme);
      await page.locator(`${R} [data-severity-row="critical"]`).click();
      await page.waitForSelector(`${R} [data-drawer="severity"] [data-critical-delay]`);
      await shoot(page, `routing-critical-delay-${lang}-${scheme}`);
      const crit = fieldOf(page, 'data-critical-delay');
      await expect(crit).toHaveAttribute('unit', unit);
      await expect(crit.locator('[data-unit]')).toHaveText(unit);
      const label = (await page.locator(`${R} [data-drawer="severity"] label[for="crit-min"]`).innerText()).trim();
      expect(label, 'the label carries no unit word').not.toMatch(lang === 'he' ? /דקות/ : /minute/i);
      if (lang === 'en') expect(label, 'English label').not.toMatch(HEB);
      if (phone) continue;
      await page.keyboard.press('Escape');
      await page.locator(`${R} [data-type="battery_low"] >> visible=true`).first().click({ force: true });
      await page.waitForSelector(`${R} [data-escalate]`);
      await page.locator(`${R} [data-escalate]`).click();
      await expect(page.locator(`${R} [data-escalate-min]`)).toBeVisible();
      await shoot(page, `routing-escalate-after-${lang}-${scheme}`);
      const esc = fieldOf(page, 'data-escalate-min');
      await expect(esc).toHaveAttribute('unit', unit);
      await expect(page.locator(`${R} [data-escalate-min]`)).toHaveAttribute('aria-label', lang === 'he' ? 'זמן עד הסלמה' : 'Time until escalation');
      const after = (await esc.locator('xpath=following-sibling::span[1]').innerText()).trim();
      expect(after).toBe(lang === 'he' ? 'עד הסלמה' : 'until escalation');
    }
  });
}

// GEN-UNITS-FIELD-2520 (lead Q1 = a): the routing screen follows the page language - its own words from the English catalogue, the alert
// types by the server's `title_en`, the groups and template placeholders from the routing catalogue. Hebrew left on an English page only where
// the server (here: the mock) sends Hebrew data: the role labels, a user's name and the sample message.
const SERVER_HEBREW = ['מפעילים', 'מנהלי אתר', 'מנהלי מערכת', 'יוסי', 'גנרטור ראשי: מתח מצבר 23.1 V.'];
const hebrewLines = (text: string) => text.split('\n').map((l) => l.trim()).filter((l) => HEB.test(l) && !SERVER_HEBREW.some((w) => l.includes(w)));

test('English session: the routing screen reads English', async ({ page }) => {
  const phone = (page.viewportSize()?.width ?? 1440) < 900;
  for (const scheme of ['light', 'dark'] as const) {
    await open(page, 'en', scheme);
    const root = page.locator(`${R} [data-gen-routing]`);
    await expect(root).toContainText(phone ? 'Failed to start' : 'Low battery voltage');
    await expect(root).toContainText('Engine');
    await shoot(page, `routing-screen-en-${scheme}`);
    expect(hebrewLines(await root.innerText()), 'Hebrew on the English routing screen').toEqual([]);
    if (phone) continue;
    await page.locator(`${R} [data-type="battery_low"] >> visible=true`).first().click({ force: true });
    const drawer = page.locator(`${R} [data-drawer="routing"]`);
    await expect(drawer.locator('[data-vars]')).toContainText('Generator name');
    await shoot(page, `routing-editor-en-${scheme}`);
    expect(hebrewLines(await drawer.innerText()), 'Hebrew in the English routing editor').toEqual([]);
  }
});

test('Hebrew session: the routing screen keeps its Hebrew words', async ({ page }) => {
  await open(page, 'he', 'light');
  const root = page.locator(`${R} [data-gen-routing]`);
  await expect(root).toContainText('מנוע');
  await expect(root).toContainText('כשל התנעה');
  await expect(root).not.toContainText('Failed to start');
});
