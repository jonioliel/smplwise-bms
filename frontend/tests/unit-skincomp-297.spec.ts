import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKENS, TOKEN_GROUPS } from '../src/design/tokens';
import { RAIL_TONES, SKINS, SKIN_IDS, SKIN_RULE_BUDGET, darkRailOn, isRailTone } from '../src/design/skins';
import { ruleCount, skinTable, tokensCss } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';
import { ARX_KPI_RULES, ARX_RAIL_RULES, INFRA_RAIL_FILL_RULES, SOFT_COMPONENT_RULES } from '../src/design/skins/arx-components';
import { INFRA_DARK_RAIL } from '../src/design/skins/infra';

// SKINCOMP-297 (owner 2026-10-27): what SKINFOUND-297 left out of the two Arx skins - the component rules (KPI without the icon box; Soft:
// pill buttons, the 51 x 31 switch, the lit glow), the rail tokens --sw-rail-*, the elevator state tokens --sw-el-*, and option D (Arx
// Infra with a dark rail, `ui.rail_tone`). Node only: the tables, the generated CSS, the rule texts and the WCAG contrast of every new pair.
// classic / domus / tesla / crystal (and the frozen bubble) must stay as they were.
//   npx playwright test -c playwright.unit.config.ts tests/unit-skincomp-297.spec.ts

const ARX = ['infra', 'soft'] as const;
const OTHERS = SKIN_IDS.filter((id) => !(ARX as readonly string[]).includes(id));
const SCHEMES = ['light', 'dark'] as const;
const RAIL = ['--sw-rail-bg', '--sw-rail-text', '--sw-rail-active', '--sw-rail-active-bg', '--sw-rail-border'];
const EL = ['--sw-el-wait', '--sw-el-act', '--sw-el-trav', '--sw-el-fault', '--sw-el-off', '--sw-el-fire', '--sw-el-unk'];
const EL_BEFORE = ['#15803d', '#1d4ed8', '#0e7490', '#c81e1e', '#c2410c', '#881337', '#667085']; // the literals of elevators/styles.ts before
const P = (s: string): RGBA => {
  const c = parseColor(s);
  if (!c) throw new Error(`cannot parse ${s}`);
  return c;
};
/** color-mix(in srgb, a p%, b) for opaque b. */
const mix = (a: RGBA, p: number, b: RGBA): RGBA => [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat(1) as RGBA;

test('tokens: the rail and elevator names are declared once, the rail base is the shell\'s own colours, the elevator values are the old literals', () => {
  const groups = Object.fromEntries(TOKEN_GROUPS.map((g) => [g.id, Object.keys(g.tokens)]));
  expect(groups.rail).toEqual(RAIL);
  expect(groups.elevator).toEqual(EL);
  // the base rail = what sw-app paints with its own names (so nothing reads differently where a skin does not set them)
  expect(RAIL.map((n) => TOKENS[n].light)).toEqual(['var(--sw-surface)', 'var(--sw-text-2)', 'var(--sw-accent-text)', 'var(--sw-accent-soft)', 'var(--sw-border)']);
  for (const n of RAIL) expect(TOKENS[n].dark, n).toBe(TOKENS[n].light);
  EL.forEach((n, i) => expect([TOKENS[n].light, TOKENS[n].dark], n).toEqual([EL_BEFORE[i], EL_BEFORE[i]]));
  // the elevators' styles no longer declare the colours on their host (tokens.ts is the one place a --sw-* token is declared)
  const styles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/elevators/styles.ts'), 'utf-8');
  for (const n of EL) expect(styles, `${n} declared in elevators/styles.ts`).not.toMatch(new RegExp(`${n}\\s*:`));
  expect(styles).toContain("[data-look='wait'] { --el-c: var(--sw-el-wait); }");
});

test('the other skins are untouched: no rail / elevator override, no dark rail, no Arx component rule', () => {
  for (const id of OTHERS) {
    const s = SKINS[id];
    for (const n of [...RAIL, ...EL]) expect(s.tokens[n], `${id} sets ${n}`).toBeUndefined();
    expect(s.darkRail, `${id} dark rail`).toBeUndefined();
    expect(darkRailOn(id, 'dark'), id).toBe(false);
    for (const marker of ['--sw-rail-', 'arx kpi', 'arx rail', 'soft 6', 'soft 7', 'soft 8']) expect(s.rules, `${id} rules carry ${marker}`).not.toContain(marker);
    expect(skinTable(id, true)).toEqual(skinTable(id)); // the dark-rail table of a skin without one is its plain table
  }
  expect(SKINS.classic.tokens).toEqual({});
  expect(SKINS.classic.rules).toBe('');
  // the generated CSS has a dark-rail block for infra only
  const css = tokensCss();
  expect(css.match(/\[data-rail="dark"\]/g)?.length).toBe(3); // infra's light block, its dark block and the OS-dark twin
  expect(css).toContain(':root[data-skin="infra"][data-rail="dark"]{');
  expect(css).toContain(':root[data-skin="infra"][data-rail="dark"][data-theme="dark"]{');
  expect(css).toContain('@media (prefers-color-scheme: dark){:root[data-skin="infra"][data-rail="dark"]:not([data-theme="light"]):not([data-theme="dark"]){');
  // after every skin block (the source order the specificity relies on in the light scheme)
  expect(css.indexOf('[data-rail="dark"]')).toBeGreaterThan(css.lastIndexOf(':root[data-skin="soft"]'));
});

test('rules: Infra and Soft draw the KPI dot and the rail tokens; Soft alone has pill buttons, the 51 x 31 switch and the lit glow; budget and logos kept', () => {
  for (const id of ARX) {
    const r = SKINS[id].rules;
    expect(r, id).toContain(ARX_KPI_RULES.trim());
    expect(r, id).toContain(ARX_RAIL_RULES.trim());
    expect(ruleCount(r), `${id} rule budget`).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
    for (const sel of ['brand-tile', 'sw-brand', 'data-brand', 'homebrand', 'leadbrand', 'cornerrow', 'bsep', 'logo', 'float', 'pillrow', 'subnav', 'tabpair', 'data-dd', 'sw-dropdown']) expect(r, `${id} rules touch ${sel}`).not.toContain(sel);
    expect(r).not.toMatch(/display:\s*none/);
    expect(r).not.toMatch(/transition:\s*all/);
  }
  expect(SKINS.infra.rules).toContain(INFRA_RAIL_FILL_RULES.trim());
  expect(SKINS.infra.rules).not.toContain(SOFT_COMPONENT_RULES.trim());
  expect(SKINS.soft.rules).toContain(SOFT_COMPONENT_RULES.trim());
  // the rule values the design system names
  expect(ARX_KPI_RULES).toMatch(/\.icon\.icon \{ inline-size: 10px; block-size: 10px; border-radius: 50%/);
  expect(SOFT_COMPONENT_RULES).toContain('border-radius: var(--sw-r-pill)');
  expect(SOFT_COMPONENT_RULES).toContain('inline-size: 51px; block-size: 31px;');
  expect(SOFT_COMPONENT_RULES).toContain('inline-size: 27px; block-size: 27px;');
  expect(SOFT_COMPONENT_RULES).toContain('translateX(-20px)'); // 51 - 27 - 2 x 2 px inset
  expect(SOFT_COMPONENT_RULES).toContain('0 8px 24px color-mix(in srgb, var(--sw-lit) 28%, transparent)');
  expect(SOFT_COMPONENT_RULES).toContain(":host(devices-area:not([data-devices-style='glass']))"); // the glass device style keeps its own glow
  // the soft rail fill reads the rail tokens (under the sheen)
  expect(SKINS.soft.rules).toContain('background: var(--sw-glass-sheen), var(--sw-rail-bg)');
});

test('the rail values are the design system\'s (TOKENS.md §1.2 / §2 / §3, round 2), and option D is Arx Infra only', () => {
  const pick = (t: Record<string, { light: string; dark: string }>) => RAIL.map((n) => [t[n].light, t[n].dark]);
  expect(pick(skinTable('infra'))).toEqual([
    ['#ffffff', '#0f1526'],
    ['#4b5976', '#a9b4ca'],
    ['#2062ec', '#8fb2ff'],
    ['#e9f0ff', 'rgba(91, 140, 255, 0.18)'],
    ['#e7ebf2', '#232e45'],
  ]);
  expect(pick(skinTable('soft'))).toEqual([
    ['rgba(255, 255, 255, 0.6)', 'rgba(16, 21, 38, 0.6)'],
    ['#4d5a72', '#aeb8cc'],
    ['#2158d4', '#9ec0ff'],
    ['rgba(47, 109, 246, 0.12)', 'rgba(91, 141, 255, 0.2)'],
    ['rgba(30, 41, 59, 0.08)', 'rgba(255, 255, 255, 0.08)'],
  ]);
  expect(pick(INFRA_DARK_RAIL).map((x) => x[0])).toEqual(['#141b2b', '#aab6cc', '#ffffff', 'rgba(255, 255, 255, 0.1)', '#141b2b']);
  // in the dark scheme the dark rail is Infra's own navy rail
  for (const n of RAIL) expect(INFRA_DARK_RAIL[n].dark, n).toBe(skinTable('infra')[n].dark);
  expect([...RAIL_TONES]).toEqual(['auto', 'dark']);
  expect(isRailTone('dark') && isRailTone('auto')).toBe(true);
  for (const bad of ['light', 'Dark', '', 'navy', null]) expect(isRailTone(bad), String(bad)).toBe(false);
  expect(darkRailOn('infra', 'dark')).toBe(true);
  expect(darkRailOn('infra', 'auto')).toBe(false);
  expect(darkRailOn('soft', 'dark')).toBe(false);
});

test('contrast: rail labels and the current item >= 4.5:1 on the rail (Infra, Soft over every canvas bed, Infra dark rail), light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  const cases: [string, boolean][] = [['infra', false], ['soft', false], ['infra', true]];
  for (const [id, dark] of cases) {
    for (const mode of SCHEMES) {
      const t = skinTable(id as 'infra' | 'soft', dark);
      const v = (n: string) => t[n][mode];
      // what is under the rail: the page colour and, for a canvas with blooms, each bloom on each stop
      const grounds: RGBA[] = [P(v('--sw-bg'))];
      const canvas = (v('--sw-canvas').match(/#[0-9a-f]{6}\b|rgba?\([^)]*\)/gi) ?? []).map(P);
      for (const st of canvas.filter((c) => c[3] >= 1)) for (const bl of canvas.filter((c) => c[3] < 1)) grounds.push(over(bl, st));
      // the solid twin (reduced transparency, no backdrop-filter, more contrast)
      const fills = grounds.map((g) => over(P(v('--sw-rail-bg')), g));
      if (id === 'soft') fills.push(P(v('--sw-surface-solid')));
      let worst = Infinity;
      for (const bed of fills) {
        const label = contrastRatio(over(P(v('--sw-rail-text')), bed), bed);
        const pill = over(P(v('--sw-rail-active-bg')), bed);
        const current = contrastRatio(over(P(v('--sw-rail-active')), pill), pill);
        const hover = mix(P(v('--sw-rail-text')), 0.12, bed);
        const hovered = contrastRatio(over(P(v('--sw-rail-text')), hover), hover);
        worst = Math.min(worst, label, current, hovered);
      }
      const row = `${id}${dark ? ' (dark rail)' : ''}/${mode}: worst ${worst.toFixed(2)}`;
      rows.push(row);
      if (worst < 4.5) fails.push(row);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('contrast: white text on every elevator state colour >= 4.5:1 in every skin; Soft\'s lit tile keeps its text >= 4.5:1', () => {
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const mode of SCHEMES) {
      const t = skinTable(id);
      for (const n of EL) {
        const r = contrastRatio(P('#ffffff'), P(t[n][mode]));
        if (r < 4.5) fails.push(`${id}/${mode} white on ${n}: ${r.toFixed(2)}`);
      }
    }
  }
  // soft 8: the lit tile = color-mix(--sw-lit 16 %, --sw-surface-solid); the name (--sw-text) and the state line (--sw-text-2) sit on it
  for (const mode of SCHEMES) {
    const t = skinTable('soft');
    const bed = mix(P(t['--sw-lit'][mode]), 0.16, P(t['--sw-surface-solid'][mode]));
    for (const n of ['--sw-text', '--sw-text-2']) {
      const r = contrastRatio(P(t[n][mode]), bed);
      if (r < 4.5) fails.push(`soft/${mode} ${n} on the lit tile: ${r.toFixed(2)}`);
    }
  }
  expect(fails).toEqual([]);
});
