import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lobbyFeed, serveFeed, settled, tvUrl } from './notice-tv-fixtures';

// CR-NOTICE106: the PRODUCT TV page against the owner-APPROVED mock-up, pixel by pixel. The mock-up (docs/design/mockups/notice-106/
// tv.html) is opened from disk with its fixed clock and the same switches; the product page gets a feed that carries the mock-up's own
// lobby data (tests/notice-tv-fixtures.ts). Both are screenshotted at the same viewport and compared in a canvas: a pixel counts as
// different when any channel differs by more than 24; the share of different pixels must stay under the bound below. The Hebrew
// date line is off on both sides (the mock-up hard-codes one string; the product computes it), the company logo too (the mock-up
// draws a fictional one), and the promo slides (not in this build).
//   npx playwright test tests/pixel-notice-tv-mock.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.resolve(HERE, '../../docs/design/mockups/notice-106/tv.html');
const OUT = path.resolve(HERE, '../test-results/notice-tv-pixel');
const MAX_SHARE = 0.005; // 0.5 % of the pixels

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'one pixel comparison, desktop Chromium'));

async function diff(page: Page, a: Buffer, b: Buffer): Promise<{ share: number; w: number; h: number; png: string }> {
  return page.evaluate(async ([pa, pb]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [ia, ib] = await Promise.all([load(pa), load(pb)]);
    const w = Math.min(ia.width, ib.width);
    const h = Math.min(ia.height, ib.height);
    const ca = document.createElement('canvas');
    ca.width = w; ca.height = h;
    const xa = ca.getContext('2d') as CanvasRenderingContext2D;
    xa.drawImage(ia, 0, 0);
    const da = xa.getImageData(0, 0, w, h).data;
    xa.clearRect(0, 0, w, h);
    xa.drawImage(ib, 0, 0);
    const db = xa.getImageData(0, 0, w, h);
    const out = xa.createImageData(w, h);
    let bad = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db.data[i]), Math.abs(da[i + 1] - db.data[i + 1]), Math.abs(da[i + 2] - db.data[i + 2]));
      const hit = d > 24;
      if (hit) bad++;
      out.data[i] = hit ? 255 : da[i] * 0.3 + 170; out.data[i + 1] = hit ? 0 : da[i + 1] * 0.3 + 170; out.data[i + 2] = hit ? 0 : da[i + 2] * 0.3 + 170; out.data[i + 3] = 255;
    }
    xa.putImageData(out, 0, 0);
    return { share: bad / (w * h), w, h, png: ca.toDataURL('image/png') };
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`] as const);
}

const CASES = [
  { name: 'lobby-t1-day-1920', w: 1920, h: 1080, mock: 'board=lobby&template=1&theme=day', product: { template: 1 as const, theme: 'day' as const } },
  { name: 'lobby-t1-night-1920', w: 1920, h: 1080, mock: 'board=lobby&template=1&theme=night', product: { template: 1 as const, theme: 'night' as const } },
  { name: 'lobby-t3-day-1920', w: 1920, h: 1080, mock: 'board=lobby&template=3&theme=day', product: { template: 3 as const, theme: 'day' as const } },
  { name: 'lobby-t1-portrait-night', w: 1080, h: 1920, mock: 'board=lobby&template=1&theme=night', product: { template: 1 as const, theme: 'night' as const } },
  { name: 'lobby-all-day-1920', w: 1920, h: 1080, mock: 'board=lobby&template=1&theme=day&mode=all', product: { template: 1 as const, theme: 'day' as const, mode: 'all' as const } },
];

for (const c of CASES) {
  test(`the product TV page draws the approved mock-up: ${c.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
    const mock = await ctx.newPage();
    await mock.goto('file://' + MOCK.replace(/\\/g, '/') + `?${c.mock}&clock=fixed&hebdate=0&company=0&promo=0`);
    await settled(mock);
    const a = await mock.screenshot();
    const page = await ctx.newPage();
    const base = (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
    // TVNOTICE2-297: the v4 mock-up's footer reads "updated <time> · <board name>" (the full wording); the default is now the preview wording
    await serveFeed(page, lobbyFeed({ updated: 'full', ...c.product, blocks: { clock: true, hebdate: false, welcome: true, weather: true, info: [], promo: false, news: true, company_logo: false } }));
    await page.goto(new URL(tvUrl(), base).toString());
    await settled(page);
    const b = await page.screenshot();
    const r = await diff(page, a, b);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${c.name}-mock.png`), a);
    fs.writeFileSync(path.join(OUT, `${c.name}-product.png`), b);
    fs.writeFileSync(path.join(OUT, `${c.name}-diff.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.appendFileSync(path.join(OUT, 'report.txt'), `${c.name}: ${(r.share * 100).toFixed(3)} % different (${r.w}x${r.h})\n`);
    expect(r.w).toBe(c.w);
    expect(r.share, `${c.name}: ${(r.share * 100).toFixed(3)} % of the pixels differ from the approved mock-up`).toBeLessThan(MAX_SHARE);
    await ctx.close();
  });
}
