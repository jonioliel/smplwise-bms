/**
 * GATELANES-297 (owner decision 2026-10-27, docs/testing/GATE_AUDIT_2026-10-27.md proposal P1): which skins carry PIXEL baselines.
 *
 *   PIXEL_SKIN_IDS      THE one-line config below. A skin listed here gets a screenshot compare in every per-skin pixel case.
 *   PIXEL_SKINS         PIXEL_SKIN_IDS minus the frozen skins (frozen-skins.ts), in registry order
 *   SMOKE_ONLY_SKINS    every other skin under test (today tesla and crystal): the same case, the same screens, a structural smoke
 *                       instead of the pixels - the skin is really drawn, the screen is there with a real size, nothing overflows
 *                       sideways, the page threw no error. Cheap, no baseline, so a broken skin still turns the gate red.
 *   pixelTitle(s, what) the case title: "<skin> is pixel-stable: <what>" for a pixel skin (the gate's pixel step runs --grep
 *                       pixel-stable), "<skin> draws <what> (structural smoke, no pixel baseline)" for the others (preview group)
 *   skinCheck(page, s)  one picture of a per-skin case: runs the spec's own compare for a pixel skin, the smoke of a root for the others
 *
 * Add a skin back: put it in PIXEL_SKIN_IDS, take its linux baselines on the runner
 * (`npx playwright test tests/<pixel spec> --project=desktop --project=mobile --update-snapshots=missing`), review them, commit.
 * Its old baselines were deleted when it left (GATELANES-297); git history has them.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { SkinId } from '../../src/design/skins';
import { SKINS_UNDER_TEST } from './frozen-skins';

export const PIXEL_SKIN_IDS: readonly SkinId[] = ['classic', 'domus'];

export const isPixelSkin = (skin: string): boolean => (PIXEL_SKIN_IDS as readonly string[]).includes(skin);
export const PIXEL_SKINS: readonly SkinId[] = SKINS_UNDER_TEST.filter(isPixelSkin);
export const SMOKE_ONLY_SKINS: readonly SkinId[] = SKINS_UNDER_TEST.filter((s) => !isPixelSkin(s));

export const pixelTitle = (skin: string, what: string): string =>
  isPixelSkin(skin) ? `${skin} is pixel-stable: ${what}` : `${skin} draws ${what} (structural smoke, no pixel baseline)`;

/** The structural smoke of one screen in a skin that has no pixel baseline. */
export async function expectSkinSmoke(page: Page, skin: string, root: string | Locator, errors: readonly string[]) {
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-skin')), 'the requested skin is the one drawn').toBe(skin);
  const el = (typeof root === 'string' ? page.locator(root) : root).first();
  await expect(el).toBeVisible();
  const box = await el.boundingBox();
  expect(box !== null && box.width >= 40 && box.height >= 20, `a real size: ${JSON.stringify(box)}`).toBe(true);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'no sideways overflow of the page').toBeLessThanOrEqual(1);
  expect([...errors], 'the page threw no error').toEqual([]);
}

/** Call at the start of a per-skin case (before the page opens: it listens for page errors). Returns the check of one picture:
 *  `await check(() => compare(page, info, name), root)` - the compare for a pixel skin, the structural smoke of `root` otherwise. */
export function skinCheck(page: Page, skin: string) {
  const errors: string[] = [];
  // errors of the app only: the specs' open() first loads about:blank, where the mocks' init scripts cannot read localStorage
  // ("Access is denied for this document") - in every skin, classic included; that is the harness, not the skin (runner 2026-10-27)
  if (!isPixelSkin(skin)) page.on('pageerror', (e) => { if (!page.url().startsWith('about:')) errors.push(e.message); });
  return async (pixel: () => Promise<unknown>, root: string | Locator) => {
    if (isPixelSkin(skin)) await pixel();
    else await expectSkinSmoke(page, skin, root, errors);
  };
}
