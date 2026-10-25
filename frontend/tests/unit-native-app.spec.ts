import { test, expect } from '@playwright/test';
import {
  hasCapability,
  hasFunction,
  holdNativeSession,
  NATIVE_SIGN_OUT_REASONS,
  nativeBridge,
  nativeSignOutReason,
  normalizeDeviceStatus,
  notifyNativeSignedOut,
  readDeviceStatus,
  releaseNativeSession,
  resetNativeSessionForTests,
  syncNativeSession,
} from '../src/arx/native-app';
import { inAndroidApp, resetAndroidAppForTests, shellBridge } from '../src/arx/android-app';
import { deviceRows, lastEventText, locationAuthText, sensorLabel, sensorState } from '../src/arx/native-device-view';

// MOBILE214: native shell detection (Android and iOS), the sign-in hints, and the device card's data. Node only.

type Host = { ArxApp?: unknown; top?: unknown; location?: { href: string; search: string }; sessionStorage?: unknown };
function top(arx?: unknown): Host {
  const w: Host = { ArxApp: arx };
  w.top = w;
  return w;
}
const g = globalThis as unknown as { window?: Host; history?: unknown };

test.afterEach(() => {
  delete g.window;
  delete g.history;
  resetNativeSessionForTests();
  resetAndroidAppForTests();
});

test('both platforms are recognised, other platforms and non-objects are not', () => {
  expect(nativeBridge(top({ platform: 'android' }))?.platform).toBe('android');
  expect(nativeBridge(top({ platform: 'ios' }))?.platform).toBe('ios');
  for (const bad of [{ platform: 'windows' }, { platform: 1 }, {}, null, 'ios', undefined]) expect(nativeBridge(top(bad))).toBeNull();
  expect(nativeBridge(null)).toBeNull();
});

test('a bridge inside a frame is never trusted', () => {
  const frame: Host = { ArxApp: { platform: 'ios' }, top: {} };
  expect(nativeBridge(frame)).toBeNull();
  expect(shellBridge({ ArxApp: { platform: 'android', switchServer() {} }, top: {} })).toBeNull();
});

test('functions and capabilities are feature-detected', () => {
  const b = nativeBridge(top({ platform: 'ios', capabilities: ['location'], deviceStatus() {}, signedIn: 1 }));
  expect(hasFunction(b, 'deviceStatus')).toBe(true);
  expect(hasFunction(b, 'signedIn')).toBe(false);
  expect(hasFunction(b, 'nothing')).toBe(false);
  expect(hasCapability(b, 'location')).toBe(true);
  expect(hasCapability(b, 'push')).toBe(false);
  expect(hasFunction(null, 'x')).toBe(false);
});

test('inside the iOS app the page does not think it is the Android app, even with app=android', () => {
  const w = top({ platform: 'ios' });
  w.location = { href: 'https://arx.example/?app=android', search: '?app=android' };
  const store = new Map<string, string>();
  w.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  g.window = w;
  g.history = { state: null, replaceState() {} };
  resetAndroidAppForTests();
  expect(inAndroidApp()).toBe(false);
});

test('signedIn and signedOut are sent once per change, with the user id as a hint', () => {
  const calls: string[] = [];
  const w = top({
    platform: 'ios',
    signedIn: (a: { user_id: string }) => calls.push(`in:${a.user_id}`),
    signedOut: () => calls.push('out'),
  });
  syncNativeSession('u1', w);
  syncNativeSession('u1', w);
  syncNativeSession('u2', w);
  syncNativeSession(null, w);
  syncNativeSession(null, w);
  expect(calls).toEqual(['in:u1', 'in:u2', 'out']);
});

test('SX-09: signedOut carries a reason from the closed vocabulary; anything else is unknown', () => {
  const got: unknown[] = [];
  const w = top({ platform: 'android', signedIn: () => undefined, signedOut: (...a: unknown[]) => got.push(a) });
  syncNativeSession('u1', w);
  syncNativeSession(null, w, 'expired');
  syncNativeSession('u1', w);
  syncNativeSession(null, w); // no reason given: unknown
  syncNativeSession('u1', w);
  syncNativeSession(null, w, 'weird' as never);
  expect(got).toEqual([[{ reason: 'expired' }], [{ reason: 'unknown' }], [{ reason: 'unknown' }]]);
  expect(NATIVE_SIGN_OUT_REASONS).toEqual(['user', 'expired', 'revoked', 'idle', 'unknown']);
  for (const r of NATIVE_SIGN_OUT_REASONS) expect(nativeSignOutReason(r)).toBe(r);
  for (const bad of ['', 'USER', 'device_removed', null, undefined, 1, {}]) expect(nativeSignOutReason(bad)).toBe('unknown');
});

test('SX-09: a shell that takes no argument still works (an extra argument is ignored; a strict-arity bridge gets the old call)', () => {
  let plain = 0;
  syncNativeSession(null, top({ platform: 'ios', signedOut: () => void plain++ }), 'user');
  expect(plain).toBe(1);
  resetNativeSessionForTests();
  const arity: unknown[][] = [];
  const strict = top({
    platform: 'android',
    signedOut: (...a: unknown[]) => {
      if (a.length) throw new Error('Method not found');
      arity.push(a);
    },
  });
  syncNativeSession(null, strict, 'user');
  expect(arity).toEqual([[]]);
});

test('SX-09: while a sign-out is held nothing reaches the shell; the release sends its own reason once', () => {
  const got: unknown[] = [];
  const w = top({ platform: 'ios', signedIn: () => undefined, signedOut: (a: unknown) => got.push(a) });
  syncNativeSession('u1', w);
  holdNativeSession();
  syncNativeSession(null, w, 'expired'); // a background 401 during the user's sign-out
  notifyNativeSignedOut('expired', w);
  expect(got).toEqual([]);
  releaseNativeSession('user', w);
  notifyNativeSignedOut('expired', w); // the reload path afterwards: already told
  expect(got).toEqual([{ reason: 'user' }]);
});

test('a shell without the functions, a frame, or a throwing shell causes no error and no call', () => {
  syncNativeSession('u1', top({ platform: 'android' }));
  syncNativeSession('u1', { ArxApp: { platform: 'ios', signedIn: () => assertNever() }, top: {} });
  syncNativeSession('u1', top({ platform: 'ios', signedIn: () => { throw new Error('boom'); } }));
  syncNativeSession(null, null);
});
function assertNever(): never {
  throw new Error('must not be called');
}

test('device status: fields are normalised, a string reply is parsed, junk means not registered', () => {
  const d = normalizeDeviceStatus({ registered: true, name: 'Phone', location_auth: 'always', precise: true, last_event_at: '2026-10-23T10:00:00Z', sensors: { steps: 'on', battery: 'off' } });
  expect(d).toEqual({ registered: true, name: 'Phone', location_auth: 'always', precise: true, last_event_at: '2026-10-23T10:00:00Z', sensors: { steps: 'on', battery: 'off' } });
  expect(normalizeDeviceStatus('{"registered":true}').registered).toBe(true);
  expect(normalizeDeviceStatus('not json')).toEqual({ registered: false, name: null, location_auth: null, precise: null, last_event_at: null, sensors: null });
  expect(normalizeDeviceStatus({ registered: 'yes', sensors: [] }).sensors).toBeNull(); // Android has no sensors field
  expect(normalizeDeviceStatus(null).registered).toBe(false);
});

test('readDeviceStatus waits for a promise, accepts a plain value, times out, and is null without the function', async () => {
  expect(await readDeviceStatus(50, top({ platform: 'android' }))).toBeNull();
  const slow = top({ platform: 'ios', deviceStatus: () => new Promise((r) => setTimeout(() => r({ registered: true, name: 'P' }), 20)) });
  expect((await readDeviceStatus(500, slow))?.name).toBe('P');
  expect((await readDeviceStatus(500, top({ platform: 'android', deviceStatus: () => ({ registered: true }) })))?.registered).toBe(true);
  const never = top({ platform: 'ios', deviceStatus: () => new Promise(() => {}) });
  expect((await readDeviceStatus(30, never))?.registered).toBe(false);
  const fails = top({ platform: 'ios', deviceStatus: () => Promise.reject(new Error('x')) });
  expect((await readDeviceStatus(500, fails))?.registered).toBe(false);
});

test('device card rows: Hebrew text, no row detail for an unregistered phone, sensors only when reported', () => {
  const un = deviceRows(normalizeDeviceStatus({ registered: false }));
  expect(un.map((r) => r.key)).toEqual(['status']);
  expect(un[0].value).toBe('לא רשום');
  const rows = deviceRows(normalizeDeviceStatus({ registered: true, name: 'Dana', location_auth: 'when_in_use', precise: false, last_event_at: null, sensors: { steps: 'on', altitude: 'unavailable', other_x: 'weird' } }));
  const by = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  expect(by.status).toBe('רשום');
  expect(by.name).toBe('Dana');
  expect(by.location_auth).toBe('בזמן השימוש');
  expect(by.precise).toBe('לא');
  expect(by.last_event_at).toBe('עדיין לא נשלח');
  expect(by['sensor:steps']).toBe('פעיל');
  expect(by['sensor:altitude']).toBe('לא זמין במכשיר');
  expect(by['sensor:other_x']).toBe('weird');
  const noSensors = deviceRows(normalizeDeviceStatus({ registered: true }));
  expect(noSensors.some((r) => r.key.startsWith('sensor:'))).toBe(false);
  expect(sensorLabel('steps')).toBe('צעדים');
  expect(sensorLabel('zzz')).toBe('zzz');
  expect(sensorState('off')).toBe('כבוי');
  expect(locationAuthText(null)).toBe('לא ידוע');
  expect(locationAuthText('denied')).toBe('נדחתה');
  expect(lastEventText('garbage')).toBe('garbage');
});
