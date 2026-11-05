import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICKER_SKINS } from './helpers/frozen-skins';
import { collectTargets, failing, measureContrast, over, pageScroll, parseRgba, ratio } from './helpers/skin-qa-probe';
import { openWall, tagFacts } from './helpers/skin-qa-wall';

// SKIN-QA-FOLLOWUP-2404 (owner round 22, Q4: "it has to work"): on a tile narrower than 160 px - a phone wall of three columns on the
// remote channel, where the profile badge holds the top row and the camera's name the bottom one - the "moved to the main stream" tag is
// a 20 px chip with the "up" glyph in the bottom-end corner, on the name's row. Measured in every skin the picker offers, light and dark,
// at 390 px: the chip is drawn (never hidden), sits in its corner inside the tile, covers neither the profile badge nor the name (a long
// name ends in its ellipsis before it), its glyph reads at 3:1 over the rendered picture and over a white one, its words are its
// accessible name and its tooltip, a long press shows them in a bubble without opening the camera, and nothing scrolls sideways.
//   ~/run_remote.sh preview <branch> tests/layout-skin-qa-followup-2404.spec.ts --project=mobile
const OUT = process.env.SKINQA_OUT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.tmp_skinqa');
const SUB_FALLBACK_HE = 'עבר לזרם הראשי';
const LONG = 'חניון תת-קרקעי, כניסה מזרחית לרכבים';

function save(info: TestInfo, name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}-${info.project.name}.json`), JSON.stringify(data, null, 1));
}
async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`) });
}

const chipOf = (page: Page, cam: string) => page.locator(`live-wall sw-camera-tile[data-cam="${cam}"] sw-live-player [data-sub-fallback]`);

test.describe('SKIN-QA-FOLLOWUP-2404 · the fallback chip on a narrow remote tile', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of PICKER_SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: three columns at 390 px - the chip is drawn, covers neither the badge nor the name, reads, long-presses`, async ({ page }, info) => {
        test.skip(info.project.name !== 'mobile', 'a phone wall');
        test.setTimeout(120_000);
        const bad: string[] = [];
        await openWall(page, skin, scheme, { cols: 3, channel: 'remote', names: { c1: LONG } });
        const player = page.locator('live-wall sw-camera-tile[data-cam="c1"] sw-live-player');
        const t = await tagFacts(page, 'c1');
        await expect(player).toHaveAttribute('data-subchip', '');
        const chip = chipOf(page, 'c1');
        const label = await page.locator('live-wall sw-camera-tile[data-cam="c1"]').evaluate((tile) => {
          const l = tile.shadowRoot?.querySelector('.foot .label') as HTMLElement | null;
          const r = l?.getBoundingClientRect();
          return r ? { x: r.left, r: r.right, cut: l!.scrollWidth > l!.clientWidth + 1 } : null;
        });
        // geometry: a 20 px circle in the bottom-end (left, RTL) corner of a narrow tile, nothing under it
        if (t.tile.w >= 160) bad.push(`the tile is ${Math.round(t.tile.w)} px wide (the case needs < 160)`);
        if (t.tag.w > 24 || t.tag.h > 24 || t.tag.w < 18) bad.push(`the chip is ${Math.round(t.tag.w)}x${Math.round(t.tag.h)} px`);
        if (t.tag.x - t.tile.x > 10 || t.tile.b - t.tag.b > 10) bad.push('the chip is not in the bottom-end (left) corner');
        if (t.tag.x < t.tile.x - 0.5 || t.tag.b > t.tile.b + 0.5) bad.push('the chip leaves its tile');
        if (t.overlaps.length) bad.push(`the chip covers ${t.overlaps.join(', ')}`);
        if (!t.others.some((o) => /vbadge/.test(o.cls))) bad.push('no profile badge drawn (the remote case)');
        if (!label) bad.push('no camera name drawn');
        else {
          if (label.x < t.tag.r) bad.push(`the name (${Math.round(label.x)}) runs under the chip (${Math.round(t.tag.r)})`);
          if (!label.cut) bad.push('the long name was expected to end in its ellipsis');
        }
        // the words: accessible name and tooltip
        expect(await chip.textContent()).toBe(SUB_FALLBACK_HE);
        await expect(chip).toHaveAttribute('title', SUB_FALLBACK_HE);
        // the glyph: 3:1 on the rendered picture and, worst case, the scrim over a white picture
        const rows = await measureContrast(page, await collectTargets(chip, { icons: true }));
        for (const r of failing(rows)) bad.push(`the chip's glyph reads at ${r.ratio} < ${r.need}`);
        const ink = await chip.locator('sw-icon').evaluate((el) => getComputedStyle(el).color);
        const scrim = parseRgba(t.bg);
        const white = over(scrim, [255, 255, 255]);
        const worst = Math.round(ratio(over(parseRgba(ink), white), white) * 100) / 100;
        if (worst < 3) bad.push(`over a white picture the glyph reads at ${worst} < 3`);
        const s = await pageScroll(page);
        if (s.sideways > 0) bad.push(`sideways scroll ${s.sideways} px`);
        await shot(page, info, `chip-3col-${skin}-${scheme}`);
        // a long press shows the words; the release does not open the camera
        const hash = await page.evaluate(() => location.hash);
        const b = (await chip.boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(700);
        const hint = player.locator('[data-sub-fallback-hint]');
        await expect(hint).toHaveText(SUB_FALLBACK_HE);
        const hb = (await hint.boundingBox())!;
        if (hb.x < t.tile.x - 0.5 || hb.x + hb.width > t.tile.r + 0.5) bad.push('the long-press words leave the tile');
        const hintRows = await measureContrast(page, await collectTargets(hint));
        for (const r of failing(hintRows)) bad.push(`the long-press words read at ${r.ratio} < ${r.need}`);
        await shot(page, info, `chip-3col-hint-${skin}-${scheme}`);
        await page.mouse.up();
        await page.waitForTimeout(300);
        if ((await page.evaluate(() => location.hash)) !== hash) bad.push('the release of a long press opened the camera');
        await expect(hint).toHaveCount(0, { timeout: 4_000 });
        save(info, `chip-3col-${skin}-${scheme}`, { t, label, rows, worst, hintRows, bad });
        console.log(`SKIN-QA-FOLLOWUP-2404 chip ${skin} ${scheme}: tile ${Math.round(t.tile.w)}x${Math.round(t.tile.h)}, chip ${Math.round(t.tag.w)} px, glyph ${rows.map((r) => r.ratio).join('/')} (white ${worst}), ${bad.length} problems`);
        expect(bad, `chip ${skin} ${scheme}`).toEqual([]);
      });
    }
  }

  test('a wide tile keeps the words; a local three-column tile draws the chip too', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone wall');
    test.setTimeout(120_000);
    await openWall(page, 'classic', 'light', { cols: 2, channel: 'remote' });
    await tagFacts(page, 'c1');
    await expect(page.locator('live-wall sw-camera-tile[data-cam="c1"] sw-live-player')).not.toHaveAttribute('data-subchip', '');
    expect((await chipOf(page, 'c1').boundingBox())!.width, 'the words, not the chip').toBeGreaterThan(60);
    await page.goto('about:blank');
    await openWall(page, 'classic', 'dark', { cols: 3 });
    const t = await tagFacts(page, 'c1');
    await expect(page.locator('live-wall sw-camera-tile[data-cam="c1"] sw-live-player')).toHaveAttribute('data-subchip', '');
    expect(t.overlaps).toEqual([]);
  });
});
