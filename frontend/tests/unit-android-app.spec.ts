import { test, expect } from '@playwright/test';
import {
  ANDROID_VALUE,
  STORAGE_KEY,
  SWITCH_SERVER_URL,
  detectAndroidApp,
  inAndroidApp,
  inAndroidShell,
  resetAndroidAppForTests,
  shellBridge,
  switchServer,
  withoutAppParam,
} from '../src/arx/android-app';

// CR-008 §9: "inside the Android app" detection - the own-WebView shell's injected `window.ArxApp`, and the
// `?app=android` both Android apps add to the URL they open. Node only (a fake window where one is needed).

function memory(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage & { data: Map<string, string> };
}

type FakeWindow = { ArxApp?: unknown; location: { href: string; search: string }; sessionStorage: Storage };
const g = globalThis as unknown as { window?: FakeWindow; history?: { state: unknown; replaceState: (s: unknown, t: string, u: string) => void } };

function fakeWindow(href: string, arxApp?: unknown): { win: FakeWindow; replaced: string[] } {
  const url = new URL(href);
  const replaced: string[] = [];
  const win: FakeWindow = { ArxApp: arxApp, location: { href, search: url.search }, sessionStorage: memory() };
  g.window = win;
  g.history = { state: null, replaceState: (_s, _t, u) => void replaced.push(u) };
  resetAndroidAppForTests();
  return { win, replaced };
}

test.afterEach(() => {
  delete g.window;
  delete g.history;
  resetAndroidAppForTests();
});

test('the query parameter marks the session and later loads remember it', () => {
  const store = memory();
  expect(detectAndroidApp('?app=android', store)).toBe(true);
  expect(store.data.get(STORAGE_KEY)).toBe(ANDROID_VALUE);
  expect(detectAndroidApp('', store)).toBe(true); // a reload / an in-app navigation without the parameter
  expect(detectAndroidApp('?design=a', store)).toBe(true);
});

test('a plain browser is not the app', () => {
  const store = memory();
  for (const search of ['', '?', '?app=ios', '?app=Android', '?application=android', '?x=app%3Dandroid', '#app=android']) {
    expect(detectAndroidApp(search, store), search).toBe(false);
  }
  expect(store.data.size).toBe(0);
});

test('works without storage (blocked or missing)', () => {
  expect(detectAndroidApp('?app=android', null)).toBe(true);
  expect(detectAndroidApp('', null)).toBe(false);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  expect(detectAndroidApp('?app=android', throwing)).toBe(true);
  expect(detectAndroidApp('', throwing)).toBe(false);
});

test('the parameter is dropped from the address, everything else kept', () => {
  expect(withoutAppParam('https://site.example.com/arx/?app=android')).toBe('https://site.example.com/arx/');
  expect(withoutAppParam('https://site.example.com/arx/?design=a&app=android#/live')).toBe('https://site.example.com/arx/?design=a#/live');
  expect(withoutAppParam('https://site.example.com/arx/?app=other#/x')).toBe('https://site.example.com/arx/?app=other#/x');
  expect(withoutAppParam('https://site.example.com/arx/#/x')).toBe('https://site.example.com/arx/#/x');
});

test("the shell's injected interface is recognised only in its exact shape", () => {
  const ok = { platform: 'android', shell: 'webview', version: '2.0.0', switchServer: () => undefined };
  expect(shellBridge({ ArxApp: ok })).toBe(ok);
  expect(shellBridge({ ArxApp: Object.freeze({ ...ok }) })).not.toBeNull();
  for (const bad of [undefined, null, 'android', 42, {}, { platform: 'ios', switchServer: () => undefined }, { platform: 'android' }, { platform: 'android', switchServer: 'arx://servers' }]) {
    expect(shellBridge({ ArxApp: bad }), JSON.stringify(bad) ?? String(bad)).toBeNull();
  }
  expect(shellBridge(null)).toBeNull();
  expect(shellBridge(undefined)).toBeNull();
});

test('inside the shell: detected without the URL parameter, and "החלף שרת" calls the app', () => {
  let calls = 0;
  const { win, replaced } = fakeWindow('https://site.example.com/arx/#/live', { platform: 'android', shell: 'webview', switchServer: () => void calls++ });
  expect(inAndroidApp()).toBe(true);
  expect(inAndroidShell()).toBe(true);
  expect(replaced).toEqual([]); // nothing to clean
  switchServer();
  expect(calls).toBe(1);
  expect(win.location.href).toBe('https://site.example.com/arx/#/live'); // no navigation
});

test('inside the Trusted Web Activity: the parameter is recorded, removed, and "החלף שרת" navigates to arx://servers', () => {
  const { win, replaced } = fakeWindow('https://site.example.com/arx/?app=android#/live');
  expect(inAndroidApp()).toBe(true);
  expect(inAndroidShell()).toBe(false);
  expect(replaced).toEqual(['https://site.example.com/arx/#/live']);
  expect((win.sessionStorage as unknown as { data: Map<string, string> }).data.get(STORAGE_KEY)).toBe(ANDROID_VALUE);
  switchServer();
  expect(win.location.href).toBe(SWITCH_SERVER_URL);
  expect(SWITCH_SERVER_URL).toBe('arx://servers');
});

test('in a plain browser nothing app-specific shows', () => {
  fakeWindow('https://site.example.com/arx/#/live');
  expect(inAndroidApp()).toBe(false);
  expect(inAndroidShell()).toBe(false);
});
