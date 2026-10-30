import { test, expect } from '@playwright/test';
import { REDUCED_MOTION_ARX, REDUCED_MOTION_DECLS, tokensCss } from '../src/design/css';
import { SKIN_IDS } from '../src/design/skins';

// MOTIONSETTING-297 (owner 2026-10-27): the motion setting `ui.motion` (auto | full | reduced). Node only: the CSS the token layer prints.
// auto = the OS reduction decides (the media query), full = the media query does not apply under <html data-motion="full">,
// reduced = the very same declarations apply always (<html data-motion="reduced">), in every skin.
//   npx playwright test -c playwright.unit.config.ts tests/unit-motionsetting-297.spec.ts

const css = tokensCss();
const lines = css.split('\n');
const mediaLine = lines.find((l) => l.startsWith('@media (prefers-reduced-motion: reduce)')) ?? '';
const reducedLine = lines.find((l) => l.startsWith(':root[data-motion="reduced"]')) ?? '';

test('the OS reduction still applies in auto and is switched off only by data-motion="full"', () => {
  expect(mediaLine).not.toBe('');
  expect(mediaLine).toContain(':root:not([data-motion="full"])');
  expect(mediaLine).toContain(':root[data-skin]:not([data-motion="full"])'); // every skin, light and dark (the declarations are !important)
  // one block (a selector list), not two: nothing else reads the OS query
  expect(mediaLine.match(/\{[^{}]*\}/g)?.length).toBe(1);
});

test('reduced prints the same declarations as the OS reduction, for the bare root and for every skin', () => {
  expect(reducedLine).toContain(':root[data-motion="reduced"],:root[data-skin][data-motion="reduced"]');
  const declsOf = (l: string) => l.slice(l.lastIndexOf('{') + 1, l.lastIndexOf('}'));
  expect(declsOf(reducedLine)).toBe(REDUCED_MOTION_DECLS);
  expect(declsOf(mediaLine.replace(/\}\}$/, '}'))).toBe(REDUCED_MOTION_DECLS);
  // zero durations, no press scale, no rise: the old names and the Arx layer
  for (const n of ['--sw-t-fast', '--sw-t-med', '--sw-t-sheet', '--sw-t-state', '--sw-t-press', '--sw-t-hover', '--sw-spring-toggle-ms', '--sw-stagger', '--sw-enter-ms']) {
    expect(REDUCED_MOTION_DECLS, n).toContain(`${n}:0ms !important;`);
  }
  expect(REDUCED_MOTION_DECLS).toContain('--sw-hover-lift:0px !important;');
  expect(REDUCED_MOTION_DECLS).toContain('--sw-enter-y:0px !important;');
  expect(REDUCED_MOTION_DECLS).toContain('--sw-press-scale:1 !important;');
  expect(REDUCED_MOTION_DECLS).toContain(REDUCED_MOTION_ARX);
});

test('there is no rule for "full" beyond the exclusion, and no skin sets a data-motion rule of its own', () => {
  expect(css.match(/data-motion="full"/g)?.length).toBe(2); // only the two :not() exclusions in the OS block
  expect(css.match(/data-motion="reduced"/g)?.length).toBe(2);
  expect(SKIN_IDS.length).toBeGreaterThan(5); // the registry is read by the same css (tokensCss) - nothing per skin was added for motion
});

// 2.29.0 (owner 2026-10-29): the entrance animation setting `ui.entry_animations` and the all-components reduced-motion sheet.
test('entry animations off prints one rule that zeroes the three entrance tokens, for the root and every skin', () => {
  const line = lines.find((l) => l.startsWith(':root[data-enter="off"]')) ?? '';
  expect(line).toContain(':root[data-skin][data-enter="off"]');
  for (const n of ['--sw-enter-ms:0ms', '--sw-enter-y:0px', '--sw-stagger:0ms']) expect(line, n).toContain(`${n} !important`);
  expect(css.match(/data-enter="off"/g)?.length).toBe(2);
});

test('the shared reduced sheet zeroes literal durations and stops loops from flickering', async () => {
  const { REDUCED_ALL_CSS } = await import('../src/design/apply');
  expect(REDUCED_ALL_CSS).toContain('animation-duration:0.01ms !important');
  expect(REDUCED_ALL_CSS).toContain('transition-duration:0.01ms !important');
  expect(REDUCED_ALL_CSS).toContain('animation-iteration-count:1 !important');
});
