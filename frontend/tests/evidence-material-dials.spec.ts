import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBubbleMock } from './bubble-mocks';

// MD1 material dials, phase 2 (owner decision 2026-10-03: build the approved mockups of docs/design/compare/material-dials
// without the Chalk preset): the `material` presets Frosted / Paper / Neon, the `depth` and `tint` dials of ui.look.
//   1. evidence shots -> docs/design/evidence/material-dials/: the home (mocked backend), the area on the glass surface, the
//      components' demo page and the settings card, per preset, at 390 / 820 / 1440, light and dark; depth + tint alone; three
//      palettes; the domus skin's cards; the strong setting.
//   2. the dials apply: the attributes and the numbers on <html>; with every dial off every material layer is invisible (today's pixels);
//   3. the lead's reservations, in code: neon never glows around a state tone and never in a list; the wash is capped by the
//      computed contrast floor; no backdrop-filter on a tile in the lite tier under any preset; the chrome keeps its blur;
//   4. the settings card: a preset is a macro (writes depth, tint and the suggested transparency), the dials stay free afterwards.
// Needs the Vite DEV server (the dials go through /src/design/look.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5215      then
//   SW_BASE_URL=http://127.0.0.1:5215/ npx playwright test tests/evidence-material-dials.spec.ts --project=desktop --project=mobile --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/material-dials');
const LOOK_URL = '/src/design/look.ts';

const attr = (page: Page, a: string) => page.evaluate((n) => document.documentElement.getAttribute(n), a);
const rootVar = (page: Page, v: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);
const lookCard = (page: Page) => page.locator('sw-app system-diagnostics system-look');
const area = (page: Page) => page.locator('sw-app devices-area');
const pill = (page: Page, id: string) => area(page).locator(`sw-pill[data-entity="${id}"]`);

async function open(page: Page, hash: string, query = '', skin = 'bubble') {
  await page.clock.setFixedTime(new Date('2026-10-03T13:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

/** Every colour of a computed shadow / image list with its alpha (rgba(...) and rgb(...) only; transparent counts as alpha 0). */
function alphas(computed: string): number[] {
  const out: number[] = [];
  const num = (s: string | undefined) => (s === undefined ? 1 : s.endsWith('%') ? Number(s.slice(0, -1)) / 100 : Number(s));
  for (const m of computed.matchAll(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+%?)\s*)?\)/g)) out.push(num(m[1]));
  // color-mix() results serialise as color(srgb r g b / a) (or oklab / lab); a missing alpha is 1
  for (const m of computed.matchAll(/\b(?:color|oklab|lab|oklch|lch)\(\s*[a-z-]*\s*[-\d.e% ]+?(?:\/\s*([\d.]+%?))?\s*\)/g)) out.push(num(m[1]));
  for (const _ of computed.matchAll(/\btransparent\b/g)) out.push(0);
  return out;
}
const computedOf = (loc: ReturnType<Page['locator']>, prop: string) => loc.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
/** The last shadow of a box-shadow list (the neon bloom is the last layer of the material formula). */
const lastShadow = (s: string) => s.split(/,(?![^(]*\))/).map((x) => x.trim()).pop() ?? '';

const PRESETS = ['none', 'frosted', 'paper', 'neon'] as const;
const lookQ = (preset: (typeof PRESETS)[number], extra = '') => `&look=material:${preset},depth:1,tint:1${extra}`;

test.describe('material dials', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked / demo spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('look-keep')) {
          localStorage.removeItem('sw.ui.look');
          localStorage.removeItem('sw.ui.look.installation');
        }
        localStorage.removeItem('sw.devices.treeCollapsed');
        localStorage.removeItem('sw.devices.layout');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('evidence shots: home, area (glass), demo page and the settings card per preset; depth + tint alone; palettes; domus; strong', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    test.setTimeout(15 * 60_000);
    const widths = info.project.name === 'mobile' ? [390] : [1440, 820];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
      for (const scheme of ['light', 'dark'] as const) {
        const q = `&scheme=${scheme}`;
        await installBubbleMock(page);
        for (const preset of PRESETS) {
          await open(page, '/devices/building', q + lookQ(preset));
          await expect(page.locator('html')).toHaveAttribute('data-bubble-material', preset);
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          await shot(page, `home-${preset}-${w}-${scheme}`);
          if (preset === 'frosted' || preset === 'neon') {
            await open(page, '/devices/areas/living', q + lookQ(preset, ',surface:glass'));
            await expect(pill(page, 'light.living_main')).toBeVisible();
            await shot(page, `area-glass-${preset}-${w}-${scheme}`);
          }
        }
        // depth and tint alone (the mockups' third overlap box) and the strong setting
        await open(page, '/devices/building', `${q}&look=depth:1,tint:1`);
        await shot(page, `home-depth-tint-only-${w}-${scheme}`);
        await open(page, '/devices/building', `${q}&look=material:frosted,depth:2,tint:2`);
        await shot(page, `home-frosted-strong-${w}-${scheme}`);
        // three palettes under frosted and neon (the installation's palette through the page override)
        if (w !== 820) {
          for (const pal of ['amber-sand', 'deep-ocean', 'high-contrast']) {
            for (const preset of ['frosted', 'neon'] as const) {
              await open(page, '/devices/building', `${q}&look=material:${preset},depth:1,tint:1,palette:${pal}`);
              await expect(page.locator('html')).toHaveAttribute('data-bubble-palette', pal);
              await shot(page, `home-${preset}-${pal}-${w}-${scheme}`);
            }
          }
        }
        await page.unroute('**/api/v1/**');
        // the components' demo page and the settings card (static demo)
        for (const preset of PRESETS) {
          await open(page, '/styleguide/bubble', q + lookQ(preset, ',surface:glass'));
          await shot(page, `demo-glass-${preset}-${w}-${scheme}`);
        }
        await open(page, '/system/diagnostics', q + lookQ('frosted'));
        await lookCard(page).evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(300);
        await shot(page, `settings-look-material-${w}-${scheme}`);
        // the domus skin shares the token layer: its cards take the rim and the lift
        await open(page, '/system/diagnostics', q + lookQ('frosted'), 'domus');
        await shot(page, `domus-settings-frosted-${w}-${scheme}`);
      }
    }
  });

  test('the dials apply on <html>; every dial off = every material layer invisible (today\'s pixels); the wash cap is the computed contrast floor', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough for the numbers');
    await open(page, '/styleguide/bubble', '&scheme=light');
    expect([await attr(page, 'data-bubble-material'), await attr(page, 'data-bubble-depth'), await attr(page, 'data-bubble-tint')]).toEqual(['none', '0', '0']);
    expect(await rootVar(page, '--sw-m-depth')).toBe('0');
    expect(await rootVar(page, '--sw-m-tint')).toBe('0');
    const demoPill = page.locator('sw-app bubble-demo [data-demo-grid] sw-pill');
    for (const prop of ['box-shadow', 'background-image']) {
      const v = await computedOf(demoPill, prop);
      const a = alphas(v);
      expect(a.length, `${prop}: ${v.slice(0, 120)}`).toBeGreaterThan(0);
      expect(Math.max(...a), `${prop} with the dials off must be invisible: ${v.slice(0, 160)}`).toBe(0);
    }
    // the same for a card (the settings screen): no rim, no lift, no layer with the dials off
    await open(page, '/system/diagnostics', '&scheme=light');
    const card = lookCard(page).locator('sw-card').first();
    for (const prop of ['box-shadow', 'background-image']) {
      const v = await computedOf(card, prop);
      expect(Math.max(0, ...alphas(v)), `card ${prop} with the dials off must be invisible: ${v.slice(0, 160)}`).toBe(0);
    }
    await open(page, '/styleguide/bubble', '&scheme=light');
    // the dials on: the attributes, the preset's numbers, the multipliers
    await open(page, '/styleguide/bubble', '&scheme=light&look=material:neon,depth:2,tint:2,surface:glass');
    expect([await attr(page, 'data-bubble-material'), await attr(page, 'data-bubble-depth'), await attr(page, 'data-bubble-tint')]).toEqual(['neon', '2', '2']);
    expect(await rootVar(page, '--sw-m-glow')).toBe('16px');
    expect(await rootVar(page, '--sw-m-depth')).toBe('1.8');
    expect(await rootVar(page, '--sw-m-tint')).toBe('1.8');
    expect(await rootVar(page, '--sw-m-blur')).toBe('14px');
    // the rim and the lift are drawn now (non-zero alphas), the glass pill keeps its blur in the full tier at the preset's radius
    const sh = await computedOf(demoPill, 'box-shadow');
    expect(Math.max(...alphas(sh)), sh).toBeGreaterThan(0);
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).saveOwnLook({ material: 'frosted', depth: 1, tint: 1, surface: 'glass', performance: 'full' }), LOOK_URL);
    await page.waitForTimeout(200);
    expect(await computedOf(demoPill, 'backdrop-filter')).toContain('blur(20px)');
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).saveOwnLook({ material: 'paper', depth: 1, tint: 1, surface: 'glass', performance: 'full' }), LOOK_URL);
    await page.waitForTimeout(200);
    expect(await computedOf(demoPill, 'backdrop-filter')).toContain('blur(0px)');
    // the wash cap on <html> is the contrast floor of the skin x palette x scheme in force (design/contrast.ts), inside the dial's range
    const cap = await page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-m-wash-cap').trim());
    expect(cap).toMatch(/^\d+%$/);
    const capN = parseInt(cap, 10);
    expect(capN).toBeGreaterThanOrEqual(14);
    expect(capN).toBeLessThanOrEqual(62);
    const computedCap = await page.evaluate(async (url) => {
      const c = await import(/* @vite-ignore */ url as string);
      const v = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      return c.washCap(c.washModelOf(v)) as number;
    }, '/src/design/contrast.ts');
    expect(capN).toBe(computedCap);
    // dark scheme: a cap of its own
    await open(page, '/styleguide/bubble', '&scheme=dark&look=material:frosted,depth:1,tint:1');
    const capDark = await page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-m-wash-cap').trim());
    expect(capDark).toMatch(/^\d+%$/);
    expect(parseInt(capDark, 10)).toBeGreaterThanOrEqual(14);
  });

  test('neon: the bloom only around a tile with a decorative tone, never a state tone, never in a list; lists take the side stripe; the lite tier never blurs a tile; the chrome keeps its blur', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the numbers are the same on every width');
    // the settings preview carries a hue pill (on) and a KPI tile with a state tone, side by side under the same dials
    await open(page, '/system/diagnostics', '&scheme=light&look=material:neon,depth:1,tint:1,surface:glass,performance:full');
    const card = lookCard(page);
    await expect(card).toBeVisible();
    const previewPill = card.locator('[data-preview-pill]');
    const previewKpi = card.locator('[data-preview-kpi]');
    const glowPill = lastShadow(await computedOf(previewPill, 'box-shadow'));
    const glowKpi = lastShadow(await computedOf(previewKpi, 'box-shadow'));
    expect(Math.max(...alphas(glowPill)), `hue pill bloom: ${glowPill}`).toBeGreaterThan(0);
    expect(Math.max(...alphas(glowKpi)), `state-toned KPI must not glow: ${glowKpi}`).toBe(0);
    // the KPI's wash is there (its state carries a tone), the pill's too; both texts still read (the cap)
    const kpiBg = await computedOf(previewKpi, 'background-image');
    expect(Math.max(...alphas(kpiBg)), kpiBg.slice(0, 200)).toBeGreaterThan(0);
    // the area in the list density: no bloom, a 6 px tone stripe on an "on" pill, none on an off one
    await installBubbleMock(page);
    await open(page, '/devices/areas/living', '&scheme=light&look=material:neon,depth:1,tint:1,surface:glass,density:row,performance:full');
    await expect(pill(page, 'light.living_main')).toBeVisible();
    const rowGlow = lastShadow(await computedOf(pill(page, 'light.living_main'), 'box-shadow'));
    expect(Math.max(...alphas(rowGlow)), `list bloom: ${rowGlow}`).toBe(0);
    expect(await computedOf(pill(page, 'light.living_main'), 'border-inline-start-width')).toBe('6px');
    expect(await computedOf(pill(page, 'light.living_read'), 'border-inline-start-width')).toBe('0px');
    // tint off: no stripe either
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).saveOwnLook({ material: 'neon', depth: 1, tint: 0, surface: 'glass', density: 'row', performance: 'full' }), LOOK_URL);
    await page.waitForTimeout(200);
    expect(await computedOf(pill(page, 'light.living_main'), 'border-inline-start-width')).toBe('0px');
    // the lite tier: no backdrop-filter on a glass pill under any preset; the rail keeps its blur
    for (const preset of PRESETS) {
      await page.evaluate(async ([url, m]) => (await import(/* @vite-ignore */ url as string)).saveOwnLook({ material: m, depth: 1, tint: 1, surface: 'glass', performance: 'lite' }), [LOOK_URL, preset] as const);
      await page.waitForTimeout(200);
      await expect(page.locator('html')).toHaveAttribute('data-bubble-performance', 'lite');
      expect(await computedOf(pill(page, 'light.living_main'), 'backdrop-filter'), `lite ${preset}`).toBe('none');
      expect(await computedOf(page.locator('sw-app nav.rail'), 'backdrop-filter'), `rail ${preset}`).toContain('blur(');
    }
    // the gradient surface: no wash on a pill (two colours would fight), the rim stays
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).saveOwnLook({ material: 'frosted', depth: 1, tint: 2, surface: 'gradient', performance: 'full' }), LOOK_URL);
    await page.waitForTimeout(200);
    const t = await pill(page, 'light.living_main').evaluate((el) => getComputedStyle(el).getPropertyValue('--sw-m-t').trim());
    expect(t).toMatch(/\*\s*0\)?$/); // the tile's own switch is 0 under the gradient surface
  });

  test('the settings card: a preset is a macro over the dials (depth, tint, transparency), the dials stay free; "לפי ההתקנה" per dial; the installation default saves with the button', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the card is the same component on a phone');
    await open(page, '/system/diagnostics', '&scheme=light');
    const card = lookCard(page);
    await expect(card).toBeVisible();
    for (const d of ['material', 'depth', 'tint']) await expect(card.locator(`[data-look-row="${d}"]`)).toHaveCount(1);
    await expect(card.locator('[data-look-option="material:chalk"]')).toHaveCount(0);
    // my preference: frosted writes depth 1, tint 1 and 62 % at once
    await card.locator('[data-look-option="material:frosted"]').click();
    await expect(card.locator('[data-look-message]')).toBeVisible();
    await expect.poll(() => attr(page, 'data-bubble-material')).toBe('frosted');
    expect(await attr(page, 'data-bubble-depth')).toBe('1');
    expect(await attr(page, 'data-bubble-tint')).toBe('1');
    await expect(card.locator('[data-look-range="transparency"]')).toHaveValue('62');
    // the dials are free afterwards: depth 2 keeps the preset, none keeps the depth
    await card.locator('[data-look-option="depth:2"]').click();
    await expect.poll(() => attr(page, 'data-bubble-depth')).toBe('2');
    expect(await attr(page, 'data-bubble-material')).toBe('frosted');
    await card.locator('[data-look-option="material:none"]').click();
    await expect.poll(() => attr(page, 'data-bubble-material')).toBe('none');
    expect(await attr(page, 'data-bubble-depth')).toBe('2');
    // paper suggests 96 %, keeps depth 2
    await card.locator('[data-look-option="material:paper"]').click();
    await expect.poll(() => attr(page, 'data-bubble-material')).toBe('paper');
    expect(await attr(page, 'data-bubble-depth')).toBe('2');
    await expect(card.locator('[data-look-range="transparency"]')).toHaveValue('96');
    // back to the installation for every dial
    await card.locator('[data-look-clear-own]').click();
    await expect.poll(() => attr(page, 'data-bubble-material')).toBe('none');
    expect(await attr(page, 'data-bubble-depth')).toBe('0');
    // the installation default (demo mode): a draft until saved, the preview follows the draft
    await card.locator('[data-look-target="installation"]').click();
    await card.locator('[data-look-option="material:neon"]').click();
    expect(await attr(page, 'data-bubble-material')).toBe('none'); // a draft
    await expect(card.locator('[data-look-preview]')).toHaveAttribute('data-bubble-material', 'neon');
    await expect(card.locator('[data-look-preview]')).toHaveAttribute('data-bubble-depth', '1');
    await card.locator('[data-look-save]').click();
    await expect.poll(() => attr(page, 'data-bubble-material')).toBe('neon');
    expect(await attr(page, 'data-bubble-tint')).toBe('1');
    await page.evaluate(() => sessionStorage.setItem('look-keep', '1'));
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(400);
    expect(await attr(page, 'data-bubble-material')).toBe('neon'); // survives a reload
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
  });

  test('the classic skin draws none of it, whatever the dials say', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width');
    await open(page, '/system/diagnostics', '&scheme=light&look=material:neon,depth:2,tint:2', 'classic');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'classic');
    const card = page.locator('sw-app sw-card').first();
    const sh = await computedOf(card, 'box-shadow');
    expect(sh).not.toContain('inset'); // classic's shadow-1, no rim
    expect(await computedOf(card, 'background-image')).toBe('none');
  });
});
