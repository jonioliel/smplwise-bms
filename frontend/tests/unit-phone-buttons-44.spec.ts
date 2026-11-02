import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MOBILE_POLISH_SHADOW } from '../src/design/mobile-polish-css';

// PHONE-BUTTONS-44-2342 (owner 02.11, answer 2A): on a phone (max-width 767 px AND a coarse pointer) the shared button is DRAWN 44 px
// high, small and default alike, with proportional padding; desktop / tablet keep their sizes; no invisible hit slop is left.
// Node only (reads the CSS text). The drawn height is measured by tests/layout-a11y-295.spec.ts and tests/evidence-mobile-touch.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-phone-buttons-44.spec.ts

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const button = readFileSync(resolve(ROOT, 'src/components/sw-button.ts'), 'utf8');

/** The body of the first `@media <prelude> {` block in `css` (nested braces balanced). */
function mediaBody(css: string, prelude: RegExp): string {
  const m = prelude.exec(css);
  if (!m) return '';
  let depth = 0;
  const start = css.indexOf('{', m.index);
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  return '';
}

/** The declarations of `selector { ... }` inside `css`. */
function rule(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return '';
  return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
}

test('sw-button: the phone block draws sm and md at 44 px with proportional padding', () => {
  const phone = mediaBody(button, /@media \(max-width: 767px\) and \(pointer: coarse\)/);
  expect(phone, 'the phone block').not.toBe('');
  expect(rule(phone, 'button')).toContain('min-block-size: max(44px, var(--sw-ctl-h-md))');
  expect(rule(phone, 'button')).toContain('padding-inline: 13px');
  expect(rule(phone, ":host([size='sm']) button")).toContain('min-block-size: max(44px, var(--sw-ctl-h-sm))');
  expect(rule(phone, ":host([size='sm']) button")).toContain('padding-inline: 11px');
  expect(rule(phone, ":host([size='lg']) button")).toContain('min-block-size: max(44px, var(--sw-ctl-h-lg))');
  expect(rule(phone, ':host([icononly]) button')).toContain('inline-size: max(44px, var(--sw-ctl-h-md))');
  expect(rule(phone, ':host([icononly]) button')).toContain('padding-inline: 0');
  expect(rule(phone, ":host([icononly][size='sm']) button")).toContain('inline-size: max(44px, var(--sw-ctl-h-sm))');
  expect(phone, 'no 36 / 40 px floor left on a phone').not.toMatch(/max\((36|40)px/);
});

test('sw-button: the desktop / tablet sizes are unchanged (the resting rules outside the phone block)', () => {
  const resting = button.replace(mediaBody(button, /@media \(max-width: 767px\) and \(pointer: coarse\)/), '');
  expect(rule(resting, '    button')).toContain('min-block-size: var(--sw-ctl-h-md)');
  expect(rule(resting, '    button')).toContain('padding-inline: 12px');
  expect(rule(resting, ":host([size='sm']) button")).toContain('min-block-size: var(--sw-ctl-h-sm)');
  expect(rule(resting, ":host([size='sm']) button")).toContain('padding-inline: 9px');
});

test('phone layer: the 44 px heights win over a skin (after the skin sheet, at its specificity) and no invisible slop is left', () => {
  const phone = mediaBody(MOBILE_POLISH_SHADOW, /@media \(max-width: 767px\) and \(pointer: coarse\)/);
  expect(phone, 'the phone + coarse block').not.toBe('');
  expect(rule(phone, ":host(sw-button:not([size='sm']):not([size='lg'])) button")).toContain('min-block-size: max(44px, var(--sw-ctl-h-md))');
  expect(rule(phone, ":host(sw-button[size='sm']) button")).toContain('min-block-size: max(44px, var(--sw-ctl-h-sm))');
  expect(rule(phone, ":host(sw-button[size='lg']) button")).toContain('min-block-size: max(44px, var(--sw-ctl-h-lg))');
  expect(rule(phone, ":host(sw-button[icononly][size='sm']) button")).toContain('inline-size: max(44px, var(--sw-ctl-h-sm))');
  expect(MOBILE_POLISH_SHADOW, 'the invisible hit slop is gone').not.toContain(':host(sw-button) button::after');
});
