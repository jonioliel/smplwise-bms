import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { TABLE_MIN } from '../src/screens/wiskey-stations-logic';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';

// CR-036 slice S6: the layout guard (tests/layout-guard.ts) over the native stations and doors screen against the MOCKED backend,
// in every skin the build has x light / dark x widths 320-1440, in the states of the screen: the cards, the list, the table (from
// 768 px), a station's drawer with its door settings open, the release confirmation, the announcement composer with its engine
// section open and - on a phone - the places sheet. It FAILS on escape / overflow / clipped: nothing leaves its card, no text is cut
// without an ellipsis, the page never scrolls sideways.
//
// The guard's `target` / `floating` classes are not asserted through the guard itself: a modal drawer and a dialog cover the page by
// design, and the 44 px rule of components this screen does not own (the drawer's and the dialog's close buttons, sw-button) is
// theirs. What IS asserted, in every state, is `ownTargets`: every control of this screen's own elements (wk-action-button,
// sw-view-switch, sw-place-tree, the chips, the rows, the search, the announcement composer) is at least 44 x 44 px in touch layouts
// (<= 1100 px) and at least the look dial (`--sw-touch-desktop`, 44 by default) on a desktop. The table is asserted too: from 820 px
// every table button must lie inside the visible table (a wide table scrolls inside its host and the guard would not flag it).
// One project (desktop) runs the sweep - it sets the viewport itself.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-wiskey-stations.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg';
const SCREEN = 'wiskey-stations';

/** Runs inside the page: this screen's own interactive elements that are smaller than the hit area. */
function ownTargets(args: { ctx: string }): string[] {
  const out: string[] = [];
  const min = innerWidth <= 1100 ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
  const mine = new Set(['WK-ACTION-BUTTON', 'WK-ANNOUNCE-DIALOG', 'SW-VIEW-SWITCH', 'SW-PLACE-TREE']);
  const INTER = 'button, a[href], input, select, textarea';
  const seen = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const walk = (root: ParentNode) => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el.matches(INTER) && !(el as HTMLButtonElement).disabled && seen(el)) {
        const r = el.getBoundingClientRect();
        if (r.width < min - 0.5 || r.height < min - 0.5) out.push(`${args.ctx}: ${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`);
      }
      if (mine.has(el.tagName) && el.shadowRoot) walk(el.shadowRoot);
    }
  };
  const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('wiskey-stations');
  if (host?.shadowRoot) walk(host.shadowRoot);
  return out;
}

/** Runs inside the page: the table's own buttons (the station, a door, answer) that lie even partly outside the table host's visible
 * width. A wide table scrolls inside its host and the layout guard does not call that a finding - but it hides what is at the end of
 * the row, and the buttons must not be there (the table keeps to the host by giving up columns: screens/wiskey-stations-logic.ts). */
function tableButtonsClipped(args: { ctx: string }): string[] {
  const out: string[] = [];
  const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('wiskey-stations')?.shadowRoot?.querySelector('sw-table') as HTMLElement | null;
  const root = host?.shadowRoot;
  if (!host || !root) return out;
  const box = host.getBoundingClientRect();
  for (const el of Array.from(root.querySelectorAll('wk-action-button'))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.left < box.left - 1 || r.right > box.right + 1) {
      const name = el.getAttribute('data-wk-door') ?? el.getAttribute('data-wk-open') ?? 'button';
      out.push(`${args.ctx}: ${name} ${Math.round(r.left)}..${Math.round(r.right)} outside the table ${Math.round(box.left)}..${Math.round(box.right)}`);
    }
  }
  return out;
}

async function settle(page: Page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(120);
}

test.describe('wiskey-stations layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.describe.configure({ timeout: 30 * 60_000 });

  test('cards, list, table, drawer, dialogs and the places sheet: skins x themes x widths', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installStationsMock(page, newMock());
    const results: Finding[] = [];
    const own: string[] = [];
    const cut: string[] = [];
    let runs = 0;
    const check = async (ctx: string, extraSkip = '') => {
      runs++;
      const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP + extraSkip, within: SCREEN, roots: [SCREEN] });
      results.push(...found.filter((f) => f.cls === 'escape' || f.cls === 'overflow' || f.cls === 'clipped'));
      own.push(...(await page.evaluate(ownTargets, { ctx })));
    };
    const click = async (sel: string) => {
      await page.locator(sel).first().click();
      await settle(page);
    };

    for (const skin of SKIN_IDS) {
      for (const theme of THEMES) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openStations(page, { skin, scheme: theme });
        await page.waitForSelector(`${SCREEN} [data-wk-station]`, { timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await settle(page);
          const ctx = `${skin} ${theme} ${w}`;
          const phone = w <= 767;
          // cards
          await click(`${SCREEN} sw-view-switch button[data-view="cards"]`);
          await check(`${ctx} cards`);
          // list
          await click(`${SCREEN} sw-view-switch button[data-view="list"]`);
          await check(`${ctx} list`);
          // table (a narrow window has none: the list does its job)
          if (w >= TABLE_MIN) {
            await click(`${SCREEN} sw-view-switch button[data-view="table"]`);
            await check(`${ctx} table`);
            cut.push(...(await page.evaluate(tableButtonsClipped, { ctx: `${ctx} table` })));
          } else {
            expect(await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).count(), `${ctx}: no table option below ${TABLE_MIN} px`).toBe(0);
          }
          await click(`${SCREEN} sw-view-switch button[data-view="cards"]`);
          // the station's drawer with the door settings open (cards lie under the modal: the drawer's own content is the subject)
          await click(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`);
          await click(`${SCREEN} sw-drawer [data-wk-settings-toggle]`);
          await page.waitForSelector(`${SCREEN} sw-drawer [data-wk-program="1"]`);
          await settle(page);
          await check(`${ctx} drawer`);
          // the release confirmation, inside the drawer
          await click(`${SCREEN} sw-drawer [data-wk-door="lobby/2"]`);
          await check(`${ctx} release`);
          await click(`${SCREEN} sw-drawer [data-wk-release-cancel]`);
          await page.keyboard.press('Escape');
          await settle(page);
          // the announcement composer, engine section open
          await click(`${SCREEN} [data-wk-announce]`);
          await click(`${SCREEN} wk-announce-dialog [data-wk-announce-more]`);
          await click(`${SCREEN} wk-announce-dialog [data-wk-phrase]`);
          await check(`${ctx} announce`);
          await page.keyboard.press('Escape');
          await settle(page);
          // the places sheet (a phone's replacement of the tree)
          if (phone) {
            await click(`${SCREEN} [data-wk-places-chip]`);
            await check(`${ctx} places`);
            await page.keyboard.press('Escape');
            await settle(page);
          }
        }
      }
    }
    const { byCls, lines } = summarize(results);
    console.log(`layout-wiskey-stations: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), own targets under the hit area ${own.length}, table buttons cut off ${cut.length}, page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    for (const l of [...new Set(own)].slice(0, 40)) console.log('  [own target] ' + l);
    for (const l of [...new Set(cut)].slice(0, 40)) console.log('  [table cut] ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
    expect([...new Set(own)], 'controls below the hit area').toEqual([]);
    expect([...new Set(cut)], 'table buttons outside the visible table').toEqual([]);
  });

  test('the states of the screen never scroll sideways: loading, empty, forbidden, a last-known copy', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    const states: [string, Partial<StationsMock>][] = [
      ['empty', { stations: [] }],
      ['forbidden', { stationsStatus: 403 }],
      ['stale', { feed: 'stale' }],
      ['not-installed', { feed: 'not_installed' }],
    ];
    for (const [name, over] of states) {
      await page.goto('about:blank');
      await installStationsMock(page, newMock(over));
      for (const w of QUICK ? [320, 1440] : [320, 390, 820, 1440]) {
        await page.setViewportSize({ width: w, height: height(w) });
        await openStations(page);
        await page.waitForSelector(`${SCREEN} [data-wk-stations]`, { timeout: 30_000 });
        await settle(page);
        const found = await page.evaluate(inPageCheck, { ctx: `${name} ${w}`, skip: SKIP, within: SCREEN, roots: [SCREEN] });
        results.push(...found.filter((f) => f.cls === 'escape' || f.cls === 'overflow' || f.cls === 'clipped'));
        expect(await page.evaluate(ownTargets, { ctx: `${name} ${w}` }), `${name} ${w}`).toEqual([]);
      }
    }
    const { lines } = summarize(results);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });

  test('the page never scrolls sideways at any width of the sweep, with a long station name and a long door name', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    const mock = newMock();
    mock.stations[1].name = 'לובי הכניסה הראשית של הבניין המערבי עם שם ארוך מאוד שלא נגמר';
    mock.stations[1].locks[0].name = 'דלת כניסה ראשית לאולם הקבלה הגדול';
    await installStationsMock(page, mock);
    for (const w of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: height(w) });
      await openStations(page);
      await page.waitForSelector(`${SCREEN} [data-wk-station]`, { timeout: 30_000 });
      await settle(page);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(over, `page overflow at ${w}`).toBeLessThanOrEqual(1);
      const found = await page.evaluate(inPageCheck, { ctx: `long ${w}`, skip: SKIP, within: SCREEN, roots: [SCREEN] });
      expect(summarize(found.filter((f) => f.cls === 'escape' || f.cls === 'overflow' || f.cls === 'clipped')).lines, `long names at ${w}`).toEqual([]);
    }
  });
});
