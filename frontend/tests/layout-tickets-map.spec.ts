import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installTicketsMock, url } from './tickets-mocks';
import { drawerScrollers } from './tickets-scrollers';
import { installMapMock, ATTACHED, GONE, T_MAP, F0, type MapMockOptions } from './tickets-map-mocks';

// TKMAPSPEC: the layout guard (tests/layout-guard.ts) over the TKMAP1 map chip in the request drawer's Overview tab and over its picker
// (the "בחירת רכיב מהמפה" dialog) against the MOCKED backend - every skin x light / dark x widths 320-1440 (the drawer on a desktop, the
// full sheet below 768 px). FAILS on escape / overflow / clipped findings, on page errors, and on the one-scroll-per-tab rule (IA §4.1,
// tests/tickets-scrollers.ts): with the chip or the picker open the drawer still has exactly ONE scroll container (`div.body`), and the
// chip's own section adds none. The picker's inner element list (a bounded scroller inside its modal dialog) is reported, not failed.
// The 44 px rule is reported.
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-map.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.chip, .rc, .seg, .banner, .statebox, .blk, .sentence, .msg, .bubble, .card, .qc, .stepper, .step, .doc';
const L = 'sw-app tickets-list ticket-detail';
const CHIP = `${L} ticket-map-element`;

interface Screen {
  name: string;
  mock: MapMockOptions;
  wait: string;
  prep?: (p: Page) => Promise<void>;
  /** the picker dialog is open (its own bounded list is reported, not failed) */
  picker?: boolean;
}
const openPicker = async (p: Page) => {
  await p.locator(`${CHIP} [data-map-pick]`).click();
  await p.waitForSelector(`${CHIP} ticket-map-picker [data-map-stage]`, { timeout: 20_000 });
};
const SCREENS: Screen[] = [
  { name: 'chip-empty', mock: {}, wait: `${CHIP} [data-map-element="none"]` },
  { name: 'chip-attached', mock: { state: { [T_MAP]: ATTACHED } }, wait: `${CHIP} [data-map-element="present"]` },
  { name: 'chip-preview', mock: { state: { [T_MAP]: ATTACHED } }, wait: `${CHIP} [data-map-element="present"]`,
    prep: async (p) => { await p.locator(`${CHIP} [data-map-preview]`).click(); await p.waitForSelector(`${CHIP} [data-map-preview-image] img`); await p.waitForTimeout(200); } },
  { name: 'chip-gone', mock: { state: { [T_MAP]: GONE } }, wait: `${CHIP} [data-map-element="gone"]` },
  { name: 'picker-open', mock: {}, wait: `${CHIP} [data-map-element="none"]`, prep: openPicker, picker: true },
  { name: 'picker-chosen', mock: {}, wait: `${CHIP} [data-map-element="none"]`, picker: true,
    prep: async (p) => { await openPicker(p); await p.locator(`${CHIP} ticket-map-picker [data-pick-item]`).first().click(); await p.waitForSelector(`${CHIP} ticket-map-picker [data-map-chosen]`); } },
  { name: 'picker-noplan', mock: {}, wait: `${CHIP} [data-map-element="none"]`, picker: true,
    prep: async (p) => { await openPicker(p); await p.locator(`${CHIP} ticket-map-picker [data-map-floor]`).selectOption(F0); await p.waitForSelector(`${CHIP} ticket-map-picker [data-map-noplan]`); } },
];

/** scroll containers inside the chip's own section (the picker dialog excluded) and, separately, inside the picker */
async function chipScrollers(page: Page): Promise<{ own: string[]; picker: string[] }> {
  return page.evaluate(() => {
    const find = (root: ParentNode, sel: string): Element | null => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.matches(sel)) return el;
        if (el.shadowRoot) {
          const f = find(el.shadowRoot, sel);
          if (f) return f;
        }
      }
      return null;
    };
    const chip = find(document, 'ticket-map-element') as HTMLElement | null;
    const scrolls = (e: Element) => {
      const cs = getComputedStyle(e);
      return /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX);
    };
    const collect = (root: ParentNode, skip: string): string[] => {
      const out: string[] = [];
      const walk = (n: ParentNode) => {
        for (const e of Array.from(n.children)) {
          if (skip && e.matches(skip)) continue;
          if (scrolls(e)) out.push(`${e.tagName.toLowerCase()}.${(e as HTMLElement).className || ''}`.trim());
          if (e.shadowRoot) walk(e.shadowRoot);
          walk(e);
        }
      };
      walk(root);
      return out;
    };
    const sec = chip?.shadowRoot;
    const pk = sec ? (sec.querySelector('ticket-map-picker') as HTMLElement | null) : null;
    return { own: sec ? collect(sec, 'ticket-map-picker') : ['(no chip)'], picker: pk?.shadowRoot ? collect(pk.shadowRoot, '') : [] };
  });
}

/** the picker dialog's box against the viewport, and whether its "צרף לבקשה" button is reachable (inside the box and the viewport) */
async function pickerBox(page: Page): Promise<{ l: number; t: number; r: number; b: number; vw: number; vh: number; saveOut: boolean } | null> {
  return page.evaluate(() => {
    const find = (root: ParentNode, sel: string): Element | null => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.matches(sel)) return el;
        if (el.shadowRoot) {
          const f = find(el.shadowRoot, sel);
          if (f) return f;
        }
      }
      return null;
    };
    const pk = find(document, 'ticket-map-picker');
    const dlg = pk?.shadowRoot?.querySelector('sw-dialog');
    const box = dlg?.shadowRoot?.querySelector('.box');
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const save = pk?.shadowRoot?.querySelector('[data-map-save]')?.getBoundingClientRect();
    const saveOut = !save || save.left < r.left - 1 || save.right > r.right + 1 || save.bottom > Math.min(r.bottom, innerHeight) + 1 || save.top < Math.max(r.top, 0) - 1;
    return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, saveOut };
  });
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('tickets map chip and picker layout guard', () => {
  test.describe.configure({ timeout: 60 * 60_000 });
  for (const skin of SKIN_IDS) {
    test(`the chip and the picker at every width and theme [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      const targets: Finding[] = [];
      const scrollFindings: string[] = [];
      const pickerScrollers = new Set<string>();
      let runs = 0;
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await installTicketsMock(page, { persona: 'admin' });
          await installMapMock(page, s.mock);
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url(`/tickets/all?t=${T_MAP}`, skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const sc = await drawerScrollers(page);
            if (sc.length !== 1 || sc[0] !== 'div.body') scrollFindings.push(`${s.name} ${skin} ${theme} ${w}: drawer scroll containers [${sc.join(', ')}]`);
            const own = await chipScrollers(page);
            if (own.own.length) scrollFindings.push(`${s.name} ${skin} ${theme} ${w}: the chip adds scroll containers [${own.own.join(', ')}]`);
            for (const x of own.picker) pickerScrollers.add(x);
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'tickets-list' });
            // the picker's modal overlay (`div.backdrop`) is a viewport-fixed layer that lives inside the Overview panel's DOM: the guard's
            // escape rule has no exemption for a fixed element that is itself the descendant, so it is not a finding (the dialog box is
            // checked against the viewport below)
            for (const f of found) {
              if (f.cls === 'escape' && f.el.startsWith('div.backdrop')) continue;
              (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
            }
            if (s.picker) {
              const box = await pickerBox(page);
              if (!box) scrollFindings.push(`${s.name} ${skin} ${theme} ${w}: the picker dialog box was not found`);
              else if (box.l < -1 || box.t < -1 || box.r > box.vw + 1 || box.b > box.vh + 1 || box.saveOut) {
                results.push({ cls: 'escape', el: 'sw-dialog .box', detail: `the picker dialog leaves the viewport (${JSON.stringify(box)})`, ctx: `${s.name} ${skin} ${theme} ${w}` });
              }
            }
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`tickets map layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), scroll findings ${scrollFindings.length}, page errors ${errors.length}`);
      console.log(`  picker inner scrollers (reported): ${[...pickerScrollers].join(' | ') || 'none'}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(scrollFindings, 'ONE scroll per tab').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
