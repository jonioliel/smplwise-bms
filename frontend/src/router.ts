// Minimal hash router. Hash routes survive the HA Ingress path prefix and iframe embedding without
// any server-side rewrite. Route: `#/explore/floors/f0?state=empty`.
// `devices` (CR-007, 2026-09-28): "חשמל והתקנים", a top-level area of its own like `wiskey` (see the ADR-009 notes in
// docs/architecture/DECISIONS.md).
// `security` (CR-010, 2026-09-29): the security area's own routes - #/security/alarm, and #/security (the last used section).
// `multimedia` (CR-015, 2026-09-30): the screens and the remote - #/multimedia/screens (players and groups come in 0.1.150).
// `infra` (CR-023, 2026-10-04): "תשתיות" - #/infra/electricity/<page> (docs/architecture/ELECTRICITY_UI_SHELL.md).
export type Mode = 'live' | 'explore' | 'investigate' | 'system' | 'wiskey' | 'devices' | 'security' | 'multimedia' | 'infra';

export interface RouteState {
  path: string;
  segments: string[];
  params: URLSearchParams;
  mode: Mode | null;
}

const MODES: Mode[] = ['live', 'explore', 'investigate', 'system', 'wiskey', 'devices', 'security', 'multimedia', 'infra'];

export function parseRoute(hash: string = window.location.hash): RouteState {
  const raw = hash.replace(/^#/, '') || '/explore/floors/f0';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const segments = path.split('/').filter(Boolean);
  const first = segments[0] as Mode | undefined;
  return {
    path,
    segments,
    params: new URLSearchParams(queryPart),
    mode: first && MODES.includes(first) ? first : null,
  };
}

export function navigate(path: string, params?: Record<string, string>): void {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  window.location.hash = `#${path}${query}`;
}

/** Fired on `window` after `replaceRoute`: the address changed without a history entry and without a `hashchange`. */
export const ROUTE_REPLACED = 'sw-route-replaced';

/** Rewrite the current route in place (history.replaceState, the router's `history.state` kept): no new history entry
 * and no `hashchange`, so it is never mistaken for the user's intent. The shell re-reads the route on ROUTE_REPLACED.
 * Used by the WisKey embed to mirror the panel's confirmed location (embed API v1). */
export function replaceRoute(path: string, params?: URLSearchParams): void {
  writeRoute(path, params, false);
}

/** Like replaceRoute but as a NEW history entry (history.pushState): the WisKey embed records a tab change the user
 * asked for only once the panel confirmed it, so a declined change leaves no entry behind. */
export function pushRoute(path: string, params?: URLSearchParams): void {
  writeRoute(path, params, true);
}

function writeRoute(path: string, params: URLSearchParams | undefined, push: boolean): void {
  const query = params && params.toString() ? `?${params.toString()}` : '';
  const hash = `#${path}${query}`;
  if (window.location.hash === hash) return;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (push) window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new CustomEvent(ROUTE_REPLACED));
}

/** eplaced is true for replaceRoute / pushRoute (the program moved the address), false for a hashchange. */
export function onRouteChange(handler: (route: RouteState, replaced: boolean) => void): () => void {
  const onHash = () => handler(parseRoute(), false);
  const onReplaced = () => handler(parseRoute(), true);
  window.addEventListener('hashchange', onHash);
  window.addEventListener(ROUTE_REPLACED, onReplaced);
  handler(parseRoute(), false);
  return () => {
    window.removeEventListener('hashchange', onHash);
    window.removeEventListener(ROUTE_REPLACED, onReplaced);
  };
}
