import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';

// WISKEY-PAIRING-I18N-2520: the pairing LINES of "חיבור Arx ל-WisKey" (Settings › מתגי מסכי כניסה), their "how to fix", the steps outside Arx
// and the steps after a re-pair, on an ENGLISH page, said from the stable codes the server sends (`reason`, `fix_code`, `params`,
// `owner_step_codes`, `step_codes`); the same answer on a Hebrew page shows the server's Hebrew unchanged. The lines are the backend's own
// (`wiskey_pairing._line`, tests/fixtures/wiskey-pairing-i18n-2520.json). MOCKED backend, synthetic data; nothing reaches WisKey, Home
// Assistant or a station. Evidence: docs/design/evidence/wiskey-pairing-i18n-2520 (SW_SHOTS=1).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-pairing-i18n-2520.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SW_SHOT_DIR || path.resolve(HERE, '../../docs/design/evidence/wiskey-pairing-i18n-2520');
const FIX = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'wiskey-pairing-i18n-2520.json'), 'utf8')) as {
  lines: Array<{ key: string; label: string; text: string; fix: string | null }>;
  owner_steps: string[];
  owner_step_codes: string[];
  repair_steps: string[];
  repair_step_codes: string[];
  addon_url: string;
};
const SETTINGS = '/system/diagnostics?tab=access-control';
const CARD = 'sw-app system-diagnostics system-wiskey-pairing [data-wkp-card]';
const HEB = /[֐-׿]/;

const STATUS = {
  generated_at: '2026-11-25T08:00:05+00:00', verdict: 'not_paired', paired: false, talk_ready: false,
  probe: { at: '2026-11-25T08:00:00+00:00', accepted: false, code: 'direct_connect_refused', outcome: null, service_subject: null, repository: null, capabilities: null, discovery_error: null },
  repair: { available: true, reason: 'refused', announce: false, addon_url: FIX.addon_url },
  lines: FIX.lines, owner_steps: FIX.owner_steps, owner_step_codes: FIX.owner_step_codes, features: [],
};
const REPAIRED = { announced: false, rotation_paused: true, pairing_code: 'synthetic-new-pairing-code-0001', addon_url: FIX.addon_url, paired_at: null,
  steps: FIX.repair_steps, step_codes: FIX.repair_step_codes, status: STATUS };

async function boot(page: Page, lang: 'he' | 'en', scheme: 'light' | 'dark') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = await installAccessMock(page, { persona: 'admin' });
  await installParityMock(page, mock, 'ready');
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    // registered after the mock layer so it wins
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.route('**/api/v1/system/wiskey-pairing**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/repair') ? REPAIRED : STATUS) }));
  await page.goto('about:blank');
  await page.goto(url(SETTINGS, 'classic', scheme));
  await page.waitForSelector('sw-app');
  await expect(page.locator(CARD)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${CARD} [data-wkp-line]`)).toHaveCount(FIX.lines.length);
  if (lang === 'en') await page.locator('html[data-lang-words="en"]').waitFor({ state: 'attached', timeout: 30_000 });
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator(CARD).screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

const line = (page: Page, key: string) => page.locator(`${CARD} [data-wkp-line="${key}"]`);

test.describe('WISKEY-PAIRING-I18N-2520: the pairing lines in the page language', () => {
  test.beforeEach(({}, info) => {
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
    test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`English page (${scheme}): lines, fixes and the steps outside Arx in English`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await boot(page, 'en', scheme);
      await shot(page, info, `lines-en-${scheme}`); // before the checks: the compare page's "before" is the same spec on the base
      for (const l of await page.locator(`${CARD} [data-wkp-line]`).all()) {
        expect((await l.innerText()).trim(), `line ${await l.getAttribute('data-wkp-line')}`).not.toMatch(HEB);
      }
      for (const s of await page.locator(`${CARD} [data-wkp-steps] li`).allInnerTexts()) expect(s).not.toMatch(HEB);
      await expect(page.locator(`${CARD} [data-wkp-steps] li`)).toHaveCount(FIX.owner_steps.length);
      // the server's values and words inside the English sentences
      await expect(line(page, 'bridge')).toContainText('it has not sent a signed update since the pairing.');
      await expect(line(page, 'acceptance')).toContainText('WisKey refused the signature of Arx (direct_connect_refused)');
      await expect(line(page, 'discovery')).toContainText('By the service channel: video yes, talk no');
      await expect(line(page, 'discovery').locator('[data-wkp-fix]')).toContainText('Update WisKey to a version that publishes the talk commands');
      await expect(line(page, 'events')).toContainText('A gap in the door events: unknown to 2026-11-24T10:00:00+00:00 (the resume point is too old');
      await expect(line(page, 'last_error')).toContainText('WisKey closed the connection without an answer - it did not verify the signature.');
      await expect(line(page, 'provider').locator('a[data-wkp-provider-link]')).toHaveText('To the row "Video and talk source"');
      await expect(page.locator(`${CARD} [data-wkp-steps] li`).first()).toHaveText('In the system infrastructure: Settings › Devices & services › SMPLWISE Bridge - make sure there is only one entry and that it is loaded.');
      expect(await page.locator(CARD).evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });

    test(`Hebrew page (${scheme}): the same answer shows the server words unchanged`, async ({ page }, info) => {
      await boot(page, 'he', scheme);
      await shot(page, info, `lines-he-${scheme}`);
      for (const l of FIX.lines) {
        await expect(line(page, l.key).locator('.lbl')).toHaveText(l.label);
        await expect(line(page, l.key)).toContainText(l.text);
        if (l.fix) await expect(line(page, l.key).locator('[data-wkp-fix]')).toContainText(l.fix);
      }
      await expect(page.locator(`${CARD} [data-wkp-steps] li`)).toHaveText(FIX.owner_steps);
      await expect(line(page, 'provider').locator('a[data-wkp-provider-link]')).toHaveText('לשורה "מקור הווידאו והדיבור"');
      expect(await page.locator(CARD).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    });
  }

  for (const lang of ['en', 'he'] as const) {
    test(`the steps after a re-pair (${lang}): ${lang === 'en' ? 'English from the codes, the address filled in' : 'the server words unchanged'}`, async ({ page }) => {
      await boot(page, lang, 'light');
      await page.locator(`${CARD} sw-button[data-wkp-repair-open]`).click();
      await page.locator(`${CARD} sw-dialog[data-wkp-confirm] sw-button[data-wkp-confirm-ok]`).click();
      const steps = page.locator(`${CARD} [data-wkp-repair-steps] li`);
      await expect(steps).toHaveCount(FIX.repair_steps.length);
      if (lang === 'he') {
        await expect(steps).toHaveText(FIX.repair_steps);
        return;
      }
      for (const s of await steps.allInnerTexts()) expect(s).not.toMatch(HEB);
      await expect(steps.nth(2)).toHaveText(`Address: ${FIX.addon_url} · pairing code: the code shown here.`);
    });
  }
});
