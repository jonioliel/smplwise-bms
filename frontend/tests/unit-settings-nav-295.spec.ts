import { test, expect } from '@playwright/test';
import { SETTINGS_NAVS, SETTINGS_NAV_DEFAULT, asSettingsNav, ownSettingsNav, settingsNavOf } from '../src/shell/tabs-mode';
import { settingsNavStrings } from '../src/screens/settings-nav-strings';

// PHONENAV-295 (owner 2026-10-21): the personal "settings navigation on phones" preference (`ui.dd_settings_nav`: tabs | dropdown, default tabs)
// as plain data. No browser page; runs in every project. Backend twin: services/user_prefs.py (tests/test_settings_nav_pref.py).

test.describe('settings navigation on phones (pure)', () => {
  test('the closed list and the default match the backend twin', () => {
    expect(SETTINGS_NAVS).toEqual(['tabs', 'dropdown']);
    expect(SETTINGS_NAV_DEFAULT).toBe('tabs');
  });

  test('asSettingsNav accepts exactly the two strings', () => {
    for (const m of SETTINGS_NAVS) expect(asSettingsNav(m)).toBe(m);
    for (const bad of ['', 'Tabs', 'list', ' tabs', 1, null, undefined, {}, ['tabs']]) expect(asSettingsNav(bad)).toBeNull();
  });

  test('with no own choice the user gets the tab row', () => {
    expect(ownSettingsNav()).toBeNull();
    expect(settingsNavOf()).toBe('tabs');
  });

  test('he / en / ar / ru label the card and both options, with no hint paragraph', () => {
    const seen = new Set<string>();
    for (const lang of ['he', 'en', 'ar', 'ru']) {
      const s = settingsNavStrings(lang);
      expect(s.title.length).toBeGreaterThan(0);
      for (const m of SETTINGS_NAVS) expect(s.options[m].length).toBeGreaterThan(0);
      expect(s.saved.length).toBeGreaterThan(0);
      expect(Object.keys(s).sort()).toEqual(['options', 'saved', 'title']);
      seen.add(s.title);
    }
    expect(seen.size).toBe(4);
    expect(settingsNavStrings('fr').title).toBe(settingsNavStrings('he').title);
  });

  test('no Home Assistant wording in any language', () => {
    for (const lang of ['he', 'en', 'ar', 'ru']) {
      expect(JSON.stringify(settingsNavStrings(lang))).not.toMatch(/home assistant|ingress|\bHA\b/i);
    }
  });
});
