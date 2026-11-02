import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// POLISH4-WP4 (round 4, home + devices): source guards for D2 (the home edit bar never covers the card), D24 (the announcements tab),
// D25 (the automations header and cards at 1024), D26 (resolved by owner answer 8B - verified, not changed) and the notices hover cancel
// that WP1 made redundant.
//   npx playwright test -c playwright.unit.config.ts tests/unit-polish4-wp4-home.spec.ts --workers=1

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (p: string) => readFileSync(path.join(SRC, p), 'utf8');

test('D2: the edit bar reserves its measured height in the last sheet, so no direction or fit step wins over it', () => {
  const s = read('screens/home-widgets.ts');
  // the reservation is its own sheet, the last one of the element
  expect(s).toMatch(/XS_MINI_WIDGET_STYLES, HOME_EDIT_BAR_STYLES\];/);
  expect(s).toContain(":host([editing]) .wg.wg:not(.ghost) {\n    padding-block-end: calc(var(--wg-e-h, 34px) + 16px);");
  // the old fixed 52 px reservations are gone
  expect(s).not.toContain('padding-block-end: 52px');
  // the bar reports its height to its card
  expect(s).toContain("card.style.setProperty('--wg-e-h', `${h}px`)");
  expect(s).toMatch(/protected updated\(\) \{\n\s+this\.syncTicker\(\);\n\s+this\.watchEditBars\(\);/);
  expect(s).toContain('this.barRo?.disconnect();');
});

test('D2: the edit controls are tokens, 44 px on touch, hover gated, pressed on pointer-down', () => {
  const s = read('screens/home-widgets.ts');
  expect(s).not.toMatch(/border-radius:\s*999px/);
  const bar = s.slice(s.indexOf('    .wg-e {'), s.indexOf('    .seg button[aria-pressed'));
  expect(bar).toContain('border-radius: var(--sw-r-lg);');
  expect(bar).toMatch(/@media \(pointer: coarse\) \{\n\s+\.grip,\n\s+\.eb \{\n\s+inline-size: 44px;\n\s+block-size: 44px;/);
  expect(bar).toMatch(/\.seg button \{\n\s+min-block-size: 44px;\n\s+min-inline-size: 44px;/);
  expect(bar).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\n\s+\.grip:hover,/);
  expect(bar).toContain('background: var(--sw-pressed-wash);');
  // no hover rule of the file outside a hover gate
  const ungated = s.split('\n').filter((l, i, all) => /:hover\b/.test(l) && !all.slice(Math.max(0, i - 3), i).some((p) => p.includes('(hover: hover)')));
  expect(ungated, ungated.join('\n')).toEqual([]);
});

test('D24: the announcements tab reads its radii and motion from the tokens, 44 px pickers on touch, gated hover, visible focus', () => {
  const s = read('screens/devices-announce.ts');
  expect(s).not.toMatch(/border-radius:\s*999px/);
  expect(s).not.toContain('var(--sw-r-lg, 12px)');
  expect(s).not.toContain('cubic-bezier(');
  expect(s).toContain('transition: transform var(--sw-t-press) var(--sw-ease)');
  const coarse = s.slice(s.indexOf('@media (pointer: coarse) {'), s.indexOf('@media (prefers-reduced-motion: reduce)'));
  expect(coarse).toContain('.chip, select { min-block-size: 44px; }');
  expect(s).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\n\s+\.chip:not\(\[aria-pressed='true'\]\):hover/);
  expect(s).toContain('.chip:focus-visible, select:focus-visible, textarea:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus);');
});

test('D25: from 768 to 1399 px the state filter folds behind "סינון" by the phone_filter setting; the cards take rows of three below 1200', () => {
  const s = read('screens/devices-automations.ts');
  const fold = s.slice(s.indexOf('@media (min-width: 768px) and (max-width: 1399px) {'));
  expect(fold).toMatch(/^@media \(min-width: 768px\) and \(max-width: 1399px\) \{\n\s+:host\(\[data-phone-filter='fold'\]\) \.dh-det \.stf \{\n\s+display: none;/);
  expect(fold).toContain(":host([data-phone-filter='fold']) .dh-det .foldbtn {\n        display: inline-flex;");
  expect(s).toContain("@media (min-width: 768px) and (max-width: 1199px) {\n      .cgrid {\n        grid-template-columns: repeat(auto-fill, minmax(min(100%, 264px), 1fr));");
  // the setting still decides: "rows" keeps the filter's own row (the attribute the fold keys on is set from it)
  expect(s).toContain("this.setAttribute('data-phone-filter', this.status.ui.phone_filter === 'rows' ? 'rows' : 'fold');");
});

test('D26: the layout editor is a bottom sheet below 1200 px (owner 8B) - the 260 px side panel of Q6 is not applied over it', () => {
  const c = read('screens/devices-layout-css.ts');
  expect(c).toContain('@media (max-width: 1199px) {\n      .lay-panel {\n        inset-block-start: auto;');
  expect(c).toContain('--lay-panel: 300px;');
  expect(c).not.toContain('--lay-panel: 260px');
  expect(c).not.toMatch(/border-radius:\s*999px/);
  expect(c).not.toContain('#fff');
  expect(c).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\n\s+\.lay-libItem:hover \{/);
  expect(c).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\n\s+\.lay-tbtn:hover \{/);
});

test('the notices page no longer cancels the row hover locally (the shared sheet gates it, POLISH4-WP1)', () => {
  const c = read('screens/devices-notices-css.ts');
  expect(c).not.toContain('@media not ((hover: hover) and (pointer: fine))');
  expect(c).not.toMatch(/tr\.go:hover td \{\s*background: transparent;/);
});
