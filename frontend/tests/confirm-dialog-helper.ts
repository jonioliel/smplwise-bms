import { expect, type Page } from '@playwright/test';

/** CR-CONFIRM-DIALOG-2438: a confirmation is the system's own dialog (components/confirm-dialog.ts), not the browser's confirm() box -
 * a spec answers it by clicking, where it used to call page.once('dialog', ...). Returns the question's text. */
export async function answerConfirm(page: Page, accept: boolean, timeout = 15_000): Promise<string> {
  const dlg = page.locator('sw-confirm-dialog').last();
  await expect(dlg.locator('[data-confirm-text]')).toBeVisible({ timeout });
  const text = (await dlg.locator('[data-confirm-text]').textContent()) ?? '';
  await dlg.locator(accept ? '[data-confirm-ok]' : '[data-confirm-cancel]').click();
  await expect(page.locator('sw-confirm-dialog')).toHaveCount(0);
  return text;
}
