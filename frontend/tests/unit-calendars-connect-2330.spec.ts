import { test, expect } from '@playwright/test';
import { CONN_ERROR_HE, cardOf, connErrorText, serverProviderOf } from '../src/api/calendars';
import { clientIdOk, directionsFor, firstStep, pasteLooksRight } from '../src/calendars/connect-model';

// CALCONNECT-2330: the pure rules of the connect flow of הגדרות › חיבורי יומן. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-calendars-connect-2330.spec.ts

test('both iCal kinds of the server share the iCal card; a new iCal connection is a subscription', () => {
  expect(['ics_in', 'ics_out', 'ical', 'google', 'microsoft'].map((p) => cardOf(p as never))).toEqual(['ical', 'ical', 'ical', 'google', 'microsoft']);
  expect(serverProviderOf('ical')).toBe('ics_in');
  expect(serverProviderOf('google')).toBe('google');
});

test('directions: iCal and read connections only import; a read-write account offers the three', () => {
  expect(directionsFor({ provider: 'ics_in', scope: 'read' })).toEqual(['import']);
  expect(directionsFor({ provider: 'google', scope: 'read' })).toEqual(['import']);
  expect(directionsFor({ provider: 'microsoft', scope: 'read_write' })).toEqual(['export', 'import', 'two_way']);
});

test('the dialog opens on the client until it is saved, then on the approval (also for a re-authorisation)', () => {
  const setup = { client_id_set: true, client_secret_set: true, authorized: false, feed_url_set: false, tenant: null, ready: false, pending_flow: null };
  expect(firstStep('google', null)).toBe('client');
  expect(firstStep('google', { setup: { ...setup, client_id_set: false } })).toBe('client');
  expect(firstStep('google', { setup })).toBe('auth');
  expect(firstStep('microsoft', { setup: { ...setup, authorized: true } })).toBe('auth');
  expect(firstStep('ical', null)).toBe('feed');
});

test('client ids in the providers own formats', () => {
  expect(clientIdOk('google', '1234567890-abc123.apps.googleusercontent.com')).toBe(true);
  expect(clientIdOk('google', ' 1234567890-abc123.apps.googleusercontent.com ')).toBe(true);
  expect(clientIdOk('google', 'abc.apps.googleusercontent.com')).toBe(false);
  expect(clientIdOk('microsoft', '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b')).toBe(true);
  expect(clientIdOk('microsoft', 'not-a-guid')).toBe(false);
  expect(clientIdOk('ical', 'x')).toBe(false);
});

test('only the loopback address with a state and a code (or an error) can be pasted', () => {
  expect(pasteLooksRight('http://127.0.0.1:8749/?state=s1&code=4/abc&scope=x')).toBe(true);
  expect(pasteLooksRight('  http://127.0.0.1:8749/?state=s1&error=access_denied ')).toBe(true);
  expect(pasteLooksRight('http://127.0.0.1:8749/?code=4/abc')).toBe(false);
  expect(pasteLooksRight('https://evil.example/?state=s1&code=x')).toBe(false);
  expect(pasteLooksRight('4/abc')).toBe(false);
});

test('connection statuses in Hebrew: auth expired, quota, rate limit; an unknown code still reads as words', () => {
  expect(connErrorText('auth_expired')).toContain('ההרשאה פגה');
  expect(connErrorText('quota_exceeded')).toContain('המכסה');
  expect(connErrorText('rate_limited')).toContain('מגביל');
  expect(connErrorText('something_new')).toBe('הסנכרון נכשל. ננסה שוב אוטומטית.');
  expect(connErrorText(null)).toBe('');
  for (const v of Object.values(CONN_ERROR_HE)) expect(v).toMatch(/[֐-׿]/);
});
