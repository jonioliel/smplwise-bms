import { test, expect } from '@playwright/test';
import { EMPTY_BRAND, EMPTY_INSTALLER, brandFromView, installerFromView } from '../src/design/brand-logo';

// WHITELABEL097-295: the pure rules of the installer (white-label) profile on the client - off unless the server says on, preset accents
// only, file names only in the stamped form. Run: npx playwright test tests/unit-white-label.spec.ts --project=desktop

const F = 'aaaaaaaaaaaaaaaa.png';

test('off by default: nothing of the profile is read', () => {
  expect(EMPTY_BRAND.wl).toEqual(EMPTY_INSTALLER);
  expect(EMPTY_INSTALLER.enabled).toBe(false);
  expect(installerFromView(undefined)).toEqual(EMPTY_INSTALLER);
  expect(installerFromView({ enabled: false })).toEqual(EMPTY_INSTALLER);
  // a disabled block that still carries data (a bug on the server) is ignored: the switch is the only authority
  expect(installerFromView({ enabled: false, name: 'x', contact: 'y', accent: 'teal', logo_file: { light: F, dark: null } })).toEqual(EMPTY_INSTALLER);
});

test('enabled: name, contact, preset accent and stamped logo files', () => {
  const w = installerFromView({ enabled: true, name: 'מתקין', contact: '03-1234567', accent: 'purple', logo_file: { light: F, dark: null } });
  expect(w).toEqual({ enabled: true, name: 'מתקין', contact: '03-1234567', accent: 'purple', files: { light: F, dark: null } });
});

test('a free colour or an unknown accent reads as default; a file name that is not a stamp is dropped', () => {
  expect(installerFromView({ enabled: true, accent: '#ff0000' }).accent).toBe('default');
  expect(installerFromView({ enabled: true, accent: 'neon' }).accent).toBe('default');
  expect(installerFromView({ enabled: true, logo_file: { light: '../x.png', dark: 'javascript:alert(1)' } }).files).toEqual({ light: null, dark: null });
});

test('brandFromView: a view without the installer key keeps the base; an explicit off clears it', () => {
  const on = brandFromView({ installer: { enabled: true, name: 'מתקין', logo_file: { light: F, dark: null } } });
  expect(on.wl.enabled).toBe(true);
  expect(brandFromView({ size: 'l' }, on).wl).toEqual(on.wl);
  expect(brandFromView({ installer: { enabled: false } }, on).wl).toEqual(EMPTY_INSTALLER);
  expect(brandFromView(null, on)).toBe(on);
});
