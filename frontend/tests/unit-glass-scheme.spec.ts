import { test, expect } from '@playwright/test';
import { DEVICES_PREFS_DEFAULT, devicesPrefsOf, glassSchemeOf, resolveDevicesScheme, setGlassScheme, currentGlassScheme } from '../src/screens/devices-style';

// 2.4.4 (owner 2026-10-10): `devices.glass_scheme` - the glass screens follow the product's scheme (default), or are always light / dark.
//   npx playwright test tests/unit-glass-scheme.spec.ts --project=desktop

test('the setting reads as follow unless it says light or dark', () => {
  expect(DEVICES_PREFS_DEFAULT.glassScheme).toBe('follow');
  expect(devicesPrefsOf({}).glassScheme).toBe('follow');
  expect(devicesPrefsOf({ 'devices.glass_scheme': 'dark' }).glassScheme).toBe('dark');
  expect(glassSchemeOf('auto')).toBe('follow');
  expect(glassSchemeOf(undefined)).toBe('follow');
  expect(glassSchemeOf('light')).toBe('light');
});

test('a fixed choice wins over devices.scheme; follow keeps the DU1 rule', () => {
  try {
    setGlassScheme('follow');
    // no document here: the product scheme resolves to light, so follow = what devices.scheme says
    expect(resolveDevicesScheme('light')).toBe('light');
    expect(resolveDevicesScheme('dark')).toBe('dark');
    setGlassScheme('light');
    expect(currentGlassScheme()).toBe('light');
    expect(resolveDevicesScheme('dark')).toBe('light');
    setGlassScheme('dark');
    expect(resolveDevicesScheme('light')).toBe('dark');
    expect(resolveDevicesScheme('auto')).toBe('dark');
    setGlassScheme('nonsense');
    expect(currentGlassScheme()).toBe('follow');
  } finally {
    setGlassScheme('follow');
  }
});
