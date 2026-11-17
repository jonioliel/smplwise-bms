import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockGaps } from './home-v3-gaps-mocks';

// CR-MODAL-STACK-B-2442: a hand-built modal on the shared modal stack (components/hand-modal.ts), on a real screen - the home
// interface's sheet (every overlay of sw-home is one layer). The rules: one Escape press closes one layer, the top one; Tab stays inside
// the sheet; the screen behind it is inert; focus returns to the control that opened it. The lint half (every hand-built role="dialog" is
// on the stack or allow-listed) is tests/unit-modal-stack-guard-2442.spec.ts.

const home = (page: Page) => page.locator('sw-home');
const ready = (page: Page) => expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);

async function openMedia(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('about:blank');
  await mockGaps(page, {});
  await page.goto('/#/home/media');
  await home(page).waitFor();
  await ready(page);
  await settle(page);
}

/** What the home interface looks like to the keyboard right now. */
const probe = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    const ovl = root.querySelector('.app-root > .ovl');
    let inOvl = false;
    for (let n: Node | null = a; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) if (n === ovl) inOvl = true;
    return {
      sheets: root.querySelectorAll('.app-root > .ovl > .sheet').length,
      inert: root.querySelector('.app-root > .hs')?.hasAttribute('inert') ?? false,
      focusInSheet: inOvl,
      focusOnOpener: !!a && a.hasAttribute('data-p3-announce'),
    };
  });

test('home sheet: the screen behind it is inert, Tab stays inside, Escape closes it and focus returns to the opener', async ({ page }) => {
  await openMedia(page);
  await home(page).locator('[data-p3-announce]').focus();
  await page.keyboard.press('Enter');
  await expect(home(page).locator('[data-p3-sheet="announce"]')).toBeVisible();
  await expect.poll(async () => (await probe(page)).inert).toBe(true);
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    expect((await probe(page)).focusInSheet, `press ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).sheets).toBe(0);
  await expect.poll(() => probe(page)).toEqual({ sheets: 0, inert: false, focusInSheet: false, focusOnOpener: true });
});

test('home sheet opened with the mouse: Escape closes it although focus is not inside it', async ({ page }) => {
  await openMedia(page);
  await home(page).locator('[data-p3-announce]').click();
  await expect(home(page).locator('[data-p3-sheet="announce"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).sheets).toBe(0);
  expect((await probe(page)).inert).toBe(false);
});

test('a confirmation over a home sheet: Escape closes the dialog only, a second press closes the sheet', async ({ page }) => {
  await openMedia(page);
  await home(page).locator('[data-p3-announce]').click();
  await expect(home(page).locator('[data-p3-sheet="announce"]')).toBeVisible();
  await page.waitForFunction(() => !!customElements.get('sw-dialog'));
  await page.evaluate(() => {
    const dlg = document.createElement('sw-dialog') as HTMLElement & { open: boolean; heading: string };
    dlg.id = 'msb-confirm';
    dlg.heading = 'אישור';
    dlg.innerHTML = '<button id="msb-btn">אישור</button>';
    document.body.append(dlg);
    dlg.open = true;
  });
  const dialogOpen = () => page.evaluate(() => (document.getElementById('msb-confirm') as unknown as { open: boolean }).open);
  await page.waitForTimeout(500);
  expect(await dialogOpen()).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(dialogOpen).toBe(false);
  // the same press did not reach the sheet, not even late
  await page.waitForTimeout(300);
  expect((await probe(page)).sheets).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).sheets).toBe(0);
});

test('a home sheet over an sw-sheet: Escape closes the home sheet only, a second press closes the sheet under it', async ({ page }) => {
  await openMedia(page);
  await page.waitForFunction(() => !!customElements.get('sw-sheet'));
  await page.evaluate(() => {
    const sheet = document.createElement('sw-sheet') as HTMLElement & { open: boolean; heading: string; kind: string };
    sheet.id = 'msb-sheet';
    sheet.kind = 'centred';
    sheet.heading = 'גיליון';
    sheet.innerHTML = '<button id="msb-s-btn">כפתור</button>';
    document.body.append(sheet);
    sheet.open = true;
  });
  const under = () => page.evaluate(() => (document.getElementById('msb-sheet') as unknown as { open: boolean }).open);
  await page.waitForTimeout(300);
  // the sheet's scrim covers the screen: the announce key is pressed from code (a screen opens its sheet over another layer the same way)
  await home(page).locator('[data-p3-announce]').dispatchEvent('click');
  await expect.poll(async () => (await probe(page)).sheets).toBe(1);
  expect(await under()).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await probe(page)).sheets).toBe(0);
  await page.waitForTimeout(300);
  expect(await under()).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(under).toBe(false);
});
