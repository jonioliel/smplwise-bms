import { test, expect } from '@playwright/test';
import { DEFAULT_SKIN, FOUNDATION_SKINS, FROZEN_FALLBACK_SKIN, FROZEN_SKINS, SELECTABLE_SKIN_IDS, SKIN_IDS, SKINS, isFrozenSkin, isSelectableSkin, resolveSkin } from '../src/design/skins';
import { isFrozen, PICKER_SKINS, SKINS_UNDER_TEST, skinsUnderTest } from './helpers/frozen-skins';

// BUBBLE-FREEZE-295 (owner 2026-10-26): the bubble skin stays in the registry and in the tree, but is not selectable and reads as Domus.
// This spec does NOT skip itself: it is the check that the freeze holds (and that the code is still there).

test('the registry keeps the bubble skin (code and tokens stay) but marks it frozen; the fresh-install default is still classic', () => {
  expect([...SKIN_IDS]).toContain('bubble');
  expect(SKINS.bubble.id).toBe('bubble');
  expect(Object.keys(SKINS.bubble.tokens).length).toBeGreaterThan(10);
  expect([...FROZEN_SKINS]).toEqual(['bubble']);
  expect(FROZEN_FALLBACK_SKIN).toBe('domus');
  expect(FROZEN_SKINS).not.toContain(FROZEN_FALLBACK_SKIN);
  expect(DEFAULT_SKIN).toBe('classic');
  expect([...SELECTABLE_SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft']); // SKINFOUND-297: the two Arx skins are selectable
});

test('a frozen id is not selectable and is read as the fallback; unknown values stay unknown', () => {
  expect(isFrozenSkin('bubble')).toBe(true);
  expect(isFrozenSkin('domus')).toBe(false);
  expect(isSelectableSkin('bubble')).toBe(false);
  expect(isSelectableSkin('crystal')).toBe(true);
  expect(resolveSkin('bubble')).toBe('domus');
  for (const id of ['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft'] as const) expect(resolveSkin(id)).toBe(id);
  for (const bad of ['Bubble', '', 'ios', null, undefined, 3]) expect(resolveSkin(bad)).toBeNull();
});

test('the test helper derives the skins under test from the registry', () => {
  expect(isFrozen('bubble')).toBe(true);
  // SKINFOUND-297: the foundation-stage skins are selectable but not in the per-skin matrix (no pixel baselines yet)
  expect([...SKINS_UNDER_TEST]).toEqual(SELECTABLE_SKIN_IDS.filter((id) => !FOUNDATION_SKINS.includes(id)));
  expect([...SKINS_UNDER_TEST]).toEqual(['classic', 'domus', 'tesla', 'crystal']);
  expect([...PICKER_SKINS]).toEqual([...SELECTABLE_SKIN_IDS]);
  expect(skinsUnderTest(['classic', 'bubble', 'crystal', 'soft'])).toEqual(['classic', 'crystal']);
});

test('on the page: a requested or cached bubble skin is drawn as domus', async ({ page }) => {
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=bubble#/devices/building');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'domus');
  await page.evaluate(() => localStorage.setItem('sw.ui.design', JSON.stringify({ skin: 'bubble', scheme: 'light' })));
  await page.goto('about:blank');
  await page.goto('/?design=a#/devices/building');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'domus');
});
