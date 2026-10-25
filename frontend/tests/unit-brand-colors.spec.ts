import { test, expect } from '@playwright/test';
import { BRAND_PRESETS, accentHoverOf, brandHex, brandTokens, contrastOf, contrastOnWhite, normalizeBrand } from '../src/design/brand';
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

test('POLISH-295: the hover of a primary button never reads worse than at rest - a white label darkens the fill in both schemes, a dark label lightens it', () => {
  // the case the polish preview found: white on the dark-scheme system blue lightened toward white was about 3.4:1
  for (const accent of ['#3a6ce0', '#2767ed', '#7c3aed', '#0d9488', '#007aff']) {
    for (const theme of ['light', 'dark'] as const) {
      const h = brandTokens({ accent, toggle: 'default' }, theme)['--sw-accent-hover'];
      expect(h, `${accent} ${theme}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastOf('#ffffff', h), `${accent} ${theme}`).toBeGreaterThanOrEqual(contrastOf('#ffffff', accent));
    }
  }
  expect(contrastOf('#ffffff', brandTokens({ accent: '#3a6ce0', toggle: 'default' }, 'dark')['--sw-accent-hover'])).toBeGreaterThanOrEqual(4.5);
  // a skin with a dark label on its dark-scheme accent (domus, tesla, crystal): the hover lightens and the label keeps its contrast
  const darkLabel = '#0c1018';
  const h = brandTokens({ accent: '#6ea2ff', toggle: 'default' }, 'dark', darkLabel)['--sw-accent-hover'];
  expect(contrastOf(darkLabel, h)).toBeGreaterThanOrEqual(contrastOf(darkLabel, '#6ea2ff'));
  expect(accentHoverOf('#3a6ce0')).toBe(accentHoverOf('#3a6ce0', '#ffffff'));
});

test('"accent" (SET-polish): the switch follows the accent - admitted for the switch only, writes var(--sw-accent), no hex of its own', () => {
  expect(normalizeBrand('accent', 'toggle')).toBe('accent');
  expect(normalizeBrand('accent')).toBe('default');
  expect(normalizeBrand('accent', 'accent')).toBe('default');
  expect(brandHex('accent')).toBeNull();
  expect(brandTokens({ accent: 'default', toggle: 'accent' }, 'light')).toEqual({ '--sw-toggle-on': 'var(--sw-accent)' });
  const both = brandTokens({ accent: '#7c3aed', toggle: 'accent' }, 'dark');
  expect(both['--sw-accent']).toBe('#7c3aed');
  expect(both['--sw-toggle-on']).toBe('var(--sw-accent)');
});
