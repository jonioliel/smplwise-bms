// Dev helper: dump contrast results and clip regions of a board. node inspect.mjs contrast | clip <board> <selectorOrY> <h> <out>
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(resolve(here, '../../../../frontend/node_modules/'));
const { chromium } = req('playwright');
const [mode, board, y, h, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(pathToFileURL(join(here, 'boards', board || 'foundations-color.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
if (mode === 'contrast') {
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-pair]')].map((el) => {
    const scheme = el.closest('.scheme-light') ? 'light' : 'dark';
    return `${scheme}\t${el.querySelector('.lbl').textContent}\t${el.querySelector('.val').textContent}`;
  }));
  console.log(rows.join('\n'));
} else {
  await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: +y, width: 1440, height: +h } });
  console.log('clipped', out);
}
await browser.close();
