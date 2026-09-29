import { test, expect } from '@playwright/test';
import { baseOf, inScope, isIngressScope, resolveDeepLink } from '../src/pwa/deeplink';

// CR-008 P3: a notification click lands under the app's own base - the HA Ingress prefix today, /arx/ on the remote
// channel - and only on an in-app hash route. Node only (the same module the service worker inlines).

const INGRESS = 'https://ha.example.test/api/hassio_ingress/AbC123-token_x/';
const REMOTE = 'https://ha.example.test/arx/';

test('deep links resolve under the base the worker is registered for', () => {
  expect(resolveDeepLink(REMOTE, '#/investigate/events/ev42')).toBe('https://ha.example.test/arx/#/investigate/events/ev42');
  expect(resolveDeepLink(INGRESS, '#/investigate/events/ev42')).toBe(`${INGRESS}#/investigate/events/ev42`);
  expect(resolveDeepLink('http://127.0.0.1:4173/', '#/system/notifications')).toBe('http://127.0.0.1:4173/#/system/notifications');
  expect(resolveDeepLink(`${REMOTE}?design=a#/live`, '#/investigate/events')).toBe(`${REMOTE}#/investigate/events`);
});

test('anything but an in-app hash route opens the app base', () => {
  for (const bad of ['https://evil.example/', '//evil.example/x', 'javascript:alert(1)', '/api/v1/me', '../../', '#//evil.example', '#/x"><script>', '', null, 42, { url: '#/x' }]) {
    expect(resolveDeepLink(REMOTE, bad), String(bad)).toBe(REMOTE);
  }
  expect(resolveDeepLink(REMOTE, `#/${'a'.repeat(400)}`)).toBe(REMOTE);
});

test('channel and scope helpers', () => {
  expect(isIngressScope(INGRESS)).toBe(true);
  expect(isIngressScope(REMOTE)).toBe(false);
  expect(baseOf(`${REMOTE}#/live`)).toBe(REMOTE);
  expect(inScope(REMOTE, 'https://ha.example.test/arx/#/live')).toBe(true);
  expect(inScope(REMOTE, 'https://ha.example.test/lovelace/0')).toBe(false);
  expect(inScope(INGRESS, 'https://ha.example.test/api/hassio_ingress/other/')).toBe(false);
});
