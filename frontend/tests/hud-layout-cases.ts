import { test, expect, type Browser, type Page, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedHud, unseedHud, type HudSeed } from './hud-live-seed';
import { MENU_SCHEMES, MENU_SKINS, whenQuiet } from './hud-opaque-harness';
import { hudFindings, settledHud, type HudSnapshot } from './hud-layout-harness';

// The HUD over the floor map's plan and 3D canvas keeps its panels apart (owner 2026-10-13: the pictures of the opaque panels, docs/design/evidence/
// hud-opaque/, showed three layout collisions that translucency had been hiding), on the REAL floor map of a seeded building (tests/hud-live-seed.ts):
//   1. the circuit buttons and the 3D time pill both stood top / inline-end 12 px - on a floor with a lighting circuit at the realistic level the
//      button covered the pill (and the walk's minimap);
//   2. the side list, docked at the same edge, covered the time pill, its picker, the minimap and two of the three zoom buttons;
//   3. the level bar was centred with `inset-inline-start: 50%` + `translateX(-50%)`: in RTL it left the canvas at 390 px, sat over the pill and the
//      circuit buttons, and was never in the middle.
// Rectangles are read from the browser (tests/hud-layout-harness.ts): in every skin at 390 / 768 / 1440 px, in the states of the screen - the 2D plan
// (plain, with the side list, with the layers list), the 3D view at the realistic level (the time pill and the circuit buttons, the picker open, the
// side list open) and the eye-level walk (the minimap, with the side list) - no two panels that must stand apart overlap, nothing reaches past the
// stage, nothing is painted over a control, the picker is the top-most thing, the level bar is centred in the free band and shows all its chips.
// The spec takes no side: against the build BEFORE the fix it fails on exactly those findings (and with SW_HUD_SHOTS=1 still writes the pictures).
// Runs only with SW_LIVE=1 against the devices fixture (tests/fixtures/devices_fake_ha.py: the real backend, a fake Home Assistant); it seeds its own
// building and removes it. SW_API_PORT / SW_FAKE_HA_CONTROL_PORT as the other fixture specs.
//   SW_HUD_SHOTS=1 [SW_HUD_TAG=after] [SW_HUD_SHOT_SKINS=classic,domus] [SW_HUD_SHOT_SCHEMES=light] [SW_HUD_SHOT_WIDTHS=1440,390]
//   also writes the pictures of every state into docs/design/evidence/hud-layout/ (PNG; the evidence folder keeps them as JPEG).
const MAP = 'explore-floor-map';
const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.SW_HUD_SHOTS ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'hud-layout') : '';
const TAG = process.env.SW_HUD_TAG || 'after';
const csv = (v: string | undefined, all: readonly string[]) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [...all]);
const SHOT_SKINS = csv(process.env.SW_HUD_SHOT_SKINS, ['classic']);
const SHOT_SCHEMES = csv(process.env.SW_HUD_SHOT_SCHEMES, ['light']);
const SHOT_WIDTHS = csv(process.env.SW_HUD_SHOT_WIDTHS, ['1440', '768', '390']).map(Number);
const WIDTHS = [1440, 768, 390] as const;
/** SW_HUD_WIDTHS narrows the widths (a quick local loop); SW_HUD_SKINS the skins. */
const RUN_WIDTHS = csv(process.env.SW_HUD_WIDTHS, WIDTHS.map(String)).map(Number);
const SCHEMES = MENU_SCHEMES;
const shortList = (w: number) => w < 768; // the phone's forms (the list is a bottom sheet, the layers list covers the corner)

let api: APIRequestContext;
let seed: HudSeed;

async function newPage(browser: Browser, w: number) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: w, height: w < 768 ? 844 : 900 },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    deviceScaleFactor: 1,
    hasTouch: w < 768,
    isMobile: w < 768,
  });
  // the side list is a persisted choice (this browser): every page of the spec starts with it closed
  await ctx.addInitScript(() => {
    try {
      localStorage.removeItem('sw.map.sidelist');
    } catch {
      /* storage unavailable */
    }
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
  return { ctx, page };
}

async function open(page: Page, skin: string, scheme: string, floor: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}&look=performance:full#/explore/floors/${floor}`);
  await expect(page.locator(`${MAP} [data-floorchip]`)).toBeVisible({ timeout: 60000 });
  await expect(page.locator(`${MAP} [data-floor-buttons] button`)).toHaveCount(3, { timeout: 40000 });
  await expect(page.locator(`${MAP} .levelbar [data-level-chip]`)).toHaveCount(3, { timeout: 20000 }); // all levels + the two of the ground floor
  await expect(page.locator(`${MAP} [data-circuit-strip] [data-circuit-toggle]`)).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(700);
}

async function to3d(page: Page) {
  const host = page.locator(MAP);
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 30000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 40000 });
  await toggle.click();
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 90000 });
  await expect(host.locator('[data-floor-strip] [data-strip-floor]')).toHaveCount(3);
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-3d-thumbs', /^[1-9]/, { timeout: 40000 });
  await whenQuiet(page);
}

const jsClick = (page: Page, sel: string) => page.locator(`${MAP} ${sel}`).evaluate((el) => (el as HTMLElement).click()); // the realistic level keeps the main thread busy

async function setList(page: Page, on: boolean) {
  const open = () => page.locator(`${MAP} [data-sidelist]`).count().then((n) => n > 0);
  if ((await open()) === on) return;
  await page.locator(`${MAP} [data-sidelist-toggle]`).click();
  await expect.poll(open, { timeout: 10000 }).toBe(on);
  await page.waitForTimeout(250);
}

async function setPanel(page: Page, on: boolean) {
  const open = () => page.locator(`${MAP} [data-layers-panel]`).count().then((n) => n > 0);
  if ((await open()) === on) return;
  // the "layers" button of the tools row: the second sw-button with the layers icon (the first set of buttons are the layer toggles)
  await page.locator(`${MAP} sw-button[icon='layers']`).click();
  await expect.poll(open, { timeout: 10000 }).toBe(on);
  await page.waitForTimeout(250);
}

type Spec = Parameters<typeof hudFindings>[1];
/** Read the HUD once it settles, add what it breaks to `findings` (the test asserts them all at its end, so one run reports every state), and
 * take the picture when asked. The rectangles go to the log whatever the verdict: a failing state is read from them. */
async function look(page: Page, state: string, ctxName: string, spec: Spec, extra: { skin: string; scheme: string; w: number }, findings: string[]): Promise<HudSnapshot> {
  const snap = await settledHud(page);
  const found = hudFindings(snap, spec);
  const label = `${ctxName} / ${state}`;
  console.log(`HUD ${label} ${found.length ? 'FINDINGS ' + found.length : 'ok'} ${JSON.stringify({ stage: snap.stage, row2: snap.row2, corner: snap.corner, end: snap.end, rects: snap.rects })}`);
  for (const f of found) findings.push(`${label}: ${f}`);
  if (OUT && SHOT_SKINS.includes(extra.skin) && SHOT_SCHEMES.includes(extra.scheme) && SHOT_WIDTHS.includes(extra.w)) {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${TAG}-${state}-${extra.skin}-${extra.scheme}-${extra.w}.png`), animations: 'disabled' });
  }
  return snap;
}

/** The pairs that stand apart in the corner and the top row, whatever the state (an absent name is skipped; `present` lists what must be there). */
const TOP: [string, string][] = [
  ['levelbar', 'chip'],
  ['levelbar', 'circuit#0'],
  ['levelbar', 'pill'],
  ['levelbar', 'minimap'],
  ['levelbar', 'floorbtns'],
  ['levelbar', 'floorstrip'],
  ['chip', 'floorbtns'],
  ['chip', 'floorstrip'],
  ['chip', 'pill'],
  ['chip', 'minimap'],
  ['chip', 'circuit#0'],
  ['circuit#0', 'pill'],
  ['circuit#0', 'minimap'],
  ['circuit#0', 'floorbtns'],
  ['circuit#0', 'floorstrip'],
  ['pill', 'floorstrip'],
  ['minimap', 'floorstrip'],
  ['hint', 'levelbar'],
  ['hint', 'pill'],
  ['hint', 'chip'],
  ['hint', 'minimap'],
];
const DOCKED_AGAINST = ['circuit#0', 'levelbar', 'pill', 'picker', 'minimap', 'zoom', 'scale', 'legend', 'chip', 'bar3d', 'walkbar'];
/** A transient notice (the slow-device hint) is painted over the columns it crosses on a phone; the picker is a menu over the stack below it. */
const HINT_OVER = ['circuit#0', 'floorstrip', 'floorbtns', 'thumbs', 'bar3d'];
/** Two `allowCover` tables as one (a name's allowed coverers add up). */
const merge = (a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> => {
  const out: Record<string, string[]> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = [...(out[k] ?? []), ...v];
  return out;
};

/** Defines the layout guard for these skins: the cases of tests/evidence-hud-layout-live.spec.ts and -b.spec.ts (two files so that each fixture group stays
 * under the fixture job's 20-minute limit; every skin is read once). */
export function defineHudLayoutTests(skins: readonly string[]): void {
  const SKINS = csv(process.env.SW_HUD_SKINS, skins);
  test.describe('the HUD over the floor map keeps its panels apart (layout guard on the real floor map)', () => {
    test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the devices fixture backend running');

    test.beforeAll(async ({ playwright }) => {
      api = await playwright.request.newContext({ baseURL: BASE });
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

    for (const w of WIDTHS) {
      if (!RUN_WIDTHS.includes(w)) continue;
      for (const skin of SKINS) {
        test(`2D plan: level bar, circuit buttons, floor buttons, zoom, legend; the side list; the layers list - ${skin} / ${w} px (light and dark)`, async ({ browser }, info) => {
          test.setTimeout(240_000);
          test.skip(info.project.name !== 'desktop', 'one project runs the sweep: it sets its own viewport');
          const findings: string[] = [];
          for (const scheme of SCHEMES) {
            const { ctx, page } = await newPage(browser, w);
            const name = `${skin}/${scheme}/${w}`;
            const me = { skin, scheme, w };
            const phone = shortList(w);
            try {
              await open(page, skin, scheme, seed.main);
              const apart: [string, string][] = [...TOP, ['zoom', 'scale'], ['circuit#0', 'zoom'], ['floorbtns', 'legend'], ['zoom', 'legend'], ['scale', 'legend']];
              const plain: Spec = { present: ['chip', 'levelbar', 'circuit#0', 'floorbtns', 'zoom', 'scale'], apart, centred: true, noScroll: true };
              await look(page, 'plan2d', name, plain, me, findings);
              // the side list: a docked panel from 768 px (the corner steps past it, it stops above the zoom row), a bottom sheet below (the zoom buttons stand
              // above it; the circuit buttons give way to it on a phone, as they always did)
              await setList(page, true);
              const listApart: [string, string][] = DOCKED_AGAINST.map((n) => ['sidelist', n]);
              await look(page, 'plan2d-list', name, { present: [...plain.present.filter((n) => !phone || n !== 'circuit#0'), 'sidelist'], apart: [...apart, ...listApart], centred: true, noScroll: true }, me, findings);
              await setList(page, false);
              // the layers list (a popover that docks over the corner from 641 px): the corner and the bar stand past it
              if (!phone) {
                await setPanel(page, true);
                const panelApart: [string, string][] = ['circuit#0', 'levelbar', 'pill', 'minimap', 'chip'].map((n) => ['layers', n]);
                const noZoom = apart.filter(([a, b]) => !['zoom', 'scale', 'legend'].some((z) => z === a || z === b));
                await look(page, 'plan2d-layers', name, { present: ['chip', 'levelbar', 'layers', 'circuit#0'], apart: [...noZoom, ...panelApart], allowCover: { zoom: ['layers'], scale: ['layers'], legend: ['layers'] }, centred: true, noScroll: true }, me, findings);
                await setPanel(page, false);
              }
            } finally {
              await ctx.close();
            }
          }
          expect(findings, findings.join('\n')).toEqual([]);
        });

        test(`3D realistic level: time pill and circuit buttons, the picker, the side list; the walk's minimap - ${skin} / ${w} px`, async ({ browser }, info) => {
          test.setTimeout(480_000);
          test.skip(info.project.name !== 'desktop', 'one project runs the sweep: it sets its own viewport');
          // every skin is read in both schemes across the widths (the geometry does not depend on the scheme; the colours are the opacity spec's)
          const scheme = SCHEMES[((MENU_SKINS as readonly string[]).indexOf(skin) + WIDTHS.indexOf(w)) % 2];
          const findings: string[] = [];
          const { ctx, page } = await newPage(browser, w);
          const name = `${skin}/${scheme}/${w}`;
          const me = { skin, scheme, w };
          const sheet = shortList(w); // the list is a bottom sheet: it covers the 3D view's bottom rows by design
          const listApart: [string, string][] = DOCKED_AGAINST.filter((n) => !sheet || n !== 'bar3d').map((n) => ['sidelist', n]); // the sheet covers the view bar by design; the walk's row it leaves free
          const sheetCover: Record<string, string[]> = sheet ? { bar3d: ['sidelist'], thumbs: ['sidelist'] } : {};
          const topmost = (s: HudSnapshot, state: string) => {
            if (s.pickerCovered.length) findings.push(`${name} / ${state}: the picker is not the top-most thing: ${s.pickerCovered.join(', ')} painted over it`);
          };
          try {
            await open(page, skin, scheme, seed.main);
            await to3d(page);
            await jsClick(page, 'sw-plan-3d [data-quality-3]'); // the realistic level: the time pill
            await expect(page.locator(`${MAP} sw-plan-3d [data-3d-time]`)).toBeAttached({ timeout: 90000 });
            await whenQuiet(page);
            const hintOver = merge(Object.fromEntries(HINT_OVER.map((n) => [n, ['hint']])), sheetCover);
            const real: Spec = {
              present: ['chip', 'levelbar', 'circuit#0', 'pill', 'floorstrip', 'bar3d', 'thumbs'],
              apart: [...TOP, ['circuit#0', 'bar3d'], ['circuit#0', 'thumbs'], ['pill', 'bar3d'], ['levelbar', 'bar3d'], ['levelbar', 'thumbs']],
              allowCover: hintOver,
              centred: true,
              noScroll: true,
            };
            const s1 = await look(page, 'real3d', name, real, me, findings);
            if (s1.corner !== 'pill') findings.push(`${name} / real3d: the floor map was not told about the time pill (stage data-corner is ${s1.corner ?? 'unset'}, want pill)`);
            // the picker: a menu opened from the pill, over the stack below it and above everything
            await jsClick(page, 'sw-plan-3d [data-3d-time-toggle]');
            await expect(page.locator(`${MAP} sw-plan-3d [data-3d-time-pop]`)).toBeAttached();
            const menuOver = merge(hintOver, { 'circuit#0': ['picker'], levelbar: ['picker'], floorstrip: ['picker'], thumbs: ['picker'], chip: ['picker'] });
            const withPicker: Spec = { ...real, present: [...real.present, 'picker'], apart: [...real.apart, ['picker', 'pill']], allowCover: menuOver };
            topmost(await look(page, 'real3d-picker', name, withPicker, me, findings), 'real3d-picker');
            // the side list over the same corner
            await setList(page, true);
            const withList: Spec = { ...withPicker, present: [...withPicker.present.filter((n) => !sheet || n !== 'circuit#0'), 'sidelist'], apart: [...withPicker.apart, ...listApart] };
            topmost(await look(page, 'real3d-picker-list', name, withList, me, findings), 'real3d-picker-list');
            await jsClick(page, 'sw-plan-3d [data-3d-time-toggle]'); // close the picker
            const closed: Spec = { ...withList, present: withList.present.filter((n) => n !== 'picker'), apart: withList.apart.filter(([a, b]) => a !== 'picker' && b !== 'picker'), allowCover: hintOver };
            await look(page, 'real3d-list', name, closed, me, findings);
            await setList(page, false);
            // the eye-level walk: the minimap takes the corner, the circuit buttons stand below it
            await jsClick(page, 'sw-plan-3d [data-walk-btn]');
            await expect(page.locator(`${MAP} sw-plan-3d[data-walk]`)).toBeAttached({ timeout: 90000 });
            await expect(page.locator(`${MAP} sw-plan-3d sw-walk-hud [data-walk-bar]`)).toBeAttached({ timeout: 30000 });
            await whenQuiet(page);
            const walk: Spec = { present: ['chip', 'levelbar', 'circuit#0', 'minimap', 'floorstrip', 'walkbar'], apart: [...TOP, ['circuit#0', 'walkbar'], ['minimap', 'walkbar'], ['levelbar', 'walkbar']], allowCover: hintOver, centred: true, noScroll: true };
            const s4 = await look(page, 'walk', name, walk, me, findings);
            if (s4.corner !== 'minimap') findings.push(`${name} / walk: the floor map was not told about the minimap (stage data-corner is ${s4.corner ?? 'unset'}, want minimap)`);
            await setList(page, true);
            await look(page, 'walk-list', name, { ...walk, present: [...walk.present.filter((n) => !sheet || n !== 'circuit#0'), 'sidelist'], apart: [...walk.apart, ...listApart] }, me, findings);
          } finally {
            await ctx.close();
          }
          expect(findings, findings.join('\n')).toEqual([]);
        });
      }
    }
  });
}
