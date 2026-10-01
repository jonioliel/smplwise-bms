import { test, expect } from '@playwright/test';
import { TOKENS, TOKEN_GROUPS, TOKEN_NAMES } from '../src/design/tokens';
import { SKINS, SKIN_IDS, SKIN_RULE_BUDGET, DEFAULT_SKIN } from '../src/design/skins';
import { ruleCount, skinRules, skinTable, tokensCss } from '../src/design/css';

// Design foundation (2026-10-01): the token table and the skins. Node only: the table is data, the CSS is generated from it.

test('every token has a light AND a dark value, a --sw- name, and is declared once', () => {
  const seen = new Set<string>();
  for (const g of TOKEN_GROUPS) {
    for (const [name, v] of Object.entries(g.tokens)) {
      expect(name, name).toMatch(/^--sw-[a-z0-9-]+$/);
      expect(seen.has(name), `${name} is declared in two groups`).toBe(false);
      seen.add(name);
      expect(typeof v.light === 'string' && v.light.trim() !== '', `${name} light`).toBe(true);
      expect(typeof v.dark === 'string' && v.dark.trim() !== '', `${name} dark`).toBe(true);
    }
  }
  expect(TOKEN_NAMES.length).toBe(seen.size);
  expect(Object.keys(TOKENS).length).toBeGreaterThanOrEqual(130);
});

test('the colours of the shell exist for both schemes: surfaces, text, accent, every state with its -soft and -text', () => {
  const must = ['--sw-bg', '--sw-surface', '--sw-surface-2', '--sw-surface-3', '--sw-surface-solid', '--sw-border', '--sw-border-strong', '--sw-overlay', '--sw-text', '--sw-text-2', '--sw-text-3', '--sw-heading', '--sw-accent', '--sw-accent-soft', '--sw-accent-text', '--sw-focus', '--sw-shadow-1', '--sw-shadow-2', '--sw-shadow-3', '--sw-map-bg', '--sw-map-wall', '--sw-obj-light', '--sw-circuit-1'];
  for (const n of must) expect(TOKENS[n], n).toBeTruthy();
  for (const st of ['live', 'recorded', 'offline', 'stale', 'unknown', 'danger', 'warning', 'success', 'forbidden']) {
    for (const suffix of ['', '-soft', '-text']) expect(TOKENS[`--sw-${st}${suffix}`], `--sw-${st}${suffix}`).toBeTruthy();
  }
  // the dark set really differs from the light set for the surfaces (a copied column would be a half-done dark mode)
  for (const n of ['--sw-bg', '--sw-surface', '--sw-text', '--sw-border', '--sw-map-bg']) expect(TOKENS[n].dark).not.toBe(TOKENS[n].light);
});

test('skins: registered ids, overrides carry both columns and name existing tokens, rules stay inside the budget', () => {
  expect([...SKIN_IDS]).toEqual(['classic', 'domus', 'tesla']);
  expect(DEFAULT_SKIN).toBe('classic');
  expect(SKINS.classic.tokens).toEqual({});
  expect(SKINS.classic.rules).toBe('');
  for (const id of SKIN_IDS) {
    const s = SKINS[id];
    expect(s.id).toBe(id);
    expect(s.nameHe.length).toBeGreaterThan(0);
    for (const [name, v] of Object.entries(s.tokens)) {
      expect(TOKENS[name], `${id}: unknown token ${name}`).toBeTruthy();
      expect(v.light && v.dark, `${id}: ${name} needs both columns`).toBeTruthy();
    }
    expect(ruleCount(s.rules), `${id} rules`).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
  }
  expect(ruleCount(SKINS.domus.rules)).toBeGreaterThan(10);
  expect(ruleCount(SKINS.tesla.rules)).toBeGreaterThan(10);
});

test('the generated CSS: light on :root, dark on [data-theme=dark] and on the OS query, a block set per skin, reduced motion', () => {
  const css = tokensCss();
  expect(css).toContain(':root{color-scheme:light;');
  expect(css).toContain(':root[data-theme="dark"]{color-scheme:dark;');
  expect(css).toContain('@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-theme="dark"]){color-scheme:dark;');
  expect(css).toContain(':root[data-skin="domus"]{');
  expect(css).toContain(':root[data-skin="domus"][data-theme="dark"]{');
  expect(css).toContain(':root[data-skin="tesla"][data-theme="dark"]{');
  expect(css).not.toContain('data-skin="classic"'); // classic is the base: no block
  expect(css).toContain('prefers-reduced-motion: reduce');
  expect(css).not.toMatch(/undefined|\[object/);
  // the light block holds every token
  const light = css.slice(css.indexOf(':root{'), css.indexOf('}\n', css.indexOf(':root{')));
  for (const n of TOKEN_NAMES) expect(light, n).toContain(`${n}:`);
  expect(skinRules('classic')).toBe('');
});

// ---- contrast: text on its solid surface, per skin and scheme (the glass surfaces are checked through their solid twins) ----
type RGBA = [number, number, number, number];
function parse(c: string): RGBA | null {
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1].split('').map((h) => parseInt(h + h, 16)), 1] as RGBA;
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return null;
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
function lum(c: RGBA): number {
  const [r, g, b] = [c[0], c[1], c[2]].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('contrast: body, secondary and tertiary text, accent text, text on accent, and every state text on its soft fill are >= 4.5:1', () => {
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of ['light', 'dark'] as const) {
      const v = (n: string) => t[n][mode];
      const solid = parse(v('--sw-surface-solid'))!;
      const solid2 = parse(v('--sw-surface-2-solid'))!;
      const bg = parse(v('--sw-bg'))!;
      const check = (label: string, fg: string, back: RGBA) => {
        const f = parse(fg);
        if (!f) return fails.push(`${id}/${mode} ${label}: cannot parse ${fg}`);
        const r = ratio(over(f, back), back);
        if (r < 4.5) fails.push(`${id}/${mode} ${label}: ${r.toFixed(2)}`);
      };
      for (const n of ['--sw-text', '--sw-text-2', '--sw-text-3', '--sw-accent-text', '--sw-heading']) {
        check(`${n} on surface`, v(n), solid);
        check(`${n} on surface-2`, v(n), solid2);
      }
      for (const n of ['--sw-text', '--sw-text-2', '--sw-text-3']) check(`${n} on bg`, v(n), bg);
      // white-ish text on the accent fill (primary button, selected chip)
      const accent = parse(v('--sw-accent'))!;
      const inverse = parse(v('--sw-text-inverse'))!;
      const r = ratio(inverse, accent);
      if (r < 4.5) fails.push(`${id}/${mode} text-inverse on accent: ${r.toFixed(2)}`);
      for (const st of ['live', 'recorded', 'offline', 'stale', 'unknown', 'danger', 'warning', 'success', 'forbidden']) {
        const soft = parse(v(`--sw-${st}-soft`))!;
        check(`${st}-text on ${st}-soft`, v(`--sw-${st}-text`), over(soft, solid));
      }
    }
  }
  // classic/light IS the product's look before the foundation (pixel-stable by decision): these pairs are known and are fixed when
  // the classic skin itself is redesigned, never silently. Everything else must pass.
  const KNOWN_CLASSIC_LIGHT = ['--sw-text-3 on surface', '--sw-text-3 on surface-2', '--sw-text-3 on bg', 'offline-text on offline-soft', 'unknown-text on unknown-soft', 'success-text on success-soft'];
  const unexpected = fails.filter((f) => !(f.startsWith('classic/light ') && KNOWN_CLASSIC_LIGHT.some((k) => f.includes(k))));
  expect(unexpected).toEqual([]);
  expect(fails.length - unexpected.length, 'a known classic/light pair got fixed: remove it from the list').toBe(KNOWN_CLASSIC_LIGHT.length);
});
