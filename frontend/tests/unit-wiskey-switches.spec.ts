import { test, expect } from '@playwright/test';
import { WS_KEYS, WS_TABLES, wst } from '../src/i18n/wiskey-switches';
import { ApiError } from '../src/api/client';
import { SWITCH_KEYS, SWITCH_STEM, canTurnOn, refusalKind, stateOf, type SwitchesView } from '../src/api/wiskey-switches';
import { SECURITY_SETTINGS_TABS, SECURITY_WISKEY_HREF, INSTALLATION_ONLY_HREFS, isNvrHref, tabAllowed, visibleTabs, type Can } from '../src/shell/nav';
import { SETTINGS_GROUPS } from '../src/screens/system-index';

// SWITCHUI-295: the access-control read switches screen (#/system/security/wiskey) - the words, the pure rules and the navigation entry.
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-switches.spec.ts

const err = (status: number, code: string) => new ApiError(status, { code, user_message: '', retryable: false, correlation_id: 'x', details: {} });

test('every key exists in he / en / ar / ru, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of WS_KEYS) {
      const v = WS_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(WS_TABLES.he[k]));
    }
  }
});

test('the words never name the home platform, an internal key or a permit key', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of WS_KEYS) {
      const v = WS_TABLES[lang][k];
      expect(/home assistant|\bHA\b|ingress|companion/i.test(v), `${lang}.${k} platform`).toBe(false);
      expect(/acr5|wiskey\./i.test(v), `${lang}.${k} internal key`).toBe(false);
    }
  }
});

test('the four switches: the closed list, each with a plain title and description in every language', () => {
  expect([...SWITCH_KEYS]).toEqual(['wiskey.acr5_access_state', 'wiskey.acr5_normalize_user', 'wiskey.acr5_presence', 'wiskey.acr5_feature_plans']);
  expect(SWITCH_KEYS.every((k) => k.startsWith('wiskey.acr5_') && !/go[_.-]?live|permit/i.test(k))).toBe(true);
  for (const k of SWITCH_KEYS) {
    const stem = SWITCH_STEM[k];
    expect(WS_KEYS).toContain(`${stem}Title`);
    expect(WS_KEYS).toContain(`${stem}Text`);
  }
  expect(new Set(SWITCH_KEYS.map((k) => SWITCH_STEM[k])).size).toBe(4);
});

test('state: a switch the server did not send, or sent as anything but on, reads off', () => {
  const v: SwitchesView = { switches: { 'wiskey.acr5_access_state': 'on', 'wiskey.acr5_presence': 'off' }, go_live_permitted: true };
  expect(stateOf(v, 'wiskey.acr5_access_state')).toBe('on');
  expect(stateOf(v, 'wiskey.acr5_presence')).toBe('off');
  expect(stateOf(v, 'wiskey.acr5_feature_plans')).toBe('off');
  expect(stateOf(null, 'wiskey.acr5_access_state')).toBe('off');
});

test('turning on needs the go-live permit; the answer never carries a way to set one', () => {
  expect(canTurnOn({ go_live_permitted: true })).toBe(true);
  expect(canTurnOn({ go_live_permitted: false })).toBe(false);
  expect(canTurnOn({ go_live_permitted: undefined as unknown as boolean })).toBe(false);
});

test('the closed refusals are told apart: no permit (409), not an administrator (403), invalid (422), anything else', () => {
  expect(refusalKind(err(409, 'wiskey_not_permitted'))).toBe('permit');
  expect(refusalKind(err(409, 'something_else'))).toBe('permit');
  expect(refusalKind(err(403, 'not_system_admin'))).toBe('forbidden');
  expect(refusalKind(err(422, 'unknown_switch'))).toBe('invalid');
  expect(refusalKind(err(422, 'permit_not_writable'))).toBe('invalid');
  expect(refusalKind(err(500, 'boom'))).toBe('other');
  expect(refusalKind(new TypeError('x'))).toBe('other');
  expect(wst('permitRefused', undefined, 'en')).toContain('go-live permit');
  expect(wst('confirmOnQ', { name: 'X' }, 'en')).toBe('Turn on "X"?');
});

test('the tab: under Settings > Security, system administrators at installation scope, never hidden as an NVR page', () => {
  const t = SECURITY_SETTINGS_TABS.find((x) => x.id === 'wiskey');
  expect(t).toMatchObject({ href: SECURITY_WISKEY_HREF });
  expect(SECURITY_WISKEY_HREF).toBe('#/system/security/wiskey');
  expect(INSTALLATION_ONLY_HREFS.has(SECURITY_WISKEY_HREF)).toBe(true);
  const only = (...perms: string[]): Can => (p) => perms.includes(p);
  expect(tabAllowed(SECURITY_WISKEY_HREF, only('system.configure'))).toBe(true);
  expect(tabAllowed(SECURITY_WISKEY_HREF, only('alarm.view', 'sources.configure'))).toBe(false);
  const siteOnly: Can = (p, installationOnly) => p === 'system.configure' && !installationOnly;
  expect(tabAllowed(SECURITY_WISKEY_HREF, siteOnly)).toBe(false);
  expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('system.configure')).map((x) => x.id)).toContain('wiskey');
  expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('alarm.view')).map((x) => x.id)).not.toContain('wiskey');
  expect(isNvrHref(SECURITY_WISKEY_HREF)).toBe(false);
  expect(SETTINGS_GROUPS.flatMap((g) => g.entries).some((e) => e.href === SECURITY_WISKEY_HREF && e.sub)).toBe(true);
});
