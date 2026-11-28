import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, post, setStepUpHandler, STEP_UP_REPLAY_MS } from '../src/api/client';

// FIX-FE2-2570 (deep review 2.57 FRONTEND-CORE, second pass FE2-NN). Node only: a stubbed fetch, the real modules. Every module under
// test is imported INSIDE its test, so a run against the code before the fix fails test by test (a missing export or the old behaviour)
// instead of failing the whole file at load. The component behaviour (dialogs, folders, editors) is in unit-fix-fe2-2570-ui.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-fe2-2570.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

type Call = { url: string; method: string; body: string | null };
type Reply = { status: number; body?: unknown };

/** A stubbed fetch: `reply(n, call)` answers the n-th call (1-based); a Promise answer holds the call until it resolves. */
async function withFetch<T>(reply: (n: number, c: Call) => Reply | Promise<Reply>, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const c = { url: String(url), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null };
    calls.push(c);
    const r = await reply(calls.length, c);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    setStepUpHandler(null);
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}
const err409 = { code: 'confirmation_required', user_message: 'פעולה זו דורשת אישור מפורש.', retryable: false, correlation_id: 'c', details: {} };
const settle = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

// ------------------------------------------------------------------------------------------------ FE2-01: the shared run-with-confirmation rule

test.describe('FE2-01: a sensitive scene / script asks first and is sent once more only with confirm: true', () => {
  const item = (over: Record<string, unknown> = {}) => ({ id: 's1', name: 'יציאה מהבית', sensitive: false, unknown_effects: false, targets: [], ...over });

  test('a sensitive item: asked BEFORE anything is sent; "no" sends nothing, "yes" sends exactly one request with confirm: true', async () => {
    const { runConfirmed } = await import('../src/api/run-confirm');
    const sent: { confirm?: boolean; client_request_id: string }[] = [];
    const send = async (o: { confirm?: boolean; client_request_id: string }) => { sent.push(o); return 'ok'; };
    expect(await runConfirmed(item({ sensitive: true }), send, async () => false)).toEqual({ sent: false });
    expect(sent).toHaveLength(0);
    const asked: string[] = [];
    expect(await runConfirmed(item({ sensitive: true }), send, async (i) => { asked.push(i.name); return true; })).toEqual({ sent: true, result: 'ok' });
    expect(asked).toEqual(['יציאה מהבית']);
    expect(sent).toHaveLength(1);
    expect(sent[0].confirm).toBe(true);
  });

  test('the server asks (a door step the list does not show): the same question, then ONE more request with the same id', async () => {
    const { runConfirmed } = await import('../src/api/run-confirm');
    const sent: { confirm?: boolean; client_request_id: string }[] = [];
    const send = async (o: { confirm?: boolean; client_request_id: string }) => {
      sent.push(o);
      if (!o.confirm) throw new ApiError(409, err409);
      return 'ok';
    };
    expect(await runConfirmed(item(), send, async () => true)).toEqual({ sent: true, result: 'ok' });
    expect(sent).toHaveLength(2);
    expect(sent[0].confirm).toBeUndefined();
    expect(sent[1].confirm).toBe(true);
    expect(sent[1].client_request_id).toBe(sent[0].client_request_id);
    sent.length = 0;
    expect(await runConfirmed(item(), send, async () => false)).toEqual({ sent: false });
    expect(sent).toHaveLength(1); // the refused one only; "no" sends nothing more
  });

  test('any other failure is thrown as it came - never re-sent', async () => {
    const { runConfirmed } = await import('../src/api/run-confirm');
    let n = 0;
    const e = new ApiError(502, { code: 'bridge_unavailable', user_message: 'x', retryable: true, correlation_id: 'c', details: {} });
    const out = await settle(runConfirmed(item(), async () => { n += 1; throw e; }, async () => true));
    expect(out).toBe(e);
    expect(n).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------ FE2-03: a late physical confirmation

test('FE2-03: a door open confirmed after the replay window is not sent and answers "confirmed - press again", not the raw refusal', async () => {
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  try {
    setStepUpHandler(async () => {
      skew += STEP_UP_REPLAY_MS + 10_000; // the dialog waited behind another one
      return true;
    });
    const gate = { code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action: 'door.open', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } };
    await withFetch(() => ({ status: 403, body: gate }), async (calls) => {
      const out = await settle(post('access-control/doors/d1/open', {}));
      expect(out).toBeInstanceOf(ApiError);
      expect((out as ApiError).body.code).toBe('step_up_confirmed_press_again');
      expect(calls).toHaveLength(1);
    });
  } finally {
    Date.now = realNow;
  }
});

// ------------------------------------------------------------------------------------------------ FE2-06 / FE2-12: building presence

test.describe('FE2-06: presence times in the installation zone the server sent', () => {
  // 14:20 UTC = 09:20 in New York (EST, November) = 16:20 in Israel
  const AT = '2026-11-28T14:20:00Z';

  test('the chip and the widget show "empty since" in the snapshot\'s zone', async () => {
    const L = await import('../src/api/building-presence-logic');
    const snap = { configured: true, enabled: true, settings: {} as never, fresh: true, status: 'clear' as const, occupied_rooms: 0, rooms: [], sensors: [], empty_since: AT, at: AT, time_zone: 'America/New_York' };
    expect(L.chipView(snap).text).toContain('09:20');
    expect(L.chipView(snap).text).not.toContain('16:20');
    expect(L.chipView({ ...snap, time_zone: undefined }).text).toContain('16:20'); // an older server: the former default
    expect(L.chipView({ ...snap, time_zone: 'Not/AZone' }).text).toContain('16:20'); // an unknown name never throws
  });

  test('the area line shows the room\'s "empty since" in the answer\'s zone', async () => {
    const L = await import('../src/api/building-presence-logic');
    const a = { area_id: 'a1', line: true, sensors: { status: 'clear' as const, empty_since: AT, sensors: 1 }, people: null, time_zone: 'America/New_York' };
    const v = L.areaLineView(a);
    expect(`${v.room} ${v.title}`).toContain('09:20');
  });

  test('FE2-12: after a few failed reads in a row the chip no longer shows the last answer', async () => {
    const L = await import('../src/api/building-presence-logic');
    expect(typeof L.keptSnapshot).toBe('function');
    const last = { at: 'x' };
    expect(L.keptSnapshot(last, 1)).toBe(last);
    expect(L.keptSnapshot(last, L.STALE_FAILS - 1)).toBe(last);
    expect(L.keptSnapshot(last, L.STALE_FAILS)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------ FE2-08: messaging policy

test('FE2-08: the changes that stop delivery are the ones asked about', async () => {
  const M = await import('../src/messaging/policy-model');
  expect(typeof M.blockingChange).toBe('function');
  expect(M.blockingChange({ enforce: false, allow: [] }, { enforce: true })).toBe('all');
  expect(M.blockingChange({ enforce: false, allow: [1] }, { enforce: true })).toBeNull();
  expect(M.blockingChange({ enforce: true, allow: [] }, { enforce: false })).toBeNull();
  expect(M.blockingChange({ enforce: true, allow: [1] }, { remove: true })).toBe('all');
  expect(M.blockingChange({ enforce: true, allow: [1, 2] }, { remove: true })).toBe('one');
  expect(M.blockingChange({ enforce: false, allow: [1] }, { remove: true })).toBeNull();
});

// ------------------------------------------------------------------------------------------------ FE2-16: preference saves out of order

test('FE2-16: A then B, B saved and A refused afterwards - the screen keeps B (the server holds B)', async () => {
  const T = await import('../src/shell/tabs-mode');
  let releaseA: (r: Reply) => void = () => undefined;
  const heldA = new Promise<Reply>((r) => (releaseA = r));
  await withFetch((n, c) => {
    if (c.method === 'GET') return { status: 200, body: { prefs: {}, stored: [], updated_at: null } };
    const b = JSON.parse(c.body ?? '{}') as Record<string, unknown>;
    if (b['ui.dd_settings_nav'] === 'dropdown') return heldA; // A: answered last, refused
    return { status: 200, body: { prefs: b, stored: Object.keys(b), updated_at: null } }; // B: saved at once
  }, async () => {
    await T.loadTabsMode('u-fe2', true);
    expect(T.ownSettingsNav()).toBeNull();
    const a = settle(T.saveOwnSettingsNav('dropdown'));
    const b = settle(T.saveOwnSettingsNav('tabs'));
    expect(await b).toBeNull();
    releaseA({ status: 422, body: { code: 'validation', user_message: 'x', retryable: false, correlation_id: 'c', details: {} } });
    await a;
    expect(T.ownSettingsNav()).toBe('tabs');
  });
  // the last save refused: back to what the server holds
  await withFetch((n, c) => (c.method === 'GET' ? { status: 200, body: { prefs: {}, stored: [], updated_at: null } } : { status: 422, body: { code: 'validation', user_message: 'x', retryable: false, correlation_id: 'c', details: {} } }), async () => {
    await T.loadTabsMode('u-fe2b', true);
    const out = await settle(T.saveOwnSettingsNav('dropdown'));
    expect(out).toBeInstanceOf(ApiError);
    expect(T.ownSettingsNav()).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------ FE2-14: generated wire types that nothing imports

/** The generated families (api/generated/wire-*.ts) that no file of frontend/src imports, at 2.57 (review FE2-14: 47 at 2.56; wire-ha is
 * now imported by api/ha.ts). This list may only SHRINK: a new generated family must be imported by its client (so tsc compares the
 * screen with the server); when one gets imported, remove it here. */
const NOT_IMPORTED_BASELINE = [
  'wire-access-control-capture', 'wire-access-control-diag', 'wire-access-control-door-tech', 'wire-access-control-messaging', 'wire-access-control-ops',
  'wire-access-control-people', 'wire-access-control-profiles', 'wire-access-control-reads', 'wire-access-control-station-ops', 'wire-access-control-station-people',
  'wire-access-control-triage', 'wire-access-control-wa-queue', 'wire-access-control-writes', 'wire-access-grants', 'wire-access-station-permissions',
  'wire-access-wiskey-visits', 'wire-announcements', 'wire-app-refresh', 'wire-app-secrets', 'wire-automation-blueprints', 'wire-automations', 'wire-backup',
  'wire-brand', 'wire-building-presence', 'wire-bulk-people', 'wire-calendar-attendees', 'wire-camera-image-health', 'wire-camera-sources', 'wire-capture-lease',
  'wire-cast', 'wire-device-layouts', 'wire-health', 'wire-intercom-calls', 'wire-intercom-listen', 'wire-intercom-media', 'wire-quiet', 'wire-settings',
  'wire-storage', 'wire-transit', 'wire-wiskey-installer-clock', 'wire-wiskey-installer-platform', 'wire-wiskey-lineage', 'wire-wiskey-managed',
  'wire-wiskey-pairing', 'wire-wiskey-switches', 'wire-wiskey-validation',
];

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) tsFiles(p, out);
    else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('FE2-14: no new generated wire family is left unimported, and the list of unimported ones only shrinks', () => {
  const genDir = path.join(SRC, 'api', 'generated');
  const families = readdirSync(genDir).filter((f) => /^wire-.*\.ts$/.test(f)).map((f) => f.replace(/\.ts$/, ''));
  const used = new Set<string>();
  for (const f of tsFiles(SRC)) {
    if (f.startsWith(genDir)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/generated\/(wire-[a-z0-9-]+)/g)) used.add(m[1]);
  }
  const unused = families.filter((f) => !used.has(f)).sort();
  expect(unused.filter((f) => !NOT_IMPORTED_BASELINE.includes(f)), 'a new generated family nobody imports').toEqual([]);
  expect(NOT_IMPORTED_BASELINE.filter((f) => !unused.includes(f)), 'imported now (or removed): take it off the baseline').toEqual([]);
});
