import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { alphaOf } from './menu-opaque-harness';

// Owner report 2026-10-11: on the floor map with the 3D on screen, the floor switcher showed twice - the large floor strip
// (short name, floor name, state dots) and, under its card (then translucent) in the same corner, the 2D quick floor buttons as a
// second smaller set bleeding through. One switcher at a time: the 3D shows only the strip, the 2D only the quick
// buttons. Since 2026-10-13 (second report: every HUD panel over the plan is opaque, tests/evidence-hud-opaque-live.spec.ts) the strip's card
// is also the opaque menu surface, so nothing under it can show through whatever is rendered there: the spec reads its computed alpha too. Checked in every skin and both schemes, on the desktop and the phone: the visible floor buttons are exactly the
// building's floors, no two of them overlap, and each one is the element painted at its own centre. The spec builds its
// own site / building / three floors with generated plan pictures and removes them.
// Runs only with SW_LIVE=1 (a backend behind the preview proxy; SW_API_PORT picks a throwaway instance).
// SW_FLOORSTRIP_TAG names the screenshot set (default "after"; "before" was taken on the unfixed build).
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'floorstrip');
const TAG = process.env.SW_FLOORSTRIP_TAG || 'after';
const MAP = 'explore-floor-map';
const SKINS = SKIN_IDS;
const SCHEMES = ['light', 'dark'];
const FLOORS = [
  { name: 'קרקע', level: 0 },
  { name: 'קומה -1', level: -1 },
  { name: 'קומה -2', level: -2 },
];
const ids = { site: '', building: '', floors: [] as string[] };
let api: APIRequestContext;

const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.25, height_m: null, base_z_m: 0, kind: 'exterior',
  confidence: 1, source: 'manual', locked: false, external_ids: {} });

type Painted = { visible: { sel: string; id: string; box: { x: number; y: number; w: number; h: number }; onTop: boolean }[] };

/** Every floor button of the map's shadow root that is laid out on screen (both switchers), with its box and whether
 * the browser paints it at its own centre (nothing of the other set over it). */
async function floorButtons(page: Page): Promise<Painted> {
  return page.locator(MAP).evaluate((host) => {
    const root = host.shadowRoot!;
    const out: Painted['visible'] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-floor-button], [data-strip-floor]'))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = root.elementFromPoint(cx, cy);
      out.push({
        sel: el.hasAttribute('data-strip-floor') ? 'strip' : 'quick',
        id: el.getAttribute('data-strip-floor') ?? el.getAttribute('data-floor-button') ?? '',
        box: { x: r.left, y: r.top, w: r.width, h: r.height },
        onTop: !!hit && (hit === el || el.contains(hit)),
      });
    }
    return { visible: out };
  }) as Promise<Painted>;
}

const overlap = (a: Painted['visible'][number]['box'], b: Painted['visible'][number]['box']) =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

/** The assertions of one view: exactly one switcher (`want`), one button per floor, no overlap, each painted on top. */
function check(got: Painted, want: 'strip' | 'quick', label: string) {
  const kinds = [...new Set(got.visible.map((b) => b.sel))];
  expect.soft(kinds, `${label}: only the ${want} switcher is laid out (${JSON.stringify(got.visible.map((b) => b.sel))})`).toEqual([want]);
  expect.soft(got.visible.length, `${label}: one visible floor button per floor`).toBe(FLOORS.length);
  expect.soft(new Set(got.visible.map((b) => b.id)).size, `${label}: no floor listed twice`).toBe(got.visible.length);
  const pairs: string[] = [];
  got.visible.forEach((a, i) => got.visible.slice(i + 1).forEach((b) => { if (overlap(a.box, b.box)) pairs.push(`${a.sel}:${a.id} x ${b.sel}:${b.id}`); }));
  expect.soft(pairs, `${label}: no two floor buttons overlap`).toEqual([]);
  expect.soft(got.visible.filter((b) => !b.onTop).map((b) => `${b.sel}:${b.id}`), `${label}: every floor button is the one painted at its centre`).toEqual([]);
}

async function open(page: Page, skin: string, scheme: string, floor: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/explore/floors/${floor}`);
  await expect(page.locator(`${MAP} [data-floor-buttons] button`)).toHaveCount(FLOORS.length, { timeout: 30000 });
}

async function to3d(page: Page) {
  const host = page.locator(MAP);
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 30000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
  await toggle.click();
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await expect(host.locator('[data-floor-strip] [data-strip-floor]')).toHaveCount(FLOORS.length);
  await page.waitForTimeout(700); // the strip's other-floor dots load lazily; let the corner settle before the picture
}

test.describe.serial('one floor switcher on the floor map (owner 2026-10-11)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת מחליף קומות ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:6px solid #ccc"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const f of FLOORS) {
      const floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: f })).json()).id as string;
      ids.floors.push(floor);
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      const version = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id as string;
      expect((await api.post(`api/v1/plan-versions/${version}/publish`)).status()).toBe(200);
      const g = await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json();
      const doc = { ...g.doc, walls: [WALL('w-out', [[0.15, 0.2], [0.85, 0.2], [0.85, 0.8], [0.15, 0.8], [0.15, 0.2]]), WALL('w-in', [[0.5, 0.2], [0.5, 0.8]])] };
      const put = await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc, base_revision: g.geometry.revision } });
      expect(put.status(), await put.text()).toBe(200);
      expect((await api.post(`api/v1/plan-versions/${version}/geometry/publish`)).status()).toBe(200);
    }
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      for (const f of ids.floors) expect((await api.delete(`api/v1/floors/${f}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('every skin and scheme: the 2D shows only the quick buttons, the 3D only the floor strip, never both', async ({ page }, info) => {
    test.setTimeout(420_000);
    const start = ids.floors[1]; // 'קומה -1', the owner's screen
    for (const skin of SKINS) {
      for (const scheme of SCHEMES) {
        const label = `${info.project.name} ${skin} ${scheme}`;
        await open(page, skin, scheme, start);
        check(await floorButtons(page), 'quick', `${label} 2D`);
        await to3d(page);
        check(await floorButtons(page), 'strip', `${label} 3D`);
        const card = await page.locator(`${MAP} [data-floor-strip]`).evaluate((el) => getComputedStyle(el).backgroundColor);
        expect.soft(alphaOf(card), `${label} 3D: the strip's card is opaque (${card})`).toBe(1);
        // the strip keeps its names (the large set the owner wants) and marks the floor on screen
        await expect.soft(page.locator(`${MAP} [data-strip-floor="${start}"]`)).toHaveAttribute('aria-pressed', 'true');
        const corner = page.locator(`${MAP} [data-floor-strip]`);
        const box = (await corner.boundingBox())!;
        await page.screenshot({
          path: path.join(OUT, `${TAG}-${info.project.name}-${skin}-${scheme}.png`),
          clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 40), width: box.width + 120, height: box.height + 80 },
        });
      }
    }
  });

  test('the strip still switches floors from the keyboard and keeps the 3D', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, 'classic', 'light', ids.floors[1]);
    await to3d(page);
    const target = page.locator(`${MAP} [data-strip-floor="${ids.floors[2]}"]`);
    await target.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 15000 }).toContain(ids.floors[2]);
    const host = page.locator(MAP);
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 }); // the 3D is kept
    await expect(host.locator(`[data-strip-floor="${ids.floors[2]}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(host.locator('[data-floor-buttons]')).toHaveCount(0);
    // back to 2D: the quick buttons return, the strip leaves
    await host.locator('[data-view-3d]').click();
    await expect(host.locator('[data-floor-buttons] button')).toHaveCount(FLOORS.length);
    await expect(host.locator('[data-floor-strip]')).toHaveCount(0);
  });
});
