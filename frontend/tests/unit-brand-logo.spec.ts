import { test, expect } from '@playwright/test';
import { LOGO_SCALE, brandFromView, chooseCompanyLogo, composeTitle, EMPTY_BRAND, companyScale, type DarkMode } from '../src/design/brand-logo';

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
  expect(s).toEqual({ companyName: 'נווה', kind: 'management', files: { light: L, dark: null }, size: 'xl', logoSide: 'start', companySize: 'same', darkMode: 'file', titlePrefix: 'Arx', titleMode: 'dev', projectName: 'P',
    // WL: the server block now carries the white-label object; this server block has none, so it reads as the disabled default
    wl: { enabled: false, name: '', contact: '', accent: 'default', files: { light: null, dark: null } } });
  const bad = brandFromView({ company: { name: 'x', kind: 'nope' as never, logo: { light: null, dark: null }, logo_file: { light: '../../etc/passwd', dark: 'x.png' } }, size: 'huge' as never, dark_mode: 'neon' as never, title: { prefix: '   ', mode: 'none' as never } });
  expect(bad.kind).toBe('developer');
  expect(bad.files).toEqual({ light: null, dark: null });
  expect(bad.size).toBe('m');
  expect(bad.darkMode).toBe('invert'); // HOME-295 (owner answers round 2, item 12): the default on dark is invert
  expect(bad.titlePrefix).toBe(EMPTY_BRAND.titlePrefix);
  expect(bad.titleMode).toBe('both');
  expect(brandFromView(null)).toEqual(EMPTY_BRAND);
});

// LOGOSIDE-295: the side of the developer / installer logos and their own size scale
test('logo side: start (the right in RTL) is the default; only start | end are accepted, anything else reads as the default or the last known', () => {
  expect(EMPTY_BRAND.logoSide).toBe('start');
  expect(brandFromView({ logo_side: 'end' }).logoSide).toBe('end');
  expect(brandFromView({ logo_side: 'start' }, { ...EMPTY_BRAND, logoSide: 'end' }).logoSide).toBe('start');
  expect(brandFromView({ logo_side: 'left' as never }).logoSide).toBe('start');
  expect(brandFromView({ logo_side: 'left' as never }, { ...EMPTY_BRAND, logoSide: 'end' }).logoSide).toBe('end');
  expect(brandFromView({ size: 'l' }).logoSide).toBe('start'); // a block without the field keeps the default
});

test('company logo size: "same" follows the general scale; s | m | l | xl give the company / installer logos their own; unknown reads as same', () => {
  expect(EMPTY_BRAND.companySize).toBe('same');
  expect(brandFromView({ company_logo_size: 'xl' }).companySize).toBe('xl');
  expect(brandFromView({ company_logo_size: 'huge' as never }).companySize).toBe('same');
  expect(companyScale('l', 'same')).toBe(LOGO_SCALE.l); // follows
  expect(companyScale('l', 's')).toBe(LOGO_SCALE.s); // its own scale replaces the general one, it does not multiply it
  expect(companyScale('s', 'xl')).toBe(LOGO_SCALE.xl);
  expect(companyScale('m', 'same')).toBe(1);
});
