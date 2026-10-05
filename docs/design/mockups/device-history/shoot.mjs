// Playwright screenshots of the DEVHIST mockups (static files, file://, Chromium). Run from the repo root:
//   node docs/design/mockups/device-history/shoot.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const candidates = [path.join(repo, 'frontend', 'package.json'), path.join(process.env.SW_MAIN_CHECKOUT || 'C:/cloude/smplwisebms', 'frontend', 'package.json')];
const pw = candidates.find((p) => { try { createRequire(p).resolve('playwright'); return true; } catch { return false; } });
if (!pw) throw new Error('playwright not found');
const { chromium } = createRequire(pw)('playwright');
const W = { desktop: 1440, tablet: 820, phone: 390 };
const SCREENS = { press: 'desktop', 'press-phone': 'phone', 'desk-activity': 'desktop', 'desk-filters': 'desktop', 'desk-schedules': 'desktop', 'desk-editor': 'desktop', 'phone-activity': 'phone', 'phone-filters': 'phone', 'phone-schedules': 'phone', 'phone-editor': 'phone', states: 'desktop', 'states-sched': 'desktop', variants: 'desktop', domains: 'desktop' };
const EXTRA = [['desk-activity', 'dark', 'classic'], ['desk-activity', 'light', 'bubble'], ['desk-schedules', 'dark', 'domus'], ['phone-activity', 'dark', 'bubble'], ['variants', 'dark', 'classic'], ['phone-schedules', 'dark', 'classic'], ['desk-editor', 'light', 'domus'], ['variants', 'light', 'bubble']];
const jobs = Object.entries(SCREENS).map(([s, d]) => [s, d, 'light', 'classic']).concat(EXTRA.map(([s, t, k]) => [s, SCREENS[s], t, k]));
const out = path.join(here, 'screens'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(); const errors = [];
for (const [s, d, t, k] of jobs) {
  const page = await browser.newPage({ viewport: { width: W[d] + 40, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${s}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`${s}: ${m.text()}`); });
  await page.goto(pathToFileURL(path.join(here, 'gallery.html')).href + `#s=${s}&d=${d}&t=${t}&k=${k}`);
  await page.waitForSelector('#frame'); await page.addStyleTag({ content: '#bar{display:none}' });
  await page.locator('#frame').screenshot({ path: path.join(out, `${s}-${t}-${k}.png`) });
  await page.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS', errors); process.exit(1); } else console.log('ok', jobs.length);
