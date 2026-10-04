import { test, expect } from '@playwright/test';
import { TOKENS, TOKEN_GROUPS, TOKEN_NAMES } from '../src/design/tokens';
import { SKINS, SKIN_IDS, SKIN_RULE_BUDGET, DEFAULT_SKIN } from '../src/design/skins';
import { ruleCount, skinRules, skinTable, tokensCss } from '../src/design/css';
import { DENSITY_BUNDLE, DEPTH_BUNDLE, LOOK_DEFAULT, LOOK_DIALS, LOOK_DIAL_IDS, MATERIAL_BUNDLE, MATERIAL_SUGGESTED_TRANSPARENCY, PERFORMANCE_BUNDLE, RADIUS_BUNDLE, TINT_BUNDLE, materialMacro, normalizeDial, normalizeLook } from '../src/design/look';
import { LITE_MIN_ALPHA, WASH_MAX, WASH_TONES, alphaFloor, liteAlpha, liteAlphaFloor, liteLayerModel, sheetModelOf, washCap, washModelOf, worstTextContrast, worstWashContrast } from '../src/design/contrast';
import { MATERIAL_LAYERS, MATERIAL_RULE_BUDGET, MATERIAL_SHADOWS, MATERIAL_SKINS, materialRules } from '../src/styles/material';
import { BUILTIN_PALETTES, paletteTokens } from '../src/design/palette';

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
  expect([...SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'bubble']);
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
  expect(ruleCount(SKINS.bubble.rules)).toBeGreaterThan(10);
});

// ---- the look dials (Bubble foundation): the lists match the backend, the bundles cover every value, the resolver's order ----
test('look dials: every dial has a default inside its list / range, the bundles cover every density and radius, the CSS carries them for the bubble skin', () => {
  for (const d of LOOK_DIAL_IDS) {
    expect(normalizeDial(d, LOOK_DEFAULT[d]), `${d} default`).toBe(LOOK_DEFAULT[d]);
    const dial = LOOK_DIALS[d] as { kind: string; values?: readonly unknown[]; range?: readonly [number, number] };
    if (dial.kind === 'choice') for (const v of dial.values!) expect(normalizeDial(d, v), `${d}=${String(v)}`).toBe(v);
    else {
      expect(normalizeDial(d, dial.range![0])).toBe(dial.range![0]);
      expect(normalizeDial(d, dial.range![1])).toBe(dial.range![1]);
      expect(normalizeDial(d, dial.range![0] - 1)).toBeNull();
      expect(normalizeDial(d, dial.range![1] + 1)).toBeNull();
      expect(normalizeDial(d, dial.range![0] + 0.5)).toBeNull();
    }
  }
  expect(normalizeDial('density', 'huge')).toBeNull();
  expect(normalizeDial('touch', 40)).toBeNull();
  expect(normalizeLook({ density: 'row', touch: 32, scale: 200, colour: 'red' })).toEqual({ density: 'row', touch: 32 });
  expect(normalizeLook('{"surface":"glass"}')).toEqual({ surface: 'glass' });
  expect(normalizeLook('nope')).toEqual({});
  for (const v of LOOK_DIALS.density.values) {
    expect(DENSITY_BUNDLE[v]['--sw-pill-h'], v).toBeTruthy();
    for (const name of Object.keys(DENSITY_BUNDLE[v])) expect(TOKENS[name], `${v}: ${name} is not a token`).toBeTruthy();
  }
  for (const v of LOOK_DIALS.radius.values) {
    expect(RADIUS_BUNDLE[v]['--sw-r-lg'], v).toBeTruthy();
    for (const name of Object.keys(RADIUS_BUNDLE[v])) expect(TOKENS[name], `${v}: ${name} is not a token`).toBeTruthy();
  }
  const css = tokensCss();
  expect(css).toContain(':root[data-skin="bubble"][data-bubble-density="compact"],:root[data-skin="bubble"] [data-bubble-density="compact"]{--sw-pill-h:46px;');
  expect(css).toContain('[data-bubble-radius="square"]');
  expect(css).toContain('prefers-reduced-transparency: reduce');
  expect(css).toContain('--sw-t-sheet:0ms');
});

// ---- contrast on translucent surfaces (Bubble foundation): computed, and the floor the runtime clamps to ----
test('translucent sheet: the computed alpha floor keeps every text at >= 4.5:1 over the worst content behind it, and the dial\'s range reaches above it', () => {
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of ['light', 'dark'] as const) {
      const model = sheetModelOf((n) => t[n]?.[mode] ?? '');
      expect(model, `${id}/${mode} sheet model`).toBeTruthy();
      const floor = alphaFloor(model!);
      // at the floor and at every allowed alpha above it the worst text pair passes; one step below it fails (the floor is tight)
      for (let a = floor; a <= 1.0001; a += 0.01) expect(worstTextContrast(model!, Math.round(a * 100) / 100), `${id}/${mode} alpha ${a.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      if (floor > 0.01) expect(worstTextContrast(model!, floor - 0.01), `${id}/${mode} below the floor`).toBeLessThan(4.5);
      // the skin's resting alpha (tokens) is usable: at or above the floor
      expect(parseFloat(t['--sw-sheet-alpha'][mode]), `${id}/${mode} resting alpha`).toBeGreaterThanOrEqual(floor - 1e-9);
      if (id === 'bubble') {
        // the mockup's contrast pass: 72 % (the default transparency) passes, so the floor is at or below it; the owner can go lower only to the floor
        expect(floor, `${id}/${mode} floor`).toBeLessThanOrEqual(LOOK_DEFAULT.transparency / 100 + 1e-9);
        expect(floor).toBeGreaterThanOrEqual(LOOK_DIALS.transparency.range[0] / 100); // the floor is inside the dial's range (never silently off)
      }
    }
  }
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

// ---- the performance tier (lite): no blur on cards / pills / rows / lists, tinted fills that keep the contrast guard ----
test('performance dial: auto | full | lite, auto is the default; the bundle switches the blur and the glass fill, and the CSS carries it for the bubble skin', () => {
  expect([...LOOK_DIALS.performance.values]).toEqual(['auto', 'full', 'lite']);
  expect(LOOK_DEFAULT.performance).toBe('auto');
  expect(normalizeDial('performance', 'lite')).toBe('lite');
  expect(normalizeDial('performance', 'turbo')).toBeNull();
  expect(normalizeLook({ performance: 'lite', density: 'row' })).toEqual({ density: 'row', performance: 'lite' });
  for (const tier of ['full', 'lite'] as const) for (const name of Object.keys(PERFORMANCE_BUNDLE[tier])) expect(TOKENS[name], `${tier}: ${name} is not a token`).toBeTruthy();
  expect(PERFORMANCE_BUNDLE.lite['--sw-perf-blur']).toBe('none');
  expect(PERFORMANCE_BUNDLE.full['--sw-perf-blur']).toBe('initial'); // full = the component's own blur (the var() fallback applies)
  expect(TOKENS['--sw-perf-blur'].light).toBe('initial');
  const css = tokensCss();
  expect(css).toContain(':root[data-skin="bubble"][data-bubble-performance="lite"],:root[data-skin="bubble"] [data-bubble-performance="lite"]{--sw-perf-blur:none;');
  expect(css).toContain('[data-bubble-performance="full"]');
  // the dock / rail / tree, the scrim and the open pop-up keep their blur tokens (lite does not touch them)
  for (const kept of ['--sw-glass-blur-nav', '--sw-glass-blur-sheet', '--sw-backdrop-blur']) expect(Object.keys(PERFORMANCE_BUNDLE.lite)).not.toContain(kept);
});

test('lite tier contrast: the un-blurred tinted fill reads at >= 4.5:1 for every text over every worst-case pixel, in both schemes', () => {
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of ['light', 'dark'] as const) {
      const model = sheetModelOf((n) => t[n]?.[mode] ?? '');
      expect(model, `${id}/${mode}`).toBeTruthy();
      const lite = liteLayerModel(model!);
      expect(lite.overlay[3], 'no dimming overlay under an un-blurred layer').toBe(0);
      expect(lite.behind.length).toBeGreaterThan(model!.behind.length); // the saturated primaries are added
      const floor = liteAlphaFloor(model!);
      const alpha = liteAlpha(model!);
      expect(alpha, `${id}/${mode} lite alpha`).toBeGreaterThanOrEqual(LITE_MIN_ALPHA);
      expect(alpha).toBeGreaterThanOrEqual(floor);
      expect(alpha).toBeLessThanOrEqual(1);
      // at the lite alpha and at every alpha above it the worst pair passes
      for (let a = alpha; a <= 1.0001; a += 0.01) expect(worstTextContrast(lite, Math.round(a * 100) / 100), `${id}/${mode} alpha ${a.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      // the floor is tight (one step below fails) unless it sits at 0
      if (floor > 0.01) expect(worstTextContrast(lite, floor - 0.01), `${id}/${mode} below the lite floor`).toBeLessThan(4.5);
    }
  }
  // the bubble skin needs no more than the near-solid minimum: lite costs no extra opacity beyond it
  for (const mode of ['light', 'dark'] as const) {
    const t = skinTable('bubble');
    const model = sheetModelOf((n) => t[n]?.[mode] ?? '')!;
    expect(liteAlpha(model), `bubble/${mode}`).toBeLessThanOrEqual(1);
  }
});

// ---- MD1 material dials (owner 2026-10-03; mockups docs/design/compare/material-dials, built without the Chalk preset) ----
test('material dials: depth 0|1|2, tint 0|1|2, material none|frosted|paper|neon (no chalk), all OFF by default; the bundles name tokens and the CSS carries them for bubble and domus', () => {
  expect([...LOOK_DIALS.depth.values]).toEqual([0, 1, 2]);
  expect([...LOOK_DIALS.tint.values]).toEqual([0, 1, 2]);
  expect([...LOOK_DIALS.material.values]).toEqual(['none', 'frosted', 'paper', 'neon']);
  expect((LOOK_DIALS.material.values as readonly string[]).includes('chalk')).toBe(false);
  expect([LOOK_DEFAULT.depth, LOOK_DEFAULT.tint, LOOK_DEFAULT.material]).toEqual([0, 0, 'none']);
  expect(LOOK_DIAL_IDS.slice(-3)).toEqual(['depth', 'tint', 'material']);
  expect(normalizeDial('depth', 2)).toBe(2);
  expect(normalizeDial('depth', '2')).toBeNull(); // a string level is refused, as the backend refuses it
  expect(normalizeDial('tint', 3)).toBeNull();
  expect(normalizeDial('material', 'chalk')).toBeNull();
  expect(normalizeLook({ material: 'neon', depth: 2, tint: 1 })).toEqual({ depth: 2, tint: 1, material: 'neon' });
  for (const [name, bundles] of [['material', MATERIAL_BUNDLE], ['depth', DEPTH_BUNDLE], ['tint', TINT_BUNDLE]] as const) {
    for (const [value, decl] of Object.entries(bundles)) for (const token of Object.keys(decl)) expect(TOKENS[token], `${name}=${value}: ${token} is not a token`).toBeTruthy();
  }
  // every preset writes the same set of numbers (a preset never leaves a number of the previous preset behind)
  const keys = Object.keys(MATERIAL_BUNDLE.none).sort();
  for (const m of LOOK_DIALS.material.values) expect(Object.keys(MATERIAL_BUNDLE[m]).sort(), m).toEqual(keys);
  // the resting tokens = the none preset at depth 0 / tint 0: every layer invisible (today's pixels)
  expect(TOKENS['--sw-m-depth'].light).toBe('0');
  expect(TOKENS['--sw-m-tint'].light).toBe('0');
  for (const [k, v] of Object.entries(MATERIAL_BUNDLE.none)) expect(TOKENS[k].light, k).toBe(v);
  expect(DEPTH_BUNDLE[2]['--sw-m-depth']).toBe('1.8');
  expect(TINT_BUNDLE[2]['--sw-m-tint']).toBe('1.8');
  // the mockups' numbers
  expect(MATERIAL_BUNDLE.frosted['--sw-m-blur']).toBe('20px');
  expect(MATERIAL_BUNDLE.frosted['--sw-m-grain']).toContain('feTurbulence');
  expect(MATERIAL_BUNDLE.paper['--sw-m-blur']).toBe('0px');
  expect(MATERIAL_BUNDLE.paper['--sw-m-rim']).toBe('0.5');
  expect(MATERIAL_BUNDLE.neon['--sw-m-glow']).toBe('16px');
  expect(MATERIAL_BUNDLE.neon['--sw-m-glowa']).toBe('1');
  for (const m of ['none', 'frosted', 'paper'] as const) expect(MATERIAL_BUNDLE[m]['--sw-m-glowa'], m).toBe('0');
  expect(MATERIAL_SUGGESTED_TRANSPARENCY).toEqual({ none: 72, frosted: 62, paper: 96, neon: 56 });
  // the macro: a preset turns depth / tint on when they were off, keeps them when set, suggests the transparency; none only clears the preset
  expect(materialMacro({ depth: 0, tint: 0 }, 'frosted')).toEqual({ material: 'frosted', depth: 1, tint: 1, transparency: 62 });
  expect(materialMacro({ depth: 2, tint: 1 }, 'paper')).toEqual({ material: 'paper', depth: 2, tint: 1, transparency: 96 });
  expect(materialMacro({ depth: 2, tint: 2 }, 'none')).toEqual({ material: 'none' });
  const css = tokensCss();
  for (const skin of MATERIAL_SKINS) {
    expect(css).toContain(`:root[data-skin="${skin}"][data-bubble-material="frosted"],:root[data-skin="${skin}"] [data-bubble-material="frosted"]{--sw-m-sheen:0.07;`);
    expect(css).toContain(`:root[data-skin="${skin}"][data-bubble-depth="2"],:root[data-skin="${skin}"] [data-bubble-depth="2"]{--sw-m-depth:1.8;}`);
    expect(css).toContain(`:root[data-skin="${skin}"][data-bubble-tint="1"]`);
  }
  expect(css).not.toContain(':root[data-skin="classic"][data-bubble-material');
  expect(css).not.toContain(':root[data-skin="tesla"][data-bubble-material');
});

test('material layer: one formula appended to the bubble and domus sheets inside its own budget; classic and tesla get none; the rules mitigate the neon reservation (no glow on state tones or in lists), keep lists un-washed and add no bare backdrop-filter', () => {
  for (const id of SKIN_IDS) {
    const m = materialRules(id);
    if ((MATERIAL_SKINS as readonly string[]).includes(id)) {
      expect(m.length, id).toBeGreaterThan(0);
      expect(ruleCount(m), `${id} material rules`).toBeLessThanOrEqual(MATERIAL_RULE_BUDGET);
      expect(skinRules(id).endsWith(m), `${id} sheet ends with the material layer`).toBe(true);
      expect(ruleCount(SKINS[id].rules), `${id} skin rules keep their own budget`).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
      expect(m).toContain(MATERIAL_LAYERS);
      expect(m).toContain(MATERIAL_SHADOWS);
      // every backdrop-filter is wrapped in the performance switch (the lite tier never blurs a tile) or is none; none is bare
      for (const line of m.split('\n')) {
        const n = (line.match(/backdrop-filter:/g) ?? []).length;
        const wrapped = (line.match(/backdrop-filter: (var\(--sw-perf-blur|none)/g) ?? []).length;
        expect(wrapped, `bare backdrop-filter in: ${line.slice(0, 80)}`).toBe(n);
      }
    } else {
      expect(m, id).toBe('');
      expect(skinRules(id)).toBe(SKINS[id].rules);
    }
  }
  const b = materialRules('bubble');
  // the neon bloom: only around a tile whose tone is decorative (the hue ring, the area's hue) and never in a list; the KPI state tones carry no glow switch
  expect(b).toMatch(/:host\(sw-pill\[on\]:not\(\[accent\]\):not\(\[data-density='row'\]\)\)[^{]*\{ --sw-m-glow-on: 1; --sw-m-glow-c: var\(--h, var\(--sw-accent\)\); \}/);
  expect(b).not.toMatch(/sw-kpi\[tone[^\n]*--sw-m-glow-on: 1/); // no KPI tone rule turns the bloom on
  expect(b.split('\n').filter((l) => l.includes('--sw-m-glow-on: 1'))).toHaveLength(1); // exactly one rule turns it on (the decorative-tone hosts)
  expect(MATERIAL_SHADOWS).toContain('var(--sw-m-glow-on, 0)'); // the bloom's alpha is 0 wherever the switch is not set
  // the wash is capped by the computed contrast floor and multiplied by the tile's own --sw-m-on (0 unless its state carries a tone)
  expect(b).toContain('--sw-m-w: min(calc(var(--sw-m-wash) * var(--sw-m-t)), var(--sw-m-wash-cap));');
  expect(b).toContain('--sw-m-t: calc(var(--sw-m-tint) * var(--sw-m-on, 0));');
  // lists: a side stripe scaled by the tint dial, never a washed row; the chrome never carries a tone
  expect(b).toContain(":host(sw-pill[data-density='row'][on]:not([accent])) { border-inline-start: calc(6px * min(1, var(--sw-m-tint)))");
  expect(b).toContain(":host(devices-building[data-skin='bubble']) .arow[data-on='true'] { border-inline-start:");
  expect(b).toMatch(/nav\.tree, :host\(sw-app\) nav\.rail\.rail \{[^}]*--sw-m-on: 0;/);
  // the gradient surface takes no wash (two colours on one tile fight)
  expect(b).toMatch(/sw-pill\[data-surface='gradient'\][^{]*\{[^}]*--sw-m-on: 0;[^}]*box-shadow/);
  // the domus layer keeps the skin's own sheen and shadows under the material
  const d = materialRules('domus');
  expect(d).toContain(`${MATERIAL_LAYERS}, var(--sw-glass-sheen)`);
  expect(d).toContain('var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), ' + MATERIAL_SHADOWS);
});

test('material wash cap: for every skin x scheme and every ready palette x scheme the computed cap keeps text and muted text at >= 4.5:1 on every tone washed at the cap and below, is tight, and leaves the soft wash (28 %) usable on every ready palette', () => {
  const caps: string[] = [];
  const check = (label: string, v: (n: string) => string) => {
    const m = washModelOf(v);
    expect(m, `${label} wash model`).toBeTruthy();
    expect(m!.tones.length, `${label} tones`).toBe(WASH_TONES.length);
    const cap = washCap(m!);
    caps.push(`${label}: ${cap}%`);
    expect(cap % 2).toBe(0);
    expect(cap).toBeLessThanOrEqual(WASH_MAX);
    for (let s = 2; s <= cap; s += 2) expect(worstWashContrast(m!, s), `${label} wash ${s}%`).toBeGreaterThanOrEqual(4.5);
    if (cap < WASH_MAX) expect(worstWashContrast(m!, cap + 2), `${label} above the cap`).toBeLessThan(4.5);
    return cap;
  };
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of ['light', 'dark'] as const) {
      const cap = check(`${id}/${mode}`, (n) => t[n]?.[mode] ?? '');
      // the skins that draw the material keep a usable wash (the resting bubble dark surface is the tightest: light text over a dark surface loses contrast fastest under a bright tone)
      if ((MATERIAL_SKINS as readonly string[]).includes(id)) expect(cap, `${id}/${mode} cap ${cap}%`).toBeGreaterThanOrEqual(14);
    }
  }
  const bubble = skinTable('bubble');
  for (const p of BUILTIN_PALETTES) {
    for (const mode of ['light', 'dark'] as const) {
      const pt = paletteTokens(p, mode);
      const cap = check(`${p.id}/${mode}`, (n) => pt[n] ?? bubble[n]?.[mode] ?? '');
      // the soft wash of every preset (18-28 % at tint = normal; neon's 34 % is capped) is never silently dead on a ready palette
      expect(cap, `${p.id}/${mode} cap ${cap}% (${caps.join(', ')})`).toBeGreaterThanOrEqual(28);
    }
  }
});