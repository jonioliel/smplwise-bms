import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ApiError, ApiUnreachable, describeError } from '../src/api/client';
import { decodeSegment } from '../src/router';
import type { SocketEnv, SocketLike } from '../src/api/reconnecting-socket';

// LOWS-FRONTEND-2550: the low findings of the 2.52 deep review in the frontend core (FC-07 .. FC-11). Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-core.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// session.ts builds the socket address from document.baseURI (the page's base); Node has no document
(globalThis as unknown as { document?: { baseURI: string } }).document ??= { baseURI: 'http://arx.test/' };

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

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const sockets: FakeSocket[] = [];
  const env: SocketEnv = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => true,
    onResume: () => () => undefined,
    random: () => 0.5,
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
  return { env, advance, sockets };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const bare = (status: number, statusText: string) => new ApiError(status, { code: `http_${status}`, user_message: statusText, retryable: false, correlation_id: '', details: {} });

test.describe('FC-08 describeError', () => {
  test('an answer without the server error model reads as the translated sentence with its status, never `http_502` / "Bad Gateway"', () => {
    expect(describeError(bare(502, ''))).toBe('השרת דחה את הבקשה (502)'); // HTTP/2: no status text
    expect(describeError(bare(502, 'Bad Gateway'))).toBe('השרת דחה את הבקשה (502)'); // HTTP/1.1: English status text
    expect(describeError(bare(422, 'Unprocessable Entity'))).toBe('השרת דחה את הבקשה (422)');
    // the server's own error model is untouched
    expect(describeError(new ApiError(409, { code: 'item_changed', user_message: 'השתנה', retryable: false, correlation_id: '', details: {} }))).toBe('השתנה');
    expect(describeError(new ApiError(409, { code: 'item_changed', user_message: '', retryable: false, correlation_id: '', details: {} }))).toBe('item_changed');
  });

  test('"no connection" only for a request that got no answer - a programming TypeError says what it is', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toBe('אין חיבור לשרת.'); // Chrome / Edge
    expect(describeError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('אין חיבור לשרת.'); // Firefox
    expect(describeError(new TypeError('Load failed'))).toBe('אין חיבור לשרת.'); // Safari
    expect(describeError(new ApiUnreachable('timeout'))).toBe('אין חיבור לשרת.');
    expect(describeError(new ApiUnreachable('signin_unreachable'))).toBe('אין חיבור לשרת.');
    const bug = new TypeError("Cannot read properties of null (reading 'items')");
    expect(describeError(bug)).toBe("Cannot read properties of null (reading 'items')");
  });
});

test.describe('FC-10 route segments', () => {
  test('a malformed escape is kept as written instead of throwing during render', () => {
    expect(decodeSegment('50%')).toBe('50%');
    expect(decodeSegment('%E0%A4%A')).toBe('%E0%A4%A');
    expect(decodeSegment('%D7%97%D7%93%D7%A8')).toBe('חדר');
    expect(decodeSegment('a%2Fb')).toBe('a/b');
  });

  test('the shell decodes no route segment with the throwing decoder', () => {
    expect(src('shell/sw-app.ts')).not.toMatch(/decodeURIComponent\(s\[/);
    expect(src('shell/sw-app.ts').match(/decodeSegment\(s\[2\]/g)?.length).toBe(3);
  });
});

test.describe('FC-07 the personal language after the remote sign-in', () => {
  test('the remote start-up reads the language again once the session exists (after the shell is mounted)', () => {
    const boot = src('arx/boot.ts');
    const start = boot.slice(boot.indexOf('async function startApp'), boot.indexOf('function showLogin'));
    expect(start).toMatch(/mountShell\(\);[\s\S]*syncUiLang\(\)/);
    expect(boot).toMatch(/import \{ syncUiLang \} from '\.\.\/i18n\/ui-lang';/);
  });
});

test.describe('FC-09 / FC-11 the /me/ws channel', () => {
  test('FC-09: a listener that throws skips neither the permissions check nor the listeners after it, and is logged', async () => {
    const { watchPermissions, onMeEvent } = await import('../src/api/session');
    const f = fakeEnv();
    const changes: number[] = [];
    const seen: string[] = [];
    const errors: unknown[][] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errors.push(a);
    const off1 = onMeEvent(() => {
      throw new Error('listener bug');
    });
    const off2 = onMeEvent((e) => seen.push(e.type));
    const stop = watchPermissions(() => changes.push(1), f.env, async () => ({ mode: 'api' }) as never);
    try {
      f.sockets[0].open();
      f.sockets[0].frame('{"type":"permissions_changed"}');
      expect(changes).toHaveLength(1);
      expect(seen).toEqual(['permissions_changed']);
      expect(errors).toHaveLength(1);
      f.sockets[0].frame('not json'); // a malformed frame is still ignored quietly
      expect(errors).toHaveLength(1);
      expect(changes).toHaveLength(1);
    } finally {
      console.error = orig;
      off1();
      off2();
      stop();
    }
  });

  test('FC-11: a 4401 close stops the reconnect loop and reads the session; a signed-out session keeps the channel closed', async () => {
    const { watchPermissions } = await import('../src/api/session');
    const f = fakeEnv();
    let reads = 0;
    const stop = watchPermissions(() => undefined, f.env, async () => {
      reads += 1;
      return { mode: 'unauthenticated' } as never;
    });
    f.sockets[0].open();
    f.sockets[0].drop(4401);
    await flush();
    expect(reads).toBe(1);
    f.advance(10 * 60_000); // ten minutes: no new socket
    expect(f.sockets).toHaveLength(1);
    stop();
  });

  test('FC-11: when the session is still signed in after the read (the remote channel renewed it) the channel opens again, with back-off', async () => {
    const { watchPermissions } = await import('../src/api/session');
    const f = fakeEnv();
    let reads = 0;
    const stop = watchPermissions(() => undefined, f.env, async () => {
      reads += 1;
      return { mode: 'api' } as never;
    });
    f.sockets[0].drop(4401);
    await flush();
    expect(reads).toBe(1);
    f.advance(1_999);
    expect(f.sockets).toHaveLength(1);
    f.advance(1);
    expect(f.sockets).toHaveLength(2); // 2 s
    f.sockets[1].drop(4401); // refused again: the wait doubles
    await flush();
    f.advance(3_999);
    expect(f.sockets).toHaveLength(2);
    f.advance(1);
    expect(f.sockets).toHaveLength(3); // 4 s
    stop();
    f.sockets[2].drop(4401);
    await flush();
    f.advance(10 * 60_000);
    expect(f.sockets).toHaveLength(3); // stopped: nothing reopens
  });

  test('an ordinary drop (1006) still reconnects by itself and does not read the session', async () => {
    const { watchPermissions } = await import('../src/api/session');
    const f = fakeEnv();
    let reads = 0;
    const stop = watchPermissions(() => undefined, f.env, async () => {
      reads += 1;
      return { mode: 'api' } as never;
    });
    f.sockets[0].drop(1006);
    await flush();
    f.advance(2_000);
    expect(f.sockets).toHaveLength(2);
    expect(reads).toBe(0);
    stop();
  });
});

test.describe('FC-09 the ha/ws frames', () => {
  test('an error thrown by the screen handler is logged (not swallowed) and the next frames still arrive', async () => {
    const { subscribeHa } = await import('../src/api/ha');
    const f = fakeEnv();
    const got: string[] = [];
    const errors: unknown[][] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errors.push(a);
    let fail = true;
    const stop = subscribeHa(
      (m) => {
        got.push(m.type);
        if (fail) {
          fail = false;
          throw new Error('screen bug');
        }
      },
      undefined,
      f.env,
    );
    try {
      f.sockets[0].open();
      f.sockets[0].frame('{"type":"schedules_changed","payload":{}}');
      f.sockets[0].frame('{"type":"media_groups_changed","payload":{}}');
      f.sockets[0].frame('{oops');
      expect(got).toEqual(['schedules_changed', 'media_groups_changed']);
      expect(errors).toHaveLength(1);
    } finally {
      console.error = orig;
      stop();
    }
  });
});
