import { test, expect, type Page } from '@playwright/test';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// GEN-UNITS-FIELD-2490: the generator settings read the ACTIVE-language catalogue; the unit sits in the field frame (sw-field unit), not in the label.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-gen-units-en-2490.spec.ts
async function open(page: Page, lang: 'he' | 'en', hash: string, section: string) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installGeneratorMock(page, { perms: PERMS.manage, log: true });
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    // registered after the mock layer so it wins
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.goto(url(hash));
  const s = page.locator(`sw-app gen-settings [data-section="${section}"]`);
  await expect(s).toBeVisible({ timeout: 20_000 });
  return s;
}
const fields = (s: ReturnType<Page['locator']>) => s.locator('sw-field').evaluateAll((els) => els.map((e) => ({ label: e.getAttribute('label') ?? '', unit: e.getAttribute('unit') ?? '' })));

test.describe('generator settings: units in the field frame, per language', () => {
  test('English session: English labels and unit words, no unit in a label', async ({ page }) => {
    const s = await open(page, 'en', '/system/infra/generator/thresholds', 'thresholds');
    const f = await fields(s);
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) {
      expect(x.label, 'label has no Hebrew letters').not.toMatch(/[֐-׿]/);
      expect(x.unit, 'unit has no Hebrew letters').not.toMatch(/[֐-׿]/);
      expect(x.label, 'no "(unit)" in the label').not.toMatch(/\(/);
    }
    expect(f.find((x) => x.label === 'Minimum oil pressure')?.unit).toBe('bar');
    expect(f.find((x) => x.label === 'Low fuel')?.unit).toBe('%');
    await expect(s.locator('sw-field input[id^="th-"]').first()).toBeVisible();
    const log = await open(page, 'en', '/system/infra/generator/log', 'log');
    const lf = await fields(log);
    expect(lf.find((x) => x.label === 'Expected test interval (0 = not tracked)')?.unit).toBe('days');
    expect(lf.find((x) => x.label === 'A run shorter than this is not logged')?.unit).toBe('seconds');
  });
  test('Hebrew session: Hebrew labels, units unchanged in the frame', async ({ page }) => {
    const s = await open(page, 'he', '/system/infra/generator/thresholds', 'thresholds');
    const f = await fields(s);
    expect(f.find((x) => x.label === 'לחץ שמן מינימלי')?.unit).toBe('bar');
    expect(f.find((x) => x.label === 'דלק נמוך')?.unit).toBe('%');
    for (const x of f) expect(x.label).not.toMatch(/\(/);
  });
});
