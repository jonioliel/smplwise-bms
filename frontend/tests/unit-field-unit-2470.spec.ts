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
  expect(s).toContain(":host([has-unit]:dir(ltr):not([unit-at='start'])) ::slotted(input), :host([has-unit]:dir(rtl)[unit-at='start']) ::slotted(input) { padding-right: var(--_upad) !important; --_ualign: right; }");
  expect(s).toContain(":host([has-unit]:dir(rtl):not([unit-at='start'])) ::slotted(input), :host([has-unit]:dir(ltr)[unit-at='start']) ::slotted(input) { padding-left: var(--_upad) !important; --_ualign: left; }");
  // the padding is the measured unit + the inset + a gap; until the first measure 1.4em
  expect(s).toContain('--_upad: calc(var(--_uw, 1.4em) + var(--_uin) + 6px);');
  expect(s).toContain("this.unitBox?.style.setProperty('--_uw', `${Math.ceil(w)}px`);");
  expect(s).toContain('new ResizeObserver(this.measureUnit)');
  // numeric inputs: LTR digits, tabular figures
  for (const sel of ["::slotted(input[inputmode='decimal'])", "::slotted(input[inputmode='numeric'])", "::slotted(input[type='number'])"]) expect(s).toContain(`:host([has-unit]) ${sel}`);
  // ... and sits against its unit (the unit's physical side)
  expect(s).toMatch(/direction: ltr; text-align: var\(--_ualign, left\); font-variant-numeric: tabular-nums;/);
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

// ---- the consumption modules' hand-built "input + unit" pairs, one screen per commit (owner N21-N46: a mixed form moves all its
// fields together; the module keeps its own input look - its input rules outrank the field's ::slotted ones - and its label size
// through sw-field.fld::part(label))
const MOVED: Record<string, { units: string[]; hooks: string[] }> = {
  'electricity/elec-settings.ts': { units: ['unit="₪"', 'unit="%"', "unit=${tr('ימים')}", "unit=${tr('בחודש')}", "unit=${tr('שעות אחרי סוף התקופה')}"], hooks: ['data-tariff-price', 'data-vat-input', 'data-days', 'data-day-of-month', 'data-delay', 'data-field-error=${k}', 'data-field-error="delay_hours"', 'id="b-${k}"'] },
  'electricity/elec-wizard.ts': { units: ['unit="₪"', "unit=${tr('בחודש')}"], hooks: ['data-anchor-day', 'data-anchor-month', 'data-first-start', 'data-tariff-price', 'data-tariff-name', 'data-tariff-from'] },
  'electricity/meter-card.ts': { units: ["unit=${tr('קוט״ש')}"], hooks: ['data-replace-final', 'data-replace-start', 'data-replace-note'] },
  'screens/electricity/settings-retention.ts': { units: ['unit=${UNIT_TEXT[range.unit] ?? range.unit}'], hooks: ['data-retention-input=${r.key}', 'data-retention-error=${r.key}'] },
  'water/meter-card.ts': { units: ["unit=${o.suffix ?? ''}"], hooks: ["suffix: wt('m3')", 'id="wkd"', 'id="wru"'] },
  'screens/water/page-settings.ts': { units: ['unit="₪"'], hooks: ['data-water-price', 'data-sewage-price', 'data-tariff-name'] },
};

for (const [file, { units, hooks }] of Object.entries(MOVED)) {
  test(`moved to sw-field with a unit: ${file}`, () => {
    const s = flat(file);
    expect(s).toMatch(/import '(\.\.\/)+components\/sw-field';/);
    for (const u of units) expect(s, u).toContain(u);
    for (const h of hooks) expect(s, h).toContain(h);
    // no hand-built pair is left: no module .unit box, no unit span after an input, no input inside an .inp frame with a unit
    expect(s).not.toMatch(/<div class="unit"><input/);
    expect(s).not.toMatch(/<input[^>]*\/><span( class="mut")?>[^<]{1,30}<\/span><\/div>/);
    // a field's own message sits in the field's message slot (outside the unit frame)
    expect(s).not.toMatch(/<sw-field[^`]*?<div class="msg" role="alert"(?! slot="message")[^>]*>/);
  });
}

test('the module skin: a module form field keeps the module label and its 13 px unit inset', () => {
  const s = flat('electricity/styles.ts');
  expect(s).toContain('sw-field.fld::part(label) { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }');
  expect(s).toContain('sw-field { --sw-field-unit-inset: 13px; }');
});
