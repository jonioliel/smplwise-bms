import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SW_MARK_INNER, SW_SMPL_GREY, swMarkSvg, swWordSvg } from '../src/design/sw-logo-art';

// NOTICEPUSH-295 slice L: the string artwork of the notice-board TV is the same drawing as the app shell's <sw-brand> (LOGOFIT-295),
// in the approved mockup's colours, and no surface that this slice moved still points at the mint PNG.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf-8');

test('the TV artwork is the same tile / S / dot as sw-brand.ts', () => {
  const brand = read('components/sw-brand.ts');
  for (const piece of SW_MARK_INNER.match(/<[^>]+\/>/g) ?? []) expect(brand).toContain(piece);
  expect(SW_MARK_INNER).toContain('fill="#2767ed"');
  expect(SW_MARK_INNER).toContain('#8fe1ff');
});

test('light surface: Smpl grey and Wise #2767ed; dark surface: Smpl white and Wise #8fb2ff', () => {
  const light = swWordSvg(false);
  expect(light).toContain('data-brand-art="mockup-v3-word"');
  expect(light).toContain(`fill="${SW_SMPL_GREY}">Smpl<tspan fill="#2767ed">Wise</tspan>`);
  const dark = swWordSvg(true);
  expect(dark).toContain('data-brand-art="mockup-v3-word-dark"');
  expect(dark).toContain('fill="#ffffff">Smpl<tspan fill="#8fb2ff">Wise</tspan>');
  expect(light).toContain('font-family="Heebo');
  expect(swMarkSvg()).toContain('data-brand-art="mockup-v3-mark"');
});

test('an alt text makes the drawing an image; none makes it decorative', () => {
  expect(swWordSvg(false, 'SmplWise')).toContain('role="img" aria-label="SmplWise"');
  expect(swWordSvg(false)).toContain('aria-hidden="true"');
});

test('the moved surfaces no longer reference the mint PNG', () => {
  expect(read('notice-tv/main.ts')).not.toMatch(/smplwise-logo\.png|smplwise-mark\.png/);
  expect(read('screens/kiosk-wall.ts')).not.toMatch(/smplwise-logo\.png|smplwise-mark\.png/);
  expect(fs.readFileSync(path.join(SRC, '../index.html'), 'utf-8')).toContain('smplwise-mark.svg');
  expect(fs.readFileSync(path.join(SRC, '../notice-tv.html'), 'utf-8')).not.toContain('id="sw-word"');
});
