import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { holdsTab, isTopLayer, layerCount, pushLayer, removeLayer, takesEscape, topLayer, trapTab } from '../src/components/modal-stack';

// CR-MODAL-STACK-2441 (code review 07:F13): the stack shared by sw-dialog, the modal sw-drawer and sw-sheet. Node only - the layers are
// plain objects, the key events plain objects too. The browser half (real elements, real key presses) is in
// tests/a11y-polished-2342.spec.ts and tests/a11y-dialog-focus-2310.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-modal-stack-2441.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

/** Every test leaves the module's stack empty. */
function layers<T extends object>(...made: T[]): T[] {
  return made;
}
const clear = (...all: object[]) => all.forEach(removeLayer);

test('the layer opened last is the top one; closing it gives the top back to the one below', () => {
  const [sheet, dialog] = layers({ n: 'sheet' }, { n: 'dialog' });
  expect(topLayer()).toBeNull();
  pushLayer(sheet);
  expect(isTopLayer(sheet)).toBe(true);
  pushLayer(dialog);
  expect(topLayer()).toBe(dialog);
  expect(isTopLayer(sheet)).toBe(false);
  removeLayer(dialog);
  expect(topLayer()).toBe(sheet);
  removeLayer(sheet);
  expect(topLayer()).toBeNull();
  expect(layerCount()).toBe(0);
});

test('a layer that opens again moves to the top and is never listed twice; removing an unknown layer is harmless', () => {
  const [a, b] = layers({}, {});
  pushLayer(a);
  pushLayer(b);
  pushLayer(a);
  expect(layerCount()).toBe(2);
  expect(topLayer()).toBe(a);
  removeLayer({});
  expect(layerCount()).toBe(2);
  removeLayer(a);
  expect(topLayer()).toBe(b);
  clear(a, b);
  expect(layerCount()).toBe(0);
});

test('a single open layer always takes Escape (the single-modal case is unchanged)', () => {
  const only = {};
  pushLayer(only);
  expect(takesEscape(only, {})).toBe(true);
  expect(takesEscape(only, {})).toBe(true); // the next press, a new event
  clear(only);
});

test('nested: only the top layer takes the key, in either listener order', () => {
  const [sheet, dialog] = layers({}, {});
  pushLayer(sheet);
  pushLayer(dialog);
  // the lower layer's listener first
  const e1 = {};
  expect(takesEscape(sheet, e1)).toBe(false);
  expect(takesEscape(dialog, e1)).toBe(true);
  // the top layer's listener first
  const e2 = {};
  expect(takesEscape(dialog, e2)).toBe(true);
  expect(takesEscape(sheet, e2)).toBe(false);
  clear(sheet, dialog);
});

test('one press closes one layer: the layer below does not take the same event after the top one left the stack', () => {
  const [drawer, sheet] = layers({}, {});
  pushLayer(drawer);
  pushLayer(sheet);
  const press = {};
  expect(takesEscape(sheet, press)).toBe(true);
  removeLayer(sheet); // it closed inside its listener; the element's update ran before the next listener
  expect(isTopLayer(drawer)).toBe(true);
  expect(takesEscape(drawer, press)).toBe(false);
  // the second press is the drawer's
  expect(takesEscape(drawer, {})).toBe(true);
  clear(drawer);
});

test('a layer that left the page without closing never holds the key', () => {
  const below = { isConnected: true };
  const gone = { isConnected: true };
  pushLayer(below);
  pushLayer(gone);
  expect(topLayer()).toBe(gone);
  gone.isConnected = false;
  expect(topLayer()).toBe(below);
  expect(takesEscape(below, {})).toBe(true);
  expect(holdsTab(below)).toBe(true);
  clear(below, gone);
});

test('Tab belongs to the top layer that traps: an inline sheet above a modal layer does not take the trap away', () => {
  const [dialog, inline, confirm] = layers({}, {}, {});
  expect(holdsTab(dialog)).toBe(false); // not open
  pushLayer(dialog);
  expect(holdsTab(dialog)).toBe(true);
  let isInline = true;
  pushLayer(inline, { traps: () => !isInline });
  expect(holdsTab(dialog)).toBe(true);
  expect(holdsTab(inline)).toBe(false);
  // Escape still goes to the layer opened last
  expect(takesEscape(dialog, {})).toBe(false);
  expect(takesEscape(inline, {})).toBe(true);
  // the same sheet as a real pop-up (the layout is read at the time of the key)
  isInline = false;
  expect(holdsTab(inline)).toBe(true);
  expect(holdsTab(dialog)).toBe(false);
  pushLayer(confirm);
  expect(holdsTab(confirm)).toBe(true);
  expect(holdsTab(inline)).toBe(false);
  clear(dialog, inline, confirm);
});

test('trapTab: wraps on the two edges, pulls stray focus in, leaves the middle to the browser, swallows the key when nothing can take focus', () => {
  const focused: string[] = [];
  const el = (id: string, extra: Record<string, unknown> = {}) => ({ id, shadowRoot: null, getRootNode: () => ({}), focus: () => focused.push(id), ...extra }) as unknown as HTMLElement;
  const [a, b, c] = [el('a'), el('b'), el('c')];
  const all = [a, b, c];
  const key = (shiftKey: boolean) => {
    const e = { shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
    return e;
  };
  let e = key(false);
  trapTab(e, all, c, true); // Tab on the last one
  expect([e.prevented, focused.pop()]).toEqual([true, 'a']);
  e = key(true);
  trapTab(e, all, a, true); // Shift+Tab on the first one
  expect([e.prevented, focused.pop()]).toEqual([true, 'c']);
  e = key(false);
  trapTab(e, all, b, true); // the middle: the browser moves the focus
  expect([e.prevented, focused.length]).toEqual([false, 0]);
  e = key(true);
  trapTab(e, all, c, true); // Shift+Tab on the last one: the browser too
  expect([e.prevented, focused.length]).toEqual([false, 0]);
  e = key(false);
  trapTab(e, all, el('page'), false); // focus is outside the box
  expect([e.prevented, focused.pop()]).toEqual([true, 'a']);
  e = key(true);
  trapTab(e, all, null, false);
  expect([e.prevented, focused.pop()]).toEqual([true, 'c']);
  e = key(false);
  trapTab(e, [], null, false);
  expect([e.prevented, focused.length]).toEqual([true, 0]);
  // an edge whose shadow root holds the focus (an sw-button's inner button) is still the edge
  const inner = el('inner', { getRootNode: () => ({ host: c }) });
  e = key(false);
  trapTab(e, all, inner, true);
  expect([e.prevented, focused.pop()]).toEqual([true, 'a']);
});

test('the three primitives use the shared stack and helpers, and none keeps a private copy', () => {
  const dialog = read('components/sw-dialog.ts');
  const drawer = read('components/sw-drawer.ts');
  const sheet = read('components/sw-sheet.ts');
  for (const s of [dialog, drawer, sheet]) {
    expect(s).toContain("from './modal-stack'");
    expect(s).toMatch(/takesEscape\(this, e\)/);
    expect(s).toMatch(/pushLayer\(this/);
    expect(s).toMatch(/removeLayer\(this\)/);
    expect(s).not.toMatch(/function deepActive\(/);
    // the private copy of deepActive() was a `while (x?.shadowRoot?.activeElement)` walk to the deepest element. sw-dialog's open() (main,
    // b19e99165) walks every LEVEL of the focus chain to see whether focus is already inside the dialog - not a copy of the helper
    expect(s).not.toMatch(/while \(\w+\?\.shadowRoot\?\.activeElement\)/);
  }
  expect(dialog).not.toContain('OPEN_STACK');
  for (const s of [dialog, sheet]) expect(s).toMatch(/if \(!holdsTab\(this\)\) return;/);
  // the stack module itself touches no DOM when it is loaded (this spec imports it in Node)
  expect(read('components/modal-stack.ts')).not.toMatch(/^import /m);
});
