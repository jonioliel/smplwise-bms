import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installReadinessMock } from './readiness-mocks';
import { url } from './tickets-mocks';

// CR-READY96 slice 1 evidence: הגדרות › מוכנות (#/system/readiness) against the MOCKED backend (tests/readiness-mocks.ts) - fake data only.
//   - the PAGE NEVER SCROLLS (owner requirement): at 1366x768, 1024x768, 768x1024, 390x844 and 320x640, light and dark, even with 20 extra checks the document and
//     the shell's <main> have no overflow; on a wide screen the checklist scrolls INSIDE its own panel;
//   - states: ready, loading, error, forbidden, a running demo (the banner for a user without demo.run, the buttons for a holder);
//   - the hand-over is never blocked by the score (advice only); the thresholds dialog lists every setting; no horizontal overflow.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-readiness-96.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'READY96');
const HASH = '/system/readiness';
const SIZES = [
  { w: 1366, h: 768 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 320, h: 640 },
] as const;

test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

async function open(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.goto('about:blank');
  await page.goto(url(HASH, 'classic', scheme));
  await page.waitForSelector('sw-app system-readiness');
}

/** Overflow of the document and of the shell's scroller, and of the screen's own host. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement as HTMLElement;
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    const host = document.querySelector('system-readiness') as HTMLElement | null;
    return {
      docY: doc.scrollHeight - doc.clientHeight,
      docX: doc.scrollWidth - doc.clientWidth,
      mainY: main ? main.scrollHeight - main.clientHeight : 0,
      hostY: host ? host.scrollHeight - host.clientHeight : 0,
    };
  });
}

test.describe('readiness screen', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const s of SIZES) {
      test(`the page never scrolls (${s.w}x${s.h}, ${scheme}) even with many checks`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
        await page.setViewportSize({ width: s.w, height: s.h });
        await installReadinessMock(page, { extraChecks: 20 });
        await open(page, scheme);
        await expect(page.locator('system-readiness [data-readiness]')).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(150);
        const o = await overflow(page);
        expect(o.docY, 'document vertical overflow').toBeLessThanOrEqual(1);
        expect(o.mainY, 'shell main vertical overflow').toBeLessThanOrEqual(1);
        expect(o.docX, 'document horizontal overflow').toBeLessThanOrEqual(0);
        const inner = await page.evaluate(() => {
          const el = document.querySelector('system-readiness')?.shadowRoot?.querySelector('[data-checks]') as HTMLElement | null;
          return el ? { scrolls: el.scrollHeight > el.clientHeight + 1, h: el.clientHeight } : null;
        });
        if (inner && s.w >= 900) expect(inner.scrolls, 'the checklist scrolls inside its own panel').toBe(true);
        if (inner) expect(inner.h, 'the checklist panel has room').toBeGreaterThan(80);
        await page.screenshot({ path: path.join(OUT, `ready-${s.w}x${s.h}-${scheme}.png`) });
      });
    }
  }

  test('the score, the level, the blockers and the advice-only wording are shown', async ({ page }) => {
    await installReadinessMock(page);
    await open(page);
    const root = page.locator('system-readiness');
    await expect(root.locator('[data-score]')).toHaveText('84');
    await expect(root.locator('[data-level]')).toHaveText('כמעט מוכן למסירה');
    await expect(root.locator('[data-blockers]')).toContainText('חסם אחד');
    await expect(root.locator('[data-advice]')).toContainText('זו המלצה בלבד');
    await expect(root.locator('[data-check]')).toHaveCount(11);
    await expect(root.locator('[data-check="backup"] [data-check-status]')).toHaveText('חסם');
    await expect(root.locator('[data-steps] [data-gain]').first()).toHaveText('+6');
  });

  test('the KPI row filters the checklist', async ({ page }) => {
    await installReadinessMock(page);
    await open(page);
    const root = page.locator('system-readiness');
    await root.locator('[data-k="blocked"]').click();
    await expect(root.locator('[data-check]')).toHaveCount(1);
    await root.locator('[data-k="not_applicable"]').click();
    await expect(root.locator('[data-check]')).toHaveCount(2);
    await root.locator('[data-k="all"]').click();
    await expect(root.locator('[data-check]')).toHaveCount(11);
  });

  test('the hand-over is recorded below the advice - the score never disables it', async ({ page }) => {
    const mock = await installReadinessMock(page);
    await open(page);
    const root = page.locator('system-readiness');
    await expect(root.locator('[data-below-advice]')).toBeVisible();
    const btn = root.locator('[data-handover-btn]');
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText('מוקדמת');
    await root.locator('[data-customer]').fill('לקוח לדוגמה');
    await btn.click();
    await expect(root.locator('[data-handover-state]')).toHaveText('נרשמה');
    const call = mock.calls.find((c) => c.path === 'readiness/attest/handover');
    expect(call?.body).toMatchObject({ done: true, customer_name: 'לקוח לדוגמה' });
  });

  test('every threshold and weight is editable and saved as one confirmed change', async ({ page }) => {
    const mock = await installReadinessMock(page);
    await open(page);
    const root = page.locator('system-readiness');
    await root.locator('[data-open-settings]').click();
    const dlg = root.locator('[data-settings-dialog]');
    await expect(dlg.locator('[data-setting]')).toHaveCount(5 + 11);
    await dlg.locator('[data-setting="readiness.advice_score"]').fill('80');
    await dlg.locator('[data-setting="readiness.weight.backup"]').fill('20');
    await dlg.locator('[data-settings-save]').click();
    await expect.poll(() => mock.calls.find((c) => c.path === 'readiness/settings')?.body).toEqual({ changes: { 'readiness.advice_score': '80', 'readiness.weight.backup': '20' }, confirmed: true });
  });

  test('an invalid threshold is refused in the dialog before anything is sent', async ({ page }) => {
    const mock = await installReadinessMock(page);
    await open(page);
    const root = page.locator('system-readiness');
    await root.locator('[data-open-settings]').click();
    await root.locator('[data-settings-dialog] [data-setting="readiness.advice_score"]').fill('500');
    await root.locator('[data-settings-dialog] [data-settings-save]').click();
    await expect(root.locator('[data-settings-error]')).toBeVisible();
    expect(mock.calls.some((c) => c.path === 'readiness/settings')).toBe(false);
  });

  test('forbidden, error and loading states', async ({ page }) => {
    await installReadinessMock(page, { mode: 'forbidden' });
    await open(page);
    await expect(page.locator('system-readiness sw-state-panel[state="forbidden"]')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installReadinessMock(page, { mode: 'error' });
    await open(page);
    await expect(page.locator('system-readiness sw-state-panel[state="error"]')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installReadinessMock(page, { mode: 'slow', delayMs: 2500 });
    await open(page);
    await expect(page.locator('system-readiness sw-state-panel[state="loading"]')).toBeVisible();
    await expect(page.locator('system-readiness [data-readiness]')).toBeVisible({ timeout: 20_000 });
  });

  test('the demo button needs demo.run and the dialog starts a demo with the chosen dataset', async ({ page }) => {
    await installReadinessMock(page);
    await open(page);
    await expect(page.locator('system-readiness [data-open-demo]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const mock = await installReadinessMock(page, { canRunDemo: true });
    await open(page);
    await page.locator('system-readiness [data-open-demo]').click();
    const dlg = page.locator('system-readiness [data-demo-dialog]');
    await dlg.locator('[data-demo-dataset]').selectOption('office');
    await dlg.locator('[data-demo-scenario]').selectOption('cameras_offline');
    await dlg.locator('[data-demo-hours]').selectOption('8');
    await Promise.all([page.waitForNavigation().catch(() => null), dlg.locator('[data-demo-start]').click()]);
    const call = mock.calls.find((c) => c.path === 'demo/start');
    expect(call?.body).toEqual({ dataset: 'office', scenario: 'cameras_offline', hours: 8 });
  });

  test('a running demo is announced to every user; the exit button only to a holder of demo.run', async ({ page }) => {
    const demo = { active: true, dataset: 'residential' as const, scenario: 'normal' as const, started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(), started_by_name: 'דני' };
    await installReadinessMock(page, { demo });
    await open(page);
    const bar = page.locator('sw-app sw-demo-banner [data-demo-banner]');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('הנתונים מדומים');
    await expect(page.locator('sw-app sw-demo-banner [data-demo-exit]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installReadinessMock(page, { demo, canRunDemo: true });
    await open(page);
    await expect(page.locator('sw-app sw-demo-banner [data-demo-exit]')).toBeVisible();
    const o = await overflow(page);
    expect(o.docY).toBeLessThanOrEqual(1);
    expect(o.mainY).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(OUT, 'ready-demo-banner.png') });
  });
});
