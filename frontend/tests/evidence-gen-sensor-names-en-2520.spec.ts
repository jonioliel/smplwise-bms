import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// GEN-SENSOR-NAMES-EN-2520: the generator sensor names follow the page language. The server sends each name in Hebrew and in English (`needs` /
// `needs_en` in the alert routing's "requires sensor", `label` / `label_en` in the sensor-mapping tab); an English page shows the English, a
// Hebrew page the unchanged Hebrew. Light and dark; screenshots to SW_SHOT_DIR when set.
//   SW_BASE_URL=http://127.0.0.1:<port>/ [SW_SHOT_DIR=<dir>] npx playwright test tests/evidence-gen-sensor-names-en-2520.spec.ts
const HEB = /[֐-׿]/;
const ROUTING = 'sw-app gen-routing [data-gen-routing]';
const MAPPING = 'sw-app gen-settings [data-section="mapping"]';

async function open(page: Page, lang: 'he' | 'en', hash: string, ready: string, scheme: 'light' | 'dark') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installGeneratorMock(page, { level: 'typical', perms: PERMS.manage });
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    // registered after the mock layer so it wins
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  const root = page.locator(ready);
  await expect(root).toBeVisible({ timeout: 20_000 });
  return root;
}
async function shoot(page: Page, name: string) {
  const dir = process.env.SW_SHOT_DIR;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}
const needsTexts = (page: Page) => page.locator(`${ROUTING} [data-needs]`).evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
const roleLabels = (page: Page) => page.locator(`${MAPPING} [data-role]`).evaluateAll((els) => els.map((e) => ({
  role: e.getAttribute('data-role') ?? '', label: (e.querySelector('[data-role-label]')?.textContent ?? '').trim(), aria: e.querySelector('select')?.getAttribute('aria-label') ?? '',
})));

// soft checks: every language / scheme is checked and shot even when one fails (the same spec makes the "before" shots on the base)
for (const lang of ['he', 'en'] as const) {
  test(`routing "requires sensor" names in the page language (${lang})`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, lang, '/system/infra/generator/routing', ROUTING, scheme);
      await shoot(page, `sensor-names-routing-${lang}-${scheme}`);
      const needs = await needsTexts(page);
      // the first page of the matrix: the typical controller has no oil pressure sensor (low oil pressure, engine group)
      expect.soft(needs.length, 'the typical controller leaves types without their sensor').toBeGreaterThan(0);
      const all = needs.join(' | ');
      if (lang === 'en') {
        expect.soft(all).toContain('Oil pressure');
        for (const n of needs) expect.soft(n, 'no Hebrew in an English "requires sensor"').not.toMatch(HEB);
      } else {
        expect.soft(all).toContain('לחץ שמן');
        expect.soft(all).not.toContain('Oil pressure');
      }
    }
  });

  test(`sensor-mapping tab names in the page language (${lang})`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await open(page, lang, '/system/infra/generator/mapping', MAPPING, scheme);
      await shoot(page, `sensor-names-mapping-${lang}-${scheme}`);
      const rows = await roleLabels(page);
      expect.soft(rows.map((r) => r.role)).toEqual(['engine_state', 'gen_v_l1', 'fuel_pct', 'battery_v']);
      const want = lang === 'en' ? ['Engine state', 'Generator voltage L1', 'Fuel level', 'Battery voltage'] : ['מצב מנוע', 'מתח גנרטור L1', 'מפלס דלק', 'מתח מצבר'];
      expect.soft(rows.map((r) => r.label)).toEqual(want);
      expect.soft(rows.map((r) => r.aria), 'the select is named by the same word').toEqual(want);
    }
  });
}
