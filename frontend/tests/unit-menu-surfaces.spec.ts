import { test, expect } from '@playwright/test';
import { TOKENS } from '../src/design/tokens';
import { SKIN_IDS, SKINS } from '../src/design/skins';
import { skinTable, tokensCss } from '../src/design/css';
import { BUILTIN_PALETTES, paletteTokens } from '../src/design/palette';
import { contrastRatio, parseColor } from '../src/design/contrast';
import { devicesThemes } from '../src/styles/devices-themes';
import { DEVICE_PALETTES } from '../src/styles/devices-palettes';

// Menus are never see-through (owner 2026-10-13, the user menu over the building tree in the glass look): the token side.
// `--sw-menu-surface` / `--sw-menu-border` are declared once, set by every skin in BOTH columns, mapped by the ready bubble palettes,
// bridged by the glass screens to their palette's solid twin - and every value is a fully opaque colour that reads.
//   npx playwright test -c playwright.unit.config.ts tests/unit-menu-surfaces.spec.ts
// (the static scan of the menu components is tests/unit-menu-lint.spec.ts, the computed-style check in a browser is
// tests/evidence-menu-opaque.spec.ts)

const SCHEMES = ['light', 'dark'] as const;

test('the menu tokens are declared once, with a light and a dark value, both opaque', () => {
  for (const n of ['--sw-menu-surface', '--sw-menu-border']) {
    expect(TOKENS[n], n).toBeTruthy();
    for (const mode of SCHEMES) {
      const c = parseColor(TOKENS[n][mode]);
      expect(c, `${n} ${mode}: ${TOKENS[n][mode]} must be a plain colour (no var(), no gradient)`).toBeTruthy();
      expect(c![3], `${n} ${mode} is opaque`).toBe(1);
    }
  }
  // the dark column really differs from the light one
  expect(TOKENS['--sw-menu-surface'].dark).not.toBe(TOKENS['--sw-menu-surface'].light);
});

test('every skin sets the menu tokens for both schemes (a skin that forgot them would inherit the classic white in dark): fully opaque, and the text reads on them', () => {
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of SCHEMES) {
      const v = (n: string) => t[n][mode];
      const surface = parseColor(v('--sw-menu-surface'));
      const border = parseColor(v('--sw-menu-border'));
      expect(surface, `${id}/${mode} surface`).toBeTruthy();
      expect(border, `${id}/${mode} border`).toBeTruthy();
      expect(surface![3], `${id}/${mode} surface alpha`).toBe(1);
      expect(border![3], `${id}/${mode} border alpha`).toBe(1);
      // a skin states its own pair (never the classic base by accident); classic IS the base
      if (id !== 'classic') {
        expect(SKINS[id].tokens['--sw-menu-surface'], `${id} sets --sw-menu-surface`).toBeTruthy();
        expect(SKINS[id].tokens['--sw-menu-border'], `${id} sets --sw-menu-border`).toBeTruthy();
      }
      // the text a menu carries: body, secondary, headings, accent text and the destructive row of the user menu
      const pairs: [string, number][] = [['--sw-text', 4.5], ['--sw-text-2', 4.5], ['--sw-heading', 4.5], ['--sw-accent-text', 4.5], ['--sw-danger-text', 4.5]];
      // text-3 (captions) is a known soft pair on the classic light surface (unit-design-tokens.spec.ts KNOWN_CLASSIC_LIGHT)
      if (!(id === 'classic' && mode === 'light')) pairs.push(['--sw-text-3', 4.5]);
      for (const [n, min] of pairs) {
        const fg = parseColor(v(n));
        if (!fg) {
          fails.push(`${id}/${mode} ${n}: cannot parse ${v(n)}`);
          continue;
        }
        // a translucent text colour is composited over the menu surface before the ratio
        const flat: [number, number, number, number] = [0, 1, 2].map((i) => fg[i] * fg[3] + surface![i] * (1 - fg[3])).concat(1) as [number, number, number, number];
        const r = contrastRatio(flat, surface!);
        if (r < min) fails.push(`${id}/${mode} ${n} on the menu surface: ${r.toFixed(2)}`);
      }
      // the hairline is visible against the surface unless the skin is borderless (bubble: the border IS the surface, it draws nothing)
      const same = v('--sw-menu-border') === v('--sw-menu-surface');
      expect(same, `${id}/${mode}: only the borderless bubble skin hides its hairline`).toBe(id === 'bubble');
    }
  }
  expect(fails).toEqual([]);
});

test('the generated token CSS carries the menu tokens in the base, in every skin block and in the dark blocks', () => {
  const css = tokensCss();
  expect(css).toContain('--sw-menu-surface:#ffffff;');
  expect(css).toContain('--sw-menu-surface:#151c2c;');
  for (const id of ['domus', 'tesla', 'bubble', 'crystal']) {
    const light = css.indexOf(`:root[data-skin="${id}"]{`);
    const dark = css.indexOf(`:root[data-skin="${id}"][data-theme="dark"]{`);
    expect(light, `${id} light block`).toBeGreaterThan(-1);
    expect(css.slice(light, css.indexOf('}', light)), `${id} light`).toContain('--sw-menu-surface:');
    expect(css.slice(dark, css.indexOf('}', dark)), `${id} dark`).toContain('--sw-menu-surface:');
  }
});

test('the ready bubble palettes map the menu tokens to their elevated surface (the colour every text pair of the palette is checked on), opaque, both schemes', () => {
  for (const p of BUILTIN_PALETTES) {
    for (const mode of SCHEMES) {
      const t = paletteTokens(p, mode);
      expect(t['--sw-menu-surface'], `${p.id}/${mode}`).toBe(p.schemes[mode].surfaceElevated);
      expect(parseColor(t['--sw-menu-surface'])![3]).toBe(1);
      expect(parseColor(t['--sw-menu-border'])![3]).toBe(1);
      // the elevated surface is the one the palette validator already proves text on; assert the two main pairs here as well
      const surface = parseColor(t['--sw-menu-surface'])!;
      expect(contrastRatio(parseColor(p.schemes[mode].text)!, surface), `${p.id}/${mode} text on the menu`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseColor(p.schemes[mode].textMuted)!, surface), `${p.id}/${mode} muted text on the menu`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('the glass bridge maps a menu inside a glass screen to the palette\'s SOLID twin, and every palette has an opaque solid twin in both schemes', () => {
  const css = devicesThemes.cssText;
  expect(css).toMatch(/:host\(\[data-devices-style='glass'\]\) \{[^}]*--sw-menu-surface: var\(--dv-surface-solid\);/);
  expect(css).toMatch(/:host\(\[data-devices-style='glass'\]\) \{[^}]*--sw-menu-border: var\(--dv-border\);/);
  // the bridge is never undone for the menu: the translucent knob is not what a menu reads
  expect(css).not.toMatch(/--sw-menu-surface: var\(--dv-surface\)/);
  // the solid twins of the default palette (devices-themes.ts) and of the others (devices-palettes.ts): plain #rrggbb
  const solids = [...css.matchAll(/--dv-surface-solid:\s*([^;]+);/g)].map((m) => m[1].trim());
  expect(solids.length).toBeGreaterThanOrEqual(2);
  for (const p of DEVICE_PALETTES) for (const mode of SCHEMES) if (p[mode].knobs) solids.push(p[mode].knobs!['--dv-surface-solid']);
  expect(solids.length).toBeGreaterThanOrEqual(2 + 2 * (DEVICE_PALETTES.length - 1));
  for (const s of solids) {
    const c = parseColor(s);
    expect(c, `solid twin ${s}`).toBeTruthy();
    expect(c![3], `solid twin ${s} is opaque`).toBe(1);
  }
});
