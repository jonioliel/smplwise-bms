import { test, expect, type Page } from '@playwright/test';

// NATIVE-SELECT-B-2480: `<sw-field flow>` moves a screen's select into the shared field WITHOUT changing how it draws. A screen's
// select, styled by the screen (a partial module skin, as many screens have) or not at all, must compute the same box and the same
// look inside `<sw-field flow>` as outside it - at rest, on focus and disabled - in every skin (the skins add '::slotted(select)'
// wells and halos to the field). The select stays a light-DOM child: its label, value and change event are the screen's.

const SKINS = ['classic', 'domus', 'crystal', 'bubble', 'tesla'] as const;
const PROPS = ['width', 'height', 'padding-top', 'padding-inline-start', 'border-top-width', 'border-top-color', 'border-top-left-radius',
  'background-color', 'color', 'font-size', 'font-weight', 'box-shadow', 'outline-style', 'min-height', 'box-sizing', 'cursor'];

async function mount(page: Page, skin: string) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?design=a&fit=off&skin=${skin}&scheme=light#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-field'), undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.setAttribute('data-flow-bed', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:var(--sw-surface);padding:20px';
    const root = host.attachShadow({ mode: 'open' });
    // a partial module skin (font, frame, radius - no height, no shadow, no focus rule) and a select with no skin at all
    root.innerHTML = `<style>.row { display: flex; gap: 12px; align-items: center; margin-block: 8px; }
      .inp { font: inherit; font-size: 15px; border: 1px solid #c33; border-radius: 6px; padding: 0 8px; background: #fffdf5; }</style>
      ${['inp', ''].map((cls) => `<div class="row" data-row="${cls || 'bare'}">
        <label>א <select class="${cls}" data-s="out"><option>אחת</option><option>שתיים ארוכה</option></select></label>
        <label>ב <sw-field flow><select class="${cls}" data-s="in"><option>אחת</option><option>שתיים ארוכה</option></select></sw-field></label>
        <select class="${cls}" data-s="out-dis" disabled><option>נעול</option></select>
        <sw-field flow><select class="${cls}" data-s="in-dis" disabled><option>נעול</option></select></sw-field></div>`).join('')}`;
    document.body.append(host);
  });
  await page.waitForTimeout(150);
}

const look = (page: Page, row: string, s: string) =>
  page.evaluate(({ row, s, props }) => {
    const root = document.querySelector('[data-flow-bed]')!.shadowRoot!;
    const el = root.querySelector(`[data-row="${row}"] [data-s="${s}"]`) as HTMLSelectElement;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  }, { row, s, props: PROPS });

for (const skin of SKINS) {
  test(`flow keeps the screen's select look - ${skin}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mount(page, skin);
    for (const row of ['inp', 'bare']) {
      expect(await look(page, row, 'in'), `${skin} ${row} at rest`).toEqual(await look(page, row, 'out'));
      expect(await look(page, row, 'in-dis'), `${skin} ${row} disabled`).toEqual(await look(page, row, 'out-dis'));
      const root = (s: string) => `[data-flow-bed] [data-row="${row}"] [data-s="${s}"]`;
      await page.locator(root('out')).focus();
      const outFocus = await look(page, row, 'out');
      await page.locator(root('in')).focus();
      expect(await look(page, row, 'in'), `${skin} ${row} focused`).toEqual(outFocus);
    }
  });
}

test('flow: the select stays the screen\'s control - label, value, change', async ({ page }) => {
  await mount(page, 'classic');
  const sel = page.locator('[data-flow-bed] [data-row="inp"] [data-s="in"]');
  const seen = await sel.evaluate((el) => {
    const events: string[] = [];
    el.addEventListener('change', (e) => events.push((e.target as HTMLSelectElement).value));
    (window as unknown as { __flowEvents: string[] }).__flowEvents = events;
    return { labels: (el as HTMLSelectElement).labels?.length ?? 0, parent: el.parentElement?.tagName };
  });
  expect(seen).toEqual({ labels: 1, parent: 'SW-FIELD' });
  await sel.selectOption({ index: 1 });
  expect(await page.evaluate(() => (window as unknown as { __flowEvents: string[] }).__flowEvents)).toEqual(['שתיים ארוכה']);
  const display = await page.evaluate(() => getComputedStyle(document.querySelector('[data-flow-bed]')!.shadowRoot!.querySelector('sw-field')!).display);
  expect(display).toBe('contents');
});
