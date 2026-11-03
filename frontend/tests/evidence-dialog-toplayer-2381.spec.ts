import { test, expect, type Page } from '@playwright/test';

// DIALOG-TOPLAYER-2381: sw-dialog's backdrop is a manual popover in the browser's top layer. In the glass skins (domus, crystal) every
// sw-card carries a backdrop-filter, which made the card the containing block of the old `position: fixed` backdrop: a dialog opened from
// inside a card was centred on the card and only the card was dimmed (2.38.0 gate, the NVR connection card's "save anyway" dialog on a
// phone). Here a TALL card (2400 px) is mounted in the shell's scroller on the style guide (demo data, no backend), the page is scrolled to
// the middle of the card, and a dialog is opened from a button there. Asserted, per glass skin, light and dark, on every project:
//   - the backdrop is exactly the viewport and sits in the top layer; the box is inside the viewport and centred on it;
//   - the four corners of the screen hit the dialog's backdrop (the dimming covers the page, nothing of the page paints above it);
//   - a dialog opened from that dialog paints above it, Escape closes only the top one, then the first, and focus returns to the opener;
//   - a toast (the shell's offline pill) stays above an open dialog, whether it appeared before or after the dialog opened.
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-dialog-toplayer-2381.spec.ts --workers=1

const SKINS = ['domus', 'crystal'] as const;
const SCHEMES = ['light', 'dark'] as const;

async function mount(page: Page, skin: string, scheme: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the open animation's durations are zero: the box is measured where it rests
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/styleguide`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
    const card = document.createElement('sw-card');
    card.id = 'tl-card';
    card.style.cssText = 'display:block;block-size:2400px;margin:16px';
    card.innerHTML = `<div style="block-size:1150px"></div>
      <button id="tl-open" type="button" style="min-block-size:44px">פתח</button>
      <sw-dialog id="tl-dlg" heading="שמירה בלי בדיקה">
        <p>הדיאלוג נפתח מתוך כרטיס גבוה.</p>
        <button id="tl-open2" type="button">אישור נוסף</button>
        <sw-dialog id="tl-dlg2" heading="אישור">
          <p>דיאלוג שנפתח מתוך דיאלוג.</p>
          <button id="tl-in2" type="button">בסדר</button>
        </sw-dialog>
        <sw-button slot="footer" id="tl-save">שמירה</sw-button>
      </sw-dialog>`;
    main.append(card);
    const d1 = card.querySelector('#tl-dlg') as HTMLElement & { open: boolean };
    const d2 = card.querySelector('#tl-dlg2') as HTMLElement & { open: boolean };
    card.querySelector('#tl-open')!.addEventListener('click', () => (d1.open = true));
    card.querySelector('#tl-open2')!.addEventListener('click', () => (d2.open = true));
    // scrolled along the card (whichever box scrolls): its top is far above the viewport, its bottom far below
    card.querySelector('#tl-open')!.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(200);
}

/** The geometry of an open dialog: its backdrop, its box, the viewport, and whether the backdrop is in the top layer. */
const geometry = (page: Page, id: string) =>
  page.evaluate((id) => {
    const card = document.querySelector('sw-app')!.shadowRoot!.querySelector('#tl-card')!;
    const dlg = card.querySelector(`#${id}`)!;
    const back = dlg.shadowRoot!.querySelector('.backdrop')!;
    const box = dlg.shadowRoot!.querySelector('.box')!;
    const b = back.getBoundingClientRect();
    const x = box.getBoundingClientRect();
    const de = document.documentElement;
    const cardRect = card.getBoundingClientRect();
    return {
      vw: de.clientWidth, vh: de.clientHeight,
      back: { l: b.left, t: b.top, w: b.width, h: b.height },
      box: { l: x.left, t: x.top, r: x.right, b: x.bottom, cx: (x.left + x.right) / 2, cy: (x.top + x.bottom) / 2 },
      top: back.matches(':popover-open'),
      cardFilter: getComputedStyle(card).backdropFilter || getComputedStyle(card).getPropertyValue('-webkit-backdrop-filter'),
      cardTop: cardRect.top, cardBottom: cardRect.bottom,
    };
  }, id);

/** Which dialog (if any) the point hits - through the shell's shadow root, then the dialog's own (the backdrop or its box). */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(([x, y]) => {
    const root = document.querySelector('sw-app')!.shadowRoot!;
    const top = document.elementFromPoint(x, y);
    if (top && top.tagName !== 'SW-APP') return top.tagName.toLowerCase();
    const el = root.elementFromPoint(x, y);
    if (!el || el.tagName !== 'SW-DIALOG') return el?.tagName.toLowerCase() ?? 'none';
    const inner = el.shadowRoot!.elementFromPoint(x, y);
    return `${el.id}:${inner?.className || inner?.tagName.toLowerCase()}`;
  }, [x, y]);

const isOpen = (page: Page, id: string) =>
  page.evaluate((id) => (document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${id}`) as unknown as { open: boolean }).open, id);

const deepActiveId = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return (a as HTMLElement | null)?.id ?? '';
  });

for (const skin of SKINS) {
  for (const scheme of SCHEMES) {
    test(`${skin} / ${scheme}: a dialog opened inside a tall glass card covers the viewport and is centred on it`, async ({ page }, testInfo) => {
      await mount(page, skin, scheme);
      await page.locator('#tl-open').click();
      await expect.poll(() => isOpen(page, 'tl-dlg')).toBe(true);
      await page.waitForTimeout(150);
      const g = await geometry(page, 'tl-dlg');
      // the hazard is really there: the card carries a backdrop-filter and runs past both edges of the viewport
      expect(g.cardFilter, JSON.stringify(g)).not.toMatch(/^(none|)$/);
      expect(g.cardTop < 0 && g.cardBottom > g.vh, JSON.stringify(g)).toBe(true);
      // the backdrop is the viewport, in the top layer
      expect(g.top, 'backdrop in the top layer').toBe(true);
      expect(Math.abs(g.back.l) <= 1 && Math.abs(g.back.t) <= 1 && Math.abs(g.back.w - g.vw) <= 1 && Math.abs(g.back.h - g.vh) <= 1, JSON.stringify(g)).toBe(true);
      // the box is inside the viewport and centred on it
      expect(g.box.l >= 0 && g.box.t >= 0 && g.box.r <= g.vw && g.box.b <= g.vh, JSON.stringify(g)).toBe(true);
      expect(Math.abs(g.box.cx - g.vw / 2) <= 2 && Math.abs(g.box.cy - g.vh / 2) <= 2, JSON.stringify(g)).toBe(true);
      // the dimming covers the whole page: every corner hits the backdrop
      for (const [x, y] of [[2, 2], [g.vw - 3, 2], [2, g.vh - 3], [g.vw - 3, g.vh - 3]]) expect(await hitAt(page, x, y), `corner ${x},${y}`).toBe('tl-dlg:backdrop');
      await testInfo.attach(`dialog-${skin}-${scheme}`, { body: await page.screenshot(), contentType: 'image/png' });
      // focus moved into the box
      expect(['tl-open2', 'tl-save', '']).toContain(await deepActiveId(page));
      expect(await deepActiveId(page)).not.toBe('tl-open');

      // a dialog opened from the dialog paints above it (the OPEN_STACK order), Escape closes the top one only
      await page.locator('#tl-open2').click();
      await expect.poll(() => isOpen(page, 'tl-dlg2')).toBe(true);
      await page.waitForTimeout(150);
      const g2 = await geometry(page, 'tl-dlg2');
      expect(g2.top && Math.abs(g2.back.w - g2.vw) <= 1 && Math.abs(g2.back.h - g2.vh) <= 1, JSON.stringify(g2)).toBe(true);
      expect(await hitAt(page, 2, 2)).toBe('tl-dlg2:backdrop');
      expect(await hitAt(page, Math.round(g2.box.cx), Math.round(g2.box.cy))).toMatch(/^tl-dlg2:/);
      await page.keyboard.press('Escape');
      await expect.poll(() => isOpen(page, 'tl-dlg2')).toBe(false);
      expect(await isOpen(page, 'tl-dlg')).toBe(true);
      expect(await hitAt(page, 2, 2)).toBe('tl-dlg:backdrop');
      await page.keyboard.press('Escape');
      await expect.poll(() => isOpen(page, 'tl-dlg')).toBe(false);
      await expect.poll(() => deepActiveId(page)).toBe('tl-open');
      expect((await geometry(page, 'tl-dlg')).top, 'the closed dialog left the top layer').toBe(false);
    });
  }
}

test('a toast stays above an open dialog: the offline pill shown before the dialog opened, and one shown while it is open', async ({ page }) => {
  await mount(page, 'domus', 'light');
  const pill = () =>
    page.evaluate(() => {
      const host = document.querySelector('arx-pwa-prompts')!;
      const net = host.shadowRoot!.querySelector('[data-net]');
      if (!net) return null;
      const r = net.getBoundingClientRect();
      const x = (r.left + r.right) / 2;
      const y = (r.top + r.bottom) / 2;
      return { hit: document.elementFromPoint(x, y)?.tagName.toLowerCase() ?? 'none', lifted: host.matches(':popover-open') };
    });
  // shown before the dialog: the dialog's opening raises it again
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect.poll(pill).not.toBeNull();
  await page.locator('#tl-open').click();
  await expect.poll(() => isOpen(page, 'tl-dlg')).toBe(true);
  await page.waitForTimeout(150);
  expect(await pill()).toEqual({ hit: 'arx-pwa-prompts', lifted: true });
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page, 'tl-dlg')).toBe(false);
  // shown while the dialog is open
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('#tl-open').click();
  await expect.poll(() => isOpen(page, 'tl-dlg')).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect.poll(pill).toEqual({ hit: 'arx-pwa-prompts', lifted: true });
});
