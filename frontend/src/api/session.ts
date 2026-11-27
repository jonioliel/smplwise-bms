/**
 * Session state: who the backend says we are, or "demo" when no backend answers (static preview,
 * design review). Screens read `session` and subscribe to changes; demo fixtures stay available so the
 * skeleton screens keep working without a server. SESSION-DEMO-WS-2435: a failed /me shows the demo only when no backend can be
 * behind the page (`demoOnMeFailure`); otherwise the session stays connecting and asks again.
 */
import { ApiError, get } from './client';
import { ALL_CAPABILITIES, resolveCapabilities, type Capabilities, type CapabilityName } from './capabilities';
import type { Me } from './types';
import { webrtcServerReady } from './camera-visibility';
import { isRemoteChannel, remoteBase } from '../arx/channel';
import { openReconnectingSocket, wsUrl, type SocketEnv } from './reconnecting-socket';
import { syncNativeSession, type NativeSignOutReason } from '../arx/native-app';
import { setBrandView } from '../design/brand-logo';
import { tr } from '../i18n/msg/api-core';

export type SessionMode = 'loading' | 'api' | 'demo' | 'unauthenticated' | 'no_access';

export interface Session {
  mode: SessionMode;
  me: Me | null;
  error: string | null;
  /** NN1: what the installation has (derived from `me`; everything on without a backend). */
  capabilities: Capabilities;
  /** SESSION-DEMO-WS-2435: `loading` because /me failed while a backend is there (a 502 while the add-on restarts); asked again
   * with back-off (ME_RETRY_MS). Nothing is granted meanwhile: no demo data, every capability off. */
  retrying?: boolean;
}

/** SESSION-DEMO-WS-2435: the capabilities while connecting after a failed /me - nothing is granted. */
const NO_CAPABILITIES: Capabilities = Object.fromEntries(Object.entries(ALL_CAPABILITIES).map(([k, v]) => [k, typeof v === 'boolean' ? false : v])) as unknown as Capabilities;

const listeners = new Set<(s: Session) => void>();
export let session: Session = { mode: 'loading', me: null, error: null, capabilities: ALL_CAPABILITIES };

/** SX-10: the native shell's reason for a 401 from the server (the only path that may say `expired`). */
function nativeReasonOf401(code: string | undefined): NativeSignOutReason {
  return code === 'remote_login_required' ? 'expired' : 'unknown'; // remote_session_revoked and the rest: no silent re-exchange
}

function set(next: Omit<Session, 'capabilities'>, reason: NativeSignOutReason = 'unknown') {
  const retrying = next.mode === 'loading' && !!next.retrying;
  session = { mode: next.mode, me: next.me, error: next.error, capabilities: retrying ? NO_CAPABILITIES : resolveCapabilities(next.me), ...(retrying ? { retrying: true } : {}) };
  // MOBILE214: a hint to the native app (it verifies the identity itself); only a verified, allowed session counts as signed in
  if (next.mode === 'api' && next.me) syncNativeSession(next.me.user.id);
  else if (next.mode === 'unauthenticated') syncNativeSession(null, undefined, reason);
  listeners.forEach((fn) => fn(session));
}

export function onSession(fn: (s: Session) => void): () => void {
  listeners.add(fn);
  fn(session);
  return () => listeners.delete(fn);
}

/** SESSION-DEMO-WS-2435: the retry schedule of a /me that failed while a backend is (or may be) there: 1 s, 2 s, 4 s, then every 10 s. */
const ME_RETRY_MS = [1_000, 2_000, 4_000, 10_000] as const;

/** Statuses a gateway answers while the backend behind it is restarting or unreachable (HA Ingress: 502 while the add-on restarts). */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * SESSION-DEMO-WS-2435: may this failed `GET /me` show the static demo? Only when no backend can be behind the page:
 *
 * - never under HA Ingress (`/api/hassio_ingress/<token>/`) or on the remote channel (`/arx/`): a real installation, so every failure
 *   there (502 while the add-on restarts, a phone that is offline) is transient;
 * - at the origin root (the static preview, design review, the Playwright preview without a backend): yes for a network failure (the
 *   specs abort `/api/v1`), for the preview proxy's own answer when nothing listens behind it (a bare 500 with no error body), and for a
 *   4xx such as a fixture's catch-all 404 - as before;
 * - but not for a gateway status (502/503/504) or a 5xx carrying the server's error model: a backend exists and is failing for now.
 *
 * A 401 never reaches here (it is `unauthenticated`).
 */
export function demoOnMeFailure(err: unknown, path: string = typeof window === 'undefined' ? '/' : window.location.pathname): boolean {
  if (path.startsWith('/api/hassio_ingress/') || remoteBase(path) !== null) return false;
  if (!(err instanceof ApiError)) return true; // TypeError: nothing answered at all
  if (GATEWAY_STATUSES.has(err.status)) return false;
  if (err.status >= 500 && serverErrorModel(err)) return false;
  return true;
}

/** The body is the server's error model (client.ts synthesises `http_<status>` when the answer was not JSON). */
function serverErrorModel(err: ApiError): boolean {
  const code = err.body?.code;
  return typeof code === 'string' && code !== '' && code !== `http_${err.status}`;
}

let retryTimer: number | null = null;
let retryAttempt = 0;
let retryOnline: (() => void) | null = null;

function clearMeRetry() {
  if (retryTimer !== null) window.clearTimeout(retryTimer);
  retryTimer = null;
  if (retryOnline) window.removeEventListener('online', retryOnline);
  retryOnline = null;
}

function scheduleMeRetry() {
  clearMeRetry();
  const wait = ME_RETRY_MS[Math.min(retryAttempt, ME_RETRY_MS.length - 1)];
  retryAttempt++;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void loadSession();
  }, wait);
  retryOnline = () => void loadSession(); // the network is back: ask now
  window.addEventListener('online', retryOnline, { once: true });
}

export async function loadSession(): Promise<Session> {
  clearMeRetry();
  try {
    const me = await get<Me>('me');
    retryAttempt = 0;
    setBrandView(me.brand); // LOGOS-295: the company logo, its size / dark-background mode and the tab title come with /me
    set({ mode: me.has_access ? 'api' : 'no_access', me, error: null });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      retryAttempt = 0;
      set({ mode: 'unauthenticated', me: null, error: err.body.user_message }, nativeReasonOf401(err.body.code));
    } else if (session.mode !== 'api' && session.mode !== 'no_access' && session.mode !== 'demo' && demoOnMeFailure(err)) {
      // no backend behind this page: static preview (an installation that already answered never turns into the demo)
      set({ mode: 'demo', me: null, error: err instanceof ApiError ? err.body.user_message : null });
    } else if (session.mode === 'demo') {
      /* the demo stays the demo */
    } else {
      // SESSION-DEMO-WS-2435: a backend is there and failing for now - keep what is known (a re-read after permissions_changed keeps
      // the last answer; the server refuses what is no longer allowed), or stay connecting with nothing granted, and ask again
      const error = err instanceof ApiError ? err.body.user_message || null : null;
      if (session.mode === 'api' || session.mode === 'no_access') set({ ...session, error });
      else set({ mode: 'loading', me: null, error, retrying: true });
      scheduleMeRetry();
    }
  }
  return session;
}

const meListeners = new Set<(env: { type: string; payload?: unknown }) => void>();
/** CR-018: every message of the same per-user socket (`notification`, `notification_state`, `notify_summary`, ...) - the permissions watcher below owns the connection. */
export function onMeEvent(fn: (env: { type: string; payload?: unknown }) => void): () => void {
  meListeners.add(fn);
  return () => meListeners.delete(fn);
}

/**
 * T055: the server's access channel (`/me/ws`). It says `permissions_changed` as soon as this user's bindings, groups,
 * roles or Home Assistant active flag change; the shell then re-fetches /me (the navigation follows `session`) and
 * re-mounts the current screen. On every (re)connect the server's first message carries the current fingerprint, so
 * a change made while the socket was down is noticed too. Returns a stop function.
 */
export function watchPermissions(onChanged: () => void, env?: SocketEnv, reload: () => Promise<Session> = loadSession): () => void {
  // SESSION-DEMO-WS-2435: the shared reconnecting socket - back-off 2 s .. 60 s as before, plus the HOMELIVE-295 liveness check (the
  // server's heartbeat is every 30 s: a socket silent past SOCKET_SILENT_MS is half-open and replaced; the new socket's `hello` carries
  // the fingerprint, so a change missed meanwhile is noticed) and a retry after a constructor that throws
  // LOWS-FRONTEND-2550 (review FC-11): the server closes a handshake without a session with 4401 (no access: 4403). The socket used to
  // reconnect for the life of the page and nothing told the session, so a page whose sign-in ended stayed drawn as signed in. Now that
  // close ends the socket and the session is read once (`reload`): the shell turns to the sign-in (Ingress), or the remote channel's
  // 401 path renews the sign-in - and only while the session is still signed in afterwards is the channel opened again, after a wait
  // that doubles on each such refusal in a row (2 s .. 60 s), so a refusing server is never asked in a tight loop.
  const timers = env ?? { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown, clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  let stopped = false;
  let stopSocket: () => void = () => undefined;
  let reopen: unknown = null;
  let refusals = 0;
  const open = () => {
    if (stopped) return;
    stopSocket = openReconnectingSocket({
      url: wsUrl('me/ws'),
      env,
      onMessage: (data) => {
        refusals = 0; // the server spoke on this socket: the handshake was accepted
        meFrame(data, onChanged);
      },
      finalClose: (code) => {
        if (!(ME_WS_FINAL_CLOSE as readonly number[]).includes(code)) return false;
        const wait = Math.min(ME_WS_REOPEN_MAX_MS, ME_WS_REOPEN_MIN_MS * 2 ** refusals);
        refusals += 1;
        void reload().then(
          (s) => {
            if (stopped || (s.mode !== 'api' && s.mode !== 'no_access')) return; // the sign-in ended: the channel stays closed
            reopen = timers.setTimeout(() => {
              reopen = null;
              open();
            }, wait);
          },
          () => undefined,
        );
        return true;
      },
    });
  };
  open();
  return () => {
    stopped = true;
    if (reopen !== null) timers.clearTimeout(reopen);
    stopSocket();
  };
}

/** FC-11: the wait before `/me/ws` is opened again after a 4401 / 4403 while the session stayed signed in (doubles up to the maximum). */
const ME_WS_REOPEN_MIN_MS = 2_000;
const ME_WS_REOPEN_MAX_MS = 60_000;

/** One frame of `/me/ws`: the permissions check, then every `onMeEvent` listener.
 * LOWS-FRONTEND-2550 (review FC-09): only a malformed frame is ignored. The permissions check runs first and each listener in its own
 * `try` - a listener that throws no longer skips the check (the shell kept the old navigation) nor the listeners after it, and its
 * error reaches the console instead of vanishing. */
function meFrame(data: string, onChanged: () => void): void {
  let env: { type: string; payload?: { permissions_fingerprint?: string } };
  try {
    env = JSON.parse(data) as typeof env;
  } catch {
    return; // a malformed frame
  }
  if (!env || typeof env !== 'object' || typeof env.type !== 'string') return;
  const known = session.me?.permissions_fingerprint;
  if (env.type === 'permissions_changed') onChanged();
  else if (env.type === 'hello' && known && env.payload?.permissions_fingerprint && env.payload.permissions_fingerprint !== known) onChanged();
  for (const fn of [...meListeners]) {
    try {
      fn(env);
    } catch (err) {
      console.error('me/ws listener failed', err);
    }
  }
}

/** FC-11: the close codes after which `/me/ws` is not opened again - the server refused the handshake (no session / no access). */
const ME_WS_FINAL_CLOSE = [4401, 4403] as const;

export function can(permission: string): boolean {
  return session.me?.permissions_installation.includes(permission) ?? false;
}

/** The permission at any scope - a floor-scoped binding counts. The shell's navigation asks this (0.1.81). */
export function canAnywhere(permission: string): boolean {
  const me = session.me;
  return (me?.permissions_any ?? me?.permissions_installation ?? []).includes(permission);
}

/** The shell's navigation check: at any scope, or only at installation scope for the tabs nav.ts marks so. */
export function canNav(permission: string, installationOnly = false): boolean {
  return installationOnly ? can(permission) : canAnywhere(permission);
}

/** Who may read the NVR configuration (OSD, schedules, smart rules) - mirrors nvr_write._require_read: a system
 * administrator or anyone holding any NVR write permission. The camera screen skips those reads otherwise. */
export function canReadNvrConfig(): boolean {
  const perms = session.me?.permissions_any ?? session.me?.permissions_installation ?? [];
  return perms.some((p) => p === 'system.configure' || p.startsWith('nvr.'));
}

export const isApi = () => session.mode === 'api';

/** The one-line state shown where a screen would call a route the remote channel answers 404 on purpose
 * (`BLOCKED_ON_REMOTE` in backend/smplwise/remote_channel.py). Operator copy: no raw server error, no retry. */
export const LOCAL_ONLY_TEXT = tr('חיבור ה־NVR מנוהל רק מהרשת המקומית');
export const LOCAL_ONLY_GENERIC = tr('זמין רק מהרשת המקומית');

/** True on the remote channel (`/arx/`): the server's own answer (`/me.channel`) or, before it is known, the address. */
export const onRemote = () => session.me?.channel === 'remote' || isRemoteChannel();

/** NN1: does this installation have the capability (always true without a backend)? The shell hides what cannot work;
 * the server still refuses the routes (409 nvr_not_configured / capability_unavailable), so hiding is never the protection. */
export const cap = (name: CapabilityName): boolean => !gatesFollowCapabilities() || session.capabilities[name];

/** SESSION-DEMO-WS-2435: the capability gates read the session's capabilities with a backend and while connecting after a failed /me
 * (then all off); only the demo and the first moments before /me answers keep everything on. */
const gatesFollowCapabilities = () => session.mode === 'api' || !!session.retrying;

/** No NVR in this installation: its areas (live, cameras, events, recordings, cases, exports) are hidden and their URLs show a notice. */
export const nvrLess = () => !cap('nvr');

/** NVRLESS-CAMERAS-2411: is the video (WebRTC) server configured? Always true without a backend. */
export const webrtcServer = (): boolean => !gatesFollowCapabilities() || webrtcServerReady(session.capabilities);

/** false for a recorder installation without its media server (never "ready", D2). Always true without a backend. */
export const installationSupported = (): boolean => !gatesFollowCapabilities() || session.capabilities.supported;
