import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { newMock } from './nvr-cameras-write-mock';
import { batchCameras, installBatch, newBatchMock } from './nvr-batch-mock';
import { LONG_HE, MIXED, UNBREAK } from './breakui-worst';

// R5-LIVE-297 shoot harness, not a test: every screen of the LIVE group (live overview, single camera, camera wall, saved views, kiosk,
// camera health, the cameras settings screen and its editor / encoding / confirmation dialogs), every selectable skin, light + dark.
// The live screens run in the demo mode (no backend); the cameras settings screen runs against the stateful mocked API of
// tests/nvr-cameras-write-mock.ts + tests/nvr-batch-mock.ts (never a device).
//   R5_OUT=<dir> R5_SCREENS=overview,wall R5_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:5297/ npx playwright test tests/r5-live-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.R5_OUT ?? '';
const ALL = 'overview,camera,wall,views,kiosk,health,cams,editor,encoding,confirm';
const SCREENS = (process.env.R5_SCREENS ?? ALL).split(',');
const SKINS = (process.env.R5_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');

interface Screen { hash: string; nvr?: boolean; worst?: boolean; open?: (page: Page) => Promise<void> }
const CAMS = 'sw-app system-security system-security-cameras';
const DEF: Record<string, Screen> = {
  overview: { hash: '/live' },
  camera: { hash: '/live/cameras/cam-1' },
  wall: { hash: '/live/wall' },
  views: { hash: '/live/views' },
  kiosk: { hash: '/kiosk/all' },
  health: { hash: '/investigate/health' },
  cams: { hash: '/system/security/cameras', nvr: true },
  'cams-worst': { hash: '/system/security/cameras', nvr: true, worst: true },
  editor: {
    hash: '/system/security/cameras',
    nvr: true,
    open: async (page) => {
      const b = page.locator(`${CAMS} button[data-edit-stream]:not([disabled]):visible`).first();
      await b.waitFor({ state: 'visible', timeout: 10_000 });
      await b.click();
      await page.locator(`${CAMS} nvr-camera-editor sw-drawer[open]`).waitFor({ state: 'attached', timeout: 8000 });
    },
  },
  encoding: {
    hash: '/system/security/cameras',
    nvr: true,
    open: async (page) => {
      const b = page.locator(`${CAMS} [data-nvr-encoding-open]`);
      await b.waitFor({ state: 'visible', timeout: 10_000 });
      await b.click();
      await page.locator(`${CAMS} nvr-encoding-batch sw-dialog[open][data-nvr-enc]`).waitFor({ state: 'attached', timeout: 8000 });
      await page.waitForTimeout(600);
      const r = page.locator(`${CAMS} nvr-encoding-batch [data-nvr-enc-stream="cam-1:101"]`);
      if (await r.count()) await r.click().catch(() => {});
    },
  },
  confirm: {
    hash: '/system/security/cameras',
    nvr: true,
    open: async (page) => {
      const t = page.locator(`${CAMS} sw-toggle:not([disabled]):visible`).first();
      await t.waitFor({ state: 'visible', timeout: 10_000 });
      await t.click();
      await page.locator('sw-dialog[open][data-nvr-confirm-dialog]').first().waitFor({ state: 'attached', timeout: 8000 });
    },
  },
};

async function boot(page: Page, s: Screen, skin: string, scheme: 'light' | 'dark') {
  if (s.nvr) {
    const st = newMock();
    st.canBatch = true;
    st.cameras = batchCameras(6, { h265: [2, 4], offline: [5] });
    if (s.worst) st.cameras.forEach((c, i) => { c.name = [LONG_HE, UNBREAK, MIXED][i % 3]; });
    await installBatch(page, st, newBatchMock());
  }
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${s.hash}`);
  await page.waitForSelector('sw-app', { state: 'attached' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.fonts.ready);
  if (s.open) {
    await s.open(page);
    await page.waitForTimeout(900);
  }
}

test.describe('r5 live shoot', () => {
  test.skip(!OUT, 'R5_OUT not set');
  test.beforeAll(() => { if (OUT) fs.mkdirSync(OUT, { recursive: true }); });
  for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) for (const id of SCREENS) {
    test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
      const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
      const s = DEF[id];
      await page.emulateMedia({ colorScheme: scheme });
      await boot(page, s, skin, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`);
      await page.screenshot({ path: file, fullPage: vp === 'phone' && !s.open });
      if (over > 1) fs.appendFileSync(path.join(OUT, 'overflow.log'), `${path.basename(file)} sideways ${over}px\n`);
    });
  }
});
