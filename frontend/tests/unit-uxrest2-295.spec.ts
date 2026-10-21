import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settledPhase } from '../src/screens/wiskey-embed-phase';
import { secondaryIdentity } from '../src/screens/user-identity';
import { WET_DEV_MARKED, WET_KEYS, WET_TABLES, wet } from '../src/i18n/wiskey-embed';
import { HWF_DEV_MARKED, HWF_KEYS, HWF_TABLES, hwf } from '../src/i18n/home-widget-failure';

// UXREST2-295: the leftovers of the 2026-10-20 UX audit (16 users list, 17 WisKey loading, 19 home widget failures).
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('16: the sign-in name is printed once when it repeats the display name', () => {
  expect(secondaryIdentity('u7', 'u7')).toBe('');
  expect(secondaryIdentity('Dana@Example.com', 'dana@example.com')).toBe(''); // case-insensitive, an e-mail used as both
  expect(secondaryIdentity('  רונית ', 'ronit')).toBe('ronit');
  expect(secondaryIdentity('', 'u7')).toBe('u7'); // no display name: the username is the only line, and it is the name's own fallback
  expect(secondaryIdentity('u7', '', 'u7')).toBe(''); // empty username, the id repeats the name
  expect(secondaryIdentity('Dana', '', 'id-9')).toBe('id-9');
  expect(secondaryIdentity(null, null, null)).toBe('');
});

test('16: both users lists use the helper', () => {
  expect(src('screens/system-access.ts')).toContain('secondaryIdentity(String(r.name)');
  const local = src('screens/system-local-users.ts');
  expect(local.match(/secondaryIdentity\(/g)?.length).toBe(2);
});

test('17: the WisKey loading and timeout words exist in every column; ar / ru stay dev-marked', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of WET_KEYS) expect(WET_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  expect([...WET_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(wet('unreachableTitle', 'he')).toBe('לא ניתן לטעון את WisKey'); // the heading the existing evidence spec asserts
  expect(wet('retry', 'en')).toBe('Try again');
});

test('17: a frame that loaded but never leaves "loading" ends in the timeout state; every other state is left alone', () => {
  expect(settledPhase('loading', 'pending')).toBe('unreachable');
  for (const phase of ['waiting', 'ready', 'login_required', 'not_installed', 'unreachable', 'blocked', 'unsupported'] as const) expect(settledPhase(phase, 'pending')).toBe(phase);
  for (const mode of ['legacy', 'v1', 'unsupported']) expect(settledPhase('loading', mode)).toBe('loading');
});

test('17: the screen arms the settle timer after a load and the loading overlay has no hint paragraph', () => {
  const s = src('screens/wiskey-embed.ts');
  expect(s).toContain('this.startSettleTimer();');
  expect(s).toMatch(/state="loading" heading=\$\{wet\('loading'\)\}><\/sw-state-panel>/);
  expect(s).toContain("heading: wet('unreachableTitle'), hint: wet('unreachableHint')");
});

test('19: the widget failure words exist in every column; ar / ru stay dev-marked', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of HWF_KEYS) expect(HWF_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  expect([...HWF_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(hwf('retry', 'he')).toBe('נסו שוב');
});

test('19: a failed widget read keeps the other widgets and the last data; the failure panel is the shared state panel', () => {
  const w = src('screens/home-widgets.ts');
  expect(w).toContain('<sw-state-panel compact state="error"');
  expect(w).toContain("this.mediaFailed = true; // the previous screens and speakers stay");
  const b = src('screens/devices-building.ts');
  expect(b).toContain("this.setWidgetFailed('elevators'");
  expect(b).toContain("this.setWidgetFailed('temperature'");
  expect(b).toContain("this.setWidgetFailed('generators'");
  expect(b).toContain('this.elevators = r ? r.elevators : (this.elevators ?? [])');
  expect(src('generator/access.ts')).toContain('export async function loadHomeGeneratorsChecked');
});
