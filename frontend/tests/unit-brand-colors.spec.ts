import { test, expect } from '@playwright/test';
import { BRAND_PRESETS, brandHex, brandTokens, contrastOnWhite, normalizeBrand } from '../src/design/brand';
import { TOKEN_NAMES } from '../src/design/tokens';

// 2.4.4 (owner 2026-10-10): the accent colour and the switch-on colour (`ui.accent`, `ui.toggle_on`) on the DU1 token layer.
//   npx playwright test tests/unit-brand-colors.spec.ts --project=desktop

test('values: default, presets (the iOS green among them) and #rrggbb; anything else reads as default', () => {
  expect(normalizeBrand('default')).toBe('default');
  expect(normalizeBrand('ios_green')).toBe('ios_green');
  expect(BRAND_PRESETS.ios_green).toBe('#34c759');
  expect(normalizeBrand('#AABBCC')).toBe('#aabbcc');
  for (const bad of ['', 'green', '#abc', 'red;}', 'var(--x)', null, 7, {}]) expect(normalizeBrand(bad)).toBe('default');
  expect(brandHex('default')).toBeNull();
  expect(brandHex('teal')).toBe(BRAND_PRESETS.teal);
});

test('"default" writes nothing: the skin keeps its own colours (today\'s system blue)', () => {
  expect(brandTokens({ accent: 'default', toggle: 'default' }, 'light')).toEqual({});
  expect(brandTokens({ accent: 'default', toggle: 'default' }, 'dark')).toEqual({});
});

test('an accent writes the accent family for each scheme; a toggle colour writes --sw-toggle-on only; every name is a declared token', () => {
  const light = brandTokens({ accent: '#7c3aed', toggle: 'default' }, 'light');
  const dark = brandTokens({ accent: '#7c3aed', toggle: 'default' }, 'dark');
  for (const t of [light, dark]) {
    expect(Object.keys(t).sort()).toEqual(['--sw-accent', '--sw-accent-hover', '--sw-accent-soft', '--sw-accent-text', '--sw-focus', '--sw-nav'].sort());
    expect(t['--sw-accent']).toBe('#7c3aed');
  }
  expect(light['--sw-accent-soft']).not.toBe(dark['--sw-accent-soft']);
  const toggle = brandTokens({ accent: 'default', toggle: 'ios_green' }, 'dark');
  expect(toggle).toEqual({ '--sw-toggle-on': '#34c759' });
  const names = new Set(TOKEN_NAMES);
  for (const n of [...Object.keys(light), ...Object.keys(toggle)]) expect(names.has(n), n).toBe(true);
});

test('the light-colour warning: white on the iOS green is below 3:1, on the system blue above', () => {
  expect(contrastOnWhite('#34c759')).toBeLessThan(3);
  expect(contrastOnWhite('#2767ed')).toBeGreaterThan(4.5);
});
