import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { installGeneratorMock } from './generator-mocks';
import { installTemperature, units } from './temperature-mocks';
import { installBubbleMock, AREA_PERMS } from './bubble-mocks';
import { installTicketsMock } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';

// NOSCROLL-1366-2437 (owner rule 2026-10-24: a control screen never scrolls; design audit round 30, 2026-11-12, finding #5). The audit
// measured at 1366x768 seven control screens whose page (the shell's <main>) scrolled, two multimedia screens whose screen element
// scrolled, and four screens that put ALL their content in one inner panel that scrolled (the panel covers most of the viewport, so for
// the operator it is the page scrolling). This guard opens each of them at 1366x768 and 1440x900, in every skin under test (light) and
// in classic dark, and asserts:
//   - the document, the shell's <main>, the screen's wrapper and the screen element do not scroll (scrollHeight <= clientHeight + 1);
//   - no element inside the screen (shadow roots pierced) that covers >= 55 % of the viewport scrolls vertically (the audit's own
//     "page-sized scroller" rule). A list box that covers less than that (a table card, a log) may scroll on its own.
// Data: the audit's data sets - demo fixtures (every /api/v1 call aborted) and the existing mock layers (bubble area, generator,
// temperature, tickets, board). Worst case: the board with every closed request shown and the tree on.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-noscroll-1366.spec.ts --project=desktop
// NOSCROLL_LOG=1 prints every measurement; NOSCROLL_QUICK=1 measures classic light only; NOSCROLL_SHOTS=<dir> saves a screenshot of every case.
// docs/changes/NOSCROLL-1366-2437.md has the before / after table.

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;
const SHOTS = process.env.NOSCROLL_SHOTS ?? '';

type Mock = 'demo' | 'bubble' | 'generator' | 'temperature' | 'tickets' | 'board';
interface Case {
  id: string;
  hash: string;
  mock: Mock;
  /** the screen element to wait for (inside sw-app) */
  ready: string;
}
export const CASES: Case[] = [
  // the seven page scrollers of the audit
  { id: 'camera', hash: '/live/cameras/cam-4', mock: 'demo', ready: 'live-camera' },
  { id: 'generator', hash: '/infra/generator/live', mock: 'generator', ready: 'gen-live-page' },
  { id: 'area', hash: '/devices/areas/living', mock: 'bubble', ready: 'devices-area' },
  { id: 'health', hash: '/investigate/health', mock: 'demo', ready: 'system-devices' },
  { id: 'alarm', hash: '/security/alarm', mock: 'demo', ready: 'security-alarm' },
  { id: 'live', hash: '/live', mock: 'demo', ready: 'live-overview sw-kpi' },
  { id: 'temperature', hash: '/infra/temperature', mock: 'temperature', ready: 'infra-temperature' },
  // the two multimedia screens that scrolled their own element
  { id: 'mm-screens', hash: '/multimedia/screens', mock: 'demo', ready: 'multimedia-screens' },
  { id: 'mm-groups', hash: '/multimedia/groups', mock: 'demo', ready: 'multimedia-groups' },
  // the four screens that scrolled all their content in one panel
  { id: 'mm-players', hash: '/multimedia/players', mock: 'demo', ready: 'multimedia-players' },
  { id: 'tickets-mine', hash: '/tickets/mine', mock: 'tickets', ready: 'tickets-list ticket-card:not([skeleton])' },
  { id: 'tickets-board', hash: '/tickets/board', mock: 'board', ready: 'tickets-board ticket-card:not([skeleton])' },
  { id: 'wk-devices', hash: '/wiskey/devices', mock: 'demo', ready: 'wiskey-stations' },
];

async function open(page: Page, c: Case, skin: string, scheme: string) {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (c.mock === 'demo') await page.route('**/api/v1/**', (route) => route.abort());
  else if (c.mock === 'bubble') await installBubbleMock(page, { perms: [...AREA_PERMS, 'system.configure'] });
  else if (c.mock === 'generator') await installGeneratorMock(page);
  else if (c.mock === 'temperature') await installTemperature(page, units());
  else if (c.mock === 'tickets') await installTicketsMock(page);
  else await installBoardMock(page, { board: { closed_strip: 'all', board_floors: 'chips_tree' } });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#${c.hash}`);
  const booted = await page.waitForSelector('sw-app', { timeout: 60_000 }).then(() => true, () => false);
  if (!booted) {
    test.info().annotations.push({ type: 'dev-boot-reload', description: `${c.id} ${skin}/${scheme}: <sw-app> did not boot in 60 s; reloaded once` });
    await page.reload();
    await page.waitForSelector('sw-app', { timeout: 60_000 });
  }
  await page.locator(`sw-app ${c.ready}`).first().waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** The vertical overflow of the document, the shell's main, the screen's wrapper, the screen, and the biggest page-sized panel inside it. */
export const overflow = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS' && el.tagName !== 'SYSTEM-NAV') : null;
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const se = document.scrollingElement;
    const vw = innerWidth;
    const vh = innerHeight;
    let panel = 0;
    let panelTag = '';
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        const cs = getComputedStyle(el);
        if (!/(auto|scroll)/.test(cs.overflowY)) continue;
        const o = el.scrollHeight - el.clientHeight;
        if (o <= 8) continue;
        const r = el.getBoundingClientRect();
        const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (area / (vw * vh) < 0.55) continue;
        if (o > panel) {
          panel = o;
          const host = (el.getRootNode() as ShadowRoot).host?.localName ?? '';
          panelTag = `${host}|${el.localName}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;
        }
      }
    };
    if (screen) {
      walk(screen.shadowRoot ?? screen);
    }
    return { doc: over(se), main: over(main), wrap: screen && screen.parentElement !== main ? over(screen.parentElement) : 0, screen: over(screen), panel, panelTag, tag: screen?.tagName.toLowerCase() ?? '' };
  });

const worstOf = (o: Awaited<ReturnType<typeof overflow>>) => Math.max(o.doc, o.main, o.wrap, o.screen, o.panel);

test.describe('control screens fit 1366x768 and 1440x900 (NOSCROLL-1366-2437)', () => {
  for (const vp of VIEWPORTS) {
    for (const c of CASES) {
      test(`${c.id} at ${vp.name}: no page or page-sized panel scroll`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'the viewports are set by the test itself');
        test.setTimeout(240_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const bad: string[] = [];
        // NOSCROLL_QUICK=1 (iteration on the workstation): classic light only
        const runs: [string, string][] = process.env.NOSCROLL_QUICK ? [['classic', 'light']] : [...SKINS_UNDER_TEST.map((s) => [s, 'light'] as [string, string]), ['classic', 'dark']];
        for (const [skin, scheme] of runs) {
          await open(page, c, skin, scheme);
          // screens size their grids after the first draw (ResizeObserver, async data): let the overflow settle
          let o = await overflow(page);
          await expect.poll(async () => { o = await overflow(page); return worstOf(o); }, { timeout: 6_000 }).toBeLessThanOrEqual(1).catch(() => undefined);
          const worst = worstOf(o);
          if (process.env.NOSCROLL_LOG) console.log(`${c.id} ${vp.name} ${skin} ${scheme}: doc ${o.doc} main ${o.main} wrap ${o.wrap} screen ${o.screen} panel ${o.panel} ${o.panelTag} (${o.tag})`);
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${c.id}-${skin}-${scheme}-${vp.name}.png`) });
          if (worst > 1) bad.push(`${skin}/${scheme}: ${worst}px (doc ${o.doc}, main ${o.main}, wrap ${o.wrap}, ${o.tag} ${o.screen}, panel ${o.panelTag} ${o.panel})`);
        }
        expect(bad, `vertical overflow of ${c.id} at ${vp.name}`).toEqual([]);
      });
    }
  }
});
