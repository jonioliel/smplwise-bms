import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Release 0.1.156: the palette loader and the editor in הגדרות › כללי › מראה (static demo mode; the backend side is test_palettes.py).
//   1. the palette dial: a ready palette is in force on <html> (data attribute + inline tokens), per scheme, per user, follows the
//      installation again on "לפי ההתקנה", is ignored by the other skins, and keeps the glass above the palette's own minimum opacity;
//   2. the editor: a palette that fails the contrast checks is refused with a Hebrew message, never saved and never applied; a good one
//      is saved as a custom palette, becomes an option of the dial, applies, survives a reload and can be deleted;
//   3. evidence shots -> docs/design/evidence/palettes/
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
    return mod.paletteById(i).schemes[s as string].accent as string;
  }, ['/src/design/palette.ts', id, scheme] as const);

async function open(page: Page, query = '') {
  await page.clock.setFixedTime(new Date('2026-10-02T13:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble${query}#/system/diagnostics`);
  await page.waitForSelector('sw-app');
  await expect(lookCard(page)).toBeVisible();
  await page.waitForTimeout(500);
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

  test('the dial offers default and all ten palettes; choosing one puts its colours on the page for the scheme in force, per user, and clearing restores the skin', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the card is one component on every width');
    await open(page, '&scheme=light');
    const card = lookCard(page);
    await expect(card.locator('[data-look-row]')).toHaveCount(9);
    await expect(card.locator('[data-look-row="palette"] [data-look-option]')).toHaveCount(11);
    expect(await inline(page, '--sw-accent')).toBe(''); // default: the skin's own colours, nothing inline
    await card.locator('[data-look-option="palette:forest"]').click();
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe('forest');
    expect(await inline(page, '--sw-accent')).toBe(await paletteAccent(page, 'forest', 'light'));
    expect(await inline(page, '--sw-sheet-rgb')).toMatch(/^\d+, \d+, \d+$/);
    await expect(card.locator('[data-look-row="palette"] [data-look-option="palette:forest"]')).toHaveAttribute('aria-pressed', 'true');
    // it survives a reload (the user's own look is cached) and follows the dark scheme
    await page.evaluate(() => sessionStorage.setItem('look-keep', '1'));
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(400);
    expect(await attr(page, 'data-bubble-palette')).toBe('forest');
    await open(page, '&scheme=dark');
    expect(await inline(page, '--sw-accent')).toBe(await paletteAccent(page, 'forest', 'dark'));
    // the accessibility palette keeps the glass nearly opaque whatever the transparency dial says
    await lookCard(page).locator('[data-look-option="palette:high-contrast"]').click();
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe('high-contrast');
    const alpha = Number(await inline(page, '--sw-sheet-alpha'));
    expect(alpha).toBeGreaterThanOrEqual(0.88);
    // another skin ignores the dial: no palette colours on the page
    await open(page, '&skin=classic');
    expect(await inline(page, '--sw-accent')).toBe('');
    // "לפי ההתקנה": the palette is gone and the skin's own colours are back
    await open(page, '&scheme=light');
    await lookCard(page).locator('[data-look-follow="palette"]').click();
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe('default');
    expect(await inline(page, '--sw-accent')).toBe('');
    expect(await inline(page, '--sw-bg')).toBe('');
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
  });

  test('the editor refuses a palette that fails the contrast checks (Hebrew message, nothing saved, nothing applied) and saves a good one as a custom palette', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one width is enough for the flow');
    await open(page, '&scheme=light');
    const card = lookCard(page);
    await card.locator('[data-look-target="installation"]').click();
    const ed = editor(page);
    await ed.locator('[data-palette-new]').click();
    await expect(ed.locator('[data-palette-editor]')).toBeVisible();
    await expect(ed.locator('[data-palette-save]')).toBeDisabled(); // no name yet
    await ed.locator('[data-palette-name]').fill('בדיקה');
    await expect(ed.locator('[data-palette-save]')).toBeEnabled(); // the base palette passes
    await expect(ed.locator('[data-palette-invalid]')).toHaveCount(0);
    // light text on the light surface: below 4.5:1
    await ed.locator('[data-palette-color="textMuted"]').fill('#c8cfdc');
    const invalid = ed.locator('[data-palette-invalid]');
    await expect(invalid).toBeVisible();
    await expect(invalid).toContainText('ערכת הצבעים נדחתה: ניגודיות נמוכה מדי');
    await expect(invalid).toContainText('(נדרש 4.5:1)');
    await expect(ed.locator('[data-palette-save]')).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))).toBeNull(); // nothing stored
    expect(await inline(page, '--sw-text-2')).toBe(''); // nothing applied
    // a refused palette is not an option of the dial
    await expect(card.locator('[data-look-option^="palette:custom-"]')).toHaveCount(0);
    // repaired: a dark muted text
    await ed.locator('[data-palette-color="textMuted"]').fill('#4a5368');
    await expect(invalid).toHaveCount(0);
    await ed.locator('[data-palette-color="accent"]').fill('#0b57d0');
    await expect(invalid).toHaveCount(0);
    await ed.locator('[data-palette-save]').click();
    await expect(ed.locator('[data-palette-message]')).toBeVisible();
    const opt = card.locator('[data-look-option^="palette:custom-"]');
    await expect(opt).toHaveCount(1);
    await expect(opt).toContainText('בדיקה');
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))) as string) as { id: string; schemes: { light: { accent: string; textMuted: string } } }[];
    expect(stored).toHaveLength(1);
    expect(stored[0].schemes.light.accent).toBe('#0b57d0');
    // choose it for me: applied
    await card.locator('[data-look-target="own"]').click();
    await opt.click();
    await expect.poll(() => inline(page, '--sw-accent')).toBe('#0b57d0');
    await expect.poll(() => attr(page, 'data-bubble-palette')).toBe(stored[0].id);
    // delete it (two steps): the dial falls back to the skin's colours
    await card.locator('[data-look-target="installation"]').click();
    await ed.locator(`[data-palette-delete="${stored[0].id}"]`).click();
    await ed.locator(`[data-palette-delete="${stored[0].id}"]`).click();
    await expect(card.locator('[data-look-option^="palette:custom-"]')).toHaveCount(0);
    await expect.poll(() => inline(page, '--sw-accent')).toBe('');
    expect(await page.evaluate(() => localStorage.getItem('sw.ui.palettes'))).toBeNull();
  });

  test('a custom palette lives in the browser store: it is applied after a reload; a stored palette that no longer passes is dropped, never applied', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'once');
    await open(page, '&scheme=light');
    const bad = await page.evaluate(async () => {
      const mod = await import(/* @vite-ignore */ '/src/design/palette.ts');
      const p = JSON.parse(JSON.stringify(mod.paletteById('calm-blue')));
      p.id = 'custom-tampered';
      p.name = { he: 'פגומה', en: 'Tampered' };
      p.schemes.light.text = '#e0e0e0';
      return p;
    });
    await page.evaluate((p) => {
      sessionStorage.setItem('look-keep', '1');
      localStorage.setItem('sw.ui.palettes', JSON.stringify([p]));
      localStorage.setItem('sw.ui.look', JSON.stringify({ u: null, look: { palette: 'custom-tampered' } }));
    }, bad);
    await page.reload();
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(500);
    expect(await inline(page, '--sw-text')).toBe(''); // the failing palette is not applied: the skin's own colours stay
    await expect(lookCard(page).locator('[data-look-option^="palette:custom-"]')).toHaveCount(0);
    await page.evaluate(() => sessionStorage.removeItem('look-keep'));
  });

  test('evidence shots: the palette row and the editor, light and dark', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'the tablet width is shot from the desktop project');
    const w = info.project.name === 'mobile' ? 390 : 1440;
    await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
    for (const [scheme, id] of [['light', 'purple-rose'], ['dark', 'deep-ocean']] as const) {
      await open(page, `&scheme=${scheme}`);
      await lookCard(page).locator(`[data-look-option="palette:${id}"]`).click();
      await page.waitForTimeout(300);
      await lookCard(page).locator('[data-look-row="palette"]').scrollIntoViewIfNeeded();
      await shot(page, `settings-palette-${id}-${w}-${scheme}`);
      await lookCard(page).locator('[data-look-target="installation"]').click();
      await editor(page).locator('[data-palette-new]').click();
      await editor(page).locator('[data-palette-name]').fill('ערכה שלי');
      await editor(page).locator('[data-palette-scheme="dark"]').click();
      await editor(page).locator('[data-palette-editor]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot(page, `editor-${w}-${scheme}`);
    }
  });
});
