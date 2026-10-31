import { test, expect, type Page } from '@playwright/test';

// A11Y-2310: sw-dialog declares aria-modal="true", so keyboard focus must stay inside it (sw-sheet and sw-drawer already trap Tab),
// Escape closes it and focus returns to the control that opened it. A throwaway dialog is mounted on the style guide (demo data, no backend).
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/a11y-dialog-focus-2310.spec.ts --workers=1

async function mount(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/styleguide');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'a11y-opener';
    opener.textContent = 'open';
    opener.style.cssText = 'position:fixed;inset-block-start:4px;inset-inline-start:4px;z-index:5';
    const dlg = document.createElement('sw-dialog') as HTMLElement & { open: boolean; heading: string };
    dlg.id = 'a11y-dlg';
    dlg.heading = 'בדיקה';
    dlg.innerHTML = '<input id="d-in" aria-label="שדה"><button id="d-mid">אמצע</button><sw-button slot="footer" id="d-save">שמור</sw-button>';
    document.body.append(opener, dlg);
    opener.focus();
    dlg.open = true;
  });
  await page.waitForTimeout(400);
}

/** The deep active element's id/label, or '' */
const where = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    const dlg = document.getElementById('a11y-dlg')!;
    let inside = false;
    for (let n: Node | null = a; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) if (n === dlg) inside = true;
    return { id: (a as HTMLElement | null)?.id || (a as HTMLElement | null)?.getAttribute?.('aria-label') || a?.tagName || '', inside };
  });

test('Tab and Shift+Tab stay inside an open sw-dialog', async ({ page }) => {
  await mount(page);
  expect((await where(page)).inside).toBe(true);
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect((await where(page)).inside, `Tab #${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Shift+Tab');
    expect((await where(page)).inside, `Shift+Tab #${i + 1}`).toBe(true);
  }
});

test('Escape closes the dialog and focus returns to the opener', async ({ page }) => {
  await mount(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (document.getElementById('a11y-dlg') as unknown as { open: boolean }).open)).toBe(false);
  await expect.poll(async () => (await where(page)).id).toBe('a11y-opener');
});
