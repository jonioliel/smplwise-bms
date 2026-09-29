/**
 * CR-008 P3: where a notification click lands. Imported ONLY by the service worker (sw.ts) and the unit test - never by
 * the app bundle, so the worker stays one self-contained classic script (a shared chunk would need an ES-module worker).
 *
 * The app lives under a base path that is not fixed: the HA Ingress prefix (`/api/hassio_ingress/<token>/`) today, the
 * remote channel's `/arx/` later. The worker's own registration scope IS that base, so every link is resolved against
 * it, and only in-app hash routes (`#/…`) are accepted - a push payload can never send a click to another path or origin.
 */

const HASH_ROUTE = /^#\/(?!\/)[A-Za-z0-9/_\-.~%?=&]*$/;

/** The scope without any hash or query: the app's base URL, ending in `/`. */
export function baseOf(scope: string): string {
  const u = new URL(scope);
  u.hash = '';
  u.search = '';
  return u.href;
}

/** The absolute URL a notification opens: the base plus the payload's hash route, or the base when the route is missing
 * or anything other than an in-app hash route (absolute URLs, `//host`, `javascript:`, other paths). */
export function resolveDeepLink(scope: string, link: unknown): string {
  const base = baseOf(scope);
  if (typeof link !== 'string' || !HASH_ROUTE.test(link) || link.length > 300) return base;
  return base + link;
}

/** Under HA Ingress the app is a frame inside Home Assistant; opening the ingress URL on its own would leave HA's
 * frame (and its session cookie) behind, so a click with no open window goes to the HA page that hosts the frame. */
export function isIngressScope(scope: string): boolean {
  return new URL(scope).pathname.startsWith('/api/hassio_ingress/');
}

/** Whether a window client's URL belongs to this app (same origin, under the base). */
export function inScope(scope: string, url: string): boolean {
  return url.startsWith(baseOf(scope));
}
