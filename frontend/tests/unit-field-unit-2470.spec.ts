import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FIELD-UNIT-2470: `sw-field` gains a UNIT (an affix inside the input's frame: ₪, kWh, m³, %, days) and the consumption modules'
// hand-built "input + unit" pairs move onto it. Node only - source guards for the component contract and for every moved screen. The
// in-browser receipts (where the unit sits in Hebrew and English, the measured padding, LTR digits, the description, a press on the unit)
// are tests/pixel-sw-field.spec.ts; the screens keep their own specs (electricity-tou, layout-electricity, water-*).

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');

test('sw-field: the unit API - a `unit` text, `unit-at` start | end (reflected), drawn for the plain field only', () => {
  const s = flat('components/sw-field.ts');
  expect(s).toContain("@property() unit = '';");
  expect(s).toContain("@property({ attribute: 'unit-at', reflect: true }) unitAt: 'start' | 'end' = 'end';");
  // the capsule select and the search box keep their own chrome
  expect(s).toContain("return !!this.unit && !this.capsule && this.type !== 'search';");
  expect(s).toContain("this.toggleAttribute('has-unit', this.hasUnit);");
  // the unit sits in the frame box with the slotted control, hidden from the accessibility tree (the control is described instead)
  expect(s).toContain('<div class="ubox" part="unit-box"><slot @slotchange=${this.onSlotChange}></slot><span class="unit" part="unit" aria-hidden="true" data-unit>${this.unit}</span></div>');
  // a field's message (role="alert") has its own slot below the frame, so it never sits inside the unit box
  expect(s).toContain('<slot name="message"></slot>');
  // the label and the hint are parts (a module skin keeps its label size)
  expect(s).toContain('<div class="hint" part="hint">');
  // the label cannot point at the slotted control across the shadow boundary: a press on it focuses the control
  expect(s).toContain('<label part="label" @click=${this.focusControl}>');
  expect(s).toMatch(/private focusControl = \(\) => \{.*if \(c && !c\.disabled\) c\.focus\(\);/);
});

test('sw-field: the unit follows the READING direction, the padding side is physical, a figure stays left-to-right', () => {
  const s = flat('components/sw-field.ts');
  // logical placement of the unit itself (its direction is the page's)
  expect(s).toMatch(/\.unit \{ position: absolute; inset-block: 0; inset-inline-end: var\(--_uin\);/);
  expect(s).toMatch(/:host\(\[unit-at='start'\]\) \.unit \{ inset-inline-end: auto; inset-inline-start: var\(--_uin\); \}/);
  // the four direction x side cases map onto physical padding (an LTR figure in an RTL page has the opposite logical sides)
  expect(s).toContain(":host([has-unit]:dir(ltr):not([unit-at='start'])) ::slotted(input), :host([has-unit]:dir(rtl)[unit-at='start']) ::slotted(input) { padding-right: var(--_upad) !important; }");
  expect(s).toContain(":host([has-unit]:dir(rtl):not([unit-at='start'])) ::slotted(input), :host([has-unit]:dir(ltr)[unit-at='start']) ::slotted(input) { padding-left: var(--_upad) !important; }");
  // the padding is the measured unit + the inset + a gap; until the first measure 1.4em
  expect(s).toContain('--_upad: calc(var(--_uw, 1.4em) + var(--_uin) + 6px);');
  expect(s).toContain("this.unitBox?.style.setProperty('--_uw', `${Math.ceil(w)}px`);");
  expect(s).toContain('new ResizeObserver(this.measureUnit)');
  // numeric inputs: LTR digits, tabular figures
  for (const sel of ["::slotted(input[inputmode='decimal'])", "::slotted(input[inputmode='numeric'])", "::slotted(input[type='number'])"]) expect(s).toContain(`:host([has-unit]) ${sel}`);
  expect(s).toMatch(/direction: ltr; text-align: left; font-variant-numeric: tabular-nums;/);
  // a press on the unit lands in the input
  expect(s).toMatch(/\.unit \{[^}]*pointer-events: none;/);
  // the observer is released with the element
  expect(s).toContain('this.unitObserver?.disconnect();');
});

test('sw-field: the unit is the control\'s description; a wrong value (aria-invalid) is drawn wrong inside any shadow root', () => {
  const s = flat('components/sw-field.ts');
  expect(s).toContain("el.setAttribute('aria-description', this.unit);");
  expect(s).toContain("el.setAttribute('data-sw-field-unit', '');");
  // a description the screen set itself is kept; ours leaves with the unit
  expect(s).toContain("if (!ours && el.hasAttribute('aria-description')) return;");
  expect(s).toContain("el.removeAttribute('aria-description');");
  expect(s).toContain("::slotted(input[aria-invalid='true']), ::slotted(select[aria-invalid='true']), ::slotted(textarea[aria-invalid='true']) { border-color: var(--sw-danger);");
});

test('time-of-use prices: the shared table with a ₪ field per price; every spec hook kept; no hand-built table or sideways scroll', () => {
  const s = flat('electricity/elec-tou-editor.ts');
  const prices = s.slice(s.indexOf('private prices('), s.indexOf('// ------------------------------------------------------------------ hours'));
  expect(prices).toContain('<sw-table bare static-rows class="t"');
  expect(prices).toContain("'data-tou-band'");
  expect(prices).toContain('data-tou-prices');
  expect(prices).toContain('<sw-field part="field tou-price" unit="₪" hint=${hint}>');
  // the spec hooks: data-tou-price on the input, .err on a refused price (+ aria-invalid), the column header 'פס' (English 'Band')
  expect(prices).toContain('data-tou-price=${`${s.id}:${b.id}`}');
  expect(prices).toContain("class=\"ltr ${bad ? 'err' : ''}\"");
  expect(prices).toContain("aria-invalid=${bad ? 'true' : 'false'}");
  expect(prices).toContain("label: tr('פס')");
  expect(prices).not.toMatch(/<table|scrollx|<span>₪<\/span>/);
  expect(s).not.toContain('td.pc');
});
