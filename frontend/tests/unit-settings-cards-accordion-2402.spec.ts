import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCESS_LAYOUT_DEFAULT, ACCESS_LAYOUTS, areaSummary, isCardsLayout, parseAccessLayout, pickOpenCard, toggleCard } from '../src/access-control/settings-cards-logic';
import { enSettingsCardsText, heSettingsCardsText } from '../src/i18n/settings-cards';

// SETTINGS-CARDS-ACCORDION-2402 (owner 04.11 night, round 20 Q2 = a): `access.settings_layout` = accordion - the cards of Settings ›
// "מתגי מסכי כניסה" opened in place, one at a time, on a desktop too. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-settings-cards-accordion-2402.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(HERE, '..', 'src', rel), 'utf8');

test('accordion is a fourth value of the same setting; cards stays the default; the other three are unchanged', () => {
  expect([...ACCESS_LAYOUTS]).toEqual(['cards', 'accordion', 'tabs', 'list']);
  expect(ACCESS_LAYOUT_DEFAULT).toBe('cards');
  expect(parseAccessLayout('accordion')).toBe('accordion');
  for (const l of ['cards', 'tabs', 'list'] as const) expect(parseAccessLayout(l)).toBe(l);
  for (const bad of ['Accordion', 'inplace', 'accordion ', '']) expect(parseAccessLayout(bad)).toBe('cards');
  expect(isCardsLayout('cards')).toBe(true);
  expect(isCardsLayout('accordion')).toBe(true);
  expect(isCardsLayout('tabs')).toBe(false);
  expect(isCardsLayout('list')).toBe(false);
});

test('short Hebrew labels that say which cards; the default is marked in the select', () => {
  expect(heSettingsCardsText.layout.cards).toBe('כרטיסים: כותרות בצד');
  expect(heSettingsCardsText.layout.accordion).toBe('כרטיסים: נפתחים במקום');
  expect(heSettingsCardsText.layout.defaultMark).toBe('(ברירת מחדל)');
  expect(enSettingsCardsText.layout.accordion.length).toBeGreaterThan(0);
  expect(areaSummary(false, false, 'accordion')).toBe('האזור מוצג · הטמעה בטלפון: כבויה · כרטיסים: נפתחים במקום');
  const diag = read('screens/system-diagnostics.ts');
  expect(diag).toContain('l === ACCESS_LAYOUT_DEFAULT ? `${t[l]} ${t.defaultMark}` : t[l]');
});

test('in place, the open card folds on a second press at any width, and all may be closed', () => {
  // the screen passes wide = false for accordion (system-diagnostics renderAccessCards), so the narrow rules apply on a desktop too
  expect(toggleCard('display', 'display', false)).toBe('');
  expect(toggleCard('display', 'announce', false)).toBe('announce');
  expect(pickOpenCard('', ['screens', 'area'], false)).toBe('');
  expect(pickOpenCard(null, ['screens', 'area'], false)).toBe('screens');
  const diag = read('screens/system-diagnostics.ts');
  expect(diag).toContain('const wide = !inplace && this.accessWide;');
  expect(diag).toContain("isCardsLayout(layout) ? this.renderAccessCards(layout === 'accordion')");
  expect(diag).toContain('?inplace=${inplace}');
});

test('the list component: in place it never takes the wide arrangement (and so never gives the open card a height of its own)', () => {
  const fold = read('components/sw-fold-cards.ts');
  expect(fold).toContain('@property({ type: Boolean, reflect: true }) inplace = false;');
  expect(fold).toContain('const wide = !this.inplace && width >= FOLD_WIDE_MIN;');
  expect(fold).toContain("if (changed.has('inplace') && this.inplace) this.wide = false;");
});

test('the server takes the same four values', () => {
  const py = fs.readFileSync(path.join(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'routers', 'settings.py'), 'utf8');
  expect(py).toContain('pattern="^(cards|accordion|tabs|list)$", alias="access.settings_layout"');
  expect(py).toContain('"access.settings_layout": "cards",');
});
