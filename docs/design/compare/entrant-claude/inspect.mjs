// Dev helper. node inspect.mjs contrast [--skin=id]            → dump every computed contrast pair of the colour board
//                                                                 and save contrast-report-<skin>.json next to the tokens
//             node inspect.mjs clip <board> <y> <h> <out> [--skin=id]  → clip a region of a board to a PNG
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
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
  const pairs = await page.evaluate(() => [...document.querySelectorAll('[data-pair]')].map((el) => {
    const scheme = el.closest('.scheme-light') ? 'light' : 'dark';
    const [fg, bg] = el.getAttribute('data-pair').split('|');
    const val = el.querySelector('.val').textContent;
    const box = el.querySelector('.cc');
    return { scheme, label: el.querySelector('.lbl').textContent, fg, bg, fgComputed: box.style.color, bgComputed: box.style.background, ratio: +val.split(':')[0], target: +el.getAttribute('data-min') || 4.5, result: val.replace(/^[\d.]+:1 /, ''), pass: !/FAIL|3:1 only/.test(val) };
  }));
  const rows = pairs.map((p) => `${p.scheme}\t${p.label}\t${p.ratio.toFixed(2)}:1 ${p.result}`);
  console.log(rows.join('\n'));
  const bad = pairs.filter((p) => !p.pass);
  const min = Math.min(...pairs.map((p) => p.ratio));
  const report = { skin, generated: new Date().toISOString().slice(0, 10), pairs: pairs.length, failures: bad.length, minRatio: +min.toFixed(2), note: 'Computed by boards/foundations-color.html from the skin tokens; surfaces composited over the real canvas (worst case: the brightest bloom), L2 over L1. Targets: 4.5 text, 3 indicators.', rows: pairs };
  writeFileSync(join(here, `contrast-report-${skin}.json`), JSON.stringify(report, null, 2));
  console.log(`\n[${skin}] ${pairs.length} pairs · ${bad.length} below target · min ${min.toFixed(2)} → contrast-report-${skin}.json`);
} else {
  await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: +y, width: 1440, height: +h } });
  console.log('clipped', out);
}
await browser.close();
