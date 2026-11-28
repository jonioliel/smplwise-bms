import { test, expect } from '@playwright/test';
import { setStepUpHandler } from '../src/api/client';
import { signedPromptText } from '../src/api/device-key-prompt';
import { DEVICE_KEY_CHANGED, DeviceKeyCancelled, DeviceKeyNotKept, deviceKeyEnrolment, deviceKeyStepUp, registerDeviceKey } from '../src/api/factor-screens';
import { approvePushApproval } from '../src/api/push-approval';

// FIX-PHONEKEY-2570 (second deep review 2.57, SA2-01 and SA2-02), Node only: a stubbed fetch, a stubbed `window` with a FAKE Android
// bridge (mobile/android-shell BridgeScript.kt `ArxApp.deviceKey`). Invented ids and payloads only - no key, no secret.
// * SA2-01: the registration of the app's phone key (api/factor-screens.ts registerDeviceKey) - the server challenge, the app's key, the
//   phone's signature, the registration, the app keeping the server's id; and who may register at all (deviceKeyEnrolment).
// * SA2-02: whatever the caller wants shown, the phone is told the words of the SIGNED payload (api/device-key-prompt.ts).
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-phonekey-2570.spec.ts

const ORIGIN = 'https://site.example.com';
const NONCE = 'dkn_' + 'A'.repeat(43);
const payload = (purpose: string, action = '-', key = 'dk_0123456789abcdef01234567', user = 'u-admin') =>
  `arx-device-key|v1|${purpose}|${ORIGIN}|${purpose === 'sign_in' ? '-' : user}|${purpose === 'register' ? '-' : key}|${action}|${NONCE}`;

type Call = { path: string; method: string; body: Record<string, unknown> | null };
type Reply = { status: number; body?: unknown };

interface Bridge {
  status: () => Promise<unknown>;
  sign: (payload: string, text?: string) => Promise<{ signature?: string }>;
  create?: (o: { authKind: string; payload: string }) => Promise<unknown>;
  setKeyId?: (k: string) => Promise<unknown>;
  signedPrompt?: boolean;
}

/** A fake app: records every bridge call; `fail` makes one call reject with the app's reason. */
function fakeApp(over: Partial<Bridge> = {}, fail: { create?: string; sign?: string; setKeyId?: string } = {}) {
  const log: { create: { authKind: string; payload: string }[]; sign: [string, string | undefined][]; setKeyId: string[] } = { create: [], sign: [], setKeyId: [] };
  const bridge: Bridge = {
    status: async () => ({ available: true, exists: false, keyId: null }),
    create: async (o) => {
      log.create.push(o);
      if (fail.create) throw new Error(fail.create);
      return { publicKey: 'MFkw' + 'B'.repeat(80), authKind: 'biometric', attestation: ['Y2VydDE=', 'Y2VydDI='] };
    },
    sign: async (p, text) => {
      log.sign.push([p, text]);
      if (fail.sign) throw new Error(fail.sign);
      return { signature: 'MEUCIQ' + 'C'.repeat(60) };
    },
    setKeyId: async (k) => {
      log.setKeyId.push(k);
      if (fail.setKeyId) throw new Error(fail.setKeyId);
      return {};
    },
    signedPrompt: true,
    ...over,
  };
  return { bridge, log };
}

/** Runs `fn` with a page `window` holding `bridge` (null: a browser) and a stubbed fetch answering `reply(path, n)`. */
async function inPage<T>(bridge: Bridge | null, reply: (path: string, n: number) => Reply, fn: (calls: Call[], events: string[]) => Promise<T>, framed = false): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  const orig = { fetch: globalThis.fetch, window: g.window, document: g.document };
  const events: string[] = [];
  const w: Record<string, unknown> = { dispatchEvent: (e: Event) => (events.push(e.type), true) };
  w.top = framed ? {} : w;
  if (bridge) w.ArxApp = { platform: 'android', shell: 'webview', version: '2.1.0', switchServer() {}, deviceKey: bridge };
  g.window = w;
  g.document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace(/^.*\/api\/v1\//, '');
    calls.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const r = reply(path, calls.length);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await fn(calls, events);
  } finally {
    globalThis.fetch = orig.fetch;
    setStepUpHandler(null);
    for (const k of ['window', 'document'] as const) {
      if (orig[k] === undefined) delete g[k];
      else g[k] = orig[k];
    }
  }
}

const challenge = (p: string, purpose = 'step_up') => ({ status: 200, body: { challenge_id: 'dkn_' + 'c'.repeat(43), purpose, payload: p, expires_in: 60, auth_kind: 'biometric', allowed_auth_kinds: ['biometric'], attestation: 'preferred' } });

// ---------------------------------------------------------------- SA2-02: the phone shows what is signed

test('SA2-02: the line for the phone comes from the signed purpose and action', () => {
  expect(signedPromptText(payload('step_up', 'rbac.assign'))).toBe('שינוי הרשאות');
  expect(signedPromptText(payload('step_up', 'door.open'))).toBe('פתיחת דלת');
  expect(signedPromptText(payload('step_up', 'alarm.disarm'))).toBe('נטרול האזעקה');
  expect(signedPromptText(payload('step_up', 'alarm.bypass'))).toBe('עקיפת חיישן באזעקה');
  expect(signedPromptText(payload('step_up', 'identity.local.manage'))).toBe('שינוי משתמשים');
  expect(signedPromptText(payload('step_up', 'system.configure'))).toBe('שינוי הגדרות');
  expect(signedPromptText(payload('step_up', 'auth.second_factor.reset'))).toBe('שינוי דרכי האימות');
  expect(signedPromptText(payload('step_up', 'backup.restore'))).toBe('שחזור גיבוי');
  expect(signedPromptText(payload('step_up', 'tickets.manage'))).toBe('פעולה רגישה · tickets.manage');
  expect(signedPromptText(payload('step_up'))).toBe('אישור הזהות שלך');
  expect(signedPromptText(payload('step_up', 'auth.push_approval.n42'))).toBe('אישור בקשה ממסך אחר · מספר 42');
  expect(signedPromptText(payload('register'))).toBe('רישום מפתח הטלפון לחשבון');
  expect(signedPromptText(payload('sign_in'))).toBe('כניסה לחשבון');
  // not a payload of the server: the generic line, never the text itself
  for (const bad of ['פתיחת דלת', payload('disarm'), payload('step_up', 'Bad Action'), payload('step_up') + '|x', 'arx-device-key|v2|step_up|a|b|c|d|e'])
    expect(signedPromptText(bad), bad).toBe('אישור הפעולה ב־SmplWise Arx');
});

test('SA2-02: a phone-key confirmation shows the signed action, whatever the screen asks for', async () => {
  const { bridge, log } = fakeApp();
  await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(payload('step_up', 'rbac.assign')) : { status: 200, body: { method: 'device_key', minutes: 5, valid_until: '2026-11-28T10:05:00Z' } }), async (calls) => {
    // the screen asked for "open the door", the server's challenge is for a permission change: the phone says "permissions"
    await deviceKeyStepUp('dk_0123456789abcdef01234567', 'door.open');
    expect(calls.map((c) => c.path)).toEqual(['auth/device-keys/challenge', 'auth/step-up/verify']);
    expect(calls[0].body).toEqual({ purpose: 'step_up', key_id: 'dk_0123456789abcdef01234567', action: 'door.open' });
  });
  expect(log.sign).toHaveLength(1);
  expect(log.sign[0][1]).toBe('שינוי הרשאות');
  expect(log.sign[0][1]).not.toContain('דלת');
});

test('SA2-02: a phone approval shows the number INSIDE the signed payload, not the one the screen typed', async () => {
  const { bridge, log } = fakeApp();
  await inPage(bridge, (path) => (path.endsWith('/challenge') ? challenge(payload('step_up', 'auth.push_approval.n42')) : { status: 200, body: { request_id: 'pa_x', status: 'approved', reason: null, expires_in: 0 } }), async (calls) => {
    await approvePushApproval('pa_mockrequest_0123456789abcdef', 'dk_0123456789abcdef01234567', 17, bridge);
    expect(calls[0].body).toEqual({ key_id: 'dk_0123456789abcdef01234567', number: 17 });
  });
  expect(log.sign[0][1]).toBe('אישור בקשה ממסך אחר · מספר 42');
  expect(log.sign[0][1]).not.toContain('17');
});

// ---------------------------------------------------------------- SA2-01: who may register

test('SA2-01: the registration is offered only inside the app that can do it safely', async () => {
  const none = await inPage(null, () => ({ status: 404 }), async () => deviceKeyEnrolment());
  expect(none).toBe('no_app');
  const framed = await inPage(fakeApp().bridge, () => ({ status: 404 }), async () => deviceKeyEnrolment(), true);
  expect(framed).toBe('no_app');
  // an app from before the fix: no create, or a prompt that shows the page's text (no `signedPrompt`) -> update first
  const old = fakeApp({ create: undefined, setKeyId: undefined, signedPrompt: undefined }).bridge;
  expect(await inPage(old, () => ({ status: 404 }), async () => deviceKeyEnrolment())).toBe('update');
  const noSignedPrompt = fakeApp({ signedPrompt: undefined }).bridge;
  expect(await inPage(noSignedPrompt, () => ({ status: 404 }), async () => deviceKeyEnrolment())).toBe('update');
  expect(await inPage(fakeApp().bridge, () => ({ status: 404 }), async () => deviceKeyEnrolment())).toBe('ready');
});

test('SA2-01: an app that cannot register safely sends nothing at all', async () => {
  const { bridge, log } = fakeApp({ signedPrompt: undefined });
  await inPage(bridge, () => ({ status: 500 }), async (calls) => {
    await expect(registerDeviceKey('x')).rejects.toBeInstanceOf(DeviceKeyCancelled);
    expect(calls).toHaveLength(0);
  });
  expect(log.create).toHaveLength(0);
});

// ---------------------------------------------------------------- SA2-01: the registration itself

const ROW = { id: 'dk_00000000000000000000000a', label: 'הטלפון של דנה', auth_kind: 'biometric', platform: 'android', created_at: '2026-11-28T08:00:00Z', last_used_at: null, attested: 'hardware', counts: true };

test('SA2-01: challenge -> the app creates and signs -> the server registers -> the app keeps the id', async () => {
  const { bridge, log } = fakeApp();
  const reg = payload('register');
  const row = await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(reg, 'register') : { status: 200, body: ROW }), async (calls, events) => {
    const r = await registerDeviceKey('  הטלפון של דנה  ');
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST auth/device-keys/challenge', 'POST auth/device-keys']);
    expect(calls[0].body).toEqual({ purpose: 'register' });
    expect(calls[1].body).toEqual({ challenge_id: 'dkn_' + 'c'.repeat(43), public_key: 'MFkw' + 'B'.repeat(80), signature: 'MEUCIQ' + 'C'.repeat(60), label: 'הטלפון של דנה',
      auth_kind: 'biometric', attestation: ['Y2VydDE=', 'Y2VydDI='] });
    expect(events).toEqual([DEVICE_KEY_CHANGED]); // the approval watcher looks again without a reload
    return r;
  });
  expect(row.id).toBe(ROW.id);
  expect(log.create).toEqual([{ authKind: 'biometric', payload: reg }]); // the installation's kind; the register payload = attestation challenge
  expect(log.sign).toEqual([[reg, 'רישום מפתח הטלפון לחשבון']]);
  expect(log.setKeyId).toEqual([ROW.id]);
});

test('SA2-01: a prompt cancelled on the phone registers nothing', async () => {
  const { bridge, log } = fakeApp({}, { sign: 'cancelled' });
  await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(payload('register'), 'register') : { status: 200, body: ROW }), async (calls, events) => {
    const err = await registerDeviceKey('').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceKeyCancelled);
    expect((err as Error).message).toBe('cancelled');
    expect(calls.map((c) => c.path)).toEqual(['auth/device-keys/challenge']);
    expect(events).toEqual([]);
  });
  expect(log.setKeyId).toEqual([]);
});

test('SA2-01: a creation the app refuses (no tap) registers nothing', async () => {
  const { bridge, log } = fakeApp({}, { create: 'no_gesture' });
  await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(payload('register'), 'register') : { status: 200, body: ROW }), async (calls) => {
    await expect(registerDeviceKey('')).rejects.toThrow('no_gesture');
    expect(calls).toHaveLength(1);
  });
  expect(log.sign).toEqual([]);
});

test('SA2-01: a server refusal is the server\'s answer; the app keeps nothing', async () => {
  const { bridge, log } = fakeApp();
  const refusal = { code: 'device_key_attestation_required', user_message: 'נדרש מפתח מאומת בחומרה.', retryable: false, correlation_id: 'c', details: { reason: 'attestation' } };
  await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(payload('register'), 'register') : { status: 422, body: refusal }), async () => {
    await expect(registerDeviceKey('')).rejects.toMatchObject({ status: 422 });
  });
  expect(log.setKeyId).toEqual([]);
});

test('SA2-01: registered on the server but not kept by the app - said as such', async () => {
  const { bridge } = fakeApp({}, { setKeyId: 'refused' });
  await inPage(bridge, (path) => (path === 'auth/device-keys/challenge' ? challenge(payload('register'), 'register') : { status: 200, body: ROW }), async (_calls, events) => {
    const err = await registerDeviceKey('').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceKeyNotKept);
    expect((err as DeviceKeyNotKept).row.id).toBe(ROW.id);
    expect(events).toEqual([]);
  });
});
