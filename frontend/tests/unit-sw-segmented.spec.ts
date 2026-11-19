import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentedFocusStep } from '../src/components/segmented-logic';

// CR-CMP2-SELECTS-2450 (owner N11, 19.11): the shared segmented control `sw-segmented` - its keyboard rule (node), its contract (the
// source), and the screens that adopted it (no hand-built `.seg` group comes back there). The look is pinned by
// tests/pixel-sw-segmented.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-sw-segmented.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

test.describe('sw-segmented: the focus rule of the arrow keys', () => {
  const all = [true, true, true, true];

  test('left to right: ArrowRight is the next key, ArrowLeft the previous one, both wrap', () => {
    expect(segmentedFocusStep('ArrowRight', 0, all, false)).toBe(1);
    expect(segmentedFocusStep('ArrowRight', 3, all, false)).toBe(0);
    expect(segmentedFocusStep('ArrowLeft', 0, all, false)).toBe(3);
    expect(segmentedFocusStep('ArrowLeft', 2, all, false)).toBe(1);
  });

  test('right to left (the product reads Hebrew): the arrows follow the reading direction', () => {
    expect(segmentedFocusStep('ArrowLeft', 0, all, true)).toBe(1);
    expect(segmentedFocusStep('ArrowRight', 0, all, true)).toBe(3);
    expect(segmentedFocusStep('ArrowLeft', 3, all, true)).toBe(0);
  });

  test('disabled keys are skipped; Home / End go to the first / last enabled key', () => {
    const some = [false, true, false, true, false];
    expect(segmentedFocusStep('ArrowRight', 1, some, false)).toBe(3);
    expect(segmentedFocusStep('ArrowRight', 3, some, false)).toBe(1);
    expect(segmentedFocusStep('Home', 3, some, false)).toBe(1);
    expect(segmentedFocusStep('End', 1, some, false)).toBe(3);
  });

  test('other keys, an empty row and a row with nothing enabled are not ours', () => {
    expect(segmentedFocusStep('Enter', 0, all, false)).toBe(-1);
    expect(segmentedFocusStep('Tab', 0, all, false)).toBe(-1);
    expect(segmentedFocusStep('ArrowRight', 0, [], false)).toBe(-1);
    expect(segmentedFocusStep('ArrowRight', 0, [false, false], false)).toBe(-1);
    expect(segmentedFocusStep('Home', 0, [false, false], false)).toBe(-1);
  });
});

test.describe('sw-segmented: the contract in the source', () => {
  const src = read('components/sw-segmented.ts');

  test('controlled: a press fires a composed `change` with the value and never moves the thumb itself', () => {
    expect(src).toMatch(/new CustomEvent<SegmentedChange<V>>\('change', \{ detail: \{ value: o\.value \}, bubbles: true, composed: true \}\)/);
    expect(src).not.toMatch(/this\.value\s*=[^=]/);
    // a disabled group / key fires nothing
    expect(src).toMatch(/if \(this\.disabled \|\| o\.disabled\) return;/);
  });

  test('accessible: a named group of toggle buttons (aria-pressed), the arrows move the focus', () => {
    expect(src).toMatch(/role=\$\{radio \? 'radiogroup' : 'group'\} aria-label=\$\{this\.label \|\| nothing\}/);
    // CR-CMP2-SEGMENTED-B-2450: a radio group keeps its radios (role + aria-checked) and the aria-pressed the look reads
    expect(src).toMatch(/role=\$\{radio \? 'radio' : nothing\} aria-checked=\$\{radio \? String\(o\.value === this\.value\) : nothing\}/);
    expect(src).toMatch(/<button type="button" part="key" aria-pressed=\$\{o\.value === this\.value \? 'true' : 'false'\}/);
    expect(src).toMatch(/@keydown=\$\{this\.onKey\}/);
    expect(src).toMatch(/button:focus-visible \{\s*outline: var\(--sw-focus-w, 2px\) solid var\(--sw-focus\);/);
  });

  test('the look is the settings key (POLISH4-WP1) and reads the --sw-seg-* knobs; the chosen key is the dark-safe light pill', () => {
    const settings = read('styles/settings.ts');
    // the same knobs as styles/settings.ts settingsSegStyles, so a glass host that sets them draws the same through the shadow root
    for (const knob of ['--sw-seg-border', '--sw-seg-radius', '--sw-seg-track', '--sw-seg-pad', '--sw-seg-gap', '--sw-seg-btn-radius', '--sw-seg-h', '--sw-seg-divider', '--sw-seg-on-bg', '--sw-seg-on-fg', '--sw-seg-on-shadow']) {
      expect(src, knob).toContain(`var(${knob}`);
      expect(settings, knob).toContain(`var(${knob}`);
    }
    expect(src).toMatch(/\.seg button\[aria-pressed='true'\] \{[^}]*background: var\(--sw-seg-on-bg, var\(--sw-seg-key, var\(--sw-surface\)\)\);[^}]*color: var\(--sw-seg-on-fg, var\(--sw-seg-key-ink, var\(--sw-accent-text\)\)\);/);
    // tokens only: no colour literal
    expect(src.split('static styles')[1]).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test('touch and motion: a 44 px tall target on a coarse pointer, hover only under a hovering pointer, no motion when reduced', () => {
    expect(src).toMatch(/@media \(max-width: 767px\) and \(pointer: coarse\) \{\s*button::before \{/);
    expect(src).toMatch(/- 44px\) \/ 2\)\)/);
    expect(src).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*button:hover/);
    expect(src).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*button \{\s*transition-duration: 0ms;/);
    expect(src).toMatch(/transform: scale\(var\(--sw-press-scale, 1\)\)/);
    // the thumb does not slide (a settings key is pressed tens of times a day): no transform transition on the track
    expect(src).not.toMatch(/\.seg \{[^}]*transition/);
  });
});

/** The screens whose segmented controls moved to sw-segmented: no hand-built `class="seg"` group may come back in them. */
const ADOPTED = [
  'screens/system-look.ts',
  'screens/system-design.ts',
  'screens/system-plan-view.ts',
  'screens/system-brand-logos.ts',
  'screens/system-automations.ts',
];

test('adoption: the adopted screens draw every segmented control with sw-segmented', () => {
  const bad: string[] = [];
  for (const file of ADOPTED) {
    const src = read(file);
    if (/class="seg[\s"]/.test(src)) bad.push(`${file}: a hand-built class="seg" group`);
    if (!src.includes('<sw-segmented')) bad.push(`${file}: no <sw-segmented>`);
    if (!src.includes("import '../components/sw-segmented';")) bad.push(`${file}: does not import the component`);
  }
  expect(bad).toEqual([]);
});
