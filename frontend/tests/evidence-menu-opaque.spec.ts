import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEVICE_PALETTES } from '../src/styles/devices-palettes';
import { BUILTIN_PALETTES } from '../src/design/palette';
import { MENU_SCHEMES, MENU_SKINS, expectOpaqueMenu, mountDropdowns, openApp, rgbText, type MenuScheme, type MenuSkin } from './menu-opaque-harness';

// Menus are never see-through (owner 2026-10-13: the user menu was half transparent over the building tree in the glass look and the
// texts overlapped). A menu is opened for real - in every skin x scheme, on the desktop popover and the phone's bottom sheet, inside the glass
// device screens in every palette, under the look dials that used to thin a list out - and what it paints is READ from the browser: the
// background alpha is 1, the colour IS the menu token, no backdrop-filter, nothing above it fades it.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-menu-opaque.spec.ts --workers=1 --project=desktop --project=mobile
// The static twin is tests/unit-menu-lint.spec.ts (it scans the CSS of the menu components), the token twin tests/unit-menu-surfaces.spec.ts.

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

  for (const skin of ['domus', 'bubble', 'crystal'] as const) {
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
      }
    }
  });
});
