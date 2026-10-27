import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { installElectricityMock } from './electricity-mocks';
import { installTicketsMock } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';
import { mockWall } from './wall-count-mock';

// NOSCROLL-297 (owner rule 2026-10-24: control screens never scroll on a desktop; they fit the viewport). The design audit of 2026-10-27
// found four desktop control screens that still scrolled the page: the live overview, the camera wall, the electricity meters and the
// service management screens (the "mine" / "all" lists and the manager board). This guard opens each of them at 1440x900 and 1920x1080,
// in every skin under test, light and dark, and asserts that nothing scrolls the page: the document, the shell's <main>, the screen's
// wrapper and the screen element itself. A list region inside the screen (an event list, the meters table, the cards) may scroll on its own.
// Data: the demo fixtures (every /api/v1 call aborted) for the live overview and the demo wall; the existing mock layers for the wall
// with 24 cameras, the meters and the tickets. Needs the Vite DEV server or a preview build (the mocks are page routes).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-noscroll-297.spec.ts --project=desktop
// NOSCROLL_LOG=1 prints every measurement; NOSCROLL_SHOTS=<dir> saves a screenshot of every case (outside docs/).
// docs/changes/NOSCROLL-297.md has the before / after table.

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;
const SCHEMES = ['light', 'dark'] as const;
const SHOTS = process.env.NOSCROLL_SHOTS ?? '';

type Mock = 'demo' | 'wall' | 'elec' | 'tickets' | 'board';
interface Case {
  id: string;
  hash: string;
  mock: Mock;
  /** what to wait for (inside sw-app) before measuring */
  ready: string;
  init?: Record<string, string>;
}
const CASES: Case[] = [
  { id: 'live-overview', hash: '/live', mock: 'demo', ready: 'live-overview sw-kpi' },
  { id: 'wall-demo', hash: '/live/wall', mock: 'demo', ready: 'live-wall sw-camera-tile' },
  { id: 'wall-9', hash: '/live/wall', mock: 'wall', ready: 'live-wall sw-camera-tile[data-cam]', init: { 'sw.wall.count': '9' } },
  { id: 'wall-all', hash: '/live/wall', mock: 'wall', ready: 'live-wall sw-camera-tile[data-cam]', init: { 'sw.wall.count': 'all' } },
  { id: 'electricity-meters', hash: '/infra/electricity/meters', mock: 'elec', ready: 'elec-meters-page [data-elec="meters"][data-state="ready"]' },
  { id: 'tickets-mine', hash: '/tickets/mine', mock: 'tickets', ready: 'tickets-list ticket-card:not([skeleton])' },
  { id: 'tickets-all', hash: '/tickets/all', mock: 'tickets', ready: 'tickets-list ticket-card:not([skeleton])' },
  { id: 'tickets-board', hash: '/tickets/board', mock: 'board', ready: 'tickets-board ticket-card:not([skeleton])' },
];

async function open(page: Page, c: Case, skin: string, scheme: string) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (c.mock === 'demo') await page.route('**/api/v1/**', (route) => route.abort());
  else if (c.mock === 'wall') await mockWall(page);
  else if (c.mock === 'elec') await installElectricityMock(page);
  else if (c.mock === 'tickets') await installTicketsMock(page);
  else await installBoardMock(page);
  await page.addInitScript((kv) => {
    try {
      localStorage.clear();
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  }, c.init ?? {});
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#${c.hash}`);
  await page.waitForSelector('sw-app');
  await page.locator(`sw-app ${c.ready}`).first().waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** The vertical overflow of everything that could scroll the page: the document, the shell's main area, the screen's wrapper and the screen
 * (the same probe as evidence-noscroll-295). */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS') : null;
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const se = document.scrollingElement;
    return { doc: over(se), main: over(main), wrap: screen && screen.parentElement !== main ? over(screen.parentElement) : 0, screen: over(screen), tag: screen?.tagName.toLowerCase() ?? '' };
  });

test.describe('desktop control screens fit the viewport (NOSCROLL-297)', () => {
  for (const vp of VIEWPORTS) {
    for (const c of CASES) {
      test(`${c.id} at ${vp.name}: no page scroll in any skin, light or dark`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const bad: string[] = [];
        for (const skin of SKINS_UNDER_TEST) {
          for (const scheme of SCHEMES) {
            await open(page, c, skin, scheme);
            // the wall sizes its tiles after the first draw (ResizeObserver): give the overflow a moment to settle
            let o = await overflow(page);
            await expect.poll(async () => { o = await overflow(page); return Math.max(o.doc, o.main, o.wrap, o.screen); }, { timeout: 5_000 }).toBeLessThanOrEqual(1).catch(() => undefined);
            const worst = Math.max(o.doc, o.main, o.wrap, o.screen);
            if (process.env.NOSCROLL_LOG) console.log(`${c.id} ${vp.name} ${skin} ${scheme}: doc ${o.doc} main ${o.main} wrap ${o.wrap} screen ${o.screen} (${o.tag})`);
            if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${c.id}-${skin}-${scheme}-${vp.name}.png`) });
            if (worst > 1) bad.push(`${skin}/${scheme}: ${worst}px (doc ${o.doc}, main ${o.main}, wrap ${o.wrap}, ${o.tag} ${o.screen})`);
          }
        }
        expect(bad, `vertical page overflow of ${c.id} at ${vp.name}`).toEqual([]);
      });
    }
  }
});
