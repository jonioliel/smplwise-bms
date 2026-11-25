/**
 * FE-SAFETY-FIX-2520 (deep review 2520 frontend core, FC-02): the sign-out ends this browser's Web Push subscription. A module of its
 * own so the remote sign-out (arx/auth.ts, loaded on demand) does not pull in the push settings, the PWA registration or the shell.
 */
import { apiUrl } from '../api/client';

/** sha256(endpoint)[:32] - how the server names a subscription without handing the endpoint back. */
export async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

interface Row {
  id: string;
  endpoint_hash: string;
}

/** This browser's current push subscription under the app's worker, or null (no worker, no subscription). Never asks anything. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof window === 'undefined' || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration(new URL('./', document.baseURI).href); // the app's scope (pwa/register.appBase)
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * The sign-out ends this browser's subscription - its server row (while the session still stands) and the browser's own, so a shared or
 * borrowed device stops receiving the signed-out user's notifications. The server also removes the rows of the ended sign-in
 * (services/push.end_for_sign_ins), which covers a browser that is closed or offline at that moment. Best effort and bounded: the server
 * part waits at most `timeoutMs`, then the browser's own subscription ends anyway (a row left behind dies at the next send: the push
 * service answers 404 / 410); it never fails the sign-out. Plain fetch, not api/client's get/del: a 401 here must not start the
 * refresh-and-reload path of a page that is signing out. Resolves true when this browser had a subscription and it was ended.
 */
export async function dropOnSignOut(timeoutMs = 3000): Promise<boolean> {
  const wait = (ms: number) => {
    let timer = 0;
    const p = new Promise<false>((resolve) => {
      timer = window.setTimeout(() => resolve(false), ms);
    });
    return { p, stop: () => window.clearTimeout(timer) };
  };
  const work = (async (): Promise<boolean> => {
    const sub = await currentSubscription();
    if (!sub) return false;
    const server = (async () => {
      const hash = await endpointHash(sub.endpoint);
      const res = await fetch(apiUrl('push/subscriptions'), { credentials: 'same-origin' });
      if (!res.ok) return;
      const rows = ((await res.json()) as { subscriptions?: Row[] }).subscriptions ?? [];
      const mine = rows.find((r) => r.endpoint_hash === hash);
      if (mine) await fetch(apiUrl(`push/subscriptions/${encodeURIComponent(mine.id)}`), { method: 'DELETE', credentials: 'same-origin' });
    })().catch(() => undefined); // the server ends the row with the sign-in anyway
    const bound = wait(timeoutMs);
    await Promise.race([server, bound.p]);
    bound.stop();
    return sub.unsubscribe();
  })().catch(() => false);
  const guard = wait(timeoutMs + 2000); // a worker or push manager that never answers
  try {
    return await Promise.race([work, guard.p]);
  } finally {
    guard.stop();
  }
}
