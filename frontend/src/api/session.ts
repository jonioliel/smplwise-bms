/**
 * Session state: who the backend says we are, or "demo" when no backend answers (static preview,
 * design review). Screens read `session` and subscribe to changes; demo fixtures stay available so the
 * skeleton screens keep working without a server.
 */
import { ApiError, apiUrl, get } from './client';
import { ALL_CAPABILITIES, resolveCapabilities, type Capabilities, type CapabilityName } from './capabilities';
import type { Me } from './types';

export type SessionMode = 'loading' | 'api' | 'demo' | 'unauthenticated' | 'no_access';

export interface Session {
  mode: SessionMode;
  me: Me | null;
  error: string | null;
  /** NN1: what the installation has (derived from `me`; everything on without a backend). */
  capabilities: Capabilities;
}

const listeners = new Set<(s: Session) => void>();
export let session: Session = { mode: 'loading', me: null, error: null, capabilities: ALL_CAPABILITIES };

function set(next: Omit<Session, 'capabilities'>) {
  session = { ...next, capabilities: resolveCapabilities(next.me) };
  listeners.forEach((fn) => fn(session));
}

export function onSession(fn: (s: Session) => void): () => void {
  listeners.add(fn);
  fn(session);
  return () => listeners.delete(fn);
}

export async function loadSession(): Promise<Session> {
  try {
    const me = await get<Me>('me');
    set({ mode: me.has_access ? 'api' : 'no_access', me, error: null });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) set({ mode: 'unauthenticated', me: null, error: err.body.user_message });
    else if (err instanceof ApiError) set({ mode: 'demo', me: null, error: err.body.user_message });
    else set({ mode: 'demo', me: null, error: null }); // no backend behind this page: static preview
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
export function watchPermissions(onChanged: () => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = 2000;
  const url = (() => {
    const u = new URL(apiUrl('me/ws'));
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  })();
  const open = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onopen = () => {
      delay = 2000;
    };
    ws.onmessage = (m) => {
      try {
        const env = JSON.parse(m.data as string) as { type: string; payload?: { permissions_fingerprint?: string } };
        meListeners.forEach((fn) => fn(env));
        const known = session.me?.permissions_fingerprint;
        if (env.type === 'permissions_changed') onChanged();
        else if (env.type === 'hello' && known && env.payload?.permissions_fingerprint && env.payload.permissions_fingerprint !== known) onChanged();
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (!stopped) {
        window.setTimeout(open, delay);
        delay = Math.min(60000, delay * 2);
      }
    };
  };
  open();
  return () => {
    stopped = true;
    ws?.close();
  };
}

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

/** NN1: does this installation have the capability (always true without a backend)? The shell hides what cannot work;
 * the server still refuses the routes (409 nvr_not_configured / capability_unavailable), so hiding is never the protection. */
export const cap = (name: CapabilityName): boolean => session.mode !== 'api' || session.capabilities[name];

/** No NVR in this installation: its areas (live, cameras, events, recordings, cases, exports) are hidden and their URLs show a notice. */
export const nvrLess = () => !cap('nvr');

/** false for a recorder installation without its media server (never "ready", D2). Always true without a backend. */
export const installationSupported = (): boolean => session.mode !== 'api' || session.capabilities.supported;
