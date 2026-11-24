import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ariaChecked, checkedOf, pressed, selectAllState, type CheckState } from '../src/components/sw-checkbox-logic';
import { SELECTABLE_SKIN_IDS, SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { TOKENS } from '../src/design/tokens';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// SHARED-CHECKBOX-2480: the shared selection check box `sw-checkbox`. Node only: the state rules (sw-checkbox-logic.ts), source guards
// for the component contract (no colour / px literal, the knobs, the aria, Space not Enter, in-label, the coarse-pointer hit area), and
// the contrast of its drawn parts in every selectable skin, light and dark. The in-browser receipts (press, keyboard, label, name,
// RTL, the specimen shots) are tests/pixel-sw-checkbox.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');
/** The source without comments (as scripts/design_ratchet.py reads it). */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(?<![:'"`\\/])\/\/\s.*$/gm, '');

test('the state rules: aria-checked, one press, the select-all box', () => {
  expect(ariaChecked({ checked: false, indeterminate: false })).toBe('false');
  expect(ariaChecked({ checked: true, indeterminate: false })).toBe('true');
  // the mixed mark wins over checked, as on a native box
  expect(ariaChecked({ checked: true, indeterminate: true })).toBe('mixed');
  expect(ariaChecked({ checked: false, indeterminate: true })).toBe('mixed');
  expect(pressed({ checked: false, indeterminate: false })).toEqual({ checked: true, indeterminate: false });
  expect(pressed({ checked: true, indeterminate: false })).toEqual({ checked: false, indeterminate: false });
  // a mixed box becomes checked (the native rule), whatever `checked` held
  expect(pressed({ checked: false, indeterminate: true })).toEqual({ checked: true, indeterminate: false });
  expect(pressed({ checked: true, indeterminate: true })).toEqual({ checked: true, indeterminate: false });
  expect(selectAllState(0, 5)).toEqual({ checked: false, indeterminate: false });
  expect(selectAllState(2, 5)).toEqual({ checked: false, indeterminate: true });
  expect(selectAllState(5, 5)).toEqual({ checked: true, indeterminate: false });
  expect(selectAllState(7, 5)).toEqual({ checked: true, indeterminate: false }); // a stale count reads as all
  expect(selectAllState(0, 0)).toEqual({ checked: false, indeterminate: false }); // nothing to choose
  expect(selectAllState(3, 0)).toEqual({ checked: false, indeterminate: false });
  // the select-all box ticks through the same press rule: a mixed header selects every row
  const header: CheckState = selectAllState(2, 5);
  expect(pressed(header)).toEqual({ checked: true, indeterminate: false });
});

test('checkedOf: the change detail first, else the target (the handler a native box had)', () => {
  const ev = (detail: unknown, target: unknown) => ({ detail, target }) as unknown as Event;
  expect(checkedOf(ev({ checked: true, value: 'a' }, { checked: false }))).toBe(true);
  expect(checkedOf(ev({ checked: false }, { checked: true }))).toBe(false);
  expect(checkedOf(ev(null, { checked: true }))).toBe(true);
  expect(checkedOf(ev(undefined, null))).toBe(false);
});

test('sw-checkbox: the API is sw-toggle\'s shape (checked / disabled reflected, label, labelHidden, in-label) plus indeterminate and value', () => {
  const s = flat('components/sw-checkbox.ts');
  expect(s).toContain("@customElement('sw-checkbox')");
  expect(s).toContain('@property({ type: Boolean, reflect: true }) checked = false;');
  expect(s).toContain('@property({ type: Boolean, reflect: true }) indeterminate = false;');
  expect(s).toContain('@property({ type: Boolean, reflect: true }) disabled = false;');
  expect(s).toContain("@property() label = '';");
  expect(s).toContain('@property({ type: Boolean }) labelHidden = false;');
  expect(s).toContain("@property({ type: Boolean, attribute: 'in-label' }) inLabel = false;");
  expect(s).toContain("@property() value = '';");
  // the change event: bubbles out of every shadow root, carries the value
  expect(s).toContain("new CustomEvent('change', { detail: { checked: this.checked, value: this.value }, bubbles: true, composed: true })");
  // the box is a real control: a button with the checkbox role, aria-checked from the state rule, disabled natively
  expect(s).toMatch(/<button type="button" part="box" role="checkbox" aria-checked=\$\{ariaChecked\(this\)\}/);
  expect(s).toContain('?disabled=${this.disabled}');
  // Enter does not tick (Space is the button's own activation)
  expect(s).toContain("if (e.key === 'Enter') e.preventDefault();");
  // the row is a <label> around the box and the text (a press on the text ticks the box; a link inside the text keeps its press)
  expect(s).toMatch(/<label class="row" part="row" ><button/);
  expect(s).toContain('<span class="text" part="label" ?hidden=${!showText}><slot @slotchange=${this.onSlot}>');
  // in-label: the screen's own label ticks the box, other controls inside it keep their press
  expect(s).toContain("first.closest('a, button, input, select, textarea, sw-toggle, sw-checkbox, sw-button')");
  expect(s).toContain("this.labelEl = this.closest('label');");
  expect(s).toContain("this.labelEl?.removeEventListener('click', this.onLabelClick);");
  // a disabled box never moves
  expect(s).toMatch(/private press\(\) \{ if \(this\.disabled\) return;/);
});

test('sw-checkbox: design tokens only - no colour literal, no px literal, the knobs read with token fallbacks', () => {
  const c = code('components/sw-checkbox.ts');
  expect(c.match(/(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g) ?? []).toEqual([]);
  expect(c.match(/(?<![\w-])(?:rgba?|hsla?)\(/g) ?? []).toEqual([]);
  expect(c.match(/(?<![\w.-])-?\d+(?:\.\d+)?px\b/g) ?? []).toEqual([]);
  // not counted as a hand-built switch / native check box by the ratchet
  expect(c).not.toMatch(/role\s*=\s*["']switch["']|type\s*=\s*["']checkbox["']/);
  const s = flat('components/sw-checkbox.ts');
  for (const k of [
    '--_on: var(--sw-check-on, var(--sw-accent));',
    '--_off: var(--sw-check-off, var(--sw-toggle-off));',
    'gap: var(--sw-check-gap, var(--sw-s-2));',
    'font-size: var(--sw-check-fs, var(--sw-fs-sm));',
    'inline-size: var(--sw-check-size);',
    'block-size: var(--sw-check-size);',
    'border: var(--sw-check-border-w) solid var(--_off);',
    'border-radius: var(--sw-check-radius, var(--sw-r-2xs));',
    'background: var(--sw-check-bg, var(--sw-surface-solid));',
    'color: var(--sw-check-mark, var(--sw-text-inverse));',
    'outline: var(--sw-focus-w) solid var(--sw-focus);',
    'opacity: var(--sw-disabled-opacity);',
  ])
    expect(s, k).toContain(k);
  // the size knobs are tokens (a px value lives in design/), one value for both schemes
  expect(TOKENS['--sw-check-size']).toEqual({ light: '18px', dark: '18px' });
  expect(TOKENS['--sw-check-border-w']).toEqual({ light: '2px', dark: '2px' });
  expect(TOKENS['--sw-check-touch']).toEqual({ light: '44px', dark: '44px' });
  // the colour knobs are NOT declared (they follow a screen that re-tints its accent / surface locally)
  for (const n of ['--sw-check-on', '--sw-check-off', '--sw-check-bg', '--sw-check-mark']) expect(TOKENS[n], n).toBeUndefined();
  // no skin overrides a check knob (the skins reach the box through the tokens it falls back to)
  for (const id of SKIN_IDS) expect(Object.keys(skinTable(id)).filter((n) => n.startsWith('--sw-check-') && !TOKENS[n])).toEqual([]);
});

test('sw-checkbox: a coarse pointer gets a 44 px tall hit area in the block axis only; RTL by logical properties; forced colours', () => {
  const s = flat('components/sw-checkbox.ts');
  expect(s).toMatch(/@media \(pointer: coarse\) \{ button::before \{ content: ''; position: absolute; inset-inline: calc\(var\(--sw-check-border-w\) \* -1\); inset-block: calc\(\(var\(--sw-check-size\) - var\(--sw-check-touch\)\) \/ 2 - var\(--sw-check-border-w\)\); \} \}/);
  // 18 px box with a 2 px ring: the ::before's padding-box offsets make it exactly 44 px tall
  const size = 18;
  const bw = 2;
  const inset = (size - 44) / 2 - bw;
  expect(size - 2 * bw - 2 * inset).toBe(44);
  // no physical side in the component's CSS (it reads the same in Hebrew and English)
  const c = code('components/sw-checkbox.ts');
  expect(c).not.toMatch(/\b(margin|padding|border)-(left|right)\b|\b(left|right)\s*:/);
  expect(s).toContain('@media (forced-colors: active)');
  // the mark is not mirrored in RTL (a check mark reads the same both ways)
  expect(c).not.toMatch(/scaleX\(-1\)/);
});

test('sw-checkbox is registered app-wide (the shell imports it, as the screens that move onto it will need)', () => {
  expect(read('shell/sw-app.ts')).toMatch(/^import '\.\.\/components\/sw-checkbox';/m);
});

// ---- contrast of the drawn parts, every selectable skin x scheme (WCAG 1.4.11: a UI boundary / a state mark reads >= 3:1) ----
const MIN = 3;
const colours = (s: string): RGBA[] => (s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi) ?? []).map((c) => parseColor(c)).filter((c): c is RGBA => !!c);

function beds(id: (typeof SKIN_IDS)[number], mode: 'light' | 'dark') {
  const t = skinTable(id);
  const v = (n: string) => t[n][mode];
  const P = (n: string) => {
    const c = parseColor(v(n));
    if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${v(n)}`);
    return c;
  };
  const bg = P('--sw-bg');
  const solid = P('--sw-surface-solid');
  const out: Record<string, RGBA> = { bg, 'surface-solid': solid, 'surface-2-solid': P('--sw-surface-2-solid') };
  for (const n of ['--sw-surface', '--sw-surface-2']) out[`${n.slice(5)} over bg`] = over(P(n), bg);
  out['surface-3 over surface-solid'] = over(P('--sw-surface-3'), solid);
  const canvas = colours(v('--sw-canvas'));
  const stops = canvas.filter((c) => c[3] >= 1);
  const blooms = canvas.filter((c) => c[3] < 1 && !(c[0] === 255 && c[1] === 255 && c[2] === 255));
  stops.forEach((s, i) => blooms.forEach((b, j) => (out[`surface over bloom ${j + 1} on stop ${i + 1}`] = over(P('--sw-surface'), over(b, s)))));
  return { P, beds: out };
}

/** CSS `color-mix(in srgb, a p%, b)` of two opaque colours. */
const mix = (a: RGBA, b: RGBA, p: number): RGBA => [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat(1) as RGBA;

test('contrast: the empty ring, the filled box edge and the mark on it read >= 3:1 in every selectable skin, light and dark', () => {
  // the edge of a filled box is its ring, a quarter of the way from the fill to the text colour (the bare accent is recorded too)
  expect(flat('components/sw-checkbox.ts')).toContain(':host([checked]) button, :host([indeterminate]) button { background: var(--_on); border-color: color-mix(in srgb, var(--_on) 75%, var(--sw-text)); }');
  const fails: string[] = [];
  const rows: string[] = [];
  for (const id of SELECTABLE_SKIN_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      const { P, beds: b } = beds(id, mode);
      const ring = P('--sw-toggle-off');
      const fill = P('--sw-accent');
      const mark = P('--sw-text-inverse');
      const edge = mix(fill, P('--sw-text'), 0.75);
      const boxBg = P('--sw-surface-solid');
      let ringWorst = Infinity;
      let fillWorst = Infinity;
      let edgeWorst = Infinity;
      let where = '';
      for (const [bed, c] of Object.entries(b)) {
        ringWorst = Math.min(ringWorst, contrastRatio(over(ring, c), c));
        fillWorst = Math.min(fillWorst, contrastRatio(over(fill, c), c));
        const e = contrastRatio(edge, c);
        if (e < edgeWorst) [edgeWorst, where] = [e, bed];
      }
      // the ring against the box's own fill (the inside of an empty box)
      const ringIn = contrastRatio(over(ring, boxBg), boxBg);
      const markOn = contrastRatio(over(mark, fill), fill);
      rows.push(`${id}/${mode}: ring ${ringWorst.toFixed(2)} (inside ${ringIn.toFixed(2)}), edge ${edgeWorst.toFixed(2)} (${where}; bare fill ${fillWorst.toFixed(2)}), mark ${markOn.toFixed(2)}`);
      if (ringWorst < MIN) fails.push(`${id}/${mode} ring ${ringWorst.toFixed(2)}`);
      if (ringIn < MIN) fails.push(`${id}/${mode} ring inside ${ringIn.toFixed(2)}`);
      if (edgeWorst < MIN) fails.push(`${id}/${mode} edge ${edgeWorst.toFixed(2)} on ${where}`);
      if (markOn < MIN) fails.push(`${id}/${mode} mark ${markOn.toFixed(2)}`);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});
