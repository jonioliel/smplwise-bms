import { test, expect } from '@playwright/test';
import { SP_KEYS, SP_TABLES, spt } from '../src/i18n/security-public';
import { leftText, leftTone, parseCap, parseRetention, sortPending, ticketText, waitText } from '../src/access-external/pending-model';
import { SECURITY_PUBLIC_HREF, SECURITY_SETTINGS_TABS, isNvrHref, tabAllowed, visibleTabs, type Can } from '../src/shell/nav';
import { SETTINGS_GROUPS } from '../src/screens/system-index';
import type { PendingRow } from '../src/api/access-grants';

// SECFIX2-295 (owner decisions 2026-10-21): the public-interface settings page and the undecided-technicians panel - the words, the
// pure logic and the navigation entry. Node-only:  npx playwright test tests/unit-security-public.spec.ts --project=desktop

const row = (over: Partial<PendingRow>): PendingRow => ({ contact_id: 'c', name: 'Avi', vendor: 'Vendor', ticket_number: null, since: '2026-10-01T00:00:00Z', days: 0, days_left: 90, ...over });

test('every key exists in he / en / ar / ru, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of SP_KEYS) {
      const v = SP_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(SP_TABLES.he[k]));
    }
  }
});

test('the words never name the home platform', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of SP_KEYS) expect(/home assistant|\bHA\b|ingress|companion/i.test(SP_TABLES[lang][k]), `${lang}.${k}`).toBe(false);
  }
});

test('waiting and countdown texts', () => {
  expect(waitText(row({ days: 0 }), 'en')).toBe('Waiting since today');
  expect(waitText(row({ days: 12 }), 'en')).toBe('Waiting 12 days');
  expect(leftText(row({ days_left: 78 }), 'en')).toBe('Deleted in 78 days');
  expect(leftText(row({ days_left: 0 }), 'en')).toBe('Deleted today');
  expect(leftText(row({ days_left: null }), 'en')).toBe('No automatic deletion');
  expect(spt('pendLeft', { n: 5 }, 'he')).toContain('5');
});

test('countdown tone: err at 7 days or less, warn at 30 or less, off otherwise or without retention', () => {
  expect(leftTone(row({ days_left: 7 }))).toBe('err');
  expect(leftTone(row({ days_left: 30 }))).toBe('warn');
  expect(leftTone(row({ days_left: 31 }))).toBe('off');
  expect(leftTone(row({ days_left: null }))).toBe('off');
});

test('closest to deletion first, then the longest waiting; no countdown goes last', () => {
  const rows = [row({ contact_id: 'a', days_left: 50, days: 40 }), row({ contact_id: 'b', days_left: 5, days: 85 }), row({ contact_id: 'c', days_left: null, days: 200 }),
    row({ contact_id: 'd', days_left: 50, days: 41 })];
  expect(sortPending(rows).map((r) => r.contact_id)).toEqual(['b', 'd', 'a', 'c']);
});

test('the ticket reference is text only and absent without a number (tickets module off)', () => {
  expect(ticketText(row({ ticket_number: 1042 }), 'en')).toBe('Request 1042');
  expect(ticketText(row({ ticket_number: null }), 'en')).toBe('');
});

test('the fields: retention 0 or 7-365, cap 0-100, whole numbers only', () => {
  for (const [raw, v] of [['0', 0], ['7', 7], ['90', 90], ['365', 365], [' 30 ', 30]] as const) expect(parseRetention(raw)).toBe(v);
  for (const raw of ['1', '6', '366', '-1', '9.5', '', 'abc', '1e2']) expect(parseRetention(raw), raw).toBeNull();
  for (const [raw, v] of [['0', 0], ['10', 10], ['100', 100]] as const) expect(parseCap(raw)).toBe(v);
  for (const raw of ['101', '-3', '', '2.5']) expect(parseCap(raw), raw).toBeNull();
});

test('the tab: under Settings > Security, system administrators at installation scope, never hidden as an NVR page', () => {
  const t = SECURITY_SETTINGS_TABS.find((x) => x.id === 'public');
  expect(t).toMatchObject({ href: SECURITY_PUBLIC_HREF });
  expect(SECURITY_PUBLIC_HREF).toBe('#/system/security/public');
  const only = (...perms: string[]): Can => (p) => perms.includes(p);
  expect(tabAllowed(SECURITY_PUBLIC_HREF, only('system.configure'))).toBe(true);
  expect(tabAllowed(SECURITY_PUBLIC_HREF, only('alarm.view', 'sources.configure'))).toBe(false);
  const siteOnly: Can = (p, installationOnly) => p === 'system.configure' && !installationOnly;
  expect(tabAllowed(SECURITY_PUBLIC_HREF, siteOnly)).toBe(false);
  expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('system.configure')).map((x) => x.id)).toContain('public');
  expect(isNvrHref(SECURITY_PUBLIC_HREF)).toBe(false);
  expect(SETTINGS_GROUPS.flatMap((g) => g.entries).some((e) => e.href === SECURITY_PUBLIC_HREF && e.sub)).toBe(true);
});
