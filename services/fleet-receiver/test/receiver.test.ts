import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { MAX_BODY, olderThan, summarize, type Installation } from '../src/index';
import { b64encode, CONTEXT, kidOf, parseEnrollment, verifyReport } from '../src/crypto';
import fixture from './fixtures/signed_report.json';

// Everything here is fake: an in-memory KV and throwaway Ed25519 keys generated per run (plus the fixture's published TEST key, which is
// enrolled nowhere). Nothing touches the network.
class FakeKV {
  store = new Map<string, string>();
  async get(key: string, type?: unknown): Promise<any> {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async list(o: { prefix: string }) {
    return { keys: [...this.store.keys()].filter((k) => k.startsWith(o.prefix)).sort().map((name) => ({ name })), list_complete: true };
  }
}

const ADMIN = 'admin-token-0123456789abcdef0123456789';
const enc = new TextEncoder();
let kv: FakeKV;
let env: any;

interface TestKey {
  priv: CryptoKey;
  pub: string;
  kid: string;
  code: string;
}
let keyA: TestKey;
let keyB: TestKey;

function b64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function newKey(id: string): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = b64encode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const kid = await kidOf(pub);
  return { priv: pair.privateKey, pub, kid, code: `arx-fleet-1.${id}.${kid}.${b64url(pub)}` };
}

async function sign(key: TestKey, body: string, context = CONTEXT): Promise<string> {
  return b64encode(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key.priv, enc.encode(context + body))));
}

const ID = 'aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb';
const baseReport = (): Record<string, any> => ({ ...JSON.parse(fixture.body), installation_id: ID });

function reportAt(seq: number, at: Date, patch: (r: Record<string, any>) => void = () => {}): string {
  const r = baseReport();
  r.seq = seq;
  r.generated_at = at.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00Z');
  patch(r);
  return JSON.stringify(r);
}

async function call(method: string, path: string, body?: string, headers: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(new Request(`https://fleet.test${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body }), env);
}

async function post(body: string, key: TestKey, sig?: string, kid?: string): Promise<Response> {
  return call('POST', '/v1/report', body, { 'x-arx-fleet-kid': kid ?? key.kid, 'x-arx-fleet-sig': sig ?? (await sign(key, body)) });
}

const admin = { authorization: `Bearer ${ADMIN}` };
async function enroll(code: string, label = 'Customer A', extra: Record<string, unknown> = {}): Promise<Response> {
  return call('POST', '/v1/admin/installations', JSON.stringify({ code, label, ...extra }), admin);
}

const NOW = new Date('2026-10-22T03:20:00Z');

beforeAll(async () => {
  keyA = await newKey(ID);
  keyB = await newKey(ID);
});

beforeEach(() => {
  kv = new FakeKV();
  env = { FLEET_KV: kv, ADMIN_TOKEN: ADMIN, LATEST_ADDON_VERSION: '2.12.1' };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('negative first: nothing unauthenticated, tampered or out of schema is stored', () => {
  it('refuses a report of an installation that was never enrolled', async () => {
    const r = await post(reportAt(1, NOW), keyA);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'unknown_installation' });
    expect([...kv.store.keys()].filter((k) => !k.startsWith('inst:'))).toEqual([]);
  });

  it('refuses a tampered body (signature made over other bytes)', async () => {
    await enroll(keyA.code);
    const good = reportAt(1, NOW);
    const sig = await sign(keyA, good);
    const tampered = good.replace('"cameras":24', '"cameras":25');
    expect(tampered).not.toBe(good);
    const r = await post(tampered, keyA, sig);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'bad_signature' });
    expect(kv.store.has(`last:${ID}`)).toBe(false);
  });

  it('refuses a tampered signature', async () => {
    await enroll(keyA.code);
    const body = reportAt(1, NOW);
    const sig = await sign(keyA, body);
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    const r = await post(body, keyA, flipped);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('bad_signature');
  });

  it('refuses a signature made without the domain-separation context', async () => {
    await enroll(keyA.code);
    const body = reportAt(1, NOW);
    const r = await post(body, keyA, await sign(keyA, body, ''));
    expect(r.status).toBe(401);
  });

  it('refuses a report signed by a key that is not the enrolled one', async () => {
    await enroll(keyA.code);
    const body = reportAt(1, NOW);
    expect((await post(body, keyB)).status).toBe(401); // keyB's kid is not enrolled
    const r = await post(body, keyB, await sign(keyB, body), keyA.kid); // keyB's signature under keyA's kid
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('bad_signature');
  });

  it('refuses a correctly signed report that carries a key outside the schema (e.g. a name)', async () => {
    await enroll(keyA.code);
    for (const patch of [
      (r: any) => (r.counts.camera_names = ['Lobby']),
      (r: any) => (r.site_name = 'x'),
      (r: any) => (r.versions.addon = 'http://evil'),
      (r: any) => (r.components.nvr = 'Lobby NVR down'),
      (r: any) => (r.readiness.missing = ['not_an_item']),
      (r: any) => delete r.disk,
    ]) {
      const body = reportAt(1, NOW, patch);
      const r = await post(body, keyA);
      expect(r.status).toBe(422);
      const j = await r.json();
      expect(j.error).toBe('schema_invalid');
      expect(JSON.stringify(j)).not.toContain('Lobby');
    }
    expect(kv.store.has(`last:${ID}`)).toBe(false);
  });

  it('refuses a replayed or older sequence number, and stale or future reports', async () => {
    await enroll(keyA.code);
    expect((await post(reportAt(5, NOW), keyA)).status).toBe(202);
    for (const seq of [5, 4]) {
      const r = await post(reportAt(seq, NOW), keyA);
      expect(r.status).toBe(409);
      expect((await r.json()).error).toBe('replayed');
    }
    const stale = await post(reportAt(6, new Date(NOW.getTime() - 37 * 3600 * 1000)), keyA);
    expect(stale.status).toBe(422);
    expect((await stale.json()).error).toBe('stale');
    const future = await post(reportAt(7, new Date(NOW.getTime() + 60 * 60 * 1000)), keyA);
    expect((await future.json()).error).toBe('from_future');
  });

  it('refuses oversized bodies, bad headers and non-JSON', async () => {
    await enroll(keyA.code);
    const big = 'x'.repeat(MAX_BODY + 1);
    expect((await post(big, keyA)).status).toBe(413);
    const body = reportAt(1, NOW);
    expect((await call('POST', '/v1/report', body, {})).status).toBe(400);
    expect((await call('POST', '/v1/report', body, { 'x-arx-fleet-kid': 'zz', 'x-arx-fleet-sig': 'x' })).status).toBe(400);
    expect((await post('not json', keyA)).status).toBe(400);
    expect((await call('GET', '/v1/report')).status).toBe(405);
  });

  it('keeps the admin routes closed without the token, and closed when the token is not configured', async () => {
    expect((await call('GET', '/v1/admin/installations')).status).toBe(401);
    expect((await call('GET', '/v1/admin/installations', undefined, { authorization: 'Bearer wrong' })).status).toBe(401);
    env.ADMIN_TOKEN = undefined;
    expect((await call('GET', '/v1/admin/installations', undefined, admin)).status).toBe(503);
    env.ADMIN_TOKEN = 'short';
    expect((await call('GET', '/v1/admin/installations', undefined, admin)).status).toBe(503);
  });

  it('refuses a malformed enrollment code, a code whose key id does not match its key, and a silent key swap', async () => {
    expect((await enroll('arx-fleet-1.nope')).status).toBe(422);
    const wrongKid = keyA.code.replace(keyA.kid, keyB.kid);
    expect((await enroll(wrongKid)).status).toBe(422);
    expect((await enroll(keyA.code, '')).status).toBe(422);
    expect((await call('POST', '/v1/admin/installations', JSON.stringify({ code: keyA.code, label: 'x', extra: 1 }), admin)).status).toBe(422);
    expect((await enroll(keyA.code)).status).toBe(201);
    const swap = await enroll(keyB.code);
    expect(swap.status).toBe(409);
    expect((await swap.json()).error).toBe('already_enrolled_other_key');
  });

  it('after an explicit key replacement the old key is retired and refused', async () => {
    await enroll(keyA.code);
    const r = await enroll(keyB.code, 'Customer A', { replace_key: true });
    expect(r.status).toBe(200);
    const old = await post(reportAt(1, NOW), keyA);
    expect(old.status).toBe(401);
    expect((await old.json()).error).toBe('key_retired');
    expect((await post(reportAt(2, NOW), keyB)).status).toBe(202);
  });
});

describe('interoperability with the add-on signer', () => {
  it('verifies the fixture signed by the Python code (services/fleet_keys + fleet_report.canonical)', async () => {
    expect(fixture.context).toBe(CONTEXT);
    expect(await verifyReport(fixture.public_key, fixture.body, fixture.signature)).toBe(true);
    expect(await verifyReport(fixture.public_key, fixture.body + ' ', fixture.signature)).toBe(false);
    expect(await kidOf(fixture.public_key)).toBe(fixture.kid);
    const e = await parseEnrollment(fixture.enrollment_code);
    expect(e).toEqual({ installation_id: fixture.installation_id, kid: fixture.kid, public_key: fixture.public_key });
  });

  it('accepts and stores the Python-signed fixture end to end', async () => {
    vi.setSystemTime(new Date('2026-10-22T04:00:00Z'));
    expect((await enroll(fixture.enrollment_code, 'Fixture')).status).toBe(201);
    const r = await call('POST', '/v1/report', fixture.body, { 'x-arx-fleet-kid': fixture.kid, 'x-arx-fleet-sig': fixture.signature });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true, seq: 7 });
    const last = JSON.parse(kv.store.get(`last:${fixture.installation_id}`)!);
    expect(last.report).toEqual(JSON.parse(fixture.body));
    expect(kv.store.has(`hist:${fixture.installation_id}:2026-10-22`)).toBe(true);
  });
});

describe('the fleet overview', () => {
  it('lists enrolled installations with a status, and never-reporting ones as never', async () => {
    await enroll(keyA.code, 'Customer A');
    const other = await newKey('ccccccccccccccccdddddddddddddddd');
    await enroll(other.code, 'Customer B');
    expect((await post(reportAt(1, NOW), keyA)).status).toBe(202);
    const r = await call('GET', '/v1/admin/installations', undefined, admin);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.totals.installations).toBe(2);
    const a = j.items.find((i: any) => i.installation_id === ID);
    expect(a.label).toBe('Customer A');
    expect(a.status).toBe('amber'); // the fixture body is overall "warn"
    expect(j.items.find((i: any) => i.label === 'Customer B').status).toBe('never');
    const one = await call('GET', `/v1/admin/installations/${ID}`, undefined, admin);
    expect((await one.json()).last.seq).toBe(1);
    expect((await call('DELETE', `/v1/admin/installations/${ID}`, undefined, admin)).status).toBe(200);
    expect(kv.store.has(`inst:${ID}`)).toBe(false);
  });

  it('derives green / amber / red / silent and the old-version flag', () => {
    const inst: Installation = { installation_id: ID, label: 'x', enrolled_at: '', keys: [] };
    const rep = (over: (r: any) => void) => {
      const r = baseReport();
      over(r);
      return { seq: 1, received_at: '2026-10-22T03:00:00Z', report: r };
    };
    const now = Date.parse('2026-10-22T04:00:00Z');
    const ok = (r: any) => {
      r.overall = 'ok';
      for (const k of Object.keys(r.components)) r.components[k] = 'ok';
      r.readiness.ready = true;
    };
    expect(summarize(inst, rep(ok), '2.12.1', now).status).toBe('green');
    expect(summarize(inst, rep((r) => { ok(r); r.components.nvr = 'error'; }), '2.12.1', now).status).toBe('red');
    const old = summarize(inst, rep((r) => { ok(r); r.versions.addon = '2.11.0'; }), '2.12.1', now);
    expect(old.status).toBe('amber');
    expect(old.outdated).toBe(true);
    expect(summarize(inst, rep(ok), '2.12.1', now + 40 * 3600 * 1000).status).toBe('silent');
    expect(olderThan('2.9.3', '2.12.1')).toBe(true);
    expect(olderThan('2.12.1', '2.12.1')).toBe(false);
  });
});
