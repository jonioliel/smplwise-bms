import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUD_FLOORS, seedHud, unseedHud, type HudSeed } from './hud-live-seed';
import { MENU_SCHEMES, MENU_SKINS, expectOpaqueControl, expectOpaqueFill, expectOpaqueHud, whenQuiet } from './hud-opaque-harness';

// The HUD panels over the plan and the 3D canvas are opaque (owner 2026-10-13, second report - the same symptom as the floor strip of 2026-10-11),
// on the REAL floor map of a seeded building: the panels that need a backend (the floor strip beside the 3D view, the side list, the selection bar,
// the circuit buttons, the level bar, the quick floor buttons, the level thumbnails, the room-name and entity pills, the label pills drawn in the plan).
// The panels the demo screens already show (the floor chip, the legend, the zoom buttons, the view bar, the time pill, the walk bar) are in
// tests/evidence-menu-opaque.spec.ts. What is read from the browser, in every skin x scheme, on the desktop and the phone: the computed background alpha
// is 1 and IS the menu token, no backdrop-filter, nothing fades it, and every text of the panel reads at the WCAG ratio on the opaque colour under it.
// Runs only with SW_LIVE=1 against the devices fixture (tests/fixtures/devices_fake_ha.py: the real backend, a fake Home Assistant); the spec seeds its
// own building (tests/hud-live-seed.ts) and removes it. SW_API_PORT / SW_FAKE_HA_CONTROL_PORT as the other fixture specs.
//   SW_HUD_SHOTS=1 (and SW_HUD_TAG, default "after") also writes the desktop and phone pictures into docs/design/evidence/hud-opaque/.
const MAP = 'explore-floor-map';
const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
const OUT = process.env.SW_HUD_SHOTS ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'hud-opaque') : '';
const TAG = process.env.SW_HUD_TAG || 'after';
const isPhone = (info: { project: { name: string } }) => info.project.name === 'mobile';
let api: APIRequestContext;
let seed: HudSeed;

const shot = async (page: Page, kind: string, skin: string, scheme: string, info: { project: { name: string } }) => {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${kind}-${skin}-${scheme}-${isPhone(info) ? 390 : 1440}.png`), animations: 'disabled' });
};

async function open(page: Page, skin: string, scheme: string, floor: string) {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}&look=performance:full#/explore/floors/${floor}`);
  await expect(page.locator(`${MAP} [data-floorchip]`)).toBeVisible({ timeout: 40000 });
  await expect(page.locator(`${MAP} [data-floor-buttons] button`)).toHaveCount(HUD_FLOORS.length, { timeout: 30000 });
  await page.waitForTimeout(700);
}

async function to3d(page: Page) {
  const host = page.locator(MAP);
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 30000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
  await toggle.click();
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 40000 });
  await expect(host.locator('[data-floor-strip] [data-strip-floor]')).toHaveCount(HUD_FLOORS.length);
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-3d-thumbs', /^[1-9]/, { timeout: 20000 }); // the level thumbnails are drawn
  await page.waitForTimeout(900); // the strip's other-floor dots load lazily
  await whenQuiet(page); // the scene build and the thumbnail pass keep the main thread busy for seconds (software GL)
}

test.describe('HUD panels over the plan and the 3D canvas are opaque on the real floor map', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the devices fixture backend running');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'the desktop and the phone are the two forms');
  });

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    seed = await seedHud(api, CONTROL, new Date().toISOString().slice(0, 19));
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (seed) await unseedHud(api, seed);
    } finally {
      await api.dispose();
    }
  });

  for (const skin of MENU_SKINS) {
    for (const scheme of MENU_SCHEMES) {
      test(`2D plan: floor chip, level bar, floor buttons, circuits, side list, selection bar, legend, zoom, label pills - ${skin} / ${scheme}`, async ({ page }, info) => {
        test.setTimeout(150_000);
        await open(page, skin, scheme, seed.main);
        const map = page.locator(MAP);
        await expect(map.locator('sw-plan-canvas .zone .zl-bg').first()).toBeAttached({ timeout: 20000 }); // the rooms' name labels are drawn
        const tag = `${skin}/${scheme}/${info.project.name}`;
        await expectOpaqueHud(map.locator('[data-floorchip]'), `floor chip ${tag}`);
        await expectOpaqueHud(map.locator('.levelbar'), `level bar ${tag}`); // the building's ground floor has a second level
        await expectOpaqueHud(map.locator('[data-floor-button]').first(), `quick floor button ${tag}`);
        await expectOpaqueControl(map.locator(`[data-floor-button="${seed.main}"]`), `quick floor button on ${tag}`, { token: false });
        await expectOpaqueHud(map.locator('[data-circuit-toggle]').first(), `circuit button ${tag}`);
        await expectOpaqueHud(map.locator('sw-plan-canvas .controls'), `zoom buttons ${tag}`, false);
        await expectOpaqueHud(map.locator('sw-plan-canvas .scale'), `scale ${tag}`);
        if (!isPhone(info)) await expectOpaqueHud(map.locator('.legend'), `legend ${tag}`);
        // the label pills drawn in the plan (a room's name, its thermometer)
        await expectOpaqueFill(map.locator('sw-plan-canvas .zone .zl-bg'), `room label ${tag}`);
        await expectOpaqueFill(map.locator('sw-plan-canvas .zone .tchip rect'), `temperature chip ${tag}`);
        // the side list opens over the plan (a bottom sheet on a phone)
        await map.locator('[data-sidelist-toggle]').click();
        await expectOpaqueHud(map.locator('[data-sidelist]'), `side list ${tag}`);
        await shot(page, 'live2d', skin, scheme, info);
        await map.locator('[data-sidelist-toggle]').click();
        await expect(map.locator('[data-sidelist]')).toHaveCount(0);
        // the multi-camera selection bar (the desktop's toolbar; a phone scrolls it)
        if (!isPhone(info)) {
          await map.locator('[data-multi-toggle]').click();
          await expectOpaqueHud(map.locator('[data-pickbar]'), `selection bar ${tag}`);
          await shot(page, 'livepick', skin, scheme, info);
        }
      });

      test(`3D view: floor strip, level thumbnails, pills, view bar - ${skin} / ${scheme}`, async ({ page }, info) => {
        test.setTimeout(180_000);
        // the ground floor carries rooms, devices, a thermometer and a second level: the strip, the thumbnails and the pills all show
        await open(page, skin, scheme, seed.main);
        await to3d(page);
        const map = page.locator(MAP);
        const el = map.locator('sw-plan-3d[data-floor-3d]');
        const tag = `${skin}/${scheme}/${info.project.name}`;
        // the floor strip (owner 2026-10-11, and again 2026-10-13): an opaque card with its names, its dots and the floor on screen marked
        await expectOpaqueHud(map.locator('[data-floor-strip]'), `floor strip ${tag}`);
        await expect(map.locator(`[data-strip-floor="${seed.main}"]`)).toHaveAttribute('aria-pressed', 'true');
        // the level thumbnails and the pills over the scene (room names, devices, the thermometer)
        await expectOpaqueHud(el.locator('[data-3d-thumb]').first(), `level thumbnail ${tag}`);
        await expect(el.locator('[data-3d-label]:visible').first()).toBeVisible({ timeout: 20000 }); // a pill the frame loop has placed on screen
        await expectOpaqueHud(el.locator('[data-3d-label]:visible').first(), `pill ${tag}`);
        await expectOpaqueControl(el.locator('[data-preset-top] button'), `view chip ${tag}`, { token: false });
        await expectOpaqueControl(el.locator('[data-export-gltf] button'), `export button ${tag}`, { token: false });
        await shot(page, 'live3d', skin, scheme, info);
      });
    }
  }
});
