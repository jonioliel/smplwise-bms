import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { placeOverlay } from '../src/tickets/overlay-menu';

// 2.5.5: where a table / card menu goes (tickets/overlay-menu.ts) and the guards that keep it out of every scroll box.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-overlay-menu.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const src = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const VP = { w: 1280, h: 800 };
const box = (left: number, top: number, w = 120, h = 32) => ({ left, top, right: left + w, bottom: top + h });

test('a menu that fits opens below the trigger from its inline-start edge (LTR left, RTL right) and never scrolls', () => {
  const ltr = placeOverlay(box(300, 100), { w: 200, h: 180 }, VP, false);
  expect(ltr).toMatchObject({ top: 136, left: 300, maxHeight: 180, flipped: false, scrolls: false });
  const rtl = placeOverlay(box(300, 100), { w: 200, h: 180 }, VP, true);
  expect(rtl.left).toBe(220); // right edge 420 - 200: it grows to the left
});

test('near the bottom it flips above when that side holds it', () => {
  const p = placeOverlay(box(300, 700), { w: 200, h: 300 }, VP, false);
  expect(p.flipped).toBe(true);
  expect(p.top).toBe(700 - 4 - 300);
  expect(p.scrolls).toBe(false);
});

test('a menu taller than the roomier side is limited to it and scrolls inside itself (a one-row table, a long list)', () => {
  const p = placeOverlay(box(300, 120), { w: 200, h: 2000 }, VP, false);
  expect(p.flipped).toBe(false);
  expect(p.scrolls).toBe(true);
  expect(p.maxHeight).toBe(800 - 8 - (120 + 32 + 4));
  expect(p.top + p.maxHeight).toBeLessThanOrEqual(VP.h - 8);
  const low = placeOverlay(box(300, 600), { w: 200, h: 2000 }, VP, false);
  expect(low.flipped).toBe(true);
  expect(low.top).toBeGreaterThanOrEqual(8);
  expect(low.top + low.maxHeight).toBeLessThanOrEqual(600 - 4 + 0.001);
});

test('it is clamped to the viewport on both sides, also on a phone width', () => {
  const edge = placeOverlay(box(1200, 100), { w: 240, h: 100 }, VP, false);
  expect(edge.left).toBe(1280 - 8 - 240);
  const rtlEdge = placeOverlay(box(0, 100, 60), { w: 240, h: 100 }, VP, true);
  expect(rtlEdge.left).toBe(8);
  const phone = placeOverlay(box(10, 100, 100), { w: 400, h: 100 }, { w: 320, h: 640 }, false);
  expect(phone.left).toBe(8);
});

test('the table and card menus are top-layer popovers outside the scroll box, opaque, and the table box has no fixed height', () => {
  const table = src('screens/tickets-table.ts');
  expect(table).toContain('popover="manual"');
  expect(table).not.toMatch(/class="cellmenu"[^`]*class="pop"/);
  expect(table).not.toContain('td.cellmenu');
  // the menu is rendered after the .tw box, not inside a cell
  expect(table.indexOf('${this.cellMenu()}')).toBeGreaterThan(table.indexOf("this.body()}"));
  const css = src('tickets/table-styles.ts');
  const block = css.slice(css.indexOf('.pop.ov {'), css.indexOf('}', css.indexOf('.pop.ov {')));
  expect(block).toContain('position: fixed');
  expect(block).toContain('background: var(--sw-menu-surface)');
  const tw = css.slice(css.indexOf('.tw {'), css.indexOf('}', css.indexOf('.tw {')));
  expect(tw).toContain('block-size: auto');
  expect(tw).not.toMatch(/\bmin-block-size\b/);
  expect(src('tickets/ticket-card.ts')).toContain('popover="manual"');
  expect(src('tickets/styles.ts')).toMatch(/\.pop\.ov \{\s*position: fixed;/);
});

test('the settings lists re-read after their own changes and poll with the shared helper', () => {
  expect(src('tickets/settings-dept.ts')).toMatch(/this\.emit\('dept-reload'\); \/\/ 2\.5\.5/);
  expect(src('screens/system-tickets.ts')).toContain('new LiveRefresh(');
  expect(src('screens/system-tickets.ts')).toMatch(/createDepartment[\s\S]{0,400}loadDepartments\(\)/);
  expect(src('tickets/handlers-members.ts')).toContain('new LiveRefresh(');
  expect(src('tickets/handlers-members.ts')).toMatch(/void this\.load\(\); \/\/ 2\.5\.5/);
  expect(src('tickets/contacts-directory.ts')).toContain('new LiveRefresh(');
});

test('one row deleted through the bulk bar leaves the table at once (ticket-deleted), like a bulk answer', () => {
  const table = src('screens/tickets-table.ts');
  expect(table).toContain('@ticket-deleted=${this.onOneDeleted}');
  expect(table).toMatch(/onOneDeleted[\s\S]{0,300}this\.dropTicket\(/);
});
