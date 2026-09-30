// Dev helper. node inspect.mjs contrast [--skin=id]            → dump every computed contrast pair of the colour board
//             node inspect.mjs clip <board> <y> <h> <out> [--skin=id]  → clip a region of a board to a PNG
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(resolve(here, '../../../../frontend/node_modules/'));
const { chromium } = req('playwright');
const args = process.argv.slice(2);
const skin = (args.find((a) => a.startsWith('--skin=')) || '--skin=domus').slice(7);
const [mode, board, y, h, out] = args.filter((a) => !a.startsWith('--'));
const dir = skin === 'domus' ? join(here, 'boards') : join(here, 'boards', skin);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(pathToFileURL(join(dir, board && mode !== 'contrast' ? board : 'foundations-color.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
if (mode === 'contrast') {
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-pair]')].map((el) => {
    const scheme = el.closest('.scheme-light') ? 'light' : 'dark';
    return `${scheme}\t${el.querySelector('.lbl').textContent}\t${el.querySelector('.val').textContent}`;
  }));
  console.log(rows.join('\n'));
  const bad = rows.filter((r) => /FAIL|3:1 only/.test(r));
  console.log(`\n[${skin}] ${rows.length} pairs · ${bad.length} below target`);
} else {
  await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: +y, width: 1440, height: +h } });
  console.log('clipped', out);
}
await browser.close();
