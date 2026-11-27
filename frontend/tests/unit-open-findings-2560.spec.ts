import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keepHiddenFavs, favOk, type FavWorld } from '../src/home/home-logic';
import type { Fav } from '../src/home/home-api';

// OPEN-FINDINGS-2560 (SCR-08, SCR-25, SCR-22). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-open-findings-2560.spec.ts
const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

test('SCR-08: saving the visible favourites keeps the stored ones that are hidden right now', () => {
  const w = { rooms: [], cameras: [{ id: 'cam.a' }], scenes: [], hasEnergy: false, hasSecurity: false } as unknown as FavWorld;
  const hidden: Fav = { t: 'cam', id: 'cam.gone' };
  const shown: Fav = { t: 'cam', id: 'cam.a' };
  expect(favOk(hidden, w)).toBe(false);
  expect(favOk(shown, w)).toBe(true);
  const saved = keepHiddenFavs([shown, hidden], [shown], w);
  expect(saved).toEqual([shown, hidden]);
  // reorder / removal of a visible one still works, and nothing is duplicated
  expect(keepHiddenFavs([shown, hidden], [], w)).toEqual([hidden]);
  expect(keepHiddenFavs([shown, hidden], [shown, hidden], w)).toEqual([shown, hidden]);
});

test('SCR-08: the home screen saves through keepHiddenFavs', () => {
  expect(src('home/sw-home.ts')).toMatch(/private saveFavs\([^)]*\) \{\s*const list = keepHiddenFavs\(/);
});

test('SCR-25: removing a case item asks first (danger, focus on cancel) and names the item', () => {
  const s = src('screens/investigate-cases.ts');
  expect(s).not.toMatch(/data-item-remove[^\n]*removeCaseItem/);
  const m = s.match(/private async removeItem\([\s\S]*?\n  \}\n/);
  expect(m).not.toBeNull();
  const body = m![0];
  expect(body).toContain('confirmDialog(');
  expect(body).toContain('danger: true');
  expect(body).toContain('focusCancel: true');
  expect(body).toContain('{what}');
  expect(body.indexOf('confirmDialog(')).toBeLessThan(body.indexOf('removeCaseItem('));
});

test('SCR-22: "ack all" asks first and says how many; Hebrew and English texts exist', () => {
  const s = src('generator/gen-alerts-page.ts');
  expect(s).not.toMatch(/@click=\$\{\(\) => this\.act\(\(\) => ackAll/);
  const m = s.match(/private async ackAllNow\([\s\S]*?\n  \}\n/);
  expect(m).not.toBeNull();
  expect(m![0]).toContain('focusCancel: true');
  expect(m![0]).toContain('fill(G.alerts.ackAllBody, { n })');
  expect(m![0].indexOf('confirmDialog(')).toBeLessThan(m![0].indexOf('ackAll(this.device.id)'));
  for (const f of ['i18n/he.ts', 'i18n/lang/en/i18n/en.ts']) expect(src(f)).toMatch(/ackAllTitle:[^,]*, ackAllBody:/);
  expect(src('i18n/lang/en/i18n/msg/investigate.ts')).toContain("'הסרת פריט מהתיק'");
});
