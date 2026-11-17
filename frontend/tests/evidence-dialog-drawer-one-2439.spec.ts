import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A a / Q-DES-8B a): the system's ONE dialog and ONE drawer.
// A dialog and a modal drawer are mounted on the style guide (demo data, no backend), per skin and scheme, and measured:
//   - the dialog's box and the drawer's panel are opaque (alpha 1) and carry no backdrop blur - nothing behind shows through;
//   - from 768 px the dialog is centred, 440 px wide (wide 720, xl 1120); on a phone it is a full-width sheet on the bottom edge;
//   - the drawer hangs on the inline start (the right edge in Hebrew, the left in English); on a phone it fills the screen;
//   - the header holds the title, the explanation line and a round close button; the footer sits on the bottom edge of the box;
//   - `beforeclose` can refuse the close request (✕, Escape, the scrim), and Escape / focus return work as before.
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-dialog-drawer-one-2439.spec.ts --workers=1

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/dialog-drawer-one-2439');
const SKINS = ['domus', 'classic', 'crystal', 'bubble'] as const; // bubble: opaque too (owner round 34, Q-DES-23 b)
const SCHEMES = ['light', 'dark'] as const;

async function mount(page: Page, skin: string, scheme: string, lang = 'he') {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // durations are zero: everything is measured where it rests
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}${lang === 'en' ? '&lang=en' : ''}#/styleguide`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
    const box = document.createElement('div');
    box.id = 'one';
    box.innerHTML = `<button id="one-open" type="button" style="min-block-size:44px">חלון</button>
      <button id="one-drawer" type="button" style="min-block-size:44px">מגירה</button>
      <sw-dialog id="one-dlg" heading="אתר חדש" subheading="שם וכתובת">
        <label style="display:grid;gap:3px">שם<input id="one-name" value="משרדי החברה" /></label>
        <label style="display:grid;gap:3px">כתובת (לא חובה)<input placeholder="רחוב ומספר" /></label>
        <sw-button slot="footer" variant="ghost" id="one-cancel">ביטול</sw-button>
        <sw-button slot="footer" variant="primary" id="one-save">צור אתר</sw-button>
      </sw-dialog>
      <sw-drawer modal id="one-drw" heading="בקשת שירות חדשה" subheading="אחזקה">
        <label style="display:grid;gap:3px">כותרת<input value="נזילה בחדר המדרגות" /></label>
        <div style="block-size:1400px;flex:none" id="one-tall">תיאור</div>
        <sw-button slot="footer" variant="primary" id="one-send">פתיחת בקשה</sw-button>
        <sw-button slot="footer" variant="ghost">ביטול</sw-button>
      </sw-drawer>`;
    main.prepend(box);
    const dlg = box.querySelector('#one-dlg') as HTMLElement & { open: boolean };
    const drw = box.querySelector('#one-drw') as HTMLElement & { open: boolean };
    box.querySelector('#one-open')!.addEventListener('click', () => (dlg.open = true));
    box.querySelector('#one-drawer')!.addEventListener('click', () => (drw.open = true));
  });
  await page.waitForTimeout(200);
}

interface Probe {
  vw: number; vh: number; l: number; t: number; r: number; b: number; w: number; h: number;
  alpha: number; blur: string; radius: number; footBottom: number; closeW: number; closeH: number; closeRadius: string; bodyScrolls: boolean; dir: string;
}

const probe = (page: Page, id: string, sel: string) =>
  page.evaluate(([id, sel]) => {
    const host = document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${id}`)!;
    const el = host.shadowRoot!.querySelector(sel) as HTMLElement;
    const cs = getComputedStyle(el);
    // the alpha of the painted fill: a canvas reads back what the colour really is (rgb(), color(), color-mix() all resolve here)
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = cs.backgroundColor;
    g.fillRect(0, 0, 1, 1);
    const alpha = g.getImageData(0, 0, 1, 1).data[3] / 255;
    const r = el.getBoundingClientRect();
    const foot = el.querySelector('footer')!.getBoundingClientRect();
    const close = el.querySelector('header sw-button')!.shadowRoot!.querySelector('button')!;
    const cr = close.getBoundingClientRect();
    const body = el.querySelector('.body') as HTMLElement;
    const de = document.documentElement;
    return {
      vw: de.clientWidth, vh: de.clientHeight, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, alpha,
      blur: cs.backdropFilter || cs.getPropertyValue('-webkit-backdrop-filter') || 'none', radius: parseFloat(cs.borderStartStartRadius), footBottom: foot.bottom,
      closeW: cr.width, closeH: cr.height, closeRadius: getComputedStyle(close).borderStartStartRadius, bodyScrolls: body.scrollHeight > body.clientHeight + 1, dir: cs.direction,
    } as Probe;
  }, [id, sel] as const);

const isOpen = (page: Page, id: string) =>
  page.evaluate((id) => (document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${id}`) as unknown as { open: boolean }).open, id);

for (const skin of SKINS) {
  for (const scheme of SCHEMES) {
    test(`${skin} / ${scheme}: the one dialog is opaque, unblurred, centred (a bottom sheet on a phone)`, async ({ page }, info) => {
      await mount(page, skin, scheme);
      await page.locator('#one-open').click();
      await expect.poll(() => isOpen(page, 'one-dlg')).toBe(true);
      await page.waitForTimeout(150);
      const p = await probe(page, 'one-dlg', '.box');
      expect(p.alpha, JSON.stringify(p)).toBe(1);
      expect(p.blur, JSON.stringify(p)).toBe('none');
      if (p.vw < 768) {
        expect(Math.abs(p.l) <= 1 && Math.abs(p.r - p.vw) <= 1 && Math.abs(p.b - p.vh) <= 1, JSON.stringify(p)).toBe(true);
      } else {
        expect(Math.abs(p.w - 440) <= 1, JSON.stringify(p)).toBe(true);
        expect(Math.abs((p.l + p.r) / 2 - p.vw / 2) <= 2 && Math.abs((p.t + p.b) / 2 - p.vh / 2) <= 2, JSON.stringify(p)).toBe(true);
      }
      // the actions sit on the box's bottom edge; the close button is a circle
      expect(Math.abs(p.footBottom - p.b) <= 2, JSON.stringify(p)).toBe(true);
      expect(Math.abs(p.closeW - p.closeH) <= 1 && p.closeRadius === '50%', JSON.stringify(p)).toBe(true);
      await page.screenshot({ path: path.join(OUT, `dialog-${skin}-${scheme}-${info.project.name}.png`) });
      // the three fixed widths
      if (p.vw >= 1200) {
        for (const [attr, w] of [['wide', 720], ['xl', 1120]] as const) {
          await page.evaluate(([a]) => { const d = document.querySelector('sw-app')!.shadowRoot!.querySelector('#one-dlg')!; d.removeAttribute('wide'); d.removeAttribute('xl'); d.setAttribute(a, ''); }, [attr]);
          await page.waitForTimeout(60);
          expect(Math.abs((await probe(page, 'one-dlg', '.box')).w - w) <= 1, attr).toBe(true);
        }
      }
      await page.keyboard.press('Escape');
      await expect.poll(() => isOpen(page, 'one-dlg')).toBe(false);
    });

    test(`${skin} / ${scheme}: the one drawer is opaque, unblurred, on the inline start (the full screen on a phone)`, async ({ page }, info) => {
      await mount(page, skin, scheme);
      await page.locator('#one-drawer').click();
      await expect.poll(() => isOpen(page, 'one-drw')).toBe(true);
      await page.waitForTimeout(150);
      const p = await probe(page, 'one-drw', 'dialog.panel');
      expect(p.alpha, JSON.stringify(p)).toBe(1);
      expect(p.blur, JSON.stringify(p)).toBe('none');
      expect(p.dir).toBe('rtl');
      if (p.vw < 768) {
        expect(Math.abs(p.l) <= 1 && Math.abs(p.r - p.vw) <= 1 && Math.abs(p.t) <= 1 && Math.abs(p.b - p.vh) <= 1, JSON.stringify(p)).toBe(true);
      } else {
        // Hebrew: the inline start is the right edge
        expect(Math.abs(p.r - p.vw) <= 1 && Math.abs(p.w - 480) <= 1 && Math.abs(p.t) <= 1 && Math.abs(p.b - p.vh) <= 1, JSON.stringify(p)).toBe(true);
      }
      // only the middle scrolls: the actions stay on the bottom edge
      expect(p.bodyScrolls, JSON.stringify(p)).toBe(true);
      expect(Math.abs(p.footBottom - p.b) <= 2, JSON.stringify(p)).toBe(true);
      expect(Math.abs(p.closeW - p.closeH) <= 1 && p.closeRadius === '50%', JSON.stringify(p)).toBe(true);
      await page.screenshot({ path: path.join(OUT, `drawer-${skin}-${scheme}-${info.project.name}.png`) });
      await page.keyboard.press('Escape');
      await expect.poll(() => isOpen(page, 'one-drw')).toBe(false);
    });
  }
}

test('the dialog: beforeclose refuses a close request; without a listener Escape closes and focus returns to the opener', async ({ page }) => {
  await mount(page, 'domus', 'light');
  await page.evaluate(() => {
    const d = document.querySelector('sw-app')!.shadowRoot!.querySelector('#one-dlg')!;
    (window as unknown as { __refuse: boolean }).__refuse = true;
    (window as unknown as { __asked: number }).__asked = 0;
    d.addEventListener('beforeclose', (e) => {
      (window as unknown as { __asked: number }).__asked++;
      if ((window as unknown as { __refuse: boolean }).__refuse) e.preventDefault();
    });
  });
  await page.locator('#one-open').click();
  await expect.poll(() => isOpen(page, 'one-dlg')).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await isOpen(page, 'one-dlg')).toBe(true);
  await page.locator('#one-dlg sw-button[icon="close"]').click();
  await page.waitForTimeout(100);
  expect(await isOpen(page, 'one-dlg')).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(2);
  await page.evaluate(() => ((window as unknown as { __refuse: boolean }).__refuse = false));
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page, 'one-dlg')).toBe(false);
  await expect.poll(() => page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return (a as HTMLElement | null)?.id ?? '';
  })).toBe('one-open');
});

test('English (left to right): the drawer still opens from the inline start - the left edge', async ({ page }) => {
  await mount(page, 'domus', 'light', 'en');
  const dir = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
  test.skip(dir !== 'ltr', 'this build does not switch the page direction from the address');
  await page.locator('#one-drawer').click();
  await expect.poll(() => isOpen(page, 'one-drw')).toBe(true);
  await page.waitForTimeout(150);
  const p = await probe(page, 'one-drw', 'dialog.panel');
  if (p.vw >= 768) expect(Math.abs(p.l) <= 1 && Math.abs(p.w - 480) <= 1, JSON.stringify(p)).toBe(true);
});
