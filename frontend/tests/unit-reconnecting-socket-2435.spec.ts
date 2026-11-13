import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SOCKET_CONNECT_MS, SOCKET_MIN_DELAY_MS, SOCKET_SILENT_MS, SOCKET_WATCHDOG_MS, openReconnectingSocket, type SocketEnv, type SocketLike } from '../src/api/reconnecting-socket';

// SESSION-DEMO-WS-2435: the shared reconnecting socket (api/reconnecting-socket.ts) that /me/ws now uses - a fake clock, fake page events
// and fake sockets (the LiveEnv pattern of unit-live-refresh-295.spec.ts). Runs in Node; no page.
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
  frame(data: string) {
    this.onmessage?.({ data });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function fakeEnv(opts: { throws?: () => boolean } = {}) {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true };
  let onResume: () => void = () => undefined;
  let onOnline: () => void = () => undefined;
  let registered = 0;
  const sockets: FakeSocket[] = [];
  let attempts = 0;
  const env: SocketEnv = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    onResume: (a, b) => {
      onResume = a;
      onOnline = b;
      registered++;
      return () => {
        registered--;
        onResume = onOnline = () => undefined;
      };
    },
    random: () => 0.5, // no jitter
    create: (url) => {
      attempts++;
      if (opts.throws?.()) throw new Error('SecurityError: the constructor refused');
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
  return { env, state, advance, sockets, attempts: () => attempts, resume: () => onResume(), online: () => onOnline(), pending: () => timers.size, listeners: () => registered };
}

test.describe('SESSION-DEMO-WS-2435 reconnecting socket', () => {
  test('a constructor that throws is retried with back-off (it used to end the loop for good)', () => {
    let fail = 2;
    const f = fakeEnv({ throws: () => fail-- > 0 });
    const downs: number[] = [];
    const stop = openReconnectingSocket({ url: 'ws://x/api/v1/me/ws', env: f.env, onMessage: () => undefined, onDown: () => downs.push(1) });
    expect(f.attempts()).toBe(1);
    expect(f.sockets).toHaveLength(0);
    f.advance(SOCKET_MIN_DELAY_MS - 1);
    expect(f.attempts()).toBe(1);
    f.advance(1);
    expect(f.attempts()).toBe(2); // second throw: the next wait doubles
    f.advance(SOCKET_MIN_DELAY_MS * 2);
    expect(f.attempts()).toBe(3);
    expect(f.sockets).toHaveLength(1);
    expect(downs).toHaveLength(2);
    const got: string[] = [];
    stop();
    // a fresh run delivers the frames of the socket that finally opened
    const g = fakeEnv({ throws: (() => { let n = 1; return () => n-- > 0; })() });
    const stop2 = openReconnectingSocket({ url: 'ws://x', env: g.env, onMessage: (d) => got.push(d) });
    g.advance(SOCKET_MIN_DELAY_MS);
    g.sockets[0].open();
    g.sockets[0].frame('{"type":"hello"}');
    expect(got).toEqual(['{"type":"hello"}']);
    stop2();
  });

  test('a silent (half-open) socket is released and replaced after missed heartbeats', () => {
    const f = fakeEnv();
    const got: string[] = [];
    const stop = openReconnectingSocket({ url: 'ws://x', env: f.env, onMessage: (d) => got.push(d) });
    const first = f.sockets[0];
    first.open();
    // heartbeats every 30 s keep it
    for (let i = 0; i < 4; i++) {
      f.advance(30_000);
      first.frame('{"type":"heartbeat"}');
    }
    expect(f.sockets).toHaveLength(1);
    expect(first.closed).toBe(false);
    // then nothing: no close event (a phone that slept) - the watchdog notices past SOCKET_SILENT_MS
    f.advance(SOCKET_SILENT_MS);
    expect(f.sockets).toHaveLength(1);
    f.advance(SOCKET_WATCHDOG_MS);
    expect(f.sockets).toHaveLength(2);
    expect(first.closed).toBe(true);
    expect(first.onmessage).toBeNull(); // its handlers went quiet
    const second = f.sockets[1];
    second.open();
    second.frame('{"type":"hello"}');
    expect(got.at(-1)).toBe('{"type":"hello"}');
    stop();
  });

  test('resume on visible checks at once; a socket stuck connecting is replaced; online forces a non-open socket', () => {
    const f = fakeEnv();
    const stop = openReconnectingSocket({ url: 'ws://x', env: f.env, onMessage: () => undefined });
    f.sockets[0].open();
    f.state.visible = false;
    f.advance(SOCKET_SILENT_MS + SOCKET_WATCHDOG_MS * 2); // hidden: the watchdog does not act
    expect(f.sockets).toHaveLength(1);
    f.state.visible = true;
    f.resume();
    expect(f.sockets).toHaveLength(2); // the resume check replaced the silent socket now
    // the new one never opens
    f.advance(SOCKET_CONNECT_MS + SOCKET_WATCHDOG_MS);
    expect(f.sockets.length).toBeGreaterThanOrEqual(3);
    const n = f.sockets.length;
    f.online(); // the latest is still CONNECTING: online forces a fresh one
    expect(f.sockets).toHaveLength(n + 1);
    f.sockets.at(-1)!.open();
    f.online(); // an OPEN socket is kept
    expect(f.sockets).toHaveLength(n + 1);
    stop();
  });

  test('close -> back-off doubles (capped), resets after a good open; a closed socket waits for its back-off, resume skips it', () => {
    const f = fakeEnv();
    const stop = openReconnectingSocket({ url: 'ws://x', env: f.env, onMessage: () => undefined, maxDelayMs: 8_000 });
    f.sockets[0].drop();
    f.advance(2_000);
    expect(f.sockets).toHaveLength(2);
    f.sockets[1].drop();
    f.advance(3_999);
    expect(f.sockets).toHaveLength(2);
    f.advance(1);
    expect(f.sockets).toHaveLength(3);
    f.sockets[2].drop();
    f.advance(SOCKET_WATCHDOG_MS - 1); // the watchdog does not shortcut the back-off (8 s here, capped)
    expect(f.sockets).toHaveLength(4);
    f.sockets[3].drop();
    f.resume(); // the page came back: a closed socket waiting for its (possibly frozen) timer reconnects now
    expect(f.sockets).toHaveLength(5);
    f.sockets[4].open();
    f.sockets[4].drop();
    f.advance(SOCKET_MIN_DELAY_MS);
    expect(f.sockets).toHaveLength(6); // back to the first step after a good open
    stop();
  });

  test('finalClose stops reconnecting; stop() leaves no timer, listener or socket', () => {
    const f = fakeEnv();
    const stop = openReconnectingSocket({ url: 'ws://x', env: f.env, onMessage: () => undefined, finalClose: (c) => c === 4403 });
    f.sockets[0].drop(4403);
    f.advance(120_000);
    f.resume();
    expect(f.sockets).toHaveLength(1);
    stop();
    expect(f.pending()).toBe(0);
    expect(f.listeners()).toBe(0);

    const g = fakeEnv();
    const stop2 = openReconnectingSocket({ url: 'ws://x', env: g.env, onMessage: () => undefined });
    g.sockets[0].open();
    stop2();
    expect(g.sockets[0].closed).toBe(true);
    expect(g.pending()).toBe(0);
    expect(g.listeners()).toBe(0);
    g.advance(600_000);
    expect(g.sockets).toHaveLength(1);
  });

  test('/me/ws uses the shared socket (watchPermissions), the hand-rolled loop is gone', () => {
    const s = src('api/session.ts');
    expect(s).toContain("openReconnectingSocket({");
    expect(s).toContain("wsUrl('me/ws')");
    expect(s).not.toContain('new WebSocket(');
  });
});
