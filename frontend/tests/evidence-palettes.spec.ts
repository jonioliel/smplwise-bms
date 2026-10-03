import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Release 0.1.156: the palette loader and the editor in הגדרות › כללי › מראה (static demo mode; the backend side is test_palettes.py).
//   1. the palette dial belongs to the installation's system administrator only: a ready palette chosen there (saved with the button) is in
//      force on <html> (data attribute + inline tokens), per scheme, ignored by the other skins, keeps the glass above the palette's own
//      minimum opacity; a personal palette override does not exist (no row on "ההעדפה שלי", a stored one is ignored);
//   2. the editor: recommended swatches + a free picker for every key colour (accent first); a palette that fails the contrast checks is
//      only WARNED about (Hebrew, worst pairs, one-click auto-fix) and can still be saved and applied; a good one is saved as a custom
//      palette, becomes an option of the dial, applies, survives a reload and can be deleted;
//   3. the dark scheme's accent is lighter than the light one's, whatever a custom palette stores;
//   4. evidence shots -> docs/design/evidence/palettes/
// Needs the Vite DEV server (the specs import /src/design/palette.ts):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5201      then
//   SW_BASE_URL=http://127.0.0.1:5201/ npx playwright test tests/evidence-palettes.spec.ts --project=desktop --project=mobile --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/palettes');

const attr = (page: Page, a: string) => page.evaluate((n) => document.documentElement.getAttribute(n), a);
const inline = (page: Page, v: string) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), v);
const lookCard = (page: Page) => page.locator('sw-app system-diagnostics system-look');
const editor = (page: Page) => page.locator('sw-app system-diagnostics system-look system-palette-editor');
const paletteAccent = (page: Page, id: string, scheme: 'light' | 'dark') =>
  page.evaluate(async ([url, i, s]) => {
    const mod = await import(/* @vite-ignore */ url as string);
    return mod.effectiveScheme(mod.paletteById(i), s).accent as string;
  }, ['/src/design/palette.ts', id, scheme] as const);

async function open(page: Page, query = '', skin = 'bubble') {
  await page.clock.setFixedTime(new Date('2026-10-02T13:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}${query}#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await expect(lookCard(page)).toBeVisible();
  await page.waitForTimeout(500);
}

/** The installation's palette, chosen on "ברירת המחדל של ההתקנה" and saved (the only place a palette is chosen). */
async function choose(page: Page, id: string) {
  const card = lookCard(page);
  await card.locator('[data-look-target="installation"]').click();
  await card.locator(`[data-look-option="palette:${id}"]`).click();
  await card.locator('[data-look-save]').click();
  await expect.poll(() => attr(page, 'data-bubble-palette')).toBe(id);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

test.describe('bubble palettes', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('look-keep')) {
          localStorage.removeItem('sw.ui.look');
          localStorage.removeItem('sw.ui.look.installation');
          localStorage.removeItem('sw.ui.palettes');
        }
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('only the installation chooses the palette: the dial offers default and all ten, saved it is in force for the scheme, there is no personal override', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the card is one component on every width');
    await open(page, '&scheme=light');
    const card = lookCard(page);
    // "ההעדפה שלי": the other eight dials, no palette row at all
    await expect(card.locator('[data-look-row]')).toHaveCount(8);
    await expect(card.locator('[data-look-row="palette"]')).toHaveCount(0);
    await expect(card.locator('[data-look-follow="palette"]')).toHaveCount(0);
    // a personal palette left in the browser store by an older version is ignored
    await card.locator('[data-look-option="density:compact"]').click(); // a real personal dial (writes the user's cache entry)
    await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem('sw.ui.look') as string) as { u: string | null; look: Record<string, unknown> };
      c.look.palette = 'sunset';
      localStorage.setItem('sw.ui.look', JSON.stringify(c));
    });
    await page.evaluate(() => sessionStorage.setItem('look-keep', '1'));
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(400);
    expect(await attr(page, 'data-bubble-palette')).toBe('default');
    expect(await attr(page, 'data-bubble-density')).toBe('compact'); // the other personal dials stay
    expect(await inline(page, '--sw-accent')).toBe('');
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
    await open(page, '&scheme=light');
    // the installation: ten + default, a draft until saved
    await card.locator('[data-look-target="installation"]').click();
    await expect(card.locator('[data-look-row="palette"] [data-look-option]')).toHaveCount(11);
    await expect(card.locator('[data-look-row]')).toHaveCount(9);
    await card.locator('[data-look-option="palette:forest"]').click();
    expect(await attr(page, 'data-bubble-palette')).toBe('default');
    await card.locator('[data-look-save]').click();
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe('forest');
    expect(await inline(page, '--sw-accent')).toBe(await paletteAccent(page, 'forest', 'light'));
    expect(await inline(page, '--sw-sheet-rgb')).toMatch(/^\d+, \d+, \d+$/);
    // the gradient washes keep their text readable: the three shares are on the page
    expect(await inline(page, '--sw-wash-start')).toMatch(/^\d+%$/);
    await expect(card.locator('[data-look-row="palette"] [data-look-option="palette:forest"]')).toHaveAttribute('aria-pressed', 'true');
    // it survives a reload and follows the dark scheme (its lighter accent)
    await page.evaluate(() => sessionStorage.setItem('look-keep', '1'));
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(400);
    expect(await attr(page, 'data-bubble-palette')).toBe('forest');
    await open(page, '&scheme=dark');
    expect(await inline(page, '--sw-accent')).toBe(await paletteAccent(page, 'forest', 'dark'));
    // the accessibility palette keeps the glass nearly opaque whatever the transparency dial says
    await choose(page, 'high-contrast');
    const alpha = Number(await inline(page, '--sw-sheet-alpha'));
    expect(alpha).toBeGreaterThanOrEqual(0.88);
    // another skin ignores the dial: no palette colours on the page
    await open(page, '', 'classic');
    expect(await inline(page, '--sw-accent')).toBe('');
    // back to the skin's own colours
    await open(page, '&scheme=light');
    await choose(page, 'default');
    expect(await inline(page, '--sw-accent')).toBe('');
    expect(await inline(page, '--sw-bg')).toBe('');
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
  });

  test('the editor warns about low contrast (Hebrew, worst pairs, auto-fix) but still saves; recommended swatches and a free picker, accent first', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough for the flow');
    await open(page, '&scheme=light');
    const card = lookCard(page);
    await card.locator('[data-look-target="installation"]').click();
    const ed = editor(page);
    await ed.locator('[data-palette-new]').click();
    await expect(ed.locator('[data-palette-editor]')).toBeVisible();
    await expect(ed.locator('[data-palette-save][disabled]')).toHaveCount(1); // no name yet
    await ed.locator('[data-palette-name]').fill('בדיקה');
    await expect(ed.locator('[data-palette-save]:not([disabled])')).toHaveCount(1); // the base palette passes
    await expect(ed.locator('[data-palette-warning]')).toHaveCount(0);
    // the accent is the first key colour; recommended swatches and a free picker
    await expect(ed.locator('[data-palette-key]').first()).toHaveAttribute('data-palette-key', 'accent');
    const swatches = ed.locator('[data-palette-key="accent"] [data-palette-swatch]');
    expect(await swatches.count()).toBeGreaterThanOrEqual(5);
    await swatches.nth(1).click();
    await expect(swatches.nth(1)).toHaveAttribute('aria-pressed', 'true');
    const picked = (await swatches.nth(1).getAttribute('data-palette-swatch'))!.split(':')[1];
    await expect(ed.locator('[data-palette-color="accent"]')).toHaveValue(picked);
    await swatches.nth(0).click(); // back to the base palette's own accent, so the flow below starts from a passing palette
    await expect(swatches.nth(0)).toHaveAttribute('aria-pressed', 'true');
    // light text on the light surface: below 4.5:1 -> a warning, saving stays allowed
    await ed.locator('[data-palette-color="textMuted"]').fill('#c8cfdc');
    const warn = ed.locator('[data-palette-warning]');
    await expect(warn).toBeVisible();
    await expect(warn).toContainText('אזהרה: ניגודיות נמוכה מדי');
    await expect(warn).toContainText('(נדרש 4.5:1)');
    await expect(ed.locator('[data-palette-invalid]')).toHaveCount(0);
    await expect(ed.locator('[data-palette-save]:not([disabled])')).toHaveCount(1);
    // the one-click fix moves the failing colours to passing values
    await ed.locator('[data-palette-autofix]').click();
    await expect(warn).toHaveCount(0);
    await expect(ed.locator('[data-palette-save]:not([disabled])')).toHaveCount(1);
    // break it again and SAVE with the warning: it is stored and is an option of the dial
    await ed.locator('[data-palette-color="textMuted"]').fill('#c8cfdc');
    await expect(warn).toBeVisible();
    await ed.locator('[data-palette-save]').click();
    await expect(ed.locator('[data-palette-message]')).toBeVisible();
    const opt = card.locator('[data-look-option^="palette:custom-"]');
    await expect(opt).toHaveCount(1);
    await expect(opt).toContainText('בדיקה');
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))) as string) as { id: string; schemes: { light: { accent: string; textMuted: string } } }[];
    expect(stored).toHaveLength(1);
    expect(stored[0].schemes.light.textMuted).toBe('#c8cfdc');
    // choose it for everybody: applied although it warns
    await opt.click();
    await card.locator('[data-look-save]').click();
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe(stored[0].id);
    await expect.poll(() => inline(page, '--sw-text-2')).toBe('#c8cfdc');
    // "save as": the copy gets a NEW custom id and the original stays; the base 'default' is never in the editor's list
    await ed.locator(`[data-palette-edit="${stored[0].id}"]`).click();
    await ed.locator('[data-palette-save-as]').click();
    await expect(card.locator('[data-look-option^="palette:custom-"]')).toHaveCount(2);
    const ids = JSON.parse((await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))) as string).map((p: { id: string }) => p.id) as string[];
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(stored[0].id);
    expect(ids.every((i) => i.startsWith('custom-'))).toBe(true);
    await expect(ed.locator('[data-palette-delete="default"], [data-palette-edit="default"]')).toHaveCount(0);
    const copy = ids.find((i) => i !== stored[0].id)!;
    await ed.locator(`[data-palette-delete="${copy}"]`).click();
    await ed.locator(`[data-palette-delete="${copy}"]`).click();
    await expect(card.locator('[data-look-option^="palette:custom-"]')).toHaveCount(1);
    // delete it (two steps): the dial falls back to the skin's colours
    await ed.locator(`[data-palette-delete="${stored[0].id}"]`).click();
    await ed.locator(`[data-palette-delete="${stored[0].id}"]`).click();
    await expect(card.locator('[data-look-option^="palette:custom-"]')).toHaveCount(0);
    await expect.poll(() => inline(page, '--sw-accent')).toBe('');
    expect(await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))).toBeNull();
  });

  test('a custom palette lives in the browser store: it is applied after a reload even with low contrast; a structurally broken one is dropped, never applied; the dark accent is lifted', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await open(page, '&scheme=dark');
    const [low, broken] = await page.evaluate(async () => {
      const url = '/src/design/palette.ts';
      const mod = await import(/* @vite-ignore */ url);
      const a =JSON.parse(JSON.stringify(mod.paletteById('calm-blue')));
      a.id = 'custom-low';
      a.name = { he: 'ניגודיות נמוכה', en: 'Low' };
      a.schemes.light.text = '#e0e0e0';
      a.schemes.dark.accent = '#10204a'; // darker than the light accent: the dark scheme lifts it
      const b = JSON.parse(JSON.stringify(mod.paletteById('calm-blue')));
      b.id = 'custom-broken';
      b.name = { he: 'פגומה', en: 'Broken' };
      delete b.schemes.dark.accent;
      return [a, b];
    });
    await page.evaluate(
      ([a, b]) => {
        sessionStorage.setItem('look-keep', '1');
        localStorage.setItem('sw.ui.palettes', JSON.stringify([a, b]));
        localStorage.setItem('sw.ui.look.installation', JSON.stringify({ palette: 'custom-low' }));
      },
      [low, broken],
    );
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(500);
    const lightText = await page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-text').trim());
    expect(lightText).not.toBe(''); // applied (low contrast only warns)
    const accent = await inline(page, '--sw-accent');
    expect(accent).not.toBe('#10204a');
    const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    expect(lum(accent)).toBeGreaterThan(lum(await page.evaluate(() => JSON.parse(localStorage.getItem('sw.ui.palettes') as string)[0].schemes.light.accent)));
    await expect(lookCard(page).locator('[data-look-target="installation"]')).toBeVisible();
    await lookCard(page).locator('[data-look-target="installation"]').click();
    await expect(lookCard(page).locator('[data-look-option="palette:custom-low"]')).toHaveCount(1);
    await expect(lookCard(page).locator('[data-look-option="palette:custom-broken"]')).toHaveCount(0); // dropped
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
  });

  test('evidence shots: the palette row and the editor, light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    const w = info.project.name === 'mobile' ? 390 : 1440;
    await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
    for (const [scheme, id] of [['light', 'purple-rose'], ['dark', 'deep-ocean']] as const) {
      await open(page, `&scheme=${scheme}`);
      await choose(page, id);
      await page.waitForTimeout(300);
      await lookCard(page).locator('[data-look-row="palette"]').scrollIntoViewIfNeeded();
      await shot(page, `settings-palette-${id}-${w}-${scheme}`);
      await editor(page).locator('[data-palette-new]').click();
      await editor(page).locator('[data-palette-name]').fill('ערכה שלי');
      await editor(page).locator('[data-palette-scheme="dark"]').click();
      await editor(page).locator('[data-palette-editor]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot(page, `editor-${w}-${scheme}`);
    }
  });
});
