import { test, expect } from '@playwright/test';
import { TOKENS } from '../src/design/tokens';
import { DEFAULT_SKIN, FOUNDATION_SKINS, FROZEN_SKINS, SELECTABLE_SKIN_IDS, SKINS, SKIN_IDS, SKIN_RULE_BUDGET, isSelectableSkin, resolveSkin } from '../src/design/skins';
import { REDUCED_MOTION_ARX, ruleCount, skinRules, skinTable, tokensCss } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';
import { ARX_MOTION_RULES, ARX_MOTION_TOKENS } from '../src/design/skins/arx-motion';
import { INFRA_TOKENS } from '../src/design/skins/infra';

// SKINFOUND-297 (owner 2026-10-27): the foundation of the two Arx design-system skins - "Arx Infra" (direction A) and "Arx Soft"
// (direction C) - as ADDITIONAL selectable skins next to classic / domus / tesla / crystal (bubble stays frozen), the default unchanged.
// Node only: the registry, the token tables (light AND dark), the WCAG 4.5:1 text contrast of the new tables, the motion layer and its
// reduced-motion handling, and the promise that nothing changes for anyone who does not pick them.
//   npx playwright test -c playwright.unit.config.ts tests/unit-skinfound-297.spec.ts

const ARX = ['infra', 'soft'] as const;
const OTHERS = SKIN_IDS.filter((id) => !(ARX as readonly string[]).includes(id));
// POLISH-CLASSIC-DOMUS-297 (round 4): the two main skins carry their own motion layer (skins/polish-motion.ts); the rest stay neutral
const POLISHED = ['classic', 'domus'] as const;
const NEUTRAL = OTHERS.filter((id) => !(POLISHED as readonly string[]).includes(id));
const SCHEMES = ['light', 'dark'] as const;
const MOTION_NAMES = Object.keys(ARX_MOTION_TOKENS).filter((n) => !['--sw-t-fast', '--sw-t-med', '--sw-t-sheet', '--sw-t-state', '--sw-ease', '--sw-ease-thumb'].includes(n));

test('registry: infra and soft are registered, selectable, at the foundation stage, with the Hebrew labels "Arx Infra" / "Arx Soft"; the default and the freeze are unchanged', () => {
  expect([...SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'bubble', 'crystal', 'infra', 'soft']);
  expect(DEFAULT_SKIN).toBe('classic'); // the owner decides the default after round 2
  expect([...FROZEN_SKINS]).toEqual(['bubble']);
  expect([...SELECTABLE_SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft']);
  expect([...FOUNDATION_SKINS]).toEqual(['infra', 'soft']);
  for (const id of ARX) {
    expect(SKINS[id].id).toBe(id);
    expect(isSelectableSkin(id)).toBe(true);
    expect(resolveSkin(id)).toBe(id);
  }
  expect(SKINS.infra.nameHe).toBe('Arx Infra');
  expect(SKINS.soft.nameHe).toBe('Arx Soft');
  expect(SKINS.infra.noteHe.length).toBeGreaterThan(0);
  expect(SKINS.soft.noteHe.length).toBeGreaterThan(0);
  // Arx Ops (direction B) is not built (owner 2026-10-27)
  for (const no of ['ops', 'arx-ops', 'arx-infra', 'arx-soft', 'Infra']) expect(resolveSkin(no), no).toBeNull();
});

test('token tables: every override names a declared token and carries a light AND a dark value; the rules stay inside the budget', () => {
  for (const id of ARX) {
    const s = SKINS[id];
    expect(Object.keys(s.tokens).length, id).toBeGreaterThan(30);
    for (const [name, v] of Object.entries(s.tokens)) {
      expect(TOKENS[name], `${id}: unknown token ${name}`).toBeTruthy();
      expect(v.light.trim() && v.dark.trim(), `${id}: ${name} needs both columns`).toBeTruthy();
    }
    expect(ruleCount(s.rules), `${id} rules`).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
    expect(skinRules(id)).toBe(s.rules); // no material layer (styles/material.ts is domus / bubble only)
    expect(s.rules).toContain(ARX_MOTION_RULES.trim());
  }
  // the generated CSS has a block set per Arx skin, light and dark (and the OS-dark twin)
  const css = tokensCss();
  for (const id of ARX) {
    expect(css).toContain(`:root[data-skin="${id}"]{`);
    expect(css).toContain(`:root[data-skin="${id}"][data-theme="dark"]{`);
    expect(css).toContain(`@media (prefers-color-scheme: dark){:root[data-skin="${id}"]:not([data-theme="light"]):not([data-theme="dark"]){`);
  }
});

test('the values are the design system\'s measured ones (TOKENS.md §1 / §3 as corrected by round 2), not new colours', () => {
  const i = skinTable('infra');
  const s = skinTable('soft');
  const pick = (t: ReturnType<typeof skinTable>, n: string) => [t[n].light, t[n].dark];
  // A: the stronger hairline, the round-2 muted tiers, the darker state text, density, the 24 px title
  expect(pick(i, '--sw-border-strong')).toEqual(['#d9dfe9', '#2f3c58']);
  expect(pick(i, '--sw-text-3')).toEqual(['#596985', '#93a0b8']);
  expect(pick(i, '--sw-text-2')).toEqual(['#4b5976', '#b0bbd0']);
  expect(pick(i, '--sw-stale-text')).toEqual(['#a04a06', '#f5b043']);
  expect(pick(i, '--sw-offline-text')[0]).toBe('#5c6573');
  expect(i['--sw-touch'].light).toBe('44px');
  expect([i['--sw-ctl-h-sm'].light, i['--sw-ctl-h-md'].light, i['--sw-ctl-h-lg'].light]).toEqual(['28px', '34px', '40px']);
  expect(i['--sw-page-pad'].light).toBe('24px');
  expect(i['--sw-h1'].light).toBe('24px');
  expect(i['--sw-glass-blur'].light).toBe('none'); // A has no glass
  // A keeps the classic surfaces and accent (it is "classic with the deltas")
  for (const n of ['--sw-bg', '--sw-surface', '--sw-surface-solid', '--sw-accent', '--sw-text', '--sw-heading']) expect(pick(i, n), n).toEqual([TOKENS[n].light, TOKENS[n].dark]);
  // C: the material, the vibrancy text, the dark accent that keeps white text at 4.8:1, rounder shapes
  expect(pick(s, '--sw-bg')).toEqual(['#eef2f9', '#0b1020']);
  expect(pick(s, '--sw-surface-solid')).toEqual(['#fdfdfe', '#1a2032']);
  expect(pick(s, '--sw-text-2')).toEqual(['#44516a', '#b6c0d4']);
  expect(pick(s, '--sw-text-3')).toEqual(['#566480', '#97a3bb']);
  expect(pick(s, '--sw-accent')).toEqual(['#2f6df6', '#2f6df6']);
  expect(pick(s, '--sw-live-text')).toEqual(['#0e6b33', '#7ee29a']);
  expect(pick(s, '--sw-toggle-on')).toEqual(['#34c759', '#30d158']);
  expect(s['--sw-r-md'].light).toBe('18px');
  expect(s['--sw-glass-blur'].light).toBe('blur(18px) saturate(1.4)');
  expect(s['--sw-glass-blur-sheet'].light).toBe('none'); // sheets are opaque
  // C is built on A: the density and the motion of A unless C says otherwise
  expect(s['--sw-touch'].light).toBe(INFRA_TOKENS['--sw-touch'].light);
  expect(s['--sw-gap'].light).toBe('14px');
});

// ---- WCAG 2.x: every text token of the new tables reads at >= 4.5:1 on every bed it is drawn on ----
type Beds = Record<string, RGBA>;
const colours = (s: string): RGBA[] => (s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi) ?? []).map((c) => parseColor(c)).filter((c): c is RGBA => !!c);

function beds(id: (typeof ARX)[number], mode: (typeof SCHEMES)[number]): { v: (n: string) => string; beds: Beds } {
  const t = skinTable(id);
  const v = (n: string) => t[n][mode];
  const P = (n: string) => {
    const c = parseColor(v(n));
    if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${v(n)}`);
    return c;
  };
  const bg = P('--sw-bg');
  const solid = P('--sw-surface-solid');
  const b: Beds = { bg, 'surface-solid': solid, 'surface-2-solid': P('--sw-surface-2-solid'), 'menu-surface': P('--sw-menu-surface') };
  for (const n of ['--sw-surface', '--sw-surface-2', '--sw-nav-glass']) b[`${n.slice(5)} over bg`] = over(P(n), bg);
  b['surface-3 over surface-solid'] = over(P('--sw-surface-3'), solid);
  // a canvas with blooms (soft): the glass over each bloom on each stop, and the bare canvas at each bloom's centre (full alpha)
  const canvas = colours(v('--sw-canvas'));
  const stops = canvas.filter((c) => c[3] >= 1);
  const blooms = canvas.filter((c) => c[3] < 1);
  stops.forEach((st, i) =>
    blooms.forEach((bl, j) => {
      b[`canvas: bloom ${j + 1} on stop ${i + 1}`] = over(bl, st);
      b[`surface over bloom ${j + 1} on stop ${i + 1}`] = over(P('--sw-surface'), over(bl, st));
    }),
  );
  return { v, beds: b };
}

test('contrast: body, heading, secondary, tertiary and accent text >= 4.5:1 on every surface and canvas bed of infra and soft, light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of ARX) {
    for (const mode of SCHEMES) {
      const { v, beds: b } = beds(id, mode);
      for (const n of ['--sw-text', '--sw-heading', '--sw-text-2', '--sw-text-3', '--sw-accent-text']) {
        const fg = parseColor(v(n))!;
        let worst = Infinity;
        let where = '';
        for (const [bed, c] of Object.entries(b)) {
          const r = contrastRatio(over(fg, c), c);
          if (r < worst) [worst, where] = [r, bed];
        }
        rows.push(`${id}/${mode} ${n} ${v(n)}: ${worst.toFixed(2)} (${where})`);
        if (worst < 4.5) fails.push(rows[rows.length - 1]);
      }
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('contrast: every state text on its own soft fill (over the solid surface), text on the accent and on the count badge >= 4.5:1', () => {
  const fails: string[] = [];
  for (const id of ARX) {
    for (const mode of SCHEMES) {
      const t = skinTable(id);
      const P = (n: string) => parseColor(t[n][mode])!;
      const solid = P('--sw-surface-solid');
      for (const st of ['live', 'recorded', 'offline', 'stale', 'unknown', 'danger', 'warning', 'success', 'forbidden']) {
        const bed = over(P(`--sw-${st}-soft`), solid);
        const r = contrastRatio(over(P(`--sw-${st}-text`), bed), bed);
        if (r < 4.5) fails.push(`${id}/${mode} ${st}-text on ${st}-soft: ${r.toFixed(2)}`);
      }
      const onAccent = contrastRatio(P('--sw-text-inverse'), P('--sw-accent'));
      if (onAccent < 4.5) fails.push(`${id}/${mode} text-inverse on accent: ${onAccent.toFixed(2)}`);
      const badge = contrastRatio(P('--sw-badge-fg'), P('--sw-badge-bg'));
      if (badge < 4.5) fails.push(`${id}/${mode} count badge: ${badge.toFixed(2)}`);
    }
  }
  expect(fails).toEqual([]);
});

test('menus stay opaque under both Arx skins (owner 2026-10-13): the menu pair is a plain opaque colour, stated by the skin itself', () => {
  for (const id of ARX) {
    for (const n of ['--sw-menu-surface', '--sw-menu-border']) {
      expect(SKINS[id].tokens[n], `${id} sets ${n}`).toBeTruthy();
      for (const mode of SCHEMES) expect(parseColor(SKINS[id].tokens[n][mode])?.[3], `${id}/${mode} ${n}`).toBe(1);
    }
  }
});

test('motion: the Arx names are neutral in the base (classic and every other skin draw what they drew), round 2 values under infra and soft, zero under reduced motion', () => {
  // neutral base: no press scale, no entrance, no stagger
  expect(TOKENS['--sw-press-scale'].light).toBe('1');
  expect(TOKENS['--sw-enter-ms'].light).toBe('0ms');
  expect(TOKENS['--sw-enter-y'].light).toBe('0px');
  expect(TOKENS['--sw-stagger'].light).toBe('0ms');
  // no other skin sets an Arx motion name: their merged table carries the neutral base values
  for (const id of NEUTRAL) for (const n of MOTION_NAMES) expect(SKINS[id].tokens[n], `${id} must not set ${n}`).toBeUndefined();
  // the Arx skins carry round 2 (r2.css §1)
  for (const id of ARX) {
    const t = skinTable(id);
    expect(t['--sw-t-press'].light).toBe('140ms');
    expect(t['--sw-t-med'].light).toBe('220ms');
    expect(t['--sw-t-slow'].light).toBe('280ms');
    expect(t['--sw-ease'].light).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    expect(t['--sw-ease-in-out'].light).toBe('cubic-bezier(0.77, 0, 0.175, 1)');
    expect(t['--sw-ease-drawer'].light).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    expect(t['--sw-spring-toggle'].light.startsWith('linear(0, 0.081,')).toBe(true);
    expect(t['--sw-spring-toggle-ms'].light).toBe('385ms');
    expect(t['--sw-press-scale'].light).toBe('0.97');
    // never `transition: all` in the motion rules
    expect(SKINS[id].rules).not.toMatch(/transition:\s*all/);
  }
  // reduced motion: one block for every skin, !important so a skin's dark block cannot win; every Arx duration, the rise and the press scale
  const css = tokensCss();
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const n of [...MOTION_NAMES.filter((x) => x.endsWith('-ms') || x.startsWith('--sw-t-') || x === '--sw-stagger'), '--sw-t-fast', '--sw-t-med']) {
    if (n === '--sw-ease-in-out' || n === '--sw-ease-drawer' || n === '--sw-ease-color') continue;
    expect(block, n).toMatch(new RegExp(`${n}:0ms !important`));
  }
  expect(block).toContain('--sw-enter-y:0px !important');
  expect(block).toContain('--sw-press-scale:1 !important');
  expect(REDUCED_MOTION_ARX).toContain('--sw-spring-toggle-ms:0ms !important;');
});

test('nothing changes for a skin that is not picked: the other skins\' tables carry no Arx value except the new neutral names', () => {
  for (const id of NEUTRAL) {
    const t = skinTable(id);
    // the merged table = the base + the skin's own overrides; the new names resolve to the base (neutral) value
    for (const n of [...MOTION_NAMES, '--sw-gap-lg', '--sw-page-pad-phone', '--sw-fs-4xl', '--sw-lh-tight']) {
      expect(t[n], `${id}: ${n}`).toEqual(TOKENS[n]);
    }
  }
  // the base keeps the classic values the foundation spec pins (pixel-stable classic)
  expect(TOKENS['--sw-t-fast'].light).toBe('120ms');
  expect(TOKENS['--sw-t-med'].light).toBe('200ms');
  expect(TOKENS['--sw-ease'].light).toBe('cubic-bezier(0.2, 0, 0, 1)');
  expect(TOKENS['--sw-touch'].light).toBe('36px');
  // classic's polish layer moves no size and no density (POLISH-CLASSIC-DOMUS-297)
  for (const n of ['--sw-touch', '--sw-gap-lg', '--sw-page-pad-phone', '--sw-fs-4xl', '--sw-lh-tight', '--sw-t-fast', '--sw-t-med']) expect(SKINS.classic.tokens[n], n).toBeUndefined();
  for (const id of POLISHED) expect(skinTable(id)['--sw-press-scale'].light, id).toBe('0.96'); // POLISH-BOLD-297: .97 -> .96
});

test('logos: the Arx skins never restyle or hide the SmplWise mark, the corner strip or the installation logo slot', () => {
  for (const id of ARX) {
    const r = SKINS[id].rules;
    for (const sel of ['brand-tile', 'sw-brand', 'data-brand', 'homebrand', 'leadbrand', 'cornerrow', 'bsep', 'logo']) expect(r, `${id} rules touch ${sel}`).not.toContain(sel);
    expect(r).not.toMatch(/display:\s*none/);
  }
});
