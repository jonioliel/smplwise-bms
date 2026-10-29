import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// UXFIX-A11Y-295 (owner 2026-10-20, option A): the domus light blooms are softened so text drawn straight on a bloom centre reads at
// >= 4.5:1. BEFORE / AFTER evidence in one run: "before" lays the previous light canvas inline on <html> (the only value that changed),
// "after" is the skin as shipped. Domus light + dark, desktop + phone: a page title (sw-page, top right = the warm bloom in RTL) and the
// style guide's empty state. Measured: the rendered canvas pixel at each bloom centre and the background pixels around each text,
// against the computed text colours. Writes PNG + metrics.json to docs/design/evidence/UXFIX-A11Y-295/domus-blob/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-domus-blob-295.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/UXFIX-A11Y-295/domus-blob');
const BEFORE_LIGHT_CANVAS =
  'radial-gradient(1100px 680px at 90% -8%, rgba(255,168,60,.62), transparent 62%), radial-gradient(1300px 820px at 4% 108%, rgba(72,124,255,.58), transparent 64%), radial-gradient(820px 560px at 52% 50%, rgba(255,255,255,.42), transparent 70%), linear-gradient(170deg, #e4e9f4 0%, #d6dfef 55%, #dce1ee 100%)';

type PNGLike = { width: number; height: number; data: Buffer };
type PNGMod = { sync: { read: (b: Buffer) => PNGLike } } | null;
// integ/2100: `typeof PNG` here was the narrowed `null`, so tsc saw PNG as `never` in the test (TS2339) - a named type instead
let PNG: PNGMod = null;
try {
  PNG = (createRequire(import.meta.url)('playwright-core/lib/utilsBundle') as { PNG: PNGMod }).PNG;
} catch {
  PNG = null;
}

const lum = (c: number[]) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a: number[], b: number[]) => {
  const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
};
const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

async function open(page: Page, hash: string, scheme: 'light' | 'dark', variant: 'before' | 'after') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=domus&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  if (variant === 'before' && scheme === 'light') await page.evaluate((v) => document.documentElement.style.setProperty('--sw-canvas', v), BEFORE_LIGHT_CANVAS);
  await page.waitForTimeout(1500);
}

/** Text colour of an element vs the screenshot pixels just outside its box (start, end, above): the lowest ratio. */
async function textOnCanvas(page: Page, sel: string, png: PNGLike | null, dpr: number): Promise<{ text: string; color: number[]; min: number | null } | null> {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) return null;
  const info = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    return { color: getComputedStyle(el).color, text: (el.textContent ?? '').trim().slice(0, 40), r: { x: t.width ? t.x : r.x, y: t.width ? t.y : r.y, w: t.width || r.width, h: t.height || r.height } };
  });
  const color = rgb(info.color);
  if (!png) return { text: info.text, color, min: null };
  const px = (x: number, y: number) => {
    const X = Math.max(0, Math.min(png.width - 1, Math.round(x * dpr)));
    const Y = Math.max(0, Math.min(png.height - 1, Math.round(y * dpr)));
    const i = (Y * png.width + X) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  const { x, y, w, h } = info.r;
  const pts = [px(x - 4, y + h / 2), px(x + w + 4, y + h / 2), px(x + w / 2, y - 3), px(x + 2, y - 3), px(x + w - 2, y - 3)];
  return { text: info.text, color, min: Math.min(...pts.map((p) => ratio(color, p))) };
}

test.use({ locale: 'he-IL' });

test('domus blobs: before / after screenshots and measured contrast of a page title and an empty state', async ({ page }, info) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT, { recursive: true });
  const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
  const dpr = await page.evaluate(() => devicePixelRatio);
  const metrics: Record<string, unknown>[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    for (const variant of ['before', 'after'] as const) {
      // 1. a page title straight on the canvas (RTL: the start = the top right, the warm bloom)
      await open(page, '/explore/sites', scheme, variant);
      const shot1 = await page.screenshot({ path: path.join(OUT, `domus-${scheme}-${vp}-title-${variant}.png`) });
      const png1 = PNG ? PNG.sync.read(shot1) : null;
      const vw = page.viewportSize()!.width;
      const vh = page.viewportSize()!.height;
      // the rendered canvas at the two bloom centres (90% / top edge and 4% / bottom edge), against the muted text colours
      const tokens = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return Object.fromEntries(['--sw-text', '--sw-text-2', '--sw-text-3', '--sw-accent-text', '--sw-unknown-text', '--sw-success-text'].map((n) => [n, cs.getPropertyValue(n).trim()]));
      });
      const hex = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : rgb(h));
      const centres: Record<string, Record<string, number>> = {};
      // GATE-FIX-2270: the R5-MAPS-297 hero layout (5fad95ab0, 2b13910b3) puts the sites scene (sw-scene) over the lower half of the
      // phone screen, so the cool bloom point (4%, vh - 90) landed on the drawn ground (#3e7440), not on the canvas. The bloom centres are sampled from a shot with the screen's content
      // hidden (the canvas and the shell only); the title / subtitle contrasts below still use the real screenshot.
      let pngC = png1;
      if (png1) {
        await page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('explore-sites')?.setAttribute('style', 'visibility:hidden'));
        pngC = PNG ? PNG.sync.read(await page.screenshot()) : null;
        await page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('explore-sites')?.removeAttribute('style'));
      }
      if (pngC) {
        for (const [name, x, y] of [['warm bloom (90%, top)', vw * 0.9, 2], ['cool bloom (4%, bottom)', vw * 0.04, vp === 'phone' ? vh - 90 : vh - 2]] as const) {
          const X = Math.round(x * dpr);
          const Y = Math.round(y * dpr);
          const i = (Y * pngC.width + X) * 4;
          const bg = [pngC.data[i], pngC.data[i + 1], pngC.data[i + 2]];
          centres[name] = Object.fromEntries(Object.entries(tokens).map(([n, c]) => [n, Number(ratio(hex(c), bg).toFixed(2))]));
          centres[name].bg = Number(`0x${bg.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
        }
      }
      const title = await textOnCanvas(page, 'sw-app explore-sites sw-page h1', png1, dpr);
      const sub = await textOnCanvas(page, 'sw-app explore-sites sw-page .sub', png1, dpr);
      // 2. an empty state (the style guide's empty panel)
      await open(page, '/styleguide', scheme, variant);
      const panel = page.locator('styleguide-screen sw-state-panel[state="empty"]').first();
      await panel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const shot2 = await page.screenshot({ path: path.join(OUT, `domus-${scheme}-${vp}-empty-${variant}.png`) });
      const png2 = PNG ? PNG.sync.read(shot2) : null;
      const eh = await textOnCanvas(page, 'styleguide-screen sw-state-panel[state="empty"] h4', png2, dpr);
      const row = { scheme, viewport: vp, variant, bloomCentres: centres, pageTitle: title, pageSubtitle: sub, emptyHeading: eh };
      metrics.push(row);
      console.log(JSON.stringify(row));
    }
  }
  fs.writeFileSync(path.join(OUT, `metrics-${vp}.json`), JSON.stringify(metrics, null, 2));
  // the light AFTER bloom centres hold every muted text at >= 4.5:1 (the rendered pixels, not the token model)
  const after = metrics.find((m) => m.scheme === 'light' && m.variant === 'after') as { bloomCentres: Record<string, Record<string, number>> };
  if (PNG) for (const [name, row] of Object.entries(after.bloomCentres)) for (const [n, r] of Object.entries(row)) if (n !== 'bg') expect(r, `${name} ${n}`).toBeGreaterThanOrEqual(4.5);
});
