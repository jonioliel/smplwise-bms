/**
 * SmplWise Arx service worker (CR-008 P3), built to `arx-sw.js` next to index.html and registered with the app's base as
 * its scope (the Ingress prefix today, `/arx/` on the remote channel). It is a classic script: it imports only modules no
 * app code imports (deeplink.ts, offline-page.ts), so the bundler inlines them.
 *
 * Caching - the app shell only, in one cache per release (`arx-shell-<add-on version>`; activate deletes the others, so
 * old hashed files never pile up, and the version inside this file makes every release a worker update):
 * - navigations: network first; the last good index.html is the fallback, then the Hebrew offline page;
 * - hashed build assets (`assets/`): cache first - a hashed name never changes content;
 * - fonts, brand images, icons, fonts.css and the manifest (names without a hash): network first, the cache is only the
 *   offline fallback, so a changed icon or font is picked up at once;
 * - never `api/…` (data, images, downloads, WebSocket handshakes), never a Range request (video), never another origin.
 *
 * Web Push: shows the notification from the minimal payload (title, body, deep link, ids); a click focuses an open
 * Arx window and routes it to the deep link, or opens one (under Ingress: the HA page that hosts the app, with the link
 * kept for the app to pick up on start). The app badge follows the number of open notifications.
 */
import { OFFLINE_HTML } from './offline-page';
import { baseOf, inScope, isIngressScope, resolveDeepLink } from './deeplink';

interface ExtendableEvt extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchEvt extends ExtendableEvt {
  request: Request;
  respondWith(r: Response | Promise<Response>): void;
}
interface PushEvt extends ExtendableEvt {
  data: { json(): unknown; text(): string } | null;
}
interface NotificationEvt extends ExtendableEvt {
  notification: Notification;
}
interface MessageEvt extends ExtendableEvt {
  data: unknown;
}
interface SubscriptionChangeEvt extends ExtendableEvt {
  oldSubscription: PushSubscription | null;
  newSubscription: PushSubscription | null;
}
interface WinClient {
  url: string;
  focus(): Promise<WinClient>;
  postMessage(message: unknown): void;
}
interface SwGlobal {
  registration: ServiceWorkerRegistration;
  clients: {
    matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<WinClient[]>;
    openWindow(url: string): Promise<WinClient | null>;
    claim(): Promise<void>;
  };
  navigator: Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (event: never) => void): void;
  arxOpenTarget?: (data: unknown) => Promise<string>;
}

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  event_id?: string | null;
  alert_id?: string | null;
  tag?: string;
  category?: string;
  severity?: string;
}

const sw = self as unknown as SwGlobal;
const SHELL_CACHE = `arx-shell-${__ARX_BUILD__}`;
const META_CACHE = 'arx-meta';
const scope = (): string => baseOf(sw.registration.scope);
const metaKey = (name: string) => `${scope()}__arx/${name}`;

function relPath(url: URL): string | null {
  const base = new URL(scope());
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  return url.pathname.slice(base.pathname.length);
}

const UNHASHED = /^(fonts|brand|icons)\//;

sw.addEventListener('install', ((e: ExtendableEvt) => {
  // no precache list: the shell is cached as it is used; a new worker waits until the app asks it to take over
  e.waitUntil(Promise.resolve());
}) as never);

sw.addEventListener('activate', ((e: ExtendableEvt) => {
  e.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('arx-shell-') && name !== SHELL_CACHE) await caches.delete(name);
      }
      await sw.clients.claim();
    })(),
  );
}) as never);

sw.addEventListener('message', ((e: MessageEvt) => {
  const data = e.data as { type?: string; openUrl?: string } | null;
  if (data?.type === 'arx-skip-waiting') void sw.skipWaiting();
  // the app tells the worker which top-level page hosts it (under Ingress: the HA panel), for clicks with no window open
  if (data?.type === 'arx-context' && typeof data.openUrl === 'string' && /^\/(?![/\\])/.test(data.openUrl) && data.openUrl.length < 500) {
    e.waitUntil(putMeta('context', { openUrl: data.openUrl }));
  }
}) as never);

sw.addEventListener('fetch', ((e: FetchEvt) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const rel = relPath(url);
  if (rel === null || rel.startsWith('api/') || rel.startsWith('__arx/')) return; // never data, media or another origin
  // `mode: 'navigate'` fires for a same-scope IFRAME navigation too (e.g. the embedded WisKey panel, which can share
  // the app's own origin and - in a test harness registering the worker at scope `/` - even its base pathname): only
  // `destination: 'document'` is the top-level page the app-shell strategy is for. Anything else must reach the real
  // network untouched, never the cached/offline shell.
  if (req.mode === 'navigate' && req.destination === 'document') {
    e.respondWith(shell(req));
    return;
  }
  if (rel.startsWith('assets/')) e.respondWith(cacheFirst(req));
  else if (UNHASHED.test(rel) || rel === 'fonts.css' || rel === 'arx-manifest.webmanifest') e.respondWith(networkFirst(req));
}) as never);

async function shell(req: Request): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) await cache.put(scope(), res.clone());
    return res;
  } catch {
    const cached = await cache.match(scope());
    return cached || new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}

async function cacheFirst(req: Request): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
  return res;
}

async function networkFirst(req: Request): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function putMeta(name: string, value: unknown): Promise<void> {
  const cache = await caches.open(META_CACHE);
  await cache.put(metaKey(name), new Response(JSON.stringify({ ...(value as object), at: Date.now() }), { headers: { 'Content-Type': 'application/json' } }));
}

async function getMeta<T>(name: string): Promise<T | null> {
  const res = await (await caches.open(META_CACHE)).match(metaKey(name));
  return res ? ((await res.json()) as T) : null;
}

async function updateBadge(): Promise<void> {
  try {
    const n = (await sw.registration.getNotifications()).length;
    if (n && sw.navigator.setAppBadge) await sw.navigator.setAppBadge(n);
    else if (sw.navigator.clearAppBadge) await sw.navigator.clearAppBadge();
  } catch {
    /* badging is optional */
  }
}

sw.addEventListener('push', ((e: PushEvt) => {
  let d: PushData = {};
  try {
    d = (e.data?.json() as PushData) ?? {};
  } catch {
    d = { body: e.data?.text() ?? '' };
  }
  const icon = new URL('icons/arx-192.png', scope()).href;
  const badge = new URL('icons/arx-badge-72.png', scope()).href;
  e.waitUntil(
    sw.registration
      .showNotification(d.title || 'SmplWise Arx', {
        body: d.body || '',
        tag: d.tag || undefined,
        icon,
        badge,
        lang: 'he',
        dir: 'rtl',
        requireInteraction: d.severity === 'critical',
        data: { url: d.url, event_id: d.event_id ?? null, alert_id: d.alert_id ?? null },
      })
      .then(updateBadge),
  );
}) as never);

/** Route an open Arx window to the notification's deep link, or open one. Returns what it did (tests read it). */
async function openTarget(data: unknown): Promise<string> {
  const target = resolveDeepLink(scope(), (data as { url?: unknown } | null)?.url);
  const hash = new URL(target).hash || '#/';
  const windows = (await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((c) => inScope(scope(), c.url));
  if (windows.length) {
    const w = windows[0];
    w.postMessage({ type: 'arx-navigate', hash });
    try {
      await w.focus();
    } catch {
      /* focusing needs the click's user activation; the route change above does not */
    }
    return 'focused';
  }
  await putMeta('pending', { hash });
  let url = target;
  if (isIngressScope(scope())) {
    const ctx = await getMeta<{ openUrl?: string }>('context');
    url = ctx?.openUrl || '/';
  }
  await sw.clients.openWindow(url);
  return 'opened';
}
sw.arxOpenTarget = openTarget;

sw.addEventListener('notificationclick', ((e: NotificationEvt) => {
  e.notification.close();
  e.waitUntil(openTarget(e.notification.data).then(updateBadge));
}) as never);

sw.addEventListener('notificationclose', ((e: NotificationEvt) => {
  e.waitUntil(updateBadge());
}) as never);

sw.addEventListener('pushsubscriptionchange', ((e: SubscriptionChangeEvt) => {
  // the push service replaced the subscription: subscribe again with the same server key and tell the backend, naming
  // the old endpoint so exactly that row is replaced. If the session has expired the app re-syncs on its next start.
  e.waitUntil(
    (async () => {
      const old = e.oldSubscription;
      let key = old?.options?.applicationServerKey ?? null;
      if (!key) {
        const r = await fetch(new URL('api/v1/push/vapid-key', scope()), { credentials: 'same-origin' });
        if (!r.ok) return;
        const b64 = ((await r.json()) as { public_key: string }).public_key.replace(/-/g, '+').replace(/_/g, '/');
        key = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)).buffer;
      }
      const sub = e.newSubscription ?? (await sw.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      const json = sub.toJSON();
      await fetch(new URL('api/v1/push/subscriptions', scope()), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, old_endpoint: old?.endpoint ?? null }),
      });
    })().catch(() => undefined),
  );
}) as never);
