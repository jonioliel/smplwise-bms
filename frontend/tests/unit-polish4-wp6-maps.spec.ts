import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// POLISH4 WP6 MAPS-PLAN (release 2.37.0, docs/changes/pilot-POLISH4-WP6-MAPS-2370.md): the source guards of the maps / plan polish -
// node only, no page. D12: the floor map, sites, floors, presence, import and the plan editor / studio are touch-tablet control screens,
// so every :hover sits under `@media (hover: hover) and (pointer: fine)`; D13: tokens only (no hex / rgba literal, no px radius, no px
// font size) in the styles of the package; D28: the plan-studio favourite star and the editor's active icon key draw in the warning ink.
//   npx playwright test -c playwright.unit.config.ts tests/unit-polish4-wp6-maps.spec.ts
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => fs.readFileSync(path.join(here, '..', 'src', p), 'utf8');

const FILES = [
  'screens/explore-floor-map.ts',
  'screens/explore-sites.ts',
  'screens/explore-floors.ts',
  'screens/explore-presence.ts',
  'screens/explore-plan-import.ts',
  'screens/explore-plan-editor.ts',
  'screens/explore-entities.ts',
  'screens/plan-studio-panel.ts',
  'screens/plan-studio6-panel.ts',
  'screens/plan-view-dials.ts',
];

/** The source with its comments blanked (block and line comments), so a note that quotes an old literal is not counted. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** Every `:hover` line outside an `@media (hover: hover) and (pointer: fine)` block (the same reader as unit-polish-classic-domus-297). */
function ungatedHovers(css: string): number[] {
  const lines = css.split('\n');
  const out: number[] = [];
  let gate = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const delta = (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
    if (gate > 0) {
      gate += delta;
      continue;
    }
    if (/@media \(hover: hover\) and \(pointer: fine\)/.test(l)) {
      gate = delta;
      continue;
    }
    if (/:hover/.test(l)) out.push(i + 1);
  }
  return out;
}

test('D12: every hover of the maps / plan screens is gated to a fine pointer, and no (hover: none) undo is left', () => {
  for (const f of FILES) {
    const c = code(src(f));
    expect(ungatedHovers(c), `${f}: ungated :hover lines`).toEqual([]);
    expect(c, `${f}: a (hover: none) undo block`).not.toMatch(/@media \(hover: none\)/);
  }
});

test('D13: tokens only - no hex or rgba literal, no px radius and no px font size in the package', () => {
  for (const f of FILES) {
    const c = code(src(f));
    expect(c.match(/#[0-9a-fA-F]{3,8}\b(?![-\w])/g) ?? [], `${f}: hex literals`).toEqual([]);
    expect(c.match(/rgba?\(/g) ?? [], `${f}: rgb / rgba literals`).toEqual([]);
    expect(c.match(/border-radius:\s*[0-9.]+px/g) ?? [], `${f}: px radii`).toEqual([]);
    expect(c.match(/font-size:\s*[0-9.]+px/g) ?? [], `${f}: px font sizes`).toEqual([]);
  }
});

test('D13: the floor-links stack labels its floors on the type scale (no 6px literal), the studio and the editor have phone / touch rules', () => {
  expect(src('screens/explore-floors.ts')).toMatch(/svg\.stack \.pname \{\s*font-size: calc\(var\(--sw-fs-2xs\) \* 2 \/ 3\);\s*fill: var\(--sw-text-2\);/);
  const studio = src('screens/plan-studio-panel.ts');
  expect(studio).toMatch(/@media \(pointer: coarse\) \{[\s\S]*?\.modes button,[\s\S]*?min-block-size: var\(--sw-touch-desktop\)/);
  expect(studio).toMatch(/@media \(max-width: 479px\) \{\s*\.three \{/);
  const editor = src('screens/explore-plan-editor.ts');
  expect(editor).toMatch(/@media \(max-width: 767px\) \{\s*\.layout \{[\s\S]*?\.mapwrap \{\s*min-block-size: min\(520px, 70dvh\);/);
  expect(editor).toMatch(/@media \(pointer: coarse\) \{\s*\.bar button\.icon \{/);
});

test('D13: the detected-room preview colours are skin hues, never green (green is a status colour only)', () => {
  const editor = src('screens/explore-plan-editor.ts');
  const m = editor.match(/const PALETTE = \[([^\]]*)\]/);
  expect(m).not.toBeNull();
  const hues = m![1].split(',').map((x) => x.trim().replace(/'/g, ''));
  expect(hues.length).toBeGreaterThanOrEqual(6);
  for (const h of hues) expect(h).toMatch(/^var\(--sw-hue-[124567]\)$/); // hue-3 and hue-8 are the green ones
  expect(editor).toContain("PALETTE[i % PALETTE.length] : 'var(--sw-offline)'");
});

test('D12 / map status: the side list and pick chips paint camera status with the status tokens', () => {
  const map = src('screens/explore-floor-map.ts');
  expect(map).toContain("a.camera.status === 'online' ? 'var(--sw-success)' : a.camera.status === 'offline' ? 'var(--sw-danger)'");
  expect(map).toContain("return a.camera.status === 'online' ? 'var(--sw-success)' : 'var(--sw-danger)';");
});

test('D28: the favourite star and the active editor icon key read in the warning ink, not the bare warning hue', () => {
  expect(src('screens/plan-studio-panel.ts')).toMatch(/\.libitem \.fav\.on \{\s*color: var\(--sw-warning-text\);/);
  expect(src('screens/explore-plan-editor.ts')).toMatch(/\.bar button\.icon\.on \{\s*background: var\(--sw-warning-soft\);\s*color: var\(--sw-warning-text\);/);
  // the walk start star (plan-studio6) keeps the A11Y-POLISHED-2342 fix: the warning ink in light
  expect(src('screens/plan-studio6-panel.ts')).toContain('color: light-dark(var(--sw-warning-text), var(--sw-warning));');
});
