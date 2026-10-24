import { test, expect } from '@playwright/test';
import { LOGO_SCALE, brandFromView, chooseCompanyLogo, composeTitle, EMPTY_BRAND, type DarkMode } from '../src/design/brand-logo';

// CR-LOGOS295: the pure rules of the logo placements - size scale, which file a surface draws and on what, the tab-title composition.
//   npx playwright test tests/unit-brand-logo.spec.ts --project=desktop

const L = 'aaaaaaaaaaaaaaaa.png';
const D = 'bbbbbbbbbbbbbbbb.svg';
const MODES: DarkMode[] = ['plate', 'file', 'invert'];

test('size scale: small / medium / large / very large = 0.75 / 1 / 1.25 / 1.5', () => {
  expect(LOGO_SCALE).toEqual({ s: 0.75, m: 1, l: 1.25, xl: 1.5 });
});

test('no company logo: nothing is drawn, whatever the scheme and the mode', () => {
  for (const m of MODES) for (const dark of [false, true]) expect(chooseCompanyLogo({ light: null, dark: null }, m, dark)).toBeNull();
});

test('light surface: the light file as uploaded, never the dark file, never a plate or a filter', () => {
  for (const m of MODES) {
    expect(chooseCompanyLogo({ light: L, dark: null }, m, false)).toEqual({ variant: 'light', treatment: 'plain', file: L });
    expect(chooseCompanyLogo({ light: L, dark: D }, m, false)).toEqual({ variant: 'light', treatment: 'plain', file: L });
  }
});

test('dark surface x dark mode x dark file matrix', () => {
  // plate (default): the light file on a light plate - even when a dark file exists
  expect(chooseCompanyLogo({ light: L, dark: null }, 'plate', true)).toEqual({ variant: 'light', treatment: 'plate', file: L });
  expect(chooseCompanyLogo({ light: L, dark: D }, 'plate', true)).toEqual({ variant: 'light', treatment: 'plate', file: L });
  // file: the dark file when there is one; without it the plate (a dark surface never shows an empty slot)
  expect(chooseCompanyLogo({ light: L, dark: D }, 'file', true)).toEqual({ variant: 'dark', treatment: 'plain', file: D });
  expect(chooseCompanyLogo({ light: L, dark: null }, 'file', true)).toEqual({ variant: 'light', treatment: 'plate', file: L });
  // invert: the light file with the administrator-chosen filter
  expect(chooseCompanyLogo({ light: L, dark: null }, 'invert', true)).toEqual({ variant: 'light', treatment: 'invert', file: L });
});

test('only a dark file exists: it is drawn on a DARK plate on a light surface and plain on a dark one in file mode', () => {
  expect(chooseCompanyLogo({ light: null, dark: D }, 'plate', false)).toEqual({ variant: 'dark', treatment: 'darkplate', file: D });
  expect(chooseCompanyLogo({ light: null, dark: D }, 'file', true)).toEqual({ variant: 'dark', treatment: 'plain', file: D });
});

test('title: prefix - developer · project, each name in first-strong isolates', () => {
  const iso = (s: string) => `⁨${s}⁩`;
  expect(composeTitle('Smplwise Arx', 'both', 'נווה הירדן', 'Tower A')).toBe(`Smplwise Arx - ${iso('נווה הירדן')} · ${iso('Tower A')}`);
  expect(composeTitle('Smplwise Arx', 'dev', 'נווה הירדן', 'Tower A')).toBe(`Smplwise Arx - ${iso('נווה הירדן')}`);
  expect(composeTitle('Smplwise Arx', 'project', 'נווה הירדן', 'Tower A')).toBe(`Smplwise Arx - ${iso('Tower A')}`);
});

test('title: empty names are left out; no name at all gives the prefix alone; an empty prefix falls back to the product name', () => {
  expect(composeTitle('Smplwise Arx', 'both', '', 'Tower A')).toBe('Smplwise Arx - ⁨Tower A⁩');
  expect(composeTitle('Smplwise Arx', 'both', '  ', '')).toBe('Smplwise Arx');
  expect(composeTitle('Smplwise Arx', 'project', 'נווה', '')).toBe('Smplwise Arx');
  expect(composeTitle('  ', 'both', 'x', '')).toBe('Smplwise Arx - ⁨x⁩');
});

test('a server block becomes state; anything unknown reads as the default (a corrupt value never reaches the page)', () => {
  const s = brandFromView({ company: { name: 'נווה', kind: 'management', logo: { light: null, dark: null }, logo_file: { light: L, dark: 'not-a-file' } }, size: 'xl', dark_mode: 'file', title: { prefix: 'Arx', mode: 'dev' }, project: { name: 'P' } });
  expect(s).toEqual({ companyName: 'נווה', kind: 'management', files: { light: L, dark: null }, size: 'xl', darkMode: 'file', titlePrefix: 'Arx', titleMode: 'dev', projectName: 'P',
    // WL: the server block now carries the white-label object; this server block has none, so it reads as the disabled default
    wl: { enabled: false, name: '', contact: '', accent: 'default', files: { light: null, dark: null } } });
  const bad = brandFromView({ company: { name: 'x', kind: 'nope' as never, logo: { light: null, dark: null }, logo_file: { light: '../../etc/passwd', dark: 'x.png' } }, size: 'huge' as never, dark_mode: 'neon' as never, title: { prefix: '   ', mode: 'none' as never } });
  expect(bad.kind).toBe('developer');
  expect(bad.files).toEqual({ light: null, dark: null });
  expect(bad.size).toBe('m');
  expect(bad.darkMode).toBe('plate');
  expect(bad.titlePrefix).toBe(EMPTY_BRAND.titlePrefix);
  expect(bad.titleMode).toBe('both');
  expect(brandFromView(null)).toEqual(EMPTY_BRAND);
});
