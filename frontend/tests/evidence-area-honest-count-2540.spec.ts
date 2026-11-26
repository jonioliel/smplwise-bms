import { test, expect, type Page } from '@playwright/test';
import { mockHonestArea, openBuilding } from './area-honest-count-2540-mocks';

// AREA-HONEST-COUNT-2540 (deep review SCR-10 / SCR-09, the FULL interface): the building screen's area row and area summary never show
// a lock whose state is not known as "not locked" (its own grey "לא ידוע"), and an unreadable alarm summary is grey, never the warm
// "armed" look. Mocked backend (tests/area-honest-count-2540-mocks.ts), the preview build.

const B = (page: Page) => page.locator('sw-app devices-building');
const row = (page: Page, id: string) => B(page).locator(`a.arow[data-area-row="ahc_${id}"]`);

test.describe('the area row tells an unknown lock / alarm apart', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('an offline lock is grey "לא ידוע", never the warm "not locked"; an open one keeps its warm count beside it', async ({ page }) => {
    await mockHonestArea(page);
    await openBuilding(page);
    // entry: one locked, one offline - nothing is open: no warm unlock indicator, a grey "1 לא ידוע"
    const entry = row(page, 'entry');
    await expect(entry.locator('[data-ind="locks"]:not([data-ind-unknown])')).toHaveCount(0);
    const unk = entry.locator('[data-ind="locks"][data-ind-unknown]');
    await expect(unk).toHaveText('1 לא ידוע');
    await expect(unk).toHaveClass(/\bdim\b/);
    await expect(unk).not.toHaveClass(/\bwarm\b/);
    await expect(unk).toHaveAttribute('title', 'מנעולים במצב לא ידוע: 1 מתוך 2');
    // back: the only lock is offline: "לא ידוע"
    await expect(row(page, 'back').locator('[data-ind="locks"][data-ind-unknown]')).toHaveText('לא ידוע');
    await expect(row(page, 'back').locator('[data-ind="locks"]:not([data-ind-unknown])')).toHaveCount(0);
    // office: one open, one offline - both, apart: the warm "0/2" (unlock icon) and the grey unknown
    const office = row(page, 'office');
    const open = office.locator('[data-ind="locks"]:not([data-ind-unknown])');
    await expect(open).toHaveText('0/2');
    await expect(open).toHaveClass(/\bwarm\b/);
    await expect(open.locator('sw-icon')).toHaveAttribute('name', 'unlock');
    await expect(office.locator('[data-ind="locks"][data-ind-unknown]')).toHaveText('1 לא ידוע');
    // kitchen: every lock locked - "only when active" hides it, as before
    await expect(row(page, 'kitchen').locator('[data-ind="locks"]')).toHaveCount(0);
  });

  test('the alarm summary: the armed panel is not hidden by an offline one; an unreadable summary is grey', async ({ page }) => {
    await mockHonestArea(page);
    await openBuilding(page);
    const entry = row(page, 'entry').locator('[data-ind="alarm"]');
    await expect(entry).toHaveText('דרוכה (בית)');
    await expect(entry).toHaveClass(/\bwarm\b/);
    await expect(entry).toHaveAttribute('title', 'אזעקה · לוח אחד במצב לא ידוע');
    const back = row(page, 'back').locator('[data-ind="alarm"]');
    await expect(back).toHaveText('לא זמינה');
    await expect(back).toHaveAttribute('data-ind-unknown', '');
    await expect(back).toHaveClass(/\bdim\b/);
    await expect(back).not.toHaveClass(/\bwarm\b/);
    const office = row(page, 'office').locator('[data-ind="alarm"]');
    await expect(office).toHaveText('מנוטרלת');
    await expect(office).not.toHaveClass(/\bwarm\b/);
  });

  test('the area summary (popover) lists the unknown locks on their own chip', async ({ page }) => {
    await mockHonestArea(page);
    await openBuilding(page);
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const menu = B(page).locator(wide ? 'devices-bulk-menu[data-tree-area="ahc_entry"]' : 'devices-bulk-menu[data-card-area="ahc_entry"]');
    await expect(menu).toBeVisible({ timeout: 30_000 });
    await menu.locator('[data-area-more]').click();
    const panel = menu.locator('[data-bulk-panel="popover"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-chip="locks"]')).toContainText('1/2');
    await expect(panel.locator('[data-chip="locks_unknown"]')).toContainText('מצב לא ידוע 1');
    await expect(panel.locator('[data-chip="alarm"]')).toContainText('אזעקה: דרוכה (בית) · 1 לא ידוע');
  });

  test('no horizontal page scroll with the extra indicator', async ({ page }) => {
    await mockHonestArea(page);
    await openBuilding(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
