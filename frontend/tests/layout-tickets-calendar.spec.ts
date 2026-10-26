import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installTicketsMock, url, type TicketsMockOptions } from './tickets-mocks';

// TKCAL: the layout guard (tests/layout-guard.ts) over the weekly calendar against the MOCKED backend - the week (and, below 768 px, the
// day list), an empty week, the open filter row, the open drawer, a long title - in every skin x light / dark x widths 320-1440. FAILS on
// escape / overflow / clipped findings and on page errors; the 44 px target rule is reported (the desktop touch dial is 32 px).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-tickets-calendar.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = '.skl, sw-icon, svg, sw-toggle, [role="switch"], .vh, input[type="file"]';
const BUBBLE = '.chip, .rc, .seg, .banner, .statebox, .pop, a.ev, .dbtn, .step';
const C = 'sw-app tickets-list tickets-calendar';
const NOW = '2026-10-13T10:42:00Z';

interface Screen {
  name: string;
  mock?: TicketsMockOptions;
  wait: string;
  prep?: (p: Page) => Promise<void>;
}
const SCREENS: Screen[] = [
  { name: 'week', wait: `${C} [data-cal]` },
  { name: 'next-week-empty', wait: `${C} [data-cal]`, prep: async (p) => p.locator(`${C} [data-cal-next]`).click() },
  { name: 'filter-row', wait: `${C} [data-cal]`, prep: async (p) => p.locator('sw-app tickets-list [data-filter-toggle]').click() },
  { name: 'drawer', wait: `${C} [data-cal]`, prep: async (p) => { await p.locator(`${C} [data-cal-event]`).first().click(); await p.waitForSelector('sw-app tickets-list ticket-detail[mode="drawer"] [data-ticket-detail]'); } },
  { name: 'empty', wait: 'sw-app tickets-list [data-tickets-state="empty"]', mock: { empty: true } },
  { name: 'error', wait: 'sw-app tickets-list [data-tickets-state="error"]', mock: { failList: true } },
];

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

test.describe('tickets calendar layout guard', () => {
  // A failure must never burn an hour of a gate: the sweep takes well under a minute per skin, every wait / click is bounded.
  // (The open drawer is waited for by its panel [data-ticket-detail]: the <ticket-detail> host is display: inline with a fixed-position
  // shadow panel, so the host itself has no box and is never "visible" - an unbounded wait on it hung each skin until the 1 h timeout.)
  test.describe.configure({ timeout: 4 * 60_000 });
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });
  for (const skin of SKIN_IDS) {
    test(`every calendar screen, width and theme [${skin}]`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => { try { sessionStorage.setItem('sw.tickets.list.calendar', '1'); } catch { /* about:blank has no storage */ } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const results: Finding[] = [];
      const targets: Finding[] = [];
      let runs = 0;
      for (const theme of THEMES) {
        for (const s of SCREENS) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await installTicketsMock(page, { schedule: true, ...(s.mock ?? {}) });
          await page.clock.setFixedTime(new Date(NOW));
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.goto('about:blank');
          await page.goto(url('/tickets/mine', skin, theme));
          await page.waitForSelector(s.wait, { timeout: 20_000 });
          await page.evaluate((v) => v && document.documentElement.style.setProperty('--sw-touch-desktop', v), skin === 'bubble' ? '' : '32px');
          if (s.prep) await s.prep(page);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            // the week / day switch follows a media query: measure only after the calendar re-rendered for this width
            await page.waitForFunction((phone) => {
              const deep = (root: Document | ShadowRoot, sel: string): Element | null => {
                const hit = root.querySelector(sel);
                if (hit) return hit;
                for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { const h = deep(e.shadowRoot, sel); if (h) return h; }
                return null;
              };
              const cal = deep(document, 'tickets-calendar')?.shadowRoot?.querySelector('[data-cal]');
              return !cal || cal.getAttribute('data-cal-mode') === (phone ? 'day' : 'week');
            }, w < 768, { timeout: 10_000 });
            await settle(page);
            await page.waitForTimeout(60);
            runs++;
            const found = await page.evaluate(inPageCheck, { ctx: `${s.name} ${skin} ${theme} ${w}`, bubble: BUBBLE, skip: SKIP, roots: [], within: 'tickets-list' });
            for (const f of found) (f.cls === 'target' || f.cls === 'floating' ? targets : results).push(f);
          }
        }
      }
      const { byCls, lines } = summarize(results);
      const t = summarize(targets);
      console.log(`tickets calendar layout [${skin}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), reported ${targets.length} (${JSON.stringify(t.byCls)}), page errors ${errors.length}`);
      for (const l of lines) console.log('  ' + l);
      for (const l of t.lines.slice(0, 25)) console.log('  (reported) ' + l);
      expect(errors, 'page errors').toEqual([]);
      expect(lines, 'layout findings').toEqual([]);
    });
  }
});
