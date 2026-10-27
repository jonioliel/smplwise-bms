import { test, expect } from '@playwright/test';
import { TOKENS } from '../src/design/tokens';
import { SKINS, SKIN_IDS, SKIN_OPTIONS_MAX_ENTRIES, normalizeSkinOptions, optionProblems, skinOptionChoices } from '../src/design/skins';
import { ruleCount, skinTable, tokensCss } from '../src/design/css';
import { SKIN_RULE_BUDGET } from '../src/design/skins/define';
import { parseColor } from '../src/design/contrast';

// POLISH-SKINS-297 (owner round 4, 2026-10-27): the polish of tesla, crystal, Arx Infra and Arx Soft, and the skin OPTIONS of the registry
// (Arx Soft: the lamp glow in two intensities, the switch colour - never green - chosen in Settings). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-skin-options-297.spec.ts

const POLISHED = ['tesla', 'crystal', 'infra', 'soft'] as const;

test('the four polished skins draw no pixel bevel and no 1 px lit edge (owner: those belong to classic and domus), and stay in the rule budget', () => {
  for (const id of POLISHED) {
    const s = SKINS[id];
    expect(s.features.bevel, id).toBe(false);
    expect(s.features.material, id).toBe(false);
    expect(s.features.pixelEdge, id).toBe(false);
    for (const m of ['light', 'dark'] as const) expect(skinTable(id)['--sw-highlight'][m], `${id}/${m}`).toMatch(/transparent/);
    expect(s.rules, id).not.toMatch(/inset 0 1px 0 var\(--sw-highlight\)/);
    expect(ruleCount(s.rules), `${id} rules`).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
    expect(s.rules, id).not.toMatch(/transition:\s*all/);
  }
});

test('hover never sticks on a phone: every :hover rule of the four skins sits inside (hover: hover) and (pointer: fine)', () => {
  for (const id of POLISHED) {
    const css = SKINS[id].rules;
    // drop the gated blocks, then no :hover may be left
    const ungated = css.replace(/@media \(hover: hover\) and \(pointer: fine\) \{(?:[^{}]*\{[^{}]*\})+\s*\}/g, '');
    expect(ungated, id).not.toMatch(/:hover/);
  }
});

test('a device that is on never borrows the warning colour under the four skins; a lamp takes the lit tint', () => {
  for (const id of POLISHED) {
    const css = SKINS[id].rules;
    expect(css, id).toMatch(/:host\(devices-area\) sw-card\[data-card='lighting'\] :is\(\.tile, \.row\)\.on \{[^}]*--sw-lit/);
    expect(css, id).toMatch(/:host\(devices-area\) sw-card:not\(\[data-card='lighting'\]\) :is\(\.tile, \.row\)\.on \{/);
  }
});

test('Arx Soft offers two options: the lamp glow (two intensities) and the switch colour (blue by default, never green)', () => {
  const o = SKINS.soft.options ?? [];
  expect(o.map((x) => x.id)).toEqual(['glow', 'switch']);
  const glow = o[0];
  expect(glow.choices.map((c) => c.id)).toEqual(['soft', 'strong']);
  expect(glow.default).toBe('soft');
  expect(glow.choices[0].tokens['--sw-lit-glow'].light).not.toBe(glow.choices[1].tokens['--sw-lit-glow'].light);
  // the glow falls downward from the lamp (an offset shadow), it is not a flat halo
  for (const c of glow.choices) for (const m of ['light', 'dark'] as const) expect(c.tokens['--sw-lit-glow'][m]).toMatch(/, 0 \d+px \d+px -?\d+px color-mix/);
  const sw = o[1];
  expect(sw.default).toBe('blue');
  expect(sw.choices.length).toBeGreaterThanOrEqual(3);
  const isGreen = (hex: string) => {
    const c = parseColor(hex)!;
    const [r, g, b] = [c[0] / 255, c[1] / 255, c[2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 0.08) return false; // a grey
    let h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h > 75 && h < 190; // green and the teals that read as green
  };
  for (const c of sw.choices) for (const m of ['light', 'dark'] as const) expect(isGreen(c.tokens['--sw-toggle-on'][m]), `${c.id}/${m} ${c.tokens['--sw-toggle-on'][m]}`).toBe(false);
  // the defaults are what the skin draws with nothing chosen
  expect(SKINS.soft.tokens['--sw-toggle-on']).toEqual(sw.choices[0].tokens['--sw-toggle-on']);
  expect(SKINS.soft.tokens['--sw-lit-glow']).toEqual(glow.choices[0].tokens['--sw-lit-glow']);
  // the base keeps the glow neutral: no other skin glows
  expect(TOKENS['--sw-lit-glow'].light).toBe('none');
  for (const id of SKIN_IDS) if (id !== 'soft') expect(skinTable(id)['--sw-lit-glow'], id).toEqual(TOKENS['--sw-lit-glow']);
});

test('every option of every skin meets the contract (ids, labels, both columns, the same names in every choice, the semantic rules)', () => {
  for (const id of SKIN_IDS) expect(optionProblems(SKINS[id]), id).toEqual([]);
});

test('the CSS: one block set per non-default choice, keyed on data-sko-<option>, light and dark; the default choice needs none', () => {
  const css = tokensCss();
  expect(css).toContain(':root[data-skin="soft"][data-sko-glow="strong"]{');
  expect(css).toContain(':root[data-skin="soft"][data-sko-glow="strong"][data-theme="dark"]{');
  expect(css).toContain(':root[data-skin="soft"][data-sko-switch="magenta"]{--sw-toggle-on:#c2349b;}');
  expect(css).not.toContain('[data-sko-glow="soft"]');
  expect(css).not.toContain('[data-sko-switch="blue"]');
  // the merged table follows a choice
  expect(skinTable('soft', { switch: 'magenta' })['--sw-toggle-on'].dark).toBe('#e45bb8');
  expect(skinTable('soft', { switch: 'nosuch' })['--sw-toggle-on'].light).toBe('#2f6df6');
});

test('break-ui: ui.skin_options worst cases read as the defaults, never throw', () => {
  expect(normalizeSkinOptions(undefined)).toEqual({});
  expect(normalizeSkinOptions('{not json')).toEqual({});
  expect(normalizeSkinOptions('[]')).toEqual({});
  expect(normalizeSkinOptions(['soft.glow'])).toEqual({});
  expect(normalizeSkinOptions({ 'soft.glow': 'strong', 'soft.switch': 'magenta' })).toEqual({ 'soft.glow': 'strong', 'soft.switch': 'magenta' });
  expect(normalizeSkinOptions('{"soft.glow":"strong"}')).toEqual({ 'soft.glow': 'strong' });
  // unknown skin, option, choice, a value that is not an id, a nested key: dropped
  expect(normalizeSkinOptions({ 'nosuch.glow': 'strong', 'soft.nosuch': 'x', 'soft.glow': 'blinding', 'soft.switch': 'url(x)', 'soft.glow.x': 'strong', 'tesla.glow': 'strong' })).toEqual({});
  const many: Record<string, string> = {};
  for (let i = 0; i < 500; i++) many[`soft.o${i}`] = 'x';
  many['soft.glow'] = 'strong';
  expect(Object.keys(normalizeSkinOptions(many)).length).toBeLessThanOrEqual(SKIN_OPTIONS_MAX_ENTRIES);
  expect(skinOptionChoices('soft', {})).toEqual({ glow: 'soft', switch: 'blue' });
  expect(skinOptionChoices('soft', { 'soft.switch': 'graphite', 'soft.glow': 'nope' })).toEqual({ glow: 'soft', switch: 'graphite' });
  expect(skinOptionChoices('classic', { 'soft.switch': 'graphite' })).toEqual({});
  // every label fits the picker (break-ui: a label without a limit is a layout bug waiting for a long name)
  for (const id of SKIN_IDS) for (const o of SKINS[id].options ?? []) for (const c of o.choices) expect([...c.labelHe].length, `${id}.${o.id}.${c.id}`).toBeLessThanOrEqual(16);
});
