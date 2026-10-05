import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { resetApnsTokenCache } from '../src/apns';
import { resetFcmTokenCache } from '../src/fcm';
import { b64urlDecode } from '../src/crypto';

// Everything here is fake: an in-memory KV, generated (throwaway) signing keys, a stubbed fetch for APNs / FCM / OAuth.
// Nothing touches the network and no real key exists in this file.
class FakeKV {
  store = new Map<string, string>();
  async get(key: string, options?: unknown): Promise<any> {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return options === 'json' || (typeof options === 'object' && (options as { type?: string })?.type === 'json') ? JSON.parse(v) : v;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const SERVER_SECRET = 'srv-secret-0123456789abcdef';
const OTHER_SECRET = 'other-secret-0123456789abcdef';
const APNS_TOKEN = 'a'.repeat(64);
const FCM_TOKEN = 'f'.repeat(120);
let env: any;
let kv: FakeKV;
let apnsPublic: CryptoKey;
let fcmPublic: CryptoKey;
let calls: { url: string; init: RequestInit }[];
let upstream: (url: string, init: RequestInit) => Response;
const fake: { p8: string; sa: string } = { p8: '', sa: '' };
const dec = (b64: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(b64)));

function pem(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  apnsPublic = ec.publicKey;
  const rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  fcmPublic = rsa.publicKey;
  fake.p8 = pem(await crypto.subtle.exportKey('pkcs8', ec.privateKey));
  fake.sa = JSON.stringify({ project_id: 'fake-project', client_email: 'fake@fake-project.iam.gserviceaccount.com', private_key: pem(await crypto.subtle.exportKey('pkcs8', rsa.privateKey)) });
});

beforeEach(() => {
  kv = new FakeKV();
  env = {
    RELAY_KV: kv,
    SERVER_KEYS: `efrat:${SERVER_SECRET},office:${OTHER_SECRET}`,
    APNS_KEY_P8: fake.p8, APNS_KEY_ID: 'KEYID12345', APNS_TEAM_ID: 'TEAMID1234', APNS_BUNDLE_ID: 'com.smplwise.arx.app', APNS_ENV: 'production',
    FCM_SERVICE_ACCOUNT: fake.sa,
    RELAY_TOKEN_SECRET: 'stable-token-secret-0123456789',
  };
  resetApnsTokenCache();
  resetFcmTokenCache();
  calls = [];
  upstream = (url) => (url.includes('oauth2.googleapis.com') ? new Response(JSON.stringify({ access_token: 'fake-oauth' }), { status: 200 }) : new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return upstream(url, init);
  });
});

const pending: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const res = await worker.fetch(
    new Request(`https://relay.test${path}`, { method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    ctx as any,
  );
  await Promise.all(pending.splice(0));
  return res;
}
const reg = (platform: 'ios' | 'android' = 'ios', extra: object = {}) =>
  call('POST', '/v1/register', { platform, push_token: platform === 'ios' ? APNS_TOKEN : FCM_TOKEN, app_version: '1.0.0', bundle_id: 'com.smplwise.arx.app', ...extra });
const token = async (platform: 'ios' | 'android' = 'ios') => ((await (await reg(platform)).json()) as { relay_token: string }).relay_token;
const push = (relay_token: string, extra: object = {}, key = SERVER_SECRET) =>
  call('POST', '/v1/push', { relay_token, category: 'safety', notification_id: 'msg_0001', priority: 'high', server: 'srv_0a1b2c3d4e5f6071', ...extra }, { authorization: `Bearer ${key}` });

describe('health and routing', () => {
  it('reports what is configured and never a secret', async () => {
    expect(await (await call('GET', '/v1/health')).json()).toEqual({ ok: true, apns: true, fcm: true, stable_tokens: true, server_keys: 2 });
  });
  it('shows an unconfigured relay honestly', async () => {
    env = { RELAY_KV: kv, SERVER_KEYS: '' };
    expect(await (await call('GET', '/v1/health')).json()).toEqual({ ok: true, apns: false, fcm: false, stable_tokens: false, server_keys: 0 });
  });
  it('404 for anything else', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
    expect((await call('GET', '/v1/register')).status).toBe(404);
  });
});

describe('register / unregister (contract section 8)', () => {
  it('returns an rt_ token, idempotent per push token', async () => {
    const a = await token();
    expect(a).toMatch(/^rt_[A-Za-z0-9_-]{43}$/);
    expect(await token()).toBe(a);
    const other = ((await (await call('POST', '/v1/register', { platform: 'ios', push_token: 'b'.repeat(64), app_version: '1', bundle_id: 'com.smplwise.arx.app' })).json()) as any).relay_token;
    expect(other).not.toBe(a);
  });
  it('without RELAY_TOKEN_SECRET a fresh token is issued and the previous one stops working', async () => {
    delete env.RELAY_TOKEN_SECRET;
    const a = await token();
    const b = await token();
    expect(b).not.toBe(a);
    expect((await push(a)).status).toBe(404);
    expect((await push(b)).status).toBe(200);
  });
  it('stores only hashes of relay tokens, never the token itself', async () => {
    const relay_token = await token();
    for (const [k, v] of kv.store) {
      expect(k).not.toContain(relay_token);
      expect(v).not.toContain(relay_token);
    }
    const keys = [...kv.store.keys()].filter((k) => k.startsWith('reg:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^reg:[0-9a-f]{64}$/);
    expect(Object.keys(JSON.parse(kv.store.get(keys[0])!)).sort()).toEqual(['bundle_id', 'created_at', 'platform', 'push_token']);
  });
  it('rejects an unknown bundle id, a bad platform and malformed push tokens', async () => {
    expect((await reg('ios', { bundle_id: 'com.evil.app' })).status).toBe(400);
    expect((await reg('ios', { platform: 'windows' })).status).toBe(400);
    expect((await reg('ios', { push_token: 'zz' })).status).toBe(400);
    expect((await call('POST', '/v1/register', { platform: 'android', push_token: 'short', bundle_id: 'com.smplwise.arx.app' })).status).toBe(400);
    expect((await call('POST', '/v1/register', 'not an object')).status).toBe(400);
  });
  it('rejects bodies over 2 KiB', async () => {
    expect((await reg('ios', { app_version: 'x'.repeat(3000) })).status).toBe(400);
  });
  it('limits registrations to 60 per hour per address', async () => {
    for (let i = 0; i < 60; i++) expect((await reg()).status).toBe(200);
    expect((await reg()).status).toBe(429);
  });
  it('DELETE answers 204 and the token then is unknown', async () => {
    const relay_token = await token();
    expect((await call('DELETE', '/v1/register', { relay_token })).status).toBe(204);
    expect((await push(relay_token)).status).toBe(404);
    expect((await call('DELETE', '/v1/register', { relay_token })).status).toBe(204);
    expect((await call('DELETE', '/v1/register', { relay_token: 'junk' })).status).toBe(400);
  });
});

describe('push (server to relay)', () => {
  it('401 without or with a wrong server key, before any upstream call', async () => {
    const relay_token = await token();
    expect((await call('POST', '/v1/push', { relay_token })).status).toBe(401);
    expect((await push(relay_token, {}, 'wrong-key-0123456789abcdef')).status).toBe(401);
    expect((await push(relay_token, {}, 'short')).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it('400 on a bad category, notification id or token shape', async () => {
    const relay_token = await token();
    expect((await push(relay_token, { category: 'bogus' })).status).toBe(400);
    expect((await push(relay_token, { notification_id: 'a b' })).status).toBe(400);
    expect((await push('rt_short')).status).toBe(400);
  });
  it('404 relay_token_unknown for a token that is not registered', async () => {
    const res = await push('rt_' + 'A'.repeat(43));
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).code).toBe('relay_token_unknown');
  });
  it('iOS: a generic APNs alert, the installation server id as thread, ES256 provider token, no text', async () => {
    const relay_token = await token();
    const res = await push(relay_token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const c = calls.at(-1)!;
    expect(c.url).toBe(`https://api.push.apple.com/3/device/${APNS_TOKEN}`);
    const h = c.init.headers as Record<string, string>;
    expect(h['apns-topic']).toBe('com.smplwise.arx.app');
    expect(h['apns-push-type']).toBe('alert');
    expect(h['apns-priority']).toBe('10');
    const payload = JSON.parse(c.init.body as string);
    expect(payload.aps['thread-id']).toBe('srv_0a1b2c3d4e5f6071');
    expect(payload.aps['mutable-content']).toBe(1);
    expect(payload.aps['interruption-level']).toBe('time-sensitive');
    expect(payload).toMatchObject({ notification_id: 'msg_0001', category: 'safety', server: 'srv_0a1b2c3d4e5f6071' });
    expect(Object.keys(payload).sort()).toEqual(['aps', 'category', 'notification_id', 'server']);
    const jwt = h.authorization.replace(/^bearer /, '').split('.');
    expect(dec(jwt[0])).toEqual({ alg: 'ES256', kid: 'KEYID12345' });
    expect(dec(jwt[1])).toMatchObject({ iss: 'TEAMID1234' });
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, apnsPublic, b64urlDecode(jwt[2]), new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`))).toBe(true);
  });
  it('iOS normal priority has no time-sensitive level; sandbox uses the sandbox host', async () => {
    env.APNS_ENV = 'sandbox';
    const relay_token = await token();
    await push(relay_token, { priority: 'normal' });
    expect(calls.at(-1)!.url).toContain('api.sandbox.push.apple.com');
    expect(JSON.parse(calls.at(-1)!.init.body as string).aps['interruption-level']).toBeUndefined();
    expect((calls.at(-1)!.init.headers as any)['apns-priority']).toBe('5');
  });
  it('falls back to the server key id when the body names no valid server', async () => {
    const relay_token = await token();
    await push(relay_token, { server: 'bad id!' });
    expect(JSON.parse(calls.at(-1)!.init.body as string).server).toBe('efrat');
  });
  it('Android: an OAuth exchange (RS256 service-account JWT) then a data-only FCM v1 message', async () => {
    const relay_token = await token('android');
    expect((await push(relay_token, { collapse: 'k1' })).status).toBe(200);
    const oauth = calls.find((c) => c.url.includes('oauth2.googleapis.com'))!;
    const form = new URLSearchParams(oauth.init.body as string);
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const jwt = form.get('assertion')!.split('.');
    expect(dec(jwt[1])).toMatchObject({ iss: 'fake@fake-project.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token' });
    expect(await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, fcmPublic, b64urlDecode(jwt[2]), new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`))).toBe(true);
    const send = calls.at(-1)!;
    expect(send.url).toBe('https://fcm.googleapis.com/v1/projects/fake-project/messages:send');
    expect((send.init.headers as any).authorization).toBe('Bearer fake-oauth');
    const m = JSON.parse(send.init.body as string).message;
    expect(m.notification).toBeUndefined();
    expect(m.token).toBe(FCM_TOKEN);
    expect(m.data).toMatchObject({ notification_id: 'msg_0001', category: 'safety', server: 'srv_0a1b2c3d4e5f6071' });
    expect(m.android).toMatchObject({ priority: 'HIGH', collapse_key: 'k1' });
  });
  it('reuses the cached OAuth token for the next push', async () => {
    const relay_token = await token('android');
    await push(relay_token);
    await push(relay_token, { notification_id: 'msg_0002' });
    expect(calls.filter((c) => c.url.includes('oauth2.googleapis.com'))).toHaveLength(1);
  });
  it('APNs 410 gives 410 push_token_gone and the registration is deleted', async () => {
    const relay_token = await token();
    upstream = () => new Response(JSON.stringify({ reason: 'Unregistered' }), { status: 410 });
    const res = await push(relay_token);
    expect(res.status).toBe(410);
    expect(((await res.json()) as any).code).toBe('push_token_gone');
    upstream = () => new Response('{}', { status: 200 });
    expect((await push(relay_token)).status).toBe(404);
  });
  it('FCM 404 UNREGISTERED and a message.token INVALID_ARGUMENT give 410', async () => {
    const oauthOr = (body: unknown, status: number) => (url: string) => (url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 't' })) : new Response(JSON.stringify(body), { status }));
    let r = await token('android');
    upstream = oauthOr({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, 404);
    expect((await push(r)).status).toBe(410);
    r = await token('android');
    upstream = oauthOr({ error: { status: 'INVALID_ARGUMENT', details: [{ fieldViolations: [{ field: 'message.token' }] }] } }, 400);
    expect((await push(r)).status).toBe(410);
  });
  it('a rejected FCM OAuth token (401) is minted again once', async () => {
    const relay_token = await token('android');
    let first = true;
    upstream = (url) => {
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }));
      if (first) {
        first = false;
        return new Response('{}', { status: 401 });
      }
      return new Response('{}', { status: 200 });
    };
    expect((await push(relay_token)).status).toBe(200);
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(2);
  });
  it('an expired APNs provider token is minted again once', async () => {
    const relay_token = await token();
    let first = true;
    upstream = () => {
      if (first) {
        first = false;
        return new Response(JSON.stringify({ reason: 'ExpiredProviderToken' }), { status: 403 });
      }
      return new Response('{}', { status: 200 });
    };
    expect((await push(relay_token)).status).toBe(200);
    expect(calls).toHaveLength(2);
  });
  it('upstream 429 / 5xx give 503 upstream_busy; other refusals and network errors 502', async () => {
    const relay_token = await token();
    upstream = () => new Response('{}', { status: 429, headers: { 'retry-after': '7' } });
    const busy = await push(relay_token);
    expect(busy.status).toBe(503);
    expect(((await busy.json()) as any).retry_after_s).toBe(7);
    upstream = () => new Response(JSON.stringify({ reason: 'PayloadEmpty' }), { status: 400 });
    expect((await push(relay_token)).status).toBe(502);
    upstream = () => {
      throw new Error('network');
    };
    expect((await push(relay_token)).status).toBe(502);
  });
  it('503 when the platform is not configured', async () => {
    const relay_token = await token();
    delete env.APNS_KEY_P8;
    const res = await push(relay_token);
    expect(res.status).toBe(503);
    expect(((await res.json()) as any).code).toBe('apns_unconfigured');
  });
  it('limits 60 pushes per minute per device (429 rate_limited)', async () => {
    const relay_token = await token();
    for (let i = 0; i < 60; i++) expect((await push(relay_token, { notification_id: `msg_${1000 + i}` })).status).toBe(200);
    expect((await push(relay_token)).status).toBe(429);
  });
  it('slows a server that keeps naming unknown tokens (200 per hour)', async () => {
    for (let i = 0; i < 200; i++) expect((await push('rt_' + 'B'.repeat(43))).status).toBe(404);
    expect((await push('rt_' + 'B'.repeat(43))).status).toBe(429);
  });
  it('a repeat push does not rewrite the registration (KV writes are the scarce free-plan resource)', async () => {
    const relay_token = await token();
    await push(relay_token);
    const puts: string[] = [];
    const orig = kv.put.bind(kv);
    kv.put = async (k: string, v: string) => {
      puts.push(k);
      return orig(k, v);
    };
    await push(relay_token, { notification_id: 'msg_0002' });
    expect(puts.filter((k) => k.startsWith('reg:'))).toHaveLength(0);
  });
});
