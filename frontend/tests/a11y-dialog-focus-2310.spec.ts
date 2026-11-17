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

// CR-MODAL-STACK-2441 (code review 07:F13): a confirmation (sw-dialog) opened over an sw-sheet. Both listen for Tab on the window; the
// sheet used to pull the focus back into itself on every Tab, because the dialog is not inside it. Only the top layer traps now.
async function mountSheetWithConfirm(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/styleguide');
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-sheet') && !!customElements.get('sw-dialog'));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    type Layer = HTMLElement & { open: boolean; heading: string; kind?: string };
    const opener = document.createElement('button');
    opener.id = 'sd-page';
    opener.textContent = 'open';
    opener.style.cssText = 'position:fixed;inset-block-start:4px;inset-inline-start:4px;z-index:5';
    const sheet = document.createElement('sw-sheet') as Layer;
    sheet.id = 'sd-sheet';
    sheet.kind = 'centred';
    sheet.heading = 'גיליון';
    sheet.innerHTML = '<input id="s-in" aria-label="שם"><button id="s-del">מחק</button><button id="s-last">סיום</button>';
    const dlg = document.createElement('sw-dialog') as Layer;
    dlg.id = 'sd-dlg';
    dlg.heading = 'למחוק?';
    dlg.innerHTML = '<button id="c-no">ביטול</button><button id="c-yes">מחק</button>';
    document.body.append(opener, sheet, dlg);
    opener.focus();
    sheet.open = true;
    sheet.querySelector('#s-del')!.addEventListener('click', () => (dlg.open = true));
  });
  await page.waitForTimeout(400);
}

/** The id of the deep active element and which of the two layers holds it. */
const whereIn = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    let layer = '';
    for (let n: Node | null = a; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      if (n instanceof HTMLElement && (n.id === 'sd-sheet' || n.id === 'sd-dlg')) {
        layer = n.id;
        break;
      }
    }
    return { id: (a as HTMLElement | null)?.id || a?.tagName || '', layer };
  });

test('sheet + dialog: Tab and Shift+Tab stay inside the confirmation opened over a sheet', async ({ page }) => {
  await mountSheetWithConfirm(page);
  expect((await whereIn(page)).layer).toBe('sd-sheet');
  await page.locator('#s-del').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await whereIn(page)).layer).toBe('sd-dlg');
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const at = await whereIn(page);
    expect(at.layer, `Tab #${i + 1} (${at.id})`).toBe('sd-dlg');
    seen.add(at.id);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    const at = await whereIn(page);
    expect(at.layer, `Shift+Tab #${i + 1} (${at.id})`).toBe('sd-dlg');
    seen.add(at.id);
  }
  // the trap really cycles through the confirmation's own controls
  expect([...seen]).toEqual(expect.arrayContaining(['c-no', 'c-yes']));
});

test('sheet + dialog: Escape closes the confirmation, focus returns into the sheet and its own trap works again', async ({ page }) => {
  await mountSheetWithConfirm(page);
  await page.locator('#s-del').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await whereIn(page)).layer).toBe('sd-dlg');
  await page.keyboard.press('Escape');
  const state = () => page.evaluate(() => ['sd-sheet', 'sd-dlg'].map((id) => (document.getElementById(id) as unknown as { open: boolean }).open));
  await expect.poll(state).toEqual([true, false]);
  await expect.poll(async () => (await whereIn(page)).id).toBe('s-del');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect((await whereIn(page)).layer, `Tab #${i + 1}`).toBe('sd-sheet');
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    expect((await whereIn(page)).layer, `Shift+Tab #${i + 1}`).toBe('sd-sheet');
  }
  await page.keyboard.press('Escape');
  await expect.poll(state).toEqual([false, false]);
  await expect.poll(async () => (await whereIn(page)).id).toBe('sd-page');
});
