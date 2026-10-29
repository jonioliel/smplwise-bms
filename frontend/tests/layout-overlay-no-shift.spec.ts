import { test, expect, type Page } from '@playwright/test';
import { installBubbleMock } from './bubble-mocks';

// UIJANK-293 (owner 2026-10-20, 2.9.3): opening or closing an overlay never moves the page behind it. The owner saw the home screen jump
// down when the lights panel ("גופי תאורה במבנה") opened: the packed home layout fell back to its loosest level while the panel was open
// (the page behind grew), and the scroll lock dropped the page area's classic scrollbar (the content re-flowed sideways by its width).
// This guard covers the shared primitives (sw-drawer modal / side panel, sw-dialog, sw-sheet) mounted inside the shell's page area, and the
// home screen's own tiles panel at a height where the packing is tight. Classic scrollbars are kept on (no --hide-scrollbars) so a lost
// gutter shows up as a 15 px shift on Linux / Windows. Fake data only (the bubble mock layer).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-overlay-no-shift.spec.ts
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

interface Snap {
  mainTop: number;
  mainCW: number;
  rootTop: number;
  marks: number[][];
}

/** The page area's scroll offset and width, the document's, and the boxes of the probe marks / the home screen's blocks. */
async function snap(page: Page, sel: 'probe' | 'home'): Promise<Snap> {
  return page.evaluate((which) => {
    const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
    let els: Element[] = [];
    if (which === 'probe') els = Array.from(main.querySelectorAll('[data-shift-mark]'));
    else {
      const b = main.querySelector('devices-building')!.shadowRoot!;
      const page = b.querySelector('sw-page')!;
      els = [page.shadowRoot!.querySelector('header')!, ...Array.from(b.querySelectorAll('home-widgets, sw-kpi, section.fcard')).slice(0, 6)];
    }
    const r = (e: Element) => {
      const x = e.getBoundingClientRect();
      return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)];
    };
    return { mainTop: Math.round(main.scrollTop), mainCW: main.clientWidth, rootTop: Math.round(document.scrollingElement!.scrollTop), marks: els.map(r) };
  }, sel);
}

function expectSame(a: Snap, b: Snap, label: string) {
  expect(b.mainTop, `${label}: the page area's scroll offset`).toBe(a.mainTop);
  expect(b.rootTop, `${label}: the document's scroll offset`).toBe(a.rootTop);
  expect(b.mainCW, `${label}: the page area's width (a lost scrollbar gutter)`).toBe(a.mainCW);
  expect(b.marks.length, `${label}: the same blocks`).toBe(a.marks.length);
  a.marks.forEach((m, i) => {
    for (let k = 0; k < 4; k++) expect(Math.abs(b.marks[i][k] - m[k]), `${label}: block ${i} [left, top, width, height] ${m.join(',')} -> ${b.marks[i].join(',')}`).toBeLessThanOrEqual(1);
  });
}

/** SW_SHOTS_DIR: evidence screenshots of the home case (before / open / after), taken before the assertions so a red run shows them too. */
async function shot(page: Page, name: string) {
  const dir = process.env.SW_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

async function openHome(page: Page) {
  await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'] });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  await page.locator('sw-app devices-building sw-kpi[data-tile-kind="lights"]').waitFor();
  await page.waitForTimeout(600); // the packing steps (one per frame) settle
}

test.describe('overlays never move the page behind them', () => {
  test('shared primitives: sw-drawer (modal and side panel), sw-dialog, sw-sheet', async ({ page }) => {
    test.setTimeout(150_000);
    await openHome(page);
    // a tall probe page inside the shell's page area, scrolled part way, with one of each overlay
    await page.evaluate(() => {
      const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
      const host = document.createElement('div');
      host.id = 'shift-probe';
      host.style.flex = 'none';
      host.innerHTML = `<div data-shift-mark style="block-size:120px;background:#ccd">top</div>
        <div style="block-size:2200px"></div><div data-shift-mark style="block-size:60px;background:#dcc">bottom</div>
        <div style="position:relative;block-size:300px" data-shift-mark><sw-drawer id="side" heading="side"><p>side</p></sw-drawer></div>
        <sw-drawer id="modal" modal heading="modal"><p>modal body</p></sw-drawer>
        <sw-dialog id="dlg" heading="dialog"><p>dialog body</p></sw-dialog>
        ${customElements.get('sw-sheet') ? '<sw-sheet id="sheet" heading="sheet"><p>sheet body</p></sw-sheet>' : ''}`;
      main.querySelector('.screen')!.prepend(host);
      main.scrollTop = 700;
    });
    await page.waitForTimeout(300);
    const ids = await page.evaluate(() => ['modal', 'side', 'dlg', 'sheet'].filter((id) => document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${id}`)));
    expect(ids).toContain('modal');
    for (const id of ids) {
      const before = await snap(page, 'probe');
      expect(before.mainTop, 'the probe page scrolls').toBeGreaterThan(600);
      await page.evaluate((i) => {
        (document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${i}`) as HTMLElement & { open: boolean }).open = true;
      }, id);
      await page.waitForTimeout(450);
      expectSame(before, await snap(page, 'probe'), `${id} open`);
      await page.evaluate((i) => {
        (document.querySelector('sw-app')!.shadowRoot!.querySelector(`#${i}`) as HTMLElement & { open: boolean }).open = false;
      }, id);
      await page.waitForTimeout(450);
      expectSame(before, await snap(page, 'probe'), `${id} closed`);
    }
    // two modal drawers overlapping: the page area stays locked until the last one closes, then scrolls again
    await page.evaluate(() => {
      const root = document.querySelector('sw-app')!.shadowRoot!;
      const a = root.querySelector('#modal') as HTMLElement & { open: boolean };
      const b = document.createElement('sw-drawer') as HTMLElement & { open: boolean; modal: boolean };
      b.id = 'modal2';
      b.modal = true;
      root.querySelector('#shift-probe')!.append(b);
      a.open = true;
      b.open = true;
    });
    await page.waitForTimeout(300);
    const locked = await page.evaluate(() => document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!.style.overflow);
    expect(locked).toBe('hidden');
    await page.evaluate(() => ((document.querySelector('sw-app')!.shadowRoot!.querySelector('#modal') as HTMLElement & { open: boolean }).open = false));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!.style.overflow), 'still locked under the second drawer').toBe('hidden');
    await page.evaluate(() => ((document.querySelector('sw-app')!.shadowRoot!.querySelector('#modal2') as HTMLElement & { open: boolean }).open = false));
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => {
      const m = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
      return { overflow: m.style.overflow, gutter: m.style.getPropertyValue('scrollbar-gutter') };
    });
    expect(after, 'the inline values are restored by the last release').toEqual({ overflow: '', gutter: '' });
  });

  test('home: the lights panel opens and closes without moving or re-packing the page', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the packed home layout is a desktop-width layout');
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 640 }); // tight: the home screen packs its tiles (data-fit > 0)
    await openHome(page);
    const body = page.locator('sw-app devices-building .page-body');
    const fit = await body.getAttribute('data-fit');
    expect(Number(fit), 'the home screen is packed at this height').toBeGreaterThan(0);
    const before = await snap(page, 'home');
    await shot(page, 'home-lights-0-closed');
    await page.locator('sw-app devices-building sw-kpi[data-tile-kind="lights"] .hit').click();
    await expect(page.locator('sw-app devices-building devices-tiles-panel sw-drawer')).toHaveAttribute('open', '');
    await page.waitForTimeout(500);
    await expect(body, 'the packing is frozen while the panel is open').toHaveAttribute('data-fit', fit!);
    await shot(page, 'home-lights-1-open');
    expectSame(before, await snap(page, 'home'), 'lights panel open');
    await page.keyboard.press('Escape');
    await expect(page.locator('sw-app devices-building devices-tiles-panel sw-drawer')).not.toHaveAttribute('open', '');
    // POLISH-BOLD-297: a hovered tile lifts 2 px (--sw-hover-lift) - the pointer that clicked the tile is still over it; move it off so
    // the comparison sees the page, not the hover state
    await page.mouse.move(2, 2);
    await page.waitForTimeout(500);
    await expect(body).toHaveAttribute('data-fit', fit!);
    await shot(page, 'home-lights-2-closed');
    expectSame(before, await snap(page, 'home'), 'lights panel closed');
  });
});
