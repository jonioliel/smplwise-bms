import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tilesUnassignedShown, treeUnassignedShown, type TreeUnassigned } from '../src/api/home-screen';
import { HS_TABLES, hs } from '../src/i18n/home-screen';

// OWNER-R12-2341 (owner answers 01.11, round 12): 5A the NVR-write wording, 6A the tiles view follows "הצג 'ללא שיוך' בעץ",
// 8B the layout editor's bottom sheet on tablets (768-1199).
//   npx playwright test -c playwright.unit.config.ts tests/unit-owner-r12-2341.spec.ts --workers=1

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (p: string) => readFileSync(path.join(SRC, p), 'utf8');

test('6A: the tiles view section follows the same choice with the same semantics as the tree row', () => {
  const modes: TreeUnassigned[] = ['always', 'editing', 'never'];
  for (const m of modes) for (const editing of [false, true]) expect(tilesUnassignedShown(m, editing), `${m}/${editing}`).toBe(treeUnassignedShown(m, editing));
  expect(tilesUnassignedShown('always', false)).toBe(true); // the default keeps today's tiles view
  expect(tilesUnassignedShown('editing', false)).toBe(false);
  expect(tilesUnassignedShown('editing', true)).toBe(true);
  expect(tilesUnassignedShown('never', true)).toBe(false);
});

test('6A: the help text says the setting covers the tree and the tiles view (he / en); the label is unchanged', () => {
  expect(hs('treeUnassigned', {}, 'he')).toBe('הצג "ללא שיוך" בעץ');
  expect(HS_TABLES.he.tuNote).toContain('חל על העץ ועל תצוגת האריחים');
  expect(HS_TABLES.he.tuNote).toContain('"כל המבנה"'); // hiding still changes no number
  expect(HS_TABLES.en.tuNote).toContain('the tree and the tiles view');
});

test('6A: the building screen gates the tiles section and its layout grid by the choice (source guard)', () => {
  const b = read('screens/devices-building.ts');
  // the tiles view's "ללא שיוך" section
  expect(b).toMatch(/const loose = !phoneOne && [^\n]*&& tilesUnassignedShown\(this\.screen\.tree_unassigned, this\.lay\.editing\);/);
  // a hidden section is not offered to the layout editor as a grid
  expect(b).toContain('const tilesLoose = loose && tilesUnassignedShown(this.screen.tree_unassigned, this.lay.editing);');
  // the tree row's gating (TREE-HIDE-UNASSIGNED-2331) and its configure-only quick hide are unchanged
  expect(b).toContain('treeUnassignedShown(looseMode, this.lay.editing)');
  expect(b).toMatch(/menu: this\.infoCanEdit && !this\.lay\.editing/);
});

test('8B: the layout editor panel is a bottom sheet below 1200 px and a side panel from 1200 px', () => {
  const c = read('screens/devices-layout-css.ts');
  const sheet = c.indexOf('@media (max-width: 1199px) {\n      .lay-panel {\n        inset-block-start: auto;');
  expect(sheet, 'the sheet rule covers phone and tablet').toBeGreaterThan(0);
  // HOME-EDIT-DRAWER-2351 (owner 02.11, round 14): the home screen's CLOSED edit drawer frees the column through data-he-free
  expect(c).toContain('@media (min-width: 1200px) {\n      :host([data-lay-editing]:not([data-he-free])) sw-page {\n        padding-inline-end: calc(var(--lay-panel) + 32px);');
  expect(c).toContain('@media (max-width: 1199px) {\n      :host([data-lay-editing]) sw-page {\n        padding-block-end: 52vh;');
  // the old phone-only sheet / tablet side-panel split is gone
  expect(c).not.toContain('@media (min-width: 768px) {\n      :host([data-lay-editing]) sw-page');
  expect(c).not.toMatch(/@media \(max-width: 767px\) \{\s*\.lay-panel \{/);
  // the desktop side panel itself is unchanged
  expect(c).toContain('inline-size: var(--lay-panel, 300px);');
  expect(c).toContain('--lay-panel: 300px;');
});

test('5A: the connections page no longer says Arx never writes to the NVR', () => {
  const s = read('screens/system-setup.ts');
  expect(s).toContain('Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה.');
  expect(s).not.toContain('Arx לא כותב ל־NVR');
  expect(s).not.toContain('תשתית המערכת ואחסון · קריאה בלבד');
});
