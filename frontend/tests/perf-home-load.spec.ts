import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// PERF-HOME-DEVICES-2342 (docs/changes/PERF-HOME-DEVICES-2342.md): a navigation-timing probe of the home screen and the devices screens
// on the built preview (demo data, no backend). Each address is opened cold in a fresh context; the spec records the navigation timing,
// when the shell said it is ready (`sw-app[data-shell-ready]`), how much JavaScript the page fetched, and how many GETs went to the API
// (and how many of those repeated an address already asked). It asserts only that the screen's element is there and upgraded - the
// lazy screen chunks must never leave a route blank; the numbers are written to SW_PERF_OUT (default test-results/perf-home-load.json).
const ROUTES = [
  { name: 'home (/)', url: '/', tag: 'devices-building' },
  { name: '#/devices/building', url: '/#/devices/building', tag: 'devices-building' },
  { name: '#/devices/areas/lobby', url: '/#/devices/areas/lobby', tag: 'devices-area' },
  { name: '#/devices/synoptic', url: '/#/devices/synoptic', tag: 'devices-synoptic' },
  { name: '#/live (another area, lazy)', url: '/#/live', tag: 'live-overview' },
];
const OUT = process.env.SW_PERF_OUT || path.join('test-results', 'perf-home-load.json');

async function probe(page: Page, url: string, tag: string) {
  const api: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' && /\/api\/v1\//.test(r.url())) api.push(r.url());
  });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('sw-app[data-shell-ready]', { timeout: 30_000 });
  const readyMs = Date.now() - t0;
  // the route's screen element is in the shell and its definition arrived (a lazy chunk included)
  await expect.poll(() => page.evaluate((t) => {
    const app = document.querySelector('sw-app');
    const el = app?.shadowRoot?.querySelector(t);
    return !!el && !!customElements.get(t);
  }, tag), { timeout: 15_000 }).toBe(true);
  const upgradedMs = Date.now() - t0;
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = res.filter((r) => /\.js(\?|$)/.test(r.name));
    return {
      responseEnd: nav ? Math.round(nav.responseEnd) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEvent: nav ? Math.round(nav.loadEventEnd) : null,
      jsRequests: js.length,
      jsTransferKB: Math.round(js.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) / 1024),
      jsDecodedKB: Math.round(js.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
    };
  });
  const dup = api.length - new Set(api).size;
  return { ...m, shellReadyMs: readyMs, screenUpgradedMs: upgradedMs, apiGets: api.length, apiDuplicateGets: dup };
}

test.describe('home and devices screens: load timing', () => {
  test.describe.configure({ mode: 'serial' });
  const rows: Record<string, unknown>[] = [];
  for (const r of ROUTES) {
    test(`cold load ${r.name}`, async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      try {
        const row = { route: r.name, ...(await probe(page, r.url, r.tag)) };
        rows.push(row);
        console.log(`PERF ${JSON.stringify(row)}`);
      } finally {
        await ctx.close();
      }
    });
  }
  test.afterAll(() => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
  });
});
