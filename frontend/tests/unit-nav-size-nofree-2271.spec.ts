import { test, expect } from '@playwright/test';
import { NAV_DEFAULT, navSize, nearestPreset, normalizeNavSize, setInstallationNavSize, usableNavSize } from '../src/shell/nav-size';

// HOME-NAV-2271 (owner decision 2026-10-27, question 7: home direction A, personal, no free mode): the UI offers the four
// presets only. A stored free value (the backend still accepts the shape) must keep working: it is shown as the nearest preset.

test.describe('navigation size without the free mode', () => {
  test('a preset passes through unchanged', () => {
    expect(usableNavSize({ mode: 'rel', preset: 'xl' })).toEqual({ mode: 'rel', preset: 'xl' });
  });

  test('a stored free value falls back to the preset nearest its icon size', () => {
    const free = (icon: number) => ({ mode: 'free', icon, label: 12, item: 60 });
    expect(usableNavSize(free(14))).toEqual({ mode: 'rel', preset: 's' });
    expect(usableNavSize(free(20))).toEqual({ mode: 'rel', preset: 'm' });
    expect(usableNavSize(free(26))).toEqual({ mode: 'rel', preset: 'l' });
    expect(usableNavSize(free(40))).toEqual({ mode: 'rel', preset: 'xl' });
    // labels off is still a valid stored value and still falls back
    expect(usableNavSize({ mode: 'free', icon: 25, label: 0, item: 96 })).toEqual({ mode: 'rel', preset: 'l' });
  });

  test('garbage stays null (the caller keeps the default); the wire validator still accepts the free shape', () => {
    expect(usableNavSize(null)).toBeNull();
    expect(usableNavSize({ mode: 'free', icon: 99, label: 12, item: 60 })).toBeNull();
    expect(usableNavSize({ mode: 'rel', preset: 'xxl' })).toBeNull();
    expect(normalizeNavSize({ mode: 'free', icon: 26, label: 12, item: 60 })).toEqual({ mode: 'free', icon: 26, label: 12, item: 60 });
  });

  test('nearestPreset of a preset is itself', () => {
    expect(nearestPreset({ mode: 'rel', preset: 'l' })).toBe('l');
  });

  test('an installation default saved as free is applied as a preset; an invalid one falls to the built-in default', () => {
    setInstallationNavSize({ mode: 'free', icon: 30, label: 13, item: 70 });
    expect(navSize()).toEqual({ mode: 'rel', preset: 'xl' });
    setInstallationNavSize('nonsense');
    expect(navSize()).toEqual(NAV_DEFAULT);
  });
});
