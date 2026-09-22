/**
 * Session state: who the backend says we are, or "demo" when no backend answers (static preview,
 * design review). Screens read `session` and subscribe to changes; demo fixtures stay available so the
 * skeleton screens keep working without a server.
 */
import { ApiError, get } from './client';
import type { Me } from './types';

export type SessionMode = 'loading' | 'api' | 'demo' | 'unauthenticated' | 'no_access';

export interface Session {
  mode: SessionMode;
  me: Me | null;
  error: string | null;
}

const listeners = new Set<(s: Session) => void>();
export let session: Session = { mode: 'loading', me: null, error: null };

function set(next: Session) {
  session = next;
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

export function can(permission: string): boolean {
  return session.me?.permissions_installation.includes(permission) ?? false;
}

/** The permission at any scope - a floor-scoped binding counts. The shell's navigation asks this (0.1.81). */
export function canAnywhere(permission: string): boolean {
  const me = session.me;
  return (me?.permissions_any ?? me?.permissions_installation ?? []).includes(permission);
}

/** Who may read the NVR configuration (OSD, schedules, smart rules) - mirrors nvr_write._require_read: a system
 * administrator or anyone holding any NVR write permission. The camera screen skips those reads otherwise. */
export function canReadNvrConfig(): boolean {
  const perms = session.me?.permissions_any ?? session.me?.permissions_installation ?? [];
  return perms.some((p) => p === 'system.configure' || p.startsWith('nvr.'));
}

export const isApi = () => session.mode === 'api';
