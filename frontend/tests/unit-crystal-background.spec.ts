import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKGROUND_MODES, BACKGROUND_SLOTS, BUILTIN_BACKGROUNDS, isBackgroundMode, normalizeImages, resolveBackground } from '../src/design/background';
import { SKINS } from '../src/design/skins';
import { ruleCount } from '../src/design/css';
import { he } from '../src/i18n/he';
import { en } from '../src/i18n/en';

// CRY (2026-10-10): the Crystal skin's background layer. Node only: the resolver is pure, the assets are files on disk.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 250 * 1024;

test('the built-in day / night pair ships as small WebP files with their SVG sources, each original and under 250 KB', () => {
  for (const slot of BACKGROUND_SLOTS) {
    const webp = path.join(ROOT, 'public', BUILTIN_BACKGROUNDS[slot]);
    expect(fs.existsSync(webp), webp).toBe(true);
    const bytes = fs.statSync(webp).size;
    expect(bytes, `${slot} size`).toBeLessThanOrEqual(LIMIT);
    expect(fs.readFileSync(webp).subarray(8, 12).toString('ascii')).toBe('WEBP');
    const svg = fs.readFileSync(path.join(ROOT, 'src/design/backgrounds', `crystal-${slot}.svg`), 'utf8');
    expect(svg).toContain('original artwork drawn in code');
    expect(svg).not.toMatch(/<image\b|xlink:href|data:image/); // no embedded raster, no third-party picture
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(LIMIT);
  }
});

test('resolution: builtin follows the scheme, none paints nothing, custom takes the slot, then the other slot, then the built-in pair', () => {
  const none = { day: null, night: null };
  expect(resolveBackground('builtin', 'light', none)).toBe(BUILTIN_BACKGROUNDS.day);
  expect(resolveBackground('builtin', 'dark', none)).toBe(BUILTIN_BACKGROUNDS.night);
  expect(resolveBackground('none', 'light', { day: 'a', night: 'b' })).toBeNull();
  expect(resolveBackground('custom', 'light', none)).toBe(BUILTIN_BACKGROUNDS.day);
  expect(resolveBackground('custom', 'dark', { day: '2026-10-10T10:00:00Z', night: null })).toContain('settings/background/day?v=2026-10-10T10%3A00%3A00Z');
  expect(resolveBackground('custom', 'dark', { day: 'x', night: 'y' })).toContain('settings/background/night?v=y');
  expect(resolveBackground('custom', 'light', { day: 'x', night: 'y' })).toContain('settings/background/day?v=x');
});

test('the modes and the stamps are validated the way the backend validates them; the labels exist in Hebrew and English', () => {
  expect([...BACKGROUND_MODES]).toEqual(['builtin', 'none', 'custom']);
  for (const m of BACKGROUND_MODES) expect(isBackgroundMode(m)).toBe(true);
  for (const bad of ['photo', '', 'Builtin', 3, null, undefined]) expect(isBackgroundMode(bad), String(bad)).toBe(false);
  expect(normalizeImages({ day: ' s1 ', night: '', other: 'z' })).toEqual({ day: 's1', night: null });
  expect(normalizeImages('nope')).toEqual({ day: null, night: null });
  expect(normalizeImages(null)).toEqual({ day: null, night: null });
  for (const k of Object.keys(he.background)) expect((en.background as Record<string, string>)[k], `en background.${k}`).toBeTruthy();
});

test('the crystal skin is registered with both names, paints the artwork under its veil, keeps its rule budget and gives every translucent layer a solid twin', () => {
  const s = SKINS.crystal;
  expect(s.name).toBe('Crystal');
  expect(s.nameHe.length).toBeGreaterThan(0);
  expect(ruleCount(s.rules)).toBeLessThanOrEqual(50);
  expect(s.rules).toContain('linear-gradient(var(--sw-bg-veil), var(--sw-bg-veil)), var(--sw-bg-image) center / cover no-repeat, var(--sw-canvas)');
  expect(s.rules).toContain('@supports not ((backdrop-filter: blur(1px))');
  expect(s.rules).toContain('prefers-reduced-transparency: reduce');
  // the scrolling panels (cards, tiles, widgets) wrap their blur and fill in the performance switches; the chrome keeps the nav blur
  expect(s.rules).toMatch(/:host\(sw-card\)[^{]*\{[^}]*backdrop-filter: var\(--sw-perf-blur, var\(--sw-glass-blur\)\)/);
  expect(s.rules).toMatch(/:host\(sw-card\)[^{]*\{[^}]*var\(--sw-perf-glass-bg, var\(--sw-surface\)\)/);
  // the tree stays prominent: its own panel rule, pill rows, a filled selected row
  expect(s.rules).toContain(':host(devices-building) .tree-row.selected');
  expect(s.tokens['--sw-bg-veil'].light).not.toBe(s.tokens['--sw-bg-veil'].dark);
});
