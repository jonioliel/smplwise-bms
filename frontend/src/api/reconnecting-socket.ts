/**
 * SESSION-DEMO-WS-2435: one reconnecting WebSocket with a liveness check - the pattern `api/ha.ts` `subscribeHa` proved in
 * HOMELIVE-295, as a helper the hand-written sockets can share (`api/session.ts` `/me/ws` first).
 *
 * - Reconnect on close with back-off (min -> x2 -> max) and a small jitter, so a restarted add-on is not hit by every tab at once.
 * - A constructor that throws (a bad URL, the browser's socket limit) schedules the same reconnect instead of ending for good.
 * - Watchdog: the server sends a frame at least every heartbeat; a socket OPEN but silent for longer than `silentMs`, or CONNECTING
 *   for longer than `connectMs`, is half-open (a phone that slept never gets a close event) - it is released at once and replaced.
 * - Resume: on visible / focus / pageshow the same check runs now; on `online` a socket that is not OPEN reconnects now.
 * - `stop()` ends everything: no timer, no listener and no socket stays behind.
 *
 * The clock, the timers, the page events and the WebSocket constructor come from `SocketEnv`, so the unit spec drives it with a
 * fake clock and fake sockets (the `LiveEnv` pattern of `api/live-refresh.ts`).
 */
import { apiUrl } from './client';

/** The part of a WebSocket the helper uses (a real `WebSocket` satisfies it). */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  close(): void;
}

export interface SocketEnv {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  visible(): boolean;
  /** Registers the resume events (`onResume`: the page is visible again; `onOnline`: the network is back); returns the unregister function. */
  onResume(onResume: () => void, onOnline: () => void): () => void;
  random(): number;
  create(url: string): SocketLike;
}

export interface ReconnectingSocketOptions {
  /** The absolute ws(s):// address (see `wsUrl`). */
  url: string;
  /** Every frame's text, as received (the caller parses its own envelope). */
  onMessage(data: string): void;
  onOpen?(): void;
  /** The socket went away (closed, released by the watchdog, or the constructor threw); a reconnect is scheduled unless stopped. */
  onDown?(): void;
  /** A close code after which no reconnect is attempted (e.g. 4403). Default: always reconnect. */
  finalClose?(code: number): boolean;
  minDelayMs?: number;
  maxDelayMs?: number;
  silentMs?: number;
  connectMs?: number;
  watchdogMs?: number;
  env?: SocketEnv;
}

/** WebSocket readyState values (the constants of the DOM interface; Node has no global WebSocket in every version). */
const CONNECTING = 0;
const OPEN = 1;

/** HOMELIVE-295 values: the servers' heartbeat is every 30 s (ha/ws, me/ws). */
export const SOCKET_SILENT_MS = 75_000;
export const SOCKET_CONNECT_MS = 20_000;
export const SOCKET_WATCHDOG_MS = 20_000;
export const SOCKET_MIN_DELAY_MS = 2_000;
export const SOCKET_MAX_DELAY_MS = 60_000;
const JITTER = 0.2;

/** `api/v1/<path>` of this page as a ws:// or wss:// address. */
export function wsUrl(path: string): string {
  const u = new URL(apiUrl(path));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

function browserEnv(): SocketEnv {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    visible: () => document.visibilityState !== 'hidden',
    onResume(fn, onOnline) {
      const vis = () => {
        if (document.visibilityState !== 'hidden') fn();
      };
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('focus', fn);
      window.addEventListener('pageshow', fn);
      window.addEventListener('online', onOnline);
      return () => {
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('focus', fn);
        window.removeEventListener('pageshow', fn);
        window.removeEventListener('online', onOnline);
      };
    },
    random: () => Math.random(),
    create: (url) => new WebSocket(url) as unknown as SocketLike,
  };
}

/** Opens the socket and keeps it alive; returns the stop function. */
export function openReconnectingSocket(opts: ReconnectingSocketOptions): () => void {
  const env = opts.env ?? browserEnv();
  const minDelay = opts.minDelayMs ?? SOCKET_MIN_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? SOCKET_MAX_DELAY_MS;
  const silentMs = opts.silentMs ?? SOCKET_SILENT_MS;
  const connectMs = opts.connectMs ?? SOCKET_CONNECT_MS;
  const watchdogMs = opts.watchdogMs ?? SOCKET_WATCHDOG_MS;
  let ws: SocketLike | null = null;
  let stopped = false;
  let delay = minDelay;
  let retry: unknown = null;
  let watchdog: unknown = null;
  let lastFrameAt = env.now();

  const clearRetry = () => {
    if (retry !== null) env.clearTimeout(retry);
    retry = null;
  };
  /** Let go of the current socket at once: its handlers go quiet (a half-open one never says close). */
  const release = () => {
    const sock = ws;
    ws = null;
    if (!sock) return;
    sock.onopen = sock.onmessage = sock.onclose = null;
    try {
      sock.close();
    } catch {
      /* already gone */
    }
  };
  const schedule = () => {
    if (stopped) return;
    clearRetry();
    const wait = Math.round(delay * (1 + (env.random() * 2 - 1) * JITTER));
    retry = env.setTimeout(() => {
      retry = null;
      open();
    }, wait);
    delay = Math.min(maxDelay, delay * 2);
  };
  const open = () => {
    if (stopped) return;
    let sock: SocketLike;
    try {
      sock = env.create(opts.url);
    } catch {
      ws = null;
      opts.onDown?.();
      schedule(); // SESSION-DEMO-WS-2435: a throw used to end the loop for good
      return;
    }
    ws = sock;
    lastFrameAt = env.now();
    sock.onopen = () => {
      lastFrameAt = env.now();
      delay = minDelay;
      opts.onOpen?.();
    };
    sock.onmessage = (m) => {
      lastFrameAt = env.now();
      opts.onMessage(typeof m.data === 'string' ? m.data : String(m.data));
    };
    sock.onclose = (ev) => {
      if (ws === sock) ws = null;
      opts.onDown?.();
      if (!stopped && !(opts.finalClose?.(ev?.code ?? 0) ?? false)) schedule();
    };
  };
  /** Replace the socket now when it is gone (closed and waiting for its back-off: on resume only - a frozen timer), silent past
   * `silentMs`, stuck connecting past `connectMs` or (forced) simply not OPEN. */
  const revive = (force: boolean, watchdogTick = false) => {
    if (stopped) return;
    if (!ws && retry === null) return; // a final close: nothing to revive
    if (!ws && watchdogTick) return; // waiting for its back-off: the timer runs, the back-off stays
    const age = env.now() - lastFrameAt;
    const dead = !ws;
    const silent = !!ws && ws.readyState === OPEN && age > silentMs;
    const stuck = !!ws && ws.readyState === CONNECTING && age > connectMs;
    if (!(dead || silent || stuck || (force && !!ws && ws.readyState !== OPEN))) return;
    const hadSocket = !!ws;
    clearRetry();
    release();
    if (hadSocket) opts.onDown?.();
    delay = minDelay;
    open();
  };
  const tick = () => {
    watchdog = env.setTimeout(tick, watchdogMs);
    if (env.visible()) revive(false, true);
  };
  const offResume = env.onResume(
    () => revive(false),
    () => revive(true),
  );
  watchdog = env.setTimeout(tick, watchdogMs);
  open();
  return () => {
    stopped = true;
    clearRetry();
    if (watchdog !== null) env.clearTimeout(watchdog);
    watchdog = null;
    offResume();
    release();
  };
}
