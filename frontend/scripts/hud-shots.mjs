#!/usr/bin/env node
// Before / after pictures of the HUD panels over the plan and the 3D canvas (docs/design/evidence/hud-opaque/, owner 2026-10-13): the REAL floor map of a
// building seeded into the devices fixture backend (tests/hud-live-seed.ts: three floors, the apartment plan, four named rooms, cameras, devices, a lighting
// circuit, a second level). Five shots per skin x scheme x width:
//   list2d   the 2D plan with the side list open (floor chip, level bar, quick floor buttons, circuit button, legend, zoom buttons, label pills)
//   strip3d  the 3D view of the ground floor with the floor strip, the level thumbnails, the pills and the view bar (the side list is closed again: it is a
//            persisted choice - pass --list3d open to keep it open there)
//   time3d   the realistic level with the time pill and its open picker (a menu: it opens over the circuit button, which stands below the pill)
//   overlap3d the same realistic level with the circuit button under the time pill. Before the layout fix (map/hud-layout.ts, tests/evidence-hud-layout-live.spec.ts,
//            docs/design/evidence/hud-layout/) the two stood on the same spot - both top / inline-end 12 px - and the opaque button hid the pill
//   walk3d   the eye-level walk with the walk bar (the bottom sheet on a phone)
//
//   SW_API_PORT=8381 python frontend/tests/fixtures/devices_fake_ha.py   (SW_PORT=8381 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni)
//   SW_API_PORT=8381 npx vite preview --outDir <the build to picture> --port 4382      (npm run build first; `vite build --outDir dist-after` for a second build)
//   node scripts/hud-shots.mjs --base http://127.0.0.1:4382 --control http://127.0.0.1:8382 --tag after --out ../docs/design/evidence/hud-opaque \
//        --skins classic,domus,crystal --schemes light,dark --widths 1440,390 --shots list2d,strip3d,time3d,overlap3d,walk3d
//
// The site is seeded once and its ids kept in --seed (default hud-seed.json next to the output) so the "before" and the "after" run picture the same building;
// pass --cleanup to remove it at the end. Pictures are PNG; the evidence folder keeps them as JPEG (the 3D scenes are ~1 MB each as PNG).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, request } from '@playwright/test';
import { seedHud, unseedHud } from '../tests/hud-live-seed.ts';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const base = arg('base', 'http://127.0.0.1:4173');
const control = arg('control', 'http://127.0.0.1:8100');
const tag = arg('tag', 'after');
const out = path.resolve(arg('out', 'hud-shots'));
const skins = arg('skins', 'classic,domus,crystal').split(',');
const schemes = arg('schemes', 'light,dark').split(',');
const widths = arg('widths', '1440,390').split(',').map(Number);
const shots = arg('shots', 'list2d,strip3d,time3d,overlap3d,walk3d').split(',');
const keepList3d = arg('list3d', 'closed') === 'open';
const seedFile = path.resolve(arg('seed', path.join(out, 'hud-seed.json')));
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await fn()) return;
    } catch {
      /* not yet */
    }
    await sleep(250);
  }
  throw new Error('timeout: ' + what);
}
const has = (loc, attr) => loc.evaluate((el, a) => el.hasAttribute(a), attr);
const jsClick = (loc) => loc.evaluate((el) => el.click()); // the realistic level keeps the main thread busy: a click through the page is not held up by actionability checks

let seed;
const api = await request.newContext({ baseURL: base });
if (fs.existsSync(seedFile)) seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
else {
  seed = await seedHud(api, control, new Date().toISOString().slice(0, 19));
  fs.writeFileSync(seedFile, JSON.stringify(seed, null, 1));
  console.log('seeded', JSON.stringify(seed));
}

const browser = await chromium.launch();
const MAP = 'explore-floor-map';
const name = (kind, skin, scheme, w) => path.join(out, `${tag}-${kind}-${skin}-${scheme}-${w}.png`);

async function open(page, skin, scheme, floor) {
  await page.goto('about:blank');
  await page.goto(`${base}/?design=a&skin=${skin}&scheme=${scheme}&look=performance:full#/explore/floors/${floor}`);
  await page.waitForSelector(`${MAP} [data-floorchip]`, { timeout: 40000 });
  await page.waitForSelector(`${MAP} sw-plan-canvas`, { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(900);
  const head = await page.locator(`${MAP} [data-head]`).innerText();
  if (head.includes('נתוני הדגמה')) throw new Error('the floor map is in demo mode: the backend is not answering');
}
async function to3d(page) {
  const host = page.locator(MAP);
  const toggle = host.locator('[data-view-3d]');
  await toggle.waitFor({ state: 'attached', timeout: 30000 });
  await until(async () => !(await has(toggle, 'disabled')), 30000, '3D toggle enabled');
  await toggle.click();
  await host.locator('sw-plan-3d[data-floor-3d]').waitFor({ timeout: 30000 });
  await until(() => has(host.locator('sw-plan-3d[data-floor-3d]'), 'data-ready'), 60000, '3D ready');
  await page.waitForTimeout(1500); // the strip's other-floor dots and the level thumbnails load lazily
}

for (const w of widths) {
  for (const skin of skins) {
    for (const scheme of schemes) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', deviceScaleFactor: 1, hasTouch: w < 768, isMobile: w < 768 });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
      try {
        if (shots.includes('list2d')) {
          await open(page, skin, scheme, seed.main);
          const toggle = page.locator(`${MAP} [data-sidelist-toggle]`);
          if (await toggle.count()) {
            await toggle.click();
            await page.waitForSelector(`${MAP} [data-sidelist]`, { timeout: 8000 });
            await page.waitForTimeout(400);
          }
          await page.screenshot({ path: name('list2d', skin, scheme, w), animations: 'disabled' });
          console.log('shot', name('list2d', skin, scheme, w));
          if (!keepList3d && (await toggle.count())) {
            await toggle.click(); // the list is a persisted choice (localStorage): close it again so that the 3D shots show the corner it stands in
            await until(async () => (await page.locator(`${MAP} [data-sidelist]`).count()) === 0, 8000, 'side list closed');
          }
        }
        if (shots.some((s) => ['strip3d', 'time3d', 'overlap3d', 'walk3d'].includes(s))) {
          await open(page, skin, scheme, seed.main);
          await to3d(page);
          if (shots.includes('strip3d')) {
            await page.screenshot({ path: name('strip3d', skin, scheme, w), animations: 'disabled' });
            console.log('shot', name('strip3d', skin, scheme, w));
          }
          if (shots.some((s) => ['time3d', 'overlap3d', 'walk3d'].includes(s))) {
            await jsClick(page.locator(`${MAP} sw-plan-3d [data-quality-3]`));
            await page.waitForSelector(`${MAP} sw-plan-3d [data-3d-time]`, { timeout: 40000 });
            await page.waitForTimeout(2500);
            if (shots.includes('overlap3d')) {
              await page.screenshot({ path: name('overlap3d', skin, scheme, w), animations: 'disabled' });
              console.log('shot', name('overlap3d', skin, scheme, w));
            }
            if (shots.includes('time3d')) {
              await jsClick(page.locator(`${MAP} sw-plan-3d [data-3d-time-toggle]`)); // the picker opens under the pill: the pill and its popover together
              await page.waitForTimeout(500);
              await page.screenshot({ path: name('time3d', skin, scheme, w), animations: 'disabled' });
              console.log('shot', name('time3d', skin, scheme, w));
              await jsClick(page.locator(`${MAP} sw-plan-3d [data-3d-time-toggle]`));
            }
            if (shots.includes('walk3d')) {
              await jsClick(page.locator(`${MAP} sw-plan-3d [data-walk-btn]`));
              await page.waitForSelector(`${MAP} sw-plan-3d[data-walk]`, { timeout: 40000 });
              await page.waitForSelector(`${MAP} sw-plan-3d sw-walk-hud [data-walk-bar]`, { timeout: 20000 });
              await page.waitForTimeout(2500);
              await page.screenshot({ path: name('walk3d', skin, scheme, w), animations: 'disabled' });
              console.log('shot', name('walk3d', skin, scheme, w));
            }
          }
        }
      } catch (e) {
        console.log('FAILED', skin, scheme, w, String(e).slice(0, 300));
        try {
          await page.screenshot({ path: path.join(out, `FAIL-${tag}-${skin}-${scheme}-${w}.png`) });
        } catch {
          /* ignore */
        }
      }
      await page.close();
      await ctx.close();
    }
  }
}
await browser.close();
if (process.argv.includes('--cleanup')) {
  await unseedHud(api, seed);
  fs.rmSync(seedFile, { force: true });
  console.log('cleaned up');
}
await api.dispose();
console.log('done');
