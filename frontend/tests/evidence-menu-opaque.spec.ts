import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVICE_PALETTES } from '../src/styles/devices-palettes';
import { BUILTIN_PALETTES } from '../src/design/palette';
import { MENU_SCHEMES, MENU_SKINS, expectOpaqueMenu, mountDropdowns, openApp, rgbText, type MenuScheme, type MenuSkin } from './menu-opaque-harness';
import { expectOpaqueControl, expectOpaqueHud, whenQuiet } from './hud-opaque-harness';
import { buildScene, type Catalog3DLookup } from '../src/map/scene-builder';
import { camera as walkCamera, walkDoc, walkInput } from './walk-fixtures';
import { skinsUnderTest, skipIfFrozen } from './helpers/frozen-skins';

// Menus are never see-through (owner 2026-10-13: the user menu was half transparent over the building tree in the glass look and the
// texts overlapped). A menu is opened for real - in every skin x scheme, on the desktop popover and the phone's bottom sheet, inside the glass
// device screens in every palette, under the look dials that used to thin a list out - and what it paints is READ from the browser: the
// background alpha is 1, the colour IS the menu token, no backdrop-filter, nothing above it fades it.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-menu-opaque.spec.ts --workers=1 --project=desktop --project=mobile
// The static twin is tests/unit-menu-lint.spec.ts (it scans the CSS of the menu components), the token twin tests/unit-menu-surfaces.spec.ts.
// The same file also holds the second half of the report (the HUD panels over the plan and the 3D canvas, last describe below) and its text contrast.

const isPhone = (info: { project: { name: string } }) => info.project.name === 'mobile';
const DD_STYLES = ['auto', 'pill', 'capsule'] as const;

// SW_MENU_SHOTS=1 also writes the evidence screenshots (the open user menu per skin x scheme, desktop and phone; a search panel and a dropdown list)
// into docs/design/evidence/menus-opaque/; the before images there are the same screens on the commit before the fix (the translucent menu).
const SHOTS = process.env.SW_MENU_SHOTS ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/menus-opaque') : '';
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
};

async function openUserMenu(page: Page, phone: boolean) {
  await page.locator(phone ? 'button[data-nav-me]' : 'button[data-profile-menu]').first().click();
  await expect(page.locator('sw-user-menu[open]')).toHaveCount(1);
  return page.locator('sw-user-menu .panel');
}

/** The corner search: the pill opens a panel (field + results) that hangs over the page. */
async function openSearch(page: Page) {
  await page.locator('sw-app .float button').first().click();
  const panel = page.locator('sw-app .searchpanel');
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('menus are opaque in every skin and scheme', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const skin of MENU_SKINS) {
    for (const scheme of MENU_SCHEMES) {
      test(`user menu: ${skin} / ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'a popover (desktop) and a bottom sheet (phone) are the two forms');
        await openApp(page, skin as MenuSkin, scheme as MenuScheme, '/devices/building');
        const panel = await openUserMenu(page, isPhone(info));
        await expect(panel).toBeVisible();
        const p = await expectOpaqueMenu(panel, `user menu ${skin}/${scheme}/${info.project.name}`);
        if (!isPhone(info) || skin !== 'tesla') await shot(page, `usermenu-${skin}-${scheme}-${isPhone(info) ? 390 : 1440}`);
        // the form: the panel really is the popover (desktop) or the sheet (phone) it claims to be
        const box = await panel.boundingBox();
        expect(box, 'the panel is on screen').toBeTruthy();
        if (isPhone(info)) expect(box!.width).toBeGreaterThanOrEqual(380);
        else expect(box!.width).toBeLessThan(400);
        expect(p.token).not.toBe('');
      });

      test(`search panel, tree menu and dropdown lists: ${skin} / ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'the desktop and the phone are the two forms');
        await openApp(page, skin as MenuSkin, scheme as MenuScheme, '/devices/building');
        // the corner search: field + result list in one panel over the page
        const search = await openSearch(page);
        await page.locator('sw-app .searchpanel input').fill('סלון');
        await expectOpaqueMenu(search, `search panel ${skin}/${scheme}`);
        if (skin === 'domus' && !isPhone(info)) await shot(page, `search-${skin}-${scheme}-1440`);
        await page.keyboard.press('Escape');
        // the "..." menu of a tree row (a summary over the tree) - there is no tree on a phone
        if (!isPhone(info)) {
          await page.locator('devices-building devices-bulk-menu button.more').first().click();
          await expectOpaqueMenu(page.locator('devices-building devices-bulk-menu .panel').first(), `tree row menu ${skin}/${scheme}`);
          await page.keyboard.press('Escape');
        }
        // a dropdown's list: the three looks (today's, the pill, the capsule)
        await mountDropdowns(page, DD_STYLES);
        for (const s of DD_STYLES) {
          await page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .chip`).click();
          const pop = page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .pop`);
          await expect(pop).toBeVisible();
          await expectOpaqueMenu(pop, `dropdown ${s} ${skin}/${scheme}/${info.project.name}`);
          if (s === 'capsule' && (skin === 'domus' || skin === 'crystal') && !isPhone(info)) await shot(page, `dropdown-${s}-${skin}-${scheme}-1440`);
          await page.keyboard.press('Escape');
          await expect(pop).toBeHidden();
        }
      });
    }
  }

  test('user menu: the account level (a second panel content) stays opaque and the dividers read', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the level switch is the same on every width');
    await openApp(page, 'domus', 'light', '/devices/building');
    const panel = await openUserMenu(page, false);
    await page.locator('sw-user-menu [data-menu-account]').click();
    await expect(page.locator('sw-user-menu [data-menu-level="account"]')).toBeVisible();
    await expectOpaqueMenu(panel, 'user menu / account level');
    // the divider under the header is the menu hairline (an opaque colour), not the white glass rim that vanishes on a white surface
    const line = await page.locator('sw-user-menu ul[data-menu-level="account"]').evaluate((u) => getComputedStyle(u).borderBlockStartColor);
    expect(line).toBe('rgb(223, 225, 230)');
  });

  for (const skin of skinsUnderTest(['domus', 'bubble', 'crystal'] as const)) {
    test(`the phone's dropdown sheet is opaque, its dim scrim stays translucent: ${skin}`, async ({ page }, info) => {
      test.skip(!isPhone(info), 'the sheet is the phone form');
      await openApp(page, skin, 'light', '/devices/building');
      await page.evaluate(() => document.documentElement.setAttribute('data-dd-phone', 'sheet'));
      await mountDropdowns(page, ['pill']);
      await page.locator('#stage sw-tabs[data-t="pill"] sw-dropdown .chip').click();
      const pop = page.locator('#stage sw-tabs[data-t="pill"] sw-dropdown .pop');
      await expect(pop).toHaveAttribute('data-present', 'sheet');
      await expectOpaqueMenu(pop, `dropdown sheet ${skin}`);
      // the scrim behind a modal sheet is allowed to dim and blur the page: it is NOT the menu
      const scrim = await pop.evaluate((el) => getComputedStyle(el, '::backdrop').backgroundColor);
      expect(scrim, 'the scrim keeps dimming the page').not.toBe('rgba(0, 0, 0, 0)');
      await page.keyboard.press('Escape');
    });
  }

  test('a popover card (the map marker card) is opaque in every skin', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the card is the same on every width');
    for (const skin of MENU_SKINS) {
      await openApp(page, skin, 'light', '/devices/building');
      await page.evaluate(() => {
        document.querySelectorAll('#stage').forEach((e) => e.remove());
        const st = document.createElement('div');
        st.id = 'stage';
        st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff)';
        const pop = document.createElement('sw-popover') as HTMLElement & { heading: string; x: number; y: number; stageWidth: number; stageHeight: number };
        pop.heading = 'כניסה ראשית';
        pop.x = 300;
        pop.y = 300;
        pop.stageWidth = 900;
        pop.stageHeight = 700;
        st.appendChild(pop);
        document.body.appendChild(st);
      });
      await expectOpaqueMenu(page.locator('#stage sw-popover'), `popover ${skin}`);
    }
  });
});

test.describe('menus keep their opaque surface under every look dial and palette that used to thin a pop-up out', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const dial of ['transparency:40', 'performance:lite', 'transparency:40,performance:lite,surface:glass,material:frosted,depth:2,tint:2']) {
    test(`bubble look ${dial}: the user menu and a dropdown list stay opaque`, async ({ page }, info) => {
      skipIfFrozen('bubble'); // BUBBLE-FREEZE-295
      test.skip(info.project.name !== 'desktop', 'the dials act the same on every width');
      for (const scheme of MENU_SCHEMES) {
        await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=bubble&scheme=${scheme}&look=${dial}#/devices/building`);
        await page.waitForSelector('sw-app');
        const panel = await openUserMenu(page, false);
        await expectOpaqueMenu(panel, `bubble ${dial} ${scheme}: user menu`);
        await page.keyboard.press('Escape');
        await mountDropdowns(page, ['auto', 'capsule']);
        for (const s of ['auto', 'capsule']) {
          await page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .chip`).click();
          await expectOpaqueMenu(page.locator(`#stage sw-tabs[data-t="${s}"] sw-dropdown .pop`), `bubble ${dial} ${scheme}: dropdown ${s}`);
          await page.keyboard.press('Escape');
        }
      }
    });
  }

  for (const id of ['calm-blue', 'sunset', 'high-contrast']) {
    test(`bubble palette ${id}: the menu surface is the palette's elevated surface, opaque, light and dark`, async ({ page }, info) => {
      skipIfFrozen('bubble'); // BUBBLE-FREEZE-295
      test.skip(info.project.name !== 'desktop', 'the palette acts the same on every width');
      const pal = BUILTIN_PALETTES.find((p) => p.id === id);
      expect(pal, `palette ${id} exists`).toBeTruthy();
      for (const scheme of MENU_SCHEMES) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=bubble&scheme=${scheme}&look=palette:${id}#/devices/building`);
        await page.waitForSelector('sw-app');
        const panel = await openUserMenu(page, false);
        const p = await expectOpaqueMenu(panel, `palette ${id} ${scheme}: user menu`);
        expect(p.token, `palette ${id} ${scheme}: the menu surface is surfaceElevated`).toBe(rgbText(pal!.schemes[scheme].surfaceElevated));
      }
    });
  }
});

test.describe('a menu inside a glass device screen is the palette\'s SOLID twin, light or dark by the screen\'s own scheme', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  // the solid twin of each palette and scheme: "default" lives in devices-themes.ts (#fbfcfe / #1c1c1e), the others in devices-palettes.ts
  const solidOf = (theme: string, scheme: MenuScheme): string => {
    if (theme === 'default') return scheme === 'light' ? '#fbfcfe' : '#1c1c1e';
    const pal = DEVICE_PALETTES.find((p) => p.id === theme)!;
    return pal[scheme].knobs!['--dv-surface-solid'];
  };

  test('the tree row menu in every glass palette and scheme - also a DARK screen under a LIGHT product (devices.scheme)', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'there is no tree on a phone');
    test.setTimeout(240_000);
    await openApp(page, 'domus', 'light', '/devices/building');
    const host = page.locator('devices-building');
    for (const theme of ['default', 'sand', 'forest', 'graphite']) {
      for (const scheme of MENU_SCHEMES) {
        await host.evaluate(
          (h, [t, s]) => {
            h.setAttribute('data-devices-style', 'glass');
            h.setAttribute('data-devices-theme', t);
            h.setAttribute('data-devices-scheme', s);
          },
          [theme, scheme],
        );
        await page.locator('devices-building devices-bulk-menu button.more').first().click();
        const panel = page.locator('devices-building devices-bulk-menu .panel').first();
        const p = await expectOpaqueMenu(panel, `glass ${theme}/${scheme}: tree row menu`);
        expect(p.token, `glass ${theme}/${scheme}: the menu surface is the palette's solid twin`).toBe(rgbText(solidOf(theme, scheme)));
        // the text on it reads: the menu's own text colour is the palette's, not the product's light text on a dark panel
        const ink = await panel.evaluate((el) => getComputedStyle(el).color);
        const fg = ink.match(/\d+(\.\d+)?/g)!.map(Number);
        const bg = p.bg.match(/\d+(\.\d+)?/g)!.map(Number);
        const lum = (c: number[]) => 0.2126 * (c[0] / 255) ** 2.2 + 0.7152 * (c[1] / 255) ** 2.2 + 0.0722 * (c[2] / 255) ** 2.2;
        expect(Math.abs(lum(fg) - lum(bg)), `glass ${theme}/${scheme}: dark text on light or light on dark (${ink} on ${p.bg})`).toBeGreaterThan(0.3);
        await page.keyboard.press('Escape');

        // a dropdown's list inside the same glass screen (a real sw-dropdown placed in the screen's shadow root inherits the bridge): the same solid twin
        await host.evaluate((h) => {
          const root = h.shadowRoot!;
          root.querySelectorAll('#menu-probe').forEach((e) => e.remove());
          const dd = document.createElement('sw-dropdown') as HTMLElement & { items: unknown; value: string };
          dd.id = 'menu-probe';
          dd.setAttribute('dd-style', 'capsule');
          dd.items = [{ id: 'a', label: 'סלון', count: 6 }, { id: 'b', label: 'מטבח' }, { id: 'c', label: 'משרד' }];
          dd.value = 'a';
          dd.style.cssText = 'position:fixed;inset-block-start:90px;inset-inline-start:90px;z-index:5';
          root.appendChild(dd);
        });
        await page.locator('devices-building #menu-probe .chip').click();
        const dp = await expectOpaqueMenu(page.locator('devices-building #menu-probe .pop'), `glass ${theme}/${scheme}: dropdown list`);
        expect(dp.token, `glass ${theme}/${scheme}: the dropdown list is the palette's solid twin`).toBe(rgbText(solidOf(theme, scheme)));
        await page.keyboard.press('Escape');
        await host.evaluate((h) => h.shadowRoot!.querySelectorAll('#menu-probe').forEach((e) => e.remove()));
      }
    }
  });
});

// ---- the second half of the same report (owner 2026-10-13): the HUD panels over the plan and the 3D canvas are opaque too. The demo floor map
// (no backend) shows the floor chip, the legend, the zoom buttons and the scale over the 2D plan, and over the 3D scene the view / quality bar,
// the entity pills, the time pill (at the realistic level); the walk bar is the real element on the style guide's 3D card with the walk world of
// the walk specs. The panels that need the fixture backend (the floor strip, the side list, the selection bar, the circuit buttons, the level bar,
// the quick floor buttons, the level thumbnails, the room labels) are tests/evidence-hud-opaque-live.spec.ts. What is read: the computed background
// alpha is 1 and IS the menu token, no backdrop-filter, nothing fades it - and every text of the panel reads at the WCAG ratio on the opaque
// colour it stands on, in every skin x scheme, on the desktop and the phone.
//   SW_HUD_SHOTS=1 also writes the desktop pictures into docs/design/evidence/hud-opaque/ (the "after" set; "before" was taken on the commit before).

const HUD_SHOTS = process.env.SW_HUD_SHOTS ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/hud-opaque') : '';
const hudShot = async (page: Page, name: string) => {
  if (!HUD_SHOTS) return;
  fs.mkdirSync(HUD_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(HUD_SHOTS, `${name}.png`), animations: 'disabled' });
};

const WALK_ITEMS = new Map(
  (JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; shape: string; color_token: string; role: string; mesh?: unknown; walkable?: boolean }[] }).items.map((i) => [i.id, i]),
);
const walkCatalog: Catalog3DLookup = (id) => {
  const i = WALK_ITEMS.get(id);
  return i ? ({ shape: i.shape, color_token: i.color_token, role: i.role, mesh: (i.mesh as never) ?? null, walkable: i.walkable } as ReturnType<Catalog3DLookup>) : undefined;
};

test.describe('the HUD panels over the plan and the 3D canvas are opaque in every skin and scheme', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'the desktop and the phone are the two forms');
  });

  for (const skin of MENU_SKINS) {
    for (const scheme of MENU_SCHEMES) {
      test(`2D plan: floor chip, legend, zoom buttons and scale - ${skin} / ${scheme}`, async ({ page }, info) => {
        await openApp(page, skin as MenuSkin, scheme as MenuScheme, '/explore/floors/f0');
        const map = page.locator('explore-floor-map');
        await expect(map.locator('[data-floorchip]')).toBeVisible({ timeout: 20000 });
        await expect(map.locator('sw-plan-canvas')).toBeVisible();
        await page.waitForTimeout(600);
        await expectOpaqueHud(map.locator('[data-floorchip]'), `floor chip ${skin}/${scheme}`);
        if (!isPhone(info)) await expectOpaqueHud(map.locator('.legend'), `legend ${skin}/${scheme}`); // the legend leaves a phone (767 px rule)
        await expectOpaqueHud(map.locator('sw-plan-canvas .controls'), `zoom buttons ${skin}/${scheme}`, false);
        await expectOpaqueHud(map.locator('sw-plan-canvas .scale'), `scale ${skin}/${scheme}`);
        if (!isPhone(info) && (skin === 'domus' || skin === 'crystal' || skin === 'classic')) await hudShot(page, `after-demo2d-${skin}-${scheme}-1440`);
      });

      test(`3D view: the view bar, the pills, the time pill - ${skin} / ${scheme}`, async ({ page }, info) => {
        test.setTimeout(150_000);
        await openApp(page, skin as MenuSkin, scheme as MenuScheme, '/explore/floors/f0');
        const map = page.locator('explore-floor-map');
        const toggle = map.locator('[data-view-3d]');
        await expect(toggle).toBeAttached({ timeout: 30000 });
        await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
        await toggle.click();
        const el = map.locator('sw-plan-3d[data-floor-3d]');
        await expect(el).toHaveAttribute('data-ready', '', { timeout: 40000 });
        await whenQuiet(page);
        // the shared controls on the bar float on the canvas with no box of their own: opaque in every state - the preset that is on (accent fill),
        // the ones that are not (the surface), the camera select, the export button
        await expectOpaqueControl(el.locator('[data-preset-iso] button'), `view chip on ${skin}/${scheme}`, { token: false });
        await expectOpaqueControl(el.locator('[data-preset-top] button'), `view chip ${skin}/${scheme}`, { token: false });
        await expectOpaqueControl(el.locator('[data-preset-camera]'), `camera select ${skin}/${scheme}`, { token: false });
        await expectOpaqueControl(el.locator('[data-export-gltf] button'), `export button ${skin}/${scheme}`, { token: false });
        await el.locator('[data-preset-top]').hover(); // the hover fill of a chip is the surface washed towards the ink (an opaque mix): still opaque
        await expectOpaqueControl(el.locator('[data-preset-top] button'), `hovered view chip ${skin}/${scheme}`, { token: false });
        // the entity pills over the scene (the demo floor has lights, a lock and sensors)
        const pill = el.locator('[data-3d-label]:visible').first(); // a pill the frame loop has placed on screen
        await expect(pill).toBeVisible({ timeout: 15000 });
        await expectOpaqueHud(pill, `entity pill ${skin}/${scheme}`);
        if (!isPhone(info)) await hudShot(page, `after-demo3d-${skin}-${scheme}-1440`);
        // the realistic level: the time pill (its picker is a menu: opaque as well)
        await el.locator('[data-quality-3]').evaluate((c) => (c as HTMLElement).click());
        const time = el.locator('[data-3d-time]');
        await expect(time).toBeVisible({ timeout: 60000 });
        await whenQuiet(page); // the realistic level compiles its post chain on the main thread (software GL): the page answers again when that is done
        await expectOpaqueHud(time, `time pill ${skin}/${scheme}`);
        await time.locator('[data-3d-time-toggle]').evaluate((b) => (b as HTMLElement).click());
        await expectOpaqueHud(el.locator('[data-3d-time-pop]'), `time picker ${skin}/${scheme}`, true, false); // a menu over the dark canvas: its fill is its edge
        if (!isPhone(info)) await hudShot(page, `after-demotime-${skin}-${scheme}-1440`);
      });

      test(`walk: the walk bar (desktop) and its bottom sheet (phone) - ${skin} / ${scheme}`, async ({ page }, info) => {
        test.setTimeout(150_000);
        await page.clock.setFixedTime(new Date('2026-10-13T10:00:00Z'));
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}&look=performance:full#/styleguide`);
        await page.locator('styleguide-screen [data-3d-demo-load]').click();
        const el = page.locator('styleguide-screen sw-plan-3d');
        await expect(el).toHaveAttribute('data-ready', '', { timeout: 40000 });
        const desc = buildScene({ ...walkInput(walkDoc(), { 'binary_sensor.d1': 'on' }, [walkCamera]), catalog: walkCatalog, walk: true });
        await el.evaluate((n, d) => {
          const w = n as unknown as { minFps: number; walkable: boolean; description: unknown; startWalk(s: unknown): void };
          w.minFps = 0;
          w.walkable = true;
          w.description = d;
        }, desc);
        await el.scrollIntoViewIfNeeded();
        await el.evaluate((n) => (n as unknown as { startWalk(s: unknown): void }).startWalk({ id: 'start', kind: 'centre', label: '', level: 'L0', x: 3, z: 4, heading_deg: 90, pitch_deg: 0, eye_m: null }));
        await expect(el).toHaveAttribute('data-walk', '');
        const bar = el.locator(isPhone(info) ? '[data-walk-sheet]' : '.walkbar');
        await expect(bar).toBeVisible();
        await expectOpaqueHud(bar, `walk ${isPhone(info) ? 'sheet' : 'bar'} ${skin}/${scheme}`, true, !isPhone(info)); // the phone sheet is a menu over the dark canvas, the bar a panel with the strong hairline
      });
    }
  }
});
