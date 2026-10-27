import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TOKENS, TOKEN_GROUPS } from '../src/design/tokens';
import {
  BEVEL_SKINS,
  DEFAULT_SKIN,
  FOUNDATION_SKINS,
  FROZEN_FALLBACK_SKIN,
  FROZEN_SKINS,
  SELECTABLE_SKIN_IDS,
  SKINS,
  SKIN_IDS,
  defineSkin,
  derivedFeatures,
  skinProblems,
} from '../src/design/skins';
import { REDUCED_MOTION_ARX, REDUCED_MOTION_CORE, skinRules, skinTable, tokensCss } from '../src/design/css';
import { materialRules } from '../src/styles/material';
import {
  ELEVATION_SCALE,
  MOTION_DURATIONS,
  MOTION_SCALE,
  MOTION_TRAVEL,
  RADIUS_SCALE,
  SEMANTIC_NAMES,
  SPACING_SCALE,
  STATUS_NAMES,
  SURFACE_LEVELS,
  TEXT_LEVELS,
  TYPE_SCALE,
  statusTokens,
  validateSkinTable,
} from '../src/design/semantic';

// DESIGNTOKENS-297 (version 2.25.0 foundations): the semantic contract of the design-variables layer (design/semantic.ts), the skin
// registry as data (design/skins/define.ts: stage + pixel / bevel features, defineSkin) and the reduced-motion block generated from the
// motion roles. Node only; nothing here draws a pixel - the "no visual change" promise is that the generated design CSS of every skin is
// byte-identical to release/2240 (checked on the branch, see the commit message) and that every existing skin conforms as it is.
//   npx playwright test -c playwright.unit.config.ts tests/unit-designtokens-297.spec.ts

const here = dirname(fileURLToPath(import.meta.url));

test('the semantic roles name existing tokens only (no parallel alias family) and cover every scale the brief lists', () => {
  for (const n of SEMANTIC_NAMES) expect(TOKENS[n], `role points at an undeclared token ${n}`).toBeTruthy();
  expect(SEMANTIC_NAMES.some((n) => n.startsWith('--sw-sem'))).toBe(false);
  expect(SURFACE_LEVELS.length).toBe(4);
  expect(TEXT_LEVELS.length).toBe(4);
  expect(RADIUS_SCALE.length).toBeGreaterThanOrEqual(6);
  expect(ELEVATION_SCALE.length).toBe(3);
  expect(SPACING_SCALE.length).toBeGreaterThanOrEqual(8);
  expect(TYPE_SCALE.length).toBeGreaterThanOrEqual(9);
  for (const s of STATUS_NAMES) for (const n of Object.values(statusTokens(s))) expect(TOKENS[n], n).toBeTruthy();
});

test('every registered skin (frozen included) meets the contract in light AND dark, as it is today', () => {
  for (const id of SKIN_IDS) {
    expect(validateSkinTable(skinTable(id)), id).toEqual([]);
    expect(skinProblems(SKINS[id]), id).toEqual([]);
    if (SKINS[id].darkRail) expect(validateSkinTable(skinTable(id, true)), `${id} dark rail`).toEqual([]); // SKINCOMP-297
  }
  // SKINCOMP-297: a dark rail may rewrite only --sw-rail-* names, with both columns
  const bad = { ...SKINS.infra, darkRail: { '--sw-accent': { light: '#000000', dark: '#000000' }, '--sw-rail-bg': { light: '#141b2b', dark: ' ' } } };
  expect(skinProblems(bad).filter((p) => p.startsWith('darkRail'))).toHaveLength(2);
});

test('features: declared per skin and equal to what the skin really draws; bevels only in classic and domus', () => {
  for (const id of SKIN_IDS) {
    const s = SKINS[id];
    const d = derivedFeatures(skinTable(id));
    expect(s.features.pixelEdge, `${id} pixelEdge`).toBe(d.pixelEdge);
    expect(s.features.glass, `${id} glass`).toBe(d.glass);
    // the material layer (which carries the bevel rim) is appended exactly where the registry says so
    expect(s.features.material, `${id} material`).toBe(materialRules(id) !== '');
    expect(skinRules(id)).toBe(s.rules + (s.features.material ? materialRules(id) : ''));
    if (!s.features.bevel) expect(skinRules(id), `${id} draws a bevel rim without the feature`).not.toContain('--sw-m-rim');
  }
  expect([...BEVEL_SKINS]).toEqual(['classic', 'domus']);
  const selectableWithBevel = SELECTABLE_SKIN_IDS.filter((id) => SKINS[id].features.bevel);
  expect(selectableWithBevel).toEqual(['classic', 'domus']);
  // recorded contradiction: the frozen bubble skin keeps its material rim unchanged (no visual change to any existing skin); it is never drawn
  expect(SKIN_IDS.filter((id) => SKINS[id].features.bevel && !BEVEL_SKINS.includes(id))).toEqual(['bubble']);
  expect(SKINS.bubble.stage).toBe('frozen');
});

test('stage: FROZEN_SKINS and FOUNDATION_SKINS are read from the registry data and are what they were', () => {
  expect([...FROZEN_SKINS]).toEqual(['bubble']);
  expect([...FOUNDATION_SKINS]).toEqual(['infra', 'soft']);
  expect([...SELECTABLE_SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft']);
  expect(DEFAULT_SKIN).toBe('classic');
  for (const id of SKIN_IDS) expect(['stable', 'foundation', 'frozen']).toContain(SKINS[id].stage);
});

test('reduced motion: generated from the motion roles; every duration / travel of the motion group is covered', () => {
  const motion = TOKEN_GROUPS.find((g) => g.id === 'motion')!.tokens;
  for (const [n, v] of Object.entries(motion)) {
    if (/^\d+(\.\d+)?ms$/.test(v.light)) expect(MOTION_DURATIONS as readonly string[], `${n} escapes reduced motion`).toContain(n);
    if (/^-?\d+(\.\d+)?px$/.test(v.light)) expect(MOTION_TRAVEL as readonly string[], `${n} escapes reduced motion`).toContain(n);
  }
  expect(MOTION_SCALE as readonly string[]).toContain('--sw-press-scale');
  // the same declarations, in the same order, as the block that was written by hand before DESIGNTOKENS-297
  expect(REDUCED_MOTION_CORE).toBe('--sw-t-fast:0ms !important;--sw-t-med:0ms !important;--sw-t-sheet:0ms !important;--sw-t-state:0ms !important;--sw-hover-lift:0px !important;');
  expect(REDUCED_MOTION_ARX).toBe(
    [
      '--sw-t-press:0ms',
      '--sw-t-hover:0ms',
      '--sw-t-slow:0ms',
      '--sw-t-exit:0ms',
      '--sw-t-toast:0ms',
      '--sw-spring-toggle-ms:0ms',
      '--sw-spring-tab-ms:0ms',
      '--sw-spring-dialog-ms:0ms',
      '--sw-spring-drawer-ms:0ms',
      '--sw-spring-kpi-ms:0ms',
      '--sw-stagger:0ms',
      '--sw-enter-y:0px',
      '--sw-enter-ms:0ms',
      '--sw-press-scale:1',
    ]
      .map((d) => `${d} !important;`)
      .join(''),
  );
  // MOTIONSETTING-297 (merged into 2.25.0): the generated declarations feed both selectors - the OS reduction unless
  // data-motion="full", and data-motion="reduced" always
  const decls = `${REDUCED_MOTION_CORE}${REDUCED_MOTION_ARX}`;
  expect(tokensCss()).toContain(`@media (prefers-reduced-motion: reduce){:root:not([data-motion="full"]),:root[data-skin]:not([data-motion="full"]){${decls}}}`);
  expect(tokensCss()).toContain(`:root[data-motion="reduced"],:root[data-skin][data-motion="reduced"]{${decls}}`);
});

// a minimal valid data skin: two overrides in both schemes (it borrows the tesla id only to satisfy the SkinId type; never registered)
const sample = () => ({
  id: 'tesla' as const,
  name: 'Sample',
  nameHe: 'דוגמה',
  noteHe: 'סקין בדיקה',
  light: { '--sw-r-md': '10px', '--sw-text-3': '#56657f' },
  dark: { '--sw-r-md': '10px', '--sw-text-3': '#93a0b8' },
});

test('defineSkin: a skin written as data becomes a registry entry (both columns, derived features, foundation stage)', () => {
  const s = defineSkin(sample());
  expect(s.tokens['--sw-r-md']).toEqual({ light: '10px', dark: '10px' });
  expect(s.tokens['--sw-text-3']).toEqual({ light: '#56657f', dark: '#93a0b8' });
  expect(s.stage).toBe('foundation');
  expect(s.features).toEqual({ material: false, bevel: false, pixelEdge: false, glass: false });
  expect(s.rules).toBe('');
  const glassy = defineSkin({ ...sample(), light: { ...sample().light, '--sw-glass-blur': 'blur(12px)', '--sw-highlight': 'rgba(255, 255, 255, 0.8)' }, dark: { ...sample().dark, '--sw-glass-blur': 'blur(12px)', '--sw-highlight': 'rgba(255, 255, 255, 0.1)' } });
  expect(glassy.features.glass).toBe(true);
  expect(glassy.features.pixelEdge).toBe(true);
});

test('defineSkin refuses data that breaks the contract, naming the problem', () => {
  const bad = (patch: Record<string, unknown>, msg: RegExp) => expect(() => defineSkin({ ...sample(), ...patch } as Parameters<typeof defineSkin>[0])).toThrow(msg);
  bad({ light: { ...sample().light, '--sw-nope': '#000' }, dark: { ...sample().dark, '--sw-nope': '#000' } }, /unknown token --sw-nope/);
  bad({ light: { ...sample().light, '--sw-r-lg': '20px' } }, /--sw-r-lg has a light value and no dark value/);
  bad({ features: { bevel: true } }, /bevel is allowed only in classic, domus/);
  bad({ id: 'domus', features: { material: true, bevel: false } }, /material needs bevel/);
  bad({ light: { ...sample().light, '--sw-accent': '#ef4444' }, dark: { ...sample().dark, '--sw-accent': '#3a6ce0' } }, /accent-is-status \(light\): --sw-accent = --sw-danger/);
  bad({ light: { ...sample().light, '--sw-r-md': '40px' }, dark: { ...sample().dark, '--sw-r-md': '40px' } }, /scale-order .*--sw-r-lg/);
  bad({ light: { ...sample().light, '--sw-menu-surface': 'rgba(255, 255, 255, 0.7)' }, dark: { ...sample().dark, '--sw-menu-surface': '#151c2c' } }, /menu-translucent/);
  bad({ light: { ...sample().light, '--sw-t-exit': '400ms' }, dark: { ...sample().dark, '--sw-t-exit': '400ms' } }, /exit-slower-than-enter/);
  bad({ nameHe: 'שם ארוך מאוד של סקין שלא נכנס בכרטיס' }, /nameHe is longer than 24/);
  bad({ name: '  ' }, /name is empty/);
  bad({ features: { glass: true } }, /glass is declared true/);
  bad({ rules: ':host(sw-card) { }'.repeat(51) }, /rules: 51 blocks > 50/);
});

test('the backend accepts exactly the registry ids and freezes exactly the frozen ones (routers/settings.py)', () => {
  const py = readFileSync(resolve(here, '../../smplwise_vms/backend/smplwise/routers/settings.py'), 'utf8');
  const pattern = /pattern="\^\(([a-z|]+)\)\$", alias="ui\.skin"/.exec(py);
  expect(pattern, 'ui.skin pattern').toBeTruthy();
  expect(pattern![1].split('|')).toEqual([...SKIN_IDS]);
  const stored = /return raw if raw in \(([^)]*)\) else DEFAULTS\["ui\.skin"\]/.exec(py);
  expect(stored, 'stored_skin tuple').toBeTruthy();
  expect(stored![1].split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean)).toEqual([...SKIN_IDS]);
  const frozen = /^FROZEN_SKINS = \(([^)]*)\)/m.exec(py);
  expect(frozen![1].split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean)).toEqual([...FROZEN_SKINS]);
  expect(/^FROZEN_FALLBACK_SKIN = "([a-z]+)"/m.exec(py)![1]).toBe(FROZEN_FALLBACK_SKIN);
});

test('break-ui: the skin picker wraps a long name / note inside its card and keeps the "current" mark whole', () => {
  const src = readFileSync(resolve(here, '../src/screens/system-design.ts'), 'utf8');
  const block = (sel: string) => new RegExp(`\\n\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(src)?.[1] ?? '';
  expect(block('.skin .nm')).toContain('min-inline-size: 0;');
  expect(block('.skin .nm')).toContain('overflow-wrap: anywhere;');
  expect(block('.skin .note')).toContain('overflow-wrap: anywhere;');
  expect(block('.skin .cur')).toContain('flex: none;');
  expect(block('.skin .cur')).toContain('white-space: nowrap;');
  // the registry labels stay inside the limits defineSkin enforces for new skins
  for (const id of SKIN_IDS) {
    expect([...SKINS[id].nameHe].length, id).toBeLessThanOrEqual(24);
    expect([...SKINS[id].noteHe].length, id).toBeLessThanOrEqual(90);
  }
});
