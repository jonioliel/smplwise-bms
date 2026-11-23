import { test, expect, type Page } from '@playwright/test';

// MULTI-BUILDING-SAFETY-2500 (owner decisions 22.11, Q62 / Q63), demo mode (no backend):
//   - הגדרות › בניינים ומיפוי: the new setting row "בדיקה לפני הפעלת ריבוי בניינים"; pressing the switch opens the check (it does not turn on),
//     "הפעל" waits for "עברתי על הממצאים"; a blocking finding (`?mbcheck=block`) keeps it disabled with the reason.
//   - מפה › בניין › קומות › עריכה: the floor's building and "העברה לבניין אחר" (the demo site has two buildings); the move dialog shows the
//     impact preview - who loses access first - and asks "אני מבין" before the move when anybody loses access.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-mb-safety-2500.spec.ts --workers=1
// Every project: nothing overflows horizontally, the dialog sits inside the viewport. The floor dialogs are desktop / tablet only (the
// phone has no structure editing, ui.mobile hide_structure).

async function boot(page: Page, q: string, hash: string) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.clock.install({ time: new Date('2026-11-23T09:00:00Z') });
  await page.addInitScript(() => {
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const sig = `${nav.hardwareConcurrency ?? '?'}/${nav.deviceMemory ?? '?'}/${Math.round(devicePixelRatio * 100) / 100}`;
      localStorage.setItem('sw.ui.performance', JSON.stringify({ tier: 'full', sig, at: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a${q}#${hash}`);
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The element (e.g. the dialog's confirm button, its preview) is drawn inside the viewport - the dialog fits, nothing below the fold. */
async function inViewport(page: Page, sel: string) {
  const vp = page.viewportSize()!;
  const box = await page.locator(sel).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
}

const settings = async (page: Page, q = '&mb=off') => {
  await boot(page, q, '/system/diagnostics?tab=buildings');
  await page.locator('system-mapping [data-mapping-switch]').waitFor();
};

test('the check before turning multi-building on: a setting row, the dialog instead of an instant switch, "הפעל" after the review', async ({ page }) => {
  await settings(page);
  const row = page.locator('system-mapping [data-mapping-setting="review"]');
  await expect(row).toBeVisible();
  await expect(row.locator('[data-mapping-option="required"]')).toBeVisible();
  await expect(page.locator('system-mapping [data-mapping-switch-state]')).toHaveAttribute('data-mapping-switch-state', 'off');
  await page.locator('system-mapping [data-mapping-toggle]').click();
  const dlg = page.locator('system-mapping mb-enable-check');
  await expect(dlg.locator('[data-mb-findings]')).toBeVisible();
  await expect(page.locator('system-mapping [data-mapping-switch-state]')).toHaveAttribute('data-mapping-switch-state', 'off');
  await expect(dlg.locator('[data-mb-finding="reach_gain"]')).toHaveAttribute('data-severity', 'warning');
  const enable = dlg.locator('[data-mb-enable] button');
  await expect(enable).toBeDisabled();
  await dlg.locator('[data-mb-ack]').check();
  await expect(enable).toBeEnabled();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await enable.click();
  await expect(page.locator('system-mapping [data-mapping-switch-state]')).toHaveAttribute('data-mapping-switch-state', 'on');
  await expect(dlg).toHaveCount(0);
});

test('a blocking finding keeps "הפעל" disabled and says why', async ({ page }) => {
  await settings(page, '&mb=off&mbcheck=block');
  await page.locator('system-mapping [data-mapping-toggle]').click();
  const dlg = page.locator('system-mapping mb-enable-check');
  await expect(dlg.locator('[data-mb-finding="entity_cross_building"]')).toHaveAttribute('data-severity', 'blocking');
  await expect(dlg.locator('[data-mb-finding]').first()).toHaveAttribute('data-mb-finding', 'entity_cross_building');
  await expect(dlg.locator('[data-mb-blocked]')).toBeVisible();
  await expect(dlg.locator('[data-mb-ack]')).toHaveCount(0);
  await expect(dlg.locator('[data-mb-enable] button')).toBeDisabled();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

test('moving a floor: the building row in the edit dialog and the impact preview, people who lose access first', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'the phone has no structure editing (ui.mobile hide_structure)');
  await boot(page, '', '/explore/buildings/bld-a/floors');
  await page.locator('explore-floors [data-floor-actions]').waitFor();
  await page.locator('explore-floors [data-floor-actions] sw-button', { hasText: 'עריכה' }).first().click();
  await expect(page.locator('explore-floors [data-floor-move-row]')).toBeVisible();
  await page.locator('explore-floors [data-floor-move-open]').click();
  const pv = page.locator('explore-floors [data-floor-move-preview]');
  await expect(pv).toBeVisible();
  await expect(page.locator('explore-floors [data-floor-move-target] option')).toHaveText(['מבנה ב']);
  await expect(pv.locator('[data-floor-move-loses="3"]')).toBeVisible();
  await expect(pv.locator('[data-floor-move-gains="2"]')).toBeVisible();
  await expect(pv.locator('[data-floor-move-ack]')).toBeVisible();
  // the demo never moves anything: the confirm stays disabled there (the gate itself is unit-tested)
  await expect(page.locator('explore-floors [data-floor-move-confirm] button')).toBeDisabled();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await inViewport(page, 'explore-floors [data-floor-move-preview]');
  await inViewport(page, 'explore-floors [data-floor-move-confirm]');
});

test('a move nobody loses access by asks no acknowledgement', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'the phone has no structure editing (ui.mobile hide_structure)');
  await boot(page, '&mbmove=clean', '/explore/buildings/bld-a/floors');
  await page.locator('explore-floors [data-floor-actions]').waitFor();
  await page.locator('explore-floors [data-floor-actions] sw-button', { hasText: 'עריכה' }).first().click();
  await page.locator('explore-floors [data-floor-move-open]').click();
  const pv = page.locator('explore-floors [data-floor-move-preview]');
  await expect(pv.locator('[data-floor-move-loses="0"]')).toBeVisible();
  await expect(pv.locator('[data-floor-move-ack]')).toHaveCount(0);
});
