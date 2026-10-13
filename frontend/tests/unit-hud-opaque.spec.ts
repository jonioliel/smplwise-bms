import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS, SKINS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { TOKENS } from '../src/design/tokens';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';
import { PILL_INK, pillInk } from '../src/map/pill-ink';
import { HUD_SURFACES } from '../src/styles/menu-surface';

// The HUD panels over the plan and the 3D canvas are opaque (owner 2026-10-13, second report): the token side. Every panel paints
// `--sw-menu-surface`; this spec proves the text it carries reads on it - the ink tokens on the surface, on the fills a panel lays over
// it (a chip, a hover, a selected row), the pills' text twins, the night backdrop - at 4.5:1 in EVERY skin x scheme. The static twin (what the
// CSS paints and colours) is tests/unit-menu-lint.spec.ts, the browser twin (the computed alpha, blur and contrast of the real panels)
// tests/evidence-menu-opaque.spec.ts and tests/evidence-hud-opaque-live.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-hud-opaque.spec.ts

const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The colour a token has in a skin and scheme, as RGBA (a `var()` alias is followed through the table). */
function colorOf(id: (typeof SKIN_IDS)[number], scheme: Scheme, name: string): RGBA {
  const t = skinTable(id);
  let v = t[name]?.[scheme];
  for (let i = 0; i < 4 && v && v.startsWith('var('); i++) v = t[v.slice(4, -1).trim()]?.[scheme];
  const c = v ? parseColor(v) : null;
  if (!c) throw new Error(`${id}/${scheme} ${name}: cannot parse ${v}`);
  return c;
}
/** The surface a HUD panel paints, and `fill` laid over it (a translucent token composites; an opaque one replaces). */
function onSurface(id: (typeof SKIN_IDS)[number], scheme: Scheme, ...layers: string[]): RGBA {
  let bg = colorOf(id, scheme, '--sw-menu-surface');
  for (const l of layers) bg = over(colorOf(id, scheme, l), bg);
  return bg;
}

test('the HUD ink reads on the opaque panel surface: every ink token a HUD panel may use, every skin x scheme, 4.5:1', () => {
  // the lint (unit-menu-lint.spec.ts INK_OK) allows exactly these: --sw-text-3, a bare state colour and the bare accent are not on the list
  const ink = ['--sw-text', '--sw-heading', '--sw-text-2', '--sw-accent-text', '--sw-live-text', '--sw-recorded-text', '--sw-offline-text', '--sw-stale-text', '--sw-unknown-text', '--sw-danger-text', '--sw-warning-text', '--sw-forbidden-text', '--sw-map-temp'];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const scheme of SCHEMES) {
      const bg = onSurface(id, scheme);
      expect(bg[3], `${id}/${scheme} the panel surface is opaque`).toBe(1);
      for (const n of ink) {
        const r = contrastRatio(over(colorOf(id, scheme, n), bg), bg);
        if (r < 4.5) fails.push(`${id}/${scheme} ${n} on the HUD surface: ${r.toFixed(2)}`);
      }
    }
  }
  expect(fails, fails.join('\n')).toEqual([]);
});

test('text on the fills a HUD panel lays over its surface (a chip, a hover, a selected row, a pressed button) reads at 4.5:1 too', () => {
  // [ink token, the fills over the panel surface (in order), what it is, the minimum ratio (4.5 text; 3 for an icon that carries no text)]
  const pairs: [string, string[], string, number][] = [
    ['--sw-text', ['--sw-surface'], 'a chip or a button on a bar (sw-chip, sw-button)', 4.5],
    ['--sw-text-2', ['--sw-surface-2'], 'a floor of the strip under the pointer (its name is the secondary ink)', 4.5],
    ['--sw-text', ['--sw-surface-3'], 'a hovered or selected list row, with its caption (the side list)', 4.5],
    ['--sw-text', ['--sw-accent-soft'], 'the floor of the strip that is on screen', 4.5],
    ['--sw-accent-text', ['--sw-accent-soft'], 'a pressed editor rail tool (an icon, no text)', 3],
    ['--sw-text', ['--sw-stale-soft'], 'the banner: text on the amber tone laid over the surface', 4.5],
    ['--sw-text', ['--sw-hover-wash'], 'a washed row', 4.5],
  ];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const scheme of SCHEMES) {
      for (const [fg, layers, what, min] of pairs) {
        const bg = onSurface(id, scheme, ...layers);
        const r = contrastRatio(over(colorOf(id, scheme, fg), bg), bg);
        if (r < min) fails.push(`${id}/${scheme} ${fg} on ${layers.join(' + ')} (${what}): ${r.toFixed(2)} < ${min}`);
      }
      // the hover fill of a control on the bar: the menu surface washed 8 % towards the ink (color-mix in sw-plan-3d / the event page buttons)
      const ink = colorOf(id, scheme, '--sw-text');
      const wash = over([ink[0], ink[1], ink[2], 0.08], onSurface(id, scheme));
      const rWash = contrastRatio(over(ink, wash), wash);
      if (rWash < 4.5) fails.push(`${id}/${scheme} --sw-text on the hover wash of a bar control: ${rWash.toFixed(2)}`);
      // an accent fill is opaque: the pressed chip / walk button and the selected quick floor button put the inverse ink on it
      const accent = colorOf(id, scheme, '--sw-accent');
      const rAccent = contrastRatio(over(colorOf(id, scheme, '--sw-text-inverse'), accent), accent);
      if (rAccent < 4.5) fails.push(`${id}/${scheme} --sw-text-inverse on --sw-accent (a selected chip / a pressed button): ${rAccent.toFixed(2)}`);
    }
  }
  expect(fails, fails.join('\n')).toEqual([]);
});

test('the pill ink: every colour the 3D scene hands a pill maps to a readable twin that exists, and each twin reads on the opaque pill in every skin x scheme', () => {
  // the names scene-builder.ts gives a room-name / entity / label pill (the temperature chip is styled by the map-temp token in CSS)
  const emitted = ['live', 'stale', 'text-3', 'map-label', ...Object.keys(PILL_INK)];
  for (const [from, to] of Object.entries(PILL_INK)) expect(TOKENS[`--sw-${to}`], `--sw-${to} (the twin of ${from}) is a declared token`).toBeTruthy();
  const fails: string[] = [];
  for (const name of emitted) {
    const css = pillInk(name);
    const token = /^var\((--sw-[a-z0-9-]+)\)$/.exec(css)?.[1];
    expect(token, `${name} -> ${css}`).toBeTruthy();
    expect(token, `${name}: a bare colour is never the pill's text`).not.toBe(`--sw-${name}`);
    for (const id of SKIN_IDS) {
      for (const scheme of SCHEMES) {
        const bg = onSurface(id, scheme);
        const r = contrastRatio(over(colorOf(id, scheme, token!), bg), bg);
        if (r < 4.5) fails.push(`${id}/${scheme} pill ink ${name} -> ${token}: ${r.toFixed(2)}`);
      }
    }
  }
  expect(fails, fails.join('\n')).toEqual([]);
  // a name the map does not know passes through as the token it is (no crash, no invention)
  expect(pillInk('map-temp')).toBe('var(--sw-map-temp)');
  expect(pillInk('live')).toBe('var(--sw-live-text)');
});

test('the 3D night backdrop is an opaque navy with light ink that reads on it', () => {
  const css = readFileSync(path.resolve(HERE, '../src/map/sw-plan-3d.ts'), 'utf8');
  const m = /:host\(\[data-night\]\) \.bar,\s*:host\(\[data-night\]\) \.strip \{([^}]*)\}/.exec(css);
  expect(m, 'the night rule of the bar and the strip exists').toBeTruthy();
  const bg = /background:\s*(#[0-9a-f]{6})\s*;/i.exec(m![1])?.[1];
  const ink = /(?:^|[;\s])color:\s*(#[0-9a-f]{6})\s*;/i.exec(m![1])?.[1];
  expect(bg, `the night backdrop is a plain opaque hex, not a mix: ${m![1].trim()}`).toBeTruthy();
  expect(ink).toBeTruthy();
  expect(m![1]).not.toMatch(/color-mix|rgba|transparent/);
  expect(contrastRatio(parseColor(ink!)!, parseColor(bg!)!)).toBeGreaterThanOrEqual(4.5);
});

test('Tesla draws chips and secondary buttons flat and transparent on the page: they take their fill from --hud-fill, which every HUD bar of shared controls sets', () => {
  const rules = SKINS.tesla.rules;
  // the hook is read by exactly the two rules that make a control transparent (chip, secondary / danger button), with the transparent fallback
  expect(rules).toMatch(/:host\(sw-chip\) button \{ background: var\(--hud-fill, transparent\);/);
  expect(rules).toMatch(/:host\(sw-button\[variant='secondary'\]\) button, :host\(sw-button\[variant='danger'\]\) button \{ background: var\(--hud-fill, transparent\); \}/);
  expect(rules).not.toMatch(/:host\(sw-chip\) button \{ background: transparent/); // (no hard-wired flat chip is left behind)
  // and the registered bars of shared controls set it to the opaque menu surface (the lint proves the rule: unit-menu-lint.spec.ts)
  const bars = HUD_SURFACES.filter((h) => h.via === 'surface-token');
  expect(bars.map((b) => `${b.file} | ${b.selector}`).sort()).toEqual(['map/sw-plan-3d.ts | .bar', 'screens/investigate-event-detail.ts | .tools3d']);
  for (const b of bars) {
    const src = readFileSync(path.resolve(HERE, '../src', b.file), 'utf8');
    const rule = new RegExp(`\\n\\s*${b.selector.replace('.', '\\.')} \\{([^}]*)\\}`).exec(src);
    expect(rule, `${b.file} ${b.selector}`).toBeTruthy();
    expect(rule![1], `${b.file} ${b.selector} sets the hook`).toContain('--hud-fill: var(--sw-menu-surface);');
  }
});

test('the owner\'s list is registered: the floor strip, floor chip, level bar, legend, side list, selection bar, time pill and walk bar', () => {
  const have = (file: string, sel: string) => HUD_SURFACES.some((h) => h.file === file && h.selector === sel);
  for (const [file, sel] of [
    ['screens/explore-floor-map.ts', '.floorstrip'],
    ['screens/explore-floor-map.ts', '.floorchip'],
    ['screens/explore-floor-map.ts', '.levelbar'],
    ['screens/explore-floor-map.ts', '.legend'],
    ['screens/explore-floor-map.ts', '.sidelist'],
    ['screens/explore-floor-map.ts', '.pickbar'],
    ['map/sw-plan-3d.ts', '.timepill'],
    ['map/walk-hud.ts', '.walkbar'],
  ]) expect(have(file, sel), `${file} | ${sel}`).toBe(true);
});
