import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHOICES, CHOICE_DEFAULTS, demoScreenOverrides, HOME_SCREEN_DEFAULT, homeScreenOf, homeScreenPatch, treeUnassignedHint, treeUnassignedShown,
} from '../src/api/home-screen';
import { HS_TABLES, hs } from '../src/i18n/home-screen';

// TREE-HIDE-UNASSIGNED-2331 (owner 01.11): "הצג 'ללא שיוך' בעץ" - always (default) / only while editing / never.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tree-unassigned-2331.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test('the choice, its values and the default that keeps today\'s behaviour', () => {
  expect(CHOICES.tree_unassigned).toEqual(['always', 'editing', 'never']);
  expect(CHOICE_DEFAULTS.tree_unassigned).toBe('always');
  expect(HOME_SCREEN_DEFAULT.tree_unassigned).toBe('always');
});

test('when the tree draws the row', () => {
  expect(treeUnassignedShown('always', false)).toBe(true);
  expect(treeUnassignedShown('always', true)).toBe(true);
  expect(treeUnassignedShown('editing', false)).toBe(false);
  expect(treeUnassignedShown('editing', true)).toBe(true);
  expect(treeUnassignedShown('never', false)).toBe(false);
  expect(treeUnassignedShown('never', true)).toBe(false);
});

test('the editor hint says something only when the row is hidden somewhere', () => {
  expect(treeUnassignedHint('always')).toBeNull();
  expect(treeUnassignedHint('editing')).toBe('editing');
  expect(treeUnassignedHint('never')).toBe('never');
});

test('read tolerantly; the save sends only the changed key', () => {
  expect(homeScreenOf({ tree_unassigned: 'never' }).tree_unassigned).toBe('never');
  expect(homeScreenOf({ tree_unassigned: 'hidden' }).tree_unassigned).toBe('always');
  expect(homeScreenOf({}).tree_unassigned).toBe('always');
  expect(homeScreenOf(JSON.stringify({ tree_unassigned: 'editing' })).tree_unassigned).toBe('editing');
  const to = { ...HOME_SCREEN_DEFAULT, tree_unassigned: 'editing' as const };
  expect(homeScreenPatch(HOME_SCREEN_DEFAULT, to)).toEqual({ tree_unassigned: 'editing' });
  expect(homeScreenPatch(to, HOME_SCREEN_DEFAULT)).toEqual({ tree_unassigned: 'always' }); // the undo
});

test('the demo / evidence address can choose it', () => {
  expect(demoScreenOverrides('?hs_tree_unassigned=never')).toEqual({ tree_unassigned: 'never' });
  expect(homeScreenOf(demoScreenOverrides('?hs_tree_unassigned=editing')).tree_unassigned).toBe('editing');
});

test('the words: the setting, its values and the row actions in Hebrew and English', () => {
  expect(hs('treeUnassigned', {}, 'he')).toBe('הצג "ללא שיוך" בעץ');
  expect(hs('tu_always', {}, 'he')).toBe('תמיד');
  expect(hs('tu_editing', {}, 'he')).toBe('רק כשאני עורך');
  expect(hs('tu_never', {}, 'he')).toBe('אף פעם');
  expect(hs('tuHide', {}, 'he')).toBe('הסתר מהעץ');
  for (const k of ['treeUnassigned', 'tu_always', 'tu_editing', 'tu_never', 'tuNote', 'tuOpen', 'tuMenu', 'tuHide', 'tuHidden', 'tuUndo', 'tuFailed', 'tuHintEditing', 'tuHintNever', 'tuShowAlways', 'tuHintWhere'] as const) {
    expect(HS_TABLES.he[k], k).toBeTruthy();
    expect(HS_TABLES.en[k], k).toBeTruthy();
  }
  // the bucket keeps the tree's own name ("ללא שיוך"), not the mapping assistant's "לא משויך" (that one is an area without a building)
  expect(hs('tuHide', {}, 'he')).not.toContain('לא משויך');
});

test('the settings form and the building screen wire the choice (source guard)', () => {
  const form = readFileSync(path.join(SRC, 'screens/home-screen-options.ts'), 'utf8');
  expect(form).toContain("tree_unassigned: 'treeUnassigned'");
  expect(form).toContain("tree_unassigned: 'tu_'");
  expect(form).toContain('this.treeUnassigned()');
  const b = readFileSync(path.join(SRC, 'screens/devices-building.ts'), 'utf8');
  expect(b).toContain('treeUnassignedShown(looseMode, this.lay.editing)');
  // only a system.configure holder (infoCanEdit = GET /settings can_edit) gets the row's "הסתר מהעץ"
  expect(b).toMatch(/menu: this\.infoCanEdit && !this\.lay\.editing/);
  // the "כל המבנה" row still reads the building counts (which include the unassigned devices): hiding changes no number
  expect(b).toContain('<span class="nm" title="כל המבנה">כל המבנה</span>${lit(t.building)}');
});
