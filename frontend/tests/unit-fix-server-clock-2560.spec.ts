import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, apiResponse, post, setStepUpHandler } from '../src/api/client';
import { noteDateHeader, noteServerTime, resetServerClock, serverNow, serverOffset } from '../src/api/server-clock';
import { canConfirm } from '../src/access-control/people-csv-verify-logic';
import { secondsLeft } from '../src/access-control/profiles-logic';

// FIX-SERVER-CLOCK-2560 (deep review 2.56: VD-01, VD-03, FE-01, FE-03, FE-04, WA-01): every client-stamped expiry of a command is on the
// SERVER's clock (api/server-clock.ts); the clock learns only from short round trips; a physical action confirmed through step-up is
// re-sent with a fresh expiry, never its stale one. Node only: a stubbed fetch and document, a device clock moved by +/- 2 minutes.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-server-clock-2560.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

type Call = { url: string; method: string; body: string | null };
type Reply = { status: number; body?: unknown };

async function withFetch<T>(reply: (n: number) => Reply, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
    const r = reply(calls.length);
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

/** Runs `fn` on a device whose clock is `skewMs` off the server's; the server's time was learned from one short answer. `real()` is the
 * server's (= the real) clock; `advance(ms)` moves both clocks on (a dialog left open). */
async function skewed<T>(skewMs: number, fn: (clock: { real: () => number; advance: (ms: number) => void }) => Promise<T>): Promise<T> {
  const realNow = Date.now;
  let later = 0;
  const real = () => realNow() + later;
  Date.now = () => real() + skewMs;
  resetServerClock();
  const t = Date.now();
  noteServerTime(real(), t - 40, t + 40); // a body sample, 80 ms round trip
  try {
    return await fn({ real, advance: (ms) => (later += ms) });
  } finally {
    Date.now = realNow;
    resetServerClock();
  }
}

const bodyOf = (c: Call) => JSON.parse(c.body ?? '{}') as Record<string, unknown>;
/** How far the stamped `expires_at` is from `want` (ms); the stamps are whole seconds (isoZ) or exact. */
const off = (c: Call, want: number) => Math.abs(Date.parse(String(bodyOf(c).expires_at)) - want);
const OK = { status: 202, body: { id: 'a1', status: 'pending' } };

for (const skew of [-120_000, 120_000]) {
  const label = `device clock ${skew < 0 ? '2 min behind' : '2 min ahead'}`;

  test(`VD-01: alarm arm / disarm / bypass stamp expires_at on the server's clock (${label})`, async () => {
    const alarm = await import('../src/api/alarm');
    await skewed(skew, async ({ real }) => {
      await withFetch(() => OK, async (calls) => {
        await alarm.panelAction('alarm_control_panel.home', 'disarm', { confirmed: true });
        await alarm.panelAction('alarm_control_panel.home', 'arm_away', { confirmed: true });
        await alarm.zoneBypass('binary_sensor.door', true, { confirmed: true });
        expect(calls).toHaveLength(3);
        for (const c of calls) expect(off(c, real() + 60_000), c.url).toBeLessThan(1_500);
      });
    });
  });

  test(`FE-04: every HA entity action (lights, the door tile) stamps expires_at on the server's clock (${label})`, async () => {
    const ha = await import('../src/api/ha');
    await skewed(skew, async ({ real }) => {
      await withFetch(() => OK, async (calls) => {
        await ha.runAction('light.lobby', 'light.turn_on');
        await ha.runAction('lock.entrance', 'lock.unlock', {}, true);
        for (const c of calls) expect(off(c, real() + 60_000), c.url).toBeLessThan(1_500);
      });
    });
  });

  test(`a door opened from a notification stamps expires_at on the server's clock (${label})`, async () => {
    const n = await import('../src/api/notifications');
    await skewed(skew, async ({ real }) => {
      await withFetch(() => ({ status: 200, body: { ok: true } }), async (calls) => {
        await n.httpNotify.openDoor('n1', 'st1');
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toContain('intercom/stations/st1/release');
        expect(off(calls[0], real() + 15_000)).toBeLessThan(1_500);
      });
    });
  });

  test(`VD-03: player, queue, group and screen commands expire 15 s ahead on the server's clock (${label})`, async () => {
    const players = (await import('../src/api/media-players')) as unknown as { expiry?: (ms?: number) => string };
    const screens = (await import('../src/api/media-screens')) as unknown as { expiry?: (ms?: number) => string };
    await skewed(skew, async ({ real }) => {
      for (const ex of [players.expiry, screens.expiry]) {
        expect(typeof ex, 'the stamp helper the commands use').toBe('function');
        expect(Math.abs(Date.parse(ex!()) - (real() + 15_000))).toBeLessThan(500);
      }
    });
    // every media command site uses that helper or serverNow (the dialogs, the home screen)
    const sites = ['api/media-players.ts', 'api/media-screens.ts', 'components/media-bulk-dialog.ts', 'components/media-group-dialog.ts', 'home/home-p3.ts', 'home/home-p3-media.ts'];
    for (const f of sites) expect(read(f), f).not.toMatch(/Date\.now\(\) \+ (ms|15_000)\)\.toISOString/);
  });

  test(`WA-01: the emergency sheet, the people CSV confirm and a review's time left count on the server's clock (${label})`, async () => {
    await skewed(skew, async ({ real }) => {
      // the server's 20 s confirm window / a preview valid 60 s more: open on the server's time line whatever the device says
      const until = new Date(real() + 20_000).toISOString();
      expect(secondsLeft(until, serverNow())).toBe(20);
      const vp = { writes: 3, expires_at: new Date(real() + 60_000).toISOString() } as Parameters<typeof canConfirm>[0];
      expect(canConfirm(vp, '3', serverNow())).toBe(true);
    });
    const em = read('door-windows/emergency.ts');
    expect(em).toContain('Math.round((until - serverNow()) / 1000)');
    expect(em).not.toContain('until - Date.now()');
    const bp = read('screens/wiskey-bulk-people.ts');
    expect(bp).not.toMatch(/canConfirm\([^)]*Date\.now\(\)\)/);
    expect(bp.match(/canConfirm\([^)]*serverNow\(\)\)/g)?.length).toBe(2);
    const pr = read('screens/wiskey-profiles.ts');
    expect(pr).toContain('private now = serverNow()');
    expect(pr).toContain('(this.now = serverNow())');
  });
}

test('no client-stamped command expiry is left on the device clock (expires_at / expiry built from Date.now())', () => {
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts') && !/mock|demo/i.test(name)) {
        readFileSync(p, 'utf8').split('\n').forEach((ln, i) => {
          if (/(expires_at|expiry)\b[^\n]*Date\.now\(\) *\+/.test(ln)) bad.push(`${path.relative(SRC, p)}:${i + 1}`);
        });
      }
    }
  };
  walk(SRC);
  expect(bad).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ FE-03: only short round trips teach the clock

test('FE-03: a sample with a long round trip is ignored; the smallest error wins; an old sample gives way', async () => {
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  try {
    resetServerClock();
    const t = Date.now();
    // a tablet slept 10 minutes with the request in flight: the midpoint would be 5 minutes off
    noteServerTime(t - 600_000 + 50, t - 600_000, t);
    expect(serverOffset(), 'a 10-minute round trip teaches nothing').toEqual({ ms: 0, source: null });
    noteServerTime(t + 30_000, t - 2_500, t);
    expect(serverOffset().source, 'over the 2 s bound: ignored').toBeNull();
    // a good exact sample: kept
    noteServerTime(t + 30_000, t - 100, t + 100);
    expect(serverOffset()).toEqual({ ms: 30_000, source: 'body' });
    // a worse one (1.5 s round trip) a few seconds later does not replace it
    noteServerTime(t + 33_000 + 9_000, t + 2_000, t + 3_500);
    expect(serverOffset().ms).toBe(30_000);
    // a header (coarse) does not replace a recent exact sample
    noteDateHeader(new Date(t + 90_000).toUTCString(), t + 4_000, t + 4_010);
    expect(serverOffset()).toEqual({ ms: 30_000, source: 'body' });
    // a minute later a header sample may replace it (the server's clock may have been corrected meanwhile)
    skew = 61_000;
    const t2 = Date.now();
    noteDateHeader(new Date(Math.floor((t2 + 10_000) / 1000) * 1000).toUTCString(), t2 - 10, t2 + 10);
    expect(serverOffset().source).toBe('header');
    expect(Math.abs(serverOffset().ms - 10_000)).toBeLessThan(1_000);
  } finally {
    Date.now = realNow;
    resetServerClock();
  }
});

// ------------------------------------------------------------------------------------------------ FE-01: no stale resend after step-up

const gate = (action: string) => ({ code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action, methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } });

for (const skew of [-120_000, 120_000]) {
  test(`FE-01: a door release confirmed 20 s later is re-sent with a FRESH expiry, the same request id (device ${skew < 0 ? 'behind' : 'ahead'})`, async () => {
    await skewed(skew, async ({ real, advance }) => {
      setStepUpHandler(async () => {
        advance(20_000); // unlock the phone, open the authenticator, type six digits
        return true;
      });
      const stamp = new Date(serverNow() + 15_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      await withFetch((n) => (n === 1 ? { status: 403, body: gate('door.open') } : { status: 200, body: { outcome: 'ok' } }), async (calls) => {
        await post('intercom/stations/st1/release', { confirmed: true, client_request_id: 'rq-1', expires_at: stamp });
        expect(calls).toHaveLength(2);
        const [first, again] = calls.map(bodyOf);
        expect(first.expires_at).toBe(stamp);
        expect(Date.parse(String(again.expires_at)), 'the replay is not already expired on the server').toBeGreaterThan(real());
        expect(off(calls[1], real() + 15_000), 'the same 15 s life, from now (two whole-second stamps)').toBeLessThan(2_500);
        expect(again.client_request_id, 'the same command id (the refused one was never recorded)').toBe('rq-1');
        expect({ ...again, expires_at: 0 }).toEqual({ ...first, expires_at: 0 });
      });
    });
  });
}

test('FE-01: the alarm disarm confirmed later is re-sent with a fresh 60 s expiry', async () => {
  const alarm = await import('../src/api/alarm');
  await skewed(-120_000, async ({ real, advance }) => {
    setStepUpHandler(async () => {
      advance(70_000); // longer than the 60 s envelope, inside the 120 s replay window
      return true;
    });
    await withFetch((n) => (n === 1 ? { status: 403, body: gate('alarm.disarm') } : OK), async (calls) => {
      await alarm.panelAction('alarm_control_panel.home', 'disarm', { confirmed: true });
      expect(calls).toHaveLength(2);
      expect(off(calls[1], real() + 60_000), 'two whole-second stamps').toBeLessThan(2_500);
    });
  });
});

test('FE-01: a physical action whose body cannot be rebuilt is not re-sent - "confirmed, press again"', async () => {
  setStepUpHandler(async () => true);
  await withFetch((n) => (n === 1 ? { status: 403, body: gate('door.open') } : { status: 200, body: { outcome: 'ok' } }), async (calls) => {
    const res = await apiResponse('intercom/stations/st1/release', { method: 'POST', body: 'expires_at=2026-11-27T10:00:00Z' });
    expect(calls, 'nothing is sent after the confirmation').toHaveLength(1);
    expect(res.status).toBe(409);
    const b = (await res.json()) as { code: string; user_message: string; retryable: boolean };
    expect(b.code).toBe('step_up_confirmed_press_again');
    expect(b.user_message).toContain('לחצו שוב');
    expect(b.retryable).toBe(true);
  });
  // through post(): the screens get an ApiError with that code (never a silent success, never "expired - fix your clock")
  setStepUpHandler(async () => true);
  await withFetch((n) => (n === 1 ? { status: 403, body: gate('alarm.bypass') } : OK), async (calls) => {
    const spent = new Date(Date.now() - 5_000).toISOString(); // stamped already spent: no life to give again
    const err = await post('alarm/zones/z1/bypass', { bypassed: true, client_request_id: 'b1', expires_at: spent }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).body.code).toBe('step_up_confirmed_press_again');
    expect(calls).toHaveLength(1);
  });
});

test('FE-01: freshEnvelope - JSON with expires_at rebuilt, none = re-sent as is, anything else = not sent', async () => {
  const c = (await import('../src/api/client')) as unknown as { freshEnvelope?: (b: unknown, at: number, now: number) => string | null | undefined };
  expect(typeof c.freshEnvelope).toBe('function');
  const f = c.freshEnvelope!;
  const at = Date.parse('2026-11-27T10:00:00Z');
  const body = JSON.stringify({ a: 1, client_request_id: 'x', expires_at: '2026-11-27T10:00:15Z' });
  expect(JSON.parse(f(body, at, at + 20_000)!)).toEqual({ a: 1, client_request_id: 'x', expires_at: '2026-11-27T10:00:35Z' });
  expect(JSON.parse(f(JSON.stringify({ expires_at: '2026-11-28T10:00:00Z' }), at, at)!).expires_at, 'never more than 5 min').toBe('2026-11-27T10:05:00Z');
  expect(f(undefined, at, at)).toBeUndefined();
  expect(f(JSON.stringify({ confirmed: true }), at, at), 'no expiry in the body: nothing stale').toBeUndefined();
  expect(f('not json', at, at)).toBeNull();
  expect(f(JSON.stringify({ expires_at: 'soon' }), at, at)).toBeNull();
  expect(f(JSON.stringify({ expires_at: '2026-11-27T09:59:00Z' }), at, at), 'already spent when stamped').toBeNull();
  expect(f(new Blob(['x']), at, at)).toBeNull();
});

test('a settings change confirmed through step-up is still re-sent byte for byte (only physical actions are rebuilt)', async () => {
  setStepUpHandler(async () => true);
  await withFetch((n) => (n === 1 ? { status: 403, body: gate('system.configure') } : { status: 200, body: { saved: true } }), async (calls) => {
    await post('settings/x', { expires_at: '2020-01-01T00:00:00Z', v: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toBe(calls[0].body);
  });
});
