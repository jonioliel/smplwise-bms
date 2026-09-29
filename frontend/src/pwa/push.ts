/**
 * CR-008 P3: Web Push on the client - this browser's push subscription (through the app's own service worker) and the
 * backend's `push/*` API. The subscription belongs to the signed-in HA user; the same user id counts whether the app is
 * open inside Home Assistant (Ingress) or on the remote channel.
 */
import { del, get, post, put } from '../api/client';
import { appBase, isFramed, isIos, isStandalone } from './register';

export type PushCategory = 'alerts' | 'doors' | 'device_faults' | 'system';

export interface PushPrefs {
  categories: Record<PushCategory, boolean>;
  quiet: { enabled: boolean; from: string; to: string; allow_critical: boolean };
  updated_at: string | null;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint_host: string;
  endpoint_hash: string;
  user_agent: string | null;
  channel: string | null;
  created_at: string;
  last_seen_at: string;
  last_ok_at: string | null;
  failures: number;
  last_error: string | null;
}

export const getVapidKey = () => get<{ public_key: string }>('push/vapid-key');
export const listSubscriptions = () => get<{ subscriptions: PushSubscriptionRow[] }>('push/subscriptions');
export const deleteSubscription = (id: string) => del(`push/subscriptions/${encodeURIComponent(id)}`);
export const getPrefs = () => get<PushPrefs>('push/prefs');
export const putPrefs = (p: Pick<PushPrefs, 'categories' | 'quiet'>) => put<PushPrefs>('push/prefs', p);
export const sendTest = () => post<{ sent: number; results: { id: string; endpoint_host: string; status: number; outcome: string }[] }>('push/test');

/** Why push cannot be switched on here, or 'ok'. */
export type PushSupport = 'ok' | 'insecure' | 'unsupported' | 'ios_install' | 'denied';

export function pushSupport(): PushSupport {
  if (!window.isSecureContext) return 'insecure';
  // iOS/iPadOS deliver Web Push only to an app added to the home screen (16.4+)
  if (isIos() && !isStandalone() && !isFramed()) return 'ios_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** sha256(endpoint)[:32] - how the server names a subscription without handing the endpoint back. */
export async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(appBase());
  if (!reg) return null;
  return reg.active ? reg : navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function register(sub: PushSubscription, oldEndpoint?: string): Promise<PushSubscriptionRow> {
  const json = sub.toJSON();
  return post<PushSubscriptionRow>('push/subscriptions', { endpoint: sub.endpoint, keys: json.keys, user_agent: navigator.userAgent.slice(0, 300), old_endpoint: oldEndpoint ?? null });
}

/** Ask for permission, subscribe this browser with the installation's key and register it for the current user. */
export async function subscribeThisDevice(): Promise<PushSubscriptionRow> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'ההתראות נחסמו בדפדפן. אפשר לשחרר אותן בהגדרות האתר.' : 'לא אושרה הצגת התראות.');
  const reg = await registration();
  if (!reg) throw new Error('רכיב הרקע של Arx (service worker) לא נטען; רעננו את הדף ונסו שוב.');
  const { public_key } = await getVapidKey();
  const key = keyBytes(public_key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe(); // made for another key (another installation, or the data was reset)
    sub = null;
  }
  sub = sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  return register(sub);
}

/** Remove this browser's subscription (server row first, then the browser's own). */
export async function unsubscribeThisDevice(rows: PushSubscriptionRow[]): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const hash = await endpointHash(sub.endpoint);
  const mine = rows.find((r) => r.endpoint_hash === hash);
  if (mine) await deleteSubscription(mine.id);
  await sub.unsubscribe();
}

/** On every start: when this browser is subscribed, refresh the server row (it keeps `last_seen_at` fresh, recovers a
 * subscription the worker could not report, and moves it to the user now signed in). Never asks for permission. */
export async function syncSubscription(): Promise<void> {
  try {
    if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (!sub) return;
    const { public_key } = await getVapidKey();
    if (!sameKey(sub.options?.applicationServerKey, keyBytes(public_key))) {
      const reg = await registration();
      await sub.unsubscribe();
      if (reg) await register(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(public_key) }), sub.endpoint);
      return;
    }
    await register(sub);
  } catch {
    /* best effort; the settings tab shows the real state */
  }
}

/** A readable name for a push service host. */
export function serviceName(host: string): string {
  if (host.endsWith('googleapis.com')) return 'Chrome / Android';
  if (host.endsWith('mozilla.com')) return 'Firefox';
  if (host.endsWith('push.apple.com')) return 'Safari / iPhone';
  if (host.endsWith('notify.windows.com')) return 'Edge / Windows';
  return host;
}
