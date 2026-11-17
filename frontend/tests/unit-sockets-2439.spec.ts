import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SocketEnv, SocketLike } from '../src/api/reconnecting-socket';
import { subscribeEvents } from '../src/api/events';
import { haPushLive, onEntityPush, subscribeHa, SILENT_MS, type HaPush } from '../src/api/ha';
import { subscribeIntercom, type IntercomPush } from '../src/api/intercom';
import { schedulesSocket } from '../src/api/schedules';
import { openSessionSocket } from '../src/wiskey/session-socket';
import type { SocketLike as SessionSocket } from '../src/wiskey/talk-session';

// CR-SOCKETS-2439 (review 07:F6 remaining sockets, 08:F24): /events/ws, /ha/ws (the push socket and the schedules' own), /intercom/ws on
// the shared reconnecting socket (api/reconnecting-socket.ts, SESSION-DEMO-WS-2435); the WisKey sessions' shared socket start.
// A fake clock, fake page events and fake sockets per adopter (the pattern of unit-reconnecting-socket-2435.spec.ts). Node only.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

class FakeSocket implements SocketLike {
  readyState = 0;
  closed = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  send(type: string, payload: unknown = {}) {
    this.onmessage?.({ data: JSON.stringify({ version: 1, type, payload }) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true };
  let onResume: () => void = () => undefined;
  let registered = 0;
  const sockets: FakeSocket[] = [];
  const env: SocketEnv = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    onResume: (a) => {
      onResume = a;
      registered++;
      return () => {
        registered--;
        onResume = () => undefined;
      };
    },
    random: () => 0.5, // no jitter
    create: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = end;
  };
  const last = () => sockets[sockets.length - 1];
  return { env, state, advance, sockets, last, resume: () => onResume(), pending: () => timers.size, listeners: () => registered };
}

/** wsUrl() resolves against document.baseURI: a minimal document for the duration of a test. */
function withDocument<T>(fn: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const saved = g.document;
  g.document = { baseURI: 'https://arx.example/app/' };
  try {
    return fn();
  } finally {
    if (saved === undefined) delete g.document;
    else g.document = saved;
  }
}

test.describe('/events/ws (api/events.ts subscribeEvents)', () => {
  test('frames, connected state, reconnect 2 s .. 30 s, a silent socket replaced, stop leaves nothing', () => {
    const f = fakeEnv();
    const events: string[] = [];
    const states: string[] = [];
    const stop = withDocument(() =>
      subscribeEvents((e) => events.push(String((e as { id: string }).id)), (s, c) => states.push(`${s ? 'ingest' : 'null'}:${c}`), f.env),
    );
    expect(f.sockets).toHaveLength(1);
    expect(f.last().url).toBe('wss://arx.example/app/api/v1/events/ws');
    f.last().open();
    f.last().send('event_added', { id: 'e1' });
    f.last().send('event_updated', { id: 'e2' });
    f.last().send('heartbeat', { ingest: { ok: true } });
    f.last().onmessage?.({ data: 'not json' }); // ignored
    expect(events).toEqual(['e1', 'e2']);
    expect(states).toEqual(['null:true', 'ingest:true']);
    // closes: reconnect after 2 s, then 4, 8, 16, 30 (capped as before), 30
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const n = f.sockets.length;
      f.last().drop();
      let waited = 0;
      while (f.sockets.length === n) {
        f.advance(1_000);
        waited += 1_000;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    expect(states.filter((s) => s === 'null:false')).toHaveLength(6);
    // a socket that opened, then went silent (half-open after a phone slept): replaced by the watchdog, no close event needed
    f.last().open();
    const before = f.sockets.length;
    f.advance(100_000);
    expect(f.sockets.length).toBeGreaterThan(before);
    expect(f.sockets[before - 1].closed).toBe(true);
    stop();
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);
    expect(f.last().closed).toBe(true);
    const n = f.sockets.length;
    f.advance(600_000);
    expect(f.sockets.length).toBe(n);
  });
});

test.describe('/intercom/ws (api/intercom.ts subscribeIntercom)', () => {
  test('the four frame types, connected state, no reconnect after 4403 / 4401, reconnect otherwise', () => {
    for (const final of [4403, 4401]) {
      const f = fakeEnv();
      const got: IntercomPush['type'][] = [];
      const socket: boolean[] = [];
      const stop = withDocument(() => subscribeIntercom((m) => got.push(m.type), (c) => socket.push(c), f.env));
      expect(f.last().url).toBe('wss://arx.example/app/api/v1/intercom/ws');
      f.last().open();
      f.last().send('intercom_refresh');
      f.last().send('intercom_state', { state: 'ok' });
      f.last().send('intercom_tts', { id: 't' });
      f.last().send('heartbeat');
      expect(got).toEqual(['intercom_refresh', 'intercom_state', 'intercom_tts', 'heartbeat']);
      f.last().drop(1006);
      f.advance(2_000);
      expect(f.sockets).toHaveLength(2);
      f.last().open();
      f.last().drop(final);
      f.advance(120_000);
      f.resume();
      expect(f.sockets).toHaveLength(2); // final: never again
      expect(socket).toEqual([true, false, true, false]);
      stop();
      expect(f.pending()).toBe(0);
      expect(f.listeners()).toBe(0);
    }
  });
});

test.describe('the schedules socket (api/schedules.ts schedulesSocket)', () => {
  test('schedule frames are throttled to one call a second; other entities are ignored; stop cancels a pending call', () => {
    const f = fakeEnv();
    let calls = 0;
    const socket: boolean[] = [];
    const stop = withDocument(() => schedulesSocket(() => calls++, (c) => socket.push(c), f.env));
    expect(f.last().url).toBe('wss://arx.example/app/api/v1/ha/ws');
    f.last().open();
    f.last().send('schedules_changed');
    f.last().send('entity_state_changed', { entity: { entity_id: 'switch.schedule_lobby' } });
    f.last().send('entity_state_changed', { entity: { entity_id: 'light.lobby' } });
    expect(calls).toBe(0);
    f.advance(1_000);
    expect(calls).toBe(1); // three frames, one call
    f.last().send('schedules_changed');
    stop();
    f.advance(5_000);
    expect(calls).toBe(1); // the pending call died with the subscription
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);
    expect(socket).toEqual([true]);
  });

  test('no reconnect after 4401; a constructor that throws is retried', () => {
    const f = fakeEnv();
    let throws = 1;
    const create = f.env.create;
    f.env.create = (url) => {
      if (throws-- > 0) throw new Error('refused');
      return create(url);
    };
    const stop = withDocument(() => schedulesSocket(() => undefined, undefined, f.env));
    expect(f.sockets).toHaveLength(0);
    f.advance(2_000);
    expect(f.sockets).toHaveLength(1); // retried (it used to end the loop for good)
    f.last().open();
    f.last().drop(4401);
    f.advance(120_000);
    expect(f.sockets).toHaveLength(1);
    stop();
  });
});

test.describe('/ha/ws (api/ha.ts subscribeHa)', () => {
  test('the HOMELIVE timings are kept: SILENT_MS is the silence limit', () => {
    expect(SILENT_MS).toBe(75_000);
    const ha = src('api/ha.ts');
    expect(ha).toMatch(/silentMs: SILENT_MS,\s*connectMs: CONNECT_MS,\s*watchdogMs: WATCHDOG_MS,/);
    expect(ha).toContain('const CONNECT_MS = 20_000;');
    expect(ha).toContain('const WATCHDOG_MS = 20_000;');
    expect(ha).toContain('maxDelayMs: 30_000');
  });

  test('frames reach the listener (entity pushes the command listeners first); haPushLive counts open sockets; close, watchdog and stop release the count', () => {
    const f = fakeEnv();
    const got: HaPush['type'][] = [];
    const pushed: string[] = [];
    const socket: boolean[] = [];
    const off = onEntityPush((e) => pushed.push(e.entity_id));
    const base = haPushLive();
    expect(base).toBe(false);
    const stop = withDocument(() => subscribeHa((m) => got.push(m.type), (c) => socket.push(c), f.env));
    expect(f.last().url).toBe('wss://arx.example/app/api/v1/ha/ws');
    expect(haPushLive()).toBe(false); // connecting does not count
    f.last().open();
    expect(haPushLive()).toBe(true);
    f.last().send('entity_state_changed', { entity: { entity_id: 'light.a', state: 'on' } });
    f.last().send('heartbeat', { sync: {} });
    f.last().send('cast_sessions_changed', { reason: 'x' });
    expect(got).toEqual(['entity_state_changed', 'heartbeat', 'cast_sessions_changed']);
    expect(pushed).toEqual(['light.a']);
    // a close: not live, reconnect after the back-off
    f.last().drop();
    expect(haPushLive()).toBe(false);
    f.advance(2_000);
    expect(f.sockets).toHaveLength(2);
    f.last().open();
    expect(haPushLive()).toBe(true);
    // silent past SILENT_MS (heartbeats stopped): the watchdog releases it and connects again at once
    f.advance(SILENT_MS + 20_000);
    expect(f.sockets[1].closed).toBe(true);
    expect(f.sockets.length).toBe(3);
    expect(haPushLive()).toBe(false);
    f.last().open();
    expect(haPushLive()).toBe(true);
    stop();
    expect(haPushLive()).toBe(false); // the stopped socket no longer counts
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);
    expect(socket).toEqual([true, false, true, false, true]);
    off();
  });

  test('two subscribers: the count follows each socket; no reconnect after 4403', () => {
    const a = fakeEnv();
    const b = fakeEnv();
    const sa = withDocument(() => subscribeHa(() => undefined, undefined, a.env));
    const sb = withDocument(() => subscribeHa(() => undefined, undefined, b.env));
    a.last().open();
    b.last().open();
    a.last().drop(4403);
    a.advance(120_000);
    a.resume();
    expect(a.sockets).toHaveLength(1);
    expect(haPushLive()).toBe(true); // b is still open
    sb();
    expect(haPushLive()).toBe(false);
    sa();
  });
});

test.describe('no hand-written socket loop left', () => {
  for (const f of ['api/events.ts', 'api/ha.ts', 'api/intercom.ts', 'api/schedules.ts']) {
    test(`${f}: on the shared reconnecting socket`, () => {
      const s = src(f);
      expect(s).toContain("from './reconnecting-socket'");
      expect(s).toContain('openReconnectingSocket({');
      expect(s).not.toMatch(/new WebSocket\(/);
      expect(s).not.toMatch(/window\.setTimeout\(open/);
    });
  }
});

class FakeSessionSocket {
  binaryType = 'blob';
  readyState = 0;
  send() {}
  close() {}
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
}

test.describe('WisKey sessions: the shared socket start (wiskey/session-socket.ts)', () => {
  test('opens on the reply path with binary frames', () => {
    const paths: string[] = [];
    const sock = new FakeSessionSocket();
    const ws = openSessionSocket(
      { socket: (p) => (paths.push(p), sock as unknown as SessionSocket), stop: async () => undefined },
      { session: 's1', ws_path: '/api/v1/x/ws' },
      () => {
        throw new Error('not expected');
      },
    );
    expect(ws).toBe(sock as unknown as SessionSocket);
    expect(paths).toEqual(['/api/v1/x/ws']);
    expect(sock.binaryType).toBe('arraybuffer');
  });

  test('a constructor that throws stops the server session and fails with the caller\'s handler', async () => {
    const stopped: string[] = [];
    let failed = 0;
    const ws = openSessionSocket(
      {
        socket: () => {
          throw new Error('refused');
        },
        stop: async (s) => void stopped.push(s),
      },
      { session: 's2', ws_path: '/p' },
      () => failed++,
    );
    await Promise.resolve();
    expect(ws).toBeNull();
    expect(failed).toBe(1);
    expect(stopped).toEqual(['s2']);
  });

  test('both sessions use it; the copied block is gone', () => {
    for (const f of ['wiskey/listen-session.ts', 'wiskey/talk-session.ts']) {
      const s = src(f);
      expect(s).toContain("const ws = openSessionSocket(this.deps, reply, () => this.fail('network'));");
      expect(s).not.toContain('ws = this.deps.socket(reply.ws_path);');
    }
  });
});
