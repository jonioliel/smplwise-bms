import type { Page } from '@playwright/test';

/** LV1: the wall's columns picker is the shared compact dropdown; `n` = 0 is the automatic best fit. */
export async function pickCols(page: Page, n: number): Promise<void> {
  const dd = page.locator('live-wall sw-dropdown[data-wall-cols-dd]');
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`.opt[data-id="${n}"]`).click();
}
