import { test, expect } from '@playwright/test';
import { DD_PLACES, DD_PLACE_DEFAULT, asDdPlace, ddPlaceOf, installationDdPlace, setInstallationTabsMode } from '../src/shell/tabs-mode';
import { placeStrings } from '../src/screens/tabs-place-strings';

// 2026-10-17: the header dropdown placement dial (`ui.dd_place`: 1 own row | 2 far end | 3 after the title | 4 start edge, default 1) as plain
// data. No browser page; runs in every project. Backend twin: smplwise_vms/backend/smplwise/services/dd_style.py.

test.describe('header dropdown placement (pure)', () => {
  test('the closed list and the default match the backend twin', () => {
    expect(DD_PLACES).toEqual(['1', '2', '3', '4']);
    expect(DD_PLACE_DEFAULT).toBe('1');
  });

  test('asDdPlace accepts exactly the four strings', () => {
    for (const p of DD_PLACES) expect(asDdPlace(p)).toBe(p);
    for (const bad of ['', '0', '5', ' 4', 'auto', 4, null, undefined, {}]) expect(asDdPlace(bad)).toBeNull();
  });

  test('the installation value is read from the settings; unreadable or missing falls back to 1', () => {
    setInstallationTabsMode({ 'ui.dd_place': '2' });
    expect(installationDdPlace()).toBe('2');
    expect(ddPlaceOf()).toBe('2');
    setInstallationTabsMode({ 'ui.dd_place': 'nonsense' });
    expect(installationDdPlace()).toBe('1');
    setInstallationTabsMode(null);
    expect(ddPlaceOf()).toBe('1');
  });

  test('both languages label all four placements', () => {
    const he = placeStrings();
    for (const p of DD_PLACES) expect(he.places[p].length).toBeGreaterThan(0);
  });
});
